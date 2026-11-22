/* ============================================================
   اتجاه القبلة — app.js
   Boot: activation controls, saved-position restore and
   the render loop. Loaded last.
   ============================================================ */
"use strict";

  enableBtn.addEventListener('click', function(){
    state.enabled = true;
    requestLocation();
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'){
      DeviceOrientationEvent.requestPermission().then(function(res){
        if (res === 'granted'){ startOrientation(); }
        else {
          showToast('يلزم إذن الحركة لعمل البوصلة');
          statusTitle.textContent = 'إذن الحركة متوقف';
          statusDesc.textContent = 'فعّل إذن الحركة من إعدادات المتصفح لهذا الموقع، ثم أعد تحميل الصفحة واضغط زر التفعيل من جديد.';
        }
      }).catch(function(){
        showToast('تعذّر طلب إذن الحركة — أعد المحاولة');
      });
    } else {
      startOrientation();
    }
    enableBtn.textContent = 'البوصلة مفعّلة';
    enableBtn.setAttribute('disabled', 'disabled');
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
    calibWarn.classList.toggle('show', hasHeading && state.compassUnreliable);
    // displayHeading is the filtered MAGNETIC heading, driven directly by
    // the One Euro filter on every sensor event — no extra smoothing lag
    // is added here, so the dial tracks the hand almost 1:1 while resting
    // jitter stays filtered out. The WMM2025 correction is applied on top:
    // true heading = magnetic heading + declination D (east positive),
    // and only this true heading is compared with the qibla bearing
    // (which is measured from true north) or used to rotate the dial.
    var h = norm360(state.displayHeading + state.declination);
    dial.style.transform = 'rotate(' + (-h) + 'deg)';
    if (!hasHeading){
      hubHeading.textContent = '—°';
      hubDiff.textContent = 'بانتظار التفعيل';
      hubDiff.className = 'diff';
      dAlign.textContent = '—';
      dAlignSub.textContent = 'الاصطفاف الدقيق ضمن ±٥°';
      updateStrip(false, 0, 0, false, false);
      requestAnimationFrame(tick);
      return;
    }
    hubHeading.textContent = fmt(h, 0) + '°';

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
        statusIcon.innerHTML = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 12.5 10 18 19.5 6.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      } else if (!isAligned && state.aligned){
        state.aligned = false;
        document.body.classList.remove('aligned');
        statusTitle.textContent = 'تم تحديد موقعك — حرّك هاتفك';
        statusDesc.textContent = 'الآن لفّ جسمك ببطء حتى يصطف الخط مع الكعبة.';
        statusIcon.innerHTML = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="#000" stroke-width="1.8"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z" fill="#000"/></svg>';
      }

      if (state.aligned){
        hubDiff.textContent = '✓ على القبلة';
        hubDiff.className = 'diff ok';
        dAlign.textContent = 'مصطف تماماً';
        dAlignSub.textContent = 'الفرق ' + fmt(diff, 0) + '° فقط — صلِّ مطمئناً';
        turnText.textContent = 'ثبّت هاتفك — هذا هو اتجاه القبلة';
        turnArrow.textContent = '✓';
        turnArrow.style.transform = 'none';
      } else {
        hubDiff.textContent = 'الفرق ' + fmt(diff, 0) + '°';
        hubDiff.className = 'diff';
        dAlign.textContent = fmt(diff, 0) + '°';
        dAlignSub.textContent = signed > 0 ? 'أدر هاتفك يميناً لتقليل الفرق' : 'أدر هاتفك يساراً لتقليل الفرق';
        if (state.enabled){
          turnText.textContent = signed > 0
            ? 'أدر هاتفك يميناً بمقدار ' + fmt(Math.abs(signed), 0) + '°'
            : 'أدر هاتفك يساراً بمقدار ' + fmt(Math.abs(signed), 0) + '°';
          turnArrow.textContent = signed > 0 ? '⟶' : '⟵';
          turnArrow.style.transform = 'none';
        }
      }
      if (!state.aligned && state.compassUnreliable && diff <= ALIGN_TOL){
        hubDiff.textContent = 'قريب جداً — المعايرة مطلوبة';
        turnText.textContent = 'حرّك هاتفك على شكل الرقم 8 لمعايرة البوصلة، ثم أعد المحاولة';
        turnArrow.textContent = '∞';
        turnArrow.style.transform = 'none';
      }
      // keep vibrating gently while staying aligned (throttled inside)
      if (state.aligned) vibrateSuccess();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
