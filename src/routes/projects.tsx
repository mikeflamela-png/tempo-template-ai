import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Film, Plus, Trash2, Clapperboard } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { createProject, deleteProject, projectClips, useFootage } from "@/lib/footage/store";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Tempo" },
      { name: "description", content: "Your footage projects: selects, edits and exports in one place." },
      { property: "og:title", content: "Projects — Tempo" },
      { property: "og:description", content: "Your footage projects: selects, edits and exports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { projects, ready, clips } = useFootage();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const start = (kind: "stringout" | "clips") => {
    const p = createProject(name, kind);
    setCreating(false);
    setName("");
    void navigate({ to: "/p/$id/footage", params: { id: p.id }, search: { kind } });
  };

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 pb-24">
        <div className="flex items-end justify-between border-b border-border pb-6">
          <div>
            <h1 className="display-tight text-4xl tracking-tight">Projects</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Footage in, organised selects out, edits made in a couple of minutes.
            </p>
          </div>
          <Button onClick={() => setCreating(true)} className="gap-2">
            <Plus className="size-4" /> New project
          </Button>
        </div>

        {creating && (
          <div className="mt-8 rounded-2xl border border-border bg-card/50 p-6">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="w-full border-b border-border bg-transparent pb-2 text-2xl outline-none placeholder:text-muted-foreground/50"
            />
            <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              What are you uploading?
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => start("stringout")}
                className="group rounded-xl border border-border bg-background/40 p-5 text-left transition-colors hover:border-primary"
              >
                <Film className="size-5 text-primary" />
                <p className="mt-3 text-base">Upload stringout</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  One long video with many shots. Tempo finds the cuts and turns it into clips.
                </p>
              </button>
              <button
                onClick={() => start("clips")}
                className="group rounded-xl border border-border bg-background/40 p-5 text-left transition-colors hover:border-primary"
              >
                <Clapperboard className="size-5 text-primary" />
                <p className="mt-3 text-base">Upload clips</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A pile of iPhone, camera or camcorder files. Each one becomes a clip.
                </p>
              </button>
            </div>
          </div>
        )}

        {!ready && <p className="mt-10 text-sm text-muted-foreground">Loading projects…</p>}

        <div className="mt-8 space-y-2">
          {projects.map((p) => {
            const count = clips.filter((c) => c.projectId === p.id).length;
            const rated = projectClips(p.id).filter((c) => c.rating > 0 || c.rejected).length;
            return (
              <div
                key={p.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card/40 px-5 py-4 transition-colors hover:border-primary/60"
              >
                <Link
                  to="/p/$id/footage"
                  params={{ id: p.id }}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-base">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {count} clips · {rated} reviewed · {p.versions.length} edits
                  </p>
                </Link>
                <Link
                  to="/p/$id/selects"
                  params={{ id: p.id }}
                  className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                >
                  Selects
                </Link>
                <Link
                  to="/p/$id/make"
                  params={{ id: p.id }}
                  className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                >
                  Make video
                </Link>
                <button
                  onClick={() => deleteProject(p.id)}
                  aria-label="Delete project"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
          {ready && !projects.length && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="w-full rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
            >
              Create your first project
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
