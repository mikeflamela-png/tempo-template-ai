import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Lock, LockOpen, Sparkles } from "lucide-react";
import type { ControlState } from "@/lib/recipe/types";

interface Props {
  index: number;
  title: string;
  hint: string;
  /** one-line answer shown when collapsed */
  summary: string;
  state: ControlState;
  locked: boolean;
  onState: (s: ControlState) => void;
  onLocked: (v: boolean) => void;
  /** hide the surprise option for sections where it means nothing */
  allowSurprise?: boolean;
  children: ReactNode;
  defaultOpen?: boolean;
}

const STATES: { key: ControlState; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "surprise", label: "Surprise me" },
  { key: "custom", label: "I'll choose" },
];

export function RecipeSection({
  index,
  title,
  hint,
  summary,
  state,
  locked,
  onState,
  onLocked,
  allowSurprise = true,
  children,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen || state === "custom");

  return (
    <section
      className={`rounded-2xl border transition-colors ${
        state === "custom" ? "border-primary/40 bg-card/60" : "border-border bg-card/30"
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">
          {String(index).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="display-tight text-sm uppercase tracking-[0.18em]">{title}</span>
            {locked && <Lock className="size-3 text-primary" />}
            {state === "custom" && <Check className="size-3 text-primary" />}
            {state === "surprise" && <Sparkles className="size-3 text-accent-foreground" />}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {summary || hint}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/60 px-5 pb-5 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {STATES.filter((s) => allowSurprise || s.key !== "surprise").map((s) => (
              <button
                key={s.key}
                onClick={() => onState(s.key)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  state === s.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={() => onLocked(!locked)}
              title="Locked decisions survive every variation pass"
              className={`ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                locked
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
              {locked ? "Locked" : "Lock"}
            </button>
          </div>
          {state === "custom" ? (
            <div className="space-y-4">{children}</div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {state === "surprise"
                ? "Tempo will push this further than usual and vary it across the four versions."
                : `Tempo decides this — ${hint.toLowerCase()}`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  labels,
  suffix,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  labels?: Record<string, string>;
  suffix?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o)}
          onClick={() => onChange(o)}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            o === value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          }`}
        >
          {labels?.[String(o)] ?? String(o)}
          {suffix}
        </button>
      ))}
    </div>
  );
}
