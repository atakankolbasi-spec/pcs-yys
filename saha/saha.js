/* PCS TRANSİT YYS · Canlı saha (3B). Tek başına: örnek verili tanıtım. saha.html?gomulu: panonun içinde gerçek kayıtlarla. */
(()=>{
/* =====================================================================================
   VERİ KATMANI
   Sahne ve liste yalnızca `kaynak` nesnesini okur. Kayıt biçimi panonun visits tablosuyla aynıdır:
   { id, plate, registration, customer, declaration, carrier, visit_date, visit_time, created_at,
     onsite, onsite_at, t1, t1_at, done, done_at, out_at }
   --- Supabase bağlantısı buraya ---
   Gerçek panoya bağlarken ornekKaynak() yerine aynı arayüzü (simdi(), liste(), adim(dt)) sağlayan bir
   supabaseKaynak() yazılır: panonun oturumuyla visits tablosundan bugünün kayıtları okunur ve Realtime
   (postgres_changes) ile güncel tutulur. t1/done saatleri tabloda yoksa değişikliğin görüldüğü an kullanılır.
   Bu sayfada anahtar ya da adres YOKTUR.
   ===================================================================================== */
const GOMULU=(()=>{try{return new URLSearchParams(location.search).has('gomulu');}catch(e){return false;}})();
if(GOMULU)document.documentElement.classList.add('gomulu');
let TODAY='2026-10-28',GUN0=Date.UTC(2026,9,28)-3*3600000; // İstanbul gece yarısı (UTC+3)
const CUSTOMERS={'BULTRANS':'#3b82f6','TORNADO':'#f97316','LİN LOJ':'#ec4899','PLASTNAK':'#14b8a6','ETL LOJ':'#8b5cf6','ATEŞER':'#eab308'};
function ornekKaynak(){
  // [plaka, müşteri, beyanname, nakliyeci, ruhsat, randevu, varış(dk), tesis(dk), t1(dk), bitti(dk), çıkış(dk)]
  const P=[
    ['X 4999 MB / X 5167 EM','BULTRANS','ELMA İSTANBUL','KAAN LOJ.','15 400 KG','07:00', 395, 402, 700, 800, 812],
    ['CB 1234 AB / CB 5678 CD','LİN LOJ','DGS','NURHAN','14 700 KG','07:10', 432, 441, 520, 590, 604],
    ['34 ERH 715 / 34 ERF 438','LİN LOJ','BERG METAL','KAAN LOJ.','16 800 KG','07:30', 452, 460, 548, 640, 651],
    ['PA 1010 MB / PA 5467 EM','ETL LOJ','PARSİYEL','EKOL','15 950 KG','08:00', 478, 489, 600, 700, 714],
    ['H 2854 BX / C 0540 EC','TORNADO','ELMA İSTANBUL','NURHAN','14 900 KG','08:20', 500, 508, 610, 785, 797],
    ['X 7608 MA / X 1443 EM','BULTRANS','DGS','KAAN LOJ.','15 200 KG','08:45', 522, 531, 655, 775, 788],
    ['A 2184 HK / A 1323 EM','PLASTNAK','PARSİYEL','EKOL','16 100 KG','09:15', 552, 560, 650, 735, 748],
    ['34 KL 4567 / 34 KL 890','ATEŞER','BERG METAL','NURHAN','15 700 KG','09:40', 576, 583, 665, 800, 812],
    ['X 1215 KK / X 0250 EK','BULTRANS','ELMA İSTANBUL','KAAN LOJ.','15 050 KG','10:15', 612, 620, 705, 790, 803],
    ['DB 16 LKW / DB 17 CTD','TORNADO','DGS','EKOL','14 300 KG','10:50', 646, 655, 760, 840, 852],
    ['E 4076 HB / E 9893 EE','ETL LOJ','PARSİYEL','NURHAN','16 400 KG','11:20', 676, 686, 790, 860, 872],
    ['CT 04 LLA / CT 05 LLA','PLASTNAK','BERG METAL','KAAN LOJ.','15 600 KG','11:45', 702, 712, 800, 875, 886],
    ['41 TR 222 / 41 TR 333','ATEŞER','ELMA İSTANBUL','EKOL','15 800 KG','12:30', 748, 757, 850, 920, 932],
    ['B 123 XYZ / B 456 XYZ','LİN LOJ','DGS','NURHAN','14 650 KG','13:10', 788, 796, 880, 950, 962]
  ];
  const iso=m=>{const d=new Date(Date.UTC(2026,9,28,0,0)+ (m-180)*60000);return d.toISOString();}; // İstanbul = UTC+3
  const plan=P.map((p,i)=>({id:'v'+(i+1),plate:p[0],customer:p[1],declaration:p[2],carrier:p[3],registration:p[4],visit_date:TODAY,visit_time:p[5],
    created_at:iso(360),_varis:p[6],_tesis:p[7],_t1:p[8],_bitti:p[9],_cikis:p[10]}));
  let sim=12*60+50, ekstra=0, sonraki=12*60+58;
  const R=()=>Math.random(),ara=(a,b)=>a+R()*(b-a);
  function yeni(s,uzun){ // kapıya gelen yeni araç; süreler gerçekçi: tartı+evrak ~1-1,5 sa, T1 ~1-1,5 sa, çıkış ~10 dk
    const L='ABCEHKMPTX',r=()=>L[Math.floor(R()*L.length)],n=()=>String(1000+Math.floor(R()*9000));
    const cs=Object.keys(CUSTOMERS),c=cs[Math.floor(R()*cs.length)];s=Math.ceil(s);
    const t1=s+6+(uzun?ara(250,300):ara(55,95)),bt=t1+(uzun?ara(90,120):ara(55,90)),ck=bt+ara(9,15);
    plan.push({id:'x'+(++ekstra),plate:`X ${n()} ${r()}${r()} / X ${n()} ${r()}${r()}`,customer:c,declaration:['ELMA İSTANBUL','DGS','BERG METAL','PARSİYEL'][ekstra%4],carrier:['KAAN LOJ.','EKOL','NURHAN'][ekstra%3],registration:`${14+Math.floor(R()*3)} ${Math.floor(R()*10)}00 KG`,
      visit_date:TODAY,visit_time:hhmm(s),created_at:iso(s),_varis:s+1,_tesis:s+6,_t1:Math.round(t1),_bitti:Math.round(bt),_cikis:Math.round(ck)});}
  const durum=v=>({...v,arriving:sim>=v._varis-14&&sim<v._tesis,onsite:sim>=v._tesis,onsite_at:sim>=v._tesis?iso(v._tesis):null,
    t1:v._t1!=null&&sim>=v._t1,t1_at:v._t1!=null&&sim>=v._t1?iso(v._t1):null,done:v._bitti!=null&&sim>=v._bitti,done_at:v._bitti!=null&&sim>=v._bitti?iso(v._bitti):null,
    out_at:v._cikis!=null&&sim>=v._cikis?iso(v._cikis):null});
  return {
    simdi:()=>sim,
    liste:()=>plan.map(durum),
    adim(dk){sim+=dk;
      // gün içinde (06:30–19:00) 25–45 dakikada bir yeni araç; nadiren uzun bekleyen
      while(sim>=sonraki){if(sonraki>=6.5*60&&sonraki<=19*60)yeni(sonraki,sonraki<12*60&&R()<.1);sonraki+=ara(25,45);}
      // 22:00'den sonra saha boşalınca ertesi sabaha geç
      if(sim>=22*60&&plan.every(v=>v._cikis!=null&&v._cikis<=sim)){sim-=15.5*60;plan.length=0;sonraki=sim+5;}},
    cagir(){yeni(sim,false);} // örnek: hemen kapıya gelen yeni araç
  };
}
/* Pano içinde (saha.html?gomulu): kayıtlar panodan postMessage ile gelir; saat gerçek saattir.
   Panonun gönderdiği biçim: {tip:'pcs-saha', ziyaretler:[visits satırı...], renkler:{müşteri:renk}, secili:id} */
function disKaynak(){let liste=[];
  const bugun=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const [y,m,d]=p.split('-').map(Number);TODAY=p;GUN0=Date.UTC(y,m-1,d)-3*3600000;};
  bugun();
  return {simdi:()=>(Date.now()-GUN0)/60000,liste:()=>liste,adim(){},cagir(){},
    yukle(z){bugun();const simdi=Date.now();
      liste=z.map(v=>{const geldi=!!v.onsite||!!v.done;const ziyaret=v.visit_time?GUN0+((+v.visit_time.slice(0,2))*60+(+v.visit_time.slice(3,5)))*60000:null;
        const on=v.onsite_at||(geldi?(v.created_at||null):null);
        return {...v,onsite:geldi,onsite_at:on,t1:!!v.t1||!!v.done,t1_at:v.t1_at||null,done:!!v.done,done_at:v.done_at||null,
          out_at:v.done?(v.done_at||new Date(simdi).toISOString()):null,
          arriving:!geldi&&v.visit_date===TODAY&&ziyaret!=null&&Math.abs(simdi-ziyaret)<75*60000};});}};}
const kaynak=GOMULU?disKaynak():ornekKaynak();
if(!GOMULU)try{const q=new URLSearchParams(location.search).get('saat');if(q)kaynak.adim(parseFloat(q)*60-kaynak.simdi());}catch(e){}

/* ---------- yardımcılar ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function hhmm(m){m=Math.floor(m);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(((m%60)+60)%60).padStart(2,'0');}
const isoMin=s=>{if(!s)return null;const t=new Date(s).getTime();return isNaN(t)?null:(t-GUN0)/60000;}; // bugünün 00:00'ından beri dakika (önceki günler eksi)
function sure(dk){dk=Math.max(0,Math.floor(dk));const h=Math.floor(dk/60),m=dk%60;return h?`${h} sa ${String(m).padStart(2,'0')} dk`:`${m} dk`;}
function sureKisa(dk){dk=Math.max(0,Math.floor(dk));const h=Math.floor(dk/60),m=dk%60;return h?`${h}s ${String(m).padStart(2,'0')}d`:`${m} dk`;}
const UZUN=6*60;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function ulke(p){const t=String(p||'').trim().toUpperCase();
  if(/^\d/.test(t))return 'TR';if(/^(B|CT|AG|CJ|IS|TM)\s/.test(t))return 'RO';if(/^(X|CB|PA|H|CA|E|A|C|DB|EH|BP|PB|K|M|PK|CO|CT)\s/.test(t))return 'BG';return '?';}
const STARS='<svg viewBox="0 0 20 20" fill="#ffd400">'+Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2;return `<circle cx="${(10+Math.cos(a)*6.4).toFixed(1)}" cy="${(10+Math.sin(a)*6.4).toFixed(1)}" r="1.25"/>`;}).join('')+'</svg>';
function plateHTML(p,lg){const [a,b]=String(p).split('/').map(s=>s.trim());const c=ulke(a);
  return `<span class="lp${lg?' lg':''}${c==='?'?' unk':''}" title="${c==='TR'?'Türkiye':c==='BG'?'Bulgaristan':c==='RO'?'Romanya':'Ülke tanınamadı'}"><span class="lp-band">${c!=='?'?STARS:''}<b>${c}</b></span><span class="lp-num">${esc(a)}${b?`<i class="lp-sep"></i>${esc(b)}`:''}</span></span>`;}
const ICON={
  on:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>',
  t1:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 14l3 3 5-6"/></svg>',
  dn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>'};
const tok=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function durumKodu(v,sim){if(v.out_at)return 'out';if(v.done)return 'done';if(v.t1)return 't1';if(v.onsite)return 'on';return 'wait';}
function kalis(v,sim){const a=isoMin(v.onsite_at);if(a==null)return 0;return (v.out_at?isoMin(v.out_at):sim)-a;}
const uzunMu=(v,sim)=>v.onsite&&!v.done&&!v.out_at&&kalis(v,sim)>=UZUN;

/* =========================== SAHA PLANI ===========================
   Yerleşim tesisin uydu görüntüsü ve fotoğraflarına göre (kuzey yukarı). 1 plan birimi = 10 cm; PM(mx,mz) saha betonunun
   kuzeybatı köşesinden metre cinsinden konumu plan koordinatına çevirir. Saha 62,7 × 53,5 m.
   - Batı: boydan boya antrepo (kepenkli kapılar) ve önünde servis şeridi; batı kenarında doğu–batı yönlü 6 park yeri
     (burun binaya, arka sahaya). Kuzeybatı köşede bekleme salonu, kuzey duvarı önünde kısa konteyner ve beton bloklar.
   - Kuzey duvarı: duvara dik kantar (ön tarafı duvara dayalı), yanında bekleyen dorse; doğusunda 8 park yeri (arkalar duvara).
   - Güneydoğu: 6 park yeri (arkalar güney duvarına). Güney kenarı: kapı, bariyerler, güvenlik kulübesi; aşağıda rampa,
     çıkış yolu, ofisler ve otopark; en güneyde ana yol.
   Akış: ana yol → kapı → kantara ileri çıkış, tartı → geri geri inip park yerine; çıkış doğu şeridinden ana yola. */
const W=900,H=840,OX=140,OY=40,PM=(mx,mz)=>[OX+mx*10,OY+mz*10];
const GATE_Y=OY+460;                      // kapı hattı (mz 46)
const KANTAR_X=OX+197.5,KANTAR_Y=OY+94;   // kantar ekseni ve tartı noktası (mx 19,75, mz 9,4)
const OUTX=OX+238;                        // çıkış şeridi (mx 23,8)
const ROAD=OY+700;                        // ana yolun kuzey şeridi (mz 70)
const GATEX=KANTAR_X,EXITX=OUTX;
const SLOTS=[];
[22.6,26.4,30.2,34,37.8,41.6].forEach(mz=>{const [x,y]=PM(9.1,mz);SLOTS.push({x,y,kol:'B',ang:Math.PI,r:[.3,mz-1.9,18.3,mz+1.9]});});
[27,30.8,34.6,38.4,42.2,46,49.8,53.6].forEach(mx=>{const [x,y]=PM(mx,9.1);SLOTS.push({x,y,kol:'K',ang:Math.PI/2,r:[mx-1.9,.3,mx+1.9,18.3]});});
[36.5,40.3,44.1,47.9,51.7,55.5].forEach(mx=>{const [x,y]=PM(mx,44.4);SLOTS.push({x,y,kol:'G',ang:-Math.PI/2,r:[mx-1.9,35.3,mx+1.9,53.3]});});
SLOTS.forEach((s,i)=>{s.no=i+1;s.v=null;});
const DOORS=[4,12,20,28,36,44].map((mz,i)=>({mz,y:OY+mz*10,label:'K'+(i+1)}));
const cv=$('scene'),ctx=cv.getContext('2d');let S=1,dpr=1;
function resize(){dpr=Math.min(2,devicePixelRatio||1);const box=cv.parentElement;let w=box.clientWidth;if(document.body.classList.contains('tv')&&box.clientHeight>50)w=Math.min(w,box.clientHeight*W/H);cv.style.width=w+'px';S=w/W;cv.style.height=Math.round(H*S)+'px';cv.width=Math.round(w*dpr);cv.height=Math.round(H*S*dpr);}
addEventListener('resize',()=>{resize();draw();});
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function label(t,x,y,size,color,align='center',weight=800,spacing=1.6){ctx.save();ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Plus Jakarta Sans",system-ui,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';
  if('letterSpacing' in ctx)ctx.letterSpacing=spacing+'px';ctx.fillText(t,x,y);ctx.restore();}
function arrow(x,y,ang,col){ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.strokeStyle=col;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(7,0);ctx.moveTo(2,-5);ctx.lineTo(7,0);ctx.lineTo(2,5);ctx.stroke();ctx.restore();}
const RC=(a,b,c,d)=>{const [x0,y0]=PM(a,b),[x1,y1]=PM(c,d);return [x0,y0,x1-x0,y1-y0];};
function blok(a,b,c,d,fill,stroke,r=3){const [x,y,w,h]=RC(a,b,c,d);rr(ctx,x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}return [x+w/2,y+h/2];}

function drawStatic(){
  const g=tok('--f-ground'),grid=tok('--f-grid'),yard=tok('--f-yard'),road=tok('--f-road'),bld=tok('--f-bld'),bd=tok('--f-bld-bd'),mk=tok('--f-mark'),tx=tok('--f-text');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<=W;x+=25){ctx.moveTo(x,0);ctx.lineTo(x,H);}for(let y=0;y<=H;y+=25){ctx.moveTo(0,y);ctx.lineTo(W,y);}ctx.stroke();
  // ana yol
  const [,ry0]=PM(0,68),[,ry1]=PM(0,76),[,ryc]=PM(0,72);ctx.fillStyle=road;ctx.fillRect(0,ry0,W,ry1-ry0);ctx.strokeStyle=mk;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,ry0);ctx.lineTo(W,ry0);ctx.moveTo(0,ry1);ctx.lineTo(W,ry1);ctx.stroke();
  ctx.setLineDash([14,12]);ctx.strokeStyle=tok('--s-on');ctx.globalAlpha=.55;ctx.beginPath();ctx.moveTo(0,ryc);ctx.lineTo(W,ryc);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  label('ANA YOL',12,ry1+14,10,tx,'left');
  // antrepo ve servis şeridi
  blok(-14,-4,-2.6,64,bld,bd,6);blok(-2.6,-4,0,46,road,null,0);
  ctx.save();const [ax,ay]=PM(-8.3,30);ctx.translate(ax,ay);ctx.rotate(-Math.PI/2);label('ANTREPO · Z34089',0,0,11,tx);ctx.restore();
  DOORS.forEach(d=>{blok(-3.4,d.mz-1.6,-2.6,d.mz+1.6,tok('--accent'),null,2);});
  // saha
  ctx.beginPath();[[0,0],[62.7,0],[62.7,53.5],[26,53.5],[26,46],[0,46]].forEach(([a,b],i)=>{const [x,y]=PM(a,b);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();
  ctx.fillStyle=yard;ctx.fill();ctx.strokeStyle=bd;ctx.lineWidth=1.5;ctx.setLineDash([6,5]);ctx.stroke();ctx.setLineDash([]);
  // kapı koridoru, rampa
  blok(12,46,26,68,yard,null,0);blok(12,46.5,18,67.5,road,null,2);
  // kantar (kuzey duvarına dik)
  blok(18,.8,21.5,17.8,tok('--s-t1'),tok('--s-on'),2);ctx.globalAlpha=1;
  ctx.save();const [kx,ky]=PM(19.75,9.3);ctx.translate(kx,ky);ctx.rotate(-Math.PI/2);label('KANTAR',0,0,8.5,'#ffffff','center',800,1);ctx.restore();
  // yapılar
  blok(.35,1.9,3.25,8.5,bld,bd);blok(5,.3,14.5,2.3,mk,null,2);blok(14.6,.8,17.2,14.4,bld,bd);blok(1.3,18.3,8.9,20.6,bld,bd);
  label('BEKLEME',1.8*10+OX,PM(0,10.2)[1],7.5,tx,'center',800,.5);
  blok(27,45.5,31,49.5,bld,bd);label('GÜVENLİK',...PM(29,51),7.5,tx,'center',800,.5);
  [[26.5,54.5,35,62],[37.5,54.5,45,62],[48,54.5,55.5,62],[57,54.5,66,60]].forEach(r=>blok(...r,bld,bd));label('OFİSLER',...PM(41,64.8),9,tx);
  // park yerleri
  ctx.strokeStyle=mk;ctx.lineWidth=1.5;
  SLOTS.forEach(s=>{const [x,y,w,h]=RC(...s.r);ctx.strokeRect(x,y,w,h);
    const [lx,ly]=s.kol==='B'?PM(s.r[2]-2.2,(s.r[1]+s.r[3])/2):s.kol==='K'?PM((s.r[0]+s.r[2])/2,s.r[3]-2):PM((s.r[0]+s.r[2])/2,s.r[1]+2);
    label('P'+String(s.no).padStart(2,'0'),lx,ly,8,tx,'center',800,.4);});
  // akış okları
  for(let mz=40;mz>22;mz-=8)arrow(...PM(19.75,mz),-Math.PI/2,mk);
  for(let mz=32;mz<66;mz+=9)arrow(...PM(23.8,mz),Math.PI/2,mk);
  label('GİRİŞ',...PM(19.6,66),9,tok('--s-on'),'center');label('ÇIKIŞ',...PM(24.6,63),9,tok('--s-done'),'center');
  // kuzey ve ölçek
  ctx.save();ctx.translate(W-40,60);ctx.strokeStyle=tx;ctx.fillStyle=tx;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(5,6);ctx.lineTo(0,2);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();label('K',W-40,34,9,tx);
  ctx.strokeStyle=tx;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(W-150,H-14);ctx.lineTo(W-50,H-14);ctx.moveTo(W-150,H-19);ctx.lineTo(W-150,H-9);ctx.moveTo(W-50,H-19);ctx.lineTo(W-50,H-9);ctx.stroke();label('10 m',W-100,H-26,9,tx,'center',700,.5);
}
function barrier(px,yon,open,col){ctx.save();ctx.translate(px,GATE_Y);ctx.fillStyle=tok('--f-text');ctx.fillRect(-3,-3,6,6);ctx.scale(yon,1);ctx.rotate(open?-Math.PI/2.3:0);
  for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#ffffff':col;ctx.fillRect(i*8,-2,8,4);}ctx.strokeStyle=col;ctx.lineWidth=.6;ctx.strokeRect(0,-2,40,4);ctx.restore();}
const kapidaGir=()=>[...araclar.values()].some(a=>a.mv&&a.x>OX+150&&a.x<OX+218&&Math.abs(a.y-GATE_Y)<110);
const kapidaCik=()=>[...araclar.values()].some(a=>a.mv&&a.x>=OX+218&&a.x<OX+280&&Math.abs(a.y-GATE_Y)<110);

/* ---------- araçlar ---------- */
const araclar=new Map(); // id -> {x,y,ang,mv,slot,state}
function yol(points,r=55){ // köşeleri yuvarlatılmış örneklenmiş yol
  const out=[points[0]];
  for(let i=1;i<points.length-1;i++){const [ax,ay]=points[i-1],[bx,by]=points[i],[cx,cy]=points[i+1];
    const d1=Math.hypot(bx-ax,by-ay)||1,d2=Math.hypot(cx-bx,cy-by)||1,k=Math.min(r,d1/2,d2/2);
    const p1=[bx-(bx-ax)/d1*k,by-(by-ay)/d1*k],p2=[bx+(cx-bx)/d2*k,by+(cy-by)/d2*k];out.push(p1);
    for(let t=.125;t<1;t+=.125){const u=1-t;out.push([u*u*p1[0]+2*u*t*bx+t*t*p2[0],u*u*p1[1]+2*u*t*by+t*t*p2[1]]);}out.push(p2);}
  out.push(points.at(-1));
  return {pts:out.filter((p,i)=>!i||Math.hypot(p[0]-out[i-1][0],p[1]-out[i-1][1])>.01)};
}
function yolNokta(p,d){const {pts}=p;let acc=0;for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  if(acc+l>=d){const t=(d-acc)/(l||1);return [pts[i-1][0]+(pts[i][0]-pts[i-1][0])*t,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*t,Math.atan2(pts[i][1]-pts[i-1][1],pts[i][0]-pts[i-1][0])];}acc+=l;}
  const a=pts.at(-2)||pts[0],b=pts.at(-1);return [b[0],b[1],Math.atan2(b[1]-a[1],b[0]-a[0])];}
function yolUzunluk(p){let L=0;for(let i=1;i<p.pts.length;i++)L+=Math.hypot(p.pts[i][0]-p.pts[i-1][0],p.pts[i][1]-p.pts[i-1][1]);return L;}
function bosSlot(){const f=SLOTS.filter(s=>!s.v);return f.length?f[Math.floor(Math.random()*f.length)]:null;}
function parkAci(s){return s.ang;}
function hareket(a,points,{rev=false,sonra}={}){const p=yol(points);a.mv={p,L:yolUzunluk(p),d:0,rev,sonra};}
const mP=(mx,mz)=>PM(mx,mz);
// kantardan sonra park yerine giden yol: {geri1: kantardan geri iniş, ileri, geri2}
function parkYolu(s){const KX=KANTAR_X;
  if(s.kol==='B') return [{p:[[KX,KANTAR_Y],[KX,s.y],[OX+257.5,s.y]],rev:true},{p:[[OX+257.5,s.y],[s.x,s.y]]}];
  const ilk={p:[[KX,KANTAR_Y],[KX,OY+290]],rev:true};const [,ly]=mP(0,s.kol==='K'?22:24);
  if(s.x<=OX+430) return [ilk,{p:[[KX,OY+290],[KX,ly+30],[s.x+100,ly]]},{p:[[s.x+100,ly],[s.x,ly],[s.x,s.y]],rev:true}];
  const [,l2]=mP(0,31);return [ilk,{p:[[KX,OY+290],[KX,OY+240],[OX+540,OY+240],[OX+540,l2],[s.x-100,l2]]},{p:[[s.x-100,l2],[s.x,l2],[s.x,s.y]],rev:true}];}
function cikisYolu(s){const son=[[OUTX,ROAD],[-300,ROAD]];
  if(s.kol==='B') return [{p:[[s.x,s.y],[OUTX,s.y],[OUTX,s.y-75]],rev:true},{p:[[OUTX,s.y-75],[OUTX,GATE_Y],...son]}];
  const [,ly]=mP(0,30);return [{p:[[s.x,s.y],[s.x,ly],[OUTX,ly],[OUTX,GATE_Y],...son]}];}
function zincir(a,adimlar,bitti){const [b,...kalan]=adimlar;if(!b){bitti&&bitti();return;}hareket(a,b.p,{rev:!!b.rev,sonra:()=>zincir(a,kalan,bitti)});}

function senkron(liste,sim){
  const gor=new Set();
  // yolda: randevusu yaklaşan/gelen ama tesise girmemiş araçlar (en çok 3), ana yolda doğudan gelip kapı önünde sıraya girer
  const yolda=liste.filter(v=>v.arriving&&!v.onsite).slice(0,3);
  yolda.forEach((v,i)=>{gor.add(v.id);let a=araclar.get(v.id);const hx=KANTAR_X+360+i*200;
    if(!a){a={id:v.id,x:W+420,y:ROAD,ang:Math.PI,state:'yolda'};araclar.set(v.id,a);}
    if(a.state==='yolda'&&!a.mv&&Math.abs(a.x-hx)>1)hareket(a,[[a.x,ROAD],[hx,ROAD]]);
  });
  liste.forEach(v=>{
    if(!v.onsite)return;
    let a=araclar.get(v.id);
    if(v.out_at){ // çıkış
      if(a&&a.state!=='cikiyor'&&a.state!=='gitti'){const s=a.slot;a.state='cikiyor';a.bekle=0;
        if(s){zincir(a,cikisYolu(s),()=>{a.state='gitti';});setTimeout(()=>{if(s.v===a.id)s.v=null;},6000);}
        else a.state='gitti';}
      if(a)gor.add(v.id);return;
    }
    gor.add(v.id);
    if(!a||a.state==='yolda'){const s=bosSlot();if(!s)return;s.v=v.id;
      if(!a||ilk){a=a||{id:v.id};Object.assign(a,{x:s.x,y:s.y,ang:parkAci(s),slot:s,state:'park',mv:null});araclar.set(v.id,a);}
      else{a.slot=s;a.state='giriyor';
        hareket(a,[[a.x,a.y],[KANTAR_X,ROAD],[KANTAR_X,KANTAR_Y]],{sonra:()=>{a.bekle=reduce?0:2.6;a.sonraBekle=()=>{ // kantarda tartı
          zincir(a,parkYolu(s),()=>{a.state='park';});};}});}
    }
  });
  for(const [id,a] of araclar){if(!gor.has(id)||a.state==='gitti'){if(a.slot&&a.slot.v===id)a.slot.v=null;araclar.delete(id);}}
}
let ilk=true;

function adimla(dt){
  const hiz=(reduce?1e6:85)*carp;
  for(const a of araclar.values()){if(a.bekle>0){a.bekle-=dt*carp;if(a.bekle<=0){const f=a.sonraBekle;a.sonraBekle=null;f&&f();}continue;}if(!a.mv)continue;const m=a.mv;const kalan=m.L-m.d;
    const yav=Math.max(.2,Math.min(1,kalan/70,(m.d+12)/50))*(m.rev?.55:1);m.d=Math.min(m.L,m.d+hiz*yav*dt);
    const [x,y,ang]=yolNokta(m.p,m.d);a.x=x;a.y=y;a.ang=m.rev?ang+Math.PI:ang;
    if(m.d>=m.L){a.mv=null;m.sonra&&m.sonra();if(a.state==='park'&&!a.mv&&a.slot)a.ang=parkAci(a.slot);}}
}

function tir(a,v,sim,secili){
  const durum=durumKodu(v,sim),uz=uzunMu(v,sim);
  const col={wait:tok('--s-wait'),on:tok('--s-on'),t1:tok('--s-t1'),done:tok('--s-done'),out:tok('--s-done')}[durum];
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.ang);ctx.scale(2,1.05);
  ctx.fillStyle='rgba(11,21,48,.18)';rr(ctx,-40,-12+3,84,26,7);ctx.fill();
  const t=performance.now()/1000;
  if(uz||durum==='wait'||secili){const pulse=reduce?0:(Math.sin(t*4)+1)/2;ctx.strokeStyle=uz?tok('--s-long'):secili?tok('--accent'):col;ctx.globalAlpha=secili?1:.45+.45*pulse;ctx.lineWidth=secili?3:2.5;rr(ctx,-48,-19,98,38,13);ctx.stroke();ctx.globalAlpha=1;}
  ctx.strokeStyle=uz?tok('--s-long'):col;ctx.lineWidth=2.4;rr(ctx,-44,-16,90,32,10);ctx.stroke();
  rr(ctx,-40,-12,60,24,4);ctx.fillStyle=tok('--f-truck');ctx.fill();ctx.strokeStyle=tok('--f-truck-bd');ctx.lineWidth=1.2;ctx.stroke();
  ctx.fillStyle=CUSTOMERS[v.customer]||'#94a3b8';rr(ctx,-36,-3,52,6,2);ctx.fill();
  ctx.strokeStyle=tok('--f-truck-bd');ctx.globalAlpha=.35;ctx.lineWidth=1;for(let x=-28;x<16;x+=10){ctx.beginPath();ctx.moveTo(x,-12);ctx.lineTo(x,-4);ctx.moveTo(x,4);ctx.lineTo(x,12);ctx.stroke();}ctx.globalAlpha=1;
  rr(ctx,23,-11,19,22,5);ctx.fillStyle=tok('--f-truck');ctx.fill();ctx.strokeStyle=tok('--f-truck-bd');ctx.lineWidth=1.2;ctx.stroke();
  rr(ctx,36,-9,4,18,2);ctx.fillStyle=tok('--f-glass');ctx.fill();
  ctx.fillStyle=col;ctx.beginPath();ctx.arc(29,0,3.2,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function plakaEtiket(a,v,sim,secili){
  const s=a.slot;const atPark=s&&a.state==='park'&&!a.mv;
  const show=secili||(S>=.62&&(atPark||a.state==='yolda'));if(!show)return;
  const tr=v.plate.split('/')[0].trim();const c=ulke(tr);
  let x=a.x,y;const st=s&&s.no%2?16:0;
  if(atPark){if(s.kol==='B'){x=s.x+128;y=s.y;}else if(s.kol==='K'){y=s.y+108+st;}else{y=s.y-108-st;}}else y=a.y-34;
  const fs=11.5;ctx.save();ctx.font=`700 ${fs}px "Roboto Condensed","Arial Narrow",Arial,sans-serif`;const tw=ctx.measureText(tr).width;const w=tw+26,h=18;
  ctx.fillStyle='#fff';ctx.strokeStyle='#16233a';ctx.lineWidth=1.3;rr(ctx,x-w/2,y-h/2,w,h,4);ctx.fill();ctx.stroke();
  ctx.fillStyle=c==='?'?'#8a96a8':'#1f4fb8';rr(ctx,x-w/2+.6,y-h/2+.6,12,h-1.2,3);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='800 6.5px "Plus Jakarta Sans",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c,x-w/2+6.6,y+4.5);
  ctx.fillStyle='#111827';ctx.font=`700 ${fs}px "Roboto Condensed","Arial Narrow",Arial,sans-serif`;ctx.fillText(tr,x+6,y+.5);
  if(atPark&&v.onsite&&(secili||uzunMu(v,sim))){const dk=kalis(v,sim);const uz=uzunMu(v,sim);const ty=y+15;ctx.font='800 9.5px "Plus Jakarta Sans",sans-serif';const t=sureKisa(dk),w2=ctx.measureText(t).width+10;
    ctx.fillStyle=uz?tok('--s-long'):tok('--accent');rr(ctx,x-w2/2,ty-7,w2,14,7);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(t,x,ty+.5);}
  ctx.restore();
}
let son=[];
function draw(){
  if(G3)return;
  ctx.setTransform(dpr*S,0,0,dpr*S,0,0);
  drawStatic();
  const sim=kaynak.simdi();const byId=new Map(son.map(v=>[v.id,v]));
  barrier(...PM(17.9,0).slice(0,1),1,kapidaGir(),tok('--s-long'));barrier(...PM(25.45,0).slice(0,1),-1,kapidaCik(),tok('--s-long'));
  const list=[...araclar.values()].sort((a,b)=>a.y-b.y);
  for(const a of list){const v=byId.get(a.id);if(v)tir(a,v,sim,a.id===secim);}
  for(const a of list){const v=byId.get(a.id);if(v)plakaEtiket(a,v,sim,a.id===secim);}
}

/* =========================== 3B SAHNE (three.js) ===========================
   PCS Transit · Büyükçekmece sahası örnek alınarak modellendi: açık renk dökme beton saha, sarı çizgiler, çukur kantar,
   prekast istinat duvarı + yeşil tel çit ve jiletli tel, taş kaplama kulübe ve bekleme salonu, beyaz sandviç panel binalar,
   dizili beyaz tenteli dorseler, aydınlatma ve elektrik direkleri, yeşil tepeler ve uzakta şehir siluet.
   Hareket mantığı 2B plan koordinatlarında çalışır (araclar: x, y, ang); 3B sahne bunları metreye çevirir
   (1 plan birimi = 10 cm; yerleşim uydu görüntüsüne göre). WebGL yoksa 2B plan kullanılır. Bütün dokular sayfanın içinde çizilir. */
let G3=null;
function kur3B(){
  if(typeof THREE==='undefined')return null;
  try{const t=document.createElement('canvas');if(!(t.getContext('webgl2')||t.getContext('webgl')))return null;}catch(e){return null;}
  const T=THREE,box=$('s3'),ov=$('s3ov');
  let R;try{R=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){return null;}
  R.setPixelRatio(Math.min(GOMULU?1.5:2,devicePixelRatio||1));R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
  R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=1.0;R.outputColorSpace=T.SRGBColorSpace;
  box.prepend(R.domElement);R.domElement.setAttribute('aria-label','Tesis sahasının 3B görünümü: kantar, güvenlik kulübesi, bekleme salonu, antrepo, park alanı ve tırlar');
  const SC=new T.Scene(),CAM=new T.PerspectiveCamera(34,16/9,.5,2200);
  const M=.1,CXp=OX+313.5,CYp=OY+267.5,P3=(x,y)=>[(x-CXp)*M,(y-CYp)*M];
  const X=mx=>(OX+mx*10-CXp)*M,Z=mz=>(OY+mz*10-CYp)*M,Q=(mx,mz)=>[X(mx),Z(mz)]; // saha metresi → dünya koordinatı
  // ---------- yardımcılar ----------
  let sd=23;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const ANI=Math.min(8,R.capabilities.getMaxAnisotropy());
  function tx(w,h,ciz,rep,renkli=true){const c=document.createElement('canvas');c.width=w;c.height=h;ciz(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);
    if(renkli)t.colorSpace=T.SRGBColorSpace;t.anisotropy=ANI;if(rep){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rep[0],rep[1]);}return t;}
  const rep=(t,x,y)=>{const c=t.clone();c.wrapS=c.wrapT=T.RepeatWrapping;c.repeat.set(x,y);c.needsUpdate=true;return c;};
  const gurultu=(g,w,h,n,cols,a=1,smin=1,smax=3)=>{for(let i=0;i<n;i++){g.globalAlpha=a*rnd();g.fillStyle=cols[Math.floor(rnd()*cols.length)];const s=smin+rnd()*(smax-smin);g.fillRect(rnd()*w,rnd()*h,s,s);}g.globalAlpha=1;};
  const FONT='"Plus Jakarta Sans",Arial,sans-serif',COND='"Roboto Condensed","Arial Narrow",Arial,sans-serif';
  const MS=o=>new T.MeshStandardMaterial(o);
  const tumMat=[];const mk=o=>{const m=MS(o);tumMat.push(m);return m;};
  const kutu=(w,h,d,m,x=0,y=0,z=0,golge=true)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=golge;o.receiveShadow=true;return o;};
  const duz=(w,d,m,x,z,y=.01)=>{const o=new T.Mesh(new T.PlaneGeometry(w,d),m);o.rotation.x=-Math.PI/2;o.position.set(x,y,z);o.receiveShadow=true;return o;};
  const dikey=(w,h,m,x,y,z,ry=0)=>{const o=new T.Mesh(new T.PlaneGeometry(w,h),m);o.position.set(x,y,z);o.rotation.y=ry;o.receiveShadow=true;return o;};
  // sınırlar
  const yx0=X(0),yx1=X(62.7),yz0=Z(0),yz1=Z(53.5),rz=Z(72),gx=X(19.75);
  const YW=yx1-yx0,YD=yz1-yz0,ycx=(yx0+yx1)/2,ycz=(yz0+yz1)/2;
  // ---------- dokular ----------
  // ince beton dokusu (tekrarlı): renk + pürüz
  const betonInce=tx(512,512,(g,w,h)=>{g.fillStyle='#808080';g.fillRect(0,0,w,h);gurultu(g,w,h,26000,['#6f6f6f','#949494','#7a7a7a','#8a8a8a'],.55,1,2.2);
    for(let i=0;i<14;i++){const x=rnd()*w,y=rnd()*h,r=20+rnd()*60,gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(60,60,60,.18)');gr.addColorStop(1,'rgba(60,60,60,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r);}},null,false);
  // saha zemini: tek büyük doku (derzler, lastik izleri, sarı çizgiler, kantar işaretleri pişirilmiş)
  const ZW=4096,ZH=Math.round(4096*YD/YW),pxm=ZW/YW;const Zx=X=>(X-yx0)*pxm,Zz=Z=>(Z-yz0)*pxm;
  const sahaT=tx(ZW,ZH,(g,w,h)=>{
    g.fillStyle='#d8d3c8';g.fillRect(0,0,w,h);
    // geniş lekeler / renk dalgası
    for(let i=0;i<160;i++){const x=rnd()*w,y=rnd()*h,r=40+rnd()*260,gr=g.createRadialGradient(x,y,0,x,y,r);const c=rnd()<.5?'196,190,178':'226,222,214';gr.addColorStop(0,`rgba(${c},.35)`);gr.addColorStop(1,`rgba(${c},0)`);g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r);}
    gurultu(g,w,h,90000,['#c9c3b6','#e3dfd6','#bdb7aa','#d1ccc1'],.35,1,3);
    // perdah izleri (mala dalgaları)
    g.lineWidth=1.2;for(let i=0;i<900;i++){g.strokeStyle=`rgba(${rnd()<.5?'170,164,152':'240,237,230'},.18)`;const x=rnd()*w,y=rnd()*h,r=8+rnd()*26;g.beginPath();g.arc(x,y,r,rnd()*6,rnd()*6+1.5);g.stroke();}
    // derzler (~6 m)
    g.strokeStyle='rgba(120,114,104,.55)';g.lineWidth=2;for(let X=yx0+6;X<yx1;X+=6.2){g.beginPath();g.moveTo(Zx(X),0);g.lineTo(Zx(X),h);g.stroke();}for(let Z=yz0+6;Z<yz1;Z+=6.2){g.beginPath();g.moveTo(0,Zz(Z));g.lineTo(w,Zz(Z));g.stroke();}
    // lastik izleri: kavisler ve daireler
    const iz=(cx,cy,r,a0,a1,al)=>{for(const o of [-1,1]){g.strokeStyle=`rgba(40,38,36,${al})`;g.lineWidth=5+rnd()*5;g.beginPath();g.arc(cx,cy,r+o*16,a0,a1);g.stroke();g.strokeStyle=`rgba(40,38,36,${al*.6})`;g.lineWidth=2;g.beginPath();g.arc(cx,cy,r+o*16+6,a0,a1);g.stroke();}};
    for(let i=0;i<26;i++){const cx=rnd()*w,cy=rnd()*h,r=80+rnd()*420,a0=rnd()*6.28;iz(cx,cy,r,a0,a0+.8+rnd()*3.5,.08+rnd()*.14);}
    // ortadaki büyük dönüş daireleri (uydu görüntüsündeki koyu lastik izleri)
    const zx=m=>m*pxm;
    iz(zx(31),zx(27),12*pxm,0,6.28,.15);iz(zx(36),zx(31),9*pxm,.4,5.6,.13);iz(zx(27),zx(24),14.5*pxm,3.6,6.1,.11);iz(zx(40),zx(34),6.5*pxm,0,6.28,.1);iz(zx(24),zx(33),10*pxm,4.2,6.9,.12);
    // sarı park çizgileri (P01–P20) ve numaralar
    g.strokeStyle='#e7b81c';g.lineCap='butt';const ln=(a,b,c,d,wm=.13)=>{g.strokeStyle='#e7b81c';g.lineWidth=wm*pxm;g.beginPath();g.moveTo(zx(a),zx(b));g.lineTo(zx(c),zx(d));g.stroke();};
    SLOTS.forEach(s=>{const [a,b,c,d]=s.r;ln(a,b,c,b);ln(a,d,c,d);ln(a,b,a,d);ln(c,b,c,d);
      const [nx,nz]=s.kol==='B'?[c-1.5,(b+d)/2]:s.kol==='K'?[(a+c)/2,d-1.5]:[(a+c)/2,b+1.5];
      g.save();g.translate(zx(nx),zx(nz));g.fillStyle='rgba(231,184,28,.95)';g.font=`800 ${1.25*pxm}px ${COND}`;g.textAlign='center';g.textBaseline='middle';g.fillText(String(s.no).padStart(2,'0'),0,0);g.restore();});
    // kantara yaklaşma çizgileri (fotoğraftaki gibi)
    ln(17.3,18.3,17.3,31,.15);ln(22.2,18.3,22.2,31,.15);
    // kenar sarı şerit (duvar dibi)
    g.strokeStyle='rgba(231,184,28,.9)';g.lineWidth=.12*pxm;g.strokeRect(.6*pxm,.6*pxm,w-1.2*pxm,h-1.2*pxm);
  });
  sahaT.anisotropy=ANI;
  const ince=(x,y)=>{const t=rep(betonInce,x,y);return t;};
  // prekast duvar
  const duvarT=tx(1024,256,(g,w,h)=>{g.fillStyle='#b9bbb8';g.fillRect(0,0,w,h);gurultu(g,w,h,22000,['#a9aba8','#c7c9c6','#b0b2af'],.5,1,2.5);
    for(let i=0;i<30;i++){const x=rnd()*w,y=rnd()*h*.4,r=10+rnd()*40;g.fillStyle='rgba(120,122,120,.12)';g.fillRect(x,y,r*.3,h-y);} // akıntı izi
    g.fillStyle='rgba(80,82,80,.55)';for(let x=0;x<w;x+=256){g.fillRect(x,0,3,h);}g.fillStyle='rgba(255,255,255,.18)';for(let x=3;x<w;x+=256)g.fillRect(x,0,2,h);
    g.fillStyle='rgba(60,60,60,.25)';g.fillRect(0,h-10,w,10);});
  // taş kaplama (kulübe, bekleme salonu)
  const tasT=tx(512,512,(g,w,h)=>{g.fillStyle='#8e9093';g.fillRect(0,0,w,h);let y=0;while(y<h){const bh=10+rnd()*16;let x=-rnd()*60;while(x<w){const bw=30+rnd()*90;const t=170+rnd()*55|0;g.fillStyle=`rgb(${t},${t+1},${t+3})`;g.fillRect(x+1,y+1,bw-2,bh-2);
      g.fillStyle='rgba(255,255,255,.22)';g.fillRect(x+1,y+1,bw-2,2);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x+1,y+bh-3,bw-2,2);x+=bw;}y+=bh;}gurultu(g,w,h,9000,['#666','#ddd'],.25,1,2);},[2,1]);
  // trapez / sandviç panel (beyaz)
  const panelT=tx(512,256,(g,w,h)=>{g.fillStyle='#eef0f1';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=32){const gr=g.createLinearGradient(x,0,x+32,0);gr.addColorStop(0,'rgba(255,255,255,.5)');gr.addColorStop(.12,'rgba(0,0,0,.12)');gr.addColorStop(.2,'rgba(255,255,255,.25)');gr.addColorStop(.85,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.14)');g.fillStyle=gr;g.fillRect(x,0,32,h);}
    gurultu(g,w,h,3000,['#cfd3d6'],.35,1,2);g.fillStyle='rgba(120,126,132,.35)';for(let x=0;x<w;x+=128)g.fillRect(x,0,2,h);for(let i=0;i<40;i++){g.fillStyle='rgba(150,150,150,.6)';g.fillRect(rnd()*w,rnd()*h,2,2);}});
  // kepenk
  const kepenkT=tx(256,256,(g,w,h)=>{g.fillStyle='#1d2229';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=10){const gr=g.createLinearGradient(0,y,0,y+10);gr.addColorStop(0,'#3a424c');gr.addColorStop(.5,'#22282f');gr.addColorStop(1,'#14181d');g.fillStyle=gr;g.fillRect(0,y,w,10);}},[1,1]);
  // seksiyonel kapı (antrepo)
  const seksT=tx(256,256,(g,w,h)=>{g.fillStyle='#5d6670';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=42){g.fillStyle='#6b747e';g.fillRect(0,y,w,38);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(0,y,w,3);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(0,y+38,w,4);}});
  // tel panel çit (yeşil)
  const telT=tx(128,128,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='#2f6e45';g.lineWidth=3;for(let x=0;x<=w;x+=16){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}g.lineWidth=2.4;for(let y=0;y<=h;y+=40){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
    g.lineWidth=5;g.beginPath();g.moveTo(0,64);g.lineTo(w,64);g.stroke();},null,true);
  // jiletli tel (concertina)
  const jiletT=tx(256,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='#c9ced3';g.lineWidth=2;for(let x=-40;x<w+40;x+=22){g.beginPath();g.ellipse(x,h/2,24,h/2-4,0,0,6.3);g.stroke();}
    g.fillStyle='#e5e8eb';for(let i=0;i<70;i++){const x=rnd()*w,y=4+rnd()*(h-8);g.fillRect(x,y,4,1.5);}},null,true);
  // kafes direk (elektrik)
  const kafesT=tx(64,256,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='#6d4a35';g.lineWidth=5;g.beginPath();g.moveTo(4,0);g.lineTo(4,h);g.moveTo(w-4,0);g.lineTo(w-4,h);g.stroke();g.lineWidth=3;
    for(let y=0;y<h;y+=32){g.beginPath();g.moveTo(4,y);g.lineTo(w-4,y+32);g.moveTo(w-4,y);g.lineTo(4,y+32);g.stroke();}},null,true);
  // tente kumaşı (gerilmiş beyaz branda, kayış ve tokalar, kir lekeleri) + Euro Türk yazıları
  const TW=2048,TH=384;
  const tenteCiz=(g,w,h,euro,renk)=>{g.fillStyle='#e7e9eb';g.fillRect(0,0,w,h);gurultu(g,w,h,16000,['#dadde0','#f2f3f4','#d0d4d8'],.45,1,3);
    const ad=w/20.5; // kayış aralığı ≈ 0,65 m
    for(let x=0;x<=w;x+=ad){const gr=g.createLinearGradient(x,0,x+ad,0);gr.addColorStop(0,'rgba(0,0,0,.08)');gr.addColorStop(.25,'rgba(255,255,255,.10)');gr.addColorStop(.6,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.08)');g.fillStyle=gr;g.fillRect(x,0,ad,h);
      g.fillStyle='rgba(112,120,130,.6)';g.fillRect(x-3,6,6,h-12);g.fillStyle='#737b84';g.fillRect(x-7,h-46,14,26);g.fillStyle='#c4c9ce';g.fillRect(x-5,h-42,10,6);}
    const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(255,255,255,.3)');gr.addColorStop(.5,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(70,76,84,.28)');g.fillStyle=gr;g.fillRect(0,0,w,h);
    for(let i=0;i<14;i++){const x=rnd()*w,y=rnd()*h;g.fillStyle='rgba(115,105,90,.06)';g.beginPath();g.ellipse(x,y,60+rnd()*180,10+rnd()*34,0,0,7);g.fill();}
    if(renk){g.fillStyle=renk;g.globalAlpha=.85;g.fillRect(0,h-30,w,8);g.globalAlpha=1;}
    if(euro){const bx=w*.53,by=h*.15,bw=w*.34,bh=h*.27;g.fillStyle='#2a4594';g.fillRect(bx,by,bw*.5,bh);g.fillStyle='#cf2e31';g.fillRect(bx+bw*.5,by,bw*.5,bh);
      g.fillStyle='#fff';g.font=`600 ${bh*.62}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';g.fillText('EURO',bx+bw*.25,by+bh*.55);g.fillText('TÜRK',bx+bw*.75,by+bh*.55);
      g.fillStyle='#2b2f36';g.font=`700 ${bh*.22}px ${COND}`;g.fillText('UK/IRELAND AND TURKEY – GROUPAGE/FULL LOADS TRANSPORT',bx+bw*.5,by+bh*1.32);
      g.font=`600 ${bh*.2}px ${FONT}`;g.textAlign='left';g.fillStyle='#30353c';g.fillText('www.euroturk.co.uk        www.euroturktr.com',w*.06,by+bh*.25);
      g.fillStyle='rgba(48,53,60,.7)';for(let i=0;i<4;i++){g.fillRect(w*.06,by+bh*.62+i*bh*.17,w*.07,3);g.fillRect(w*.15,by+bh*.62+i*bh*.17,w*.09,3);g.fillRect(w*.27,by+bh*.62+i*bh*.17,w*.11,3);}}};
  const tenteCache=new Map();const tenteMat=(euro,renk)=>{const k=euro+'|'+renk;if(!tenteCache.has(k)){const t=tx(TW,TH,(g,w,h)=>tenteCiz(g,w,h,euro,renk));tenteCache.set(k,mk({map:t,roughness:.86,side:T.DoubleSide}));}return tenteCache.get(k);};
  // dorse arka kapıları: panel olukları, 4 kilit kolu, menteşeler, uyarı etiketi
  const arkaT=tx(512,512,(g,w,h)=>{g.fillStyle='#d4d8dc';g.fillRect(0,0,w,h);gurultu(g,w,h,5000,['#c6cbd0','#e2e5e8'],.4,1,3);
    g.strokeStyle='#a2a9b0';g.lineWidth=2;for(let x=20;x<w;x+=34){g.beginPath();g.moveTo(x,10);g.lineTo(x,h-10);g.stroke();}
    g.fillStyle='#6f777f';g.fillRect(w/2-3,0,6,h);g.fillStyle='#8a929a';g.fillRect(0,0,10,h);g.fillRect(w-10,0,10,h);
    [.2,.5,.8].forEach(p=>{g.fillStyle='#596067';g.fillRect(4,h*p-14,22,28);g.fillRect(w-26,h*p-14,22,28);});
    g.fillStyle='#fff';g.fillRect(w*.64,h*.1,w*.14,w*.14);g.strokeStyle='#d42a2f';g.lineWidth=5;g.strokeRect(w*.64+4,h*.1+4,w*.14-8,w*.14-8);
    const k=g.createLinearGradient(0,h*.75,0,h);k.addColorStop(0,'rgba(90,75,60,0)');k.addColorStop(1,'rgba(90,75,60,.22)');g.fillStyle=k;g.fillRect(0,h*.75,w,h*.25);});
  // ızgaralar (çekici tarzları; marka/logo yok): yatay lameller, krom çıtalar
  const izgara=(tip)=>tx(512,256,(g,w,h)=>{g.fillStyle='#0c0e10';g.fillRect(0,0,w,h);
    const lamel=(n,y0,y1,c1,c2,th)=>{for(let i=0;i<n;i++){const y=y0+(y1-y0)*i/(n-1);const gr=g.createLinearGradient(0,y-th/2,0,y+th/2);gr.addColorStop(0,c1);gr.addColorStop(1,c2);g.fillStyle=gr;g.fillRect(14,y-th/2,w-28,th);}};
    if(tip==='v'){lamel(7,30,226,'#d9dee3','#555d66',12);g.strokeStyle='#e4e8ec';g.lineWidth=12;g.beginPath();g.moveTo(w*.22,h*.86);g.lineTo(w*.78,h*.14);g.stroke();}
    else if(tip==='d'){lamel(9,22,236,'#3d434a','#14171a',16);g.fillStyle='#cfd5da';g.fillRect(10,4,w-20,10);g.fillRect(10,h-14,w-20,10);}
    else if(tip==='m'){lamel(5,40,216,'#e3e7eb','#6b737c',14);g.fillStyle='#d5dbe0';g.fillRect(8,h*.46,w-16,14);}
    else{lamel(4,40,216,'#c9cfd5','#485058',18);}
    const v=g.createLinearGradient(0,0,0,h);v.addColorStop(0,'rgba(0,0,0,.25)');v.addColorStop(.5,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.3)');g.fillStyle=v;g.fillRect(0,0,w,h);});
  const IZG={v:izgara('v'),d:izgara('d'),m:izgara('m'),s:izgara('s')};
  // far grubu, jant, plaka
  const farT=tx(256,128,(g,w,h)=>{g.fillStyle='#16181b';g.fillRect(0,0,w,h);const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#cfd6dd');gr.addColorStop(1,'#68707a');g.fillStyle=gr;g.fillRect(6,6,w-12,h-12);
    [[w*.28,h*.5,30],[w*.6,h*.5,24]].forEach(([x,y,r])=>{const rg=g.createRadialGradient(x,y,2,x,y,r);rg.addColorStop(0,'#ffffff');rg.addColorStop(.5,'#e6ebf0');rg.addColorStop(1,'#8b939b');g.fillStyle=rg;g.beginPath();g.arc(x,y,r,0,7);g.fill();});
    g.fillStyle='#f0a020';g.fillRect(w*.8,h*.18,w*.13,h*.64);});
  const jantT=tx(256,256,(g,w,h)=>{const c=w/2;let gr=g.createRadialGradient(c,c,10,c,c,c);gr.addColorStop(0,'#f1f3f5');gr.addColorStop(.55,'#b7bec5');gr.addColorStop(.62,'#8c949c');gr.addColorStop(.7,'#d5dadf');gr.addColorStop(1,'#98a0a8');g.fillStyle=gr;g.fillRect(0,0,w,h);
    g.fillStyle='#262a2f';for(let i=0;i<10;i++){const a=i/10*6.283;g.save();g.translate(c+Math.cos(a)*80,c+Math.sin(a)*80);g.rotate(a);g.beginPath();g.ellipse(0,0,12,20,0,0,7);g.fill();g.restore();}
    g.fillStyle='#dfe3e7';for(let i=0;i<10;i++){const a=(i+.5)/10*6.283;g.beginPath();g.arc(c+Math.cos(a)*44,c+Math.sin(a)*44,6,0,7);g.fill();}
    gr=g.createRadialGradient(c,c,4,c,c,30);gr.addColorStop(0,'#fafbfc');gr.addColorStop(1,'#7b838b');g.fillStyle=gr;g.beginPath();g.arc(c,c,30,0,7);g.fill();});
  const plakaCache=new Map();const plakaMat=t=>{if(!plakaCache.has(t)){const pt=tx(256,56,(g,w,h)=>{g.fillStyle='#f4f5f2';g.fillRect(0,0,w,h);g.strokeStyle='#111';g.lineWidth=3;g.strokeRect(1.5,1.5,w-3,h-3);g.fillStyle='#1f4fb8';g.fillRect(3,3,24,h-6);g.fillStyle='#111';g.font=`700 36px ${COND}`;g.textAlign='center';g.textBaseline='middle';g.fillText(t,w/2+12,h/2+2);});plakaCache.set(t,mk({map:pt,roughness:.4,metalness:.1}));}return plakaCache.get(t);};
  const euroCamT=tx(512,96,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle='#24419a';g.fillRect(w*.2,h*.12,w*.3,h*.76);g.fillStyle='#d42a2f';g.fillRect(w*.5,h*.12,w*.3,h*.76);g.fillStyle='#fff';g.font=`600 ${h*.5}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';g.fillText('EURO',w*.35,h*.53);g.fillText('TÜRK',w*.65,h*.53);});
  const yazi=(t,{w=1024,h=160,bg='#16233a',fg='#ffffff',font=96,ls=8,weight=800,fam=FONT}={})=>tx(w,h,g=>{if(bg){g.fillStyle=bg;g.fillRect(0,0,w,h);}g.fillStyle=fg;g.font=`${weight} ${font}px ${fam}`;g.textAlign='center';g.textBaseline='middle';if('letterSpacing' in g)g.letterSpacing=ls+'px';g.fillText(t,w/2,h/2+2);});
  // PCS | EURO TÜRK panosu
  const panoT=tx(1024,200,(g,w,h)=>{g.fillStyle='#f4f5f6';g.fillRect(0,0,w,h);g.fillStyle='#fff';g.fillRect(14,14,210,h-28);g.strokeStyle='#c9ced4';g.lineWidth=3;g.strokeRect(14,14,210,h-28);
    g.font=`900 110px ${FONT}`;g.textBaseline='middle';g.textAlign='left';g.fillStyle='#24419a';g.fillText('P',40,h*.44);g.fillStyle='#d42a2f';g.fillText('C',108,h*.44);g.fillStyle='#24419a';g.fillText('S',172,h*.44);g.fillStyle='#d42a2f';g.fillRect(38,h*.74,170,18);
    g.fillStyle='#24419a';g.fillRect(240,26,370,h-52);g.fillStyle='#d42a2f';g.fillRect(610,26,390,h-52);g.fillStyle='#fff';g.font=`600 96px ${FONT}`;g.textAlign='center';g.fillText('EURO',425,h/2+4);g.fillText('TÜRK',805,h/2+4);});
  // gökyüzü (kubbe) ve bulutlar
  const bulutT=tx(512,256,(g,w,h)=>{g.clearRect(0,0,w,h);for(let i=0;i<46;i++){const x=w*.12+rnd()*w*.76,y=h*.42+rnd()*h*.32-(Math.abs(x-w/2)/w)*h*.0,r=26+rnd()*70*(1-Math.abs(x-w/2)/w);
      const gr=g.createRadialGradient(x,y-r*.3,r*.1,x,y,r);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.6,'rgba(246,248,252,.9)');gr.addColorStop(1,'rgba(220,228,240,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();}
    const gr=g.createLinearGradient(0,h*.55,0,h);gr.addColorStop(0,'rgba(150,165,190,0)');gr.addColorStop(1,'rgba(150,165,190,.45)');g.globalCompositeOperation='source-atop';g.fillStyle=gr;g.fillRect(0,0,w,h);},null,true);
  const tarlaT=tx(1024,1024,(g,w,h)=>{g.fillStyle='#6f9a45';g.fillRect(0,0,w,h);const c=['#7aa84c','#5f8a3a','#8db35a','#a08a5a','#7a5a3a','#94b663'];for(let i=0;i<70;i++){g.save();g.translate(rnd()*w,rnd()*h);g.rotate((rnd()-.5)*.9);g.fillStyle=c[Math.floor(rnd()*c.length)];g.globalAlpha=.55+rnd()*.4;g.fillRect(-90-rnd()*120,-40-rnd()*70,180+rnd()*240,80+rnd()*140);
      g.strokeStyle='rgba(0,0,0,.08)';g.lineWidth=2;for(let k=-200;k<200;k+=10){g.beginPath();g.moveTo(k,-120);g.lineTo(k,120);g.stroke();}g.restore();}gurultu(g,w,h,20000,['#4f7a2f','#9cc06a','#6d5a3a'],.3,1,3);},[3,3]);
  const cimT=tx(256,256,(g,w,h)=>{g.fillStyle='#6b8f43';g.fillRect(0,0,w,h);gurultu(g,w,h,9000,['#587d36','#7da352','#93b766','#6a7a3a'],.7,1,3);},[1,1]);
  const yolT=tx(512,512,(g,w,h)=>{g.fillStyle='#5a5d61';g.fillRect(0,0,w,h);gurultu(g,w,h,14000,['#47494d','#6d7075','#55585c'],.5,1,2.5);},[60,1]);
  // ---------- malzemeler ----------
  const mat={
    saha:mk({map:sahaT,roughness:.92,roughnessMap:ince(YW/3,YD/3),bumpMap:ince(YW/1.5,YD/1.5),bumpScale:.6}),
    beton:mk({color:'#c9c6bf',map:ince(4,4),roughness:.9}),duvar:mk({map:duvarT,roughness:.92}),
    sari:mk({color:'#efbd1e',roughness:.6}),mavi:mk({color:'#2f5fb0',roughness:.45,metalness:.55}),maviAcik:mk({color:'#8ab2d8',roughness:.5,metalness:.5}),
    tas:mk({map:tasT,roughness:.88}),panel:mk({map:panelT,roughness:.5,metalness:.15}),koyuGri:mk({color:'#3a3f45',roughness:.6,metalness:.3}),
    kepenk:mk({map:kepenkT,roughness:.45,metalness:.55}),seks:mk({map:seksT,roughness:.5,metalness:.4}),beyazKapi:mk({color:'#eef0f1',roughness:.45}),
    turuncu:mk({color:'#e2541b',roughness:.45,metalness:.1}),direk:mk({color:'#9aa1a8',roughness:.45,metalness:.75}),koyu:mk({color:'#1b1e22',roughness:.6,metalness:.2}),
    lastik:mk({color:'#151618',roughness:.92}),jant:mk({color:'#c4cad1',roughness:.3,metalness:.85}),jantKoyu:mk({color:'#5a6068',roughness:.4,metalness:.7}),krom:mk({color:'#e0e5ea',roughness:.18,metalness:.95}),
    cam:new T.MeshPhysicalMaterial({color:'#24323f',roughness:.03,metalness:.15,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:2.2}),
    sasi:mk({color:'#23262a',roughness:.75,metalness:.35}),gri:mk({color:'#9aa1a8',roughness:.55,metalness:.4}),
    far:mk({map:farT,emissiveMap:farT,color:'#ffffff',emissive:'#fff2c4',emissiveIntensity:.15,roughness:.15,metalness:.3}),stop:mk({color:'#6a0b0b',emissive:'#ff2a1a',emissiveIntensity:.3}),turuncuLamba:mk({color:'#b8650c',emissive:'#ff9a1a',emissiveIntensity:.2}),
    lamba:mk({color:'#fffaf0',emissive:'#ffe1a8',emissiveIntensity:0}),kirmizi:mk({color:'#d42a2f',roughness:.5}),beyaz:mk({color:'#f6f7f8',roughness:.45}),
    arka:mk({map:arkaT,roughness:.55,metalness:.2}),
    tel:mk({map:rep(telT,1,1),transparent:true,alphaTest:.35,side:T.DoubleSide,roughness:.55,metalness:.35}),
    jilet:mk({map:rep(jiletT,1,1),transparent:true,alphaTest:.3,side:T.DoubleSide,roughness:.3,metalness:.9}),
    kafes:mk({map:rep(kafesT,1,1),transparent:true,alphaTest:.35,side:T.DoubleSide,roughness:.8}),
    cim:mk({map:rep(cimT,40,40),roughness:1}),tarla:mk({map:tarlaT,roughness:1,flatShading:false}),yol:mk({map:yolT,roughness:.95}),
    ev:mk({color:'#e9e3d6',roughness:.9}),cati:mk({color:'#c3c8cd',roughness:.55,metalness:.45}),evKiremit:mk({color:'#b0543a',roughness:.85}),sehir:mk({color:'#9fb0c4',roughness:.6,metalness:.2}),
    agac:mk({color:'#3f6a31',roughness:.95,flatShading:true}),agacK:mk({color:'#56813d',roughness:.95,flatShading:true}),govde:mk({color:'#5a4330',roughness:1})};
  // ---------- zemin ----------
  const m4=new T.Matrix4();
  const zemin=new T.Mesh(new T.PlaneGeometry(2400,2400),mat.cim);zemin.rotation.x=-Math.PI/2;zemin.position.y=-.05;zemin.receiveShadow=true;SC.add(zemin);
  SC.add(duz(YW,YD,mat.saha,ycx,ycz,.02));
  const alan=(a,b,c,d,m,y=.03)=>{const o=duz(X(c)-X(a),Z(d)-Z(b),m,(X(a)+X(c))/2,(Z(b)+Z(d))/2,y);SC.add(o);return o;};
  const betonM=(a,b)=>{const m=mat.beton.clone();m.map=rep(betonInce,a/4,b/4);return m;};
  const telDuz=(L,h,x,y,z,ry)=>{const m=mat.tel.clone();m.map=rep(telT,L/2.5,1);const t=dikey(L,h,m,x,y,z,ry);SC.add(t);return t;};
  // servis şeridi (antrepo önü), güneybatıdaki alçak beton alan
  alan(-2.6,-10,0,46,mat.yol,.03);
  alan(-2.6,46,12,68,betonM(14.6,22),.03);
  // kapı koridoru: batıda oluklu rampa, doğuda iki şeritli giriş–çıkış yolu
  const korT=tx(512,805,(g,w,h)=>{const p=w/14;g.fillStyle='#cfcac0';g.fillRect(0,0,w,h);gurultu(g,w,h,30000,['#c2bdb2','#ddd9d0','#b8b3a8'],.4,1,2.5);
    g.fillStyle='#8f9296';g.fillRect(0,0,6*p,h);gurultu(g,6*p,h,9000,['#7d8084','#a3a6aa'],.5,1,2);
    g.fillStyle='rgba(235,235,230,.85)';for(let x=.5*p;x<6*p;x+=.75*p)g.fillRect(x,6,3,h-12);
    g.fillStyle='rgba(245,245,240,.9)';for(let y=10;y<h;y+=2.4*p)g.fillRect(9.85*p,y,.14*p,1.2*p);
    g.fillStyle='#e7b81c';g.fillRect(6*p,0,.13*p,h);g.fillRect(w-.2*p,0,.13*p,h);
    for(let i=0;i<6;i++){g.strokeStyle='rgba(40,38,36,.1)';g.lineWidth=10;[7.75,11.8].forEach(c=>{g.beginPath();g.moveTo((c+(rnd()-.5)*.8)*p,0);g.lineTo((c+(rnd()-.5)*.8)*p,h);g.stroke();});}});
  alan(12,46,26,68,mk({map:korT,roughness:.9}),.035);
  // ofislerin otoparkı
  alan(26,62,66,68,mat.yol,.03);
  // ana yol (güneyde, doğu–batı) + kaldırımlar
  SC.add(duz(1400,8,mat.yol,0,rz,.03));
  const kesik=mk({color:'#f1f1ec',roughness:.6});for(let x=-690;x<690;x+=12)SC.add(duz(5,.2,kesik,x,rz,.05));
  SC.add(kutu(1400,.2,2.2,mat.beton,0,.1,rz+5.1,false));
  [[-700,X(12)],[X(26),700]].forEach(([a,b])=>SC.add(kutu(b-a,.2,2.2,mat.beton,(a+b)/2,.1,rz-5.1,false)));
  // rampa korkuluğu
  {const L=Z(68)-Z(46.3),zc=(Z(46.3)+Z(68))/2;SC.add(kutu(.3,.9,L,mat.beton,X(12)-.15,.45,zc));telDuz(L,1.1,X(12)-.15,1.45,zc,Math.PI/2);}
  // ---------- kantar (kuzey duvarına dik; ön ucu duvarda, sarı kenarlı çukur, mavi raylar) ----------
  const kz=Z(9.3),KL=17,KW=3.4;
  SC.add(kutu(KW+1.4,.12,KL,mat.koyu,gx,-.02,kz,false));
  const plat=new T.Mesh(new T.BoxGeometry(KW,.1,KL),mk({map:tx(256,1024,(g,w,h)=>{g.fillStyle='#9fbfdd';g.fillRect(0,0,w,h);gurultu(g,w,h,9000,['#7fa3c6','#b6d0e8','#6f8fb2'],.45,1,4);
      for(let i=0;i<30;i++){g.fillStyle='rgba(60,90,140,.25)';const x=rnd()*w,y=rnd()*h;g.beginPath();g.ellipse(x,y,20+rnd()*40,8+rnd()*20,rnd()*3,0,7);g.fill();}
      g.fillStyle='#4c6f9c';for(let y=40;y<h;y+=90)for(let x=30;x<w;x+=60)g.fillRect(x,y,16,6);g.strokeStyle='rgba(40,60,90,.5)';g.lineWidth=3;for(let y=0;y<h;y+=h/3){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}}),roughness:.6,metalness:.4}));
  plat.position.set(gx,.02,kz);plat.receiveShadow=true;SC.add(plat);
  const rayT=tx(1024,64,(g,w,h)=>{g.fillStyle='#2f5fb0';g.fillRect(0,0,w,h);g.fillStyle='rgba(255,255,255,.18)';g.fillRect(0,0,w,6);g.fillStyle='#ffffff';g.font=`800 40px ${COND}`;g.textBaseline='middle';for(let x=60;x<w;x+=420){g.fillText('MAX 60 TON',x,h/2+2);g.fillText('CE',x+270,h/2+2);}});
  const rayM=mk({map:rayT,roughness:.45,metalness:.5});
  [-1,1].forEach(s=>{const r=new T.Mesh(new T.BoxGeometry(.22,.32,KL),[mat.mavi,mat.mavi,mat.mavi,mat.mavi,rayM,rayM]);r.position.set(gx+s*(KW/2-.1),.16,kz);r.castShadow=true;SC.add(r);
    SC.add(kutu(.55,.34,KL,mat.sari,gx+s*(KW/2+.38),.17,kz));
    const rampa=new T.Mesh(new T.BoxGeometry(.55,.32,1.6),mat.sari);rampa.position.set(gx+s*(KW/2+.38),.07,kz+KL/2+.75);rampa.rotation.x=.2;SC.add(rampa);});
  // ---------- istinat duvarı + tel çit + jiletli tel ----------
  const DH=2.8;
  const duvar=(x0,z0,x1,z1,cit=true)=>{const L=Math.hypot(x1-x0,z1-z0);if(L<.5)return;const ang=-Math.atan2(z1-z0,x1-x0),cx=(x0+x1)/2,cz=(z0+z1)/2;
    const dm=mat.duvar.clone();dm.map=rep(duvarT,L/12,1);const d=new T.Mesh(new T.BoxGeometry(L,DH,.35),dm);d.position.set(cx,DH/2,cz);d.rotation.y=ang;d.castShadow=d.receiveShadow=true;SC.add(d);
    {const k=kutu(L,.12,.5,mat.beton,cx,DH+.06,cz,false);k.rotation.y=ang;SC.add(k);}
    if(cit){const tm=mat.tel.clone();tm.map=rep(telT,L/2.5,1);const t=new T.Mesh(new T.PlaneGeometry(L,2),tm);t.position.set(cx,DH+1.1,cz);t.rotation.y=ang;SC.add(t);
      jiletHat.push([x0,z0,x1,z1]);}};
  const jiletHat=[];
  const yesilD=mk({color:'#2f6e45',roughness:.5,metalness:.4});const citDirekleri=[];
  [[0,0,62.7,0],[62.7,0,62.7,53.5],[26,53.5,62.7,53.5],[26,46,26,53.5],[-2.6,46,12,46]].forEach(([a,b,c,d])=>{const [x0,z0,x1,z1]=[X(a),Z(b),X(c),Z(d)];duvar(x0,z0,x1,z1);const L=Math.hypot(x1-x0,z1-z0);for(let k=0;k<=L;k+=2.5){const t=k/L;citDirekleri.push([x0+(x1-x0)*t,z0+(z1-z0)*t]);}});
  // jiletli tel: çit tepesinde, duvar boyunca uzanan bobin (her halka hafif çapraz → concertina görünümü)
  {const halkalar=[];jiletHat.forEach(([x0,z0,x1,z1])=>{const L=Math.hypot(x1-x0,z1-z0),a=Math.atan2(z1-z0,x1-x0);for(let k=.15,i=0;k<L-.1;k+=.2,i++){const t=k/L;halkalar.push([x0+(x1-x0)*t,z0+(z1-z0)*t,a,i]);}});
    const hg=new T.TorusGeometry(.3,.011,4,18);const hm=mk({color:'#b9c0c7',roughness:.3,metalness:.88});const hI=new T.InstancedMesh(hg,hm,halkalar.length);
    const e=new T.Euler(0,0,0,'YXZ'),qq=new T.Quaternion(),pp=new T.Vector3(),ss=new T.Vector3(1,1,1);
    halkalar.forEach(([x,z,a,i],n)=>{e.set(0,-a+Math.PI/2+(i%2?.42:-.42),0);qq.setFromEuler(e);pp.set(x,DH+2.42,z);m4.compose(pp,qq,ss);hI.setMatrixAt(n,m4);});SC.add(hI);}
  {const dI=new T.InstancedMesh(new T.BoxGeometry(.07,2.5,.07),yesilD,citDirekleri.length);citDirekleri.forEach(([x,z],i)=>{m4.makeTranslation(x,DH+1.25,z);dI.setMatrixAt(i,m4);});SC.add(dI);}
  // PCS | EURO TÜRK panosu (kuzey duvarı, kantarın solunda) ve doğu duvarı; "KANTARA YAVAŞ GİRİNİZ" tabelası
  const pano=new T.Mesh(new T.PlaneGeometry(9,1.76),mk({map:panoT,roughness:.5,emissive:'#ffffff',emissiveIntensity:0}));pano.material.emissiveMap=panoT;pano.position.set(X(11.2),1.62,Z(0)+.19);SC.add(pano);
  const pano2=pano.clone();pano2.rotation.y=-Math.PI/2;pano2.position.set(X(62.7)-.19,1.62,Z(26));SC.add(pano2);
  {const t=new T.Mesh(new T.PlaneGeometry(.9,1.15),mk({map:tx(256,320,g=>{g.fillStyle='#fff';g.fillRect(0,0,256,320);g.strokeStyle='#222';g.lineWidth=8;g.strokeRect(10,10,236,300);g.fillStyle='#16181b';g.font=`800 50px ${COND}`;g.textAlign='center';g.fillText('KANTARA',128,100);g.fillText('YAVAŞ',128,170);g.fillText('GİRİNİZ',128,240);}),roughness:.5}));
    t.position.set(X(23.3),1.5,Z(0)+.19);SC.add(t);}
  SLOTS.forEach(s=>{if(s.kol==='B')return;const mx=(s.r[0]+s.r[2])/2;const n=new T.Mesh(new T.PlaneGeometry(.7,.7),mk({map:yazi(String(s.no),{w:128,h:128,bg:'#ffffff',fg:'#16181b',font:84,ls:0,fam:COND}),roughness:.5}));
    if(s.kol==='K')n.position.set(X(mx),2.25,Z(0)+.19);else{n.rotation.y=Math.PI;n.position.set(X(mx),2.25,Z(53.5)-.19);}SC.add(n);});
  // ---------- güvenlik kulübesi (taş kaplama) + bariyerler ----------
  const kulube=(x,z,ry=0)=>{const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry;
    g.add(kutu(2.6,.25,2.6,mat.beton,0,.12,0),kutu(2.5,2.45,2.5,mat.tas,0,1.47,0),kutu(2.62,.12,2.62,mat.koyuGri,0,2.75,0),kutu(2.7,.08,2.7,mat.panel,0,2.84,0));
    g.add(dikey(.9,2.0,mat.beyazKapi,.55,1.25,1.262),dikey(1,.8,mat.koyuGri,-.55,1.75,1.258),dikey(.9,.7,mat.cam,-.55,1.75,1.262),dikey(.8,.7,mat.cam,1.262,1.75,0,Math.PI/2));
    g.add(kutu(3.2,.08,2.4,mat.koyuGri,2.8,2.7,0),kutu(.08,2.6,.08,mat.koyuGri,4.3,1.35,1.1),kutu(.08,2.6,.08,mat.koyuGri,4.3,1.35,-1.1),kutu(.4,.3,.15,mat.koyu,.6,3.2,1.2,false),kutu(.05,.5,.05,mat.koyuGri,.6,2.95,1.2,false));
    SC.add(g);return g;};
  const kolT=tx(512,16,(g,w,h)=>{g.fillStyle='#f6f7f8';g.fillRect(0,0,w,h);for(let x=40;x<w;x+=90){g.fillStyle='#d42a2f';g.fillRect(x,0,14,h);}});const kolMat=mk({map:kolT,roughness:.4});
  const bariyer=(px,pz,ry,L,uc)=>{const g=new T.Group();g.position.set(px,0,pz);g.rotation.y=ry;g.add(kutu(.42,1.15,.36,mat.turuncu,0,.58,0),kutu(.46,.06,.4,mat.koyu,0,1.18,0));
    const piv=new T.Group();piv.position.set(.1,1.0,0);const kol=new T.Mesh(new T.BoxGeometry(L,.1,.1),kolMat);kol.position.x=L/2;kol.castShadow=true;piv.add(kol);g.add(piv);
    if(uc)g.add(kutu(.08,.9,.08,mat.turuncu,L+.15,.45,0));SC.add(g);return piv;};
  kulube(X(29),Z(47.5),-Math.PI/2);
  const bz=Z(46.4);const bGir=bariyer(X(17.9),bz,0,3.85,true),bCik=bariyer(X(25.45),bz,Math.PI,3.4,false);
  SC.add(kutu(2,1.3,1.1,mk({color:'#b7bdc3',roughness:.4,metalness:.6}),X(33),.85,Z(48.6)));
  // ---------- bekleme salonu (taş kaplama, kuzeybatı köşe; kapı doğuya) ----------
  {const bs=new T.Group();bs.position.set(X(1.8),0,Z(5.2));bs.rotation.y=Math.PI/2;
    bs.add(kutu(6.6,.55,2.9,mat.beton,0,.27,0),kutu(6.2,2.45,2.5,mat.tas,0,1.78,0),kutu(6.3,.15,2.6,mat.koyuGri,0,3.06,0),kutu(6.5,.08,2.8,mat.panel,0,3.16,0));
    [-3.08,-1.05,1.05,3.08].forEach(x=>bs.add(kutu(.1,2.45,2.54,mat.koyuGri,x,1.78,0,false)));bs.add(kutu(6.24,.12,2.54,mat.koyuGri,0,.6,0,false));
    bs.add(dikey(.95,2.05,mat.beyazKapi,0,1.62,1.262),dikey(.5,.22,mk({map:yazi('BEKLEME SALONU',{w:512,h:220,bg:'#ffffff',fg:'#1a1d21',font:58,ls:2}),roughness:.5}),0,2.1,1.27));
    [-2.05,2.05].forEach(x=>{bs.add(dikey(1.1,1.15,mat.koyuGri,x,1.95,1.256),dikey(.95,1.0,mat.cam,x,1.95,1.262));});
    bs.add(kutu(2.4,.22,1.2,mat.koyu,0,.38,1.9),kutu(2.0,.22,.6,mat.koyu,0,.16,2.6));
    bs.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});SC.add(bs);}
  // kuzey duvarı önünde beton bloklar, kısa konteyner
  SC.add(kutu(X(14.2)-X(5),.8,1.8,mat.beton,(X(5)+X(14.2))/2,.4,Z(1.2)));
  const konT=tx(512,128,(g,w,h)=>{g.fillStyle='#7f8b96';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=12){g.fillStyle='rgba(255,255,255,.12)';g.fillRect(x,0,4,h);g.fillStyle='rgba(0,0,0,.14)';g.fillRect(x+6,0,4,h);}gurultu(g,w,h,3000,['#6f7a84','#93a0ab','#8a6a50'],.4,1,3);});
  SC.add(kutu(7.6,2.5,2.4,mk({map:konT,roughness:.6,metalness:.4}),X(5.1),1.25,Z(19.45)));
  // ---------- antrepo (batı; beyaz sandviç panel, koyu saçak, siyah kepenkli kapılar) ----------
  const AL=74,AD=13.4,AH=9.2,acx=X(-2.6)-AD/2,acz=Z(27);
  const ag=new T.Group();ag.position.set(acx,0,acz);ag.rotation.y=Math.PI/2;SC.add(ag);
  {const am=mat.panel.clone();am.map=rep(panelT,AL/6,1);ag.add(kutu(AL,AH,AD,am,0,AH/2,0));
    const catiG=new T.BufferGeometry();{const h2=1.6,x0=-AL/2-.3,x1=AL/2+.3,z0=-AD/2-.3,z1=AD/2+.3;catiG.setAttribute('position',new T.BufferAttribute(new Float32Array([x0,0,z0, x1,0,z0, x1,h2,0, x0,0,z0, x1,h2,0, x0,h2,0, x0,0,z1, x0,h2,0, x1,h2,0, x0,0,z1, x1,h2,0, x1,0,z1]),3));catiG.computeVertexNormals();}
    const ct=new T.Mesh(catiG,mk({color:'#cfd4d8',roughness:.5,metalness:.55,side:T.DoubleSide}));ct.position.y=AH;ct.castShadow=true;ag.add(ct);
    const ucgen=new T.Shape();ucgen.moveTo(-AD/2,0);ucgen.lineTo(AD/2,0);ucgen.lineTo(0,1.6);ucgen.closePath();[-1,1].forEach(s=>{const m=new T.Mesh(new T.ShapeGeometry(ucgen),mat.panel);m.rotation.y=Math.PI/2;m.position.set(s*AL/2,AH,0);ag.add(m);});
    ag.add(kutu(AL+.2,.55,.2,mat.koyuGri,0,AH-.3,AD/2+.1,false),dikey(AL-2,.8,mat.cam,0,AH-1.2,AD/2+.02));}
  const tabela=new T.Mesh(new T.PlaneGeometry(20,1.9),mk({map:yazi('ANTREPO · Z34089',{w:1300,h:124,bg:'#ffffff',fg:'#1c3f94',font:84,ls:10}),roughness:.5,emissive:'#ffffff',emissiveIntensity:0}));tabela.material.emissiveMap=tabela.material.map;
  tabela.position.set(acz-Z(24),AH-2.9,AD/2+.04);ag.add(tabela);
  const kapiIsiklari=[];
  DOORS.forEach(d=>{const lx=acz-Z(d.mz),fz=AD/2;
    ag.add(dikey(3.6,4.2,mat.kepenk,lx,2.1,fz+.03),kutu(4.0,.45,.45,mat.koyuGri,lx,4.45,fz+.22,false),kutu(.3,4.4,.18,mat.koyuGri,lx-1.95,2.2,fz+.09,false),kutu(.3,4.4,.18,mat.koyuGri,lx+1.95,2.2,fz+.09,false));
    const kt=new T.Mesh(new T.PlaneGeometry(1.1,.5),mk({map:yazi(d.label,{w:192,h:96,bg:'#ffffff',fg:'#1a1d21',font:64,ls:0}),roughness:.5}));kt.position.set(lx+2.6,4.3,fz+.05);ag.add(kt);
    const l=kutu(.7,.18,.3,mat.lamba.clone(),lx,5.0,fz+.3,false);kapiIsiklari.push(l);ag.add(l);});
  // ---------- güneydeki ofisler ve otopark ----------
  const ofis=(a,b,c,d,h)=>{const w=X(c)-X(a),dd=Z(d)-Z(b),cx=(X(a)+X(c))/2,cz=(Z(b)+Z(d))/2;const m=mat.panel.clone();m.map=rep(panelT,w/6,1);SC.add(kutu(w,h,dd,m,cx,h/2,cz));
    SC.add(kutu(w+.3,.4,dd+.3,mat.koyuGri,cx,h+.1,cz),kutu(w-.3,.08,dd-.3,mat.cati,cx,h+.32,cz,false),dikey(w-1.2,1.1,mat.cam,cx,h*.6,Z(d)+.01),dikey(w-1.2,1.1,mat.cam,cx,h*.6,Z(b)-.01,Math.PI));};
  ofis(26.5,54.5,35,62,4.2);ofis(37.5,54.5,45,62,4.2);ofis(48,54.5,55.5,62,4.6);ofis(57,54.5,66,60,3.8);
  {const arac=[];for(let mx=27.5;mx<62;mx+=2.6)if(rnd()<.72)arac.push([mx,63.7]);for(let mx=28.5;mx<60;mx+=2.6)if(rnd()<.5)arac.push([mx,66.8]);
    const gI=new T.InstancedMesh(new T.BoxGeometry(1.8,.75,4.3),mk({color:'#ffffff',roughness:.35,metalness:.5}),arac.length),uI=new T.InstancedMesh(new T.BoxGeometry(1.6,.6,2.2),mk({color:'#1a222b',roughness:.15,metalness:.6}),arac.length);
    const renkler=['#e9eaec','#c9ccd0','#2a2d33','#7a2025','#1f3d6e','#9aa0a6','#ffffff'];const cc=new T.Color();
    arac.forEach(([mx,mz],i)=>{m4.makeTranslation(X(mx),.6,Z(mz));gI.setMatrixAt(i,m4);m4.makeTranslation(X(mx),1.25,Z(mz)+.2);uI.setMatrixAt(i,m4);gI.setColorAt(i,cc.set(renkler[i%renkler.length]));});
    gI.castShadow=uI.castShadow=true;SC.add(gI,uI);}
  SC.add(kutu(2.2,1.6,2.2,mat.kirmizi,X(63.5),.8,Z(64.6)));
  // ---------- kuzeyde sürülmüş tarla, doğuda komşu saha ----------
  const sururT=tx(1024,512,(g,w,h)=>{g.fillStyle='#6e5238';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=6){g.fillStyle=y%12?'rgba(40,28,18,.35)':'rgba(150,120,90,.25)';g.fillRect(0,y+rnd()*2,w,3);}gurultu(g,w,h,20000,['#5a4230','#86684a','#4d3828'],.5,1,3);
    for(let i=0;i<30;i++){g.fillStyle='rgba(90,120,60,.25)';g.beginPath();g.ellipse(rnd()*w,rnd()*h,20+rnd()*60,6+rnd()*14,0,0,7);g.fill();}});
  alan(-6,-28,64,-3.5,mk({map:sururT,roughness:1}),.01);
  alan(66,-22,96,72,betonM(30,94),.02);
  {const cx=X(71.5),cz=Z(5);SC.add(kutu(9,3.2,5,mat.ev,cx,1.6,cz),kutu(9.6,.3,5.6,mat.evKiremit,cx,3.35,cz));}
  // ---------- tır modelleri ----------
  // Gerçek ölçüler (metre): çekici ≈6 m (arka x≈2,45 … ön tampon x≈8,6), kabin genişliği 2,49, tavan 3,76–4,0; dorse 13,6 × 2,55,
  // üstü 4,0, taban ≈1,25; teker Ø1,05. Ortak geometriler tip başına bir kez üretilir; her tırın sabit parçaları malzemeye göre
  // tek bir ağa birleştirilir (TV'de akıcılık için), yalnızca tekerler ayrı kalır (döndükleri için).
  const boyaC=new Map();const boya=r=>{if(!boyaC.has(r)){const m=new T.MeshPhysicalMaterial({color:r,metalness:.42,roughness:.34,clearcoat:.8,clearcoatRoughness:.1});tumMat.push(m);boyaC.set(r,m);}return boyaC.get(r);};
  const plastik=mk({color:'#1b1d20',roughness:.72,metalness:.05}),plastikCift=mk({color:'#1b1d20',roughness:.72,metalness:.05,side:T.DoubleSide}),alu=mk({color:'#cdd2d7',roughness:.26,metalness:.9}),
    kirli=mk({color:'#2a2b2c',roughness:.88,metalness:.3}),gri2=mk({color:'#8e959c',roughness:.45,metalness:.6}),cizgi=mk({color:'#0b0c0e',roughness:.8}),
    reflSari=mk({color:'#e8b21a',emissive:'#7a5200',emissiveIntensity:.25,roughness:.4}),dorseBeyaz=mk({color:'#e2e5e8',roughness:.55,metalness:.12}),
    altKiris=mk({color:'#b9bfc5',roughness:.32,metalness:.78}),frigoM=mk({color:'#eef0f2',roughness:.32,metalness:.12}),
    lastikM=mk({color:'#17181a',roughness:.9,side:T.DoubleSide}),jantYuz=mk({map:jantT,roughness:.26,metalness:.88}),jantYuzK=mk({map:jantT,color:'#80878f',roughness:.35,metalness:.8}),
    urMat=mk({map:tx(256,16,(g,w,h)=>{for(let x=-16;x<w;x+=16){g.fillStyle='#c8202a';g.beginPath();g.moveTo(x,0);g.lineTo(x+8,0);g.lineTo(x+8+h,h);g.lineTo(x+h,h);g.fill();g.fillStyle='#f2f2f0';g.beginPath();g.moveTo(x+8,0);g.lineTo(x+16,0);g.lineTo(x+16+h,h);g.lineTo(x+8+h,h);g.fill();}}),roughness:.4});
  const izgM=new Map();const izgMat=k=>{if(!izgM.has(k))izgM.set(k,mk({map:IZG[k],roughness:.4,metalness:.6}));return izgM.get(k);};
  // ortak geometriler
  const lastikG=(()=>{const R=.525,r0=.33,hw=.19;const p=[[r0,-hw+.015],[R-.07,-hw],[R-.02,-hw+.035],[R,-hw+.09],[R,hw-.09],[R-.02,hw-.035],[R-.07,hw],[r0,hw-.015]].map(([a,b])=>new T.Vector2(a,b));const g=new T.LatheGeometry(p,40);g.rotateX(Math.PI/2);return g;})();
  const jantG=(()=>{const g=new T.CylinderGeometry(.335,.335,.33,32);g.rotateX(Math.PI/2);return g;})();
  const kemerG=(()=>{const g=new T.CylinderGeometry(.64,.64,.44,24,1,true,-Math.PI/2,Math.PI);g.rotateX(-Math.PI/2);return g;})();
  const tankG=(()=>{const g=new T.CylinderGeometry(.33,.33,1.45,28);g.rotateZ(Math.PI/2);return g;})(),hTankG=(()=>{const g=new T.CylinderGeometry(.15,.15,1.2,16);g.rotateZ(Math.PI/2);return g;})(),egzG=new T.CylinderGeometry(.075,.075,1.5,14);
  const camG=new T.PlaneGeometry(2.24,.96),camCerG=new T.PlaneGeometry(2.42,1.1);
  const perdeG=(()=>{const L=13.3,hh=2.42,g=new T.PlaneGeometry(L,hh,82,6);const p=g.attributes.position,ad=L/20.5;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);const u=(((x+L/2)%ad)+ad)%ad/ad,v=(y+hh/2)/hh;p.setZ(i,.03*Math.sin(Math.PI*u)*Math.sin(Math.PI*Math.min(1,v*1.12))+.012*Math.sin(v*9+x*.7));}g.computeVertexNormals();return g;})();
  const kabinGC=new Map();const kabinGeo=top=>{if(kabinGC.has(top))return kabinGC.get(top);const s=new T.Shape();
    const k=.04;s.moveTo(6.2+k,1.05+k);s.lineTo(8.28-k,1.05+k);s.quadraticCurveTo(8.42-k,1.05+k,8.42-k,1.2+k);s.lineTo(8.40-k,2.36);s.lineTo(8.37-k,2.46);s.lineTo(8.18-k,3.38);
    s.quadraticCurveTo(8.12-k,3.6-k,7.9-k,3.64-k);s.quadraticCurveTo(7.66,top-.02-k,7.32,top-k);s.lineTo(6.42+k,top-k);s.quadraticCurveTo(6.2+k,top-k,6.2+k,top-.22);s.lineTo(6.2+k,1.05+k);
    const g=new T.ExtrudeGeometry(s,{depth:2.21,bevelEnabled:true,bevelThickness:.14,bevelSize:.1,bevelSegments:6,curveSegments:12});g.translate(0,0,-1.105);g.computeVertexNormals();kabinGC.set(top,g);return g;};
  // tekerler: her tırda yalnızca konum/dönüş taşıyan boş düğümler; çizim, bütün tekerler için tek bir InstancedMesh ile yapılır
  const tumTekerler=new Set(),TMAX=640;
  const lastikI=new T.InstancedMesh(lastikG,lastikM,TMAX),jantI=new T.InstancedMesh(jantG,jantYuz,TMAX),jantKI=new T.InstancedMesh(jantG,jantYuzK,TMAX/2);
  [lastikI,jantI,jantKI].forEach(m=>{m.frustumCulled=false;m.count=0;m.receiveShadow=true;SC.add(m);});lastikI.castShadow=true;
  function teker(x,z,g,list,koyu){const w=new T.Object3D();w.position.set(x,.525,z);w.userData.koyu=!!koyu;g.add(w);list&&list.push(w);tumTekerler.add(w);return w;}
  function tekerGuncelle(){SC.updateMatrixWorld();let a=0,b=0,c=0;for(const w of tumTekerler){if(a>=TMAX)break;lastikI.setMatrixAt(a++,w.matrixWorld);if(w.userData.koyu){if(c<TMAX/2)jantKI.setMatrixAt(c++,w.matrixWorld);}else if(b<TMAX)jantI.setMatrixAt(b++,w.matrixWorld);}
    lastikI.count=a;jantI.count=b;jantKI.count=c;[lastikI,jantI,jantKI].forEach(m=>m.instanceMatrix.needsUpdate=true);}
  // çekici tarzları (gerçek renk tonları; marka/logo yok)
  const ST={volvo:{renk:'#1f3a74',top:3.88,gunes:true,iz:'v',tampon:'#1f3a74'},daf:{renk:'#e3e6e9',top:4.0,iz:'d',tampon:'#e3e6e9'},
    actros:{renk:'#d3d8dc',top:3.82,iz:'m',tampon:'#4b5157'},scania:{renk:'#2e5b45',top:3.76,gunes:true,iz:'s',tampon:'#2e5b45'},
    euro:{renk:'#e9ebed',top:4.0,iz:'d',euro:true,tampon:'#e9ebed'},bordo:{renk:'#6e1c22',top:3.85,gunes:true,iz:'s',tampon:'#6e1c22'}};
  const KT=['euro','volvo','daf','euro','actros','scania','euro','daf','bordo','volvo'];
  const euroBandM=mk({map:euroCamT,roughness:.4});
  function cekiciYap(g,tarz,tek,plaka,stopM){const st=ST[tarz],km=boya(st.renk),tm=boya(st.tampon);
    const kb=new T.Mesh(kabinGeo(st.top),km);kb.castShadow=kb.receiveShadow=true;g.add(kb);
    // ön cam ve contası (öne eğimli)
    const ca=new T.Group();ca.position.set(8.352,2.93,0);ca.rotation.z=.205;const c1=new T.Mesh(camCerG,cizgi);c1.rotation.y=Math.PI/2;c1.position.x=-.003;const c2=new T.Mesh(camG,mat.cam);c2.rotation.y=Math.PI/2;c2.position.x=.006;ca.add(c1,c2);[-.52,.52].forEach(z=>{const s=kutu(.02,.025,.95,cizgi,.012,-.42,z,false);s.rotation.x=z>0?.12:-.12;ca.add(s);});g.add(ca);g.add(kutu(.03,.05,2.2,alu,8.405,2.41,0,false));
    // ızgara, farlar, tampon, sis farları, plaka
    g.add(dikey(1.7,.86,izgMat(st.iz),8.476,1.86,0,Math.PI/2));
    [-1,1].forEach(sd=>{g.add(dikey(.4,.3,mat.far,8.478,1.5,sd*1.04,Math.PI/2),dikey(.15,.09,mat.far,8.6,.95,sd*.86,Math.PI/2),kutu(.05,.08,.2,mat.turuncuLamba,8.6,1.16,sd*1.1,false));});
    g.add(kutu(.32,.62,2.5,tm,8.43,.99,0),kutu(.28,.14,2.38,plastik,8.42,.62,0),kutu(.04,.06,2.0,alu,8.6,1.3,0,false));
    g.add(dikey(.52,.114,plakaMat(plaka),8.596,.84,0,Math.PI/2));
    // güneşlik / Euro Türk bandı / tavan lambaları
    if(st.gunes){const gv=new T.Group();gv.position.set(8.28,3.47,0);gv.rotation.z=-.18;gv.add(kutu(.34,.04,2.36,km,.14,0,0,false));g.add(gv);}
    if(st.euro){const eb=new T.Group();eb.position.set(8.21,3.53,0);eb.rotation.z=.6;eb.add(dikey(1.9,.27,euroBandM,.02,0,0,Math.PI/2));g.add(eb);}
    if(st.top>=3.95)[-.6,-.2,.2,.6].forEach(z=>g.add(kutu(.06,.05,.12,mat.turuncuLamba,7.36,st.top+.08,z,false)));
    [-1,1].forEach(sd=>{
      g.add(kutu(.02,2.2,.012,cizgi,7.04,2.32,sd*1.306,false),kutu(1.2,.02,.012,cizgi,7.62,1.22,sd*1.306,false)); // kapı çizgileri
      g.add(dikey(1.02,.8,mat.cam,7.68,3.0,sd*1.307,sd>0?0:Math.PI),kutu(.2,.045,.045,alu,7.2,2.3,sd*1.32,false));
      g.add(kutu(.04,.04,.42,plastik,8.32,3.3,sd*1.45,false),kutu(.04,.04,.42,plastik,8.32,2.55,sd*1.45,false),kutu(.13,.7,.24,km,8.4,2.95,sd*1.68,false),kutu(.11,.28,.21,km,8.42,2.35,sd*1.63,false),dikey(.2,.62,mat.cam,8.334,2.95,sd*1.68,-Math.PI/2)); // aynalar (gövde renginde kapak, arkada ayna camı)
      g.add(kutu(.62,.7,.05,plastik,7.72,.72,sd*1.0,false),kutu(.58,.045,.3,alu,7.72,.46,sd*1.14,false),kutu(.58,.045,.3,alu,7.72,.84,sd*1.14,false)); // basamaklar
      const ark=new T.Mesh(kemerG,plastikCift);ark.position.set(7.2,.53,sd*1.05);g.add(ark);
      g.add(kutu(1.25,.05,.52,plastik,3.6,1.12,sd*1.05),kutu(.03,.55,.5,plastik,2.88,.66,sd*1.05,false),kutu(.22,1.9,.04,km,6.08,2.85,sd*1.26,false));
      if(sd>0){const tk=new T.Mesh(tankG,alu);tk.position.set(5.15,.86,.98);tk.castShadow=true;g.add(tk,kutu(.06,.72,.74,cizgi,4.7,.86,.98,false),kutu(.06,.72,.74,cizgi,5.6,.86,.98,false));}
      else g.add(kutu(.95,.6,.55,plastik,5.25,.9,-.98),kutu(.5,.5,.5,alu,4.45,.92,-.98));});
    g.add(kutu(5.9,.28,.16,kirli,5.35,.95,.45),kutu(5.9,.28,.16,kirli,5.35,.95,-.45),kutu(.2,.2,1.06,kirli,2.55,.95,0)); // şasi
    g.add(kutu(1.1,.1,1.45,gri2,3.75,1.2,0),kutu(.95,.06,1.1,plastik,3.75,1.27,0)); // beşinci teker
    g.add(kutu(.06,.12,.32,stopM,2.47,.92,.82,false),kutu(.06,.12,.32,stopM,2.47,.92,-.82,false));
    if(st.gunes){const eg=new T.Mesh(egzG,alu);eg.position.set(6.02,3.0,-1.12);g.add(eg);}
    teker(7.2,1.06,g,tek);teker(7.2,-1.06,g,tek);teker(3.6,1.06,g,tek,true);teker(3.6,-1.06,g,tek,true);}
  function dorseYap(g,{euro=false,renk=null,tip='tente',tek=null,plaka='',stopM=mat.stop,dusuk=false}={}){const L=13.6,x0=-8.25,x1=5.35,cx=(x0+x1)/2;
    g.add(kutu(12.4,.34,.16,kirli,cx+.4,1.0,.48),kutu(12.4,.34,.16,kirli,cx+.4,1.0,-.48),kutu(L,.1,2.46,kirli,cx,1.2,0)); // şasi, taban
    let zr=1.284;
    if(tip==='frigo'){zr=1.306;g.add(kutu(L,2.72,2.6,frigoM,cx,2.62,0),kutu(.5,1.7,2.1,mk({color:'#d5dbe1',roughness:.35,metalness:.4}),x1+.27,2.95,0),dikey(1.8,1.4,izgMat('s'),x1+.523,2.95,0,Math.PI/2));
      if(renk)[-1,1].forEach(sd=>g.add(kutu(L*.9,.16,.01,boya(renk),cx,1.62,sd*1.305,false)));}
    else{g.add(kutu(L,.2,.06,altKiris,cx,1.36,1.25),kutu(L,.2,.06,altKiris,cx,1.36,-1.25),kutu(L,.12,.07,altKiris,cx,3.93,1.245),kutu(L,.12,.07,altKiris,cx,3.93,-1.245),kutu(L,.05,2.5,dorseBeyaz,cx,3.98,0),kutu(.1,2.74,2.5,dorseBeyaz,x1-.05,2.6,0));
      const tm=tenteMat(euro,renk);[-1,1].forEach(sd=>{const p=new T.Mesh(perdeG,tm);p.position.set(cx,2.66,sd*1.245);if(sd<0)p.rotation.y=Math.PI;p.castShadow=p.receiveShadow=true;g.add(p);});}
    // arka çerçeve, kapılar, kilit kolları
    g.add(kutu(.14,2.72,.12,altKiris,x0+.07,2.62,1.215),kutu(.14,2.72,.12,altKiris,x0+.07,2.62,-1.215),kutu(.14,.22,2.55,altKiris,x0+.07,3.88,0),kutu(.16,.2,2.55,kirli,x0+.08,1.3,0));
    g.add(dikey(2.32,2.42,mat.arka,x0-.002,2.6,0,-Math.PI/2));
    [-.95,-.35,.35,.95].forEach(z=>g.add(kutu(.04,2.36,.045,alu,x0-.03,2.6,z,false),kutu(.05,.05,.24,plastik,x0-.06,1.95,z+.1,false)));
    [-1.12,1.12].forEach(z=>g.add(kutu(.03,.06,.1,stopM,x0-.02,3.9,z,false)));
    // arka alt koruma, lambalar, plaka, yangın tüpü kutusu
    g.add(kutu(.1,.16,2.36,urMat,x0+.16,.56,0),kutu(.1,.48,.1,kirli,x0+.24,.84,.7,false),kutu(.1,.48,.1,kirli,x0+.24,.84,-.7,false),kutu(.1,.07,2.44,kirli,x0+.2,.92,0,false));
    [-1,1].forEach(sd=>g.add(kutu(.06,.17,.42,stopM,x0+.13,1.0,sd*.92,false),kutu(.061,.17,.1,mat.turuncuLamba,x0+.128,1.0,sd*1.18,false),kutu(.061,.08,.1,mat.beyaz,x0+.128,1.0,sd*.66,false)));
    if(plaka)g.add(dikey(.52,.114,plakaMat(plaka),x0+.09,1.0,0,-Math.PI/2));
    g.add(kutu(.42,.5,.34,mat.kirmizi,x0+.75,.88,.93));
    // yan korumalar, reflektörler, yan lambalar, çamurluklar
    [-1,1].forEach(sd=>{g.add(kutu(5.4,.07,.05,gri2,-.95,.5,sd*1.2,false),kutu(5.4,.07,.05,gri2,-.95,.86,sd*1.2,false));
      [-3.4,-.95,1.5].forEach(x=>g.add(kutu(.07,.45,.24,kirli,x,.75,sd*1.1,false)));
      g.add(kutu(L-.8,.05,.006,reflSari,cx,1.3,sd*zr,false));for(let x=x0+.8;x<x1-.6;x+=2.6)g.add(kutu(.09,.06,.02,mat.turuncuLamba,x,1.15,sd*1.27,false));
      g.add(kutu(3.95,.04,.5,plastik,-5.36,1.13,sd*1.07),kutu(.02,.5,.48,plastik,-7.28,.68,sd*1.07,false),kutu(.02,.36,.48,plastik,-3.42,.82,sd*1.07,false));});
    // ayaklar (bağlıyken kalkık, tek başına dururken inik), takım kutusu, hava tankları, dingiller
    const ayH=dusuk?1.15:.88,ayY=dusuk?.625:.76,taY=dusuk?.03:.3;
    [-1,1].forEach(sd=>g.add(kutu(.15,ayH,.15,gri2,2.4,ayY,sd*.85),kutu(.34,.05,.34,kirli,2.4,taY,sd*.85,false)));
    g.add(kutu(.06,.06,1.7,gri2,2.4,.85,0,false),kutu(.04,.04,.32,alu,2.4,1.0,1.03,false),kutu(.9,.42,.42,plastik,.4,.93,-.95));
    [-.3,.3].forEach(z=>{const tk=new T.Mesh(hTankG,gri2);tk.position.set(-1.6,.98,z);g.add(tk);});
    [-4.05,-5.36,-6.67].forEach(x=>{g.add(kutu(.13,.13,2.0,kirli,x,.53,0,false));teker(x,1.07,g,tek);teker(x,-1.07,g,tek);});
    g.add(kutu(3.2,.18,.16,kirli,-5.36,.86,.62,false),kutu(3.2,.18,.16,kirli,-5.36,.86,-.62,false));
    return stopM;}
  // aynı malzemedeki parçaları tek ağa birleştir (çizim çağrısı sayısını düşürür)
  function birlestir(root,haric){root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert();const gr=new Map(),sil=[];
    root.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;for(let p=o;p&&p!==root;p=p.parent)if(haric.has(p))return;
      const ge=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();ge.applyMatrix4(new T.Matrix4().multiplyMatrices(inv,o.matrixWorld));
      if(!ge.attributes.uv)ge.setAttribute('uv',new T.BufferAttribute(new Float32Array(ge.attributes.position.count*2),2));
      const k=o.material.uuid+(o.castShadow?'s':'');if(!gr.has(k))gr.set(k,{m:o.material,gs:[],sh:o.castShadow});gr.get(k).gs.push(ge);sil.push(o);});
    sil.forEach(o=>o.parent.remove(o));
    for(const {m,gs,sh} of gr.values()){let n=0;gs.forEach(x=>n+=x.attributes.position.count);const P=new Float32Array(n*3),N=new Float32Array(n*3),U=new Float32Array(n*2);let o=0;
      gs.forEach(x=>{P.set(x.attributes.position.array,o*3);N.set(x.attributes.normal.array,o*3);U.set(x.attributes.uv.array,o*2);o+=x.attributes.position.count;x.dispose();});
      const bg=new T.BufferGeometry();bg.setAttribute('position',new T.BufferAttribute(P,3));bg.setAttribute('normal',new T.BufferAttribute(N,3));bg.setAttribute('uv',new T.BufferAttribute(U,2));bg.computeBoundingSphere();
      const me=new T.Mesh(bg,m);me.castShadow=sh;me.receiveShadow=true;root.add(me);}}
  const hash=s=>{let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))|0;return Math.abs(h);};
  // tırsız duran dorseler: kantarın yanında bir tane (uydu görüntüsündeki gibi) ve doğudaki komşu sahada
  const sabitDorse=(mx,mz,ang,o={})=>{const g=new T.Group();dorseYap(g,{...o,dusuk:true});birlestir(g,new Set());const [x,z]=Q(mx,mz);g.position.set(x,0,z);g.rotation.y=-ang;SC.add(g);};
  const sabitDorseler=()=>{const D=modelD?(mx,mz,ang,o={})=>{const g=new T.Group();glbDorse(g,o.renk||null,'',null,true);const [x,z]=Q(mx,mz);g.position.set(x,0,z);g.rotation.y=-ang;SC.add(g);}:sabitDorse;
    D(15.9,6.15,-Math.PI/2,{euro:true});
    for(let i=0;i<6;i++)D(69.5+i*3.9,17.4,-Math.PI/2,{euro:i%2===0,tip:i===3?'frigo':'tente',renk:[null,'#2a6fd1',null,null,'#c9302c',null][i]});
    for(let i=0;i<4;i++)D(71+i*3.9,46.6,Math.PI/2,{euro:i%2===1});};
  // ---------- gerçek tır modelleri (Sketchfab, CC BY 4.0 — künye sayfanın altında) ----------
  // çekici: "MAN TGX 2010 V8" (DevPoly3D), dorse: "Semi Trailer" (NoblecatSoft). sadeleştirilmiş GLB, base64 olarak .json içinde.
  // Yerel eksen: +x ileri, beşinci teker x=4.21; çekici önü x≈8.6, dorse arkası x≈-8.43 (eski prosedürel tırla aynı ölçü).
  let modelC=null,modelD=null,modelDurum=0; // 0 yükleniyor, 1 hazır, 2 başarısız → prosedürel tır
  const glbHazirla=(sc,s,ry,ox,oy)=>{const g=new T.Group();sc.scale.setScalar(s);sc.rotation.y=ry;sc.position.set(ox,oy,0);g.add(sc);
    sc.traverse(o=>{if(!o.isMesh)return;const m=o.material;tumMat.push(m);o.receiveShadow=true;o.geometry.computeBoundingSphere();o.castShadow=o.geometry.boundingSphere.radius*s>.35;
      if(m.name==='Glass'){m.color.set('#1b2633');m.opacity=.82;m.roughness=.04;m.metalness=.9;m.transparent=true;m.depthWrite=false;}
      if(m.name==='Material'){m.color.set('#0c0e11');m.roughness=.3;} if(m.name==='Darker_Most'||m.name==='dark'){m.roughness=.55;m.metalness=.2;}
      if(m.name==='Metalic'||m.name==='Back_Trailor'){m.roughness=.35;m.metalness=.85;}});return g;};
  const cekBoyaC=new Map();const cekBoya=r=>{if(!cekBoyaC.has(r)){const m=new T.MeshPhysicalMaterial({color:r,metalness:.35,roughness:.28,clearcoat:1,clearcoatRoughness:.08,name:'Grey'});tumMat.push(m);cekBoyaC.set(r,m);}return cekBoyaC.get(r);};
  const CEK_RENK=['#eceff1','#eceff1','#1f3a74','#e3e6e9','#b31b1b','#eceff1','#2e5b45','#c9ced3','#111418','#eceff1','#f0f1ec'];
  // dorse yanı: müşteri renginde alt bant + ön tarafta müşteri adlı renk bloğu
  const yanCache=new Map();const yanMat=(renk,ad)=>{const k=renk+'|'+ad;if(!yanCache.has(k)){const t=tx(1024,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle=renk;g.fillRect(0,h*.55,w,h*.45);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(0,h*.55,w,2);
      if(ad){g.fillStyle=renk;g.fillRect(w-250,0,250,h);g.fillStyle='#fff';g.font=`800 34px ${COND}`;g.textAlign='center';g.textBaseline='middle';g.fillText(ad,w-125,h/2+2);}});
    yanCache.set(k,mk({map:t,transparent:true,alphaTest:.05,roughness:.45,metalness:.1}));}return yanCache.get(k);};
  function glbCekici(g,renk,plaka,stopM){const c=modelC.clone(true);c.traverse(o=>{if(!o.isMesh)return;if(o.material.name==='Grey')o.material=cekBoya(renk);else if(o.material.name==='Red_Light_Back')o.material=stopM;});g.add(c);
    if(plaka)g.add(dikey(.52,.114,plakaMat(plaka),8.63,.5,0,Math.PI/2));}
  function glbDorse(g,renk,plaka,stopM,park){const d=modelD.clone(true);d.traverse(o=>{if(!o.isMesh)return;if(stopM&&o.material.name==='Red_glass_trailer.001')o.material=stopM;});g.add(d);
    if(renk){const ad=Object.keys(CUSTOMERS).find(k=>CUSTOMERS[k]===renk)||'';[-1,1].forEach(sd=>g.add(dikey(13.3,.62,yanMat(renk,sd>0?ad:''),-1.66,1.5,sd*1.272,sd>0?0:Math.PI)));}
    if(plaka)g.add(dikey(.52,.114,plakaMat(plaka),-8.47,.62,0,-Math.PI/2));
    if(park)[-1,1].forEach(sd=>g.add(kutu(.13,.5,.13,gri2,1.15,.25,sd*1.12),kutu(.32,.04,.32,kirli,1.15,.02,sd*1.12,false)));}
  {const G=window.GLTF3;const bitti=()=>{sabitDorseler();};
    // Modeller GLB olarak base64 içinde .json dosyasında gelir: fetch yalnızca sayfanın kendi dosyasını okur,
    // WebAssembly ve data:/blob: fetch gerekmez (artifact çerçevesinin güvenlik kurallarına takılmaz).
    const glbOku=u=>fetch(u).then(r=>{if(!r.ok)throw new Error(u+' '+r.status);return r.json();}).then(j=>{const b=atob(j.glb),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);
      return new Promise((ok,hata)=>{const L=new G.GLTFLoader();const cib=window.createImageBitmap;
        try{window.createImageBitmap=undefined;L.parse(a.buffer,'',ok,hata);}finally{window.createImageBitmap=cib;}});}); // dokular <img> ile yüklenir
    if(G){Promise.all(['saha/cekici.json','saha/dorse.json'].map(glbOku)).then(([c,d])=>{
        modelC=glbHazirla(c.scene,.1438,Math.PI/2,5.504,.06);modelD=glbHazirla(d.scene,4.8,-Math.PI/2,.61,-.043);modelDurum=1;bitti();})
      .catch(e=>{console.warn('Tır modelleri yüklenemedi, sade tır çiziliyor',e);modelDurum=2;bitti();const h=box.querySelector('.s3-hint');if(h)h.textContent='Tır modelleri yüklenemedi ('+String(e&&e.message||e).slice(0,80)+')';});}
    else{modelDurum=2;bitti();}}
  // ---------- direkler: aydınlatma (projektör) + elektrik (kafes) ve kablolar ----------
  const lambalar=[];const projeksiyon=(x,z,ry=0)=>{SC.add(kutu(.28,12,.28,mat.direk,x,6,z));const h=new T.Group();h.position.set(x,12.1,z);h.rotation.y=ry;h.add(kutu(1.3,.2,.2,mat.direk,0,0,0,false));
    [-.45,.45].forEach(o=>{const p=kutu(.55,.42,.16,mat.koyu,o,-.1,.15,false);p.rotation.x=.5;h.add(p);const l=kutu(.46,.32,.02,mat.lamba,o,-.12,.25,false);l.rotation.x=.5;h.add(l);lambalar.push(l);});SC.add(h);};
  [[24.6,.5,0],[57.4,.5,0],[62.2,20,-Math.PI/2],[62.2,37,-Math.PI/2],[33.6,53,Math.PI],[11.2,47.6,0],[-2.2,18,Math.PI/2],[-2.2,38,Math.PI/2]].forEach(([a,b,r])=>projeksiyon(X(a),Z(b),r));
  const gece=[];[[19.75,13],[42,24],[20,56],[46,44],[8,32]].forEach(([a,b])=>{const p=new T.PointLight('#ffd9a8',0,48,1.7);p.position.set(X(a),10,Z(b));SC.add(p);gece.push(p);});
  const parilti=tx(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,240,210,1)');gr.addColorStop(.3,'rgba(255,225,170,.45)');gr.addColorStop(1,'rgba(255,215,160,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const pMat=new T.SpriteMaterial({map:parilti,blending:T.AdditiveBlending,depthWrite:false,transparent:true,opacity:0});
  lambalar.forEach(l=>{const s=new T.Sprite(pMat);s.scale.set(4,4,1);l.updateWorldMatrix(true,false);l.getWorldPosition(s.position);SC.add(s);});
  // elektrik direkleri: biri saha içinde kuzey duvarı önünde (fotoğraftaki gibi), diğerleri tarla kenarı ve doğu şeridi
  const elDirek=[[4,.9]];for(let mx=-8;mx<=72;mx+=26)elDirek.push([mx,-29]);for(let mz=-14;mz<=60;mz+=26)elDirek.push([64.6,mz]);
  const elW=elDirek.map(([a,b])=>[X(a),Z(b)]);
  elW.forEach(([x,z])=>{const h=11+rnd()*1.5;[0,Math.PI/2].forEach(r=>{const p=dikey(.7,h,mat.kafes,x,h/2,z,r);SC.add(p);});SC.add(kutu(1.6,.12,.12,mat.koyu,x,h-.4,z,false));});
  const kabloMat=new T.LineBasicMaterial({color:'#1d1f22',transparent:true,opacity:.75});
  for(let i=1;i<elW.length;i++){const [x0,z0]=elW[i-1],[x1,z1]=elW[i];if(Math.hypot(x1-x0,z1-z0)>45)continue;[-.6,.6].forEach(o=>{const pts=[];for(let k=0;k<=16;k++){const t=k/16;pts.push(new T.Vector3(x0+(x1-x0)*t+o*.7,11.1-Math.sin(Math.PI*t)*1.4,z0+(z1-z0)*t+o*.7));}SC.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),kabloMat));});}
  // ---------- çevre: tepeler, tarlalar, evler, cami, uzak şehir, komşu depolar ----------
  const tepe=(x,z,sx,sy,sz)=>{const m=new T.Mesh(new T.SphereGeometry(1,40,20,0,Math.PI*2,0,Math.PI/2),mat.tarla);m.scale.set(sx,sy,sz);m.position.set(x,-1,z);m.receiveShadow=true;SC.add(m);return m;};
  tepe(-60,-560,380,40,170);tepe(300,-640,300,52,180);tepe(-520,-200,200,30,300);tepe(560,-260,220,34,180);tepe(-560,300,240,26,180);
  // tepedeki evler + cami
  const evGeo=new T.BoxGeometry(1,1,1),catiGeo=(()=>{const g=new T.ConeGeometry(.78,.55,4,1);g.rotateY(Math.PI/4);return g;})();
  const evler=[];for(let i=0;i<46;i++){const a=rnd(),x=-150+a*340+(rnd()-.5)*30,z=-530-rnd()*80;const yh=40*Math.sqrt(Math.max(0,1-((x+60)/380)**2-((z+560)/170)**2))-1;if(yh<4)continue;evler.push([x,yh,z,5+rnd()*5,4+rnd()*4,5+rnd()*4]);}
  const evI=new T.InstancedMesh(evGeo,mat.ev,evler.length),cI=new T.InstancedMesh(catiGeo,mat.evKiremit,evler.length);const q=new T.Quaternion(),s3=new T.Vector3(),p3=new T.Vector3();
  evler.forEach(([x,y,z,w,h,d],i)=>{m4.compose(p3.set(x,y+h/2,z),q.setFromAxisAngle(new T.Vector3(0,1,0),rnd()*1.5),s3.set(w,h,d));evI.setMatrixAt(i,m4);m4.compose(p3.set(x,y+h+1.4,z),q,s3.set(w*1.15,3,d*1.15));cI.setMatrixAt(i,m4);});SC.add(evI,cI);
  {const cx=40,cz=-548,cy=37;const cm=mk({color:'#f1efe9',roughness:.8});SC.add(kutu(16,8,16,cm,cx,cy+4,cz));const kub=new T.Mesh(new T.SphereGeometry(6.2,24,12,0,Math.PI*2,0,Math.PI/2),mk({color:'#9aa6b2',roughness:.4,metalness:.5}));kub.position.set(cx,cy+8,cz);SC.add(kub);
    const min=new T.Mesh(new T.CylinderGeometry(.9,1.0,26,12),cm);min.position.set(cx+11,cy+13,cz);SC.add(min);const kulah=new T.Mesh(new T.ConeGeometry(1.0,4.5,12),mk({color:'#8f9aa6',roughness:.4,metalness:.5}));kulah.position.set(cx+11,cy+28.2,cz);SC.add(kulah);SC.add(kutu(2.6,.5,2.6,cm,cx+11,cy+20,cz));}
  // uzak şehir siluet (doğu / güneydoğu)
  const sehirI=new T.InstancedMesh(evGeo,mat.sehir,70);for(let i=0;i<70;i++){const a=-.9+rnd()*1.5,r=760+rnd()*260,h=20+rnd()*rnd()*130;m4.compose(p3.set(Math.cos(a)*r,h/2-2,Math.sin(a)*r*.7-80),q.identity(),s3.set(14+rnd()*24,h,14+rnd()*24));sehirI.setMatrixAt(i,m4);}SC.add(sehirI);
  // komşu beyaz depolar
  const komsu=(x,z,w,d,h)=>{const m=mat.panel.clone();m.map=rep(panelT,w/6,1);const b=new T.Mesh(new T.BoxGeometry(w,h,d),m);b.position.set(x,h/2,z);b.castShadow=b.receiveShadow=true;SC.add(b);SC.add(kutu(w+.3,.5,d+.3,mat.koyuGri,x,h+.1,z),kutu(w-.3,.1,d-.3,mat.cati,x,h+.38,z,false));};
  komsu(X(-27),Z(27),22,84,10);komsu(X(112),Z(18),30,62,10);komsu(X(32),Z(92),70,18,8);komsu(X(-22),Z(88),30,22,7);komsu(X(-60),Z(-10),26,40,9);
  // ağaçlar
  const yaprak=[mat.agac,mat.agacK];const agac=(x,z,s=1)=>{SC.add(kutu(.4*s,3*s,.4*s,mat.govde,x,1.5*s,z));for(let i=0;i<3;i++){const b=new T.Mesh(new T.IcosahedronGeometry((1.5+rnd()*.9)*s,1),yaprak[i%2]);b.position.set(x+(rnd()-.5)*1.6*s,(3.3+i*.9)*s,z+(rnd()-.5)*1.6*s);b.castShadow=true;SC.add(b);}};
  for(let mx=-40;mx<110;mx+=9+rnd()*10)agac(X(mx),Z(-33-rnd()*10),1+rnd()*.5);
  for(let mz=-30;mz<80;mz+=10+rnd()*8)agac(X(-44-rnd()*8),Z(mz),1+rnd()*.4);
  for(let mz=-10;mz<70;mz+=14+rnd()*8)agac(X(98+rnd()*4),Z(mz),.9+rnd()*.4);
  for(let mx=-30;mx<100;mx+=12+rnd()*10)if(mx<10||mx>70)agac(X(mx),Z(80+rnd()*4),.9+rnd()*.4);
  // sabit sahne parçalarını malzemeye göre birleştir (çizim çağrısı sayısını düşürür)
  {const haric=new Set([bGir,bCik]);SC.traverse(o=>{if(o.isInstancedMesh||o.isSprite||(o.isMesh&&o.renderOrder))haric.add(o);});birlestir(SC,haric);}
  // ---------- gökyüzü ----------
  const gokG=new T.SphereGeometry(1900,32,16);const gokU={ust:{value:new T.Color('#2f6fd8')},alt:{value:new T.Color('#cfe3f7')},gunes:{value:new T.Vector3(0,1,0)},parla:{value:1}};
  const gokM=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,uniforms:gokU,
    vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 ust;uniform vec3 alt;uniform vec3 gunes;uniform float parla;varying vec3 vP;void main(){float h=max(vP.y,0.0);vec3 c=mix(alt,ust,pow(h,0.55));float g=max(dot(vP,normalize(gunes)),0.0);c+=vec3(1.0,.93,.8)*(pow(g,350.0)*2.5+pow(g,12.0)*.18)*parla;gl_FragColor=vec4(c,1.0);}'});
  const gok=new T.Mesh(gokG,gokM);gok.renderOrder=-10;SC.add(gok);
  const bulutlar=[];const bulutM=new T.MeshBasicMaterial({map:bulutT,transparent:true,depthWrite:false,fog:false,color:'#ffffff'});
  for(let i=0;i<16;i++){const a=rnd()*Math.PI*2,r=900+rnd()*500,h=160+rnd()*220;const b=new T.Mesh(new T.PlaneGeometry(420+rnd()*420,170+rnd()*120),bulutM);b.position.set(Math.cos(a)*r,h,Math.sin(a)*r);b.lookAt(0,h*.6,0);b.renderOrder=-9;SC.add(b);bulutlar.push(b);}
  // ---------- ışık ----------
  const hemi=new T.HemisphereLight('#d8e8ff','#a59a84',.85);SC.add(hemi);
  const gunes=new T.DirectionalLight('#fff4e2',3.0);gunes.castShadow=true;gunes.shadow.mapSize.set(4096,4096);const sc=gunes.shadow.camera;sc.left=-80;sc.right=80;sc.top=62;sc.bottom=-62;sc.near=10;sc.far=700;
  gunes.shadow.bias=-.0004;gunes.shadow.normalBias=.05;gunes.shadow.radius=3;SC.add(gunes);SC.add(gunes.target);gunes.target.position.set(ycx,0,ycz);
  SC.fog=new T.Fog('#cfe0f2',320,1500);
  // ortam yansıması (kendi gökyüzünden)
  let pm=null;const envYap=()=>{try{const s2=new T.Scene();s2.add(gok.clone());const yer=new T.Mesh(new T.PlaneGeometry(4000,4000),new T.MeshBasicMaterial({color:'#b9b2a4'}));yer.rotation.x=-Math.PI/2;yer.position.y=-5;s2.add(yer);
    pm=pm||new T.PMREMGenerator(R);const rt=pm.fromScene(s2,.02);SC.environment=rt.texture;}catch(e){}};
  const C=(a)=>new T.Color(a),lerpC=(a,b,t)=>a.clone().lerp(b,t);
  let sonFaz=-1,sonEnv=-1;
  function isik(sim){const h=((sim/60)%24+24)%24;const el=Math.sin(Math.PI*(h-6.2)/13.4);const gun=Math.max(0,Math.min(1,(el+.05)/.35)),aksam=Math.max(0,1-Math.abs(el-.08)/.22)*(h>11?1:.6);
    const az=Math.PI*(h-6)/13;const gx_=Math.cos(az)*-260,gy=Math.max(26,el*300),gz=-160+Math.sin(az)*120;gunes.position.set(gx_,gy,gz);
    gunes.intensity=Math.max(3.1*gun,.3);gunes.color.copy(gun>.02?lerpC(C('#fff4e2'),C('#ffad66'),aksam):C('#9db4ff'));if(gun<=.02)gunes.position.set(160,220,-80);
    hemi.intensity=.2+.9*gun;hemi.color.copy(lerpC(C('#4b5d8a'),C('#d8e8ff'),gun));hemi.groundColor.copy(lerpC(C('#1c2030'),C('#a59a84'),gun));
    const ust=lerpC(lerpC(C('#070d22'),C('#2f6fd8'),gun),C('#34508f'),aksam*.5),alt=lerpC(lerpC(C('#15213d'),C('#cfe3f7'),gun),C('#f3a86a'),aksam*.85);
    gokU.ust.value.copy(ust);gokU.alt.value.copy(alt);gokU.gunes.value.set(gx_,gy,gz).normalize();gokU.parla.value=gun;
    const faz=Math.round(h*6);if(faz!==sonFaz){sonFaz=faz;SC.fog.color.copy(alt);bulutM.color.copy(lerpC(lerpC(C('#2a3550'),C('#ffffff'),gun),C('#ffd2b0'),aksam*.7));
      const ef=Math.round(gun*4);if(ef!==sonEnv){sonEnv=ef;envYap();}}
    const gk=1-gun;gece.forEach(p=>p.intensity=gk*150);mat.lamba.emissiveIntensity=gk*5;kapiIsiklari.forEach(l=>l.material.emissiveIntensity=gk*3);pMat.opacity=gk*.9;
    tabela.material.emissiveIntensity=gk*.4;pano.material.emissiveIntensity=gk*.25;mat.far.emissiveIntensity=.15+gk*3.5;
    const envI=.25+.75*gun;tumMat.forEach(m=>m.envMapIntensity=envI);mat.cam.envMapIntensity=.6+1.9*gun;
    R.toneMappingExposure=1.0+gk*.12;return gk;}
  // ---------- hareketli tır ----------
  const plakaParca=(p,i)=>(String(p).split('/')[i]||String(p).split('/')[0]).trim();
  function tirYap(v){
    const g=new T.Group(),tek=[];const hs=hash(v.id+v.plate);const tarz=KT[hs%KT.length];const stopM=mat.stop.clone();
    if(modelC){stopM.color.set('#5a0d0a');stopM.emissive.set('#ff2a1a');glbCekici(g,CEK_RENK[hs%CEK_RENK.length],plakaParca(v.plate,0),stopM);glbDorse(g,CUSTOMERS[v.customer]||null,plakaParca(v.plate,1),stopM,false);}
    else{cekiciYap(g,tarz,tek,plakaParca(v.plate,0),stopM);
      dorseYap(g,{euro:tarz==='euro'||hs%3===0,renk:CUSTOMERS[v.customer]||null,tip:hs%7===3?'frigo':'tente',tek,plaka:plakaParca(v.plate,1),stopM});
      birlestir(g,new Set(tek));}
    // durum çerçevesi (zeminde)
    const sh=(w,h,r)=>{const s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;};
    const dis=sh(19.2,3.9,1.4),ic=sh(18.6,3.3,1.1);dis.holes.push(ic);
    const halka=new T.Mesh(new T.ShapeGeometry(dis,8),new T.MeshBasicMaterial({color:'#f59e0b',transparent:true,opacity:.95,depthWrite:false}));halka.rotation.x=-Math.PI/2;halka.position.set(.15,.07,0);halka.renderOrder=2;g.add(halka);
    const dolgu=new T.Mesh(new T.ShapeGeometry(sh(19.2,3.9,1.4),8),new T.MeshBasicMaterial({color:'#f59e0b',transparent:true,opacity:.12,depthWrite:false}));dolgu.rotation.x=-Math.PI/2;dolgu.position.set(.15,.065,0);dolgu.renderOrder=1;g.add(dolgu);
    g.traverse(o=>{o.userData.id=v.id;});
    SC.add(g);
    const el=document.createElement('div');el.className='pl3';el.dataset.id=v.id;el.innerHTML=plateHTML(v.plate.split('/')[0].trim())+'<span class="tm"></span>';el.addEventListener('pointerdown',e=>{intro=null;e.stopPropagation();sec(v.id);});ov.appendChild(el);
    return {g,tek,st:[{material:stopM}],halka,dolgu,el,tm:el.querySelector('.tm'),son:null,w:0,secili:false};
  }
  const tirlar=new Map();
  // ---------- kamera ----------
  // Varsayılan: uydu görüntüsü gibi güneyden kuzeye, hafif eğik kuşbakışı. KAPI: videodaki giriş yakın açısı.
  // Açılışta yüksekten tesise süzülen kısa bir giriş geçişi (azaltılmış harekette atlanır); TV modunda yavaş sinematik tur.
  const VARS={tx:0,tz:8,r:112,th:0,ph:.6},KAPI={tx:X(22),tz:Z(41),r:50,th:.12,ph:.98};
  const cam={...VARS},hedef={...VARS};let takip=null,sonEtk=performance.now(),surukle=null,yakinIstek=false;
  let intro=reduce||GOMULU?null:{t:0,sure:5.5,bas:{tx:60,tz:-40,r:430,th:-1.25,ph:.95}};
  try{if(new URLSearchParams(location.search).has('introyok'))intro=null;}catch(e){}
  if(intro)Object.assign(cam,intro.bas);
  function kameraUygula(){const sp=Math.sin(cam.ph);CAM.position.set(cam.tx+cam.r*sp*Math.sin(cam.th),cam.r*Math.cos(cam.ph),cam.tz+cam.r*sp*Math.cos(cam.th));CAM.lookAt(cam.tx,0,cam.tz);}
  const yakinTh=th=>{while(th-cam.th>Math.PI)th-=2*Math.PI;while(th-cam.th<-Math.PI)th+=2*Math.PI;return th;};
  function genel(){takip=null;Object.assign(hedef,{tx:VARS.tx,tz:VARS.tz,r:VARS.r,ph:VARS.ph,th:yakinTh(VARS.th)});}
  function odak(id,yakin){const t=tirlar.get(id);if(!t)return;intro=null;takip=id;hedef.r=yakin?23:Math.min(hedef.r,42);hedef.ph=yakin?1.3:1.08;
    const a=-t.g.rotation.y,fx=Math.cos(a),fz=Math.sin(a),dx=fx*.7-fz*.7,dz=fz*.7+fx*.7;hedef.th=yakinTh(Math.atan2(dx,dz));}
  const el=R.domElement,isaret=new Map();let pinch=0;
  el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);isaret.set(e.pointerId,[e.clientX,e.clientY]);surukle={x:e.clientX,y:e.clientY,hareket:0};box.classList.add('drag');sonEtk=performance.now();});
  el.addEventListener('pointermove',e=>{if(!isaret.has(e.pointerId))return;const [px,py]=isaret.get(e.pointerId);isaret.set(e.pointerId,[e.clientX,e.clientY]);sonEtk=performance.now();
    if(isaret.size===2){const [a,b]=[...isaret.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)hedef.r=Math.max(10,Math.min(320,hedef.r*pinch/d));pinch=d;if(surukle)surukle.hareket+=99;return;}
    const dx=e.clientX-px,dy=e.clientY-py;if(surukle)surukle.hareket+=Math.abs(dx)+Math.abs(dy);hedef.th-=dx*.006;hedef.ph=Math.max(.32,Math.min(1.42,hedef.ph-dy*.005));});
  const birak=e=>{isaret.delete(e.pointerId);if(isaret.size<2)pinch=0;box.classList.remove('drag');
    if(surukle&&surukle.hareket<6&&e.type==='pointerup'){const b=el.getBoundingClientRect();const m=new T.Vector2((e.clientX-b.left)/b.width*2-1,-((e.clientY-b.top)/b.height)*2+1);const ray=new T.Raycaster();ray.setFromCamera(m,CAM);
      const hit=ray.intersectObjects([...tirlar.values()].map(t=>t.g),true).find(h=>h.object.userData.id);if(hit){if(secim!==hit.object.userData.id)sec(hit.object.userData.id);else odak(secim);}else{if(secim)sec(secim);genel();}}
    if(!isaret.size)surukle=null;};
  el.addEventListener('pointerup',birak);el.addEventListener('pointercancel',birak);
  el.addEventListener('wheel',e=>{e.preventDefault();intro=null;hedef.r=Math.max(10,Math.min(320,hedef.r*Math.exp(e.deltaY*.0012)));sonEtk=performance.now();},{passive:false});
  $('s3reset').addEventListener('click',()=>{intro=null;if(secim)sec(secim);genel();});
  $('s3kapi').addEventListener('click',()=>{intro=null;if(secim){sec(secim);sonSecim=secim;}takip=null;Object.assign(hedef,{...KAPI,th:yakinTh(KAPI.th)});});
  $('s3yakin').addEventListener('click',()=>{intro=null;if(secim){if(tirlar.has(secim))odak(secim,true);else yakinIstek=true;return;}yakinIstek=true;
    const id=[...tirlar.keys()].find(k=>araclar.get(k)?.state==='park')||[...tirlar.keys()][0];if(id)sec(id);});
  // ---------- köpek ----------
  // Sahanın ortasında gezinen küçük bir köpek: 12 küçük kutu, gölgesiz; kare() içinde ilerler, yani çizim durunca (görünmüyor / kayıyor) o da durur.
  // Rastgele noktalara yürür, ara sıra durup koklar, tır 6 m yaklaşırsa kaçar. Hareket azaltma tercihinde yerinde durur.
  const kopek=(()=>{
    const g=new T.Group(),S=3;
    const tuy=mk({color:'#c98f50',roughness:.9,metalness:0}),acik=mk({color:'#ecd9b8',roughness:.9,metalness:0}),koyu=mk({color:'#6e4220',roughness:.9,metalness:0}),burun=mk({color:'#1b1b1b',roughness:.6,metalness:0});
    const p=(w,h,d,m,x,y,z,ust=g)=>{const o=kutu(w,h,d,m,x,y,z,false);o.receiveShadow=false;ust.add(o);return o;};
    p(.52,.2,.2,tuy,0,.4,0);                      // gövde
    p(.2,.12,.17,acik,.12,.34,0);                 // göğüs
    const bas=new T.Group();bas.position.set(.3,.5,0);g.add(bas);
    p(.2,.17,.17,tuy,.04,.04,0,bas);              // kafa
    p(.13,.08,.1,acik,.17,-.01,0,bas);            // burun-ağız
    p(.035,.04,.05,burun,.245,.01,0,bas);         // burun ucu
    for(const z of [-1,1]){const k=p(.06,.11,.03,koyu,0,.14,z*.085,bas);k.rotation.x=z*.35;}   // kulaklar
    const kuy=new T.Group();kuy.position.set(-.27,.46,0);g.add(kuy);p(.22,.045,.045,tuy,-.11,0,0,kuy);kuy.rotation.z=.6;   // kuyruk
    const bacak=[];for(const [x,z] of [[.2,.075],[.2,-.075],[-.2,.075],[-.2,-.075]]){const h=new T.Group();h.position.set(x,.3,z);g.add(h);p(.07,.3,.07,tuy,0,-.15,0,h);p(.08,.04,.09,acik,.01,-.29,0,h);bacak.push(h);}
    g.scale.setScalar(S);SC.add(g);
    return {g,bas,kuy,bacak};
  })();
  const kx0=Math.max(yx0+3,ycx-14),kx1=Math.min(yx1-3,ycx+14),kz0=Math.max(yz0+3,ycz-9),kz1=Math.min(yz1-3,ycz+9);
  const K={x:ycx+3,z:ycz+2,yaw:0,hedef:null,bekle:2,hiz:0,faz:0,kuyruk:0,kos:false};
  const kSin=(v,a,b)=>Math.min(b,Math.max(a,v));
  kopek.g.position.set(K.x,0,K.z);
  function kopekAdim(dt){
    if(reduce)return;
    let kd=1e9,kp=null;for(const t of tirlar.values()){const d=Math.hypot(t.g.position.x-K.x,t.g.position.z-K.z);if(d<kd){kd=d;kp=t.g.position;}}
    if(kp&&kd<6){const dx=K.x-kp.x,dz=K.z-kp.z,l=Math.hypot(dx,dz)||1;K.hedef=[kSin(K.x+dx/l*9,kx0,kx1),kSin(K.z+dz/l*9,kz0,kz1)];K.kos=true;K.bekle=0;}
    let vh=0;
    if(K.bekle>0)K.bekle-=dt;
    else{if(!K.hedef){K.hedef=[kx0+Math.random()*(kx1-kx0),kz0+Math.random()*(kz1-kz0)];K.kos=false;}
      const dx=K.hedef[0]-K.x,dz=K.hedef[1]-K.z,d=Math.hypot(dx,dz);
      if(d<.5){K.hedef=null;K.kos=false;K.bekle=1.5+Math.random()*4;}
      else{vh=K.kos?3.4:1.05;let da=Math.atan2(-dz,dx)-K.yaw;da=Math.atan2(Math.sin(da),Math.cos(da));K.yaw+=da*Math.min(1,dt*(K.kos?7:3.5));if(Math.abs(da)>1.2)vh*=.25;}}
    K.hiz+=(vh-K.hiz)*Math.min(1,dt*5);
    K.x=kSin(K.x+Math.cos(K.yaw)*K.hiz*dt,kx0,kx1);K.z=kSin(K.z-Math.sin(K.yaw)*K.hiz*dt,kz0,kz1);
    K.faz+=K.hiz*dt*5.5;K.kuyruk+=dt*(K.hiz>.3?10:6);
    const gen=Math.min(.8,K.hiz*.5);
    kopek.bacak.forEach((h,i)=>{h.rotation.z=Math.sin(K.faz+(i===0||i===3?0:Math.PI))*gen;});
    kopek.g.position.set(K.x,Math.abs(Math.sin(K.faz))*.02*K.hiz,K.z);kopek.g.rotation.y=K.yaw;
    kopek.kuy.rotation.y=Math.sin(K.kuyruk)*(K.hiz>.3?.35:.6);
    kopek.bas.rotation.z=K.bekle>0?-.35*Math.max(0,Math.sin(K.kuyruk*.2)):Math.sin(K.faz*2)*.04;   // dururken ara sıra yere eğilip koklar
  }
  // ---------- boyut ----------
  function boyut(){const w=box.clientWidth,h=box.clientHeight;if(!w||!h)return;R.setSize(w,h,false);CAM.aspect=w/h;CAM.updateProjectionMatrix();const yeni=112*Math.pow(Math.max(1,1.75/CAM.aspect),.85);if(!takip&&Math.abs(hedef.r-VARS.r)<1)hedef.r=yeni;VARS.r=yeni;}
  new ResizeObserver(boyut).observe(box);
  // ---------- kare ----------
  let sonSecim=null,zaman=0,tur=0;const v3=new T.Vector3();
  function kare(dt){zaman+=dt;const sim=kaynak.simdi(),gk=isik(sim);const byId=new Map(son.map(v=>[v.id,v]));
    for(const [id,a] of araclar){const v=byId.get(id);if(!v)continue;let t=tirlar.get(id);if(!t){if(!modelDurum)continue;t=tirYap(v);tirlar.set(id,t);}
      const [X,Z]=P3(a.x,a.y);const ry=-a.ang;
      if(t.son){const d=Math.hypot(X-t.son[0],Z-t.son[1]);const yon=a.mv&&a.mv.rev?-1:1;if(d>0&&d<20)t.tek.forEach(w=>w.rotation.z-=yon*d/.53);}
      t.son=[X,Z];t.g.position.set(X,0,Z);t.g.rotation.y=ry;
      // kantar üzerindeyken platform yüksekliği
      const kod=durumKodu(v,sim),uz=uzunMu(v,sim);const renk=uz?tok('--s-long'):{wait:'#8796ad',on:tok('--s-on'),t1:tok('--s-t1'),done:tok('--s-done'),out:tok('--s-done')}[kod];
      const nab=(uz||kod==='wait')&&!reduce?(Math.sin(zaman*4)+1)/2:1,sec_=id===secim;
      t.halka.material.color.set(sec_?tok('--accent'):renk);t.halka.material.opacity=sec_?1:.55+.4*nab;t.dolgu.material.color.set(sec_?tok('--accent'):renk);t.dolgu.material.opacity=(sec_?.26:.1+.1*nab);
      const fren=(a.mv&&(a.mv.L-a.mv.d)<40)||a.bekle>0;t.st.forEach(s=>s.material.emissiveIntensity=fren||(a.mv&&a.mv.rev)?3.5:.3+gk*1.2);
      t.el.classList.toggle('sel',sec_);t.secili=sec_;
      const tm=t.tm;tm.className='tm '+(uz?'long':kod==='on'?'':kod==='t1'?'t1':kod==='done'||kod==='out'?'done':'wait');tm.textContent=a.bekle>0?'KANTARDA':v.onsite?sureKisa(kalis(v,sim)):a.state==='yolda'?'YOLDA':'';tm.hidden=!tm.textContent;
      if(sec_&&t.el.dataset.full!=='1'){t.el.querySelector('.lp').outerHTML=plateHTML(v.plate);t.el.dataset.full='1';}else if(!sec_&&t.el.dataset.full==='1'){t.el.querySelector('.lp').outerHTML=plateHTML(v.plate.split('/')[0].trim());t.el.dataset.full='';}}
    for(const [id,t] of tirlar)if(!araclar.has(id)){SC.remove(t.g);t.tek.forEach(w=>tumTekerler.delete(w));t.el.remove();tirlar.delete(id);if(takip===id)genel();}
    bGir.rotation.z+=((kapidaGir()?1.45:0)-bGir.rotation.z)*Math.min(1,dt*3);bCik.rotation.z+=((kapidaCik()?1.45:0)-bCik.rotation.z)*Math.min(1,dt*3);
    if(secim!==sonSecim){sonSecim=secim;if(secim&&tirlar.has(secim)){odak(secim,yakinIstek);yakinIstek=false;}else if(!intro)genel();}
    if(yakinIstek&&secim&&tirlar.has(secim)){odak(secim,true);yakinIstek=false;}
    if(takip&&tirlar.has(takip)){const p=tirlar.get(takip).g.position;hedef.tx=p.x;hedef.tz=p.z;}
    // TV modu: kullanıcı bir süre dokunmazsa sahanın üstünde yavaşça dönen, yükselip alçalan sinematik tur
    const tv=document.body.classList.contains('tv');if(tv&&!reduce&&!takip&&!intro&&performance.now()-sonEtk>8000){tur+=dt;hedef.th+=dt*.03;hedef.ph=VARS.ph+.42+.2*Math.sin(tur*.05);hedef.r=VARS.r*(.82+.16*Math.sin(tur*.037));hedef.tx=VARS.tx+14*Math.sin(tur*.041);hedef.tz=VARS.tz+8*Math.sin(tur*.029);}else tur=0;
    if(!reduce)bulutlar.forEach((b,i)=>{b.position.x+=dt*(1.2+i%3*.4);if(b.position.x>1500)b.position.x=-1500;});
    kopekAdim(dt);
    if(intro){intro.t+=dt;const u=Math.min(1,intro.t/intro.sure),e=u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;for(const n of ['tx','tz','r','th','ph'])cam[n]=intro.bas[n]+(hedef[n]-intro.bas[n])*e;if(u>=1)intro=null;}
    else{const k=reduce?1:1-Math.exp(-dt*(tur?.8:3.2));for(const n of ['tx','tz','r','th','ph'])cam[n]+=(hedef[n]-cam[n])*k;}
    kameraUygula();tekerGuncelle();R.render(SC,CAM);
    const W2=box.clientWidth,H2=box.clientHeight,dar=W2<640;const kutular=[];
    const sirali=[...tirlar.entries()].sort((a,b)=>(b[1].secili?1:0)-(a[1].secili?1:0)||CAM.position.distanceTo(a[1].g.position)-CAM.position.distanceTo(b[1].g.position));
    for(const [id,t] of sirali){v3.set(t.g.position.x,5.8,t.g.position.z).project(CAM);const x=(v3.x+1)/2*W2,y=(1-v3.y)/2*H2;
      let gor=v3.z<1&&x>-60&&x<W2+60&&y>-40&&y<H2+40&&(!dar||t.secili);
      const w=t.el.offsetWidth||90,h=t.el.offsetHeight||40;const r=[x-w/2,y-h,x+w/2,y];
      if(gor&&!t.secili&&kutular.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]))gor=false;
      if(gor)kutular.push(r);t.el.style.opacity=gor?1:0;t.el.style.pointerEvents=gor?'auto':'none';t.el.style.transform=`translate(${(x-w/2).toFixed(1)}px,${(y-h).toFixed(1)}px)`;}
  }
  function ilkSecim(){sonSecim=secim;}
  isik(kaynak.simdi());kameraUygula();
  return {kare,boyut,ilkSecim,_kopekAdim:kopekAdim,_kopek:()=>({x:K.x,z:K.z,hiz:K.hiz,sinir:[kx0,kx1,kz0,kz1],bacak:kopek.bacak.map(h=>h.rotation.z)}),_bilgi:()=>({...R.info.render,geo:R.info.memory.geometries,tex:R.info.memory.textures}),_kamera:(o)=>{Object.assign(hedef,o);Object.assign(cam,o);takip=null;}};
}

/* =========================== LİSTE VE PANELLER =========================== */
let secim=null;
function chipsHTML(v){const on=v.onsite,t1=v.t1,dn=v.done;
  return `<div class="chips"><span class="chip${on?' on':''}">${ICON.on}TESİSTE</span><span class="chip${t1?' t1':''}">${ICON.t1}T1</span><span class="chip${dn?' dn':''}">${ICON.dn}BİTTİ</span></div>`;}
function listeCiz(liste,sim){
  const gor=liste.filter(v=>!v.out_at);
  const gruplar=new Map();gor.forEach(v=>{if(!gruplar.has(v.customer))gruplar.set(v.customer,[]);gruplar.get(v.customer).push(v);});
  const sira=new Map(liste.slice().sort((a,b)=>a.visit_time.localeCompare(b.visit_time)).map((v,i)=>[v.id,i+1]));
  let html='';
  for(const [c,vs] of gruplar){vs.sort((a,b)=>a.visit_time.localeCompare(b.visit_time));
    html+=`<div class="grp"><i style="background:${CUSTOMERS[c]||'#94a3b8'}"></i><b>${esc(c)}</b><em>${vs.length} ARAÇ</em></div>`;
    for(const v of vs){const dk=kalis(v,sim),uz=uzunMu(v,sim);
      html+=`<div class="row${v.id===secim?' sel':''}${uz?' long':''}" tabindex="0" role="button" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} · ${esc(c)}">
        <span class="no">${String(sira.get(v.id)).padStart(2,'0')}</span>${chipsHTML(v)}
        <span class="decl" title="${esc(v.declaration)}">${esc(v.declaration||'—')}</span><span class="pl">${plateHTML(v.plate)}</span>
        <span class="carr">${esc(v.carrier||'—')}</span>
        <span class="dur${uz?' long':v.onsite?'':' wait'}">${v.onsite?sureKisa(dk):v.arriving?'YOLDA':v.visit_time}</span></div>`;}
  }
  $('rows').innerHTML=html||'<p class="note" style="padding:12px">Bugün sahada araç yok.</p>';
  $('list-n').textContent=gor.length+' ARAÇ';
}
function uzunlarCiz(liste,sim){
  const on=liste.filter(v=>v.onsite&&!v.done&&!v.out_at).sort((a,b)=>kalis(b,sim)-kalis(a,sim)).slice(0,4);
  $('longs').innerHTML=on.length?on.map(v=>{const dk=kalis(v,sim),uz=dk>=UZUN;return `<div class="lw" data-id="${esc(v.id)}">${plateHTML(v.plate)}<span class="c">${esc(v.customer)}</span><span class="pill${uz?' long':''}">${sure(dk)}</span></div>`;}).join(''):'<p class="note" style="padding:4px 2px">Tesiste bekleyen araç yok.</p>';
}
function seciliCiz(liste,sim){
  const v=liste.find(x=>x.id===secim);
  if(!v){$('sel').innerHTML='<p class="sel-empty">Sahada ya da listede bir araca dokunun; ayrıntısı burada görünür.</p>';$('sel-cust').innerHTML='';return;}
  $('sel-cust').innerHTML=`<i style="background:${CUSTOMERS[v.customer]||'#94a3b8'}"></i>${esc(v.customer)}`;
  const st=durumKodu(v,sim),slot=araclar.get(v.id)?.slot;
  const adim=(ad,ok,cur,c,zaman)=>`<div class="step${ok?' ok':''}${cur?' cur':''}" style="--c:${c}"><i></i><span>${ad}</span><small>${zaman||'—'}</small></div>`;
  const tm=s=>s?hhmm(isoMin(s)):'';
  $('sel').innerHTML=`<div class="sel-top">${plateHTML(v.plate,true)}<span class="pill${uzunMu(v,sim)?' long':''}">${v.onsite?sure(kalis(v,sim)):v.arriving?'YOLDA':'RANDEVU '+v.visit_time}</span></div>
    <div class="kv"><div><span>BEYANNAME</span><b>${esc(v.declaration||'—')}</b></div><div><span>NAKLİYECİ</span><b>${esc(v.carrier||'—')}</b></div><div><span>RUHSAT</span><b>${esc(v.registration||'—')}</b></div>
    <div><span>GELİŞ</span><b>${v.onsite_at?tm(v.onsite_at):v.visit_time}</b></div><div><span>PARK YERİ</span><b>${slot?'P'+String(slot.no).padStart(2,'0'):'—'}</b></div><div><span>DURUM</span><b>${{wait:v.arriving?'Yolda':'Gelmedi',on:'Tesiste',t1:'T1 yazıldı',done:'İşlemler bitti',out:'Çıktı'}[st]}</b></div></div>
    <div class="steps">${adim('KAPI',v.onsite||v.arriving,!v.onsite&&v.arriving,tok('--s-wait'),v.arriving||v.onsite?v.visit_time:'')}${adim('TESİS',v.onsite,v.onsite&&!v.t1,tok('--s-on'),tm(v.onsite_at))}${adim('T1',v.t1,v.t1&&!v.done,tok('--s-t1'),tm(v.t1_at))}${adim('ÇIKIŞ',!!v.out_at,v.done&&!v.out_at,tok('--s-done'),tm(v.out_at))}</div>`;
}
const feedEl=$('feed');const goruldu=new Set();
function olay(v,tur,zaman){const k=v.id+tur;if(goruldu.has(k))return;goruldu.add(k);
  const metin={yolda:'kapıya yaklaşıyor',on:'tesise girdi',t1:'T1 yazıldı',done:'işlemleri bitti',out:'tesisten çıktı'}[tur];
  const col={yolda:'--s-wait',on:'--s-on',t1:'--s-t1',done:'--s-done',out:'--s-done'}[tur];
  const li=document.createElement('li');li.dataset.id=v.id;li.dataset.t=zaman;
  li.innerHTML=`<time>${hhmm(zaman)}</time><i style="background:var(${col})"></i><p><b>${esc(v.plate.split('/')[0].trim())}</b> ${metin} <em>· ${esc(v.customer)}</em></p>`;
  const sonra=[...feedEl.children].find(x=>+x.dataset.t<=zaman);feedEl.insertBefore(li,sonra||null);while(feedEl.children.length>40)feedEl.lastChild.remove();}
function olaylar(liste,sim){for(const v of liste){
  if(v.arriving&&!v.onsite)olay(v,'yolda',v._varis??sim);
  if(v.onsite_at)olay(v,'on',isoMin(v.onsite_at));if(v.t1_at)olay(v,'t1',isoMin(v.t1_at));if(v.done_at)olay(v,'done',isoMin(v.done_at));if(v.out_at)olay(v,'out',isoMin(v.out_at));}}
function kpi(liste,sim){
  const c=k=>liste.filter(k).length;
  $('k-all').textContent=liste.length;$('k-wait').textContent=c(v=>!v.onsite);$('k-on').textContent=c(v=>v.onsite&&!v.t1&&!v.out_at);
  $('k-t1').textContent=c(v=>v.t1&&!v.done&&!v.out_at);$('k-done').textContent=c(v=>v.done);
  const ks=liste.filter(v=>v.onsite).map(v=>kalis(v,sim));const ort=ks.length?ks.reduce((a,b)=>a+b,0)/ks.length:0;
  $('k-avg').innerHTML=ks.length?`${Math.floor(ort/60)}<small>sa</small> ${String(Math.round(ort%60)).padStart(2,'0')}<small>dk</small>`:'–';
  $('clock').firstChild.nodeValue=hhmm(sim);
  const uz=liste.filter(v=>uzunMu(v,sim));$('alert').hidden=!uz.length;
  if(uz.length)$('alert-t').textContent=`${uz.length} araç 6 saatten uzun süredir tesiste: `+uz.map(v=>`${v.plate.split('/')[0].trim()} (${sure(kalis(v,sim))})`).join(' · ');
}

/* =========================== ETKİLEŞİM =========================== */
let disSecim=null;function sec(id){secim=secim===id?null:id;yenile(true);if(disSecim)disSecim(secim);}
$('rows').addEventListener('pointerdown',e=>{if(e.button>0)return;const r=e.target.closest('.row');if(r)sec(r.dataset.id);});
$('rows').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('row')){e.preventDefault();sec(e.target.dataset.id);}});
$('longs').addEventListener('pointerdown',e=>{if(e.button>0)return;const r=e.target.closest('.lw');if(r)sec(r.dataset.id);});
feedEl.addEventListener('pointerdown',e=>{if(e.button>0)return;const r=e.target.closest('li');if(r)sec(r.dataset.id);});
cv.addEventListener('click',e=>{const b=cv.getBoundingClientRect(),x=(e.clientX-b.left)/S,y=(e.clientY-b.top)/S;let best=null,bd=48;
  for(const a of araclar.values()){const d=Math.hypot(a.x-x,a.y-y);if(d<bd*2){bd=d/2;best=a.id;}}if(best)sec(best);});
let carp=1,dur=false;
$('b-pause').onclick=e=>{dur=!dur;e.currentTarget.setAttribute('aria-pressed',dur);e.currentTarget.textContent=dur?'Devam':'Duraklat';};
$('b-fast').onclick=e=>{carp=carp===1?6:1;e.currentTarget.setAttribute('aria-pressed',carp>1);};
$('b-call').onclick=()=>{kaynak.cagir();yenile(true);};
function temaUygula(t){if(t)document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;draw();}
try{const t=localStorage.getItem('tesis-tema');if(t)temaUygula(t);}catch(e){}
$('b-theme').onclick=()=>{const koyu=document.documentElement.dataset.theme?document.documentElement.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;const t=koyu?'light':'dark';temaUygula(t);try{localStorage.setItem('tesis-tema',t);}catch(e){}};
let idleT;function tvIdle(){document.body.classList.remove('idle');clearTimeout(idleT);if(document.body.classList.contains('tv'))idleT=setTimeout(()=>document.body.classList.add('idle'),3000);}
addEventListener('mousemove',tvIdle);
function tv(on){document.body.classList.toggle('tv',on);$('tv-l').textContent=on?'TV modundan çık':'TV modu';tvIdle();setTimeout(()=>{resize();draw();},60);}
$('b-tv').onclick=async()=>{const on=!document.body.classList.contains('tv');tv(on);
  try{if(on&&document.documentElement.requestFullscreen&&!document.fullscreenElement)await document.documentElement.requestFullscreen();else if(!on&&document.fullscreenElement)await document.exitFullscreen();}catch(e){}};
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&document.body.classList.contains('tv'))tv(false);});
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('tv'))tv(false);});

/* =========================== DÖNGÜ =========================== */
let sonListe=0;
function yenile(zorla){const sim=kaynak.simdi();son=kaynak.liste();senkron(son,sim);ilk=false;olaylar(son,sim);kpi(son,sim);listeCiz(son,sim);uzunlarCiz(son,sim);seciliCiz(son,sim);}
let last=performance.now(),acc=0,gorunur=true,sonKare=0;
/* gömülüyken: ekranda görünmüyorsa (sayfanın altında kaldı) hiç çizilmez; görünürken en çok ~30 kare/sn */
if(GOMULU&&typeof IntersectionObserver!=='undefined')try{new IntersectionObserver(es=>{gorunur=es[es.length-1].isIntersecting;}).observe(document.documentElement);}catch(e){}
function loop(now){const dt=Math.min(.1,(now-last)/1000);last=now;
  if(GOMULU&&(dur||!gorunur||document.hidden)){requestAnimationFrame(loop);return;}
  if(GOMULU&&now-sonKare<30){requestAnimationFrame(loop);last-=dt*1000;return;}sonKare=now;
  if(!dur){kaynak.adim(dt*1.2*carp);adimla(dt);}
  acc+=dt;if(acc>.5){acc=0;yenile();}
  if(G3)G3.kare(dt);else draw();requestAnimationFrame(loop);}
let ucOldu=false;const ikiB=()=>{$('s3note').hidden=false;cv.style.visibility='';};
function uc(){if(ucOldu)return;ucOldu=true;G3=kur3B();if(G3){cv.hidden=true;$('s3').hidden=false;G3.boyut();G3.ilkSecim();window.__kopek={adim:G3._kopekAdim,bilgi:G3._kopek,kare:G3.kare,kamera:G3._kamera};}else ikiB();}   // __kopek: testler için (köpeğin durumunu okur, çizmeden ilerletir)
cv.style.visibility='hidden';
if(window.THREE)uc();else{addEventListener('uc-hazir',uc,{once:true});setTimeout(()=>{if(!ucOldu){ucOldu=true;ikiB();}},10000);}
resize();yenile(true);if(!GOMULU)secim='v1';yenile(true);draw();requestAnimationFrame(loop);
if(GOMULU){
  const ana=window.parent!==window?window.parent:null,O=location.origin;
  addEventListener('message',e=>{if(e.origin!==O||!e.data||typeof e.data!=='object')return;const m=e.data;
    if(m.tip==='pcs-saha'){if(m.renkler&&typeof m.renkler==='object')for(const [k,c] of Object.entries(m.renkler))if(/^#[0-9a-f]{6}$/i.test(c))CUSTOMERS[k]=c;
      if(Array.isArray(m.ziyaretler))kaynak.yukle(m.ziyaretler);
      const s=m.secili&&kaynak.liste().some(v=>v.id===m.secili)?m.secili:null;if(s!==secim){secim=s;}yenile(true);}
    else if(m.tip==='pcs-saha-dur'){dur=!!m.dur;}});
  disSecim=id=>{if(ana)ana.postMessage({tip:'pcs-saha-sec',id},O);};
  if(ana)ana.postMessage({tip:'pcs-saha-hazir'},O);
}
(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>{resize();draw();});
})();
