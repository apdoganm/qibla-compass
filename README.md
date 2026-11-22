# اتجاه القبلة — Qibla Direction

A single-page web app that shows the exact Qibla direction from anywhere in
the world: a live compass (plus an alternative direction-strip view) driven by
the phone's orientation sensor and the user's geolocation, with the Qibla
bearing computed astronomically from the Kaaba's coordinates
(21.422487, 39.826206).

This is the multi-file refactor of the original single-file build. Behaviour,
design, copy and styling are unchanged — the code is only split into files.

## Features

- Live compass dial with a Kaaba marker at the true Qibla bearing, and a
  second display mode: a wide direction strip whose arrows thin out as you
  approach alignment.
- The hero fills the entire first viewport (top bar + hero), so the data
  cards below it appear only after scrolling. The dial is sized by a
  single width-and-height-aware expression (`--dial-size`: 88vw on
  phones; `min(64vw, 700px, calc(100svh - 242px))` from 600px up —
  the height term reserves the measured first-screen overhead, so
  the dial always fits entirely inside the first screen) and is a perfect
  circle at every size: when the viewport height constrains, the
  circle shrinks — it never squashes. On desktop the two hero columns
  share one vertical rhythm: the mode switch tops the compass column
  on the headline's line, the turn hint and the text column's small
  note share the bottom line, and the dial sits centred between them.
- Alignment state at ±5° (6.5° exit hysteresis): the UI turns green and the
  phone vibrates (`[70, 50, 70]`) on alignment.
- Heading pipeline: tilt-compensated azimuth, One Euro adaptive filter
  (jitter-free at rest, near-instant on real turns), absolute-orientation
  preference, and an accuracy gate (`webkitCompassAccuracy` / relative-only
  detection) that blocks the aligned state until the compass is trustworthy.
- Magnetic declination corrected with the real **WMM2025** model
  (NOAA/NCEI coefficients, vendored — no runtime dependency).
- Location is requested once: the last fix is kept in `localStorage`
  (`qibla:lastPosition`), shown instantly on later visits, and a single
  `watchPosition` keeps angle/distance/declination updated silently.
- The top strip names the visitor's current place (city + country, in
  Arabic) once a fix exists, reverse-geocoded via BigDataCloud's free
  keyless endpoint. Lookups are throttled to one per ≥1 km of movement,
  the resolved name is cached with the saved position, and any lookup
  failure falls back to showing the formatted coordinates instead.
- Devices without a direction sensor (desktops, sensor-less hardware)
  get an explicit unsupported state: if `DeviceOrientationEvent` does
  not exist, or no valid heading sample arrives within 4 s of
  activation (desktop browsers fire the event with `alpha` permanently
  null), the status card, top pill, dial hub and strip all state that
  the device does not support direction detection — no alignment, no
  vibration, and the activation button offers a retry instead of
  claiming the compass is on. The location-based data (Qibla angle,
  distance, coordinates, declination) still populates normally, and a
  real heading sample arriving later clears the state automatically.
  (iOS motion-permission denial keeps its own separate message.)
  Every activation — first tap and every retry — runs against a
  3-second deadline: while it runs, the status card shows the
  locating copy in the normal (non-red) styling and the activation
  button pulses (وميض — a sonar ring expanding from its edge and
  fading out while its black background breathes gently; a pure-CSS
  animation toggled by the same rAF clock that owns the deadline).
  The render loop memoises
  its idle frames, so nothing competes with that pulse.
  A valid sample inside the window cancels the deadline and the
  compass goes live immediately; if the deadline expires first, the
  card flips to the red error message with an enabled retry button
  in the same frame. With no sensor API the wait is skipped and the
  error is immediate (no pulse). Geolocation requests carry a matching 3 s
  timeout whose error path lands on decided copy, and while the
  error state is shown, location refreshes run silently so no
  «جارٍ تحديد موقعك…» text is ever layered under the red card.
  In this state the dial hub shows a single short red line
  («الاتجاه غير مدعوم») under a warning glyph, and the dial's scale
  is dimmed while the Qibla line and Kaaba marker stay full-strength.
- Device-type awareness: the site detects whether the visitor is on a
  phone, a tablet or a computer (classic UA parsing, with the iPadOS
  Macintosh-UA + multi-touch case read as a tablet and Windows touch
  laptops kept as computers; UA Client Hints refine the result
  asynchronously when available). Detection is silent — there is no
  visible device indicator — and every string that names
  the visitor's device adapts to it — «حرّك هاتفك» on a phone,
  «حرّك جهازك اللوحي» on a tablet, «حرّك كمبيوترك» on a computer —
  via the `{device}` / `{deviceBare}` tokens that `device.js` fills
  (`QiblaDevice.fill()` for JS-set strings, in-place at boot for
  static HTML copy). The one deliberate exception is the
  unsupported-sensor advice «افتح نفس الرابط من هاتفك»: it tells the
  visitor to switch TO a phone, so it stays phone-specific on every
  device.
- Arabic-first, full RTL, IBM Plex Sans Arabic.

## Project structure

```
index.html                  Semantic markup only; links the CSS/JS below.
assets/
  logo.svg                  Site logo: a minimal front-view Kaaba mark
                            (black cube, one gold band, small gold door)
                            — header, footer and favicon.
  css/
    main.css                Entry point — @imports the partials in the
                            original cascade order (responsive last).
    tokens.css              Design tokens (:root custom properties).
    base.css                Reset and base element styles.
    layout.css              Page wrap, top strip, live indicator.
    hero.css                Hero, status pill, buttons.
    compass.css             Compass dial, Kaaba marker, hub, mode switch.
    strip.css               Direction strip.
    cards.css               Data cards grid.
    sections.css            Steps, note, footer, toast.
    responsive.css          Breakpoints, landscape, reduced motion.
  js/
    vendor/magvar.js        WMM2025 declination library (vendored verbatim
                            from magvar v2.2.0 / NOAA-NCEI WMM.COF — do not
                            edit its internals or coefficients).
    geo.js                  Kaaba constants, Qibla/distance spherical math,
                            angle helpers, number formatting.
    device.js               Device-type awareness (phone / tablet /
                            computer), the top-bar device chip, and the
                            {device} / {deviceBare} wording tokens.
    state.js                DOM references + shared application state.
    filter.js               One Euro heading filter.
    dial.js                 Builds the dial ticks/numbers/cardinals.
    ui.js                   Toast, mode switch, strip rendering.
    location.js             Geolocation: saved fix, watch, declination,
                            reverse geocoding of the current place.
    orientation.js          Device-orientation handling.
    app.js                  Boot: activation controls, saved-position
                            restore, render loop. Loaded last.
```

Scripts are plain ordered `<script>` tags (no build step, no modules) and
share one global scope in load order — keep the order in `index.html`.

## Run it

Any static host works, including GitHub Pages. For a local check:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Notes:

- Geolocation and device-orientation permissions require HTTPS (or
  `localhost`) in most browsers; opening via `file://` works for layout,
  but sensor/location behaviour depends on the browser's saved permission
  for the origin.
- Privacy: the position itself is stored only on the device
  (`localStorage`). The one exception is the place-name lookup: on a new
  fix (and after moving ≥1 km) the coordinates are sent to BigDataCloud's
  reverse-geocoding endpoint solely to resolve the city/country name
  shown in the top strip — nothing else leaves the device.
- External services: Google Fonts (IBM Plex Sans Arabic) and the
  BigDataCloud reverse-geocode-client API (no key, no account).
