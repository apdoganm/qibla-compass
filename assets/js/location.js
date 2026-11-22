/* ============================================================
   بوصلة القبلة — location.js
   Geolocation: one explicit fix, saved position, silent
   watchPosition updates, WMM2025 declination per fix.
   ============================================================ */
"use strict";

  /* ---------- Location ----------
     Permission is asked once, at first activation. The last known fix is
     kept in localStorage on this device only, shown instantly on later
     visits (labelled as saved), and a single watchPosition then keeps the
     qibla angle, distance and coordinates updated silently — the browser
     does not re-ask while permission stands for this site. */
  var LS_KEY = 'qibla:lastPosition';
  function savePosition(lat, lon, acc){
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ lat: lat, lon: lon, acc: acc, ts: Date.now() }));
    } catch(e){ /* storage unavailable (private mode / sandbox) — session still works */ }
  }
  function loadSavedPosition(){
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return null;
      if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return null;
      return p;
    } catch(e){ return null; }
  }
  /* WMM2025 declination at the user's position for today's date.
     Recomputed on every position fix, so travelling updates the
     correction together with the qibla angle and the distance. */
  function updateDeclination(lat, lon){
    var d = magvar(lat, lon, 0, new Date());
    state.declination = (typeof d === 'number' && isFinite(d)) ? d : 0;
    dDecl.textContent = (state.declination >= 0 ? '+' : '') + fmt(state.declination, 1) + '°';
  }
  function applyPosition(lat, lon, acc){
    state.lat = lat; state.lon = lon; state.accuracy = acc;
    state.qibla = calcQibla(lat, lon);
    state.distance = calcDistance(lat, lon);
    updateDeclination(lat, lon);
    qiblaArm.style.transform = 'rotate(' + state.qibla + 'deg)';
    kaabaDeg.textContent = fmt(state.qibla, 1) + '°';
    stripQiblaDeg.textContent = fmt(state.qibla, 1) + '°';
    dQibla.innerHTML = fmt(state.qibla, 1) + '°';
    dDist.innerHTML = fmt(Math.round(state.distance), 0) + ' <small>كم</small>';
    dCoords.textContent = fmt(lat, 4) + ', ' + fmt(lon, 4);
    dAcc.textContent = 'دقة الموقع: ±' + Math.round(acc) + ' متر';
  }
  function onPosition(pos){
    var lat = pos.coords.latitude, lon = pos.coords.longitude;
    var acc = pos.coords.accuracy || 50;
    if (state.lat !== null && Math.abs(state.lat - lat) < 0.00001 && Math.abs(state.lon - lon) < 0.00001){
      // Same spot (e.g. the watch confirming the saved fix): just refresh
      // the accuracy label so it no longer reads as a stale saved value.
      dAcc.textContent = 'دقة الموقع: ±' + Math.round(acc) + ' متر';
      return;
    }
    applyPosition(lat, lon, acc);
    savePosition(lat, lon, acc);
    if (!state.aligned){
      statusTitle.textContent = 'تم تحديد موقعك — حرّك هاتفك';
      statusDesc.textContent = 'الآن لفّ جسمك ببطء حتى يصطف الخط مع الكعبة. وسيُحدّث موقعك تلقائياً إذا تحركت.';
    }
  }
  function onPositionError(err){
    if (err && err.code === 1){ // PERMISSION_DENIED — revoked or never granted
      statusTitle.textContent = 'إذن الموقع متوقف';
      statusDesc.textContent = 'فعّل إذن الموقع لهذا الموقع من إعدادات المتصفح، ثم اضغط «تحديث موقعي». بدون موقعك الحالي تُعرض قبلة آخر موقع محفوظ فقط.';
      showToast('إذن الموقع مرفوض — فعّله من إعدادات المتصفح');
    } else {
      statusTitle.textContent = 'تعذّر تحديد موقعك الآن';
      statusDesc.textContent = 'جرّب في مكان مفتوح أو قرب نافذة ثم اضغط «تحديث موقعي».';
    }
  }
  function startWatch(){
    if (state.watchStarted || !('geolocation' in navigator)) return;
    state.watchStarted = true;
    navigator.geolocation.watchPosition(onPosition, onPositionError,
      { enableHighAccuracy: true, maximumAge: 10000 });
  }
  function requestLocation(){
    if (!('geolocation' in navigator)){
      showToast('جهازك لا يدعم تحديد الموقع');
      return;
    }
    statusTitle.textContent = 'جارٍ تحديد موقعك…';
    statusDesc.textContent = 'لحظات ونحسب زاوية القبلة من مكانك الحالي.';
    // One explicit fix — this is the call that raises the permission prompt
    // on the very first activation. Afterwards the single watch below keeps
    // everything updated silently; no repeated prompts or requests.
    navigator.geolocation.getCurrentPosition(function(pos){
      onPosition(pos);
      showToast('تم تحديد موقعك بنجاح');
    }, onPositionError, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
    startWatch();
  }
