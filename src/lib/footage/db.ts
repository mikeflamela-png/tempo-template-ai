/**
 * Blob store for uploaded footage and music.
 *
 * Sources are stored ONCE. Every clip is a virtual pointer (sourceId + in/out),
 * so a 12 minute stringout that yields 137 clips still occupies one blob.
 */
const DB = "tempo-footage";
const STORE = "media";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putMedia(id: string, blob: Blob) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getMedia(id: string): Promise<Blob | null> {
  const db = await open();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

export async function deleteMedia(id: string) {
  const db = await open();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

/** Object URL cache so a source blob is only ever materialised once per session. */
const urls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export function cachedUrl(id: string): string | null {
  return urls.get(id) ?? null;
}

export async function mediaUrl(id: string): Promise<string | null> {
  const existing = urls.get(id);
  if (existing) return existing;
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const p = (async () => {
    const blob = await getMedia(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urls.set(id, url);
    return url;
  })();
  pending.set(id, p);
  const url = await p;
  pending.delete(id);
  return url;
}
