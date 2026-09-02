import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  Img,
  OffthreadVideo,
  Sequence,
  Video,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  Animation,
  AudioTrack,
  MediaMap,
  MediaSlot,
  Overlay,
  TemplateSpec,
  TextSlot,
} from "@/lib/template/types";
import { LAYOUT_BOXES } from "@/lib/template/layouts";
import { fontByKey, registerRuntimeFont } from "@/lib/template/fonts";
import type { AssetUrlMap } from "@/lib/render/resolve";
import { placeholderFor } from "@/lib/template/placeholders";
import { CreativeEventLayer } from "./CreativeEventLayer";
import { GraphicLayer } from "./GraphicLayer";
import { MotionAssetLayer } from "./MotionAssetLayer";



/* ------------------------------------------------------------------ motion */

type Motion = {
  scale: number;
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
  rotate: number;
  skew: number;
  perspective: number;
  opacity: number;
  blur: number;
  blurAngle: number;
  rgb: number;
  clipInset: [number, number, number, number];
};

const base = (): Motion => ({
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  x: 0,
  y: 0,
  rotate: 0,
  skew: 0,
  perspective: 0,
  opacity: 1,
  blur: 0,
  blurAngle: 0,
  rgb: 0,
  clipInset: [0, 0, 0, 0],
});

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

function applyIn(anim: Animation, p: number, mo: Motion, s: number, frame: number) {
  const e = easeOut(p);
  switch (anim) {
    case "punch_in":
      mo.scale *= interpolate(e, [0, 1], [1.35, 1.08]);
      break;
    case "push_in":
      mo.scale *= interpolate(e, [0, 1], [1.02, 1.12]);
      break;
    case "slow_push_in":
      mo.scale *= interpolate(e, [0, 1], [1.0, 1.03]);
      break;
    case "aggressive_push_in":
      mo.scale *= interpolate(e, [0, 1], [1.0, 1.3]);
      break;
    case "pull_out":
      mo.scale *= interpolate(e, [0, 1], [1.3, 1.04]);
      break;
    case "snap_zoom":
      mo.scale *= interpolate(Math.min(p * 2.2, 1), [0, 1], [1.9, 1.05]);
      mo.opacity *= interpolate(p, [0, 0.12], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "slide_left":
      mo.x += interpolate(e, [0, 1], [40, 0]);
      mo.scale *= 1.06;
      break;
    case "slide_right":
      mo.x += interpolate(e, [0, 1], [-40, 0]);
      mo.scale *= 1.06;
      break;
    case "slide_up":
      mo.y += interpolate(e, [0, 1], [45, 0]);
      mo.scale *= 1.06;
      break;
    case "slide_down":
      mo.y += interpolate(e, [0, 1], [-45, 0]);
      mo.scale *= 1.06;
      break;
    case "snap_move":
      mo.x += interpolate(Math.min(p * 3, 1), [0, 1], [60, 0]);
      break;
    case "overshoot":
      mo.scale *= interpolate(s, [0, 1], [0.88, 1]) * (1 + Math.max(0, 0.06 - p * 0.3));
      mo.y += interpolate(s, [0, 1], [40, 0]);
      break;
    case "bounce":
      mo.y += Math.abs(Math.sin(p * Math.PI * 2)) * (1 - p) * -46;
      break;
    case "scale_bounce":
    case "elastic_scale":
      mo.scale *= interpolate(s, [0, 1], [0.7, 1]);
      mo.opacity *= interpolate(p, [0, 0.18], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "blur_in":
      mo.blur += interpolate(e, [0, 1], [22, 0]);
      mo.scale *= 1.08;
      break;
    case "smear_in":
      mo.blur += interpolate(e, [0, 1], [30, 0]);
      mo.blurAngle = 90;
      mo.scaleX *= interpolate(e, [0, 1], [1.3, 1]);
      break;
    case "mask_reveal":
      mo.clipInset[1] = interpolate(e, [0, 1], [100, 0]);
      mo.scale *= interpolate(e, [0, 1], [1.18, 1.04]);
      break;
    case "expand":
      mo.clipInset = [
        interpolate(e, [0, 1], [42, 0]),
        interpolate(e, [0, 1], [8, 0]),
        interpolate(e, [0, 1], [42, 0]),
        interpolate(e, [0, 1], [8, 0]),
      ];
      mo.scale *= 1.05;
      break;
    case "collapse":
      mo.clipInset = [
        interpolate(e, [0, 1], [0, 18]),
        interpolate(e, [0, 1], [0, 30]),
        interpolate(e, [0, 1], [0, 18]),
        interpolate(e, [0, 1], [0, 30]),
      ];
      break;
    case "rotate_snap":
      mo.rotate += interpolate(Math.min(p * 2.4, 1), [0, 1], [-6, 0]);
      mo.scale *= 1.1;
      break;
    case "perspective_tilt":
      mo.perspective = interpolate(e, [0, 1], [16, 3]);
      mo.scale *= 1.1;
      break;
    case "handheld":
      mo.x += random(`hh-x${Math.floor(frame / 2)}`) * 6 - 3;
      mo.y += random(`hh-y${Math.floor(frame / 2)}`) * 6 - 3;
      mo.scale *= 1.04;
      break;
    default:
      break;
  }
}

function applyDuring(anim: Animation, p: number, mo: Motion, frame: number) {
  switch (anim) {
    case "drift":
      mo.scale *= interpolate(p, [0, 1], [1.0, 1.08]);
      mo.x += Math.sin(p * Math.PI) * 6;
      break;
    case "float":
      mo.y += Math.sin(p * Math.PI * 2) * 10;
      mo.rotate += Math.sin(p * Math.PI * 2) * 0.8;
      break;
    case "pan_left":
      mo.x += interpolate(p, [0, 1], [40, -40]);
      mo.scale *= 1.18;
      break;
    case "pan_right":
      mo.x += interpolate(p, [0, 1], [-40, 40]);
      mo.scale *= 1.18;
      break;
    case "pan_up":
      mo.y += interpolate(p, [0, 1], [50, -50]);
      mo.scale *= 1.2;
      break;
    case "pan_down":
      mo.y += interpolate(p, [0, 1], [-50, 50]);
      mo.scale *= 1.2;
      break;
    case "push_in":
      mo.scale *= interpolate(p, [0, 1], [1, 1.16]);
      break;
    case "slow_push_in":
      mo.scale *= interpolate(p, [0, 1], [1, 1.06]);
      break;
    case "aggressive_push_in":
      mo.scale *= interpolate(p, [0, 1], [1, 1.4]);
      break;
    case "pull_out":
      mo.scale *= interpolate(p, [0, 1], [1.16, 1]);
      break;
    case "subtle_rotate":
      mo.rotate += interpolate(p, [0, 1], [-1.6, 1.6]);
      mo.scale *= 1.08;
      break;
    case "handheld":
      mo.x += random(`d-x${Math.floor(frame / 3)}`) * 8 - 4;
      mo.y += random(`d-y${Math.floor(frame / 3)}`) * 8 - 4;
      mo.rotate += random(`d-r${Math.floor(frame / 5)}`) * 0.8 - 0.4;
      mo.scale *= 1.05;
      break;
    case "freeze":
      break;
    default:
      break;
  }
}

/** p: 0 -> 1 across the outgoing window */
function applyOut(kind: string, p: number, mo: Motion) {
  switch (kind) {
    case "whip":
      mo.x -= p * 90;
      mo.blur += p * 26;
      break;
    case "directional_blur":
      mo.blur += p * 30;
      mo.blurAngle = 0;
      mo.x -= p * 20;
      break;
    case "blur":
      mo.blur += p * 24;
      mo.opacity *= 1 - p * 0.5;
      break;
    case "blur_pulse":
      mo.blur += Math.sin(p * Math.PI) * 26;
      mo.scale *= 1 + Math.sin(p * Math.PI) * 0.06;
      break;
    case "wipe_left":
    case "mask_wipe":
      mo.clipInset[1] = p * 100;
      break;
    case "wipe_up":
      mo.clipInset[2] = p * 100;
      break;
    case "shape_wipe":
      mo.clipInset = [p * 50, p * 50, p * 50, p * 50];
      mo.scale *= 1 + p * 0.1;
      break;
    case "scale_out":
      mo.scale *= 1 + p * 0.35;
      mo.opacity *= 1 - p;
      break;
    case "punch_zoom":
      mo.scale *= 1 + easeOut(p) * 0.9;
      break;
    case "match_zoom":
      mo.scale *= 1 + p * 0.5;
      mo.blur += p * 6;
      break;
    case "snap_zoom_out":
      mo.scale *= 1 - p * 0.35;
      break;
    case "slide_out":
      mo.x -= p * 140;
      break;
    case "push_out":
      mo.y -= p * 140;
      break;
    case "rotate_out":
      mo.rotate += p * 12;
      mo.scale *= 1 + p * 0.2;
      break;
    case "expand_frame":
      mo.clipInset = [-p * 10, -p * 10, -p * 10, -p * 10];
      mo.scale *= 1 + p * 0.15;
      break;
    case "collapse_frame":
      mo.clipInset = [p * 50, p * 15, p * 50, p * 15];
      break;
    case "mask_out":
      mo.clipInset[0] = p * 50;
      mo.clipInset[2] = p * 50;
      break;
    case "film_splice":
      mo.y += Math.sin(p * Math.PI * 3) * 26;
      mo.opacity *= 1 - p * 0.25;
      break;
    case "rgb_split":
      mo.rgb += p * 22;
      break;
    case "stretch":
      mo.scaleY *= 1 + p * 0.5;
      mo.scaleX *= 1 - p * 0.12;
      break;
    case "smear":
      mo.blur += p * 34;
      mo.blurAngle = 90;
      mo.scaleX *= 1 + p * 0.3;
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------- media */

function MediaFill({
  slot,
  index,
  media,
  frame,
  fps,
  frozen,
}: {
  slot: MediaSlot;
  index: number;
  media: MediaMap;
  frame: number;
  fps: number;
  frozen?: boolean;
}) {
  const asset = media[slot.id];
  const zoom = asset?.zoom ?? 1;
  const flip = `${asset?.flipX ? "scaleX(-1) " : ""}${asset?.flipY ? "scaleY(-1) " : ""}`;
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: asset?.fit ?? "cover",
    opacity: asset?.opacity ?? 1,
    transform: `${flip}rotate(${asset?.rotation ?? 0}deg) scale(${zoom}) translate(${asset?.offsetX ?? 0}%, ${asset?.offsetY ?? 0}%)`,
  };
  if (asset?.kind === "video") {
    const speed = asset.speed ?? 1;
    // Server renders decode with ffmpeg (OffthreadVideo) instead of Chromium,
    // so exports do not depend on the render machine's browser codecs.
    const Clip = getRemotionEnvironment().isRendering ? OffthreadVideo : Video;
    return (
      <Clip
        src={asset.url}
        startFrom={Math.round((asset.inPoint ?? 0) * fps)}
        muted={asset.muted !== false}
        volume={asset.volume ?? 1}
        playbackRate={frozen ? 0.02 : speed}
        style={style}
      />
    );
  }
  if (asset) return <Img src={asset.url} style={style} />;

  return (
    <>
      <Img src={placeholderFor(slot.purpose, index)} style={style} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${(index * 47) % 360}deg, rgba(0,0,0,0.28), rgba(0,0,0,0))`,
          mixBlendMode: "multiply",
          opacity: 0.7 + 0.3 * Math.sin(frame / 12),
        }}
      />
    </>
  );
}

function SlotLayer({
  slot,
  index,
  media,
  spec,
}: {
  slot: MediaSlot;
  index: number;
  media: MediaMap;
  spec: TemplateSpec;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = slot.duration * fps;
  const inFrames = Math.max(3, Math.min(total * 0.6, 0.32 * fps));
  const outFrames = Math.max(2, Math.min(total * 0.4, 0.22 * fps));
  const pIn = Math.min(frame / inFrames, 1);
  const pAll = Math.min(frame / Math.max(total, 1), 1);
  const pOut = Math.max(0, (frame - (total - outFrames)) / outFrames);
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });

  const mo = base();
  applyDuring(slot.animationDuring ?? "none", pAll, mo, frame);
  applyIn(slot.animationIn ?? "none", pIn, mo, s, frame);
  if (slot.transitionOut) applyOut(slot.transitionOut, pOut, mo);
  if (slot.animationOut) applyOut(slot.animationOut, pOut, mo);

  const tf = slot.transform ?? {};
  if (tf.startScale || tf.endScale)
    mo.scale *= interpolate(pAll, [0, 1], [tf.startScale ?? 1, tf.endScale ?? tf.startScale ?? 1]);
  mo.x += tf.x ?? 0;
  mo.y += tf.y ?? 0;
  mo.rotate += tf.rotation ?? 0;

  const boxDef = LAYOUT_BOXES[slot.layout] ?? LAYOUT_BOXES.full;
  const frameKind = boxDef.frame ?? (slot.layout === "full" ? "none" : "shadow");
  const inset = [
    Math.max(mo.clipInset[0], 0),
    Math.max(mo.clipInset[1], 0),
    Math.max(mo.clipInset[2], 0),
    Math.max(mo.clipInset[3], 0),
  ];
  const clipPath = boxDef.clip ?? `inset(${inset[0]}% ${inset[1]}% ${inset[2]}% ${inset[3]}%)`;

  const inner = (
    <div
      style={{
        width: "100%",
        height: "100%",
        transform: `perspective(1200px) rotateY(${mo.perspective}deg) scale(${mo.scale}) scaleX(${mo.scaleX}) scaleY(${mo.scaleY}) translate(${mo.x}px, ${mo.y}px) skewX(${mo.skew}deg)`,
        filter: mo.blur ? `blur(${mo.blur}px)` : undefined,
      }}
    >
      <MediaFill
        slot={slot}
        index={index}
        media={media}
        frame={frame}
        fps={fps}
        frozen={slot.animationDuring === "freeze"}
      />
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: boxDef.left,
        top: boxDef.top,
        width: boxDef.width,
        height: boxDef.height,
        overflow: "hidden",
        opacity: mo.opacity,
        clipPath,
        borderRadius: boxDef.radius ?? (frameKind === "none" ? 0 : 8),
        boxShadow: frameKind === "shadow" ? "0 30px 80px rgba(0,0,0,0.5)" : undefined,
        border:
          frameKind === "thick"
            ? `4px solid ${spec.palette.ink}`
            : frameKind === "hairline"
              ? `2px solid ${spec.palette.ink}88`
              : undefined,
        transform: `rotate(${mo.rotate + (boxDef.rotate ?? 0)}deg)`,
        backgroundColor: spec.palette.bg,
      }}
    >
      {mo.rgb > 0.5 ? (
        <>
          <div style={{ position: "absolute", inset: 0, transform: `translateX(${-mo.rgb}px)`, filter: "url(#none)", mixBlendMode: "screen", opacity: 0.6, background: "rgba(255,0,0,0.0)" }}>
            {inner}
          </div>
          <div style={{ position: "absolute", inset: 0, transform: `translateX(${mo.rgb}px)`, mixBlendMode: "screen", opacity: 0.6 }}>
            {inner}
          </div>
          <div style={{ position: "absolute", inset: 0, opacity: 0.8 }}>{inner}</div>
        </>
      ) : (
        inner
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- text */

function TextLayer({ text, spec }: { text: TextSlot; spec: TemplateSpec }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const speed = text.animSpeed ?? 1;
  const aFrame = frame * speed;
  const total = text.duration * fps;
  const p = Math.min(aFrame / Math.max(0.35 * fps, 1), 1);
  const outP = Math.max(0, (frame - (total - 0.2 * fps)) / (0.2 * fps));
  const s = spring({ frame: aFrame, fps, config: { damping: 14, stiffness: 200 } });
  const color = text.color ?? (text.accent ? spec.palette.accent : spec.palette.ink);
  const words = text.value.split(" ").filter(Boolean);
  const font = fontByKey(text.fontKey || spec.fontKey);
  const k = (width / 1080) * font.display.scale * (text.sizeScale ?? 1);

  const wrap: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    padding: "0 72px",
    display: "flex",
    flexDirection: "column",
    alignItems:
      text.align === "left" ? "flex-start" : text.align === "right" ? "flex-end" : "center",
    textAlign: text.align ?? "center",
    top: text.position === "top" ? "12%" : text.position === "center" ? "38%" : undefined,
    bottom: text.position === "bottom" ? "12%" : undefined,
    opacity: (1 - outP) * (text.opacity ?? 1),
    transform: `translate(${text.x ?? 0}%, ${text.y ?? 0}%) rotate(${text.rotation ?? 0}deg)`,
  };

  const common: React.CSSProperties = {
    color,
    fontFamily: font.stack,
    margin: 0,
    lineHeight: text.lineHeight ?? 0.92,
    textTransform: font.display.uppercase ? "uppercase" : "none",
    letterSpacing: text.tracking != null ? `${text.tracking}em` : font.display.tracking,
    ...(text.stroke
      ? {
          WebkitTextStroke: `${text.stroke}px ${text.strokeColor ?? "#000"}`,
        }
      : {}),
    ...(text.shadow ? { textShadow: `0 ${text.shadow / 2}px ${text.shadow}px rgba(0,0,0,.6)` } : {}),
    ...(text.background ? { background: text.background } : {}),
  };
  const heavy = text.fontWeight ?? font.display.weight;


  let content: React.ReactNode = null;
  switch (text.style) {
    case "oversized_hook":
      content = (
        <h1
          style={{
            ...common,
            fontSize: 132 * k,
            fontWeight: heavy,
            textTransform: "uppercase",
            transform: `scale(${interpolate(s, [0, 1], [0.82, 1])})`,
            opacity: p,
          }}
        >
          {text.value}
        </h1>
      );
      break;
    case "giant_word":
      content = (
        <h1
          style={{
            ...common,
            fontSize: 240 * k,
            fontWeight: heavy,
            textTransform: "uppercase",
            lineHeight: 0.82,
            transform: `scale(${interpolate(easeOut(p), [0, 1], [1.4, 1])})`,
            opacity: p,
          }}
        >
          {words[0] ?? text.value}
        </h1>
      );
      break;
    case "outlined":
      content = (
        <h1
          style={{
            ...common,
            fontSize: 128 * k,
            fontWeight: heavy,
            textTransform: "uppercase",
            color: "transparent",
            WebkitTextStroke: `${3 * k}px ${color}`,
            transform: `translateY(${(1 - p) * 30}px)`,
            opacity: p,
          }}
        >
          {text.value}
        </h1>
      );
      break;
    case "kinetic_words":
      content = (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
          {words.map((w, i) => {
            const wp = spring({ frame: frame - i * 3, fps, config: { damping: 11, stiffness: 220 } });
            return (
              <span
                key={i}
                style={{
                  ...common,
                  fontSize: 104 * k,
                  fontWeight: heavy,
                  textTransform: "uppercase",
                  transform: `translateY(${interpolate(wp, [0, 1], [70, 0])}px) scale(${interpolate(wp, [0, 1], [0.6, 1])})`,
                  opacity: wp,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      );
      break;
    case "word_by_word": {
      const per = Math.max(3, total / Math.max(words.length, 1));
      const idx = Math.min(words.length - 1, Math.floor(frame / per));
      const wp = Math.min((frame % per) / 5, 1);
      content = (
        <span
          style={{
            ...common,
            fontSize: 150 * k,
            fontWeight: heavy,
            textTransform: "uppercase",
            transform: `scale(${interpolate(wp, [0, 1], [1.18, 1])})`,
            opacity: Math.min(wp * 2, 1),
          }}
        >
          {words[idx]}
        </span>
      );
      break;
    }
    case "stagger_reveal":
      content = (
        <div>
          {words.map((w, i) => {
            const wp = Math.min(Math.max((frame - i * 4) / 10, 0), 1);
            return (
              <div key={i} style={{ overflow: "hidden" }}>
                <span
                  style={{
                    ...common,
                    display: "inline-block",
                    fontSize: 88 * k,
                    fontWeight: heavy,
                    textTransform: "uppercase",
                    transform: `translateY(${(1 - wp) * 100}%)`,
                  }}
                >
                  {w}
                </span>
              </div>
            );
          })}
        </div>
      );
      break;
    case "tracking_in":
      content = (
        <span
          style={{
            ...common,
            fontSize: 64 * k,
            fontWeight: heavy,
            textTransform: "uppercase",
            letterSpacing: interpolate(easeOut(p), [0, 1], [40, 8]),
            opacity: p,
          }}
        >
          {text.value}
        </span>
      );
      break;
    case "vertical_type":
      content = (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {text.value
            .replace(/\s/g, "")
            .split("")
            .map((c, i) => {
              const wp = Math.min(Math.max((frame - i * 2) / 8, 0), 1);
              return (
                <span
                  key={i}
                  style={{
                    ...common,
                    fontSize: 52 * k,
                    fontWeight: heavy,
                    textTransform: "uppercase",
                    opacity: wp,
                    transform: `translateX(${(1 - wp) * -20}px)`,
                  }}
                >
                  {c}
                </span>
              );
            })}
        </div>
      );
      break;
    case "ticker":
      content = (
        <div style={{ overflow: "hidden", width: "100%", background: color }}>
          <div
            style={{
              whiteSpace: "nowrap",
              transform: `translateX(${-((frame * 6) % 1400)}px)`,
            }}
          >
            <span
              style={{
                ...common,
                color: spec.palette.bg,
                fontSize: 40 * k,
                fontWeight: heavy,
                textTransform: "uppercase",
                padding: "10px 0",
                display: "inline-block",
              }}
            >
              {`${text.value}   ·   `.repeat(6)}
            </span>
          </div>
        </div>
      );
      break;
    case "feature_callout":
      content = (
        <div
          style={{
            background: color,
            padding: "18px 30px",
            transform: `translateX(${interpolate(s, [0, 1], [-60, 0])}px)`,
            opacity: p,
          }}
        >
          <span
            style={{
              ...common,
              color: spec.palette.bg,
              fontSize: 48 * k,
              fontWeight: heavy,
              textTransform: "uppercase",
            }}
          >
            {text.value}
          </span>
        </div>
      );
      break;
    case "stat_callout": {
      const m = text.value.match(/^([\d.,%+]+[%x×]?)\s*(.*)$/);
      content = (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "inherit", opacity: p }}>
          <span
            style={{
              ...common,
              fontSize: 172 * k,
              fontWeight: heavy,
              transform: `translateY(${(1 - easeOut(p)) * 40}px)`,
            }}
          >
            {m?.[1] ?? text.value}
          </span>
          {m?.[2] && (
            <span style={{ ...common, fontSize: 36 * k, letterSpacing: 6, opacity: 0.85 }}>
              {m[2]}
            </span>
          )}
        </div>
      );
      break;
    }
    case "highlight_bar":
      content = (
        <span
          style={{
            ...common,
            fontSize: 58 * k,
            fontWeight: heavy,
            textTransform: "uppercase",
            background: `linear-gradient(${spec.palette.accent}, ${spec.palette.accent}) left center / ${easeOut(p) * 100}% 100% no-repeat`,
            color: spec.palette.ink,
            padding: "6px 16px",
          }}
        >
          {text.value}
        </span>
      );
      break;
    case "subtitle":
      content = (
        <span
          style={{
            ...common,
            fontSize: 42 * k,
            fontWeight: 500,
            background: "rgba(0,0,0,0.55)",
            color: spec.palette.ink,
            padding: "10px 20px",
            borderRadius: 6,
            opacity: p,
          }}
        >
          {text.value}
        </span>
      );
      break;
    case "minimal_caption":
      content = (
        <span
          style={{
            ...common,
            fontSize: 40 * k,
            fontWeight: 400,
            letterSpacing: 2,
            opacity: p * 0.95,
            transform: `translateY(${(1 - p) * 18}px)`,
          }}
        >
          {text.value}
        </span>
      );
      break;
    case "centered_statement":
      content = (
        <span
          style={{
            ...common,
            fontSize: 78 * k,
            fontWeight: 300,
            letterSpacing: 4,
            opacity: p,
            transform: `scale(${interpolate(p, [0, 1], [1.08, 1])})`,
          }}
        >
          {text.value}
        </span>
      );
      break;
    case "edge_aligned":
      content = (
        <span
          style={{
            ...common,
            fontSize: 62 * k,
            fontWeight: heavy,
            textTransform: "uppercase",
            borderLeft: `10px solid ${spec.palette.accent}`,
            paddingLeft: 22,
            opacity: p,
            transform: `translateX(${(1 - p) * -40}px)`,
          }}
        >
          {text.value}
        </span>
      );
      break;
    case "masked_reveal":
      content = (
        <div style={{ overflow: "hidden" }}>
          <span
            style={{
              ...common,
              display: "inline-block",
              fontSize: 92 * k,
              fontWeight: heavy,
              textTransform: "uppercase",
              transform: `translateY(${(1 - p) * 110}%)`,
            }}
          >
            {text.value}
          </span>
        </div>
      );
      break;
    case "cta_lockup":
    default:
      content = (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px)`,
            opacity: p,
          }}
        >
          <span
            style={{
              ...common,
              fontSize: 56 * k,
              fontWeight: heavy,
              textTransform: "uppercase",
              border: `5px solid ${color}`,
              padding: "18px 34px",
              borderRadius: 999,
            }}
          >
            {text.value}
          </span>
        </div>
      );
  }

  return <div style={wrap}>{content}</div>;
}

/* ---------------------------------------------------------------- overlays */

function OverlayLayer({ overlay, spec }: { overlay: Overlay; spec: TemplateSpec }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const color = overlay.accent ? spec.palette.accent : spec.palette.ink;
  const total = overlay.duration * fps;

  switch (overlay.type) {
    case "flash": {
      const o = interpolate(frame, [0, total * 0.25, total], [0, 0.85, 0], {
        extrapolateRight: "clamp",
      });
      return <AbsoluteFill style={{ background: color, opacity: o }} />;
    }
    case "bar_wipe": {
      const p = Math.min(frame / total, 1);
      return (
        <AbsoluteFill>
          <div
            style={{
              position: "absolute",
              left: `${interpolate(p, [0, 1], [-100, 100])}%`,
              top: 0,
              width: "100%",
              height: "100%",
              background: color,
            }}
          />
        </AbsoluteFill>
      );
    }
    case "grain":
    case "noise":
      return (
        <AbsoluteFill
          style={{
            opacity: overlay.type === "noise" ? 0.26 : 0.16,
            mixBlendMode: "overlay",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundPosition: `${(frame * 37) % 120}px ${(frame * 53) % 120}px`,
          }}
        />
      );
    case "paper":
      return (
        <AbsoluteFill
          style={{
            opacity: 0.22,
            mixBlendMode: "multiply",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23p)'/%3E%3C/svg%3E\")",
          }}
        />
      );
    case "vignette":
      return (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)",
          }}
        />
      );
    case "halation":
      return (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: 0.22,
            background: `radial-gradient(ellipse at 50% 40%, ${spec.palette.accent}66, transparent 62%)`,
          }}
        />
      );
    case "bloom":
      return (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: 0.16 + 0.06 * Math.sin(frame / 14),
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.55), transparent 60%)",
          }}
        />
      );
    case "light_leak": {
      const p = (frame / Math.max(total, 1)) % 1;
      return (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: 0.3,
            background: `linear-gradient(${105 + p * 30}deg, transparent 30%, ${spec.palette.accent}88 ${40 + p * 20}%, transparent 70%)`,
          }}
        />
      );
    }
    case "chromatic":
    case "rgb_separation":
      return (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: overlay.type === "chromatic" ? 0.14 : 0.24,
            background:
              "linear-gradient(90deg, rgba(255,0,80,0.5), rgba(0,0,0,0) 20%, rgba(0,0,0,0) 80%, rgba(0,180,255,0.5))",
          }}
        />
      );
    case "blur_pulse":
      return (
        <AbsoluteFill
          style={{
            backdropFilter: `blur(${Math.max(0, Math.sin((frame / Math.max(total, 1)) * Math.PI) * 14)}px)`,
          }}
        />
      );
    case "posterize":
      return (
        <AbsoluteFill
          style={{
            mixBlendMode: "hard-light",
            opacity: 0.2,
            background: `linear-gradient(${spec.palette.accent}, ${spec.palette.bg})`,
          }}
        />
      );
    case "film_border":
      return (
        <AbsoluteFill>
          <div style={{ position: "absolute", inset: 0, border: `28px solid ${spec.palette.bg}` }} />
          <div
            style={{
              position: "absolute",
              inset: 28,
              border: `2px solid ${spec.palette.ink}55`,
            }}
          />
        </AbsoluteFill>
      );
    case "camcorder":
      return (
        <AbsoluteFill style={{ padding: 48, color: spec.palette.ink, fontFamily: "monospace" }}>
          <div style={{ position: "absolute", top: 48, left: 48, fontSize: 34, letterSpacing: 3 }}>
            {frame % 30 < 20 ? "● REC" : ""}
          </div>
          <div style={{ position: "absolute", top: 48, right: 48, fontSize: 30 }}>SP</div>
          <div style={{ position: "absolute", bottom: 48, left: 48, fontSize: 30 }}>
            AUTO · F2.8
          </div>
          <AbsoluteFill
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 4px)",
            }}
          />
        </AbsoluteFill>
      );
    case "timestamp": {
      const secs = Math.floor(frame / fps);
      return (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 60,
            fontFamily: "monospace",
            fontSize: 34,
            color: "#ffd76e",
            textShadow: "0 0 8px rgba(0,0,0,0.6)",
          }}
        >
          {`00:${String(secs).padStart(2, "0")}:${String(frame % fps).padStart(2, "0")}`}
        </div>
      );
    }
    case "frame_line":
      return <AbsoluteFill style={{ border: `4px solid ${color}`, margin: 34, opacity: 0.8 }} />;
    case "progress":
    default:
      return (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10 }}>
          <div
            style={{ height: "100%", width: `${(frame / durationInFrames) * 100}%`, background: color }}
          />
        </div>
      );
  }
}

/* --------------------------------------------------------------- composition */

/** Blocks the first rendered frame until uploaded fonts are actually usable. */
function useFontsReady(faces?: RenderFontFace[] | undefined) {
  const [handle] = useState(() => ((faces ?? []).length > 0 ? delayRender("brand fonts") : null));
  useEffect(() => {
    if (handle === null) return;
    const families = (faces ?? []).map((f) => `12px '${f.family}'`);
    Promise.all(families.map((f) => document.fonts.load(f)))
      .catch(() => undefined)
      .finally(() => continueRender(handle));
  }, [handle, faces]);
}

export interface RenderFontFace {
  /** font key used by spec.fontKey / text.fontKey */
  key: string;
  family: string;
  url: string;
}

export interface TemplateVideoProps {
  spec: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
  audio?: AudioTrack | null;
  /** server render: uploaded motion / brand asset files, keyed by asset id */
  assetUrls?: AssetUrlMap | undefined;
  /** server render: uploaded brand fonts, registered before the first frame */
  fontFaces?: RenderFontFace[] | undefined;
}

export const TemplateVideo: React.FC<TemplateVideoProps> = ({
  spec,
  media,
  textOverrides,
  audio,
  assetUrls,
  fontFaces,
}) => {
  // Uploaded brand fonts have no Google entry — register them so fontByKey()
  // resolves to the real family on the render machine too.
  useFontsReady(fontFaces);
  for (const f of fontFaces ?? []) {
    registerRuntimeFont({
      key: f.key,
      name: f.family,
      stack: `'${f.family}', system-ui, sans-serif`,
      category: "Minimal",
      google: "",
      display: { weight: 600, tracking: 0, uppercase: false, scale: 1 },
    });
  }
  const { fps } = useVideoConfig();
  const f = (sec: number) => Math.round(sec * fps);
  const totalFrames = Math.max(2, f(spec.duration));

  return (
    <AbsoluteFill style={{ backgroundColor: spec.palette.bg }}>
      {(fontFaces ?? []).length > 0 && (
        <style>
          {(fontFaces ?? [])
            .map(
              (f) =>
                `@font-face{font-family:'${f.family}';src:url('${f.url}');font-display:block;}`,
            )
            .join("\n")}
        </style>
      )}
      {audio?.url && (
        <Audio
          src={audio.url}
          startFrom={Math.round((audio.trimStart ?? 0) * fps)}
          volume={(frame: number) => {
            const fin = audio.fadeIn > 0 ? Math.min(1, frame / Math.max(1, f(audio.fadeIn))) : 1;
            const fout =
              audio.fadeOut > 0
                ? Math.min(1, (totalFrames - frame) / Math.max(1, f(audio.fadeOut)))
                : 1;
            return Math.max(0, audio.volume * fin * fout);
          }}
        />
      )}
      {spec.mediaSlots.map((slot, i) => (
        <Sequence
          key={slot.id}
          from={f(slot.start)}
          durationInFrames={Math.max(2, f(slot.duration))}
          layout="none"
        >
          <SlotLayer slot={slot} index={i} media={media} spec={spec} />
        </Sequence>
      ))}
      {spec.overlays.map((o, i) => (
        <Sequence
          key={`o-${i}`}
          from={f(o.start)}
          durationInFrames={Math.max(2, f(o.duration))}
          layout="none"
        >
          <OverlayLayer overlay={o} spec={spec} />
        </Sequence>
      ))}
      {spec.textSlots.map((text) => (
        <Sequence
          key={text.id}
          from={f(text.start)}
          durationInFrames={Math.max(2, f(text.duration))}
          layout="none"
        >
          <TextLayer text={{ ...text, value: textOverrides[text.id] ?? text.value }} spec={spec} />
        </Sequence>
      ))}
      {(spec.creativeEvents ?? [])
        .filter((ev) => (ev.layer ?? "under_text") === "under_text")
        .map((ev) => (
          <Sequence
            key={ev.id}
            from={f(ev.start)}
            durationInFrames={Math.max(2, f(ev.duration))}
            layout="none"
          >
            <CreativeEventLayer event={ev} spec={spec} media={media} />
          </Sequence>
        ))}
      {(spec.graphicSlots ?? []).map((g) => (
        <Sequence
          key={g.id}
          from={f(g.start)}
          durationInFrames={Math.max(2, f(g.duration))}
          layout="none"
        >
          <GraphicLayer graphic={g} palette={spec.palette} fontKey={spec.fontKey} />
        </Sequence>
      ))}
      {(spec.creativeEvents ?? [])
        .filter((ev) => ev.layer === "over_all")
        .map((ev) => (
          <Sequence
            key={ev.id}
            from={f(ev.start)}
            durationInFrames={Math.max(2, f(ev.duration))}
            layout="none"
          >
            <CreativeEventLayer event={ev} spec={spec} media={media} />
          </Sequence>
        ))}
      <MotionAssetLayer
        events={spec.motionAssets ?? []}
        width={spec.width}
        height={spec.height}
        fps={spec.fps}
        assetUrls={assetUrls}
      />
      <LogoLayer spec={spec} media={media} />
    </AbsoluteFill>


  );

};
