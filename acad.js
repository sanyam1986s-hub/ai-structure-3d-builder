(()=>{ "use strict";
// AI Structure 3D Builder — AutoCAD 2D Writer module (v4.4). Loaded after the main module; reads app state through window.__ai3d.
const AI=window.__ai3d; const $=q=>document.querySelector(q); const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const state=new Proxy({},{get:(t,k)=>AI.state[k],set:(t,k,v)=>{ AI.state[k]=v; return true; }});
const openModal=(n,d)=>AI.openModal(n,d);
// ================================================================
// v4.4 — AutoCAD 2D Writer: draw the model straight into AutoCAD (AutoLISP command AI3D2D, or .scr script for AutoCAD LT)
//   geometry → primitive list (metres) → serialise to LISP / SCR, + SVG preview
// ================================================================
const ACAD_LAY={'S-GRID':[8,'CENTER'],'S-GRIDTXT':[7,'Continuous'],'S-COL':[1,'Continuous'],'S-BEAM':[3,'Continuous'],'S-STEEL':[5,'Continuous'],'S-SLAB':[9,'Continuous'],'S-FTG':[30,'Continuous'],'S-PILE':[6,'Continuous'],'S-ROOF':[4,'Continuous'],'S-PURLIN':[2,'DASHED'],'S-BRACE':[1,'DASHED'],'S-LEVEL':[140,'Continuous'],'S-TEXT':[7,'Continuous'],'S-DIM':[8,'Continuous'],'S-TITLE':[2,'Continuous'],'S-TABLE':[7,'Continuous'],'A-WALL':[7,'Continuous'],'A-DOOR':[3,'Continuous'],'A-WIND':[4,'Continuous'],'A-ROOM':[2,'Continuous'],'A-STAIR':[6,'Continuous'],'A-FURN':[8,'Continuous']};
function acadCfg(){ return {unit:$('#acUnit').value, scale:+$('#acScale').value, views:[...document.querySelectorAll('#acViews input:checked')].map(c=>c.value), fmt:$('#acFmt').value, tf:AC_PLAN.tf||1, notes:AC_PLAN.notes||[]}; }
let AC_PLAN={};
function acadBuild(o){ const M=state.model, D=state.design, P=state.params; if(!M) return {prims:[],views:[]};
  const secs=D.secs, ts=o.scale/100, TH=0.25*ts*(o.tf||1), prims=[], views=[]; const E=1e-3;
  const L=(a,b,ly)=>prims.push({t:'L',a,b,ly}), C=(c,r,ly)=>prims.push({t:'C',c,r,ly}), T=(p,s,h,ly,rot=0)=>prims.push({t:'T',p,s:String(s),h,ly,rot});
  const PL=(pts,ly,cl=true)=>prims.push({t:'PL',pts,ly,cl}), S=(pts,ly)=>prims.push({t:'S',pts,ly}), DM=(a,b,loc,ly='S-DIM')=>prims.push({t:'D',a,b,loc,ly,h:TH});
  const rect=(cx,cy,w,h,ly,fill)=>{ const p=[[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]]; PL(p,ly); if(fill) S(p,ly); };
  const gx=M.gx, gy=M.gy, X0=gx[0].pos, X1=gx[gx.length-1].pos, Y0=gy[0].pos, Y1=gy[gy.length-1].pos; const ext=1.2*ts+0.8, br=0.45*ts;
  const nd=i=>M.nodes[i-1]; const secTxt=s=>!s?'':s.kind==='RECT'?`${s.b}x${s.h}`:s.kind==='CIRC'?`D${s.d}`:(s.name||'');
  const isV=m=>{ const a=nd(m.i), b=nd(m.j); return Math.abs(a.x-b.x)<E&&Math.abs(a.y-b.y)<E; };
  const ROOFT=new Set(['rafter','purlin','tchord','bchord','tweb','btie','rbeam','strut','rbrace','ebeam']);
  // ---- plan frame: grids, bubbles, dimension chains (offset ox,oy) ----
  const planGrid=(ox,oy)=>{ for(const g of gx){ const x=ox+g.pos; L([x,oy+Y0-ext],[x,oy+Y1+ext*0.6],'S-GRID'); C([x,oy+Y0-ext-br],br,'S-GRIDTXT'); T([x,oy+Y0-ext-br],g.label,br*0.9,'S-GRIDTXT'); }
    for(const g of gy){ const y=oy+g.pos; L([ox+X0-ext,y],[ox+X1+ext*0.6,y],'S-GRID'); C([ox+X0-ext-br,y],br,'S-GRIDTXT'); T([ox+X0-ext-br,y],g.label,br*0.9,'S-GRIDTXT'); }
    const dy=oy+Y1+ext*0.6+0.6*ts; for(let i=1;i<gx.length;i++) DM([ox+gx[i-1].pos,oy+Y1],[ox+gx[i].pos,oy+Y1],[ox+gx[i].pos,dy]); if(gx.length>2) DM([ox+X0,oy+Y1],[ox+X1,oy+Y1],[ox+X1,dy+0.7*ts]);
    const dx=ox+X1+ext*0.6+0.6*ts; for(let i=1;i<gy.length;i++) DM([ox+X1,oy+gy[i-1].pos],[ox+X1,oy+gy[i].pos],[dx,oy+gy[i].pos]); if(gy.length>2) DM([ox+X1,oy+Y0],[ox+X1,oy+Y1],[dx+0.7*ts,oy+Y1]); };
  const title=(ox,oy,cx,txt,sub)=>{ const y=oy+Y0-ext-2*br-1.0*ts; T([ox+cx,y],txt,0.5*ts,'S-TITLE'); const w=Math.min(20,txt.length*0.32*ts); L([ox+cx-w,y-0.4*ts],[ox+cx+w,y-0.4*ts],'S-TITLE'); if(sub) T([ox+cx,y-0.85*ts],sub,TH,'S-TEXT'); };
  const colAt=(ox,oy,m,top)=>{ const n=top?(nd(m.i).z>nd(m.j).z?nd(m.i):nd(m.j)):nd(m.i); const s=secs[m.sec]; if(!s) return; const x=ox+n.x, y=oy+n.y;
    if(s.kind==='RECT') rect(x,y,s.b/100,s.h/100,'S-COL',true); else if(s.kind==='CIRC'){ C([x,y],s.d/200,'S-COL'); } else { const d=(s.d||200)/1000, b=(s.bf||s.d||150)/1000; rect(x,y,b,d,'S-STEEL',false); L([x-b/2,y],[x+b/2,y],'S-STEEL'); }
    T([x+0.35*ts,y+0.35*ts],m.sec,TH*0.8,'S-TEXT'); };
  const memLine=(ox,oy,m,ly,lab)=>{ const a=nd(m.i), b=nd(m.j), s=secs[m.sec]; const ax=ox+a.x, ay=oy+a.y, bx=ox+b.x, by=oy+b.y; const len=Math.hypot(bx-ax,by-ay); if(len<E) return; const ux=(bx-ax)/len, uy=(by-ay)/len;
    if(s?.kind==='RECT'&&ly==='S-BEAM'){ const w=s.b/200; L([ax-uy*w,ay+ux*w],[bx-uy*w,by+ux*w],ly); L([ax+uy*w,ay-ux*w],[bx+uy*w,by-ux*w],ly); } else L([ax,ay],[bx,by],ly);
    if(lab){ let r=Math.atan2(uy,ux); if(r>Math.PI/2+E||r<-Math.PI/2+E) r+=Math.PI; const off=(s?.kind==='RECT'?s.b/200:0)+0.3*ts; T([(ax+bx)/2-Math.sin(r)*off,(ay+by)/2+Math.cos(r)*off],`${m.sec} ${secTxt(s)}`,TH*0.8,'S-TEXT',r); } };
  const W=X1-X0+2*ext+3*ts+2, H=Y1-Y0+2*ext+4*ts+3; let col=0;
  const place=()=>{ const ox=col*(W+4*ts)-X0+ext+br*2, oy=0; col++; return [ox,oy]; };
  // ---- footing plan ----
  if(o.views.includes('ftg')&&M.footings.length){ const [ox,oy]=place(); planGrid(ox,oy);
    for(const fo of M.footings){ const s=secs[fo.sec]; if(!s) continue; const Bx=(s.Bx||s.B)/100, By=(s.By||s.B)/100, x=ox+fo.x, y=oy+fo.y; rect(x,y,Bx,By,'S-FTG'); rect(x,y,s.ped/100,s.ped/100,'S-COL',true);
      if(s.kind==='PCAP'&&Array.isArray(s.pts)) s.pts.forEach(([px,py])=>{ C([x+px,y+py],(s.pile||0.22)/2,'S-PILE'); L([x+px-(s.pile||0.22)/2,y+py],[x+px+(s.pile||0.22)/2,y+py],'S-PILE'); });
      T([x,y-By/2-0.35*ts],fo.sec,TH,'S-TEXT'); }
    title(ox,oy,(X0+X1)/2,'แปลนฐานราก (FOUNDATION PLAN)',`มาตราส่วน 1:${o.scale}`); views.push('แปลนฐานราก'); }
  // ---- floor plans ----
  if(o.views.includes('plans')) M.levels.forEach((lv,li)=>{ if(li===0) return; const z=lv.elev; const bm=M.members.filter(m=>!isV(m)&&Math.abs(nd(m.i).z-z)<0.02&&Math.abs(nd(m.j).z-z)<0.02&&!ROOFT.has(m.type)); const sl=M.slabs.filter(s=>Math.abs(s.z-z)<0.05);
    if(!bm.length&&!sl.length) return; const [ox,oy]=place(); planGrid(ox,oy);
    for(const s of sl){ const p=[[ox+s.x1,oy+s.y1],[ox+s.x2,oy+s.y1],[ox+s.x2,oy+s.y2],[ox+s.x1,oy+s.y2]]; C([ox+(s.x1+s.x2)/2,oy+(s.y1+s.y2)/2+0.45*ts],0.3*ts,'S-SLAB'); T([ox+(s.x1+s.x2)/2,oy+(s.y1+s.y2)/2-0.15*ts],`${s.sec} t=${Math.round((s.t||0)*100)} cm`,TH*0.8,'S-TEXT'); }
    const seen=new Set(); for(const m of bm){ const s=secs[m.sec]; const k=m.sec+'|'+nd(m.i).y.toFixed(2); memLine(ox,oy,m,s?.kind==='RECT'?'S-BEAM':'S-STEEL',!seen.has(k)); seen.add(k); }
    M.members.filter(m=>isV(m)&&Math.abs(Math.max(nd(m.i).z,nd(m.j).z)-z)<0.02).forEach(m=>colAt(ox,oy,m,true));
    title(ox,oy,(X0+X1)/2,`แปลนโครงสร้างชั้น ${lv.name} (+${lv.elev.toFixed(2)})`,`มาตราส่วน 1:${o.scale}`); views.push('แปลน '+lv.name); });
  // ---- roof plan ----
  const rm=M.members.filter(m=>ROOFT.has(m.type)); if(o.views.includes('roof')&&rm.length){ const [ox,oy]=place(); planGrid(ox,oy); const seen=new Set();
    for(const m of rm){ const ly=m.type==='purlin'?'S-PURLIN':/brace/.test(m.type)?'S-BRACE':'S-ROOF'; const k=m.type+m.sec; memLine(ox,oy,m,ly,m.type!=='purlin'&&!seen.has(k)); seen.add(k); }
    M.members.filter(m=>isV(m)&&['pcolumn','column','xcolumn'].includes(m.type)).forEach(m=>{ const top=Math.max(nd(m.i).z,nd(m.j).z); if(top>=Math.max(...M.levels.map(l=>l.elev))-0.02) colAt(ox,oy,m,true); });
    const pu=rm.find(m=>m.type==='purlin'); if(pu) T([ox+X1+ext,oy+Y0-ext-0.4*ts],`แป ${secTxt(secs[pu.sec])} @ ${P.portal.purlin_spacing} m`,TH,'S-TEXT');
    title(ox,oy,(X0+X1)/2,'แปลนหลังคา (ROOF FRAMING PLAN)',`มาตราส่วน 1:${o.scale} · ความชัน ${P.portal.roof_slope_deg}°`); views.push('แปลนหลังคา'); }
  // ---- elevations (row 2) ----
  const zMax=Math.max(...M.nodes.map(n=>n.z)), zMin=Math.min(0,...M.nodes.map(n=>n.z),M.footings.length?-(P.soil.Df||1.5)-0.3:0); let ecol=0; const EOY=Y0-ext-2*br-3*ts-zMax-2*ts-3;
  const elev=(axis,line,tag)=>{ const G=axis==='x'?gx:gy, c0=G[0].pos, c1=G[G.length-1].pos; const ox=ecol*((Math.max(X1-X0,Y1-Y0))+2*ext+8*ts)-c0+ext+br*2, oy=EOY; ecol++;
    const on=n=>axis==='x'?Math.abs(n.y-line)<0.02:Math.abs(n.x-line)<0.02, u=n=>axis==='x'?n.x:n.y;
    for(const g of G){ const x=ox+g.pos; L([x,oy+zMin-1],[x,oy+zMax+ext*0.6],'S-GRID'); C([x,oy+zMin-1-br],br,'S-GRIDTXT'); T([x,oy+zMin-1-br],g.label,br*0.9,'S-GRIDTXT'); }
    for(const lv of M.levels){ const y=oy+lv.elev; L([ox+c0-ext,y],[ox+c1+ext*0.4,y],'S-LEVEL'); const tx=ox+c1+ext*0.4; PL([[tx,y],[tx+0.25*ts,y+0.3*ts],[tx-0.25*ts,y+0.3*ts]],'S-LEVEL'); T([tx+0.9*ts,y+0.55*ts],`${lv.name} ${lv.elev>=0?'+':''}${lv.elev.toFixed(2)}`,TH,'S-TEXT'); }
    for(const m of M.members){ const a=nd(m.i), b=nd(m.j); if(!on(a)||!on(b)) continue; const s=secs[m.sec]; const A=[ox+u(a),oy+a.z], B=[ox+u(b),oy+b.z];
      const ly=s?.kind==='RECT'||s?.kind==='CIRC'?(isV(m)?'S-COL':'S-BEAM'):(m.type==='purlin'?'S-PURLIN':/brace/.test(m.type)?'S-BRACE':'S-STEEL');
      if(s?.kind==='RECT'){ const w=(isV(m)?(axis==='x'?s.b:s.h):s.h)/200; if(isV(m)){ L([A[0]-w,A[1]],[B[0]-w,B[1]],ly); L([A[0]+w,A[1]],[B[0]+w,B[1]],ly); } else { L([A[0],A[1]],[B[0],B[1]],ly); L([A[0],A[1]-2*w],[B[0],B[1]-2*w],ly); } } else L(A,B,ly); }
    for(const fo of M.footings){ if(!on({x:fo.x,y:fo.y})) continue; const s=secs[fo.sec]; if(!s) continue; const B=(axis==='x'?(s.Bx||s.B):(s.By||s.B))/100, t=s.D/100, Df=P.soil.Df, x=ox+(axis==='x'?fo.x:fo.y);
      rect(x,oy-Df+t/2,B,t,'S-FTG'); L([x-s.ped/200,oy-Df+t],[x-s.ped/200,oy],'S-COL'); L([x+s.ped/200,oy-Df+t],[x+s.ped/200,oy],'S-COL'); }
    L([ox+c0-ext,oy],[ox+c1+ext*0.4,oy],'S-LEVEL'); for(let i=1;i<G.length;i++) DM([ox+G[i-1].pos,oy+zMin-1],[ox+G[i].pos,oy+zMin-1],[ox+G[i].pos,oy+zMin-1-2*br-0.6*ts]);
    const ttl=`รูปด้านโครงสร้าง แนว ${tag}`; const yT=oy+zMin-1-2*br-1.8*ts; T([ox+(c0+c1)/2,yT],ttl,0.5*ts,'S-TITLE'); L([ox+(c0+c1)/2-Math.min(20,ttl.length*0.32*ts),yT-0.4*ts],[ox+(c0+c1)/2+Math.min(20,ttl.length*0.32*ts),yT-0.4*ts],'S-TITLE'); T([ox+(c0+c1)/2,yT-0.85*ts],`มาตราส่วน 1:${o.scale}`,TH,'S-TEXT'); views.push(ttl); };
  if(o.views.includes('elx')) elev('x',gy[0].pos,'Grid '+gy[0].label);
  if(o.views.includes('ely')) elev('y',gx[0].pos,'Grid '+gx[0].label);
  // ---- section schedule ----
  if(o.views.includes('sched')){ const rows=D.groups.filter(g=>!g.hidden); const cw=[3.2,6.5,9,3].map(v=>v*ts), rh=0.7*ts; const x0=Math.max(1,ecol)*((Math.max(X1-X0,Y1-Y0))+2*ext+8*ts)+2, y0=EOY+zMax+1;
    const hdr=['MARK','ชิ้นส่วน','หน้าตัด / เหล็กเสริม','ผล']; const tw=cw.reduce((a,b)=>a+b,0);
    T([x0+tw/2,y0+1.0*ts],'ตารางหน้าตัดชิ้นส่วนโครงสร้าง (SECTION SCHEDULE)',0.45*ts,'S-TITLE');
    [hdr,...rows.map(g=>[g.key,g.title.replace(/^.*?:\s*/,'').slice(0,28),(g.section||'').slice(0,46),g.status==='NG'?'NG':'OK'])].forEach((r,i)=>{ const y=y0-i*rh; let x=x0; r.forEach((c,j)=>{ PL([[x,y],[x+cw[j],y],[x+cw[j],y-rh],[x,y-rh]],'S-TABLE'); T([x+cw[j]/2,y-rh/2],c,TH*(i?0.75:0.85),'S-TEXT'); x+=cw[j]; }); });
    views.push('ตารางหน้าตัด'); }
  // ---- general notes written by the AI drafter (from the AutoCAD skill) ----
  if(o.notes?.length){ const nx=-X0+ext+br*2, ny=EOY+zMin-1-2*br-4*ts-1; T([nx+6*ts,ny],'หมายเหตุทั่วไป (GENERAL NOTES)',0.4*ts,'S-TITLE');
    o.notes.slice(0,30).forEach((t,i)=>prims.push({t:'T',p:[nx,ny-(i+1)*0.55*ts],s:String(t).slice(0,120),h:TH*0.9,ly:'S-TEXT',rot:0,left:true})); views.push('หมายเหตุทั่วไป'); }
  return {prims,views}; }
// ---- serialisers ----
const acU=s=>String(s).replace(/[^\x20-\x7e]/g,c=>'\\U+'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));
const acN=v=>{ const r=Math.round(v*1e4)/1e4; return Object.is(r,-0)?'0':String(r); };
function acadLISP(B,o){ const k=o.unit==='mm'?1000:1, P=p=>`'(${acN(p[0]*k)} ${acN(p[1]*k)} 0.0)`, q=s=>'"'+acU(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"'; const prm=state.params;
  const out=[`;;; AI Structure 3D Builder - AutoCAD 2D Writer (v4.4)`,`;;; Project: ${acU(prm.project_name||'').replace(/\n/g,' ')}`,`;;; Units: ${o.unit} | text/dim scale 1:${o.scale} | ${B.prims.length} entities | ${new Date().toISOString().slice(0,10)}`,
  `;;; Use: APPLOAD this file (or drag it into the drawing), then type AI3D2D`,'',
  '(vl-load-com)',
  '(defun ai:lay (n c lt) (if (not (tblsearch "LAYER" n)) (entmake (list \'(0 . "LAYER") \'(100 . "AcDbSymbolTableRecord") \'(100 . "AcDbLayerTableRecord") (cons 2 n) \'(70 . 0) (cons 62 c) (cons 6 (if (tblsearch "LTYPE" lt) lt "Continuous"))))))',
  '(defun ai:L (a b ly) (entmake (list \'(0 . "LINE") (cons 8 ly) (cons 10 a) (cons 11 b))))',
  '(defun ai:C (c r ly) (entmake (list \'(0 . "CIRCLE") (cons 8 ly) (cons 10 c) (cons 40 r))))',
  '(defun ai:T (p s h ly r) (entmake (list \'(0 . "TEXT") (cons 8 ly) (cons 7 "AI3D") (cons 10 p) (cons 11 p) (cons 40 h) (cons 1 s) (cons 50 r) \'(72 . 1) \'(73 . 2))))',
  '(defun ai:TL (p s h ly) (entmake (list \'(0 . "TEXT") (cons 8 ly) (cons 7 "AI3D") (cons 10 p) (cons 40 h) (cons 1 s))))',
  '(defun ai:PL (pts ly cl) (entmake (append (list \'(0 . "LWPOLYLINE") \'(100 . "AcDbEntity") (cons 8 ly) \'(100 . "AcDbPolyline") (cons 90 (length pts)) (cons 70 (if cl 1 0))) (mapcar \'(lambda (p) (cons 10 p)) pts))))',
  '(defun ai:S (a b c d ly) (entmake (list \'(0 . "SOLID") (cons 8 ly) (cons 10 a) (cons 11 b) (cons 12 d) (cons 13 c))))',
  '(defun ai:D (a b l ly) (setvar "CLAYER" ly) (vl-catch-all-apply \'vl-cmdf (list "_.DIMLINEAR" a b l)))',
  '(defun c:AI3D2D ( / os ce cl)',
  '  (setq os (getvar "OSMODE") ce (getvar "CMDECHO") cl (getvar "CLAYER")) (setvar "OSMODE" 0) (setvar "CMDECHO" 0)',
  '  (foreach lt \'("CENTER" "DASHED") (if (not (tblsearch "LTYPE" lt)) (vl-catch-all-apply \'vl-cmdf (list "_.-LINETYPE" "_L" lt (if (= (getvar "MEASUREMENT") 1) "acadiso.lin" "acad.lin") ""))))',
  '  (if (not (tblsearch "STYLE" "AI3D")) (entmake \'((0 . "STYLE") (100 . "AcDbSymbolTableRecord") (100 . "AcDbTextStyleTableRecord") (2 . "AI3D") (70 . 0) (40 . 0.0) (41 . 1.0) (50 . 0.0) (71 . 0) (42 . 2.5) (3 . "tahoma.ttf") (4 . ""))))',
  ...Object.entries(ACAD_LAY).map(([n,[c,lt]])=>`  (ai:lay "${n}" ${c} "${lt}")`),
  `  (setvar "LTSCALE" ${acN(o.scale*k/1000*0.5)}) (setvar "DIMSCALE" ${acN(o.scale*k/1000)}) (setvar "DIMTXSTY" "AI3D")`];
  for(const p of B.prims){ const ly=`"${p.ly}"`;
    if(p.t==='L') out.push(`  (ai:L ${P(p.a)} ${P(p.b)} ${ly})`); else if(p.t==='C') out.push(`  (ai:C ${P(p.c)} ${acN(p.r*k)} ${ly})`);
    else if(p.t==='T') out.push(p.left?`  (ai:TL ${P(p.p)} ${q(p.s)} ${acN(p.h*k)} ${ly})`:`  (ai:T ${P(p.p)} ${q(p.s)} ${acN(p.h*k)} ${ly} ${acN(p.rot||0)})`); else if(p.t==='PL') out.push(`  (ai:PL (list ${p.pts.map(P).join(' ')}) ${ly} ${p.cl?'T':'nil'})`);
    else if(p.t==='S') out.push(`  (ai:S ${p.pts.map(P).join(' ')} ${ly})`); else if(p.t==='D') out.push(`  (ai:D ${P(p.a)} ${P(p.b)} ${P(p.loc)} ${ly})`); }
  out.push('  (setvar "CLAYER" cl) (setvar "OSMODE" os) (setvar "CMDECHO" ce)','  (vl-catch-all-apply \'vl-cmdf (list "_.ZOOM" "_E"))',`  (princ "\\nAI3D2D: drawn ${B.prims.length} entities (${B.views.length} views).") (princ))`,'(princ "\\nAI Structure 3D: type AI3D2D to draw the structural 2D drawings.") (princ)','');
  return out.join('\r\n'); }
function acadSCR(B,o){ const k=o.unit==='mm'?1000:1, P=p=>`${acN(p[0]*k)},${acN(p[1]*k)}`; const out=['CMDECHO 0','OSMODE 0','ORTHOMODE 0','_.-STYLE AI3D tahoma.ttf 0 1 0 _N _N',`DIMSCALE ${acN(o.scale*k/1000)}`,'DIMTXSTY AI3D'];
  for(const [n,[c]] of Object.entries(ACAD_LAY)) out.push(`_.-LAYER _M ${n} _C ${c} ${n} `);
  let cur=''; const lay=ly=>{ if(ly!==cur){ out.push(`_.-LAYER _S ${ly} `); cur=ly; } };
  for(const p of [...B.prims].sort((a,b)=>a.ly<b.ly?-1:a.ly>b.ly?1:0)){ lay(p.ly);
    if(p.t==='L') out.push(`_.LINE ${P(p.a)} ${P(p.b)} `); else if(p.t==='C') out.push(`_.CIRCLE ${P(p.c)} ${acN(p.r*k)}`);
    else if(p.t==='T') out.push(p.left?`_.-TEXT _S AI3D ${P(p.p)} ${acN(p.h*k)} 0`:`_.-TEXT _S AI3D _J _MC ${P(p.p)} ${acN(p.h*k)} ${acN((p.rot||0)*180/Math.PI)}`,acU(p.s));
    else if(p.t==='PL') out.push(`_.PLINE ${p.pts.map(P).join(' ')} ${p.cl?'_C':' '}`); else if(p.t==='S') out.push(`_.SOLID ${P(p.pts[0])} ${P(p.pts[1])} ${P(p.pts[3])} ${P(p.pts[2])} `);
    else if(p.t==='D') out.push(`_.DIMLINEAR ${P(p.a)} ${P(p.b)} ${P(p.loc)}`); }
  out.push('_.ZOOM _E','CMDECHO 1',''); return out.join('\r\n'); }
function acadSVG(B){ if(!B.prims.length) return '<div class="status">ยังไม่มีโมเดล</div>'; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; const ex=p=>{ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); y0=Math.min(y0,p[1]); y1=Math.max(y1,p[1]); };
  B.prims.forEach(p=>{ if(p.a) ex(p.a); if(p.b) ex(p.b); if(p.c) ex(p.c); if(p.p) ex(p.p); if(p.pts) p.pts.forEach(ex); if(p.loc) ex(p.loc); });
  const col={'S-GRID':'#94a3b8','S-GRIDTXT':'#334155','S-COL':'#dc2626','S-BEAM':'#16a34a','S-STEEL':'#2563eb','S-SLAB':'#a8a29e','S-FTG':'#b45309','S-PILE':'#c026d3','S-ROOF':'#0891b2','S-PURLIN':'#ca8a04','S-BRACE':'#dc2626','S-LEVEL':'#0f766e','S-TEXT':'#111827','S-DIM':'#64748b','S-TITLE':'#111827','S-TABLE':'#334155','A-WALL':'#111827','A-DOOR':'#16a34a','A-WIND':'#0891b2','A-ROOM':'#a16207','A-STAIR':'#7c3aed','A-FURN':'#94a3b8'};
  const Y=y=>y1-y+(y0-y0); const sw=(x1-x0)/1600; let h='';
  for(const p of B.prims){ const c=col[p.ly]||'#000'; const dash=/GRID$|PURLIN|BRACE/.test(p.ly)?` stroke-dasharray="${sw*8} ${sw*4}"`:'';
    if(p.t==='L') h+=`<line x1="${p.a[0]}" y1="${Y(p.a[1])}" x2="${p.b[0]}" y2="${Y(p.b[1])}" stroke="${c}" stroke-width="${sw}"${dash}/>`;
    else if(p.t==='C') h+=`<circle cx="${p.c[0]}" cy="${Y(p.c[1])}" r="${p.r}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
    else if(p.t==='PL'||p.t==='S') h+=`<polygon points="${p.pts.map(q=>q[0]+','+Y(q[1])).join(' ')}" fill="${p.t==='S'?c:'none'}" fill-opacity="${p.t==='S'?0.6:0}" stroke="${c}" stroke-width="${sw}"/>`;
    else if(p.t==='T') h+=`<text x="${p.p[0]}" y="${Y(p.p[1])}" font-size="${p.h}" fill="${c}" text-anchor="${p.left?'start':'middle'}" dominant-baseline="central" transform="rotate(${-(p.rot||0)*180/Math.PI} ${p.p[0]} ${Y(p.p[1])})">${esc(p.s)}</text>`;
    else if(p.t==='D'){ const v=Math.abs(p.a[0]-p.b[0])<1e-6; const A=v?[p.loc[0],p.a[1]]:[p.a[0],p.loc[1]], Bp=v?[p.loc[0],p.b[1]]:[p.b[0],p.loc[1]]; const d=Math.hypot(p.a[0]-p.b[0],p.a[1]-p.b[1]);
      h+=`<line x1="${A[0]}" y1="${Y(A[1])}" x2="${Bp[0]}" y2="${Y(Bp[1])}" stroke="${c}" stroke-width="${sw}"/><text x="${(A[0]+Bp[0])/2}" y="${Y((A[1]+Bp[1])/2)}" font-size="${p.h||sw*16}" fill="${c}" text-anchor="middle" dy="${-(p.h||sw*16)*0.4}" ${v?`transform="rotate(-90 ${(A[0]+Bp[0])/2} ${Y((A[1]+Bp[1])/2)})"`:''}>${d.toFixed(2)}</text>`; } }
  const pad=(x1-x0)*0.02; return `<svg viewBox="${x0-pad} ${Y(y1)-pad} ${x1-x0+2*pad} ${y1-y0+2*pad}" style="width:100%;height:auto;background:#fff" role="img" aria-label="ตัวอย่างแบบ 2D ที่จะเขียนลง AutoCAD" font-family="Tahoma,sans-serif">${h}</svg>`; }
function acadRender(){ const o=acadCfg(); const B=acadBuild(o); state.acad={B,o}; $('#acPrev').innerHTML=acadSVG(B);
  const n={}; B.prims.forEach(p=>n[p.ly]=(n[p.ly]||0)+1);
  $('#acInfo').textContent=`${B.views.length} แบบ: ${B.views.join(' · ')} — รวม ${B.prims.length} entities (${Object.entries(n).map(([k,v])=>k+' '+v).join(', ')})`; return B; }
function acadCode(){ const {B,o}=state.acad||{B:acadRender(),o:acadCfg()}; return o.fmt==='scr'?acadSCR(B,o):acadLISP(B,o); }
$('#acPreview').onclick=acadRender; ['#acUnit','#acScale','#acFmt'].forEach(q=>$(q).addEventListener('change',acadRender)); $('#acViews').addEventListener('change',acadRender);
$('#acSave').onclick=async()=>{ acadRender(); const o=acadCfg(); const base=(state.params.project_name||'model').replace(/[^\w฀-๿-]+/g,'_').slice(0,40)||'model'; const ext=o.fmt==='scr'?'scr':'lsp'; const name=`${base}_AI3D2D.${ext}`; const data=acadCode();
  const downloadsFn=AI.downloadsFn; if(downloadsFn){ for(const nm of [name,name.replace(/\.(lsp|scr)$/,'_$1.txt')]){ try{ await downloadsFn.save({filename:nm,data}); $('#acStatus').textContent=nm===name?`บันทึก ${nm} แล้ว`:`บันทึกเป็น ${nm} — เปลี่ยนนามสกุลเป็น .${ext} ก่อนใช้ใน AutoCAD`; return; }catch(e){ if(e.code==='declined'){ $('#acStatus').textContent='ยกเลิกการบันทึก'; return; } } } }
  openModal(name,data); };
$('#acCopy').onclick=async()=>{ acadRender(); const data=acadCode(); try{ await navigator.clipboard.writeText(data); $('#acStatus').textContent=`คัดลอกโค้ด ${(data.length/1024).toFixed(0)} KB แล้ว — ${acadCfg().fmt==='scr'?'บันทึกเป็นไฟล์ .scr แล้วใช้คำสั่ง SCRIPT':'วางลงใน Command line ของ AutoCAD (หรือ VLISP Console) แล้วพิมพ์ AI3D2D'}`; }catch(e){ openModal('AI3D2D.'+(acadCfg().fmt==='scr'?'scr':'lsp'),data); } };
document.querySelector('[data-tab="acad"]').addEventListener('click',()=>setTimeout(acadRender,30));

// =====================================================================
// AutoCAD Drafting SKILL (embedded, versioned, self-learning) + AI drafter + local AutoCAD Agent
// =====================================================================
const SK_KEY='ai3d_acad_skill_v1';
const SK_DEFAULT=`# Skill: AI เขียนแบบโครงสร้างใน AutoCAD (AI Structure 3D Builder)
## เป้าหมาย
เขียนแบบก่อสร้างโครงสร้าง 2D ลง AutoCAD จากโมเดลในโปรแกรม ให้ถูกต้อง อ่านง่าย ตามแนวปฏิบัติแบบก่อสร้างไทย (วสท./มยผ.) และ ACI/AISC
## ขั้นตอน
1. ตรวจข้อมูลโมเดล: Grid, ระดับชั้น, ชนิดโครงสร้าง (คสล./เหล็ก/หลังคาโครงเหล็ก), ฐานราก/เสาเข็ม, กลุ่มหน้าตัด
2. เลือกชุดแบบ: แปลนฐานราก → แปลนโครงสร้างทุกชั้น → แปลนหลังคา (ถ้ามี) → รูปด้าน X/Y → ตารางหน้าตัด → หมายเหตุทั่วไป
3. หน่วยแบบ mm, วาดขนาดจริง 1:1, มาตราส่วนตัวอักษร/Dim 1:100 (อาคารยาวเกิน 60 m ใช้ 1:200; รายละเอียดเล็กใช้ 1:50)
4. Layer มาตรฐาน S-* (S-GRID เส้น CENTER, S-COL, S-BEAM, S-STEEL, S-FTG, S-PILE, S-ROOF, S-PURLIN, S-DIM, S-TEXT, S-TITLE)
5. ความสูงตัวอักษรบนกระดาษ: ข้อความทั่วไป 2.5 mm, ชื่อแบบ 5 mm, Bubble Grid Ø 9 mm
6. ทุกแปลนต้องมี Grid + Bubble + Dimension ระยะช่วงและระยะรวม; ทุกรูปด้านต้องมีระดับชั้น (+0.00)
7. หมายเหตุทั่วไปต้องระบุ: กำลังคอนกรีต fc', ชั้นเหล็กเสริม, เหล็กรูปพรรณ, ระยะหุ้ม, ระยะทาบ, หน่วยในแบบ, มาตรฐานที่ใช้
8. ตรวจก่อนส่ง: กลุ่มที่ NG ต้องแจ้งใน checklist, ชิ้นส่วนที่ไม่มีหน้าตัดต้องแจ้ง
## บทเรียนที่เรียนรู้ (อัปเดตอัตโนมัติจากการสอนของวิศวกร)
`;
function skLoad(){ try{ const j=JSON.parse(localStorage.getItem(SK_KEY)||'null'); if(j&&j.md) return j; }catch(e){} return {ver:1,md:SK_DEFAULT,lessons:[],runs:0,updated:new Date().toISOString().slice(0,10)}; }
function skSave(sk){ sk.updated=new Date().toISOString().slice(0,10); try{ localStorage.setItem(SK_KEY,JSON.stringify(sk)); }catch(e){} skUI(); }
let SK=skLoad();
function skText(){ return SK.md+(SK.lessons.length?SK.lessons.map((l,i)=>`${i+1}. ${l.text} (${l.date})`).join('\n'):'- (ยังไม่มี)'); }
function modelSummary(){ const M=state.model, D=state.design, P=state.params; if(!M) return 'no model';
  const cnt={}; M.members.forEach(m=>cnt[m.type]=(cnt[m.type]||0)+1);
  return JSON.stringify({project:P.project_name,structure:P.structure_type,grid_x:M.gx.map(g=>`${g.label}@${g.pos}`),grid_y:M.gy.map(g=>`${g.label}@${g.pos}`),levels:M.levels.map(l=>`${l.name}+${l.elev}`),
    members:cnt,slabs:M.slabs.length,footings:M.footings.length,materials:P.materials,roof:M.portal?{slope:P.portal.roof_slope_deg,eave:P.portal.eave_height,purlin:P.portal.purlin_spacing}:null,
    groups:D.groups.filter(g=>!g.hidden).map(g=>({key:g.key,title:g.title,section:g.section,status:g.status})).slice(0,60)}); }
// ---- UI injected into the AutoCAD 2D tab ----
(function skMount(){ const tab=$('#tab-acad'); if(!tab) return; const box=document.createElement('div'); box.className='acsk';
  box.innerHTML=`<div class="acsk-hd"><b>🤖 AI เขียนแบบ AutoCAD</b><span class="acsk-ver" id="skVer"></span></div>
  <div class="status">AI อ่าน <b>Skill การเขียนแบบ</b> + ข้อมูลโมเดล → วางแผนชุดแบบ/มาตราส่วน/หมายเหตุ → ส่งงานให้ <b>AutoCAD Agent</b> บนเครื่องคุณ เปิด AutoCAD สร้างแบบใหม่ วาด และบันทึก DWG ให้เอง</div>
  <label class="f" for="skAsk">สั่งเพิ่มเติม (ไม่บังคับ)<textarea id="skAsk" rows="2" placeholder="เช่น ขอเฉพาะแปลนฐานรากกับแปลนชั้น 2, ตัวอักษรใหญ่ขึ้น, ใส่หมายเหตุเรื่องเสาเข็ม"></textarea></label>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="skRun" type="button">🤖 AI เขียนแบบ → เปิด AutoCAD วาด</button><button class="btn" id="skSend" type="button">▶ ส่งงานให้ Agent (ไม่ใช้ AI)</button><button class="btn" id="skAgent" type="button">⬇ ติดตั้ง AutoCAD Agent</button></div>
  <div id="skOut" class="status" aria-live="polite"></div>
  <details class="adv"><summary>📘 Skill การเขียนแบบ AutoCAD — ดู / แก้ / สอน AI</summary><div>
    <label class="f" for="skTeach">สอน AI / ข้อเสนอแนะหลังดูแบบใน AutoCAD<textarea id="skTeach" rows="2" placeholder="เช่น ป้ายคานให้ใส่ทุกช่วง, Dim ต้องอยู่ด้านล่างแปลน, ชื่อแบบใช้ภาษาอังกฤษตัวใหญ่"></textarea></label>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="skLearn" type="button">💾 บันทึกเป็นบทเรียน (AI สรุป + อัปเดต Skill)</button><button class="btn" id="skExport" type="button">ส่งออก Skill (.md)</button><button class="btn" id="skReset" type="button">คืนค่าเริ่มต้น</button></div>
    <label class="f" for="skMd">เนื้อหา Skill (แก้ไขได้ — บันทึกเมื่อออกจากช่อง)<textarea id="skMd" rows="12" style="font-family:var(--f-mono);font-size:12px"></textarea></label>
    <div id="skLessons" class="status"></div></div></details>`;
  const anchor=$('#acInfo'); tab.insertBefore(box,anchor);
  const st=document.createElement('style'); st.textContent='.acsk{border:1px solid #22d3ee66;border-radius:10px;padding:10px;background:linear-gradient(135deg,#ecfeff,#f5f3ff);display:flex;flex-direction:column;gap:8px}@media (prefers-color-scheme:dark){.acsk{background:#0b1d2a}}.acsk-hd{display:flex;gap:8px;align-items:center}.acsk-ver{font-size:11.5px;border:1px solid #7c3aed66;color:#7c3aed;border-radius:999px;padding:0 8px}'; document.head.appendChild(st);
})();
let skUI=function(){ const v=$('#skVer'); if(!v) return; v.textContent=`Skill v${SK.ver} · บทเรียน ${SK.lessons.length} · ใช้แล้ว ${SK.runs} ครั้ง · ${SK.updated}`; $('#skMd').value=SK.md;
  $('#skLessons').innerHTML=SK.lessons.length?'<b>บทเรียนที่เรียนรู้:</b><ol>'+SK.lessons.map((l,i)=>`<li>${esc(l.text)} <span style="opacity:.6">(${esc(l.date)})</span> <button class="btn sm" type="button" data-skdel="${i}" aria-label="ลบบทเรียน">×</button></li>`).join('')+'</ol>':'ยังไม่มีบทเรียน — เขียนข้อเสนอแนะแล้วกดบันทึก';
  document.querySelectorAll('[data-skdel]').forEach(b=>b.onclick=()=>{ SK.lessons.splice(+b.dataset.skdel,1); SK.ver++; skSave(SK); }); };
skUI();
$('#skMd').addEventListener('change',()=>{ SK.md=$('#skMd').value; SK.ver++; skSave(SK); });
$('#skReset').onclick=()=>{ if(!confirm('คืนค่า Skill เริ่มต้น? (บทเรียนจะถูกลบ)')) return; SK={ver:SK.ver+1,md:SK_DEFAULT,lessons:[],runs:SK.runs}; skSave(SK); };
$('#skExport').onclick=()=>saveText(`AI3D_AutoCAD_Skill_v${SK.ver}.md`,skText()+`\n\n---\nversion ${SK.ver} · updated ${SK.updated} · runs ${SK.runs}\n`);
async function saveText(name,data,alt){ const dl=AI.downloadsFn; if(dl){ for(const nm of [name,...(alt?[alt]:[])]){ try{ await dl.save({filename:nm,data}); return nm; }catch(e){ if(e.code==='declined') return null; } } } openModal(name,data); return name; }
let sendJob=async function(){ acadRender(); const o={...acadCfg(),fmt:'lsp'}; const B=state.acad.B; const base=(state.params.project_name||'model').replace(/[^\w฀-๿-]+/g,'_').slice(0,40)||'model';
  const nm=await saveText(`${base}_AI3D2D.lsp`,acadLISP(B,o),`${base}_AI3D2D_lsp.txt`); SK.runs++; skSave(SK);
  $('#skOut').innerHTML=nm?`📤 ส่งงาน <b>${esc(nm)}</b> แล้ว (${B.prims.length} entities, ${B.views.length} แบบ) — ถ้า AutoCAD Agent เปิดอยู่ จะเปิด AutoCAD วาด และบันทึก DWG ใน D:\\Claude_Project\\AI3D_DWG ให้เอง`:'ยกเลิกการส่งงาน'; };
$('#skSend').onclick=()=>sendJob();
$('#skRun').onclick=async()=>{ const sample=AI.sampleFn; if(!state.model){ $('#skOut').textContent='ยังไม่มีโมเดล'; return; }
  if(!sample){ $('#skOut').textContent='AI ใช้ได้เมื่อเปิดโปรแกรมใน Claude — ส่งงานแบบไม่ใช้ AI แทน'; return sendJob(); }
  $('#skOut').textContent='🤖 AI กำลังอ่าน Skill + โมเดล และวางแผนการเขียนแบบ…'; $('#skRun').disabled=true;
  const prompt=`You are the AI structural drafter of "AI Structure 3D Builder". Follow this drafting SKILL exactly, including every learned lesson (lessons override the defaults):\n\n${skText()}\n\nMODEL DATA:\n${modelSummary()}\n\nENGINEER REQUEST: ${$('#skAsk').value.trim()||'(none) — produce the full standard drawing set'}\n\nReturn ONLY JSON: {"views":[subset of "ftg","plans","roof","elx","ely","sched"],"unit":"mm"|"m","scale":50|100|200,"text_factor":number 0.6-2.0,"notes":[Thai general-notes lines for the drawing, max 14, each <=110 chars, numbered],"checklist":[Thai items the engineer must check],"summary":"Thai one-paragraph drafting plan"}`;
  try{ const r=await sample.json(prompt,{cache:false}); const j=r?.json||r?.data||r;
    const views=(Array.isArray(j.views)&&j.views.length?j.views:['ftg','plans','roof','elx','ely','sched']);
    document.querySelectorAll('#acViews input').forEach(c=>c.checked=views.includes(c.value));
    if(['mm','m'].includes(j.unit)) $('#acUnit').value=j.unit; if([50,100,200].includes(+j.scale)) $('#acScale').value=String(+j.scale);
    AC_PLAN={tf:Math.min(2,Math.max(0.6,+j.text_factor||1)),notes:Array.isArray(j.notes)?j.notes.map(String):[]};
    await sendJob();
    $('#skOut').innerHTML=`<b>แผนการเขียนแบบจาก AI:</b> ${esc(j.summary||'')}${j.checklist?.length?'<br><b>ตรวจก่อนใช้:</b><ul>'+j.checklist.slice(0,10).map(c=>`<li>${esc(c)}</li>`).join('')+'</ul>':''}<br>`+$('#skOut').innerHTML; }
  catch(e){ $('#skOut').textContent='AI ทำงานไม่สำเร็จ: '+(e.message||e)+' — ส่งงานแบบไม่ใช้ AI แทน'; await sendJob(); }
  finally{ $('#skRun').disabled=false; } };
$('#skLearn').onclick=async()=>{ const t=$('#skTeach').value.trim(); if(!t){ $('#skTeach').focus(); return; } const sample=AI.sampleFn; let lessons=[t];
  $('#skLearn').disabled=true; $('#skLessons').textContent='🤖 AI กำลังสรุปบทเรียน…';
  try{ if(sample){ const r=await sample.json(`You maintain an AutoCAD structural drafting SKILL. Current skill:\n${skText()}\n\nThe engineer gave this feedback after reviewing drawings in AutoCAD:\n"${t}"\n\nTurn it into 1-3 short, specific, reusable Thai rules (imperative, <=120 chars each) that do not duplicate existing lessons. Return ONLY JSON {"lessons":["..."]}`,{cache:false}); const j=r?.json||r?.data||r; if(Array.isArray(j?.lessons)&&j.lessons.length) lessons=j.lessons.map(String).slice(0,3); } }catch(e){}
  const d=new Date().toISOString().slice(0,10); lessons.forEach(x=>SK.lessons.push({text:x.slice(0,200),date:d,src:t.slice(0,200)})); SK.ver++; skSave(SK); $('#skTeach').value=''; $('#skLearn').disabled=false;
  $('#skOut').textContent=`📘 บันทึกบทเรียน ${lessons.length} ข้อ — Skill อัปเดตเป็น v${SK.ver} และจะใช้ในการเขียนแบบครั้งถัดไป`; };
const AGENT_PS1="# =====================================================================\r\n#  AI Structure 3D Builder - AutoCAD Agent  (v1.1 - live status window)\r\n#  Watches a folder for drawing jobs exported by the web app\r\n#  (*AI3D2D*.lsp  or  *AI3D2D*_lsp.txt), opens AutoCAD, creates a new\r\n#  drawing, runs the job (command AI3D2D) and saves it as DWG.\r\n#  Run with Windows PowerShell 5.1:  AI3D_AutoCAD_Agent.bat\r\n# =====================================================================\r\nparam(\r\n  [string]$Watch    = (Join-Path $env:USERPROFILE 'Downloads'),\r\n  [string]$OutDir   = 'D:\\Claude_Project\\AI3D_DWG',\r\n  [string]$Template = '',\r\n  [int]$Poll        = 2,\r\n  [switch]$Once,\r\n  [switch]$NoGui\r\n)\r\n$ErrorActionPreference = 'Stop'\r\n$Sig  = ';;; AI Structure 3D Builder'\r\n$Done = Join-Path $Watch 'ai3d_done'\r\n$Tmp  = Join-Path $env:TEMP 'ai3d'\r\nforeach($d in @($OutDir,$Done,$Tmp)){ if(-not (Test-Path -LiteralPath $d)){ New-Item -ItemType Directory -Path $d -Force | Out-Null } }\r\n\r\nfunction Log([string]$m,[string]$c='Gray'){ $line=('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'),$m); Write-Host $line -ForegroundColor $c\r\n  if($Ui){ [void]$Ui.Log.Items.Add($line); $Ui.Log.TopIndex=[Math]::Max(0,$Ui.Log.Items.Count-1); [Windows.Forms.Application]::DoEvents() } }\r\n# ---------------- live status window (Agent Mode) ----------------\r\n$Ui = $null\r\nif(-not $NoGui){\r\n  try {\r\n    Add-Type -AssemblyName System.Windows.Forms, System.Drawing\r\n    [System.Windows.Forms.Application]::EnableVisualStyles()\r\n    $f = New-Object System.Windows.Forms.Form\r\n    $f.Text = 'AI3D AutoCAD Agent - Agent Mode'; $f.Width = 760; $f.Height = 520; $f.TopMost = $true\r\n    $f.BackColor = [Drawing.Color]::FromArgb(2,6,23); $f.ForeColor = [Drawing.Color]::FromArgb(207,250,254)\r\n    $f.Font = New-Object Drawing.Font('Segoe UI',10)\r\n    $hd = New-Object Windows.Forms.Label; $hd.Text = 'AI AGENT MODE  -  waiting for jobs'; $hd.Dock = 'Top'; $hd.Height = 34\r\n    $hd.Font = New-Object Drawing.Font('Segoe UI',13,[Drawing.FontStyle]::Bold); $hd.ForeColor = [Drawing.Color]::FromArgb(103,232,249)\r\n    $job = New-Object Windows.Forms.Label; $job.Text = ('Watching: ' + $Watch + '   |   DWG: ' + $OutDir); $job.Dock = 'Top'; $job.Height = 24\r\n    $steps = New-Object Windows.Forms.Label; $steps.Dock = 'Top'; $steps.Height = 46; $steps.Font = New-Object Drawing.Font('Consolas',10)\r\n    $pb = New-Object Windows.Forms.ProgressBar; $pb.Dock = 'Top'; $pb.Height = 16; $pb.Minimum = 0; $pb.Maximum = 100\r\n    $lb = New-Object Windows.Forms.ListBox; $lb.Dock = 'Fill'; $lb.BackColor = [Drawing.Color]::Black; $lb.ForeColor = [Drawing.Color]::FromArgb(134,239,172)\r\n    $lb.Font = New-Object Drawing.Font('Consolas',9); $lb.BorderStyle = 'None'\r\n    $f.Controls.Add($lb); $f.Controls.Add($pb); $f.Controls.Add($steps); $f.Controls.Add($job); $f.Controls.Add($hd)\r\n    $f.Show(); [Windows.Forms.Application]::DoEvents()\r\n    $Ui = @{ Form=$f; Head=$hd; Job=$job; Steps=$steps; Bar=$pb; Log=$lb }\r\n  } catch { $Ui = $null }\r\n}\r\n$StepNames = @('Connect AutoCAD','New drawing','Load job','Draw (AI3D2D)','Save DWG')\r\nfunction Pump{ if($Ui){ [Windows.Forms.Application]::DoEvents() } }\r\nfunction Pause-Ui([int]$ms){ $end=(Get-Date).AddMilliseconds($ms); while((Get-Date) -lt $end){ Pump; Start-Sleep -Milliseconds 100 } }\r\nfunction Set-Step([int]$i,[string]$head){\r\n  if(-not $Ui){ return }\r\n  $txt = ''\r\n  for($k=0; $k -lt $StepNames.Count; $k++){ $mark = if($k -lt $i){'[OK]'} elseif($k -eq $i){'[>>]'} else {'[  ]'}; $txt += ($mark + ' ' + $StepNames[$k] + '   ') }\r\n  $Ui.Steps.Text = $txt\r\n  if($i -ge $StepNames.Count){ $Ui.Bar.Style='Continuous'; $Ui.Bar.Value=100 }\r\n  elseif($i -eq 3){ $Ui.Bar.Style='Marquee' } else { $Ui.Bar.Style='Continuous'; $Ui.Bar.Value=[int](100*$i/$StepNames.Count) }\r\n  if($head){ $Ui.Head.Text = $head }\r\n  Pump\r\n}\r\n\r\n\r\n# AutoCAD rejects COM calls while it is busy -> retry\r\nfunction Invoke-Retry([scriptblock]$Block,[int]$Tries=120){\r\n  for($i=0; $i -lt $Tries; $i++){\r\n    try { return (& $Block) }\r\n    catch {\r\n      $msg = $_.Exception.Message\r\n      if($msg -match 'rejected|busy|0x8001010A|0x80010001|RPC_E_'){ Pause-Ui 500 } else { throw }\r\n    }\r\n  }\r\n  throw 'AutoCAD stayed busy for too long'\r\n}\r\nfunction Wait-Idle($Acad,[int]$Seconds=600){\r\n  $sw = [Diagnostics.Stopwatch]::StartNew()\r\n  while($sw.Elapsed.TotalSeconds -lt $Seconds){\r\n    try { if($Acad.GetAcadState().IsQuiescent){ return } } catch {}\r\n    Pause-Ui 500\r\n  }\r\n  throw 'Timeout waiting for AutoCAD to become idle'\r\n}\r\nfunction Get-AutoCAD{\r\n  $a = $null\r\n  try { $a = [Runtime.InteropServices.Marshal]::GetActiveObject('AutoCAD.Application'); Log 'Connected to running AutoCAD' 'Cyan' }\r\n  catch { Log 'Starting AutoCAD ... (first start can take a minute)' 'Yellow'; $a = New-Object -ComObject 'AutoCAD.Application' }\r\n  Invoke-Retry { $a.Visible = $true } | Out-Null\r\n  Wait-Idle $a 300\r\n  return $a\r\n}\r\nfunction Invoke-Job($File){\r\n  $first = Get-Content -LiteralPath $File.FullName -TotalCount 1\r\n  if(-not $first -or -not $first.StartsWith($Sig)){\r\n    Log ('Skip (not an AI3D job): ' + $File.Name) 'DarkYellow'\r\n    Move-Item -LiteralPath $File.FullName -Destination (Join-Path $Done ('skipped_' + $File.Name)) -Force\r\n    return\r\n  }\r\n  $name = [IO.Path]::GetFileNameWithoutExtension($File.Name) -replace '_lsp$',''\r\n  $lsp  = Join-Path $Tmp 'ai3d_job.lsp'\r\n  Copy-Item -LiteralPath $File.FullName -Destination $lsp -Force\r\n\r\n  Set-Step 0 ('AI AGENT MODE  -  ' + $name)\r\n  if($Ui){ $Ui.Job.Text = ('Job: ' + $File.Name) }\r\n  $acad = Get-AutoCAD\r\n  Set-Step 1\r\n  $doc  = Invoke-Retry { if($Template){ $acad.Documents.Add($Template) } else { $acad.Documents.Add() } }\r\n  Invoke-Retry { $doc.Activate() } | Out-Null\r\n  Wait-Idle $acad\r\n  # trust the temp folder so SECURELOAD does not block the job file\r\n  try {\r\n    $tp = [string](Invoke-Retry { $doc.GetVariable('TRUSTEDPATHS') })\r\n    if($tp -notlike ('*' + $Tmp + '*')){ Invoke-Retry { $doc.SetVariable('TRUSTEDPATHS', (($tp.TrimEnd(';') + ';' + $Tmp).TrimStart(';'))) } | Out-Null }\r\n  } catch { Log 'Note: could not set TRUSTEDPATHS (AutoCAD may ask to allow loading - click Load)' 'DarkYellow' }\r\n\r\n  Set-Step 2\r\n  $p = $lsp -replace '\\\\','/'\r\n  Log ('Drawing  ' + $name + ' ...') 'Green'\r\n  $n = @(Select-String -LiteralPath $lsp -Pattern '^\\s+\\(ai:' ).Count\r\n  Log ('Entities to draw: ' + $n)\r\n  Set-Step 3\r\n  Invoke-Retry { $doc.SendCommand('(load \"' + $p + '\") AI3D2D ') } | Out-Null\r\n  Pause-Ui 1000\r\n  Wait-Idle $acad 1800\r\n  try { Log ('Model space objects: ' + (Invoke-Retry { $doc.ModelSpace.Count })) 'Cyan' } catch {}\r\n  Set-Step 4\r\n\r\n  $dwg = Join-Path $OutDir ($name + '.dwg')\r\n  Invoke-Retry { $doc.SaveAs($dwg) } | Out-Null\r\n  Log ('Saved    ' + $dwg) 'Cyan'\r\n  Set-Step 5 'AI AGENT MODE  -  done, waiting for next job'\r\n  Move-Item -LiteralPath $File.FullName -Destination (Join-Path $Done $File.Name) -Force\r\n}\r\n\r\nWrite-Host ''\r\nWrite-Host '  AI Structure 3D Builder - AutoCAD Agent' -ForegroundColor Cyan\r\nLog ('Watching : ' + $Watch)\r\nLog ('DWG out  : ' + $OutDir)\r\nLog 'In the web app: tab \"AutoCAD 2D\" -> \"AI Agent: open AutoCAD and draw\".  Ctrl+C to stop.'\r\nwhile($true){\r\n  $jobs = @(Get-ChildItem -LiteralPath $Watch -File -ErrorAction SilentlyContinue |\r\n            Where-Object { $_.Name -match 'AI3D2D' -and $_.Name -match '(\\.lsp|_lsp\\.txt)$' } |\r\n            Sort-Object LastWriteTime)\r\n  foreach($f in $jobs){\r\n    $s1 = $f.Length; Start-Sleep -Milliseconds 500; $f.Refresh()\r\n    if($f.Length -ne $s1 -or $f.Length -eq 0){ continue }\r\n    Pump   # still downloading\r\n    try { Invoke-Job $f }\r\n    catch {\r\n      Log ('ERROR ' + $f.Name + ': ' + $_.Exception.Message) 'Red'\r\n      Move-Item -LiteralPath $f.FullName -Destination (Join-Path $Done ('failed_' + $f.Name)) -Force -ErrorAction SilentlyContinue\r\n    }\r\n  }\r\n  if($Once){ break }\r\n  if($Ui -and -not $Ui.Form.Visible){ break }\r\n  Pause-Ui ($Poll*1000)\r\n}\r\n", AGENT_BAT="@echo off\ntitle AI3D AutoCAD Agent\nrem Edit OutDir below if you want DWG files somewhere else\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%~dp0AI3D_AutoCAD_Agent.ps1\" -OutDir \"D:\\Claude_Project\\AI3D_DWG\"\npause\n";
$('#skAgent').onclick=async()=>{ const a=await saveText('AI3D_AutoCAD_Agent.ps1',AGENT_PS1,'AI3D_AutoCAD_Agent_ps1.txt'); const b=await saveText('AI3D_AutoCAD_Agent.bat',AGENT_BAT,'AI3D_AutoCAD_Agent_bat.txt');
  $('#skOut').innerHTML=`⬇ ดาวน์โหลด Agent แล้ว (${esc(a||'-')}, ${esc(b||'-')}) — วางทั้ง 2 ไฟล์ในโฟลเดอร์เดียวกัน (เปลี่ยนนามสกุลกลับเป็น .ps1 / .bat ถ้าได้ .txt) แล้วดับเบิลคลิก <b>AI3D_AutoCAD_Agent.bat</b> ค้างไว้ระหว่างใช้งาน`; };

// ---- problem log → AI improves the skill (versioned, with rollback) ----
function qaDrawing(B,o){ const M=state.model, D=state.design, out=[]; const add=(k,t)=>out.push({k,t});
  const ng=D.groups.filter(g=>!g.hidden&&g.status==='NG'); if(ng.length) add('ng',`กลุ่มที่ NG ${ng.length} กลุ่ม: ${ng.slice(0,5).map(g=>g.key).join(', ')} — แบบยังใช้ก่อสร้างไม่ได้`);
  const nosec=M.members.filter(m=>!D.secs[m.sec]).length; if(nosec) add('nosec',`ชิ้นส่วนไม่มีหน้าตัด ${nosec} ชิ้น — ไม่ถูกวาด/ไม่มีป้าย`);
  if(!M.footings.length&&o.views.includes('ftg')) add('noftg','โมเดลไม่มีฐานราก — แปลนฐานรากว่าง');
  if(!B.prims.some(p=>p.t==='D')) add('nodim','ไม่มีเส้นบอกระยะในชุดแบบ');
  if(!o.notes?.length) add('nonote','ไม่มีหมายเหตุทั่วไป (fc\', เหล็กเสริม, ระยะหุ้ม) ในแบบ');
  const lv=M.levels.length-1, pl=B.views.filter(v=>v.startsWith('แปลน ')).length; if(o.views.includes('plans')&&pl<lv) add('plan',`แปลนชั้นได้ ${pl}/${lv} ชั้น — บางชั้นไม่มีคาน/พื้นในโมเดล`);
  const span=Math.max(M.gx[M.gx.length-1].pos-M.gx[0].pos,M.gy[M.gy.length-1].pos-M.gy[0].pos); if(span>60&&o.scale<200) add('scale',`อาคารยาว ${span.toFixed(0)} m แต่ใช้มาตราส่วน 1:${o.scale} — ตัวอักษรอาจเล็ก/แน่น`);
  const lab=B.prims.filter(p=>p.t==='T'&&p.ly==='S-TEXT').length; if(lab<5) add('label','ป้ายชิ้นส่วนน้อยผิดปกติ');
  const d=new Date().toISOString().slice(0,10); SK.issues=SK.issues||[];
  out.forEach(x=>{ const e=SK.issues.find(i=>i.k===x.k); if(e){ e.n++; e.t=x.t; e.date=d; } else SK.issues.push({...x,n:1,date:d}); }); skSave(SK); return out; }
function skIssuesHTML(){ const I=SK.issues||[]; return I.length?'<b>ปัญหาที่พบสะสม:</b><ul>'+I.map(i=>`<li>${esc(i.t)} <span style="opacity:.6">×${i.n} · ${esc(i.date)}</span></li>`).join('')+'</ul>':'<span style="opacity:.7">ยังไม่พบปัญหา</span>'; }
(function(){ const det=document.querySelector('.acsk details > div'); if(!det) return; const w=document.createElement('div'); w.innerHTML=`<div id="skIssues" class="status"></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="skImprove" type="button">🧠 AI พัฒนา Skill จากปัญหา + บทเรียน</button><button class="btn" id="skUndo" type="button">↶ ย้อน Skill เวอร์ชันก่อน</button><button class="btn" id="skImport" type="button">นำเข้า Skill (.md)</button><button class="btn sm" id="skClrIss" type="button">ล้างรายการปัญหา</button><input type="file" id="skFile" accept=".md,.txt" hidden></div><div id="skChg" class="status"></div>`;
  det.insertBefore(w,det.firstChild); })();
const _skUI=skUI; skUI=function(){ _skUI(); const e=$('#skIssues'); if(e) e.innerHTML=skIssuesHTML(); const u=$('#skUndo'); if(u) u.disabled=!(SK.hist&&SK.hist.length); };
skUI();
const _send=sendJob; sendJob=async function(){ await _send(); const o={...acadCfg()}; const iss=qaDrawing(state.acad.B,o); if(iss.length) $('#skOut').innerHTML+=`<br><b>⚠ ปัญหาที่ตรวจพบ (บันทึกเข้า Skill แล้ว):</b><ul>${iss.map(i=>`<li>${esc(i.t)}</li>`).join('')}</ul>`; };
$('#skSend').onclick=()=>sendJob();
$('#skClrIss').onclick=()=>{ SK.issues=[]; skSave(SK); };
$('#skUndo').onclick=()=>{ const h=SK.hist?.pop(); if(!h) return; Object.assign(SK,{md:h.md,lessons:h.lessons}); SK.ver++; skSave(SK); $('#skChg').textContent=`↶ ย้อนกลับเป็นเนื้อหาของ v${h.ver} แล้ว (บันทึกเป็น v${SK.ver})`; };
$('#skImport').onclick=()=>$('#skFile').click();
$('#skFile').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; const t=await f.text(); (SK.hist=SK.hist||[]).push({ver:SK.ver,md:SK.md,lessons:SK.lessons}); if(SK.hist.length>10) SK.hist.shift(); SK.md=t.split('\n---\nversion')[0]; SK.lessons=[]; SK.ver++; skSave(SK); $('#skChg').textContent=`นำเข้า ${f.name} เป็น Skill v${SK.ver}`; e.target.value=''; };
$('#skImprove').onclick=async()=>{ const sample=AI.sampleFn; if(!sample){ $('#skChg').textContent='การพัฒนา Skill ด้วย AI ใช้ได้เมื่อเปิดโปรแกรมใน Claude'; return; }
  $('#skImprove').disabled=true; $('#skChg').textContent='🧠 AI กำลังวิเคราะห์ปัญหาและบทเรียน เพื่อปรับปรุง Skill…';
  try{ const r=await sample.json(`You maintain the embedded AutoCAD structural-drafting SKILL of "AI Structure 3D Builder" (Thai engineering practice, ACI/AISC, วสท./มยผ.).\n\nCURRENT SKILL (markdown, version ${SK.ver}):\n${SK.md}\n\nLEARNED LESSONS:\n${SK.lessons.map((l,i)=>`${i+1}. ${l.text}`).join('\n')||'(none)'}\n\nPROBLEMS FOUND IN PAST RUNS (with counts):\n${(SK.issues||[]).map(i=>`- ${i.t} (x${i.n})`).join('\n')||'(none)'}\n\nImprove the skill: fold durable lessons into the right numbered steps, add concrete prevention/check rules for recurring problems, keep everything the engineer wrote that is still valid, keep it concise (<= 60 lines), in Thai, same markdown structure, ending with the heading "## บทเรียนที่เรียนรู้ (อัปเดตอัตโนมัติจากการสอนของวิศวกร)" as the last line. Return ONLY JSON {"md":"...","keep_lessons":["lessons not yet folded in"],"changes":["Thai summary of each change"]}`,{cache:false});
    const j=r?.json||r?.data||r; if(!j||typeof j.md!=='string'||j.md.length<200) throw new Error('AI ไม่ได้ส่ง Skill ที่สมบูรณ์กลับมา');
    (SK.hist=SK.hist||[]).push({ver:SK.ver,md:SK.md,lessons:SK.lessons}); if(SK.hist.length>10) SK.hist.shift();
    const d=new Date().toISOString().slice(0,10); SK.md=j.md.trim()+'\n'; SK.lessons=(Array.isArray(j.keep_lessons)?j.keep_lessons:[]).map(t=>({text:String(t).slice(0,200),date:d}));
    (SK.issues||[]).forEach(i=>i.n=0); SK.issues=(SK.issues||[]).filter(i=>i.n>0); SK.ver++; skSave(SK);
    $('#skChg').innerHTML=`✅ พัฒนา Skill เป็น <b>v${SK.ver}</b> แล้ว — ใช้ทันทีในการเขียนแบบครั้งถัดไป<ul>${(j.changes||[]).slice(0,10).map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`; }
  catch(e){ $('#skChg').textContent='พัฒนา Skill ไม่สำเร็จ: '+(e.message||e); }
  finally{ $('#skImprove').disabled=false; } };

// ---- Agent Mode: live "hyperspace" HUD of what the AI drafting agent is doing (status, problems, % in real time) ----
const AM=(()=>{ let el=null, orb=null, t0=0, raf=0, warpRaf=0, speed=1, mini=false; const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEF_STEPS=['อ่าน Skill การเขียนแบบ','วิเคราะห์ข้อมูลโมเดล','AI วางแผนชุดแบบ / มาตราส่วน / หมายเหตุ','สร้างเส้น ตัวอักษร Dim (entities)','ตรวจปัญหา (QA) + บันทึกเข้า Skill','ส่งงานให้ AutoCAD Agent','Agent เปิด AutoCAD → วาด → บันทึก DWG'];
  let STEPS=DEF_STEPS, W=[5,5,35,20,10,10,15], TITLE='AI AGENT MODE · HYPERDRIVE DRAFTING'; let st=STEPS.map(()=>({s:'wait',p:0,d:'',t:0})); const met=new Map(); let issues=[];
  const css=`.am{position:fixed;inset:0;z-index:99;display:none;font-family:var(--f-body);color:#e0fbff;background:#000}.am.on{display:block}
.am canvas.warp{position:absolute;inset:0;width:100%;height:100%}
.am .scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,#22d3ee0a 0 1px,transparent 1px 3px);mix-blend-mode:screen}
.am .flash{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 40%,#ffffffcc,#a78bfa55 30%,transparent 60%)}.am .flash.go{animation:amFlash .6s ease-out}
@keyframes amFlash{0%{opacity:1}100%{opacity:0}}
.am-p{position:relative;margin:2vh auto;width:min(1320px,97vw);height:96vh;display:grid;grid-template-columns:320px 1fr 320px;grid-template-rows:auto 1fr 150px;gap:10px;padding:12px;border-radius:18px;background:#020617b0;backdrop-filter:blur(2px);border:1px solid transparent;
  background-clip:padding-box;box-shadow:0 0 0 1px #22d3ee66,0 0 40px #22d3ee55,0 0 90px #7c3aed44,inset 0 0 60px #22d3ee14;animation:amHue 8s linear infinite}
@keyframes amHue{to{filter:hue-rotate(360deg)}}
.am-hd{grid-column:1/-1;display:flex;align-items:center;gap:14px}.am-ttl{font-size:18px;font-weight:800;letter-spacing:1.5px;background:linear-gradient(90deg,#67e8f9,#c4b5fd,#f0abfc,#fde047,#67e8f9);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:amShine 3s linear infinite}
@keyframes amShine{to{background-position:300% 0}}.am-sub{font:11.5px var(--f-mono,monospace);color:#7dd3fc}.am-sp{flex:1}
.am-ring{--p:0;width:86px;height:86px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#22d3ee calc(var(--p)*1%),#f0abfc calc(var(--p)*1%),#1e1b4b 0);box-shadow:0 0 26px #22d3ee,0 0 60px #7c3aed88;animation:amPulse 1.4s ease-in-out infinite}
.am-ring b{width:70px;height:70px;border-radius:50%;background:#020617;display:grid;place-items:center;font:800 21px var(--f-mono,monospace);color:#fff;text-shadow:0 0 10px #22d3ee,0 0 20px #a78bfa}
@keyframes amPulse{50%{box-shadow:0 0 40px #67e8f9,0 0 90px #f0abfcaa}}
.am-col{display:flex;flex-direction:column;gap:6px;overflow:auto;min-height:0}.am-h{font:700 12px var(--f-mono,monospace);letter-spacing:2px;color:#a5f3fc;text-shadow:0 0 8px #22d3ee}
.am-s{border:1px solid #22d3ee33;border-radius:10px;padding:6px 9px;font-size:12.5px;background:#06213a99;transition:all .3s}.am-s.run{border-color:#f0abfc;box-shadow:0 0 18px #c026d388,inset 0 0 12px #7c3aed55;animation:amBlink 1s steps(2) infinite}
@keyframes amBlink{50%{border-color:#67e8f9;box-shadow:0 0 22px #22d3ee99}}.am-s.ok{border-color:#34d39999;box-shadow:0 0 10px #10b98144}.am-s.err{border-color:#f87171;box-shadow:0 0 14px #ef444477}.am-s.skip{opacity:.55}
.am-s .t{display:flex;gap:6px;align-items:center}.am-s .i{width:18px;text-align:center}.am-s .d{opacity:.8;font-size:11.5px;margin-top:2px;white-space:pre-wrap}.am-s .tm{font:10.5px var(--f-mono,monospace);opacity:.6}
.am-bar{height:4px;border-radius:2px;background:#0e2a3f;margin-top:4px;overflow:hidden}.am-bar i{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#a78bfa,#f0abfc);box-shadow:0 0 8px #22d3ee;transition:width .3s}
.am-cv{grid-row:2/4;grid-column:2;border-radius:14px;background:#000a;overflow:hidden;position:relative;box-shadow:inset 0 0 40px #22d3ee22,0 0 0 1px #22d3ee44}.am-cv svg{width:100%;height:100%}.am-cv svg *{vector-effect:non-scaling-stroke}
.am-cv .lbl{position:absolute;left:10px;top:8px;font:12px var(--f-mono,monospace);color:#67e8f9;text-shadow:0 0 6px #22d3ee;z-index:2}.am-cv .sweep{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent,#22d3ee22 48%,#ffffff44 50%,#22d3ee22 52%,transparent);background-size:300% 100%;animation:amSweep 2.4s linear infinite}
@keyframes amSweep{from{background-position:150% 0}to{background-position:-150% 0}}
.am-m{display:grid;grid-template-columns:1fr auto;gap:2px 8px;font-size:12.5px;background:#06213a99;border:1px solid #22d3ee33;border-radius:10px;padding:8px 10px}.am-m span:nth-child(even){font-family:var(--f-mono,monospace);color:#fde047;text-shadow:0 0 6px #facc15;text-align:right}
.am-iss{display:flex;flex-direction:column;gap:5px}.am-i{border-left:3px solid;border-radius:6px;padding:5px 8px;font-size:12px;background:#1f0a1a99}.am-i.hi{border-color:#f43f5e;box-shadow:0 0 12px #f43f5e66}.am-i.md{border-color:#f59e0b}.am-i.lo{border-color:#22d3ee}.am-i.new{animation:amNew 1.2s steps(2) 3}
@keyframes amNew{50%{background:#f43f5e44}}
.am-log{grid-column:1;grid-row:3;overflow:auto;white-space:pre-wrap;word-break:break-all;font:11px/1.45 var(--f-mono,monospace);color:#86efac;text-shadow:0 0 4px #22c55e;background:#000c;border:1px solid #22d3ee33;border-radius:10px;padding:6px 8px}
.am-orb{position:fixed;right:18px;bottom:18px;z-index:98;width:74px;height:74px;border-radius:50%;border:0;cursor:pointer;display:none;place-items:center;font:800 16px var(--f-mono,monospace);color:#fff;background:conic-gradient(from 0deg,#22d3ee,#7c3aed,#f0abfc,#22d3ee);box-shadow:0 0 30px #22d3ee,0 0 60px #7c3aed;animation:amSpin 3s linear infinite}
.am-orb.on{display:grid}.am-orb span{animation:amSpin 3s linear infinite reverse;text-shadow:0 0 8px #000}@keyframes amSpin{to{transform:rotate(360deg)}}
@media (max-width:1000px){.am-p{grid-template-columns:1fr;grid-template-rows:auto auto 300px auto auto;overflow:auto}.am-cv{grid-row:3;grid-column:1}.am-log{grid-row:auto;grid-column:1;height:140px}}
@media (prefers-reduced-motion:reduce){.am *,.am-p,.am-orb,.am-orb span{animation:none!important}}`;
  function warp(){ const c=el.querySelector('canvas.warp'), g=c.getContext('2d'); const S=Array.from({length:420},()=>({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random()}));
    const fr=()=>{ const w=c.width=c.clientWidth, h=c.height=c.clientHeight; g.fillStyle='rgba(0,0,8,0.35)'; g.fillRect(0,0,w,h); const cx=w/2, cy=h*0.45;
      for(const s of S){ const pz=s.z; s.z-=0.004*speed; if(s.z<=0.02){ s.x=Math.random()*2-1; s.y=Math.random()*2-1; s.z=1; continue; }
        const x=cx+s.x/s.z*w*0.5, y=cy+s.y/s.z*h*0.5, px=cx+s.x/pz*w*0.5, py=cy+s.y/pz*h*0.5; const hue=(200+s.x*80+performance.now()/40)%360;
        g.strokeStyle=`hsla(${hue},100%,${70+30*(1-s.z)}%,${1-s.z})`; g.lineWidth=(1-s.z)*2.4; g.beginPath(); g.moveTo(px,py); g.lineTo(x,y); g.stroke(); }
      if(el.classList.contains('on')&&!RM()) warpRaf=requestAnimationFrame(fr); }; cancelAnimationFrame(warpRaf); fr(); }
  function mount(){ if(el) return; const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
    el=document.createElement('div'); el.className='am'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label','โหมดการทำงานของ AI Agent');
    el.innerHTML=`<canvas class="warp" aria-hidden="true"></canvas><div class="scan"></div><div class="flash" id="amFl"></div>
    <div class="am-p"><div class="am-hd"><div class="am-ring" id="amRing"><b id="amTot">0%</b></div><div><div class="am-ttl">AI AGENT MODE · HYPERDRIVE DRAFTING</div><div class="am-sub" id="amSub">initialising neural drafting core…</div></div><span class="am-sp"></span><span class="am-sub" id="amTime"></span><button class="hbtn" id="amMin" type="button">▾ ย่อ</button><button class="hbtn" id="amX" type="button">ปิด</button></div>
    <div class="am-col"><div class="am-h">◢ MISSION STEPS</div><div id="amSt" class="am-col"></div></div>
    <div class="am-cv"><div class="sweep" id="amSw"></div><div class="lbl" id="amLbl">CAD CANVAS</div><div id="amSvg" style="width:100%;height:100%"></div></div>
    <div class="am-col" style="grid-row:2/4"><div class="am-h">◢ รายงานสถานะ · LIVE</div><div class="am-m" id="amMet"></div><div class="am-h">◢ รายงานปัญหา</div><div class="am-iss" id="amIss"></div></div>
    <div class="am-log" id="amLog" aria-live="off"></div></div>`;
    document.body.appendChild(el); orb=document.createElement('button'); orb.className='am-orb'; orb.type='button'; orb.setAttribute('aria-label','เปิดหน้าจอ AI Agent'); orb.innerHTML='<span>0%</span>'; document.body.appendChild(orb);
    orb.onclick=()=>{ mini=false; orb.classList.remove('on'); el.classList.add('on'); warp(); };
    el.querySelector('#amMin').onclick=()=>{ mini=true; el.classList.remove('on'); orb.classList.add('on'); };
    el.querySelector('#amX').onclick=()=>{ el.classList.remove('on'); orb.classList.remove('on'); cancelAnimationFrame(raf); cancelAnimationFrame(warpRaf); };
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&el.classList.contains('on')) el.querySelector('#amMin').click(); }); setInterval(()=>{ if(el.classList.contains('on')||orb.classList.contains('on')) render(); },250); }
  function tot(){ return Math.round(st.reduce((a,x,i)=>a+W[i]*(x.s==='ok'||x.s==='skip'?1:x.p/100),0)/W.reduce((a,b)=>a+b,0)*100); }
  function render(){ const T=tot(); el.querySelector('#amTot').textContent=T+'%'; el.querySelector('#amRing').style.setProperty('--p',T); orb.querySelector('span').textContent=T+'%';
    el.querySelector('#amTime').textContent='T+'+((performance.now()-t0)/1000).toFixed(1)+' s';
    const run=st.findIndex(x=>x.s==='run'); el.querySelector('#amSub').textContent=run>=0?`▶ ${STEPS[run]} …`:(T>=100?'✔ ภารกิจเสร็จสมบูรณ์':'standing by');
    el.querySelector('#amSt').innerHTML=STEPS.map((n,i)=>{ const x=st[i]; const ic={wait:'○',run:'◉',ok:'✔',err:'⚠',skip:'–'}[x.s]; return `<div class="am-s ${x.s}"><div class="t"><span class="i">${ic}</span><span>${i+1}. ${esc(n)}</span><span class="am-sp"></span><span>${x.s==='ok'?100:Math.round(x.p)}%</span></div>${x.d?`<div class="d">${esc(x.d)}</div>`:''}${x.t?`<div class="tm">${x.t.toFixed(1)} s</div>`:''}<div class="am-bar"><i style="width:${x.s==='ok'||x.s==='skip'?100:x.p}%"></i></div></div>`; }).join('');
    el.querySelector('#amMet').innerHTML=[['ความคืบหน้ารวม',T+' %'],['เวลาทำงาน',((performance.now()-t0)/1000).toFixed(1)+' s'],...met].map(([k,v])=>`<span>${esc(k)}</span><span>${esc(String(v))}</span>`).join('');
    el.querySelector('#amIss').innerHTML=issues.length?issues.map((x,i)=>`<div class="am-i ${x.sev}${x.n?' new':''}">${x.sev==='hi'?'⛔':x.sev==='md'?'⚠':'ℹ'} ${esc(x.t)}</div>`).join(''):'<div class="am-i lo">✔ ยังไม่พบปัญหา</div>'; issues.forEach(x=>x.n=false); }
  function flash(){ if(RM()) return; const f=el.querySelector('#amFl'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); speed=6; setTimeout(()=>speed=1.4,500); }
  const api={ on:()=>{ try{ return localStorage.getItem('ai3d_agent_mode')!=='0'; }catch(e){ return true; } },
    open(cfg){ if(!api.on()) return; mount(); STEPS=cfg?.steps||DEF_STEPS; W=cfg?.w||(cfg?STEPS.map(()=>1):[5,5,35,20,10,10,15]); TITLE=cfg?.title||'AI AGENT MODE · HYPERDRIVE DRAFTING'; el.querySelector('.am-ttl').textContent=TITLE; el.querySelector('#amLbl').textContent=cfg?.canvas||'CAD CANVAS'; st=STEPS.map(()=>({s:'wait',p:0,d:'',t:0,_t:0})); met.clear(); issues=[]; t0=performance.now(); speed=1.4; el.querySelector('#amLog').textContent=''; el.querySelector('#amSvg').innerHTML=''; mini=false; orb.classList.remove('on'); el.classList.add('on'); warp(); render(); },
    step(i,s,d,p){ if(!el||!st[i]) return; const x=st[i]; if(s==='run'&&x.s!=='run') x._t=performance.now(); if((s==='ok'||s==='err'||s==='skip')&&x._t) x.t=(performance.now()-x._t)/1000;
      const done=(s==='ok'&&x.s!=='ok'); Object.assign(x,{s,p:p??(s==='ok'?100:x.p),d:d??x.d}); if(done) flash(); if(s==='run') speed=Math.max(speed,2.2); render(); },
    metric(k,v){ if(!el) return; met.set(k,v); },
    canvas(html){ if(!el) return; el.querySelector('#amSw').style.display='none'; el.querySelector('#amSvg').innerHTML=html; },
    lbl(t){ if(el) el.querySelector('#amLbl').textContent=t; },
    issue(t,sev='md'){ if(!el) return; issues.push({t,sev,n:true}); flash(); render(); },
    log(t){ if(!el) return; const L=el.querySelector('#amLog'); L.textContent+=`[T+${((performance.now()-t0)/1000).toFixed(1)}] ${t}\n`; L.scrollTop=L.scrollHeight; },
    draw(B,code){ return new Promise(res=>{ if(!el||(!el.classList.contains('on')&&!mini)) return res(); const box=el.querySelector('#amSvg'); box.innerHTML=acadSVG(B).replace('background:#fff','background:transparent'); const svg=box.querySelector('svg'); if(!svg) return res();
      svg.style.filter='invert(1) hue-rotate(180deg) drop-shadow(0 0 2px #22d3ee) drop-shadow(0 0 6px #a78bfa)'; const kids=[...svg.children]; kids.forEach(k=>k.style.opacity=0);
      const lines=code.split(/\r?\n/).filter(l=>l.startsWith('  (ai:')); const N=kids.length, dur=RM()?0:Math.min(6000,1500+N*4); const t1=performance.now(); let shown=0, li=0;
      const tick=()=>{ const f=dur?Math.min(1,(performance.now()-t1)/dur):1; const k=Math.floor(f*N); for(;shown<k;shown++) kids[shown].style.opacity=1; const lk=Math.floor(f*lines.length);
        if(lk>li){ lines.slice(li,lk).slice(-2).forEach(l=>api.log(l.trim().slice(0,110))); li=lk; }
        el.querySelector('#amLbl').textContent=`CAD CANVAS · ${shown}/${N} objects · ${Math.round(f*100)}%`; api.metric('Entities ที่วาดแล้ว',`${shown}/${N}`); api.step(api._ds??3,'run',`${shown}/${N} objects`,f*100);
        if(f<1) raf=requestAnimationFrame(tick); else { el.querySelector('#amSw').style.display='none'; res(); } }; el.querySelector('#amSw').style.display=''; tick(); }); } };
  return api; })();
// toggle in the AI panel
(function(){ const row=document.querySelector('.acsk #skOut'); if(!row) return; const l=document.createElement('label'); l.className='f'; l.style.cssText='flex-direction:row;align-items:center;gap:6px'; l.innerHTML='<input type="checkbox" id="amOn"> 🛰 แสดงโหมดการทำงานของ AI Agent (HUD ขั้นตอน + ภาพวาดสด + log)'; row.parentNode.insertBefore(l,row); const c=l.querySelector('input'); c.checked=AM.on(); c.onchange=()=>{ try{ localStorage.setItem('ai3d_agent_mode',c.checked?'1':'0'); }catch(e){} }; })();
// instrumented flows
async function agentFlow(useAI,U){ U=U||AM; const direct=(U===AM); if(!state.model){ $('#skOut').textContent='ยังไม่มีโมเดล'; return; } if(direct) AM.open(); const sample=AI.sampleFn;
  U.step(0,'run'); U.log(`load skill v${SK.ver} (${SK.lessons.length} lessons, ${(SK.issues||[]).length} known issues)`); U.step(0,'ok',`Skill v${SK.ver} · บทเรียน ${SK.lessons.length}`); U.metric('Skill',`v${SK.ver} · บทเรียน ${SK.lessons.length}`); (SK.issues||[]).filter(i=>i.n>1).forEach(i=>U.issue(`ปัญหาซ้ำ ×${i.n}: ${i.t}`,'lo'));
  U.step(1,'run'); const ms=JSON.parse(modelSummary()); U.log(`model: grid ${ms.grid_x.length}x${ms.grid_y.length}, levels ${ms.levels.length}, groups ${ms.groups.length}`); U.step(1,'ok',`Grid ${ms.grid_x.length}×${ms.grid_y.length} · ${ms.levels.length} ระดับ · ${ms.footings} ฐานราก`); U.metric('โมเดล',`Grid ${ms.grid_x.length}×${ms.grid_y.length} · ${ms.levels.length} ระดับ`); U.metric('กลุ่มหน้าตัด',ms.groups.length); const ngc=ms.groups.filter(g=>g.status==='NG').length; if(ngc) U.issue(`กลุ่มออกแบบ NG ${ngc} กลุ่ม — ควรแก้ก่อนออกแบบก่อสร้าง`,'hi');
  if(useAI&&sample){ U.step(2,'run','AI กำลังคิด…',10); U.log('ask AI drafter …'); const tick=setInterval(()=>U.step(2,'run',undefined,Math.min(90,(U._p=(U._p||10)+3))),400); U._p=10;
    try{ const plan=await aiPlan(sample); clearInterval(tick); U.step(2,'ok',plan.summary||'วางแผนเสร็จ'); U.metric('แผน AI',`${plan.views.length} แบบ · 1:${plan.scale} · ${plan.unit}`); U.metric('หมายเหตุทั่วไป',plan.notes.length+' ข้อ'); (plan.checklist||[]).slice(0,6).forEach(c=>U.issue('ตรวจ: '+c,'lo')); U.log(`plan: views=${plan.views.join(',')} unit=${plan.unit} 1:${plan.scale} notes=${plan.notes.length}`); }
    catch(e){ clearInterval(tick); U.step(2,'err','AI ไม่สำเร็จ — ใช้การตั้งค่าปัจจุบัน: '+(e.message||e)); U.issue('AI วางแผนไม่สำเร็จ: '+(e.message||e),'hi'); U.log('AI error: '+(e.message||e)); } }
  else { U.step(2,'skip',useAI?'ไม่มี AI (เปิดนอก Claude) — ใช้การตั้งค่าปัจจุบัน':'ส่งงานโดยไม่ใช้ AI'); }
  U.step(3,'run'); acadRender(); const o={...acadCfg(),fmt:'lsp'}; const B=state.acad.B; const code=acadLISP(B,o); await U.draw(B,code); U.step(3,'ok',`${B.prims.length} entities · ${B.views.length} แบบ`); U.metric('ชุดแบบ',B.views.length+' แบบ'); U.metric('ขนาดไฟล์งาน',(code.length/1024).toFixed(0)+' KB');
  U.step(4,'run'); const iss=qaDrawing(B,o); U.step(4,iss.length?'err':'ok',iss.length?iss.map(i=>'⚠ '+i.t).join('\n'):'ไม่พบปัญหา'); iss.forEach(i=>{ U.log('QA: '+i.t); U.issue(i.t,i.k==='ng'||i.k==='nosec'?'hi':'md'); }); U.metric('ปัญหา QA',iss.length+' รายการ'); if(iss.length) U.step(4,'ok');
  U.step(5,'run'); const base=(state.params.project_name||'model').replace(/[^\w฀-๿-]+/g,'_').slice(0,40)||'model'; const nm=await saveText(`${base}_AI3D2D.lsp`,code,`${base}_AI3D2D_lsp.txt`); SK.runs++; skSave(SK);
  if(nm){ U.step(5,'ok',nm); U.metric('ไฟล์งาน',nm.length>28?nm.slice(0,26)+'…':nm); U.metric('สถานะ Agent','รอ Agent บนเครื่องรับงาน'); U.log('job sent → '+nm); U.step(6,'run','ดูความคืบหน้าที่หน้าต่าง "AI3D AutoCAD Agent" บนเครื่อง — DWG จะอยู่ใน D:\\Claude_Project\\AI3D_DWG',50); }
  else { U.step(5,'err','ยกเลิกการส่งงาน'); U.issue('ผู้ใช้ยกเลิกการบันทึกไฟล์งาน — Agent จะไม่ได้รับงาน','hi'); }
  U.done&&U.done(nm?(iss.length?'warn':'ok'):'err',nm?`ส่งงานเขียนแบบโครงสร้าง ${B.views.length} แบบ (${B.prims.length} entities) → ${nm}`:'ยกเลิกการส่งงาน',nm?[nm]:[]);
  $('#skOut').innerHTML=nm?`📤 ส่งงาน <b>${esc(nm)}</b> แล้ว (${B.prims.length} entities, ${B.views.length} แบบ)`+(iss.length?`<br><b>⚠ ปัญหาที่ตรวจพบ (บันทึกเข้า Skill แล้ว):</b><ul>${iss.map(i=>`<li>${esc(i.t)}</li>`).join('')}</ul>`:''):'ยกเลิกการส่งงาน'; }
async function aiPlan(sample){ const prompt=`You are the AI structural drafter of "AI Structure 3D Builder". Follow this drafting SKILL exactly, including every learned lesson (lessons override the defaults):\n\n${skText()}\n\nMODEL DATA:\n${modelSummary()}\n\nENGINEER REQUEST: ${$('#skAsk').value.trim()||'(none) — produce the full standard drawing set'}\n\nReturn ONLY JSON: {"views":[subset of "ftg","plans","roof","elx","ely","sched"],"unit":"mm"|"m","scale":50|100|200,"text_factor":number 0.6-2.0,"notes":[Thai general-notes lines for the drawing, max 14, each <=110 chars, numbered],"checklist":[Thai items the engineer must check],"summary":"Thai one-paragraph drafting plan"}`;
  const r=await sample.json(prompt,{cache:false}); const j=r?.json||r?.data||r; const views=(Array.isArray(j.views)&&j.views.length?j.views:['ftg','plans','roof','elx','ely','sched']);
  document.querySelectorAll('#acViews input').forEach(c=>c.checked=views.includes(c.value)); if(['mm','m'].includes(j.unit)) $('#acUnit').value=j.unit; if([50,100,200].includes(+j.scale)) $('#acScale').value=String(+j.scale);
  AC_PLAN={tf:Math.min(2,Math.max(0.6,+j.text_factor||1)),notes:Array.isArray(j.notes)?j.notes.map(String):[]}; return {views,unit:$('#acUnit').value,scale:+$('#acScale').value,notes:AC_PLAN.notes,summary:j.summary||'',checklist:j.checklist||[]}; }
$('#skRun').onclick=async()=>{ $('#skRun').disabled=true; AM.busy='📐 AI เขียนแบบโครงสร้าง'; AM.busyTab='acad'; try{ await agentFlow(true); } finally{ AM.busy=null; $('#skRun').disabled=false; } };
$('#skSend').onclick=()=>agentFlow(false);

// =====================================================================
// AI TEAMS: separate AI sets that each work + report on their own, and an AI Command Center
// that runs them as one system and merges every team report into a system report.
// =====================================================================
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const today=()=>new Date().toISOString().slice(0,10);
// ---------- generic embedded skill (versioned, lessons, problem log, AI self-improvement) ----------
function makeSkill(key,title,defMd){ const sk={key,title,defMd,d:null};
  sk.load=()=>{ try{ const j=JSON.parse(localStorage.getItem(key)||'null'); if(j&&j.md) return sk.d=j; }catch(e){} return sk.d={ver:1,md:defMd,lessons:[],issues:[],hist:[],runs:0,updated:today()}; };
  sk.save=()=>{ sk.d.updated=today(); try{ localStorage.setItem(key,JSON.stringify(sk.d)); }catch(e){} sk.paint&&sk.paint(); };
  sk.text=()=>sk.d.md+(sk.d.lessons.length?sk.d.lessons.map((l,i)=>`${i+1}. ${l.text}`).join('\n'):'- (ยังไม่มี)');
  sk.addIssues=list=>{ list.forEach(x=>{ const e=sk.d.issues.find(i=>i.t===x.t); if(e){ e.n++; e.date=today(); } else sk.d.issues.push({t:x.t,sev:x.sev||'md',n:1,date:today()}); }); sk.save(); };
  sk.load(); return sk; }
function skillUI(sk,box){ box.innerHTML=`<details class="adv"><summary>📘 ${esc(sk.title)} — <span data-v></span></summary><div>
  <label class="f">สอน AI / ข้อเสนอแนะ<textarea rows="2" data-teach placeholder="เช่น ปัญหาที่พบในงานจริง หรือวิธีที่ถูกต้อง"></textarea></label>
  <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn pri sm" type="button" data-learn>💾 บันทึกบทเรียน</button><button class="btn sm" type="button" data-imp>🧠 AI พัฒนา Skill จากปัญหา + บทเรียน</button><button class="btn sm" type="button" data-undo>↶ ย้อนเวอร์ชัน</button><button class="btn sm" type="button" data-exp>ส่งออก .md</button></div>
  <div class="status" data-msg></div><div class="status" data-iss></div><div class="status" data-les></div>
  <label class="f">เนื้อหา Skill (แก้ไขได้)<textarea rows="10" data-md style="font-family:var(--f-mono);font-size:12px"></textarea></label></div></details>`;
  const q=a=>box.querySelector(`[data-${a}]`);
  sk.paint=()=>{ const d=sk.d; q('v').textContent=`v${d.ver} · บทเรียน ${d.lessons.length} · ปัญหา ${d.issues.length} · ใช้ ${d.runs} ครั้ง`; q('md').value=d.md;
    q('les').innerHTML=d.lessons.length?'<b>บทเรียน:</b><ol>'+d.lessons.map(l=>`<li>${esc(l.text)}</li>`).join('')+'</ol>':''; q('iss').innerHTML=d.issues.length?'<b>ปัญหาสะสม:</b><ul>'+d.issues.map(i=>`<li>${esc(i.t)} ×${i.n}</li>`).join('')+'</ul>':''; q('undo').disabled=!d.hist.length; };
  sk.paint();
  q('md').onchange=()=>{ sk.d.hist.push({ver:sk.d.ver,md:sk.d.md,lessons:sk.d.lessons}); sk.d.md=q('md').value; sk.d.ver++; sk.save(); };
  q('exp').onclick=()=>saveText(`${sk.key}_v${sk.d.ver}.md`,sk.text());
  q('undo').onclick=()=>{ const h=sk.d.hist.pop(); if(!h) return; sk.d.md=h.md; sk.d.lessons=h.lessons; sk.d.ver++; sk.save(); q('msg').textContent=`ย้อนกลับเป็นเนื้อหา v${h.ver}`; };
  q('learn').onclick=async()=>{ const t=q('teach').value.trim(); if(!t) return; let L=[t]; const S=AI.sampleFn; q('msg').textContent='🤖 AI กำลังสรุปบทเรียน…';
    if(S){ try{ const r=await S.json(`You maintain the skill "${sk.title}". Current skill:\n${sk.text()}\n\nEngineer feedback: "${t}"\nTurn it into 1-3 short reusable Thai rules (<=120 chars, no duplicates). Return ONLY JSON {"lessons":["..."]}`,{cache:false}); if(Array.isArray(r?.lessons)&&r.lessons.length) L=r.lessons.map(String).slice(0,3); }catch(e){} }
    L.forEach(x=>sk.d.lessons.push({text:x.slice(0,200),date:today()})); sk.d.ver++; sk.save(); q('teach').value=''; q('msg').textContent=`บันทึก ${L.length} บทเรียน → Skill v${sk.d.ver}`; };
  q('imp').onclick=async()=>{ const S=AI.sampleFn; if(!S){ q('msg').textContent='ต้องเปิดโปรแกรมใน Claude'; return; } q('msg').textContent='🧠 AI กำลังพัฒนา Skill…';
    try{ const r=await S.json(`You maintain the embedded skill "${sk.title}" of "AI Structure 3D Builder" (Thai practice, ACI/AISC/AISI, วสท./มยผ., units kgf, ksc, cm).\nCURRENT SKILL v${sk.d.ver}:\n${sk.d.md}\nLESSONS:\n${sk.d.lessons.map(l=>'- '+l.text).join('\n')||'(none)'}\nPROBLEMS FOUND IN RUNS:\n${sk.d.issues.map(i=>`- ${i.t} (x${i.n})`).join('\n')||'(none)'}\nImprove the skill: fold durable lessons into the steps, add prevention/check rules for recurring problems, keep valid content, <=60 lines, Thai markdown, keep the same headings. Return ONLY JSON {"md":"...","keep_lessons":["..."],"changes":["..."]}`,{cache:false});
      if(typeof r?.md!=='string'||r.md.length<150) throw new Error('AI ไม่ได้ส่ง Skill ที่สมบูรณ์'); sk.d.hist.push({ver:sk.d.ver,md:sk.d.md,lessons:sk.d.lessons}); if(sk.d.hist.length>10) sk.d.hist.shift();
      sk.d.md=r.md.trim()+'\n'; sk.d.lessons=(r.keep_lessons||[]).map(t=>({text:String(t).slice(0,200),date:today()})); sk.d.issues=[]; sk.d.ver++; sk.save();
      q('msg').innerHTML=`✅ Skill v${sk.d.ver}<ul>${(r.changes||[]).slice(0,8).map(c=>`<li>${esc(c)}</li>`).join('')}</ul>`; }catch(e){ q('msg').textContent='ไม่สำเร็จ: '+(e.message||e); } }; }
// ---------- default skills ----------
const MD_CALC=`# Skill: AI ชุดคำนวณงานโครงสร้าง
## มาตรฐาน
ACI 318 (คสล.), AISC ASD/LRFD (เหล็กรูปพรรณ), AISI S100 (เหล็กรีดเย็น), วสท./มยผ., กฎกระทรวง ฉ.6 — หน่วย kgf, ksc, cm
## ขั้นตอน
1. ตรวจน้ำหนักบรรทุก DL/LL/WL และ Load combination ให้สอดคล้องกับประเภทอาคาร
2. ทุกกลุ่มต้องแสดงสูตร → แทนค่าตัวเลขครบ → ผลลัพธ์ → OK/NG พร้อมอ้างข้อ (clause)
3. ratio > 1.00 = NG ต้องเสนอหน้าตัด/เหล็กเสริมใหม่; 0.95–1.00 = เตือนเกือบเต็มกำลัง; < 0.30 = อาจใหญ่เกิน (ประหยัดได้)
4. คาน: โมเมนต์ ρmin/ρmax, เฉือน Vc+Vs, ระยะปลอก, การแอ่นตัว; เสา: P-M, ความชะลูด; พื้น: ความหนาขั้นต่ำ, เหล็กเสริม; ฐานราก: แรงแบกทาน, เฉือนทะลุ/ทางเดียว
5. เหล็ก: กำลังดัด/โก่งเดาะด้านข้าง, แรงอัด KL/r, แรงเฉือน, การแอ่นตัว L/240–L/360
6. สรุปกลุ่มที่ต้องแก้ และข้อเสนอแนะต่อทีมเขียนแบบและ BOQ
## บทเรียนที่เรียนรู้ (อัปเดตอัตโนมัติจากการสอนของวิศวกร)
`;
const MD_ARCH=`# Skill: AI ชุดวาดแบบสถาปัตยกรรม (AutoCAD)
## เป้าหมาย
วาดแปลนสถาปัตย์ทุกชั้นลง AutoCAD จากแบบที่อัปโหลด ให้ตรงกับ Grid โครงสร้าง
## ขั้นตอน
1. อ่านแบบ: ผนัง (แนว, ความหนา 10/20 cm), ประตู (ตำแหน่ง, กว้าง 0.8/0.9/1.0 m, ทิศเปิด), หน้าต่าง, ห้อง (ชื่อ, พื้นที่), บันได
2. พิกัดเป็นเมตร อ้างอิง Grid โครงสร้าง (x ตาม Grid ตัวเลข, y ตาม Grid ตัวอักษร)
3. Layer: A-WALL, A-DOOR, A-WIND, A-ROOM, A-STAIR; หน่วย mm 1:1; ตัวอักษร 2.5 mm @1:100
4. ทุกห้องมีชื่อ + พื้นที่ (m²); ทุกแปลนมี Grid, Dimension, ชื่อแบบ + มาตราส่วน
5. ถ้าไม่มีแบบสถาปัตย์ ให้สร้างผังแนวคิดตาม Grid และแจ้งเป็นปัญหา
## บทเรียนที่เรียนรู้ (อัปเดตอัตโนมัติจากการสอนของวิศวกร)
`;
const MD_BOQ=`# Skill: AI ชุดทำ BOQ (แบบ ปร.4 กรมบัญชีกลาง)
## ขั้นตอน
1. ถอดงานโครงสร้างจากโมเดล (ดิน ฐานราก เสาเข็ม คอนกรีต ไม้แบบ เหล็กเสริม เหล็กรูปพรรณ หลังคา)
2. ถอดงานสถาปัตย์จากแบบ (ผนัง ฉาบ ทาสี พื้น ฝ้า ประตู หน้าต่าง สุขภัณฑ์) + รายการที่แบบไม่ได้ระบุแต่ต้องมี
3. ราคา: แยกค่าวัสดุ/ค่าแรง ต่อหน่วย อ้างอิง สนค. กระทรวงพาณิชย์ รายจังหวัด, คูณ Factor F
4. ตรวจ: รายการไม่มีราคา, ปริมาณเป็นศูนย์, รายการซ้ำ, ราคาผิดปกติ (> ±40% จากตลาด), สัดส่วนค่าแรง/วัสดุผิดปกติ
5. หน่วยมาตรฐาน: m³ คอนกรีต, m² ไม้แบบ/ผนัง, kg เหล็ก, ต้น เสาเข็ม, ชุด/แห่ง ครุภัณฑ์
## บทเรียนที่เรียนรู้ (อัปเดตอัตโนมัติจากการสอนของวิศวกร)
`;
const SKILL_CALC=makeSkill('ai3d_skill_calc','Skill คำนวณงานโครงสร้าง',MD_CALC), SKILL_ARCH=makeSkill('ai3d_skill_arch','Skill วาดแบบสถาปัตย์',MD_ARCH), SKILL_BOQ=makeSkill('ai3d_skill_boq','Skill ทำ BOQ',MD_BOQ);
const SKILL_SDRAW={title:'Skill เขียนแบบโครงสร้าง (ในแท็บ AutoCAD 2D)',get d(){ return SK; },addIssues:l=>{},save:()=>skSave(SK)};
// ---------- team reports ----------
const REP={}; try{ Object.assign(REP,JSON.parse(localStorage.getItem('ai3d_team_reports')||'{}')); }catch(e){}
const saveRep=()=>{ try{ localStorage.setItem('ai3d_team_reports',JSON.stringify(REP,(k,v)=>k==='html'?undefined:v)); }catch(e){} paintReports(); };
function reporter(id,mode){ // mode: {nested:k} when run by the command center, else direct
  const T=TEAMS[id], R=REP[id]={team:T.name,icon:T.icon,status:'run',pct:0,start:Date.now(),end:0,summary:'',metrics:{},issues:[],outputs:[],sub:T.steps.map(n=>({n,s:'wait',p:0,d:''}))}; const W=T.w||T.steps.map(()=>1); const tot=W.reduce((a,b)=>a+b,0);
  const pct=()=>Math.round(R.sub.reduce((a,x,i)=>a+W[i]*(x.s==='ok'||x.s==='skip'||x.s==='err'?1:x.p/100),0)/tot*100);
  const nest=mode&&mode.nested!=null; if(!nest) AM.open({title:`${T.icon} ${T.name} · AI AGENT`,steps:T.steps,w:W,canvas:T.canvas||'WORKSPACE'});
  const U={ step(i,s,d,p){ const x=R.sub[i]; if(!x) return; Object.assign(x,{s,p:p??(s==='ok'?100:x.p),d:d??x.d}); R.pct=pct(); if(nest) AM.step(mode.nested,'run',`${i+1}/${R.sub.length} ${x.n}${x.d?' — '+String(x.d).slice(0,90):''}`,R.pct); else AM.step(i,s,d,p); },
    metric(k,v){ R.metrics[k]=v; AM.metric(nest?`${T.icon} ${k}`:k,v); }, issue(t,sev='md'){ R.issues.push({t,sev}); AM.issue(nest?`${T.icon} ${t}`:t,sev); },
    log(t){ AM.log(nest?`${T.icon} ${t}`:t); }, canvas(h){ AM.canvas(h); }, lbl(t){ AM.lbl(t); },
    draw(B,code){ if(nest){ AM.canvas(acadSVG(B).replace('background:#fff','background:transparent').replace('<svg ','<svg style="filter:invert(1) hue-rotate(180deg) drop-shadow(0 0 3px #22d3ee)" ')); AM.lbl(`${T.icon} ${B.views.length} แบบ · ${B.prims.length} objects`); U.log(`${B.prims.length} entities ready`); return Promise.resolve(); } AM._ds=T.drawStep??3; return AM.draw(B,code); },
    done(status,summary,outputs){ R.status=status; R.summary=summary||R.summary; if(outputs) R.outputs=outputs; R.end=Date.now(); R.pct=100; if(nest) AM.step(mode.nested,status==='err'?'err':'ok',`${status==='ok'?'✔':status==='warn'?'⚠':'✖'} ${summary||''}`.slice(0,160)); saveRep(); } };
  return U; }
// ---------- TEAM: structural calculation ----------
async function runCalc(U){ const S=AI.sampleFn, sk=SKILL_CALC; if(!state.design) return U.done('err','ยังไม่มีโมเดล/ผลออกแบบ');
  U.step(0,'run'); U.metric('Skill คำนวณ',`v${sk.d.ver}`); U.step(0,'ok',`Skill v${sk.d.ver} · บทเรียน ${sk.d.lessons.length}`);
  U.step(1,'run'); const G=state.design.groups.filter(g=>!g.hidden); U.metric('กลุ่มออกแบบ',G.length); U.step(1,'ok',`${G.length} กลุ่ม`);
  U.step(2,'run'); const auto=[]; G.forEach(g=>{ const r=+g.ratio||0; if(g.status==='NG'||r>1) auto.push({t:`${g.key} ${g.title}: NG (ratio ${r.toFixed(2)}) — ${g.section}`,sev:'hi'}); else if(r>0.95) auto.push({t:`${g.key}: เกือบเต็มกำลัง ratio ${r.toFixed(2)}`,sev:'md'}); else if(r>0&&r<0.3) auto.push({t:`${g.key}: ratio ${r.toFixed(2)} อาจใหญ่เกิน (ประหยัดได้)`,sev:'lo'}); });
  auto.forEach(x=>U.issue(x.t,x.sev)); U.metric('NG',G.filter(g=>g.status==='NG').length); U.step(2,auto.some(x=>x.sev==='hi')?'err':'ok',`พบ ${auto.length} ประเด็น`);
  let ai=null; U.step(3,'run','AI กำลังตรวจรายการคำนวณ…',10);
  if(S){ try{ const data=G.slice(0,40).map(g=>({key:g.key,title:g.title,section:g.section,status:g.status,ratio:+(+g.ratio||0).toFixed(3),steps:(g.steps||[]).slice(0,8).map(s=>[s.h,s.fx,s.sb,s.r].filter(Boolean).join(' | ').slice(0,180))}));
      const P=state.params; const tk=setInterval(()=>U.step(3,'run',undefined,Math.min(90,(U._p=(U._p||10)+4))),500);
      try{ ai=await S.json(`You are the AI structural calculation checker of "AI Structure 3D Builder". Follow this SKILL:\n${sk.text()}\n\nMATERIALS: ${JSON.stringify(P.materials)}\nLOADS: ${JSON.stringify(P.loads||{})}\nOCCUPANCY: ${P.occupancy||''}\nDESIGN GROUPS (with calc steps):\n${JSON.stringify(data)}\n\nCheck every group against the codes. Units kgf, ksc, cm. Return ONLY JSON {"checks":[{"group":"key","status":"OK"|"WARN"|"NG","clause":"code clause","comment":"Thai, with the key numbers substituted"}],"recommendations":["Thai"],"summary":"Thai paragraph"}`,{cache:false}); } finally{ clearInterval(tk); }
      (ai.checks||[]).filter(c=>c.status!=='OK').forEach(c=>U.issue(`${c.group}: ${c.comment}${c.clause?` (${c.clause})`:''}`,c.status==='NG'?'hi':'md')); U.step(3,'ok',ai.summary||'ตรวจครบ'); }
    catch(e){ U.issue('AI ตรวจคำนวณไม่สำเร็จ: '+(e.message||e),'hi'); U.step(3,'err',String(e.message||e)); } }
  else U.step(3,'skip','ไม่มี AI (เปิดนอก Claude) — ใช้ผลตรวจอัตโนมัติ');
  U.step(4,'run'); const chk=new Map((ai?.checks||[]).map(c=>[c.group,c]));
  const rows=G.map(g=>{ const c=chk.get(g.key); const r=+g.ratio||0; const st=c?.status||(g.status==='NG'?'NG':r>0.95?'WARN':'OK'); return {g,c,r,st}; });
  const tbl=`<table style="width:100%;border-collapse:collapse;font-size:12px;color:#e0fbff"><tr style="color:#67e8f9"><th align=left>กลุ่ม</th><th align=left>หน้าตัด</th><th>ratio</th><th>ผล</th><th align=left>AI</th></tr>${rows.map(x=>`<tr style="border-bottom:1px solid #22d3ee22"><td>${esc(x.g.key)} ${esc(x.g.title.slice(0,30))}</td><td>${esc((x.g.section||'').slice(0,40))}</td><td><div style="width:70px;height:7px;background:#0e2a3f;border-radius:4px"><div style="width:${Math.min(100,x.r*100)}%;height:100%;border-radius:4px;background:${x.r>1?'#f43f5e':x.r>0.95?'#f59e0b':'#22d3ee'}"></div></div>${x.r.toFixed(2)}</td><td style="color:${x.st==='NG'?'#f87171':x.st==='WARN'?'#fbbf24':'#4ade80'}">${x.st}</td><td>${esc((x.c?.comment||'').slice(0,90))}</td></tr>`).join('')}</table>`;
  U.canvas(`<div style="padding:34px 12px 12px;overflow:auto;height:100%">${tbl}</div>`); U.lbl('CALC MATRIX · '+G.length+' groups');
  const ng=rows.filter(x=>x.st==='NG').length, wn=rows.filter(x=>x.st==='WARN').length;
  REP.calc.html=`<h2>รายงานตรวจรายการคำนวณโดย AI — ${esc(state.params.project_name||'')}</h2><p>${esc(ai?.summary||'')}</p>${tbl.replace(/#e0fbff/g,'#111').replace(/#67e8f9/g,'#0e7490')}<h3>ข้อเสนอแนะ</h3><ul>${(ai?.recommendations||[]).map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`;
  U.metric('ผลตรวจ',`OK ${rows.length-ng-wn} · WARN ${wn} · NG ${ng}`); U.step(4,'ok',`OK ${rows.length-ng-wn} / WARN ${wn} / NG ${ng}`);
  U.step(5,'run'); sk.addIssues(REP.calc.issues.filter(i=>i.sev!=='lo')); sk.d.runs++; sk.save(); U.step(5,'ok',`บันทึก ${REP.calc.issues.length} ประเด็นเข้า Skill`);
  REP.calc.recs=ai?.recommendations||[]; U.done(ng?'warn':'ok',`ตรวจ ${rows.length} กลุ่ม: OK ${rows.length-ng-wn}, WARN ${wn}, NG ${ng}. ${ai?.summary||''}`.slice(0,400),['รายงานตรวจคำนวณ (HTML)']); }
// ---------- TEAM: architectural drafting ----------
async function overviewBlobs(n=4){ const out=[]; for(const s of (state.sources||[])) for(const b of (s.images||[])){ if(out.length<n) out.push(b); } return out; }
function archBuild(L,o){ const M=state.model, gx=M.gx, gy=M.gy, ts=o.scale/100, TH=0.25*ts, prims=[], views=[]; const X0=gx[0].pos, X1=gx[gx.length-1].pos, Y0=gy[0].pos, Y1=gy[gy.length-1].pos, ext=1.2*ts+0.8, br=0.45*ts;
  const P=(t,o2)=>prims.push({t,...o2}); let col=0; const Wd=X1-X0+2*ext+6*ts+3;
  for(const lv of L){ const ox=col*Wd-X0+ext+2*br, oy=0; col++;
    gx.forEach(g=>{ P('L',{a:[ox+g.pos,oy+Y0-ext],b:[ox+g.pos,oy+Y1+ext*0.6],ly:'S-GRID'}); P('C',{c:[ox+g.pos,oy+Y0-ext-br],r:br,ly:'S-GRIDTXT'}); P('T',{p:[ox+g.pos,oy+Y0-ext-br],s:g.label,h:br*0.9,ly:'S-GRIDTXT',rot:0}); });
    gy.forEach(g=>{ P('L',{a:[ox+X0-ext,oy+g.pos],b:[ox+X1+ext*0.6,oy+g.pos],ly:'S-GRID'}); P('C',{c:[ox+X0-ext-br,oy+g.pos],r:br,ly:'S-GRIDTXT'}); P('T',{p:[ox+X0-ext-br,oy+g.pos],s:g.label,h:br*0.9,ly:'S-GRIDTXT',rot:0}); });
    for(let i=1;i<gx.length;i++) P('D',{a:[ox+gx[i-1].pos,oy+Y1],b:[ox+gx[i].pos,oy+Y1],loc:[ox+gx[i].pos,oy+Y1+ext*0.6+0.6*ts],ly:'S-DIM',h:TH});
    for(const w of (lv.walls||[])){ const [x1,y1,x2,y2,t=0.2]=w.map(Number); const len=Math.hypot(x2-x1,y2-y1); if(!(len>0.05)) continue; const nx=-(y2-y1)/len*t/2, ny=(x2-x1)/len*t/2;
      P('PL',{pts:[[ox+x1+nx,oy+y1+ny],[ox+x2+nx,oy+y2+ny],[ox+x2-nx,oy+y2-ny],[ox+x1-nx,oy+y1-ny]],ly:'A-WALL',cl:true}); }
    for(const d of (lv.doors||[])){ const [x,y,w=0.9,ang=0]=d.map(Number); const a=ang*Math.PI/180, ux=Math.cos(a), uy=Math.sin(a); const hx=ox+x-ux*w/2, hy=oy+y-uy*w/2;
      P('L',{a:[hx,hy],b:[hx-uy*w,hy+ux*w],ly:'A-DOOR'}); const arc=[]; for(let k=0;k<=8;k++){ const th=k/8*Math.PI/2; arc.push([hx+ux*w*Math.cos(th)-uy*w*Math.sin(th),hy+uy*w*Math.cos(th)+ux*w*Math.sin(th)]); } P('PL',{pts:arc,ly:'A-DOOR',cl:false}); }
    for(const wi of (lv.windows||[])){ const [x1,y1,x2,y2]=wi.map(Number); const len=Math.hypot(x2-x1,y2-y1); if(!(len>0.1)) continue; const nx=-(y2-y1)/len*0.1, ny=(x2-x1)/len*0.1;
      P('PL',{pts:[[ox+x1+nx,oy+y1+ny],[ox+x2+nx,oy+y2+ny],[ox+x2-nx,oy+y2-ny],[ox+x1-nx,oy+y1-ny]],ly:'A-WIND',cl:true}); P('L',{a:[ox+x1,oy+y1],b:[ox+x2,oy+y2],ly:'A-WIND'}); }
    for(const r of (lv.rooms||[])){ P('T',{p:[ox+(+r.x),oy+(+r.y)+0.25*ts],s:String(r.name||'ห้อง').slice(0,30),h:TH*1.1,ly:'A-ROOM',rot:0}); if(r.area) P('T',{p:[ox+(+r.x),oy+(+r.y)-0.2*ts],s:`${(+r.area).toFixed(1)} m²`,h:TH*0.8,ly:'A-ROOM',rot:0}); }
    const ttl=`แปลนสถาปัตยกรรม ${lv.name||''}`; P('T',{p:[ox+(X0+X1)/2,oy+Y0-ext-2*br-1.0*ts],s:ttl,h:0.5*ts,ly:'S-TITLE',rot:0}); P('T',{p:[ox+(X0+X1)/2,oy+Y0-ext-2*br-1.85*ts],s:`มาตราส่วน 1:${o.scale}`,h:TH,ly:'S-TEXT',rot:0}); views.push(ttl); }
  return {prims,views}; }
function archFallback(){ const M=state.model, gx=M.gx, gy=M.gy, X0=gx[0].pos, X1=gx[gx.length-1].pos, Y0=gy[0].pos, Y1=gy[gy.length-1].pos; let n=0;
  return M.levels.slice(0,Math.max(1,M.levels.length-1)).map(lv=>({name:lv.name,walls:[[X0,Y0,X1,Y0,0.2],[X1,Y0,X1,Y1,0.2],[X1,Y1,X0,Y1,0.2],[X0,Y1,X0,Y0,0.2],...gx.slice(1,-1).map(g=>[g.pos,Y0,g.pos,Y1,0.1])],
    doors:[[(gx[0].pos+gx[1].pos)/2,Y0,1.0,0]],windows:gx.slice(1).map((g,i)=>[gx[i].pos+0.8,Y1,g.pos-0.8,Y1]),rooms:gx.slice(1).map((g,i)=>({name:'ห้อง '+(++n),x:(gx[i].pos+g.pos)/2,y:(Y0+Y1)/2,area:(g.pos-gx[i].pos)*(Y1-Y0)}))})); }
async function runArch(U){ const S=AI.sampleFn, sk=SKILL_ARCH; if(!state.model) return U.done('err','ยังไม่มีโมเดล');
  U.step(0,'run'); U.metric('Skill สถาปัตย์',`v${sk.d.ver}`); U.step(0,'ok',`Skill v${sk.d.ver}`);
  U.step(1,'run'); const imgs=await overviewBlobs(4); U.metric('ภาพแบบ',imgs.length+' ภาพ'); if(!imgs.length) U.issue('ไม่มีแบบสถาปัตย์ที่อัปโหลด — สร้างผังแนวคิดตาม Grid','md'); U.step(1,'ok',imgs.length?`${imgs.length} ภาพ`:'ไม่มีภาพแบบ');
  let L=null; U.step(2,'run','AI กำลังอ่านแบบ…',10);
  if(S){ const M=state.model; const tk=setInterval(()=>U.step(2,'run',undefined,Math.min(90,(U._p=(U._p||10)+3))),500);
    try{ const r=await S.json(`You are the AI architectural drafter of "AI Structure 3D Builder". Follow this SKILL:\n${sk.text()}\n\nSTRUCTURAL GRID (metres): X ${JSON.stringify(M.gx.map(g=>[g.label,g.pos]))}, Y ${JSON.stringify(M.gy.map(g=>[g.label,g.pos]))}; LEVELS ${JSON.stringify(M.levels.map(l=>[l.name,l.elev]))}.\n${imgs.length?'Read the attached architectural drawings.':'No drawings attached: propose a sensible concept layout for the building use: '+(state.params.occupancy||'')}\nENGINEER REQUEST: ${$('#tmAsk_arch')?.value||'(none)'}\nAll coordinates in metres in the grid system. Return ONLY JSON {"levels":[{"name":"level name","walls":[[x1,y1,x2,y2,thickness]],"doors":[[x,y,width,angle_deg]],"windows":[[x1,y1,x2,y2]],"rooms":[{"name":"Thai","x":0,"y":0,"area":0}]}],"issues":["Thai problems/uncertain readings"],"summary":"Thai"}`,{images:imgs,cache:false});
      L=Array.isArray(r?.levels)&&r.levels.length?r.levels:null; (r?.issues||[]).forEach(t=>U.issue(String(t),'md')); U.step(2,L?'ok':'err',r?.summary||(L?'อ่านแบบเสร็จ':'AI ไม่ได้ส่งผังกลับมา')); }
    catch(e){ U.issue('AI อ่านแบบไม่สำเร็จ: '+(e.message||e),'hi'); U.step(2,'err',String(e.message||e)); } finally{ clearInterval(tk); } }
  else U.step(2,'skip','ไม่มี AI — ใช้ผังแนวคิดจาก Grid');
  if(!L){ L=archFallback(); U.issue('ใช้ผังแนวคิดอัตโนมัติจาก Grid (ไม่ใช่แบบจริง)','md'); }
  U.step(3,'run'); const o={unit:$('#acUnit')?.value||'mm',scale:+($('#acScale')?.value||100)}; const B=archBuild(L,o); const code=acadLISP(B,o);
  const nW=L.reduce((a,l)=>a+(l.walls||[]).length,0), nD=L.reduce((a,l)=>a+(l.doors||[]).length,0), nWi=L.reduce((a,l)=>a+(l.windows||[]).length,0), nR=L.reduce((a,l)=>a+(l.rooms||[]).length,0);
  U.metric('ผนัง / ประตู / หน้าต่าง / ห้อง',`${nW} / ${nD} / ${nWi} / ${nR}`); await U.draw(B,code); U.step(3,'ok',`${B.prims.length} entities · ${B.views.length} แปลน`);
  U.step(4,'run'); const q=[]; if(!nW) q.push({t:'ไม่มีผนังในแปลน',sev:'hi'}); if(!nD) q.push({t:'ไม่มีประตู',sev:'md'}); if(nR&&L.some(l=>(l.rooms||[]).some(r=>!r.name))) q.push({t:'มีห้องไม่มีชื่อ',sev:'md'}); if(!nR) q.push({t:'ไม่มีชื่อห้อง/พื้นที่',sev:'md'});
  q.forEach(x=>U.issue(x.t,x.sev)); sk.addIssues(q); U.step(4,'ok',q.length?`${q.length} ปัญหา`:'ไม่พบปัญหา');
  U.step(5,'run'); const base=(state.params.project_name||'model').replace(/[^\w฀-๿-]+/g,'_').slice(0,36)||'model'; const nm=await saveText(`${base}_ARCH_AI3D2D.lsp`,code,`${base}_ARCH_AI3D2D_lsp.txt`); sk.d.runs++; sk.save();
  if(nm){ U.step(5,'ok',nm); U.metric('ไฟล์งาน',nm.slice(0,30)); } else { U.step(5,'err','ยกเลิกการส่งงาน'); }
  U.done(!nm?'err':REP.arch.issues.some(i=>i.sev==='hi')?'warn':'ok',`แปลนสถาปัตย์ ${B.views.length} แปลน (ผนัง ${nW}, ประตู ${nD}, หน้าต่าง ${nWi}, ห้อง ${nR})${nm?' → ส่ง AutoCAD Agent':''}`,nm?[nm]:[]); }
// ---------- TEAM: BOQ ----------
async function clickAndWait(sel,U,si,maxMs=360000){ const b=$(sel); if(!b) return 'missing'; const orig=b.textContent; b.click(); let changed=false; const t0=Date.now();
  while(Date.now()-t0<maxMs){ await wait(400); const st=$('#qStatus')?.textContent||''; if(st) U.step(si,'run',st.slice(0,120),Math.min(95,10+(Date.now()-t0)/1500));
    if(b.textContent!==orig) changed=true; else if(changed||Date.now()-t0>1500) return changed?'done':'instant'; } return 'timeout'; }
async function runBoq(U){ const S=AI.sampleFn, sk=SKILL_BOQ; if(!state.model) return U.done('err','ยังไม่มีโมเดล');
  U.step(0,'run'); U.metric('Skill BOQ',`v${sk.d.ver}`); U.step(0,'ok',`Skill v${sk.d.ver}`);
  U.step(1,'run'); $('#qRe')?.click(); await wait(700); const nS=(state.qto?.rows||[]).filter(r=>r.cat==='struct').length; U.metric('รายการโครงสร้าง',nS); U.step(1,'ok',`${nS} รายการ`);
  U.step(2,'run'); if((state.sources||[]).length&&$('#qP2B')){ await clickAndWait('#qP2B',U,2,60000); U.step(2,'ok',($('#qStatus')?.textContent||'ถอดงานสถาปัตย์จากแบบแล้ว').slice(0,120)); } else U.step(2,'skip','ไม่มีแบบที่อัปโหลด');
  U.step(3,'run'); if(S){ const r=await clickAndWait('#qAI',U,3); U.step(3,r==='timeout'?'err':'ok',($('#qStatus')?.textContent||'').slice(0,140)||'AI ใส่ราคาแล้ว'); } else U.step(3,'skip','ไม่มี AI — ใช้ราคาเริ่มต้นในโปรแกรม');
  const rows=()=>state.qto?.rows||[];
  U.step(4,'run','AI ตรวจ BOQ ตาม Skill…',10); let rv=null;
  if(S&&rows().length){ try{ const data=rows().slice(0,160).map(r=>[r.id,r.cat,r.sub,r.desc.slice(0,70),r.qty,r.unit,r.mat,r.lab]);
      rv=await S.json(`You are the AI BOQ checker (Thai ปร.4). Follow this SKILL:\n${sk.text()}\nPROVINCE: ${$('#qProv')?.value||''}\nBOQ ROWS [id,cat,sub,desc,qty,unit,mat,lab]:\n${JSON.stringify(data)}\nFind missing items that must exist for this building, rows with wrong/abnormal unit prices, zero quantities and duplicates. Return ONLY JSON {"missing":[{"sub":"Thai","desc":"Thai","qty":0,"unit":"","mat":0,"lab":0,"note":"why"}],"flags":[{"id":"row id","issue":"Thai","mat":0,"lab":0}],"summary":"Thai"}`,{cache:false});
      const add=(rv.missing||[]).slice(0,25).filter(m=>m&&m.desc&&+m.qty>0); add.forEach((m,i)=>rows().push({id:'AIB'+(i+1),cat:'arch',sub:String(m.sub||'รายการเพิ่มเติม (AI BOQ)').slice(0,40),desc:String(m.desc).slice(0,140),qty:+m.qty,unit:String(m.unit||''),mat:+m.mat||0,lab:+m.lab||0,src:'add',ref:'MARKET',note:'AI BOQ: '+String(m.note||'').slice(0,100),pr:'AI'}));
      (rv.flags||[]).forEach(fl=>U.issue(`${fl.id}: ${fl.issue}`,'md')); if(add.length){ try{ AI.renderQTO(); }catch(e){} } U.metric('รายการที่ AI เพิ่ม',add.length); U.step(4,'ok',rv.summary||`เพิ่ม ${add.length} รายการ`); }
    catch(e){ U.issue('AI ตรวจ BOQ ไม่สำเร็จ: '+(e.message||e),'hi'); U.step(4,'err',String(e.message||e)); } }
  else U.step(4,'skip',S?'ไม่มีรายการ':'ไม่มี AI');
  U.step(5,'run'); const R=rows(); const q=[]; const noP=R.filter(r=>!(+r.mat)&&!(+r.lab)); if(noP.length) q.push({t:`ไม่มีราคา ${noP.length} รายการ`,sev:'hi'}); const z=R.filter(r=>!(+r.qty>0)); if(z.length) q.push({t:`ปริมาณเป็นศูนย์ ${z.length} รายการ`,sev:'md'});
  const seen=new Set(), dup=R.filter(r=>{ const k=r.sub+'|'+r.desc+'|'+r.unit; if(seen.has(k)) return true; seen.add(k); return false; }); if(dup.length) q.push({t:`รายการซ้ำ ${dup.length}`,sev:'md'}); if(!R.some(r=>r.cat!=='struct')) q.push({t:'ยังไม่มีงานสถาปัตย์ใน BOQ',sev:'md'});
  q.forEach(x=>U.issue(x.t,x.sev)); sk.addIssues(q); const F=+($('#qF')?.value||1)||1; const mat=R.reduce((a,r)=>a+(+r.mat||0)*(+r.qty||0),0), lab=R.reduce((a,r)=>a+(+r.lab||0)*(+r.qty||0),0);
  U.metric('ค่าวัสดุ',Math.round(mat).toLocaleString()); U.metric('ค่าแรง',Math.round(lab).toLocaleString()); U.metric('รวม × F',Math.round((mat+lab)*F).toLocaleString()+' บาท'); U.step(5,'ok',q.length?`${q.length} ปัญหา`:'ไม่พบปัญหา');
  U.step(6,'run'); const bySub={}; R.forEach(r=>{ bySub[r.sub]=(bySub[r.sub]||0)+((+r.mat||0)+(+r.lab||0))*(+r.qty||0); }); const mx=Math.max(1,...Object.values(bySub));
  U.canvas(`<div style="padding:34px 14px;overflow:auto;height:100%;font-size:12.5px">${Object.entries(bySub).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="display:grid;grid-template-columns:200px 1fr 110px;gap:8px;align-items:center;margin:3px 0"><span>${esc(k)}</span><div style="height:12px;border-radius:6px;background:linear-gradient(90deg,#22d3ee,#a78bfa,#f0abfc);width:${v/mx*100}%;box-shadow:0 0 10px #22d3ee"></div><span style="text-align:right;color:#fde047">${Math.round(v*F).toLocaleString()}</span></div>`).join('')}<div style="margin-top:10px;font-size:15px;color:#fff">รวมทั้งสิ้น × Factor F ${F}: <b style="color:#fde047">${Math.round((mat+lab)*F).toLocaleString()} บาท</b></div></div>`); U.lbl('BOQ · ปร.4 · '+R.length+' รายการ');
  if(SKILL_BOQ.autoCsv!==false) $('#qCsv')?.click(); sk.d.runs++; sk.save(); U.step(6,'ok','ส่งออก BOQ (.csv) แล้ว');
  U.done(q.some(x=>x.sev==='hi')?'warn':'ok',`BOQ ${R.length} รายการ รวม ${Math.round((mat+lab)*F).toLocaleString()} บาท (×F ${F}). ${rv?.summary||''}`.slice(0,400),['BOQ ปร.4 (.csv)']); }
// ---------- TEAM: structural drafting (wraps the AutoCAD agent) ----------
async function runSdraw(U){ await agentFlow(true,U); if(REP.sdraw&&REP.sdraw.status==='run') U.done('err','ไม่ได้ส่งงาน'); }
const TEAMS={
  calc:{name:'AI ชุดคำนวณงานโครงสร้าง',icon:'🧮',steps:['อ่าน Skill คำนวณ','รวบรวมผลออกแบบทุกกลุ่ม','ตรวจอัตโนมัติ (NG / ratio)','AI ตรวจรายการคำนวณตามมาตรฐาน','สร้างรายงานคำนวณ','บันทึกปัญหาเข้า Skill'],w:[1,1,2,8,2,1],canvas:'CALC MATRIX',skill:SKILL_CALC,run:runCalc,desc:'ตรวจทุกกลุ่มออกแบบ (ACI/AISC/AISI) ด้วย AI: สูตร แทนค่า ผล OK/NG อ้างข้อมาตรฐาน + ข้อเสนอแนะ'},
  sdraw:{name:'AI ชุดเขียนแบบงานโครงสร้าง',icon:'📐',steps:['อ่าน Skill การเขียนแบบ','วิเคราะห์ข้อมูลโมเดล','AI วางแผนชุดแบบ / มาตราส่วน / หมายเหตุ','สร้างเส้น ตัวอักษร Dim (entities)','ตรวจปัญหา (QA) + บันทึกเข้า Skill','ส่งงานให้ AutoCAD Agent','Agent เปิด AutoCAD → วาด → บันทึก DWG'],w:[5,5,35,20,10,10,15],skill:SKILL_SDRAW,run:runSdraw,desc:'แปลนฐานราก/ชั้น/หลังคา รูปด้าน ตารางหน้าตัด → เปิด AutoCAD วาดผ่าน Agent'},
  arch:{name:'AI ชุดวาดแบบสถาปัตยกรรม',icon:'🏛',steps:['อ่าน Skill สถาปัตย์','รวบรวมภาพแบบที่อัปโหลด','AI อ่านแบบ → ผนัง ประตู หน้าต่าง ห้อง','สร้างแปลนสถาปัตย์ (entities)','ตรวจปัญหา QA + บันทึกเข้า Skill','ส่งงานให้ AutoCAD Agent'],w:[1,1,8,3,1,1],skill:SKILL_ARCH,run:runArch,desc:'AI อ่านแบบสถาปัตย์ → ผนัง ประตู หน้าต่าง ชื่อห้อง/พื้นที่ ตาม Grid → วาดลง AutoCAD'},
  boq:{name:'AI ชุดทำ BOQ',icon:'💰',steps:['อ่าน Skill BOQ','ถอดงานโครงสร้างจากโมเดล','ถอดงานสถาปัตย์จากแบบ (Plan2BOQ)','AI ถอดละเอียด + ราคา','AI ตรวจ BOQ ตาม Skill (รายการขาด/ราคาผิดปกติ)','ตรวจปัญหา QA + บันทึกเข้า Skill','สรุป + ส่งออก ปร.4'],w:[1,2,3,8,6,1,1],canvas:'BOQ',skill:SKILL_BOQ,run:runBoq,desc:'ถอดปริมาณโครงสร้าง+สถาปัตย์ ใส่ราคาตามจังหวัด ตรวจรายการขาด/ราคาผิดปกติ → BOQ ปร.4'} };
const ORDER=['calc','sdraw','arch','boq']; let busy=false;
async function runTeam(id){ if(busy) return; busy=true; try{ const U=reporter(id); await TEAMS[id].run(U); if(REP[id].status==='run') U.done('err','หยุดกลางทาง'); } catch(e){ REP[id]&&Object.assign(REP[id],{status:'err',summary:String(e.message||e)}); saveRep(); } finally{ busy=false; paintReports(); } }
// ---------- AI COMMAND CENTER: run all teams as one system + merged system report ----------
const STAGES=[['calc','arch'],['sdraw','boq']];
async function runAll(){ if(busy) return; busy=true; const on=id=>$(`#tmOn_${id}`)?.checked!==false; const stages=STAGES.map(g=>g.filter(on)).filter(g=>g.length); const ids=stages.flat();
  AM.open({title:'🛰 AI COMMAND CENTER · ระบบ AI ทุกชุด (ทำงานพร้อมกันเป็นขั้น)',steps:[...ids.map(id=>`ขั้น ${stages.findIndex(g=>g.includes(id))+1} · ${TEAMS[id].icon} ${TEAMS[id].name}`),'ขั้น '+(stages.length+1)+' · 🧠 AI รวมรายงานเป็นระบบ'],w:[...ids.map(()=>4),2],canvas:'SYSTEM'});
  paintFlow('run'); TB.cc=ids; TB.ccDone=false; TB.ccMsg='';
  try{ for(const [si,g] of stages.entries()){ AM.log(`===== STAGE ${si+1}: ${g.map(id=>TEAMS[id].name).join(' + ')} (parallel) =====`);
      await Promise.all(g.map(async id=>{ const k=ids.indexOf(id); AM.step(k,'run','เริ่มทำงาน…',1); const U=reporter(id,{nested:k}); paintFlow();
        try{ await TEAMS[id].run(U); if(REP[id].status==='run') U.done('err','หยุดกลางทาง'); }catch(e){ U.issue(`${TEAMS[id].name} ล้มเหลว: ${e.message||e}`,'hi'); U.done('err',String(e.message||e)); } paintFlow(); })); }
    const k=ids.length; TB.ccMsg='🧠 AI รวมรายงานระบบ…'; AM.step(k,'run','AI กำลังรวมรายงานทุกชุด…',20); const sys=await systemReport(ids); AM.step(k,'ok',sys.summary.slice(0,150));
    AM.canvas(sysHTML(sys,true)); AM.lbl('SYSTEM REPORT · '+sys.overall); }
  finally{ busy=false; TB.cc=null; paintReports(); } }
// ---------- live workflow diagram (status-coloured) ----------
function paintFlow(){ const box=$('#tmFlow'); if(!box) return; const C={ok:'#16a34a',warn:'#d97706',err:'#dc2626',run:'#0284c7'}; const col=id=>C[REP[id]?.status]||'#64748b'; const pc=id=>REP[id]?` ${REP[id].pct}%`:'';
  const node=(x,y,w,id,t,sub)=>`<g><rect x="${x}" y="${y}" width="${w}" height="54" rx="10" fill="${id?col(id)+'22':'#7c3aed22'}" stroke="${id?col(id):'#7c3aed'}" stroke-width="2"${id&&REP[id]?.status==='run'?' class="tm-pulse"':''}/><text x="${x+w/2}" y="${y+22}" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${t}</text><text x="${x+w/2}" y="${y+41}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".75">${sub}</text></g>`;
  const ar=(x1,y1,x2,y2)=>`<path d="M${x1} ${y1} C ${(x1+x2)/2} ${y1}, ${(x1+x2)/2} ${y2}, ${x2} ${y2}" fill="none" stroke="#7c3aed" stroke-width="1.6" marker-end="url(#tmA)"/>`;
  const sys=REP._system; box.innerHTML=`<svg viewBox="0 0 860 300" style="width:100%;height:auto;color:var(--ink)" role="img" aria-label="Flow การทำงานของ AI แต่ละชุด">
  <defs><marker id="tmA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7c3aed"/></marker></defs>
  <text x="70" y="22" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">อินพุต</text><text x="285" y="22" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">ขั้น 1 · ทำพร้อมกัน</text><text x="535" y="22" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">ขั้น 2 · ทำพร้อมกัน</text><text x="770" y="22" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">ขั้น 3</text>
  ${node(10,118,120,null,'แบบ + โมเดล 3D','รูป / PDF / DXF')}
  ${node(190,50,190,'calc','🧮 คำนวณโครงสร้าง','ACI/AISC/AISI'+pc('calc'))}${node(190,190,190,'arch','🏛 วาดแบบสถาปัตย์','ผนัง/ประตู/ห้อง'+pc('arch'))}
  ${node(440,50,190,'sdraw','📐 เขียนแบบโครงสร้าง','AutoCAD Agent'+pc('sdraw'))}${node(440,190,190,'boq','💰 ทำ BOQ ปร.4','ปริมาณ + ราคา'+pc('boq'))}
  <g><rect x="690" y="118" width="160" height="54" rx="10" fill="${sys?(sys.overall==='OK'?'#16a34a22':sys.overall==='WARN'?'#d9770622':'#dc262622'):'#7c3aed22'}" stroke="${sys?(sys.overall==='OK'?'#16a34a':sys.overall==='WARN'?'#d97706':'#dc2626'):'#7c3aed'}" stroke-width="2"/><text x="770" y="140" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">🧠 รายงานระบบ</text><text x="770" y="159" text-anchor="middle" font-size="11" fill="currentColor" opacity=".75">${sys?esc(sys.overall):'AI รวมทุกชุด'}</text></g>
  ${ar(130,145,190,77)}${ar(130,145,190,217)}${ar(380,77,440,77)}${ar(380,77,440,217)}${ar(380,217,440,217)}${ar(630,77,690,145)}${ar(630,217,690,145)}
  <text x="410" y="290" text-anchor="middle" font-size="11" fill="currentColor" opacity=".65">ผลคำนวณ → แบบโครงสร้าง + BOQ · ผังสถาปัตย์ → BOQ · ปัญหาทุกชุด → บันทึกเข้า Skill ของชุดนั้น → AI พัฒนา Skill</text></svg>`; }
async function systemReport(ids){ const R=ids.map(id=>REP[id]).filter(Boolean); const S=AI.sampleFn; let sys=null;
  if(S){ try{ sys=await S.json(`You are the AI project director of "AI Structure 3D Builder". Merge these AI team reports into one system report for the engineer (Thai):\n${JSON.stringify(R.map(r=>({team:r.team,status:r.status,summary:r.summary,metrics:r.metrics,issues:r.issues.slice(0,25),outputs:r.outputs})))}\nFind cross-team problems (e.g. NG members already drawn or priced, missing architectural items in BOQ). Return ONLY JSON {"overall":"OK"|"WARN"|"NG","summary":"Thai paragraph","by_team":[{"team":"","status":"","comment":""}],"cross_issues":["Thai"],"next_actions":["Thai, ordered"]}`,{cache:false}); }catch(e){} }
  if(!sys||!sys.summary){ const bad=R.filter(r=>r.status==='err').length, wn=R.filter(r=>r.status==='warn').length; sys={overall:bad?'NG':wn?'WARN':'OK',summary:`ทำงาน ${R.length} ชุด: สำเร็จ ${R.length-bad-wn}, มีข้อควรแก้ ${wn}, ล้มเหลว ${bad} — ปัญหารวม ${R.reduce((a,r)=>a+r.issues.length,0)} ประเด็น`,by_team:R.map(r=>({team:r.team,status:r.status,comment:r.summary})),cross_issues:[],next_actions:R.flatMap(r=>r.issues.filter(i=>i.sev==='hi').map(i=>`[${r.team}] ${i.t}`)).slice(0,10)}; }
  sys.date=new Date().toLocaleString('th-TH'); sys.teams=ids; REP._system=sys; saveRep(); return sys; }
function sysHTML(sys,dark){ const c=dark?{t:'#e0fbff',h:'#67e8f9',k:'#fde047'}:{t:'#111',h:'#0e7490',k:'#b45309'}; const col={OK:'#22c55e',WARN:'#f59e0b',NG:'#ef4444',ok:'#22c55e',warn:'#f59e0b',err:'#ef4444',run:'#38bdf8'};
  return `<div style="padding:${dark?'34px 16px':'0'};overflow:auto;height:100%;color:${c.t};font-size:13px"><div style="font-size:18px;font-weight:800;color:${col[sys.overall]||c.h};text-shadow:${dark?'0 0 12px currentColor':'none'}">สถานะระบบ: ${esc(sys.overall)}</div><p>${esc(sys.summary)}</p>
   <h4 style="color:${c.h};margin:8px 0 4px">รายงานแต่ละชุด</h4>${(sys.by_team||[]).map(b=>`<div style="border-left:4px solid ${col[b.status]||c.h};padding:3px 8px;margin:4px 0"><b>${esc(b.team)}</b> — <span style="color:${col[b.status]||c.h}">${esc(b.status)}</span><br>${esc(b.comment||'')}</div>`).join('')}
   ${sys.cross_issues?.length?`<h4 style="color:${c.h};margin:8px 0 4px">ปัญหาข้ามชุด</h4><ul>${sys.cross_issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
   ${sys.next_actions?.length?`<h4 style="color:${c.h};margin:8px 0 4px">งานที่ต้องทำต่อ (เรียงลำดับ)</h4><ol>${sys.next_actions.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:''}<div style="opacity:.6;font-size:11px">${esc(sys.date||'')}</div></div>`; }
// ---------- AI Teams tab UI ----------
function paintReports(){ const box=$('#tmReports'); if(!box) return; const col={ok:'#16a34a',warn:'#d97706',err:'#dc2626',run:'#0284c7'}; const lab={ok:'สำเร็จ',warn:'มีข้อควรแก้',err:'ล้มเหลว',run:'กำลังทำ'};
  paintFlow(); box.innerHTML=(REP._system?`<div class="tm-sys"><div class="tm-h">🧠 รายงานระบบ (AI รวมทุกชุด)</div>${sysHTML(REP._system,false)}<button class="btn sm" type="button" id="tmSysDl">ดาวน์โหลดรายงานระบบ (.html)</button></div>`:'')+
   ORDER.filter(id=>REP[id]).map(id=>{ const r=REP[id]; const dur=r.end?((r.end-r.start)/1000).toFixed(1)+' s':'…'; return `<div class="tm-rep" style="border-left-color:${col[r.status]}"><div class="tm-h">${r.icon} ${esc(r.team)} <span class="tm-b" style="background:${col[r.status]}">${lab[r.status]} · ${r.pct}%</span><span style="opacity:.6;font-size:11.5px">${dur} · ${new Date(r.start).toLocaleString('th-TH')}</span></div>
     <div>${esc(r.summary||'')}</div>${Object.keys(r.metrics).length?`<div class="tm-met">${Object.entries(r.metrics).map(([k,v])=>`<span>${esc(k)}: <b>${esc(String(v))}</b></span>`).join('')}</div>`:''}
     ${r.issues.length?`<details><summary>ปัญหา ${r.issues.length} รายการ</summary><ul>${r.issues.map(i=>`<li class="sev-${i.sev}">${esc(i.t)}</li>`).join('')}</ul></details>`:''}${id==='calc'&&r.html?`<button class="btn sm" type="button" data-calcdl>ดาวน์โหลดรายงานคำนวณ (.html)</button> <button class="btn sm" type="button" data-calcfix>🛠 ส่งให้ AI แก้กลุ่ม NG</button>`:''}</div>`; }).join('');
  $('#tmSysDl')&&($('#tmSysDl').onclick=()=>saveText('AI3D_รายงานระบบ.html',`<!DOCTYPE html><html lang="th"><meta charset="utf-8"><title>รายงานระบบ AI</title><body style="font-family:Tahoma,sans-serif;max-width:900px;margin:20px auto">${sysHTML(REP._system,false)}${ORDER.filter(id=>REP[id]).map(id=>`<h3>${REP[id].icon} ${esc(REP[id].team)} — ${esc(REP[id].status)}</h3><p>${esc(REP[id].summary)}</p><ul>${REP[id].issues.map(i=>`<li>${esc(i.t)}</li>`).join('')}</ul>`).join('')}</body></html>`));
  box.querySelector('[data-calcdl]')&&(box.querySelector('[data-calcdl]').onclick=()=>saveText('AI3D_รายงานคำนวณ.html',`<!DOCTYPE html><html lang="th"><meta charset="utf-8"><body style="font-family:Tahoma,sans-serif;max-width:1000px;margin:20px auto">${REP.calc.html}</body></html>`));
  box.querySelector('[data-calcfix]')&&(box.querySelector('[data-calcfix]').onclick=()=>{ const ng=state.design.groups.filter(g=>!g.hidden&&g.status==='NG').map(g=>g.key); const t=`แก้กลุ่มที่ NG ให้ผ่านทั้งหมด (${ng.join(', ')||'ตามรายงาน AI'}) ตามข้อเสนอแนะ: ${(REP.calc.recs||[]).slice(0,4).join('; ')}`; document.querySelector('[data-tab="chat"]')?.click(); const ta=$('#chIn'); if(ta){ ta.value=t; ta.focus(); } }); }
(function mountTeams(){ const tab=$('#tab-agents'); if(!tab) return; const st=document.createElement('style'); st.textContent=`.tm-grid{display:grid;gap:10px}.tm-card{border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px;background:linear-gradient(135deg,#22d3ee0d,#a78bfa12)}.tm-card .tm-t{display:flex;gap:8px;align-items:center;font-weight:700}.tm-card .tm-t .sp{flex:1}
.tm-cc{border:1px solid #7c3aed88;border-radius:14px;padding:12px;background:linear-gradient(135deg,#0e7490,#7c3aed);color:#fff;display:flex;flex-direction:column;gap:8px;box-shadow:0 0 22px #7c3aed55}.tm-cc .btn{background:#fff;color:#4c1d95;border:0;font-weight:700}.tm-cc label{display:inline-flex;gap:4px;align-items:center;font-size:12.5px;margin-right:10px}
.tm-rep{border:1px solid var(--line);border-left:5px solid;border-radius:10px;padding:8px 10px;margin:6px 0;font-size:12.5px}.tm-h{font-weight:700;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tm-b{color:#fff;border-radius:999px;padding:0 8px;font-size:11.5px}.tm-met{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;font-size:12px}
.tm-pulse{animation:tmP 1s ease-in-out infinite}@keyframes tmP{50%{stroke-width:5;opacity:.6}}@media (prefers-reduced-motion:reduce){.tm-pulse{animation:none}}.tm-sys{border:2px solid #7c3aed;border-radius:12px;padding:10px;margin:6px 0}.sev-hi{color:var(--ng)}.sev-md{color:var(--warn)}`; document.head.appendChild(st);
  tab.innerHTML=`<div class="tm-cc"><div style="font-size:16px;font-weight:800">🛰 AI Command Center — สั่งทุกชุดทำงานเป็นระบบ</div><div style="font-size:12.5px;opacity:.9">AI แต่ละชุดทำงานแยกกันและรายงานของตัวเอง → AI หัวหน้าทีมรวมทุกรายงานเป็น "รายงานระบบ" (สถานะรวม, ปัญหาข้ามชุด, งานที่ต้องทำต่อ)</div>
    <div>${ORDER.map(id=>`<label><input type="checkbox" id="tmOn_${id}" checked> ${TEAMS[id].icon} ${TEAMS[id].name.replace('AI ชุด','')}</label>`).join('')}</div><div><button class="btn" id="tmAll" type="button">🚀 รัน AI ทุกชุด + รวมรายงานระบบ</button></div></div>
    <div class="tm-grid">${ORDER.map(id=>{ const T=TEAMS[id]; return `<div class="tm-card"><div class="tm-t">${T.icon} ${T.name}<span class="sp"></span><button class="btn pri sm" type="button" data-run="${id}">▶ รันชุดนี้</button></div><div class="status">${esc(T.desc)}</div>${id==='arch'?'<label class="f">สั่งเพิ่มเติม<input id="tmAsk_arch" type="text" placeholder="เช่น ผนังภายนอก 20 cm, ห้องน้ำทุกชั้น"></label>':''}<div data-sk="${id}"></div></div>`; }).join('')}</div>
    <div class="tm-h" style="margin-top:8px">🔀 Flow การทำงานของ AI แต่ละชุด</div><div id="tmFlow"></div>
    <div class="tm-h" style="margin-top:8px">📊 รายงานการทำงานของ AI แต่ละชุด</div><div id="tmReports"></div>`;
  ORDER.forEach(id=>{ const box=tab.querySelector(`[data-sk="${id}"]`); if(TEAMS[id].skill.paint!==undefined||TEAMS[id].skill.key) skillUI(TEAMS[id].skill,box); else box.innerHTML='<div class="status">ใช้ Skill เขียนแบบในแท็บ AutoCAD 2D (สอน/พัฒนา/ย้อนเวอร์ชันได้ที่นั่น)</div>'; });
  tab.querySelectorAll('[data-run]').forEach(b=>b.onclick=()=>runTeam(b.dataset.run)); $('#tmAll').onclick=runAll; paintReports(); })();

// ---------- v5.3 track EVERY AI call in the app (any command that uses AI shows on the AI CORE display) ----------
const AICALLS=new Map(); let aiCallN=0;
function aiLabel(p){ const s=String(p||''); const R=[[/calculation checker/i,'ตรวจรายการคำนวณ'],[/architectural drafter/i,'อ่านแบบสถาปัตย์'],[/BOQ checker/i,'ตรวจ BOQ'],[/project director/i,'รวมรายงานระบบ'],[/structural drafter/i,'วางแผนเขียนแบบโครงสร้าง'],[/maintain(s)? (the )?(embedded )?(AutoCAD )?.*skill|Improve the skill|Turn it into 1-3/i,'พัฒนา / สรุปบทเรียน Skill'],
    [/BOQ|ปร\.4|unit price|quantity take|ถอดปริมาณ|ราคา/i,'ถอดปริมาณ BOQ + ราคา'],[/verif|re-?check|round \d|ตรวจย้อน|compare.*model/i,'ตรวจย้อนกลับโมเดลกับแบบ'],[/edit|instruction|คำสั่ง|modify|change the model/i,'แก้ไขโมเดลตามคำสั่ง'],[/document|inspect|summar/i,'ตรวจ/สรุปเอกสารแบบ'],[/extract|drawing|grid|level|structural/i,'อ่านแบบ → สร้างโมเดล']];
  for(const [re,l] of R) if(re.test(s)) return l; return 'ประมวลผล'; }
function wrapSample(orig){ if(!orig||orig.__ai3dWrapped) return orig; const w={__ai3dWrapped:true,__orig:orig}; const names=new Set([...Object.getOwnPropertyNames(orig),...Object.getOwnPropertyNames(Object.getPrototypeOf(orig)||{})].filter(k=>k!=='constructor'));
  for(const k of names){ const v=orig[k]; if(typeof v!=='function'){ w[k]=v; continue; } if(/^(limits|cancel|abort)$/.test(k)){ w[k]=(...a)=>v.apply(orig,a); continue; }
    w[k]=(...args)=>{ const id=++aiCallN; const p0=typeof args[0]==='string'?args[0]:(()=>{ try{ return JSON.stringify(args[0]).slice(0,4000); }catch(e){ return ''; } })(); let o=args[1];
      const rec={id,kind:k,label:aiLabel(p0),t0:Date.now(),chunks:0,imgs:Array.isArray(o?.images)?o.images.length:0}; AICALLS.set(id,rec);
      if(o&&typeof o==='object'&&typeof o.onText==='function'){ const ot=o.onText; o={...o,onText:(...a)=>{ rec.chunks++; return ot(...a); }}; args[1]=o; }
      let r; try{ r=v.apply(orig,args); }catch(e){ AICALLS.delete(id); throw e; }
      return Promise.resolve(r).then(x=>{ AICALLS.delete(id); return x; },e=>{ AICALLS.delete(id); rec.err=true; TB.lastErr=Date.now(); throw e; }); }; }
  return w; }
setInterval(()=>{ try{ const s=AI.sampleFn; if(s&&!s.__ai3dWrapped) AI.sampleFn=wrapSample(s); }catch(e){} },400);
// ---------- AI working display: big centre-screen core + Matrix-style status (v5.1) ----------
const TB=(()=>{ const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st=document.createElement('style'); st.textContent=`.mx{position:fixed;left:50%;top:50%;z-index:97;width:min(560px,92vw);transform:translate(-50%,-50%) scale(.2);opacity:0;pointer-events:none;transition:transform .35s cubic-bezier(.2,1.5,.4,1),opacity .3s}
.mx.on{transform:translate(-50%,-50%) scale(1);opacity:1}.mx.out{transform:translate(-50%,-50%) scale(1.6);opacity:0;filter:blur(6px);transition:transform .5s ease-in,opacity .5s,filter .5s}
.mx-box{position:relative;border-radius:22px;overflow:hidden;background:#000000f2;border:1px solid #00ff6688;box-shadow:0 0 30px #00ff6655,0 0 90px #00ff6622,inset 0 0 40px #00ff6622}
.mx-box canvas{position:absolute;inset:0;width:100%;height:100%;opacity:.55}
.mx-in{position:relative;display:flex;flex-direction:column;align-items:center;padding:22px 20px 16px}
.mx-core{width:170px;height:170px;border-radius:50%;display:grid;place-items:center;position:relative;background:radial-gradient(circle,#003314 0%,#000 70%);box-shadow:0 0 40px #00ff66aa,inset 0 0 30px #00ff6655}
.mx-core::before{content:"";position:absolute;inset:-6px;border-radius:50%;background:conic-gradient(#00ff66 calc(var(--p)*1%),#003b18 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 0);mask:radial-gradient(farthest-side,transparent calc(100% - 7px),#000 0);filter:drop-shadow(0 0 8px #00ff66)}
.mx-core::after{content:"";position:absolute;inset:14px;border-radius:50%;border:1px dashed #00ff6688;animation:mxSpin 6s linear infinite}
.mx-pc{font:700 44px/1 "Consolas","Courier New",monospace;color:#b7ffcf;text-shadow:0 0 6px #00ff66,0 0 18px #00ff66,0 0 40px #00ff66;letter-spacing:2px;animation:mxFlick 2.4s infinite}
.mx-ai{position:absolute;bottom:34px;font:700 11px "Consolas",monospace;letter-spacing:5px;color:#00ff66;text-shadow:0 0 8px #00ff66}
.mx-ttl{margin-top:12px;font:700 13px "Consolas","Courier New",monospace;letter-spacing:4px;color:#00ff66;text-shadow:0 0 10px #00ff66}
.mx-lines{width:100%;margin-top:10px;font:13px/1.55 "Consolas","Courier New",monospace;color:#7dffa8;text-shadow:0 0 6px #00ff66;min-height:40px}
.mx-ln{display:flex;gap:8px;white-space:nowrap;overflow:hidden}.mx-ln .t{flex:1;overflow:hidden;text-overflow:ellipsis}.mx-ln .b{color:#00ff66;letter-spacing:-1px}.mx-ln .c{animation:mxBlink .8s steps(1) infinite}
.mx.done .mx-pc{color:#fff;font-size:34px}.mx.err .mx-box{border-color:#ff3355;box-shadow:0 0 40px #ff335588}.mx.err .mx-pc{color:#ffb3c0;text-shadow:0 0 18px #ff3355}
@keyframes mxSpin{to{transform:rotate(360deg)}}@keyframes mxBlink{50%{opacity:0}}@keyframes mxFlick{0%,92%,100%{opacity:1}93%{opacity:.35}95%{opacity:1}97%{opacity:.6}}
.mx.mini{left:auto!important;top:auto!important;right:14px;bottom:14px;transform:none!important;width:min(320px,80vw);z-index:100;transition:opacity .3s}.mx.mini.on{opacity:.88}.mx.mini.out{opacity:0;filter:none}
.mx.mini .mx-box{background:#000c;border:0;box-shadow:0 0 18px #00ff6633;border-radius:14px}.mx.mini .mx-box canvas{opacity:.22}
.mx.mini .mx-in{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 12px}.mx.mini .mx-core{width:58px;height:58px;box-shadow:none;background:transparent}.mx.mini .mx-core::before{inset:-3px}.mx.mini .mx-core::after{inset:8px}
.mx.mini .mx-pc{font-size:16px;letter-spacing:0}.mx.mini .mx-ai{display:none}.mx.mini .mx-ttl{margin:0;flex:1;font-size:10px;letter-spacing:2px}.mx.mini .mx-lines{margin:0;font-size:10.5px;flex-basis:100%}.mx.mini .mx-ln:nth-child(n+3){display:none}.mx.mini .mx-ln .b{display:none}
.mx.emb{transform:none!important;width:auto;mix-blend-mode:screen;transition:opacity .4s}.mx.emb.on{opacity:.62}.mx.emb.out{opacity:0;filter:none}
.mx.emb .mx-box{height:100%;background:transparent;border:0;box-shadow:none;border-radius:0}.mx.emb .mx-box canvas{opacity:.28}
.mx.emb .mx-in{height:100%;align-items:flex-end;justify-content:flex-start;padding:28px 34px 34px}.mx.emb .mx-core{width:96px;height:96px;background:transparent;box-shadow:none;opacity:.7}
.mx.emb .mx-pc{font-size:24px}.mx.emb .mx-ai{bottom:16px;font-size:8px;letter-spacing:3px}.mx.emb .mx-ttl{font-size:10.5px;opacity:.7;margin-top:6px}.mx.emb .mx-lines{font-size:11.5px;opacity:.8;margin-top:auto}
@media (prefers-reduced-motion:reduce){.mx,.mx *{animation:none!important;transition:none!important}}`; document.head.appendChild(st);
  const el=document.createElement('div'); el.className='mx'; el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
  el.innerHTML=`<div class="mx-box"><canvas aria-hidden="true"></canvas><div class="mx-in"><div class="mx-core" style="--p:0"><span class="mx-pc">0%</span><span class="mx-ai">AI CORE</span></div><div class="mx-ttl">&gt; SYSTEM PROCESSING_</div><div class="mx-lines"></div></div></div>`; document.body.appendChild(el);
  const cv=el.querySelector('canvas'), g=cv.getContext('2d'); const CH='アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFกขคงจฉชซญฎดตถทนบปผพฟมยรลวศสหอฮ'; let drops=[], raf=0;
  function rain(){ const w=cv.width=cv.clientWidth, h=cv.height=cv.clientHeight, fs=14, cols=Math.ceil(w/fs); if(drops.length!==cols) drops=Array.from({length:cols},()=>Math.random()*-40);
    g.fillStyle='rgba(0,0,0,0.12)'; g.fillRect(0,0,w,h); g.font=fs+'px monospace';
    for(let i=0;i<cols;i++){ const y=drops[i]*fs; g.fillStyle=Math.random()<.06?'#e6ffee':'#00ff66'; g.fillText(CH[Math.floor(Math.random()*CH.length)],i*fs,y); if(y>h&&Math.random()>.975) drops[i]=0; drops[i]+=0.55; }
    if(el.classList.contains('on')&&!RM()) raf=setTimeout(()=>requestAnimationFrame(rain),45); }
  const typed=new Map(); // key -> {full, n}
  const txt=q=>(document.querySelector(q)?.textContent||'').trim();
  function sources(){ const out=[]; const put=(key,label,pct,msg)=>out.push({key,label,pct,msg});
    const ps=txt('#pgState'), pp=parseInt(txt('#pgPct'))||0, pm=document.getElementById('progModal'); if(ps&&!/^(พร้อม|เสร็จสมบูรณ์|หยุด \/ ผิดพลาด|กำลังเตรียม)$/.test(ps)&&((pp>0&&pp<100)||pm?.classList.contains('on'))) put('gen','AUTO_GEN',pp,ps);
    const cs=txt('#chSend'); if(cs==='หยุด'||cs==='รอยืนยัน…') put('chat','AI_EDIT',null,txt('#chStatus')||(cs==='หยุด'?'AI กำลังแก้โมเดล':'รอยืนยันการแก้ไข'));
    if(txt('#qAI')==='หยุด') put('qai','BOQ_AI',null,txt('#qStatus')||'AI กำลังถอด BOQ + ราคา');
    const LB={calc:'CALC',sdraw:'S_DRAW',arch:'A_DRAW',boq:'BOQ'};
    for(const id of Object.keys(LB)){ const r=REP[id]; if(r&&r.status==='run'){ const cur=r.sub.find(x=>x.s==='run'); put(id,LB[id],r.pct,`${cur?cur.n:'กำลังทำงาน'}${cur?.d?' :: '+String(cur.d).slice(0,60):''}`); } }
    if(TB.cc){ const ids=TB.cc; const p=Math.round(ids.reduce((a,id)=>a+(REP[id]?.pct||0),0)/Math.max(1,ids.length)); put('cc','COMMAND_CENTER',p,TB.ccMsg||'ทีม AI ทำงานพร้อมกัน'); }
    if(AM.busy) put('am','AGENT',null,AM.busy);
    for(const r of AICALLS.values()){ const sec=((Date.now()-r.t0)/1000).toFixed(0); put('call'+r.id,'AI_CALL#'+r.id,null,`${r.label} · ${sec}s${r.imgs?' · ภาพ '+r.imgs:''}${r.chunks?' · รับข้อมูล '+r.chunks:' · รอคำตอบ'}`); }
    return out; }
  let showing=false, lastFail=false, hideT=0;
  const bar=p=>p==null?'[ ~~~~~~~~ ]':'['+'█'.repeat(Math.round(p/10))+'░'.repeat(10-Math.round(p/10))+']';
  function host(){ const h=document.querySelector('#progModal.on #holo'); if(!h) return null; const r=h.getBoundingClientRect(); return r.width>40&&r.height>40?r:null; }
  // any other window open (report, review, edit preview, settings, start, docs, help, Agent Mode, file modal…) -> shrink to a small see-through corner panel
  function winOpen(){ return [...document.querySelectorAll('.hud.on,#modal.on,.am.on,[role=dialog].on,dialog[open]')].some(w=>w.id!=='progModal'&&w!==el&&!el.contains(w)&&w.getClientRects().length>0&&getComputedStyle(w).visibility!=='hidden'); }
  function dock(){ const r=host(); if(r){ el.classList.remove('mini'); el.classList.add('emb'); Object.assign(el.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'}); return; }
    if(el.classList.contains('emb')){ el.classList.remove('emb'); el.style.cssText=''; }
    el.classList.toggle('mini',winOpen()); }
  function tick(){ dock(); const S=sources();
    if(S.length){ clearTimeout(hideT); el.classList.remove('out','done','err'); if(!showing){ showing=true; el.classList.add('on'); typed.clear(); cancelAnimationFrame(raf); clearTimeout(raf); if(!RM()) rain(); }
      const ps=S.filter(s=>s.pct!=null); const tot=S.find(s=>s.key==='cc')?.pct ?? (ps.length?Math.round(ps.reduce((a,s)=>a+s.pct,0)/ps.length):null);
      el.querySelector('.mx-core').style.setProperty('--p',tot??((Date.now()/40)%100)); el.querySelector('.mx-pc').textContent=tot!=null?tot+'%':'···';
      el.querySelector('.mx-ttl').textContent=`> ${S.length>1?S.length+' AI PROCESSES':'AI PROCESS'} RUNNING_`;
      el.querySelector('.mx-lines').innerHTML=S.slice(0,7).map(s=>{ const full=`${s.label} :: ${s.msg}`; let t=typed.get(s.key); if(!t){ t={n:0}; typed.set(s.key,t); } t.n=RM()?full.length:Math.min(full.length,t.n+4);
        return `<div class="mx-ln"><span>&gt;</span><span class="t">${esc(full.slice(0,t.n))}${t.n<full.length?'<span class="c">█</span>':''}</span><span class="b">${bar(s.pct)}</span><span>${s.pct!=null?String(s.pct).padStart(3)+'%':'RUN'}</span></div>`; }).join('');
      el.setAttribute('aria-label','AI กำลังทำงาน '+S.map(s=>`${s.label} ${s.pct??''} ${s.msg}`).join('; '));
      lastFail=Object.values(REP).some(r=>r&&r.status==='err'&&Date.now()-(r.end||0)<4000)||(Date.now()-(TB.lastErr||0)<4000); }
    else if(showing){ showing=false; const fail=lastFail||(Date.now()-(TB.lastErr||0)<2000)||Object.values(REP).some(r=>r&&r.status==='err'&&Date.now()-(r.end||0)<4000);
      el.classList.add(fail?'err':'done'); el.querySelector('.mx-core').style.setProperty('--p',100); el.querySelector('.mx-pc').textContent=fail?'ERROR':'COMPLETE';
      el.querySelector('.mx-ttl').textContent=fail?'> PROCESS TERMINATED WITH ERRORS_':'> ALL AI PROCESSES COMPLETE_';
      hideT=setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>{ el.classList.remove('on','out','done','err'); cancelAnimationFrame(raf); clearTimeout(raf); },520); },650); } }
  setInterval(tick,250);
  return {cc:null,ccDone:false,ccMsg:''}; })();

// ---------- v5.5 click burst on EVERY button: soft sci-fi holographic shards (replaces the v5.2 AUTO GEN hover burst) ----------
(function clickFx(){ const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st=document.createElement('style'); st.textContent=`.mgx{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483000;will-change:transform,opacity,filter}
.mgx-ring{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483000;border-radius:50%;border:1.5px solid #93c5fd;box-shadow:0 0 10px #a5b4fccc,inset 0 0 8px #e9d5ffaa}`; document.head.appendChild(st);
  const COL=['#e0f7ff','#bae6fd','#c7d2fe','#e9d5ff','#f5f3ff','#a5f3fc','#ccfbf1'];
  function burst(b,ev){ if(RM()) return; const r=b.getBoundingClientRect(); const ox=ev&&ev.clientX?ev.clientX:r.left+r.width/2, oy=ev&&ev.clientY?ev.clientY:r.top+r.height/2;
    const ring=document.createElement('i'); ring.className='mgx-ring'; document.body.appendChild(ring);
    ring.animate([{transform:`translate(${ox-6}px,${oy-6}px) scale(1)`,width:'12px',height:'12px',opacity:.9},{transform:`translate(${ox-6}px,${oy-6}px) scale(9)`,width:'12px',height:'12px',opacity:0}],{duration:750,easing:'ease-out'}).onfinish=()=>ring.remove();
    const n=22; for(let i=0;i<n;i++){ const p=document.createElement('i'); p.className='mgx'; const c=COL[i%COL.length]; const kind=i%3;
      const w=kind===0?2:(kind===1?4+Math.random()*4:6), h=kind===0?12+Math.random()*14:(kind===1?4+Math.random()*4:6);
      p.style.cssText=`width:${w}px;height:${h}px;background:${c};opacity:.9;box-shadow:0 0 0 1px #7dd3fcaa,0 0 6px ${c},0 0 12px #a5b4fccc;${kind===2?'clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);':''}border-radius:${kind===1?'1px':'0'}`;
      document.body.appendChild(p); const ang=(i/n)*Math.PI*2+(Math.random()-.5)*.5, d=50+Math.random()*90, rot=ang*180/Math.PI+90+(Math.random()-.5)*60;
      const ex=ox+Math.cos(ang)*d, ey=oy+Math.sin(ang)*d-8, r2=rot+(Math.random()-.5)*180;
      p.animate([{transform:`translate(${ox}px,${oy}px) rotate(${rot}deg) scale(.6)`,opacity:0,filter:'blur(0)',easing:'cubic-bezier(.2,.8,.3,1)'},
        {transform:`translate(${ox+Math.cos(ang)*d*.55}px,${oy+Math.sin(ang)*d*.55}px) rotate(${rot}deg) scale(1.05)`,opacity:1,filter:'blur(0)',offset:.3,easing:'ease-out'},
        {transform:`translate(${ox+Math.cos(ang)*d*.85}px,${oy+Math.sin(ang)*d*.85-4}px) rotate(${(rot+r2)/2}deg) scale(.8)`,opacity:.85,filter:'blur(.5px)',offset:.65,easing:'ease-in'},
        {transform:`translate(${ex}px,${ey}px) rotate(${r2}deg) scale(.3)`,opacity:0,filter:'blur(3px)'}],{duration:850+Math.random()*450,easing:'linear'}).onfinish=()=>p.remove(); } }
  document.addEventListener('pointerdown',e=>{ const b=e.target.closest?.('button'); if(b&&!b.disabled) burst(b,e); },true);
  document.addEventListener('click',e=>{ if(e.detail!==0) return; const b=e.target.closest?.('button'); if(b&&!b.disabled) burst(b,null); },true); })();

// ---------- v5.3 every command button: hover -> colour shift, blink, lift up, stand out, text pops ----------
(function btnFx(){ const st=document.createElement('style'); const B='button:not(:disabled):not(.am-orb):not(.mx button)';
  st.textContent=`button{transition:translate .22s cubic-bezier(.2,1.6,.4,1),scale .22s cubic-bezier(.2,1.6,.4,1),box-shadow .2s,background .2s,color .2s,border-color .2s}
${B}:hover,${B}:focus-visible{translate:0 -4px;scale:1.06;position:relative;z-index:4;color:#fff!important;border-color:#c4b5fd!important;
  background:linear-gradient(135deg,#0891b2,#7c3aed 55%,#db2777)!important;background-size:200% 200%!important;
  box-shadow:0 8px 18px #7c3aed66,0 0 0 2px #a78bfa88,0 0 22px #22d3ee88!important;text-shadow:0 0 6px #fff,0 0 14px #67e8f9;font-weight:700;letter-spacing:.3px;
  animation:btnHue 1.6s linear infinite,btnBlink .9s steps(2) infinite}
${B}:active{translate:0 -1px;scale:.98}
@keyframes btnHue{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes btnBlink{0%{filter:brightness(1.05)}50%{filter:brightness(1.35) saturate(1.3)}}
@media (prefers-reduced-motion:reduce){${B}:hover,${B}:focus-visible{animation:none;translate:none;scale:none}}`;
  document.head.appendChild(st); })();

// ---------- v5.7+ full user manual embedded in Help (manual/manual.html + PDF) ----------
(function manualHelp(){ const VER='5.8', URL='manual/manual.html', PDF=`manual/AI3D_Manual_v${VER}.pdf`;
  const st=document.createElement('style'); st.textContent=`#manModal{position:fixed;inset:0;z-index:98;display:none;place-items:center;padding:14px;background:#02050cd9;backdrop-filter:blur(3px)}
#manModal.on{display:grid}#manModal .mp{width:min(1100px,100%);height:min(92vh,1000px);display:flex;flex-direction:column;background:#0b1220;border:1px solid #38bdf8aa;border-radius:14px;overflow:hidden;box-shadow:0 0 40px #22d3ee44}
#manModal .mh{display:flex;gap:8px;align-items:center;padding:8px 12px;color:#e0f2fe;border-bottom:1px solid #1e3a8a}#manModal .mh b{flex:1;font-size:14px}
#manModal .mh a,#manModal .mh button{font:inherit;font-size:12.5px;padding:6px 12px;border-radius:8px;border:1px solid #38bdf8;background:#0e7490;color:#fff;text-decoration:none;cursor:pointer}
#manModal iframe{flex:1;border:0;background:#fff;width:100%}`; document.head.appendChild(st);
  const m=document.createElement('div'); m.id='manModal'; m.setAttribute('role','dialog'); m.setAttribute('aria-label','คู่มือการใช้งาน');
  m.innerHTML=`<div class="mp"><div class="mh"><b>📘 คู่มือการใช้งาน AI Structure 3D Builder v${VER}</b><a href="${PDF}" download="AI3D_Manual_v${VER}.pdf" target="_blank" rel="noopener">⬇ ดาวน์โหลด PDF</a><a href="${URL}" target="_blank" rel="noopener">↗ เปิดแท็บใหม่</a><button type="button" id="manClose">ปิด</button></div><iframe title="คู่มือการใช้งาน" loading="lazy"></iframe></div>`;
  document.body.appendChild(m); const fr=m.querySelector('iframe');
  const open=()=>{ if(!fr.src) fr.src=URL; m.classList.add('on'); }, close=()=>m.classList.remove('on');
  m.querySelector('#manClose').onclick=close; m.addEventListener('click',e=>{ if(e.target===m) close(); }); document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&m.classList.contains('on')) close(); });
  const hd=document.querySelector('#helpModal .hud-hd'), hc=document.getElementById('helpClose');
  if(hd&&hc){ const b=document.createElement('button'); b.type='button'; b.className='hbtn'; b.id='helpManual'; b.textContent='📘 คู่มือฉบับเต็ม (รูป + ลำดับงาน + PDF)'; b.onclick=open; hd.insertBefore(b,hc); }
  const body=document.querySelector('#helpModal .help-body');
  if(body){ const d=document.createElement('div'); d.style.cssText='margin:0 0 10px;padding:10px 12px;border:1px solid #38bdf8;border-radius:10px;background:#0e749022';
    d.innerHTML=`<b>📘 คู่มือฉบับเต็ม v${VER}</b> — ลำดับการใช้งานแบบลูกศร รูปหน้าจอพร้อมหมายเลขปุ่ม ทุกคำสั่งใช้ทำอะไร และ AI แต่ละชุด · <a href="#" id="helpManual2">เปิดคู่มือ</a> · <a href="${PDF}" download="AI3D_Manual_v${VER}.pdf" target="_blank" rel="noopener">ดาวน์โหลด PDF</a>`;
    body.insertBefore(d,body.firstChild); d.querySelector('#helpManual2').onclick=e=>{ e.preventDefault(); open(); }; }
  window.__ai3dManual=open; })();

})();
