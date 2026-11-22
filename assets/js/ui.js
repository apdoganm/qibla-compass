/* ============================================================
   بوصلة القبلة — ui.js
   Toast, compass/strip mode switch and strip rendering.
   ============================================================ */
"use strict";

  // Stagger the strip arrows so they flow one after another
  for (var ai = 0; ai < stripArrows.children.length; ai++){
    stripArrows.children[ai].style.animationDelay = (-(ai * 0.13)) + 's';
  }

  /* ---------- Mode switch: compass / strip ---------- */
  function setMode(mode){
    var compass = mode === 'compass';
    viewCompass.hidden = !compass;
    viewStrip.hidden = compass;
    modeCompassBtn.classList.toggle('active', compass);
    modeStripBtn.classList.toggle('active', !compass);
    modeCompassBtn.setAttribute('aria-selected', compass ? 'true' : 'false');
    modeStripBtn.setAttribute('aria-selected', compass ? 'false' : 'true');
  }
  modeCompassBtn.addEventListener('click', function(){ setMode('compass'); });
  modeStripBtn.addEventListener('click', function(){ setMode('strip'); });

  /* ---------- Direction strip rendering ---------- */
  function updateStrip(hasHeading, diff, signed, isAligned, unreliable){
    var arrows = stripArrows.children;
    var i;
    if (!hasHeading){
      strip.className = 'strip idle';
      stripDeg.textContent = '—°';
      stripGuide.textContent = 'فعّل البوصلة لبدء التوجيه';
      stripSub.textContent = 'الأسهم الزرقاء تشير لاتجاه التصحيح، وتقلّ كلما اقتربت من القبلة';
      stripArrows.className = 'strip-arrows';
      for (i = 0; i < arrows.length; i++) arrows[i].style.opacity = '0';
      return;
    }
    if (isAligned){
      strip.className = 'strip aligned-strip';
      stripDeg.textContent = '0°';
      stripGuide.textContent = 'أنت على القبلة تماماً';
      stripSub.textContent = 'ثبّت اتجاهك — الشريط الأخضر يعني الاصطفاف الدقيق';
      stripArrows.className = 'strip-arrows';
      for (i = 0; i < arrows.length; i++) arrows[i].style.opacity = '0';
      return;
    }
    strip.className = 'strip live';
    stripDeg.textContent = fmt(diff, 0) + '°';
    if (unreliable && diff <= ALIGN_TOL){
      stripGuide.textContent = 'قريب — عايِر البوصلة للتأكيد';
      stripSub.textContent = 'أنت ضمن نطاق القبلة، لكن دقة المستشعر منخفضة الآن فلن نؤكد الاصطفاف';
    } else {
      stripGuide.textContent = signed > 0 ? 'لف يميناً' : 'لف يساراً';
      stripSub.textContent = 'انحرافك عن القبلة ' + fmt(diff, 0) + '° — استمر في اللف ببطء';
    }
    stripArrows.className = 'strip-arrows ' + (signed > 0 ? 'go-right' : 'go-left');
    // Arrows thin out and slow down as the deviation shrinks
    var visible = diff > 45 ? 5 : diff > 25 ? 4 : diff > 12 ? 3 : diff > 6 ? 2 : 1;
    var frac = Math.min(1, diff / 60);
    var dur = (1.5 - frac * 0.9).toFixed(2) + 's';
    for (i = 0; i < arrows.length; i++){
      arrows[i].style.opacity = i < visible ? String(1 - i * 0.14) : '0';
      arrows[i].style.animationDuration = dur;
    }
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function showToast(msg, green){
    toast.textContent = msg;
    toast.className = 'toast show' + (green ? ' green' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.className = 'toast'; }, 3400);
  }
