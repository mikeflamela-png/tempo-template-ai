import ph1 from "@/assets/ph-1.jpg";
import ph2 from "@/assets/ph-2.jpg";
import ph3 from "@/assets/ph-3.jpg";
import ph4 from "@/assets/ph-4.jpg";
import ph5 from "@/assets/ph-5.jpg";
import ph6 from "@/assets/ph-6.jpg";
import type { Purpose } from "./types";

export const PLACEHOLDERS = [ph1, ph2, ph3, ph4, ph5, ph6];

const byPurpose: Record<Purpose, string[]> = {
  hook: [ph3, ph2, ph6],
  product: [ph1, ph4, ph6],
  detail: [ph2, ph5, ph1],
  lifestyle: [ph3, ph6, ph5],
  proof: [ph6, ph2, ph3],
  hero: [ph4, ph1, ph2],
};

export function placeholderFor(purpose: Purpose, index: number) {
  const list = byPurpose[purpose] ?? PLACEHOLDERS;
  return list[index % list.length]!;
}