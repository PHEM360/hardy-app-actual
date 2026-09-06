import { useMemo } from "react";
import type { DeviceDoc } from "@/hooks/useDeviceSettings";
import { useRemoteDisplayPhotos, type RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import { useAlbumPhotoUrls } from "@/hooks/usePictures";
import { useCalendar } from "@/hooks/useCalendar";
import { useTasks } from "@/hooks/useTasks";
import { SceneRotator } from "@/components/display/SceneRotator";

export function RemoteDisplayRuntime({
  device,
  extraPhotos = [],
}: {
  device: DeviceDoc;
  extraPhotos?: RemoteDisplayPhoto[];
}) {
  const { photos } = useRemoteDisplayPhotos(device.uid);
  const { events } = useCalendar(device.uid);
  const { tasks } = useTasks(device.uid);

  const albumIds = useMemo(() => {
    const ids = new Set<string>();
    for (const page of device.settings?.pages || []) {
      for (const widget of page.widgets || []) {
        if (widget.type !== "photos") continue;
        for (const albumId of widget.albumIds || []) ids.add(albumId);
      }
    }
    return [...ids];
  }, [device.settings?.pages]);

  const { photos: albumPhotos } = useAlbumPhotoUrls(albumIds);
  const albumRemotePhotos = useMemo<RemoteDisplayPhoto[]>(
    () =>
      albumPhotos.map((photo) => ({
        id: `album:${photo.albumId}:${photo.id}`,
        url: photo.url,
        albumId: photo.albumId,
        storagePath: photo.storagePath || "",
        caption: photo.name || "",
        source: "album" as const,
        createdAt: photo.createdAt,
      })),
    [albumPhotos],
  );

  return (
    <SceneRotator
      device={device}
      photos={[...photos, ...albumRemotePhotos, ...extraPhotos]}
      calendarEvents={events}
      tasks={tasks}
    />
  );
}
