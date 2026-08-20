import { Player, type PlayerRef } from "@remotion/player";
import { forwardRef } from "react";
import { TemplateVideo } from "./TemplateComposition";
import type { MediaMap, TemplateSpec } from "@/lib/template/types";

export interface PlayerProps {
  spec: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  clickToPlay?: boolean;
  initialFrame?: number;
}

const TemplatePlayerInner = forwardRef<PlayerRef, PlayerProps>(function Inner(
  {
    spec,
    media,
    textOverrides,
    controls = true,
    autoPlay = false,
    loop = true,
    clickToPlay = true,
    initialFrame = 0,
  },
  ref,
) {
  return (
    <Player
      ref={ref}
      component={TemplateVideo}
      inputProps={{ spec, media, textOverrides }}
      durationInFrames={Math.max(2, Math.round(spec.duration * spec.fps))}
      fps={spec.fps}
      compositionWidth={spec.width}
      compositionHeight={spec.height}
      style={{ width: "100%", height: "100%" }}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      clickToPlay={clickToPlay}
      initialFrame={initialFrame}
      acknowledgeRemotionLicense
    />
  );
});

export default TemplatePlayerInner;