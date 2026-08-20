/**
 * TYPE SYSTEM PANEL
 *
 * Create, edit and delete the brand's approved Type Systems — one reusable
 * text treatment per semantic role — with a live CSS preview of exactly how
 * the treatment will look on screen.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brandById } from "@/lib/brand/store";
import {
  TYPE_SYSTEM_ROLES,
  deleteTypeSystem,
  saveTypeSystem,
  seedTypeSystemsForBrand,
  typeSystemsForBrand,
  useTypeSystems,
  type TypeSystem,
  type TypeSystemBackground,
  type TypeSystemRole,
} from "@/lib/brand/typesystems";
import { ANIMATIONS, type TextStyleName } from "@/lib/template/types";

const BACKGROUNDS: TypeSystemBackground[] = ["none", "bar", "block", "blur"];
const ALIGNS: TypeSystem["align"][] = ["left", "center", "right"];
const POSITIONS: TypeSystem["position"][] = ["top", "center", "bottom"];

const TEXT_STYLES: TextStyleName[] = [
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

function PreviewCard({ system, sampleText, ink, accent }: { system: TypeSystem; sampleText: string; ink: string; accent: string }) {
  const bgStyle: React.CSSProperties =
    system.background === "bar"
      ? { background: "rgba(0,0,0,0.35)", padding: "6px 14px" }
      : system.background === "block"
        ? { background: accent, color: "#0b0b0d", padding: "10px 20px", borderRadius: 8 }
        : system.background === "blur"
          ? { background: "rgba(0,0,0,0.25)", backdropFilter: "blur(6px)", padding: "8px 16px", borderRadius: 6 }
          : {};
  return (
    <div className="flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-lg border bg-black">
      <div
        className="flex h-full w-full flex-col p-4"
        style={{
          justifyContent: system.position === "top" ? "flex-start" : system.position === "bottom" ? "flex-end" : "center",
          alignItems: system.align === "left" ? "flex-start" : system.align === "right" ? "flex-end" : "center",
        }}
      >
        <div
          style={{
            ...bgStyle,
            color: system.background === "block" ? undefined : (system.color ?? ink),
            fontWeight: system.fontWeight,
            fontSize: `${system.sizeScale * 28}px`,
            letterSpacing: `${system.tracking}px`,
            lineHeight: system.lineHeight,
            textTransform: system.uppercase ? "uppercase" : "none",
            textAlign: system.align,
            WebkitTextStroke: system.stroke ? `${system.stroke}px ${system.strokeColor ?? "#000"}` : undefined,
            maxWidth: `${system.maxWidthPct}%`,
            whiteSpace: "pre-wrap",
          }}
        >
          {sampleText}
        </div>
      </div>
    </div>
  );
}

export default function TypeSystemPanel({ brandId }: { brandId: string }) {
  useTypeSystems();
  const kit = brandById(brandId);
  const systems = useMemo(() => {
    seedTypeSystemsForBrand(brandId, kit);
    return typeSystemsForBrand(brandId).sort((a, b) => a.role.localeCompare(b.role));
  }, [brandId, kit]);

  const [selectedId, setSelectedId] = useState<string | undefined>(systems[0]?.id);
  const selected = systems.find((s) => s.id === selectedId) ?? systems[0];

  function update(patch: Partial<TypeSystem>) {
    if (!selected) return;
    const next = saveTypeSystem({ ...selected, ...patch });
    setSelectedId(next.id);
  }

  function createNew(role: TypeSystemRole) {
    const next = saveTypeSystem({
      brandId,
      name: `New ${role}`,
      role,
      fontWeight: 700,
      sizeScale: 1,
      minSizeScale: 0.6,
      maxSizeScale: 1.4,
      uppercase: false,
      tracking: 0,
      lineHeight: 1.1,
      align: "center",
      maxWidthPct: 80,
      stroke: 0,
      background: "none",
      animation: "centered_statement",
      position: "center",
    });
    setSelectedId(next.id);
  }

  const sampleText = selected?.role === "cta" ? "Shop Now" : selected?.role === "stat" ? "10,000+" : "Your headline goes here";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Type Systems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-1">
              {systems.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    s.id === selected?.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
                  }`}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.role}</div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <Separator />
          <div className="flex flex-wrap gap-1 pt-2">
            {TYPE_SYSTEM_ROLES.map((role) => (
              <Button key={role} size="sm" variant="outline" onClick={() => createNew(role)}>
                + {role}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {selected ? (
            <PreviewCard
              system={selected}
              sampleText={sampleText}
              ink={kit?.colors.ink ?? "#f5f2ec"}
              accent={kit?.colors.accent ?? "#e8ff54"}
            />
          ) : (
            <div className="text-sm text-muted-foreground">No type system selected.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {selected ? (
            <ScrollArea className="h-[460px] pr-2">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={selected.name} onChange={(e) => update({ name: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={selected.role} onValueChange={(v) => update({ role: v as TypeSystemRole })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_SYSTEM_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Font</Label>
                  <Select value={selected.fontId ?? "none"} onValueChange={(v) => update({ fontId: v === "none" ? undefined : v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Default</SelectItem>
                      {kit?.fonts.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Font weight ({selected.fontWeight})</Label>
                  <Slider
                    min={300}
                    max={900}
                    step={100}
                    value={[selected.fontWeight]}
                    onValueChange={([v]) => update({ fontWeight: v! })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Size scale ({selected.sizeScale.toFixed(2)})</Label>
                  <Slider
                    min={0.2}
                    max={2}
                    step={0.05}
                    value={[selected.sizeScale]}
                    onValueChange={([v]) => update({ sizeScale: v! })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Min size ({selected.minSizeScale.toFixed(2)})</Label>
                    <Slider
                      min={0.2}
                      max={2}
                      step={0.05}
                      value={[selected.minSizeScale]}
                      onValueChange={([v]) => update({ minSizeScale: v! })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Max size ({selected.maxSizeScale.toFixed(2)})</Label>
                    <Slider
                      min={0.2}
                      max={2}
                      step={0.05}
                      value={[selected.maxSizeScale]}
                      onValueChange={([v]) => update({ maxSizeScale: v! })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Uppercase</Label>
                  <Switch checked={selected.uppercase} onCheckedChange={(v) => update({ uppercase: v })} />
                </div>

                <div className="space-y-1.5">
                  <Label>Tracking ({selected.tracking})</Label>
                  <Slider min={-4} max={8} step={0.5} value={[selected.tracking]} onValueChange={([v]) => update({ tracking: v! })} />
                </div>

                <div className="space-y-1.5">
                  <Label>Line height ({selected.lineHeight.toFixed(2)})</Label>
                  <Slider
                    min={0.8}
                    max={1.6}
                    step={0.02}
                    value={[selected.lineHeight]}
                    onValueChange={([v]) => update({ lineHeight: v! })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Align</Label>
                  <Select value={selected.align} onValueChange={(v) => update({ align: v as TypeSystem["align"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALIGNS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Max width % ({selected.maxWidthPct})</Label>
                  <Slider
                    min={30}
                    max={100}
                    step={2}
                    value={[selected.maxWidthPct]}
                    onValueChange={([v]) => update({ maxWidthPct: v! })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Color</Label>
                  <Input type="color" value={selected.color ?? "#f5f2ec"} onChange={(e) => update({ color: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label>Stroke width ({selected.stroke})</Label>
                  <Slider min={0} max={4} step={0.5} value={[selected.stroke]} onValueChange={([v]) => update({ stroke: v! })} />
                </div>

                {selected.stroke > 0 && (
                  <div className="space-y-1.5">
                    <Label>Stroke color</Label>
                    <Input
                      type="color"
                      value={selected.strokeColor ?? "#000000"}
                      onChange={(e) => update({ strokeColor: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Background</Label>
                  <Select value={selected.background} onValueChange={(v) => update({ background: v as TypeSystemBackground })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BACKGROUNDS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Animation</Label>
                  <Select value={selected.animation} onValueChange={(v) => update({ animation: v as TextStyleName })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_STYLES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Select value={selected.position} onValueChange={(v) => update({ position: v as TypeSystem["position"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    deleteTypeSystem(selected.id);
                    setSelectedId(undefined);
                  }}
                >
                  Delete type system
                </Button>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-sm text-muted-foreground">Select or create a type system.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
