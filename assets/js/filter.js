/* ============================================================
   اتجاه القبلة — filter.js
   One Euro adaptive heading filter.
   ============================================================ */
"use strict";

  /* ---------- Heading filter: One Euro ----------
     Raw magnetometer output jumps around at rest (the deviations the user
     saw), while a plain smoothing factor makes the dial lag behind real
     turns. This adaptive filter keeps its cutoff low while the phone is
     still — jitter filtered out — and raises it with turning speed, so a
     real turn is tracked almost instantly: very sensitive, without noise. */
  var filt = { x: null, dx: 0, lastT: 0, lastRaw: null };
  var F_MIN_CUTOFF = 1.2, F_BETA = 0.05, F_D_CUTOFF = 1.0;
  function oeAlpha(cutoff, dt){
    var tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  function feedHeading(raw, tMs){
    raw = norm360(raw);
    if (filt.x === null){
      filt.x = raw; filt.dx = 0; filt.lastRaw = raw; filt.lastT = tMs;
      state.displayHeading = raw;
      return;
    }
    var dt = (tMs - filt.lastT) / 1000;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.5) dt = 0.5;
    filt.lastT = tMs;
    var instDx = shortestDelta(filt.lastRaw, raw) / dt;
    filt.lastRaw = raw;
    var aD = oeAlpha(F_D_CUTOFF, dt);
    filt.dx += aD * (instDx - filt.dx);
    var cutoff = F_MIN_CUTOFF + F_BETA * Math.abs(filt.dx);
    var a = oeAlpha(cutoff, dt);
    filt.x = norm360(filt.x + a * shortestDelta(filt.x, raw));
    state.displayHeading = filt.x;
  }
