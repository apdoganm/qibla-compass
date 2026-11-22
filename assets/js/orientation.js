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
  var FILL_FAST_MS = 250;
  /* One clock, two consumers: a single rAF loop drives BOTH the
     activation button's loading fill (0 → 1 across exactly
     ACTIVATION_DEADLINE_MS) and the decision deadline itself,
     timestamped from the same performance.now() readings — the
     fill and the decision can never drift apart. The DEADLINE is
     computed from the raw linear progress; only the VISUAL fill
     fraction is eased (easeVisual below), so the sweep glides
     while the decision still lands at exactly the deadline. The
     fill is rendered as transform: scaleX() on a solid bar
     (origin at the right edge): composited by the GPU, so the
     sweep stays butter-smooth — animating width instead forced
     layout + paint every frame and visibly stuttered. */
  function easeVisual(p){
    // easeInOutCubic for the fill only: a slow, elegant start, a
    // fluid middle and a gentle settle into 1 at the deadline.
    // Maps 0→0, 0.5→0.5 and 1→1 monotonically.
    return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }
  var activationClock = null; // { start, rafId, progress, fastFrom, fastStart }
  var reducedMotion = (typeof window.matchMedia === 'function') &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setBtnFill(p){
    btnFill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }
  function endButtonLoading(){
    enableBtn.classList.remove('loading');
    enableBtn.removeAttribute('aria-busy');
    setBtnFill(0);
  }
  function stopActivationClock(){
    if (activationClock){
      cancelAnimationFrame(activationClock.rafId);
      activationClock = null;
      endButtonLoading();
    }
    // No clock running → the button was never in the loading state;
    // touch nothing (a known-absent sensor must see zero fill writes).
  }
  function startActivationClock(){
    stopActivationClock();
    var clock = { start: performance.now(), rafId: 0, progress: 0, fastFrom: -1, fastStart: 0 };
    activationClock = clock;
    enableBtn.classList.add('loading');
    enableBtn.setAttribute('aria-busy', 'true');
    setBtnFill(0);
    var step = function(){
      if (activationClock !== clock) return; // cancelled or superseded
      var now = performance.now();
      var p;
      if (clock.fastFrom >= 0){
        // Early success: sweep the remaining fill home in ~250 ms,
        // then show the live state — nobody waits the full 3 s for a
        // compass that already works. The fast sweep eases into 1
        // with the same curve as the main fill.
        var fp = Math.min(1, (now - clock.fastStart) / FILL_FAST_MS);
        p = clock.fastFrom + (1 - clock.fastFrom) * easeVisual(fp);
        clock.progress = p;
        setBtnFill(p);
        if (fp >= 1){
          activationClock = null;
          endButtonLoading();
          applyCompassLive();
          return;
        }
      } else {
        var raw = Math.min(1, (now - clock.start) / ACTIVATION_DEADLINE_MS);
        p = easeVisual(raw); // visual fraction only — deadline below uses raw
        if (reducedMotion) p = Math.ceil(p * 10) / 10; // coarse steps only
        clock.progress = p;
        setBtnFill(p);
        if (raw >= 1){
          // Deadline: the decision lands in the same frame the fill
          // completes — red error + enabled retry, atomically.
          activationClock = null;
          endButtonLoading();
          state.activating = false;
          if (!state.sensorSeen) enterUnsupported();
          return;
        }
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
    btnText.textContent = 'جارٍ التفعيل…';
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
    btnText.textContent = 'إعادة محاولة التفعيل';
  }
  function clearUnsupported(){
    if (activationClock){
      if (activationClock.fastFrom < 0){
        // A valid sample inside the deadline window: fast-complete
        // the fill (~250 ms); applyCompassLive() runs when it lands.
        activationClock.fastFrom = activationClock.progress;
        activationClock.fastStart = performance.now();
      }
      return; // fast-complete already in flight on a second sample
    }
    applyCompassLive();
  }
  function applyCompassLive(){
    state.unsupported = false;
    state.activating = false;
    document.body.classList.remove('unsupported');
    btnText.textContent = 'البوصلة مفعّلة';
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
      // Known-absent sensor API: skip the 3 s wait entirely — and no
      // fake fill for a failure that is already known.
      enterUnsupported();
      return;
    }
    startActivationClock();
  }
