import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

export function safePath(root, pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0]);
  const candidate = resolve(root, `.${decoded}`);
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

export async function sendFile(response, filename) {
  try {
    const info = await stat(filename);
    if (!info.isFile()) return false;
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Length": info.size,
      "Content-Type": MIME_TYPES[extname(filename)] || "application/octet-stream",
    });
    createReadStream(filename).pipe(response);
    return true;
  } catch {
    return false;
  }
}

export function notFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Arquivo não encontrado.");
}
