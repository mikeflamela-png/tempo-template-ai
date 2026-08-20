import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const submitSchema = z.object({
  payload: z.unknown(),
});

const statusSchema = z.object({ jobId: z.string().min(1) });

/**
 * Submits a render job to the Remotion render worker.
 *
 * The worker is an external Node service (Remotion's renderer needs a real
 * Chromium + ffmpeg, which the edge runtime cannot provide). Configure it with
 * the REMOTION_WORKER_URL secret; the app degrades to a downloadable job file
 * when it is not set.
 */
export const submitRender = createServerFn({ method: "POST" })
  .inputValidator((d) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const base = process.env["REMOTION_WORKER_URL"];
    if (!base) {
      return { configured: false as const };
    }
    const res = await fetch(`${base.replace(/\/$/, "")}/render`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env["REMOTION_WORKER_TOKEN"]
          ? { authorization: `Bearer ${process.env["REMOTION_WORKER_TOKEN"]}` }
          : {}),
      },
      body: JSON.stringify(data.payload),
    });
    if (!res.ok) throw new Error(`Render worker rejected the job (${res.status})`);
    const json = (await res.json()) as { jobId: string };
    return { configured: true as const, jobId: json.jobId };
  });

export const renderStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => statusSchema.parse(d))
  .handler(async ({ data }) => {
    const base = process.env["REMOTION_WORKER_URL"];
    if (!base) return { configured: false as const };
    const res = await fetch(`${base.replace(/\/$/, "")}/status/${data.jobId}`, {
      headers: process.env["REMOTION_WORKER_TOKEN"]
        ? { authorization: `Bearer ${process.env["REMOTION_WORKER_TOKEN"]}` }
        : {},
    });
    if (!res.ok) throw new Error(`Status check failed (${res.status})`);
    const json = (await res.json()) as {
      state: "queued" | "rendering" | "done" | "error";
      progress?: number;
      url?: string;
      error?: string;
    };
    return { configured: true as const, ...json };
  });
