import { createFileRoute } from "@tanstack/react-router";

/**
 * Streams the finished MP4 back through the app's own origin so the browser's
 * `download` attribute works and the worker URL never has to be public.
 */
export const Route = createFileRoute("/api/public/render-download/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const base = process.env["REMOTION_WORKER_URL"];
        if (!base) return new Response("Render service not connected", { status: 503 });
        const token = process.env["REMOTION_WORKER_TOKEN"];
        const upstream = await fetch(
          `${base.replace(/\/$/, "")}/download/${encodeURIComponent(params.id)}`,
          { headers: token ? { authorization: `Bearer ${token}` } : {} },
        );
        if (!upstream.ok || !upstream.body) {
          return new Response("The rendered file is no longer available", { status: 404 });
        }
        return new Response(upstream.body, {
          headers: {
            "content-type": "video/mp4",
            "content-disposition": `attachment; filename="tempo-${params.id.slice(0, 8)}.mp4"`,
            ...(upstream.headers.get("content-length")
              ? { "content-length": upstream.headers.get("content-length")! }
              : {}),
          },
        });
      },
    },
  },
});
