/* ============================================================
   اتجاه القبلة — geo.js
   Constants and spherical math: Qibla bearing, distance to
   the Kaaba, angle helpers and number formatting.
   ============================================================ */
"use strict";

  var KAABA = { lat: 21.422487, lon: 39.826206 };
  var ALIGN_TOL = 5; // degrees — a phone magnetometer cannot honestly promise tighter

  /* ---------- Math ---------- */
  function toRad(d){ return d * Math.PI / 180; }
  function toDeg(r){ return r * 180 / Math.PI; }
  function norm360(d){ return ((d % 360) + 360) % 360; }
  function angDiff(a, b){
    var d = Math.abs(norm360(a) - norm360(b)) % 360;
    return d > 180 ? 360 - d : d;
  }
  function calcQibla(lat, lon){
    var phi1 = toRad(lat), phi2 = toRad(KAABA.lat);
    var dLon = toRad(KAABA.lon - lon);
    var y = Math.sin(dLon);
    var x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(dLon);
    return norm360(toDeg(Math.atan2(y, x)));
  }
  function calcDistance(lat, lon){
    var R = 6371;
    var dLat = toRad(KAABA.lat - lat), dLon = toRad(KAABA.lon - lon);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat)) * Math.cos(toRad(KAABA.lat)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function fmt(n, dec){ return n.toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec}); }

  /* Shortest signed angular delta (moved from the render-loop
     section of the original file; a pure helper used by both
     the heading filter and the render loop). */
  function shortestDelta(from, to){
    var d = norm360(to) - norm360(from);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }
