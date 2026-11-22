/* ============================================================
   اتجاه القبلة — state.js
   DOM element references and the shared application state.
   Loaded before every other app script.
   ============================================================ */
"use strict";

  var dial = document.getElementById('dial');
  var qiblaArm = document.getElementById('qiblaArm');
  var hubHeading = document.getElementById('hubHeading');
  var hubDiff = document.getElementById('hubDiff');
  var kaabaDeg = document.getElementById('kaabaDeg');
  var statusTitle = document.getElementById('statusTitle');
  var statusDesc = document.getElementById('statusDesc');
  var statusIcon = document.getElementById('statusIcon');
  var liveDot = document.getElementById('liveDot');
  var liveText = document.getElementById('liveText');
  var turnText = document.getElementById('turnText');
  var turnArrow = document.getElementById('turnArrow');
  var enableBtn = document.getElementById('enableBtn');
  var btnText = document.getElementById('btnText');
  var btnLabelText = document.getElementById('btnLabelText');
  var locateBtn = document.getElementById('locateBtn');
  var placeText = document.getElementById('placeText');
  var toast = document.getElementById('toast');
  var dQibla = document.getElementById('dQibla');
  var dDist = document.getElementById('dDist');
  var dCoords = document.getElementById('dCoords');
  var dAcc = document.getElementById('dAcc');
  var dDecl = document.getElementById('dDecl');
  var dAlign = document.getElementById('dAlign');
  var dAlignSub = document.getElementById('dAlignSub');
  var modeCompassBtn = document.getElementById('modeCompassBtn');
  var modeStripBtn = document.getElementById('modeStripBtn');
  var viewCompass = document.getElementById('viewCompass');
  var viewStrip = document.getElementById('viewStrip');
  var strip = document.getElementById('strip');
  var stripArrows = document.getElementById('stripArrows');
  var stripDeg = document.getElementById('stripDeg');
  var stripGuide = document.getElementById('stripGuide');
  var stripSub = document.getElementById('stripSub');
  var stripQiblaDeg = document.getElementById('stripQiblaDeg');
  var calibWarn = document.getElementById('calibWarn');

  var state = {
    lat: null, lon: null,
    qibla: null, distance: null,
    declination: 0,         // WMM2025 magnetic declination D at the user's position (east +)
    targetHeading: null,   // raw sensor heading
    displayHeading: 0,      // smoothed
    hasSensor: false,
    sensorSeen: false,
    unsupported: false,      // no usable direction sensor on this device (e.g. desktop)
    activating: false,       // inside the 3 s activation-deadline window (pending, non-red)
    aligned: false,
    enabled: false,
    lastVibrate: 0,
    compassAccuracy: null,   // iOS webkitCompassAccuracy, degrees (negative = invalid)
    compassUnreliable: false,
    absGradeSeen: false,     // an absolute / compass-grade reading has arrived
    firstEventAt: 0,
    watchStarted: false
  };
