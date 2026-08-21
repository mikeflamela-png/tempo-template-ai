import { createFileRoute } from "@tanstack/react-router";

/**
 * Export pipeline entry point.
 *
 * The browser posts the job JSON plus the actual source clips as multipart; we
 * forward the whole body to the Remotion render worker (Chromium + ffmpeg),
 * which the edge runtime cannot host itself.
 */
export const Route = createFileRoute("/api/public/render")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const base = process.env["REMOTION_WORKER_URL"];
        if (!base) {
          return Response.json({ configured: false }, { status: 200 });
        }
        const token = process.env["REMOTION_WORKER_TOKEN"];
        // The body is multipart: without the original content-type (and its
        // boundary) the worker cannot parse a single field.
        const contentType = request.headers.get("content-type");
        const upstream = await fetch(`${base.replace(/\/$/, "")}/render`, {
          method: "POST",
          headers: {
            ...(contentType ? { "content-type": contentType } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: request.body,
          // required by undici/workerd when streaming a request body
          duplex: "half",
        } as RequestInit);
        if (!upstream.ok) {
          const detail = (await upstream.text().catch(() => "")).slice(0, 500);
          return Response.json(
            {
              configured: true,
              error: `Render worker rejected the job (${upstream.status})${detail ? `: ${detail}` : ""}`,
            },
            { status: 502 },
          );
        }

        const json = (await upstream.json()) as { jobId: string };
        return Response.json({ configured: true, jobId: json.jobId });
      },
    },
  },
});
