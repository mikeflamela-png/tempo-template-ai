import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleSlash, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/settings/rendering")({
  head: () => ({
    meta: [
      { title: "Render worker — Settings — Tempo" },
      {
        name: "description",
        content:
          "Connect Tempo to a real Remotion render worker for honest server-side MP4 export: status, required secrets and deploy steps.",
      },
      { property: "og:title", content: "Render worker — Tempo" },
      {
        property: "og:description",
        content: "Check server render connectivity and see exactly what a real MP4 export requires.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RenderingSettingsPage,
});

interface HealthResult {
  configured: boolean;
  ok: boolean;
  latencyMs: number | null;
  worker: string | null;
}

function RenderingSettingsPage() {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/public/render-health");
      const json = (await res.json()) as HealthResult;
      setHealth(json);
    } catch {
      setHealth({ configured: false, ok: false, latencyMs: null, worker: "Could not reach the app server" });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const status: "connected" | "not-configured" | "unreachable" | "checking" = checking
    ? "checking"
    : !health
      ? "checking"
      : !health.configured
        ? "not-configured"
        : health.ok
          ? "connected"
          : "unreachable";

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link to="/">
          <ArrowLeft className="size-4" /> Back to Tempo
        </Link>
      </Button>

      <h1 className="display-tight text-3xl">Render worker</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Tempo's browser preview is a live Remotion composition, but a real MP4 needs an
        actual Chromium + ffmpeg process to encode frames — the browser can't do that on
        its own, and the app's edge runtime can't host Chromium either. That's what the
        render worker is: a small external Node service Tempo hands finished export jobs to.
      </p>

      <section className="mt-8 rounded-xl border border-border p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusIcon status={status} />
            <div>
              <p className="font-semibold">
                {status === "checking" && "Checking connection…"}
                {status === "not-configured" && "Server rendering is not connected"}
                {status === "unreachable" && "Render worker configured, but unreachable"}
                {status === "connected" && "Render worker connected"}
              </p>
              <p className="text-xs text-muted-foreground">
                {health?.worker ? health.worker : "No REMOTION_WORKER_URL secret is set."}
                {typeof health?.latencyMs === "number" ? ` · ${health.latencyMs}ms` : ""}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void check()} disabled={checking}>
            {checking ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Test connection
          </Button>
        </div>
        {status !== "connected" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Until this is connected, Export MP4 in the editor will offer the FCPXML /
            handoff package download instead of a rendered file — nothing is silently
            faked.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Required secrets
        </h2>
        <div className="space-y-3 rounded-xl border border-border p-5 text-sm">
          <div>
            <p className="font-mono text-xs text-foreground">REMOTION_WORKER_URL</p>
            <p className="text-muted-foreground">
              The externally reachable base URL of the deployed worker, e.g.{" "}
              <code className="text-foreground">https://render.yourdomain.com</code>.
            </p>
          </div>
          <div>
            <p className="font-mono text-xs text-foreground">REMOTION_WORKER_TOKEN</p>
            <p className="text-muted-foreground">
              Optional but recommended shared secret. The app sends it as{" "}
              <code className="text-foreground">Authorization: Bearer …</code> and never exposes
              it to the browser.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Deploying render-worker/
        </h2>
        <ol className="list-decimal space-y-2 rounded-xl border border-border p-5 pl-9 text-sm text-muted-foreground">
          <li>
            Deploy <code className="text-foreground">render-worker/</code> to any Node host with 2+
            vCPU (Fly.io, Railway, Render, or a VPS) — it needs Chromium + ffmpeg installed
            alongside it.
          </li>
          <li>
            Set <code className="text-foreground">PORT</code>,{" "}
            <code className="text-foreground">PUBLIC_URL</code> (the externally reachable base
            URL, used for asset + download links) and{" "}
            <code className="text-foreground">REMOTION_WORKER_TOKEN</code> on that host.
          </li>
          <li>Run it with <code className="text-foreground">node render-worker/server.mjs</code>.</li>
          <li>
            Add <code className="text-foreground">REMOTION_WORKER_URL</code> (and the same token)
            to this project's secrets, then re-check the connection above.
          </li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Full details, including a sample Dockerfile, are in{" "}
          <code className="text-foreground">render-worker/README.md</code>.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          What a real MP4 export requires
        </h2>
        <ul className="space-y-2 rounded-xl border border-border p-5 text-sm text-muted-foreground">
          {[
            "Every shot in the stringout has a resolved media source (no empty slots).",
            "Uploaded fonts for any custom type system are present in the active brand kit.",
            "Imported motion assets are in a server-safe format (WebM/VP9 alpha, not ProRes .mov).",
            "Output width/height are even numbers — required by H.264.",
            "The render worker is deployed, reachable and passes the health check above.",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Tempo checks most of this automatically before every export — see the preflight
          panel in the Export dialog.
        </p>
      </section>
    </main>
  );
}

function StatusIcon({ status }: { status: "connected" | "not-configured" | "unreachable" | "checking" }) {
  if (status === "checking") return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (status === "connected") return <CheckCircle2 className="size-5 text-emerald-400" />;
  if (status === "unreachable") return <AlertTriangle className="size-5 text-amber-400" />;
  return <CircleSlash className="size-5 text-muted-foreground" />;
}

export function RenderStatusBadge() {
  return <Badge variant="secondary">rendering</Badge>;
}
