import { NextRequest } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  return new Response(buildHtml(code), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function buildHtml(code: string): string {
  const safeCode = JSON.stringify(code);
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<title>Simulator</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;background:#0d0d1f;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;color:#f1f5f9;display:flex;flex-direction:column}
#banner{background:linear-gradient(135deg,#1e0a35 0%,#2d1052 100%);border-bottom:1px solid rgba(139,92,246,.3);padding:8px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;min-height:52px;flex-shrink:0}
#pt-info{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
#pt-name{font-weight:700;font-size:1rem}
.chip{display:flex;gap:3px;align-items:baseline;font-size:.8rem}
.cl{color:rgba(167,139,250,.8);font-weight:500}
.cv{color:#e2e8f0;font-weight:600}
.ch{color:#fbbf24}
#timer-area{display:flex;align-items:center;gap:8px;direction:ltr;flex-shrink:0}
#tdot{width:8px;height:8px;border-radius:50%;background:#6b7280;flex-shrink:0}
#tdot.run{background:#22c55e;box-shadow:0 0 6px #22c55e}
#tdisp{color:#9ca3af;font-family:monospace;font-size:1.4rem;font-weight:700;letter-spacing:.05em;min-width:5ch}
#tdisp.run{color:#f1f5f9}
#mbtn{background:none;border:none;color:#9ca3af;font-size:1.2rem;cursor:pointer;padding:0 4px;line-height:1;-webkit-tap-highlight-color:transparent}
#mon{flex:0 0 360px;display:flex;min-height:0}
#ctgwrap{flex:1 1 0;position:relative;min-width:0;overflow:hidden;background:#020209}
#ctg{display:block}
#vp{width:200px;flex-shrink:0;border-left:1px solid rgba(139,92,246,.15);padding:8px;display:flex;flex-direction:column;gap:3px}
.vrow{flex:1;display:flex;flex-direction:column;justify-content:center;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);min-height:0}
.vrow.alm{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.4)}
.vlbl{color:rgba(156,163,175,.8);font-size:.6rem;font-family:monospace;letter-spacing:.1em;margin-bottom:1px}
.vval{font-weight:700;line-height:1}
.vunit{color:rgba(107,114,128,.7);font-size:.65rem}
#clinical{flex:1;min-height:0;border-top:2px solid rgba(139,92,246,.2);display:flex;flex-direction:column;overflow:hidden}
#chdr{padding:8px 16px;border-bottom:1px solid rgba(139,92,246,.12);display:flex;align-items:center;gap:10px;flex-shrink:0}
#cbadge{display:none;background:rgba(124,58,237,.25);border:1px solid rgba(124,58,237,.4);border-radius:6px;padding:2px 8px;color:#c4b5fd;font-size:.75rem;font-weight:700}
#cwait{color:#4b5563;font-size:.82rem}
#ccontent{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:12px}
.slbl{color:#7c3aed;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
#dtxt{color:#d1d5db;font-size:.85rem;line-height:1.7;white-space:pre-line}
#ltabs{display:flex;gap:4px;padding:5px 8px;background:rgba(0,0,0,.25);border-bottom:1px solid rgba(139,92,246,.15);overflow-x:auto;-webkit-overflow-scrolling:touch;flex-shrink:0}
.ltab{padding:3px 10px;border-radius:14px;border:1px solid rgba(139,92,246,.25);background:none;color:#9ca3af;font-size:.7rem;cursor:pointer;-webkit-tap-highlight-color:transparent;font-family:inherit;white-space:nowrap;flex-shrink:0}
.ltab.act{background:rgba(124,58,237,.3);border-color:#7c3aed;color:#c4b5fd;font-weight:700}
#ltable{overflow-x:auto;-webkit-overflow-scrolling:touch}
#ltable table{border-collapse:collapse;direction:rtl;white-space:nowrap;font-size:.72rem;width:100%}
#ltable th{padding:3px 8px;font-weight:700;color:#a5b4fc;background:rgba(0,0,10,.4);border-bottom:1px solid rgba(139,92,246,.2);text-align:center}
#ltable td{padding:2px 8px;font-family:monospace;text-align:center;border-bottom:1px solid rgba(255,255,255,.04);color:#e2e8f0}
#ltable .meta{text-align:right;font-family:inherit;color:#6b7280}
.labn{color:#f87171!important;text-decoration:underline;font-weight:700}
#htxt{color:#9ca3af;font-size:.82rem;line-height:1.6}
#ended{display:none;position:fixed;inset:0;z-index:60;background:rgba(13,13,31,.92);flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px}
#ended.show{display:flex}
#dbg{position:fixed;bottom:0;left:0;right:0;z-index:99;background:#0a0a1a;border-top:1px solid #222;padding:3px 10px;font-size:.6rem;font-family:monospace;color:#f59e0b;display:flex;gap:12px;flex-wrap:wrap}
#dbg.ok{color:#22c55e}
</style>
</head>
<body>
<div id="banner">
  <div id="pt-info" dir="rtl">
    <span id="pt-name">—</span>
    <span class="chip"><span class="cl">גיל:</span><span id="pt-age" class="cv">—</span></span>
    <span class="chip"><span class="cl">G</span><span id="pt-g" class="cv">—</span></span>
    <span class="chip"><span class="cl">P</span><span id="pt-p" class="cv">—</span></span>
    <span class="chip"><span class="cl">שבוע:</span><span id="pt-wk" class="cv">—</span></span>
    <span id="pt-bl" class="chip" style="display:none"><span class="cl">דם:</span><span id="pt-blv" class="cv ch"></span></span>
    <span id="pt-al" style="color:#fbbf24;font-size:.75rem;font-weight:600;display:none"></span>
  </div>
  <div id="timer-area">
    <div id="tdot"></div>
    <span id="tdisp">00:00</span>
    <button id="mbtn" title="השתק">🔊</button>
  </div>
</div>

<div id="mon">
  <div id="ctgwrap"><canvas id="ctg"></canvas></div>
  <div id="vp" dir="ltr">
    <div class="vrow" id="rfhr">
      <div class="vlbl">FHR</div>
      <div style="display:flex;align-items:flex-end;gap:3px">
        <span id="fhrv" class="vval" style="font-size:1.8rem;color:#22c55e">---</span>
        <span class="vunit">bpm</span>
      </div>
    </div>
    <div class="vrow" id="rmhr">
      <div class="vlbl">MHR</div>
      <div style="display:flex;align-items:flex-end;gap:3px">
        <span id="mhrv" class="vval" style="font-size:1.4rem;color:#eab308">---</span>
        <span class="vunit">bpm</span>
      </div>
    </div>
    <div class="vrow" id="rbp">
      <div class="vlbl">BP</div>
      <div style="display:flex;align-items:flex-end;gap:3px">
        <span id="bpv" class="vval" style="font-size:1.4rem;color:#f1f5f9">---/--</span>
        <span class="vunit">mmHg</span>
      </div>
    </div>
    <div class="vrow" id="rspo">
      <div class="vlbl">SpO₂</div>
      <div style="display:flex;align-items:flex-end;gap:3px">
        <span id="spov" class="vval" style="font-size:1.4rem;color:#06b6d4">--</span>
        <span class="vunit">%</span>
      </div>
    </div>
    <div class="vrow" id="rtmp">
      <div class="vlbl">Temp</div>
      <div style="display:flex;align-items:flex-end;gap:3px">
        <span id="tmpv" class="vval" style="font-size:1.4rem;color:#f1f5f9">--.-</span>
        <span class="vunit">°C</span>
      </div>
    </div>
  </div>
</div>

<div id="clinical">
  <div id="chdr" dir="rtl">
    <span id="cbadge">כרטיס <span id="cnum"></span></span>
    <span id="cwait">ממתין לנתונים קליניים...</span>
  </div>
  <div id="ccontent" dir="rtl">
    <div id="dsec" style="display:none">
      <div class="slbl">תיאור קליני</div>
      <div id="dtxt"></div>
    </div>
    <div id="lsec" style="display:none;margin:0 -16px">
      <div class="slbl" style="padding:0 16px 5px">תוצאות מעבדה</div>
      <div id="ltabs">
        <button id="ltab-cbc" class="ltab act">ספירה</button>
        <button id="ltab-chem" class="ltab">ביוכימיה</button>
        <button id="ltab-coag" class="ltab">מנגנון קרישה</button>
        <button id="ltab-other" class="ltab">בדיקות נוספות</button>
      </div>
      <div id="ltable"></div>
    </div>
    <div id="hsec" style="display:none">
      <div class="slbl">רקע רפואי</div>
      <div id="htxt"></div>
    </div>
  </div>
</div>

<div id="ended">
  <div style="font-size:2.5rem">✅</div>
  <div style="color:#c4b5fd;font-size:1.4rem;font-weight:700">הסימולציה הסתיימה</div>
  <div style="color:#9ca3af;font-size:.9rem;text-align:center;line-height:1.6">תודה על השתתפותך</div>
</div>

<div id="dbg">
  <span>JS:YES</span>
  <span id="ddb">DB:init</span>
  <span id="dn">(0)</span>
  <span>${code}</span>
</div>

<script>
(function() {
  var CODE = ${safeCode};

  // ── helpers ────────────────────────────────────────────────────────────────
  function g(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? pad(h)+':'+pad(m)+':'+pad(sec) : pad(m)+':'+pad(sec);
  }
  function get(obj, key, def) { return (obj && obj[key] !== undefined && obj[key] !== null) ? obj[key] : def; }

  // ── state ──────────────────────────────────────────────────────────────────
  var simTime = 0, isRunning = false, timerTick = null, lastAt = null, pollN = 0;
  var stateInit = false;
  var simTimeMs = 0; // absolute sim time in ms — synced from server on first poll, then incremented locally
  var ctgP = { fhr_baseline:140, fhr_variability:'normal', accelerations:'present', decelerations:'none', mhr_baseline:75, contraction_frequency:0, contraction_intensity:'moderate' };
  var vit  = { hr:75, bp_systolic:120, bp_diastolic:80, spo2:98, temp:36.8 };
  var curFHR = 140;

  // ── timer ──────────────────────────────────────────────────────────────────
  function startTimer() {
    if (timerTick) return;
    timerTick = setInterval(function() { simTime++; g('tdisp').textContent = fmt(simTime); }, 1000);
    g('tdot').className = 'run'; g('tdisp').className = 'run';
  }
  function stopTimer() {
    clearInterval(timerTick); timerTick = null;
    g('tdot').className = ''; g('tdisp').className = '';
  }

  // ── patient ────────────────────────────────────────────────────────────────
  function setPatient(p) {
    if (!p) return;
    g('pt-name').textContent = get(p,'name','—');
    g('pt-age').textContent  = get(p,'age','—');
    g('pt-g').textContent    = get(p,'gravida','—');
    g('pt-p').textContent    = get(p,'para','—');
    g('pt-wk').textContent   = get(p,'gestational_weeks',0)+'+'+get(p,'gestational_days',0);
    if (p.blood_type) { g('pt-blv').textContent = p.blood_type; g('pt-bl').style.display=''; }
    if (p.allergies)  { g('pt-al').textContent = '⚠ '+p.allergies; g('pt-al').style.display=''; }
    if (p.history)    { g('htxt').textContent = p.history; g('hsec').style.display=''; }
  }

  // ── vitals ─────────────────────────────────────────────────────────────────
  function setVitals(v) {
    if (!v) return;
    vit = v;
    var sys = v.bp_systolic, dia = v.bp_diastolic;
    g('mhrv').textContent = v.hr;
    g('bpv').textContent  = sys+'/'+dia;
    g('spov').textContent = v.spo2;
    g('tmpv').textContent = parseFloat(v.temp).toFixed(1);
    var hrAlm  = v.hr < 50 || v.hr > 120;
    var bpAlm  = sys > 160 || sys < 90 || dia > 110;
    var spoAlm = v.spo2 < 95;
    g('mhrv').style.color = hrAlm  ? '#ef4444' : '#eab308';
    g('bpv').style.color  = bpAlm  ? '#ef4444' : '#f1f5f9';
    g('spov').style.color = v.spo2 < 90 ? '#ef4444' : spoAlm ? '#eab308' : '#06b6d4';
    g('tmpv').style.color = v.temp > 38 ? '#ef4444' : '#f1f5f9';
    g('rmhr').className = 'vrow' + (hrAlm  ? ' alm' : '');
    g('rbp').className  = 'vrow' + (bpAlm  ? ' alm' : '');
    g('rspo').className = 'vrow' + (spoAlm ? ' alm' : '');
  }

  // ── FHR ────────────────────────────────────────────────────────────────────
  function setFHR(fhr) {
    curFHR = fhr;
    g('fhrv').textContent = Math.round(fhr);
    var alm = fhr < 110 || fhr > 160;
    g('fhrv').style.color = alm ? '#ef4444' : '#22c55e';
    g('rfhr').className   = 'vrow' + (alm ? ' alm' : '');
    audioUpdateFHR(fhr);
  }

  // ── Audio (Web Audio API, iOS 11 compatible) ────────────────────────────────
  var ACtx = window.AudioContext || window.webkitAudioContext;
  var actx = null, normalBuf = null, decelBuf = null;
  var normalNode = null, decelNode = null;
  var gNormal = null, gDecel = null, gMaster = null;
  var audioReady = false, audioRunning = false, audioUnlocked = false;
  var audioBaseline = 140, audioInDecel = false;
  var audioPendingStart = false; // start as soon as audio is unlocked

  function audioLoadXHR(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.responseType = 'arraybuffer';
    x.onload = function() {
      actx.decodeAudioData(x.response, function(buf) { cb(buf); }, function() {});
    };
    x.send();
  }

  function audioInit() {
    if (actx) return;
    try {
      actx = new ACtx();
      gMaster = actx.createGain(); gMaster.gain.value = 1; gMaster.connect(actx.destination);
      gNormal = actx.createGain(); gNormal.gain.value = 1; gNormal.connect(gMaster);
      gDecel  = actx.createGain(); gDecel.gain.value  = 0; gDecel.connect(gMaster);
      var loaded = 0;
      function onBuf() { if (++loaded === 2) { audioReady = true; if (audioPendingStart) audioStart(); } }
      audioLoadXHR('/audio/ctg-normal.mp3', function(b) { normalBuf = b; onBuf(); });
      audioLoadXHR('/audio/decel.mp3',      function(b) { decelBuf  = b; onBuf(); });
    } catch(e) {}
  }

  function audioStartLoop(fhr) {
    if (!actx || !normalBuf || !gNormal) return;
    if (normalNode) { try { normalNode.stop(); } catch(e) {} }
    normalNode = actx.createBufferSource();
    normalNode.buffer = normalBuf;
    normalNode.loop = true;
    normalNode.playbackRate.value = fhr / 140;
    normalNode.connect(gNormal);
    normalNode.start();
  }

  function audioStart() {
    if (audioRunning) return;
    if (!audioReady || !audioUnlocked) { audioPendingStart = true; return; }
    audioPendingStart = false;
    audioRunning = true;
    audioStartLoop(curFHR);
  }

  function audioStop() {
    audioRunning = false; audioPendingStart = false;
    if (normalNode) { try { normalNode.stop(); } catch(e) {} normalNode = null; }
    if (decelNode)  { try { decelNode.stop();  } catch(e) {} decelNode  = null; }
    audioInDecel = false;
  }

  function audioUpdateFHR(fhr) {
    if (!audioRunning || !actx) return;
    if (normalNode) {
      normalNode.playbackRate.value = fhr / 140;
    }
    var drop = audioBaseline - fhr;
    if (drop >= 30 && !audioInDecel) {
      audioInDecel = true;
      var now = actx.currentTime;
      gNormal.gain.cancelScheduledValues(now); gDecel.gain.cancelScheduledValues(now);
      gNormal.gain.linearRampToValueAtTime(0.12, now + 0.3);
      gDecel.gain.linearRampToValueAtTime(1.0,  now + 0.3);
      if (decelNode) { try { decelNode.stop(); } catch(e) {} }
      decelNode = actx.createBufferSource();
      decelNode.buffer = decelBuf; decelNode.loop = true;
      decelNode.playbackRate.value = fhr < 60 ? 0.65 : fhr < 80 ? 0.80 : 0.95;
      decelNode.detune.value       = fhr < 60 ? -600  : fhr < 80 ? -300  : -100;
      decelNode.connect(gDecel); decelNode.start();
    } else if (drop < 30 && audioInDecel) {
      audioInDecel = false;
      var now2 = actx.currentTime;
      gNormal.gain.cancelScheduledValues(now2); gDecel.gain.cancelScheduledValues(now2);
      gNormal.gain.linearRampToValueAtTime(1.0, now2 + 0.5);
      gDecel.gain.linearRampToValueAtTime(0.0,  now2 + 0.5);
    }
    if (!audioInDecel) audioBaseline = audioBaseline * 0.995 + fhr * 0.005;
  }

  // Init eagerly so buffers are already loaded when the gesture arrives
  audioInit();

  // audioUnlock() MUST be called inside a real user-gesture handler on iOS —
  // that is the only way actx.resume() is allowed to succeed.
  function audioUnlock() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    if (!actx) audioInit();
    if (!actx) return;
    actx.resume().then(function() {
      if (isRunning || audioPendingStart) audioStart();
    }).catch(function() {});
  }
  // touchstart unlock — skip mute button so muting doesn't immediately un-mute via autostart
  document.addEventListener('touchstart', function(e) {
    var mb = g('mbtn'); if (mb && (e.target === mb || mb.contains(e.target))) return;
    audioUnlock();
  }, { passive: true });
  document.addEventListener('click', audioUnlock);

  // ── Mute button ────────────────────────────────────────────────────────────
  var isMuted = false;
  function toggleMute() {
    isMuted = !isMuted;
    if (gMaster) gMaster.gain.value = isMuted ? 0 : 1;
    g('mbtn').textContent = isMuted ? '🔇' : '🔊';
  }
  g('mbtn').addEventListener('click', function(e) {
    e.stopPropagation();
    toggleMute(); // flip muted state FIRST
    // then unlock audio if not yet unlocked (muted state is already set so autostart skips)
    if (!audioUnlocked) {
      audioUnlocked = true;
      if (!actx) audioInit();
      actx.resume().then(function() {
        if (!isMuted && (isRunning || audioPendingStart)) audioStart();
      }).catch(function() {});
    }
  });

  // ── labs ───────────────────────────────────────────────────────────────────
  var labsData = null, labsAbn = [], curLabTab = 'cbc';

  var LAB_TABS = {
    cbc:  [{k:'wbc',l:'WBC',s:'cbc',dig:1},{k:'rbc',l:'RBC',s:'cbc',dig:2},{k:'hgb',l:'HGB',s:'cbc',dig:1},
           {k:'hct',l:'HCT',s:'cbc',dig:1},{k:'mcv',l:'MCV',s:'cbc',dig:1},{k:'mch',l:'MCH',s:'cbc',dig:1},
           {k:'mchc',l:'MCHC',s:'cbc',dig:1},{k:'plt',l:'PLT',s:'cbc',dig:0},{k:'mpv',l:'MPV',s:'cbc',dig:1},{k:'rdw',l:'RDW',s:'cbc',dig:1}],
    chem: [{k:'na',l:'NA',s:'chemistry',dig:0},{k:'k',l:'K',s:'chemistry',dig:1},{k:'cl',l:'CL',s:'chemistry',dig:0},
           {k:'glu',l:'GLU',s:'chemistry',dig:0},{k:'bun',l:'BUN',s:'chemistry',dig:1},{k:'cre',l:'CRE',s:'chemistry',dig:2},
           {k:'ca',l:'CA',s:'chemistry',dig:1},{k:'p',l:'P',s:'chemistry',dig:1},{k:'tp',l:'TP',s:'chemistry',dig:1},
           {k:'alb',l:'ALB',s:'chemistry',dig:1},{k:'alt',l:'ALT',s:'chemistry',dig:0},{k:'ast',l:'AST',s:'chemistry',dig:0},
           {k:'alk_p',l:'ALK.P',s:'chemistry',dig:0},{k:'ggtp',l:'GGTP',s:'chemistry',dig:0},{k:'t_bil',l:'T.BIL',s:'chemistry',dig:2},
           {k:'d_bil',l:'D.BIL',s:'chemistry',dig:2},{k:'ldh',l:'LDH',s:'chemistry',dig:0},{k:'ur_ac',l:'UR.AC',s:'chemistry',dig:1},
           {k:'mg',l:'MG',s:'chemistry',dig:1}],
    coag: [{k:'pt_pct',l:'PT%',s:'coagulation',dig:1},{k:'inr',l:'INR',s:'coagulation',dig:2},{k:'ptt',l:'PTT',s:'coagulation',dig:1},
           {k:'d_dimer',l:'DIMER',s:'coagulation',dig:2},{k:'fib',l:'FIB',s:'coagulation',dig:0},{k:'tt',l:'TT',s:'coagulation',dig:1},
           {k:'bt',l:'BT',s:'coagulation',dig:0}],
  };

  function renderLabTab() {
    if (!labsData) return;
    var el = g('ltable');
    if (curLabTab === 'other') {
      var rows2 = [], ot2 = labsData.other || {};
      if (ot2.crp !== undefined) rows2.push(['CRP', parseFloat(ot2.crp).toFixed(2), 'MG/DL', labsAbn.indexOf('crp') >= 0]);
      if (ot2.protein_creatinine_ratio !== undefined) rows2.push(['PROTEIN/CREATININE', String(ot2.protein_creatinine_ratio), 'mg/g', labsAbn.indexOf('protein_creatinine_ratio') >= 0]);
      if (!rows2.length) { el.innerHTML = '<div style="padding:14px;text-align:center;color:#4b5563;font-size:.8rem">אין תוצאות</div>'; return; }
      var h2 = '<table><thead><tr><th style="text-align:right">בדיקה</th><th>תוצאה</th><th>יחידות</th></tr></thead><tbody>';
      rows2.forEach(function(r) { h2 += '<tr><td class="meta">'+r[0]+'</td><td class="'+(r[3]?'labn':'')+'">'+r[1]+'</td><td class="meta" style="text-align:center">'+r[2]+'</td></tr>'; });
      el.innerHTML = h2 + '</tbody></table>'; return;
    }
    var cols = LAB_TABS[curLabTab];
    var filled = cols.filter(function(c) { var sec = labsData[c.s]; return sec && sec[c.k] !== undefined && sec[c.k] !== null; });
    if (!filled.length) { el.innerHTML = '<div style="padding:14px;text-align:center;color:#4b5563;font-size:.8rem">אין תוצאות</div>'; return; }
    var h = '<table><thead><tr><th style="text-align:right">תאריך שעה</th><th>חומר</th>';
    filled.forEach(function(c) { h += '<th>'+c.l+'</th>'; });
    h += '</tr></thead><tbody><tr><td class="meta">'+fmt(simTime)+'</td><td class="meta" style="text-align:center">דם</td>';
    filled.forEach(function(c) {
      var raw = labsData[c.s][c.k];
      var val = c.dig === 0 ? String(Math.round(raw)) : parseFloat(raw).toFixed(c.dig);
      h += '<td class="'+(labsAbn.indexOf(c.k) >= 0 ? 'labn' : '')+'">'+val+'</td>';
    });
    g('ltable').innerHTML = h + '</tr></tbody></table>';
  }

  function setLabs(labs, abn) {
    if (!labs) return;
    labsData = labs; labsAbn = abn || [];
    var hasAny = (labs.cbc && Object.keys(labs.cbc).length) ||
                 (labs.chemistry && Object.keys(labs.chemistry).length) ||
                 (labs.coagulation && Object.keys(labs.coagulation).length) ||
                 (labs.other && Object.keys(labs.other).length);
    if (!hasAny) return;
    g('lsec').style.display = '';
    renderLabTab();
  }

  // Tab button click handlers (null-guarded in case of stale cached HTML)
  ['cbc','chem','coag','other'].forEach(function(tab) {
    var btn = g('ltab-'+tab);
    if (!btn) return;
    btn.addEventListener('click', function() {
      curLabTab = tab;
      ['cbc','chem','coag','other'].forEach(function(t) {
        var b = g('ltab-'+t); if (b) b.className = 'ltab' + (t === tab ? ' act' : '');
      });
      renderLabTab();
    });
  });

  // ── snapshot ───────────────────────────────────────────────────────────────
  function applySnap(snap) {
    if (!snap || snap.type !== 'state-snapshot') return;
    var d = snap.structuredData;
    if (d) {
      if (d.ctg) {
        var prevFreq = ctgP.contraction_frequency;
        ctgP = d.ctg;
        // Clear TOCO only when frequency changes (different period = stale shape)
        if (ctgP.contraction_frequency !== prevFreq) tocoBuf = [];
        // FHR: let new samples using updated ctgP scroll in naturally — no buffer clear
      }
      setVitals(d.vitals);
      setPatient(d.patient);
      if (d.clinical_description) { g('dtxt').textContent=d.clinical_description; g('dsec').style.display=''; }
      setLabs(d.labs, d.abnormal_fields);
    }
    if (snap.cardNumber && snap.cardNumber > 0) {
      g('cnum').textContent=snap.cardNumber; g('cbadge').style.display=''; g('cwait').style.display='none';
    }
    if (!stateInit && snap.simTimeSeconds !== undefined) {
      simTime=snap.simTimeSeconds; simTimeMs=simTime*1000; g('tdisp').textContent=fmt(simTime); stateInit=true;
    }
    if (snap.isRunning && !isRunning) { isRunning=true; startTimer(); if (audioUnlocked) audioStart(); }
    if (!snap.isRunning && isRunning) { isRunning=false; stopTimer(); audioStop(); }
    if (snap.isEnded) { isRunning=false; stopTimer(); audioStop(); g('ended').className='ended show'; }
  }

  // ── polling ────────────────────────────────────────────────────────────────
  function poll() {
    pollN++;
    g('dn').textContent='('+pollN+')';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/sim-state/'+CODE, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) { g('ddb').textContent='DB:e'+xhr.status; return; }
      try {
        var data = JSON.parse(xhr.responseText);
        var tag = data.dbOk ? 'db' : 'mem';
        if (!data.payload) { g('ddb').textContent='DB:'+tag+':null'; return; }
        if (data.updatedAt === lastAt) { g('ddb').textContent='DB:'+tag+':same'; return; }
        lastAt = data.updatedAt;
        g('ddb').textContent='DB:'+tag+':got'; g('dbg').className='ok';
        applySnap(data.payload);
      } catch(e) { g('ddb').textContent='DB:parse-err'; }
    };
    xhr.send();
  }
  poll();
  setInterval(poll, 2000);

  // ── CTG canvas ─────────────────────────────────────────────────────────────
  var canvas = g('ctg');
  var ctx    = canvas.getContext('2d');
  var fhrBuf = [], mhrBuf = [], tocoBuf = [];
  var ampMap = { absent:0, minimal:1, reduced:8, normal:10, saltatory:25, marked:15 };

  // 5-minute rolling window — matches the React CTGMonitor's VISIBLE_SECONDS=300.
  // At 10 samples/sec this is 3000 samples. For a contraction every 2 min the full
  // bell shape (600 px wide at ~0.3 px/sample on a 900 px canvas) is clearly visible.
  var TARGET_SECS = 100;
  var SAMPLES_PER_SEC = 10; // one sample every 100ms
  var MAX_SAMPLES = TARGET_SECS * SAMPLES_PER_SEC; // 3000

  var dpr = window.devicePixelRatio || 1; // Retina support
  var cssW = 300, cssH = 300; // CSS dimensions (used for drawing coords)

  function resizeCanvas() {
    var wrap = g('ctgwrap');
    cssW = wrap.offsetWidth  || 300;
    cssH = wrap.offsetHeight || 300;
    // Set physical pixels for sharp rendering on Retina/HiDPI
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale all drawing to CSS pixels
    fhrBuf = []; mhrBuf = []; tocoBuf = [];
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 30);

  function nextFHR() {
    var base = ctgP.fhr_baseline || 140;
    var amp  = ampMap[ctgP.fhr_variability] !== undefined ? ampMap[ctgP.fhr_variability] : 10;
    // Use absolute sim time so waveform phase matches the instructor's React CTGMonitor
    var tMs  = simTimeMs;

    // Band-limited noise — same frequencies as React WaveformGenerator
    var noise = amp * (
      Math.sin(tMs * 0.003)  * 0.40 +
      Math.sin(tMs * 0.007)  * 0.30 +
      Math.sin(tMs * 0.013)  * 0.20 +
      (Math.random() - 0.5)  * 0.30
    );

    // Accelerations: periodic bump every ~150 sec, lasting 20 sec (+18–26 bpm)
    var accel = 0;
    if (ctgP.accelerations === 'present') {
      var accPhase = tMs % 150000;
      if (accPhase < 20000) {
        accel = (18 + Math.random() * 8) * Math.sin((accPhase / 20000) * Math.PI);
      }
    }

    // Decelerations — matches React WaveformGenerator.computeDeceleration exactly
    var decel = 0;
    var dType = ctgP.decelerations;
    if (dType && dType !== 'none') {
      var dFreq    = ctgP.contraction_frequency > 0 ? ctgP.contraction_frequency : 3;
      var dPeriod  = (10 * 60000) / dFreq;
      var dPhase   = (tMs % dPeriod) / dPeriod;
      var depth    = ctgP.deceleration_depth || 30;
      if (dType === 'early') {
        decel = -depth * Math.exp(-((dPhase - 0.5) * (dPhase - 0.5)) / (2 * 0.01));
      } else if (dType === 'late') {
        if (dPhase >= 0.55 && dPhase <= 0.88) {
          var lp = (dPhase - 0.55) / 0.33;
          decel = -depth * Math.sin(lp * Math.PI);
        }
      } else if (dType === 'variable_mild') {
        if (dPhase >= 0.28 && dPhase <= 0.58) {
          var lp2 = (dPhase - 0.28) / 0.30;
          var nadir = lp2 < 0.4 ? lp2 / 0.4 : 1 - (lp2 - 0.4) / 0.6;
          decel = -20 * nadir;
        }
      } else if (dType === 'variable_moderate') {
        if (dPhase >= 0.28 && dPhase <= 0.58) {
          var lp3 = (dPhase - 0.28) / 0.30;
          var nadir3 = lp3 < 0.4 ? lp3 / 0.4 : 1 - (lp3 - 0.4) / 0.6;
          decel = -depth * nadir3;
        }
      } else if (dType === 'variable_severe') {
        var sevPeriod = 150000;
        var sevPhase  = (tMs % sevPeriod) / sevPeriod;
        if (sevPhase >= 0.28 && sevPhase <= 0.58) {
          var lp4 = (sevPhase - 0.28) / 0.30;
          var nadir4 = lp4 < 0.4 ? lp4 / 0.4 : 1 - (lp4 - 0.4) / 0.6;
          decel = -Math.max(depth, 60) * nadir4;
        }
      } else if (dType === 'prolonged') {
        var longPeriod = dPeriod * 4;
        var longPhase  = (tMs % longPeriod) / longPeriod;
        if (longPhase < 0.12) decel = -65;
        else if (longPhase < 0.22) decel = -65 * (1 - (longPhase - 0.12) / 0.10);
      }
    }

    return Math.max(50, Math.min(210, base + noise + accel + decel));
  }

  function nextMHR() {
    var base = ctgP.mhr_baseline || vit.hr || 75;
    return base + 2 * Math.sin(Date.now() * 0.0005) + Math.random() * 2 - 1;
  }

  function nextTOCO() {
    var freq = ctgP.contraction_frequency || 0;
    if (freq <= 0) return 0;
    var timeMs   = simTimeMs;
    var periodMs = (10 * 60000) / freq;
    var phase    = (timeMs % periodMs) / periodMs; // 0–1 within one cycle
    var intens   = ctgP.contraction_intensity || 'moderate';
    var peakAmp  = intens === 'mild' ? 29 : intens === 'strong' ? 68 : 49; // matches React
    var sigmaFrac = 15000 / periodMs; // matches React: sigmaMs=15000
    var baseline  = 8 + (Math.random() - 0.5) * 2;
    var gaussian  = peakAmp * Math.exp(-((phase - 0.5) * (phase - 0.5)) / (2 * sigmaFrac * sigmaFrac));
    var noiseScale = 1 - Math.min(0.85, gaussian / peakAmp);
    var noise = (Math.random() - 0.5) * 4 * noiseScale;
    return Math.max(0, Math.round(gaussian + baseline + noise));
  }

  function drawCTG() {
    var w = cssW, h = cssH;
    if (!w || !h) return;
    var fH = Math.round(h * 0.65);
    var tH = h - fH - 2; // TOCO channel height (2px gap below FHR)
    var tY = fH + 2;     // TOCO channel top y

    if (isRunning) {
      var nf = nextFHR(), nm = nextMHR(), nt = nextTOCO();
      setFHR(nf);
      fhrBuf.push(nf); mhrBuf.push(nm); tocoBuf.push(nt);
      simTimeMs += 100; // advance absolute sim time by one sample (100 ms)
      // Keep only MAX_SAMPLES — fixed time window regardless of screen width
      if (fhrBuf.length  > MAX_SAMPLES) fhrBuf  = fhrBuf.slice(fhrBuf.length  - MAX_SAMPLES);
      if (mhrBuf.length  > MAX_SAMPLES) mhrBuf  = mhrBuf.slice(mhrBuf.length  - MAX_SAMPLES);
      if (tocoBuf.length > MAX_SAMPLES) tocoBuf = tocoBuf.slice(tocoBuf.length - MAX_SAMPLES);
    }

    // Pixels per sample: spread MAX_SAMPLES evenly across full canvas width
    var pps = w / MAX_SAMPLES;

    // ── background ───────────────────────────────────────────────────────────
    ctx.fillStyle = '#020209';
    ctx.fillRect(0, 0, w, fH);
    ctx.fillStyle = '#111128';
    ctx.fillRect(0, tY, w, tH);

    // ── FHR grid ─────────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(139,92,246,.08)'; ctx.lineWidth = 1;
    var lines = [60,80,100,120,140,160,180,200];
    for (var i=0;i<lines.length;i++) {
      var gy = fH - (lines[i]-50)/160*fH;
      if (gy>=0 && gy<=fH) {
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(w,gy); ctx.stroke();
        ctx.fillStyle='rgba(139,92,246,.35)'; ctx.font='9px monospace';
        ctx.fillText(lines[i], 2, gy-2);
      }
    }

    // ── dashed threshold lines at 110 and 160 bpm ────────────────────────────
    ctx.save();
    ctx.strokeStyle = 'rgba(234,179,8,0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 5]);
    var thresh = [110, 160];
    for (var t=0;t<thresh.length;t++) {
      var ty2 = fH - (thresh[t]-50)/160*fH;
      ctx.beginPath(); ctx.moveTo(0,ty2); ctx.lineTo(w,ty2); ctx.stroke();
    }
    ctx.restore();

    // ── divider ───────────────────────────────────────────────────────────────
    ctx.strokeStyle='rgba(139,92,246,.2)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,fH); ctx.lineTo(w,fH); ctx.stroke();

    // ── MHR (faint yellow) in FHR channel ────────────────────────────────────
    if (mhrBuf.length > 1) {
      ctx.beginPath(); ctx.strokeStyle='rgba(234,179,8,0.45)'; ctx.lineWidth=1;
      var mOffset = MAX_SAMPLES - mhrBuf.length;
      for (var k=0;k<mhrBuf.length;k++) {
        var mx = (mOffset + k) * pps;
        var my = fH - (mhrBuf[k]-50)/160*fH;
        if (k===0) ctx.moveTo(mx,my); else ctx.lineTo(mx,my);
      }
      ctx.stroke();
    }

    // ── FHR line (bright green) ───────────────────────────────────────────────
    if (fhrBuf.length > 1) {
      ctx.beginPath(); ctx.strokeStyle='#22c55e'; ctx.lineWidth=2;
      var fOffset = MAX_SAMPLES - fhrBuf.length; // left-pad when buffer not full yet
      for (var j=0;j<fhrBuf.length;j++) {
        var fx = (fOffset + j) * pps;
        var fy = fH - (fhrBuf[j]-50)/160*fH;
        if (j===0) ctx.moveTo(fx,fy); else ctx.lineTo(fx,fy);
      }
      ctx.stroke();
    }

    // ── TOCO channel grid (0-100 mmHg) ───────────────────────────────────────
    ctx.strokeStyle = 'rgba(80,80,130,0.4)'; ctx.lineWidth = 1;
    var tocoLines = [0,20,40,60,80,100];
    for (var g2=0;g2<tocoLines.length;g2++) {
      var tgy = tY + tH * (1 - tocoLines[g2]/100);
      ctx.beginPath(); ctx.moveTo(0,tgy); ctx.lineTo(w,tgy); ctx.stroke();
    }
    ctx.fillStyle='rgba(156,163,175,0.4)'; ctx.font='8px monospace';
    var tocoLabels = [20,40,60,80];
    for (var gl=0;gl<tocoLabels.length;gl++) {
      ctx.fillText(tocoLabels[gl], 2, tY + tH*(1 - tocoLabels[gl]/100) - 1);
    }

    // ── TOCO trace (white) ────────────────────────────────────────────────────
    if (tocoBuf.length > 1) {
      ctx.beginPath(); ctx.strokeStyle='rgba(241,245,249,0.85)'; ctx.lineWidth=1.5;
      var tOffset = MAX_SAMPLES - tocoBuf.length;
      for (var q=0;q<tocoBuf.length;q++) {
        var qx = (tOffset + q) * pps;
        var qy = tY + tH * (1 - tocoBuf[q]/100);
        if (q===0) ctx.moveTo(qx,qy); else ctx.lineTo(qx,qy);
      }
      ctx.stroke();
    }
  }

  setInterval(drawCTG, 100);
})();
</script>
</body>
</html>`;
}
