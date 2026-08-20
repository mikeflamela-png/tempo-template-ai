import { useCallback, useRef, useState } from "react";
import { Loader2, Music, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { analyseAudio } from "@/lib/audio/beatmap";
import { setAudio, updateAudio } from "@/lib/template/store";
import type { AudioTrack } from "@/lib/template/types";

interface Props {
  audio: AudioTrack | null;
  tightness: number;
  onTightness: (v: number) => void;
  onSync: () => void;
  onUnsync: () => void;
  synced: boolean;
}

export function MusicPanel({
  audio,
  tightness,
  onTightness,
  onSync,
  onUnsync,
  synced,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [peaks, setPeaks] = useState<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (file: File) => {
    setBusy(true);
    try {
      const { beatMap, peaks: p } = await analyseAudio(file);
      setPeaks(p);
      setAudio({
        url: URL.createObjectURL(file),
        name: file.name,
        duration: beatMap.duration,
        trimStart: 0,
        volume: 0.8,
        fadeIn: 0.2,
        fadeOut: 0.5,
        beatMap,
      });
      toast.success(`Analysed · ${beatMap.bpm} BPM · ${beatMap.events.length} events`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not analyse that track");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Music</h2>
        {audio && (
          <button
            onClick={() => setAudio(null)}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove track"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {!audio ? (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Music className="size-5" />}
            {busy ? "Analysing beats…" : "Upload a track"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void load(f);
            }}
          />
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-2">
            <p className="truncate text-xs font-semibold">{audio.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {audio.beatMap?.bpm ?? "?"} BPM · {audio.duration.toFixed(1)}s ·{" "}
              {audio.beatMap?.events.length ?? 0} events
            </p>
            {peaks.length > 0 && (
              <div className="mt-2 flex h-8 items-end gap-px">
                {peaks
                  .filter((_, i) => i % 6 === 0)
                  .map((p, i) => (
                    <span
                      key={i}
                      className="flex-1 bg-primary/60"
                      style={{ height: `${Math.max(6, p * 100)}%` }}
                    />
                  ))}
              </div>
            )}
          </div>

          <Row label={`Start ${audio.trimStart.toFixed(1)}s`}>
            <Slider
              value={[audio.trimStart]}
              min={0}
              max={Math.max(0.1, audio.duration - 1)}
              step={0.1}
              onValueChange={(v) => updateAudio({ trimStart: v[0] ?? 0 })}
            />
          </Row>
          <Row label={`Volume ${Math.round(audio.volume * 100)}%`}>
            <Slider
              value={[audio.volume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(v) => updateAudio({ volume: v[0] ?? 0.8 })}
            />
          </Row>
          <Row label={`Fade out ${audio.fadeOut.toFixed(1)}s`}>
            <Slider
              value={[audio.fadeOut]}
              min={0}
              max={3}
              step={0.1}
              onValueChange={(v) => updateAudio({ fadeOut: v[0] ?? 0 })}
            />
          </Row>

          <div className="space-y-2 rounded-lg border border-border p-2">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Sync tightness — {tightness < 0.5 ? "loose" : "tight"}
            </Label>
            <Slider
              value={[tightness]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(v) => onTightness(v[0] ?? 0.5)}
            />
            <p className="text-[10px] leading-snug text-muted-foreground">
              Loose keeps the template&apos;s rhythm and only nudges major cuts. Tight snaps every
              meaningful cut, text and graphic onto the beat grid.
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={onSync}>
                Sync to track
              </Button>
              {synced && (
                <Button size="sm" variant="secondary" onClick={onUnsync}>
                  Revert
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
