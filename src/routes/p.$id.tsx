import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { AppNav } from "@/components/AppNav";
import { projectById, projectClips, useFootage } from "@/lib/footage/store";
import { useSourceUrls } from "@/lib/footage/useSources";

export const Route = createFileRoute("/p/$id")({
  component: ProjectLayout,
});

const TABS = [
  { to: "/p/$id/footage", label: "Footage" },
  { to: "/p/$id/selects", label: "Selects" },
  { to: "/p/$id/make", label: "Make video" },
  { to: "/p/$id/results", label: "Results" },
] as const;

function ProjectLayout() {
  const { id } = useParams({ from: "/p/$id" });
  const { ready } = useFootage();
  useSourceUrls(id);
  const project = projectById(id);
  const clips = projectClips(id);
  const reviewed = clips.filter((c) => c.rating > 0 || c.rejected).length;

  if (!ready) {
    return (
      <div className="min-h-screen">
        <AppNav />
        <p className="mx-auto max-w-6xl px-6 text-sm text-muted-foreground">Loading project…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen">
        <AppNav />
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="display-tight text-3xl">Project not found</h1>
          <Link to="/projects" className="mt-4 inline-block text-sm text-primary">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Project</p>
            <h1 className="display-tight text-3xl tracking-tight">{project.name}</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {clips.length} clips · {reviewed} reviewed · {project.versions.length} edits
          </p>
        </div>
        <nav className="flex gap-6 py-4">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              params={{ id }}
              activeProps={{ className: "text-foreground" }}
              className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <Outlet />
      </main>
    </div>
  );
}
