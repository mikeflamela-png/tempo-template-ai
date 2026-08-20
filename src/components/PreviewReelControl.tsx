import { useRef } from "react";
import { Film, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setReel, useTemplateStore } from "@/lib/template/store";

async function readDuration(url: string) {
  return new Promise<number>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => resolve(0);
    v.src = url;
  });
}

export function PreviewReelControl({ compact = false }: { compact?: boolean }) {
  const { reel } = useTemplateStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast("That isn't a video file");
      return;
    }
    const url = URL.createObjectURL(file);
    const duration = await readDuration(url);
    if (duration < 1) {
      toast("Couldn't read that video's duration");
      return;
    }
    setReel({ url, name: file.name, duration });
    toast("Preview reel set", {
      description: `${file.name} · ${duration.toFixed(1)}s — every template now previews with sections of this footage.`,
    });
  };

  return (
    <div
      className={
        compact
          ? "flex items-center gap-2"
          : "flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 backdrop-blur"
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {!compact && (
        <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Preview footage
        </span>
      )}
      {reel ? (
        <>
          <span className="flex min-w-0 items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs">
            <Film className="size-3.5 shrink-0 text-primary" />
            <span className="max-w-[180px] truncate">{reel.name}</span>
            <span className="text-muted-foreground">{reel.duration.toFixed(0)}s</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
            <RefreshCw className="size-3.5" /> Replace
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setReel(null)}>
            <X className="size-3.5" /> Remove
          </Button>
        </>
      ) : (
        <>
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="size-3.5" /> Upload preview reel
          </Button>
          {!compact && (
            <span className="text-xs text-muted-foreground">
              One 30–120s stringout. Every template slot gets a different section of it.
            </span>
          )}
        </>
      )}
    </div>
  );
}
