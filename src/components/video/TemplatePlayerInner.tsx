import { Player, type PlayerRef } from "@remotion/player";
import { forwardRef } from "react";
import { TemplateVideo } from "./TemplateComposition";
import type { AudioTrack, MediaMap, TemplateSpec } from "@/lib/template/types";

export interface PlayerProps {
  spec: TemplateSpec;
  media: MediaMap;
  textOverrides: Record<string, string>;
  audio?: AudioTrack | null | undefined;
  controls?: boolean | undefined;
  autoPlay?: boolean | undefined;
  loop?: boolean | undefined;
  clickToPlay?: boolean | undefined;
  initialFrame?: number | undefined;
}

const TemplatePlayerInner = forwardRef<PlayerRef, PlayerProps>(function Inner(
  {
    spec,
    media,
    textOverrides,
    audio = null,
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
      inputProps={{ spec, media, textOverrides, audio }}
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