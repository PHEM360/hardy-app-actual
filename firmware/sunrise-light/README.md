# Sunrise light firmware (12V strip + MOSFET)

Custom firmware for an ESP32 driving a plain (non-addressable) 12V LED strip
through a single N-channel MOSFET, so it can be linked to the Hardy Hub app
as a sunrise light in place of stock WLED.

Two things this firmware does differently from stock WLED:

- **No WiFi or MQTT credentials are compiled in.** The app's existing "Add
  sunrise light" flow works unmodified: the board broadcasts its own setup
  network, the app's browser joins it and hands over your home WiFi + MQTT
  details, and the board saves them to flash and reboots. Flash the exact
  same binary onto any board — pairing happens entirely through the app,
  same as it would for a stock WLED light.
- **MQTT is encrypted.** Stock WLED has no TLS support for MQTT at all — its
  own project wiki says so directly ("secure connections are not currently
  supported... authentication is presently transmitted over an unencrypted
  connection"). This firmware connects to the broker over TLS with a
  verified certificate instead.

## What you need

- An ESP32 dev board (any common one — "ESP32 DevKitC" / "NodeMCU-32S" style
  boards are fine).
- A single-color 12V LED strip.
- An N-channel logic-level MOSFET (e.g. IRLZ44N, IRLB8721, or similar — must
  switch fully on with a 3.3V gate signal).
- A 12V power supply sized for your strip.
- A ~220-470Ω resistor (gate series resistor) and a ~10kΩ resistor (gate
  pulldown).
- A USB cable and a computer to flash the board.

## Wiring

```
12V supply (+) ─────────────────────────────► LED strip (+)
12V supply (-) ──────────┬──────────────────► LED strip (-)
                          │
                        MOSFET drain ◄─────────┘
                        MOSFET source ──────────► 12V supply (-) / ESP32 GND (common ground)
ESP32 GPIO4 ──[220-470Ω]──► MOSFET gate
MOSFET gate ──[10kΩ]──► MOSFET source (pulldown, keeps the strip off during boot)
```

The ESP32's GND must be tied to the 12V supply's ground (common ground) —
the MOSFET switches the strip's negative side, so the ESP32's low-side
signal and the strip's return path need to share a reference. Power the
ESP32 itself from USB or a separate 5V regulator, not directly from 12V.

GPIO4 is used by default (`LED_GPIO` in `src/main.cpp`) — it's a generally
safe, non-strapping pin on most ESP32 dev boards, but check your specific
board's pinout/silkscreen before wiring, and change the constant if you need
a different pin.

## 1. Install PlatformIO

Install the [PlatformIO IDE extension](https://platformio.org/install/ide?install=vscode)
for VS Code. This firmware is a standard PlatformIO project — open the
`firmware/sunrise-light` folder in VS Code and PlatformIO will pick it up
automatically (bottom status bar shows a PlatformIO icon once it's loaded).

## 2. Build and flash

With the board plugged in via USB:

```
pio run --target upload
```

That's it — nothing to edit first. There are no credentials in this project
to fill in.

## 3. Pair it from the app

1. Power on the freshly-flashed board. It broadcasts its own WiFi network
   named `WLED-AP` (password `wled1234`) — same as stock WLED would.
2. In the Hardy Hub app, go to **Sunrise lights** → **Add sunrise light**
   and follow the on-screen steps: join `WLED-AP` from this device, come
   back to the app, and enter your home WiFi name/password.
3. The app hands those details to the board over its setup network, the
   board saves them and reboots onto your home WiFi, and the app polls
   until it sees the light online — usually within a minute — then closes
   the dialog and shows it as linked to your account.

Nothing to type into a config file, and no per-board firmware edits — the
same flashed binary can be paired to any account through the app.

## Re-pairing a light

To move a light to different WiFi or a different account, hold the **BOOT**
button on the board while powering it on. That clears its saved WiFi/MQTT
config and drops it back into setup mode (broadcasting `WLED-AP` again), so
you can run "Add sunrise light" again from the app.

## Testing

From the app, toggle the light on/off and drag the brightness slider — both
should smoothly fade the strip (the crossfade duration comes from the
`transition` field the app sends). The colour picker and the sunrise "from /
to" colours won't visibly do anything on a single-color strip; the sunrise
ramp itself still works, driving brightness up from 0 as the alarm
approaches.

## How it matches the app's WLED setup flow

The app's pairing code (`src/lib/wledLocalApi.ts`) talks to a light over its
setup network using two of WLED's own local endpoints, and doesn't know or
care whether it's talking to real WLED or this firmware:

- `GET /json/info` — confirms the browser is actually joined to the light's
  network.
- `POST /json/cfg` — hands over `{ nw: { ins: [{ ssid, psk }] }, mqtt: {
  broker, port, user, psk, topics: { device } } }`.

This firmware implements both (see `handleJsonInfo`/`handleJsonCfgPost` in
`src/main.cpp`), saves what it's given to flash (`Preferences`/NVS), and
reboots into station mode — at which point it behaves like any other
sunrise light on the MQTT contract described in
`functions/src/mqttBroker.ts` and `functions/src/sunriseLights.ts`.

## Security notes

- MQTT connects over TLS (`WiFiClientSecure` with `setCACert`, never
  `setInsecure()`) — see `include/root_ca.h`, pre-filled with **ISRG Root
  X1** (Let's Encrypt's root certificate), which covers most free hosted
  MQTT brokers (HiveMQ Cloud, EMQX Cloud, etc.). If your broker uses a
  different CA, the serial log will show `MQTT: connect failed, rc=-2`
  repeatedly after WiFi connects successfully — run
  `openssl s_client -connect <your-broker-host>:8883 -showcerts` and swap
  in the root it chains to.
- WiFi and MQTT credentials are only ever transmitted locally, over the
  board's own temporary setup network, directly from your browser — never
  through a cloud service — and are stored in the board's flash (NVS), not
  compiled into the firmware binary.
- The `/json/cfg` and `/json/state` setup endpoints only exist while the
  board is in setup mode (unprovisioned, or BOOT-button reset); once it's
  running normally on your home WiFi there's no open HTTP config endpoint
  sitting on your network.
- The MQTT broker login is shared across every light on your account — this
  mirrors an existing tradeoff in the app's backend (see the comment at the
  top of `functions/src/lightPairing.ts`): most free hosted brokers don't
  offer a per-device credential API. It's not something firmware alone can
  fix; it would need a backend change to mint per-device broker credentials.
- Malformed or oversized incoming MQTT payloads are rejected before parsing
  (see the length checks in `onMqttMessage`) rather than trusted blindly.
