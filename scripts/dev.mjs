import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { context } from "esbuild";
import { notFound, safePath, sendFile } from "./server-utils.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(projectRoot, ".chargegrid-dev");
const publicRoot = resolve(projectRoot, "public");
const requestedPort = Number(process.env.PORT || 5173);
const clients = new Set();
let firstBuild = true;

const liveReloadPlugin = {
  name: "chargegrid-live-reload",
  setup(build) {
    build.onEnd((result) => {
      if (!firstBuild && result.errors.length === 0) {
        clients.forEach((response) => response.write("data: reload\n\n"));
      }
      firstBuild = false;
    });
  },
};

const buildContext = await context({
  absWorkingDir: projectRoot,
  bundle: true,
  entryNames: "app",
  entryPoints: ["src/main.jsx"],
  format: "esm",
  jsx: "automatic",
  logLevel: "info",
  outdir: outputRoot,
  plugins: [liveReloadPlugin],
  sourcemap: "inline",
  target: ["es2022"],
});

await buildContext.rebuild();
await buildContext.watch();

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  if (url.pathname === "/__chargegrid_reload") {
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    });
    response.write("data: connected\n\n");
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    const source = await readFile(resolve(projectRoot, "index.html"), "utf8");
    const liveReload = `<script>new EventSource('/__chargegrid_reload').onmessage=function(event){if(event.data==='reload')location.reload()}</script>`;
    const html = source.replace("</body>", `${liveReload}</body>`);
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(html);
    return;
  }

  const outputFile = safePath(outputRoot, url.pathname);
  if (outputFile && (await sendFile(response, outputFile))) return;
  const publicFile = safePath(publicRoot, url.pathname);
  if (publicFile && (await sendFile(response, publicFile))) return;

  notFound(response);
});

server.listen(requestedPort, "0.0.0.0", () => {
  console.log(`\nChargeGrid pronta em http://localhost:${requestedPort}`);
  console.log("Alterações em src/ recarregam o navegador automaticamente.\n");
});

async function shutdown() {
  clients.forEach((response) => response.end());
  await buildContext.dispose();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
