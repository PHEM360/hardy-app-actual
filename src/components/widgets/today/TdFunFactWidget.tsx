import { funFactForDate } from "@/lib/funFacts";
import { TdHead } from "./TdHead";

export function TdFunFactWidget() {
  const fact = funFactForDate();
  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="✨" title="Fun fact" />
      <p className="text-sm leading-relaxed text-foreground">{fact}</p>
    </div>
  );
}
