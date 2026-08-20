import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { GraphicSlot, Palette } from "@/lib/template/types";
import { fontByKey } from "@/lib/template/fonts";

interface Props {
  graphic: GraphicSlot;
  palette: Palette;
  fontKey?: string | undefined;
}

/** progress 0..1 across the graphic's own sequence */
function useAnim(g: GraphicSlot) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = Math.max(1, Math.round(g.duration * fps));
  const inDur = Math.min(14, Math.max(5, Math.round(total * 0.3)));
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 190 } });
  const exit = interpolate(frame, [total - 7, total], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const draw = interpolate(frame, [0, inDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { frame, fps, total, enter, exit, draw };
}

export function GraphicLayer({ graphic: g, palette, fontKey }: Props) {
  const { frame, enter, exit, draw } = useAnim(g);
  const color = g.color ?? palette.accent;
  const font = fontByKey(fontKey);

  let scale = g.scale;
  let rotate = g.rotation;
  let x = 0;
  let y = 0;
  let opacity = g.opacity * exit;

  switch (g.animation) {
    case "pop":
      scale *= interpolate(enter, [0, 1], [0.4, 1]);
      opacity *= draw;
      break;
    case "slide":
      x = interpolate(enter, [0, 1], [-14, 0]);
      opacity *= draw;
      break;
    case "fade":
      opacity *= draw;
      break;
    case "spin":
      rotate += interpolate(enter, [0, 1], [-35, 0]) + Math.sin(frame / 22) * 3;
      opacity *= draw;
      break;
    case "pulse":
      scale *= 1 + Math.sin(frame / 6) * 0.05;
      opacity *= draw;
      break;
    case "snap":
      scale *= frame < 3 ? 1.25 : 1;
      break;
    case "draw":
    default:
      break;
  }

  const wrap: React.CSSProperties = {
    position: "absolute",
    left: `${50 + g.x}%`,
    top: `${50 + g.y}%`,
    transform: `translate(-50%, -50%) translate(${x}%, ${y}%) rotate(${rotate}deg) scale(${scale})`,
    opacity,
    color,
    pointerEvents: "none",
  };

  const strokeDraw = g.animation === "draw" ? draw : 1;

  return <div style={wrap}>{renderKind(g, color, palette, font.stack, strokeDraw)}</div>;
}

function renderKind(
  g: GraphicSlot,
  color: string,
  palette: Palette,
  family: string,
  draw: number,
) {
  const label: React.CSSProperties = {
    fontFamily: family,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  switch (g.kind) {
    case "line":
      return <div style={{ width: 420 * draw, height: 8, background: color }} />;
    case "underline":
      return <div style={{ width: 300 * draw, height: 14, background: color, borderRadius: 8 }} />;
    case "circle":
      return (
        <svg width={320} height={320} viewBox="0 0 100 100">
          <ellipse
            cx="50"
            cy="50"
            rx="44"
            ry="34"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={250}
            strokeDashoffset={250 * (1 - draw)}
          />
        </svg>
      );
    case "rect":
      return (
        <div
          style={{
            width: 320,
            height: 200,
            border: `6px solid ${color}`,
            clipPath: `inset(0 ${100 - draw * 100}% 0 0)`,
          }}
        />
      );
    case "border":
      return (
        <div
          style={{
            width: 880,
            height: 1500,
            border: `6px solid ${color}`,
            clipPath: `inset(0 ${100 - draw * 100}% 0 0)`,
          }}
        />
      );
    case "film_frame":
      return (
        <div
          style={{
            width: 900,
            height: 1400,
            border: `3px solid ${color}`,
            outline: `26px solid ${palette.bg}`,
            outlineOffset: 3,
          }}
        />
      );
    case "corner":
      return (
        <div style={{ width: 860, height: 1460, position: "relative" }}>
          {[
            { top: 0, left: 0, borderTop: `8px solid ${color}`, borderLeft: `8px solid ${color}` },
            { top: 0, right: 0, borderTop: `8px solid ${color}`, borderRight: `8px solid ${color}` },
            { bottom: 0, left: 0, borderBottom: `8px solid ${color}`, borderLeft: `8px solid ${color}` },
            { bottom: 0, right: 0, borderBottom: `8px solid ${color}`, borderRight: `8px solid ${color}` },
          ].map((s, i) => (
            <div key={i} style={{ position: "absolute", width: 90, height: 90, ...s }} />
          ))}
        </div>
      );
    case "arrow":
      return (
        <svg width={280} height={140} viewBox="0 0 120 60">
          <g
            stroke={color}
            strokeWidth="7"
            fill="none"
            strokeLinecap="square"
            strokeDasharray={200}
            strokeDashoffset={200 * (1 - draw)}
          >
            <path d="M6 30 H110" />
            <path d="M85 8 L112 30 L85 52" />
          </g>
        </svg>
      );
    case "scribble":
      return (
        <svg width={420} height={180} viewBox="0 0 200 80">
          <path
            d="M5 60 C40 5, 60 75, 95 30 S150 70, 195 20"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={320}
            strokeDashoffset={320 * (1 - draw)}
          />
        </svg>
      );
    case "star":
      return (
        <svg width={180} height={180} viewBox="0 0 24 24" fill={color}>
          <path d="M12 0 L14 9 L24 12 L14 15 L12 24 L10 15 L0 12 L10 9 Z" />
        </svg>
      );
    case "cross":
      return (
        <svg width={120} height={120} viewBox="0 0 24 24" stroke={color} strokeWidth="3">
          <path d="M3 3 L21 21 M21 3 L3 21" />
        </svg>
      );
    case "grid":
      return (
        <div
          style={{
            width: 900,
            height: 1500,
            backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
            backgroundSize: "90px 90px",
            opacity: 0.35,
          }}
        />
      );
    case "label":
      return (
        <div
          style={{
            ...label,
            background: color,
            color: palette.bg,
            padding: "12px 26px",
            fontSize: 40,
          }}
        >
          {g.text ?? "LABEL"}
        </div>
      );
    case "highlight_bar":
      return (
        <div
          style={{
            ...label,
            background: color,
            color: palette.bg,
            padding: "10px 24px",
            fontSize: 56,
            clipPath: `inset(0 ${100 - draw * 100}% 0 0)`,
          }}
        >
          {g.text ?? "HERO"}
        </div>
      );
    case "badge":
      return (
        <div
          style={{
            ...label,
            width: 130,
            height: 130,
            borderRadius: "50%",
            border: `6px solid ${color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
          }}
        >
          {g.text ?? "01"}
        </div>
      );
    case "sticker":
      return (
        <div
          style={{
            ...label,
            background: color,
            color: palette.bg,
            padding: "18px 30px",
            fontSize: 44,
            borderRadius: 999,
            boxShadow: `0 0 0 8px ${palette.bg}`,
          }}
        >
          {g.text ?? "NEW"}
        </div>
      );
    case "counter": {
      const target = Number(g.text ?? "100") || 100;
      return (
        <div style={{ ...label, fontSize: 150, letterSpacing: "-0.03em" }}>
          {Math.round(target * draw)}
        </div>
      );
    }
    case "number":
      return (
        <div style={{ ...label, fontSize: 380, letterSpacing: "-0.05em", lineHeight: 0.8 }}>
          {g.text ?? "03"}
        </div>
      );
    case "timestamp":
      return (
        <div style={{ ...label, fontFamily: "monospace", fontSize: 40 }}>
          {g.text ?? "REC ● 00:00:14"}
        </div>
      );
    case "editorial_mark":
      return <div style={{ ...label, fontSize: 120 }}>{g.text ?? "—"}</div>;
    case "progress_bar":
      return (
        <div style={{ width: 800, height: 10, background: `${color}33` }}>
          <div style={{ width: `${draw * 100}%`, height: "100%", background: color }} />
        </div>
      );
    case "ticker": {
      const text = `${g.text ?? "TEMPO"} · `;
      return (
        <div style={{ width: 1080, overflow: "hidden" }}>
          <div
            style={{
              ...label,
              fontSize: 54,
              transform: `translateX(${-draw * 40}%)`,
              color,
            }}
          >
            {text.repeat(8)}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
