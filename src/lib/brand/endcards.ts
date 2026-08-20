/**
 * END CARDS
 *
 * A reusable, on-brand closing block: logo/product art, a CTA, a URL and an
 * offer line, in one of a few approved layouts. `appendEndCard` splices this
 * block onto the tail of a TemplateSpec using the existing text/graphic/
 * motion-asset structures so it renders in the Player without new renderer
 * code.
 */
import { useSyncExternalStore } from "react";
import type { GraphicSlot, MotionAssetEvent, TemplateSpec, TextSlot } from "@/lib/template/types";
import type { BrandKit } from "./store";

export type EndCardVariant = "primary" | "alternate" | "minimal";
export type EndCardBackground = "brand" | "asset" | "ink" | "transparent";

export interface EndCard {
  id: string;
  brandId: string;
  name: string;
  variant: EndCardVariant;
  logoAssetId?: string | undefined;
  productAssetId?: string | undefined;
  backgroundAssetId?: string | undefined;
  background: EndCardBackground;
  cta: string;
  url: string;
  offer: string;
  typeSystemId?: string | undefined;
  motionAssetId?: string | undefined;
  durationSec: number;
  entrance: "fade" | "slide_up" | "punch_in" | "none";
  exit: "fade" | "slide_down" | "none";
  createdAt: number;
}

interface EndCardState {
  cards: EndCard[];
}

const KEY = "tempo.brand.endcards.v1";
const empty: EndCardState = { cards: [] };
let state: EndCardState = empty;
let hydrated = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...empty, ...(JSON.parse(raw) as EndCardState) };
  } catch {
    /* ignore */
  }
}

function commit(next: EndCardState) {
  state = next;
  persist();
  notify();
}

export function useEndCards() {
  hydrate();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => empty,
  );
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`;

export function endCardsForBrand(brandId: string): EndCard[] {
  hydrate();
  return state.cards.filter((c) => c.brandId === brandId);
}

export function endCardById(id?: string | null): EndCard | undefined {
  hydrate();
  return state.cards.find((c) => c.id === id);
}

export function saveEndCard(card: Omit<EndCard, "id" | "createdAt"> & { id?: string }): EndCard {
  hydrate();
  const id = card.id ?? uid("endcard");
  const existing = state.cards.find((c) => c.id === id);
  const next: EndCard = { ...card, id, createdAt: existing?.createdAt ?? Date.now() };
  commit({ cards: [next, ...state.cards.filter((c) => c.id !== id)] });
  return next;
}

export function deleteEndCard(id: string) {
  hydrate();
  commit({ cards: state.cards.filter((c) => c.id !== id) });
}

export function defaultEndCard(brandId: string, kit?: BrandKit | null): Omit<EndCard, "id" | "createdAt"> {
  const logo = kit?.assets.find((a) => a.kind === "logo");
  const product = kit?.assets.find((a) => a.kind === "product");
  return {
    brandId,
    name: "End Card",
    variant: "primary",
    ...(logo ? { logoAssetId: logo.id } : {}),
    ...(product ? { productAssetId: product.id } : {}),
    background: "brand",
    cta: kit?.ctas[0] ?? "Shop now",
    url: "",
    offer: "",
    durationSec: 2.5,
    entrance: "fade",
    exit: "none",
  };
}

const ENDCARD_PREFIX = "endcard:";

/** Remove any previously appended end card block from a spec (by id prefix). */
function stripExistingEndCard(spec: TemplateSpec): TemplateSpec {
  return {
    ...spec,
    textSlots: spec.textSlots.filter((t) => !t.id.startsWith(ENDCARD_PREFIX)),
    graphicSlots: (spec.graphicSlots ?? []).filter((g) => !g.id.startsWith(ENDCARD_PREFIX)),
    motionAssets: (spec.motionAssets ?? []).filter((m) => !m.id.startsWith(ENDCARD_PREFIX)),
  };
}

/**
 * Append (or replace) the closing block of a TemplateSpec with an End Card:
 * CTA / URL / offer text slots plus logo/product placement, rendered through
 * the existing textSlots / graphicSlots / motionAssets arrays so the Remotion
 * Player shows it without any new renderer code.
 */
export function appendEndCard(spec: TemplateSpec, card: EndCard, kit?: BrandKit | null): TemplateSpec {
  const stripped = stripExistingEndCard(spec);
  const cardStart = stripped.duration;
  const duration = Math.max(0.5, card.durationSec);
  const newTotal = cardStart + duration;

  const style = card.entrance === "punch_in" ? "cta_lockup" : "centered_statement";

  const textSlots: TextSlot[] = [...stripped.textSlots];
  if (card.cta.trim()) {
    textSlots.push({
      id: `${ENDCARD_PREFIX}cta-${card.id}`,
      label: "CTA",
      value: card.cta,
      start: cardStart,
      duration,
      style: "cta_lockup",
      position: "center",
      align: "center",
      accent: true,
    });
  }
  if (card.offer.trim()) {
    textSlots.push({
      id: `${ENDCARD_PREFIX}offer-${card.id}`,
      label: "OFFER",
      value: card.offer,
      start: cardStart,
      duration,
      style: "highlight_bar",
      position: "top",
      align: "center",
    });
  }
  if (card.url.trim()) {
    textSlots.push({
      id: `${ENDCARD_PREFIX}url-${card.id}`,
      label: "URL",
      value: card.url,
      start: cardStart,
      duration,
      style: "minimal_caption",
      position: "bottom",
      align: "center",
    });
  }

  const graphicSlots: GraphicSlot[] = [...(stripped.graphicSlots ?? [])];
  if (card.variant !== "minimal") {
    graphicSlots.push({
      id: `${ENDCARD_PREFIX}badge-${card.id}`,
      kind: "badge",
      label: "END CARD",
      start: cardStart,
      duration,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      opacity: card.background === "transparent" ? 0 : 1,
      animation: card.entrance === "punch_in" ? "pop" : "fade",
    });
  }

  const motionAssets: MotionAssetEvent[] = [...(stripped.motionAssets ?? [])];
  const logoAsset = card.logoAssetId ?? kit?.assets.find((a) => a.kind === "logo")?.id;
  const productAsset = card.productAssetId ?? kit?.assets.find((a) => a.kind === "product")?.id;
  if (logoAsset) {
    motionAssets.push({
      id: `${ENDCARD_PREFIX}logo-${card.id}`,
      assetId: logoAsset,
      slotKey: "endcard_logo",
      label: "Logo",
      start: cardStart,
      duration,
      scale: 0.4,
      x: 50,
      y: card.productAssetId ? 30 : 45,
      opacity: 1,
    });
  }
  if (productAsset) {
    motionAssets.push({
      id: `${ENDCARD_PREFIX}product-${card.id}`,
      assetId: productAsset,
      slotKey: "endcard_product",
      label: "Product",
      start: cardStart,
      duration,
      scale: 0.7,
      x: 50,
      y: 65,
      opacity: 1,
    });
  }
  if (card.backgroundAssetId && card.background === "asset") {
    motionAssets.push({
      id: `${ENDCARD_PREFIX}bg-${card.id}`,
      assetId: card.backgroundAssetId,
      slotKey: "endcard_background",
      label: "Background",
      start: cardStart,
      duration,
      scale: 1,
      x: 50,
      y: 50,
      opacity: 1,
    });
  }
  if (card.motionAssetId) {
    motionAssets.push({
      id: `${ENDCARD_PREFIX}motion-${card.id}`,
      assetId: card.motionAssetId,
      slotKey: "endcard_motion",
      label: "Motion",
      start: cardStart,
      duration,
      scale: 1,
      x: 50,
      y: 50,
      opacity: 1,
    });
  }

  const palette =
    card.background === "ink"
      ? { ...stripped.palette, bg: stripped.palette.ink, ink: stripped.palette.bg }
      : stripped.palette;

  return {
    ...stripped,
    duration: newTotal,
    textSlots,
    graphicSlots,
    motionAssets,
    palette,
    endCardId: card.id,
    typeSystemIds: card.typeSystemId
      ? [...new Set([...(stripped.typeSystemIds ?? []), card.typeSystemId])]
      : (stripped.typeSystemIds ?? []),
  };
}
