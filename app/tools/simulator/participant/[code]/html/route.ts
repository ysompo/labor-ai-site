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
#ctitle{color:#e2e8f0;font-weight:700;font-size:.88rem}
#cwait{color:#4b5563;font-size:.82rem}
#ccontent{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:12px}
.slbl{color:#7c3aed;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
#dtxt{color:#d1d5db;font-size:.85rem;line-height:1.7;white-space:pre-line}
#lgrid{display:flex;flex-wrap:wrap;gap:5px 12px}
.li{font-size:.8rem;display:flex;gap:3px;align-items:baseline}
.ln{color:#6b7280}
.lv{color:#e2e8f0;font-weight:500}
.lv.abn{color:#f87171;font-weight:700;text-decoration:underline}
.lu{color:#4b5563;font-size:.7rem}
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
    <span id="ctitle"></span>
    <span id="cwait">ממתין לנתונים קליניים...</span>
  </div>
  <div id="ccontent" dir="rtl">
    <div id="dsec" style="display:none">
      <div class="slbl">תיאור קליני</div>
      <div id="dtxt"></div>
    </div>
    <div id="lsec" style="display:none">
      <div class="slbl">תוצאות מעבדה</div>
      <div id="lgrid"></div>
      <div id="lbt" style="display:none;margin-top:5px;font-size:.82rem;color:#fbbf24"></div>
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
  var ctgP = { fhr_baseline:140, fhr_variability:'normal', accelerations:'present', decelerations:'none', mhr_baseline:75 };
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
  }

  // ── labs ───────────────────────────────────────────────────────────────────
  function setLabs(labs, abn) {
    if (!labs) return;
    var grid = g('lgrid'); grid.innerHTML = '';
    var rows = [];
    function p(key,lbl,obj,prop,unit,dig) {
      var v = obj && obj[prop];
      if (v !== undefined && v !== null) rows.push({key:key,lbl:lbl,val:parseFloat(v).toFixed(dig||1),unit:unit||''});
    }
    var cbc=labs.cbc||{}, ch=labs.chemistry||{}, co=labs.coagulation||{}, ot=labs.other||{};
    p('hgb','HGB',cbc,'hgb','g/dL'); p('plt','PLT',cbc,'plt','K/μL',0); p('wbc','WBC',cbc,'wbc','K/μL'); p('hct','HCT',cbc,'hct','%');
    p('cre','Cre',ch,'cre','mg/dL',2); p('ast','AST',ch,'ast','U/L',0); p('alt','ALT',ch,'alt','U/L',0);
    p('ldh','LDH',ch,'ldh','U/L',0); p('ur_ac','Uric',ch,'ur_ac','mg/dL'); p('alb','Alb',ch,'alb','g/dL');
    p('pt_pct','PT%',co,'pt_pct','%',0); p('inr','INR',co,'inr','',2); p('ptt','PTT',co,'ptt','sec',0);
    p('fib','Fib',co,'fib','mg/dL',0); p('d_dimer','D-dim',co,'d_dimer','μg/mL',2);
    p('crp','CRP',ot,'crp','mg/L'); p('protein_creatinine_ratio','P/C',ot,'protein_creatinine_ratio','',2);
    var abnArr = abn || [];
    for (var i=0;i<rows.length;i++) {
      var r=rows[i], isAbn=abnArr.indexOf(r.key)>=0;
      var s=document.createElement('span'); s.className='li';
      s.innerHTML='<span class="ln">'+r.lbl+':</span><span class="lv'+(isAbn?' abn':'')+'">'+r.val+'</span>'+(r.unit?'<span class="lu">'+r.unit+'</span>':'');
      grid.appendChild(s);
    }
    if (rows.length) g('lsec').style.display='';
    if (ot.blood_type) { g('lbt').textContent='סוג דם: '+ot.blood_type; g('lbt').style.display=''; }
  }

  // ── snapshot ───────────────────────────────────────────────────────────────
  function applySnap(snap) {
    if (!snap || snap.type !== 'state-snapshot') return;
    var d = snap.structuredData;
    if (d) {
      if (d.ctg) ctgP = d.ctg;
      setVitals(d.vitals);
      setPatient(d.patient);
      if (d.clinical_description) { g('dtxt').textContent=d.clinical_description; g('dsec').style.display=''; }
      if (d.card_title)           { g('ctitle').textContent=d.card_title; }
      setLabs(d.labs, d.abnormal_fields);
    }
    if (snap.cardNumber && snap.cardNumber > 0) {
      g('cnum').textContent=snap.cardNumber; g('cbadge').style.display=''; g('cwait').style.display='none';
    }
    if (!stateInit && snap.simTimeSeconds !== undefined) {
      simTime=snap.simTimeSeconds; g('tdisp').textContent=fmt(simTime); stateInit=true;
    }
    if (snap.isRunning && !isRunning) { isRunning=true; startTimer(); }
    if (snap.type === 'session-end') { isRunning=false; stopTimer(); g('ended').className='ended show'; }
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
  var fhrBuf = [], mhrBuf = [];
  var accelPh=0, accelTmr=0, decelPh=0, decelTmr=0;
  var ampMap = { minimal:1, reduced:3, normal:6, marked:12 };

  function resizeCanvas() {
    var wrap = g('ctgwrap');
    canvas.width  = wrap.offsetWidth  || 300;
    canvas.height = wrap.offsetHeight || 300;
    fhrBuf = []; mhrBuf = [];
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 30);

  function nextFHR() {
    var base = ctgP.fhr_baseline || 140;
    var amp  = ampMap[ctgP.fhr_variability] || 6;
    var t    = Date.now();
    var noise = amp * Math.sin(t * 0.0007) + amp * 0.4 * Math.sin(t * 0.0023);
    accelTmr--;
    var accel = 0;
    if (ctgP.accelerations === 'present') {
      if (accelTmr <= 0) { accelPh = Math.random() < 0.06 ? Math.PI : 0; accelTmr = 25 + Math.random()*80; }
      if (accelPh > 0)   { accel = 15 * Math.sin(accelPh); accelPh -= 0.15; if (accelPh<0) accelPh=0; }
    }
    decelTmr--;
    var decel = 0;
    if (ctgP.decelerations && ctgP.decelerations !== 'none') {
      if (decelTmr <= 0) { decelPh = Math.random() < 0.04 ? Math.PI : 0; decelTmr = 30 + Math.random()*120; }
      if (decelPh > 0)   { decel = -25 * Math.sin(decelPh); decelPh -= 0.1; if (decelPh<0) decelPh=0; }
    }
    return Math.max(50, Math.min(210, base + noise + accel + decel));
  }

  function nextMHR() {
    var base = ctgP.mhr_baseline || vit.hr || 75;
    return base + 2 * Math.sin(Date.now() * 0.0005) + Math.random() * 2 - 1;
  }

  function drawCTG() {
    var w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    var fH = Math.round(h * 0.65);
    var mH = h - fH;

    var nf = nextFHR(), nm = nextMHR();
    setFHR(nf);
    fhrBuf.push(nf); mhrBuf.push(nm);
    if (fhrBuf.length > w+10) fhrBuf = fhrBuf.slice(fhrBuf.length - w - 10);
    if (mhrBuf.length > w+10) mhrBuf = mhrBuf.slice(mhrBuf.length - w - 10);

    ctx.fillStyle = '#020209';
    ctx.fillRect(0, 0, w, h);

    // grid
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
    // divider
    ctx.strokeStyle='rgba(139,92,246,.2)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,fH); ctx.lineTo(w,fH); ctx.stroke();

    // FHR line
    if (fhrBuf.length > 1) {
      ctx.beginPath(); ctx.strokeStyle='#22c55e'; ctx.lineWidth=2;
      for (var j=0;j<fhrBuf.length;j++) {
        var fx = w - fhrBuf.length + j;
        var fy = fH - (fhrBuf[j]-50)/160*fH;
        if (j===0) ctx.moveTo(fx,fy); else ctx.lineTo(fx,fy);
      }
      ctx.stroke();
    }
    // MHR line
    if (mhrBuf.length > 1) {
      ctx.beginPath(); ctx.strokeStyle='#eab308'; ctx.lineWidth=1.5;
      for (var k=0;k<mhrBuf.length;k++) {
        var mx2 = w - mhrBuf.length + k;
        var my2 = fH + (mH - (mhrBuf[k]-30)/120*mH);
        if (k===0) ctx.moveTo(mx2,my2); else ctx.lineTo(mx2,my2);
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
