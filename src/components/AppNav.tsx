import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

const PRIMARY = [
  { to: "/", label: "Create" },
  { to: "/projects", label: "Projects" },
  { to: "/library", label: "Library" },
] as const;

const OVERFLOW = [
  { to: "/brand", label: "Brand" },
  { to: "/settings/rendering", label: "Rendering" },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link to="/" className="display-tight text-lg tracking-tight">
        TEM<span className="text-primary">PO</span>
      </Link>
      <nav className="flex items-center gap-6">
        {PRIMARY.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`text-[11px] uppercase tracking-[0.2em] transition-colors ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="More"
            className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {open && (
            <div
              className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-border bg-card/95 p-1.5 backdrop-blur"
              onMouseLeave={() => setOpen(false)}
            >
              {OVERFLOW.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
