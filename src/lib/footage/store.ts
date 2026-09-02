import { useSyncExternalStore } from "react";
import { getMedia, putMedia, deleteMedia } from "./db";
import type {
  Clip,
  EditVersion,
  LogoRecord,
  MakeSettings,
  MusicRecord,
  Project,
  Scene,
  ShotType,
  SourceRecord,
} from "./types";

/**
 * Project memory. Ratings, favorites, rejects, shot types, trims, scene groups,
 * music and generated versions all survive a reload. Persisted in IndexedDB
 * (thumbnails would blow the localStorage quota).
 */
const STATE_KEY = "tempo-selects-state:v1";

interface State {
  projects: Project[];
  sources: SourceRecord[];
  clips: Clip[];
  scenes: Scene[];
  ready: boolean;
}

const empty: State = { projects: [], sources: [], clips: [], scenes: [], ready: false };
let state: State = empty;
const listeners = new Set<() => void>();
let hydrating = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;


function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload = JSON.stringify({
      projects: state.projects,
      sources: state.sources,
      clips: state.clips,
      scenes: state.scenes,
    });

    void putMedia(STATE_KEY, new Blob([payload], { type: "application/json" })).catch(() => {});
  }, 300);
}

function commit(next: State) {
  state = next;
  persist();
  emit();
}

/** Anything created while hydration was still in flight must survive it. */
function mergeById<T extends { id: string }>(stored: T[], live: T[]): T[] {
  const out = [...stored];
  const seen = new Set(stored.map((x) => x.id));
  for (const item of live) if (!seen.has(item.id)) out.unshift(item);
  return out;
}

export function hydrateFootage() {
  if (hydrating || state.ready || typeof window === "undefined") return;
  hydrating = true;
  void (async () => {
    try {
      const blob = await getMedia(STATE_KEY);
      if (blob) {
        const parsed = JSON.parse(await blob.text()) as Partial<State>;
        state = {
          projects: mergeById(parsed.projects ?? [], state.projects),
          sources: mergeById(parsed.sources ?? [], state.sources),
          clips: mergeById(parsed.clips ?? [], state.clips),
          scenes: mergeById(parsed.scenes ?? [], state.scenes),
          ready: true,

        };
      } else {
        state = { ...state, ready: true };
      }
    } catch {
      state = { ...state, ready: true };
    }
    persist();
    emit();
  })();
}

export function useFootage() {
  hydrateFootage();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => empty,
  );
}

export function getState() {
  return state;
}

/* ------------------------------------------------------------------ projects */

export const DEFAULT_SETTINGS: MakeSettings = {
  duration: 15,
  format: "9:16",
  styleKey: "clean",
  effects: "light",
  count: 5,
  logo: { mode: "none", position: "center", scale: 1 },
  text: {
    opening: "",
    middle: "",
    closing: "",
    style: "minimal",
    placement: "bottom",
    fontKey: "inter-tight",
  },
};


export function createProject(name: string, kind: Project["kind"]): Project {
  const p: Project = {
    id: `pr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || "Untitled project",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    kind,
    music: null,
    versions: [],
    lastSettings: null,
  };
  commit({ ...state, projects: [p, ...state.projects] });
  return p;
}

export function updateProject(id: string, patch: Partial<Project>) {
  commit({
    ...state,
    projects: state.projects.map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
    ),
  });
}

export function deleteProject(id: string) {
  const sources = state.sources.filter((s) => s.projectId === id);
  sources.forEach((s) => void deleteMedia(s.id));
  commit({
    ...state,
    projects: state.projects.filter((p) => p.id !== id),
    sources: state.sources.filter((s) => s.projectId !== id),
    clips: state.clips.filter((c) => c.projectId !== id),
    scenes: state.scenes.filter((s) => s.projectId !== id),
  });
}

export function projectById(id: string) {
  return state.projects.find((p) => p.id === id) ?? null;
}

export function setLogo(projectId: string, logo: LogoRecord | null) {
  updateProject(projectId, { logo });
}

/* ------------------------------------------------------------------- scenes */

export function projectScenes(projectId: string): Scene[] {
  return state.scenes.filter((s) => s.projectId === projectId);
}

export function sceneById(id: string | null | undefined) {
  return id ? (state.scenes.find((s) => s.id === id) ?? null) : null;
}

/** Group clips into a new scene. Naming is optional. */
export function groupAsScene(projectId: string, clipIds: string[], name?: string): Scene {
  const index = projectScenes(projectId).length + 1;
  const scene: Scene = {
    id: `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    name: (name ?? "").trim() || `Scene ${index}`,
    createdAt: Date.now(),
  };
  const set = new Set(clipIds);
  commit({
    ...state,
    scenes: [...state.scenes, scene],
    clips: state.clips.map((c) => (set.has(c.id) ? { ...c, sceneId: scene.id } : c)),
  });
  return scene;
}

export function addToScene(sceneId: string, clipIds: string[]) {
  const set = new Set(clipIds);
  commit({ ...state, clips: state.clips.map((c) => (set.has(c.id) ? { ...c, sceneId } : c)) });
}

export function removeFromScene(clipIds: string[]) {
  const set = new Set(clipIds);
  commit({ ...state, clips: state.clips.map((c) => (set.has(c.id) ? { ...c, sceneId: null } : c)) });
}

export function renameScene(sceneId: string, name: string) {
  commit({
    ...state,
    scenes: state.scenes.map((s) => (s.id === sceneId ? { ...s, name: name.trim() || s.name } : s)),
  });
}

export function ungroupScene(sceneId: string) {
  commit({
    ...state,
    scenes: state.scenes.filter((s) => s.id !== sceneId),
    clips: state.clips.map((c) => (c.sceneId === sceneId ? { ...c, sceneId: null } : c)),
  });
}


/* -------------------------------------------------------------------- media */

export function addSource(rec: SourceRecord) {
  commit({ ...state, sources: [...state.sources, rec] });
}

export function sourceById(id: string) {
  return state.sources.find((s) => s.id === id) ?? null;
}

export function projectSources(projectId: string) {
  return state.sources.filter((s) => s.projectId === projectId);
}

/* -------------------------------------------------------------------- clips */

export function addClips(clips: Clip[]) {
  commit({ ...state, clips: [...state.clips, ...clips] });
}

export function projectClips(projectId: string): Clip[] {
  return state.clips
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.order - b.order);
}

export function updateClip(id: string, patch: Partial<Clip>) {
  commit({ ...state, clips: state.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
}

export function updateClips(ids: string[], patch: Partial<Clip>) {
  const set = new Set(ids);
  commit({ ...state, clips: state.clips.map((c) => (set.has(c.id) ? { ...c, ...patch } : c)) });
}

export function deleteClip(id: string) {
  commit({ ...state, clips: state.clips.filter((c) => c.id !== id) });
}

/** Merge a clip with the one after it (same source, adjacent). */
export function mergeWithNext(id: string) {
  const list = state.clips.filter((c) => c.projectId === clipById(id)?.projectId);
  const ordered = [...list].sort((a, b) => a.order - b.order);
  const i = ordered.findIndex((c) => c.id === id);
  const cur = ordered[i];
  const next = ordered[i + 1];
  if (!cur || !next || cur.sourceId !== next.sourceId) return;
  const merged: Clip = { ...cur, end: next.end, out: next.out };
  commit({
    ...state,
    clips: state.clips
      .filter((c) => c.id !== next.id)
      .map((c) => (c.id === cur.id ? merged : c)),
  });
}

/** Split a clip at an absolute source time. */
export function splitClip(id: string, at: number) {
  const clip = clipById(id);
  if (!clip) return;
  if (at <= clip.start + 0.2 || at >= clip.end - 0.2) return;
  const a: Clip = { ...clip, end: at, out: Math.min(clip.out, at) };
  const b: Clip = {
    ...clip,
    id: `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    start: at,
    in: at,
    out: clip.end,
    end: clip.end,
    order: clip.order + 0.5,
    thumb: undefined,
  };
  commit({ ...state, clips: [...state.clips.map((c) => (c.id === id ? a : c)), b] });
}

export function clipById(id: string) {
  return state.clips.find((c) => c.id === id) ?? null;
}

export function setShotType(id: string, shotType: ShotType | null) {
  updateClip(id, { shotType });
}

/* -------------------------------------------------------------------- music */

export function setMusic(projectId: string, music: MusicRecord | null) {
  updateProject(projectId, { music });
}

/* ----------------------------------------------------------------- versions */

export function saveVersions(projectId: string, versions: EditVersion[], settings: MakeSettings) {
  const project = projectById(projectId);
  if (!project) return;
  updateProject(projectId, { versions, lastSettings: settings });
}

export function updateVersion(projectId: string, versionId: string, patch: Partial<EditVersion>) {
  const project = projectById(projectId);
  if (!project) return;
  updateProject(projectId, {
    versions: project.versions.map((v) => (v.id === versionId ? { ...v, ...patch } : v)),
  });
}
