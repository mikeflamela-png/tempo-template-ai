/**
 * FEEDBACK DIALOG
 *
 * A small structured love/dislike capture surface. Fires on anything the
 * user reacts to (a render, an opener, a motion pack) and writes into the
 * persistent taste profile via recordFeedback.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LIKE_TAGS } from "@/lib/taste/goldStandards";
import { DISLIKE_TAGS, recordFeedback } from "@/lib/taste/profile";

export interface FeedbackDialogProps {
  targetId: string;
  kind: "love" | "dislike";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FeedbackDialog({ targetId, kind, open, onOpenChange }: FeedbackDialogProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setTags([]);
      setNote("");
    }
  }, [open, targetId, kind]);

  const options: string[] = kind === "love" ? LIKE_TAGS : DISLIKE_TAGS;

  function toggle(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function submit() {
    recordFeedback({ targetId, kind, tags, ...(note.trim() ? { note: note.trim() } : {}) });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "love" ? "What do you love about this?" : "What's off about this?"}</DialogTitle>
          <DialogDescription>
            Tag what stood out — this trains your persistent taste profile.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {options.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                  active
                    ? kind === "love"
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-destructive bg-destructive/20 text-destructive"
                    : "border-border text-muted-foreground hover:border-foreground/40",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <Textarea
          placeholder="Optional note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={tags.length === 0 && !note.trim()}>
            Save feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
