import { Link } from "react-router-dom";
import { Check, MapPin, Search, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DisplayAlbumPicker } from "@/components/display/DisplayAlbumPicker";
import {
  WIDGET_LABELS,
  type DisplayWidgetLayout,
} from "@/lib/displayPages";
import type { RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import type { PhotoAlbum } from "@/types/photos";
import type { Task } from "@/types/app";

const FIELD = "h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary";

export function DisplayWidgetSettings({
  widget,
  albums,
  photos,
  tasks,
  calendarCategories,
  placeQuery,
  onPlaceQuery,
  onFindPlace,
  onChange,
  onClose,
}: {
  widget: DisplayWidgetLayout;
  albums: PhotoAlbum[];
  photos: RemoteDisplayPhoto[];
  tasks: Task[];
  calendarCategories: string[];
  placeQuery: string;
  onPlaceQuery: (value: string) => void;
  onFindPlace: () => void;
  onChange: (patch: Partial<DisplayWidgetLayout>) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-primary/25 p-4 shadow-card"
      style={{ background: "color-mix(in srgb, hsl(198,60%,46%) 14%, hsl(var(--card)))" }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">{WIDGET_LABELS[widget.type]} settings</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close widget settings"
          className="rounded-lg p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold" htmlFor="widget-title">Heading on screen</label>
          <input
            id="widget-title"
            value={widget.title || ""}
            placeholder={WIDGET_LABELS[widget.type]}
            onChange={(event) => onChange({ title: event.target.value })}
            className={`${FIELD} mt-1`}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold" htmlFor="widget-accent">Accent colour</label>
          <input
            id="widget-accent"
            type="color"
            value={widget.accentColor || "#5eead4"}
            onChange={(event) => onChange({ accentColor: event.target.value })}
            className="h-9 w-16 cursor-pointer rounded-xl border border-border bg-transparent p-1"
          />
        </div>

        {widget.type === "clock" && (
          <label className="block text-xs font-semibold">
            Clock face
            <select
              value={widget.clockStyle || "digital"}
              onChange={(event) => onChange({ clockStyle: event.target.value as "digital" | "analog" })}
              className={`${FIELD} mt-1`}
            >
              <option value="digital">Digital</option>
              <option value="analog">Analogue</option>
            </select>
          </label>
        )}

        {(widget.type === "clock" || widget.type === "today") && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-background/70 p-2.5">
            <label className="flex items-center justify-between gap-3 text-xs">
              <span>24-hour time</span>
              <Switch checked={widget.format24h !== false} onCheckedChange={(value) => onChange({ format24h: value })} />
            </label>
            {widget.type === "clock" && (
              <>
                <label className="flex items-center justify-between gap-3 text-xs">
                  <span>Show seconds</span>
                  <Switch checked={widget.showSeconds === true} onCheckedChange={(value) => onChange({ showSeconds: value })} />
                </label>
                <label className="flex items-center justify-between gap-3 text-xs">
                  <span>Show date</span>
                  <Switch checked={widget.showDate !== false} onCheckedChange={(value) => onChange({ showDate: value })} />
                </label>
              </>
            )}
          </div>
        )}

        {widget.type === "photos" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">Photos</p>
              <Link to="/photos" className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline">
                Open Photos
              </Link>
            </div>
            <DisplayAlbumPicker
              albums={albums}
              photos={photos}
              widget={widget}
              onChange={onChange}
            />
            <label className="flex items-center gap-2 text-xs">
              Change every
              <input
                type="number"
                min={5}
                value={widget.photoIntervalSeconds || ""}
                onChange={(event) => onChange({ photoIntervalSeconds: Math.max(5, Number(event.target.value) || 20) })}
                className={`${FIELD} h-8 w-20`}
              />
              secs
            </label>
          </div>
        )}

        {(widget.type === "calendar" || widget.type === "today") && (
          <>
            {widget.type === "calendar" && (
              <>
                <label className="block text-xs font-semibold">
                  Calendar style
                  <select
                    value={widget.calendarView || "month"}
                    onChange={(event) => onChange({ calendarView: event.target.value as DisplayWidgetLayout["calendarView"] })}
                    className={`${FIELD} mt-1`}
                  >
                    <option value="month">Whole month grid</option>
                    <option value="week">This week</option>
                    <option value="agenda">List of what’s coming up</option>
                  </select>
                </label>
                {widget.calendarView === "agenda" ? (
                  <label className="flex items-center gap-2 text-xs">
                    Show the next
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={widget.calendarDaysAhead || ""}
                      onChange={(event) => onChange({ calendarDaysAhead: Math.max(1, Number(event.target.value) || 14) })}
                      className={`${FIELD} h-8 w-20`}
                    />
                    days
                  </label>
                ) : (
                  <label className="block text-xs font-semibold">
                    How events appear
                    <select
                      value={widget.calendarEventStyle || "titles"}
                      onChange={(event) => onChange({ calendarEventStyle: event.target.value as DisplayWidgetLayout["calendarEventStyle"] })}
                      className={`${FIELD} mt-1`}
                    >
                      <option value="titles">Event titles</option>
                      <option value="dots">Coloured dots only</option>
                      <option value="compact">A count per day</option>
                    </select>
                  </label>
                )}
              </>
            )}
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold" htmlFor="event-colour">Event colour</label>
              <input
                id="event-colour"
                type="color"
                value={widget.eventColor || "#f87171"}
                onChange={(event) => onChange({ eventColor: event.target.value })}
                className="h-9 w-16 cursor-pointer rounded-xl border border-border bg-transparent p-1"
              />
            </div>
            {calendarCategories.length > 0 && (
              <div>
                <p className="text-xs font-semibold">Categories</p>
                <p className="text-[10px] text-muted-foreground">None selected shows everything.</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {calendarCategories.map((category) => {
                    const selected = (widget.calendarCategories || []).includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => {
                          const next = new Set(widget.calendarCategories || []);
                          if (selected) next.delete(category); else next.add(category);
                          onChange({ calendarCategories: [...next] });
                        }}
                        className={`rounded-xl border px-2.5 py-1 text-[11px] capitalize transition ${
                          selected
                            ? "border-primary bg-primary/15 font-semibold text-foreground"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {(widget.type === "tasks" || widget.type === "today") && (
          <>
            {widget.type === "tasks" && (
              <label className="block text-xs font-semibold">
                Tasks to show
                <select
                  value={widget.taskFilter || "open"}
                  onChange={(event) => onChange({ taskFilter: event.target.value as DisplayWidgetLayout["taskFilter"] })}
                  className={`${FIELD} mt-1`}
                >
                  <option value="today">Today only</option>
                  <option value="open">All open tasks</option>
                  <option value="all">Open and completed</option>
                </select>
              </label>
            )}
            <label className="block text-xs font-semibold">
              Subtasks
              <select
                value={widget.subtaskMode || "open"}
                onChange={(event) => onChange({ subtaskMode: event.target.value as DisplayWidgetLayout["subtaskMode"] })}
                className={`${FIELD} mt-1`}
              >
                <option value="open">Show the ones still to do</option>
                <option value="all">Show all, ticked included</option>
                <option value="hide">Hide, show progress only</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold">
                Rows at a time
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={widget.taskLimit || ""}
                  onChange={(event) => onChange({ taskLimit: Math.max(1, Number(event.target.value) || 8) })}
                  className={`${FIELD} mt-1`}
                />
              </label>
              <label className="text-xs font-semibold">
                Scroll on after
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={widget.autoCycleSeconds || ""}
                  onChange={(event) => onChange({ autoCycleSeconds: Math.max(5, Number(event.target.value) || 20) })}
                  className={`${FIELD} mt-1`}
                />
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Longer lists move on by themselves, so nothing stays hidden on a screen you cannot tap.
            </p>
            {widget.type === "tasks" && (
              <details className="rounded-xl border border-border/60 bg-background/70 p-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">Choose individual tasks</summary>
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                  {tasks.map((task) => {
                    const taskId = task.id || "";
                    const selected = (widget.taskIds || []).includes(taskId);
                    return (
                      <button
                        key={taskId}
                        type="button"
                        onClick={() => {
                          const next = new Set(widget.taskIds || []);
                          if (selected) next.delete(taskId); else next.add(taskId);
                          onChange({ taskIds: [...next] });
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] ${
                          selected ? "border-primary bg-primary/15 font-semibold" : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                          {selected && <Check className="h-2.5 w-2.5" />}
                        </span>
                        <span className="truncate">{task.title}</span>
                      </button>
                    );
                  })}
                </div>
              </details>
            )}
          </>
        )}

        {widget.type === "weather" && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold" htmlFor="weather-place">Location</label>
            <div className="flex gap-1.5">
              <input
                id="weather-place"
                value={placeQuery}
                onChange={(event) => onPlaceQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") onFindPlace(); }}
                placeholder="Town or city"
                className={FIELD}
              />
              <button
                type="button"
                onClick={onFindPlace}
                aria-label="Find place"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {widget.weatherPlace
                ? `Showing ${widget.weatherPlace}`
                : "Using the screen’s own location, if it allows it."}
            </p>
          </div>
        )}

        {widget.type === "message" && (
          <label className="block text-xs font-semibold">
            Message
            <textarea
              value={widget.message || ""}
              onChange={(event) => onChange({ message: event.target.value })}
              rows={4}
              placeholder="Back at 6 — dinner in the oven"
              className={`${FIELD} mt-1 h-auto py-2`}
            />
          </label>
        )}

        {widget.type === "countdown" && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold">
              Counting down to
              <input
                type="date"
                value={widget.countdownTo || ""}
                onChange={(event) => onChange({ countdownTo: event.target.value })}
                className={`${FIELD} mt-1`}
              />
            </label>
            <label className="block text-xs font-semibold">
              What for
              <input
                value={widget.countdownLabel || ""}
                onChange={(event) => onChange({ countdownLabel: event.target.value })}
                placeholder="Holiday"
                className={`${FIELD} mt-1`}
              />
            </label>
          </div>
        )}

        {widget.type === "birthdays" && (
          <label className="flex items-center gap-2 text-xs">
            Show birthdays within
            <input
              type="number"
              min={1}
              max={365}
              value={widget.birthdaysDaysAhead || ""}
              onChange={(event) => onChange({ birthdaysDaysAhead: Math.max(1, Number(event.target.value) || 30) })}
              className={`${FIELD} h-8 w-20`}
            />
            days
          </label>
        )}

        {widget.type === "familyBoard" && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs">
              Show the latest
              <input
                type="number"
                min={1}
                max={20}
                value={widget.familyBoardLimit || ""}
                onChange={(event) => onChange({ familyBoardLimit: Math.max(1, Number(event.target.value) || 6) })}
                className={`${FIELD} h-8 w-20`}
              />
              notes
            </label>
            <p className="text-[10px] text-muted-foreground">Anyone can post a note to the family board from their phone — it appears here automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
