/**
 * neonvideo_merge on ffmpegapi often times out downloading `www.ffmpegapi.net/download/…`
 * URLs (narrator mux outputs from merge_videos). Those same URLs work from our app, but
 * their workers hit a 120s limit fetching their own CDN.
 *
 * We download those segments here and upload to a public origin they can fetch quickly
 * (Vercel Blob or Bunny). Other hosts (e.g. WaveSpeed CloudFront) are left as-is.
 */

import { Agent, fetch as undiciFetch } from "undici";
import { nanoid } from "nanoid";
import { put } from "@vercel/blob";
import { summarizeMediaUrl } from "@/lib/pipelineTrace";

const downloadAgent = new Agent({
  connectTimeout: 180_000,
  headersTimeout: 600_000,
  bodyTimeout: 600_000,
});

const MAX_SEGMENT_BYTES = 280 * 1024 * 1024;

export type SegmentMirrorTrace = (msg: string) => void | Promise<void>;

function hostNeedsMirror(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "www.ffmpegapi.net" ||
    h === "ffmpegapi.net" ||
    h.endsWith(".ffmpegapi.net")
  );
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await undiciFetch(url, {
    method: "GET",
    dispatcher: downloadAgent,
    redirect: "follow",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Mirror download failed (${res.status}): ${t.slice(0, 200)}`);
  }

  const cl = res.headers.get("content-length");
  if (cl) {
    const n = parseInt(cl, 10);
    if (!Number.isNaN(n) && n > MAX_SEGMENT_BYTES) {
      throw new Error(`Segment too large (${n} bytes, max ${MAX_SEGMENT_BYTES})`);
    }
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_SEGMENT_BYTES) {
    throw new Error(`Segment too large (${buf.length} bytes, max ${MAX_SEGMENT_BYTES})`);
  }
  return buf;
}

/**
 * Bunny Edge Storage PUT auth: header `AccessKey` must be the **Storage zone password**
 * (Dashboard → Storage → your zone → FTP & API → password), NOT the global Bunny account API key.
 */
function bunnyStorageAccessKey(): string | undefined {
  const password =
    process.env.BUNNY_STORAGE_PASSWORD?.trim() ||
    process.env.BUNNY_STORAGE_ZONE_PASSWORD?.trim();
  if (password) return password;
  return process.env.BUNNY_STORAGE_API_KEY?.trim();
}

function bunnyStorageApiHostname(): string {
  const raw =
    process.env.BUNNY_STORAGE_HOSTNAME?.trim() ||
    process.env.BUNNY_STORAGE_HOST?.trim() ||
    "storage.bunnycdn.com";
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Folder inside the storage zone (no leading/trailing slashes). */
function bunnyMirrorObjectPath(): string {
  const folder = (
    process.env.BUNNY_STORAGE_MIRROR_PATH?.trim() ||
    process.env.BUNNY_STORAGE_SCENES_PATH?.trim() ||
    process.env.BUNNY_STORAGE_IMAGESCENES_PATH?.trim() ||
    "story-segments"
  )
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  const file = `${nanoid()}.mp4`;
  return folder ? `${folder}/${file}` : file;
}

async function uploadPublicMp4(buffer: Buffer): Promise<string> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (blobToken) {
    const pathname = `story-segments/${nanoid()}.mp4`;
    const blob = await put(pathname, buffer, {
      access: "public",
      token: blobToken,
      contentType: "video/mp4",
      multipart: buffer.length > 8 * 1024 * 1024,
    });
    return blob.url;
  }

  const zone = process.env.BUNNY_STORAGE_ZONE?.trim();
  const accessKey = bunnyStorageAccessKey();
  const cdnHost = process.env.BUNNY_CDN_HOST?.trim()?.replace(/^https?:\/\//, "");
  const storageHost = bunnyStorageApiHostname();

  if (zone && accessKey && cdnHost) {
    const objectPath = bunnyMirrorObjectPath();
    const putUrl = `https://${storageHost}/${zone}/${objectPath}`;

    const up = await fetch(putUrl, {
      method: "PUT",
      headers: {
        AccessKey: accessKey,
        "Content-Type": "video/mp4",
      },
      body: new Uint8Array(buffer),
    });
    if (!up.ok) {
      const errText = await up.text();
      throw new Error(`Bunny upload failed (${up.status}): ${errText.slice(0, 300)}`);
    }
    return `https://${cdnHost}/${objectPath}`;
  }

  throw new Error(
    "Narrator clips use www.ffmpegapi.net/download URLs; neonvideo_merge times out fetching them from ffmpegapi’s servers. " +
      "Set BLOB_READ_WRITE_TOKEN (Vercel Blob) or Bunny: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD (storage zone FTP/API password), " +
      "BUNNY_CDN_HOST (pull zone host, e.g. neonvideo.b-cdn.net), optional BUNNY_STORAGE_HOSTNAME (e.g. ny.storage.bunnycdn.com)."
  );
}

/**
 * If `url` is on ffmpegapi.net download hosts, download and re-upload to Blob/Bunny so
 * neonvideo_merge can fetch it. Used for initial segments **and** every intermediate
 * pair-merge output (those are ffmpegapi URLs again and time out on the next merge).
 */
export async function mirrorFfmpegDownloadUrlIfNeeded(
  url: string,
  trace?: SegmentMirrorTrace,
  label?: string
): Promise<string> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    await trace?.(`mirror ${label ?? "?"} invalid URL, passing through`);
    return url;
  }

  if (!hostNeedsMirror(host)) {
    await trace?.(`mirror ${label ?? "clip"} skip host=${host}`);
    return url;
  }

  await trace?.(
    `mirror ${label ?? "ffmpeg-output"} (${host}) for neonvideo_merge…`
  );
  const buf = await downloadToBuffer(url);
  await trace?.(
    `mirror ${label ?? ""} downloaded ${(buf.length / (1024 * 1024)).toFixed(2)} MiB`
  );
  const publicUrl = await uploadPublicMp4(buf);
  await trace?.(
    `mirror ${label ?? ""} OK → ${summarizeMediaUrl(publicUrl)}`
  );
  return publicUrl;
}

/**
 * For each segment URL, mirror ffmpegapi.net download URLs (initial scene list).
 */
export async function normalizeSegmentUrlsForNeonvideoMerge(
  urls: string[],
  trace?: SegmentMirrorTrace
): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    out.push(
      await mirrorFfmpegDownloadUrlIfNeeded(
        urls[i],
        trace,
        `segment[${i}]`
      )
    );
  }
  return out;
}
