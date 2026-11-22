/* ============================================================
   اتجاه القبلة — dial.js
   Builds the compass dial ticks, numbers and cardinals.
   ============================================================ */
"use strict";

  /* ---------- Build dial ticks ---------- */
  (function buildDial(){
    // Every marker sits at the dial center, then: rotate(angle) moves its
    // local "up" to that bearing, translateY(-r) pushes it out to the ring.
    // This keeps the whole ring exactly concentric with the dial at any size.
    function layout(){
      var size = dial.clientWidth || 360;
      var rTick = size/2 - 15;
      var rNum  = size/2 - 33;
      var rCard = size/2 - 57;
      dial.querySelectorAll('.tick').forEach(function(t){
        var a = parseFloat(t.getAttribute('data-a'));
        t.style.left = '50%'; t.style.top = '50%';
        t.style.transform = 'translate(-50%,-50%) rotate(' + a + 'deg) translateY(' + (-rTick) + 'px)';
      });
      dial.querySelectorAll('.tick-num').forEach(function(n){
        var a = parseFloat(n.getAttribute('data-a'));
        n.style.left = '50%'; n.style.top = '50%';
        n.style.transform = 'translate(-50%,-50%) rotate(' + a + 'deg) translateY(' + (-rNum) + 'px) rotate(' + (-a) + 'deg)';
      });
      dial.querySelectorAll('.cardinal').forEach(function(c){
        var a = parseFloat(c.getAttribute('data-a'));
        c.style.left = '50%'; c.style.top = '50%';
        c.style.transform = 'translate(-50%,-50%) rotate(' + a + 'deg) translateY(' + (-rCard) + 'px) rotate(' + (-a) + 'deg)';
      });
    }
    for (var d = 0; d < 360; d += 5){
      var t = document.createElement('div');
      t.className = 'tick' + (d % 30 === 0 ? ' major' : '');
      t.setAttribute('data-a', d);
      dial.insertBefore(t, qiblaArm);
    }
    [0,30,60,90,120,150,180,210,240,270,300,330].forEach(function(d){
      var n = document.createElement('div');
      n.className = 'tick-num'; n.setAttribute('data-a', d);
      n.textContent = d + '°';
      dial.insertBefore(n, qiblaArm);
    });
    var cards = [ [0,'شمال','north'], [90,'شرق',''], [180,'جنوب',''], [270,'غرب',''] ];
    cards.forEach(function(c){
      var el = document.createElement('div');
      el.className = 'cardinal ' + c[2]; el.setAttribute('data-a', c[0]);
      el.textContent = c[1];
      dial.insertBefore(el, qiblaArm);
    });
    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('load', layout);
  })();
