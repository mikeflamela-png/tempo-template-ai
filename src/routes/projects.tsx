import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { useTemplateStore } from "@/lib/template/store";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Tempo" },
      {
        name: "description",
        content: "Every saved Tempo project in one place — open, continue editing or generate more.",
      },
      { property: "og:title", content: "Projects — Tempo" },
      {
        property: "og:description",
        content: "Your saved Tempo edits, ready to reopen or refine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { projects } = useTemplateStore();

  return (
    <main className="min-h-screen">
      <div className="glow-surface">
        <AppNav />
        <section className="mx-auto max-w-6xl px-6 pb-10 pt-4">
          <h1 className="display-tight text-4xl">Projects</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Everything you've saved from the editor.
          </p>
        </section>
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">You haven't saved any projects yet.</p>
            <Button asChild className="mt-5">
              <Link to="/">
                <Sparkles className="size-4" /> Start creating
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {projects.map((p) => (
              <div key={p.id} className="flex flex-col gap-3">
                <div
                  className="relative overflow-hidden rounded-2xl border border-border bg-muted/30"
                  style={{ aspectRatio: `${p.spec.width} / ${p.spec.height}` }}
                >
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {p.spec.name}
                  </div>
                </div>
                <div>
                  <h3 className="display-tight text-lg">{p.name}</h3>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Updated {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button asChild size="sm" className="w-full">
                  <Link to="/editor/$id" params={{ id: p.templateId }}>
                    Open
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
