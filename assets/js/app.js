/* ============================================================
   اتجاه القبلة — app.js
   Boot: activation controls, saved-position restore and
   the render loop. Loaded last.
   ============================================================ */
"use strict";

  enableBtn.addEventListener('click', function(){
    // One activation contract for the first tap AND every retry (see
    // orientation.js): a 3-second deadline, a pending window in the
    // normal non-red styling, and an atomic flip to the red error
    // state if no real heading sample arrives in time. When the
    // sensor API is known-absent the wait is skipped entirely.
    //
    // ORDER IS THE CONTRACT: the pending state is entered FIRST and
    // synchronously — pill + locating copy, the button's .loading
    // dots, disabled + aria-busy, and the 3 s deadline clock all
    // start in this same task, BEFORE anything that can hang is
    // started. Geolocation then runs in parallel (its own 3 s
    // timeout, never gating the button), and the motion-permission
    // request — where the browser exposes one — is raced against
    // 1.2 s inside requestMotionPermission(): a permission promise
    // that never settles can never block the deadline again.
    state.enabled = true;
    if (typeof DeviceOrientationEvent === 'undefined'){
      startOrientation();   // → enterUnsupported() synchronously
      requestLocation();    // silent branch: the decision is already made
      return;
    }
    var restoreLabel = btnLabelText.textContent; // for an explicit permission denial
    enterActivating();
    startActivationClock();   // the 3 s deadline starts NOW — before any await
    // requestLocation runs while state.unsupported may still be set
    // (retry): its silent branch then avoids overwriting the pending
    // copy, while its fix still refreshes the data cards.
    requestLocation();
    if (typeof DeviceOrientationEvent.requestPermission === 'function'){
      requestMotionPermission(restoreLabel);
    } else {
      attachOrientationListeners();
    }
  });
  locateBtn.addEventListener('click', requestLocation);

  // Before activation: show the last saved fix instantly when one exists on
  // this device (labelled as saved), otherwise an honest Cairo fallback.
  // No heading is shown until a real sensor provides one.
  (function initPosition(){
    var saved = loadSavedPosition();
    if (saved){
      applyPosition(saved.lat, saved.lon, saved.acc || 50);
      dAcc.textContent = 'آخر موقع محفوظ على هذا الجهاز — سيُحدّث تلقائياً عند توفر موقع جديد';
    } else {
      applyPosition(30.0444, 31.2357, 0, true);
      dAcc.textContent = 'موقع افتراضي (القاهرة) — فعّل موقعك للدقة';
    }
    state.targetHeading = null;
    state.displayHeading = 0;
    // If the browser already holds location permission for this published
    // site, resume the silent watch right away — no new prompt, no tap.
    // (On a local file:// page the browser may not keep this permission;
    // then the saved position above is what gets shown until activation.)
    if ('permissions' in navigator && navigator.permissions && navigator.permissions.query){
      try {
        navigator.permissions.query({ name: 'geolocation' }).then(function(st){
          if (st.state === 'granted') startWatch();
          st.onchange = function(){
            if (st.state === 'granted') startWatch();
            else if (st.state === 'denied') onPositionError({ code: 1 });
          };
        }).catch(function(){});
      } catch(e){ /* a few browsers throw synchronously for this query — the watch then simply starts on activation */ }
    }
  })();

  /* ---------- Render loop ---------- */
  function vibrateSuccess(){
    var now = Date.now();
    if (now - state.lastVibrate < 1200) return;
    state.lastVibrate = now;
    if (navigator.vibrate){ try { navigator.vibrate([70, 50, 70]); } catch(e){} }
  }
  /* Lucide icon strings swapped in by the render loop — same official
     geometry as the static markup icons, stroke:currentColor so the
     state colours (red hub warning, white-on-green status check…)
     come from the component's CSS color. */
  var LUCIDE_ATTRS = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var ICON_WARN = '<svg width="34" height="34" viewBox="0 0 24 24" ' + LUCIDE_ATTRS + '><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
  var ICON_STATUS_CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" ' + LUCIDE_ATTRS + '><path d="M20 6 9 17l-5-5"/></svg>';
  var ICON_STATUS_COMPASS = '<svg width="20" height="20" viewBox="0 0 24 24" ' + LUCIDE_ATTRS + '><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
  var ICON_TURN_R = '<svg width="18" height="18" viewBox="0 0 24 24" ' + LUCIDE_ATTRS + '><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
  var ICON_TURN_L = '<svg width="18" height="18" viewBox="0 0 24 24" ' + LUCIDE_ATTRS + '><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>';
  var ICON_TURN_OK = '<svg width="18" height="18" viewBox="0 0 24 24" ' + LUCIDE_ATTRS + '><path d="M20 6 9 17l-5-5"/></svg>';
  var ICON_TURN_INF = '<svg width="18" height="18" viewBox="0 0 24 24" ' + LUCIDE_ATTRS + '><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z"/></svg>';

  /* Render-loop memo: with no heading (every desktop, and any phone
     before activation) the frame's DOM output depends only on the
     idle mode — pending vs unsupported — so identical frames skip
     ALL writes. Previously tick() rewrote the dial transform, hub
     texts and the whole strip 60×/s forever, and that constant
     main-thread churn competed with the activation button's fill
     animation during the 3 s window. The dial transform and the
     calibration pill are likewise written only when they change. */
  var lastCalibShown = null, lastDialH = null, lastIdleKey = null;
  function tick(){
    // A heading counts as real only when it comes from the device sensor
    // — never before activation.
    var hasHeading = state.targetHeading !== null && state.sensorSeen;
    // Compass trust: iOS reports its own accuracy in degrees (negative =
    // invalid); elsewhere, a stream that only ever delivers relative
    // readings is not compass-grade either. While untrusted we still show
    // the heading, but we refuse to declare alignment or vibrate.
    var accBad = typeof state.compassAccuracy === 'number' &&
                 (state.compassAccuracy < 0 || state.compassAccuracy > 25);
    var relOnly = state.sensorSeen && !state.absGradeSeen &&
                  state.firstEventAt > 0 && (performance.now() - state.firstEventAt > 3000);
    state.compassUnreliable = !!(accBad || relOnly);
    var calibShow = hasHeading && state.compassUnreliable;
    if (calibShow !== lastCalibShown){
      calibWarn.classList.toggle('show', calibShow);
      lastCalibShown = calibShow;
    }
    // displayHeading is the filtered MAGNETIC heading, driven directly by
    // the One Euro filter on every sensor event — no extra smoothing lag
    // is added here, so the dial tracks the hand almost 1:1 while resting
    // jitter stays filtered out. The WMM2025 correction is applied on top:
    // true heading = magnetic heading + declination D (east positive),
    // and only this true heading is compared with the qibla bearing
    // (which is measured from true north) or used to rotate the dial.
    var h = norm360(state.displayHeading + state.declination);
    var hKey = h.toFixed(2);
    if (hKey !== lastDialH){
      dial.style.transform = 'rotate(' + (-h) + 'deg)';
      lastDialH = hKey;
    }
    if (!hasHeading){
      var idleKey = (state.unsupported && !state.activating) ? 'unsupported' : 'idle';
      if (idleKey !== lastIdleKey){
        lastIdleKey = idleKey;
        if (idleKey === 'unsupported'){
          // Unsupported hub: one warning glyph + ONE short red line.
          // No «—°» reading, no device label — nothing can cramp or
          // overflow the hub in this state (see compass.css).
          hubHeading.innerHTML = ICON_WARN;
          hubHeading.className = 'big warn';
          hubDiff.textContent = 'الاتجاه غير مدعوم';
        } else {
          hubHeading.textContent = '—°';
          hubHeading.className = 'big';
          hubDiff.textContent = 'بانتظار التفعيل';
        }
        hubDiff.className = 'diff';
        dAlign.textContent = '—';
        dAlignSub.textContent = 'الاصطفاف الدقيق ضمن ±٥°';
        updateStrip(false, 0, 0, false, false);
      }
      requestAnimationFrame(tick);
      return;
    }
    lastIdleKey = null;
    hubHeading.textContent = fmt(h, 0) + '°';
    hubHeading.className = 'big';

    if (state.qibla !== null){
      var diff = angDiff(h, state.qibla);
      var signed = shortestDelta(h, state.qibla); // + = turn right (clockwise)
      // Hysteresis: once aligned, stay aligned until the drift passes
      // 6.5°, so sensor noise at the edge no longer flickers the state.
      // An untrusted compass can never enter (or hold) the aligned state.
      var isAligned = !state.compassUnreliable &&
                      (state.aligned ? diff <= ALIGN_TOL + 1.5 : diff <= ALIGN_TOL);
      updateStrip(true, diff, signed, isAligned, state.compassUnreliable);

      if (isAligned && !state.aligned){
        state.aligned = true;
        document.body.classList.add('aligned');
        vibrateSuccess();
        showToast('ما شاء الله — أنت الآن في اتجاه القبلة تماماً', true);
        statusTitle.textContent = 'أنت على القبلة تماماً';
        statusDesc.textContent = 'حافظ على هذا الاتجاه — المؤشر الأخضر والاهتزاز يؤكدان الاصطفاف الدقيق.';
        statusIcon.innerHTML = ICON_STATUS_CHECK;
      } else if (!isAligned && state.aligned){
        state.aligned = false;
        document.body.classList.remove('aligned');
        statusTitle.textContent = QiblaDevice.fill('تم تحديد موقعك — حرّك {device}');
        statusDesc.textContent = 'الآن لفّ جسمك ببطء حتى يصطف الخط مع الكعبة.';
        statusIcon.innerHTML = ICON_STATUS_COMPASS;
      }

      if (state.aligned){
        hubDiff.textContent = 'على القبلة';
        hubDiff.className = 'diff ok';
        dAlign.textContent = 'مصطف تماماً';
        dAlignSub.textContent = 'الفرق ' + fmt(diff, 0) + '° فقط — صلِّ مطمئناً';
        turnText.textContent = QiblaDevice.fill('ثبّت {device} — هذا هو اتجاه القبلة');
        turnArrow.innerHTML = ICON_TURN_OK;
        turnArrow.style.transform = 'none';
      } else {
        hubDiff.textContent = 'الفرق ' + fmt(diff, 0) + '°';
        hubDiff.className = 'diff';
        dAlign.textContent = fmt(diff, 0) + '°';
        dAlignSub.textContent = signed > 0 ? QiblaDevice.fill('أدر {device} يميناً لتقليل الفرق') : QiblaDevice.fill('أدر {device} يساراً لتقليل الفرق');
        if (state.enabled){
          turnText.textContent = signed > 0
            ? QiblaDevice.fill('أدر {device} يميناً بمقدار ') + fmt(Math.abs(signed), 0) + '°'
            : QiblaDevice.fill('أدر {device} يساراً بمقدار ') + fmt(Math.abs(signed), 0) + '°';
          turnArrow.innerHTML = signed > 0 ? ICON_TURN_R : ICON_TURN_L;
          turnArrow.style.transform = 'none';
        }
      }
      if (!state.aligned && state.compassUnreliable && diff <= ALIGN_TOL){
        hubDiff.textContent = 'قريب جداً — المعايرة مطلوبة';
        turnText.textContent = QiblaDevice.fill('حرّك {device} على شكل الرقم 8 لمعايرة البوصلة، ثم أعد المحاولة');
        turnArrow.innerHTML = ICON_TURN_INF;
        turnArrow.style.transform = 'none';
      }
      // keep vibrating gently while staying aligned (throttled inside)
      if (state.aligned) vibrateSuccess();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
