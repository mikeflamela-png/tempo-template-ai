import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/render-status/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const base = process.env["REMOTION_WORKER_URL"];
        if (!base) return Response.json({ configured: false }, { status: 200 });
        const token = process.env["REMOTION_WORKER_TOKEN"];
        const upstream = await fetch(
          `${base.replace(/\/$/, "")}/status/${encodeURIComponent(params.id)}`,
          { headers: token ? { authorization: `Bearer ${token}` } : {} },
        );
        if (!upstream.ok) {
          return Response.json(
            { configured: true, state: "error", error: `Status check failed (${upstream.status})` },
            { status: 502 },
          );
        }
        const json = await upstream.json();
        return Response.json({ configured: true, ...(json as object) });
      },
    },
  },
});
