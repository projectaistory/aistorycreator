/**
 * Human-readable URL summaries for logs (avoid dumping full signed URLs).
 */
export function summarizeMediaUrl(url: string): string {
  try {
    const u = new URL(url);
    const path =
      u.pathname.length > 48 ? `${u.pathname.slice(0, 48)}…` : u.pathname;
    return `${u.hostname}${path} [chars=${url.length}]`;
  } catch {
    return `[invalid-url chars=${String(url).length}]`;
  }
}

export function pipelineTraceLine(scope: string, detail: string): string {
  return `${new Date().toISOString()} [${scope}] ${detail}`;
}
