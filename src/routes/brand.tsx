import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Trash2, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { fontByKey } from "@/lib/template/fonts";
import {
  ASSET_KINDS,
  FONT_ROLES,
  USAGE_RULES,
  addBrandAsset,
  addBrandFont,
  brandById,
  copyKitById,
  createBrandKit,
  deleteBrandKit,
  deleteCopyKit,
  removeBrandAsset,
  removeBrandFont,
  saveCopyKit,
  setActiveBrand,
  setActiveCopy,
  updateBrandAsset,
  updateBrandKit,
  useBrandStore,
  type AssetKind,
  type BrandFontRole,
  type CopyMode,
  type UsageRule,
} from "@/lib/brand/store";

export const Route = createFileRoute("/brand")({
  head: () => ({
    meta: [
      { title: "Brand & Copy Kits — Tempo" },
      {
        name: "description",
        content:
          "Upload your real fonts, logos and product assets, set usage rules, and lock the exact copy Tempo is allowed to use in generated templates.",
      },
      { property: "og:title", content: "Brand & Copy Kits — Tempo" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Real fonts, real logos, real copy — the discipline layer behind every Tempo template.",
      },
    ],
  }),
  component: BrandPage,
});

const label = "text-[11px] uppercase tracking-[0.2em] text-muted-foreground";

function BrandPage() {
  const store = useBrandStore();
  const kit = brandById(store.activeKitId) ?? store.kits[0];
  const fontInput = useRef<HTMLInputElement>(null);
  const assetInput = useRef<HTMLInputElement>(null);
  const [fontRole, setFontRole] = useState<BrandFontRole>("display");
  const [assetKind, setAssetKind] = useState<AssetKind>("logo");
  const [error, setError] = useState<string | null>(null);

  const copy = copyKitById(store.activeCopyId);
  const [draft, setDraft] = useState(() => ({
    name: "Main copy",
    hook: "",
    headline: "",
    support: "",
    feature: "",
    offer: "",
    cta: "",
    extras: [] as string[],
    mode: "exact" as CopyMode,
  }));

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="display-tight text-lg tracking-tight">
          TEM<span className="text-primary">PO</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/library" className={`${label} hover:text-foreground`}>
            Creative library
          </Link>
          <Link to="/" className={`${label} hover:text-foreground`}>
            Generator
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h1 className="display-tight text-4xl sm:text-5xl">Brand & copy</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Tempo only looks like your brand if it uses your real files. Upload fonts and assets, set
          the rules they must follow, then lock the exact words allowed on screen.
        </p>

        {/* kit switcher */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {store.kits.map((k) => (
            <button
              key={k.id}
              onClick={() => setActiveBrand(k.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                kit?.id === k.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {k.name}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => createBrandKit(`Brand ${store.kits.length + 1}`)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> New brand kit
          </Button>
        </div>

        {!kit && (
          <p className="mt-10 text-sm text-muted-foreground">
            Create a brand kit to start uploading fonts and assets.
          </p>
        )}

        {kit && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* identity */}
            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <p className={label}>Identity</p>
              <Input
                className="mt-3"
                value={kit.name}
                onChange={(e) => updateBrandKit(kit.id, { name: e.target.value })}
              />
              <div className="mt-4 grid grid-cols-4 gap-3">
                {(["bg", "ink", "accent", "secondary"] as const).map((c) => (
                  <label key={c} className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {c}
                    </span>
                    <input
                      type="color"
                      value={kit.colors[c]}
                      onChange={(e) =>
                        updateBrandKit(kit.id, { colors: { ...kit.colors, [c]: e.target.value } })
                      }
                      className="h-9 w-full cursor-pointer rounded-md border border-border bg-transparent"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-5 space-y-2">
                <p className={label}>Motion tolerance</p>
                <Slider
                  value={[kit.animationIntensity]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => updateBrandKit(kit.id, { animationIntensity: v[0] ?? 4 })}
                />
                <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span>Restrained</span>
                  <span>Expressive</span>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <p className={label}>Approved CTAs (one per line)</p>
                <Textarea
                  value={kit.ctas.join("\n")}
                  onChange={(e) =>
                    updateBrandKit(kit.id, {
                      ctas: e.target.value.split("\n").filter((x) => x.trim()),
                    })
                  }
                  className="min-h-20"
                  placeholder={"SHOP NOW\nLEARN MORE"}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 text-destructive"
                onClick={() => deleteBrandKit(kit.id)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete kit
              </Button>
            </div>

            {/* fonts */}
            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <p className={label}>Fonts</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {FONT_ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setFontRole(r)}
                    className={`rounded-full border px-3 py-1 text-xs capitalize ${
                      fontRole === r
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
                <Button variant="outline" size="sm" onClick={() => fontInput.current?.click()}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> Upload {fontRole} font
                </Button>
                <input
                  ref={fontInput}
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setError(null);
                    try {
                      await addBrandFont(kit.id, file, fontRole);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                />
              </div>
              {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
              <div className="mt-4 space-y-3">
                {kit.fonts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No fonts yet — templates fall back to the Google font library.
                  </p>
                )}
                {kit.fonts.map((f) => (
                  <div key={f.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {f.role} · {f.fileName}
                        </p>
                        <p
                          className="mt-1 text-2xl"
                          style={{
                            fontFamily: fontByKey(f.id).stack,
                            textTransform: f.uppercase ? "uppercase" : "none",
                            letterSpacing: `${f.tracking / 100}em`,
                          }}
                        >
                          Design that ships
                        </p>
                      </div>
                      <button
                        onClick={() => removeBrandFont(kit.id, f.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {f.status === "error" && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" /> {f.error}
                      </p>
                    )}
                    {f.status === "pending" && (
                      <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* assets */}
            <div className="rounded-2xl border border-border bg-card/60 p-5 lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className={label}>Assets</p>
                <div className="ml-auto flex flex-wrap gap-2">
                  {ASSET_KINDS.map((k) => (
                    <button
                      key={k}
                      onClick={() => setAssetKind(k)}
                      className={`rounded-full border px-3 py-1 text-xs capitalize ${
                        assetKind === k
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => assetInput.current?.click()}>
                    <Upload className="mr-1 h-3.5 w-3.5" /> Upload {assetKind}
                  </Button>
                  <input
                    ref={assetInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) await addBrandAsset(kit.id, file, assetKind);
                    }}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {kit.assets.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Logos, product cutouts, textures and end-card art live here.
                  </p>
                )}
                {kit.assets.map((a) => (
                  <div key={a.id} className="rounded-xl border border-border p-2">
                    <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                      {a.url ? (
                        <img src={a.url} alt={a.name} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">missing file</span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-xs">{a.name}</p>
                    <select
                      value={a.rule}
                      onChange={(e) =>
                        updateBrandAsset(kit.id, a.id, { rule: e.target.value as UsageRule })
                      }
                      className="mt-2 w-full rounded-md border border-border bg-transparent px-2 py-1 text-[11px]"
                    >
                      {USAGE_RULES.map((r) => (
                        <option key={r} value={r} className="bg-background">
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeBrandAsset(kit.id, a.id)}
                      className="mt-2 text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* copy kits */}
        <div className="mt-10 rounded-2xl border border-border bg-card/60 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className={label}>Copy kits</p>
            <div className="ml-auto flex flex-wrap gap-2">
              {store.copyKits.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCopy(c.id);
                    setDraft({ ...c });
                  }}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    copy?.id === c.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Kit name"
            />
            <div className="flex gap-2">
              {(["exact", "shorten", "variations"] as CopyMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setDraft({ ...draft, mode: m })}
                  className={`rounded-full border px-3 py-1 text-xs capitalize ${
                    draft.mode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {m === "exact" ? "Exact copy" : m}
                </button>
              ))}
            </div>
            {(
              [
                ["hook", "Hook"],
                ["headline", "Headline"],
                ["feature", "Feature"],
                ["support", "Support line"],
                ["offer", "Offer"],
                ["cta", "CTA"],
              ] as const
            ).map(([field, name]) => (
              <label key={field} className="space-y-1.5">
                <span className={label}>{name}</span>
                <Input
                  value={draft[field]}
                  onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                />
              </label>
            ))}
            <label className="space-y-1.5 sm:col-span-2">
              <span className={label}>Extra lines (one per line)</span>
              <Textarea
                value={draft.extras.join("\n")}
                onChange={(e) =>
                  setDraft({ ...draft, extras: e.target.value.split("\n").filter((x) => x.trim()) })
                }
                className="min-h-20"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Exact copy mode never rewrites a line. If a template has more text slots than you have
            lines, the extra slots are removed instead of filled with invented words.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() =>
                saveCopyKit({
                  ...draft,
                  ...(copy ? { id: copy.id } : {}),
                  ...(kit ? { brandId: kit.id } : {}),
                })
              }
            >
              {copy ? "Update copy kit" : "Save copy kit"}
            </Button>
            {copy && (
              <Button variant="ghost" onClick={() => deleteCopyKit(copy.id)}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
