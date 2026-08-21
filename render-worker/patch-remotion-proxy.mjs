/**
 * Remotion 4's required off-thread media proxy binds to 0.0.0.0 by default.
 * Render treats that internal listener as a second public web port and may
 * route health/status traffic to it. Keep the proxy reachable by Chromium but
 * private to the container by binding it to IPv4 loopback.
 */
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rendererPackage = require.resolve("@remotion/renderer/package.json");
const serveStatic = new URL("./dist/serve-static.js", `file://${rendererPackage}`).pathname;
const before = "server.listen({ port, host: portConfig.host });";
const after = "server.listen({ port, host: '127.0.0.1' });";
const source = fs.readFileSync(serveStatic, "utf8");

if (source.includes(after)) {
  console.log(`Remotion proxy already patched: ${serveStatic}`);
} else if (source.includes(before)) {
  fs.writeFileSync(serveStatic, source.replace(before, after));
  console.log(`Patched Remotion proxy to loopback-only: ${serveStatic}`);
} else {
  throw new Error(
    `Unsupported @remotion/renderer serve-static implementation at ${serveStatic}; refusing an unsafe build`,
  );
}

const verified = fs.readFileSync(serveStatic, "utf8");
if (!verified.includes(after) || verified.includes(before)) {
  throw new Error("Remotion proxy loopback patch verification failed");
}