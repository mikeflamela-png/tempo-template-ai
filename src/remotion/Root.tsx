/**
 * Remotion entry used by the render worker. The worker bundles this file and
 * renders the exact same composition the browser Player shows, so previews and
 * exports can never drift apart.
 */
import { Composition } from "remotion";
import { TemplateVideo, type TemplateVideoProps } from "@/components/video/TemplateComposition";
import type { TemplateSpec } from "@/lib/template/types";

const fallbackSpec: TemplateSpec = {
  id: "placeholder",
  name: "Placeholder",
  duration: 6,
  fps: 30,
  width: 1080,
  height: 1920,
  tags: [],
  palette: { bg: "#0b0b0d", ink: "#f5f2ec", accent: "#e8ff54" },
  mediaSlots: [],
  textSlots: [],
  overlays: [],
  beatMarkers: [],
  creativeProfile: {
    family: "",
    energy: "",
    pacing: "",
    typography: "",
    transitionStyle: "",
    structure: "",
  },
};

export const RemotionRoot = () => (
  <Composition
    id="tempo"
    component={TemplateVideo as never}
    durationInFrames={180}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{ spec: fallbackSpec, media: {}, textOverrides: {}, audio: null }}
    calculateMetadata={({ props }) => {
      const spec = ((props as Record<string, unknown>)['spec'] ?? fallbackSpec) as TemplateSpec;
      return {
        durationInFrames: Math.max(2, Math.round(spec.duration * spec.fps)),
        fps: spec.fps,
        width: spec.width,
        height: spec.height,
      };
    }}
  />
);
