import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Clapperboard, Film, Sparkles } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { createProject, projectClips, useFootage } from "@/lib/footage/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tempo — footage in, finished edits out" },
      {
        name: "description",
        content:
          "Split a stringout into clips, star your best footage, add a song and get several music-driven edits in minutes.",
      },
      { property: "og:title", content: "Tempo — footage in, finished edits out" },
      {
        property: "og:description",
        content: "Organise messy footage into selects, then turn the best of it into edits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const STEPS = [
  ["Upload", "A long stringout or a pile of clips."],
  ["Clips", "Tempo detects the cuts and makes usable clips."],
  ["Selects", "Star, favorite, reject and trim in seconds."],
  ["Make video", "Song, length, format, style, how many edits."],
  ["Results", "Watch, swap shots you don't like, export."],
];

function Home() {
  const { projects, clips } = useFootage();
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const start = (kind: "stringout" | "clips") => {
    const p = createProject(name, kind);
    void navigate({ to: "/p/$id/footage", params: { id: p.id } });
  };

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 pb-24">
        <section className="border-b border-border pb-12">
          <h1 className="display-tight max-w-2xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Messy footage in.
            <br />
            <span className="text-primary">Finished edits out.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm text-muted-foreground">
            Tempo splits your footage into clips, lets you rate it fast, then builds several
            genuinely different music-driven edits from your best shots.
          </p>

          <div className="mt-8 rounded-2xl border border-border bg-card/50 p-6">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New project name"
              className="w-full border-b border-border bg-transparent pb-2 text-2xl outline-none placeholder:text-muted-foreground/40"
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => start("stringout")}
                className="rounded-xl border border-border bg-background/40 p-5 text-left transition-colors hover:border-primary"
              >
                <Film className="size-5 text-primary" />
                <p className="mt-3 text-base">Upload stringout</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  One long video with many shots — Tempo finds the cuts.
                </p>
              </button>
              <button
                onClick={() => start("clips")}
                className="rounded-xl border border-border bg-background/40 p-5 text-left transition-colors hover:border-primary"
              >
                <Clapperboard className="size-5 text-primary" />
                <p className="mt-3 text-base">Upload clips</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Phone, camera and camcorder files — each becomes a clip.
                </p>
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 border-b border-border py-10 sm:grid-cols-5">
          {STEPS.map(([title, blurb], i) => (
            <div key={title}>
              <p className="font-mono text-[10px] text-primary">0{i + 1}</p>
              <p className="mt-1 text-sm uppercase tracking-widest">{title}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{blurb}</p>
            </div>
          ))}
        </section>

        {projects.length > 0 && (
          <section className="py-10">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                Recent projects
              </h2>
              <Link to="/projects" className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
                All projects
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {projects.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  to="/p/$id/footage"
                  params={{ id: p.id }}
                  className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-5 py-4 hover:border-primary/60"
                >
                  <span className="truncate text-sm">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {clips.filter((c) => c.projectId === p.id).length} clips ·{" "}
                    {p.versions.length} edits
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-wrap items-center gap-4 pt-4">
          <Link to="/recipe">
            <Button variant="outline" className="gap-2">
              <Sparkles className="size-4" /> Creative recipe builder
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground">
            The deeper template, brand and creative tooling is all still here.
          </p>
        </section>
      </main>
    </div>
  );
}
