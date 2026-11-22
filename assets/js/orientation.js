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
    if (state.unsupported) clearUnsupported();
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
     all, or when the watchdog sees no valid heading sample within
     4 s of activation (the classic desktop-Chrome case: the listener
     registers but alpha stays null forever). A valid sample arriving
     later clears the state automatically via clearUnsupported().
     The iOS permission-denied message is a separate state and is
     never merged into this one. */
  function enterUnsupported(){
    if (state.sensorSeen || state.unsupported) return;
    state.unsupported = true;
    liveDot.classList.remove('on');
    liveText.textContent = 'تحديد الاتجاه غير مدعوم على هذا الجهاز';
    statusTitle.textContent = 'هذا الجهاز لا يدعم تحديد الاتجاه';
    statusDesc.textContent = 'أجهزة الكمبيوتر لا تحتوي على مستشعر بوصلة مغناطيسي، فلا يمكن قياس اتجاهك هنا. زاوية القبلة من موقعك محدّدة في بطاقات البيانات بالأسفل — افتح نفس الرابط من هاتفك لمعرفة اتجاهك لحظة بلحظة.';
    // Honest button state: not stuck on a disabled «البوصلة مفعّلة» —
    // it offers a retry (e.g. after connecting/enabling a sensor).
    enableBtn.removeAttribute('disabled');
    enableBtn.textContent = 'إعادة محاولة التفعيل';
  }
  function clearUnsupported(){
    state.unsupported = false;
    enableBtn.textContent = 'البوصلة مفعّلة';
    enableBtn.setAttribute('disabled', 'disabled');
    if (state.qibla !== null){
      statusTitle.textContent = 'تم تحديد موقعك — حرّك هاتفك';
      statusDesc.textContent = 'الآن لفّ جسمك ببطء حتى يصطف الخط مع الكعبة.';
    }
  }
  var orientationStarted = false;
  var headingWatchdog = null;
  function startOrientation(){
    if (!orientationStarted){
      orientationStarted = true;
      window.addEventListener('deviceorientationabsolute', function(e){ onOrientation(e, true); }, true);
      window.addEventListener('deviceorientation', function(e){ onOrientation(e, e.absolute === true); }, true);
    }
    if (typeof DeviceOrientationEvent === 'undefined'){
      enterUnsupported();
      return;
    }
    if (headingWatchdog) clearTimeout(headingWatchdog);
    headingWatchdog = setTimeout(function(){
      headingWatchdog = null;
      if (!state.sensorSeen) enterUnsupported();
    }, 4000);
  }
