/* PCS TRANSIT YYS - Supabase ortak veritabanlı araç operasyon panosu. */
(() => {
'use strict';
/* Başka bir sitenin içine (iframe) gömülürse uygulamayı hiç açma: tıklama tuzağına (clickjacking) karşı.
   GitHub Pages sunucu başlığı (X-Frame-Options) eklemeye izin vermediği için koruma burada yapılır. */
if(window.top!==window.self){document.documentElement.style.display='none';try{window.top.location.replace(window.location.href);}catch(_){}return;}
const STORE = 'pcs-transit-yys.v1';
const DAY = 86400000;
const DAYS = ['Pazartesi','Sal\u0131','\u00c7ar\u015famba','Per\u015fembe','Cuma','Cumartesi'];
const SHORT_DAYS = ['Pzt','Sal','\u00c7ar','Per','Cum','Cmt'];
const I = {
truck:'<path d="M3 6h11v12H3zM14 10h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
registry:'<path d="M4 5h16v14H4zM8 5V3m8 2V3M4 10h16"/><path d="M8 14h3m3 0h2"/>',
chart:'<path d="M4 4v16h17M8 16v-5m5 5V7m5 9v-8"/>',
shield:'<path d="M12 3l8 3v6c0 5-8 9-8 9S4 17 4 12V6z"/><path d="M8 12l3 3 5-6"/>',
calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
chevron:'<path d="M9 5l7 7-7 7"/>',left:'<path d="M15 5l-7 7 7 7"/>',down:'<path d="M6 9l6 6 6-6"/>',
plus:'<path d="M12 5v14M5 12h14"/>',download:'<path d="M12 3v12m-5-5l5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-5 5l5-5 5 5M4 16v5h16v-5"/>',
check:'<path d="M5 12l4 4L19 6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',doc:'<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6"/>',
search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l5 5"/>',st_onsite:'<path d="M3 21V9.5L12 4l9 5.5V21"/><path d="M3 21h18"/><path d="M8 21v-6.5h8V21"/><path d="M8 17.5h8"/><path d="M10 10h4"/>',st_t1:'<path d="M13 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21H11"/><path d="M13 3v5h5v3"/><path d="M8 12h6M8 16h3"/><path d="M19.2 13.8a1.6 1.6 0 0 1 2.3 2.3L16 21.6 13 22l.4-3z"/>',st_done:'<path d="M12 2.8 19.5 5.6v6c0 4.9-3.3 8.3-7.5 9.6-4.2-1.3-7.5-4.7-7.5-9.6v-6z"/><path d="m8.6 12.1 2.4 2.4 4.6-4.9"/>',wa:'<path d="M20.5 11.6a8.6 8.6 0 0 1-12.7 7.6L3.5 20.5l1.4-4.1a8.6 8.6 0 1 1 15.6-4.8z"/><path d="M9.2 8.4c.1 3.3 3 6.2 6.4 6.4l1-1.3-1.9-1.1-.9.8a4.1 4.1 0 0 1-2.4-2.4l.8-.9-1.1-1.9z"/>',edit:'<path d="M14 5l5 5M4 20l4-1L20 7a2.1 2.1 0 00-3-3L5 16z"/>',trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',close:'<path d="M6 6l12 12M6 18L18 6"/>',database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
settings:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',print:'<path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7zM17 11h.1"/>',refresh:'<path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3"/><path d="M18 4v4h-4M6 20v-4h4"/>',arrow:'<path d="M4 12h16m-6-6l6 6-6 6"/>',copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',bell:'<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 004 0"/>',moon:'<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',tablet:'<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M11 18h2"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 2-3 4m0 3h.1"/>',building:'<path d="M4 21V3h11v18m0-12h5v12M2 21h20M8 7h3m-3 4h3m-3 4h3"/>'
};
const icon = (n,cls='') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]||I.doc}</svg>`;
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = p => String(p||'').normalize('NFKC').toUpperCase().replace(/\u0130/g,'I').replace(/[\s.-]+/g,'');
const plateText = p => String(p||'').trim().toUpperCase().replace(/\s+/g,' ');
const uid = () => globalThis.crypto?.randomUUID?.() || ('id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const dateObj = s => new Date(s+'T12:00:00Z');
const iso = d => d.toISOString().slice(0,10);
const addDays = (s,n) => iso(new Date(dateObj(s).getTime()+n*DAY));
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(dateObj(s)) && iso(dateObj(s))===s;
const weekday = s => dateObj(s).getUTCDay();
function localToday(at=new Date()){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));const x=t=>p.find(a=>a.type===t).value;return `${x('year')}-${x('month')}-${x('day')}`;}
const TODAY = localToday();
const WORK_TODAY = weekday(TODAY)===0?addDays(TODAY,-1):TODAY; /* Pazar günü raporlar son iş gününden açılır */
function weekInfo(s){let d=dateObj(s);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=d.getUTCFullYear();return {year:y,week:Math.ceil((((d-new Date(Date.UTC(y,0,1)))/DAY)+1)/7)};}
function monday(y,w){const d=new Date(Date.UTC(y,0,4,12));d.setUTCDate(d.getUTCDate()-(d.getUTCDay()||7)+1+(w-1)*7);return iso(d);}
function lastWeeks(n){const thisMonday=monday(weekNow.year,weekNow.week);const out=[];for(let i=n-1;i>=0;i--){const mon=addDays(thisMonday,-7*i);const wi=weekInfo(mon);const ds=Array.from({length:6},(_,k)=>addDays(mon,k));const s=stats(state.visits.filter(v=>ds.includes(v.date)));out.push({year:wi.year,week:wi.week,total:s.total,done:s.done});}return out;}
const fmt = (s,opt={day:'numeric',month:'long'}) => new Intl.DateTimeFormat('tr-TR',{timeZone:'UTC',...opt}).format(dateObj(s));
const timeNow = () => new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
const weekNow=weekInfo(TODAY);
let ui={page:'pano',year:weekNow.year,week:weekNow.week,day:(weekday(TODAY)>=1&&weekday(TODAY)<=6)?TODAY:'all',search:'',regSearch:'',collapsed:new Set(),demo:false};
let selectedIds=new Set();
let storageError='',toastTimer,realState, demoState=null, pendingVisit=null, confirmAction=null;
const emptyState = () => ({schemaVersion:1,revision:0,updatedAt:null,registry:[],visits:[]});
function cleanText(v,max=300){if(typeof v!=='string')throw new Error('Metin alanlar\u0131 ge\u00e7erli de\u011fil.');if(v.length>max)throw new Error('Bir metin alan\u0131 izin verilen uzunlu\u011fu a\u015f\u0131yor.');return v;}
function validateData(raw){
 if(!raw||raw.schemaVersion!==1||!Array.isArray(raw.registry)||!Array.isArray(raw.visits))throw new Error('Bu dosya ge\u00e7erli bir PCS yede\u011fi de\u011fil.');
 if(raw.registry.length>10000||raw.visits.length>100000)throw new Error('Yedekte desteklenen kay\u0131t s\u0131n\u0131r\u0131 a\u015f\u0131ld\u0131.');
 const seenP=new Set(),seenR=new Set(),seenV=new Set();
 const meta=r=>({plate:cleanText(r.plate,30),customer:cleanText(r.customer,150),declaration:cleanText(r.declaration||'',150),carrier:cleanText(r.carrier||'',150),registration:cleanText(r.registration||'',150)});
 const reg=raw.registry.map(r=>{const x={id:cleanText(r.id,100),...meta(r)};if(!x.id||!norm(x.plate)||!x.customer.trim()||seenR.has(x.id)||seenP.has(norm(x.plate)))throw new Error('Plaka kay\u0131tlar\u0131nda bo\u015f veya tekrarlanan kay\u0131t var.');seenR.add(x.id);seenP.add(norm(x.plate));return x;});
 const visits=raw.visits.map(r=>{const x={id:cleanText(r.id,100),...meta(r),date:cleanText(r.date,10),time:cleanText(r.time||'',5),note:cleanText(r.note||'',1000),onsite:r.onsite,t1:r.t1,done:r.done,createdAt:typeof r.createdAt==='string'?r.createdAt:''};if(!x.id||seenV.has(x.id)||!norm(x.plate)||!x.customer.trim()||!validDate(x.date)||weekday(x.date)===0||[x.onsite,x.t1,x.done].some(b=>typeof b!=='boolean')||(x.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time)))throw new Error('Geli\u015f kay\u0131tlar\u0131ndan biri ge\u00e7ersiz (tarih, durum veya kimlik).');seenV.add(x.id);return x;});
 return {schemaVersion:1,revision:Number.isSafeInteger(raw.revision)?raw.revision:0,updatedAt:typeof raw.updatedAt==='string'?raw.updatedAt:null,registry:reg,visits};
}
realState=emptyState();
let state=realState;
const weekStart = () => monday(ui.year,ui.week);
const dates = () => Array.from({length:6},(_,i)=>addDays(weekStart(),i));
const weekVisits = () => {const ds=dates();return state.visits.filter(v=>v.date>=ds[0]&&v.date<=ds[5]);};
const defaultDate = () => ui.day!=='all'?ui.day:(dates().includes(TODAY)?TODAY:weekStart());
const stats = a => ({total:a.length,onsite:a.filter(v=>v.onsite).length,t1:a.filter(v=>v.t1).length,done:a.filter(v=>v.done).length,pending:a.filter(v=>!v.done).length,percent:a.length?Math.round(a.filter(v=>v.done).length/a.length*100):0});
const matchPlate = p => state.registry.find(r=>norm(r.plate)===norm(p));
const searchMatch = (v,q) => !q || [v.plate,v.customer,v.carrier,v.declaration].some(x=>norm(x).includes(norm(q)));
function toast(text,error=false){clearTimeout(toastTimer);const el=document.getElementById('toast');el.textContent=text;el.className='show'+(error?' error':'');toastTimer=setTimeout(()=>el.className='',error?8500:3800);}
function button(action,label,ico='',cls=''){return `<button type="button" class="btn ${cls}" data-action="${action}">${ico?icon(ico):''}${label}</button>`;}
function render(){
 if(!account){authScreen();return;}
 const focus=document.activeElement?.id;const sel=document.activeElement?.selectionStart;
 const pages={pano:['Pano','Ara\u00e7 operasyon panosu','Geli\u015fleri, evraklar\u0131 ve i\u015flem durumlar\u0131n\u0131 birlikte takip edin.'],pending:['Bekleyenler','Bekleyen araçlar','Tüm günlerden, henüz işlemleri bitmemiş araçlar; en uzun bekleyen en üstte.'],registry:['Plaka Kay\u0131tlar\u0131','Plaka kay\u0131tlar\u0131','Bir kez kaydedin; sonraki geli\u015flerde plaka ile bilgileri getirin.'],reports:['Raporlar','Operasyon raporlar\u0131','G\u00fcn\u00fcn ve haftan\u0131n operasyonunu say\u0131larla g\u00f6r\u00fcn.'],data:['Veri ve Yedek','Verileriniz, sizin kontrol\u00fcn\u00fczde','Ortak verileri ve yedek kopyalarını yönetin.'],settings:['Ayarlar','Ayarlar','Müşteri renklerini ve pano sıralamasını buradan yönetin.']};const p=pages[ui.page];const pendingCount=state.visits.filter(v=>!v.done).length;
 const nav=[['pano','grid','Pano'],['pending','clock','Bekleyenler'],['registry','registry','Plaka Kay\u0131tlar\u0131'],['reports','chart','Raporlar'],['data','database','Veri ve Yedek'],['settings','settings','Ayarlar']].filter(([k])=>!VIEW_TOKEN||!['registry','data','settings'].includes(k));if(VIEW_TOKEN&&['registry','data','settings'].includes(ui.page))ui.page='pano';
 const titleActions=ui.page==='pano'?button('export','Excel\u2019e aktar','download')+button('ruhsat-open','Ruhsattan ekle','doc')+button('add-visit','Ara\u00e7 ekle','plus','primary'):ui.page==='registry'?button('import-reg','Excel\u2019den al','upload')+button('add-reg','Yeni plaka kayd\u0131','plus','primary'):ui.page==='pending'||ui.page==='settings'?'':ui.page==='reports'?button('print','Yazd\u0131r','print')+button('export','Excel\u2019e aktar','download','primary'):button('backup','T\u00fcm verileri yedekle','download','primary');
 document.getElementById('app').innerHTML=`<aside class="sidebar"><div class="brand"><div class="brand-mark"><img src="logo.svg" alt=""></div><div class="brand-text"><div class="brand-name">PCS TRANS\u0130T</div><div class="brand-sub">YYS OPERASYON</div></div></div><div class="nav-label">\u00c7ALI\u015eMA ALANI</div><nav aria-label="Ana gezinme">${nav.map(([key,i,label])=>`<button type="button" title="${label}" data-action="nav" data-page="${key}" class="nav-item ${ui.page===key?'active':''}" ${ui.page===key?'aria-current="page"':''}>${icon(i)}<span class="nav-text">${label}</span>${key==='registry'?`<span class="nav-count">${state.registry.length}</span>`:key==='pending'&&pendingCount?`<span class="nav-count">${pendingCount}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-user"><div class="avatar">OP</div><span>Operasyon masan\u0131z<small>Yetkili tesis y\u00f6netimi</small></span></div></div></aside><div class="shell"><header class="topbar"><div class="breadcrumb">${icon('building')}<span>Yetkili Tesis</span>${icon('chevron')}<strong>${p[0]}</strong></div><div class="topbar-right"><span class="date-label">${fmt(TODAY,{day:'numeric',month:'long',year:'numeric'})}</span><span class="save-status"><i class="local-dot"></i>${ui.demo?'\u00d6rnek g\u00f6r\u00fcn\u00fcm':storageError?'Kay\u0131t uyar\u0131s\u0131':state.updatedAt?'Yerel kay\u0131t g\u00fcncel':'Yerel kay\u0131t'}</span><button type="button" class="demo-pill" data-action="toggle-demo">${ui.demo?'Ger\u00e7ek kay\u0131tlara d\u00f6n':'\u00d6rnek g\u00f6r\u00fcn\u00fcm'}</button></div></header><main id="main"><div class="heading"><div><div class="eyebrow">TES\u0130S OPERASYON Y\u00d6NET\u0130M\u0130</div><h1>${p[1]}</h1><p>${p[2]}</p></div><div class="actions">${titleActions}</div></div>${ui.demo?`<div class="demo-banner"><span><strong>\u00d6RNEK VER\u0130</strong>G\u00f6rd\u00fc\u011f\u00fcn\u00fcz m\u00fc\u015fteriler ve geli\u015fler kurgusald\u0131r. Ger\u00e7ek kay\u0131tlar\u0131n\u0131z etkilenmez.</span>${button('toggle-demo','\u00d6rnekten \u00e7\u0131k','','small')}</div>`:''}${storageError&&!ui.demo?`<div class="warning-banner">${esc(storageError)}</div>`:''}${!ui.demo?backupReminder():''}${ui.page==='pano'?panoView():ui.page==='pending'?pendingView():ui.page==='registry'?registryView():ui.page==='reports'?reportsView():ui.page==='settings'?settingsView():dataView()}${footer()}</main></div>`;
 onlineUI();
 if(focus && ['board-search','registry-search','wa-search','wa-tpl-single','wa-tpl-multi','quick-plate'].includes(focus)){const input=document.getElementById(focus);input?.focus();if(sel!=null)input?.setSelectionRange(sel,sel);}
}
function periodPanel(){
 const ds=dates(),wv=weekVisits();const yearList=Array.from(new Set([...Array.from({length:16},(_,i)=>weekNow.year-10+i),ui.year,...state.visits.map(v=>weekInfo(v.date).year)])).sort((a,b)=>a-b);
 return `<section class="period-panel" aria-label="Hafta ve g\u00fcn se\u00e7imi"><div class="period-top"><div class="week-controls"><span class="calendar-icon">${icon('calendar')}</span><button type="button" class="icon-btn" data-action="prev-week" aria-label="\u00d6nceki hafta">${icon('left')}</button><select id="year-select" aria-label="Y\u0131l">${yearList.map(y=>`<option ${y===ui.year?'selected':''} value="${y}">${y}</option>`).join('')}</select><select id="week-select" class="week-select" aria-label="Hafta">${Array.from({length:weekInfo(`${ui.year}-12-28`).week},(_,i)=>`<option value="${i+1}" ${i+1===ui.week?'selected':''}>${i+1}. Hafta</option>`).join('')}</select><button type="button" class="icon-btn" data-action="next-week" aria-label="Sonraki hafta">${icon('chevron')}</button><span class="range-label">${fmt(ds[0])} \u2013 ${fmt(ds[5],{day:'numeric',month:'long',year:'numeric'})}</span></div><div class="period-tools">${button('this-week','Bu hafta','','text small')}<select id="day-select" aria-label="G\u00fcn se\u00e7"><option value="all">G\u00fcn se\u00e7: T\u00fcm hafta</option>${ds.map((d,i)=>`<option value="${d}" ${ui.day===d?'selected':''}>${DAYS[i]} \u00b7 ${fmt(d,{day:'2-digit',month:'2-digit'})}</option>`).join('')}</select></div></div><div class="day-tabs" role="group" aria-label="Se\u00e7ili haftan\u0131n g\u00fcnleri"><button type="button" data-action="day" data-date="all" class="day-tab ${ui.day==='all'?'active':''}" aria-pressed="${ui.day==='all'}"><div><strong>Haftan\u0131n tamam\u0131</strong><small>6 i\u015f g\u00fcn\u00fc</small></div><span class="tab-count">${wv.length}</span></button>${ds.map((d,i)=>`<button type="button" data-action="day" data-date="${d}" class="day-tab ${ui.day===d?'active':''}" aria-pressed="${ui.day===d}"><div><strong>${DAYS[i]}</strong><small>${fmt(d,{day:'2-digit',month:'short'})}</small></div><span class="tab-count">${wv.filter(v=>v.date===d).length}</span></button>`).join('')}</div></section>`;
}
function kpis(a,weekly=true){const s=stats(a);const items=[['Toplam ara\u00e7',s.total,'Kay\u0131tl\u0131 geli\u015f say\u0131s\u0131','truck','teal'],['Tesiste i\u015faretli',s.onsite,'TES\u0130STE kutusu i\u015faretli','building','amber'],['T1 yaz\u0131ld\u0131',s.t1,'T1 i\u015flemi i\u015faretli','doc','blue'],['\u0130\u015flemleri bitti',s.done,`%${s.percent} tamamlanma oran\u0131`,'check','green'],['Bekleyen i\u015flem',s.pending,'Hen\u00fcz tamamlanmayan','clock','']];return `<div class="section-label"><h2>${weekly?`${ui.week}. hafta toplamlar\u0131`:'Se\u00e7ili g\u00fcn\u00fcn toplamlar\u0131'}</h2><span>${weekly?'G\u00fcn ve arama filtresinden ba\u011f\u0131ms\u0131z':'Yaln\u0131zca se\u00e7ili tarihin geli\u015fleri'}</span></div><section class="kpi-grid" aria-label="${weekly?'Haftal\u0131k':'G\u00fcnl\u00fck'} \u00f6zet">${items.map(([label,n,note,i,color])=>`<div class="kpi ${color}"><div class="kpi-top"><span>${label}</span><span class="kpi-icon">${icon(i)}</span></div><div class="kpi-num">${n.toLocaleString('tr-TR')}</div><div class="kpi-note">${note}</div>${color==='green'?`<div class="kpi-progress"><span style="width:${s.percent}%"></span></div>`:''}</div>`).join('')}</section>`;}
function panoView(){const gq=ui.search.trim();if(gq)return searchToolbar()+searchResultsSection(gq);const wv=weekVisits();const ds=ui.day==='all'?dates():[ui.day];const inDay=wv.filter(v=>(ui.day==='all'||v.date===ui.day)&&searchMatch(v,ui.search));const missCount=inDay.filter(isMissing).length;const shown=ui.missingOnly?inDay.filter(isMissing):inDay;const dayStat=ui.day==='all'?null:stats(wv.filter(v=>v.date===ui.day));const pool=ds.flatMap(d=>sortRows(shown.filter(v=>v.date===d)));panelId=ui.selected&&state.visits.some(x=>x.id===ui.selected)?ui.selected:(pool.find(v=>v.date===TODAY)||pool[0])?.id||null;
 return periodPanel()+kpis(wv)+(!state.registry.length&&!state.visits.length?`<section class="empty-state"><div class="empty-icon">${icon('truck')}</div><h2>\u0130lk plaka kayd\u0131n\u0131zla ba\u015flay\u0131n</h2><p>M\u00fc\u015fteri, plaka, beyanname, nakliyeci ve ruhsat bilgilerini bir kez kaydedin. Panoda plaka se\u00e7ti\u011finizde bilgiler otomatik gelsin.</p><div class="actions">${button('add-reg','\u0130lk plakay\u0131 kaydet','plus','primary')}${button('import-reg','Excel\u2019den plaka al','upload')}</div></section>`:'')+`<div class="board-layout"><div class="board-main">${quickAdd()}<div class="board-toolbar"><div class="board-title"><h2>${ui.day==='all'?'Haftal\u0131k operasyon ak\u0131\u015f\u0131':`${DAYS[weekday(ui.day)-1]} operasyonu`}</h2><span class="badge">${ui.day==='all'?'6 G\u00dcN':'1 G\u00dcN'}</span></div><button type="button" class="miss-btn${ui.missingOnly?' on':''}" data-action="missing-only" aria-pressed="${!!ui.missingOnly}" title="Beyannamesi, nakliyecisi veya ruhsatı eksik araçları göster">${icon('info')}Eksik bilgiler <b>${missCount}</b></button><div class="view-seg" role="group" aria-label="Pano g\u00f6r\u00fcn\u00fcm\u00fc"><button type="button" data-action="view-mode" data-v="table" aria-pressed="${boardView()==='table'}">${icon('registry')}Tablo</button><button type="button" data-action="view-mode" data-v="cards" aria-pressed="${boardView()==='cards'}">${icon('grid')}Kartlar</button></div><div class="search">${icon('search')}<input id="board-search" type="search" aria-label="Kay\u0131tlarda ara" placeholder="Plaka, m\u00fc\u015fteri veya nakliyeci ara... (t\u00fcm tarihlerde arar)" value="${esc(ui.search)}"></div><button type="button" class="icon-btn kb-btn" data-action="shortcuts" title="Klavye k\u0131sayollar\u0131 (?)" aria-label="Klavye k\u0131sayollar\u0131">${icon('help')}</button></div>${selectedIds.size?`<div class="bulk-bar"><strong>${selectedIds.size} araç seçili</strong>${button('bulk-onsite','Tesiste yap','','small')}${button('bulk-t1','T1 yazıldı yap','','small')}${button('bulk-done','İşlemler bitti yap','','small primary')}${button('bulk-next','Ertesi güne al','chevron','small carry-btn')}${button('bulk-clear','Seçimi temizle','','small text')}</div>`:''}<div class="board-meta"><div class="legend"><span><i class="amber"></i>Tesiste</span><span><i class="blue"></i>T1 yaz\u0131ld\u0131</span><span><i class="green"></i>\u0130\u015flemler bitti</span></div><span>${shown.length} geli\u015f g\u00f6steriliyor \u00b7 Durum kutular\u0131na t\u0131klayarak g\u00fcncelleyin</span></div>${dayStat?`<div class="daily-summary"><strong>${fmt(ui.day)} g\u00fcnl\u00fck \u00f6zet</strong><span>${dayStat.total} ara\u00e7</span><span>${dayStat.t1} T1 yaz\u0131ld\u0131</span><span>${dayStat.done} tamamland\u0131</span><span>${dayStat.pending} bekleyen</span></div>`:''}${ds.map(d=>dayBlock(d,shown.filter(v=>v.date===d),wv.filter(v=>v.date===d))).join('')}</div>${sidePanel()}</div>`;
}
function pendingView(){const all=state.visits.filter(v=>!v.done);
 if(!all.length)return `<div class="empty-state"><div class="empty-icon">${icon('check')}</div><h2>Bekleyen araç yok</h2><p>Tüm araçların işlemleri tamamlanmış görünüyor.</p></div>`;
 const age=d=>Math.max(0,Math.round((dateObj(TODAY)-dateObj(d))/DAY));const sinceMap=new Map();const since=v=>{if(sinceMap.has(v.id))return sinceMap.get(v.id);let c='';try{c=v.createdAt?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date(v.createdAt)):'';}catch(_){}const r=validDate(c)&&c<v.date?c:v.date;sinceMap.set(v.id,r);return r;};const bucket=a=>a<=0?'b0':a<=2?'b1':a<=6?'b3':'b7';
 const B=[['','Tümü'],['b0','Bugün'],['b1','1–2 gün'],['b3','3–6 gün'],['b7','7+ gün']];const cnt={'':all.length};for(const v of all){const b=bucket(age(since(v)));cnt[b]=(cnt[b]||0)+1;}
 const f=ui.pendAge||'';const rows=all.filter(v=>!f||bucket(age(since(v)))===f);
 const map=new Map();for(const v of rows){const k=v.customer||'';if(!map.has(k))map.set(k,[]);map.get(k).push(v);}
 const groups=[...map.entries()].map(([k,l])=>[k,l.sort((a,b)=>since(a).localeCompare(since(b))||String(a.time||'').localeCompare(String(b.time||'')))]).sort((a,b)=>since(a[1][0]).localeCompare(since(b[1][0]))||custPriority(a[0])-custPriority(b[0])||a[0].localeCompare(b[0],'tr'));
 const closed=ui.pendClosed||(ui.pendClosed=new Set());const sev=a=>a>=7?'bad':a>=3?'warn':'ok';const ageTxt=a=>a<=0?'Bugün':a+' gün';
 const oldest=Math.max(...all.map(v=>age(since(v))));
 const chips=`<div class="pend-summary"><div class="reg-countries" role="group" aria-label="Bekleme süresine göre süz">${B.map(([k,l])=>`<button type="button" class="reg-cc pend-cc ${k||'all'}${f===k?' active':''}" data-action="pend-age" data-b="${k}" aria-pressed="${f===k}">${l} <b>${cnt[k]||0}</b></button>`).join('')}</div><span class="pend-note">${all.length} araç bekliyor · en eskisi <b>${ageTxt(oldest)}</b></span></div>`;
 const row=v=>{const a=age(since(v));return `<tr class="${v.t1?'row-t1':v.onsite?'row-onsite':''}${justChanged(v.id)?' just-changed':''}" data-row-id="${esc(v.id)}"><td class="pend-plate"><button type="button" class="plate-button" data-action="select-visit" data-id="${esc(v.id)}" title="Panoda göster">${plateHTML(v.plate,'sm')}</button></td><td class="pend-date">${fmt(since(v))}${v.time?`<small>${esc(v.time)}</small>`:''}</td><td><span class="age-badge ${sev(a)}">${ageTxt(a)}</span></td><td class="declaration">${v.declaration?esc(v.declaration):MISSING}</td><td class="pend-carrier" title="${esc(v.carrier)}">${esc(v.carrier)||DASH}</td><td class="pend-chips">${[['onsite','TESİSTE','Tesiste','amber'],['t1','T1 YAZILDI','T1','blue'],['done','İŞLEMLER BİTTİ','Bitti','green']].map(([k,l,short,color])=>{const cid=`chkp-${esc(v.id)}-${k}`;return `<input class="check-native" id="${cid}" type="checkbox" data-check="${k}" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} ${l}" ${v[k]?'checked':''}><label class="chk-toggle ${color}" for="${cid}">${stIcon(k)}${short}</label>`;}).join('')}</td><td class="actions-cell"><button type="button" class="icon-btn wa-btn" data-action="wa-send" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} bilgilerini WhatsApp ile gönder" title="WhatsApp ile gönder">${icon('wa')}</button><button type="button" class="icon-btn" data-action="edit-visit" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} gelişini düzenle">${icon('edit')}</button></td></tr>`;};
 const body=groups.map(([name,list])=>{const a=age(since(list[0]));return `<details class="reg-group pend-group" data-cust="${esc(name)}" ${closed.has(name)?'':'open'} style="--bc:${custColor(name)}"><summary><span class="reg-dot"></span><span class="reg-name">${esc(name||'MÜŞTERİSİZ')}</span><span class="reg-count">${list.length} araç</span><span class="age-badge ${sev(a)} pend-oldest">en eski ${ageTxt(a)}</span><span class="set-chev">${icon('down')}</span></summary><div class="reg-body"><table class="operations pend-table"><thead><tr><th>PLAKA</th><th>GELİŞ</th><th>BEKLEME</th><th>BEYANNAME</th><th>NAKLİYECİ</th><th>DURUM</th><th></th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div></details>`;}).join('');
 return chips+(rows.length?`<div class="reg-list">${body}</div>`:`<div class="empty-state"><div class="empty-icon">${icon('check')}</div><h2>Bu aralıkta bekleyen araç yok</h2><p>Başka bir bekleme süresi seçin.</p></div>`)+`<p class="help-note" style="margin-top:16px">İşlemi bitmemiş tüm araçlar, en uzun bekleyen müşteri en üstte olacak şekilde listelenir. "Bitti" işaretlenen araç listeden çıkar.</p>`;}
function backupReminder(){if(VIEW_TOKEN)return'';let last=null;try{last=localStorage.getItem(STORE+'.backupAt');}catch(e){}
 if(!state.visits.length&&!state.registry.length)return'';
 if(!last)return `<div class="warning-banner"><span><strong>YEDEK ALINMADI</strong>Bu cihazda hiç JSON yedeği indirilmemiş. Düzenli yedek almak verinizi güvence altına alır.</span>${button('backup','Şimdi yedekle','download','small')}</div>`;
 const days=Math.floor((Date.now()-new Date(last).getTime())/DAY);
 if(days>=14)return `<div class="warning-banner"><span><strong>YEDEK ESKİ</strong>Son yedek ${days} gün önce alındı.</span>${button('backup','Şimdi yedekle','download','small')}</div>`;
 return'';
}
function searchToolbar(){return `<div class="board-toolbar"><div class="board-title"><h2>${ui.search.trim()?'Arıyorsunuz':ui.day==='all'?'Haftalık operasyon akışı':`${DAYS[weekday(ui.day)-1]} operasyonu`}</h2>${ui.search.trim()?'':`<span class="badge">${ui.day==='all'?'6 GÜN':'1 GÜN'}</span>`}</div><div class="search">${icon('search')}<input id="board-search" type="search" aria-label="Kayıtlarda ara" placeholder="Plaka, müşteri veya nakliyeci ara... (tüm tarihlerde arar)" value="${esc(ui.search)}"></div><button type="button" class="icon-btn kb-btn" data-action="shortcuts" title="Klavye kısayolları (?)" aria-label="Klavye kısayolları">${icon('help')}</button></div>`;}
function searchResultsSection(q){const rows=state.visits.filter(v=>searchMatch(v,q)).slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 if(!rows.length)return `<div class="empty-state"><div class="empty-icon">${icon('search')}</div><h2>Sonuç bulunamadı</h2><p>“${esc(q)}” ile eşleşen bir kayıt yok.</p></div>`;
 return `<div class="notice">${icon('info')}<div>“${esc(q)}” için tüm tarihlerde <strong>${rows.length}</strong> sonuç bulundu, en yeni en üstte.</div></div><div class="table-scroll"><table class="operations pending-operations"><thead><tr><th>PLAKA</th><th>MÜŞTERİ</th><th>BEYANNAME</th><th>NAKLİYECİ</th><th>TARİH</th><th class="status-head">TESİSTE</th><th class="status-head">T1<br>YAZILDI</th><th class="status-head">İŞLEMLER<br>BİTTİ</th><th></th></tr></thead><tbody>${rows.map(v=>`<tr class="${v.done?'row-done':v.t1?'row-t1':v.onsite?'row-onsite':''}" data-row-id="${esc(v.id)}"><td class="info plate"><button type="button" class="plate-button" data-action="edit-visit" data-id="${esc(v.id)}" title="Gelişi düzenle">${plateHTML(v.plate,'sm')}</button></td><td class="info declaration"><button type="button" class="plate-button" data-action="customer-profile" data-name="${esc(v.customer)}" title="Müşteri geçmişini gör">${esc(v.customer)||DASH}</button></td><td class="info" title="${esc(v.declaration)}">${esc(v.declaration)||DASH}</td><td class="info" title="${esc(v.carrier)}">${esc(v.carrier)||DASH}</td><td class="info mono">${fmt(v.date)}</td>${[['onsite','TESİSTE','Tesiste','amber'],['t1','T1 YAZILDI','T1','blue'],['done','İŞLEMLER BİTTİ','Bitti','green']].map(([k,l,short,color])=>{const cid=`chks-${esc(v.id)}-${k}`;return `<td class="check-cell"><input class="check-native" id="${cid}" type="checkbox" data-check="${k}" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} ${l}" ${v[k]?'checked':''}><label class="chk-toggle ${color}" for="${cid}">${stIcon(k)}${short}</label></td>`;}).join('')}<td class="info actions-cell"><button type="button" class="icon-btn" data-action="edit-visit" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} gelişini düzenle">${icon('edit')}</button></td></tr>`).join('')}</tbody></table></div>`;}
function dayBlock(d,shown,all){const st=stats(all),collapsed=ui.collapsed.has(d);return `<section class="day-block" aria-label="${fmt(d,{weekday:'long',day:'numeric',month:'long'})}"><header class="day-header"><div class="day-name"><button type="button" class="icon-btn" data-action="collapse" data-date="${d}" aria-label="G\u00fcn blo\u011funu ${collapsed?'a\u00e7':'kapat'}" aria-expanded="${!collapsed}">${icon(collapsed?'chevron':'down')}</button><div class="day-date"><b>${d.slice(8)}</b><small>${fmt(d,{month:'short'})}</small></div><div><h3>${DAYS[weekday(d)-1]}${d===TODAY?' <span class="badge">BUG\u00dcN</span>':''}</h3><p>${fmt(d,{day:'numeric',month:'long',year:'numeric'})}</p></div></div><div class="day-header-right"><div class="day-stats"><span><b>${st.total}</b> ara\u00e7</span><span><b>${st.t1}</b> T1</span><span class="done-count"><b>${st.done}</b> tamamland\u0131</span></div>${orderReady()&&all.some(v=>v.sort_order!=null)?`<button type="button" class="btn text small" data-action="clear-order" data-date="${d}" title="Bu g\u00fcn i\u00e7in elle ayarlanm\u0131\u015f s\u0131ray\u0131 kald\u0131r\u0131r, durum s\u0131ras\u0131na g\u00f6re otomatik dizer">${icon('refresh')}Otomatik s\u0131rala</button>`:''}${all.some(v=>!v.done)?`<button type="button" class="btn small carry-btn" data-action="carry-next" data-date="${d}" title="Bu g\u00fcn\u00fcn i\u015flemi bitmemi\u015f ara\u00e7lar\u0131n\u0131 bir sonraki i\u015f g\u00fcn\u00fcne ta\u015f\u0131r">${icon('chevron')}Bitmeyenleri ertesi g\u00fcne al <b class="carry-count">${all.filter(v=>!v.done).length}</b></button>`:''}${all.length?`<button type="button" class="btn text small copy-day" data-action="copy-day" data-date="${d}" title="Günün listesini tablo olarak kopyalar; Excel'e veya maile yapıştırılabilir">${icon('copy')}Listeyi kopyala</button>`:''}<button type="button" class="btn text small" data-action="add-visit" data-date="${d}">${icon('plus')}Ara\u00e7 ekle</button></div></header>${collapsed?'':shown.length?(boardView()==='cards'?cardsView(shown):operationsTable(shown)):`<div class="empty-day">${all.length?'Araman\u0131za uygun kay\u0131t bulunamad\u0131.':'Bu g\u00fcn i\u00e7in hen\u00fcz ara\u00e7 kayd\u0131 yok.'}${!all.length?`<button type="button" data-action="add-visit" data-date="${d}">\u0130lk arac\u0131 ekle \u2192</button>`:''}</div>`}</section>`;}
I.up='<path d="m6 15 6-6 6 6"/>';
const orderReady=()=>state.visits.length>0&&'sort_order' in state.visits[0];
function statusTier(v){return v.done?0:(v.onsite&&v.t1)?1:(v.onsite||v.t1)?2:3;}
let custPriorityList=[{match:'ETL LOJ - ERVİN',color:'#2dd4bf'},{match:'ETL LOJ - KAAN',color:'#a78bfa'},{match:'LİN LOJ',color:'#f472b6'},{match:'BULTRANS',color:'#818cf8'},{match:'PLASTNAK',color:'#22d3ee'},{match:'TORNADO',color:'#facc15'},{match:'BBL',color:'#fb7185'}];
function custPriority(name){const c=String(name||'').toLocaleUpperCase('tr-TR');const i=custPriorityList.findIndex(e=>e.match&&c.includes(String(e.match).toLocaleUpperCase('tr-TR')));return i<0?Infinity:i;}
function custColor(name){const i=custPriority(name);return i>=0&&custPriorityList[i]?custPriorityList[i].color||'#5eead4':'#5eead4';}
function sortRows(rows){
 const so=v=>v.sort_order==null?Infinity:v.sort_order;
 const block={};for(const v of rows){const k=v.customer||'',c=String(v.createdAt||'');if(!(k in block)||c<block[k])block[k]=c;}
 const auto=(a,b)=>{const ka=a.customer||'',kb=b.customer||'',ba=block[ka]||'',bb=block[kb]||'',pa=custPriority(ka),pb=custPriority(kb);
  return (!a.customer)-(!b.customer)||(pa-pb)||(ba<bb?-1:ba>bb?1:0)||(ka!==kb?ka.localeCompare(kb,'tr'):0)||statusTier(a)-statusTier(b)||(a.time||'99:99').localeCompare(b.time||'99:99')||a.createdAt.localeCompare(b.createdAt);};
 return rows.slice().sort((a,b)=>so(a)===so(b)?auto(a,b):so(a)-so(b));
}
function moveButtons(v){return `<button type="button" class="icon-btn" data-action="move-up" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} yukar\u0131 ta\u015f\u0131" title="Yukar\u0131 ta\u015f\u0131">${icon('up')}</button><button type="button" class="icon-btn" data-action="move-down" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} a\u015fa\u011f\u0131 ta\u015f\u0131" title="A\u015fa\u011f\u0131 ta\u015f\u0131">${icon('down')}</button>`;}function operationsTable(rows){const headers=['#','TES\u0130STE','T1<br>YAZILDI','\u0130\u015eLEMLER<br>B\u0130TT\u0130','BEYANNAME','PLAKA','NAKL\u0130YEC\u0130','RUHSAT',''];const sorted=sortRows(rows);const counts={};sorted.forEach(v=>{const k=v.customer||'';counts[k]=(counts[k]||0)+1;});return `<div class="table-scroll"><table class="operations"><colgroup>${headers.map(()=>'<col>').join('')}</colgroup><thead><tr>${headers.map((h,i)=>`<th scope="col" class="${i>=1&&i<=3?'status-head':''}">${h}</th>`).join('')}</tr></thead><tbody>${sorted.map((v,i,arr)=>{const newBlock=i===0||(arr[i-1].customer||'')!==(v.customer||'');const bc=custColor(v.customer);const head=newBlock?`<tr class="block-head-row" aria-hidden="true"><td colspan="${headers.length}"><div class="block-head-bar" style="--bc:${bc}"><button type="button" class="block-head-name" data-action="customer-profile" data-name="${esc(v.customer)}">${esc(v.customer||'M\u00dc\u015eTER\u0130S\u0130Z')}</button><span class="block-head-count">${counts[v.customer||'']} ara\u00e7</span>${v.customer?`<button type="button" class="wa-head" data-action="wa-customer" data-name="${esc(v.customer)}" data-date="${esc(v.date)}" title="Bu m\u00fc\u015fterinin bu g\u00fcnk\u00fc t\u00fcm ara\u00e7lar\u0131n\u0131 WhatsApp ile g\u00f6nder">${icon('wa')}WhatsApp</button>`:''}</div></td></tr>`:'';return `${head}<tr class="${v.done?'row-done':v.t1?'row-t1':v.onsite?'row-onsite':''}${v.id===panelId?' is-selected':''}${justChanged(v.id)?' just-changed':''}" style="--bc:${bc}" data-row-id="${esc(v.id)}"${orderReady()?' draggable="true"':''}><td class="num"><input type="checkbox" class="row-select" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} satırını seç" ${selectedIds.has(v.id)?'checked':''}><span>${String(i+1).padStart(2,'0')}</span></td>${[['onsite','TES\u0130STE','Tesiste','amber'],['t1','T1 YAZILDI','T1','blue'],['done','\u0130\u015eLEMLER B\u0130TT\u0130','Bitti','green']].map(([k,l,short,color])=>{const cid=`chk-${esc(v.id)}-${k}`;return `<td class="check-cell"><input class="check-native" id="${cid}" type="checkbox" data-check="${k}" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} ${v.date} ${l}" ${v[k]?'checked':''}><label class="chk-toggle ${color}" for="${cid}">${stIcon(k)}${short}</label></td>`;}).join('')}<td class="info declaration" title="${esc(v.declaration)}">${v.declaration?esc(v.declaration):MISSING}</td><td class="info plate"><button type="button" class="plate-button" data-action="select-visit" data-id="${esc(v.id)}" title="Ara\u00e7 bilgilerini g\u00f6ster">${plateHTML(v.plate,'sm')}</button></td><td class="info" title="${esc(v.carrier)}">${missOr(v.carrier)}</td><td class="info" title="${esc(kgText(v.registration))}">${missOr(kgText(v.registration))}</td><td class="info actions-cell"><button type="button" class="icon-btn wa-btn" data-action="wa-send" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} bilgilerini WhatsApp ile gönder" title="WhatsApp ile müşteriye gönder">${icon('wa')}</button><button type="button" class="icon-btn danger" data-action="delete-visit" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} geli\u015fini sil">${icon('trash')}</button></td></tr>`;}).join('')}</tbody></table></div>`;}
function registryView(){const q=ui.regSearch||'',cf=ui.regCountry??'';const all=state.registry;const cc=r=>plateCountry(splitPlate(r.plate)[0])||'?';
 const counts={};for(const r of all){const c=cc(r);counts[c]=(counts[c]||0)+1;}
 const rows=all.filter(r=>searchMatch(r,q)&&(!cf||cc(r)===cf));
 const map=new Map();for(const r of rows){const k=r.customer||'';if(!map.has(k))map.set(k,[]);map.get(k).push(r);}
 const groups=[...map.entries()].sort((a,b)=>custPriority(a[0])-custPriority(b[0])||a[0].localeCompare(b[0],'tr'));
 const open=ui.regOpen||(ui.regOpen=new Set()),force=!!q||!!cf;
 const ccName=c=>PLATE_COUNTRY[c]?.[0]||'Tanınmayan';
 const chips=`<div class="reg-countries" role="group" aria-label="Ülkeye göre süz"><button type="button" class="reg-cc${!cf?' active':''}" data-action="reg-country" data-cc="" aria-pressed="${!cf}">Tümü <b>${all.length}</b></button>${Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<button type="button" class="reg-cc${cf===c?' active':''}" data-action="reg-country" data-cc="${esc(c)}" aria-pressed="${cf===c}"><span class="reg-code${c==='?'?' unk':''}">${esc(c)}</span>${esc(ccName(c))} <b>${n}</b></button>`).join('')}</div>`;
 const body=groups.map(([name,list])=>{const gc={};for(const r of list){const c=cc(r);gc[c]=(gc[c]||0)+1;}list.sort((a,b)=>a.plate.localeCompare(b.plate,'tr'));
  return `<details class="reg-group" data-cust="${esc(name)}" ${force||open.has(name)?'open':''} style="--bc:${custColor(name)}"><summary><span class="reg-dot"></span><span class="reg-name">${esc(name||'MÜŞTERİSİZ')}</span><span class="reg-count">${list.length} plaka</span><span class="reg-flags">${Object.entries(gc).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<span class="reg-code${c==='?'?' unk':''}" title="${esc(ccName(c))}">${esc(c)}${n>1?` ${n}`:''}</span>`).join('')}</span><span class="set-chev">${icon('down')}</span></summary><div class="reg-body"><table class="registry-table reg-table"><thead><tr><th>PLAKA</th><th>BEYANNAME</th><th>NAKLİYECİ</th><th>RUHSAT</th><th></th></tr></thead><tbody>${list.map(r=>`<tr><td>${plateHTML(r.plate,'sm')}</td><td title="${esc(r.declaration)}">${esc(r.declaration)||DASH}</td><td title="${esc(r.carrier)}">${esc(r.carrier)||DASH}</td><td>${esc(kgText(r.registration))||DASH}</td><td class="reg-act"><button type="button" class="icon-btn" data-action="edit-reg" data-id="${esc(r.id)}" aria-label="${esc(r.plate)} kaydını düzenle">${icon('edit')}</button><button type="button" class="icon-btn danger" data-action="delete-reg" data-id="${esc(r.id)}" aria-label="${esc(r.plate)} kaydını sil">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div></details>`;}).join('');
 return `<div class="board-toolbar reg-toolbar"><div class="board-title"><h2>Kayıtlı araçlar</h2><span class="badge">${all.length} PLAKA · ${new Set(all.map(r=>r.customer)).size} MÜŞTERİ</span></div><div class="actions">${button('reg-open-all','Tümünü aç','down','small text')}${button('reg-close-all','Tümünü kapat','up','small text')}${button('template','Excel şablonu','download','small')}${button('export-reg','Kayıtları aktar','download','small')}<div class="search">${icon('search')}<input id="registry-search" type="search" aria-label="Plaka kayıtlarında ara" placeholder="Plaka, müşteri, beyanname ara..." value="${esc(q)}"></div></div></div>${chips}${rows.length?`<div class="reg-list">${body}</div>`:`<div class="empty-state"><div class="empty-icon">${icon('registry')}</div><h2>${q||cf?'Eşleşen plaka bulunamadı':'Plaka kayıtlarınız burada yer alacak'}</h2><p>${q||cf?'Aramayı veya ülke seçimini değiştirin.':'Yeni plaka kaydı ekleyin ya da Excel şablonunu doldurup toplu olarak içeri alın.'}</p>${button('add-reg','Yeni plaka kaydı','plus','primary')}</div>`}<p class="help-note" style="margin-top:16px">Müşteri başlığına tıklayarak bloğu açıp kapatabilirsiniz. Arama yaptığınızda eşleşen bloklar kendiliğinden açılır. Aynı plaka ikinci kez kaydedilemez.</p>`;}
function reportsView(){const trend=lastWeeks(8),tmax=Math.max(1,...trend.map(w=>w.total));const wv=weekVisits(),rows=ui.day==='all'?wv:wv.filter(v=>v.date===ui.day);const st=stats(rows),ds=ui.day==='all'?dates():[ui.day],max=Math.max(1,...ds.map(d=>rows.filter(v=>v.date===d).length));const map=new Map();for(const v of rows){if(!map.has(v.customer))map.set(v.customer,[]);map.get(v.customer).push(v);}const groups=[...map.entries()].sort((a,b)=>b[1].length-a[1].length);
 return periodPanel()+kpis(rows,ui.day==='all')+`<div class="report-grid"><section class="card"><div class="card-header"><div><h2>${ui.day==='all'?'G\u00fcnlere g\u00f6re ara\u00e7 ak\u0131\u015f\u0131':'Se\u00e7ili g\u00fcn\u00fcn ara\u00e7 ak\u0131\u015f\u0131'}</h2><p>${ui.day==='all'?`${fmt(weekStart())} \u2013 ${fmt(dates()[5])}`:fmt(ui.day)}</p></div><span class="badge">${ui.day==='all'?'HAFTALIK':'G\u00dcNL\u00dcK'}</span></div><div class="bar-chart" role="img" aria-label="G\u00fcnl\u00fck toplam ve tamamlanan geli\u015f say\u0131lar\u0131">${ds.map(d=>{const s=stats(rows.filter(v=>v.date===d));return `<div class="bar-group" title="${DAYS[weekday(d)-1]}: ${s.total} ara\u00e7, ${s.done} tamamland\u0131"><div class="bar" style="height:${s.total/max*85}%"><span>${s.total}</span></div><div class="bar complete" style="height:${s.done/max*85}%"><span>${s.done}</span></div><span class="bar-label">${SHORT_DAYS[weekday(d)-1]} \u00b7 ${d.slice(8)}</span></div>`;}).join('')}</div><div class="legend" style="justify-content:center"><span><i style="background:var(--c-accent)"></i>Toplam ara\u00e7</span><span><i style="background:var(--c-done)"></i>Tamamlanan</span></div></section><section class="card"><div class="card-header"><div><h2>\u0130\u015flem tamamlanma oran\u0131</h2><p>${st.total} geli\u015fin ${st.done} tanesi tamamland\u0131</p></div></div><div class="progress-ring" style="--p:${st.percent}"><div class="ring-inner"><strong>%${st.percent}</strong><span>${st.total?'tamamland\u0131':'hen\u00fcz kay\u0131t yok'}</span></div></div><div class="ring-legend"><span>${st.done} tamamlanan</span><span>${st.pending} bekleyen</span></div></section></div>`+`<section class="card"><div class="card-header"><div><h2>Haftalık trend</h2><p>Son 8 hafta · araç sayısı ve tamamlanma</p></div></div><div class="bar-chart" role="img" aria-label="Haftalık araç sayısı ve tamamlanan trend">${trend.map(w=>`<div class="bar-group" title="${w.week}. hafta ${w.year}: ${w.total} araç, ${w.done} tamamlandı"><div class="bar" style="height:${w.total/tmax*85}%"><span>${w.total}</span></div><div class="bar complete" style="height:${w.done/tmax*85}%"><span>${w.done}</span></div><span class="bar-label">${w.week}.${w.year!==weekNow.year?`'${String(w.year).slice(2)}`:''}</span></div>`).join('')}</div><div class="legend" style="justify-content:center"><span><i style="background:var(--c-accent)"></i>Toplam araç</span><span><i style="background:var(--c-done)"></i>Tamamlanan</span></div></section>`+`<section class="card"><div class="card-header"><div><h2>M\u00fc\u015fteri bazl\u0131 \u00f6zet</h2><p>Her geli\u015f bir ara\u00e7 kayd\u0131 olarak say\u0131l\u0131r; ayn\u0131 plakan\u0131n farkl\u0131 geli\u015fleri ayr\u0131d\u0131r.</p></div></div><div class="table-scroll"><table class="report-table"><thead><tr><th>M\u00dc\u015eTER\u0130</th><th>ARA\u00c7</th><th>TES\u0130STE \u0130\u015eARETL\u0130</th><th>T1 YAZILDI</th><th>TAMAMLANAN</th><th>BEKLEYEN</th></tr></thead><tbody>${groups.length?groups.map(([name,a])=>{const s=stats(a);return `<tr><td><button type="button" class="plate-button rep-cust" style="--bc:${custColor(name)}" data-action="customer-profile" data-name="${esc(name)}">${esc(name)}</button></td><td>${s.total}</td><td>${s.onsite}</td><td>${s.t1}</td><td>${s.done}</td><td>${s.pending}</td></tr>`;}).join(''):'<tr><td colspan="6" class="muted">Bu d\u00f6nemde kay\u0131t bulunmuyor.</td></tr>'}</tbody><tfoot><tr><td>TOPLAM</td><td>${st.total}</td><td>${st.onsite}</td><td>${st.t1}</td><td>${st.done}</td><td>${st.pending}</td></tr></tfoot></table></div></section><p class="help-note" style="margin-top:15px">\u201cTesiste i\u015faretli\u201d bir i\u015flem kutusu say\u0131s\u0131d\u0131r; tesisten \u00e7\u0131k\u0131\u015f kayd\u0131 anlam\u0131na gelmez. Durum kutular\u0131 birbirinden ba\u011f\u0131ms\u0131zd\u0131r.</p>`;
}
function modalHeader(title,subtitle=''){return `<div class="modal-header"><div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button type="button" class="icon-btn" data-action="close-modal" aria-label="Kapat">${icon('close')}</button></div>`;}
function openModal(html){const m=document.getElementById('modal');m.innerHTML=html;const f=m.querySelector('form[data-id]');const row=f?.dataset.id?[...state.registry,...state.visits].find(r=>r.id===f.dataset.id):null;formVersion=row?{id:row.id,updated_at:row.updated_at}:null;if(!m.open)m.showModal();requestAnimationFrame(()=>m.querySelector('[autofocus]')?.focus());}
function closeModal(){formVersion=null;document.getElementById('modal').close();confirmAction=null;}
function field(name,label,value='',opts={}){return `<div class="field ${opts.full?'full':''}"><label for="f-${name}">${label}${opts.optional?' <span class="optional">(iste\u011fe ba\u011fl\u0131)</span>':''}</label><input id="f-${name}" name="${name}" type="${opts.type||'text'}" value="${esc(value)}" maxlength="${opts.max||150}" ${opts.required?'required':''} ${opts.autofocus?'autofocus':''} ${opts.extra||''}>${opts.hint?`<small>${opts.hint}</small>`:''}</div>`;}
function openRegistryForm(id=null,prefill=''){const r=id?state.registry.find(x=>x.id===id):{plate:prefill,customer:'',declaration:'',carrier:'',registration:''};if(!r)return;openModal(`${modalHeader(id?'Plaka kayd\u0131n\u0131 d\u00fczenle':'Yeni plaka kayd\u0131','Buradaki bilgiler yeni geli\u015flerde otomatik getirilir.')}<form id="registry-form" data-id="${id?esc(id):''}"><div class="modal-body"><div class="form-grid">${field('plate','Plaka',r.plate,{required:true,max:30,autofocus:true,extra:'class="plate-input" autocomplete="off"'})}${field('customer','M\u00fc\u015fteri',r.customer,{required:true})}${field('declaration','Beyanname / referans',r.declaration,{optional:true,hint:'Her geli\u015fte de\u011fi\u015febilir; panoda ayr\u0131ca d\u00fczenlenebilir.'})}${field('carrier','Nakliyeci',r.carrier,{optional:true})}${kgField(r.registration,true)}</div><p class="form-note">${id?'Bu de\u011fi\u015fiklik ge\u00e7mi\u015f geli\u015f kay\u0131tlar\u0131n\u0131 de\u011fi\u015ftirmez.':'Yeni kay\u0131t yaln\u0131zca Kaydet d\u00fc\u011fmesiyle olu\u015fturulur. Ayn\u0131 plaka ikinci kez eklenemez.'}</p><div id="form-error" hidden></div></div><div class="modal-footer">${button('close-modal','Vazge\u00e7')}<button class="btn primary" type="submit">${icon('check')}Plakay\u0131 kaydet</button></div></form>`);}
function openVisitForm(id=null,d=null,preset=null){let v=id?state.visits.find(x=>x.id===id):{plate:'',customer:'',declaration:'',carrier:'',registration:'',date:d||defaultDate(),time:timeNow(),note:'',onsite:false,t1:false,done:false};if(!v)return;if(preset){const m=matchPlate(preset.plate);v={...v,...preset,...(m?{plate:m.plate,customer:m.customer,declaration:m.declaration,carrier:m.carrier,registration:m.registration}:{})};}const original=id?norm(v.plate):'';openModal(`${modalHeader(id?'Ara\u00e7 geli\u015fini d\u00fczenle':'Yeni ara\u00e7 geli\u015fi','Plakay\u0131 se\u00e7in, bu geli\u015fin bilgilerini kontrol edip kaydedin.')}<form id="visit-form" data-id="${id?esc(id):''}" data-original="${esc(original)}" data-matched="${esc(norm(v.plate))}"><div class="modal-body"><div class="form-grid"><div class="field full"><label for="f-plate">Plaka <span class="optional">\u00b7 kay\u0131tl\u0131 ara\u00e7tan otomatik doldur</span></label><input id="f-plate" name="plate" list="plate-options" class="plate-input" value="${esc(v.plate)}" placeholder="\u00d6rn. MCA 335" maxlength="30" required autocomplete="off" autofocus><datalist id="plate-options">${state.registry.map(r=>`<option value="${esc(r.plate)}">${esc(r.customer)}</option>`).join('')}</datalist><div id="plate-preview" class="plate-preview">${v.plate?plateHTML(v.plate):''}</div><div id="plate-hint" class="match-hint">${id?'Bu geli\u015fin kaydedilmi\u015f bilgileri g\u00f6steriliyor.':v.plate?'Kay\u0131tl\u0131 plakadan bilgiler getirildi.':'Plakay\u0131 yazd\u0131\u011f\u0131n\u0131zda t\u00fcm bilgiler otomatik gelir.'}</div></div>${field('date','Geli\u015f tarihi',v.date,{required:true,type:'date',hint:'Pazartesi \u2014 Cumartesi. Pazar se\u00e7ilemez.'})}${field('time','Geli\u015f saati',v.time,{type:'time',optional:true})}${field('customer','M\u00fc\u015fteri',v.customer,{required:true})}${field('declaration','Beyanname \u00b7 bu geli\u015f',v.declaration,{optional:true,hint:'Kay\u0131ttan getirilir; her geli\u015f i\u00e7in do\u011frulay\u0131n.'})}${field('carrier','Nakliyeci',v.carrier,{optional:true})}${kgField(v.registration,false)}<div class="field full"><label for="f-note">Operasyon notu <span class="optional">(iste\u011fe ba\u011fl\u0131)</span></label><textarea id="f-note" name="note" maxlength="1000" placeholder="Evrak durumu, bekleme nedeni veya k\u0131sa not...">${esc(v.note)}</textarea></div></div><div class="form-status">${[['onsite','TES\u0130STE'],['t1','T1 YAZILDI'],['done','\u0130\u015eLEMLER B\u0130TT\u0130']].map(([k,l])=>`<label class="form-chip ${k}"><input type="checkbox" class="check ${k}" name="${k}" ${v[k]?'checked':''}><span>${icon('st_'+k)}${l}</span></label>`).join('')}</div><p class="form-note">Bu geli\u015fe \u00f6zel de\u011fi\u015fiklikler ana plaka kayd\u0131n\u0131 veya ge\u00e7mi\u015f haftalar\u0131 etkilemez. Durum kutular\u0131 birbirinden ba\u011f\u0131ms\u0131zd\u0131r.</p><div id="form-error" hidden></div></div><div class="modal-footer">${button('close-modal','Vazge\u00e7')}<button type="submit" class="btn primary">${icon('check')}Geli\u015fi kaydet</button></div></form>`);}
function formError(s){const e=document.getElementById('form-error');e.className='form-error';e.textContent=s;e.hidden=false;}
function visitFields(form){const f=new FormData(form);return {plate:plateText(f.get('plate')),customer:String(f.get('customer')||'').trim(),declaration:String(f.get('declaration')||'').trim(),carrier:String(f.get('carrier')||'').trim(),registration:kgText(f.get('registration')),date:String(f.get('date')||''),time:String(f.get('time')||''),note:String(f.get('note')||'').trim(),onsite:f.has('onsite'),t1:f.has('t1'),done:f.has('done')};}
function handlePlate(){const form=document.getElementById('visit-form');if(!form)return;const p=form.elements.plate.value,r=matchPlate(p),hint=document.getElementById('plate-hint');if(r){if(form.dataset.matched!==norm(p)){for(const k of ['customer','declaration','carrier','registration'])form.elements[k].value=k==='registration'?regNum(r[k]):(r[k]||'');form.dataset.matched=norm(p);}hint.className='match-hint matched';hint.innerHTML=`${icon('check')} ${esc(r.customer)} \u00b7 Kay\u0131tl\u0131 plakadan bilgiler getirildi.`;}else if(form.dataset.original===norm(p)&&norm(p)){hint.className='match-hint';hint.textContent='Bu geli\u015fin mevcut bilgileri kullan\u0131l\u0131yor; ana plaka kayd\u0131 silinmi\u015f olabilir.';}else{if(form.dataset.matched){for(const k of ['customer','declaration','carrier','registration'])form.elements[k].value='';form.dataset.matched='';}hint.className='match-hint unmatched';hint.innerHTML=p.trim()?`Yeni plaka. Kaydedince Plaka Kay\u0131tlar\u0131\u2019na otomatik eklenecek.`:'Plakay\u0131 yaz\u0131n veya kay\u0131tl\u0131 ara\u00e7lardan se\u00e7in.';}}
function customerProfile(name){if(!name)return;const rows=state.visits.filter(v=>(v.customer||'')===name);const s=stats(rows);
 const recent=rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,15);
 const bc=custColor(name),lastDate=recent[0]?.date||'';const phone=customerContacts[name]||'';
 const mon0=monday(weekNow.year,weekNow.week),weeks=[];for(let i=7;i>=0;i--){const m=addDays(mon0,-7*i),e=addDays(m,6),w=rows.filter(v=>v.date>=m&&v.date<=e);weeks.push({label:weekInfo(m).week,total:w.length,done:w.filter(v=>v.done).length,cur:i===0});}
 const wmax=Math.max(1,...weeks.map(w=>w.total));
 const cc={};for(const v of rows){const c=plateCountry(splitPlate(v.plate)[0])||'?';cc[c]=(cc[c]||0)+1;}
 const st=v=>v.done?['done','Tamamlandı']:v.t1?['t1','T1 yazıldı']:v.onsite?['onsite','Tesiste']:['wait','Bekliyor'];
 const kp=[['Toplam araç',s.total],['Bekleyen',s.pending],['Tamamlanan',s.done],['Son geliş',lastDate?fmt(lastDate):'—']];
 openModal(`<div class="modal-header cp-head" style="--bc:${bc}"><div class="cp-title"><span class="cp-dot"></span><div><h2 id="modal-title">${esc(name)}</h2><p>${s.total} araç · tüm zamanlar${phone?` · ${icon('wa')} ${esc(phone)}`:''}</p></div></div><button type="button" class="icon-btn" data-action="close-modal" aria-label="Kapat">${icon('close')}</button></div>
 <div class="modal-body cp-body"><div class="cp-kpis">${kp.map(([l,n])=>`<div class="cp-kpi"><span>${l}</span><b>${n}</b></div>`).join('')}</div>
 <div class="cp-grid"><section class="cp-box"><h3>Son 8 hafta</h3><div class="cp-chart" role="img" aria-label="Son 8 haftalık araç sayısı">${weeks.map(w=>`<div class="cp-bar${w.cur?' cur':''}" title="${w.label}. hafta: ${w.total} araç, ${w.done} tamamlandı"><em>${w.total||''}</em><i style="height:${Math.round(w.total/wmax*100)}%"><u style="height:${w.total?Math.round(w.done/w.total*100):0}%"></u></i><span>${w.label}.</span></div>`).join('')}</div><small class="cp-legend"><i class="a"></i>Araç <i class="d"></i>Tamamlanan</small></section>
 <section class="cp-box"><h3>Plaka ülkeleri</h3><div class="cp-countries">${Object.entries(cc).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<div class="cp-country"><span class="reg-code${c==='?'?' unk':''}">${esc(c)}</span><span>${esc(PLATE_COUNTRY[c]?.[0]||'Tanınmayan')}</span><b>${n}</b></div>`).join('')||'<p class="help-note">Kayıt yok.</p>'}</div></section></div>
 <h3 class="cp-sub">Son araçlar</h3>${recent.length?`<div class="cp-list">${recent.map(v=>{const [k,l]=st(v);return `<div class="cp-row"><button type="button" class="plate-button" data-action="select-visit" data-id="${esc(v.id)}" title="Panoda göster">${plateHTML(v.plate,'sm')}</button><span class="cp-date">${fmt(v.date)}${v.time?' · '+esc(v.time):''}</span><span class="cp-decl">${v.declaration?esc(v.declaration):MISSING}</span><span class="cp-st ${k}">${k!=='wait'?stIcon(k,true):''}${l}</span></div>`;}).join('')}</div>`:'<p class="help-note">Bu müşteriye ait kayıt yok.</p>'}</div>
 <div class="modal-footer">${!VIEW_TOKEN&&lastDate?`<button type="button" class="btn cp-wa" data-action="wa-customer" data-name="${esc(name)}" data-date="${esc(lastDate)}">${icon('wa')}Son günün araçlarını WhatsApp'la gönder</button>`:''}${button('close-modal','Kapat')}</div>`);
 const m=document.getElementById('modal');m.classList.add('cp-modal');m.addEventListener('close',()=>m.classList.remove('cp-modal'),{once:true});}
function confirmDialog(title,text,action,label='Onayla',danger=false){confirmAction=action;openModal(`${modalHeader(title)}<div class="modal-body"><p class="confirm-text">${esc(text)}</p></div><div class="modal-footer">${button('close-modal','Vazge\u00e7')}${button('confirm',label,'',danger?'danger':'primary')}</div>`);}
function changeWeek(step){const target=weekInfo(addDays(weekStart(),step*7));ui.year=target.year;ui.week=target.week;ui.day='all';ui.collapsed.clear();render();}
function demoData(){const reg=[['MCA 335','Marmara D\u0131\u015f Ticaret','Atlas Lojistik'],['34 DEM 101','Ege Tekstil','Ekol Ta\u015f\u0131mac\u0131l\u0131k (\u00f6rnek)'],['06 DEM 202','Anadolu Makine','Kuzey Nakliyat'],['35 DEM 303','Akdeniz G\u0131da','Atlas Lojistik'],['16 DEM 404','Marmara D\u0131\u015f Ticaret','Bursa Ta\u015f\u0131mac\u0131l\u0131k'],['41 DEM 505','Nova Otomotiv','Kuzey Nakliyat'],['34 DEM 606','Ege Tekstil','Atlas Lojistik'],['22 DEM 707','Trakya Ambalaj','Trakya Lojistik'],['55 DEM 808','Anadolu Makine','Karadeniz Nakliyat'],['10 DEM 909','Nova Otomotiv','Bursa Ta\u015f\u0131mac\u0131l\u0131k'],['34 DEM 010','Akdeniz G\u0131da','Atlas Lojistik'],['07 DEM 111','Trakya Ambalaj','Trakya Lojistik']].map(([plate,customer,carrier],i)=>({id:'demo-reg-'+i,plate,customer,declaration:'\u00d6RNEK-BYN-'+String(i+1).padStart(3,'0'),carrier,registration:'\u00d6rnek ruhsat '+(i+1)}));const visits=[];const counts=[5,4,5,4,4,3];for(let d=0;d<6;d++)for(let j=0;j<counts[d];j++){const r=reg[(d*3+j)%reg.length];const stage=d<3?(j<3?3:j===3?2:1):d===3?(j<2?3:2):d===4?(j===0?3:j===1?2:1):(j===0?2:1);visits.push({...r,id:`demo-visit-${d}-${j}`,date:addDays(weekStart(),d),time:['08:30','09:15','10:40','11:20','14:10'][j],declaration:`\u00d6RNEK-BYN-${d+1}${j+1}`,note:stage===3?'\u0130\u015flemler tamamland\u0131':stage===2?'T1 kontrol\u00fc yap\u0131l\u0131yor':j%2?'Evrak bekleniyor':'Tesis giri\u015fi yap\u0131ld\u0131',onsite:true,t1:stage>=2,done:stage===3,createdAt:new Date().toISOString()});}return {...emptyState(),registry:reg,visits};}
function toggleDemo(){closeModal();if(ui.demo){ui.demo=false;state=realState;}else{ui.demo=true;if(!demoState)demoState=demoData();state=demoState;}ui.search='';ui.regSearch='';ui.collapsed.clear();render();toast(ui.demo?'\u00d6rnek g\u00f6r\u00fcn\u00fcm a\u00e7\u0131ld\u0131; ger\u00e7ek veriler ayr\u0131 tutuluyor.':'Ger\u00e7ek kay\u0131tlar\u0131n\u0131za d\u00f6n\u00fcld\u00fc.');}
function downloadBlob(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function backup(prefix='PCS_YEDEK',record=true){const payload={app:'PCS TRANSIT YYS',schemaVersion:1,mode:ui.demo?'demo':'real',exportedAt:new Date().toISOString(),data:state};downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),`${ui.demo?'ORNEK_':''}${prefix}_${TODAY}_${timeNow().replace(':','-')}.json`);if(record&&!ui.demo){try{localStorage.setItem(STORE+'.backupAt',new Date().toISOString());}catch(e){}}if(record){toast('T\u00fcm kay\u0131tlar\u0131 i\u00e7eren JSON yede\u011fi indirildi.');if(ui.page==='data')render();}}
function openExport(){openModal(`${modalHeader('Excel\u2019e aktar','Excel dosyalar\u0131 rapor kopyas\u0131d\u0131r. Eksiksiz geri y\u00fckleme i\u00e7in JSON yede\u011fi kullan\u0131n.')}<div class="modal-body"><div class="card" style="padding:15px;margin-bottom:13px"><h3>${ui.week}. hafta \u00b7 ${ui.year}</h3><p class="help-note" style="margin:7px 0 13px">${fmt(weekStart())} \u2013 ${fmt(dates()[5])}. Haftal\u0131k \u00f6zet, PANO, alt\u0131 g\u00fcn sayfas\u0131 ve plaka kay\u0131tlar\u0131.</p>${button('export-week','Haftay\u0131 Excel\u2019e aktar','download','primary')}</div><div class="card" style="padding:15px"><h3>Tek g\u00fcn\u00fcn raporu</h3><div class="actions" style="margin-top:12px"><select id="export-day" aria-label="Aktar\u0131lacak g\u00fcn">${dates().map((d,i)=>`<option value="${d}" ${d===defaultDate()?'selected':''}>${DAYS[i]} \u00b7 ${fmt(d)}</option>`).join('')}</select>${button('export-day','G\u00fcn\u00fc aktar','download')}</div></div></div><div class="modal-footer">${button('export-reg','Plaka kay\u0131tlar\u0131n\u0131 aktar','registry')}${button('close-modal','Kapat')}</div>`);}
async function exportExcel(mode){try{if(!window.PCSXLSX)throw new Error('Excel bile\u015feni y\u00fcklenemedi.');const selected=mode==='day'?(document.getElementById('export-day')?.value||defaultDate()):null;const data={state:structuredClone(state),year:ui.year,week:ui.week,monday:weekStart(),selectedDate:selected,demo:ui.demo,customerPriority:custPriorityList};const out=PCSXLSX.makeWorkbook(data,mode);downloadBlob(out.blob,out.name);closeModal();toast('Excel dosyas\u0131 haz\u0131rland\u0131 ve indirildi.');}catch(e){toast('Excel aktar\u0131m\u0131 tamamlanamad\u0131: '+e.message,true);}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,id=b.dataset.id;
 if(a==='bulk-clear'){selectedIds.clear();render();return;}
 if(a==='bulk-onsite'||a==='bulk-t1'||a==='bulk-done'){
  const key=a.slice(5);const ids=[...selectedIds];if(!ids.length)return;
  busy=true;onlineUI();
  try{const {error}=await client.from('visits').update({[key]:true}).in('id',ids).select('id');if(error)throw error;
   selectedIds.clear();busy=false;await syncData();toast(`${ids.length} araç güncellendi.`);
  }catch(err){toast(friendly(err),true);}
  finally{busy=false;onlineUI();}
  return;
 }
 if(a==='nav'){ui.page=b.dataset.page;render();return;}
 if(a==='select-visit'){if(window.innerWidth<1440&&canEdit()){pendingVisit=null;return openVisitForm(id);}ui.selected=id;{const md=document.getElementById('modal');if(md.open)closeModal();}if(ui.page!=='pano')ui.page='pano';render();return;}
 if(a==='prev-week')return changeWeek(-1);if(a==='next-week')return changeWeek(1);
 if(a==='this-week'){ui.year=weekNow.year;ui.week=weekNow.week;ui.day='all';ui.collapsed.clear();return render();}
 if(a==='day'){ui.day=b.dataset.date;return render();}
 if(a==='collapse'){ui.collapsed.has(b.dataset.date)?ui.collapsed.delete(b.dataset.date):ui.collapsed.add(b.dataset.date);return render();}
 if(a==='add-visit'){pendingVisit=null;return openVisitForm(null,b.dataset.date||defaultDate());}
 if(a==='edit-visit'){pendingVisit=null;return openVisitForm(id);}
 if(a==='add-reg'){pendingVisit=null;return openRegistryForm();}
 if(a==='edit-reg'){pendingVisit=null;return openRegistryForm(id);}
 if(a==='customer-profile'){customerProfile(b.dataset.name);return;}
 if(a==='prio-up'||a==='prio-down'){const i=Number(b.dataset.i),j=a==='prio-up'?i-1:i+1;if(j<0||j>=custPriorityList.length)return;[custPriorityList[i],custPriorityList[j]]=[custPriorityList[j],custPriorityList[i]];render();return;}
 if(a==='prio-del'){custPriorityList.splice(Number(b.dataset.i),1);render();return;}
 if(a==='prio-add'){custPriorityList.push({match:'',color:'#2dd4bf'});render();return;}
 if(a==='prio-save'){
  if(!canEdit())return;
  const clean=custPriorityList.map(e=>({match:String(e.match||'').trim(),color:e.color||'#2dd4bf'})).filter(e=>e.match);
  busy=true;onlineUI();
  try{let {error}=await client.rpc('save_app_setting',{p_key:'customer_priority',p_value:clean});if(error&&error.code==='PGRST202')({error}=await client.from('app_settings').update({value:clean,updated_at:new Date().toISOString()}).eq('key','customer_priority').select());if(error)throw error;custPriorityList=clean;generation++;prioDirty=false;busy=false;render();syncData();toast('Öncelik listesi kaydedildi.');}
  catch(err){toast(err.code==='PGRST116'||/relation .app_settings. does not exist/i.test(err.message||'')?'Önce siralama-kurulumu SQL dosyasını çalıştırın (musteri-onceligi-kurulumu.sql).':friendly(err),true);}
  finally{busy=false;onlineUI();}
  return;
 }
 if(a==='register-current'){const form=document.getElementById('visit-form');pendingVisit={...visitFields(form),editingId:form.dataset.id||null};return openRegistryForm(null,pendingVisit.plate);}
 if(a==='delete-visit'){const v=state.visits.find(x=>x.id===id);if(v)confirmDialog('Ara\u00e7 geli\u015fini sil',`${v.plate} plakas\u0131n\u0131n ${fmt(v.date)} tarihli geli\u015fi silinecek. Ana plaka kayd\u0131 ve di\u011fer geli\u015fler korunur.`,async()=>{formVersion={id:v.id,updated_at:v.updated_at};if(await mutate(s=>s.visits=s.visits.filter(x=>x.id!==id))){closeModal();toast('Geli\u015f kayd\u0131 silindi.');}},'Geli\u015fi sil',true);return;}
 if(a==='delete-reg'){const r=state.registry.find(x=>x.id===id);if(r)confirmDialog('Ana plaka kayd\u0131n\u0131 sil',`${r.plate} plakas\u0131 ana kay\u0131tlardan silinecek. Ge\u00e7mi\u015f geli\u015fler korunur. Bu plaka sonraki yeni geli\u015flerde otomatik bulunamaz.`,async()=>{formVersion={id:r.id,updated_at:r.updated_at};if(await mutate(s=>s.registry=s.registry.filter(x=>x.id!==id))){closeModal();toast('Ana plaka kayd\u0131 silindi.');}},'Plakay\u0131 sil',true);return;}
 if(a==='close-modal'){pendingVisit=null;return closeModal();}
 if(a==='confirm'){const fn=confirmAction;if(fn){confirmAction=null;fn();}return;}
 if(a==='toggle-demo')return toggleDemo();if(a==='export')return openExport();
 if(a==='export-week')return exportExcel('week');if(a==='export-day')return exportExcel('day');if(a==='export-reg')return exportExcel('registry');if(a==='template')return exportExcel('template');
 if(a==='import-reg'){document.getElementById('registry-file').click();return;}
 if(a==='backup')return backup();
 if(a==='print'){const prior=new Set(ui.collapsed);ui.collapsed.clear();render();window.print();ui.collapsed=prior;render();return;}
});
document.addEventListener('change',async e=>{const t=e.target;if(t.classList.contains('prio-color')||t.classList.contains('prio-match')){const i=Number(t.dataset.i);if(!custPriorityList[i])return;if(t.classList.contains('prio-color'))custPriorityList[i].color=t.value;else custPriorityList[i].match=t.value;return;}if(t.classList.contains('row-select')){if(t.checked)selectedIds.add(t.dataset.id);else selectedIds.delete(t.dataset.id);render();return;}if(t.dataset.check){const key=t.dataset.check,id=t.dataset.id,value=t.checked;if(!await mutate(s=>{const v=s.visits.find(x=>x.id===id);if(v)v[key]=value;}))render();return;}if(t.id==='year-select'){ui.year=Number(t.value);ui.week=Math.min(ui.week,weekInfo(`${ui.year}-12-28`).week);ui.day='all';ui.collapsed.clear();render();}if(t.id==='week-select'){ui.week=Number(t.value);ui.day='all';ui.collapsed.clear();render();}if(t.id==='day-select'){ui.day=t.value;render();}if(t.id==='registry-file')readRegistryFile(t.files[0]);});
document.addEventListener('input',e=>{if(e.target.id==='board-search'){ui.search=e.target.value;render();}if(e.target.id==='registry-search'){ui.regSearch=e.target.value;render();}if(e.target.id==='f-plate'&&document.getElementById('visit-form'))handlePlate();});
document.addEventListener('submit',async e=>{
 if(e.target.id==='registry-form'){e.preventDefault();const f=e.target,fd=new FormData(f),id=f.dataset.id;const r={id:id||uid(),plate:plateText(fd.get('plate')),customer:String(fd.get('customer')||'').trim(),declaration:String(fd.get('declaration')||'').trim(),carrier:String(fd.get('carrier')||'').trim(),registration:kgText(fd.get('registration'))};if(!norm(r.plate)||!r.customer)return formError('Plaka ve m\u00fc\u015fteri zorunludur.');if(state.registry.some(x=>x.id!==id&&norm(x.plate)===norm(r.plate)))return formError('Bu plaka zaten kay\u0131tl\u0131. Mevcut kayd\u0131 d\u00fczenleyin.');if(!id&&state.registry.length>=10000)return formError('10.000 plaka s\u0131n\u0131r\u0131na ula\u015f\u0131ld\u0131.');if(await mutate(s=>{if(id)s.registry=s.registry.map(x=>x.id===id?r:x);else s.registry.push(r);})){const pending=pendingVisit;pendingVisit=null;closeModal();toast('Plaka kayd\u0131 kaydedildi.');if(pending)openVisitForm(pending.editingId||null,pending.date,{...pending,plate:r.plate});}return;}
 if(e.target.id==='visit-form'){e.preventDefault();const f=e.target,id=f.dataset.id,v=visitFields(f);const source=matchPlate(v.plate);if(source)v.plate=source.plate;if(!validDate(v.date))return formError('Ge\u00e7erli bir geli\u015f tarihi se\u00e7in.');if(weekday(v.date)===0)return formError('Pazar g\u00fcn\u00fc kay\u0131t al\u0131nmaz. Pazartesi\u2013Cumartesi aras\u0131nda bir g\u00fcn se\u00e7in.');const reg=matchPlate(v.plate);const skipReg=!reg&&id&&f.dataset.original===norm(v.plate);if(!v.customer)return formError('M\u00fc\u015fteri ad\u0131 zorunludur.');if(state.visits.some(x=>x.id!==id&&x.date===v.date&&norm(x.plate)===norm(v.plate))&&!window.confirm('Bu plaka i\u00e7in ayn\u0131 g\u00fcnde ba\u015fka bir geli\u015f kayd\u0131 var. Ayr\u0131 bir geli\u015f olarak kaydetmek istiyor musunuz?'))return;let regNote='';if(!skipReg){if(!reg)v.plate=plateText(v.plate);const ch=registryChange(reg,v);if(ch){if(!await writeRegistry(ch))return;await syncData();regNote=ch.insert?'Ara\u00e7 geli\u015fi kaydedildi ve plaka kay\u0131tlar\u0131na eklendi.':'Ara\u00e7 geli\u015fi kaydedildi; plaka kayd\u0131ndaki bo\u015f bilgiler tamamland\u0131.';}}const prev=id?state.visits.find(x=>x.id===id):null;v.id=id||uid();v.createdAt=prev?.createdAt||new Date().toISOString();if(await mutate(s=>{if(id)s.visits=s.visits.map(x=>x.id===id?v:x);else s.visits.push(v);})){const w=weekInfo(v.date);if(w.year!==ui.year||w.week!==ui.week){ui.year=w.year;ui.week=w.week;ui.day=v.date;}else if(ui.day!=='all')ui.day=v.date;ui.collapsed.delete(v.date);closeModal();render();toast(regNote||'Ara\u00e7 geli\u015fi kaydedildi.');ruhsatAfterSave();}return;}
});
window.PCS_TEST={norm,weekInfo,monday,addDays,validDate,weekday,stats,validateData,ruhsatPlates,ruhsatKinds,ruhsatResolve,getState:()=>structuredClone(state),getUI:()=>({...ui,collapsed:[...ui.collapsed]}),today:TODAY};
const client = window.createPCSClient('https://ollrccfqiqilbflanuik.supabase.co','sb_publishable_BV4TQSJ5lCNyTdRZV-Ouvg_bDOzBNQk');
let account=null, role='viewer', busy=false, loading=false, resync=false, generation=0, formVersion=null, lastSync='';
const writeActions=new Set(['move-up','move-down','clear-order','bulk-onsite','bulk-t1','bulk-done','bulk-clear','prio-up','prio-down','prio-del','prio-add','prio-save','add-visit','edit-visit','delete-visit','add-reg','edit-reg','delete-reg','register-current','app-save','app-reset','app-preset','link-show','link-rotate','carry-next','bulk-next','wa-contacts-save','import-reg','import-confirm','ruhsat-open','ruhsat-add','ruhsat-form','ruhsat-clear','ruhsat-clip','ruhsat-dismiss']);
const disabledActions=new Set(['toggle-demo']);
const canEdit=()=>!!account&&role==='editor'&&!busy&&navigator.onLine!==false;
function authScreen(message=''){
 document.getElementById('app').innerHTML=`<div class="auth-wrap"><section class="auth-hero"><div class="auth-brand"><i class="auth-logo"><img src="logo.svg" alt=""></i>PCS TRANSİT YYS</div><div><h2>Araç geliş ve gümrük işlemlerini tek panelden takip edin.</h2><p>Plaka, müşteri, beyanname ve T1 durumları ekip üyeleri arasında anlık ve düzenli biçimde paylaşılır.</p><ul class="auth-points"><li><span class="dot">${icon('grid')}</span><div><b>Haftalık operasyon panosu</b>Pazartesi–Cumartesi günlerine göre gelen araçlar.</div></li><li><span class="dot">${icon('st_done')}</span><div><b>Tesiste, T1 yazıldı, işlemler bitti</b>Her aracın durumu ayrı ayrı işaretlenir.</div></li><li><span class="dot">${icon('chart')}</span><div><b>Raporlar ve Excel çıktısı</b>Günlük ve haftalık özetler, müşteri bazlı toplamlar.</div></li></ul><div class="auth-demo" aria-hidden="true"><div class="auth-demo-row">${plateHTML('PB 5126 PE - PB 2244 EC')}<span class="auth-chip on onsite">${icon('st_onsite')}Tesiste</span><span class="auth-chip on t1">${icon('st_t1')}T1</span><span class="auth-chip">${icon('st_done')}Bitti</span></div><div class="auth-demo-row">${plateHTML('34 ETK 42')}<span class="auth-chip on onsite">${icon('st_onsite')}Tesiste</span><span class="auth-chip on t1">${icon('st_t1')}T1</span><span class="auth-chip on done">${icon('st_done')}Bitti</span></div></div></div><small>PCS TRANSİT YYS · Ortak Çalışma</small></section><section class="auth-panel"><div class="card auth-card"><img class="auth-card-logo" src="logo.svg" alt=""><div class="eyebrow">ORTAK ÇALIŞMA</div><h1>Hoş geldiniz</h1><p class="lead">Araç operasyon panosuna kendi hesabınızla giriş yapın.</p><form id="auth-form"><div class="field"><label for="email">E-posta</label><input id="email" name="email" type="email" required autocomplete="username" placeholder="ad@sirket.com"></div><div class="field"><label for="password">Parola</label><input id="password" name="password" type="password" minlength="8" required autocomplete="current-password" placeholder="En az 8 karakter"></div><div class="auth-forgot"><button class="btn text small" type="button" data-action="reset-password">Parolamı unuttum</button></div><button class="btn primary" type="submit">Giriş yap</button><p id="auth-message" class="auth-msg" role="status">${esc(message)}</p></form><div class="auth-note">Hesaplar yönetici tarafından açılır. Erişim için yöneticinize başvurun.</div></div></section></div>`;
}
function onlineUI(){document.documentElement.classList.toggle('is-editor',role==='editor');
 for(const b of document.querySelectorAll('[data-action]')){
  if(disabledActions.has(b.dataset.action)){b.hidden=true;b.style.display='none';}
  if(writeActions.has(b.dataset.action)){b.disabled=!canEdit();if(role!=='editor'&&!b.classList.contains('plate-button'))b.style.display='none';}
 }
 document.querySelectorAll('[data-check]').forEach(x=>x.disabled=!canEdit());
 document.querySelectorAll('.row-select').forEach(x=>x.disabled=!canEdit());
 document.querySelectorAll('.prio-color,.prio-match,.app-set').forEach(x=>x.disabled=!canEdit());
 document.querySelectorAll('.wa-phone,.wa-tpl').forEach(x=>x.disabled=!canEdit());
 if(VIEW_TOKEN)document.querySelectorAll('[data-action^="wa-"]').forEach(x=>x.style.display='none');
 if(VIEW_TOKEN){const user=document.querySelector('.sidebar-user');if(user)user.innerHTML=`<span><span class="acct-name">Sadece görüntüleme</span><small>Otomatik güncellenir · ${esc(lastSync)}</small></span>`;const status=document.querySelector('.save-status');if(status)status.textContent=storageError?'Bağlantı kesildi':`Güncel · ${lastSync}`;return;}
 const status=document.querySelector('.save-status');if(status)status.textContent=storageError?'Bağlantı kesildi · yeniden deneyin':busy?'Kaydediliyor…':`Güncel · ${lastSync}`;
 const card=document.querySelector('.local-card');if(card)card.innerHTML=`<strong>Ortak çalışma alanı</strong><p>Değişiklikler 15 saniyede bir yenilenir.</p>${button('refresh','Şimdi yenile','','small')}`;
 const user=document.querySelector('.sidebar-user');if(user)user.innerHTML=`<span style="overflow-wrap:anywhere"><span class="acct-name">${esc(displayName(account?.email))}</span><small>${role==='editor'?'Düzenleyici':'Görüntüleyici'}</small>${button('signout','Çıkış yap','','small')}</span>`;
 const top=document.querySelector('.topbar-right');if(top&&!top.querySelector('[data-action="signout"]'))top.insertAdjacentHTML('beforeend',button('signout','Çıkış','','small'));
 waBadge();
}
function mapRow(r,table){return {...r,...(table==='visits'?{date:r.visit_date,time:(r.visit_time||'').slice(0,5),createdAt:r.created_at}:{}),customer:r.customer||'',declaration:r.declaration||'',carrier:r.carrier||'',registration:r.registration||'',note:r.note||''};}
async function fetchAll(table){let rows=[];for(let start=0;;start+=1000){const {data,error}=await client.from(table).select('*').order('id').range(start,start+999);if(error)throw error;rows.push(...data.map(r=>mapRow(r,table)));if(data.length<1000)return rows;}}
/* Hafif senkron: 15 sn'lik yoklamada önce tabloların satır sayısı + son updated_at değerine bakılır;
   değişiklik yoksa tüm tablolar yeniden indirilmez. Güvenlik için en geç 2 dakikada bir tam senkron yapılır. */
let syncPrint='',fullSyncAt=0;const FULL_SYNC_MS=120000;
async function tablePrint(t){const {data,count,error}=await client.from(t).select('updated_at',{count:'exact'}).order('updated_at',{ascending:false,nullsFirst:false}).limit(1);if(error)throw error;return `${count}:${data?.[0]?.updated_at||''}`;}
async function remotePrint(){const [a,b,c]=await Promise.all([tablePrint('registry'),tablePrint('visits'),tablePrint('app_settings').catch(()=>'-')]);return `${a}|${b}|${c}`;}
/* Çevrimdışı okuma: son başarılı senkronun kopyası bu cihazda saklanır (son 60 gün + bitmemiş araçlar).
   İnternet yokken uygulama açılırsa bu kopya gösterilir; değişiklik yapılamaz. Çıkış yapınca silinir. */
const CACHE_KEY=STORE+'.cache';let lastSettings=null;
function isNetErr(e){return navigator.onLine===false||/Failed to fetch|NetworkError|Load failed|network request failed/i.test(String(e?.message||''));}
function saveCache(){if(!account?.id)return;try{const from=addDays(TODAY,-60);localStorage.setItem(CACHE_KEY,JSON.stringify({uid:account.id,at:new Date().toISOString(),role,registry:state.registry,visits:state.visits.filter(v=>!v.done||v.date>=from),settings:lastSettings}));}catch(_){try{localStorage.removeItem(CACHE_KEY);}catch(__){}}}
function loadCache(){try{const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(!c||c.uid!==account?.id||!Array.isArray(c.visits)||!Array.isArray(c.registry))return false;
 role=c.role==='editor'?'editor':'viewer';state=realState={...emptyState(),registry:c.registry,visits:c.visits,updatedAt:c.at};if(c.settings)applySettings(c.settings);
 storageError=`İnternet bağlantısı yok. ${tsText(c.at)} itibarıyla bu cihazda saklanan kayıtlar gösteriliyor; bağlantı gelince otomatik güncellenir.`;return true;}catch(_){return false;}}
function clearCache(){try{localStorage.removeItem(CACHE_KEY);}catch(_){}}
/* Bir istek takılırsa (bilgisayar uykudan çıkınca, ağ değişince) senkron sonsuza kadar "sürüyor" kalmasın:
   25 sn'den uzun süren senkron bırakılır, yenisi başlar; eskisinin sonucu (generation farkı) yok sayılır.
   (15 sn'lik yoklamanın katı olmasın diye 25 sn: ikinci yoklamada kesin devreye girer.) */
let syncRun=0,syncStarted=0;const SYNC_STUCK_MS=25000;
/* Anlık güncelleme: başka biri kayıt değiştirince Supabase Realtime haber verir, 15 sn'lik yoklama beklenmez.
   Tablolar Supabase'de "supabase_realtime" yayınına eklenmemişse bildirim gelmez; 15 sn'lik yoklama yine çalışır. */
let rtChannel=null,rtTimer=null;
function startRealtime(){if(VIEW_TOKEN||rtChannel||typeof client.channel!=='function')return;
 const ping=()=>{clearTimeout(rtTimer);rtTimer=setTimeout(()=>{if(!document.hidden)syncData({remote:true,poll:true});},400);};
 try{rtChannel=client.channel('pcs-degisiklikler');for(const table of ['visits','registry','app_settings'])rtChannel.on('postgres_changes',{event:'*',schema:'public',table},ping);rtChannel.subscribe();}catch(_){rtChannel=null;}}
function stopRealtime(){clearTimeout(rtTimer);if(rtChannel){try{client.removeChannel(rtChannel);}catch(_){}rtChannel=null;}waStop();}
async function syncData(opts={}){
 if(!account||busy)return;if(loading){if(Date.now()-syncStarted<SYNC_STUCK_MS){resync=true;return;}generation++;}
 loading=true;const run=++syncRun;syncStarted=Date.now();const stamp=generation;const prevVisits=opts.remote&&(realState?.visits||[]).length?realState.visits:null;
 try{if(VIEW_TOKEN){const {data,error}=await client.rpc('public_board',{p_token:VIEW_TOKEN});if(error)throw error;if(stamp!==generation)return;
 role='viewer';state=realState={...emptyState(),registry:[],visits:(data?.visits||[]).map(r=>mapRow(r,'visits')),updatedAt:new Date().toISOString()};storageError='';lastSync=timeNow();applySettings(data?.settings||{});
 }else{let fp='';try{fp=await remotePrint();}catch(_){fp='';}
 if(opts.poll&&fp&&fp===syncPrint&&!storageError&&Date.now()-fullSyncAt<FULL_SYNC_MS){lastSync=timeNow();const sd=document.querySelector('.saha-date small');if(sd)sd.textContent='Güncel · '+lastSync;return;}
 const [{data:nextRole,error},registry,visits]=await Promise.all([client.rpc('current_app_role'),fetchAll('registry'),fetchAll('visits')]);if(error)throw error;if(stamp!==generation)return;
 role=nextRole==='editor'?'editor':'viewer';state=realState={...emptyState(),registry,visits,updatedAt:new Date().toISOString()};storageError='';lastSync=timeNow();syncPrint=fp;fullSyncAt=Date.now();
 try{const {data:sRows,error:sErr}=await client.from('app_settings').select('*');if(!sErr&&Array.isArray(sRows)){lastSettings=Object.fromEntries(sRows.map(s=>[s.key,s.value]));applySettings(lastSettings);}else if(sErr)console.warn('Ayarlar okunamadı (ayar-okuma-duzeltmesi.sql çalıştırılmalı):',sErr.message);}catch(e){}}
 if(prevVisits)try{liveDiff(prevVisits,state.visits);}catch(_){}
 if(!VIEW_TOKEN)saveCache();
 render();
 }catch(e){syncPrint='';if(stamp===generation){if(!VIEW_TOKEN&&isNetErr(e)&&!realState.visits.length&&!realState.registry.length&&loadCache()){render();return;}storageError=VIEW_TOKEN&&(e.code==='42501'||e.code==='PGRST202')?'Bu görüntüleme linki geçersiz ya da kapatılmış. Yeni linki yöneticiden isteyin.':'Veriler yenilenemedi. Son görülen kayıtlar gösteriliyor. '+friendly(e);render();}}
 finally{if(run!==syncRun)return;loading=false;if(account)onlineUI();if(resync){resync=false;syncData();}else if(account&&role==='editor'){maybeCarry();waTick();}}
}
function friendly(e){if(isNetErr(e))return 'İnternet bağlantısı yok. Bağlantı gelince tekrar deneyin.';if(e.code==='23505')return 'Bu plaka zaten kayıtlı.';if(e.code==='42501')return 'Bu işlem için düzenleyici yetkisi gerekli.';if(e.code==='23514')return 'Plaka, müşteri ve Pazartesi–Cumartesi tarihini kontrol edin.';return e.message||'Bağlantıyı kontrol edip yeniden deneyin.';}
function payload(r,table){const fields=['plate','customer','declaration','carrier','registration'];const p=Object.fromEntries(fields.map(k=>[k,r[k]||'']));if(table==='visits') Object.assign(p,{visit_date:r.date,visit_time:r.time||null,onsite:r.onsite,t1:r.t1,done:r.done,note:r.note||''});return p;}
async function mutate(fn){
 if(!canEdit()){toast(navigator.onLine===false?'İnternet bağlantısı yok; değişiklik kaydedilemez. Bağlantı gelince tekrar deneyin.':'Düzenleyici yetkisi gerekli veya kayıt işlemi sürüyor.',true);return false;}
 const before=structuredClone(state),next=structuredClone(state);fn(next);const changes=[];
 for(const table of ['registry','visits']){const old=new Map(before[table].map(r=>[r.id,r]));for(const r of next[table]){const prior=old.get(r.id);old.delete(r.id);if(!prior||JSON.stringify(payload(prior,table))!==JSON.stringify(payload(r,table)))changes.push({table,r,prior});}for(const prior of old.values())changes.push({table,prior});}
 if(changes.length!==1){toast('Her seferinde tek kayıt değiştirin.',true);return false;}
 busy=true;onlineUI();const c=changes[0];
 try{let q;if(!c.prior)q=client.from(c.table).insert({id:c.r.id,...payload(c.r,c.table)});else{q=c.r?client.from(c.table).update(payload(c.r,c.table)):client.from(c.table).delete();q=q.eq('id',c.prior.id).eq('updated_at',formVersion?.id===c.prior.id?formVersion.updated_at:c.prior.updated_at);}
 const {data,error}=await q.select('id');if(error)throw error;if(data.length!==1)throw new Error('Kayıt başka bir kullanıcı tarafından değiştirildi veya silindi. Formu kapatıp güncel kaydı yeniden açın.');
 busy=false;await syncData();return true;
 }catch(e){toast(friendly(e),true);return false;}finally{busy=false;onlineUI();}
}
function dataView(){return `<section class="card"><h2>Ortak veriler</h2><p style="margin:15px 0">${state.registry.length} plaka · ${state.visits.length} geliş. Veriler Supabase üzerinde ortak saklanır. Günlük ve haftalık Excel dosyalarını Raporlar bölümünden indirebilirsiniz.</p>${button('backup','JSON kopyası indir','download','primary')}<p class="help-note">Bu dosya tüm geçmişin kopyasıdır. Toplu geri yükleme yönetici tarafından yapılır.</p></section>`;}
var VIEW_TOKEN=(new URLSearchParams(location.search).get('izle')||'').trim();
var prioDirty=false,appearanceDirty=false,publicLink='';
const APP_FONTS={varsayilan:['Varsayılan · Roboto (siteye gömülü, her cihazda aynı)','"PCS Roboto",Roboto,"Segoe UI",Arial,sans-serif'],eski:['Eski varsayılan (Inter / Segoe UI)','Inter,"Segoe UI",Arial,sans-serif'],segoe:['Segoe UI','"Segoe UI",Arial,sans-serif'],segoevar:['Segoe UI Variable','"Segoe UI Variable Text","Segoe UI",sans-serif'],arial:['Arial','Arial,Helvetica,sans-serif'],arialnarrow:['Arial Narrow (dar)','"Arial Narrow",Arial,sans-serif'],verdana:['Verdana','Verdana,Geneva,sans-serif'],tahoma:['Tahoma','Tahoma,Verdana,sans-serif'],trebuchet:['Trebuchet MS','"Trebuchet MS",Arial,sans-serif'],calibri:['Calibri','Calibri,Carlito,Arial,sans-serif'],candara:['Candara','Candara,Calibri,sans-serif'],corbel:['Corbel','Corbel,Calibri,sans-serif'],bahnschrift:['Bahnschrift','Bahnschrift,"Segoe UI",sans-serif'],franklin:['Franklin Gothic','"Franklin Gothic Medium","Franklin Gothic",Arial,sans-serif'],century:['Century Gothic','"Century Gothic",Futura,Arial,sans-serif'],lucida:['Lucida Sans','"Lucida Sans Unicode","Lucida Grande",sans-serif'],gill:['Gill Sans','"Gill Sans MT","Gill Sans",Calibri,sans-serif'],georgia:['Georgia','Georgia,"Times New Roman",serif'],cambria:['Cambria','Cambria,Georgia,serif'],constantia:['Constantia','Constantia,Georgia,serif'],palatino:['Palatino','"Palatino Linotype",Palatino,Georgia,serif'],consolas:['Consolas (eş aralıklı)','Consolas,"Courier New",monospace'],courier:['Courier New (daktilo)','"Courier New",Courier,monospace']};
const APP_PLATE_FONTS={ayni:['Genel yazı tipiyle aynı',''],...APP_FONTS,arialblack:['Arial Black (çok kalın)','"Arial Black",Arial,sans-serif']};
const APP_WEIGHTS={ince:'İnce',normal:'Normal',bold:'Kalın',extra:'Çok kalın',black:'En kalın'};
const APP_SIZES={cokkucuk:['Çok küçük',0.85],kucuk:['Küçük',0.92],normal:['Normal',1],buyuk:['Büyük',1.08],cokbuyuk:['Çok büyük',1.16],devasa:['En büyük',1.25]};
const APP_SPACING={dar:['Dar','-0.01em'],normal:['Normal','0'],genis:['Geniş','0.03em'],cokgenis:['Çok geniş','0.06em']};
const APP_PLATE={normal:['Normal','15px'],buyuk:['Büyük','17px'],cokbuyuk:['Çok büyük','19px'],devasa:['En büyük','22px']};
const APP_DENSITY={sikisik:['Sıkışık','7px'],normal:['Normal','16px'],genis:['Geniş','22px']};
const APP_TINT={yok:['Renksiz','0%'],hafif:['Hafif','8%'],normal:['Normal','15%'],guclu:['Güçlü','26%'],cokguclu:['Çok güçlü','40%']};
const APP_BG={gri:['Açık gri','#f5f7fa'],beyaz:['Beyaz','#ffffff'],sicak:['Sıcak (krem)','#faf8f3'],mavi:['Açık mavi','#f1f5fc'],yesil:['Açık yeşil','#f3f8f5']};
const APP_HALIGN={center:'Ortada',left:'Solda'};
const APP_BOARDVIEW={table:'Tablo',cards:'Kartlar'};
const APP_CHIPSTYLE={soft:'Yumuşak (sadece Bitti dolu renk)',solid:'Dolu renk'};
const APP_HEADSTYLE={minimal:'Sade (beyaz başlık, ince renkli çizgi)',band:'Renkli şerit'};
const APP_ROWSTYLE={minimal:'Sade (sadece bitenler hafif yeşil)',full:'Renkli (duruma göre tüm satır)'};
const APP_ONOFF={on:'Açık',off:'Kapalı'};
const APP_HSTR={hafif:['Hafif','12%'],normal:['Normal','24%'],koyu:['Koyu','45%'],cokkoyu:['Çok koyu','65%']};
const APP_DEFAULT={font:'varsayilan',plateFont:'ayni',weight:'normal',size:'normal',spacing:'normal',plateSize:'normal',density:'normal',tint:'normal',bg:'gri',headAlign:'center',headStrength:'normal',headStyle:'minimal',rowStyle:'minimal',chipStyle:'soft',liveNotify:'on',boardView:'table',plateBand:'on',statusIcons:'on',colors:{onsite:'#f59e0b',t1:'#2f5fd0',done:'#15803d',brand:'#16233a',accent:'#3453d1'}};
const APP_PRESETS={klasik:['Kurumsal (önerilen)',{}],canli:['Canlı',{headStyle:'band',rowStyle:'full',chipStyle:'solid',weight:'bold',tint:'guclu',headStrength:'koyu',colors:{onsite:'#f97316',t1:'#2563eb',done:'#16a34a',brand:'#1e3a8a',accent:'#2563eb'}}],sade:['Sade',{tint:'hafif',headStrength:'hafif',bg:'beyaz',colors:{onsite:'#d97706',t1:'#3b82f6',done:'#059669',brand:'#334155',accent:'#475569'}}],kontrast:['Yüksek kontrast',{weight:'extra',size:'buyuk',plateSize:'buyuk',tint:'cokguclu',headStrength:'koyu',bg:'beyaz',colors:{onsite:'#b45309',t1:'#1e40af',done:'#166534',brand:'#000000',accent:'#1e40af'}}]};
const APP_COLOR_LABELS=[['onsite','TESİSTE işaretli'],['t1','T1 işaretli'],['done','BİTTİ işaretli'],['brand','Ana renk (düğmeler, seçili gün)'],['accent','Vurgu rengi (menü, seçili satır)']];
let appearance=structuredClone(APP_DEFAULT);
function textOn(hex){const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return '#fff';const n=parseInt(m[1],16),ch=[n>>16&255,n>>8&255,n&255].map(c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);});const L=0.2126*ch[0]+0.7152*ch[1]+0.0722*ch[2];return L>0.179?'#1b1300':'#ffffff';}
function applyAppearance(){const r=document.documentElement,a=appearance,pick=(obj,k,d)=>(obj[k]||obj[d]),set=(n,v)=>r.style.setProperty(n,v);
 const font=pick(APP_FONTS,a.font,'varsayilan')[1];set('--ui-font',font);const pf=pick(APP_PLATE_FONTS,a.plateFont,'ayni')[1];set('--plate-font',pf||font);
 set('--ui-scale',String(pick(APP_SIZES,a.size,'normal')[1]));r.dataset.weight=APP_WEIGHTS[a.weight]?a.weight:'normal';
 const sp=pick(APP_SPACING,a.spacing,'normal')[1];set('--ui-spacing',sp);if(sp==='0')delete r.dataset.spacing;else r.dataset.spacing='1';
 set('--plate-size',pick(APP_PLATE,a.plateSize,'normal')[1]);set('--row-pad',pick(APP_DENSITY,a.density,'normal')[1]);set('--tint',pick(APP_TINT,a.tint,'normal')[1]);
 set('--bg',pick(APP_BG,a.bg,'gri')[1]);r.dataset.headAlign=APP_HALIGN[a.headAlign]?a.headAlign:'center';r.dataset.stIcons=a.statusIcons==='off'?'off':'on';r.dataset.headStyle=a.headStyle==='band'?'band':'minimal';r.dataset.chipStyle=a.chipStyle==='solid'?'solid':'soft';r.dataset.rowStyle=a.rowStyle==='full'?'full':'minimal';set('--head-mix',pick(APP_HSTR,a.headStrength,'normal')[1]);
 for(const [k] of APP_COLOR_LABELS){const c=/^#[0-9a-f]{6}$/i.test(a.colors?.[k]||'')?a.colors[k]:APP_DEFAULT.colors[k];set('--c-'+k,c);set('--c-'+k+'-fg',textOn(c));}updateSaveBar();}
var customerContacts={},contactsDirty=false;
const WA_DEFAULT={single:'Merhaba\n{PLAKA}\nPlakalı aracınız tesisimize varış yapmıştır.\nTalimat ve beyanname maillerinizi bekliyoruz.',multi:'Merhaba\n{PLAKALAR}\nPlakalı araçlarınız tesisimize varış yapmıştır.\nTalimat ve beyanname maillerinizi bekliyoruz.'};
var waTemplates={...WA_DEFAULT};
function applySettings(s){const dn=s.display_names;if(dn&&typeof dn==='object'&&!Array.isArray(dn))displayNames=Object.fromEntries(Object.entries(dn).map(([k,v])=>[String(k).toLowerCase(),String(v||'')]));const cc=s.customer_contacts;if(!contactsDirty&&cc&&typeof cc==='object'&&!Array.isArray(cc)){if(cc.numbers&&typeof cc.numbers==='object'){customerContacts=cc.numbers;waTemplates={...WA_DEFAULT,...(cc.templates&&typeof cc.templates==='object'?cc.templates:{})};}else customerContacts=cc;}if(!prioDirty&&Array.isArray(s.customer_priority)&&s.customer_priority.length)custPriorityList=s.customer_priority;if(!appearanceDirty){const a=s.appearance&&typeof s.appearance==='object'?s.appearance:{};appearance={...APP_DEFAULT,...a,colors:{...APP_DEFAULT.colors,...(a.colors||{})}};applyAppearance();}}
function appSel(key,label,obj,lab=v=>v[0],hint=''){const a=appearance;return `<div class="field"><label for="app-${key}">${label}</label><select id="app-${key}" class="app-set" data-k="${key}">${Object.entries(obj).map(([k,v])=>`<option value="${k}" ${k===a[key]?'selected':''}>${esc(lab(v))}</option>`).join('')}</select>${hint?`<small>${hint}</small>`:''}</div>`;}
function appPreview(){const pc=custPriorityList[0]||{match:'ÖRNEK MÜŞTERİ',color:'#0f766e'};
 const chip=(k,l,on)=>`<input class="check-native" type="checkbox" tabindex="-1" aria-hidden="true" ${on?'checked':''}><span class="chk-toggle ${k==='onsite'?'amber':k==='t1'?'blue':'green'}">${stIcon(k)}${l}</span>`;
 const row=(n,cls,st,decl,plate,car)=>`<tr class="${cls}" style="--bc:${esc(pc.color||'#0f766e')}"><td class="num"><span>${n}</span></td><td class="check-cell">${chip('onsite','TESİSTE',st[0])}</td><td class="check-cell">${chip('t1','T1',st[1])}</td><td class="check-cell">${chip('done','BİTTİ',st[2])}</td><td class="info declaration">${decl}</td><td class="info plate"><span class="plate-button">${plateHTML(plate,'sm')}</span></td><td class="info">${car}</td></tr>`;
 return `<div class="set-preview"><span class="set-preview-label">Önizleme</span><div class="table-scroll app-preview"><table class="operations preview-ops"><tbody><tr class="block-head-row"><td colspan="7"><div class="block-head-bar" style="--bc:${esc(pc.color||'#0f766e')}"><span class="block-head-name">${esc(pc.match||'ÖRNEK MÜŞTERİ')}</span><span class="block-head-count">3 araç</span></div></td></tr>${row('01','row-onsite',[1,0,0],'ÖRNEK GIDA','34 ABC 101','ÖRNEK NAKLİYAT')}${row('02','row-t1',[1,1,0],MISSING,'CA 4821 KM - CA 1190 EK','ÖRNEK TRANS SRL')}${row('03','row-done',[1,1,1],'ÖRNEK METAL','X 5530 BM','ÖRNEK LOJİSTİK')}</tbody></table></div></div>`;}
function setPanel(id,ic,title,desc,body){if(!body)return '';const open=(ui.openPanels||(ui.openPanels=new Set())).has(id);return `<details class="set-panel" data-panel="${id}" ${open?'open':''}><summary><span class="set-ic">${icon(ic)}</span><span class="set-t"><b>${title}</b><small>${desc}</small></span><span class="set-chev">${icon('down')}</span></summary><div class="set-body">${body}</div></details>`;}
function settingsView(){const a=appearance;const lbl=(o,k,d)=>{const v=o[k]||o[d];return Array.isArray(v)?v[0]:v;};
 const names=VIEW_TOKEN?[]:customerNames(),filled=names.filter(n=>customerContacts[n]).length;
 const dots=APP_COLOR_LABELS.map(([k])=>`<i class="set-dot" style="background:var(--c-${k})"></i>`).join('');
 const theme=`<div class="app-presets">${Object.entries(APP_PRESETS).map(([k,[l]])=>`<button type="button" class="btn app-preset-btn" data-action="app-preset" data-p="${k}">${l}</button>`).join('')}</div><small class="app-hint">Bir temaya tıklayınca bütün görünüm ayarları ona göre dolar; sonra istediğiniz ayarı diğer bölümlerden tek tek değiştirebilirsiniz.</small><div class="actions" style="margin-top:14px">${button('app-reset','Varsayılana dön','refresh')}</div>`;
 const font=`<div class="app-grid">${appSel('font','Yazı tipi',APP_FONTS)}${appSel('weight','Yazı kalınlığı',APP_WEIGHTS,v=>v)}${appSel('size','Yazı boyutu',APP_SIZES,v=>v[0],'Tüm sayfayı büyütür veya küçültür.')}${appSel('spacing','Harf aralığı',APP_SPACING)}${appSel('plateFont','Plaka yazı tipi',APP_PLATE_FONTS)}${appSel('plateSize','Plaka yazı boyutu',APP_PLATE)}</div><small class="app-hint">Yazılar her zaman BÜYÜK HARF gösterilir.</small>`;
 const board=`<h3 class="set-sub">Pano</h3><div class="app-grid">${appSel('boardView','Açılış görünümü',APP_BOARDVIEW,v=>v,'Panodaki Tablo / Kartlar düğmesiyle her cihaz kendi tercihini de seçebilir.')}${appSel('rowStyle','Satır renklendirme',APP_ROWSTYLE,v=>v)}${appSel('density','Satır yüksekliği',APP_DENSITY)}${appSel('tint','Renkli satırlarda ton',APP_TINT,v=>v[0],'Sadece "Renkli" satır renklendirmede kullanılır.')}${appSel('bg','Sayfa arka planı',APP_BG)}</div>
 <h3 class="set-sub">Müşteri başlıkları</h3><div class="app-grid">${appSel('headStyle','Başlık stili',APP_HEADSTYLE,v=>v)}${appSel('headAlign','Başlık hizası',APP_HALIGN,v=>v)}${appSel('headStrength','Renkli şeritte ton',APP_HSTR,v=>v[0],'Sadece "Renkli şerit" başlık stilinde kullanılır.')}</div>
 <h3 class="set-sub">Durum düğmeleri ve plaka</h3><div class="app-grid">${appSel('chipStyle','İşaretli düğme stili',APP_CHIPSTYLE,v=>v)}${appSel('statusIcons','Düğmelerde simge',APP_ONOFF,v=>v)}${appSel('plateBand','Plakada ülke şeridi',APP_ONOFF,v=>v,'Ülke plakanın yazılışından tanınır (TR, BG, RO, GR, AL, UA, MD).')}${appSel('liveNotify','Canlı değişiklik bildirimi',APP_ONOFF,v=>v,'Başka biri bir aracı değiştirdiğinde sağ altta kısa bildirim çıkar ve satır parlar.')}</div>${appPreview()}`;
 const colors=`<div class="app-colors">${APP_COLOR_LABELS.map(([k,l])=>`<div class="app-color-item"><input type="color" class="app-set" data-k="color-${k}" value="${esc(a.colors[k])}" aria-label="${l}"><div class="app-color-text"><span>${l}</span><input type="text" class="app-set app-hex" data-k="color-${k}" value="${esc(a.colors[k])}" maxlength="7" spellcheck="false" aria-label="${l} kodu"></div><span class="chip-prev ${k}">${['onsite','t1','done'].includes(k)?stIcon(k)+(k==='onsite'?'TESİSTE':k==='t1'?'T1':'BİTTİ'):'Örnek'}</span></div>`).join('')}</div><small class="app-hint">Renk kodunu (örneğin #0f766e) yazı kutusuna yapıştırabilirsiniz. Müşteri renkleri "Müşteri renkleri ve sıralama" bölümündedir.</small>${appPreview()}`;
 return `<div class="set-list">
 ${setPanel('theme','settings','Hazır temalar','Kurumsal, Canlı, Sade veya Yüksek kontrast · tek tıkla',theme)}
 ${setPanel('font','doc','Yazı',`${esc((s=>(s.includes('·')?s.split('·')[1]:s).split('(')[0].trim())(lbl(APP_FONTS,a.font,'varsayilan')))} · ${esc(lbl(APP_WEIGHTS,a.weight,'normal'))} · ${esc(lbl(APP_SIZES,a.size,'normal'))} boyut`,font)}
 ${setPanel('board','grid','Pano ve tablo',`${esc(lbl(APP_BOARDVIEW,a.boardView,'table'))} görünüm · ${a.rowStyle==='full'?'renkli satırlar':'sade satırlar'} · ${a.headStyle==='band'?'renkli başlıklar':'sade başlıklar'}`,board)}
 ${setPanel('colors','chart','Renkler',`<span class="set-dots">${dots}</span> Durum, ana ve vurgu renkleri`,colors)}
 ${setPanel('customers','registry','Müşteri renkleri ve sıralama',`${custPriorityList.length} öncelikli müşteri · panodaki blok sırası ve renkleri`,priorityEditor())}
 ${setPanel('whatsapp','wa','WhatsApp',`${filled}/${names.length} müşterinin numarası kayıtlı · mesaj şablonu`,contactsEditor())}
 ${setPanel('link','search','Görüntüleme linki','Giriş gerektirmeyen, sadece izleme linki',linkEditor())}
 </div>
 <div class="save-bar${appearanceDirty?' show':''}" id="save-bar" role="status"><span>${icon('info')}Görünüm ayarlarında kaydedilmemiş değişiklik var.</span>${button('app-cancel','Vazgeç')}${button('app-save','Kaydet','check','primary')}</div>`;}
function updateSaveBar(){const b=document.getElementById('save-bar');if(b)b.classList.toggle('show',!!appearanceDirty);}
document.addEventListener('toggle',e=>{const d=e.target;if(!d?.classList?.contains('set-panel'))return;const s=ui.openPanels||(ui.openPanels=new Set());if(d.open)s.add(d.dataset.panel);else s.delete(d.dataset.panel);},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="app-cancel"]');if(!b)return;appearanceDirty=false;generation++;syncData();toast('Kaydedilmemiş görünüm değişiklikleri geri alındı.');});
function linkEditor(){if(role!=='editor'||VIEW_TOKEN)return '';return `<section class="card" style="margin-top:16px"><div class="card-header"><div><h2>Sadece görüntüleme linki</h2><p>Bu linki açan kişi giriş yapmadan panoyu, bekleyenleri ve raporları görür; hiçbir şeyi değiştiremez. Link kalıcıdır ve 15 saniyede bir kendiliğinden güncellenir.</p></div></div><div class="link-row"><input id="public-link" type="text" readonly value="${esc(publicLink)}" placeholder="Linki görmek için “Linki göster”e basın" aria-label="Görüntüleme linki">${publicLink?button('link-copy','Kopyala','doc'):button('link-show','Linki göster','search','primary')}</div><p class="help-note" style="margin-top:10px">Linki alan herkes kayıtları görebilir; yalnızca güvendiğiniz kişilerle paylaşın. Link yanlış ellere geçerse “Yeni link oluştur” deyin, eski link o an çalışmaz olur.</p><div class="actions" style="margin-top:12px">${button('link-rotate','Yeni link oluştur','refresh','danger')}</div></section>`;}
function customerNames(){const set=new Set();for(const v of state.visits)if(v.customer)set.add(v.customer);for(const r of state.registry)if(r.customer)set.add(r.customer);for(const n of Object.keys(customerContacts))set.add(n);return [...set].sort((a,b)=>custPriority(a)-custPriority(b)||a.localeCompare(b,'tr'));}
function contactsEditor(){if(VIEW_TOKEN)return '';const names=customerNames(),q=(ui.waSearch||'').toLocaleUpperCase('tr-TR'),list=names.filter(n=>!q||n.toLocaleUpperCase('tr-TR').includes(q));const filled=names.filter(n=>customerContacts[n]).length;
 return `<section class="card" style="margin-top:16px"><div class="card-header"><div><h2>WhatsApp numaraları</h2><p>Araç bilgisini WhatsApp ile gönderirken hangi numaranın açılacağını belirler. ${filled}/${names.length} müşterinin numarası kayıtlı. Numaralar görüntüleme linkinde gösterilmez.</p></div></div><div class="search wa-search">${icon('search')}<input id="wa-search" type="search" placeholder="Müşteri ara" value="${esc(ui.waSearch||'')}" aria-label="Müşteri ara"></div><div class="wa-list">${list.map(n=>`<label class="wa-row"><span class="wa-dot" style="--bc:${custColor(n)}"></span><span class="wa-name">${esc(n)}</span><input type="tel" class="wa-phone" data-name="${esc(n)}" value="${esc(customerContacts[n]||'')}" placeholder="Örn. 0532 123 45 67 veya +359 88 123 4567" inputmode="tel" aria-label="${esc(n)} WhatsApp numarası"></label>`).join('')||'<p class="help-note">Eşleşen müşteri yok.</p>'}</div><p class="help-note" style="margin-top:10px">Türkiye numaraları 0 ile yazılabilir (0532…); yabancı numaraları ülke koduyla yazın (+359…, +40…). Numarası olmayan müşteride WhatsApp kişi seçme ekranıyla açılır.</p>
 <div class="wa-tpl-wrap"><h3>Gönderilecek mesaj</h3><p class="help-note">Süslü parantez içindeki alanlar gönderirken aracın bilgisiyle değişir. Alana tıklayınca yazının içine eklenir.</p><div class="wa-tags">${WA_TAGS.map(([t,d])=>`<button type="button" class="wa-tag" data-tag="${t}" title="${esc(d)}">${t}</button>`).join('')}</div>
 <div class="wa-tpl-grid">${[['single','Tek araç (satırdaki ve paneldeki WhatsApp düğmesi)'],['multi','Toplu (müşteri başlığındaki WhatsApp düğmesi)']].map(([k,l])=>`<div class="wa-tpl-col"><label for="wa-tpl-${k}">${l}</label><textarea id="wa-tpl-${k}" class="wa-tpl" data-k="${k}" rows="7" spellcheck="false">${esc(waTemplates[k])}</textarea><span class="wa-prev-label">Önizleme</span><pre class="wa-preview" id="wa-prev-${k}">${esc(waMessage(waSample(k==='multi')))}</pre></div>`).join('')}</div>
 <div class="actions" style="margin-top:12px">${button('wa-tpl-reset','Varsayılan mesaja dön','refresh')}</div></div>
 <div class="actions" style="margin-top:14px">${button('wa-contacts-save','WhatsApp ayarlarını kaydet','check','primary')}</div></section>`;}
const WA_TAGS=[['{PLAKA}','Aracın plakası (çekici - dorse)'],['{PLAKALAR}','Toplu mesajda tüm plakalar, alt alta'],['{MÜŞTERİ}','Müşteri adı'],['{BEYANNAME}','Beyanname'],['{NAKLİYECİ}','Nakliyeci'],['{RUHSAT}','Ruhsat / kilo'],['{TARİH}','Geliş tarihi'],['{SAAT}','Geliş saati'],['{DURUM}','Tesiste / T1 / Bitti durumu'],['{ADET}','Toplu mesajda araç sayısı']];
function waSample(multi){const d=state.visits.filter(v=>v.customer);if(multi){const c=d[0]?.customer;const same=d.filter(v=>v.customer===c&&v.date===d[0].date);if(same.length>1)return same.slice(0,3);return [{plate:'CT 80 BWT - CT 70 BWT',customer:'ÖRNEK MÜŞTERİ',date:TODAY,time:'09:30',onsite:true,t1:false,done:false,declaration:'ÖRNEK',carrier:'ÖRNEK NAKLİYAT',registration:'15551'},{plate:'CT 40 BWT - CT 41 BWT',customer:'ÖRNEK MÜŞTERİ',date:TODAY,time:'10:10',onsite:true,t1:true,done:false,declaration:'ÖRNEK',carrier:'ÖRNEK NAKLİYAT',registration:'16329'}];}return [d[0]||{plate:'CT 80 BWT - CT 70 BWT',customer:'ÖRNEK MÜŞTERİ',date:TODAY,time:'09:30',onsite:true,t1:false,done:false,declaration:'ÖRNEK',carrier:'ÖRNEK NAKLİYAT',registration:'15551'}];}
function waNumber(name){const raw=customerContacts[name]||Object.entries(customerContacts).find(([k])=>k.toLocaleUpperCase('tr-TR')===String(name||'').toLocaleUpperCase('tr-TR'))?.[1]||'';let d=String(raw).replace(/[^\d+]/g,'');if(!d)return '';if(d.startsWith('+'))return d.slice(1).replace(/\D/g,'');d=d.replace(/\D/g,'');if(d.startsWith('00'))return d.slice(2);if(d.startsWith('0'))return '90'+d.slice(1);if(d.length===10&&d.startsWith('5'))return '90'+d;return d;}
function waKey(k){return String(k).toLocaleUpperCase('tr-TR').replace(/İ/g,'I').replace(/Ü/g,'U').replace(/Ş/g,'S').replace(/Ç/g,'C').replace(/Ğ/g,'G').replace(/Ö/g,'O').replace(/I/g,'I');}
function waMessage(list){if(!list.length)return '';const v=list[0],multi=list.length>1;const mark=b=>b?'✅':'⬜';const durum=x=>`${mark(x.onsite)} Tesiste  ${mark(x.t1)} T1 yazıldı  ${mark(x.done)} İşlemler bitti`;
 const plates=list.map(x=>x.plate).join('\n');const join=f=>[...new Set(list.map(f).filter(Boolean))].join(', ');
 const vals={PLAKA:multi?plates:v.plate,PLAKALAR:plates,MUSTERI:v.customer||'',BEYANNAME:multi?join(x=>x.declaration):(v.declaration||''),NAKLIYECI:multi?join(x=>x.carrier):(v.carrier||''),RUHSAT:multi?join(x=>kgText(x.registration)):kgText(v.registration),TARIH:fmt(v.date),SAAT:multi?join(x=>x.time):(v.time||''),DURUM:multi?list.map(x=>`${x.plate}: ${durum(x)}`).join('\n'):durum(v),ADET:String(list.length)};
 const tpl=(multi?waTemplates.multi:waTemplates.single)||(multi?WA_DEFAULT.multi:WA_DEFAULT.single);
 return tpl.replace(/\{([^{}\n]{2,20})\}/g,(m,k)=>{const key=waKey(k.trim());return key in vals?vals[key]:m;}).replace(/\n{3,}/g,'\n\n').trim();}
function waRefreshPreview(){for(const k of ['single','multi']){const el=document.getElementById('wa-prev-'+k);if(el)el.textContent=waMessage(waSample(k==='multi'));}}
function waLaunch(num,text){const q=(num?'phone='+num+'&':'')+'text='+encodeURIComponent(text);location.href='whatsapp://send?'+q;}
function openWhatsApp(list){if(!list.length)return;const num=waNumber(list[0].customer);waLaunch(num,waMessage(list));if(!num)toast(`${list[0].customer||'Bu müşteri'} için numara kayıtlı değil; WhatsApp'ta kişiyi seçin. Numarayı Ayarlar > WhatsApp numaraları bölümüne ekleyebilirsiniz.`);}
var displayNames={};
function displayName(email){const e=String(email||'').toLowerCase();return displayNames[e]||e.split('@')[0];}
function priorityEditor(){return `<section class="card" style="margin-top:16px"><div class="card-header"><div><h2>Öncelikli müşteri sıralaması</h2><p>Panoda blok sırasını ve rengini belirler. Listede olmayan müşteriler sona, teal renkte eklenir.</p></div></div><div id="prio-list">${custPriorityList.map((e,i)=>`<div class="prio-row"><input type="color" class="prio-color" data-i="${i}" value="${esc(e.color||'#2dd4bf')}" aria-label="${i+1}. sıra rengi"><input type="text" class="prio-match" data-i="${i}" value="${esc(e.match||'')}" placeholder="Müşteri adında geçen kelime, örn. BULTRANS" aria-label="${i+1}. sıra eşleşme metni"><button type="button" class="icon-btn" data-action="prio-up" data-i="${i}" aria-label="Yukarı taşı" ${i===0?'disabled':''}>${icon('up')}</button><button type="button" class="icon-btn" data-action="prio-down" data-i="${i}" aria-label="Aşağı taşı" ${i===custPriorityList.length-1?'disabled':''}>${icon('down')}</button><button type="button" class="icon-btn danger" data-action="prio-del" data-i="${i}" aria-label="Kaldır">${icon('trash')}</button></div>`).join('')||'<p class="help-note">Henüz öncelikli müşteri eklenmedi.</p>'}</div><div class="actions" style="margin-top:14px">${button('prio-add','Müşteri ekle','plus')}${button('prio-save','Kaydet','check','primary')}</div><p class="help-note" style="margin-top:10px">Eşleşme kelimesi, müşteri adının içinde geçen herhangi bir parçadır (büyük/küçük harf önemli değil). Aynı adı iki farklı şoför/şube için ayırmak istersen daha uzun bir parça yazın, örn. "ETL LOJ - ERVİN".</p></section>`;}
var panelId=null;
var DASH='<span class="dash">—</span>',MISSING='<span class="missing-tag" title="Beyanname girilmemiş">Eksik</span>';
var justChangedMap=new Map();
function justChanged(id){return Date.now()-(justChangedMap.get(id)||0)<2500;}
document.addEventListener('change',e=>{const t=e.target;if(t?.dataset?.check&&t.dataset.id){justChangedMap.set(t.dataset.id,Date.now());}},true);
/* ruhsat: sadece sayı yazılırsa sonuna KG ekle */
function kgText(s){s=String(s??'').trim();if(!s)return '';const m=s.match(/^(\d[\d.,\s]*?)\s*(kg|kgs|kilo|kilogram)?\.?$/i);return m?m[1].replace(/\s+/g,'')+' KG':s;}

function regNum(s){const k=kgText(s);return /^\d[\d.,]* KG$/.test(k)?k.slice(0,-3):String(s??'');}
function kgField(val,full){return `<div class="field${full?' full':''}"><label for="f-registration">Ruhsat (kilo) <span class="optional">(isteğe bağlı)</span></label><div class="input-suffix"><input id="f-registration" name="registration" type="text" inputmode="decimal" value="${esc(regNum(val))}" maxlength="150" placeholder="Örn. 15400" autocomplete="off"><span aria-hidden="true">KG</span></div><small>Sadece sayıyı yazın; kaydederken sonuna KG eklenir.</small></div>`;}
document.addEventListener('input',e=>{if(e.target.id==='f-plate'){const p=document.getElementById('plate-preview');if(p)p.innerHTML=e.target.value.trim()?plateHTML(e.target.value.trim().toLocaleUpperCase('tr-TR')):'';}});
/* plaka ülkesi, simgeler, kart görünümü */
var PLATE_COUNTRY={TR:['Türkiye',0],BG:['Bulgaristan',1],RO:['Romanya',1],GR:['Yunanistan',1],AL:['Arnavutluk',0],UA:['Ukrayna',0],MD:['Moldova',0]};
var BG_RE=/^(A|B|BH|BP|BT|E|EB|EH|K|KH|M|H|OB|P|PA|PB|PK|PP|C|CA|CB|CC|CH|CM|CO|CT|T|TX|X|Y)\d{4}[A-Z]{1,2}$/;
var RO_RE=/^(B\d{2,3}|(AB|AR|AG|BC|BH|BN|BT|BV|BR|BZ|CS|CL|CJ|CT|CV|DB|DJ|GL|GR|GJ|HR|HD|IL|IS|IF|MM|MH|MS|NT|OT|PH|SM|SJ|SB|SV|TR|TM|TL|VS|VL|VN)\d{2,3})[A-Z]{3}$/;
function plateCountry(p){const c=String(p||'').toLocaleUpperCase('tr-TR').replace(/İ/g,'I').replace(/[\s.\-]/g,'');
 if(/^\d{2}[A-Z]{1,3}\d{2,5}$/.test(c))return 'TR';if(BG_RE.test(c))return 'BG';if(RO_RE.test(c))return 'RO';if(/^[A-Z]{3}\d{4}$/.test(c))return 'GR';if(/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(c))return 'AL';if(/^[A-Z]{2}\d{4}[A-Z]{2}$/.test(c))return 'UA';if(/^[A-Z]{3}\d{3}$/.test(c))return 'MD';return '';}
function splitPlate(p){const s=String(p||'').trim();let parts=s.split(/\s*[–—\/]\s*|\s+-\s*|\s*-\s+/).filter(Boolean);if(parts.length===1)parts=s.split(/(?<=[A-ZÇĞİÖŞÜ])-(?=[A-ZÇĞİÖŞÜ])/i).filter(Boolean);return parts.slice(0,2).map(x=>x.trim().replace(/\s+/g,' '));}
var EU_STARS=(()=>{let d='';for(let i=0;i<12;i++){const a=i*Math.PI/6;d+=`<circle cx="${(12+8*Math.cos(a)).toFixed(2)}" cy="${(12+8*Math.sin(a)).toFixed(2)}" r="1.3" fill="#ffd33d"/>`;}return `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;})();
function plateHTML(p,size=''){if(appearance?.plateBand==='off')return `<span class="lp-plain">${esc(p)}</span>`;const [tr,dr]=splitPlate(p);if(!tr)return '—';const c1=plateCountry(tr),c2=dr?plateCountry(dr):'',i1=PLATE_COUNTRY[c1];
 const tip=`Çekici: ${i1?i1[0]:'ülke tanınamadı'}${dr?` · Dorse: ${PLATE_COUNTRY[c2]?.[0]||'ülke tanınamadı'}`:''}`;
 return `<span class="lp${size?' lp-'+size:''}${c1?'':' lp-unknown'}" title="${tip}"><span class="lp-band">${i1&&i1[1]?EU_STARS:''}<b>${c1||'?'}</b></span><span class="lp-num">${esc(tr)}${dr?`<i class="lp-sep"></i>${c2&&c2!==c1?`<em class="lp-cc2">${c2}</em>`:''}${esc(dr)}`:''}</span></span>`;}
function stIcon(k,force){return force||appearance?.statusIcons!=='off'?icon('st_'+k):'';}
function boardView(){let v='';try{v=localStorage.getItem(STORE+'.view')||'';}catch(e){}return v==='cards'||v==='table'?v:(window.innerWidth<760?'cards':(appearance?.boardView==='cards'?'cards':'table'));}
var ST_LABEL={onsite:'Tesiste',t1:'T1 yazıldı',done:'Bitti'};
function vehicleCard(v){const nx=['onsite','t1','done'].find(k=>!v[k]);
 return `<article class="vcard${v.done?' done':''}${v.id===panelId?' is-selected':''}${justChanged(v.id)?' just-changed':''}" style="--bc:${custColor(v.customer)}" data-card-id="${esc(v.id)}">
 <div class="vc-head"><input type="checkbox" class="row-select" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} kartını seç" ${selectedIds.has(v.id)?'checked':''}><button type="button" class="plate-button vc-plate" data-action="select-visit" data-id="${esc(v.id)}" title="Araç bilgilerini göster">${plateHTML(v.plate)}</button></div>
 <div class="vc-info"><div><span>Beyanname</span><b title="${esc(v.declaration)}">${v.declaration?esc(v.declaration):MISSING}</b></div><div><span>Nakliyeci</span><b title="${esc(v.carrier)}">${esc(v.carrier)||DASH}</b></div><div><span>Ruhsat</span><b>${esc(kgText(v.registration))||DASH}</b></div><div><span>Geliş</span><b>${fmt(v.date)}${v.time?' · '+esc(v.time):''}</b></div></div>
 <div class="vc-steps">${[['onsite','amber'],['t1','blue'],['done','green']].map(([k,color])=>{const cid=`card-${esc(v.id)}-${k}`;return `<input class="check-native" id="${cid}" type="checkbox" data-check="${k}" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} ${ST_LABEL[k]}" ${v[k]?'checked':''}><label class="vc-step ${k}" for="${cid}">${stIcon(k,true)}<span>${ST_LABEL[k]}</span></label>`;}).join('')}</div>
 <div class="vc-foot">${nx?`<label class="vc-next" for="card-${esc(v.id)}-${nx}">${icon('chevron')}${ST_LABEL[nx]} yap</label>`:`<span class="vc-next finished">${stIcon('done',true)}İşlemler tamamlandı</span>`}<button type="button" class="icon-btn wa-btn" data-action="wa-send" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} bilgilerini WhatsApp ile gönder" title="WhatsApp ile müşteriye gönder">${icon('wa')}</button><button type="button" class="icon-btn danger" data-action="delete-visit" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} gelişini sil">${icon('trash')}</button></div>
 </article>`;}
function cardsView(rows){const groups=[];for(const v of sortRows(rows)){const k=v.customer||'';let g=groups[groups.length-1];if(!g||g.k!==k){g={k,rows:[]};groups.push(g);}g.rows.push(v);}
 return `<div class="card-board">${groups.map(g=>{const bc=custColor(g.k);return `<section class="card-group" style="--bc:${bc}"><div class="block-head-bar card-head" style="--bc:${bc}"><button type="button" class="block-head-name" data-action="customer-profile" data-name="${esc(g.k)}">${esc(g.k||'MÜŞTERİSİZ')}</button><span class="block-head-count">${g.rows.length} araç</span>${g.k?`<button type="button" class="wa-head" data-action="wa-customer" data-name="${esc(g.k)}" data-date="${esc(g.rows[0].date)}" title="Bu müşterinin bu günkü tüm araçlarını WhatsApp ile gönder">${icon('wa')}WhatsApp</button>`:''}</div><div class="vcards">${g.rows.map(vehicleCard).join('')}</div></section>`;}).join('')}</div>`;}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="view-mode"]');if(!b)return;try{localStorage.setItem(STORE+'.view',b.dataset.v);}catch(_){}render();});
function ago(ts){const m=Math.max(0,Math.round((Date.now()-new Date(ts).getTime())/60000));if(!ts||isNaN(m))return '';return m<1?'az önce':m<60?m+' dk önce':m<1440?Math.round(m/60)+' sa önce':Math.round(m/1440)+' gün önce';}
function sidePanel(){const v=panelId?state.visits.find(x=>x.id===panelId):null;
 const stamp=x=>String(x.updated_at||x.createdAt||'');const recent=state.visits.slice().sort((a,b)=>stamp(b).localeCompare(stamp(a))).slice(0,4);
 const sText=x=>x.done?'İşlemler tamamlandı':x.t1?'T1 yazıldı':x.onsite?'Tesiste':'Araç gelişi eklendi';const sColor=x=>x.done?'var(--c-done)':x.t1?'var(--c-t1)':x.onsite?'var(--c-onsite)':'#8a96a8';
 const card=v?`<section class="side-card" aria-label="Seçili araç"><div class="side-top"><span class="side-eyebrow">Seçili araç</span><button type="button" class="side-cust" data-action="customer-profile" data-name="${esc(v.customer)}" style="--bc:${custColor(v.customer)}">${esc(v.customer)||'Müşterisiz'}</button></div><div class="side-plate">${plateHTML(v.plate,'lg')}</div><div class="side-info"><div><span>Beyanname</span><b>${v.declaration?esc(v.declaration):MISSING}</b></div><div><span>Nakliyeci</span><b>${esc(v.carrier)||DASH}</b></div><div><span>Ruhsat</span><b>${esc(kgText(v.registration))||DASH}</b></div><div><span>Geliş</span><b>${fmt(v.date)}${v.time?' · '+esc(v.time):''}</b></div></div><div class="side-flow"><h3>İşlem akışı</h3>${[['onsite','Tesiste','Sahada'],['t1','T1 yazıldı','Evrak'],['done','İşlemler bitti','Kapanış']].map(([k,l,h],i)=>{const cid=`side-${esc(v.id)}-${k}`;return `<input class="check-native" id="${cid}" type="checkbox" data-check="${k}" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} ${l}" ${v[k]?'checked':''}><label class="flow-step" for="${cid}"><i>${stIcon(k,true)}</i><span>${l}</span><small>${h}</small></label>`;}).join('')}</div><div class="side-actions"><button type="button" class="btn" data-action="edit-visit" data-id="${esc(v.id)}">Kaydı düzenle</button><button type="button" class="btn" data-action="customer-profile" data-name="${esc(v.customer)}">Müşteri geçmişi</button><button type="button" class="btn copy-btn" data-action="copy-visit" data-id="${esc(v.id)}" title="Bilgileri panoya kopyala (C)">${icon('copy')}Bilgileri kopyala</button><button type="button" class="btn wa-full" data-action="wa-send" data-id="${esc(v.id)}">${icon('wa')}WhatsApp ile gönder</button></div></section>`:`<section class="side-card"><span class="side-eyebrow">Seçili araç</span><p class="side-empty">Listeden bir plakaya tıklayın; aracın bilgileri burada açılır.</p></section>`;
 return `<aside class="side-panel">${card}${recent.length?`<section class="side-card" aria-label="Son hareketler"><h3>Son hareketler</h3>${recent.map(x=>`<button type="button" class="activity" data-action="select-visit" data-id="${esc(x.id)}"><i style="background:${sColor(x)}"></i><span><b>${sText(x)}</b><small>${esc(x.plate)}${ago(stamp(x))?' · '+ago(stamp(x)):''}</small></span></button>`).join('')}</section>`:''}</aside>`;}
function footer(){return `<footer class="footnote"><span>Supabase ortak veri tabanı · ${role==='editor'?'Düzenleyici':'Salt görüntüleme'}</span><span>Pazartesi — Cumartesi</span></footer>`;}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
 if(disabledActions.has(action)||(writeActions.has(action)&&!canEdit())||(!account&&action!=='reset-password')){e.preventDefault();e.stopImmediatePropagation();return;}
 if(action==='refresh'){e.stopImmediatePropagation();await syncData();}
 if(action==='signout'){e.stopImmediatePropagation();const {error}=await client.auth.signOut();if(error)toast(friendly(error),true);}
 if(action==='reset-password'){
  e.stopImmediatePropagation();const form=document.getElementById('auth-form');const msg=document.getElementById('auth-message');if(!form.elements.email.reportValidity())return;b.disabled=true;
  try{const email=form.elements.email.value.trim(),redirect=location.origin+location.pathname;const result=await client.auth.resetPasswordForEmail(email,{redirectTo:redirect});if(result.error)throw result.error;msg.textContent='E-postanıza gelen bağlantıyı açın. Posta gelmezse yöneticiye bildirin.';}catch(err){msg.textContent=friendly(err);}finally{b.disabled=false;}
 }
},true);
document.addEventListener('submit',async e=>{
 if(e.target.id==='auth-form'){e.preventDefault();e.stopImmediatePropagation();const form=e.target,b=form.querySelector('[type=submit]');b.disabled=true;try{const {error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});if(error)throw error;}catch(err){document.getElementById('auth-message').textContent=friendly(err);}finally{b.disabled=false;}}
 else if(e.target.id==='recovery-form'){e.preventDefault();e.stopImmediatePropagation();const {error}=await client.auth.updateUser({password:e.target.elements.password.value});if(error)toast(friendly(error),true);else{closeModal();toast('Parola güncellendi.');}}
 else if(!canEdit()){e.preventDefault();e.stopImmediatePropagation();}
},true);
client.auth.onAuthStateChange((event,session)=>{
 if(VIEW_TOKEN)return;
 setTimeout(async()=>{const userChanged=(session?.user?.id||null)!==(account?.id||null);if(userChanged){generation++;role='viewer';}account=session?.user||null;if(!account){stopRealtime();state=realState=emptyState();clearCache();selectedIds.clear();closeModal();authScreen();return;}if(userChanged)stopRealtime();startRealtime();await syncData();if(event==='PASSWORD_RECOVERY')openModal(`${modalHeader('Yeni parola')}<form id="recovery-form"><div class="modal-body"><label>Yeni parola <input name="password" type="password" minlength="8" required autocomplete="new-password"></label></div><div class="modal-footer"><button class="btn primary">Parolayı kaydet</button></div></form>`);},0);
});
function registryChange(reg,v){
 const keys=['customer','declaration','carrier','registration'];
 if(!reg)return {insert:{id:uid(),plate:plateText(v.plate),customer:v.customer||'',declaration:v.declaration||'',carrier:v.carrier||'',registration:v.registration||''}};
 const fill={};for(const k of keys)if(!reg[k]&&v[k])fill[k]=v[k];
 return Object.keys(fill).length?{update:reg,fill}:null;
}
async function writeRegistry(ch){
 busy=true;onlineUI();
 try{const q=ch.insert?client.from('registry').insert(ch.insert):client.from('registry').update(ch.fill).eq('id',ch.update.id).eq('updated_at',ch.update.updated_at);
  const {data,error}=await q.select('id');if(error)throw error;
  if(data.length!==1)throw new Error('Plaka kayd\u0131 ba\u015fka bir kullan\u0131c\u0131 taraf\u0131ndan de\u011fi\u015ftirildi. Formu kapat\u0131p yeniden deneyin.');
  return true;
 }catch(e){toast(friendly(e),true);return false;}
 finally{busy=false;onlineUI();}
}let carriedFor='';
async function maybeCarry(){
 const wd=weekday(TODAY);if(wd<1||wd>6||carriedFor===TODAY||busy||!canEdit())return;carriedFor=TODAY;
 const from=addDays(TODAY,-7);
 const ids=state.visits.filter(v=>!v.done&&v.date>=from&&v.date<TODAY).map(v=>v.id);
 if(!ids.length)return;
 busy=true;onlineUI();
 try{const patch={visit_date:TODAY};if(orderReady())patch.sort_order=null;
  const {data,error}=await client.from('visits').update(patch).in('id',ids).eq('done',false).select('id');
  if(error)throw error;busy=false;await syncData();
  toast(`${data.length} tamamlanmam\u0131\u015f ara\u00e7 bug\u00fcne aktar\u0131ld\u0131.`);
 }catch(e){toast('Tamamlanmam\u0131\u015f ara\u00e7lar aktar\u0131lamad\u0131: '+friendly(e),true);}
 finally{busy=false;onlineUI();}
}let dragId=null;
async function saveOrder(ids){
 busy=true;onlineUI();
 try{const {error}=await client.rpc('set_visit_order',{p_ids:ids});if(error)throw error;busy=false;await syncData();}
 catch(err){toast(err.code==='PGRST202'?'S\u0131ralama i\u00e7in veritaban\u0131 kurulumu gerekli (siralama-kurulumu.sql).':friendly(err),true);}
 finally{busy=false;onlineUI();}
}
const dropClear=()=>document.querySelectorAll('.drop-before,.drop-after,.dragging').forEach(x=>x.classList.remove('drop-before','drop-after','dragging'));
const rowOf=e=>e.target.closest?e.target.closest('tr[data-row-id]'):null;
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action="move-up"],[data-action="move-down"]');if(!b||!canEdit())return;
 const v=state.visits.find(x=>x.id===b.dataset.id);if(!v)return;
 const day=sortRows(state.visits.filter(x=>x.date===v.date));const i=day.findIndex(x=>x.id===v.id),j=i+(b.dataset.action==='move-up'?-1:1);
 if(j<0||j>=day.length){toast(j<0?'Bu ara\u00e7 g\u00fcn\u00fcn ilk s\u0131ras\u0131nda.':'Bu ara\u00e7 g\u00fcn\u00fcn son s\u0131ras\u0131nda.');return;}
 [day[i],day[j]]=[day[j],day[i]];await saveOrder(day.map(x=>x.id));
});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action="clear-order"]');if(!b||!canEdit())return;
 if(!window.confirm('Bu gün için elle ayarlanmış sıra kaldırılsın mı? Durumlara göre otomatik sıralamaya dönülecek.'))return;
 busy=true;onlineUI();
 try{const {error}=await client.from('visits').update({sort_order:null}).eq('visit_date',b.dataset.date).select('id');if(error)throw error;busy=false;await syncData();toast('Bu günün sıralaması otomatiğe döndürüldü.');}
 catch(err){toast(friendly(err),true);}
 finally{busy=false;onlineUI();}
});
document.addEventListener('dragstart',e=>{const tr=rowOf(e);if(!tr)return;if(!canEdit()||!orderReady()){e.preventDefault();return;}dragId=tr.dataset.rowId;tr.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId);});
document.addEventListener('dragover',e=>{if(!dragId)return;const tr=rowOf(e);if(!tr)return;const a=state.visits.find(x=>x.id===dragId),b=state.visits.find(x=>x.id===tr.dataset.rowId);if(!a||!b||a.id===b.id||a.date!==b.date)return;e.preventDefault();e.dataTransfer.dropEffect='move';const q=tr.getBoundingClientRect(),before=e.clientY<q.top+q.height/2;document.querySelectorAll('.drop-before,.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));tr.classList.add(before?'drop-before':'drop-after');});
document.addEventListener('drop',async e=>{
 if(!dragId)return;const id=dragId;dragId=null;const tr=rowOf(e);if(!tr){dropClear();return;}
 e.preventDefault();const q=tr.getBoundingClientRect(),before=tr.classList.contains('drop-before')||(!tr.classList.contains('drop-after')&&e.clientY<q.top+q.height/2);dropClear();
 const a=state.visits.find(x=>x.id===id),b=state.visits.find(x=>x.id===tr.dataset.rowId);if(!a||!b||a.id===b.id||a.date!==b.date||!canEdit())return;
 const day=sortRows(state.visits.filter(x=>x.date===a.date)).filter(x=>x.id!==id);const k=day.findIndex(x=>x.id===b.id);day.splice(before?k:k+1,0,a);
 await saveOrder(day.map(x=>x.id));
});
document.addEventListener('dragend',()=>{dragId=null;dropClear();});setInterval(()=>{if(!document.hidden&&!dragId)syncData({remote:true,poll:true});},15000);
window.addEventListener('online',()=>syncData({remote:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncData({remote:true});});

function setAppColor(t){const k=t.dataset.k;let v=String(t.value||'').trim();if(t.classList.contains('app-hex')){if(!/^#?[0-9a-f]{6}$/i.test(v))return;v=(v[0]==='#'?v:'#'+v).toLowerCase();const p=document.querySelector(`input[type=color][data-k="${k}"]`);if(p)p.value=v;}else{const h=document.querySelector(`.app-hex[data-k="${k}"]`);if(h)h.value=v;}appearance.colors[k.slice(6)]=v;appearanceDirty=true;applyAppearance();}
document.addEventListener('input',e=>{const t=e.target;if(t.classList?.contains('app-set')&&t.dataset.k?.startsWith('color-'))setAppColor(t);});
document.addEventListener('change',e=>{const t=e.target;if(t.classList?.contains('prio-color')||t.classList?.contains('prio-match')){prioDirty=true;return;}if(!t.classList?.contains('app-set'))return;const k=t.dataset.k;if(k.startsWith('color-')){setAppColor(t);if(t.classList.contains('app-hex')&&!/^#?[0-9a-f]{6}$/i.test(t.value.trim())){t.value=appearance.colors[k.slice(6)];toast('Renk kodu #RRGGBB biçiminde olmalı, örneğin #0f766e.',true);}return;}appearance[k]=t.value;appearanceDirty=true;applyAppearance();if(['boardView','plateBand','statusIcons'].includes(k)){if(k==='boardView'){try{localStorage.removeItem(STORE+'.view');}catch(_){}}render();}});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(['prio-up','prio-down','prio-del','prio-add'].includes(a)){prioDirty=true;return;}
 if(a==='app-preset'){const p=APP_PRESETS[b.dataset.p];if(!p)return;const d=structuredClone(APP_DEFAULT);appearance={...d,...p[1],colors:{...d.colors,...(p[1].colors||{})}};appearanceDirty=true;applyAppearance();render();toast(`“${p[0]}” teması uygulandı. Kalıcı olması için Kaydet’e basın.`);return;}
 if(a==='app-reset'){appearance=structuredClone(APP_DEFAULT);appearanceDirty=true;applyAppearance();render();toast('Varsayılan görünüm yüklendi. Kalıcı olması için Kaydet’e basın.');return;}
 if(a==='app-save'){if(!canEdit())return;busy=true;onlineUI();try{let {error}=await client.rpc('save_app_setting',{p_key:'appearance',p_value:appearance});if(error&&error.code==='PGRST202'){const r=await client.from('app_settings').update({value:appearance,updated_at:new Date().toISOString()}).eq('key','appearance').select('key');error=r.error;if(!error&&!r.data?.length)error={code:'SETUP'};}if(error)throw error;generation++;appearanceDirty=false;busy=false;await syncData();toast('Görünüm ayarları kaydedildi.');}catch(err){toast(err.code==='SETUP'||err.code==='42501'?'Görünüm kaydedilemedi: önce ayar-kaydetme-kurulumu.sql dosyasını Supabase’de çalıştırın.':friendly(err),true);}finally{busy=false;onlineUI();}return;}
 if(a==='link-show'||a==='link-rotate'){if(!canEdit())return;if(a==='link-rotate'&&!window.confirm('Yeni link oluşturulsun mu? Eski link hemen çalışmaz olur; yeni linki tekrar paylaşmanız gerekir.'))return;busy=true;onlineUI();try{const {data,error}=await client.rpc(a==='link-show'?'get_public_link':'rotate_public_link');if(error)throw error;if(!data)throw new Error('Aktif link bulunamadı. “Yeni link oluştur” ile oluşturun.');publicLink=location.origin+location.pathname+'?izle='+encodeURIComponent(data);busy=false;render();if(a==='link-rotate')toast('Yeni link oluşturuldu; eski link artık çalışmıyor.');}catch(err){toast(err.code==='PGRST202'?'Önce gorunum-linki-kurulumu.sql dosyasını Supabase’de çalıştırın.':friendly(err),true);}finally{busy=false;onlineUI();}return;}
 if(a==='link-copy'){try{await navigator.clipboard.writeText(publicLink);toast('Link kopyalandı.');}catch(err){const i=document.getElementById('public-link');i?.select();toast('Kopyalanamadı; linki seçip Ctrl+C ile kopyalayın.',true);}return;}
});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action^="wa-"]');if(!b||VIEW_TOKEN)return;const a=b.dataset.action;
 if(a==='wa-send'){const v=state.visits.find(x=>x.id===b.dataset.id);if(v)openWhatsApp([v]);return;}
 if(a==='wa-customer'){openWhatsApp(sortRows(state.visits.filter(v=>v.customer===b.dataset.name&&v.date===b.dataset.date)));return;}
 if(a==='wa-contacts-save'){if(!canEdit())return;const clean=Object.fromEntries(Object.entries(customerContacts).map(([k,v])=>[k,String(v||'').trim()]).filter(([,v])=>v));busy=true;onlineUI();try{const {error}=await client.rpc('save_app_setting',{p_key:'customer_contacts',p_value:{numbers:clean,templates:{single:waTemplates.single,multi:waTemplates.multi}}});if(error)throw error;customerContacts=clean;generation++;contactsDirty=false;busy=false;await syncData();toast('WhatsApp numaraları ve mesaj şablonu kaydedildi.');}catch(err){toast(err.code==='22023'||err.code==='PGRST202'?'Önce whatsapp-kurulumu.sql dosyasını Supabase’de çalıştırın.':friendly(err),true);}finally{busy=false;onlineUI();}return;}
});
var waLastTpl='single';
document.addEventListener('focusin',e=>{if(e.target.classList?.contains('wa-tpl'))waLastTpl=e.target.dataset.k;});
document.addEventListener('click',e=>{const b=e.target.closest('.wa-tag,[data-action="wa-tpl-reset"]');if(!b||!canEdit())return;
 if(b.dataset.action==='wa-tpl-reset'){waTemplates={...WA_DEFAULT};contactsDirty=true;for(const k of ['single','multi']){const t=document.getElementById('wa-tpl-'+k);if(t)t.value=waTemplates[k];}waRefreshPreview();toast('Varsayılan mesaj yüklendi. Kalıcı olması için "WhatsApp ayarlarını kaydet"e basın.');return;}
 const ta=document.getElementById('wa-tpl-'+waLastTpl);if(!ta)return;const s=ta.selectionStart??ta.value.length,en=ta.selectionEnd??s;ta.value=ta.value.slice(0,s)+b.dataset.tag+ta.value.slice(en);const p=s+b.dataset.tag.length;ta.focus();ta.setSelectionRange(p,p);waTemplates[waLastTpl]=ta.value;contactsDirty=true;waRefreshPreview();});
document.addEventListener('input',e=>{const t=e.target;if(t.classList?.contains('wa-tpl')){waTemplates[t.dataset.k]=t.value;contactsDirty=true;waRefreshPreview();return;}if(t.classList?.contains('wa-phone')){customerContacts[t.dataset.name]=t.value;contactsDirty=true;}if(t.id==='wa-search'){ui.waSearch=t.value;const pos=t.selectionStart;render();const i=document.getElementById('wa-search');if(i){i.focus();try{i.setSelectionRange(pos,pos);}catch(_){}}}});
function nextWorkday(d){let n=addDays(d,1);if(weekday(n)===0)n=addDays(n,1);return n;}
const dayLabel=d=>fmt(d,{weekday:'long',day:'numeric',month:'long'});
async function carryToNext(ids){const groups=new Map();for(const id of ids){const v=state.visits.find(x=>x.id===id);if(!v||v.done)continue;if(!groups.has(v.date))groups.set(v.date,[]);groups.get(v.date).push(v.id);}
 if(!groups.size){toast('Taşınacak, işlemi bitmemiş araç yok.');return false;}
 busy=true;onlineUI();let moved=0;
 try{for(const [d,list] of groups){const patch={visit_date:nextWorkday(d)};if(orderReady())patch.sort_order=null;const {data,error}=await client.from('visits').update(patch).in('id',list).eq('done',false).select('id');if(error)throw error;moved+=data.length;}
  busy=false;generation++;await syncData();return moved;
 }catch(err){toast('Araçlar taşınamadı: '+friendly(err),true);return false;}finally{busy=false;onlineUI();}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action="carry-next"],[data-action="bulk-next"]');if(!b||!canEdit())return;
 let ids,text;
 if(b.dataset.action==='carry-next'){const d=b.dataset.date;ids=state.visits.filter(v=>v.date===d&&!v.done).map(v=>v.id);text=`${dayLabel(d)} gününün işlemi bitmemiş ${ids.length} aracı ${dayLabel(nextWorkday(d))} gününe taşınacak. TESİSTE ve T1 işaretleri korunur.`;}
 else{ids=[...selectedIds].filter(id=>{const v=state.visits.find(x=>x.id===id);return v&&!v.done;});const skipped=selectedIds.size-ids.length;text=`Seçili ${ids.length} araç, her biri kendi gününün bir sonraki iş gününe taşınacak. TESİSTE ve T1 işaretleri korunur.${skipped?` İşlemi bitmiş ${skipped} araç taşınmaz.`:''}`;}
 if(!ids.length){toast('Taşınacak, işlemi bitmemiş araç yok.');return;}
 confirmDialog('Ertesi güne al',text,async()=>{closeModal();const n=await carryToNext(ids);if(n!==false){if(b.dataset.action==='bulk-next')selectedIds.clear();render();toast(`${n} araç bir sonraki iş gününe taşındı.`);}},'Ertesi güne al');
});
/* canlı değişiklik bildirimi */
function liveDiff(prev,next){if(appearance?.liveNotify==='off')return;const pm=new Map(prev.map(v=>[v.id,v]));const items=[];const now=Date.now();
 const ON={onsite:'Tesiste işaretlendi',t1:'T1 yazıldı',done:'İşlemler tamamlandı'},OFF={onsite:'Tesiste işareti kaldırıldı',t1:'T1 işareti kaldırıldı',done:'Tamamlandı işareti kaldırıldı'};
 for(const v of next){const p=pm.get(v.id);pm.delete(v.id);
  if(!p){items.push({id:v.id,plate:v.plate,text:'Yeni araç gelişi eklendi',k:'new'});justChangedMap.set(v.id,now);continue;}
  let hit=false;for(const k of ['done','t1','onsite']){if(!!p[k]!==!!v[k]){items.push({id:v.id,plate:v.plate,text:v[k]?ON[k]:OFF[k],k:v[k]?k:'off'});hit=true;break;}}
  if(!hit&&p.date!==v.date){items.push({id:v.id,plate:v.plate,text:`${fmt(v.date)} gününe taşındı`,k:'move'});hit=true;}
  if(!hit&&['plate','customer','declaration','carrier','registration'].some(f=>(p[f]||'')!==(v[f]||''))){items.push({id:v.id,plate:v.plate,text:'Bilgileri güncellendi',k:'edit'});hit=true;}
  if(hit)justChangedMap.set(v.id,now);}
 for(const p of pm.values())items.push({id:null,plate:p.plate,text:'Araç gelişi silindi',k:'del'});
 if(!items.length)return;
 if(items.length>4)liveToast([{id:null,plate:'',text:`${items.length} araçta değişiklik oldu`,k:'edit'}]);else liveToast(items);}
function liveToast(items){let box=document.getElementById('live-feed');if(!box){box=document.createElement('div');box.id='live-feed';box.setAttribute('aria-live','polite');document.body.appendChild(box);}
 for(const it of items){const el=document.createElement(it.id?'button':'div');if(it.id){el.type='button';el.title='Aracı göster';el.addEventListener('click',()=>{ui.selected=it.id;if(ui.page!=='pano')ui.page='pano';render();el.remove();});}
  el.className='live-item k-'+it.k;el.innerHTML=`<i class="live-dot"></i><span><b>${esc(it.text)}</b>${it.plate?`<small>${esc(it.plate)} · şimdi</small>`:'<small>şimdi</small>'}</span>`;
  box.prepend(el);while(box.children.length>4)box.lastElementChild.remove();setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400);},7000);}}
/* plaka kayıtları: blok aç/kapa, ülke süzgeci */
document.addEventListener('toggle',e=>{const d=e.target;if(!d?.classList?.contains('reg-group')||ui.regSearch||ui.regCountry)return;const s=ui.regOpen||(ui.regOpen=new Set());if(d.open)s.add(d.dataset.cust);else s.delete(d.dataset.cust);},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="reg-country"],[data-action="reg-open-all"],[data-action="reg-close-all"]');if(!b)return;const a=b.dataset.action;
 if(a==='reg-country'){ui.regCountry=b.dataset.cc||'';render();return;}
 const s=ui.regOpen||(ui.regOpen=new Set());if(a==='reg-open-all'){for(const r of state.registry)s.add(r.customer||'');}else s.clear();
 if(a==='reg-close-all'){ui.regSearch='';ui.regCountry='';}render();});
/* eksik bilgi + hızlı ekleme + bekleyenler */
function isMissing(v){return !v.declaration||!v.carrier||!kgText(v.registration);}
function missOr(val){return val?esc(val):(ui.missingOnly?MISSING:DASH);}
function quickAdd(){if(VIEW_TOKEN||role!=='editor')return '';const d=defaultDate();return `<form id="quick-add" class="quick-add" autocomplete="off"><span class="qa-ic">${icon('plus')}</span><input id="quick-plate" list="quick-plates" placeholder="Hızlı ekle: plakayı yazıp Enter'a basın" aria-label="Hızlı araç ekleme, plaka" maxlength="30"><datalist id="quick-plates">${state.registry.map(r=>`<option value="${esc(r.plate)}">${esc(r.customer)}</option>`).join('')}</datalist><span id="quick-hint" class="qa-hint">${esc(fmt(d,{weekday:'long',day:'numeric',month:'long'}))} gününe eklenir</span><button type="submit" class="btn primary small">Ekle</button></form>`;}
document.addEventListener('input',e=>{if(e.target.id!=='quick-plate')return;const val=e.target.value.trim(),h=document.getElementById('quick-hint');if(!h)return;const m=val?matchPlate(val):null;h.className='qa-hint'+(m?' ok':val?' new':'');h.innerHTML=!val?esc(fmt(defaultDate(),{weekday:'long',day:'numeric',month:'long'}))+' gününe eklenir':m?`${plateHTML(m.plate,'sm')}<b>${esc(m.customer)}</b>`:'Kayıtlı değil · Enter ile form açılır';});
document.addEventListener('submit',async e=>{if(e.target.id!=='quick-add')return;e.preventDefault();if(!canEdit())return;const inp=document.getElementById('quick-plate');const raw=(inp?.value||'').trim();if(!raw)return;const d=defaultDate();const m=matchPlate(raw);
 if(!m||!m.customer){pendingVisit=null;openVisitForm(null,d,{plate:plateText(m?.plate||raw)});return;}
 if(state.visits.some(x=>x.date===d&&norm(x.plate)===norm(m.plate))&&!window.confirm(`${m.plate} için ${fmt(d)} gününde zaten bir geliş var. Yine de eklensin mi?`))return;
 const v={id:uid(),plate:m.plate,customer:m.customer||'',declaration:m.declaration||'',carrier:m.carrier||'',registration:kgText(m.registration),date:d,time:timeNow(),note:'',onsite:false,t1:false,done:false,createdAt:new Date().toISOString()};
 if(await mutate(s=>{s.visits.push(v);})){justChangedMap.set(v.id,Date.now());ui.selected=v.id;render();const i=document.getElementById('quick-plate');if(i){i.value='';i.focus();}toast(`${v.plate} · ${v.customer}, ${fmt(d)} gününe eklendi.`);}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="missing-only"],[data-action="pend-age"]');if(!b)return;if(b.dataset.action==='missing-only')ui.missingOnly=!ui.missingOnly;else ui.pendAge=b.dataset.b||'';render();});
document.addEventListener('toggle',e=>{const d=e.target;if(!d?.classList?.contains('pend-group'))return;const s=ui.pendClosed||(ui.pendClosed=new Set());if(d.open)s.delete(d.dataset.cust);else s.add(d.dataset.cust);},true);
/* geri al */
const ST_NAME={onsite:'TESİSTE',t1:'T1 YAZILDI',done:'İŞLEMLER BİTTİ'};
const UNDO_FIELDS={visits:['plate','customer','declaration','carrier','registration','date','time','note','onsite','t1','done'],registry:['plate','customer','declaration','carrier','registration']};
let undoEntry=null,undoTimer=null,undoing=false;
const mutateBase=mutate;
mutate=async function(fn){const before=undoing?null:structuredClone(state);const ok=await mutateBase(fn);if(ok&&before){try{const c=diffOne(before,state);if(c)offerUndo(c);}catch(_){}}return ok;};
function diffOne(a,b){const out=[];for(const t of ['registry','visits']){const old=new Map(a[t].map(r=>[r.id,r]));for(const r of b[t]){const p=old.get(r.id);old.delete(r.id);if(!p||JSON.stringify(payload(p,t))!==JSON.stringify(payload(r,t)))out.push({t,p,r});}for(const p of old.values())out.push({t,p,r:null});}return out.length===1?out[0]:null;}
function offerUndo({t,p,r}){const plate=(r||p).plate,what=t==='visits'?'':' plaka kaydı';let label,fn;
 if(!p){label=`${plate}${what} eklendi`;fn=s=>{s[t]=s[t].filter(x=>x.id!==r.id);};}
 else if(!r){label=`${plate}${what} silindi`;fn=s=>{s[t].push(structuredClone(p));};}
 else{const k=t==='visits'?['done','t1','onsite'].find(k=>!!p[k]!==!!r[k]):null;
  label=k?`${plate} · ${ST_NAME[k]} ${r[k]?'işaretlendi':'kaldırıldı'}`:t==='visits'&&p.date!==r.date?`${plate} · ${fmt(r.date)} gününe taşındı`:`${plate}${what} güncellendi`;
  fn=s=>{const x=s[t].find(y=>y.id===p.id);if(x)for(const f of UNDO_FIELDS[t])x[f]=p[f];};}
 undoEntry={label,fn};let bar=document.getElementById('undo-bar');if(!bar){bar=document.createElement('div');bar.id='undo-bar';bar.setAttribute('role','status');document.body.appendChild(bar);}
 bar.innerHTML=`<span>${esc(label)}</span><button type="button" data-action="undo">${icon('undo')}Geri al</button><kbd>Ctrl+Z</kbd>`;bar.className='show';document.body.classList.add('has-undo');
 clearTimeout(undoTimer);undoTimer=setTimeout(hideUndo,10000);}
function hideUndo(){undoEntry=null;const bar=document.getElementById('undo-bar');if(bar)bar.className='';document.body.classList.remove('has-undo');}
async function doUndo(){if(!undoEntry||!canEdit())return;const e=undoEntry;hideUndo();undoing=true;formVersion=null;let ok=false;try{ok=await mutate(e.fn);}finally{undoing=false;}if(ok){render();toast('Geri alındı: '+e.label);}}

/* kopyala */
function stText(v){return v.done?'İŞLEMLER BİTTİ':v.t1?'T1 YAZILDI':v.onsite?'TESİSTE':'BEKLİYOR';}
function vehicleText(v){return [['PLAKA',v.plate],['MÜŞTERİ',v.customer],['BEYANNAME',v.declaration],['NAKLİYECİ',v.carrier],['RUHSAT',kgText(v.registration)],['GELİŞ',fmt(v.date)+(v.time?' '+v.time:'')],['DURUM',stText(v)]].map(([k,x])=>`${k}: ${x||'-'}`).join('\n');}
function copyLegacy(text,html){const host=document.querySelector('dialog[open]')||document.body;let el;if(html){el=document.createElement('div');el.innerHTML=html;el.setAttribute('contenteditable','true');}else{el=document.createElement('textarea');el.value=text;el.setAttribute('readonly','');}el.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';host.appendChild(el);
 const sel=getSelection();sel.removeAllRanges();if(html){const r=document.createRange();r.selectNodeContents(el);sel.addRange(r);}else{el.focus();el.select();}let ok=false;try{ok=document.execCommand('copy');}catch(_){}sel.removeAllRanges();el.remove();return ok;}
function copyFeedback(btn){if(!btn||btn.tagName!=='BUTTON'||btn.dataset.copied)return;const old=btn.innerHTML;btn.dataset.copied='1';btn.classList.add('is-copied');btn.innerHTML=`${icon('check')}Kopyalandı`;setTimeout(()=>{if(!btn.isConnected)return;btn.innerHTML=old;btn.classList.remove('is-copied');delete btn.dataset.copied;},1800);}
async function copyOut(text,html,msg){const btn=document.activeElement;
 try{if(navigator.clipboard&&window.isSecureContext){if(html&&window.ClipboardItem&&navigator.clipboard.write)await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);else await navigator.clipboard.writeText(text);copyFeedback(btn);toast(msg);return;}}catch(_){}
 if(copyLegacy(text,html)){copyFeedback(btn);toast(msg);return;}
 toast('Kopyalanamadı, tarayıcı izin vermedi.',true);}
function copyVisit(id){const v=state.visits.find(x=>x.id===id);if(v)copyOut(vehicleText(v),'',`${v.plate} bilgileri kopyalandı.`);}
function copyDay(d){const rows=sortRows(state.visits.filter(v=>v.date===d));if(!rows.length)return;const H=['SIRA','PLAKA','MÜŞTERİ','BEYANNAME','NAKLİYECİ','RUHSAT','SAAT','DURUM'];
 const data=rows.map((v,i)=>[i+1,v.plate,v.customer,v.declaration,v.carrier,kgText(v.registration),v.time,stText(v)].map(x=>String(x??'')));
 const text=[H,...data].map(r=>r.join('\t')).join('\n');const td='border:1px solid #cfd6e2;padding:5px 9px;font:13px Arial,sans-serif';
 const html=`<table style="border-collapse:collapse"><tr>${H.map(h=>`<th style="${td};background:#1f2a44;color:#fff;text-align:left">${h}</th>`).join('')}</tr>${data.map(r=>`<tr>${r.map(c=>`<td style="${td}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
 copyOut(text,html,`${fmt(d)} listesi kopyalandı (${rows.length} araç). Excel'e veya maile yapıştırabilirsiniz.`);}

/* açık araç uyarısı */
function openElsewhere(plate,date){const n=norm(plate);if(!n)return [];return state.visits.filter(x=>!x.done&&x.date!==date&&norm(x.plate)===n).sort((a,b)=>a.date.localeCompare(b.date));}
function openWarnText(list){return list.length?`Dikkat: bu araç ${fmt(list[0].date)} tarihinden beri açık bekliyor${list.length>1?` (${list.length} açık geliş)`:''}.`:'';}
document.addEventListener('input',e=>{if(e.target.id!=='quick-plate')return;const h=document.getElementById('quick-hint');const m=matchPlate(e.target.value.trim());if(!h||!m)return;const w=openElsewhere(m.plate,defaultDate());if(w.length)h.insertAdjacentHTML('beforeend',`<span class="qa-warn">${icon('info')}${fmt(w[0].date)}'den beri açık</span>`);});
document.addEventListener('submit',e=>{if(e.target.id!=='quick-add')return;const raw=(document.getElementById('quick-plate')?.value||'').trim();const m=raw?matchPlate(raw):null;if(!m)return;const w=openElsewhere(m.plate,defaultDate());if(w.length&&!window.confirm(`${openWarnText(w)}\n\nYine de ${fmt(defaultDate())} için yeni geliş eklensin mi?`)){e.preventDefault();e.stopImmediatePropagation();}},true);
function visitWarn(){const form=document.getElementById('visit-form');if(!form)return;const hint=document.getElementById('plate-hint');if(!hint)return;let w=document.getElementById('open-warn');if(!w){w=document.createElement('div');w.id='open-warn';w.className='open-warn';hint.after(w);}
 const list=openElsewhere(form.elements.plate.value,form.elements.date?.value||'').filter(x=>x.id!==form.dataset.id);
 const t=openWarnText(list);w.hidden=!t;w.innerHTML=t?`${icon('info')}<span>${esc(t)}</span>`:'';}
document.addEventListener('input',e=>{if(e.target.closest?.('#visit-form')&&['plate','date'].includes(e.target.name))visitWarn();});
document.addEventListener('change',e=>{if(e.target.closest?.('#visit-form')&&e.target.name==='date')visitWarn();});
new MutationObserver(()=>{const f=document.getElementById('visit-form');if(f&&!f.dataset.warnInit){f.dataset.warnInit='1';visitWarn();}}).observe(document.body,{childList:true,subtree:true});

/* klavye kısayolları */
const SHORTCUTS=[['/','Aramaya git'],['N','Hızlı eklemeye git (plaka yaz, Enter)'],['← →','Önceki / sonraki gün'],['B','Bugüne dön'],['1 · 2 · 3','Seçili araç: Tesiste · T1 · Bitti'],['C','Seçili aracın bilgilerini kopyala'],['Ctrl+Z','Son işlemi geri al'],['?','Bu listeyi aç']];
function shortcutsHelp(){openModal(modalHeader('Klavye kısayolları','Yazı kutusunda değilken çalışır')+`<div class="modal-body"><div class="kb-list">${SHORTCUTS.map(([k,l])=>`<div class="kb-row"><span>${k.split(' · ').map(x=>`<kbd>${esc(x)}</kbd>`).join(' ')}</span><b>${esc(l)}</b></div>`).join('')}</div></div><div class="modal-footer">${button('close-modal','Kapat')}</div>`);}
function weekDays(){const m=weekStart();return [0,1,2,3,4,5].map(i=>addDays(m,i));}
function stepDay(step){if(ui.page!=='pano'||ui.search.trim())return;let days=weekDays();if(ui.day==='all'){ui.day=step>0?days[0]:days[5];return render();}let i=days.indexOf(ui.day)+step;
 if(i<0||i>5){const t=weekInfo(addDays(days[0],step*7));ui.year=t.year;ui.week=t.week;ui.collapsed.clear();days=weekDays();i=i<0?5:0;}ui.day=days[i];render();}
function goToday(){const t=weekInfo(TODAY);ui.page='pano';ui.year=t.year;ui.week=t.week;ui.day=weekday(TODAY)>=1&&weekday(TODAY)<=6?TODAY:'all';ui.search='';render();}
document.addEventListener('keydown',async e=>{const el=e.target,typing=el.closest?.('input,textarea,select,[contenteditable="true"]');const md=document.getElementById('modal');
 if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!typing&&undoEntry){e.preventDefault();doUndo();return;}
 if(ui.page==='saha'||typing||e.ctrlKey||e.metaKey||e.altKey||md?.open||!account)return;const k=e.key;
 if(k==='?'){e.preventDefault();shortcutsHelp();return;}
 if(k==='/'){e.preventDefault();if(ui.page!=='pano'){ui.page='pano';render();}document.getElementById('board-search')?.focus();return;}
 if(k==='n'||k==='N'){const q=document.getElementById('quick-plate');if(!q&&ui.page!=='pano'){ui.page='pano';render();}const q2=document.getElementById('quick-plate');if(q2){e.preventDefault();q2.focus();}return;}
 if(k==='ArrowLeft'||k==='ArrowRight'){e.preventDefault();stepDay(k==='ArrowLeft'?-1:1);return;}
 if(k==='b'||k==='B'){e.preventDefault();goToday();return;}
 const sid=ui.selected&&state.visits.some(x=>x.id===ui.selected)?ui.selected:document.querySelector('.side-card input[data-check]')?.dataset.id;if(ui.page!=='pano'||!sid)return;
 if(k==='c'||k==='C'){e.preventDefault();copyVisit(sid);return;}
 const key={'1':'onsite','2':'t1','3':'done'}[k];if(key&&canEdit()){e.preventDefault();const id=sid;justChangedMap.set(id,Date.now());if(!await mutate(s=>{const v=s.visits.find(x=>x.id===id);if(v)v[key]=!v[key];}))render();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="undo"],[data-action="copy-visit"],[data-action="copy-day"],[data-action="shortcuts"]');if(!b)return;const a=b.dataset.action;
 if(a==='undo')doUndo();else if(a==='copy-visit')copyVisit(b.dataset.id);else if(a==='copy-day')copyDay(b.dataset.date);else shortcutsHelp();});

/* gece modu */
const THEME_KEY=STORE+'.theme';
function getTheme(){try{return localStorage.getItem(THEME_KEY)==='dark'?'dark':'light';}catch(_){return 'light';}}
function liftColor(hex,minL){const n=parseInt(hex.slice(1),16);let r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;
 if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;}if(l>=minL)return hex;l=minL;
 const k=x=>(x+h/30)%12,a=s*Math.min(l,1-l),f=x=>Math.round((l-a*Math.max(-1,Math.min(k(x)-3,Math.min(9-k(x),1))))*255);return '#'+[f(0),f(8),f(4)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function applyTheme(){const r=document.documentElement,dark=getTheme()==='dark';if(dark)r.dataset.theme='dark';else delete r.dataset.theme;
 if(dark){r.style.setProperty('--bg','#0e1218');for(const k of ['brand','accent']){const c=/^#[0-9a-f]{6}$/i.test(appearance.colors?.[k]||'')?appearance.colors[k]:APP_DEFAULT.colors[k];const d=liftColor(c,k==='brand'?0.4:0.6);r.style.setProperty('--c-'+k,d);r.style.setProperty('--c-'+k+'-fg',textOn(d));}}
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#0e1218':'#ffffff');}
const applyAppearanceBase=applyAppearance;
applyAppearance=function(){applyAppearanceBase();applyTheme();};
function toggleTheme(){try{localStorage.setItem(THEME_KEY,getTheme()==='dark'?'light':'dark');}catch(_){}applyAppearance();render();}

/* bildirimler: yedek uyarısı şerit yerine başlıkta */
backupReminder=function(){return '';};
function notices(){const list=[];
 if(!VIEW_TOKEN&&(state.visits.length||state.registry.length)){let last=null;try{last=localStorage.getItem(STORE+'.backupAt');}catch(_){}
  const days=last?Math.floor((Date.now()-new Date(last).getTime())/DAY):0;
  if(!last)list.push({lvl:'bad',t:'Yedek alınmadı',d:'Bu cihazda hiç JSON yedeği indirilmemiş.',act:'backup',btn:'Şimdi yedekle'});
  else if(days>=14)list.push({lvl:'bad',t:'Yedek eski',d:`Son yedek ${days} gün önce alındı.`,act:'backup',btn:'Şimdi yedekle'});}
 const miss=state.visits.filter(v=>v.date===TODAY&&isMissing(v)).length;
 if(miss)list.push({lvl:'warn',t:'Eksik bilgi',d:`Bugün ${miss} araçta beyanname, nakliyeci veya ruhsat eksik.`,act:'notif-missing',btn:'Göster'});
 const old=state.visits.filter(v=>!v.done&&v.date<addDays(TODAY,-2)).length;
 if(old)list.push({lvl:'warn',t:'Uzun bekleyen',d:`${old} araç 3 günden fazladır bekliyor.`,act:'notif-pending',btn:'Bekleyenler'});
 return list;}
function headerTools(){const n=notices(),lvl=n.some(x=>x.lvl==='bad')?'bad':n.length?'warn':'ok',dark=getTheme()==='dark';
 return `<div class="hdr-tools"><button type="button" class="hdr-btn" data-action="saha-open" title="Kapı ve rampa için büyük düğmeli ekran">${icon('tablet')}<span>Saha modu</span></button><button type="button" class="hdr-btn icon" data-action="theme-toggle" title="${dark?'Gündüz moduna geç':'Gece moduna geç'}" aria-label="${dark?'Gündüz moduna geç':'Gece moduna geç'}">${icon(dark?'sun':'moon')}</button><div class="notif"><button type="button" class="hdr-btn icon notif-btn ${lvl}" data-action="notif-toggle" aria-expanded="${!!ui.notifOpen}" aria-label="Bildirimler, ${n.length} uyarı" title="Bildirimler">${icon('bell')}${n.length?`<b class="notif-count">${n.length}</b>`:'<i class="notif-ok"></i>'}</button>${ui.notifOpen?`<div class="notif-panel" role="dialog" aria-label="Bildirimler"><div class="notif-head"><b>Bildirimler</b><span class="notif-state ${lvl}">${lvl==='ok'?'Her şey yolunda':n.length+' uyarı'}</span></div>${n.length?n.map(x=>`<div class="notif-item ${x.lvl}"><i></i><div><b>${esc(x.t)}</b><small>${esc(x.d)}</small></div><button type="button" class="btn small" data-action="${x.act}">${esc(x.btn)}</button></div>`).join(''):`<p class="notif-empty">${icon('check')}Yedek güncel, bekleyen uyarı yok.</p>`}</div>`:''}</div></div>`;}

/* saha / tablet modu */
const SAHA_KEY=STORE+'.saha';let wakeLock=null;
function sahaDay(){return weekday(TODAY)>=1&&weekday(TODAY)<=6?TODAY:defaultDate();}
function sahaEditor(){return !VIEW_TOKEN&&role==='editor';}
function sahaCard(v,ed){const steps=[['onsite','Tesiste'],['t1','T1 yazıldı'],['done','Bitti']];
 return `<article class="saha-card${v.done?' is-done':''}${justChanged(v.id)?' just-changed':''}" style="--bc:${custColor(v.customer)}"><div class="saha-card-top">${plateHTML(v.plate,'lg')}${v.time?`<span class="saha-time">${icon('clock')}${esc(v.time)}</span>`:''}</div><div class="saha-cust"><i></i>${esc(v.customer||'Müşterisiz')}</div><div class="saha-meta"><span><small>Beyanname</small>${v.declaration?esc(v.declaration):MISSING}</span><span><small>Nakliyeci</small>${esc(v.carrier)||DASH}</span></div><div class="saha-steps">${steps.map(([k,l])=>`<button type="button" class="saha-step ${k}${v[k]?' on':''}" data-action="saha-st" data-id="${esc(v.id)}" data-k="${k}" aria-pressed="${!!v[k]}" ${ed?'':'disabled'}>${stIcon(k,true)}<span>${l}</span></button>`).join('')}</div></article>`;}
function renderSaha(){const d=sahaDay(),ed=sahaEditor();const all=sortRows(state.visits.filter(v=>v.date===d));const q=norm(ui.sahaQ||'');
 const tabs=[['wait','Bekleyen',v=>!v.done],['onsite','Tesiste',v=>v.onsite&&!v.done],['done','Tamamlanan',v=>v.done],['all','Tümü',()=>true]];
 const tab=tabs.find(t=>t[0]===(ui.sahaTab||'wait'))||tabs[0];
 const list=all.filter(tab[2]).filter(v=>!q||norm(v.plate).includes(q)||norm(v.customer).includes(q));
 const focus=document.activeElement?.id,sel=document.activeElement?.selectionStart;
 document.getElementById('app').innerHTML=`<div class="saha"><header class="saha-top"><div class="saha-brand"><img src="logo.svg" alt=""><div><b>PCS TRANSİT</b><small>Saha modu</small></div></div><div class="saha-date"><b>${fmt(d,{day:'numeric',month:'long'})} ${DAYS[weekday(d)-1]||''}</b><small>${storageError?'Bağlantı kesildi':'Güncel · '+esc(lastSync||'')}</small></div><div class="saha-top-btns"><button type="button" class="saha-icon" data-action="theme-toggle" aria-label="${getTheme()==='dark'?'Gündüz moduna geç':'Gece moduna geç'}">${icon(getTheme()==='dark'?'sun':'moon')}</button><button type="button" class="saha-exit" data-action="saha-exit">${icon('left')}<span>Panoya dön</span></button></div></header>
 <form id="saha-add" class="saha-add" autocomplete="off"><label class="saha-input">${icon('search')}<input id="saha-plate" list="saha-plates" placeholder="${ed?'Plaka yazın: arayın veya giriş yapın':'Plaka veya müşteri arayın'}" value="${esc(ui.sahaQ||'')}" aria-label="Plaka" autocapitalize="characters" enterkeyhint="go"></label>${ed?`<button type="submit" class="saha-go">${icon('plus')}Giriş yap</button>`:''}<datalist id="saha-plates">${state.registry.map(r=>`<option value="${esc(r.plate)}">${esc(r.customer)}</option>`).join('')}</datalist></form>
 <div class="saha-tabs" role="group" aria-label="Liste">${tabs.map(([k,l,f])=>`<button type="button" class="saha-tab${tab[0]===k?' active':''}" data-action="saha-tab" data-k="${k}" aria-pressed="${tab[0]===k}">${l}<b>${all.filter(f).length}</b></button>`).join('')}</div>
 ${list.length?`<div class="saha-grid">${list.map(v=>sahaCard(v,ed)).join('')}</div>`:`<div class="saha-empty">${icon('check')}<b>${q?'Eşleşen araç yok':tab[0]==='wait'?'Bekleyen araç yok':'Bu listede araç yok'}</b>${q&&ed?'<small>“Giriş yap” ile bu plakayı bugüne ekleyebilirsiniz.</small>':''}</div>`}</div>`;
 if(focus==='saha-plate'){const i=document.getElementById('saha-plate');i?.focus();if(sel!=null)i?.setSelectionRange(sel,sel);}}
async function keepAwake(on){try{if(on&&!wakeLock&&navigator.wakeLock)wakeLock=await navigator.wakeLock.request('screen');if(!on&&wakeLock){await wakeLock.release();wakeLock=null;}}catch(_){wakeLock=null;}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ui.page==='saha'){wakeLock=null;keepAwake(true);}});
function setSaha(on){ui.page=on?'saha':'pano';ui.notifOpen=false;try{on?localStorage.setItem(SAHA_KEY,'1'):localStorage.removeItem(SAHA_KEY);}catch(_){}keepAwake(on);render();window.scrollTo(0,0);}
async function sahaSubmit(){if(!canEdit())return;const raw=(document.getElementById('saha-plate')?.value||'').trim();if(!raw)return;const d=sahaDay();const m=matchPlate(raw);
 const today=state.visits.find(x=>x.date===d&&norm(x.plate)===norm(m?.plate||raw));
 if(today){if(today.onsite){toast(`${today.plate} zaten tesiste.`);ui.sahaQ=today.plate;renderSaha();return;}
  const id=today.id;justChangedMap.set(id,Date.now());if(await mutate(s=>{const v=s.visits.find(x=>x.id===id);if(v)v.onsite=true;})){ui.sahaQ='';toast(`${today.plate} tesiste olarak işaretlendi.`);render();}return;}
 if(!m||!m.customer){openVisitForm(null,d,{plate:plateText(raw),onsite:true});return;}
 const w=openElsewhere(m.plate,d);if(w.length&&!window.confirm(`${openWarnText(w)}\n\nYine de bugün için yeni giriş yapılsın mı?`))return;
 const v={id:uid(),plate:m.plate,customer:m.customer||'',declaration:m.declaration||'',carrier:m.carrier||'',registration:kgText(m.registration),date:d,time:timeNow(),note:'',onsite:true,t1:false,done:false,createdAt:new Date().toISOString()};
 if(await mutate(s=>{s.visits.push(v);})){justChangedMap.set(v.id,Date.now());ui.sahaQ='';ui.sahaTab='wait';render();toast(`${v.plate} · ${v.customer} giriş yaptı, tesiste.`);}}

/* ekrana bağlama */
const renderBase=render;
render=function(){if(account&&ui.page==='saha'){renderSaha();return;}renderBase();const tr=document.querySelector('.topbar-right');if(tr&&account)tr.insertAdjacentHTML('afterbegin',headerTools());};
document.addEventListener('input',e=>{if(e.target.id!=='saha-plate')return;ui.sahaQ=e.target.value;renderSaha();});
document.addEventListener('submit',e=>{if(e.target.id!=='saha-add')return;e.preventDefault();sahaSubmit();});
document.addEventListener('click',async e=>{
 if(ui.notifOpen&&!e.target.closest('.notif')){ui.notifOpen=false;document.querySelector('.notif-panel')?.remove();document.querySelector('.notif-btn')?.setAttribute('aria-expanded','false');}
 const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(a==='theme-toggle')return toggleTheme();
 if(a==='notif-toggle'){ui.notifOpen=!ui.notifOpen;return render();}
 if(a==='backup'&&b.closest('.notif-panel')){ui.notifOpen=false;setTimeout(render,400);return;}
 if(a==='notif-missing'){const t=weekInfo(TODAY);Object.assign(ui,{page:'pano',year:t.year,week:t.week,day:weekday(TODAY)>=1&&weekday(TODAY)<=6?TODAY:'all',search:'',missingOnly:true,notifOpen:false});return render();}
 if(a==='notif-pending'){Object.assign(ui,{page:'pending',pendAge:'',notifOpen:false});return render();}
 if(a==='saha-open')return setSaha(true);
 if(a==='saha-exit')return setSaha(false);
 if(a==='saha-tab'){ui.sahaTab=b.dataset.k;return renderSaha();}
 if(a==='saha-st'){if(!canEdit())return;const id=b.dataset.id,k=b.dataset.k;justChangedMap.set(id,Date.now());b.classList.toggle('on');if(!await mutate(s=>{const v=s.visits.find(x=>x.id===id);if(v)v[k]=!v[k];}))render();}
});
try{if(localStorage.getItem(SAHA_KEY)==='1'){ui.page='saha';keepAwake(true);}}catch(_){}
applyTheme();

/* giriş-çıkış saatleri */
const timesReady=()=>state.visits.some(v=>'onsite_at' in v);
const payloadBase=payload;
payload=function(r,table){const p=payloadBase(r,table);if(table==='visits'&&r&&'onsite_at' in r){p.onsite_at=r.onsite_at||null;p.done_at=r.done_at||null;}return p;};
UNDO_FIELDS.visits.push('onsite_at','done_at');
const pad2=n=>String(n).padStart(2,'0');
function tsText(iso){if(!iso)return '—';const d=new Date(iso);if(isNaN(d))return '—';return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;}
function toLocalInput(iso){if(!iso)return '';const d=new Date(iso);if(isNaN(d))return '';return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;}
function fromLocalInput(val){if(!val)return null;const d=new Date(val);return isNaN(d)?null:d.toISOString();}
function plateCompact(p){const parts=splitPlate(p).map(x=>x.replace(/\s+/g,'')).filter(Boolean);return parts.length?parts.join(' / '):String(p||'').replace(/\s+/g,'');}
function stayMinutes(v){if(!v.onsite_at||!v.done_at)return null;const m=Math.round((new Date(v.done_at)-new Date(v.onsite_at))/60000);return m>=0?m:null;}
function stayText(v){const m=stayMinutes(v);if(m==null)return v.onsite_at&&!v.done_at?'İçeride':'—';return m<60?`${m} dk`:`${Math.floor(m/60)} sa ${pad2(m%60)} dk`;}
function gateText(v){return `${plateCompact(v.plate)}\nTESİS GİRİŞ TARİH SAAT : ${tsText(v.onsite_at)}\nTESİS ÇIKIŞ TARİH SAAT : ${tsText(v.done_at)}\nMÜŞTERİ : ${String(v.customer||'—').toLocaleUpperCase('tr-TR')}`;}
function gateShare(list){if(!list.length)return;const text=list.map(gateText).join('\n\n');const custs=[...new Set(list.map(v=>v.customer||''))];const num=custs.length===1?waNumber(custs[0]):'';
 waLaunch(num,text);if(!num&&custs.length===1)toast(`${custs[0]||'Bu müşteri'} için numara kayıtlı değil; WhatsApp'ta kişiyi seçin.`);}
function gateCopy(list){if(list.length)copyOut(list.map(gateText).join('\n\n'),'',`${list.length} aracın giriş-çıkış bilgisi kopyalandı.`);}
const SQL_NOTE='Bu özellik için Supabase’de “giris-cikis-gecmis-yedek-kurulumu.sql” bir kez çalıştırılmalı.';

/* işlem geçmişi */
const LOG_TEXT={insert:'Kayıt oluşturuldu',delete:'Kayıt silindi',onsite_on:'TESİSTE işaretlendi',onsite_off:'TESİSTE işareti kaldırıldı',t1_on:'T1 YAZILDI işaretlendi',t1_off:'T1 işareti kaldırıldı',done_on:'İŞLEMLER BİTTİ işaretlendi',done_off:'BİTTİ işareti kaldırıldı',onsite_time:'Giriş saati düzeltildi',done_time:'Çıkış saati düzeltildi',move:'Gün değiştirildi',edit:'Bilgiler düzenlendi'};
const LOG_FIELDS={plate:'plaka',customer:'müşteri',declaration:'beyanname',carrier:'nakliyeci',registration:'ruhsat',note:'not',visit_time:'geliş saati'};
function logLine(l){let t=LOG_TEXT[l.action]||l.action;const d=l.detail||{};
 if(l.action==='move'&&d.to)t=`${fmt(d.from)} → ${fmt(d.to)} gününe taşındı`;
 if(l.action==='edit'&&Array.isArray(d.fields))t+=': '+d.fields.map(f=>LOG_FIELDS[f]||f).join(', ');
 if((l.action==='onsite_time'||l.action==='done_time')&&d.at)t+=` (${tsText(d.at)})`;
 const who=l.actor_email?displayName(l.actor_email):'Sistem';
 const k=l.action.startsWith('onsite')?'onsite':l.action.startsWith('t1')?'t1':l.action.startsWith('done')?'done':l.action==='delete'||l.action.endsWith('_off')?'off':'edit';
 return `<li class="log-item k-${k}"><i></i><div><b>${esc(t)}</b><small>${esc(tsText(l.at))} · ${esc(who)}</small></div></li>`;}
async function loadHistory(id){const box=document.getElementById('gate-history');if(!box)return;
 try{const {data,error}=await client.rpc('visit_history',{p_visit_id:id});if(error)throw error;if(document.getElementById('gate-history')!==box)return;
  box.innerHTML=Array.isArray(data)&&data.length?`<ul class="log-list">${data.map(logLine).join('')}</ul>`:'<p class="help-note">Bu araç için henüz kayıtlı işlem yok. Kurulumdan sonraki işlemler burada görünür.</p>';}
 catch(e){box.innerHTML=`<p class="help-note">${esc(/visit_history|function|schema/i.test(e?.message||'')?SQL_NOTE:friendly(e))}</p>`;}}

/* tek araç raporu */
function gateReport(id){const v=state.visits.find(x=>x.id===id);if(!v)return;const ready='onsite_at' in v;
 openModal(`${modalHeader('Giriş – çıkış raporu',`${esc(v.plate)} · ${esc(v.customer||'Müşterisiz')}`)}<div class="modal-body gate-body">
 ${ready?`<div class="gate-grid"><div class="gate-stat in"><span>Tesis giriş</span><b>${tsText(v.onsite_at)}</b></div><div class="gate-stat out"><span>Tesis çıkış</span><b>${tsText(v.done_at)}</b></div><div class="gate-stat dur"><span>Tesiste kalma</span><b>${esc(stayText(v))}</b></div></div>
 <h3 class="gate-sub">WhatsApp mesajı</h3><pre class="gate-pre">${esc(gateText(v))}</pre>`:`<div class="notice">${icon('info')}<div>${esc(SQL_NOTE)}</div></div>`}
 ${VIEW_TOKEN?'':`<h3 class="gate-sub">İşlem geçmişi</h3><div id="gate-history"><p class="help-note">Yükleniyor…</p></div>`}</div>
 <div class="modal-footer">${ready?`<button type="button" class="btn" data-action="gate-copy" data-id="${esc(v.id)}">${icon('copy')}Kopyala</button><button type="button" class="btn wa-full gate-wa" data-action="gate-wa" data-id="${esc(v.id)}">${icon('wa')}WhatsApp’ta paylaş</button>`:''}${button('close-modal','Kapat')}</div>`);
 if(!VIEW_TOKEN)loadHistory(v.id);}

/* raporlar sayfası: toplu giriş-çıkış raporu */
function gateRows(){const from=ui.gateFrom||WORK_TODAY,to=ui.gateTo||from,c=ui.gateCust||'',st=ui.gateSt||'';
 return state.visits.filter(v=>v.date>=from&&v.date<=to&&(!c||v.customer===c)&&(!st||(st==='out'?!!v.done_at:st==='in'?!!v.onsite_at&&!v.done_at:!v.onsite_at))).sort((a,b)=>a.date.localeCompare(b.date)||String(a.onsite_at||'~').localeCompare(String(b.onsite_at||'~'))||a.plate.localeCompare(b.plate));}
function gateSection(){if(VIEW_TOKEN)return '';const ready=timesReady();const from=ui.gateFrom||WORK_TODAY,to=ui.gateTo||from;
 const custs=[...new Set(state.visits.map(v=>v.customer).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
 const rows=ready?gateRows():[];const mins=rows.map(stayMinutes).filter(m=>m!=null);const avg=mins.length?Math.round(mins.reduce((a,b)=>a+b,0)/mins.length):null;
 return `<section class="card gate-card" id="gate-report"><div class="card-header"><div><h2>Giriş – çıkış raporu</h2><p>TESİSTE işaretlendiği an giriş, BİTTİ işaretlendiği an çıkış olarak otomatik kaydedilir.</p></div>${ready?`<div class="actions"><button type="button" class="btn" data-action="gate-copy-all" ${rows.length?'':'disabled'}>${icon('copy')}Kopyala</button><button type="button" class="btn wa-full gate-wa" data-action="gate-wa-all" ${rows.length?'':'disabled'}>${icon('wa')}WhatsApp’ta paylaş</button></div>`:''}</div>
 ${ready?`<div class="gate-filters"><label>Başlangıç<input type="date" id="gate-from" value="${esc(from)}"></label><label>Bitiş<input type="date" id="gate-to" value="${esc(to)}"></label><label>Müşteri<select id="gate-cust"><option value="">Tüm müşteriler</option>${custs.map(c=>`<option ${c===ui.gateCust?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Durum<select id="gate-st">${[['','Hepsi'],['out','Çıkış yapanlar'],['in','Hâlâ içeride'],['none','Giriş kaydı olmayan']].map(([k,l])=>`<option value="${k}" ${k===(ui.gateSt||'')?'selected':''}>${l}</option>`).join('')}</select></label></div>
 <div class="gate-summary"><span><b>${rows.length}</b> araç</span><span><b>${rows.filter(v=>v.done_at).length}</b> çıkış yaptı</span><span><b>${rows.filter(v=>v.onsite_at&&!v.done_at).length}</b> içeride</span><span>Ortalama kalma <b>${avg==null?'—':avg<60?avg+' dk':Math.floor(avg/60)+' sa '+pad2(avg%60)+' dk'}</b></span></div>
 ${rows.length?`<div class="table-scroll"><table class="gate-table"><thead><tr><th>PLAKA</th><th>MÜŞTERİ</th><th>TESİS GİRİŞ</th><th>TESİS ÇIKIŞ</th><th>KALMA</th><th></th></tr></thead><tbody>${rows.map(v=>`<tr><td><button type="button" class="plate-button" data-action="gate-report" data-id="${esc(v.id)}" title="Raporu aç">${plateHTML(v.plate,'sm')}</button></td><td>${esc(v.customer)}</td><td class="gate-ts">${tsText(v.onsite_at)}</td><td class="gate-ts">${tsText(v.done_at)}</td><td class="gate-dur">${esc(stayText(v))}</td><td class="actions-cell"><button type="button" class="icon-btn wa-btn" data-action="gate-wa" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} giriş-çıkış bilgisini WhatsApp ile paylaş" title="WhatsApp ile paylaş">${icon('wa')}</button><button type="button" class="icon-btn" data-action="gate-report" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} raporu ve işlem geçmişi" title="Rapor ve işlem geçmişi">${icon('clock')}</button></td></tr>`).join('')}</tbody></table></div>`:`<p class="help-note" style="margin-top:14px">Seçilen aralıkta araç yok.</p>`}`
 :`<div class="notice">${icon('info')}<div>${esc(SQL_NOTE)}</div></div>`}</section>`;}
const reportsViewBase=reportsView;
reportsView=function(){return reportsViewBase()+gateSection();};

/* araç formunda saat düzeltme */
const openVisitFormBase=openVisitForm;
openVisitForm=function(id=null,d=null,preset=null){openVisitFormBase(id,d,preset);const v=id&&state.visits.find(x=>x.id===id);const grid=document.querySelector('#visit-form .form-grid');if(!v||!grid||!('onsite_at' in v))return;
 grid.insertAdjacentHTML('beforeend',`<details class="field full gate-edit"><summary>${icon('clock')}Giriş – çıkış saatleri <small>${v.onsite_at?tsText(v.onsite_at):'giriş yok'} · ${v.done_at?tsText(v.done_at):'çıkış yok'}</small></summary><div class="gate-edit-grid"><label>Tesis giriş<input type="datetime-local" name="onsite_at" value="${toLocalInput(v.onsite_at)}"></label><label>Tesis çıkış<input type="datetime-local" name="done_at" value="${toLocalInput(v.done_at)}"></label></div><p class="help-note">Saatler TESİSTE ve BİTTİ işaretlenince otomatik yazılır. Yalnızca yanlış kaldıysa düzeltin.</p><button type="button" class="btn small" data-action="gate-report" data-id="${esc(v.id)}">${icon('wa')}Rapor ve işlem geçmişi</button></details>`);};
const visitFieldsBase=visitFields;
visitFields=function(form){const o=visitFieldsBase(form);const a=form.elements.onsite_at,b=form.elements.done_at;if(a&&b){o.onsite_at=fromLocalInput(a.value);o.done_at=fromLocalInput(b.value);}return o;};

/* yan panel ve kartlara rapor düğmesi */
const sidePanelBase=sidePanel;
sidePanel=function(...args){return sidePanelBase(...args).replace(/(<button type="button" class="btn copy-btn" data-action="copy-visit" data-id="([^"]*)"[^>]*>[\s\S]*?<\/button>)/,(m,btn,id)=>`${btn}<button type="button" class="btn gate-btn" data-action="gate-report" data-id="${id}" title="Giriş-çıkış saatleri, WhatsApp raporu ve işlem geçmişi">${icon('clock')}Giriş-çıkış raporu</button>`);};
const vehicleCardBase=vehicleCard;
vehicleCard=function(v){return vehicleCardBase(v).replace('<button type="button" class="icon-btn wa-btn"',`<button type="button" class="icon-btn" data-action="gate-report" data-id="${esc(v.id)}" aria-label="${esc(v.plate)} giriş-çıkış raporu" title="Giriş-çıkış raporu ve işlem geçmişi">${icon('clock')}</button><button type="button" class="icon-btn wa-btn"`);};

/* otomatik sunucu yedeği */
const srvBackup={state:'unknown',last:null,list:[],checked:0};
async function checkBackups(force=false){if(VIEW_TOKEN||role!=='editor')return;if(!force&&Date.now()-srvBackup.checked<3600000)return;srvBackup.checked=Date.now();
 try{const {data,error}=await client.rpc('list_backups');if(error)throw error;srvBackup.list=Array.isArray(data)?data:[];srvBackup.state='ready';srvBackup.last=srvBackup.list[0]?.taken_at||null;}
 catch(_){srvBackup.state='missing';srvBackup.list=[];}
 if(ui.page==='data'||ui.notifOpen)render();else{const b=document.querySelector('.notif-btn');if(b){const tr=document.querySelector('.hdr-tools');if(tr){tr.outerHTML=headerTools();}}}}
const noticesBase=notices;
notices=function(){let l=noticesBase();if(srvBackup.state==='ready'){const age=srvBackup.last?(Date.now()-new Date(srvBackup.last).getTime())/3600000:Infinity;l=l.filter(x=>x.act!=='backup');if(age>36)l.unshift({lvl:'bad',t:'Otomatik yedek gecikti',d:srvBackup.last?`Son sunucu yedeği ${tsText(srvBackup.last)}.`:'Henüz sunucu yedeği alınmadı.',act:'backup-now',btn:'Şimdi yedekle'});}return l;};
function backupsSection(){if(VIEW_TOKEN)return '';const s=srvBackup;
 return `<section class="card backup-card"><div class="card-header"><div><h2>Otomatik sunucu yedekleri</h2><p>Her gece 03:00’te tüm veriler sunucuda otomatik yedeklenir; son 30 gün saklanır.</p></div>${s.state==='ready'&&role==='editor'?`<button type="button" class="btn" data-action="backup-now">${icon('refresh')}Şimdi yedekle</button>`:''}</div>
 ${s.state==='unknown'?'<p class="help-note">Yükleniyor…</p>':s.state==='missing'?`<div class="notice">${icon('info')}<div>${esc(SQL_NOTE)}</div></div>`:s.list.length?`<div class="backup-list">${s.list.slice(0,30).map((b,i)=>`<div class="backup-row"><span class="backup-dot${i===0?' last':''}"></span><div><b>${esc(tsText(b.taken_at))}</b><small>${b.visit_count??'?'} geliş · ${b.registry_count??'?'} plaka${i===0?' · en son':''}</small></div><button type="button" class="btn small" data-action="backup-dl" data-id="${esc(b.id)}">${icon('download')}İndir</button></div>`).join('')}</div>`:'<p class="help-note">Henüz yedek yok. İlk yedek bu gece alınacak ya da “Şimdi yedekle”ye basabilirsiniz.</p>'}</section>`;}
const dataViewBase=dataView;
dataView=function(){if(srvBackup.state==='unknown')setTimeout(()=>checkBackups(true),0);return dataViewBase()+backupsSection();};
async function downloadServerBackup(id){try{const {data,error}=await client.rpc('get_backup',{p_id:Number(id)});if(error)throw error;if(!data)throw new Error('Yedek bulunamadı.');
 const snap={schemaVersion:1,revision:0,updatedAt:data.taken_at,registry:(data.registry||[]).map(r=>mapRow(r,'registry')),visits:(data.visits||[]).map(r=>mapRow(r,'visits'))};
 const file={app:'PCS TRANSIT YYS',schemaVersion:1,mode:'real',source:'sunucu-yedegi',exportedAt:data.taken_at,settings:data.settings||{},data:snap};
 const d=new Date(data.taken_at);downloadBlob(new Blob([JSON.stringify(file,null,2)],{type:'application/json;charset=utf-8'}),`PCS_SUNUCU_YEDEGI_${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}_${pad2(d.getHours())}-${pad2(d.getMinutes())}.json`);toast('Sunucu yedeği indirildi.');}
 catch(e){toast(friendly(e),true);}}
async function backupNow(){if(!canEdit())return;try{const {error}=await client.rpc('take_backup_now');if(error)throw error;toast('Sunucuda yeni yedek alındı.');await checkBackups(true);}catch(e){toast(friendly(e),true);}}

/* olaylar */
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,id=b.dataset.id;
 if(a==='gate-report'){e.stopPropagation();return gateReport(id);}
 if(a==='gate-wa'){const v=state.visits.find(x=>x.id===id);if(v)gateShare([v]);return;}
 if(a==='gate-copy'){const v=state.visits.find(x=>x.id===id);if(v)gateCopy([v]);return;}
 if(a==='gate-wa-all')return gateShare(gateRows());
 if(a==='gate-copy-all')return gateCopy(gateRows());
 if(a==='backup-dl')return downloadServerBackup(id);
 if(a==='backup-now'){ui.notifOpen=false;return backupNow();}});
document.addEventListener('change',e=>{const t=e.target;const k={'gate-from':'gateFrom','gate-to':'gateTo','gate-cust':'gateCust','gate-st':'gateSt'}[t.id];if(!k)return;ui[k]=t.value;if(k==='gateFrom'&&(!ui.gateTo||ui.gateTo<t.value))ui.gateTo=t.value;if(k==='gateTo'&&ui.gateFrom&&t.value<ui.gateFrom)ui.gateFrom=t.value;render();document.getElementById('gate-report')?.scrollIntoView({block:'start'});});
setTimeout(()=>checkBackups(),4000);setInterval(()=>checkBackups(),300000);

/* gün bazında toplu giriş-çıkış */
function gateDayRows(d,st){return state.visits.filter(v=>v.date===d&&(!st||(st==='out'?!!v.done_at:st==='in'?!!v.onsite_at&&!v.done_at:true))).sort((a,b)=>custPriority(a.customer)-custPriority(b.customer)||(a.customer||'').localeCompare(b.customer||'','tr')||String(a.onsite_at||'~').localeCompare(String(b.onsite_at||'~'))||a.plate.localeCompare(b.plate));}
function gateDayList(cust){const d=ui.gateDay||WORK_TODAY,st=ui.gateDaySt||'';const rows=gateDayRows(d,st);return cust==null?rows:rows.filter(v=>(v.customer||'')===cust);}
function gateDay(d){if(d)ui.gateDay=d;d=ui.gateDay||WORK_TODAY;const st=ui.gateDaySt||'';const ready=timesReady();const rows=gateDayRows(d,st),all=gateDayRows(d,'');
 const groups=new Map();for(const v of rows){const k=v.customer||'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(v);}
 const chip=(k,l,n)=>`<button type="button" class="reg-cc${st===k?' active':''}" data-action="gate-day-st" data-st="${k}" aria-pressed="${st===k}">${l} <b>${n}</b></button>`;
 const title=fmt(d,{day:'numeric',month:'long',year:'numeric'})+' · '+(DAYS[weekday(d)-1]||'Pazar');
 openModal(`${modalHeader('Günlük giriş – çıkış',esc(title))}<div class="modal-body gate-day-body">
 <div class="gate-day-bar"><div class="gate-day-nav"><button type="button" class="icon-btn" data-action="gate-day-step" data-step="-1" aria-label="Önceki gün">${icon('left')}</button><input type="date" id="gate-day-date" value="${esc(d)}" aria-label="Gün seç"><button type="button" class="icon-btn" data-action="gate-day-step" data-step="1" aria-label="Sonraki gün">${icon('chevron')}</button>${d!==TODAY?`<button type="button" class="btn text small" data-action="gate-day-today">Bugün</button>`:''}</div>
 <div class="reg-countries" role="group" aria-label="Duruma göre süz">${chip('','Tümü',all.length)}${chip('out','Çıkış yapanlar',all.filter(v=>v.done_at).length)}${chip('in','Hâlâ içeride',all.filter(v=>v.onsite_at&&!v.done_at).length)}</div></div>
 ${!ready?`<div class="notice">${icon('info')}<div>${esc(SQL_NOTE)}</div></div>`:!rows.length?`<div class="empty-day">Bu gün için ${st==='out'?'çıkış yapan ':st==='in'?'içeride ':''}araç yok.</div>`:[...groups.entries()].map(([c,list])=>`<section class="gd-group" style="--bc:${custColor(c)}"><header><span class="gd-dot"></span><b>${esc(c||'Müşterisiz')}</b><small>${list.length} araç</small><span class="gd-acts"><button type="button" class="btn small" data-action="gate-day-copy" data-cust="${esc(c)}">${icon('copy')}Kopyala</button><button type="button" class="btn small gate-wa" data-action="gate-day-wa" data-cust="${esc(c)}">${icon('wa')}WhatsApp</button></span></header>
 <table class="gd-table"><thead><tr><th>PLAKA</th><th>TESİS GİRİŞ</th><th>TESİS ÇIKIŞ</th><th>KALMA</th></tr></thead><tbody>${list.map(v=>`<tr><td>${plateHTML(v.plate,'sm')}</td><td class="gate-ts">${tsText(v.onsite_at)}</td><td class="gate-ts">${tsText(v.done_at)}</td><td class="gate-dur">${esc(stayText(v))}</td></tr>`).join('')}</tbody></table></section>`).join('')}
 </div><div class="modal-footer">${ready&&rows.length?`<button type="button" class="btn" data-action="gate-day-copy">${icon('copy')}Tümünü kopyala (${rows.length})</button><button type="button" class="btn gate-wa" data-action="gate-day-wa">${icon('wa')}Tümünü WhatsApp’ta paylaş</button>`:''}${button('close-modal','Kapat')}</div>`);
 document.getElementById('modal').classList.add('gd-modal');document.getElementById('modal').addEventListener('close',()=>document.getElementById('modal').classList.remove('gd-modal'),{once:true});}
const dayBlockBase=dayBlock;
dayBlock=function(d,shown,all){const h=dayBlockBase(d,shown,all);if(VIEW_TOKEN||!all.length)return h;
 return h.replace('<button type="button" class="btn text small copy-day"',`<button type="button" class="btn small gate-day-btn" data-action="gate-day" data-date="${d}" title="Bu günün tüm araçlarının giriş-çıkış saatleri; müşteri bazında kopyala veya WhatsApp'ta paylaş">${icon('clock')}Giriş-çıkış</button><button type="button" class="btn text small copy-day"`);};
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
 if(a==='gate-day'){ui.gateDaySt='';return gateDay(b.dataset.date);}
 if(a==='gate-day-st'){ui.gateDaySt=b.dataset.st||'';return gateDay();}
 if(a==='gate-day-step'){return gateDay(addDays(ui.gateDay||WORK_TODAY,Number(b.dataset.step)));}
 if(a==='gate-day-today')return gateDay(TODAY);
 if(a==='gate-day-copy'){const l=gateDayList('cust' in b.dataset?b.dataset.cust:null);if(l.length)copyOut(l.map(gateText).join('\n\n'),'',`${l.length} aracın giriş-çıkış bilgisi kopyalandı.`);return;}
 if(a==='gate-day-wa'){const l=gateDayList('cust' in b.dataset?b.dataset.cust:null);if(l.length)gateShare(l);return;}});
document.addEventListener('change',e=>{if(e.target.id==='gate-day-date'&&validDate(e.target.value))gateDay(e.target.value);});
const gateSectionBase=gateSection;
gateSection=function(){return gateSectionBase().replace('<div class="actions">',`<div class="actions"><button type="button" class="btn gate-day-btn" data-action="gate-day" data-date="${esc(ui.gateFrom||WORK_TODAY)}">${icon('clock')}Günlük görünüm</button>`);};

/* Excel / CSV'den plaka kayıtlarını içe aktar: yalnızca yeni plakalar eklenir */
let importPlan=null;
async function readRegistryFile(file){const input=document.getElementById('registry-file');if(input)input.value='';if(!file)return;
 if(!canEdit()){toast('Bu işlem için düzenleyici yetkisi gerekli.',true);return;}
 let rows;try{if(!window.PCSXLSX)throw new Error('Excel bileşeni yüklenemedi.');rows=await PCSXLSX.readRegistry(file);}catch(e){toast('Dosya okunamadı: '+(e.message||e),true);return;}
 const seen=new Set(),add=[],existing=[],skipped=[];
 for(const r of rows){const plate=plateText(r.plate),customer=String(r.customer||'').trim();
  const rec={plate,customer,declaration:String(r.declaration||'').trim(),carrier:String(r.carrier||'').trim(),registration:kgText(r.registration)};
  if(!norm(plate)||!customer){skipped.push({...rec,why:'Plaka veya müşteri boş'});continue;}
  if(plate.length>30||[customer,rec.declaration,rec.carrier,rec.registration].some(x=>x.length>150)){skipped.push({...rec,why:'Alan çok uzun'});continue;}
  const k=norm(plate);if(seen.has(k)){skipped.push({...rec,why:'Dosyada tekrar ediyor'});continue;}seen.add(k);
  if(matchPlate(plate)){existing.push(rec);continue;}
  add.push({id:uid(),...rec});}
 importPlan={add};
 const stat=(n,l)=>`<div><strong>${n}</strong><span>${l}</span></div>`;
 const preview=add.slice(0,50).map(r=>`<tr><td>${esc(r.plate)}</td><td>${esc(r.customer)}</td><td>${esc(r.declaration)||DASH}</td><td>${esc(r.carrier)||DASH}</td></tr>`).join('');
 const skipList=skipped.slice(0,20).map(r=>`<li>${esc(r.plate||'(plaka yok)')} · ${esc(r.why)}</li>`).join('');
 openModal(`${modalHeader('Excel’den plaka al',esc(file.name))}<div class="modal-body"><div class="import-stat">${stat(add.length,'yeni plaka eklenecek')}${stat(existing.length,'zaten kayıtlı, atlanacak')}${stat(skipped.length,'hatalı satır')}</div>${add.length?`<div class="preview-scroll"><table class="preview-table"><thead><tr><th>PLAKA</th><th>MÜŞTERİ</th><th>BEYANNAME</th><th>NAKLİYECİ</th></tr></thead><tbody>${preview}</tbody></table></div>${add.length>50?'<p class="help-note">İlk 50 satır gösteriliyor.</p>':''}`:'<p class="confirm-text">Eklenecek yeni plaka yok.</p>'}${skipped.length?`<p class="help-note" style="margin-top:12px">Atlanan satırlar${skipped.length>20?' (ilk 20)':''}:</p><ul class="help-note">${skipList}</ul>`:''}<p class="form-note">Kayıtlı plakaların bilgileri değiştirilmez; yalnızca yeni plakalar eklenir.</p></div><div class="modal-footer">${button('close-modal','Vazgeç')}<button type="button" class="btn primary" data-action="import-confirm" ${add.length?'':'disabled'}>${icon('upload')}${add.length} plakayı ekle</button></div>`);
 onlineUI();}
async function importRegistry(){const plan=importPlan;if(!plan||!plan.add.length||!canEdit())return;importPlan=null;
 busy=true;onlineUI();let added=0,dup=0;
 const row=r=>({id:r.id,plate:r.plate,customer:r.customer,declaration:r.declaration,carrier:r.carrier,registration:r.registration});
 try{for(let i=0;i<plan.add.length;i+=500){const chunk=plan.add.slice(i,i+500).map(row);
   const {data,error}=await client.from('registry').insert(chunk).select('id');
   if(!error){added+=data.length;continue;}
   if(error.code!=='23505')throw error;
   /* bu arada başka biri aynı plakayı eklemiş: tek tek dene, tekrarları atla */
   for(const r of chunk){const {error:e1}=await client.from('registry').insert(r).select('id');if(!e1)added++;else if(e1.code==='23505')dup++;else throw e1;}}
  toast(`${added} plaka eklendi${dup?`; ${dup} plaka bu arada başka biri tarafından eklenmiş, atlandı`:''}.`);
 }catch(err){toast(`İçe aktarma yarıda kaldı (${added} plaka eklendi): `+friendly(err),true);}
 finally{busy=false;closeModal();generation++;await syncData();onlineUI();}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="import-confirm"]');if(b&&!b.disabled&&canEdit())importRegistry();});

/* ===== Ruhsattan araç ekleme =====
   Ruhsat fotoğrafı (WhatsApp Web'den kopyala-yapıştır, sürükle-bırak ya da dosya seç) bu bilgisayarda
   Tesseract ile okunur; fotoğraf hiçbir yere gönderilmez. Okunan plakalar plaka kayıtlarıyla eşleştirilir:
   kayıtlı araç tek tıkla eklenir, yeni araçta plaka ve boş ağırlık toplamı forma doldurulur. */
const OCR_BASE=new URL('ocr/',location.href).href;
const WASM_SIMD_TEST=new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);
let ocrWorkerP=null,ocrOnProgress=null;
const ruhsat={items:[],seq:0,running:false,returnId:null};
function loadScriptOnce(src){return new Promise((ok,fail)=>{if(window.Tesseract)return ok();const s=document.createElement('script');s.src=src;s.onload=()=>ok();s.onerror=()=>fail(new Error('Okuma programı yüklenemedi. İnternet bağlantısını kontrol edin.'));document.head.appendChild(s);});}
function ocrWorker(){
 if(!ocrWorkerP){ocrWorkerP=(async()=>{await loadScriptOnce(OCR_BASE+'tesseract.min.js');let simd=false;try{simd=WebAssembly.validate(WASM_SIMD_TEST);}catch(_){}
  const w=await window.Tesseract.createWorker('eng',1,{workerPath:OCR_BASE+'worker.min.js',corePath:OCR_BASE+(simd?'tesseract-core-simd-lstm.js':'tesseract-core-lstm.js'),langPath:OCR_BASE.slice(0,-1),gzip:true,workerBlobURL:false,cacheMethod:'none',logger:m=>{if(ocrOnProgress&&m&&typeof m.progress==='number')ocrOnProgress(m);}});
  await w.setParameters({tessedit_pageseg_mode:'11',debug_file:'/dev/null'});return w;})();
  ocrWorkerP.catch(()=>{ocrWorkerP=null;});}
 return ocrWorkerP;}
/* Okumadan önce: büyüt, griye çevir, kontrastı ger, hafif keskinleştir (küçük yazılar daha iyi okunur). */
/* rot: fotoğrafı saat yönünde kaç derece döndürerek okuyacağımız (0, 90, 180, 270) */
function ruhsatDraw(bmp,rot,sc){const bw=rot%180?bmp.height:bmp.width,bh=rot%180?bmp.width:bmp.height,w=Math.round(bw*sc),h=Math.round(bh*sc);
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;const cx=cv.getContext('2d',{willReadFrequently:true});cx.imageSmoothingQuality='high';
 cx.translate(w/2,h/2);cx.rotate(rot*Math.PI/180);cx.drawImage(bmp,-bmp.width*sc/2,-bmp.height*sc/2,bmp.width*sc,bmp.height*sc);cx.setTransform(1,0,0,1,0,0);return {cv,cx,w,h};}
async function ruhsatRotated(file,rot){if(!rot)return file;const bmp=await createImageBitmap(file);const {cv}=ruhsatDraw(bmp,rot,1);if(bmp.close)bmp.close();return cv;}
async function ruhsatEnhance(file,rot=0){const bmp=await createImageBitmap(file);const sc=Math.min(3,Math.max(1,3000/(rot%180?bmp.height:bmp.width)));
 const {cv,cx,w,h}=ruhsatDraw(bmp,rot,sc);if(bmp.close)bmp.close();
 const img=cx.getImageData(0,0,w,h),d=img.data,n=w*h,g=new Float32Array(n),hist=new Uint32Array(256);
 for(let i=0,j=0;i<n;i++,j+=4){const v=(d[j]*299+d[j+1]*587+d[j+2]*114)/1000;g[i]=v;hist[v|0]++;}
 let lo=0,hi=255,acc=0;while(lo<254&&(acc+=hist[lo])<n*0.01)lo++;acc=0;while(hi>lo+1&&(acc+=hist[hi])<n*0.01)hi--;const k=255/(hi-lo);
 for(let i=0;i<n;i++)g[i]=(g[i]-lo)*k;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;let v=g[i];if(x>0&&y>0&&x<w-1&&y<h-1)v=v+0.5*(4*g[i]-g[i-1]-g[i+1]-g[i-w]-g[i+w]);const q=i*4;d[q]=d[q+1]=d[q+2]=v<0?0:v>255?255:v;}
 cx.putImageData(img,0,0);cv.srcW=w/sc;cv.srcH=h/sc;return cv;}
const compactPlate=v=>String(v||'').toLocaleUpperCase('tr-TR').replace(/İ/g,'I').replace(/[^A-Z0-9]/g,'');
function fmtCompactPlate(c){c=compactPlate(c);let m;if((m=c.match(/^(\d{2})([A-Z]{1,3})(\d{2,5})$/))||(m=c.match(/^([A-Z]{1,3})(\d{2,4})([A-Z]{1,3})$/)))return m.slice(1).join(' ');if((m=c.match(/^([A-Z]{3})(\d{3,4})$/)))return m.slice(1).join(' ');return c;}
/* Küçük / bulanık fotoğrafta rakam harf sanılabilir (CM2817EK → "CM2B17EK"). Rakam grubunun ortasına düşen
   ve rakama benzeyen harfler rakama çevrilir; sonuç geçerli bir plaka değilse düzeltme yapılmaz. */
const DIGIT_LIKE={O:'0',Q:'0',D:'0',I:'1',L:'1',Z:'2',S:'5',G:'6',B:'8'};
function plateFix(c){const a=c.search(/\d/),b=c.length-1-[...c].reverse().join('').search(/\d/);if(a<0||b-a<2)return '';
 let f=c.slice(0,a);for(let i=a;i<=b;i++){const ch=c[i];if(/\d/.test(ch))f+=ch;else if(DIGIT_LIKE[ch])f+=DIGIT_LIKE[ch];else return '';}f+=c.slice(b+1);
 return f!==c&&plateCountry(f)?f:'';}
/* Metindeki plaka adayları: satır içinde en fazla 3 parçayı birleştir ("47 DU 965", "CT-46-AXL"), ülke biçimine uyanları al. */
function ruhsatPlates(text){const out=[];const up=String(text||'').toLocaleUpperCase('tr-TR').replace(/İ/g,'I');
 for(const line of up.split('\n')){const t=line.split(/[\s|()[\]{}"'“”‘’,;:]+/).map(x=>x.replace(/[^A-Z0-9]/g,'')).filter(Boolean);
  for(let i=0;i<t.length;i++){let c='';for(let j=i;j<Math.min(i+3,t.length);j++){if(t[j].length>8)break;c+=t[j];if(c.length<5||c.length>9)continue;const v=plateCountry(c)?c:plateFix(c);if(v&&!out.includes(v))out.push(v);}}}
 return out;}
/* Aracın cinsi: plakadan sonra gelen ilk "TRACTOR / ВЛЕКАЧ / ÇEKİCİ" ya da "SEMI-TRAILER / ПОЛУРЕМАРКЕ / RÖMORK"
   yazısı o plakanın çekici mi dorse mi olduğunu söyler (Kiril harfler İngilizce okuyucuda "BAEKAY", "NONYPEMAPKE" gibi çıkar). */
const KIND_TRAILER=/TRAIL|SEMI|REMAR|PEMAP|REMOR|R[ÖO]MORK|AUFLIEG|ANH[ÄA]NG|ПОЛУРЕМ/,KIND_TRACTOR=/TRA[CK]T|B[AN]EKA|BJIEKA|ВЛЕКА|[CÇ]EK[İI]C[İI]|ZUGMASCH/;
function ruhsatKinds(text,kinds){let last='',gap=0;
 for(const line of String(text||'').toLocaleUpperCase('tr-TR').replace(/İ/g,'I').split('\n')){if(!line.trim())continue;const ps=ruhsatPlates(line);if(ps.length){last=ps[ps.length-1];gap=0;}else gap++;
  if(!last||gap>15||kinds[last])continue;const k=KIND_TRAILER.test(line)?'trailer':KIND_TRACTOR.test(line)?'tractor':'';if(k){kinds[last]=k;last='';}}
 return kinds;}
/* Boş ağırlık: AB ruhsatında "(G) 8162" / "G 8332", Türk ruhsatında "G.1 NET AĞIRLIĞI 7180". Emin olunmayan sayı alınmaz. */
function ruhsatWeights(text){const out=[],t=String(text||'').replace(/[“”"'‘’|]/g,' ');
 for(const m of t.matchAll(/(?:\(G\)|\bG(?:\.1)?\b|NET\s*A[GĞ]IRLI[GĞ]I)[^\d]{0,30}?(\d{4,5})(?!\d)/gi)){const v=+m[1];if(v>=2000&&v<=16000)out.push(v);}
 return out;}
function lev1(a,b){if(a===b||Math.abs(a.length-b.length)>1)return false;let i=0,j=0,e=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}}return e+(a.length-i)+(b.length-j)<=1;}
function ruhsatLookup(tractor,trailer){const full=tractor+trailer;const reg=full?state.registry.find(r=>norm(r.plate)===full)||null:null;
 const tractorReg=!reg&&tractor?state.registry.find(r=>norm(splitPlate(r.plate)[0]||'')===tractor&&r.customer)||null:null;return {reg,tractorReg};}
/* Okunan adaylardan çekici ve dorseyi seç. Kayıtlı plakalar önce gelir; fotoğrafta tek harfi yanlış okunmuş
   plaka, kayıtlarda buna benzeyen TEK bir plaka varsa ona düzeltilir (birden fazlaysa düzeltilmez). */
function ruhsatResolve(cands,kinds={}){const parts=new Map();for(const r of state.registry)splitPlate(r.plate).forEach((p,i)=>{const k=norm(p);if(!k)return;if(!parts.has(k))parts.set(k,[]);parts.get(k).push({r,i});});
 let fuzzy=false;const fixed=cands.slice(0,8).map(c=>{if(parts.has(c))return {c,k:c};let hit=null,n=0;for(const k of parts.keys())if(lev1(k,c)){hit=k;if(++n>1)break;}return n===1?{c,k:hit,fz:true}:{c,k:null};});
 const known=fixed.filter(f=>f.k),plates=[...new Set(fixed.map(f=>f.k||f.c))];let tractor='',trailer='';
 for(const a of known){for(const {r,i} of parts.get(a.k)){if(i!==0)continue;const p=splitPlate(r.plate).map(norm);const b=known.find(x=>x!==a&&x.k===p[1]);if(b){tractor=a.k;trailer=b.k;fuzzy=!!(a.fz||b.fz);break;}}if(tractor)break;}
 /* kayıtta çift yoksa: çekici/dorse ayrımı önce plaka kayıtlarından, sonra ruhsattaki cins yazısından yapılır.
    Dorse çekiciyle aynı ülke biçiminde olmalı; uyan yoksa yanlış tahmin yerine boş bırakılır. */
 if(!tractor){const regTr=p=>!!parts.get(p)?.some(x=>x.i===0),role=p=>parts.has(p)?(regTr(p)?'tractor':'trailer'):kinds[p]||'';
  tractor=plates.find(regTr)||plates.find(p=>role(p)==='tractor')||plates.find(p=>role(p)!=='trailer')||'';const cc=plateCountry(tractor);
  const rest=plates.filter(p=>p!==tractor&&(!tractor||plateCountry(p)===cc));trailer=rest.find(p=>role(p)==='trailer')||rest.find(p=>role(p)!=='tractor')||'';
  fuzzy=fixed.some(f=>f.fz&&(f.k===tractor||f.k===trailer));}
 return {tractor,trailer,fuzzy,...ruhsatLookup(tractor,trailer)};}
const ruhsatPlateText=it=>it.reg?it.reg.plate:[fmtCompactPlate(it.tractor),fmtCompactPlate(it.trailer)].filter(Boolean).join(' - ');
const ruhsatSmall=it=>!!it.size&&Math.max(...it.size)<1100;
const ruhsatDate=it=>it.wa?waDate(it.wa):defaultDate();
function ruhsatInfo(it){if(it.status==='sirada'||it.status==='okunuyor'||it.status==='uzakta')return '';const done=it.status==='eklendi';let h='';
 if(it.reg)h+=`<div class="rs-match ok">${icon('check')}<span>Kayıtlı araç: <b>${esc(it.reg.customer||'Müşterisiz')}</b>${it.reg.carrier?' · '+esc(it.reg.carrier):''}${it.reg.registration?' · '+esc(kgText(it.reg.registration)):''}</span></div>`;
 else if(it.tractorReg)h+=`<div class="rs-match warn">${icon('info')}<span>Çekici kayıtlı (<b>${esc(it.tractorReg.customer)}</b>) ama bu dorseyle kaydı yok. Formda kontrol edin.</span></div>`;
 else if(it.tractor)h+=`<div class="rs-match new">${icon('info')}<span>Yeni araç: plaka kayıtlarında yok. Müşteriyi formda seçin.</span></div>`;
 else h+=`<div class="rs-match bad">${icon('info')}<span>Plaka okunamadı. Plakayı elle yazın ya da daha net, düz çekilmiş bir fotoğraf deneyin.</span></div>`;
 if(it.fuzzy)h+=`<div class="rs-note warn">Plaka fotoğrafta tam okunamadı; en yakın kayıtlı plaka seçildi. Lütfen kontrol edin.</div>`;
 if(it.status!=='hata')h+=`<div class="rs-note">${it.weights.length?`Okunan boş ağırlık: ${it.weights.map(v=>v+' kg').join(' + ')}${it.sum?` = <b>${it.sum} kg</b>`:''}`:'Boş ağırlık fotoğraftan okunamadı.'}</div>`;
 if(it.status==='tamam'&&!it.sum&&ruhsatSmall(it))h+=`<div class="rs-note warn">Fotoğraf çok küçük (${it.size[0]}×${it.size[1]} piksel), rakamlar net okunamıyor. WhatsApp'ta fotoğrafı tam ekran açıp öyle kopyalayın; gönderen kişiden fotoğrafı kırpmadan, yakından çekmesini isteyin.</div>`;
 if(it.wa&&!done&&!it.reg&&!it.tractorReg&&waCustomer(it.wa))h+=`<div class="rs-note">Gönderen numara <b>${esc(waCustomer(it.wa))}</b> müşterisine kayıtlı; formda müşteri olarak gelir.</div>`;
 const d=ruhsatDate(it),plate=ruhsatPlateText(it);if(!done&&plate&&state.visits.some(x=>x.date===d&&norm(x.plate)===norm(plate)))h+=`<div class="rs-note warn">Bu araç ${esc(fmt(d))} gününde zaten panoda.</div>`;
 if(!done)h+=`<div class="rs-acts">${it.reg&&it.reg.customer?`<button type="button" class="btn primary small" data-action="ruhsat-add" data-id="${it.id}">${icon('plus')}Hemen ekle</button>`:''}<button type="button" class="btn small" data-action="ruhsat-form" data-id="${it.id}">${icon('doc')}Formda aç</button>${it.wa?`<button type="button" class="btn text small" data-action="ruhsat-dismiss" data-id="${it.id}" title="Bu fotoğrafı eklemeden listeden kaldırır (ör. aynı ruhsat iki kez gönderildiyse)">${icon('close')}Listeden çıkar</button>`:''}</div>`;
 return h;}
function ruhsatStatusText(it){return it.status==='uzakta'?'Başka bir ekranda okunuyor':it.status==='sirada'?'Sırada':it.status==='okunuyor'?`${it.phase||'Okunuyor'}${it.progress?` · %${it.progress}`:''}`:it.status==='hata'?`Okunamadı: ${it.error}`:it.status==='eklendi'?(it.dup?'✓ Bu gün zaten panodaydı, tekrar eklenmedi':`✓ Panoya eklendi${it.wa?' · '+fmt(waDate(it.wa),{weekday:'long',day:'numeric',month:'long'}):''}`):'Okundu';}
function ruhsatCard(it){const ready=it.status==='tamam'||it.status==='hata';
 return `<article class="rs-item${it.status==='eklendi'?' is-done':''}${it.wa?' is-wa':''}" id="${it.id}">${it.url?`<img class="rs-thumb" src="${it.url}" alt="Ruhsat fotoğrafı"${it.rot?` style="transform:rotate(${it.rot}deg)"`:''}>`:`<div class="rs-thumb rs-thumb-empty">${icon('wa')}</div>`}<div class="rs-main">${it.wa?waSource(it.wa):''}<div class="rs-status ${it.status}">${esc(ruhsatStatusText(it))}</div>${ready?`<div class="rs-fields"><label>Çekici<input data-rs="${it.id}" data-k="tractor" value="${esc(fmtCompactPlate(it.tractor))}" maxlength="15" autocomplete="off" spellcheck="false"></label><label>Dorse<input data-rs="${it.id}" data-k="trailer" value="${esc(fmtCompactPlate(it.trailer))}" maxlength="15" autocomplete="off" spellcheck="false"></label></div>`:''}<div class="rs-info">${ruhsatInfo(it)}</div></div></article>`;}
function ruhsatListHTML(){const own=ruhsat.items.filter(x=>!x.wa);return own.length?`<p class="rs-day">Araçlar <b>${esc(fmt(defaultDate(),{weekday:'long',day:'numeric',month:'long'}))}</b> gününe eklenir.</p>${own.map(ruhsatCard).join('')}`:'';}
/* WhatsApp'tan gelenler pencerenin en üstünde durur; kontrol bekleyen varsa ilk o görülsün. */
function waListHTML(){const wa=ruhsat.items.filter(x=>x.wa);return wa.length?`<p class="rs-day rs-wa-head">${icon('wa')}<b>WhatsApp'tan gelenler</b> · kayıtlı araçlar panoya kendiliğinden eklenir, diğerleri burada kontrol bekler.</p>${wa.map(ruhsatCard).join('')}`:'';}
function openRuhsat(){ruhsat.returnId=null;openModal(`${modalHeader('Ruhsattan araç ekle','Fotoğraf bu bilgisayarda okunur, hiçbir yere gönderilmez. Kayıtlı plakalar otomatik tanınır.')}<div class="modal-body" id="ruhsat-box"><div id="ruhsat-wa">${waListHTML()}</div><div class="rs-drop">${icon('upload')}<b>Ruhsat fotoğrafını ekleyin</b><div id="ruhsat-paste" class="rs-paste" contenteditable="true" inputmode="none" role="textbox" aria-label="Ruhsat fotoğrafını buraya yapıştırın" data-ph="Buraya tıklayıp Ctrl+V yapın ya da sağ tık → Yapıştır" autofocus></div><div class="rs-drop-acts"><button type="button" class="btn small" data-action="ruhsat-clip">${icon('copy')}Panodan yapıştır</button><label class="btn small" for="ruhsat-file">${icon('upload')}Fotoğraf seç</label></div><span>WhatsApp'ta fotoğrafı açıp sağ tıklayın → <b>Resmi kopyala</b> (masaüstü uygulamasında <b>Kopyala</b>), sonra buraya yapıştırın. Sürükleyip bırakmak da olur. Telefonda <b>Fotoğraf seç</b> ile galeriden seçin. Her fotoğraf bir araç (çekici + dorse) sayılır.</span></div><input type="file" id="ruhsat-file" accept="image/*" multiple hidden><div id="ruhsat-list">${ruhsatListHTML()}</div></div><div class="modal-footer">${button('ruhsat-clear','Bitenleri temizle','close','text')}${button('close-modal','Kapat')}</div>`);onlineUI();}
function ruhsatRefresh(){const l=document.getElementById('ruhsat-list');if(l)l.innerHTML=ruhsatListHTML();const w=document.getElementById('ruhsat-wa');if(w)w.innerHTML=waListHTML();onlineUI();}
function ruhsatUpdateCard(it){const el=document.getElementById(it.id);if(!el)return;el.outerHTML=ruhsatCard(it);onlineUI();}
function ruhsatAllowed(){return !VIEW_TOKEN&&canEdit();}
/* Resim dosyası: türü image/* olan ya da (WhatsApp masaüstü gibi dosya olarak kopyalayan uygulamalarda türü boş gelen) uzantısı resim olan dosya */
const isImageFile=f=>!!f&&(/^image\//.test(f.type)||/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name||''));
const ruhsatFiles=list=>[...(list||[])].filter(isImageFile);
function transferImages(dt){if(!dt)return [];const out=[];for(const it of [...(dt.items||[])])if(it.kind==='file'){const f=it.getAsFile();if(isImageFile(f))out.push(f);}return out.length?out:ruhsatFiles(dt.files);}
async function ruhsatFromClipboard(){if(!navigator.clipboard?.read){toast('Bu tarayıcı panoya erişime izin vermiyor. Ctrl+V ile yapıştırın ya da fotoğrafı seçin.',true);return;}
 try{const files=[];for(const item of await navigator.clipboard.read()){const t=item.types.find(x=>x.startsWith('image/'));if(t)files.push(new File([await item.getType(t)],'pano.'+(t.split('/')[1]||'png'),{type:t}));}
  if(files.length)ruhsatAdd(files);else toast('Panoda resim yok. WhatsApp\'ta fotoğrafı açıp sağ tıklayın → "Resmi kopyala", sonra tekrar deneyin.',true);}
 catch(_){toast('Panoya erişilemedi (tarayıcı izin vermedi). Ctrl+V ile yapıştırın ya da fotoğrafı kaydedip "Fotoğraf seç" ile ekleyin.',true);}}
function ruhsatAdd(files){if(!ruhsatAllowed()||!files.length)return;const m=document.getElementById('modal');
 if(!document.getElementById('ruhsat-box')){if(m.open){toast('Önce açık pencereyi kapatın, sonra fotoğrafı yapıştırın.',true);return;}openRuhsat();}
 for(const f of files.slice(0,10)){if(f.size>20*1024*1024){toast('Fotoğraf çok büyük (en fazla 20 MB).',true);continue;}
  ruhsat.items.push({id:'rs'+(++ruhsat.seq),file:f,url:URL.createObjectURL(f),status:'sirada',progress:0,phase:'',weights:[],sum:null,tractor:'',trailer:'',reg:null,tractorReg:null,fuzzy:false,error:''});}
 ruhsatRefresh();ruhsatRun();}
async function ruhsatRun(){if(ruhsat.running)return;ruhsat.running=true;try{let it;while((it=ruhsat.items.find(x=>x.status==='sirada'&&(!x.wa||ruhsatAllowed()))))await (it.wa?waProcess(it):ruhsatProcess(it));}finally{ruhsat.running=false;}}
async function ruhsatProcess(it){it.status='okunuyor';it.phase=ocrWorkerP?'Okunuyor':'Okuma programı hazırlanıyor (ilk kullanımda ~6 MB iner)';ruhsatUpdateCard(it);
 const texts=[];let last=0,done=0,total=2;
 const status=()=>{const el=document.querySelector(`#${it.id} .rs-status`);if(el)el.textContent=ruhsatStatusText(it);};
 ocrOnProgress=m=>{const p=m.status==='recognizing text'?Math.round((done+m.progress)/total*100):Math.round(m.progress*100);if(Date.now()-last<250&&p<100)return;last=Date.now();it.progress=p;status();};
 try{const w=await ocrWorker();it.phase='Okunuyor';
  const pass=async rot=>{const cv=await ruhsatEnhance(it.file,rot),d=(await w.recognize(cv)).data;done++;return {rot,cv,text:d.text,conf:+d.confidence||0};};
  /* Yan ya da ters çekilmiş fotoğraf: düz okunduğunda plaka çıkmıyorsa ya da okuma güveni düşükse fotoğraf
     döndürülerek yeniden okunur, en güvenli okunan yön kullanılır (doğru yönde güven belirgin biçimde yükselir). */
  let best=await pass(0);
  if(!(ruhsatPlates(best.text).length&&best.conf>=40)){total=5;it.phase='Fotoğraf yan çekilmiş olabilir, döndürülüp okunuyor';status();
   for(const rot of [270,90,180]){const r=await pass(rot);if(r.conf>best.conf)best=r;if(r.conf>=50&&ruhsatPlates(r.text).length)break;}
   total=done+1;it.phase='Okunuyor';}
  it.rot=best.rot;it.size=[Math.round(best.cv.srcW),Math.round(best.cv.srcH)];
  texts.push(best.text);
  texts.push((await w.recognize(await ruhsatRotated(it.file,best.rot))).data.text);
  const [a,b]=texts,ca=ruhsatPlates(a),cands=[...ca,...ruhsatPlates(b).filter(x=>!ca.includes(x))];
  const wa=ruhsatWeights(a),wb=ruhsatWeights(b);let ws=wa.length===2?wa:wb.length===2?wb:[...new Set([...wa,...wb])];if(ws.length>2)ws=[];
  Object.assign(it,{weights:ws,sum:ws.length===2?ws[0]+ws[1]:null},ruhsatResolve(cands,ruhsatKinds(b,ruhsatKinds(a,{}))));it.status='tamam';}
 catch(e){it.status='hata';it.error=e?.message||String(e);}
 finally{ocrOnProgress=null;}
 ruhsatUpdateCard(it);}
async function ruhsatQuickAdd(it){const r=it.reg;if(!r||!r.customer||!canEdit())return;const d=ruhsatDate(it);
 if(state.visits.some(x=>x.date===d&&norm(x.plate)===norm(r.plate))&&!window.confirm(`${r.plate} için ${fmt(d)} gününde zaten bir geliş var. Yine de eklensin mi?`))return;
 const v={id:uid(),plate:r.plate,customer:r.customer||'',declaration:r.declaration||'',carrier:r.carrier||'',registration:kgText(r.registration||(it.sum?String(it.sum):'')),date:d,time:timeNow(),note:'',onsite:false,t1:false,done:false,createdAt:new Date().toISOString()};
 if(await mutate(s=>{s.visits.push(v);})){justChangedMap.set(v.id,Date.now());ui.selected=v.id;it.status='eklendi';if(it.wa)await waMark(it,'eklendi',{plate:v.plate,visit_id:v.id});render();ruhsatUpdateCard(it);toast(`${v.plate} · ${v.customer}, ${fmt(d)} gününe eklendi.`);}}
function ruhsatForm(it){ruhsat.returnId=it.id;pendingVisit=null;const tr=it.tractorReg;
 openVisitForm(null,ruhsatDate(it),{plate:ruhsatPlateText(it),registration:it.sum?String(it.sum):'',customer:tr?.customer||(it.wa?waCustomer(it.wa):'')||'',carrier:tr?.carrier||''});}
function ruhsatAfterSave(){const id=ruhsat.returnId;if(!id)return;ruhsat.returnId=null;const it=ruhsat.items.find(x=>x.id===id);if(it){it.status='eklendi';if(it.wa)waMark(it,'eklendi',{plate:ruhsatPlateText(it)});}
 if(ruhsat.items.some(x=>x.status!=='eklendi'))setTimeout(()=>{if(!document.getElementById('modal').open)openRuhsat();},300);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action^="ruhsat-"]');if(!b||b.disabled)return;const a=b.dataset.action;
 if(a==='ruhsat-open')return openRuhsat();
 if(a==='ruhsat-clip')return ruhsatFromClipboard();
 if(a==='ruhsat-clear'){ruhsat.items=ruhsat.items.filter(x=>{const keep=x.status!=='eklendi'&&(x.wa||x.status!=='hata');if(!keep&&x.url)URL.revokeObjectURL(x.url);return keep;});return ruhsatRefresh();}
 const it=ruhsat.items.find(x=>x.id===b.dataset.id);if(!it)return;if(a==='ruhsat-add')ruhsatQuickAdd(it);if(a==='ruhsat-form')ruhsatForm(it);if(a==='ruhsat-dismiss')waDismiss(it);});
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset?.rs)return;const it=ruhsat.items.find(x=>x.id===t.dataset.rs);if(!it)return;
 it[t.dataset.k]=compactPlate(t.value);it.fuzzy=false;Object.assign(it,ruhsatLookup(it.tractor,it.trailer));const box=document.querySelector(`#${it.id} .rs-info`);if(box)box.innerHTML=ruhsatInfo(it);onlineUI();});
document.addEventListener('change',e=>{if(e.target.id!=='ruhsat-file')return;const f=ruhsatFiles(e.target.files);e.target.value='';ruhsatAdd(f);});
document.addEventListener('paste',e=>{if(!ruhsatAllowed())return;const f=transferImages(e.clipboardData);
 if(!f.length){if(e.target.closest?.('#ruhsat-paste')){e.preventDefault();toast('Yapıştırılan şey resim değil. WhatsApp\'ta fotoğrafı açıp sağ tıklayın → "Resmi kopyala" (masaüstü uygulamasında "Kopyala"). Olmazsa fotoğrafı kaydedip "Fotoğraf seç" ile ekleyin.',true);}return;}
 e.preventDefault();ruhsatAdd(f);});
/* yapıştırma kutusu yalnızca yapıştırmayı karşılar; yazı yazılmaz */
document.addEventListener('beforeinput',e=>{if(e.target.id==='ruhsat-paste')e.preventDefault();});
document.addEventListener('dragover',e=>{if(dragId||!ruhsatAllowed()||![...(e.dataTransfer?.types||[])].includes('Files'))return;e.preventDefault();e.dataTransfer.dropEffect='copy';document.documentElement.classList.add('rs-dragging');});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.documentElement.classList.remove('rs-dragging');});
document.addEventListener('drop',e=>{document.documentElement.classList.remove('rs-dragging');if(dragId||!ruhsatAllowed())return;const f=transferImages(e.dataTransfer);if(!f.length)return;e.preventDefault();ruhsatAdd(f);});

/* WhatsApp'tan otomatik aktarma (kurulum: supabase/WHATSAPP.md).
   Sunucu fonksiyonu WhatsApp numarasına gelen fotoğrafı "ruhsat-gelen" deposuna koyar ve incoming_ruhsat
   tablosuna "yeni" satırı ekler. Panonun açık olduğu bir düzenleyici ekranı satırı üstlenir (iki ekran aynı
   fotoğrafı okumasın diye), fotoğrafı bu bilgisayarda okur ve:
     - plaka kayıtlarında çekici + dorse çifti müşterisiyle varsa ve plaka kesin okunduysa aracı panoya ekler
       (gün: fotoğrafın geldiği gün; Pazar gelirse Pazartesi),
     - aynı gün zaten panodaysa "mevcut" der, tekrar eklemez,
     - diğerlerini "bekliyor" yapar; tüm düzenleyicilerin "Ruhsattan ekle" penceresinde kontrole düşer.
   Tablo kurulmamışsa (whatsapp-kurulumu.sql çalıştırılmadıysa) sessizce devre dışı kalır. */
const WA_TABLE='incoming_ruhsat',WA_BUCKET='ruhsat-gelen',WA_STALE_MS=180000,WA_POLL_MS=30000;
const wa={ready:null,loading:false,loadedAt:0,channel:null,timer:null,thumbs:false};
const waDate=row=>{const d=localToday(row.created_at||Date.now());return weekday(d)===0?addDays(d,1):d;};
const tsTime=iso=>{const d=new Date(iso);return isNaN(d)?timeNow():new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);};
function waCustomer(row){const n=String(row?.from_number||'').replace(/\D/g,'').slice(-10);if(n.length<10)return '';
 for(const [name,v] of Object.entries(customerContacts))if(String(v||'').replace(/\D/g,'').slice(-10)===n)return name;return '';}
function waSource(row){const who=[row.sender_name,row.from_number?'+'+row.from_number:''].filter(Boolean).join(' · ');
 return `<div class="rs-src">${icon('wa')}<span>WhatsApp${who?' · '+esc(who):''} · ${esc(tsText(row.created_at))}${row.caption?` · <i>“${esc(row.caption)}”</i>`:''}</span></div>`;}
const waPending=()=>ruhsat.items.filter(x=>x.wa&&(x.status==='tamam'||x.status==='hata')).length;
function waBadge(){const n=role==='editor'&&!VIEW_TOKEN?waPending():0;
 for(const b of document.querySelectorAll('[data-action="ruhsat-open"]')){let s=b.querySelector('.rs-badge');if(!n){s?.remove();continue;}
  if(!s){s=document.createElement('b');s.className='rs-badge';b.appendChild(s);}s.textContent=n;s.title=`WhatsApp'tan gelen ${n} ruhsat kontrol bekliyor`;}}
function waTick(){if(Date.now()-wa.loadedAt>=WA_POLL_MS)waLoad();}
async function waLoad(){if(VIEW_TOKEN||!account||role!=='editor'||wa.ready===false||wa.loading)return;wa.loading=true;wa.loadedAt=Date.now();
 try{const {data,error}=await client.from(WA_TABLE).select('*').in('status',['yeni','okunuyor','bekliyor']).order('created_at').limit(200);
  if(error){if(/PGRST205|42P01/.test(error.code||'')||/does not exist|schema cache/i.test(error.message||''))wa.ready=false;return;}
  if(!wa.ready){wa.ready=true;waStart();}waSync(data||[]);}
 catch(_){}finally{wa.loading=false;}}
/* WhatsApp tablosu için ayrı anlık bildirim kanalı: tablo yoksa ana kanal bozulmasın diye yalnızca tablo varken açılır. */
function waStart(){if(wa.channel||typeof client.channel!=='function')return;
 try{wa.channel=client.channel('pcs-whatsapp').on('postgres_changes',{event:'*',schema:'public',table:WA_TABLE},()=>{clearTimeout(wa.timer);wa.timer=setTimeout(waLoad,400);});wa.channel.subscribe();}catch(_){wa.channel=null;}}
/* çıkışta: kanal kapanır, liste temizlenir (aynı sayfada başka kullanıcı girerse öncekinin listesi görünmesin) */
function waStop(){clearTimeout(wa.timer);if(wa.channel){try{client.removeChannel(wa.channel);}catch(_){}wa.channel=null;}
 Object.assign(wa,{ready:null,loadedAt:0});for(const x of ruhsat.items)if(x.wa&&x.url)URL.revokeObjectURL(x.url);ruhsat.items=ruhsat.items.filter(x=>!x.wa);}
function waFill(it,row){const w=(row.weights||[]).map(Number).filter(Boolean);
 Object.assign(it,{tractor:row.tractor||'',trailer:row.trailer||'',weights:w,sum:w.length===2?w[0]+w[1]:null,fuzzy:!!row.fuzzy,error:row.note||'',status:row.note&&!row.tractor?'hata':'tamam'},ruhsatLookup(compactPlate(row.tractor),compactPlate(row.trailer)));}
/* Veritabanındaki açık satırları pencere listesiyle eşitler. Başka ekranda eklenen / çıkarılan satır listeden düşer. */
function waSync(rows){const ids=new Set(),before=waPending();let changed=false;
 for(const row of rows){const id='wa-'+row.id;ids.add(id);let it=ruhsat.items.find(x=>x.id===id);
  const free=row.status==='yeni'||(row.status==='okunuyor'&&Date.parse(row.claimed_at||0)<Date.now()-WA_STALE_MS);
  if(!it){it={id,wa:row,file:null,url:'',status:free?'sirada':'uzakta',progress:0,phase:'',weights:[],sum:null,tractor:'',trailer:'',reg:null,tractorReg:null,fuzzy:false,error:''};
   if(row.status==='bekliyor')waFill(it,row);ruhsat.items.push(it);changed=true;continue;}
  it.wa=row;if(it.status==='okunuyor'||it.status==='eklendi')continue;
  if(row.status==='bekliyor'&&(it.status==='sirada'||it.status==='uzakta')){waFill(it,row);changed=true;}
  else if(row.status!=='bekliyor'){const want=free?'sirada':'uzakta';if(it.status!==want){it.status=want;changed=true;}}}
 const kept=ruhsat.items.filter(x=>!x.wa||ids.has(x.id)||x.status==='eklendi'||x.status==='okunuyor');
 if(kept.length!==ruhsat.items.length){for(const x of ruhsat.items)if(!kept.includes(x)&&x.url)URL.revokeObjectURL(x.url);ruhsat.items=kept;changed=true;}
 if(changed)ruhsatRefresh();waBadge();
 const after=waPending();if(after>before&&!document.getElementById('ruhsat-box'))toast(`WhatsApp'tan gelen ${after} ruhsat kontrol bekliyor. "Ruhsattan ekle"ye bakın.`);
 waThumbs();ruhsatRun();}
/* Başka ekranda okunmuş fotoğrafların küçük resmini indir (sırayla). */
async function waThumbs(){if(wa.thumbs)return;wa.thumbs=true;
 try{let it;while((it=ruhsat.items.find(x=>x.wa&&!x.url&&!x.noThumb&&x.wa.media_path&&x.status!=='sirada'))){
  try{const {data,error}=await client.storage.from(WA_BUCKET).download(it.wa.media_path);if(error||!data)throw error;it.file=it.file||new File([data],'ruhsat',{type:data.type||it.wa.mime||'image/jpeg'});it.url=URL.createObjectURL(data);ruhsatUpdateCard(it);}
  catch(_){it.noThumb=true;}}}
 finally{wa.thumbs=false;}}
async function waMark(it,status,extra={}){const patch={status,...extra};
 if(status==='eklendi'||status==='mevcut'||status==='yoksayildi')Object.assign(patch,{handled_by:account?.id||null,handled_at:new Date().toISOString()});
 try{const {error}=await client.from(WA_TABLE).update(patch).eq('id',it.wa.id).select('id');if(error)throw error;Object.assign(it.wa,patch);waBadge();return true;}
 catch(e){toast('WhatsApp kaydı güncellenemedi: '+friendly(e),true);return false;}}
async function waDismiss(it){if(!canEdit())return;if(await waMark(it,'yoksayildi')){ruhsat.items=ruhsat.items.filter(x=>x!==it);if(it.url)URL.revokeObjectURL(it.url);ruhsatRefresh();waBadge();}}
async function waProcess(it){const row=it.wa;it.status='okunuyor';it.phase='WhatsApp fotoğrafı alınıyor';ruhsatUpdateCard(it);
 const stale=new Date(Date.now()-WA_STALE_MS).toISOString();
 const {data,error}=await client.from(WA_TABLE).update({status:'okunuyor',claimed_at:new Date().toISOString(),claimed_by:account?.id||null}).eq('id',row.id).or(`status.eq.yeni,and(status.eq.okunuyor,claimed_at.lt."${stale}")`).select('*').then(r=>r,e=>({error:e}));
 if(error||!data?.length){it.status='uzakta';ruhsatUpdateCard(it);return;} /* başka ekran üstlendi */
 Object.assign(row,data[0]);
 try{if(!row.media_path)throw new Error('fotoğraf artık depoda yok');const {data:blob,error:dErr}=await client.storage.from(WA_BUCKET).download(row.media_path);if(dErr||!blob)throw dErr||new Error('boş dosya');
  it.file=new File([blob],row.media_path.split('/').pop(),{type:blob.type||row.mime||'image/jpeg'});if(!it.url)it.url=URL.createObjectURL(blob);}
 catch(e){it.status='hata';it.error='Fotoğraf indirilemedi ('+(e?.message||e)+')';ruhsatUpdateCard(it);await waMark(it,'bekliyor',{note:it.error});return;}
 await ruhsatProcess(it);await waDecide(it);ruhsatUpdateCard(it);waBadge();}
/* Okuma bitince: kesin eşleşen kayıtlı aracı ekle, değilse kontrole bırak. */
async function waDecide(it){const r=it.reg,d=waDate(it.wa);
 if(it.status==='tamam'&&r&&r.customer&&!it.fuzzy){
  if(state.visits.some(x=>x.date===d&&norm(x.plate)===norm(r.plate))){it.status='eklendi';it.dup=true;await waMark(it,'mevcut',{plate:r.plate,tractor:it.tractor,trailer:it.trailer,weights:it.weights});toast(`WhatsApp: ${r.plate} ${fmt(d)} gününde zaten panoda, tekrar eklenmedi.`);return;}
  for(let i=0;i<30&&!canEdit();i++)await new Promise(ok=>setTimeout(ok,1000)); /* başka bir kayıt sürüyorsa bitmesini bekle */
  const v={id:uid(),plate:r.plate,customer:r.customer||'',declaration:r.declaration||'',carrier:r.carrier||'',registration:kgText(r.registration||(it.sum?String(it.sum):'')),date:d,time:tsTime(it.wa.created_at),note:'',onsite:false,t1:false,done:false,createdAt:new Date().toISOString()};
  if(canEdit()&&await mutate(s=>{s.visits.push(v);})){justChangedMap.set(v.id,Date.now());it.status='eklendi';await waMark(it,'eklendi',{plate:v.plate,visit_id:v.id,tractor:it.tractor,trailer:it.trailer,weights:it.weights});render();toast(`WhatsApp: ${v.plate} · ${v.customer}, ${fmt(d)} gününe eklendi.`);return;}}
 if(await waMark(it,'bekliyor',{tractor:it.tractor,trailer:it.trailer,weights:it.weights,fuzzy:!!it.fuzzy,note:it.status==='hata'?String(it.error||'').slice(0,300):''})&&!document.getElementById('ruhsat-box'))
  toast(`WhatsApp'tan gelen ${waPending()} ruhsat kontrol bekliyor. "Ruhsattan ekle"ye bakın.`);}
setInterval(()=>{if(!document.hidden)waTick();},WA_POLL_MS);

/* çevrimdışı açılış için uygulama dosyalarını önbelleğe alan service worker */
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(()=>{}));
window.addEventListener('offline',()=>{if(!account)return;storageError='İnternet bağlantısı yok. Son alınan kayıtlar gösteriliyor; bağlantı gelince otomatik güncellenir.';render();});

if(VIEW_TOKEN){account={id:'public-view',email:''};role='viewer';syncData();}else authScreen();
})();

