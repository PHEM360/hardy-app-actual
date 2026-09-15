import type { DeviceDoc } from "@/hooks/useDeviceSettings";
import { useDisplayOwnerPhotos } from "@/hooks/useDisplayOwnerPhotos";
import type { RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import { useHouseholdCalendar } from "@/hooks/useHouseholdCalendar";
import { useTasks } from "@/hooks/useTasks";
import { useBirthdays } from "@/hooks/useBirthdays";
import { useFamilyMessages } from "@/hooks/useFamilyMessages";
import { SceneRotator } from "@/components/display/SceneRotator";
import type { CalendarEvent, CalendarEventCategory } from "@/types/app";

const CALENDAR_EVENT_CATEGORIES: CalendarEventCategory[] = ["personal", "family", "work", "health", "social", "other", "birthday"];

export function RemoteDisplayRuntime({
  device,
  extraPhotos = [],
}: {
  device: DeviceDoc;
  extraPhotos?: RemoteDisplayPhoto[];
}) {
  const { photos, loading: photosLoading } = useDisplayOwnerPhotos(device.uid);
  // A shared wall display should show every household member's events, not
  // just the one account the device happens to be paired to — otherwise it
  // silently looks like a single-person calendar on a screen meant for the
  // whole family. getHouseholdCalendarEvents resolves real household
  // membership server-side (calendar sharing is per-owner pageShares, not
  // household membership, so this can't be assembled from client reads).
  const { events: householdEvents } = useHouseholdCalendar(device.householdId);
  const events: CalendarEvent[] = householdEvents.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    category: CALENDAR_EVENT_CATEGORIES.includes(e.category as CalendarEventCategory) ? (e.category as CalendarEventCategory) : "family",
    startDate: e.startDate,
    endDate: e.endDate,
    allDay: e.allDay,
    createdBy: e.ownerUid,
  }));
  const { tasks } = useTasks(device.uid);
  const { birthdays } = useBirthdays(device.householdId);
  // Pinned to the display's own paired household rather than whichever
  // household this kiosk's browser last had active (it may have none).
  const { messages } = useFamilyMessages(device.householdId);

  return (
    <SceneRotator
      device={device}
      photos={[...photos, ...extraPhotos]}
      photosLoading={photosLoading}
      calendarEvents={events}
      tasks={tasks}
      birthdays={birthdays}
      familyMessages={messages}
    />
  );
}
