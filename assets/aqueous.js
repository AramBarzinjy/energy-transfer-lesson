/* Aqueous ions topic: 3D complex-ion viewer (three.js), virtual test-tube lab,
   mini tubes and the "Name that ion" game. Needs three.min.js loaded first. */
(function(){
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const calm=()=>document.documentElement.dataset.motion==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches;
const SUBS='₀₁₂₃₄₅₆₇₈₉', sub=n=>String(n).split('').map(d=>SUBS[+d]).join('');
const sup=c=>({0:'',1:'⁺',2:'²⁺',3:'³⁺','-1':'⁻','-2':'²⁻'})[c];

/* ------------------------------------------------------------------ data */
const METALS={
  cu:{sym:'Cu',name:'copper(II)',ion:'Cu²⁺',charge:2,color:0x2f7fd6,r:.60,sol:'#4f95e0',solName:'blue solution'},
  fe2:{sym:'Fe',name:'iron(II)',ion:'Fe²⁺',charge:2,color:0x5f9a3c,r:.66,sol:'#cfe3a3',solName:'pale green solution'},
  fe3:{sym:'Fe',name:'iron(III)',ion:'Fe³⁺',charge:3,color:0xc0662a,r:.52,sol:'#c99a45',solName:'purple, but usually looks yellow-brown'},
  al:{sym:'Al',name:'aluminium',ion:'Al³⁺',charge:3,color:0xaab3bd,r:.48,sol:'#e6edf2',solName:'colourless solution'}
};
const OCT=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const TET=[[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]].map(v=>{const l=Math.sqrt(3);return v.map(x=>x/l);});
const LIGNAME={H2O:'water, H₂O',OH:'hydroxide, OH⁻',NH3:'ammonia, NH₃',Cl:'chloride, Cl⁻'};
const LIGCHG={H2O:0,OH:-1,NH3:0,Cl:-1};
function formula(mk,ligs){
  const M=METALS[mk], cnt={H2O:0,NH3:0,OH:0,Cl:0}; ligs.forEach(l=>cnt[l]++);
  const part=(n,s,p)=>n?(p?'('+s+')':s)+(n>1?sub(n):''):'';
  const charge=M.charge+ligs.reduce((a,l)=>a+LIGCHG[l],0);
  return {text:'['+M.sym+part(cnt.H2O,'H₂O',1)+part(cnt.NH3,'NH₃',1)+part(cnt.OH,'OH',1)+part(cnt.Cl,'Cl',0)+']'+sup(charge), charge};
}
const PRESETS={
  amm:{metal:'cu',geom:'oct',ligs:['NH3','NH3','NH3','NH3','H2O','H2O'],title:'Excess ammonia',
    note:'<b>Ligand substitution.</b> Four NH₃ ligands replace four H₂O. NH₃ is a similar size to H₂O, so the coordination number stays <b>6</b> and the shape stays <b>octahedral</b>. Deep blue solution.'},
  cl:{metal:'cu',geom:'tet',ligs:['Cl','Cl','Cl','Cl'],title:'Concentrated HCl',
    note:'<b>Chloride ions are much larger</b>, so only <b>4</b> fit around the copper. Coordination number 6 → 4, shape octahedral → <b>tetrahedral</b>. Overall charge 2+ + 4(−1) = <b>2−</b>. Yellow solution (looks green if some blue remains).'},
  aloh4:{metal:'al',geom:'tet',ligs:['OH','OH','OH','OH'],title:'Excess NaOH (aluminium)',
    note:'<b>Amphoteric.</b> Aluminium hydroxide reacts with even more OH⁻ and dissolves, forming <b>[Al(OH)₄]⁻</b>: a colourless solution. Charge 3+ + 4(−1) = <b>1−</b>.'}
};

/* ------------------------------------------------------------------ 3D viewer */
function hasGL(){ try{ const c=document.createElement('canvas'); return !!(window.WebGLRenderingContext&&(c.getContext('webgl')||c.getContext('experimental-webgl'))); }catch(e){ return false; } }

function makeViewer(el){
  const mode=el.dataset.mode||'explore';
  el.innerHTML=
   `<div class="mol-top"><span class="mol-formula" aria-live="polite"></span><span class="mol-cn"></span></div>
    <div class="mol-stage" tabindex="0" role="img" aria-label="3D model of a complex ion. Drag to rotate; use the buttons below to pick parts."><div class="mol-hint">Drag to turn it · tap a part</div></div>
    <div class="mol-legend" aria-hidden="true"><span><i style="background:#e0473b"></i>O</span><span><i style="background:#f2f2f2"></i>H</span><span><i style="background:#3d63dd"></i>N</span><span><i style="background:#2fae4f"></i>Cl</span><span><i class="arrow"></i>coordinate bond</span><span><i style="background:#ffcf33;border-radius:50%;width:.45em;height:.45em"></i><i style="background:#ffcf33;border-radius:50%;width:.45em;height:.45em;margin-left:-.25em"></i>electron pair</span></div>
    <div class="row mol-view"><button class="btn quiet" data-v="reset">Reset view</button><button class="btn quiet" data-v="spin">Pause spin</button><button class="btn quiet" data-v="shape" aria-pressed="false">Show the shape</button></div>
    <div class="mol-controls stack"></div>
    <div class="fb explain mol-out" aria-live="polite"></div>`;
  const stage=$('.mol-stage',el), out=$('.mol-out',el), fEl=$('.mol-formula',el), cnEl=$('.mol-cn',el), ctr=$('.mol-controls',el);
  let state={metal:el.dataset.metal||'cu', geom:'oct', ligs:['H2O','H2O','H2O','H2O','H2O','H2O']};
  const sel={part:null,lig:-1};

  if(!hasGL()){ stage.innerHTML='<p class="small" style="padding:1rem">3D isn’t available in this browser, so here is the same information as text. Everything else on the page still works.</p>'; }

  /* ----- three.js scene */
  let renderer,scene,camera,root,shapeLines,labelSprite, gl=hasGL();
  const T=window.THREE, V=(x,y,z)=>new T.Vector3(x,y,z);
  if(gl){
    renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    stage.appendChild(renderer.domElement);
    scene=new T.Scene(); camera=new T.PerspectiveCamera(38,1,.1,100); camera.position.set(0,0,12);
    scene.add(new T.HemisphereLight(0xffffff,0x445566,.95));
    const dl=new T.DirectionalLight(0xffffff,.75); dl.position.set(4,6,8); scene.add(dl);
    root=new T.Group(); scene.add(root);
  }
  const startQ=()=>new T.Quaternion().setFromEuler(new T.Euler(.42,-.55,0));
  if(gl) root.quaternion.copy(startQ());

  function mat(c,extra){ return new T.MeshStandardMaterial(Object.assign({color:c,roughness:.42,metalness:.08},extra||{})); }
  function sphere(r,c,pos,ud){ const m=new T.Mesh(new T.SphereGeometry(r,32,24),mat(c)); m.position.copy(pos); m.userData=ud; root.add(m); return m; }
  function cyl(a,b,r,c,ud){ const d=b.clone().sub(a), len=d.length(); const m=new T.Mesh(new T.CylinderGeometry(r,r,len,18),mat(c)); m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize()); m.userData=ud; root.add(m); return m; }
  function cone(pos,dir,r,h,c,ud){ const m=new T.Mesh(new T.ConeGeometry(r,h,22),mat(c)); m.position.copy(pos); m.quaternion.setFromUnitVectors(V(0,1,0),dir.clone().normalize()); m.userData=ud; root.add(m); return m; }
  function perp(d){ const a=Math.abs(d.x)<.9?V(1,0,0):V(0,1,0); return a.cross(d).normalize(); }
  function textSprite(txt){
    const c=document.createElement('canvas'); c.width=256; c.height=128; const x=c.getContext('2d');
    x.font='bold 64px Lexend, Arial, sans-serif'; x.textAlign='center'; x.textBaseline='middle';
    x.lineWidth=10; x.strokeStyle='rgba(10,20,30,.85)'; x.strokeText(txt,128,64); x.fillStyle='#fff'; x.fillText(txt,128,64);
    const s=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),depthTest:false,transparent:true})); s.scale.set(1.5,.75,1); s.renderOrder=999; return s;
  }

  function build(){
    const F=formula(state.metal,state.ligs), M=METALS[state.metal];
    fEl.textContent=F.text; cnEl.textContent='Coordination number '+state.ligs.length+' · '+(state.geom==='oct'?'octahedral':'tetrahedral');
    if(!gl) return;
    while(root.children.length){ const o=root.children.pop(); o.geometry&&o.geometry.dispose(); }
    const dirs=(state.geom==='oct'?OCT:TET).map(a=>V(...a));
    sphere(M.r,M.color,V(0,0,0),{part:'metal'});
    labelSprite=textSprite(M.ion); root.add(labelSprite);
    const donors=[];
    state.ligs.forEach((t,i)=>{
      const d=dirs[i], dr={H2O:.40,OH:.40,NH3:.42,Cl:.6}[t], L=(t==='Cl'?2.35:2.05)+(M.r-.55)*.6;
      const P=d.clone().multiplyScalar(L); donors.push(P);
      const col={H2O:0xe0473b,OH:0xe0473b,NH3:0x3d63dd,Cl:0x2fae4f}[t];
      sphere(dr,col,P,{part:'ligand',lig:i,atom:t==='NH3'?'N':t==='Cl'?'Cl':'O'});
      const u=perp(d.clone()), w=d.clone().cross(u).normalize();
      const addH=(dir,k)=>{ const H=P.clone().add(dir.clone().multiplyScalar(.62)); cyl(P,H,.07,0xdddddd,{part:'ligand',lig:i,atom:'bond'}); sphere(.22,0xf4f4f4,H,{part:'ligand',lig:i,atom:'H',h:k}); };
      if(t==='H2O'){ addH(d.clone().multiplyScalar(.58).add(u.clone().multiplyScalar(.81)).normalize(),0); addH(d.clone().multiplyScalar(.58).add(u.clone().multiplyScalar(-.81)).normalize(),1); }
      if(t==='OH') addH(d.clone(),0);
      if(t==='NH3') [0,1,2].forEach(k=>{ const a=k*2*Math.PI/3; addH(d.clone().multiplyScalar(.34).add(u.clone().multiplyScalar(.94*Math.cos(a))).add(w.clone().multiplyScalar(.94*Math.sin(a))).normalize(),k); });
      /* coordinate bond: arrow from donor atom to metal, with the shared electron pair drawn on it */
      const a=P.clone().sub(d.clone().multiplyScalar(dr)), b=d.clone().multiplyScalar(M.r+.32);
      cyl(a,b,.06,0xf1b434,{part:'bond',lig:i});
      cone(d.clone().multiplyScalar(M.r+.16),d.clone().negate(),.15,.32,0xf1b434,{part:'bond',lig:i});
      const mid=a.clone().add(b).multiplyScalar(.5);
      [1,-1].forEach(s=>sphere(.075,0xffcf33,mid.clone().add(w.clone().multiplyScalar(.14*s)),{part:'pair',lig:i}));
    });
    /* shape wireframe */
    const pts=[];
    donors.forEach((p,i)=>donors.forEach((q,j)=>{ if(j<=i) return; const dot=dirs[i].dot(dirs[j]); if(state.geom==='tet'||Math.abs(dot)<.1){ pts.push(p,q); } }));
    shapeLines=new T.LineSegments(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0x8fa3b3,transparent:true,opacity:.9}));
    shapeLines.visible=$('[data-v="shape"]',el).getAttribute('aria-pressed')==='true'; root.add(shapeLines);
    applyHighlight(); render();
  }

  /* ----- part information */
  function info(part,lig){
    const M=METALS[state.metal], t=state.ligs[lig];
    if(part==='metal') return `<b>Central metal ion: ${M.ion}</b> (${M.name}).<br>The positive ion in the middle. Its positive charge attracts the lone pairs on the ligands.`+(M.charge===3?' <span class="muted">3+ ions are drawn smaller than 2+ ions, because they are.</span>':'');
    if(part==='ligand'){ const extra=t==='OH'?' This one <b>was</b> a water ligand: a base has pulled an <b>H⁺</b> off it.':t==='NH3'?' Ammonia’s lone pair is on the N.':t==='Cl'?' Chloride’s lone pair is on the Cl⁻ ion.':' Water’s lone pair is on the O.';
      return `<b>Ligand: ${LIGNAME[t]}</b><br>A ligand is <b>an ion or molecule with a lone pair of electrons which can form a coordinate bond with a metal ion</b>.`+extra; }
    if(part==='bond') return '<b>Coordinate bond</b> (gold arrow)<br><b>A shared pair of electrons which have both come from the same atom.</b> Here both electrons come from the ligand, so the arrow points <b>from the ligand to the metal</b>.';
    if(part==='pair') return '<b>The donated lone pair</b> (two yellow dots)<br>The ligand <b>donates a lone pair of electrons</b> to the metal ion. Once shared, that pair <b>is</b> the coordinate bond.';
    if(part==='cn') return `<b>Coordination number = ${state.ligs.length}</b><br>The number of coordinate bonds the metal ion forms. Count the gold arrows: ${state.ligs.length}.`;
    if(part==='shape') return state.geom==='oct'?'<b>Octahedral</b><br>6 ligands: 4 around the middle, 1 above, 1 below. All bond angles are <b>90°</b>. Tap “Show the shape” to see the 8-faced octahedron.':'<b>Tetrahedral</b><br>4 ligands spread as far apart as possible. Bond angle <b>109.5°</b>.';
    if(part==='charge'){ const F=formula(state.metal,state.ligs); return `<b>Overall charge: ${F.charge>0?F.charge+'+':F.charge<0?-F.charge+'−':'0 (neutral)'}</b><br>Metal charge ${M.charge}+ plus the ligand charges (H₂O and NH₃ are 0, OH⁻ and Cl⁻ are −1 each).`; }
    return '';
  }
  function applyHighlight(){
    if(!gl) return;
    root.children.forEach(o=>{ if(!o.material||!o.material.emissive) return; const ud=o.userData; let on=false;
      if(sel.part==='metal') on=ud.part==='metal';
      else if(sel.part==='ligand') on=ud.part==='ligand'&&ud.lig===sel.lig;
      else if(sel.part==='bond') on=ud.part==='bond'&&(sel.lig<0||ud.lig===sel.lig);
      else if(sel.part==='pair') on=ud.part==='pair'&&(sel.lig<0||ud.lig===sel.lig);
      else if(sel.part==='cn') on=ud.part==='bond';
      o.material.emissive.setHex(on?0x6b4a00:0x000000); o.material.emissiveIntensity=on?1:0; });
    $$('[data-part]',el).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===sel.part)));
  }
  function choose(part,lig){ sel.part=part; sel.lig=lig==null?-1:lig;
    if(part==='ligand'&&sel.lig<0) sel.lig=0;
    if(part==='shape'){ setShape(true); }
    out.innerHTML=info(part,sel.lig<0?0:sel.lig); applyHighlight(); render(); }
  function setShape(on){ const b=$('[data-v="shape"]',el); b.setAttribute('aria-pressed',String(on)); b.textContent=on?'Hide the shape':'Show the shape'; if(shapeLines){ shapeLines.visible=on; render(); } }

  /* ----- mode controls */
  const chips=(label,items,attr)=>`<div><p class="small muted" style="margin-bottom:.3rem">${label}</p><div class="chips" role="group" aria-label="${label}">${items.map(([v,t])=>`<button data-${attr}="${v}" aria-pressed="false">${t}</button>`).join('')}</div></div>`;
  const metalChips=chips('Pick a metal ion',[['cu','Cu²⁺'],['fe2','Fe²⁺'],['fe3','Fe³⁺'],['al','Al³⁺']],'metal');
  const partChips=chips('Or pick a part to highlight',[['metal','Central metal ion'],['ligand','A ligand'],['bond','Coordinate bond'],['pair','Lone pair'],['cn','Coordination number'],['shape','Shape'],['charge','Overall charge']],'part');
  let deprotN=0;
  const defaultText={
    explore:'Tap any part of the model, or a button below. Start with the <b>gold arrows</b>.',
    metals:'Pick a metal. Watch the <b>size</b> of the central ion and the <b>colour</b> of its solution.',
    deprot:'Press <b>Add base</b>. Each press pulls one <b>H⁺</b> off a water ligand, and the charge drops by 1.',
    beyond:'Pick one of the three exceptions to see how the complex changes.'
  };
  if(mode==='explore') ctr.innerHTML=partChips;
  if(mode==='metals') ctr.innerHTML=metalChips+`<div class="solswatch"><span class="sw"></span><span class="swtxt"></span></div>`+partChips;
  if(mode==='deprot') ctr.innerHTML=metalChips+`<div class="row"><button class="btn solid" data-deprot>Add base: remove one H⁺</button><button class="btn quiet" data-reset>Start again</button></div><div class="chargebar" aria-hidden="true"></div>`;
  if(mode==='beyond') ctr.innerHTML=chips('Pick an exception',[['amm','Cu²⁺ + excess NH₃'],['cl','Cu²⁺ + conc. HCl'],['aloh4','Al³⁺ + excess NaOH'],['hexa','Back to [Cu(H₂O)₆]²⁺']],'preset')+partChips;
  out.innerHTML=defaultText[mode];

  function paintMetal(){ $$('[data-metal]',el).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.metal===state.metal)));
    const sw=$('.solswatch',el); if(sw){ const M=METALS[state.metal]; $('.sw',sw).style.background=M.sol; $('.swtxt',sw).innerHTML=`<b>[${M.sym}(H₂O)₆]${sup(M.charge)}</b>: ${M.solName}`; } }
  function paintCharge(){ const cb=$('.chargebar',el); if(!cb) return; const M=METALS[state.metal], F=formula(state.metal,state.ligs);
    cb.innerHTML=Array.from({length:M.charge},(_,i)=>`<span class="${i<F.charge?'on':''}">+</span>`).join('')+`<b>${F.charge===0?'Neutral → insoluble → <span style="color:var(--ok)">PRECIPITATE</span>':'charge '+F.charge+'+ → still dissolved'}</b>`; }

  ctr.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.part) choose(b.dataset.part);
    if(b.dataset.metal){ state.metal=b.dataset.metal; state.ligs=Array(6).fill('H2O'); state.geom='oct'; deprotN=0; const db=$('[data-deprot]',el); if(db) db.disabled=false; paintMetal(); paintCharge(); build(); out.innerHTML=mode==='metals'?info('metal'):defaultText[mode]; if(mode==='metals'){ sel.part='metal'; applyHighlight(); render(); } }
    if(b.dataset.preset){ const p=PRESETS[b.dataset.preset]; $$('[data-preset]',el).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
      if(p){ state={metal:p.metal,geom:p.geom,ligs:p.ligs.slice()}; out.innerHTML=p.note; } else { state={metal:'cu',geom:'oct',ligs:Array(6).fill('H2O')}; out.innerHTML='Back to the start: <b>[Cu(H₂O)₆]²⁺</b>, blue, octahedral, coordination number 6.'; }
      sel.part=null; build(); }
    if(b.hasAttribute('data-deprot')) deprotonate();
    if(b.hasAttribute('data-reset')){ state.ligs=Array(6).fill('H2O'); deprotN=0; build(); paintCharge(); out.innerHTML=defaultText.deprot; $('[data-deprot]',el).disabled=false; }
  });
  const ORDER=[0,2,4];
  function deprotonate(){
    const M=METALS[state.metal]; if(deprotN>=M.charge) return;
    const i=ORDER[deprotN], before=formula(state.metal,state.ligs).text;
    const finish=()=>{ state.ligs[i]='OH'; deprotN++; build(); paintCharge();
      const F=formula(state.metal,state.ligs);
      out.innerHTML=`<b>${before} → ${F.text} + H⁺</b><br>The base takes an H⁺ from a water ligand (OH⁻ + H⁺ → H₂O, or NH₃ + H⁺ → NH₄⁺). That water is now an OH⁻ ligand, so the charge falls by 1.`+
        (F.charge===0?`<br><b style="color:var(--ok)">Charge is now 0. A neutral complex can’t stay dissolved, so it comes out as a precipitate: ${F.text}.</b> ${M.charge}+ ion → ${M.charge} H⁺ removed.`:'');
      $('[data-deprot]',el).disabled=deprotN>=M.charge; };
    if(!gl||calm()){ finish(); return; }
    const h=root.children.find(o=>o.userData.part==='ligand'&&o.userData.lig===i&&o.userData.atom==='H'&&o.userData.h===1);
    if(!h){ finish(); return; }
    const dir=h.position.clone().normalize(), start=h.position.clone(); h.material.transparent=true; const t0=performance.now();
    (function step(t){ const k=Math.min(1,(t-t0)/800); h.position.copy(start.clone().add(dir.clone().multiplyScalar(k*2.4))); h.material.opacity=1-k; render(); if(k<1) requestAnimationFrame(step); else finish(); })(t0);
  }

  /* ----- view controls */
  let spin=!calm(), userSpin=true;
  $('.mol-view',el).addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(!b) return;
    if(b.dataset.v==='reset'&&gl){ root.quaternion.copy(startQ()); camera.position.z=12; render(); }
    if(b.dataset.v==='spin'){ userSpin=!userSpin; spin=userSpin&&!calm(); b.textContent=userSpin?'Pause spin':'Spin'; }
    if(b.dataset.v==='shape') setShape(b.getAttribute('aria-pressed')!=='true'); });
  if(calm()){ const sb=$('[data-v="spin"]',el); sb.textContent='Spin'; userSpin=false; }

  /* ----- pointer: drag to rotate, tap to pick, wheel to zoom */
  if(gl){
    const cv=renderer.domElement; let down=null, last=null, moved=0;
    cv.style.touchAction='none';
    cv.addEventListener('pointerdown',e=>{ down={x:e.clientX,y:e.clientY}; last={...down}; moved=0; cv.setPointerCapture(e.pointerId); spin=false; });
    cv.addEventListener('pointermove',e=>{ if(!down) return; const dx=e.clientX-last.x, dy=e.clientY-last.y; last={x:e.clientX,y:e.clientY}; moved+=Math.abs(dx)+Math.abs(dy);
      const q=new T.Quaternion().setFromAxisAngle(V(0,1,0),dx*.01).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),dy*.01)); root.quaternion.premultiply(q); render(); });
    cv.addEventListener('pointerup',e=>{ if(down&&moved<8) pick(e); down=null; setTimeout(()=>{ spin=userSpin&&!calm(); },2500); });
    cv.addEventListener('wheel',e=>{ e.preventDefault(); camera.position.z=Math.max(6,Math.min(16,camera.position.z+e.deltaY*.01)); render(); },{passive:false});
    stage.addEventListener('keydown',e=>{ const k={ArrowLeft:[0,-.15],ArrowRight:[0,.15],ArrowUp:[-.15,0],ArrowDown:[.15,0]}[e.key]; if(!k) return; e.preventDefault();
      root.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),k[0])).premultiply(new T.Quaternion().setFromAxisAngle(V(0,1,0),k[1])); render(); });
    const ray=new T.Raycaster();
    function pick(e){ const r=cv.getBoundingClientRect(); ray.setFromCamera({x:((e.clientX-r.left)/r.width)*2-1,y:-((e.clientY-r.top)/r.height)*2+1},camera);
      const hit=ray.intersectObjects(root.children.filter(o=>o.isMesh)).find(h=>h.object.userData.part);
      if(hit) choose(hit.object.userData.part,hit.object.userData.lig); }
  }

  /* ----- render loop, only while on screen */
  let visible=false, raf=0;
  function size(){ if(!gl) return; const w=stage.clientWidth, h=stage.clientHeight; if(!w||!h) return; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); render(); }
  function render(){ if(gl&&stage.clientWidth) renderer.render(scene,camera); }
  function loop(){ raf=0; if(!visible||document.hidden) return; if(spin){ root.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(V(0,1,0),.006)); render(); } raf=requestAnimationFrame(loop); }
  new IntersectionObserver(es=>{ visible=es[0].isIntersecting; if(visible){ size(); if(!raf) raf=requestAnimationFrame(loop); } }).observe(stage);
  new ResizeObserver(size).observe(stage);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&visible&&!raf) raf=requestAnimationFrame(loop); });

  paintMetal(); paintCharge(); build();
  if(mode==='deprot'){ /* nothing selected */ }
  el._viewer={build, setComplex(s){ state=s; build(); }, renderer, get root(){return root;}, camera, render, size, stopSpin(){ userSpin=false; spin=false; }, startQ, setShape};
}

/* ------------------------------------------------------------------ test tubes */
const LAB={
 fe2:{naoh:{ppt:'#3f6e2a',obs:'Green solution → <b>green precipitate</b>. Goes brown on standing in air.',prod:'[Fe(H₂O)₄(OH)₂](s)',eq:'[Fe(H₂O)₆]²⁺ + 2OH⁻ → [Fe(H₂O)₄(OH)₂] + 2H₂O',rule:1,air:1},
      naohx:{ppt:'#3f6e2a',obs:'Green precipitate. <b>No further change</b> in excess.',prod:'[Fe(H₂O)₄(OH)₂](s)',eq:'[Fe(H₂O)₆]²⁺ + 2OH⁻ → [Fe(H₂O)₄(OH)₂] + 2H₂O',rule:1,air:1,excess:'none'},
      nh3:{ppt:'#3f6e2a',obs:'Green solution → <b>green precipitate</b>. Goes brown on standing in air.',prod:'[Fe(H₂O)₄(OH)₂](s)',eq:'[Fe(H₂O)₆]²⁺ + 2NH₃ → [Fe(H₂O)₄(OH)₂] + 2NH₄⁺',rule:1,air:1},
      nh3x:{ppt:'#3f6e2a',obs:'Green precipitate. <b>No further change</b> in excess.',prod:'[Fe(H₂O)₄(OH)₂](s)',eq:'[Fe(H₂O)₆]²⁺ + 2NH₃ → [Fe(H₂O)₄(OH)₂] + 2NH₄⁺',rule:1,air:1,excess:'none'},
      co3:{ppt:'#56803a',obs:'Green solution → <b>green precipitate</b> of iron(II) carbonate. <b>No fizzing.</b>',prod:'FeCO₃(s)',eq:'[Fe(H₂O)₆]²⁺ + CO₃²⁻ → FeCO₃ + 6H₂O',rule:4}},
 cu:{naoh:{ppt:'#3c86d9',obs:'Blue solution → <b>blue precipitate</b>.',prod:'[Cu(H₂O)₄(OH)₂](s)',eq:'[Cu(H₂O)₆]²⁺ + 2OH⁻ → [Cu(H₂O)₄(OH)₂] + 2H₂O',rule:1},
     naohx:{ppt:'#3c86d9',obs:'Blue precipitate. <b>No further change</b> in excess.',prod:'[Cu(H₂O)₄(OH)₂](s)',eq:'[Cu(H₂O)₆]²⁺ + 2OH⁻ → [Cu(H₂O)₄(OH)₂] + 2H₂O',rule:1,excess:'none'},
     nh3:{ppt:'#3c86d9',obs:'Blue solution → <b>blue precipitate</b>.',prod:'[Cu(H₂O)₄(OH)₂](s)',eq:'[Cu(H₂O)₆]²⁺ + 2NH₃ → [Cu(H₂O)₄(OH)₂] + 2NH₄⁺',rule:1},
     nh3x:{ppt:'#3c86d9',obs:'Blue precipitate, then it <b>dissolves</b> → <b>deep blue solution</b>.',prod:'[Cu(H₂O)₂(NH₃)₄]²⁺(aq)',eq:'[Cu(H₂O)₄(OH)₂] + 4NH₃ → [Cu(H₂O)₂(NH₃)₄]²⁺ + 2OH⁻ + 2H₂O',rule:2,excess:'dissolve',after:'#1d3fa8'},
     co3:{ppt:'#3fa59b',obs:'Blue solution → <b>blue-green precipitate</b> of copper carbonate. <b>No fizzing.</b>',prod:'CuCO₃(s)',eq:'[Cu(H₂O)₆]²⁺ + CO₃²⁻ → CuCO₃ + 6H₂O',rule:4},
     hcl:{change:'#d6cf3a',obs:'Blue solution → <b>yellow solution</b> (may look <b>green</b> if some blue is left).',prod:'[CuCl₄]²⁻(aq)',eq:'[Cu(H₂O)₆]²⁺ + 4Cl⁻ ⇌ [CuCl₄]²⁻ + 6H₂O',rule:6}},
 fe3:{naoh:{ppt:'#8b3f1c',obs:'Yellow-brown solution → <b>brown precipitate</b> (may look orange-brown).',prod:'[Fe(H₂O)₃(OH)₃](s)',eq:'[Fe(H₂O)₆]³⁺ + 3OH⁻ → [Fe(H₂O)₃(OH)₃] + 3H₂O',rule:1},
      naohx:{ppt:'#8b3f1c',obs:'Brown precipitate. <b>No further change</b> in excess.',prod:'[Fe(H₂O)₃(OH)₃](s)',eq:'[Fe(H₂O)₆]³⁺ + 3OH⁻ → [Fe(H₂O)₃(OH)₃] + 3H₂O',rule:1,excess:'none'},
      nh3:{ppt:'#8b3f1c',obs:'Yellow-brown solution → <b>brown precipitate</b>.',prod:'[Fe(H₂O)₃(OH)₃](s)',eq:'[Fe(H₂O)₆]³⁺ + 3NH₃ → [Fe(H₂O)₃(OH)₃] + 3NH₄⁺',rule:1},
      nh3x:{ppt:'#8b3f1c',obs:'Brown precipitate. <b>No further change</b> in excess.',prod:'[Fe(H₂O)₃(OH)₃](s)',eq:'[Fe(H₂O)₆]³⁺ + 3NH₃ → [Fe(H₂O)₃(OH)₃] + 3NH₄⁺',rule:1,excess:'none'},
      co3:{ppt:'#8b3f1c',fizz:1,obs:'<b>Brown precipitate</b> and <b>bubbles of CO₂</b> (fizzing).',prod:'[Fe(H₂O)₃(OH)₃](s) + CO₂(g)',eq:'2[Fe(H₂O)₆]³⁺ + 3CO₃²⁻ → 2[Fe(H₂O)₃(OH)₃] + 3CO₂ + 3H₂O',rule:5}},
 al:{naoh:{ppt:'#ffffff',obs:'Colourless solution → <b>white precipitate</b>.',prod:'[Al(H₂O)₃(OH)₃](s)',eq:'[Al(H₂O)₆]³⁺ + 3OH⁻ → [Al(H₂O)₃(OH)₃] + 3H₂O',rule:1},
     naohx:{ppt:'#ffffff',obs:'White precipitate, then it <b>dissolves</b> → <b>colourless solution</b>.',prod:'[Al(OH)₄]⁻(aq)',eq:'[Al(H₂O)₃(OH)₃] + OH⁻ → [Al(OH)₄]⁻ + 3H₂O',rule:3,excess:'dissolve',after:'#e6edf2'},
     nh3:{ppt:'#ffffff',obs:'Colourless solution → <b>white precipitate</b>.',prod:'[Al(H₂O)₃(OH)₃](s)',eq:'[Al(H₂O)₆]³⁺ + 3NH₃ → [Al(H₂O)₃(OH)₃] + 3NH₄⁺',rule:1},
     nh3x:{ppt:'#ffffff',obs:'White precipitate. <b>No further change</b> in excess.',prod:'[Al(H₂O)₃(OH)₃](s)',eq:'[Al(H₂O)₆]³⁺ + 3NH₃ → [Al(H₂O)₃(OH)₃] + 3NH₄⁺',rule:1,excess:'none'},
     co3:{ppt:'#ffffff',fizz:1,obs:'<b>White precipitate</b> and <b>bubbles of CO₂</b> (fizzing).',prod:'[Al(H₂O)₃(OH)₃](s) + CO₂(g)',eq:'2[Al(H₂O)₆]³⁺ + 3CO₃²⁻ → 2[Al(H₂O)₃(OH)₃] + 3CO₂ + 3H₂O',rule:5}}
};
const RULES={1:'Pattern 1 · Base pulls off H⁺ until the complex is neutral → precipitate',2:'Exception · Copper + excess ammonia → ligand substitution → deep blue solution',3:'Exception · Aluminium hydroxide is amphoteric → dissolves in excess OH⁻',4:'Carbonate + 2+ ion → metal carbonate precipitate, no fizz',5:'Carbonate + 3+ ion → hydroxide precipitate + CO₂ fizz (3+ ions are acidic enough)',6:'Chloride ions are bigger → only 4 fit → tetrahedral'};
const REAGENTS=[['naoh','NaOH, a few drops'],['naohx','NaOH, excess'],['nh3','NH₃, a few drops'],['nh3x','NH₃, excess'],['co3','Na₂CO₃'],['hcl','Conc. HCl']];
let tubeId=0;
function tubeSVG(){ const id='tc'+(++tubeId);
  return `<svg viewBox="0 0 140 270" class="tube" aria-hidden="true"><defs><clipPath id="${id}"><path d="M47 34 V222 a23 23 0 0 0 46 0 V34 Z"/></clipPath></defs>
   <ellipse class="drop" cx="70" cy="6" rx="5" ry="7"/>
   <g clip-path="url(#${id})"><rect class="liq" x="40" y="112" width="60" height="150"/><rect class="cloud" x="40" y="112" width="60" height="150"/><rect class="settle" x="40" y="214" width="60" height="50"/>
   <g class="bubbles">${[52,63,74,85,58,80,69].map((x,i)=>`<circle cx="${x}" cy="${238-(i%3)*14}" r="${2.4+i%3}" style="animation-delay:${i*.28}s"/>`).join('')}</g></g>
   <path class="glass" d="M47 26 V222 a23 23 0 0 0 46 0 V26"/><path class="glass" d="M40 26 H100"/></svg>`; }
function setTube(svg,o){ const q=s=>svg.querySelector(s);
  if(o.liq) q('.liq').style.fill=o.liq;
  if(o.cloud!==undefined){ q('.cloud').style.fill=o.pc||q('.cloud').style.fill; q('.cloud').style.opacity=o.cloud; }
  if(o.settle!==undefined){ q('.settle').style.fill=o.pc||q('.settle').style.fill; q('.settle').classList.toggle('on',!!o.settle); }
  if(o.fizz!==undefined) q('.bubbles').classList.toggle('fizz',!!o.fizz);
}
function makeLab(el){
  el.innerHTML=`<div class="lab-grid"><div class="bench"><div class="tubewrap">${tubeSVG()}</div><p class="tubelabel"></p></div>
    <div class="stack" style="min-width:0">
      <div><p class="small muted" style="margin-bottom:.3rem">1 · Pick the metal ion</p><div class="chips" role="group" aria-label="Metal ion">${Object.entries(METALS).map(([k,M])=>`<button data-m="${k}">${M.ion}</button>`).join('')}</div></div>
      <div><p class="small muted" style="margin-bottom:.3rem">2 · Add a reagent</p><div class="chips" role="group" aria-label="Reagent">${REAGENTS.map(([k,t])=>`<button data-rg="${k}">${t}</button>`).join('')}</div></div>
      <div class="row"><button class="btn quiet" data-air hidden>Leave it standing in air</button><button class="btn quiet" data-fresh>Fresh tube</button></div>
    </div></div>
    <div class="fb lab-out" aria-live="polite"></div>`;
  const svg=$('svg',el), out=$('.lab-out',el), label=$('.tubelabel',el), air=$('[data-air]',el);
  let metal='cu', timers=[];
  const clear=()=>{ timers.forEach(clearTimeout); timers=[]; };
  const later=(ms,f)=>{ if(calm()) f(); else timers.push(setTimeout(f,ms)); };
  function fresh(){ clear(); const M=METALS[metal]; setTube(svg,{liq:M.sol,cloud:0,settle:0,fizz:0}); svg.querySelector('.drop').classList.remove('fall');
    label.innerHTML=`[${M.sym}(H₂O)₆]${sup(M.charge)}(aq)<br><span class="muted">${M.solName}</span>`; air.hidden=true;
    out.innerHTML=`Pick a reagent to add to the <b>${M.name}</b> solution.`;
    $$('[data-m]',el).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===metal))); $$('[data-rg]',el).forEach(b=>b.setAttribute('aria-pressed','false')); }
  function add(r){ fresh(); const M=METALS[metal], d=LAB[metal][r];
    $$('[data-rg]',el).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rg===r)));
    if(!d){ out.innerHTML=`<b>Not in your notes.</b> The chloride reaction you need is for <b>copper</b>: [Cu(H₂O)₆]²⁺ + 4Cl⁻ ⇌ [CuCl₄]²⁻ + 6H₂O.`; return; }
    const drop=svg.querySelector('.drop'); if(!calm()){ void drop.getBBox(); drop.classList.add('fall'); }
    later(550,()=>{ if(d.change){ setTube(svg,{liq:d.change}); }
      else { setTube(svg,{pc:d.ppt,cloud:.82}); later(900,()=>setTube(svg,{pc:d.ppt,cloud:.32,settle:1})); }
      if(d.fizz){ setTube(svg,{fizz:1}); if(!calm()) timers.push(setTimeout(()=>setTube(svg,{fizz:0}),5200)); } });
    if(d.excess==='dissolve') later(2800,()=>{ setTube(svg,{liq:d.after,cloud:0,settle:0}); });
    const stage2=d.excess?`<p class="small muted">${d.excess==='dissolve'?'First a precipitate forms (Pattern 1). Keep adding and it dissolves:':'First a precipitate forms. Adding more does nothing.'}</p>`:'';
    out.innerHTML=`<p><b>Observation:</b> ${d.obs}</p>${stage2}<p><b>Product:</b> ${d.prod}</p><p class="eqline">${d.eq}</p><p class="rulechip">${RULES[d.rule]}</p>`;
    label.innerHTML=d.prod.replace('(s)','').replace(' + CO₂(g)','')+'<br><span class="muted">'+(d.change?'yellow solution':d.excess==='dissolve'?(metal==='cu'?'deep blue solution':'colourless solution'):'precipitate')+'</span>';
    air.hidden=!d.air; air.disabled=false;
  }
  el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.m){ metal=b.dataset.m; fresh(); }
    if(b.dataset.rg) add(b.dataset.rg);
    if(b.hasAttribute('data-fresh')) fresh();
    if(b.hasAttribute('data-air')){ setTube(svg,{pc:'#8a4b20',cloud:.32,settle:1}); b.disabled=true;
      out.insertAdjacentHTML('beforeend','<p><b>On standing in air:</b> the green precipitate turns <b>brown</b>. Oxygen oxidises Fe²⁺ to Fe³⁺: [Fe(H₂O)₄(OH)₂] → [Fe(H₂O)₃(OH)₃].</p>'); }
  });
  fresh();
}

/* static mini tubes: <span class="minitube" data-sol="#.." data-ppt="#.." data-fizz></span> */
function makeMini(el){ el.innerHTML=tubeSVG(); const s=$('svg',el); setTube(s,{liq:el.dataset.sol,pc:el.dataset.ppt||el.dataset.sol,cloud:el.dataset.ppt?.3:0,settle:el.dataset.ppt?1:0,fizz:el.hasAttribute('data-fizz')?1:0}); }

/* ------------------------------------------------------------------ Name that ion */
const CLUES={
  naoh:{fe2:'a <b>green</b> precipitate forms. It doesn’t dissolve in excess, and turns <b>brown</b> on standing in air',cu:'a <b>blue</b> precipitate forms, which doesn’t dissolve in excess',fe3:'a <b>brown</b> precipitate forms, which doesn’t dissolve in excess',al:'a <b>white</b> precipitate forms, which <b>dissolves in excess</b> to give a colourless solution'},
  nh3:{fe2:'a <b>green</b> precipitate forms, with no further change in excess',cu:'a <b>blue</b> precipitate forms, which <b>dissolves in excess</b> to give a <b>deep blue</b> solution',fe3:'a <b>brown</b> precipitate forms, with no further change in excess',al:'a <b>white</b> precipitate forms, with no further change in excess'},
  co3:{fe2:'a <b>green</b> precipitate forms, with <b>no fizzing</b>',cu:'a <b>blue-green</b> precipitate forms, with <b>no fizzing</b>',fe3:'a <b>brown</b> precipitate forms <b>and the mixture fizzes</b>',al:'a <b>white</b> precipitate forms <b>and the mixture fizzes</b>'}
};
const TESTNAME={naoh:'Adding NaOH(aq) dropwise, then in excess:',nh3:'Adding NH₃(aq) dropwise, then in excess:',co3:'Adding Na₂CO₃(aq):'};
function makeQuiz(el){
  el.innerHTML=`<div class="clue stack"></div><div class="chips" role="group" aria-label="Your answer">${Object.entries(METALS).map(([k,M])=>`<button data-g="${k}">${M.ion} (${M.name})</button>`).join('')}</div>
   <div class="fb" hidden aria-live="polite"></div><div class="row"><button class="btn" data-next>Next mystery solution</button><span class="small muted score"></span></div>`;
  let ans=null, last=null, right=0, total=0, done=false;
  function round(){ const keys=Object.keys(METALS); do{ ans=keys[Math.floor(Math.random()*4)]; }while(ans===last); last=ans; done=false;
    const tests=['naoh','nh3','co3'].sort(()=>Math.random()-.5).slice(0,2);
    $('.clue',el).innerHTML='<p class="eyebrow">Mystery solution</p>'+tests.map(t=>`<p><b>${TESTNAME[t]}</b> ${CLUES[t][ans]}.</p>`).join('')+'<p class="small muted">Which metal ion is in the solution?</p>';
    $('.fb',el).hidden=true; $$('[data-g]',el).forEach(b=>{b.classList.remove('right','wrong'); b.setAttribute('aria-pressed','false');}); }
  el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.g){ const ok=b.dataset.g===ans; if(!done){ total++; if(ok) right++; done=true; }
      b.setAttribute('aria-pressed','true'); const fb=$('.fb',el); fb.hidden=false; fb.className='fb anim '+(ok?'good':'nope');
      const M=METALS[ans]; fb.innerHTML=ok?`<span class="verdict">✓ Correct</span> It’s <b>${M.ion}</b>, [${M.sym}(H₂O)₆]${sup(M.charge)}.`:`<span class="verdict">✗ Not quite</span> Look at the colour of the precipitate first, then whether it dissolves in excess or fizzes. Try again.`;
      $('.score',el).textContent=right+' of '+total+' right first time'; }
    if(b.hasAttribute('data-next')) round(); });
  round();
}

$$('.minitube').forEach(makeMini);
$$('.lab').forEach(makeLab);
$$('.ionquiz').forEach(makeQuiz);
if(window.THREE) $$('.mol3d').forEach(makeViewer); else $$('.mol3d').forEach(el=>el.innerHTML='<p class="small">The 3D model couldn’t load. Check your connection and refresh.</p>');
})();
