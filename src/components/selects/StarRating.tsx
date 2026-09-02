import { Star } from "lucide-react";

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "lg";
}

export function StarRating({ value, onChange, size = "sm" }: Props) {
  const cls = size === "lg" ? "size-7" : "size-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          disabled={!onChange}
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(value === n ? 0 : n);
          }}
          className={onChange ? "transition-transform hover:scale-110" : "cursor-default"}
        >
          <Star
            className={`${cls} ${n <= value ? "fill-primary text-primary" : "text-muted-foreground/50"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default StarRating;
