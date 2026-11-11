/* Smart flashcards: spaced repetition (Leitner boxes), difficulty and section filters, self-marking by marking point.
   Needs window.DECK (assets/cards/<topic>.js). Progress is saved in this browser only. */
(function(){
const D=window.DECK, $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const LV={1:'Recall',2:'Apply',3:'Exam'}, LVD={1:'Definitions, colours, formulas · 1–2 marks',2:'Equations and short explanations · 1–2 marks',3:'AQA-style multi-mark and 6-mark answers'};
const CARDS=D.rows.map((r,i)=>({id:D.code+'-'+(i+1),n:i+1,lvl:r[0],sec:r[1],marks:r[2],q:r[3],pts:r[4],note:r[5]||'',nn:!!r[6]}));
const KEY='fc-'+D.key, DAY=864e5, GAP=[0,0,1,3,7,14,30];
let S={c:{},prefs:{levels:[1,2,3],secs:Object.keys(D.sections),mode:'smart',len:'20'}};
try{ const s=JSON.parse(localStorage.getItem(KEY)||'null'); if(s){ S.c=s.c||{}; Object.assign(S.prefs,s.prefs||{}); } }catch(e){}
const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){} };
try{ const g=JSON.parse(localStorage.getItem('lessons-settings-v1')||'null'); if(g){ const r=document.documentElement; r.dataset.size=g.size||'m'; r.dataset.spacing=g.spacing||'normal'; r.dataset.motion=g.motion||'on'; } }catch(e){}

const st=c=>S.c[c.id]||{box:0,due:0};
const status=c=>{ const b=st(c).box; return b===0?'new':b>=4?'mastered':'learning'; };
const isDue=c=>{ const s=S.c[c.id]; return !!s && s.due<=Date.now(); };
const chosen=()=>CARDS.filter(c=>S.prefs.levels.includes(c.lvl)&&S.prefs.secs.includes(c.sec));

/* ---------- setup screen */
const setup=$('#fc-setup'), play=$('#fc-play'), done=$('#fc-done');
function chip(attr,val,label,on,extra){ return `<button data-${attr}="${val}" aria-pressed="${on}">${label}${extra||''}</button>`; }
function renderSetup(){
  $('#fc-levels').innerHTML=[1,2,3].map(l=>{ const n=CARDS.filter(c=>c.lvl===l).length;
    return `<button class="lvlcard lv${l}" data-lvl="${l}" aria-pressed="${S.prefs.levels.includes(l)}"><span class="lvname">${LV[l]}</span><span class="small">${LVD[l]}</span><span class="small muted">${n} cards</span></button>`; }).join('');
  $('#fc-secs').innerHTML=Object.entries(D.sections).map(([k,t])=>chip('sec',k,t,S.prefs.secs.includes(k))).join('');
  $('#fc-mode').innerHTML=[['smart','Smart review'],['order','In order'],['shuffle','Shuffle']].map(([k,t])=>chip('mode',k,t,S.prefs.mode===k)).join('');
  $('#fc-len').innerHTML=[['10','10 cards'],['20','20 cards'],['all','All chosen']].map(([k,t])=>chip('len',k,t,S.prefs.len===k)).join('');
  const ch=chosen(), due=ch.filter(isDue).length, nw=ch.filter(c=>status(c)==='new').length;
  $('#fc-summary').innerHTML=`<b>${ch.length}</b> cards chosen · <b>${due}</b> due for review · <b>${nw}</b> new`;
  $('#fc-start').disabled=!ch.length;
  $('#fc-modehelp').textContent={smart:'Cards you got wrong or are due come first, then new ones. Cards you know well come back less often.',order:'Goes through the chosen cards in deck order, Recall → Apply → Exam.',shuffle:'Random order from the chosen cards.'}[S.prefs.mode];
  const t={new:0,learning:0,mastered:0}; CARDS.forEach(c=>t[status(c)]++);
  $('#fc-stats').innerHTML=[1,2,3].map(l=>{ const cs=CARDS.filter(c=>c.lvl===l), m=cs.filter(c=>status(c)==='mastered').length, le=cs.filter(c=>status(c)==='learning').length;
    return `<div class="statrow"><span class="lvtag lv${l}">${LV[l]}</span><div class="sbar" role="img" aria-label="${m} mastered, ${le} learning of ${cs.length}"><i class="m" style="width:${m/cs.length*100}%"></i><i class="l" style="width:${le/cs.length*100}%"></i></div><span class="small tabnum">${m}/${cs.length}</span></div>`; }).join('')+
    `<p class="small muted">Dark = mastered (got it 3+ times in a row) · light = learning · grey = not tried. ${t.mastered} of ${CARDS.length} mastered overall.</p>`;
}
setup.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const P=S.prefs;
  if(b.dataset.lvl){ const l=+b.dataset.lvl; P.levels=P.levels.includes(l)?P.levels.filter(x=>x!==l):[...P.levels,l].sort(); }
  if(b.dataset.sec){ const k=b.dataset.sec; P.secs=P.secs.includes(k)?P.secs.filter(x=>x!==k):[...P.secs,k]; }
  if(b.dataset.mode) P.mode=b.dataset.mode;
  if(b.dataset.len) P.len=b.dataset.len;
  if(b.id==='fc-allsecs') P.secs=Object.keys(D.sections);
  if(b.id==='fc-nosecs') P.secs=[];
  if(b.id==='fc-start') return start();
  if(b.id==='fc-reset'){ $('#fc-resetask').hidden=false; return; }
  if(b.id==='fc-resetno'){ $('#fc-resetask').hidden=true; return; }
  if(b.id==='fc-resetyes'){ S.c={}; $('#fc-resetask').hidden=true; }
  save(); renderSetup(); });

/* ---------- session */
let Q=[], i=0, tally={got:0,nearly:0,again:0}, shown=false;
function start(){
  let ch=chosen(); const P=S.prefs;
  if(P.mode==='shuffle') ch=ch.sort(()=>Math.random()-.5);
  if(P.mode==='smart'){ const now=Date.now();
    const due=ch.filter(c=>S.c[c.id]&&S.c[c.id].due<=now).sort((a,b)=>st(a).box-st(b).box||st(a).due-st(b).due);
    const nw=ch.filter(c=>!S.c[c.id]);
    const later=ch.filter(c=>S.c[c.id]&&S.c[c.id].due>now).sort((a,b)=>st(a).due-st(b).due);
    ch=[...due,...nw,...later]; }
  Q=P.len==='all'?ch:ch.slice(0,+P.len); i=0; tally={got:0,nearly:0,again:0};
  setup.hidden=true; done.hidden=true; play.hidden=false; show(); window.scrollTo(0,0); }
function show(){
  const c=Q[i]; shown=false;
  $('#fc-count').textContent=`Card ${i+1} of ${Q.length}`; $('#fc-pbar').style.width=(i/Q.length*100)+'%';
  $('#fc-badges').innerHTML=`<span class="lvtag lv${c.lvl}">${LV[c.lvl]}</span><span class="tag extra">${D.sections[c.sec]}</span><span class="marks">[${c.marks} mark${c.marks>1?'s':''}]</span>${c.nn?'<span class="tag new">Not in your notes yet</span>':''}<span class="cid">${c.id}</span>`;
  $('#fc-q').innerHTML=c.q;
  $('#fc-try').value=''; $('#fc-trywrap').hidden=c.lvl===1;
  $('#fc-back').hidden=true; $('#fc-flip').hidden=false; $('#fc-rate').hidden=true;
  const card=$('#fc-card'); card.classList.remove('flipped'); card.focus({preventScroll:true});
}
function flip(){ if(shown) return; shown=true; const c=Q[i];
  $('#fc-pts').innerHTML=c.pts.map((p,k)=>`<li><label><input type="checkbox" data-pt="${k}"> <span>${p}</span></label></li>`).join('');
  $('#fc-ptshelp').textContent=c.pts.length>1?`Tick each point you included. ${c.marks>c.pts.length?'':'Each point is worth 1 mark.'}`:'Tick it if your answer matched.';
  $('#fc-note').innerHTML=c.note?`<b>Examiner tip</b>${c.note}`:''; $('#fc-note').hidden=!c.note;
  $('#fc-back').hidden=false; $('#fc-flip').hidden=true; $('#fc-rate').hidden=false; $('#fc-suggest').textContent='';
  $('#fc-card').classList.add('flipped');
}
function suggest(){ const c=Q[i], n=$$('#fc-pts input:checked').length, tot=c.pts.length;
  const s=n===tot?'got':n===0?'again':'nearly';
  $('#fc-suggest').innerHTML=`You ticked ${n} of ${tot}. Suggested: <b>${{got:'Got it',nearly:'Nearly',again:'Again'}[s]}</b>`;
  $$('#fc-rate [data-r]').forEach(b=>b.classList.toggle('sugg',b.dataset.r===s)); }
function rate(r){ const c=Q[i], s=st(c); let box=s.box;
  if(r==='got') box=Math.min(6,box+1); else if(r==='nearly') box=Math.max(1,Math.min(box,3)); else box=1;
  const due=r==='again'?Date.now():Date.now()+GAP[box]*DAY;
  S.c[c.id]={box,due}; save(); tally[r]++;
  if(r==='again' && Q.slice(i+1).filter(x=>x===c).length<1) Q.splice(Math.min(Q.length,i+4),0,c);
  i++; if(i<Q.length) show(); else finish(); }
function finish(){ play.hidden=true; done.hidden=false; $('#fc-pbar').style.width='100%';
  $('#fc-result').innerHTML=`<p><b>${tally.got}</b> got it · <b>${tally.nearly}</b> nearly · <b>${tally.again}</b> again</p><p class="small muted">Cards you missed will come up first next time in Smart review.</p>`; renderSetup(); }
$('#fc-flip').addEventListener('click',flip);
$('#fc-card').addEventListener('click',e=>{ if(e.target.closest('input,textarea,button,label')) return; flip(); });
$('#fc-pts').addEventListener('change',suggest);
$('#fc-rate').addEventListener('click',e=>{ const b=e.target.closest('[data-r]'); if(b) rate(b.dataset.r); });
$('#fc-quit').addEventListener('click',()=>{ play.hidden=true; setup.hidden=false; renderSetup(); });
$('#fc-again').addEventListener('click',start);
$('#fc-back2').addEventListener('click',()=>{ done.hidden=true; setup.hidden=false; });
document.addEventListener('keydown',e=>{ if(play.hidden||e.target.closest('textarea,input[type=text]')) return;
  if(e.key===' '||e.key==='Enter'){ if(!shown){ e.preventDefault(); flip(); } }
  if(shown&&['1','2','3'].includes(e.key)) rate({1:'again',2:'nearly',3:'got'}[e.key]); });
renderSetup();
})();
