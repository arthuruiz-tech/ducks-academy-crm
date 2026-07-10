
async function forceFreshAssetsOnce(){
  const key = 'ducks_cache_fix_v2_25_done';
  if(localStorage.getItem(key)==='yes') return;
  try{
    if('caches' in window){
      const keys = await caches.keys();
      await Promise.all(keys.filter(k=>k.startsWith('ducks-academy')).map(k=>caches.delete(k)));
    }
    localStorage.setItem(key,'yes');
  }catch(e){
    localStorage.setItem(key,'yes');
  }
}
forceFreshAssetsOnce();

// Ducks CRM profesional v2.38 - fix columnas tutor y schema cache
const app = document.getElementById('app');
let sb = null;
let session = null;
let parentToken = localStorage.getItem('ducks_parent_token_v213') || '';
let parentProfile = null;
let mode = 'public';
let page = 'dashboard';
let players = [];
let payments = [];
let parentAccounts = [];
let parentLinks = [];
let parentPlayers = [];
let parentPayments = [];
let parentDocuments = [];
let documents = [];
let playerHistory = [];
let q = '';

const BANK_ACCOUNT = '157 889 8256';
const BANK_CLABE = '012 180 01578898256 3';
const BANK_NAME = 'BBVA';
const BANK_BENEFICIARY = 'DUCKS BASKETBALL';
const PAYMENT_CODI_NOTE = 'Transferencia BBVA predeterminada. El administrador confirmará el comprobante.';

const ACADEMY_WHATSAPP = window.DUCKS_ACADEMY_WHATSAPP || '+5214495498220';
const ACADEMY_WHATSAPP_DIGITS = String(ACADEMY_WHATSAPP).replace(/\D/g,'');
const ACADEMY_ADDRESS = 'Parque Boulevares 1: Jesús Sotelo Inclán, Bulevares 1ra Secc, 20288 Aguascalientes, Ags.';

const DOCUMENT_TYPES = ['Acta de nacimiento','CURP','Fotografía','Certificado médico','Identificación tutor','Comprobante de pago','Otro'];



function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),4000); }
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function money(n){return Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});}
function todayISO(){return new Date().toISOString().slice(0,10);}
function period(date){return String(date||'').slice(0,7);}
function statusClass(s){return String(s||'').replace(/\s+/g,'');}
function thumb(url){return url?`<div class="thumb"><img src="${url}"></div>`:`<div class="thumb"><div class="emptythumb">Sin foto</div></div>`;}
function playerPhotoUrl(p){ return p?.photo_url || 'assets/logo.png'; }
function isConfigured(){ return window.DUCKS_SUPABASE_URL && window.DUCKS_SUPABASE_ANON_KEY; }
function normalizePhone(v){ const d=String(v||'').replace(/\D/g,''); if(!d)return ''; if(d.startsWith('52')&&d.length===12)return '+'+d; if(d.length===10)return '+52'+d; if(d.length>=11&&d.length<=15)return '+'+d; return String(v||'').trim(); }

function onlyDigits(v){ return String(v||'').replace(/\D/g,''); }
function cleanName(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
function playerTutorPhones(p){ return [p.phone, p.tutor_phone_2].map(onlyDigits).filter(Boolean); }
function playerTutorNames(p){ return [p.tutor, p.tutor_2].map(cleanName).filter(Boolean); }
function accountMatchesPlayer(acc, p){
  const accPhone = onlyDigits(acc.phone || acc.login);
  const accName = cleanName(acc.display_name || acc.login);
  const phoneMatch = accPhone && playerTutorPhones(p).some(ph => ph.endsWith(accPhone) || accPhone.endsWith(ph));
  const nameMatch = accName && playerTutorNames(p).some(n => n === accName || n.includes(accName) || accName.includes(n));
  return phoneMatch || nameMatch;
}
async function autoLinkPlayersToAccount(account){
  const matches = players.filter(p => accountMatchesPlayer(account, p));
  let linked = 0;
  for(const p of matches){
    const exists = parentLinks.some(l => l.parent_account_id === account.id && l.player_id === p.id);
    if(exists) continue;
    const {error} = await sb.from('parent_player_links_v213').insert({parent_account_id:account.id, player_id:p.id, active:true});
    if(!error) linked++;
  }
  return {matches: matches.length, linked};
}


const PLAYER_EDIT_FIELDS = [
  'id','name','tutor','phone','tutor_2','tutor_phone_2','category','status',
  'monthly_fee','payment_day','uniform_number','photo_url','notes'
];
function compactPlayerSnapshot(p){
  const o = {};
  PLAYER_EDIT_FIELDS.forEach(k => o[k] = p?.[k] ?? '');
  return o;
}
function playerDiffBeforeAfter(before, after){
  const changes = [];
  PLAYER_EDIT_FIELDS.forEach(k=>{
    if(k === 'id') return;
    const a = String(before?.[k] ?? '');
    const b = String(after?.[k] ?? '');
    if(a !== b) changes.push({field:k, old_value:a, new_value:b});
  });
  return changes;
}
async function savePlayerHistory(playerId, before, after, action='update'){
  try{
    const changes = playerDiffBeforeAfter(before, after);
    if(action === 'update' && !changes.length) return;
    const userEmail = session?.user?.email || 'Admin';
    const row = {
      player_id: playerId,
      action,
      changed_by: userEmail,
      before_data: before || {},
      after_data: after || {},
      changes
    };
    await sb.from('player_change_history_v237').insert(row);
  }catch(err){
    console.warn('No se pudo guardar historial de jugador:', err);
  }
}
function fieldLabel(k){
  const map = {
    name:'Nombre', tutor:'Tutor principal', phone:'WhatsApp principal',
    tutor_2:'Tutor secundario', tutor_phone_2:'WhatsApp secundario',
    category:'Categoría', status:'Estado', monthly_fee:'Mensualidad',
    payment_day:'Día de pago', uniform_number:'Número uniforme',
    photo_url:'Foto', notes:'Notas'
  };
  return map[k] || k;
}

function nextId(){ const max=players.reduce((m,p)=>Math.max(m,Number(String(p.id||'').replace(/\D/g,''))||0),0); return 'D'+String(max+1).padStart(3,'0'); }

function calc(player, payList=payments){
  const confirmed = payList.filter(p=>p.player_id===player.id && p.confirmation_status==='Confirmado').sort((a,b)=>String(b.payment_date).localeCompare(String(a.payment_date)));
  const last = confirmed[0]?.payment_date || '';
  const now = new Date();
  const lastD = last ? new Date(last+'T00:00:00') : null;
  const active = String(player.status||'').toLowerCase()==='activo';
  let months = 0;
  if(active){ months = !lastD ? 1 : Math.max(0,(now.getFullYear()-lastD.getFullYear())*12+(now.getMonth()-lastD.getMonth())); }
  const amount = active ? months * Number(player.monthly_fee||0) : 0;
  let status='Inactivo';
  if(active){
    if(months===0) status='Pagado';
    else if(months===1 && now.getDate() <= Number(player.payment_day||1)) status='Pendiente';
    else status='Vencido';
  }
  return {last,months,amount,status};
}
function reminderMessage(player){
  const c=calc(player);
  const monthsText=c.months>1 ? `, correspondiente a ${c.months} meses de adeudo` : '';
  return `Hola, buen día.

Les recordamos amablemente que está pendiente el pago de Ducks Basketball Academy por ${money(c.amount)}${monthsText}.

Para facilitar el proceso, pueden ingresar a la aplicación instalada o al Portal de Papás desde el siguiente enlace:

https://ducks-academy-crm.vercel.app

Ahí podrán consultar el adeudo, realizar el pago y subir su comprobante de forma rápida y segura.

Agradecemos mucho su apoyo para mantener el control administrativo de la academia.

🏀 Ducks Basketball Academy`;
}
function whatsappUrl(player){ const phone = String(player.phone||'').replace(/\D/g,''); return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(reminderMessage(player))}` : ''; }
function whatsappButtons(player){
  const c = calc(player);
  if(c.status !== 'Vencido' || !player.phone) return '';
  return `<button class="btn secondary" onclick="copyReminder('${player.id}')">Copiar</button><a class="btn green" target="_blank" rel="noopener" href="${whatsappUrl(player)}">WhatsApp</a>`;
}
async function copyReminder(id){ const p=players.find(x=>x.id===id); if(!p) return; await navigator.clipboard.writeText(reminderMessage(p)); toast('Mensaje de WhatsApp copiado'); }
async function copyBank(value, label){ try{ await navigator.clipboard.writeText(String(value||'').replace(/\s+/g,' ')); toast(label + ' copiada'); }catch(e){ toast('Copia manualmente: ' + value); } }

function csvEscape(value){
  const s = String(value ?? '');
  if(/[",\n\r]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}
function toCSV(rows, headers){
  const head = headers.map(h=>csvEscape(h.label)).join(',');
  const body = rows.map(row=>headers.map(h=>csvEscape(typeof h.value === 'function' ? h.value(row) : row[h.key])).join(',')).join('\n');
  return '\ufeff' + head + (body ? '\n' + body : '');
}
function downloadText(filename, text, type='text/csv;charset=utf-8;'){
  const blob = new Blob([text], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function backupDate(){
  return new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
}
function exportCSV(kind){
  const d = backupDate();
  if(kind === 'players'){
    const headers=[
      {label:'ID',key:'id'}, {label:'Nombre',key:'name'}, {label:'Tutor',key:'tutor'}, {label:'WhatsApp',key:'phone'},
      {label:'Categoria',key:'category'}, {label:'Estado',key:'status'}, {label:'Mensualidad',key:'monthly_fee'},
      {label:'Dia pago',key:'payment_day'}, {label:'Numero uniforme',key:'uniform_number'}, {label:'Foto URL',key:'photo_url'}, {label:'Notas',key:'notes'}
    ];
    downloadText(`ducks_jugadores_${d}.csv`, toCSV(players, headers));
  }
  if(kind === 'payments'){
    const headers=[
      {label:'ID pago',key:'id'}, {label:'ID jugador',key:'player_id'}, {label:'Alumno',key:'student_name'},
      {label:'Fecha pago',key:'payment_date'}, {label:'Periodo',key:'period'}, {label:'Monto',key:'amount'},
      {label:'Metodo',key:'method'}, {label:'Enviado por',key:'submitted_by'}, {label:'Estatus',key:'confirmation_status'},
      {label:'Confirmado en',key:'confirmed_at'}, {label:'Evidencia URL',key:'evidence_url'}, {label:'Evidencia nombre',key:'evidence_name'}, {label:'Notas',key:'notes'}
    ];
    downloadText(`ducks_pagos_${d}.csv`, toCSV(payments, headers));
  }
  if(kind === 'parents'){
    const headers=[
      {label:'ID cuenta',key:'id'}, {label:'Nombre',key:'display_name'}, {label:'Usuario',key:'login'},
      {label:'WhatsApp',key:'phone'}, {label:'Clave temporal',key:'access_code'}, {label:'Activo',key:'active'}, {label:'Creado',key:'created_at'}
    ];
    downloadText(`ducks_cuentas_papas_${d}.csv`, toCSV(parentAccounts, headers));
  }
  if(kind === 'links'){
    const rows = parentLinks.map(l=>{
      const a = parentAccounts.find(x=>x.id===l.parent_account_id) || {};
      const p = players.find(x=>x.id===l.player_id) || {};
      return {...l, parent_name:a.display_name||'', parent_login:a.login||'', player_name:p.name||'', player_tutor:p.tutor||''};
    });
    const headers=[
      {label:'ID relacion',key:'id'}, {label:'ID cuenta papa',key:'parent_account_id'}, {label:'Papa/Tutor',key:'parent_name'},
      {label:'Usuario papa',key:'parent_login'}, {label:'ID jugador',key:'player_id'}, {label:'Jugador',key:'player_name'},
      {label:'Tutor en jugador',key:'player_tutor'}, {label:'Activo',key:'active'}, {label:'Creado',key:'created_at'}
    ];
    downloadText(`ducks_relaciones_papa_jugador_${d}.csv`, toCSV(rows, headers));
  }
  if(kind === 'debts'){
    const rows = players.map(p=>({ ...p, ...calc(p) }));
    const headers=[
      {label:'ID jugador',key:'id'}, {label:'Jugador',key:'name'}, {label:'Tutor',key:'tutor'}, {label:'WhatsApp',key:'phone'},
      {label:'Categoria',key:'category'}, {label:'Estado jugador',key:'status'}, {label:'Ultimo pago',key:'last'},
      {label:'Meses pendientes',key:'months'}, {label:'Adeudo actual',key:'amount'}, {label:'Estado pago',key:'status'}
    ];
    downloadText(`ducks_adeudos_${d}.csv`, toCSV(rows, headers));
  }
}
function exportFullJSON(){
  const d = backupDate();
  const debts = players.map(p=>({player_id:p.id, player_name:p.name, tutor:p.tutor, phone:p.phone, category:p.category, ...calc(p)}));
  const data = {
    exported_at: new Date().toISOString(),
    academy: 'Ducks Basketball Academy',
    players,
    payments,
    parent_accounts: parentAccounts,
    parent_player_links: parentLinks,
    debts,
    notes: 'Las fotos y comprobantes se respaldan como URLs hacia Supabase Storage.'
  };
  downloadText(`ducks_respaldo_completo_${d}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;');
}


async function sha256Hex(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function makeSalt(){
  if(crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

function parentLoginCandidates(value){
  const raw = String(value||'').trim();
  const digits = raw.replace(/\D/g,'');
  const normalized = normalizePhone(raw);
  const set = new Set();
  if(raw) set.add(raw);
  if(raw) set.add(raw.toLowerCase());
  if(normalized) set.add(normalized);
  if(digits && digits.length >= 7) set.add(digits);
  if(digits.length===10) set.add('+52'+digits);
  if(digits.length===12 && digits.startsWith('52')) set.add('+'+digits);
  return Array.from(set).filter(Boolean);
}


async function init(){
  if(!isConfigured()){ renderSetup(); return; }
  sb = window.supabase.createClient(window.DUCKS_SUPABASE_URL, window.DUCKS_SUPABASE_ANON_KEY);
  const {data} = await sb.auth.getSession();
  session = data.session;
  renderPublicHome();
}


let ducksScreenStack = [];
function rememberScreen(screen){
  const last = ducksScreenStack[ducksScreenStack.length-1];
  if(last !== screen) ducksScreenStack.push(screen);
  if(ducksScreenStack.length > 20) ducksScreenStack.shift();
}
function goBackSmart(){
  const current = mode + ':' + page;
  if(ducksScreenStack.length && ducksScreenStack[ducksScreenStack.length-1] === current) ducksScreenStack.pop();
  const prev = ducksScreenStack.pop();
  if(prev){
    const [m,p] = prev.split(':');
    if(m === 'public') return renderPublicHome();
    if(m === 'parentLogin') return renderParentLogin();
    if(m === 'parentPortal') return renderParentPortal();
    if(m === 'adminLogin') return renderAdminLogin();
    if(m === 'admin'){
      mode='admin';
      page=p || 'dashboard';
      renderShell();
      loadAdminData().then(()=>renderPage());
      return;
    }
  }
  if(mode === 'parentLogin' || mode === 'adminLogin' || mode === 'parentPortal') return renderPublicHome();
  if(mode === 'admin' && page !== 'dashboard'){ page='dashboard'; renderPage(); return; }
  renderPublicHome();
}
function backButton(label='Regresar'){
  return ``;
}


function isIOSDevice(){
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
}
function canShowIOSInstallHint(){
  return isIOSDevice() && !isStandalonePWA();
}
function iosInstallBanner(){
  if(!canShowIOSInstallHint()) return '';
  return `<div class="ios-install-banner">
    <div><b>Instalar en iPhone:</b> abre este portal en <b>Safari</b>, toca <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>.</div>
    <button class="btn green small" onclick="showInstallHelp()">Ver cómo</button>
  </div>`;
}

function isStandalonePWA(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
async function installDucksApp(){
  if(isStandalonePWA()){
    toast('La app ya está instalada.');
    return;
  }
  if(window.deferredDucksInstallPrompt){
    window.deferredDucksInstallPrompt.prompt();
    const choice = await window.deferredDucksInstallPrompt.userChoice.catch(()=>null);
    window.deferredDucksInstallPrompt = null;
    if(choice?.outcome === 'accepted') toast('Instalación iniciada.');
    else showInstallHelp();
    return;
  }
  showInstallHelp();
}
function showInstallHelp(){
  const isIOS = isIOSDevice();
  const modal=document.createElement('div'); modal.className='modalbg open'; modal.id='installHelpModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>Instalar Ducks Academy</h3><button class="btn secondary" onclick="closeModal('installHelpModal')">Cerrar</button></div><div class="modal-body">
    <div class="notice success"><b>Importante:</b> en iPhone la app <b>no se instala automática</b>. Debes abrir el portal en <b>Safari</b>.</div>
    ${isIOS ? `<div class="notice">Detectamos iPhone/iPad. Si estás en Chrome o dentro de otra app, abre primero el enlace en <b>Safari</b>.</div>` : ``}
    <div class="install-steps">
      <div><b>iPhone / iPad (Safari)</b><p>1. Abre el sitio en <b>Safari</b>.<br>2. Toca <b>Compartir</b>.<br>3. Selecciona <b>Agregar a pantalla de inicio</b>.<br>4. Confirma <b>Agregar</b>.</p></div>
      <div><b>Android / Chrome</b><p>1. Abre el sitio en <b>Chrome</b>.<br>2. Toca el menú <b>⋮</b>.<br>3. Elige <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.</p></div>
      <div><b>Nombre del ícono</b><p>Aparecerá como <b>Ducks Academy</b> con el logo redondo oficial de la academia.</p></div>
      <div><b>Requisito</b><p>Debe abrirse desde el enlace publicado en <b>https</b> (Vercel). Si no ves la opción, recarga una vez y vuelve a intentarlo.</p></div>
    </div>
  </div></div>`;
  document.body.appendChild(modal);
}



function publicQuickMenu(){
  return `<header class="global-top-menu">
    <div class="global-menu-inner">
      <button class="global-brand-btn" onclick="renderPublicHome()">
        <img src="assets/logo.png" alt="Ducks"><span>Ducks Academy</span>
      </button>
      <nav class="global-links">
        <button onclick="renderPublicHome()">Inicio</button>
        <button onclick="renderParentLogin()">Portal de Papás</button>
        <button onclick="renderPublicHome();setTimeout(()=>document.getElementById('calendario')?.scrollIntoView({behavior:'smooth'}),120)">Calendario</button>
        <button onclick="renderPublicHome();setTimeout(()=>document.getElementById('academia')?.scrollIntoView({behavior:'smooth'}),120)">Academia</button>
        <button onclick="renderPublicHome();setTimeout(()=>document.getElementById('contacto')?.scrollIntoView({behavior:'smooth'}),120)">Contacto</button>
      </nav>
      <button class="admin-image-btn global-admin" title="Administrador" aria-label="Administrador" onclick="renderAdminLogin()"><img src="assets/ducks-admin-header.png" alt="Administrador"></button>
    </div>
  </header>`;
}

function adminQuickMenu(){
  return `<header class="admin-top-fixed">
    <div class="admin-top-inner">
      <button onclick="renderPublicHome()" class="admin-home-btn">🏠 Inicio público</button>
      <button onclick="page='dashboard';renderPage()">Dashboard</button>
      <button onclick="page='players';renderPage()">Jugadores</button>
      <button onclick="page='parents';renderPage()">Papás</button>
      <button onclick="page='payments';renderPage()">Pagos</button>
      <button onclick="page='documents';renderPage()">Documentos</button>
      <button onclick="page='backups';renderPage()">Respaldos</button>
    </div>
  </header>`;
}

function renderSetup(){ app.innerHTML=`${publicQuickMenu()}<div class="public-site with-global-menu"><div class="academy-main"><div class="parent-card"><h1>Configurar Supabase</h1><div class="notice warning">Falta configurar config.js.</div></div></div></div>`; }

function renderPublicHome(){
  mode='public'; rememberScreen('public:');
  app.innerHTML=`${publicQuickMenu()}<div class="public-site with-global-menu">
    <header class="academy-menu"><div class="academy-menu-inner">
      <a class="academy-brand" href="#inicio"><img src="assets/logo.png"><span>Ducks Basketball Academy</span></a>
      <nav class="academy-links">
        <a href="#inicio">Inicio</a>
        <button type="button" class="primary-menu-btn" onclick="renderParentLogin()">Portal de Papás</button><button type="button" onclick="installDucksApp()"><img class="install-app-icon" src="assets/pwa-icon-192.png" alt=""> Instalar App</button>
        <a href="#calendario">Calendario</a>
        <div class="menu-drop">
          <a href="#academia">Academia</a>
          <div class="submenu">
            <a href="#academia">Quiénes somos</a>
            <a href="#reglamento">Reglamento</a>
            <a href="#categorias">Categorías</a>
            <a href="#valores">Valores</a>
          </div>
        </div>
        <a href="#contacto">Contacto</a>
      </nav>
      <button class="admin-image-btn" title="Administrador" onclick="renderAdminLogin()"><img src="assets/ducks-admin-header.png" alt="Administrador"></button>
    </div></header>
    <main class="academy-main">
      <section id="inicio" class="academy-ribbon ribbon-hq video-hero clean-video-hero">
        <video class="hero-video" autoplay muted loop playsinline preload="metadata">
          <source src="assets/hero-video.mp4" type="video/mp4">
        </video>
        <div class="hero-video-overlay clean-overlay"></div>
        <div class="hero-text-layout">
          <div class="hero-corner top-left">
            <span>Ducks Basketball Academy</span>
          </div>
          <div class="hero-corner bottom-left">
            <h1>Formación deportiva con disciplina</h1>
          </div>
          <div class="hero-corner bottom-right">
            <p>Entrenamiento, valores y desarrollo para niños y jóvenes.</p>
          </div>
        </div>
      </section>
      <section class="quick-parent-card">
        <div><h2>Pagos y comprobantes</h2><p>El Portal de Papás es privado. Cada familia entra con usuario y contraseña para ver únicamente la información de sus hijos.</p></div>
        <div class="quick-actions"><button class="btn green" onclick="renderParentLogin()">Entrar al Portal de Papás</button><button class="btn secondary" onclick="installDucksApp()"><img class="install-app-icon" src="assets/pwa-icon-192.png" alt=""> Instalar App</button></div>
      </section>
      <section id="calendario" class="academy-section"><h2>Calendario de Juegos</h2><p>Próximamente aquí podrás consultar juegos, torneos, horarios, sedes y categorías.</p><div class="coming-soon"><span>🏀</span><b>Calendario en preparación</b><small>Consulta avisos oficiales de la academia mientras se activa este módulo.</small></div></section>
      <section id="academia" class="academy-section">
        <div class="section-headline">
          <span class="eyebrow">Academia</span>
          <h2>Formamos jugadores con disciplina, respeto y trabajo en equipo</h2>
          <p>Ducks Basketball Academy impulsa el desarrollo deportivo y humano de niños y jóvenes a través del basketball.</p>
        </div>
        <div class="academy-grid">
          <div><b>Entrenamiento</b><small>Fundamentos, técnica, coordinación, condición física y disciplina deportiva.</small></div>
          <div><b>Competencia</b><small>Participación en juegos, torneos y seguimiento por categoría.</small></div>
          <div><b>Comunidad</b><small>Comunicación clara con papás, control administrativo y compromiso familiar.</small></div>
        </div>
      </section>

      <section id="reglamento" class="academy-section rules-section">
        <div class="section-headline">
          <span class="eyebrow">Reglamento Ducks</span>
          <h2>Lineamientos principales</h2>
          <p>Este apartado queda preparado para integrar el reglamento oficial completo de Ducks Basketball Academy.</p>
        </div>
        <div class="rules-grid">
          <article><b>Asistencia y puntualidad</b><small>Confirmar asistencia a entrenamientos, juegos y torneos. Llegar a tiempo fortalece la disciplina del equipo.</small></article>
          <article><b>Uniforme y presentación</b><small>Usar la playera o uniforme indicado por la academia en entrenamientos y partidos.</small></article>
          <article><b>Respeto y conducta</b><small>Promover respeto a compañeros, entrenadores, árbitros, rivales y familias.</small></article>
          <article><b>Pagos y comprobantes</b><small>Mantener mensualidades y cuotas al corriente. Los comprobantes se cargan desde el Portal de Papás.</small></article>
          <article><b>Comunicación oficial</b><small>La información administrativa, horarios y avisos se comunicarán por los canales oficiales de Ducks.</small></article>
          <article><b>Compromiso familiar</b><small>El desarrollo del jugador requiere constancia, apoyo de papás y seguimiento administrativo.</small></article>
        </div>
      </section>

      <section id="categorias" class="academy-section">
        <div class="section-headline">
          <span class="eyebrow">Categorías</span>
          <h2>Equipos por edad y nivel</h2>
          <p>Las categorías pueden ajustarse por temporada, torneo y desarrollo de cada jugador.</p>
        </div>
        <div class="category-pills">
          <span>2018-2019</span><span>2016-2017</span><span>2015-2014</span><span>2013-2012</span><span>Libre / Desarrollo</span>
        </div>
      </section>

      <section id="valores" class="academy-section">
        <div class="section-headline">
          <span class="eyebrow">Valores</span>
          <h2>Más que basketball</h2>
        </div>
        <div class="academy-grid">
          <div><b>Disciplina</b><small>Constancia, puntualidad y enfoque en cada entrenamiento.</small></div>
          <div><b>Respeto</b><small>Compañerismo, juego limpio y convivencia sana.</small></div>
          <div><b>Trabajo en equipo</b><small>Aprender a competir, colaborar y crecer juntos.</small></div>
        </div>
      </section>

      <section id="contacto" class="academy-section contact-section">
        <div class="section-headline">
          <span class="eyebrow">Contacto</span>
          <h2>Información de la academia</h2>
          <p>Para dudas sobre pagos, entrenamientos, calendario o comprobantes, comunícate con Ducks Basketball Academy.</p>
        </div>
        <div class="contact-card">
          <div class="contact-item">
            <b>Dirección</b>
            <p>${ACADEMY_ADDRESS}</p>
          </div>
          <div class="contact-item">
            <b>WhatsApp</b>
            <a class="whatsapp-link" target="_blank" rel="noopener" href="https://wa.me/${ACADEMY_WHATSAPP_DIGITS}">
              <span class="wa-icon">☘</span>
              <span>${ACADEMY_WHATSAPP}</span>
            </a>
            <small>Actualiza el número en config.js usando window.DUCKS_ACADEMY_WHATSAPP.</small>
          </div>
        </div>
      </section>
    </main>
  </div>`;
}

/* Portal papás limpio v210 */
function renderParentLogin(){
  mode='parentLogin'; rememberScreen('parentLogin:');
  app.innerHTML=`${publicQuickMenu()}<div class="public-site with-global-menu">
    <header class="academy-menu"><div class="academy-menu-inner">
      <a class="academy-brand" href="#" onclick="renderPublicHome()"><img src="assets/logo.png"><span>Ducks Basketball Academy</span></a>
      <nav class="academy-links"><button onclick="renderPublicHome()">Inicio</button><button class="primary-menu-btn" onclick="renderParentLogin()">Portal de Papás</button><button class="admin-image-btn" title="Administrador" aria-label="Administrador" onclick="renderAdminLogin()"><img src="assets/ducks-admin-header.png" alt="Administrador"></button></nav>
    </div></header>
    <main class="academy-main">
      <div class="login-card">
        <div class="parent-title"><img src="assets/logo.png"><div><h1>Portal de Papás</h1><div class="sub">Acceso privado por familia</div></div></div>
        <div class="notice success"><b>Protección de información:</b> al iniciar sesión se limpia cualquier sesión anterior y solo verás tus hijos asignados.</div>
        <form id="parentLoginForm" class="parent-form">
          <label class="label full">Usuario<input id="parentUser" class="input" required placeholder="Correo, teléfono o usuario"></label>
          <label class="label full">Contraseña<input id="parentPassword" class="input" type="password" required placeholder="Contraseña"></label>
          <div class="full"><button class="btn green" style="width:100%;font-size:18px;padding:14px">Entrar al Portal de Papás</button></div>
        </form>
      </div>
    </main>
  </div>`;
  document.getElementById('parentLoginForm').onsubmit=parentLogin;
}

async function parentChangeOwnPassword(){
  if(!parentToken){ toast('La sesión no está activa. Inicia sesión nuevamente.'); return; }
  const p1=prompt('Escribe tu nueva contraseña (mínimo 4 caracteres):');
  if(p1===null)return;
  if(String(p1).trim().length<4){toast('La contraseña debe tener al menos 4 caracteres');return;}
  const p2=prompt('Confirma tu nueva contraseña:');
  if(p2===null)return;
  if(p1!==p2){toast('Las contraseñas no coinciden');return;}
  const {data,error}=await sb.rpc('ducks_parent_change_password_v232',{p_token:parentToken,p_new_password:String(p1).trim()});
  if(error){toast('No se pudo cambiar la contraseña: '+error.message);return;}
  const row=Array.isArray(data)?data[0]:data;
  toast(row?.ok?'Contraseña actualizada correctamente':(row?.message||'No se pudo actualizar'));
}
function parentExitToHome(){
  parentToken=''; parentProfile=null; parentPlayers=[]; parentPayments=[]; parentDocuments=[];
  localStorage.removeItem('ducks_parent_token_v213');
  renderPublicHome();
}

async function parentLogin(e){
  e.preventDefault();

  parentToken='';
  parentProfile=null;
  parentPlayers=[];
  parentPayments=[];
  parentDocuments=[];
  localStorage.removeItem('ducks_parent_token_v213');

  const user=document.getElementById('parentUser').value.trim();
  const password=document.getElementById('parentPassword').value;
  const candidates = parentLoginCandidates(user);
  let lastError = '';

  for(const login of candidates){
    const {data,error}=await sb.rpc('ducks_parent_login_v213',{p_login:login,p_password:password});
    if(error){ lastError = error.message; continue; }
    if(data && data[0]?.ok){
      parentToken=data[0].token;
      localStorage.setItem('ducks_parent_token_v213',parentToken);
      await loadParentData();
      if(!parentProfile){
        toast('No se pudo cargar la cuenta del papá. Intenta de nuevo.');
        return;
      }
      renderParentPortal();
      return;
    }
    lastError = data?.[0]?.message || 'Usuario o contraseña incorrectos';
  }
  toast(lastError || 'Usuario o contraseña incorrectos');
}
async function loadParentData(){
  parentPlayers=[]; parentPayments=[]; parentProfile=null;
  const {data,error}=await sb.rpc('ducks_parent_portal_v213',{p_token:parentToken});
  if(error){toast('Error cargando portal: '+error.message); return;}
  if(!data || !data.ok){toast(data?.message || 'Sesión inválida'); parentToken=''; localStorage.removeItem('ducks_parent_token_v213'); renderParentLogin(); return;}
  parentProfile=data.account;
  parentPlayers=data.players||[];
  parentPayments=data.payments||[];
  const docs = await sb.rpc('ducks_parent_documents_v218',{p_token:parentToken});
  if(!docs.error && docs.data?.ok){ parentDocuments = docs.data.documents || []; }
  else { parentDocuments = []; }
}

async function parentChangeOwnPassword(){
  if(!parentToken){ toast('La sesión no está activa. Inicia sesión nuevamente.'); return; }
  const p1=prompt('Escribe tu nueva contraseña (mínimo 4 caracteres):');
  if(p1===null)return;
  if(String(p1).trim().length<4){toast('La contraseña debe tener al menos 4 caracteres');return;}
  const p2=prompt('Confirma tu nueva contraseña:');
  if(p2===null)return;
  if(p1!==p2){toast('Las contraseñas no coinciden');return;}
  const {data,error}=await sb.rpc('ducks_parent_change_password_v232',{p_token:parentToken,p_new_password:String(p1).trim()});
  if(error){toast('No se pudo cambiar la contraseña: '+error.message);return;}
  const row=Array.isArray(data)?data[0]:data;
  toast(row?.ok?'Contraseña actualizada correctamente':(row?.message||'No se pudo actualizar'));
}
function parentExitToHome(){
  parentToken=''; parentProfile=null; parentPlayers=[]; parentPayments=[]; parentDocuments=[];
  localStorage.removeItem('ducks_parent_token_v213');
  renderPublicHome();
}
function parentPortalActions(){
  return `<section class="parent-account-actions">
    <div><h3>Mi cuenta</h3><p>Cambia tu contraseña o cierra sesión para regresar al inicio.</p></div>
    <div class="parent-account-buttons">
      <button class="btn green" onclick="parentChangeOwnPassword()">🔑 Cambiar contraseña</button>
      <button class="btn secondary" onclick="parentExitToHome()">Salir</button>
    </div>
  </section>`;
}

function renderParentPortal(){
  mode='parentPortal'; rememberScreen('parentPortal:');
  const cards = parentPlayers.map(p=>{
    const c=calc(p,parentPayments);
    const history=parentPayments.filter(x=>x.player_id===p.id).slice(0,8);
    return `<div class="family-player-card player-priority-card">
      <div class="player-card-top">
        <div class="player-info-side">
          <div class="family-head"><div><h2>${esc(p.name)}</h2><p>${esc(p.category||'')} · Uniforme #${esc(p.uniform_number||'-')}</p><span class="status ${c.status}">${c.status}</span></div></div>
          <div class="family-kpis"><div><small>Último pago</small><b>${esc(c.last||'Sin registro')}</b></div><div><small>Meses pendientes</small><b>${c.months}</b></div><div><small>Adeudo actual</small><b class="amount">${money(c.amount)}</b></div></div>
        </div>
        <div class="player-photo-side"><img src="${playerPhotoUrl(p)}" alt="Foto de ${esc(p.name)}"></div>
      </div>
      <details class="history-box"><summary>Ver historial y comprobantes</summary>${history.length?`<table class="mini-table"><thead><tr><th>Fecha</th><th>Monto</th><th>Estatus</th><th>Evidencia</th></tr></thead><tbody>${history.map(h=>`<tr><td>${esc(h.payment_date)}</td><td>${money(h.amount)}</td><td><span class="status ${statusClass(h.confirmation_status)}">${esc(h.confirmation_status)}</span></td><td>${h.evidence_url?`<a target="_blank" href="${h.evidence_url}">Ver</a>`:'-'}</td></tr>`).join('')}</tbody></table>`:'<p class="sub">Sin pagos registrados.</p>'}</details>
      <div class="doc-actions">
        <button class="btn green pay-now-main-btn" onclick="openParentPayNow('${p.id}')">💳 Pagar ahora</button>
        <button class="btn secondary" onclick="openParentPayment('${p.id}')">Subir comprobante</button>
        <button class="btn secondary" onclick="openParentDocument('${p.id}')">Subir documentos</button>
      </div>
      <details class="history-box">
        <summary>Documentos del jugador</summary>
        ${renderParentDocuments(p.id)}
      </details>
    </div>`;
  }).join('');
  app.innerHTML=`${publicQuickMenu()}<div class="public-site with-global-menu">
    <header class="academy-menu"><div class="academy-menu-inner">
      <a class="academy-brand" href="#" onclick="renderParentPortal()"><img src="assets/logo.png"><span>Portal de Papás</span></a>
      <nav class="academy-links"><button onclick="renderParentPortal()">Mis hijos</button><button onclick="openParentPayment()">Subir comprobante</button></nav>
      <div class="header-actions"><button class="btn secondary academy-admin" onclick="parentLogout()">Cerrar sesión</button></div>
    </div></header>
    <main class="academy-main">
      <section class="academy-ribbon private-ribbon"><div class="court-lines"></div><div class="ribbon-content"><img class="ribbon-logo small" src="assets/logo.png"><div class="ribbon-text"><span class="ribbon-kicker">Acceso privado</span><h1>Bienvenido al Portal de Papás</h1><p>${esc(parentProfile?.display_name||parentProfile?.login||'')}</p></div></div></section>
      ${parentPortalActions()}
      <section class="parent-card"><div class="parent-title"><img src="assets/logo.png"><div><h1>Mis jugadores</h1><div class="sub">Solo información asignada a tu familia</div></div></div>${parentPlayers.length?`<div class="family-grid">${cards}</div>`:`<div class="notice warning">Tu cuenta aún no tiene jugadores asignados. Contacta a administración.</div>`}</section>
      <section class="bank-card"><div class="bank-head"><div><span class="bank-chip">BBVA MX</span><h2>Datos para depósito o transferencia</h2><p>Copia la cuenta o CLABE, realiza tu pago y después adjunta el comprobante.</p></div><img src="assets/logo.png"></div><div class="bank-grid"><div class="bank-item"><small>Cuenta</small><strong>${BANK_ACCOUNT}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_ACCOUNT,'Cuenta')">Copiar cuenta</button></div><div class="bank-item"><small>CLABE</small><strong>${BANK_CLABE}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_CLABE,'CLABE')">Copiar CLABE</button></div><div class="bank-item full"><small>Beneficiario / referencia</small><strong>${BANK_BENEFICIARY}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_BENEFICIARY,'Beneficiario')">Copiar beneficiario</button></div></div></section>
    </main>
  </div>`;
}
function parentLogout(){ parentToken=''; parentProfile=null; parentPlayers=[]; parentPayments=[]; parentDocuments=[]; localStorage.removeItem('ducks_parent_token_v213'); renderPublicHome(); }

function renderParentDocuments(playerId){
  const docs = parentDocuments.filter(d=>d.player_id===playerId);
  if(!docs.length) return '<p class="sub">Aún no hay documentos cargados.</p>';
  return `<table class="mini-table"><thead><tr><th>Tipo</th><th>Nombre</th><th>Fecha</th><th>Archivo</th></tr></thead><tbody>${docs.map(d=>`<tr><td>${esc(d.document_type||'')}</td><td>${esc(d.title||'')}</td><td>${esc(String(d.created_at||'').slice(0,10))}</td><td><a target="_blank" href="${d.file_url}">Ver</a></td></tr>`).join('')}</tbody></table>`;
}
function openParentDocument(playerId=''){
  if(!parentPlayers.length){toast('No tienes jugadores asignados.'); return;}
  const selected = playerId ? parentPlayers.find(p=>p.id===playerId) : parentPlayers[0];
  const options = parentPlayers.map(p=>`<option value="${p.id}" ${p.id===selected.id?'selected':''}>${esc(p.name)} · #${esc(p.uniform_number||'-')}</option>`).join('');
  const typeOptions = DOCUMENT_TYPES.map(t=>`<option>${esc(t)}</option>`).join('');
  const modal=document.createElement('div'); modal.className='modalbg open'; modal.id='parentDocModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>Subir documentos del jugador</h3><button class="btn secondary" onclick="closeModal('parentDocModal')">Cerrar</button></div><div class="modal-body">
    <div class="notice success"><b>Documentos privados:</b> solo el papá/tutor asignado y el administrador podrán consultar estos documentos.</div>
    <form id="parentDocForm" class="form-grid">
      <label class="label full">Jugador<select id="docPlayer" class="select" required>${options}</select></label>
      <label class="label">Tipo de documento<select id="docType" class="select" required>${typeOptions}</select></label>
      <label class="label">Nombre o descripción<input id="docTitle" class="input" placeholder="Ej. CURP actualizada, Acta original..." required></label>
      <label class="label full">Archivo<input id="docFile" class="input" type="file" accept="image/*,application/pdf,.doc,.docx" required></label>
      <label class="label full">Comentarios opcionales<textarea id="docNotes" class="input" placeholder="Comentarios sobre el documento..."></textarea></label>
      <div class="full"><button class="btn green" style="width:100%;font-size:18px;padding:14px">Enviar documento</button></div>
    </form>
  </div></div>`;
  document.body.appendChild(modal);
  document.getElementById('parentDocForm').onsubmit=submitParentDocument;
}
async function submitParentDocument(e){
  e.preventDefault();
  const player_id=document.getElementById('docPlayer').value;
  const player=parentPlayers.find(p=>p.id===player_id);
  const file=document.getElementById('docFile').files[0];
  try{
    const file_url=await uploadFile(file,`documentos/${player_id}`);
    const row={
      p_token:parentToken,
      p_player_id:player_id,
      p_document_type:document.getElementById('docType').value,
      p_title:document.getElementById('docTitle').value.trim(),
      p_file_url:file_url,
      p_file_name:file.name,
      p_file_mime:file.type || '',
      p_notes:document.getElementById('docNotes').value.trim()
    };
    const {data,error}=await sb.rpc('ducks_parent_submit_document_v218',row);
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.message||'No se pudo guardar el documento');
    closeModal('parentDocModal');
    toast('Documento enviado correctamente.');
    await loadParentData();
    renderParentPortal();
  }catch(err){
    if(String(err.message||'').includes('tutor_2') || String(err.message||'').includes('tutor_phone_2')){
      toast('Falta ejecutar el SQL de tutores en Supabase. Ejecuta PASO_9_SQL_FIX_TUTOR_SCHEMA_v2_38.txt');
    }else{
      toast('Error: '+err.message);
    }
  }
}


function paymentConcept(player){
  const name = (player?.name || 'Jugador').replace(/\s+/g,' ').trim();
  const id = player?.id || '';
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  return `DUCKS ${id} ${name} ${ym}`.slice(0,70);
}

function copyDefaultPaymentData(playerId=''){
  const player = parentPlayers.find(p=>p.id===playerId) || parentPlayers[0];
  if(!player){ toast('No se encontró el jugador.'); return; }
  const c = calc(player, parentPayments);
  const amount = c.amount > 0 ? c.amount : Number(player.monthly_fee || 0);
  const concept = paymentConcept(player);
  const text = `Banco: ${BANK_NAME}
CLABE: ${BANK_CLABE}
Beneficiario: ${BANK_BENEFICIARY}
Monto: ${money(amount)}
Concepto: ${concept}`;
  navigator.clipboard.writeText(text).then(()=>toast('Datos de pago copiados')).catch(()=>toast('No se pudieron copiar los datos'));
}

function openParentPayNow(playerId=''){
  if(!parentPlayers.length){ toast('No tienes jugadores asignados.'); return; }
  const player = parentPlayers.find(p=>p.id===playerId) || parentPlayers[0];
  const c = calc(player, parentPayments);
  const amount = c.amount > 0 ? c.amount : Number(player.monthly_fee || 0);
  const concept = paymentConcept(player);
  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='payNowModal';
  modal.innerHTML=`<div class="modal pay-now-modal">
    <div class="modal-head">
      <h3>Pagar ahora</h3>
      <button class="btn secondary" onclick="closeModal('payNowModal')">Cerrar</button>
    </div>
    <div class="modal-body">
      <div class="pay-now-hero">
        <div>
          <small>Jugador</small>
          <h2>${esc(player.name)}</h2>
          <p>${c.status==='Pagado'?'No hay adeudo vencido. Puedes pagar la mensualidad actual si lo deseas.':'Adeudo actual detectado'}</p>
        </div>
        <strong>${money(amount)}</strong>
      </div>

      <div class="pay-method-grid">
        <div class="pay-method-card codi transfer-default">
          <span>Método predeterminado</span>
          <h3>Transferencia a BBVA</h3>
          <p>La CLABE de Ducks ya está lista. Copia los datos, paga desde tu app bancaria y sube el comprobante.</p>
          <div class="default-clabe-box">
            <small>CLABE BBVA predeterminada</small>
            <strong>${BANK_CLABE}</strong>
            <button class="btn green" onclick="copyBank(BANK_CLABE,'CLABE')">Copiar CLABE</button>
          </div>
        </div>
        <div class="pay-method-card">
          <span>Datos automáticos</span>
          <h3>Monto y concepto listos</h3>
          <p>El portal calcula el monto y concepto para identificar el pago más rápido.</p>
        </div>
      </div>

      <div class="bank-card embedded">
        <div class="bank-head">
          <div><span class="bank-chip">BBVA</span><h2>Datos de pago</h2><p>${PAYMENT_CODI_NOTE}</p></div>
          <img src="assets/logo.png">
        </div>
        <div class="bank-grid">
          <div class="bank-item"><small>Monto a pagar</small><strong>${money(amount)}</strong><button type="button" class="btn secondary" onclick="copyBank('${amount}','Monto')">Copiar monto</button></div>
          <div class="bank-item"><small>Cuenta</small><strong>${BANK_ACCOUNT}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_ACCOUNT,'Cuenta')">Copiar cuenta</button></div>
          <div class="bank-item"><small>CLABE</small><strong>${BANK_CLABE}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_CLABE,'CLABE')">Copiar CLABE</button></div>
          <div class="bank-item"><small>Concepto sugerido</small><strong>${esc(concept)}</strong><button type="button" class="btn secondary" onclick="copyBank('${esc(concept)}','Concepto')">Copiar concepto</button></div>
          <div class="bank-item full"><small>Beneficiario</small><strong>${BANK_BENEFICIARY}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_BENEFICIARY,'Beneficiario')">Copiar beneficiario</button></div>
        </div>
      </div>

      <div class="pay-next-actions">
        <button class="btn green" onclick="closeModal('payNowModal'); openParentPayment('${player.id}')">Ya pagué / Subir comprobante</button>
        <button class="btn secondary" onclick="copyBank('CLABE: ${BANK_CLABE}\\nMonto: ${money(amount)}\\nConcepto: ${esc(concept)}\\nBeneficiario: ${BANK_BENEFICIARY}','Datos de pago')">Copiar todo</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function openParentPayment(playerId=''){
  if(!parentPlayers.length){toast('No tienes jugadores asignados.'); return;}
  const selected = playerId ? parentPlayers.find(p=>p.id===playerId) : parentPlayers[0];
  const options = parentPlayers.map(p=>`<option value="${p.id}" ${p.id===selected.id?'selected':''}>${esc(p.name)} · #${esc(p.uniform_number||'-')}</option>`).join('');
  const modal=document.createElement('div'); modal.className='modalbg open'; modal.id='parentPayModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>Subir comprobante</h3><button class="btn secondary" onclick="closeModal('parentPayModal')">Cerrar</button></div><div class="modal-body">
    <form id="parentPayForm" class="form-grid">
      <label class="label full">Jugador<select id="parentPayPlayer" class="select" required>${options}</select></label>
      <label class="label">Fecha de pago<input id="parentPayDate" class="input" type="date" value="${todayISO()}" required></label>
      <label class="label">Monto pagado<input id="parentPayAmount" class="input" type="number" min="0" step="50" value="${selected.monthly_fee||0}" required></label>
      <label class="label">Método<select id="parentPayMethod" class="select" required><option>Transferencia</option><option>Depósito</option><option>Efectivo</option><option>Otro</option></select></label>
      <label class="label full">Comprobante<input id="parentPayEvidence" class="input" type="file" accept="image/*,application/pdf" required></label>
      <label class="label full">Comentario opcional<textarea id="parentPayNotes" class="input" placeholder="Referencia, banco o comentario..."></textarea></label>
      <div class="full"><button class="btn green" style="width:100%;font-size:18px;padding:14px">Enviar comprobante</button></div>
    </form>
  </div></div>`;
  document.body.appendChild(modal);
  document.getElementById('parentPayPlayer').onchange=()=>{ const p=parentPlayers.find(x=>x.id===document.getElementById('parentPayPlayer').value); if(p) document.getElementById('parentPayAmount').value=p.monthly_fee||0; };
  document.getElementById('parentPayForm').onsubmit=submitParentPayment;
}
async function submitParentPayment(e){
  e.preventDefault();
  const player_id=document.getElementById('parentPayPlayer').value;
  const player=parentPlayers.find(p=>p.id===player_id);
  const file=document.getElementById('parentPayEvidence').files[0];
  try{
    const evidence_url=await uploadFile(file,'evidencias');
    const payDate=document.getElementById('parentPayDate').value;
    const row={p_token:parentToken,p_player_id:player_id,p_payment_date:payDate,p_period:period(payDate),p_amount:Number(document.getElementById('parentPayAmount').value||0),p_method:document.getElementById('parentPayMethod').value,p_notes:document.getElementById('parentPayNotes').value,p_evidence_url:evidence_url,p_evidence_name:file.name};
    const {data,error}=await sb.rpc('ducks_parent_submit_payment_v213',row);
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.message||'No se pudo enviar');
    closeModal('parentPayModal');
    toast('Comprobante enviado. Queda pendiente de confirmación.');
    await loadParentData();
    renderParentPortal();
  }catch(err){toast('Error: '+err.message);}
}

/* Admin */
function renderAdminLogin(){
  mode='adminLogin'; rememberScreen('adminLogin:');
  app.innerHTML=`${publicQuickMenu()}<div class="public-site with-global-menu"><header class="academy-menu"><div class="academy-menu-inner"><a class="academy-brand" href="#" onclick="renderPublicHome()"><img src="assets/logo.png"><span>Ducks Basketball Academy</span></a><nav class="academy-links"><button onclick="renderPublicHome()">Inicio</button><button onclick="renderParentLogin()">Portal de Papás</button></nav></div></header>
  <main class="academy-main"><div class="login-card"><div class="parent-title"><img src="assets/logo.png"><div><h1>Administrador</h1><div class="sub">Acceso interno Ducks</div></div></div><form id="loginForm" class="parent-form"><label class="label full">Email<input id="loginEmail" class="input" type="email" required></label><label class="label full">Password<input id="loginPassword" class="input" type="password" required></label><div class="full"><button class="btn green">Entrar como administrador</button></div></form></div></main></div>`;
  document.getElementById('loginForm').onsubmit=login;
}
async function login(e){
  e.preventDefault();
  const {data,error}=await sb.auth.signInWithPassword({email:document.getElementById('loginEmail').value,password:document.getElementById('loginPassword').value});
  if(error){toast(error.message);return;}
  session=data.session; mode='admin'; page='dashboard'; renderShell(); await loadAdminData(); renderPage();
}
async function logout(){ await sb.auth.signOut(); session=null; renderPublicHome(); }
async function loadAdminData(){
  const pr=await sb.from('players').select('*').order('id');
  if(pr.error){toast('Error cargando jugadores: '+pr.error.message); players=[];} else players=pr.data||[];
  const py=await sb.from('payments').select('*').order('created_at',{ascending:false});
  if(py.error){toast('Error cargando pagos: '+py.error.message); payments=[];} else payments=py.data||[];
  const ac=await sb.from('parent_accounts_v213').select('*').order('display_name');
  if(ac.error){toast('Ejecuta el SQL v2.38: '+ac.error.message); parentAccounts=[];} else parentAccounts=ac.data||[];
  const ln=await sb.from('parent_player_links_v213').select('*').order('created_at',{ascending:false});
  if(ln.error){parentLinks=[];} else parentLinks=ln.data||[];
  const dc=await sb.from('player_documents_v218').select('*').order('created_at',{ascending:false});
  if(dc.error){documents=[];} else documents=dc.data||[];
  const hs=await sb.from('player_change_history_v237').select('*').order('created_at',{ascending:false}).limit(500);
  if(hs.error){playerHistory=[];} else playerHistory=hs.data||[];
}
async function refresh(){ if(mode==='admin'){await loadAdminData(); renderShell(); renderPage();} }
function renderShell(){
  app.innerHTML=`${adminQuickMenu()}<div class="shell with-admin-menu"><aside class="side"><div class="brand"><img class="brand-logo" src="assets/logo.png"><div><h1>Ducks Academy CRM</h1><p>Administración interna</p></div></div><div class="nav"><button data-page="dashboard">📊 Dashboard</button><button data-page="players">🏀 Jugadores</button><button data-page="parents">👨‍👩‍👧 Papás</button><button data-page="payments">💳 Pagos</button><button data-page="evidence">📎 Evidencias</button><button data-page="whatsapp">📲 WhatsApp vencidos</button><button data-page="public">🌐 Ver página pública</button><button data-page="documents">📁 Documentos</button><button data-page="history">🕘 Historial</button><button data-page="backups">💾 Respaldos</button><button data-page="settings">⚙️ Configuración</button></div><div class="help">v2.38: administrador discreto + WhatsApp.</div></aside><main class="main"><div class="top"><div><h2 id="title"></h2><p id="subtitle">Ducks Basketball Academy</p></div><div class="tools"><input id="search" class="input" placeholder="Buscar..." value="${esc(q)}"><button class="btn secondary" id="authBtn">Cerrar sesión</button></div></div><div id="content"></div></main></div>`;
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page; if(page==='public'){renderPublicHome(); return;} renderPage();});
  document.getElementById('search').oninput=e=>{q=e.target.value; renderPage();};
  document.getElementById('authBtn').onclick=logout;
}
function setTitle(t){ const el=document.getElementById('title'); if(el) el.textContent=t; document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); }
function renderPage(){ if(mode==='admin') rememberScreen('admin:'+page); if(page==='dashboard') renderDashboard(); if(page==='players') renderPlayers(); if(page==='parents') renderParents(); if(page==='payments') renderPayments(); if(page==='evidence') renderEvidence(); if(page==='whatsapp') renderWhatsApp(); if(page==='documents') renderDocuments(); if(page==='history') renderPlayerHistory(); if(page==='backups') renderBackups(); if(page==='settings') renderSettings(); }
function filteredPlayers(){ const s=q.toLowerCase().trim(); return players.filter(p=>!s || [p.id,p.name,p.tutor,p.phone,p.category,p.uniform_number].join(' ').toLowerCase().includes(s)); }

function renderDashboard(){
  setTitle('Dashboard ejecutivo');
  const rows=players.map(p=>({...p,c:calc(p)})); const active=rows.filter(p=>p.status==='Activo').length; const debtors=rows.filter(p=>p.c.amount>0); const overdue=rows.filter(p=>p.c.status==='Vencido').length; const pendingEvidence=payments.filter(p=>p.confirmation_status==='Pendiente de confirmación').length; const totalDebt=debtors.reduce((a,p)=>a+p.c.amount,0);
  document.getElementById('content').innerHTML=`${iosInstallBanner()}<div class="kpis"><div class="kpi"><small>Jugadores</small><strong>${players.length}</strong></div><div class="kpi green"><small>Activos</small><strong>${active}</strong></div><div class="kpi orange"><small>Con adeudo</small><strong>${debtors.length}</strong></div><div class="kpi red"><small>Vencidos</small><strong>${overdue}</strong></div><div class="kpi orange"><small>Por confirmar</small><strong>${pendingEvidence}</strong></div><div class="kpi red"><small>Adeudo total</small><strong>${money(totalDebt)}</strong></div></div>
  <div class="panel"><div class="panel-head"><h3>Jugadores con adeudo</h3></div><div class="tablewrap"><table><thead><tr><th>Foto</th><th>ID</th><th>Jugador</th><th>Núm.</th><th>Tutor</th><th>Último pago</th><th>Meses</th><th>Adeudo</th><th>Estado</th><th>WhatsApp</th></tr></thead><tbody>${debtors.sort((a,b)=>b.c.amount-a.c.amount).map(p=>`<tr><td>${thumb(p.photo_url)}</td><td>${p.id}</td><td><b>${esc(p.name)}</b><br><small>${esc(p.category||'')}</small></td><td><span class="uniform">#${esc(p.uniform_number||'-')}</span></td><td>${esc(p.tutor||'')}</td><td>${esc(p.c.last||'')}</td><td>${p.c.months}</td><td class="amount">${money(p.c.amount)}</td><td><span class="status ${p.c.status}">${p.c.status}</span></td><td>${whatsappButtons(p)}</td></tr>`).join('')||'<tr><td colspan="10">Sin adeudos</td></tr>'}</tbody></table></div></div>`;
}
function renderPlayers(){
  setTitle('Jugadores');
  const list=filteredPlayers();
  document.getElementById('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>Base de jugadores</h3><button class="btn green" onclick="openPlayerForm()">+ Nuevo jugador</button></div><div class="cards">${list.map(p=>{const c=calc(p);return `<div class="card">${thumb(p.photo_url)}<h4>${esc(p.name)}</h4><p><span class="uniform">#${esc(p.uniform_number||'-')}</span></p><p><b>ID:</b> ${p.id} · <b>Categoría:</b> ${esc(p.category||'')}</p><p><b>Tutor principal:</b> ${esc(p.tutor||'')}</p><p><b>WhatsApp principal:</b> ${esc(p.phone||'')}</p>${p.tutor_2||p.tutor_phone_2?`<p><b>Tutor secundario:</b> ${esc(p.tutor_2||'')} · ${esc(p.tutor_phone_2||'')}</p>`:''}<p><b>Adeudo:</b> <span class="amount">${money(c.amount)}</span> · <span class="status ${c.status}">${c.status}</span></p><div class="actions"><button class="btn secondary" onclick="openPlayerForm('${p.id}')">Editar</button><button class="btn secondary" onclick="openPlayerHistory('${p.id}')">Historial</button><button class="btn green" onclick="openPaymentForm('${p.id}')">Pago</button>${whatsappButtons(p)}<button class="btn red" onclick="deletePlayer('${p.id}')">Eliminar</button></div></div>`}).join('')||'<div class="card">Sin jugadores. Si aquí no aparecen, revisa que estés logueado como administrador y que la tabla players tenga permisos.'}</div></div>`;
}
function suggestedFamilies(){
  const m = new Map();
  players.forEach(p=>{
    [
      {tutor:p.tutor||'', phone:p.phone||''},
      {tutor:p.tutor_2||'', phone:p.tutor_phone_2||''}
    ].filter(e=>e.tutor||e.phone).forEach(e=>{
      const key=(e.phone||e.tutor||'Sin tutor').trim();
      if(!m.has(key)) m.set(key,{key,tutor:e.tutor||'',phone:e.phone||'',players:[]});
      if(!m.get(key).players.some(x=>x.id===p.id)) m.get(key).players.push(p);
    });
  });
  return [...m.values()].filter(f=>f.players.length);
}
function renderParents(){
  setTitle('Papás / Accesos privados');
  const fams=suggestedFamilies();
  const playersOptions = players.map(p=>`<option value="${p.id}">${p.id} · ${esc(p.name)} · Tutor: ${esc(p.tutor||'')}</option>`).join('');
  const accountsOptions = parentAccounts.map(a=>`<option value="${a.id}">${esc(a.display_name)} · ${esc(a.login)}</option>`).join('');
  document.getElementById('content').innerHTML=`<div class="notice success"><b>v2.38:</b> al crear una cuenta se ligan automáticamente los jugadores que coincidan por teléfono o tutor. Si no ves jugadores, entra a la sección Jugadores para validar que carguen correctamente.</div>
  <div class="panel"><div class="panel-head"><h3>Crear cuenta de papá/tutor</h3></div><div class="modal-body"><form id="parentAccountForm" class="form-grid">
    <label class="label">Nombre visible<input id="accName" class="input" required placeholder="Nombre del papá, mamá o tutor"></label>
    <label class="label">Usuario<input id="accLogin" class="input" required placeholder="Correo, teléfono o usuario"></label>
    <label class="label">WhatsApp<input id="accPhone" class="input" placeholder="WhatsApp"></label>
    <label class="label">Contraseña temporal<input id="accPassword" class="input" required placeholder="Ej. Ducks2026"></label>
    <div class="full"><button class="btn green">Crear cuenta</button></div>
  </form></div></div>
  <div class="panel"><div class="panel-head"><h3>Asignar jugador a papá</h3></div><div class="modal-body"><form id="parentLinkForm" class="form-grid">
    <label class="label">Cuenta del papá<select id="linkAccount" class="select" required><option value="">Selecciona cuenta...</option>${accountsOptions}</select></label>
    <label class="label">Jugador<select id="linkPlayer" class="select" required><option value="">Selecciona jugador...</option>${playersOptions}</select></label>
    <div class="full"><button class="btn green">Ligar jugador</button></div>
  </form></div></div>
  <div class="panel"><div class="panel-head"><h3>Cuentas creadas</h3></div><div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Clave temporal</th><th>WhatsApp</th><th>Activo</th><th>Acción</th></tr></thead><tbody>${parentAccounts.map(a=>`<tr><td><b>${esc(a.display_name)}</b></td><td>${esc(a.login)}</td><td><code>${esc(a.access_code||'')}</code></td><td>${esc(a.phone||'-')}</td><td>${a.active?'Sí':'No'}</td><td><button class="btn secondary" onclick="autoLinkAccountFromButton('${a.id}')">Auto ligar</button> <button class="btn secondary" onclick="resetParentPassword('${a.id}')">Reset contraseña</button></td></tr>`).join('')||'<tr><td colspan="6">Sin cuentas creadas</td></tr>'}</tbody></table></div></div>
  <div class="panel"><div class="panel-head"><h3>Sugerencias desde tutor / WhatsApp existentes</h3></div><div class="cards">${fams.map(f=>`<div class="card"><h4>${esc(f.tutor||'Tutor sin nombre')}</h4><p><b>WhatsApp:</b> ${esc(f.phone||'-')}</p><p><b>Jugadores:</b> ${f.players.map(p=>esc(p.name)).join(', ')}</p><div class="actions"><button class="btn secondary" onclick="prefillParent('${String(f.tutor||'').replace(/'/g,"\\'")}','${String(f.phone||'').replace(/'/g,"\\'")}')">Usar para crear cuenta</button></div></div>`).join('')||'<div class="card">No hay sugerencias porque no cargaron jugadores.</div>'}</div></div>
  <div class="panel"><div class="panel-head"><h3>Cuentas y jugadores ligados</h3></div><div class="tablewrap"><table><thead><tr><th>Cuenta</th><th>Usuario</th><th>Jugador</th><th>Activo</th><th>Acción</th></tr></thead><tbody>${parentLinks.map(l=>{const a=parentAccounts.find(x=>x.id===l.parent_account_id); const p=players.find(x=>x.id===l.player_id); return `<tr><td><b>${esc(a?.display_name||'')}</b></td><td>${esc(a?.login||'')}</td><td>${esc(l.player_id)} · ${esc(p?.name||'')}</td><td>${l.active?'Sí':'No'}</td><td><button class="btn secondary" onclick="resetParentPassword('${a?.id||''}')">Reset contraseña</button> <button class="btn red" onclick="deleteParentLink('${l.id}')">Eliminar</button></td></tr>`}).join('')||'<tr><td colspan="5">Sin asignaciones</td></tr>'}</tbody></table></div></div>`;
  document.getElementById('parentAccountForm').onsubmit=saveParentAccount;
  document.getElementById('parentLinkForm').onsubmit=saveParentLink;
}
function prefillParent(name, phone){ document.getElementById('accName').value=name||''; document.getElementById('accLogin').value=phone||''; document.getElementById('accPhone').value=phone||''; document.getElementById('accPassword').value='Ducks2026'; toast('Datos sugeridos cargados');}
async function saveParentAccount(e){
  e.preventDefault();
  const login = document.getElementById('accLogin').value.trim().toLowerCase();
  const display_name = document.getElementById('accName').value.trim();
  const phone = normalizePhone(document.getElementById('accPhone').value);
  const access_code = document.getElementById('accPassword').value.trim();
  if(login.length < 3){ toast('El usuario debe tener al menos 3 caracteres'); return; }
  if(display_name.length < 2){ toast('Captura el nombre del papá/tutor'); return; }
  if(access_code.length < 4){ toast('La contraseña debe tener al menos 4 caracteres'); return; }
  try{
    const row = {login, display_name, phone, access_code, active:true};
    const {error} = await sb.from('parent_accounts_v213').upsert(row, {onConflict:'login'});
    if(error) throw error;

    await loadAdminData();
    const account = parentAccounts.find(a => String(a.login).toLowerCase() === login);
    let msg = 'Cuenta de papá creada';
    if(account){
      const result = await autoLinkPlayersToAccount(account);
      await loadAdminData();
      msg += `. Jugadores ligados automáticamente: ${result.linked}`;
      if(result.matches === 0) msg += '. No se encontraron coincidencias; usa ligar manual si aplica.';
    }
    toast(msg);
    page='parents';
    renderShell();
    renderPage();
  }catch(err){
    toast('Error creando cuenta: ' + err.message);
  }
}
async function saveParentLink(e){
  e.preventDefault();
  const row={parent_account_id:document.getElementById('linkAccount').value,player_id:document.getElementById('linkPlayer').value,active:true};
  const {error}=await sb.from('parent_player_links_v213').insert(row);
  if(error) toast('Error ligando jugador: '+error.message); else {toast('Jugador ligado al papá'); await refresh(); page='parents'; renderPage();}
}


async function autoLinkAccountFromButton(accountId){
  const acc = parentAccounts.find(a=>a.id===accountId);
  if(!acc){ toast('Cuenta no encontrada'); return; }
  try{
    const result = await autoLinkPlayersToAccount(acc);
    await loadAdminData();
    toast(`Auto ligado completado. Nuevos ligados: ${result.linked}`);
    page='parents';
    renderShell();
    renderPage();
  }catch(err){
    toast('Error en auto ligado: ' + err.message);
  }
}

async function resetParentPassword(accountId){
  const acc = parentAccounts.find(a=>a.id===accountId);
  if(!acc){ toast('Cuenta no encontrada'); return; }
  const newPass = prompt(`Nueva contraseña temporal para ${acc.display_name}:`, 'Ducks2026');
  if(!newPass) return;
  const access_code = newPass.trim();
  if(access_code.length < 4){ toast('La contraseña debe tener al menos 4 caracteres'); return; }
  try{
    const {error} = await sb.from('parent_accounts_v213').update({access_code}).eq('id', accountId);
    if(error) throw error;
    toast('Contraseña actualizada. Compártela con el papá.');
  }catch(err){
    toast('Error al resetear contraseña: ' + err.message);
  }
}

async function deleteParentLink(id){ if(!confirm('¿Eliminar relación papá-jugador?')) return; const {error}=await sb.from('parent_player_links_v213').delete().eq('id',id); if(error) toast(error.message); else {toast('Relación eliminada'); await refresh(); page='parents'; renderPage();} }

function renderPayments(){
  setTitle('Pagos');
  document.getElementById('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>Historial de pagos</h3><button class="btn green" onclick="openPaymentForm()">+ Registrar pago</button></div><div class="tablewrap"><table><thead><tr><th>ID</th><th>Alumno</th><th>Fecha</th><th>Periodo</th><th>Monto</th><th>Método</th><th>Estatus</th><th>Evidencia</th><th>Acción</th></tr></thead><tbody>${payments.map(p=>`<tr><td>${String(p.id).slice(0,8)}</td><td><b>${esc(p.student_name||'')}</b><br><small>${esc(p.player_id)}</small></td><td>${esc(p.payment_date)}</td><td>${esc(p.period||'')}</td><td class="amount">${money(p.amount)}</td><td>${esc(p.method||'')}</td><td><span class="status ${statusClass(p.confirmation_status)}">${esc(p.confirmation_status)}</span></td><td>${p.evidence_url?`<a class="btn secondary" target="_blank" href="${p.evidence_url}">Ver</a>`:'-'}</td><td><button class="btn red" onclick="deletePayment('${p.id}')">Eliminar</button></td></tr>`).join('')||'<tr><td colspan="9">Sin pagos</td></tr>'}</tbody></table></div></div>`;
}
function renderEvidence(){
  setTitle('Evidencias por confirmar');
  const pend=payments.filter(p=>p.confirmation_status==='Pendiente de confirmación');
  document.getElementById('content').innerHTML=`<div class="notice warning">Al confirmar un pago, se reflejará automáticamente en el dashboard y adeudos.</div><div class="panel"><div class="panel-head"><h3>Pendientes</h3></div><div class="tablewrap"><table><thead><tr><th>Alumno</th><th>Fecha</th><th>Periodo</th><th>Monto</th><th>Enviado por</th><th>Evidencia</th><th>Acción</th></tr></thead><tbody>${pend.map(p=>`<tr><td><b>${esc(p.student_name)}</b><br><small>${esc(p.player_id)}</small></td><td>${p.payment_date}</td><td>${esc(p.period||'')}</td><td class="amount">${money(p.amount)}</td><td>${esc(p.submitted_by||'')}</td><td>${p.evidence_url?`<a class="btn secondary" target="_blank" href="${p.evidence_url}">Ver evidencia</a>`:'-'}</td><td><button class="btn green" onclick="confirmPayment('${p.id}')">Confirmar</button> <button class="btn red" onclick="rejectPayment('${p.id}')">Rechazar</button></td></tr>`).join('')||'<tr><td colspan="7">No hay evidencias pendientes.</td></tr>'}</tbody></table></div></div>`;
}
function renderWhatsApp(){
  setTitle('WhatsApp vencidos');
  const rows=players.map(p=>({...p,c:calc(p)})).filter(p=>p.c.status==='Vencido'&&p.phone).sort((a,b)=>b.c.amount-a.c.amount);
  document.getElementById('content').innerHTML=`<div class="notice warning"><b>Enviar recordatorios:</b> cada botón abre WhatsApp con el mensaje listo.</div><div class="panel"><div class="panel-head"><h3>Jugadores vencidos con WhatsApp</h3></div><div class="tablewrap"><table><thead><tr><th>ID</th><th>Jugador</th><th>Tutor</th><th>WhatsApp</th><th>Meses</th><th>Adeudo</th><th>Acción</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${p.id}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.tutor||'')}</td><td>${esc(p.phone||'')}</td><td>${p.c.months}</td><td class="amount">${money(p.c.amount)}</td><td>${whatsappButtons(p)}</td></tr>`).join('')||'<tr><td colspan="7">No hay jugadores vencidos con WhatsApp registrado.</td></tr>'}</tbody></table></div></div>`;
}


function renderDocuments(){
  setTitle('Documentos de jugadores');
  const rows = documents.map(d=>{
    const p = players.find(x=>x.id===d.player_id) || {};
    const a = parentAccounts.find(x=>x.id===d.parent_account_id) || {};
    return {...d, player_name:p.name||d.player_name||'', tutor:p.tutor||'', parent_name:a.display_name||'', parent_login:a.login||''};
  });
  document.getElementById('content').innerHTML=`<div class="notice success"><b>Documentos privados:</b> aquí puedes consultar todos los documentos enviados por papás. Cada papá solo ve los documentos de sus hijos en su portal.</div>
  <div class="kpis">
    <div class="kpi"><small>Documentos</small><strong>${documents.length}</strong></div>
    <div class="kpi"><small>Jugadores con docs</small><strong>${new Set(documents.map(d=>d.player_id)).size}</strong></div>
    <div class="kpi"><small>Actas</small><strong>${documents.filter(d=>String(d.document_type).includes('Acta')).length}</strong></div>
    <div class="kpi"><small>CURP</small><strong>${documents.filter(d=>String(d.document_type).includes('CURP')).length}</strong></div>
  </div>
  <div class="panel">
    <div class="panel-head"><h3>Documentos cargados</h3><button class="btn secondary" onclick="exportDocumentsCSV()">Exportar CSV</button></div>
    <div class="tablewrap"><table><thead><tr><th>Jugador</th><th>Tutor</th><th>Tipo</th><th>Documento</th><th>Subido por</th><th>Fecha</th><th>Archivo</th><th>Notas</th></tr></thead><tbody>
      ${rows.map(d=>`<tr><td><b>${esc(d.player_name)}</b><br><small>${esc(d.player_id)}</small></td><td>${esc(d.tutor||'')}</td><td>${esc(d.document_type||'')}</td><td>${esc(d.title||'')}</td><td>${esc(d.parent_name||d.submitted_by||'')}<br><small>${esc(d.parent_login||'')}</small></td><td>${esc(String(d.created_at||'').slice(0,10))}</td><td><a class="btn secondary" target="_blank" href="${d.file_url}">Ver</a></td><td>${esc(d.notes||'')}</td></tr>`).join('')||'<tr><td colspan="8">Aún no hay documentos.</td></tr>'}
    </tbody></table></div>
  </div>`;
}
function exportDocumentsCSV(){
  const d = backupDate();
  const rows = documents.map(doc=>{
    const p = players.find(x=>x.id===doc.player_id) || {};
    const a = parentAccounts.find(x=>x.id===doc.parent_account_id) || {};
    return {...doc, player_name:p.name||'', tutor:p.tutor||'', parent_name:a.display_name||'', parent_login:a.login||''};
  });
  const headers=[
    {label:'ID documento',key:'id'}, {label:'ID jugador',key:'player_id'}, {label:'Jugador',key:'player_name'},
    {label:'Tutor',key:'tutor'}, {label:'Tipo',key:'document_type'}, {label:'Titulo',key:'title'},
    {label:'Subido por',key:'parent_name'}, {label:'Usuario papá',key:'parent_login'},
    {label:'Archivo URL',key:'file_url'}, {label:'Archivo nombre',key:'file_name'},
    {label:'Mime',key:'file_mime'}, {label:'Notas',key:'notes'}, {label:'Creado',key:'created_at'}
  ];
  downloadText(`ducks_documentos_jugadores_${d}.csv`, toCSV(rows, headers));
}

function renderBackups(){
  setTitle('Respaldos / Exportar información');
  const debts = players.map(p=>calc(p));
  const totalDebt = debts.reduce((sum,c)=>sum + Number(c.amount||0),0);
  const overdue = debts.filter(c=>c.status==='Vencido').length;
  const pendingEvidence = payments.filter(p=>p.confirmation_status==='Pendiente de confirmación').length;
  document.getElementById('content').innerHTML=`<div class="notice success"><b>Respaldos rápidos:</b> descarga la información principal del CRM en CSV o JSON. Los comprobantes y fotos se exportan como liga URL hacia Supabase Storage.</div>
  <div class="kpis">
    <div class="kpi"><small>Jugadores</small><strong>${players.length}</strong></div>
    <div class="kpi"><small>Pagos</small><strong>${payments.length}</strong></div>
    <div class="kpi"><small>Cuentas papás</small><strong>${parentAccounts.length}</strong></div>
    <div class="kpi"><small>Relaciones</small><strong>${parentLinks.length}</strong></div>
    <div class="kpi orange"><small>Por confirmar</small><strong>${pendingEvidence}</strong></div>
    <div class="kpi red"><small>Adeudo total</small><strong>${money(totalDebt)}</strong></div>
  </div>

  <div class="backup-grid">
    <div class="backup-card">
      <div><h3>Jugadores</h3><p>Datos generales, tutor, WhatsApp, categoría, mensualidad, uniforme y foto URL.</p></div>
      <button class="btn green" onclick="exportCSV('players')">Descargar CSV</button>
    </div>
    <div class="backup-card">
      <div><h3>Pagos</h3><p>Historial de pagos, estatus, método, evidencia URL, notas y confirmaciones.</p></div>
      <button class="btn green" onclick="exportCSV('payments')">Descargar CSV</button>
    </div>
    <div class="backup-card">
      <div><h3>Cuentas de papás</h3><p>Usuarios, nombres, WhatsApp, clave temporal y estado de cuenta.</p></div>
      <button class="btn green" onclick="exportCSV('parents')">Descargar CSV</button>
    </div>
    <div class="backup-card">
      <div><h3>Papá → jugador</h3><p>Relación entre cuentas de papás y jugadores asignados.</p></div>
      <button class="btn green" onclick="exportCSV('links')">Descargar CSV</button>
    </div>
    <div class="backup-card">
      <div><h3>Adeudos</h3><p>Reporte calculado con último pago, meses pendientes, adeudo y estatus.</p></div>
      <button class="btn green" onclick="exportCSV('debts')">Descargar CSV</button>
    </div>
    <div class="backup-card">
      <div><h3>Documentos</h3><p>Listado de documentos cargados por jugador con sus ligas URL.</p></div>
      <button class="btn green" onclick="exportDocumentsCSV()">Descargar CSV</button>
    </div>
    <div class="backup-card featured">
      <div><h3>Respaldo completo</h3><p>Archivo JSON con jugadores, pagos, cuentas, relaciones, documentos y adeudos calculados.</p></div>
      <button class="btn" onclick="exportFullJSON()">Descargar JSON</button>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head"><h3>Recomendación de respaldo</h3></div>
    <div class="modal-body">
      <p><b>Frecuencia sugerida:</b> descarga respaldo completo una vez por semana y antes de hacer cambios importantes.</p>
      <p><b>Comprobantes y fotos:</b> este módulo exporta las ligas. Para descargar físicamente los archivos, entra a Supabase Storage > ducks-files.</p>
      <p><b>Restauración:</b> el CSV sirve para revisar y reimportar datos; el JSON sirve como copia completa de consulta.</p>
    </div>
  </div>`;
}


function renderPlayerHistory(){
  setTitle('Historial de cambios de jugadores');
  const rows = playerHistory.map(h=>{
    const p = players.find(x=>x.id===h.player_id) || {};
    const changes = Array.isArray(h.changes) ? h.changes : [];
    return {...h, player_name:p.name||h.after_data?.name||h.before_data?.name||'', changes_list:changes};
  });
  document.getElementById('content').innerHTML=`<div class="notice success"><b>Auditoría:</b> cada edición de jugador se guarda con fecha, usuario, datos anteriores y datos nuevos.</div>
  <div class="panel">
    <div class="panel-head"><h3>Últimos cambios</h3><button class="btn secondary" onclick="exportPlayerHistoryCSV()">Exportar CSV</button></div>
    <div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Jugador</th><th>Acción</th><th>Cambió</th><th>Campos modificados</th><th>Detalle</th></tr></thead><tbody>
      ${rows.map(h=>`<tr><td>${esc(String(h.created_at||'').replace('T',' ').slice(0,19))}</td><td><b>${esc(h.player_name)}</b><br><small>${esc(h.player_id)}</small></td><td>${esc(h.action||'')}</td><td>${esc(h.changed_by||'')}</td><td>${h.changes_list.length?h.changes_list.map(c=>`<span class="history-chip">${esc(fieldLabel(c.field))}</span>`).join(' '):'-'}</td><td><button class="btn secondary" onclick="openHistoryDetail('${h.id}')">Ver</button></td></tr>`).join('')||'<tr><td colspan="6">Aún no hay historial.</td></tr>'}
    </tbody></table></div>
  </div>`;
}
function openPlayerHistory(playerId){
  page='history';
  renderPlayerHistory();
  setTimeout(()=>{
    const rows = playerHistory.filter(h=>h.player_id===playerId);
    if(!rows.length){ toast('Este jugador aún no tiene historial.'); return; }
    openHistoryDetail(rows[0].id);
  },80);
}
function openHistoryDetail(historyId){
  const h = playerHistory.find(x=>x.id===historyId);
  if(!h){ toast('Historial no encontrado'); return; }
  const p = players.find(x=>x.id===h.player_id) || {};
  const changes = Array.isArray(h.changes) ? h.changes : [];
  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='historyModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>Detalle de cambio</h3><button class="btn secondary" onclick="closeModal('historyModal')">Cerrar</button></div><div class="modal-body">
    <div class="history-summary">
      <b>${esc(p.name||h.after_data?.name||h.before_data?.name||'Jugador')}</b>
      <span>${esc(String(h.created_at||'').replace('T',' ').slice(0,19))}</span>
      <small>Modificado por: ${esc(h.changed_by||'')}</small>
    </div>
    <div class="tablewrap"><table><thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead><tbody>
      ${changes.map(c=>`<tr><td><b>${esc(fieldLabel(c.field))}</b></td><td>${esc(c.old_value)}</td><td>${esc(c.new_value)}</td></tr>`).join('')||'<tr><td colspan="3">Sin diferencias registradas.</td></tr>'}
    </tbody></table></div>
  </div></div>`;
  document.body.appendChild(modal);
}
function exportPlayerHistoryCSV(){
  const d = backupDate();
  const rows = [];
  playerHistory.forEach(h=>{
    const p = players.find(x=>x.id===h.player_id) || {};
    const changes = Array.isArray(h.changes) ? h.changes : [];
    if(!changes.length){
      rows.push({...h, player_name:p.name||'', field:'', old_value:'', new_value:''});
    }else{
      changes.forEach(c=>rows.push({...h, player_name:p.name||'', field:fieldLabel(c.field), old_value:c.old_value, new_value:c.new_value}));
    }
  });
  const headers=[
    {label:'Fecha',key:'created_at'}, {label:'ID jugador',key:'player_id'}, {label:'Jugador',key:'player_name'},
    {label:'Acción',key:'action'}, {label:'Cambió',key:'changed_by'}, {label:'Campo',key:'field'},
    {label:'Antes',key:'old_value'}, {label:'Después',key:'new_value'}
  ];
  downloadText(`ducks_historial_jugadores_${d}.csv`, toCSV(rows, headers));
}

function renderSettings(){ setTitle('Configuración'); document.getElementById('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>Configuración</h3></div><div class="modal-body"><div class="notice"><b>Link público:</b><br><a href="${window.DUCKS_PORTAL_URL||location.origin}" target="_blank">${window.DUCKS_PORTAL_URL||location.origin}</a></div><p>El acceso de papás se crea desde el módulo Papás.</p></div></div>`; }

/* CRUD */
async function uploadFile(file, folder){
  if(!file) return '';
  const clean=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=`${folder}/${Date.now()}_${clean}`;
  const {error}=await sb.storage.from('ducks-files').upload(path,file,{upsert:false});
  if(error) throw error;
  const {data}=sb.storage.from('ducks-files').getPublicUrl(path);
  return data.publicUrl;
}
function closeModal(id){ const el=document.getElementById(id); if(el) el.remove(); }
function openPlayerForm(id=''){
  const p=id?players.find(x=>x.id===id):null;
  const modal=document.createElement('div'); modal.className='modalbg open'; modal.id='playerModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>${p?'Editar jugador':'Nuevo jugador'}</h3><button class="btn secondary" onclick="closeModal('playerModal')">Cerrar</button></div><div class="modal-body"><form id="playerForm" class="form-grid">
    <label class="label">ID jugador<input id="pId" class="input" value="${esc(p?.id||nextId())}" ${p?'readonly':''} required></label><label class="label">Nombre<input id="pName" class="input" value="${esc(p?.name||'')}" required></label><label class="label">Tutor principal<input id="pTutor" class="input" value="${esc(p?.tutor||'')}"></label><label class="label">WhatsApp principal<input id="pPhone" class="input" value="${esc(p?.phone||'')}"></label><label class="label">Tutor secundario<input id="pTutor2" class="input" value="${esc(p?.tutor_2||'')}" placeholder="Opcional"></label><label class="label">WhatsApp secundario<input id="pPhone2" class="input" value="${esc(p?.tutor_phone_2||'')}" placeholder="Opcional"></label><label class="label">Categoría<input id="pCategory" class="input" value="${esc(p?.category||'')}"></label><label class="label">Estado<select id="pStatus" class="select"><option ${p?.status==='Activo'?'selected':''}>Activo</option><option ${p?.status==='Inactivo'?'selected':''}>Inactivo</option><option ${p?.status==='Baja'?'selected':''}>Baja</option></select></label><label class="label">Mensualidad<input id="pFee" class="input" type="number" min="0" step="50" value="${esc(p?.monthly_fee||300)}"></label><label class="label">Día de pago<input id="pDay" class="input" type="number" min="1" max="31" value="${esc(p?.payment_day||5)}"></label><label class="label">Número uniforme<input id="pUniform" class="input" value="${esc(p?.uniform_number||'')}"></label><label class="label">Foto<input id="pPhoto" class="input" type="file" accept="image/*"></label><label class="label full">Notas<textarea id="pNotes" class="input">${esc(p?.notes||'')}</textarea></label><div class="full actions"><button class="btn green">Guardar jugador</button></div></form></div></div>`;
  document.body.appendChild(modal);
  document.getElementById('playerForm').onsubmit=(e)=>savePlayerForm(e,p);
}
async function savePlayerForm(e, oldPlayer){
  e.preventDefault();
  const id=document.getElementById('pId').value.trim();
  const file=document.getElementById('pPhoto').files[0];
  let photo_url=oldPlayer?.photo_url||'';
  try{
    if(file) photo_url=await uploadFile(file,'fotos');
    const row={
      id,
      name:document.getElementById('pName').value.trim(),
      tutor:document.getElementById('pTutor').value.trim(),
      phone:normalizePhone(document.getElementById('pPhone').value),
      tutor_2:document.getElementById('pTutor2')?.value.trim()||'',
      tutor_phone_2:normalizePhone(document.getElementById('pPhone2')?.value||''),
      category:document.getElementById('pCategory').value.trim(),
      status:document.getElementById('pStatus').value,
      monthly_fee:Number(document.getElementById('pFee').value||0),
      payment_day:Number(document.getElementById('pDay').value||1),
      uniform_number:document.getElementById('pUniform').value.trim(),
      photo_url,
      notes:document.getElementById('pNotes').value.trim()
    };

    const beforeSnapshot = oldPlayer ? compactPlayerSnapshot(oldPlayer) : {};
    const afterSnapshot = compactPlayerSnapshot(row);

    const result = oldPlayer
      ? await sb.from('players').update(row).eq('id',oldPlayer.id)
      : await sb.from('players').insert(row);

    if(result.error) throw result.error;

    await savePlayerHistory(id, beforeSnapshot, afterSnapshot, oldPlayer ? 'update' : 'create');

    toast(oldPlayer ? 'Jugador actualizado. Historial guardado.' : 'Jugador agregado. Historial guardado.');
    closeModal('playerModal');
    await refresh();
  }catch(err){
    toast('Error: '+err.message);
  }
}
async function deletePlayer(id){const p=players.find(x=>x.id===id); if(!p)return; if(!confirm(`¿Eliminar a ${p.name}? También se eliminarán sus pagos.`))return; const {error}=await sb.from('players').delete().eq('id',id); if(error)toast(error.message); else{toast('Jugador eliminado'); await refresh();}}
function openPaymentForm(playerId=''){
  const selected=playerId?players.find(p=>p.id===playerId):null;
  const modal=document.createElement('div'); modal.className='modalbg open'; modal.id='paymentModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>Registrar pago confirmado</h3><button class="btn secondary" onclick="closeModal('paymentModal')">Cerrar</button></div><div class="modal-body"><form id="paymentForm" class="form-grid"><label class="label full">Jugador<select id="payPlayer" class="select" required><option value="">Selecciona...</option>${players.map(p=>`<option value="${p.id}" ${p.id===playerId?'selected':''}>${p.id} · ${esc(p.name)}</option>`).join('')}</select></label><label class="label">Fecha<input id="payDate" class="input" type="date" value="${todayISO()}" required></label><label class="label">Periodo<input id="payPeriod" class="input" value="${period(todayISO())}"></label><label class="label">Monto<input id="payAmount" class="input" type="number" min="0" step="50" value="${esc(selected?.monthly_fee||300)}" required></label><label class="label">Método<select id="payMethod" class="select"><option></option><option>Transferencia</option><option>Depósito</option><option>Efectivo</option><option>Tarjeta</option><option>Otro</option></select></label><label class="label">Evidencia opcional<input id="payEvidence" class="input" type="file" accept="image/*,application/pdf"></label><label class="label full">Notas<textarea id="payNotes" class="input"></textarea></label><div class="full actions"><button class="btn green">Guardar pago confirmado</button></div></form></div></div>`;
  document.body.appendChild(modal);
  document.getElementById('payPlayer').onchange=()=>{const p=players.find(x=>x.id===document.getElementById('payPlayer').value); if(p) document.getElementById('payAmount').value=p.monthly_fee||0;};
  document.getElementById('paymentForm').onsubmit=savePaymentForm;
}
async function savePaymentForm(e){
  e.preventDefault();
  const player_id=document.getElementById('payPlayer').value; const player=players.find(p=>p.id===player_id); const file=document.getElementById('payEvidence').files[0];
  try{ const evidence_url=file?await uploadFile(file,'evidencias'):''; const row={player_id,student_name:player?.name||'',payment_date:document.getElementById('payDate').value,period:document.getElementById('payPeriod').value||period(document.getElementById('payDate').value),amount:Number(document.getElementById('payAmount').value||0),method:document.getElementById('payMethod').value,notes:document.getElementById('payNotes').value,confirmation_status:'Confirmado',evidence_url,evidence_name:file?.name||'',submitted_by:'Admin',confirmed_at:new Date().toISOString()}; const {error}=await sb.from('payments').insert(row); if(error) throw error; toast('Pago guardado y confirmado'); closeModal('paymentModal'); await refresh(); page='payments'; renderPage(); }catch(err){toast('Error: '+err.message);}
}
async function confirmPayment(id){const {error}=await sb.from('payments').update({confirmation_status:'Confirmado',confirmed_at:new Date().toISOString()}).eq('id',id); if(error)toast(error.message); else{toast('Pago confirmado'); await refresh();}}
async function rejectPayment(id){const {error}=await sb.from('payments').update({confirmation_status:'Rechazado'}).eq('id',id); if(error)toast(error.message); else{toast('Pago rechazado'); await refresh();}}
async function deletePayment(id){if(!confirm('¿Eliminar pago?'))return; const {error}=await sb.from('payments').delete().eq('id',id); if(error)toast(error.message); else{toast('Pago eliminado'); await refresh();}}

window.renderPublicHome=renderPublicHome; window.renderParentLogin=renderParentLogin; window.renderAdminLogin=renderAdminLogin; window.renderLogin=renderAdminLogin; window.parentLogout=parentLogout; window.copyBank=copyBank; window.openParentPayment=openParentPayment; window.openParentDocument=openParentDocument; window.installDucksApp=installDucksApp; window.goBackSmart=goBackSmart; window.openPlayerForm=openPlayerForm; window.deletePlayer=deletePlayer; window.openPaymentForm=openPaymentForm; window.confirmPayment=confirmPayment; window.rejectPayment=rejectPayment; window.deletePayment=deletePayment; window.closeModal=closeModal; window.copyReminder=copyReminder; window.deleteParentLink=deleteParentLink; window.prefillParent=prefillParent; window.exportCSV=exportCSV; window.exportFullJSON=exportFullJSON; window.exportDocumentsCSV=exportDocumentsCSV; window.resetParentPassword=resetParentPassword; window.autoLinkAccountFromButton=autoLinkAccountFromButton;

init();

window.parentChangeOwnPassword=parentChangeOwnPassword; window.parentExitToHome=parentExitToHome;

window.openParentPayNow=openParentPayNow;

window.copyDefaultPaymentData=copyDefaultPaymentData;

window.openPlayerHistory=openPlayerHistory; window.openHistoryDetail=openHistoryDetail; window.exportPlayerHistoryCSV=exportPlayerHistoryCSV;
