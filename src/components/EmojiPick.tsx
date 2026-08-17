export const PET_AVATARS = [
  "🐶", "🐕", "🐩", "🐺", "🐱", "🐈", "🐴", "🦄", "🐰", "🐹",
  "🐭", "🐦", "🦜", "🐧", "🐠", "🐟", "🐢", "🦎", "🐍", "🐸",
  "🐄", "🐷", "🐑", "🐐", "🐔", "🦆", "🦉", "🦊", "🐻", "🐼",
];

export function EmojiPick({
  value,
  onChange,
  options = PET_AVATARS,
}: {
  value: string;
  onChange: (emoji: string) => void;
  options?: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center border transition-all ${
              value === emoji ? "border-primary bg-primary/10 scale-110" : "border-border/50 bg-card hover:bg-muted"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or type any emoji"
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-2xl"
        maxLength={8}
      />
    </div>
  );
}
