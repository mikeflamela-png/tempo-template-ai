import { useSyncExternalStore } from "react";
import type { AudioTrack, TemplateSpec } from "./types";
import { BASE_TEMPLATES } from "./library";
import type { PreviewReel } from "./reel";

const KEY = "template-lab:v1";

export interface ProjectRecord {
  id: string;
  templateId: string;
  name: string;
  updatedAt: number;
  spec: TemplateSpec;
  textOverrides: Record<string, string>;
  /** media is object-URL backed and cannot survive a reload — names only */
  mediaNames: Record<string, string>;
}

interface State {
  generated: TemplateSpec[];
  saved: string[];
  /** object-URL backed, session only */
  reel: PreviewReel | null;
  reelShuffle: number;
  audio: AudioTrack | null;
  projects: ProjectRecord[];
}

const empty: State = {
  generated: [],
  saved: [],
  reel: null,
  reelShuffle: 0,
  audio: null,
  projects: [],
};

let state: State = { ...empty };
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      state = {
        ...state,
        generated: parsed.generated ?? [],
        saved: parsed.saved ?? [],
        projects: parsed.projects ?? [],
      };
    }
  } catch {
    /* ignore */
  }
}

function commit(next: State) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          generated: state.generated,
          saved: state.saved,
          projects: state.projects,
        }),
      );
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function useTemplateStore() {
  hydrate();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => empty,
  );
}

export function addGenerated(specs: TemplateSpec[]) {
  hydrate();
  const ids = new Set(specs.map((s) => s.id));
  commit({
    ...state,
    generated: [...specs, ...state.generated.filter((s) => !ids.has(s.id))].slice(0, 60),
  });
}

export function toggleSaved(id: string) {
  hydrate();
  const saved = state.saved.includes(id)
    ? state.saved.filter((s) => s !== id)
    : [...state.saved, id];
  commit({ ...state, saved });
}

export function setReel(reel: PreviewReel | null) {
  hydrate();
  if (state.reel && state.reel.url !== reel?.url) {
    try {
      URL.revokeObjectURL(state.reel.url);
    } catch {
      /* ignore */
    }
  }
  commit({ ...state, reel, reelShuffle: 0 });
}

export function reshuffleReel() {
  hydrate();
  commit({ ...state, reelShuffle: state.reelShuffle + 1 });
}

export function getReel() {
  hydrate();
  return state.reel;
}

export function setAudio(audio: AudioTrack | null) {
  hydrate();
  if (state.audio && state.audio.url !== audio?.url) {
    try {
      URL.revokeObjectURL(state.audio.url);
    } catch {
      /* ignore */
    }
  }
  commit({ ...state, audio });
}

export function updateAudio(patch: Partial<AudioTrack>) {
  hydrate();
  if (!state.audio) return;
  commit({ ...state, audio: { ...state.audio, ...patch } });
}

export function saveProject(record: Omit<ProjectRecord, "updatedAt">) {
  hydrate();
  const next: ProjectRecord = { ...record, updatedAt: Date.now() };
  commit({
    ...state,
    projects: [next, ...state.projects.filter((p) => p.id !== record.id)].slice(0, 40),
  });
  return next;
}

export function deleteProject(id: string) {
  hydrate();
  commit({ ...state, projects: state.projects.filter((p) => p.id !== id) });
}

export function allTemplates(): TemplateSpec[] {
  hydrate();
  return [...state.generated, ...BASE_TEMPLATES];
}

export function findTemplate(id: string): TemplateSpec | undefined {
  return allTemplates().find((t) => t.id === id);
}
