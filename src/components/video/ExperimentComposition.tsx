import { AbsoluteFill, Img, Sequence, Video, useVideoConfig } from "remotion";
import { CreativeKernel } from "./CreativeEventLayer";
import type { Params } from "@/lib/creative/kernels";
import type { MediaAssignment, Palette } from "@/lib/template/types";
import { useCurrentFrame } from "remotion";

export interface ExperimentLayerProps {
  kernel: string;
  params: Params;
  offset: number;
  duration: number;
}

export interface ExperimentCompositionProps {
  layers: ExperimentLayerProps[];
  palette: Palette;
  fontStack: string;
  footage: MediaAssignment | null;
  word: string;
  duration: number;
}

function KernelAt({
  layer,
  palette,
  fontStack,
  footage,
  word,
}: {
  layer: ExperimentLayerProps;
  palette: Palette;
  fontStack: string;
  footage: MediaAssignment | null;
  word: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = Math.max(1, Math.round(layer.duration * fps));
  return (
    <CreativeKernel
      kernelId={layer.kernel}
      params={layer.params}
      p={Math.min(1, frame / total)}
      frame={frame}
      palette={palette}
      fontFamily={fontStack}
      footage={footage}
      word={word}
      seed={11}
    />
  );
}

export const ExperimentVideo: React.FC<ExperimentCompositionProps> = ({
  layers,
  palette,
  fontStack,
  footage,
  word,
}) => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.max(0, Math.round(s * fps));
  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      {footage ? (
        footage.kind === "video" ? (
          <Video
            src={footage.url}
            muted
            startFrom={Math.round((footage.inPoint ?? 0) * fps)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Img src={footage.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )
      ) : null}
      {layers.map((l, i) => (
        <Sequence
          key={i}
          from={f(l.offset)}
          durationInFrames={Math.max(2, f(l.duration))}
          layout="none"
        >
          <KernelAt
            layer={l}
            palette={palette}
            fontStack={fontStack}
            footage={footage}
            word={word}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export default ExperimentVideo;
