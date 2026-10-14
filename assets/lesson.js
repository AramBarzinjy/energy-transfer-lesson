/* Shared lesson engine. Each topic page sets <body data-lesson="storage-key">,
   marks screens with <section class="screen" data-sec data-name [data-blurb]>,
   and uses the generic components below (data-model, .mcq, .num, .hintbox,
   [data-steps], .picker, .stepper, .flashdeck, .matcher). */
(function(){
const KEY=document.body.dataset.lesson;
const SKEY='lessons-settings-v1';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const screens={}; const SECS=$$('section.screen').map(s=>{screens[s.dataset.sec]=s; return s.dataset.sec;});
const COUNTED=$$('[data-complete]').map(b=>b.dataset.complete);
const DEF={size:'m',spacing:'normal',focus:'off',motion:'on',sound:'off'};
let st={sec:SECS[0],done:{},q:{}};
try{const s=JSON.parse(localStorage.getItem(KEY)||'null'); if(s) st=Object.assign(st,s);}catch(e){}
let set=Object.assign({},DEF);
try{const s=JSON.parse(localStorage.getItem(SKEY)||'null'); if(s) Object.assign(set,s); else if(st.set) Object.assign(set,st.set);}catch(e){}
const returning = st.sec!==SECS[0] || Object.keys(st.q).length>0;
function save(){try{localStorage.setItem(KEY,JSON.stringify({sec:st.sec,done:st.done,q:st.q,total:COUNTED.length}));}catch(e){}}
function saveSet(){try{localStorage.setItem(SKEY,JSON.stringify(set));}catch(e){}}
const json=el=>{const s=el&&$('script[type="application/json"]',el); return s?JSON.parse(s.textContent):null;};

/* sound: off by default, soft sine tones */
let ac=null;
function tone(kind){ if(set.sound!=='on') return; try{
  ac=ac||new (window.AudioContext||window.webkitAudioContext)();
  const seq = kind==='good'?[523,659]:kind==='done'?[523,659,784]:[440];
  seq.forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain(); o.type='sine'; o.frequency.value=f;
    const t=ac.currentTime+i*0.11; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.05,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t+0.25);});
}catch(e){} }

/* settings (shared by every topic) */
function applySettings(){ const r=document.documentElement;
  r.dataset.size=set.size; r.dataset.spacing=set.spacing; r.dataset.focus=set.focus; r.dataset.motion=set.motion;
  $$('[data-setting]').forEach(g=>$$('button',g).forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.v===set[g.dataset.setting])))); }
$$('[data-setting]').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return; set[g.dataset.setting]=b.dataset.v; applySettings(); saveSet(); if(g.dataset.setting==='sound') tone('good');}));
const dlg=$('#settings');
$('#openSettings').onclick=()=>{ if(dlg.showModal) dlg.showModal(); else dlg.setAttribute('open',''); };
$('#closeSettings').onclick=()=>dlg.close ? dlg.close() : dlg.removeAttribute('open');
applySettings();

/* nav */
const tabs=$('#tabs'), map=$('#map');
const nm=k=>screens[k].dataset.name;
SECS.forEach(k=>{const b=document.createElement('button'); b.dataset.go=k; b.innerHTML=nm(k)+'<span class="tick" aria-hidden="true"></span>'; tabs.appendChild(b);
  const bl=screens[k].dataset.blurb; if(bl&&map){const m=document.createElement('button'); m.dataset.go=k; m.innerHTML='<span class="k">'+nm(k)+'</span><span class="small muted">'+bl+'</span><span class="small" data-mapstate="'+k+'"></span>'; map.appendChild(m);} });
function go(k,focusEl){ if(!screens[k]) k=SECS[0]; SECS.forEach(s=>screens[s].hidden=s!==k); st.sec=k; save();
  $$('button',tabs).forEach(b=>b.setAttribute('aria-current',String(b.dataset.go===k)));
  if(k==='R') buildRevision();
  if(focusEl){ focusEl.scrollIntoView({block:'center'}); focusEl.classList.add('anim'); const f=$('input,textarea,select,button',focusEl); if(f) f.focus({preventScroll:true}); }
  else { window.scrollTo(0,0); const h=$('h1,h2',screens[k]); if(h){h.tabIndex=-1; h.focus({preventScroll:true});} }
  const t=tabs.querySelector('[aria-current="true"]'); if(t) t.scrollIntoView({block:'nearest',inline:'nearest'});
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]'); if(b){go(b.dataset.go);} });
function refreshProgress(){ const n=COUNTED.filter(k=>st.done[k]).length; $('#progfill').style.width=(n/COUNTED.length*100)+'%';
  $('.prog').setAttribute('aria-valuenow',Math.round(n/COUNTED.length*100)); $('#progtxt').textContent=n+' of '+COUNTED.length+' sections';
  $$('button',tabs).forEach(b=>{$('.tick',b).textContent=st.done[b.dataset.go]?' ✓':'';});
  $$('[data-mapstate]').forEach(s=>s.textContent=st.done[s.dataset.mapstate]?'✓ Done':'');
  $$('[data-complete]').forEach(b=>{const k=b.dataset.complete; b.textContent=st.done[k]?'✓ Done. Tap to undo':(b.dataset.label||'Mark section '+k+' done');});
}
$$('[data-complete]').forEach(b=>{b.dataset.label=b.textContent; b.addEventListener('click',()=>{const k=b.dataset.complete; st.done[k]=!st.done[k]; save(); refreshProgress(); if(st.done[k]) tone('done');});});

/* resume */
if(returning && $('#resumeBox')){ $('#resumeBox').hidden=false;
  $('#resumeTxt').textContent=' Last time you were on: '+(screens[st.sec]?nm(st.sec).replace('&amp;','&'):'the start')+'.'; const target=st.sec; $('#resumeBtn').onclick=()=>go(target); }

function rec(card,patch){const id=card.dataset.q; st.q[id]=Object.assign(st.q[id]||{},patch,{label:card.dataset.label}); save();}
function result(card,ok){const prev=st.q[card.dataset.q]||{}; rec(card,{tried:true,result: ok ? (prev.result==='wrong'||prev.result==='fixed'?'fixed':'right') : 'wrong'}); tone(ok?'good':'reveal');}

/* model-answer reveal + self rating */
$$('[data-model]').forEach(btn=>{ const card=btn.closest('.card'); const body=btn.nextElementSibling;
  const rate=document.createElement('div'); rate.className='rate'; rate.hidden=true;
  rate.innerHTML='<span class="small">How did you do?</span><button class="btn quiet" data-r="got">Got it</button><button class="btn quiet" data-r="partly">Partly</button><button class="btn quiet" data-r="not">Not yet</button>';
  body.after(rate); btn.setAttribute('aria-expanded','false'); const lbl=btn.textContent;
  btn.addEventListener('click',()=>{ const open=body.hidden; body.hidden=!open; rate.hidden=!open; btn.setAttribute('aria-expanded',String(open));
    btn.textContent=open?'Hide answer':lbl; if(open){ body.classList.add('anim'); tone('reveal'); rec(card,{tried:true});} });
  rate.addEventListener('click',e=>{const b=e.target.closest('[data-r]'); if(!b) return; rec(card,{rating:b.dataset.r}); paintRate(card);});
});
function paintRate(card){const r=(st.q[card.dataset.q]||{}).rating; $$('[data-r]',card).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.r===r)));}

/* multiple choice */
$$('.mcq').forEach(card=>{ const fb=$('.fb',card), ans=card.dataset.answer;
  $$('.opts button',card).forEach(b=>b.addEventListener('click',()=>{ const ok=b.dataset.o===ans;
    $$('.opts button',card).forEach(x=>x.classList.remove('right','wrong')); b.classList.add(ok?'right':'wrong');
    fb.hidden=false; fb.className='fb anim '+(ok?'good':'nope'); fb.innerHTML='<span class="verdict">'+(ok?'✓ Correct':'✗ Not quite')+'</span> '+b.dataset.fb.replace(/^Correct\.\s*/,'')+(ok?'':' <span class="muted">Try another option.</span>');
    result(card,ok); })); });

/* numeric answers */
function parseNum(v){ v=String(v).replace(/[,\s%]/g,'').replace(/[×x]10\^?/i,'e'); const n=parseFloat(v); return isNaN(n)?null:n; }
$$('.num').forEach(card=>{ const inp=$('input.numin',card), fb=$('.fb',card), a=parseFloat(card.dataset.answer), tol=parseFloat(card.dataset.tol||'0.01');
  const also=(card.dataset.also||'').split(',').filter(Boolean).map(Number);
  const traps=card.dataset.traps?JSON.parse(card.dataset.traps):[];
  const check=()=>{ const n=parseNum(inp.value); fb.hidden=false; fb.classList.add('anim');
    if(n===null){fb.className='fb nope'; fb.innerHTML='<span class="verdict">Type a number first.</span>'; return;}
    let ok=Math.abs(n-a)<=tol || also.some(x=>Math.abs(n-x)<0.001); let msg='';
    if(!ok){ const t=traps.find(t=>n>=t[0]-1e-9&&n<=t[1]+1e-9); msg=t?t[2]:'Check your working, or use a hint below.'; }
    fb.className='fb '+(ok?'good':'nope'); fb.innerHTML='<span class="verdict">'+(ok?'✓ Correct':'✗ Not quite')+'</span> '+(ok?'Well done. Open the worked answer if you want to check your method.':msg);
    result(card,ok); };
  $('[data-check]',card).addEventListener('click',check); inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();check();}}); });

/* match each item to an answer with dropdowns */
$$('.matcher').forEach(card=>{ const fb=$('.fb',card);
  $('[data-mcheck]',card).addEventListener('click',()=>{ const sels=$$('select',card); let right=0;
    sels.forEach(s=>{ const ok=s.value===s.dataset.answer; if(ok) right++; s.style.borderColor= s.value ? (ok?'var(--ok)':'var(--bad)') : ''; });
    const ok=right===sels.length; fb.hidden=false; fb.className='fb anim '+(ok?'good':'nope');
    fb.innerHTML='<span class="verdict">'+(ok?'✓ All correct':'✗ '+right+' of '+sels.length+' correct')+'</span> '+(ok?(card.dataset.win||''):'Green borders are right; change the red ones and check again.');
    result(card,ok); }); });

/* graduated hints */
$$('.hintbox').forEach(box=>{ const hints=JSON.parse(box.dataset.hints); let i=0; const btn=$('[data-hint]',box);
  btn.addEventListener('click',()=>{ if(i>=hints.length) return; const d=document.createElement('div'); d.className='hint anim';
    d.innerHTML='<b>'+(i===hints.length-1?'Last hint':'Hint '+(i+1))+':</b> '+hints[i]; btn.before(d); i++; tone('reveal');
    btn.textContent= i<hints.length ? 'Show hint '+(i+1)+' of '+hints.length : 'No more hints'; btn.disabled=i>=hints.length;
    const card=box.closest('.card'); if(card&&card.dataset.q) rec(card,{hints:i}); });
  btn.textContent='Show hint 1 of '+hints.length; });

/* step-by-step list */
$$('[data-steps]').forEach(ol=>{ const items=$$('li',ol); items.forEach(li=>li.hidden=true); const card=ol.closest('.card');
  const next=$('[data-stepnext]',card), all=$('[data-stepall]',card); let i=0;
  const upd=()=>{ next.disabled=i>=items.length; all.disabled=i>=items.length; next.textContent=i>=items.length?'All steps shown':'Show step '+(i+1)+' of '+items.length; };
  next.onclick=()=>{ if(i<items.length){items[i].hidden=false; items[i].classList.add('anim'); i++; tone('reveal');} upd(); };
  all.onclick=()=>{ items.forEach(li=>li.hidden=false); i=items.length; upd(); }; upd(); });

/* picker: tap a label or part of a diagram to see its explanation; optional guided walk */
$$('.picker').forEach(pk=>{ const data=json(pk); const out=$('.picker-out',pk); const order=data._order||[]; let w=-1;
  const walkBtn=$('[data-walk]',pk);
  function pick(k){ if(!data[k]) return; out.innerHTML=data[k]; out.classList.remove('anim'); void out.offsetWidth; out.classList.add('anim');
    $$('.chips [data-pick]',pk).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pick===k)));
    $$('[data-hl]',pk).forEach(el=>{const on=el.dataset.hl.split(' ').includes(k); el.classList.toggle('on',on); el.classList.toggle('dim',!on);}); tone('reveal'); }
  pk.addEventListener('click',e=>{const t=e.target.closest('[data-pick]'); if(t){ w=order.indexOf(t.dataset.pick); pick(t.dataset.pick); updWalk(); }});
  $$('[data-pick]:not(button)',pk).forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault(); w=order.indexOf(el.dataset.pick); pick(el.dataset.pick); updWalk();}}));
  function updWalk(){ if(!walkBtn) return; walkBtn.textContent = w<0 ? 'Follow it step by step' : (w>=order.length-1 ? 'Start again from the beginning' : 'Next step ('+(w+2)+' of '+order.length+')'); }
  if(walkBtn){ walkBtn.addEventListener('click',()=>{ w = w>=order.length-1 ? 0 : w+1; pick(order[w]); updWalk(); }); updWalk(); }
  const clr=$('[data-clear]',pk); if(clr) clr.addEventListener('click',()=>{ w=-1; out.innerHTML=data._intro||''; $$('[data-hl]',pk).forEach(el=>el.classList.remove('on','dim')); $$('.chips [data-pick]',pk).forEach(b=>b.setAttribute('aria-pressed','false')); updWalk(); });
});

/* stepper: reveal a diagram one stage at a time */
$$('.stepper').forEach(sp=>{ const steps=json(sp).steps; const max=steps.length-1; let cs=0;
  const els=$$('[data-step]',sp), out=$('.stepper-out',sp), nx=$('[data-snext]',sp), al=$('[data-sall]',sp);
  const draw=()=>{ els.forEach(el=>el.style.opacity=(+el.dataset.step<=cs)?1:0.12); out.innerHTML=steps[cs]; nx.disabled=cs>=max; nx.textContent=cs>=max?'All steps shown':'Show next step'; };
  nx.onclick=()=>{cs=Math.min(max,cs+1); draw(); tone('reveal');}; al.onclick=()=>{cs=max; draw();}; draw(); });

/* flashcards */
$$('.flashdeck').forEach(fd=>{ const FC=json(fd); let fi=0, ff=false;
  const side=$('.fl-side',fd), face=$('.fl-face',fd), flip=$('[data-flip]',fd);
  const draw=()=>{ side.textContent=(ff?'Answer ':'Question ')+(fi+1)+' of '+FC.length; face.textContent=FC[fi][ff?1:0]; flip.textContent=ff?'Show question':'Show answer'; };
  flip.onclick=()=>{ff=!ff; draw(); if(ff) tone('reveal');};
  $('[data-fnext]',fd).onclick=()=>{fi=(fi+1)%FC.length; ff=false; draw();};
  $('[data-fprev]',fd).onclick=()=>{fi=(fi-1+FC.length)%FC.length; ff=false; draw();}; draw(); });

/* read aloud */
const canSpeak='speechSynthesis' in window;
$$('.listen').forEach(b=>{ if(!canSpeak){b.hidden=true; return;} b.addEventListener('click',()=>{ try{
  if(speechSynthesis.speaking){speechSynthesis.cancel(); b.textContent='Read aloud'; return;}
  const card=b.closest('.card').cloneNode(true); $$('button,.tag,svg,title,script,.fig',card).forEach(x=>x.remove());
  const t=card.textContent.replace(/\s+/g,' ').replace(/−/g,' minus ').replace(/m⁻²|m−2/g,'per metre squared').replace(/year⁻¹|year−1/g,'per year')
    .replace(/NO₃⁻|NO3−/g,'nitrate').replace(/NO₂⁻|NO2−/g,'nitrite').replace(/NH₄⁺/g,'ammonium').replace(/NH₃/g,'ammonia').replace(/N₂/g,'nitrogen gas');
  const u=new SpeechSynthesisUtterance(t); u.lang='en-GB'; u.rate=0.95; u.onend=()=>b.textContent='Read aloud'; b.textContent='Stop reading'; speechSynthesis.speak(u);
 }catch(e){ b.textContent='Read aloud unavailable here'; } }); });

/* revision */
function buildRevision(){ const list=$('#revList'); list.innerHTML='';
  const items=Object.entries(st.q).filter(([id,q])=>q.result==='wrong'||q.rating==='not'||q.rating==='partly');
  if(!items.length){ list.innerHTML='<div class="card"><p>Nothing to revisit yet. Questions you get wrong or mark "Not yet" will show up here.</p></div>'; }
  items.forEach(([id,q])=>{ const b=document.createElement('button'); b.className='btn quiet'; b.style.textAlign='left';
    const why=q.result==='wrong'?'last answer was wrong':(q.rating==='not'?'you marked "Not yet"':'you marked "Partly"');
    b.innerHTML='<b>'+q.label+'</b> <span class="muted small">· '+why+'</span>';
    b.onclick=()=>{ const c=$('.card[data-q="'+id+'"]'); if(!c) return; go(c.closest('section').dataset.sec,c); }; list.appendChild(b); });
  const pl=$('#progList'); const all=$$('.card[data-q]'); const tried=c=>(st.q[c.dataset.q]||{}).tried; const orig=all.filter(c=>$('.tag.orig',c));
  pl.innerHTML='<p>Sections done: <b>'+COUNTED.filter(k=>st.done[k]).length+' of '+COUNTED.length+'</b></p><p>Questions attempted: <b>'+all.filter(tried).length+' of '+all.length+'</b></p>'+
   '<p>Original exam questions attempted: <b>'+orig.filter(tried).length+' of '+orig.length+'</b></p>';
  COUNTED.forEach(k=>{ const p=document.createElement('p'); p.textContent=(st.done[k]?'✓ ':'○ ')+nm(k).replace('&amp;','&'); pl.appendChild(p); });
}
$('#resetBtn').onclick=()=>{$('#resetConfirm').hidden=false;};
$('#resetNo').onclick=()=>{$('#resetConfirm').hidden=true;};
$('#resetYes').onclick=()=>{ st.done={}; st.q={}; save(); $('#resetConfirm').hidden=true; refreshProgress(); $$('.card[data-q]').forEach(paintRate); buildRevision(); };

$$('.card[data-q]').forEach(paintRate);
refreshProgress();
const h=(location.hash||'').slice(1); go(SECS.includes(h)?h:SECS[0]);
})();
