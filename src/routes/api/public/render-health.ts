import { createFileRoute } from "@tanstack/react-router";

/**
 * Render worker health check, used by /settings/rendering and anywhere the
 * app needs to know honestly whether server-side MP4 export is connected.
 * Never forwards or leaks the shared auth token to the browser.
 */
export const Route = createFileRoute("/api/public/render-health")({
  server: {
    handlers: {
      GET: async () => {
        const base = process.env["REMOTION_WORKER_URL"];
        if (!base) {
          return Response.json({ configured: false, ok: false, latencyMs: null, worker: null });
        }
        const token = process.env["REMOTION_WORKER_TOKEN"];
        const started = Date.now();
        try {
          const upstream = await fetch(`${base.replace(/\/$/, "")}/health`, {
            headers: token ? { authorization: `Bearer ${token}` } : {},
            signal: AbortSignal.timeout(8000),
          });
          const latencyMs = Date.now() - started;
          if (!upstream.ok) {
            return Response.json({
              configured: true,
              ok: false,
              latencyMs,
              worker: `Worker responded with ${upstream.status}`,
            });
          }
          const json = (await upstream.json().catch(() => ({}))) as { ok?: boolean };
          return Response.json({
            configured: true,
            ok: json.ok !== false,
            latencyMs,
            worker: base.replace(/^https?:\/\//, ""),
          });
        } catch (err) {
          return Response.json({
            configured: true,
            ok: false,
            latencyMs: Date.now() - started,
            worker: err instanceof Error ? err.message : "Could not reach the render worker",
          });
        }
      },
    },
  },
});
