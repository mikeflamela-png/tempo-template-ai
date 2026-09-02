import { useEffect, useState } from "react";
import { cachedUrl, mediaUrl } from "./db";
import { projectById, projectSources, useFootage } from "./store";

/**
 * Materialises every source blob for a project into an object URL exactly once,
 * plus the project music and logo. Returns a tick that changes whenever a new
 * URL becomes available.
 */
export function useSourceUrls(projectId: string) {
  const { sources, ready } = useFootage();
  const [tick, setTick] = useState(0);
  const project = projectById(projectId);
  const extras = [project?.music?.id, project?.logo?.id].filter(Boolean) as string[];

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const list = [...projectSources(projectId).map((s) => s.id), ...extras];
    void (async () => {
      for (const mediaId of list) {
        if (cachedUrl(mediaId)) continue;
        await mediaUrl(mediaId);
        if (!alive) return;
        setTick((t) => t + 1);
      }
      if (alive) setTick((t) => t + 1);
    })();
    return () => {
      alive = false;
    };
  }, [projectId, ready, sources.length, extras.join(",")]);

  return tick;
}


export function urlFor(sourceId: string) {
  return cachedUrl(sourceId);
}
