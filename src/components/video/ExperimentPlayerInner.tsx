import { Player } from "@remotion/player";
import { ExperimentVideo, type ExperimentCompositionProps } from "./ExperimentComposition";

export interface ExperimentPlayerProps extends ExperimentCompositionProps {
  width?: number;
  height?: number;
  loop?: boolean;
  controls?: boolean;
}

export default function ExperimentPlayerInner({
  width = 1080,
  height = 1350,
  loop = true,
  controls = false,
  ...props
}: ExperimentPlayerProps) {
  const fps = 30;
  return (
    <Player
      component={ExperimentVideo}
      inputProps={props}
      durationInFrames={Math.max(6, Math.round(props.duration * fps))}
      fps={fps}
      compositionWidth={width}
      compositionHeight={height}
      style={{ width: "100%", height: "100%" }}
      autoPlay
      loop={loop}
      controls={controls}
      clickToPlay={false}
      acknowledgeRemotionLicense
    />
  );
}
