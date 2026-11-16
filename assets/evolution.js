/* Selection and speciation: interactive models.
   .selsim   natural selection simulator (peppered moths)
   .selcurve selection-types model (stabilising / directional / disruptive)
   .driftsim genetic drift and bottleneck simulator
   .hwgen    endless Hardy–Weinberg questions */
(function(){
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const calm=()=>document.documentElement.dataset.motion==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd=Math.random, pick=a=>a[Math.floor(rnd()*a.length)];
const pct=x=>Math.round(x*100)+'%';

/* small line chart: series = [{vals:[..], color, dash}] y 0..1 */
function lineChart(series,maxX,o){ o=o||{}; const W=420,H=200,L=48,R=410,T=12,B=170;
  const X=i=>L+(i/maxX)*(R-L), Y=v=>B-v*(B-T); let s='';
  [0,.25,.5,.75,1].forEach(v=>{ s+=`<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end" font-size="12" style="fill:var(--muted)">${v}</text>`; });
  for(let g=0;g<=maxX;g+=Math.max(5,Math.round(maxX/6/5)*5)) s+=`<text x="${X(g)}" y="${B+16}" text-anchor="middle" font-size="12" style="fill:var(--muted)">${g}</text>`;
  s+=`<text x="${(L+R)/2}" y="${H-2}" text-anchor="middle" font-size="12" style="fill:var(--ink)">generation</text>`;
  s+=`<text x="11" y="${(T+B)/2}" transform="rotate(-90 11 ${(T+B)/2})" text-anchor="middle" font-size="12" style="fill:var(--ink)">${o.ylab||'allele frequency'}</text>`;
  (o.marks||[]).forEach(m=>{ s+=`<line x1="${X(m.g)}" x2="${X(m.g)}" y1="${T}" y2="${B}" stroke="var(--heat)" stroke-dasharray="4 3"/><text x="${X(m.g)+4}" y="${T+12}" font-size="11" style="fill:var(--heat)">${m.t}</text>`; });
  series.forEach(sr=>{ if(!sr.vals.length) return; s+=`<polyline fill="none" stroke="${sr.color}" stroke-width="${sr.w||2.5}" ${sr.dash?'stroke-dasharray="5 4"':''} stroke-linejoin="round" points="${sr.vals.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}"/>`; });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label||'line graph'}">${s}</svg>`;
}

/* ---------------------------------------------------------------- 1 natural selection */
function makeSelSim(el){
  const N=80;
  el.innerHTML=`<div class="sim-grid"><div class="moth-bg" aria-hidden="true"></div><div class="sim-chart"></div></div>
   <div class="chips" role="group" aria-label="Tree bark"><button data-bark="clean">Clean, pale bark (lichen)</button><button data-bark="sooty">Sooty, dark bark (pollution)</button></div>
   <div class="row"><button class="btn solid" data-bird>Be the bird</button><button class="btn" data-gen>Let nature do it</button><button class="btn" data-run>Run 10 generations</button><button class="btn quiet" data-reset>Start again</button></div>
   <div class="fb explain sim-out" aria-live="polite"></div>`;
  const bg=$('.moth-bg',el), chart=$('.sim-chart',el), out=$('.sim-out',el);
  let bark='sooty', pop=[], hist=[], gen=0, busy=false, bird=false, eaten=0; const MEALS=30;
  const freqD=()=>pop.reduce((a,m)=>a+m.g[0]+m.g[1],0)/(2*pop.length);
  const make=pD=>Array.from({length:N},()=>mk([+(rnd()<pD),+(rnd()<pD)]));
  const mut=a=>rnd()<0.01?1-a:a;
  function mk(g){ return {g, dark:!!(g[0]||g[1]), x:4+rnd()*92, y:6+rnd()*86, r:rnd()*360, dead:false}; }
  function draw(){
    bg.className='moth-bg '+bark;
    bg.classList.toggle('hunting',bird); bg.innerHTML=pop.map((m,i)=>`<span data-i="${i}" class="moth ${m.dark?'d':'l'}${m.dead?' eaten':''}" style="left:${m.x}%;top:${m.y}%;transform:translate(-50%,-50%) rotate(${m.r}deg)"></span>`).join('');
    chart.innerHTML=lineChart([{vals:hist,color:'var(--leaf)'}],Math.max(20,hist.length),{label:'frequency of the dark allele over generations'});
    const dk=pop.filter(m=>m.dark).length;
    if(bird){ out.innerHTML=`<b>You are the bird.</b> Tap the moths you can spot to eat them: <b>${eaten} of ${MEALS}</b> eaten. The survivors breed when you finish.`; return; }
    out.innerHTML=`<b>Generation ${gen}</b> · dark moths <b>${pct(dk/N)}</b> · frequency of the dark allele <b>${freqD().toFixed(2)}</b><br><span class="small muted">${bark==='sooty'?'Pale moths stand out on sooty bark, so birds eat more of them.':'Dark moths stand out on pale bark, so birds eat more of them.'}</span>`;
  }
  function reset(){ gen=0; pop=make(bark==='sooty'?0.15:0.5); hist=[freqD()]; draw(); }
  function breedNow(){ let alive=pop.filter(m=>!m.dead); if(alive.length<2) alive=pop;
    pop=Array.from({length:N},()=>{ const a=pick(alive), b=pick(alive); return mk([mut(pick(a.g)),mut(pick(b.g))]); }); gen++; hist.push(freqD()); }
  bg.addEventListener('click',e=>{ const t=e.target.closest('.moth'); if(!bird||!t) return; const m=pop[+t.dataset.i]; if(m.dead) return;
    m.dead=true; eaten++; t.classList.add('eaten');
    if(eaten>=MEALS){ bird=false; eaten=0; const fin=()=>{ breedNow(); draw(); out.insertAdjacentHTML('afterbegin','<b>The survivors bred.</b> Did you mostly eat the moths that stood out? That is natural selection. Press “Be the bird” again for the next generation.<br>'); }; calm()?fin():setTimeout(fin,500); }
    else out.innerHTML=`<b>You are the bird.</b> Tap the moths you can spot to eat them: <b>${eaten} of ${MEALS}</b> eaten. The survivors breed when you finish.`; });
  function step(done){
    pop.forEach(m=>{ const hidden=(bark==='sooty')===m.dark; m.dead=rnd()<(hidden?0.15:0.6); });
    draw();
    const breed=()=>{ let alive=pop.filter(m=>!m.dead); if(alive.length<2) alive=pop;
      pop=Array.from({length:N},()=>{ const a=pick(alive), b=pick(alive); return mk([mut(pick(a.g)),mut(pick(b.g))]); });
      gen++; hist.push(freqD()); draw(); done&&done(); };
    calm()?breed():setTimeout(breed,650);
  }
  el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b||busy) return;
    if(b.dataset.bark){ bark=b.dataset.bark; $$('[data-bark]',el).forEach(x=>x.setAttribute('aria-pressed',String(x===b))); reset(); }
    if(b.hasAttribute('data-bird')){ bird=true; eaten=0; pop.forEach(m=>m.dead=false); draw(); return; }
    if(b.hasAttribute('data-gen')){ bird=false; busy=true; step(()=>busy=false); }
    if(b.hasAttribute('data-run')){ bird=false; busy=true; let k=0; const go=()=>{ if(k++<10) step(go); else busy=false; }; go(); }
    if(b.hasAttribute('data-reset')) reset(); });
  $(`[data-bark="${bark}"]`,el).setAttribute('aria-pressed','true'); $('[data-bark="clean"]',el).setAttribute('aria-pressed','false');
  reset();
}

/* ---------------------------------------------------------------- 2 selection curves */
const SC={
  stab:{name:'Stabilising',x:'birth mass / kg',lo:1,hi:5.5,w:x=>Math.exp(-((x-50)**2)/(2*13**2)),
    say:'Very light and very heavy babies are more likely to die at or just after birth. Both extremes are selected <b>against</b>, so the curve gets <b>taller and narrower</b>. The mean stays the same; the range shrinks.'},
  dir:{name:'Directional',x:'fur length / cm',lo:.5,hi:3,w:x=>1/(1+Math.exp(-(x-58)/5)),
    say:'The climate gets colder. Mice with <b>longer fur</b> are better insulated, survive and breed. One extreme is favoured, so the <b>mean shifts</b> towards longer fur and the alleles for long fur increase in frequency.'},
  dis:{name:'Disruptive',x:'coat colour (light → dark)',lo:0,hi:10,w:x=>1-.9*Math.exp(-((x-50)**2)/(2*11**2)),
    say:'On a beach of pale sand and dark grass, <b>light mice</b> hide on sand and <b>dark mice</b> hide in grass. Medium mice stand out everywhere and get eaten. <b>Both extremes</b> are favoured, so the curve splits into two peaks.'}
};
function makeSelCurve(el){
  el.innerHTML=`<div class="chips" role="group" aria-label="Type of selection">${Object.entries(SC).map(([k,s])=>`<button data-type="${k}">${s.name}</button>`).join('')}</div>
   <div class="fig narrow curvefig2"></div>
   <div class="row"><button class="btn solid" data-sgen>Next generation</button><button class="btn" data-srun>Run 8 generations</button><button class="btn quiet" data-sreset>Start again</button></div>
   <div class="fb explain sc-out" aria-live="polite"></div>`;
  const fig=$('.curvefig2',el), out=$('.sc-out',el), G=101; let type='stab', f0=[], f=[], gen=0;
  const gauss=(m,s)=>Array.from({length:G},(_,i)=>Math.exp(-((i-m)**2)/(2*s*s)));
  function norm(a){ const t=a.reduce((x,y)=>x+y,0); return a.map(v=>v/t); }
  function smooth(a){ return a.map((_,i)=>{ let s=0,w=0; for(let k=-3;k<=3;k++){ const j=i+k; if(j<0||j>=G) continue; const ww=Math.exp(-k*k/4); s+=a[j]*ww; w+=ww; } return s/w; }); }
  function stats(a){ const m=a.reduce((s,v,i)=>s+v*i,0); const sd=Math.sqrt(a.reduce((s,v,i)=>s+v*(i-m)**2,0)); return {m,sd}; }
  function draw(){ const S=SC[type], W=420,H=230,L=20,R=410,T=14,B=190, mx=Math.max(...f0,...f);
    const X=i=>L+i/(G-1)*(R-L), Y=v=>B-v/mx*(B-T)*.95; let s='';
    for(let i=0;i<G;i+=4){ const w=S.w(i); if(w<.5) s+=`<rect x="${X(i)-2}" y="${T}" width="${(R-L)/(G-1)*4}" height="${B-T}" fill="var(--heat)" opacity="${(0.5-w)*.35}"/>`; }
    s+=`<line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="var(--ink)"/>`;
    s+=`<polyline fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 4" points="${f0.map((v,i)=>X(i)+','+Y(v)).join(' ')}"/>`;
    s+=`<polyline fill="var(--leaf-soft)" fill-opacity=".6" stroke="var(--leaf)" stroke-width="3" points="${X(0)},${B} ${f.map((v,i)=>X(i)+','+Y(v)).join(' ')} ${X(G-1)},${B}"/>`;
    [0,25,50,75,100].forEach(i=>{ const v=S.lo+(S.hi-S.lo)*i/100; s+=`<text x="${X(i)}" y="${B+15}" text-anchor="middle" font-size="12" style="fill:var(--muted)">${type==='dis'?['light','','medium','','dark'][i/25]:v.toFixed(1)}</text>`; });
    s+=`<text x="${(L+R)/2}" y="${H-4}" text-anchor="middle" font-size="12" style="fill:var(--ink)">${S.x}</text>`;
    s+=`<text x="${R}" y="${T+10}" text-anchor="end" font-size="11" style="fill:var(--muted)">dashed = original · red = selected against</text>`;
    fig.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${S.name} selection: number of individuals against ${S.x}">${s}</svg>`;
    const a=stats(f0), b=stats(f), conv=v=>(S.lo+(S.hi-S.lo)*v/100);
    const meanTxt=type==='dis'?'':` · mean <b>${conv(b.m).toFixed(2)}</b> (was ${conv(a.m).toFixed(2)})`;
    out.innerHTML=`<b>${S.name} selection · generation ${gen}</b>${meanTxt} · spread <b>${b.sd<a.sd*0.97?'narrower':b.sd>a.sd*1.03?'wider':'about the same'}</b><br>${S.say}`;
    $$('[data-type]',el).forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.type===type))); }
  function reset(){ gen=0; f0=norm(gauss(50,13)); f=f0.slice(); draw(); }
  function step(){ const S=SC[type]; f=norm(smooth(f.map((v,i)=>v*S.w(i)))); gen++; draw(); }
  el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.type){ type=b.dataset.type; reset(); }
    if(b.hasAttribute('data-sgen')) step();
    if(b.hasAttribute('data-sreset')) reset();
    if(b.hasAttribute('data-srun')){ let k=0; const go=()=>{ step(); if(++k<8) calm()?go():setTimeout(go,220); }; go(); } });
  reset();
}

/* ---------------------------------------------------------------- 3 genetic drift */
function makeDrift(el){
  el.innerHTML=`<div class="chips" role="group" aria-label="Population size"><button data-n="10">Small: 10</button><button data-n="50">Medium: 50</button><button data-n="1000">Large: 1000</button><button data-n="bottle">Large, then a disaster</button></div>
   <div class="fig narrow drift-fig"></div>
   <div class="row"><button class="btn solid" data-drun>Run 40 generations</button></div>
   <div class="fb explain drift-out" aria-live="polite"></div>`;
  const fig=$('.drift-fig',el), out=$('.drift-out',el); let mode='10';
  const binom=(n,p)=>{ let k=0; for(let i=0;i<n;i++) if(rnd()<p) k++; return k; };
  const COL=['var(--leaf)','var(--sun)','var(--heat)','#7a5cc2','#2a8fb0','var(--muted)'];
  function run(){ const G=40, series=[]; let marks=[];
    for(let r=0;r<6;r++){ let p=.5, vals=[p];
      for(let g=1;g<=G;g++){ let n=mode==='bottle'?(g===12?4:1000):+mode; p=binom(2*n,p)/(2*n); vals.push(p); }
      series.push({vals,color:COL[r],w:2}); }
    if(mode==='bottle') marks=[{g:12,t:'disaster: 4 survive'}];
    fig.innerHTML=lineChart(series,G,{label:'allele frequency in six separate populations',marks});
    const fixed=series.filter(s=>{ const v=s.vals[G]; return v===0||v===1; }).length;
    const txt={'10':`In a <b>small population</b> chance matters a lot. Frequencies wander randomly, and ${fixed} of 6 populations lost one allele completely (frequency 0 or 1).`,
      '50':`A <b>medium population</b> still drifts, but more slowly. ${fixed} of 6 lost an allele.`,
      '1000':'In a <b>large population</b> random changes average out, so the frequency stays close to 0.5. Drift hardly matters.',
      'bottle':'A <b>bottleneck</b>: a large population is cut to a handful of survivors by chance (e.g. a volcanic eruption). The few survivors happen to carry different allele frequencies, and the population keeps those afterwards. Genetic diversity is reduced.'}[mode];
    out.innerHTML=txt+'<br><span class="small muted">Each line is one population starting at 0.5. Nothing is being selected: every change is due to chance alone.</span>';
    $$('[data-n]',el).forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.n===mode))); }
  el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.n) mode=b.dataset.n; run(); });
  run();
}

/* ---------------------------------------------------------------- 4 Hardy–Weinberg generator */
const HW_SC=[
  {org:'cystic fibrosis in a population',rec:'have cystic fibrosis (ff)',dom:'F',ree:'f',noun:'people'},
  {org:'flower colour in sweet peas',rec:'have white flowers (rr); purple (R) is dominant',dom:'R',ree:'r',noun:'plants'},
  {org:'copper tolerance in grass',rec:'are copper tolerant (tt)',dom:'T',ree:'t',noun:'plants'},
  {org:'coat colour in mice',rec:'are white (bb); black (B) is dominant',dom:'B',ree:'b',noun:'mice'},
  {org:'albinism in a population',rec:'are albino (aa)',dom:'A',ree:'a',noun:'people'}];
function makeHW(el){
  el.innerHTML=`<div class="clue stack hw-q"></div>
   <div class="gridrow"><label>q² (recessive phenotype)</label><input type="text" data-k="q2"><span class="small">as a decimal</span></div>
   <div class="gridrow"><label>q</label><input type="text" data-k="q"><span></span></div>
   <div class="gridrow"><label>p</label><input type="text" data-k="p"><span></span></div>
   <div class="gridrow"><label>% homozygous dominant</label><input type="text" data-k="p2"><span class="small">%</span></div>
   <div class="gridrow"><label>% heterozygous (carriers)</label><input type="text" data-k="pq"><span class="small">%</span></div>
   <div class="row"><button class="btn" data-hwcheck>Check my answers</button><button class="btn quiet" data-hwshow>Show the working</button><button class="btn quiet" data-hwnext>New question</button></div>
   <div class="fb" hidden aria-live="polite"></div><div class="reveal-body hw-work" hidden></div>`;
  let A;
  function make(){ const S=pick(HW_SC), q=pick([.1,.2,.3,.4,.5,.6,.7]), N=pick([100,200,400,500,1000]), rec=Math.round(q*q*N);
    A={S,q,N,rec,q2:q*q,p:1-q,p2:(1-q)**2*100,pq:2*q*(1-q)*100};
    $('.hw-q',el).innerHTML=`<p class="eyebrow">New question</p><p><b>${S.org}.</b> In a sample of ${N} ${S.noun}, ${rec} ${S.rec}. Assuming the Hardy–Weinberg principle applies, calculate the percentage of the sample that is homozygous dominant and heterozygous.</p>`;
    $$('input',el).forEach(i=>{ i.value=''; i.style.borderColor=''; }); $('.fb',el).hidden=true; $('.hw-work',el).hidden=true;
    $('.hw-work',el).innerHTML=`<ol class="clean"><li><b>Start with the recessive phenotype</b>: only ${S.ree}${S.ree} shows it, so q² = ${rec} ÷ ${N} = <b>${A.q2.toFixed(2)}</b></li><li><b>q</b> = √${A.q2.toFixed(2)} = <b>${q.toFixed(1)}</b></li><li><b>p</b> = 1 − q = <b>${A.p.toFixed(1)}</b></li><li><b>Homozygous dominant</b> ${S.dom}${S.dom}: p² = ${A.p.toFixed(1)}² = ${(A.p2/100).toFixed(2)} = <b>${A.p2.toFixed(0)}%</b></li><li><b>Heterozygous</b> ${S.dom}${S.ree}: 2pq = 2 × ${A.p.toFixed(1)} × ${q.toFixed(1)} = ${(A.pq/100).toFixed(2)} = <b>${A.pq.toFixed(0)}%</b></li><li><b>Check</b>: ${A.p2.toFixed(0)} + ${A.pq.toFixed(0)} + ${(A.q2*100).toFixed(0)} = 100 ✓</li></ol>`; }
  const num=v=>{ const n=parseFloat(String(v).replace(/[%\s]/g,'')); return isNaN(n)?null:n; };
  el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.hasAttribute('data-hwnext')) make();
    if(b.hasAttribute('data-hwshow')){ const w=$('.hw-work',el); w.hidden=!w.hidden; }
    if(b.hasAttribute('data-hwcheck')){ let r=0; $$('input',el).forEach(i=>{ let n=num(i.value), want=A[i.dataset.k];
        if(n!==null&&(i.dataset.k==='p2'||i.dataset.k==='pq')&&n<=1&&want>1) n*=100;
        const ok=n!==null&&Math.abs(n-want)<=Math.max(.011,Math.abs(want)*.015); if(ok) r++; i.style.borderColor=n===null?'':ok?'var(--ok)':'var(--bad)'; });
      const fb=$('.fb',el); fb.hidden=false; fb.className='fb anim '+(r===5?'good':'nope');
      fb.innerHTML=r===5?'<span class="verdict">✓ All correct</span> Press “New question” for another.':`<span class="verdict">✗ ${r} of 5 correct</span> Always start from q² (the recessive phenotype), never from the dominant one.`; } });
  make();
}

$$('.selsim').forEach(makeSelSim); $$('.selcurve').forEach(makeSelCurve); $$('.driftsim').forEach(makeDrift); $$('.hwgen').forEach(makeHW);
})();
