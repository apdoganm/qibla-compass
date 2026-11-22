/* ============================================================
   اتجاه القبلة — orientation.js
   Device-orientation handling: tilt-compensated heading,
   absolute-stream preference, calibration accuracy state,
   and the no-direction-sensor (unsupported device) state.
   ============================================================ */
"use strict";

  /* ---------- Orientation ---------- */
  var absSeen = false, lastAbsAt = 0;
  function onOrientation(e, isAbs){
    var h = null;
    var compassGrade = false;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)){
      h = e.webkitCompassHeading; // iOS: degrees clockwise from magnetic north
      compassGrade = true;
      if (typeof e.webkitCompassAccuracy === 'number' && !isNaN(e.webkitCompassAccuracy)){
        state.compassAccuracy = e.webkitCompassAccuracy;
      }
    } else if (typeof e.alpha === 'number' && e.alpha !== null){
      // Tilt-aware azimuth of the device's top edge. Plain (360 - alpha)
      // is only right while the phone is flat: once it is tilted past
      // vertical the pointing direction flips, and the atan2 form below
      // follows the real direction — reducing exactly to (360 - alpha)
      // when the phone is level.
      var aR = toRad(e.alpha);
      var bR = toRad(typeof e.beta === 'number' && e.beta !== null ? e.beta : 0);
      h = norm360(toDeg(Math.atan2(-Math.sin(aR) * Math.cos(bR), Math.cos(aR) * Math.cos(bR))));
    }
    if (h === null || isNaN(h)) return;
    var now = (typeof e.timeStamp === 'number' && e.timeStamp > 0) ? e.timeStamp : performance.now();
    if (isAbs){ absSeen = true; lastAbsAt = now; }
    else if (absSeen && now - lastAbsAt < 500){
      // An absolute stream is live: ignore its relative twin event, whose
      // duplicate samples were a source of visible jitter.
      return;
    }
    if (isAbs || compassGrade) state.absGradeSeen = true;
    if (!state.firstEventAt) state.firstEventAt = now;
    if (state.unsupported || state.activating) clearUnsupported();
    state.sensorSeen = true;
    state.hasSensor = true;
    state.targetHeading = norm360(h);
    feedHeading(h, now);
    liveDot.classList.add('on');
    liveText.textContent = 'البوصلة تعمل الآن';
  }
  /* ---------- Unsupported state: no direction sensor ----------
     Desktops and sensor-less devices can locate the user (so the qibla
     angle, distance and coordinates below are all correct), but they
     have no magnetic compass, so no heading can ever arrive. Say that
     plainly instead of pretending the compass is live and waiting for
     movement. Entered when DeviceOrientationEvent does not exist at
     all, or when the activation deadline expires with no valid
     heading sample (the classic desktop-Chrome case: the listener
     registers but alpha stays null forever). A valid sample arriving
     later clears the state automatically via clearUnsupported().
     The iOS permission-denied message is a separate state and is
     never merged into this one.

     Activation deadline (user-specified): EVERY activation — the
     first tap and every retry — gets exactly ACTIVATION_DEADLINE_MS
     (3 s), armed by startOrientation(). While the window runs, the
     UI is in the pending state (enterActivating): locating copy in
     the NORMAL, non-red styling — red is reserved for the decided
     error. If a genuinely valid sample arrives in time,
     clearUnsupported() cancels the deadline and the compass is
     live. If the deadline expires first, enterUnsupported() flips
     the card to red + error message + enabled retry button as one
     atomic decision. There is no path that loads forever. When the
     sensor API does not exist at all the wait is skipped: the error
     is decided immediately. Idempotent: re-entering simply
     re-asserts the copy and button. */
  var ACTIVATION_DEADLINE_MS = 3000;
  /* The activation window is watched by a single rAF loop that owns
     ONLY the decision deadline — the button's loading feedback is a
     pure-CSS animated ellipsis (.btn.loading .dots in hero.css), so
     this clock draws nothing. Each frame compares performance.now() against the
     armed start: a genuinely valid sample cancels the clock via
     clearUnsupported() and the compass goes live immediately, and
     if the deadline expires first, enterUnsupported() flips the
     card to red + error message + enabled retry button as one
     atomic decision. There is no path that loads forever. */
  var activationClock = null; // { start, rafId }
  function endButtonLoading(){
    enableBtn.classList.remove('loading');
    enableBtn.removeAttribute('aria-busy');
  }
  function stopActivationClock(){
    if (activationClock){
      cancelAnimationFrame(activationClock.rafId);
      activationClock = null;
      endButtonLoading();
    }
    // No clock running → the button was never in the loading state;
    // touch nothing (a known-absent sensor shows the error instantly,
    // with no loading state at all).
  }
  function startActivationClock(){
    stopActivationClock();
    var clock = { start: performance.now(), rafId: 0 };
    activationClock = clock;
    enableBtn.classList.add('loading');
    enableBtn.setAttribute('aria-busy', 'true');
    var step = function(){
      if (activationClock !== clock) return; // cancelled or superseded
      if (performance.now() - clock.start >= ACTIVATION_DEADLINE_MS){
        // Deadline reached with no valid sample: red error +
        // enabled retry, atomically, in this frame.
        activationClock = null;
        endButtonLoading();
        state.activating = false;
        if (!state.sensorSeen) enterUnsupported();
        return;
      }
      clock.rafId = requestAnimationFrame(step);
    };
    clock.rafId = requestAnimationFrame(step);
  }
  function enterActivating(){
    // Pending window: normal styling, locating copy. On a retry this
    // deliberately replaces the red error visuals — the decision is
    // re-opened for at most ACTIVATION_DEADLINE_MS.
    state.activating = true;
    document.body.classList.remove('unsupported');
    liveDot.classList.remove('on');
    liveText.textContent = 'جارٍ تفعيل البوصلة…';
    statusTitle.textContent = 'جارٍ تحديد موقعك…';
    statusDesc.textContent = 'لحظات ونحسب زاوية القبلة من مكانك الحالي.';
    enableBtn.setAttribute('disabled', 'disabled');
    btnLabelText.textContent = 'جارٍ التفعيل';
  }
  function enterUnsupported(){
    if (state.sensorSeen) return;
    state.unsupported = true;
    state.activating = false;
    stopActivationClock();
    document.body.classList.add('unsupported');
    liveDot.classList.remove('on');
    liveText.textContent = 'تحديد الاتجاه غير مدعوم على هذا الجهاز';
    statusTitle.textContent = 'هذا الجهاز لا يدعم تحديد الاتجاه';
    statusDesc.textContent = 'لا يحتوي هذا الجهاز على مستشعر بوصلة مغناطيسي، فافتح الرابط من هاتفك.';
    // Honest button state: not stuck on a disabled «البوصلة مفعّلة» —
    // it offers a retry (e.g. after connecting/enabling a sensor).
    enableBtn.removeAttribute('disabled');
    btnLabelText.textContent = 'إعادة محاولة التفعيل';
  }
  function clearUnsupported(){
    // A genuinely valid sample: cancel the deadline (if armed) and
    // go live immediately — the compass that already works never
    // waits out the window.
    stopActivationClock();
    applyCompassLive();
  }
  function applyCompassLive(){
    state.unsupported = false;
    state.activating = false;
    document.body.classList.remove('unsupported');
    btnLabelText.textContent = 'البوصلة مفعّلة';
    enableBtn.setAttribute('disabled', 'disabled');
    if (state.qibla !== null){
      statusTitle.textContent = QiblaDevice.fill('تم تحديد موقعك — حرّك {device}');
      statusDesc.textContent = 'الآن لفّ جسمك ببطء حتى يصطف الخط مع الكعبة.';
    }
  }
  var orientationStarted = false;
  function startOrientation(){
    if (!orientationStarted){
      orientationStarted = true;
      window.addEventListener('deviceorientationabsolute', function(e){ onOrientation(e, true); }, true);
      window.addEventListener('deviceorientation', function(e){ onOrientation(e, e.absolute === true); }, true);
    }
    if (typeof DeviceOrientationEvent === 'undefined'){
      // Known-absent sensor API: skip the 3 s wait entirely — no
      // loading state for a failure that is already known.
      enterUnsupported();
      return;
    }
    startActivationClock();
  }
