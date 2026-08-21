import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TemplateSpec } from "@/lib/template/types";

export const Route = createFileRoute("/settings/rendering")({
  head: () => ({
    meta: [
      { title: "Video export — Settings — Tempo" },
      {
        name: "description",
        content:
          "Connect Tempo to its render service and confirm it works by rendering a real two-second MP4 test export.",
      },
      { property: "og:title", content: "Video export — Tempo" },
      {
        property: "og:description",
        content: "Check that Tempo can produce real downloadable MP4 files.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RenderingSettingsPage,
});

/** A tiny, self-contained 2s composition — no uploads, no browser assets. */
function testSpec(): TemplateSpec {
  return {
    id: "render-test",
    name: "Render test",
    duration: 2,
    fps: 30,
    width: 1080,
    height: 1920,
    tags: [],
    palette: { bg: "#0b0b0d", ink: "#f5f2ec", accent: "#e8ff54" },
    mediaSlots: [],
    textSlots: [
      {
        id: "t1",
        label: "TEST",
        value: "TEMPO RENDER TEST",
        start: 0,
        duration: 2,
        style: "centered_statement",
        position: "center",
        align: "center",
      },
    ],
    overlays: [{ type: "grain", start: 0, duration: 2 }],
    beatMarkers: [],
    creativeProfile: {
      family: "test",
      energy: "calm",
      pacing: "steady",
      typography: "minimal",
      transitionStyle: "cut",
      structure: "single",
    },
  } as TemplateSpec;
}

type TestState =
  | { phase: "idle" }
  | { phase: "running"; message: string; progress: number }
  | { phase: "done"; url: string }
  | { phase: "not-connected" }
  | { phase: "error"; message: string };

function RenderingSettingsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [test, setTest] = useState<TestState>({ phase: "idle" });

  const ping = useCallback(async () => {
    try {
      const res = await fetch("/api/public/render-health");
      const json = (await res.json()) as { configured?: boolean; ok?: boolean };
      setConnected(Boolean(json.configured && json.ok));
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void ping();
  }, [ping]);

  const runTest = useCallback(async () => {
    setTest({ phase: "running", message: "Sending a two-second test to the renderer…", progress: 5 });
    try {
      const form = new FormData();
      form.append(
        "job",
        JSON.stringify({
          spec: testSpec(),
          textOverrides: {},
          media: {},
          audio: null,
          output: {
            width: 1080,
            height: 1920,
            fps: 30,
            codec: "h264",
            container: "mp4",
            crf: 20,
          },
        }),
      );
      const res = await fetch("/api/public/render", { method: "POST", body: form });
      const data = (await res.json()) as { configured: boolean; jobId?: string; error?: string };
      if (!data.configured) {
        setConnected(false);
        setTest({ phase: "not-connected" });
        return;
      }
      if (!data.jobId) throw new Error(data.error ?? "The renderer rejected the test");

      let transient = 0;
      const poll = async (): Promise<void> => {
        let s: {
          state?: string;
          progress?: number;
          renderedFrames?: number;
          totalFrames?: number;
          url?: string;
          error?: string;
        } = {};
        try {
          s = await fetch(`/api/public/render-status/${data.jobId}`).then((r) => r.json());
        } catch {
          s = {};
        }
        if (!s.state) {
          transient += 1;
          if (transient > 40) {
            setTest({
              phase: "error",
              message: "Lost contact with the render service while the test was running.",
            });
            return;
          }
          setTimeout(() => void poll(), 3000);
          return;
        }
        transient = 0;
        if (s.state === "done" && s.url) {
          setConnected(true);
          setTest({ phase: "done", url: s.url });
          return;
        }
        if (s.state === "error") {
          setTest({ phase: "error", message: s.error ?? "The test render failed" });
          return;
        }
        const pct = Math.round((s.progress ?? 0) * 100);
        setTest({
          phase: "running",
          message:
            s.state === "queued"
              ? "Waking the renderer…"
              : pct > 97
                ? "Encoding and finalising…"
                : `Rendering ${pct}%${
                    s.renderedFrames && s.totalFrames
                      ? ` (frame ${s.renderedFrames}/${s.totalFrames})`
                      : ""
                  }`,
          progress: 10 + Math.round((s.progress ?? 0) * 85),
        });
        setTimeout(() => void poll(), 2000);
      };
      void poll();
    } catch (err) {
      setConnected(false);
      setTest({
        phase: "error",
        message: err instanceof Error ? err.message : "The test render failed",
      });
    }
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link to="/">
          <ArrowLeft className="size-4" /> Back to Tempo
        </Link>
      </Button>

      <h1 className="display-tight text-3xl">Video export</h1>

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        {connected === null ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : connected ? (
          <CheckCircle2 className="size-5 text-emerald-400" />
        ) : (
          <AlertTriangle className="size-5 text-amber-400" />
        )}
        <div>
          <p className="font-semibold">
            {connected === null ? "Checking…" : connected ? "Connected" : "Not connected"}
          </p>
          <p className="text-sm text-muted-foreground">
            {connected
              ? "Tempo can turn your edits into downloadable MP4 files."
              : "Finish the one-time setup below, then run a test export."}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Test export</p>
            <p className="text-sm text-muted-foreground">
              Renders a real two-second MP4 — the only honest proof that export works.
            </p>
          </div>
          <Button onClick={() => void runTest()} disabled={test.phase === "running"}>
            {test.phase === "running" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            Test export
          </Button>
        </div>

        {test.phase === "running" && (
          <div className="mt-3 space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${test.progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{test.message}</p>
          </div>
        )}
        {test.phase === "done" && (
          <div className="mt-3 flex items-center gap-3">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <p className="text-sm">A real MP4 was produced.</p>
            <Button asChild size="sm" variant="secondary">
              <a href={test.url} download>
                <Download className="size-4" /> Download it
              </a>
            </Button>
          </div>
        )}
        {test.phase === "not-connected" && (
          <p className="mt-3 text-sm text-amber-300">
            No render service is connected yet — follow the setup below.
          </p>
        )}
        {test.phase === "error" && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-destructive">
            {test.message}
          </p>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          One-time setup
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            1. Go to{" "}
            <a
              className="text-foreground underline"
              href="https://dashboard.render.com/blueprints"
              target="_blank"
              rel="noreferrer"
            >
              render.com → Blueprints
            </a>{" "}
            and click <span className="text-foreground">New Blueprint Instance</span>.
          </li>
          <li>2. Connect GitHub and pick this Tempo repository, then click Apply.</li>
          <li>
            3. When the service is live, copy its URL (looks like
            <span className="text-foreground"> https://tempo-render-worker.onrender.com</span>).
          </li>
          <li>
            4. Paste it into this project as the secret{" "}
            <span className="font-mono text-foreground">REMOTION_WORKER_URL</span>.
          </li>
          <li>5. Come back here and click Test export.</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          The blueprint (<span className="font-mono">render.yaml</span>) and its Dockerfile are
          already in the repo, so Chromium, ffmpeg and Remotion install themselves.
        </p>
      </section>
    </main>
  );
}
