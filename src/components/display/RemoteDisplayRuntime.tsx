import type { DeviceDoc } from "@/hooks/useDeviceSettings";
import { useRemoteDisplayPhotos } from "@/hooks/useRemoteDisplayPhotos";
import { useCalendar } from "@/hooks/useCalendar";
import { useTasks } from "@/hooks/useTasks";
import { SceneRotator } from "@/components/display/SceneRotator";

export function RemoteDisplayRuntime({ device }: { device: DeviceDoc }) {
  const { photos } = useRemoteDisplayPhotos(device.uid);
  const { events } = useCalendar(device.uid);
  const { tasks } = useTasks(device.uid);

  return <SceneRotator device={device} photos={photos} calendarEvents={events} tasks={tasks} />;
}
