import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { notFound, safePath, sendFile } from "./server-utils.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(projectRoot, "dist");
const requestedPort = Number(process.env.PORT || 4173);

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filename = safePath(outputRoot, pathname);
  if (filename && (await sendFile(response, filename))) return;
  notFound(response);
});

server.listen(requestedPort, "0.0.0.0", () => {
  console.log(`ChargeGrid disponível em http://localhost:${requestedPort}`);
});
