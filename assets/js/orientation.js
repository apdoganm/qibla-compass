/* ============================================================
   بوصلة القبلة — orientation.js
   Device-orientation handling: tilt-compensated heading,
   absolute-stream preference, calibration accuracy state.
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
    state.sensorSeen = true;
    state.hasSensor = true;
    state.manual = false;
    manualBox.classList.remove('show');
    state.targetHeading = norm360(h);
    feedHeading(h, now);
    liveDot.classList.add('on');
    liveText.textContent = 'البوصلة تعمل الآن';
  }
  function startOrientation(){
    window.addEventListener('deviceorientationabsolute', function(e){ onOrientation(e, true); }, true);
    window.addEventListener('deviceorientation', function(e){ onOrientation(e, e.absolute === true); }, true);
    // If nothing arrives (desktop), offer manual preview
    setTimeout(function(){
      if (!state.sensorSeen){
        manualBox.classList.add('show');
        if (state.targetHeading === null){
          setManualHeading(parseFloat(manualRange.value));
        }
        liveText.textContent = 'وضع المعاينة اليدوية';
        statusTitle.textContent = 'لا يوجد مستشعر بوصلة هنا';
        statusDesc.textContent = 'هذا الجهاز لا يرسل بيانات اتجاه — استخدم مؤشر المعاينة أسفل البوصلة، أو افتح الصفحة من هاتفك للتجربة الكاملة.';
      }
    }, 2500);
  }
