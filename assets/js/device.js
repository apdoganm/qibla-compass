/* ============================================================
   اتجاه القبلة — device.js
   Device-type awareness: detects whether the visitor is on a
   phone, a tablet or a computer, and adapts every device-naming
   string to match — the site says «حرّك هاتفك» on a phone,
   «حرّك جهازك اللوحي» on a tablet and «حرّك كمبيوترك» on a
   computer. (Detection is silent: there is no visible chip —
   only the wording adapts.)

   Other scripts compose device strings with the tokens
   {device} (possessive noun: هاتفك / جهازك اللوحي / كمبيوترك)
   and {deviceBare} (هاتف / جهاز لوحي / كمبيوتر) and pass them
   through QiblaDevice.fill(). Static HTML copy carries the
   same tokens and is filled in place at boot. Loaded early —
   right after geo.js, before state.js and app.js.
   ============================================================ */
"use strict";

  var QiblaDevice = (function(){
    var WORDS = {
      phone:    { noun: 'هاتفك',       bare: 'هاتف' },
      tablet:   { noun: 'جهازك اللوحي', bare: 'جهاز لوحي' },
      computer: { noun: 'كمبيوترك',    bare: 'كمبيوتر' }
    };

    /* ---------- Detection ----------
       Classic UA parsing is the synchronous baseline. Two traps
       are handled explicitly: iPadOS 13+ sends a Macintosh UA
       (only multi-touch betrays it — hence MacIntel/Macintosh +
       maxTouchPoints > 1 = tablet), and a Windows touch LAPTOP
       must stay a computer (its UA is a desktop UA, so touch
       points alone never promote it — the touch check applies
       to the Macintosh case only). UA Client Hints, when the
       browser offers them, refine the result asynchronously
       below; nothing blocks on that call. */
    function detectType(){
      var ua = navigator.userAgent || '';
      var maxTouch = (typeof navigator.maxTouchPoints === 'number') ? navigator.maxTouchPoints : 0;
      if (/iPad/i.test(ua)) return 'tablet';
      if (/Macintosh|MacIntel/i.test(ua) && maxTouch > 1) return 'tablet';
      if (/iPhone|iPod|Windows Phone|IEMobile/i.test(ua)) return 'phone';
      if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'phone' : 'tablet';
      if (/Mobile/i.test(ua)) return 'phone';
      if (navigator.userAgentData && navigator.userAgentData.mobile === true) return 'phone';
      return 'computer';
    }

    var current = {
      type: detectType(),
      noun: '', bare: ''
    };
    function applyWords(){
      var w = WORDS[current.type];
      current.noun = w.noun; current.bare = w.bare;
    }
    applyWords();

    function fill(text){
      if (typeof text !== 'string') return text;
      return text.split('{deviceBare}').join(current.bare)
                 .split('{device}').join(current.noun);
    }

    /* ---------- Static HTML strings ----------
       Token-carrying text nodes are collected once (their
       original token text is kept), so a later UA-CH refinement
       can re-fill them from the source tokens instead of trying
       to swap already-substituted words. */
    var tokenNodes = [];
    function collectTokenNodes(root){
      if (!root) return;
      if (root.nodeType === 3){
        if (root.nodeValue && root.nodeValue.indexOf('{device') !== -1){
          tokenNodes.push({ node: root, original: root.nodeValue });
        }
        return;
      }
      if (root.nodeType !== 1) return;
      var tag = root.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return;
      var kids = root.childNodes || [];
      for (var i = 0; i < kids.length; i++) collectTokenNodes(kids[i]);
    }
    function fillStatic(){
      for (var i = 0; i < tokenNodes.length; i++){
        tokenNodes[i].node.nodeValue = fill(tokenNodes[i].original);
      }
    }
    function refresh(){
      applyWords();
      fillStatic();
    }

    collectTokenNodes(document.body);
    fillStatic();

    /* ---------- UA Client Hints refinement (async, optional) ----------
       getHighEntropyValues is never awaited: the UA result above
       is already applied. If the hints disagree — e.g. a mobile
       client behind a desktop-class UA string — adopt the hint
       and re-fill everything. Conservative rules only: a mobile
       flag can promote computer → phone, and Android without the
       mobile flag means a tablet; hints never demote a phone or
       tablet the UA already identified. */
    if (navigator.userAgentData &&
        typeof navigator.userAgentData.getHighEntropyValues === 'function'){
      navigator.userAgentData.getHighEntropyValues(['mobile', 'platform']).then(function(h){
        var refined = null;
        if (h && h.mobile === true && current.type === 'computer') refined = 'phone';
        else if (h && h.mobile === false && h.platform === 'Android' && current.type === 'computer') refined = 'tablet';
        if (refined && refined !== current.type){
          current.type = refined;
          refresh();
        }
      }).catch(function(){ /* hints are a refinement only — UA result stands */ });
    }

    /* ---------- Brave detection (async, optional) ----------
       Brave blocks device-motion sensors by default, and its
       DeviceOrientationEvent.requestPermission() resolves
       'denied' without ever showing a prompt — so on Brave the
       permission-stopped card needs browser-specific unblock
       steps (orientation.js reads this flag when it fills that
       card). Detection is the browser's own official API:
       navigator.brave.isBrave() returns a promise. It is never
       awaited and never blocks anything: the flag simply flips
       true when the answer lands, long before a first tap can
       happen. Every other browser lacks the API and keeps the
       default false. */
    var braveDetected = false;
    if (navigator.brave && typeof navigator.brave.isBrave === 'function'){
      try {
        navigator.brave.isBrave().then(function(v){
          braveDetected = (v === true);
        }).catch(function(){ /* detection is best-effort — false stands */ });
      } catch(e){ /* detection is best-effort — false stands */ }
    }

    return {
      get type(){ return current.type; },
      get noun(){ return current.noun; },
      get bare(){ return current.bare; },
      get isBrave(){ return braveDetected; },
      fill: fill,
      detectType: detectType
    };
  })();
