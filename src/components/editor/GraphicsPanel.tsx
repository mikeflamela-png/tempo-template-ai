import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { GRAPHICS, GRAPHIC_ANIMATIONS, makeGraphic } from "@/lib/template/graphics";
import type { GraphicKind, GraphicSlot } from "@/lib/template/types";

interface Props {
  graphics: GraphicSlot[];
  duration: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd: (g: GraphicSlot) => void;
  onUpdate: (id: string, patch: Partial<GraphicSlot>) => void;
  onRemove: (id: string) => void;
  playhead: number;
}

const GROUPS = ["Marks", "Frames", "Labels", "Data", "Editorial"] as const;

export function GraphicsPanel({
  graphics,
  duration,
  selected,
  onSelect,
  onAdd,
  onUpdate,
  onRemove,
  playhead,
}: Props) {
  const active = graphics.find((g) => g.id === selected) ?? null;

  return (
    <div className="space-y-3">
      <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Graphics</h2>

      <div className="space-y-2">
        {GROUPS.map((group) => (
          <div key={group}>
            <p className="mb-1 text-[9px] uppercase tracking-widest text-muted-foreground/70">
              {group}
            </p>
            <div className="flex flex-wrap gap-1">
              {GRAPHICS.filter((g) => g.group === group).map((g) => (
                <button
                  key={g.kind}
                  onClick={() => onAdd(makeGraphic(g.kind as GraphicKind, playhead))}
                  className="rounded-md border border-border px-2 py-1 text-[10px] hover:border-primary hover:text-primary"
                >
                  <Plus className="mr-0.5 inline size-2.5" />
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {graphics.length > 0 && (
        <div className="space-y-1">
          {graphics.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g.id)}
              className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-[11px] ${
                selected === g.id ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <span className="truncate">
                {g.label ?? g.kind} · {g.start.toFixed(1)}s
              </span>
              <Trash2
                className="size-3.5 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(g.id);
                }}
              />
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          {"text" in active && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Text</Label>
              <Input
                value={active.text ?? ""}
                onChange={(e) => onUpdate(active.id, { text: e.target.value })}
              />
            </div>
          )}
          <Field
            label={`Start ${active.start.toFixed(2)}s`}
            value={active.start}
            min={0}
            max={Math.max(0.1, duration - 0.2)}
            step={0.05}
            onChange={(v) => onUpdate(active.id, { start: v })}
          />
          <Field
            label={`Duration ${active.duration.toFixed(2)}s`}
            value={active.duration}
            min={0.2}
            max={duration}
            step={0.05}
            onChange={(v) => onUpdate(active.id, { duration: v })}
          />
          <Field
            label={`X ${active.x}`}
            value={active.x}
            min={-50}
            max={50}
            step={1}
            onChange={(v) => onUpdate(active.id, { x: v })}
          />
          <Field
            label={`Y ${active.y}`}
            value={active.y}
            min={-50}
            max={50}
            step={1}
            onChange={(v) => onUpdate(active.id, { y: v })}
          />
          <Field
            label={`Scale ${active.scale.toFixed(2)}×`}
            value={active.scale}
            min={0.2}
            max={3}
            step={0.05}
            onChange={(v) => onUpdate(active.id, { scale: v })}
          />
          <Field
            label={`Rotation ${active.rotation}°`}
            value={active.rotation}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => onUpdate(active.id, { rotation: v })}
          />
          <Field
            label={`Opacity ${Math.round(active.opacity * 100)}%`}
            value={active.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => onUpdate(active.id, { opacity: v })}
          />
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Animation</Label>
            <select
              value={active.animation}
              onChange={(e) =>
                onUpdate(active.id, {
                  animation: e.target.value as GraphicSlot["animation"],
                })
              }
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              {GRAPHIC_ANIMATIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Colour</Label>
            <input
              type="color"
              value={active.color ?? "#ffffff"}
              onChange={(e) => onUpdate(active.id, { color: e.target.value })}
              className="h-8 w-full rounded-md border border-border bg-background"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => onRemove(active.id)}
          >
            Remove graphic
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Number((v[0] ?? value).toFixed(2)))}
      />
    </div>
  );
}
