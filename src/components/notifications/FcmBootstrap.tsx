import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { useFcmToken } from "@/hooks/useFcmToken";

/**
 * Keeps this device's FCM token registered whenever the user has push enabled,
 * so background notifications work without revisiting Notification Settings.
 */
export function FcmBootstrap() {
  const { prefs } = useNotificationPrefs();
  useFcmToken(!!prefs.push?.enabled);
  return null;
}
