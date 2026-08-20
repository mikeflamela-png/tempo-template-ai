/**
 * Executable renderer for the capability/kernel layer.
 * Every Technique in Tempo is (kernel id + params) and is drawn by this file,
 * both in the Player and in a server-side render.
 */
import { AbsoluteFill, Img, Video, interpolate, random, useVideoConfig } from "remotion";
import { num, str, type Params } from "@/lib/creative/kernels";
import type { MediaAssignment, Palette } from "@/lib/template/types";

export interface KernelRenderProps {
  kernelId: string;
  params: Params;
  /** 0..1 across the event */
  p: number;
  frame: number;
  palette: Palette;
  footage?: MediaAssignment | null | undefined;
  word?: string | undefined;
  seed?: number | undefined;
  fontFamily?: string | undefined;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
const easeInOut = (v: number) => (v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2);

/* ------------------------------------------------------------- path helpers */

/** Irregular torn edge across the frame, returned as an SVG polygon clip-path. */
function tornEdgePolygon(
  direction: string,
  progress: number,
  rough: number,
  fiber: number,
  seed: number,
) {
  const steps = Math.round(18 + fiber * 34);
  const pts: string[] = [];
  const edge = progress * 118 - 9;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const n =
      (random(`${seed}-${i}`) - 0.5) * 9 * rough +
      Math.sin(t * 11 + seed) * 3 * rough +
      Math.sin(t * 37 + seed * 2) * 1.6 * fiber;
    const pos = edge + n;
    if (direction === "right") pts.push(`${pos}% ${t * 100}%`);
    else if (direction === "left") pts.push(`${100 - pos}% ${t * 100}%`);
    else if (direction === "down") pts.push(`${t * 100}% ${pos}%`);
    else pts.push(`${t * 100}% ${100 - pos}%`);
  }
  if (direction === "right") return `polygon(0% 0%, ${pts.join(", ")}, 0% 100%)`;
  if (direction === "left") return `polygon(100% 0%, ${pts.join(", ")}, 100% 100%)`;
  if (direction === "down") return `polygon(0% 0%, ${pts.join(", ")}, 100% 0%)`;
  return `polygon(0% 100%, ${pts.join(", ")}, 100% 100%)`;
}

/** Organic blob clip-path that grows from a point. */
function blobPolygon(
  x: number,
  y: number,
  radius: number,
  lobes: number,
  irregular: number,
  seed: number,
) {
  const pts: string[] = [];
  const steps = Math.max(12, Math.round(lobes * 6));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wob =
      1 +
      Math.sin(a * lobes + seed) * 0.22 * irregular +
      (random(`${seed}-b-${i}`) - 0.5) * 0.3 * irregular;
    pts.push(`${(x + Math.cos(a) * radius * wob) * 100}% ${(y + Math.sin(a) * radius * wob * 1.7) * 100}%`);
  }
  return `polygon(${pts.join(", ")})`;
}

function scribblePath(x: number, y: number, chaos: number, density: number, seed: number) {
  const pts: string[] = [];
  const count = Math.round(14 + density * 34);
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const r = 0.06 + t * 0.34 * (0.5 + density);
    const a = t * Math.PI * (5 + chaos * 9);
    const jx = (random(`${seed}-sx-${i}`) - 0.5) * 0.14 * chaos;
    const jy = (random(`${seed}-sy-${i}`) - 0.5) * 0.14 * chaos;
    pts.push(`${(x + Math.cos(a) * r + jx) * 100},${(y + Math.sin(a) * r * 1.5 + jy) * 100}`);
  }
  return `M ${pts.join(" L ")}`;
}

function wobblyEllipse(x: number, y: number, size: number, wobble: number, seed: number) {
  const pts: string[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2.05 - 0.4;
    const w = 1 + Math.sin(a * 3 + seed) * 0.06 * wobble + (random(`${seed}-w-${i}`) - 0.5) * 0.05 * wobble;
    pts.push(`${(x + Math.cos(a) * size * 0.62 * w) * 100},${(y + Math.sin(a) * size * 0.9 * w) * 100}`);
  }
  return `M ${pts.join(" L ")}`;
}

/* ---------------------------------------------------------------- footage */

function Footage({
  media,
  style,
  className,
}: {
  media?: MediaAssignment | null | undefined;
  style?: React.CSSProperties | undefined;
  className?: string | undefined;
}) {
  if (!media) {
    return <div className={className} style={{ background: "#1b1b1e", ...style }} />;
  }
  const common = {
    className,
    style: { width: "100%", height: "100%", objectFit: "cover" as const, ...style },
  };
  if (media.kind === "video") {
    return (
      <Video
        src={media.url}
        muted
        startFrom={Math.round((media.inPoint ?? 0) * 30)}
        {...common}
      />
    );
  }
  return <Img src={media.url} {...common} />;
}

/* ---------------------------------------------------------------- kernels */

export function CreativeKernel(props: KernelRenderProps) {
  const { kernelId, params, p, frame, palette, fontFamily, footage, word, seed = 7 } = props;
  const { width, height } = useVideoConfig();
  const ink = palette.ink;
  const accent = palette.accent;
  const e = easeOut(p);

  switch (kernelId) {
    /* -------------------------------------------------- analog / paper */
    case "paper_rip": {
      const dir = str(params, "direction", "right");
      const clip = tornEdgePolygon(dir, e, num(params, "tearAmount", 0.55), num(params, "fiber", 0.5), seed);
      const shadow = num(params, "shadowDepth", 0.5);
      return (
        <AbsoluteFill style={{ transform: `rotate(${num(params, "rotation", -4) * (1 - e)}deg)` }}>
          <AbsoluteFill
            style={{
              clipPath: clip,
              background: str(params, "paper", "#efe9dd"),
              filter: `drop-shadow(${shadow * 26}px ${shadow * 18}px ${shadow * 30}px rgba(0,0,0,${0.35 + shadow * 0.4}))`,
            }}
          >
            <AbsoluteFill
              style={{
                opacity: 0.35,
                mixBlendMode: "multiply",
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.035' numOctaves='5'/%3E%3C/filter%3E%3Crect width='260' height='260' filter='url(%23p)'/%3E%3C/svg%3E\")",
              }}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
    case "ripped_edge_wipe": {
      const dir = str(params, "direction", "up");
      const clip = tornEdgePolygon(dir, e, num(params, "rough", 0.6), 0.8, seed + 3);
      return (
        <AbsoluteFill
          style={{
            clipPath: clip,
            background: str(params, "tint", "#101010"),
            filter: "drop-shadow(0 10px 26px rgba(0,0,0,0.5))",
          }}
        />
      );
    }
    case "film_burn": {
      const cx = num(params, "x", 0.4) * 100;
      const cy = num(params, "y", 0.55) * 100;
      const r = e * 150 * num(params, "spread", 0.8);
      const i = num(params, "intensity", 0.7);
      return (
        <AbsoluteFill style={{ mixBlendMode: "screen" }}>
          <AbsoluteFill
            style={{
              background: `radial-gradient(circle at ${cx}% ${cy}%, rgba(255,255,240,${0.95 * i}) ${r * 0.35}%, rgba(255,150,40,${0.85 * i}) ${r * 0.62}%, rgba(180,40,0,${0.4 * i}) ${r * 0.85}%, rgba(0,0,0,0) ${r}%)`,
            }}
          />
          <AbsoluteFill
            style={{
              opacity: 0.5 * i,
              mixBlendMode: "overlay",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
              backgroundPosition: `${frame * 13}px ${frame * 7}px`,
            }}
          />
        </AbsoluteFill>
      );
    }
    case "photocopy_flash": {
      const barW = num(params, "bar", 0.18);
      const pos = interpolate(easeInOut(p), [0, 1], [-barW, 1]);
      const blow = num(params, "blowout", 0.7);
      return (
        <AbsoluteFill>
          <AbsoluteFill
            style={{
              mixBlendMode: "screen",
              opacity: blow,
              background: `linear-gradient(180deg, transparent ${pos * 100}%, rgba(255,255,255,0.95) ${(pos + barW * 0.5) * 100}%, transparent ${(pos + barW) * 100}%)`,
            }}
          />
          <AbsoluteFill
            style={{
              mixBlendMode: "multiply",
              opacity: 0.35 * num(params, "dust", 0.5) * (1 - p),
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='d'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.5' numOctaves='2'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23d)'/%3E%3C/svg%3E\")",
            }}
          />
        </AbsoluteFill>
      );
    }
    case "light_leak": {
      const a = num(params, "angle", 105);
      const w = num(params, "width", 0.45);
      const pos = interpolate(easeInOut(p), [0, 1], [-30, 130]);
      const warm = num(params, "warmth", 0.6);
      const col = `rgba(${255},${Math.round(160 + warm * 70)},${Math.round(90 + (1 - warm) * 140)},0.85)`;
      return (
        <AbsoluteFill style={{ mixBlendMode: "screen" }}>
          <AbsoluteFill
            style={{
              background: `linear-gradient(${a}deg, transparent ${pos - w * 60}%, ${col} ${pos}%, transparent ${pos + w * 60}%)`,
              filter: `blur(${10 + num(params, "bloom", 0.5) * 40}px)`,
            }}
          />
        </AbsoluteFill>
      );
    }
    case "texture_wash": {
      const tex = str(params, "texture", "paper");
      const freq =
        tex === "grain" ? 0.85 : tex === "photocopy" ? 0.35 : tex === "dust" ? 0.5 : 0.04;
      const drift = num(params, "drift", 0.4);
      return (
        <AbsoluteFill
          style={{
            opacity: num(params, "opacity", 0.3),
            mixBlendMode: tex === "grain" ? "overlay" : "multiply",
            filter: `contrast(${1 + num(params, "contrast", 0.4)})`,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cfilter id='t'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='5'/%3E%3C/filter%3E%3Crect width='320' height='320' filter='url(%23t)'/%3E%3C/svg%3E")`,
            backgroundPosition: `${frame * drift * 6}px ${frame * drift * 4}px`,
          }}
        />
      );
    }

    /* --------------------------------------------------- hand drawn */
    case "marker_circle": {
      const d = wobblyEllipse(
        num(params, "x", 0.5),
        num(params, "y", 0.5),
        num(params, "size", 0.4),
        num(params, "wobble", 0.5),
        seed,
      );
      const laps = num(params, "laps", 1.25);
      const len = 400 * laps;
      return (
        <AbsoluteFill>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
            <path
              d={d}
              fill="none"
              stroke={accent}
              strokeWidth={num(params, "stroke", 10) / 8}
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={len * (1 - easeOut(Math.min(p * 1.25, 1)))}
              vectorEffect="non-scaling-stroke"
              style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.4))" }}
            />
          </svg>
        </AbsoluteFill>
      );
    }
    case "scribble_impact": {
      const d = scribblePath(
        num(params, "x", 0.5),
        num(params, "y", 0.5),
        num(params, "chaos", 0.6),
        num(params, "density", 0.5),
        seed,
      );
      const len = 1200;
      const burst = clamp01((p - 0.45) / 0.35);
      return (
        <AbsoluteFill>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
            <path
              d={d}
              fill="none"
              stroke={accent}
              strokeWidth={num(params, "stroke", 8) / 8}
              strokeLinecap="round"
              strokeDasharray={len}
              strokeDashoffset={len * (1 - easeOut(Math.min(p * 1.6, 1)))}
              vectorEffect="non-scaling-stroke"
            />
            {burst > 0 &&
              Array.from({ length: 9 }).map((_, i) => {
                const a = (i / 9) * Math.PI * 2 + seed;
                const x = num(params, "x", 0.5) * 100;
                const y = num(params, "y", 0.5) * 100;
                const r0 = 10 + burst * 8;
                const r1 = r0 + 6 + burst * 14;
                return (
                  <line
                    key={i}
                    x1={x + Math.cos(a) * r0}
                    y1={y + Math.sin(a) * r0 * 1.5}
                    x2={x + Math.cos(a) * r1}
                    y2={y + Math.sin(a) * r1 * 1.5}
                    stroke={ink}
                    strokeWidth={0.7}
                    opacity={1 - burst}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
          </svg>
        </AbsoluteFill>
      );
    }

    /* ---------------------------------------------------- footage based */
    case "frame_echo": {
      const copies = Math.round(num(params, "copies", 4));
      const off = num(params, "offset", 26);
      const ang = (num(params, "angle", 25) * Math.PI) / 180;
      const decay = num(params, "decay", 0.55);
      const blend = str(params, "blend", "screen") as React.CSSProperties["mixBlendMode"];
      return (
        <AbsoluteFill>
          {Array.from({ length: copies }).map((_, i) => {
            const k = i + 1;
            const o = Math.pow(decay, k) * (1 - p * 0.4);
            return (
              <AbsoluteFill
                key={i}
                style={{
                  transform: `translate(${Math.cos(ang) * off * k}px, ${Math.sin(ang) * off * k}px) scale(${1 + k * 0.02})`,
                  opacity: o,
                  mixBlendMode: blend,
                }}
              >
                <Footage media={footage} />
              </AbsoluteFill>
            );
          })}
        </AbsoluteFill>
      );
    }
    case "ghost_trail": {
      const len = num(params, "length", 0.5);
      const ang = (num(params, "angle", 90) * Math.PI) / 180;
      return (
        <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.55 * (1 - p * 0.5) }}>
          <AbsoluteFill
            style={{
              transform: `translate(${Math.cos(ang) * len * 90}px, ${Math.sin(ang) * len * 90}px) scale(1.06)`,
              filter: `blur(${6 + len * 26}px) saturate(${1 + num(params, "tint", 0.4)})`,
            }}
          >
            <Footage media={footage} />
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
    case "mask_draw_on": {
      const clip = blobPolygon(
        num(params, "x", 0.5),
        num(params, "y", 0.5),
        easeOut(p) * 0.95,
        Math.round(num(params, "lobes", 7)),
        num(params, "irregular", 0.5),
        seed,
      );
      return (
        <AbsoluteFill style={{ clipPath: clip }}>
          <Footage media={footage} />
          <AbsoluteFill style={{ boxShadow: `inset 0 0 120px rgba(0,0,0,0.45)` }} />
        </AbsoluteFill>
      );
    }
    case "contact_sheet": {
      const cols = Math.round(num(params, "cols", 3));
      const rows = cols;
      const scatter = num(params, "scatter", 0.5);
      const stagger = num(params, "stagger", 0.5);
      return (
        <AbsoluteFill style={{ background: palette.bg }}>
          {Array.from({ length: cols * rows }).map((_, i) => {
            const cx = i % cols;
            const cy = Math.floor(i / cols);
            const delay = (i / (cols * rows)) * stagger * 0.6;
            const pp = easeOut(clamp01((p - delay) / Math.max(0.12, 1 - delay)));
            const jx = (random(`${seed}-cx-${i}`) - 0.5) * scatter * 40;
            const jy = (random(`${seed}-cy-${i}`) - 0.5) * scatter * 40;
            const rot = (random(`${seed}-cr-${i}`) - 0.5) * scatter * 10;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${(cx / cols) * 100}%`,
                  top: `${(cy / rows) * 100}%`,
                  width: `${100 / cols}%`,
                  height: `${100 / rows}%`,
                  padding: width * 0.008,
                  opacity: pp,
                  transform: `translate(${jx * (1 - pp)}px, ${jy * (1 - pp)}px) scale(${0.8 + pp * 0.2}) rotate(${rot * (1 - pp)}deg)`,
                }}
              >
                <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#000" }}>
                  <Footage media={footage} />
                  {num(params, "numbers", 1) > 0.5 && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        right: 8,
                        fontFamily: "monospace",
                        fontSize: width * 0.016,
                        color: accent,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </AbsoluteFill>
      );
    }
    case "photo_stack": {
      const count = Math.round(num(params, "count", 4));
      const spread = num(params, "spread", 0.5);
      const tilt = num(params, "tilt", 0.5);
      const border = num(params, "border", 18);
      return (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          {Array.from({ length: count }).map((_, i) => {
            const delay = (i / count) * 0.55;
            const pp = easeOut(clamp01((p - delay) / 0.45));
            const dx = (random(`${seed}-px-${i}`) - 0.5) * spread * width * 0.4;
            const dy = (random(`${seed}-py-${i}`) - 0.5) * spread * height * 0.22;
            const rot = (random(`${seed}-pr-${i}`) - 0.5) * tilt * 22;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: width * 0.52,
                  height: height * 0.34,
                  background: "#fff",
                  padding: border,
                  boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                  opacity: pp,
                  transform: `translate(${dx * pp}px, ${dy * pp - (1 - pp) * 120}px) rotate(${rot * pp}deg) scale(${0.9 + pp * 0.1})`,
                }}
              >
                <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#000" }}>
                  <Footage media={footage} />
                </div>
              </div>
            );
          })}
        </AbsoluteFill>
      );
    }
    case "film_strip_rush": {
      const frames = Math.round(num(params, "frames", 5));
      const vertical = str(params, "axis", "vertical") === "vertical";
      const travel = interpolate(easeInOut(p), [0, 1], [0, -100 * num(params, "speed", 0.7) * frames * 0.5]);
      const gate = num(params, "gate", 0.4);
      return (
        <AbsoluteFill style={{ background: "#08080a", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: vertical ? "column" : "row",
              transform: vertical ? `translateY(${travel}%)` : `translateX(${travel}%)`,
            }}
          >
            {Array.from({ length: frames * 2 }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: "relative",
                  flex: "0 0 auto",
                  width: vertical ? "100%" : `${100 / 2}%`,
                  height: vertical ? `${100 / 2}%` : "100%",
                  borderTop: "6px solid #08080a",
                  borderBottom: "6px solid #08080a",
                  overflow: "hidden",
                }}
              >
                <Footage media={footage} />
              </div>
            ))}
          </div>
          {/* sprockets */}
          {[0, 1].map((side) => (
            <div
              key={side}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                [side ? "right" : "left"]: 0,
                width: width * 0.055,
                background: "#0b0b0d",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-around",
                alignItems: "center",
                transform: `translateY(${(travel % 20) * 2}px)`,
              } as React.CSSProperties}
            >
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: "52%",
                    height: height * 0.022,
                    borderRadius: 4,
                    background: "#e8e6e0",
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>
          ))}
          <AbsoluteFill
            style={{
              background: "#fff",
              opacity: gate * (random(`${seed}-g-${Math.floor(frame / 2)}`) > 0.82 ? 0.16 : 0),
            }}
          />
        </AbsoluteFill>
      );
    }
    case "magnifier": {
      const size = num(params, "size", 0.34);
      const zoom = num(params, "zoom", 2.2);
      const travel = num(params, "travel", 0.4);
      const cx = 0.5 + Math.sin(p * Math.PI * 2) * travel * 0.28;
      const cy = 0.5 + Math.cos(p * Math.PI * 1.4) * travel * 0.16;
      const d = size * Math.min(width, height) * 1.2;
      return (
        <AbsoluteFill>
          <div
            style={{
              position: "absolute",
              left: cx * width - d / 2,
              top: cy * height - d / 2,
              width: d,
              height: d,
              borderRadius: "50%",
              overflow: "hidden",
              border: `${num(params, "ring", 6)}px solid ${accent}`,
              boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
              opacity: easeOut(Math.min(p * 4, 1)),
            }}
          >
            <div
              style={{
                position: "absolute",
                width: width * zoom,
                height: height * zoom,
                left: -cx * width * zoom + d / 2,
                top: -cy * height * zoom + d / 2,
              }}
            >
              <Footage media={footage} />
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case "freeze_annotation": {
      const desat = num(params, "desaturate", 0.7);
      const px = num(params, "x", 0.62);
      const py = num(params, "y", 0.45);
      const lines = Math.round(num(params, "lines", 2));
      const style = str(params, "labelStyle", "ticket");
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ filter: `saturate(${1 - desat}) contrast(1.08)` }}>
            <Footage media={footage} />
          </AbsoluteFill>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", position: "absolute" }}>
            {Array.from({ length: lines }).map((_, i) => {
              const a = -0.6 + i * 0.9;
              const ex = px + Math.cos(a) * 0.3;
              const ey = py + Math.sin(a) * 0.22;
              const pp = easeOut(clamp01((p - i * 0.15) / 0.45));
              return (
                <line
                  key={i}
                  x1={px * 100}
                  y1={py * 100}
                  x2={(px + (ex - px) * pp) * 100}
                  y2={(py + (ey - py) * pp) * 100}
                  stroke={accent}
                  strokeWidth={0.4}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            <circle cx={px * 100} cy={py * 100} r={1.1} fill={accent} />
          </svg>
          <div
            style={{
              position: "absolute",
              left: `${(px + 0.3) * 100}%`,
              top: `${(py - 0.22) * 100}%`,
              transform: "translate(0,-50%)",
              opacity: easeOut(clamp01((p - 0.28) / 0.3)),
              fontFamily,
              fontWeight: 700,
              fontSize: width * 0.036,
              letterSpacing: 1,
              color: style === "boxed" ? palette.bg : ink,
              background: style === "boxed" ? accent : style === "ticket" ? "rgba(0,0,0,0.55)" : "transparent",
              borderBottom: style === "underline" ? `4px solid ${accent}` : undefined,
              padding: style === "underline" ? "0 0 6px" : `${width * 0.008}px ${width * 0.016}px`,
              textTransform: "uppercase",
            }}
          >
            {word ?? "Detail"}
          </div>
        </AbsoluteFill>
      );
    }

    /* ----------------------------------------------------- typography */
    case "type_crash": {
      const overshoot = num(params, "overshoot", 0.6);
      const shake = num(params, "shake", 0.5);
      const s = interpolate(easeOut(Math.min(p * 2.4, 1)), [0, 1], [2.4 + overshoot, 1]);
      const sh = p > 0.35 ? 0 : (random(`${seed}-s-${frame}`) - 0.5) * shake * 34;
      const treat = str(params, "treatment", "solid");
      return (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: width * num(params, "size", 0.24),
              lineHeight: 0.86,
              textTransform: "uppercase",
              letterSpacing: -2,
              transform: `translate(${sh}px, ${sh * 0.4}px) scale(${s}) rotate(${num(params, "rotation", -3)}deg)`,
              color: treat === "outline" ? "transparent" : treat === "knockout" ? palette.bg : ink,
              WebkitTextStroke: treat === "outline" ? `${width * 0.004}px ${ink}` : undefined,
              background: treat === "knockout" ? accent : undefined,
              padding: treat === "knockout" ? `0 ${width * 0.02}px` : undefined,
              textAlign: "center",
            }}
          >
            {word ?? "NOW"}
          </div>
        </AbsoluteFill>
      );
    }
    case "word_push": {
      const dir = str(params, "direction", "left");
      const force = num(params, "force", 0.7);
      const t = easeInOut(p);
      const axis = dir === "left" || dir === "right" ? "X" : "Y";
      const sign = dir === "left" || dir === "up" ? -1 : 1;
      const dist = (axis === "X" ? width : height) * 1.1;
      return (
        <AbsoluteFill>
          <AbsoluteFill
            style={{
              background: accent,
              transform: `translate${axis}(${sign * dist * (1 - t) * -1}px)`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 900,
                fontSize: width * num(params, "size", 0.3),
                color: palette.bg,
                textTransform: "uppercase",
                letterSpacing: -3,
                transform: `scale(${1 + force * 0.1 * (1 - t)})`,
              }}
            >
              {word ?? "GO"}
            </span>
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
    case "editorial_numbers": {
      const from = Math.round(num(params, "from", 1));
      const to = Math.round(num(params, "to", 6));
      const v = Math.round(interpolate(easeOut(p), [0, 1], [from, to]));
      const corner = str(params, "corner", "bl");
      const pad = width * 0.07;
      const pos: React.CSSProperties = {
        top: corner.startsWith("t") ? pad : undefined,
        bottom: corner.startsWith("b") ? pad : undefined,
        left: corner.endsWith("l") ? pad : undefined,
        right: corner.endsWith("r") ? pad : undefined,
      };
      return (
        <div
          style={{
            position: "absolute",
            ...pos,
            fontFamily,
            fontWeight: 800,
            fontSize: width * num(params, "size", 0.12),
            color: ink,
            opacity: 0.9,
            letterSpacing: -2,
          }}
        >
          {String(v).padStart(2, "0")}
          <span style={{ fontSize: "0.35em", opacity: 0.6, marginLeft: 8 }}>
            /{String(to).padStart(2, "0")}
          </span>
        </div>
      );
    }

    /* -------------------------------------------------------- social */
    case "shutter_sequence": {
      const shots = Math.round(num(params, "shots", 5));
      const phase = p * shots;
      const local = phase % 1;
      const flashing = local < 0.32;
      const bright = num(params, "brightness", 0.8);
      return (
        <AbsoluteFill>
          <AbsoluteFill
            style={{
              background: local < 0.14 ? "#000" : "#fff",
              opacity: flashing ? (local < 0.14 ? 0.9 : bright * (1 - local * 2)) : 0,
            }}
          />
          {num(params, "brackets", 1) > 0.5 && (
            <AbsoluteFill style={{ padding: width * 0.09 }}>
              {[
                [0, 0],
                [1, 0],
                [0, 1],
                [1, 1],
              ].map(([bx, by], i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    [bx ? "right" : "left"]: width * 0.09,
                    [by ? "bottom" : "top"]: width * 0.09,
                    width: width * 0.11,
                    height: width * 0.11,
                    borderTop: by ? undefined : `4px solid ${ink}`,
                    borderBottom: by ? `4px solid ${ink}` : undefined,
                    borderLeft: bx ? undefined : `4px solid ${ink}`,
                    borderRight: bx ? `4px solid ${ink}` : undefined,
                    opacity: 0.85,
                  } as React.CSSProperties}
                />
              ))}
            </AbsoluteFill>
          )}
        </AbsoluteFill>
      );
    }

    /* ------------------------------------------------------ editorial */
    case "crop_marks": {
      const inset = num(params, "inset", 0.07);
      const w = num(params, "weight", 2);
      const reveal = easeOut(Math.min(p * 2, 1));
      const mark = (x: number, y: number, i: number) => (
        <g key={i} opacity={reveal}>
          <line x1={x - 3} y1={y} x2={x + 3} y2={y} stroke={ink} strokeWidth={w / 8} vectorEffect="non-scaling-stroke" />
          <line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke={ink} strokeWidth={w / 8} vectorEffect="non-scaling-stroke" />
        </g>
      );
      const a = inset * 100;
      return (
        <AbsoluteFill>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
            {[
              [a, a],
              [100 - a, a],
              [a, 100 - a],
              [100 - a, 100 - a],
            ].map(([x, y], i) => mark(x!, y!, i))}
            {num(params, "grid", 0.4) > 0.05 &&
              [1, 2].map((i) => (
                <g key={`g${i}`} opacity={num(params, "grid", 0.4) * 0.5 * reveal}>
                  <line x1={a + ((100 - 2 * a) / 3) * i} y1={a} x2={a + ((100 - 2 * a) / 3) * i} y2={100 - a} stroke={ink} strokeWidth={0.15} vectorEffect="non-scaling-stroke" />
                  <line x1={a} y1={a + ((100 - 2 * a) / 3) * i} x2={100 - a} y2={a + ((100 - 2 * a) / 3) * i} stroke={ink} strokeWidth={0.15} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
          </svg>
          <div
            style={{
              position: "absolute",
              left: `${a}%`,
              bottom: `${a}%`,
              transform: "translateY(140%)",
              fontFamily: "monospace",
              fontSize: width * 0.022,
              letterSpacing: 3,
              color: ink,
              opacity: reveal * 0.8,
            }}
          >
            FIG. {String(Math.round(num(params, "index", 3))).padStart(2, "0")}
          </div>
        </AbsoluteFill>
      );
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------- event wrapper */

import { useCurrentFrame } from "remotion";
import type { CreativeEvent, MediaMap, TemplateSpec } from "@/lib/template/types";
import { fontByKey } from "@/lib/template/fonts";

export function CreativeEventLayer({
  event,
  spec,
  media,
}: {
  event: CreativeEvent;
  spec: TemplateSpec;
  media: MediaMap;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = Math.max(1, Math.round(event.duration * fps));
  const p = Math.min(1, frame / total);

  // footage playing underneath at this moment
  const slot =
    spec.mediaSlots.find(
      (s) => s.start <= event.start + 0.01 && s.start + s.duration > event.start && s.layout === "full",
    ) ??
    spec.mediaSlots.find((s) => s.start <= event.start + 0.01 && s.start + s.duration > event.start) ??
    spec.mediaSlots[0];
  const footage = slot ? media[slot.id] ?? null : null;

  return (
    <AbsoluteFill style={{ opacity: event.opacity ?? 1 }}>
      <CreativeKernel
        kernelId={event.kernel}
        params={event.params}
        p={p}
        frame={frame}
        palette={spec.palette}
        fontFamily={fontByKey(spec.fontKey).stack}
        footage={footage}
        word={event.word ?? spec.textSlots[0]?.value}
        seed={event.seed ?? 7}
      />
    </AbsoluteFill>
  );
}
