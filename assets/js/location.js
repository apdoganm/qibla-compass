/* ============================================================
   اتجاه القبلة — location.js
   Geolocation: one explicit fix, saved position, silent
   watchPosition updates, WMM2025 declination per fix, and
   reverse geocoding of the current place for the top strip.
   ============================================================ */
"use strict";

  /* ---------- Location ----------
     Permission is asked once, at first activation. The last known fix is
     kept in localStorage on this device only, shown instantly on later
     visits (labelled as saved), and a single watchPosition then keeps the
     qibla angle, distance and coordinates updated silently — the browser
     does not re-ask while permission stands for this site. */
  var LS_KEY = 'qibla:lastPosition';
  function savePosition(lat, lon, acc, place, placeLat, placeLon){
    try {
      var rec = { lat: lat, lon: lon, acc: acc, ts: Date.now() };
      if (typeof place === 'string' && place){
        rec.place = place; rec.placeLat = placeLat; rec.placeLon = placeLon;
      } else {
        // Keep any previously resolved place that still belongs to this area
        var prev = loadSavedPosition();
        if (prev && typeof prev.place === 'string' && prev.place &&
            typeof prev.placeLat === 'number' && typeof prev.placeLon === 'number' &&
            haversineKm(lat, lon, prev.placeLat, prev.placeLon) < 1){
          rec.place = prev.place; rec.placeLat = prev.placeLat; rec.placeLon = prev.placeLon;
        }
      }
      localStorage.setItem(LS_KEY, JSON.stringify(rec));
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
  function applyPosition(lat, lon, acc, skipPlace){
    state.lat = lat; state.lon = lon;
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
    // The top strip names where the visitor actually is — except for the
    // built-in Cairo fallback shown before any real fix exists.
    if (!skipPlace) resolvePlace(lat, lon);
  }

  /* ---------- Reverse geocoding: name of the visitor's place ----------
     The top strip keeps its default destination text until a real (or
     saved) fix exists; then it shows the visitor's own city + country in
     Arabic, e.g. «القاهرة، مصر». Lookup: BigDataCloud's free, keyless,
     CORS-enabled reverse-geocode-client endpoint. The coordinates go
     only to that endpoint, only for this lookup. Throttled hard: a new
     lookup happens only after moving >= 1 km from the last geocoded
     point, and the resolved name is cached with the saved position, so
     revisits render it instantly with no network call. Any failure or
     timeout falls back to plain formatted coordinates in the strip. */
  function haversineKm(lat1, lon1, lat2, lon2){
    var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  var placeState = { lat: null, lon: null, label: null, pending: false };
  function setPlaceLabel(text){
    if (placeText) placeText.textContent = text;
  }
  function coordsLabel(lat, lon){
    return fmt(lat, 4) + ', ' + fmt(lon, 4);
  }
  function fetchPlaceName(lat, lon){
    if (typeof fetch === 'undefined') return Promise.reject(new Error('no fetch'));
    var url = 'https://api.bigdatacloud.net/data/reverse-geocode-client' +
              '?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=ar';
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, 6000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function(r){
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('geocode http ' + r.status);
      return r.json();
    }).then(function(d){
      var city = d.city || d.locality || d.principalSubdivision || '';
      var country = d.countryName || '';
      var label = [city, country].filter(function(s){ return !!s; }).join('، ');
      return label || null;
    });
  }
  function persistPlace(lat, lon, label){
    try {
      var p = loadSavedPosition();
      if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
      p.place = label; p.placeLat = lat; p.placeLon = lon;
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch(e){ /* cache is best-effort only */ }
  }
  function resolvePlace(lat, lon){
    // Already resolved for this area (this session): keep the label.
    if (placeState.lat !== null &&
        haversineKm(lat, lon, placeState.lat, placeState.lon) < 1){
      if (placeState.label) setPlaceLabel(placeState.label);
      return;
    }
    // Cached with the saved position from an earlier visit: instant, offline.
    var saved = loadSavedPosition();
    if (saved && typeof saved.place === 'string' && saved.place &&
        typeof saved.placeLat === 'number' && typeof saved.placeLon === 'number' &&
        haversineKm(lat, lon, saved.placeLat, saved.placeLon) < 1){
      placeState.lat = saved.placeLat; placeState.lon = saved.placeLon;
      placeState.label = saved.place;
      setPlaceLabel(saved.place);
      return;
    }
    if (placeState.pending) return;
    placeState.pending = true;
    var done = function(label){
      placeState.pending = false;
      placeState.lat = lat; placeState.lon = lon; placeState.label = label;
      setPlaceLabel(label);
      persistPlace(lat, lon, label);
      // The user may have moved on while this lookup was in flight —
      // resolve the place for where they actually are now.
      if (state.lat !== null && state.lon !== null &&
          haversineKm(state.lat, state.lon, lat, lon) >= 1){
        resolvePlace(state.lat, state.lon);
      }
    };
    // Backstop: fetchPlaceName aborts at 6 s, but a request intercepted
    // or stalled by the network / an extension could otherwise never
    // settle, leaving `pending` stuck and the strip on its default text
    // forever after a real fix. Force the coordinates fallback instead.
    var settleTimer = setTimeout(function(){
      if (placeState.pending) done(coordsLabel(lat, lon));
    }, 7000);
    fetchPlaceName(lat, lon).then(function(name){
      clearTimeout(settleTimer);
      done(name || coordsLabel(lat, lon));
    }).catch(function(){
      clearTimeout(settleTimer);
      done(coordsLabel(lat, lon));
    });
  }
  function onPosition(pos){
    var lat = pos.coords.latitude, lon = pos.coords.longitude;
    var acc = pos.coords.accuracy || 50;
    if (state.lat !== null && Math.abs(state.lat - lat) < 0.00001 && Math.abs(state.lon - lon) < 0.00001){
      // Same spot (e.g. the watch confirming the saved fix): just refresh
      // the accuracy label so it no longer reads as a stale saved value —
      // but still make sure the place label gets resolved for this fix.
      dAcc.textContent = 'دقة الموقع: ±' + Math.round(acc) + ' متر';
      resolvePlace(lat, lon);
      return;
    }
    applyPosition(lat, lon, acc);
    savePosition(lat, lon, acc);
    if (!state.aligned && !state.unsupported){
      statusTitle.textContent = QiblaDevice.fill('تم تحديد موقعك — حرّك {device}');
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
    if (state.unsupported){
      // While the unsupported-sensor decision is on screen, a location
      // refresh must never bury it under a «جارٍ تحديد موقعك…» loading
      // text — that exact pairing (red card + eternal spinner) is the
      // stuck state users reported. Refresh the (still valid) angle /
      // distance data silently instead; onPosition already refrains
      // from overwriting the message, and an error here changes
      // nothing about the sensor decision.
      navigator.geolocation.getCurrentPosition(function(pos){
        onPosition(pos);
      }, function(){ /* keep the decided unsupported message */ },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 10000 });
      startWatch();
      return;
    }
    statusTitle.textContent = 'جارٍ تحديد موقعك…';
    statusDesc.textContent = 'لحظات ونحسب زاوية القبلة من مكانك الحالي.';
    // One explicit fix — this is the call that raises the permission prompt
    // on the very first activation. Afterwards the single watch below keeps
    // everything updated silently; no repeated prompts or requests.
    // The 3 s timeout — matching the activation deadline — guarantees
    // the error callback fires, so this flow always lands in a decided
    // state (fix or onPositionError copy) and location can never
    // outlive the compass decision.
    navigator.geolocation.getCurrentPosition(function(pos){
      onPosition(pos);
      showToast('تم تحديد موقعك بنجاح');
    }, onPositionError, { enableHighAccuracy: true, timeout: 3000, maximumAge: 10000 });
    startWatch();
  }
