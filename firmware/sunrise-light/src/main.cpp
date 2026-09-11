// Hardy Hub sunrise light firmware — for a plain 12V (non-addressable) LED
// strip driven through a single N-channel MOSFET, instead of an addressable
// WS2812B strip running stock WLED.
//
// No WiFi/MQTT credentials are compiled in. This firmware implements the
// same local setup API stock WLED exposes — see src/lib/wledLocalApi.ts in
// the main repo — so the app's existing "Add sunrise light" flow works
// completely unmodified:
//   1. First boot (nothing saved yet): broadcasts its own "WLED-AP" WiFi
//      network at 192.168.4.1 and serves GET /json/info + POST /json/cfg
//      there (192.168.4.1, not WLED's usual 4.3.2.1 — see the comment on
//      the WiFi.softAPConfig() call below for why).
//   2. The app's browser joins that network and POSTs home WiFi + MQTT
//      details to /json/cfg (see provisionWledDevice() in wledLocalApi.ts).
//   3. Those details are saved to flash (Preferences/NVS) and the board
//      reboots onto home WiFi.
//   4. From then on it connects straight to MQTT — over TLS, unlike stock
//      WLED, which has no TLS support for MQTT at all (see its own wiki's
//      Security page) — subscribes to hardyhub/lights/<id>/api, and drives
//      the MOSFET's PWM channel from the same WLED-JSON payloads the
//      backend already publishes (functions/src/mqttBroker.ts).
//
// To re-pair a light that's already configured (new home WiFi, moved to a
// different account, etc.), hold the BOOT button (GPIO0) while powering it
// on — that erases the saved config and drops back into setup mode.

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "root_ca.h"

// MOSFET gate pin. Series ~220-470R resistor from this pin to the gate, and
// a ~10k pulldown from gate to source, are recommended so the strip stays
// off (rather than flickering) while the board is booting.
static const int LED_GPIO = 27;
static const int PWM_CHANNEL = 0;
static const int PWM_FREQ_HZ = 19531; // matches WLED's own ESP32 PWM dimming frequency
static const int PWM_RESOLUTION_BITS = 8;
static const int BOOT_BUTTON_GPIO = 0; // active low on virtually every ESP32 devkit

static const uint32_t WIFI_CONNECT_TIMEOUT_MS = 20000; // fall back to setup mode rather than hang forever on a bad saved password
static const uint32_t MQTT_RETRY_DELAY_MS = 3000;

Preferences prefs;
WebServer setupServer(80);
WiFiClientSecure secureClient;
PubSubClient mqtt(secureClient);

bool setupMode = false;
uint32_t pendingRebootAtMs = 0; // 0 = no reboot scheduled

String savedWifiSsid, savedWifiPass, savedMqttHost, savedMqttUser, savedMqttPass, savedMqttTopic;
uint16_t savedMqttPort = 8883;

String topicApi, topicStatus;

// ---- Persistence ----

void loadConfig() {
  prefs.begin("hardyhub", /*readOnly=*/true);
  // Gated on a single flag, set only at the end of a successful saveConfig,
  // so a fresh/cleared board (the common case) skips straight past without
  // six separate NVS "NOT_FOUND" log lines for each never-written key.
  if (prefs.getBool("provisioned", false)) {
    savedWifiSsid = prefs.getString("wifiSsid", "");
    savedWifiPass = prefs.getString("wifiPass", "");
    savedMqttHost = prefs.getString("mqttHost", "");
    savedMqttPort = prefs.getUShort("mqttPort", 8883);
    savedMqttUser = prefs.getString("mqttUser", "");
    savedMqttPass = prefs.getString("mqttPass", "");
    savedMqttTopic = prefs.getString("mqttTopic", "");
  }
  prefs.end();
}

void saveConfig(const String& ssid, const String& pass, const String& host, uint16_t port,
                 const String& user, const String& mqttPass_, const String& topic) {
  prefs.begin("hardyhub", /*readOnly=*/false);
  prefs.putString("wifiSsid", ssid);
  prefs.putString("wifiPass", pass);
  prefs.putString("mqttHost", host);
  prefs.putUShort("mqttPort", port);
  prefs.putString("mqttUser", user);
  prefs.putString("mqttPass", mqttPass_);
  prefs.putString("mqttTopic", topic);
  prefs.putBool("provisioned", true);
  prefs.end();
}

void clearConfig() {
  prefs.begin("hardyhub", /*readOnly=*/false);
  prefs.clear();
  prefs.end();
}

bool isProvisioned() {
  return savedWifiSsid.length() > 0 && savedMqttHost.length() > 0 && savedMqttTopic.length() > 0;
}

// ---- Setup mode: local API matching stock WLED's, see wledLocalApi.ts ----

// The app is served over HTTPS (Firebase Hosting); the browser treats these
// requests to a bare local IP as cross-origin (needs CORS) *and*, separately,
// as a "private network request" from a secure context — recent Chrome
// gates that on its own permission prompt, older versions/trials gate it on
// the Access-Control-Allow-Private-Network response header below. Both cost
// nothing to include. This does not exempt the request from mixed-content
// blocking on browsers with neither mechanism (e.g. Safari) — see
// firmware/sunrise-light/README.md for what to do there.
void sendCorsHeaders() {
  setupServer.sendHeader("Access-Control-Allow-Origin", "*");
  setupServer.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  setupServer.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  setupServer.sendHeader("Access-Control-Allow-Private-Network", "true");
}

void handleOptionsPreflight() {
  sendCorsHeaders();
  setupServer.send(204);
}

void handleJsonInfo() {
  sendCorsHeaders();
  StaticJsonDocument<256> doc;
  doc["mac"] = WiFi.macAddress();
  doc["name"] = "Hardy Hub Sunrise Light";
  doc["ver"] = "1.0.0";
  String body;
  serializeJson(doc, body);
  setupServer.send(200, "application/json", body);
}

// Mirrors provisionWledDevice()'s POST body shape:
// { nw: { ins: [{ ssid, psk }] }, mqtt: { broker, port, user, psk, topics: { device } } }
void handleJsonCfgPost() {
  sendCorsHeaders();
  StaticJsonDocument<1024> doc;
  if (deserializeJson(doc, setupServer.arg("plain")) != DeserializationError::Ok) {
    setupServer.send(400, "application/json", "{\"success\":false}");
    return;
  }

  String ssid = doc["nw"]["ins"][0]["ssid"] | "";
  String pass = doc["nw"]["ins"][0]["psk"] | "";
  String host = doc["mqtt"]["broker"] | "";
  uint16_t port = doc["mqtt"]["port"] | 8883;
  String user = doc["mqtt"]["user"] | "";
  String mqttPass_ = doc["mqtt"]["psk"] | "";
  String topic = doc["mqtt"]["topics"]["device"] | "";

  if (ssid.isEmpty() || host.isEmpty() || topic.isEmpty()) {
    setupServer.send(400, "application/json", "{\"success\":false}");
    return;
  }

  saveConfig(ssid, pass, host, port, user, mqttPass_, topic);
  setupServer.send(200, "application/json", "{\"success\":true}");

  // The app follows this with POST /json/state {"rb":true} to ask for an
  // immediate reboot (see handleJsonStatePost) — this timer is just a
  // fallback in case that second request never lands (e.g. the AP drops
  // before it arrives, which wledLocalApi.ts already treats as success).
  pendingRebootAtMs = millis() + 4000;
}

void handleJsonStatePost() {
  sendCorsHeaders();
  StaticJsonDocument<128> doc;
  deserializeJson(doc, setupServer.arg("plain"));
  setupServer.send(200, "application/json", "{\"success\":true}");
  if (doc["rb"] | false) {
    pendingRebootAtMs = millis() + 300; // let the response above actually flush first
  }
}

void startSetupMode() {
  setupMode = true;
  WiFi.mode(WIFI_AP);
  // 192.168.4.1, not WLED's usual 4.3.2.1: it's a real private-range
  // address, so the app's HTTPS-served browser page can actually be granted
  // access to it (Chrome's mixed-content "local network" exemption only
  // covers real private/loopback ranges) — see the comment in
  // src/lib/wledLocalApi.ts in the main repo for the full explanation.
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  WiFi.softAP("WLED-AP", "wled1234");

  setupServer.on("/json/info", HTTP_GET, handleJsonInfo);
  setupServer.on("/json/info", HTTP_OPTIONS, handleOptionsPreflight);
  setupServer.on("/json/cfg", HTTP_POST, handleJsonCfgPost);
  setupServer.on("/json/cfg", HTTP_OPTIONS, handleOptionsPreflight);
  setupServer.on("/json/state", HTTP_POST, handleJsonStatePost);
  setupServer.on("/json/state", HTTP_OPTIONS, handleOptionsPreflight);
  setupServer.begin();

  Serial.println("Setup mode: broadcasting WLED-AP at 192.168.4.1 — pair this light from the app.");
}

// ---- Station mode: normal operation ----

uint8_t currentDuty = 0;
uint8_t targetDuty = 0;
uint8_t fadeStartDuty = 0;
uint32_t fadeStartMs = 0;
uint32_t fadeDurationMs = 0;

void applyDuty(uint8_t duty) {
  ledcWrite(PWM_CHANNEL, duty);
}

void startFade(uint8_t target, uint32_t durationMs) {
  fadeStartDuty = currentDuty;
  targetDuty = target;
  fadeDurationMs = durationMs;
  fadeStartMs = millis();
}

void serviceFade() {
  if (currentDuty == targetDuty) return;
  uint32_t elapsed = millis() - fadeStartMs;
  if (fadeDurationMs == 0 || elapsed >= fadeDurationMs) {
    currentDuty = targetDuty;
  } else {
    float t = (float)elapsed / (float)fadeDurationMs;
    currentDuty = fadeStartDuty + (int32_t)((int32_t)(targetDuty - fadeStartDuty) * t);
  }
  applyDuty(currentDuty);
}

// Matches the payload shape publishLightState() sends in
// functions/src/mqttBroker.ts: {"on":bool,"bri":0-255,"seg":[...],"transition":deciseconds}.
// Colour ("seg") is accepted but ignored — a single PWM channel can only be
// dimmed, not coloured.
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  if (length == 0 || length > 512) return; // guard against empty/oversized/garbage payloads

  StaticJsonDocument<512> doc;
  if (deserializeJson(doc, payload, length) != DeserializationError::Ok) return;

  bool on = doc["on"] | (targetDuty > 0);
  int bri = doc["bri"] | (int)targetDuty;
  bri = constrain(bri, 0, 255);
  int transitionDs = doc["transition"] | 6; // deciseconds (100ms units), same unit the cloud function uses

  uint8_t nextTarget = on ? (uint8_t)bri : 0;
  startFade(nextTarget, (uint32_t)transitionDs * 100);
}

void publishStatus(bool online) {
  mqtt.publish(topicStatus.c_str(), online ? "online" : "offline", true);
}

bool connectWifiStation() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(savedWifiSsid.c_str(), savedWifiPass.c_str());
  Serial.print("WiFi: connecting");
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > WIFI_CONNECT_TIMEOUT_MS) {
      Serial.println(" timed out");
      return false;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.printf(" connected, IP %s\n", WiFi.localIP().toString().c_str());
  return true;
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.println("MQTT: connecting...");
    String clientId = "hardyhub-" + WiFi.macAddress();
    // Last-will marks the light offline the instant the connection drops,
    // rather than leaving a stale "online" retained message behind.
    bool ok = mqtt.connect(
        clientId.c_str(), savedMqttUser.c_str(), savedMqttPass.c_str(),
        topicStatus.c_str(), /*willQos=*/1, /*willRetain=*/true, "offline");
    if (ok) {
      Serial.println("MQTT: connected");
      mqtt.subscribe(topicApi.c_str(), /*qos=*/1);
      publishStatus(true);
    } else {
      Serial.printf("MQTT: connect failed, rc=%d, retrying in %lus\n", mqtt.state(), MQTT_RETRY_DELAY_MS / 1000);
      delay(MQTT_RETRY_DELAY_MS);
    }
  }
}

void startStationMode() {
  topicApi = savedMqttTopic + "/api";
  topicStatus = savedMqttTopic + "/status";

  if (!connectWifiStation()) {
    // Bad or out-of-range saved WiFi — drop back to setup mode so this
    // light can be re-paired from the app instead of getting stuck here.
    startSetupMode();
    return;
  }

  secureClient.setCACert(MQTT_ROOT_CA);
  mqtt.setServer(savedMqttHost.c_str(), savedMqttPort);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(1024);
  connectMqtt();
}

void setup() {
  Serial.begin(115200);

  ledcSetup(PWM_CHANNEL, PWM_FREQ_HZ, PWM_RESOLUTION_BITS);
  ledcAttachPin(LED_GPIO, PWM_CHANNEL);
  applyDuty(0);

  pinMode(BOOT_BUTTON_GPIO, INPUT_PULLUP);
  if (digitalRead(BOOT_BUTTON_GPIO) == LOW) {
    Serial.println("BOOT held at power-on — clearing saved config.");
    clearConfig();
  }

  loadConfig();

  if (isProvisioned()) {
    startStationMode();
  } else {
    startSetupMode();
  }
}

void loop() {
  if (setupMode) {
    setupServer.handleClient();
    if (pendingRebootAtMs != 0 && millis() >= pendingRebootAtMs) {
      Serial.println("Rebooting into station mode...");
      ESP.restart();
    }
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    if (!connectWifiStation()) {
      startSetupMode();
      return;
    }
  }
  connectMqtt();
  mqtt.loop();
  serviceFade();
}
