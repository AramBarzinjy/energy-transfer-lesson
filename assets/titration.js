/* pH titration curves, worked out from equilibrium (charge balance), not hand-drawn.
   .curvelab  : interactive explorer (pair chips, direction toggle, optional indicator chips)
   .curvefig  : a fixed curve, e.g. a redrawn exam graph, set by data attributes */
(function(){
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const KW=1e-14, KA_W=1.76e-5, KB_W=1.8e-5;
const PAIRS={
  sasb:{name:'Strong acid + strong base', ka:'s', kb:'s', eg:'HCl + NaOH'},
  sawb:{name:'Strong acid + weak base',   ka:'s', kb:KB_W, eg:'HCl + NH₃'},
  wasb:{name:'Weak acid + strong base',   ka:KA_W, kb:'s', eg:'CH₃COOH + NaOH'},
  wawb:{name:'Weak acid + weak base',     ka:KA_W, kb:KB_W, eg:'CH₃COOH + NH₃'}
};
const IND={
  mo:{name:'Methyl orange', lo:3.1, hi:4.4, from:'red', to:'yellow'},
  bpb:{name:'Bromophenol blue', lo:3.0, hi:4.6, from:'yellow', to:'blue'},
  mr:{name:'Methyl red', lo:4.4, hi:6.2, from:'red', to:'yellow'},
  btb:{name:'Bromothymol blue', lo:6.0, hi:7.6, from:'yellow', to:'blue'},
  pp:{name:'Phenolphthalein', lo:8.3, hi:10.0, from:'colourless', to:'red (pink)'}
};
/* p = {flask:'acid'|'base', vf, ca, ka, cb, kb}; v = titrant volume in cm3 */
function pH(p,v){
  const Va = p.flask==='acid'? p.vf : v, Vb = p.flask==='acid'? v : p.vf, T=Va+Vb;
  const CA=p.ca*Va/T, CB=p.cb*Vb/T, KA=p.ka==='s'?1e10:p.ka, KBH=p.kb==='s'?1e-30:KW/p.kb;
  let lo=-15, hi=1, m=0;
  for(let i=0;i<70;i++){ m=(lo+hi)/2; const h=Math.pow(10,m);
    const f=h+CB*h/(h+KBH)-KW/h-CA*KA/(KA+h); if(f>0) hi=m; else lo=m; }
  return -m;
}
function veq(p){ return p.flask==='acid' ? p.ca*p.vf/p.cb : p.cb*p.vf/p.ca; }
function section(p){ const e=veq(p); const a=pH(p,e-0.5), b=pH(p,e+0.5); return [Math.min(a,b),Math.max(a,b)]; }
const fmt=x=>x.toFixed(1);

const W=420,H=300,X0=40,X1=408,Y0=18,Y1=262, SVGNS='http://www.w3.org/2000/svg';
const sx=(v,max)=>X0+(v/max)*(X1-X0), sy=ph=>Y1-(ph/14)*(Y1-Y0);
function draw(svg,p,opt){
  opt=opt||{}; const max=opt.max||50; let s='';
  for(let ph=0;ph<=14;ph+=2){ s+=`<line x1="${X0}" x2="${X1}" y1="${sy(ph)}" y2="${sy(ph)}" stroke="var(--line)" stroke-width="1"/><text x="${X0-8}" y="${sy(ph)+4}" text-anchor="end" font-size="13" style="fill:var(--muted)">${ph}</text>`; }
  for(let v=0;v<=max;v+=10){ s+=`<text x="${sx(v,max)}" y="${Y1+16}" text-anchor="middle" font-size="13" style="fill:var(--muted)">${v}</text>`; }
  s+=`<text x="${(X0+X1)/2}" y="${H-4}" text-anchor="middle" font-size="13" style="fill:var(--ink)">volume of ${p.flask==='acid'?'base':'acid'} added / cm³</text>`;
  s+=`<text x="12" y="${(Y0+Y1)/2}" font-size="13" transform="rotate(-90 12 ${(Y0+Y1)/2})" text-anchor="middle" style="fill:var(--ink)">pH</text>`;
  if(opt.ind){ const I=IND[opt.ind]; s+=`<rect x="${X0}" y="${sy(I.hi)}" width="${X1-X0}" height="${sy(I.lo)-sy(I.hi)}" fill="var(--sun-fill)" opacity=".35"/><text x="${X1-6}" y="${sy(I.hi)-4}" text-anchor="end" font-size="13" font-weight="700" style="fill:var(--ink)">${I.name} ${I.lo}–${I.hi}</text>`; }
  s+=`<line x1="${X0}" x2="${X1}" y1="${sy(7)}" y2="${sy(7)}" stroke="var(--muted)" stroke-dasharray="4 4"/>`;
  const e=veq(p); if(e<max && !opt.noEq) s+=`<line x1="${sx(e,max)}" x2="${sx(e,max)}" y1="${Y0}" y2="${Y1}" stroke="var(--muted)" stroke-width="1"/><text x="${sx(e,max)+5}" y="${Y0+12}" font-size="13" style="fill:var(--muted)">equivalence ${e.toFixed(1)} cm³</text>`;
  if(opt.sec){ const [a,b]=section(p); s+=`<rect x="${sx(e,max)-5}" y="${sy(b)}" width="10" height="${sy(a)-sy(b)}" fill="none" stroke="var(--heat)" stroke-width="2" rx="3"/>`; }
  let d=''; const pts=[]; for(let v=0;v<=max+1e-9;v+= (Math.abs(v-e)<2?0.02:0.25)) pts.push([v,pH(p,v)]);
  pts.forEach(([v,ph],i)=>{ d+=(i?'L':'M')+sx(v,max).toFixed(1)+' '+sy(ph).toFixed(1); });
  s+=`<path d="${d}" fill="none" stroke="var(--leaf)" stroke-width="3" stroke-linejoin="round"/>`;
  svg.innerHTML=s;
}
function makeSvg(host,label){ const svg=document.createElementNS(SVGNS,'svg'); svg.setAttribute('viewBox',`0 0 ${W} ${H}`); svg.setAttribute('role','img'); svg.setAttribute('aria-label',label); host.appendChild(svg); return svg; }

/* fixed figures */
$$('.curvefig').forEach(f=>{ const d=f.dataset; const num=x=>x==='s'?'s':parseFloat(x);
  const p={flask:d.flask, vf:parseFloat(d.vf||25), ca:parseFloat(d.ca), ka:num(d.ka), cb:parseFloat(d.cb), kb:num(d.kb)};
  draw(makeSvg(f,f.dataset.label||'pH curve'),p,{max:parseFloat(d.max||50), noEq:d.noeq!==undefined}); });

/* interactive labs */
$$('.curvelab').forEach(lab=>{
  const host=$('.lab-fig',lab), out=$('.lab-out',lab), useInd=lab.dataset.indicators==='on';
  let pair=lab.dataset.pair||'sasb', dir='acid', ind=null;
  const svg=makeSvg(host,'pH titration curve');
  function render(){
    const P=PAIRS[pair]; const p={flask:dir, vf:25, ca:0.1, ka:P.ka, cb:0.1, kb:P.kb};
    draw(svg,p,{ind, sec:true});
    svg.setAttribute('aria-label',P.name+' titration curve, '+(dir==='acid'?'base added to acid':'acid added to base'));
    const start=pH(p,0), end=pH(p,50), [a,b]=section(p);
    let h=`<p><b>${P.name}</b> <span class="muted">(e.g. ${P.eg})</span></p><ul class="clean">`+
      `<li><b>Starts</b> at pH ${fmt(start)} and <b>ends</b> near pH ${fmt(end)} (${dir==='acid'?'base':'acid'} in excess).</li>`+
      (b-a<1.5 ? `<li><b>No real vertical section</b>: pH only changes ${fmt(a)} → ${fmt(b)} across the equivalence point.</li>`
               : `<li><b>Vertical section</b> (red box): about pH ${fmt(a)} to ${fmt(b)}.</li>`)+
      `<li><b>Equivalence point</b> at 25.0 cm³, pH ${fmt(pH(p,25))}. That's the mid-point of the vertical section.</li></ul>`;
    if(useInd){
      if(!ind) h+=`<p class="muted">Pick an indicator to test it on this curve.</p>`;
      else { const I=IND[ind], ok=I.lo>=a && I.hi<=b;
        h+=`<p class="verdict" style="color:var(${ok?'--ok':'--bad'})">${ok?'✓ Suitable':'✗ Not suitable'}: ${I.name} changes colour between pH ${I.lo} and ${I.hi}, `+
          (ok?'which is inside the vertical section.':'which is not inside the vertical section'+(b-a<1.5?' (there isn’t really one).':'.'))+`</p>`; }
    }
    out.innerHTML=h;
    $$('[data-pair]',lab).forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.pair===pair)));
    $$('[data-dir]',lab).forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.dir===dir)));
    $$('[data-ind]',lab).forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.ind===ind)));
  }
  lab.addEventListener('click',e=>{ const t=e.target.closest('[data-pair],[data-dir],[data-ind]'); if(!t) return;
    if(t.dataset.pair) pair=t.dataset.pair; if(t.dataset.dir) dir=t.dataset.dir; if(t.dataset.ind!==undefined) ind=t.dataset.ind||null; render(); });
  render();
});
})();
