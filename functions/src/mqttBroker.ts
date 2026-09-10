import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import mqtt, { type MqttClient } from "mqtt";

// Bridges Firebase to ESP32 sunrise lights running stock WLED. WLED has no
// way to poll an arbitrary HTTPS endpoint on a timer (that needs a custom
// usermod), but it does have a built-in MQTT client — so a small hosted
// broker is the one stock-firmware path that lets the cloud reach a device
// sitting behind home-router NAT. Manually provisioned once with:
//   firebase functions:secrets:set MQTT_BROKER_URL
//   firebase functions:secrets:set MQTT_USERNAME
//   firebase functions:secrets:set MQTT_PASSWORD
// (MQTT_BROKER_URL is a full connection URL, e.g. "mqtts://<host>:8883".)
//
// Every light shares this one broker login and gets its own topic instead of
// its own broker credential — most free-tier hosted brokers don't expose a
// per-credential management API, and per-device credentials can be layered
// in later (see the note in lightPairing.ts) without touching callers of
// this module, since they only deal in deviceId + topic.
export const mqttBrokerUrl = defineSecret("MQTT_BROKER_URL");
export const mqttUsername = defineSecret("MQTT_USERNAME");
export const mqttPassword = defineSecret("MQTT_PASSWORD");

export const MQTT_SECRETS = [mqttBrokerUrl, mqttUsername, mqttPassword];

let client: MqttClient | null = null;
let connecting: Promise<MqttClient> | null = null;

/** Reused across warm invocations of the same Cloud Functions instance. */
function getClient(): Promise<MqttClient> {
  if (client?.connected) return Promise.resolve(client);
  if (connecting) return connecting;

  connecting = new Promise((resolve, reject) => {
    const next = mqtt.connect(mqttBrokerUrl.value(), {
      username: mqttUsername.value(),
      password: mqttPassword.value(),
      reconnectPeriod: 2000,
      connectTimeout: 8000,
    });
    next.once("connect", () => {
      client = next;
      connecting = null;
      resolve(next);
    });
    next.once("error", (err) => {
      connecting = null;
      logger.error("mqttBroker: connection error", { err: String(err) });
      reject(err);
    });
  });
  return connecting;
}

/** The topic namespace this device's WLED is configured to use — assigned once at pairing time. */
export function lightTopic(deviceId: string): string {
  return `hardyhub/lights/${deviceId}`;
}

/**
 * Publishes a WLED JSON-API payload to a light's command topic. `transition`
 * is in units of 100ms (confirm WLED's current documented ceiling for this
 * firmware version during hardware bring-up before relying on long values) —
 * kept conservative here since it only needs to smooth over a ~1 minute tick.
 */
export async function publishLightState(
  deviceId: string,
  state: { on?: boolean; bri?: number; seg?: { col: number[][] }[] },
  transitionDs = 600,
): Promise<void> {
  const mqttClient = await getClient();
  const payload = JSON.stringify({ ...state, transition: transitionDs });
  await new Promise<void>((resolve, reject) => {
    mqttClient.publish(`${lightTopic(deviceId)}/api`, payload, { qos: 1 }, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * True once anything at all has arrived on this light's topic tree — used
 * only to confirm a freshly provisioned light has connected to the broker,
 * not to read its actual state. Resolves false if nothing arrives within
 * `timeoutMs` rather than hanging a pairing check indefinitely.
 */
export async function hasSeenActivity(deviceId: string, timeoutMs = 4000): Promise<boolean> {
  const mqttClient = await getClient();
  const topic = `${lightTopic(deviceId)}/#`;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (seen: boolean) => {
      if (settled) return;
      settled = true;
      mqttClient.removeListener("message", onMessage);
      mqttClient.unsubscribe(topic, () => {});
      resolve(seen);
    };
    const onMessage = (incomingTopic: string) => {
      if (incomingTopic.startsWith(lightTopic(deviceId))) finish(true);
    };
    mqttClient.on("message", onMessage);
    mqttClient.subscribe(topic, { qos: 0 }, (err) => {
      if (err) finish(false);
    });
    setTimeout(() => finish(false), timeoutMs);
  });
}
