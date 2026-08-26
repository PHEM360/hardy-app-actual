import { format, parseISO } from "date-fns";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import { TdHead } from "./TdHead";

export function TdWeatherWidget() {
  const { forecast, failed } = useWeatherForecast();

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="🌍" title="Weather" />
      {failed && !forecast && <p className="text-xs text-muted-foreground">Location needed for the forecast.</p>}
      {forecast && (
        <>
          <p className="text-3xl font-bold font-display leading-none">{forecast.temperature}°</p>
          <p className="text-xs text-muted-foreground mb-2">{forecast.description} near you</p>
          <div className="flex-1 min-h-0 space-y-1 overflow-y-auto">
            {forecast.days.slice(0, 4).map((day) => (
              <div key={day.date} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground w-10">{format(parseISO(day.date), "EEE")}</span>
                <span className="flex-1 truncate px-2">{day.description}</span>
                <span className="font-semibold">{day.high}° / {day.low}°</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
