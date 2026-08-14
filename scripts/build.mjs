import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(projectRoot, "dist");

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });

await build({
  absWorkingDir: projectRoot,
  bundle: true,
  entryNames: "app",
  entryPoints: ["src/main.jsx"],
  format: "esm",
  jsx: "automatic",
  legalComments: "none",
  minify: true,
  outdir: outputRoot,
  sourcemap: true,
  target: ["es2020"],
});

const html = await readFile(resolve(projectRoot, "index.html"), "utf8");
await writeFile(resolve(outputRoot, "index.html"), html, "utf8");
await cp(resolve(projectRoot, "public"), outputRoot, { recursive: true });

console.log("Build concluído em dist/.");
