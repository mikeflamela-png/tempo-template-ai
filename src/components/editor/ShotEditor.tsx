import { useState } from "react";
import { Copy, GripVertical, Lock, LockOpen, Minus, Plus, Trash2 } from "lucide-react";
import type { TemplateSpec, MediaSlot } from "@/lib/template/types";

interface Props {
  spec: TemplateSpec;
  lockedIds: string[];
  onLock: (id: string) => void;
  onChange: (slots: MediaSlot[]) => void;
  selected: string | null;
  onSelect: (id: string) => void;
}

/** Re-lays a shot list out end to end so there are never gaps. */
export function relayout(slots: MediaSlot[]): MediaSlot[] {
  let t = 0;
  return slots.map((s) => {
    const out = { ...s, start: Number(t.toFixed(3)) };
    t += s.duration;
    return out;
  });
}

/**
 * Direct manipulation of the shot list — reorder, trim, duplicate, delete —
 * with no regeneration involved. Locked shots are skipped by every AI pass.
 */
export function ShotEditor({ spec, lockedIds, onLock, onChange, selected, onSelect }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const slots = [...spec.mediaSlots].sort((a, b) => a.start - b.start);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= slots.length) return;
    const next = [...slots];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(relayout(next));
  };

  const trim = (i: number, delta: number) => {
    const next = slots.map((s, j) =>
      j === i ? { ...s, duration: Math.max(0.2, Number((s.duration + delta).toFixed(2))) } : s,
    );
    onChange(relayout(next));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Shots</h2>
        <span className="text-[10px] text-muted-foreground">
          {slots.length} · {slots.reduce((a, s) => a + s.duration, 0).toFixed(1)}s
        </span>
      </div>
      {slots.map((s, i) => {
        const locked = lockedIds.includes(s.id);
        return (
          <div
            key={s.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
            }}
            onClick={() => onSelect(s.id)}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${
              selected === s.id ? "border-primary bg-primary/10" : "border-border bg-card/40"
            }`}
          >
            <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
            <span className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
              {s.duration.toFixed(2)}s
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                trim(i, -0.1);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Shorten shot"
            >
              <Minus className="size-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                trim(i, 0.1);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Lengthen shot"
            >
              <Plus className="size-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const copy = { ...s, id: `${s.id}-dup${Date.now().toString(36).slice(-3)}` };
                const next = [...slots];
                next.splice(i + 1, 0, copy);
                onChange(relayout(next));
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Duplicate shot"
            >
              <Copy className="size-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLock(s.id);
              }}
              className={locked ? "text-primary" : "text-muted-foreground hover:text-foreground"}
              aria-label="Lock shot"
            >
              {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (slots.length > 1) onChange(relayout(slots.filter((_, j) => j !== i)));
              }}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete shot"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ShotEditor;
