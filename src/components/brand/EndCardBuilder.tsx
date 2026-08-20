/**
 * END CARD BUILDER
 *
 * Create, edit and delete a brand's End Cards — the on-brand closing block
 * appended to generated videos — with a scaled 9:16 preview showing the real
 * logo/product art and exact copy.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brandById } from "@/lib/brand/store";
import {
  defaultEndCard,
  deleteEndCard,
  endCardsForBrand,
  saveEndCard,
  useEndCards,
  type EndCard,
  type EndCardBackground,
  type EndCardVariant,
} from "@/lib/brand/endcards";
import { typeSystemsForBrand, useTypeSystems } from "@/lib/brand/typesystems";

const VARIANTS: EndCardVariant[] = ["primary", "alternate", "minimal"];
const BACKGROUNDS: EndCardBackground[] = ["brand", "asset", "ink", "transparent"];
const ENTRANCES: EndCard["entrance"][] = ["fade", "slide_up", "punch_in", "none"];
const EXITS: EndCard["exit"][] = ["fade", "slide_down", "none"];

function Preview({ card, brandColors, logoUrl, productUrl, backgroundUrl }: {
  card: EndCard;
  brandColors: { bg: string; ink: string; accent: string };
  logoUrl?: string | undefined;
  productUrl?: string | undefined;
  backgroundUrl?: string | undefined;
}) {
  const bg =
    card.background === "ink"
      ? brandColors.ink
      : card.background === "brand"
        ? brandColors.bg
        : card.background === "transparent"
          ? "transparent"
          : brandColors.bg;
  const textColor = card.background === "ink" ? brandColors.bg : brandColors.ink;

  return (
    <div
      className="relative aspect-[9/16] w-full overflow-hidden rounded-lg border"
      style={{
        background: card.background === "asset" && backgroundUrl ? `center/cover url(${backgroundUrl})` : bg,
      }}
    >
      {card.background === "transparent" && (
        <div className="absolute inset-0 bg-[linear-gradient(45deg,#222_25%,transparent_25%),linear-gradient(-45deg,#222_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#222_75%),linear-gradient(-45deg,transparent_75%,#222_75%)] bg-[length:16px_16px] opacity-30" />
      )}
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
        {card.offer && (
          <div className="rounded bg-black/30 px-3 py-1 text-xs uppercase tracking-wide" style={{ color: textColor }}>
            {card.offer}
          </div>
        )}
        {logoUrl ? (
          <img src={logoUrl} alt="logo" className="max-h-16 max-w-[60%] object-contain" />
        ) : (
          <div className="text-sm text-muted-foreground">No logo</div>
        )}
        {productUrl && <img src={productUrl} alt="product" className="max-h-40 max-w-[70%] object-contain" />}
        {card.cta && (
          <div
            className="rounded-md px-5 py-2 text-sm font-bold uppercase tracking-wide"
            style={{ background: brandColors.accent, color: brandColors.bg }}
          >
            {card.cta}
          </div>
        )}
        {card.url && (
          <div className="text-xs" style={{ color: textColor }}>
            {card.url}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EndCardBuilder({ brandId }: { brandId: string }) {
  useEndCards();
  const kit = brandById(brandId);
  useTypeSystems();
  useEndCards();
  const cards = useMemo(() => endCardsForBrand(brandId), [brandId]);
  const typeSystems = useMemo(() => typeSystemsForBrand(brandId), [brandId]);
  const [selectedId, setSelectedId] = useState<string | undefined>(cards[0]?.id);
  const selected = cards.find((c) => c.id === selectedId) ?? cards[0];

  function update(patch: Partial<EndCard>) {
    if (!selected) return;
    const next = saveEndCard({ ...selected, ...patch });
    setSelectedId(next.id);
  }

  function createNew() {
    const next = saveEndCard(defaultEndCard(brandId, kit));
    setSelectedId(next.id);
  }

  const logoUrl = kit?.assets.find((a) => a.id === selected?.logoAssetId)?.url;
  const productUrl = kit?.assets.find((a) => a.id === selected?.productAssetId)?.url;
  const backgroundUrl = kit?.assets.find((a) => a.id === selected?.backgroundAssetId)?.url;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">End Cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-1">
              {cards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    c.id === selected?.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
                  }`}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.variant}</div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <Separator />
          <Button size="sm" className="w-full" onClick={createNew}>
            + New end card
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {selected ? (
            <Preview
              card={selected}
              brandColors={kit?.colors ?? { bg: "#0b0b0d", ink: "#f5f2ec", accent: "#e8ff54" }}
              logoUrl={logoUrl}
              productUrl={productUrl}
              backgroundUrl={backgroundUrl}
            />
          ) : (
            <div className="text-sm text-muted-foreground">No end card selected.</div>
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
                  <Label>Variant</Label>
                  <Select value={selected.variant} onValueChange={(v) => update({ variant: v as EndCardVariant })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VARIANTS.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Logo asset</Label>
                  <Select value={selected.logoAssetId ?? "none"} onValueChange={(v) => update({ logoAssetId: v === "none" ? undefined : v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {kit?.assets.filter((a) => a.kind === "logo").map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Product asset</Label>
                  <Select
                    value={selected.productAssetId ?? "none"}
                    onValueChange={(v) => update({ productAssetId: v === "none" ? undefined : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {kit?.assets.filter((a) => a.kind === "product").map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Background</Label>
                  <Select value={selected.background} onValueChange={(v) => update({ background: v as EndCardBackground })}>
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

                {selected.background === "asset" && (
                  <div className="space-y-1.5">
                    <Label>Background asset</Label>
                    <Select
                      value={selected.backgroundAssetId ?? "none"}
                      onValueChange={(v) => update({ backgroundAssetId: v === "none" ? undefined : v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {kit?.assets.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>CTA</Label>
                  <Input value={selected.cta} onChange={(e) => update({ cta: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label>URL</Label>
                  <Input value={selected.url} onChange={(e) => update({ url: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label>Offer</Label>
                  <Input value={selected.offer} onChange={(e) => update({ offer: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label>Type system</Label>
                  <Select
                    value={selected.typeSystemId ?? "none"}
                    onValueChange={(v) => update({ typeSystemId: v === "none" ? undefined : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Default</SelectItem>
                      {typeSystems.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Duration ({selected.durationSec.toFixed(1)}s)</Label>
                  <Slider
                    min={1}
                    max={6}
                    step={0.5}
                    value={[selected.durationSec]}
                    onValueChange={([v]) => update({ durationSec: v! })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Entrance</Label>
                  <Select value={selected.entrance} onValueChange={(v) => update({ entrance: v as EndCard["entrance"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTRANCES.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Exit</Label>
                  <Select value={selected.exit} onValueChange={(v) => update({ exit: v as EndCard["exit"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXITS.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    deleteEndCard(selected.id);
                    setSelectedId(undefined);
                  }}
                >
                  Delete end card
                </Button>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-sm text-muted-foreground">Select or create an end card.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
