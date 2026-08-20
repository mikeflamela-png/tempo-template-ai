import { Suspense, lazy, useEffect, useState } from "react";
import type { ExperimentPlayerProps } from "@/components/video/ExperimentPlayerInner";

const Inner = lazy(() => import("@/components/video/ExperimentPlayerInner"));

export function ExperimentPlayer(props: ExperimentPlayerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const skeleton = <div className="h-full w-full animate-pulse bg-muted/40" aria-hidden />;
  if (!mounted) return skeleton;
  return (
    <Suspense fallback={skeleton}>
      <Inner {...props} />
    </Suspense>
  );
}
