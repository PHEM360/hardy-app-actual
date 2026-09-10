// Talks directly to a WLED light while this browser is joined to its own
// temporary setup network — never over the internet. An unconfigured WLED
// device broadcasts an open-ish "WLED-AP" network (default password
// wled1234) and answers on 4.3.2.1 (also reachable as wled.me) until it's
// been given real WiFi credentials, per WLED's own setup docs.
//
// The /json/cfg field names below (nw.ins[].ssid/psk for WiFi,
// mqtt.{en,broker,port,user,psk,cid,topics.device} for MQTT) match WLED's
// generally-documented config shape, but WLED's exact schema does shift
// between versions — before relying on this against real hardware, GET
// http://4.3.2.1/json/cfg from a freshly-flashed device and diff it against
// what's sent here.

const WLED_AP_BASE = "http://4.3.2.1";
const REQUEST_TIMEOUT_MS = 6000;

async function wledFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${WLED_AP_BASE}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface WledInfo {
  mac: string;
  name: string;
  version: string;
}

/** Confirms a browser is actually joined to a WLED device's setup network. */
export async function getWledInfo(): Promise<WledInfo> {
  const response = await wledFetch("/json/info");
  if (!response.ok) throw new Error("Could not reach the light. Make sure you're still connected to its WiFi network.");
  const data = await response.json();
  return { mac: String(data.mac || ""), name: String(data.name || "WLED"), version: String(data.ver || "") };
}

export interface WledProvisionConfig {
  homeSsid: string;
  homePassword: string;
  mqttBrokerUrl: string; // e.g. "mqtts://host:8883" — host/port are split out below for WLED's own fields
  mqttUsername: string;
  mqttPassword: string;
  mqttTopic: string;
  deviceId: string;
}

function splitBrokerUrl(url: string): { host: string; port: number; secure: boolean } {
  try {
    const parsed = new URL(url);
    const secure = parsed.protocol.startsWith("mqtts") || parsed.protocol.startsWith("wss");
    return { host: parsed.hostname, port: Number(parsed.port) || (secure ? 8883 : 1883), secure };
  } catch {
    return { host: url, port: 8883, secure: true };
  }
}

/** Hands the light its permanent home-WiFi and MQTT connection details, then asks it to reboot onto them. */
export async function provisionWledDevice(config: WledProvisionConfig): Promise<void> {
  const broker = splitBrokerUrl(config.mqttBrokerUrl);
  const response = await wledFetch("/json/cfg", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nw: { ins: [{ ssid: config.homeSsid, psk: config.homePassword }] },
      mqtt: {
        en: true,
        broker: broker.host,
        port: broker.port,
        user: config.mqttUsername,
        psk: config.mqttPassword,
        cid: `hardyhub-${config.deviceId}`,
        topics: { device: config.mqttTopic, group: "" },
      },
    }),
  });
  if (!response.ok) throw new Error("The light rejected its setup details. Try again.");

  // WLED applies network config changes on its next boot.
  await wledFetch("/json/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rb: true }),
  }).catch(() => {
    // The device may drop its AP the instant it reboots, before it can
    // answer this request — that's success, not failure, so swallow it.
  });
}
