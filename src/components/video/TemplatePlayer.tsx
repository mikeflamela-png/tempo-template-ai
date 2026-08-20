import { Suspense, lazy, useEffect, useState, forwardRef } from "react";
import type { PlayerRef } from "@remotion/player";
import type { PlayerProps } from "./TemplatePlayerInner";

const Inner = lazy(() => import("./TemplatePlayerInner"));

export const TemplatePlayer = forwardRef<PlayerRef, PlayerProps>(function TemplatePlayer(
  props,
  ref,
) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const skeleton = (
    <div className="h-full w-full animate-pulse bg-muted/40" aria-hidden />
  );
  if (!mounted) return skeleton;

  return (
    <Suspense fallback={skeleton}>
      <Inner {...props} ref={ref} />
    </Suspense>
  );
});