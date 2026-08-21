/**
 * Builds the Remotion bundle at IMAGE BUILD TIME.
 *
 * Bundling with webpack is by far the most memory-hungry step of a render;
 * doing it inside the running service made the container run out of memory and
 * restart mid-job (the request died with a 502 and the job id was lost).
 * Baking the bundle into the image means the service only ever renders.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const outDir = await bundle({
  entryPoint: path.join(ROOT, "src/remotion/index.ts"),
  outDir: path.join(__dirname, "bundle"),
  webpackOverride: (c) => ({
    ...c,
    resolve: {
      ...c.resolve,
      alias: { ...(c.resolve?.alias ?? {}), "@": path.join(ROOT, "src") },
    },
  }),
});

console.log(`Prebundled Remotion composition to ${outDir}`);
