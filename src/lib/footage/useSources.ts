import { useEffect, useState } from "react";
import { cachedUrl, mediaUrl } from "./db";
import { projectSources, useFootage } from "./store";

/**
 * Materialises every source blob for a project into an object URL exactly once.
 * Returns a tick that changes whenever a new URL becomes available.
 */
export function useSourceUrls(projectId: string) {
  const { sources, ready } = useFootage();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const list = projectSources(projectId);
    void (async () => {
      for (const s of list) {
        if (cachedUrl(s.id)) continue;
        await mediaUrl(s.id);
        if (!alive) return;
        setTick((t) => t + 1);
      }
      if (alive) setTick((t) => t + 1);
    })();
    return () => {
      alive = false;
    };
  }, [projectId, ready, sources.length]);

  return tick;
}

export function urlFor(sourceId: string) {
  return cachedUrl(sourceId);
}
