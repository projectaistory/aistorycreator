import { Agent, fetch as undiciFetch } from "undici";
import { nanoid } from "nanoid";

/**
 * Downloads from third-party CDNs (e.g. WaveSpeed result URLs). Node’s default fetch
 * uses short connect timeouts; large images over slow TLS often throw `fetch failed`.
 */
const assetDownloadAgent = new Agent({
  connectTimeout: 180_000,
  headersTimeout: 600_000,
  bodyTimeout: 600_000,
  keepAliveTimeout: 120_000,
});

const bunnyUploadAgent = new Agent({
  connectTimeout: 120_000,
  headersTimeout: 600_000,
  bodyTimeout: 600_000,
});

type BunnyTrace = (line: string) => void | Promise<void>;

type EnsureOnBunnyOptions = {
  folderEnvVar: "BUNNY_STORAGE_CHARACTERS_PATH" | "BUNNY_STORAGE_FINAL_PATH";
  defaultFolder: string;
  preferredExt: string;
  contentType: string;
  label?: string;
  trace?: BunnyTrace;
  maxBytes?: number;
};

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

function getBunnyConfig() {
  const zone = process.env.BUNNY_STORAGE_ZONE?.trim();
  const accessKey = bunnyStorageAccessKey();
  const cdnHost = process.env.BUNNY_CDN_HOST?.trim()?.replace(/^https?:\/\//, "");
  const storageHost = bunnyStorageApiHostname();
  if (!zone || !accessKey || !cdnHost) {
    throw new Error(
      "Bunny is not fully configured. Required: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD (or BUNNY_STORAGE_API_KEY), BUNNY_CDN_HOST."
    );
  }
  return { zone, accessKey, cdnHost, storageHost };
}

function cleanFolder(folder: string): string {
  return folder.replace(/^\/+/, "").replace(/\/+$/, "");
}

function pickExtension(sourceUrl: string, preferredExt: string): string {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const raw = pathname.split(".").pop()?.toLowerCase();
    if (raw && /^[a-z0-9]{2,5}$/.test(raw)) return raw;
  } catch {
    // Keep preferred extension.
  }
  return preferredExt.replace(/^\./, "");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadToBuffer(
  sourceUrl: string,
  maxBytes: number
): Promise<Buffer> {
  const attempts = 3;
  let lastErr: unknown;
  for (let a = 1; a <= attempts; a++) {
    try {
      const res = await undiciFetch(sourceUrl, {
        method: "GET",
        redirect: "follow",
        dispatcher: assetDownloadAgent,
        headers: {
          Accept: "image/*,*/*;q=0.8",
          "User-Agent": "AiStoryCreator-asset-fetch/1.0",
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Source download failed (${res.status}): ${text.slice(0, 220)}`
        );
      }
      const cl = res.headers.get("content-length");
      if (cl) {
        const n = parseInt(cl, 10);
        if (!Number.isNaN(n) && n > maxBytes) {
          throw new Error(`Source file too large (${n} bytes, max ${maxBytes})`);
        }
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) {
        throw new Error(
          `Source file too large (${buf.length} bytes, max ${maxBytes})`
        );
      }
      return buf;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const retryable =
        a < attempts &&
        (msg.includes("fetch failed") ||
          msg.includes("ECONNRESET") ||
          msg.includes("ETIMEDOUT") ||
          msg.includes("UND_ERR_CONNECT_TIMEOUT") ||
          msg.includes("UND_ERR_HEADERS_TIMEOUT") ||
          msg.includes("UND_ERR_BODY_TIMEOUT"));
      if (retryable) {
        await sleep(800 * a);
        continue;
      }
      let host = "remote host";
      try {
        host = new URL(sourceUrl).hostname;
      } catch {
        /* ignore */
      }
      throw e instanceof Error
        ? new Error(`Could not download image from ${host}: ${msg}`)
        : e;
    }
  }
  throw lastErr;
}

function isAlreadyOnConfiguredBunnyCdn(sourceUrl: string): boolean {
  const cdnHost = process.env.BUNNY_CDN_HOST?.trim()?.replace(/^https?:\/\//, "");
  if (!cdnHost) return false;
  try {
    return new URL(sourceUrl).hostname.toLowerCase() === cdnHost.toLowerCase();
  } catch {
    return false;
  }
}

export async function ensureUrlOnBunnyStorage(
  sourceUrl: string,
  options: EnsureOnBunnyOptions
): Promise<string> {
  if (!sourceUrl?.trim()) {
    throw new Error("Cannot upload empty source URL to Bunny");
  }

  if (isAlreadyOnConfiguredBunnyCdn(sourceUrl)) {
    return sourceUrl;
  }

  const { zone, accessKey, cdnHost, storageHost } = getBunnyConfig();
  const folderRaw =
    process.env[options.folderEnvVar]?.trim() || options.defaultFolder;
  const folder = cleanFolder(folderRaw);
  const ext = pickExtension(sourceUrl, options.preferredExt);
  const objectPath = folder
    ? `${folder}/${nanoid()}.${ext}`
    : `${nanoid()}.${ext}`;
  const putUrl = `https://${storageHost}/${zone}/${objectPath}`;
  const maxBytes = options.maxBytes ?? 300 * 1024 * 1024;

  await options.trace?.(
    `bunny upload ${options.label ?? "asset"} start source=${sourceUrl}`
  );
  const buffer = await downloadToBuffer(sourceUrl, maxBytes);
  const up = await undiciFetch(putUrl, {
    method: "PUT",
    dispatcher: bunnyUploadAgent,
    headers: {
      AccessKey: accessKey,
      "Content-Type": options.contentType,
    },
    body: new Uint8Array(buffer),
  });
  if (!up.ok) {
    const text = await up.text();
    throw new Error(`Bunny upload failed (${up.status}): ${text.slice(0, 280)}`);
  }

  const cdnUrl = `https://${cdnHost}/${objectPath}`;
  await options.trace?.(
    `bunny upload ${options.label ?? "asset"} done url=${cdnUrl}`
  );
  return cdnUrl;
}
