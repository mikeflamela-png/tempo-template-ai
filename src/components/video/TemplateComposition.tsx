import {
  AbsoluteFill,
  Img,
  Sequence,
  Video,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  Animation,
  Layout,
  MediaMap,
  MediaSlot,
  Overlay,
  TemplateSpec,
  TextSlot,
} from "@/lib/template/types";
import { placeholderFor } from "@/lib/template/placeholders";

type Rect = { left: string; top: string; width: string; height: string };

const RECTS: Record<Layout, Rect> = {
  full: { left: "0%", top: "0%", width: "100%", height: "100%" },
  "split-left": { left: "0%", top: "0%", width: "50%", height: "100%" },
  "split-right": { left: "50%", top: "0%", width: "50%", height: "100%" },
  "split-top": { left: "0%", top: "0%", width: "100%", height: "50%" },
  "split-bottom": { left: "0%", top: "50%", width: "100%", height: "50%" },
  "grid-tl": { left: "0%", top: "0%", width: "50%", height: "50%" },
  "grid-tr": { left: "50%", top: "0%", width: "50%", height: "50%" },
  "grid-bl": { left: "0%", top: "50%", width: "50%", height: "50%" },
  "grid-br": { left: "50%", top: "50%", width: "50%", height: "50%" },
  pip: { left: "56%", top: "10%", width: "38%", height: "26%" },
  floating: { left: "8%", top: "58%", width: "46%", height: "32%" },
  band: { left: "0%", top: "30%", width: "100%", height: "40%" },
  "tall-inset": { left: "60%", top: "50%", width: "34%", height: "40%" },
};

type Motion = {
  scale: number;
  x: number;
  y: number;
  rotate: number;
  opacity: number;
  blur: number;
  clipInset: [number, number, number, number];
};

const base = (): Motion => ({
  scale: 1,
  x: 0,
  y: 0,
  rotate: 0,
  opacity: 1,
  blur: 0,
  clipInset: [0, 0, 0, 0],
});

function applyIn(anim: Animation, p: number, mo: Motion, s: number) {
  const e = 1 - Math.pow(1 - p, 3);
  switch (anim) {
    case "punch_in":
      mo.scale *= interpolate(e, [0, 1], [1.35, 1.08]);
      break;
    case "push_in":
      mo.scale *= interpolate(e, [0, 1], [1.02, 1.12]);
      break;
    case "pull_out":
      mo.scale *= interpolate(e, [0, 1], [1.3, 1.04]);
      break;
    case "snap_zoom":
      mo.scale *= interpolate(Math.min(p * 2.2, 1), [0, 1], [1.9, 1.05]);
      mo.opacity *= interpolate(p, [0, 0.15], [0, 1], { extrapolateRight: "clamp" });
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
    case "scale_bounce":
      mo.scale *= interpolate(s, [0, 1], [0.7, 1]);
      mo.opacity *= interpolate(p, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "blur_in":
      mo.blur += interpolate(e, [0, 1], [22, 0]);
      mo.scale *= 1.08;
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
    case "pan_left":
    case "pan_right":
    case "drift":
    case "freeze":
    case "none":
    default:
      break;
  }
}

function applyDuring(anim: Animation, p: number, mo: Motion) {
  switch (anim) {
    case "drift":
      mo.scale *= interpolate(p, [0, 1], [1.0, 1.08]);
      mo.x += Math.sin(p * Math.PI) * 6;
      break;
    case "pan_left":
      mo.x += interpolate(p, [0, 1], [40, -40]);
      mo.scale *= 1.18;
      break;
    case "pan_right":
      mo.x += interpolate(p, [0, 1], [-40, 40]);
      mo.scale *= 1.18;
      break;
    case "push_in":
      mo.scale *= interpolate(p, [0, 1], [1, 1.16]);
      break;
    case "pull_out":
      mo.scale *= interpolate(p, [0, 1], [1.16, 1]);
      break;
    default:
      break;
  }
}

function applyOut(kind: string, p: number, mo: Motion) {
  // p: 0 -> 1 across the outgoing window
  switch (kind) {
    case "whip":
      mo.x -= p * 90;
      mo.blur += p * 26;
      break;
    case "blur":
      mo.blur += p * 24;
      mo.opacity *= 1 - p * 0.5;
      break;
    case "wipe_left":
      mo.clipInset[1] = p * 100;
      break;
    case "wipe_up":
      mo.clipInset[2] = p * 100;
      break;
    case "scale_out":
      mo.scale *= 1 + p * 0.35;
      mo.opacity *= 1 - p;
      break;
    case "mask_out":
      mo.clipInset[0] = p * 50;
      mo.clipInset[2] = p * 50;
      break;
    default:
      break;
  }
}

function MediaFill({
  slot,
  index,
  media,
  frame,
  fps,
}: {
  slot: MediaSlot;
  index: number;
  media: MediaMap;
  frame: number;
  fps: number;
}) {
  const asset = media[slot.id];
  const zoom = asset?.zoom ?? 1;
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${zoom}) translate(${asset?.offsetX ?? 0}%, ${asset?.offsetY ?? 0}%)`,
  };
  if (asset?.kind === "video") {
    return (
      <Video
        src={asset.url}
        startFrom={Math.round((asset.inPoint ?? 0) * fps)}
        muted={asset.muted !== false}
        style={style}
￼      />
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
  applyDuring(slot.animationDuring ?? "none", pAll, mo);
  applyIn(slot.animationIn ?? "none", pIn, mo, s);
  if (slot.transitionOut) applyOut(slot.transitionOut, pOut, mo);
  if (slot.animationOut) applyOut(slot.animationOut, pOut, mo);

  const tf = slot.transform ?? {};
  if (tf.startScale || tf.endScale)
    mo.scale *= interpolate(pAll, [0, 1], [tf.startScale ?? 1, tf.endScale ?? tf.startScale ?? 1]);
  mo.x += tf.x ?? 0;
  mo.y += tf.y ?? 0;
  mo.rotate += tf.rotation ?? 0;

  const rect = RECTS[slot.layout] ?? RECTS.full;
  const isInset = slot.layout !== "full";

  return (
    <div
      style={{
        position: "absolute",
        ...rect,
        overflow: "hidden",
        opacity: mo.opacity,
        clipPath: `inset(${mo.clipInset[0]}% ${mo.clipInset[1]}% ${mo.clipInset[2]}% ${mo.clipInset[3]}%)`,
        borderRadius: isInset ? 10 : 0,
        boxShadow: isInset ? "0 30px 80px rgba(0,0,0,0.45)" : undefined,
        border: isInset ? `3px solid ${spec.palette.ink}` : undefined,
        transform: `rotate(${mo.rotate}deg)`,
        backgroundColor: spec.palette.bg,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${mo.scale}) translate(${mo.x}px, ${mo.y}px)`,
          filter: mo.blur ? `blur(${mo.blur}px)` : undefined,
        }}
      >
        <MediaFill slot={slot} index={index} media={media} frame={frame} fps={fps} />
      </div>
    </div>
  );
}

function TextLayer({ text, spec }: { text: TextSlot; spec: TemplateSpec }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = text.duration * fps;
  const p = Math.min(frame / Math.max(0.35 * fps, 1), 1);
  const outP = Math.max(0, (frame - (total - 0.2 * fps)) / (0.2 * fps));
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 200 } });
  const color = text.accent ? spec.palette.accent : spec.palette.ink;
  const words = text.value.split(" ").filter(Boolean);

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
    opacity: 1 - outP,
  };

  const common: React.CSSProperties = {
    color,
    fontFamily: "'Archivo', 'Helvetica Neue', sans-serif",
    margin: 0,
    lineHeight: 0.92,
  };

  let content: React.ReactNode = null;
  switch (text.style) {
    case "oversized_hook":
      content = (
        <h1
          style={{
            ...common,
            fontSize: 132,
            fontWeight: 900,
            letterSpacing: -4,
            textTransform: "uppercase",
            transform: `scale(${interpolate(s, [0, 1], [0.82, 1])})`,
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
            const wp = spring({
              frame: frame - i * 3,
              fps,
              config: { damping: 11, stiffness: 220 },
            });
            return (
              <span
                key={i}
                style={{
                  ...common,
                  fontSize: 104,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: -3,
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
                    fontSize: 88,
                    fontWeight: 800,
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
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {text.value}
          </span>
        </div>
      );
      break;
    case "minimal_caption":
      content = (
        <span
          style={{
            ...common,
            fontSize: 40,
            fontWeight: 500,
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
            fontSize: 78,
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
            fontSize: 62,
            fontWeight: 800,
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
              fontSize: 92,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: -2,
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
              fontSize: 56,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 2,
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

function OverlayLayer({ overlay, spec }: { overlay: Overlay; spec: TemplateSpec }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const color = overlay.accent ? spec.palette.accent : spec.palette.ink;

  if (overlay.type === "flash") {
    const total = overlay.duration * fps;
    const o = interpolate(frame, [0, total * 0.25, total], [0, 0.85, 0], {
      extrapolateRight: "clamp",
    });
    return <AbsoluteFill style={{ background: color, opacity: o }} />;
  }
  if (overlay.type === "bar_wipe") {
    const total = overlay.duration * fps;
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
  if (overlay.type === "grain") {
    return (
      <AbsoluteFill
        style={{
          opacity: 0.16,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundPosition: `${(frame * 37) % 120}px ${(frame * 53) % 120}px`,
        }}
      />
    );
  }
  if (overlay.type === "vignette") {
    return (
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    );
  }
  if (overlay.type === "frame_line") {
    return <AbsoluteFill style={{ border: `4px solid ${color}`, margin: 34, opacity: 0.8 }} />;
  }
  // progress
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10 }}>
      <div
        style={{
          height: "100%",
          width: `${(frame / durationInFrames) * 100}%`,
          background: color,
        }}
      />
    </div>
  );
}

export interface TemplateVideoProps {
  spec: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
}

export const TemplateVideo: React.FC<TemplateVideoProps> = ({
  spec,
  media,
  textOverrides,
}) => {
  const { fps } = useVideoConfig();
  const f = (sec: number) => Math.round(sec * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: spec.palette.bg }}>
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
          <TextLayer
            text={{ ...text, value: textOverrides[text.id] ?? text.value }}
            spec={spec}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};