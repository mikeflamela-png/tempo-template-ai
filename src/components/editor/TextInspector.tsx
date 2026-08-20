import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { FONTS, FONT_CATEGORIES } from "@/lib/template/fonts";
import type { TextSlot } from "@/lib/template/types";

interface Props {
  slot: TextSlot;
  duration: number;
  value: string;
  onValue: (v: string) => void;
  onUpdate: (patch: Partial<TextSlot>) => void;
}

const STYLES: TextSlot["style"][] = [
  "oversized_hook",
  "kinetic_words",
  "stagger_reveal",
  "feature_callout",
  "minimal_caption",
  "centered_statement",
  "edge_aligned",
  "masked_reveal",
  "cta_lockup",
  "word_by_word",
  "tracking_in",
  "vertical_type",
  "ticker",
  "outlined",
  "giant_word",
  "stat_callout",
  "subtitle",
  "highlight_bar",
];

export function TextInspector({ slot, duration, value, onValue, onUpdate }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {slot.label}
        </Label>
        <Input value={value} onChange={(e) => onValue(e.target.value)} />
      </div>

      <Select
        label="Style"
        value={slot.style}
        options={STYLES}
        onChange={(v) => onUpdate({ style: v as TextSlot["style"] })}
      />
      <Select
        label="Position"
        value={slot.position}
        options={["top", "center", "bottom"]}
        onChange={(v) => onUpdate({ position: v as TextSlot["position"] })}
      />
      <Select
        label="Align"
        value={slot.align ?? "center"}
        options={["left", "center", "right"]}
        onChange={(v) => onUpdate({ align: v as NonNullable<TextSlot["align"]> })}
      />

      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Font override</Label>
        <select
          value={slot.fontKey ?? ""}
          onChange={(e) => onUpdate({ fontKey: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">Template font</option>
          {FONT_CATEGORIES.map((cat) => (
            <optgroup key={cat} label={cat}>
              {FONTS.filter((f) => f.category === cat).map((f) => (
                <option key={f.key} value={f.key}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <Num label="Start" v={slot.start} min={0} max={Math.max(0.1, duration - 0.2)} step={0.05} on={(v) => onUpdate({ start: v })} unit="s" />
      <Num label="Duration" v={slot.duration} min={0.2} max={duration} step={0.05} on={(v) => onUpdate({ duration: v })} unit="s" />
      <Num label="Size" v={slot.sizeScale ?? 1} min={0.4} max={2.5} step={0.05} on={(v) => onUpdate({ sizeScale: v })} unit="×" />
      <Num label="Tracking" v={slot.tracking ?? 0} min={-0.08} max={0.4} step={0.01} on={(v) => onUpdate({ tracking: v })} unit="em" />
      <Num label="Line height" v={slot.lineHeight ?? 0.95} min={0.7} max={1.6} step={0.05} on={(v) => onUpdate({ lineHeight: v })} unit="" />
      <Num label="Offset X" v={slot.x ?? 0} min={-40} max={40} step={1} on={(v) => onUpdate({ x: v })} unit="%" />
      <Num label="Offset Y" v={slot.y ?? 0} min={-40} max={40} step={1} on={(v) => onUpdate({ y: v })} unit="%" />
      <Num label="Rotation" v={slot.rotation ?? 0} min={-30} max={30} step={1} on={(v) => onUpdate({ rotation: v })} unit="°" />
      <Num label="Stroke" v={slot.stroke ?? 0} min={0} max={10} step={0.5} on={(v) => onUpdate({ stroke: v })} unit="px" />
      <Num label="Shadow" v={slot.shadow ?? 0} min={0} max={40} step={1} on={(v) => onUpdate({ shadow: v })} unit="px" />
      <Num label="Opacity" v={slot.opacity ?? 1} min={0} max={1} step={0.05} on={(v) => onUpdate({ opacity: v })} unit="" />
      <Num label="Anim speed" v={slot.animSpeed ?? 1} min={0.4} max={2.5} step={0.1} on={(v) => onUpdate({ animSpeed: v })} unit="×" />

      <div className="grid grid-cols-2 gap-2">
        <Colour label="Colour" value={slot.color ?? "#ffffff"} onChange={(v) => onUpdate({ color: v })} />
        <Colour
          label="Stroke col."
          value={slot.strokeColor ?? "#000000"}
          onChange={(v) => onUpdate({ strokeColor: v })}
        />
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

function Num({
  label,
  v,
  min,
  max,
  step,
  on,
  unit,
}: {
  label: string;
  v: number;
  min: number;
  max: number;
  step: number;
  on: (v: number) => void;
  unit: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="flex justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          {v.toFixed(2)}
          {unit}
        </span>
      </Label>
      <Slider
        value={[v]}
        min={min}
        max={max}
        step={step}
        onValueChange={(x) => on(Number((x[0] ?? v).toFixed(2)))}
      />
    </div>
  );
}

function Colour({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-md border border-border bg-background"
      />
    </div>
  );
}
