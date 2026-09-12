import type { DeviceDoc } from "@/hooks/useDeviceSettings";
import { useDisplayOwnerPhotos } from "@/hooks/useDisplayOwnerPhotos";
import type { RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import { useCalendar } from "@/hooks/useCalendar";
import { useTasks } from "@/hooks/useTasks";
import { useBirthdays } from "@/hooks/useBirthdays";
import { useFamilyMessages } from "@/hooks/useFamilyMessages";
import { SceneRotator } from "@/components/display/SceneRotator";

export function RemoteDisplayRuntime({
  device,
  extraPhotos = [],
}: {
  device: DeviceDoc;
  extraPhotos?: RemoteDisplayPhoto[];
}) {
  const { photos, loading: photosLoading } = useDisplayOwnerPhotos(device.uid);
  const { events } = useCalendar(device.uid);
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
