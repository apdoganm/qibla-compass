# بوصلة القبلة — Qibla Compass

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
- Manual preview slider for devices without a compass sensor.
- Arabic-first, full RTL, IBM Plex Sans Arabic.

## Project structure

```
index.html                  Semantic markup only; links the CSS/JS below.
assets/
  css/
    main.css                Entry point — @imports the partials in the
                            original cascade order (responsive last).
    tokens.css              Design tokens (:root custom properties).
    base.css                Reset and base element styles.
    layout.css              Page wrap, top strip, live indicator.
    hero.css                Hero, status pill, buttons.
    compass.css             Compass dial, Kaaba marker, hub, mode switch.
    strip.css               Direction strip + manual preview.
    cards.css               Data cards grid.
    sections.css            Steps, note, footer, toast.
    responsive.css          Breakpoints, landscape, reduced motion.
  js/
    vendor/magvar.js        WMM2025 declination library (vendored verbatim
                            from magvar v2.2.0 / NOAA-NCEI WMM.COF — do not
                            edit its internals or coefficients).
    geo.js                  Kaaba constants, Qibla/distance spherical math,
                            angle helpers, number formatting.
    state.js                DOM references + shared application state.
    filter.js               One Euro heading filter.
    dial.js                 Builds the dial ticks/numbers/cardinals.
    ui.js                   Toast, mode switch, strip rendering.
    location.js             Geolocation: saved fix, watch, declination.
    orientation.js          Device-orientation handling.
    app.js                  Boot: activation controls, init preview,
                            render loop. Loaded last.
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
  `localhost`) in most browsers; opening via `file://` works for layout and
  the manual preview, but sensor/location behaviour depends on the browser's
  saved permission for the origin.
- The only external dependency is Google Fonts (IBM Plex Sans Arabic).
