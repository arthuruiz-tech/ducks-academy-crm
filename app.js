// Ducks CRM profesional v2.8 - página pública + portal privado de papás
const app = document.getElementById('app');
let sb = null;
let session = null;
let mode = 'public'; // public | parentLogin | parentPortal | adminLogin | admin
let page = 'dashboard';
let players = [];
let payments = [];
let parentLinks = [];
let parentPlayers = [];
let parentPayments = [];
let q = '';

const BANK_ACCOUNT = '157 889 8256';
const BANK_CLABE = '012 180 01578898256 3';
const BANK_NAME = 'BBVA';
const BANK_BENEFICIARY = 'DUCKS BASKETBALL';

function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); }
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function money(n){return Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});}
function todayISO(){return new Date().toISOString().slice(0,10);}
function period(date){return String(date||'').slice(0,7);}
function statusClass(s){return String(s||'').replace(/\s+/g,'');}
function thumb(url){return url?`<div class="thumb"><img src="${url}"></div>`:`<div class="thumb"><div class="emptythumb">Sin foto</div></div>`;}
function isConfigured(){ return window.DUCKS_SUPABASE_URL && window.DUCKS_SUPABASE_ANON_KEY; }
function normalizePhone(v){ const d=String(v||'').replace(/\D/g,''); if(!d)return ''; if(d.startsWith('52')&&d.length===12)return '+'+d; if(d.length===10)return '+52'+d; if(d.length>=11&&d.length<=15)return '+'+d; return String(v||'').trim(); }
function nextId(){ const max=players.reduce((m,p)=>Math.max(m,Number(String(p.id||'').replace(/\D/g,''))||0),0); return 'D'+String(max+1).padStart(3,'0'); }
function playerPhotoUrl(p){ return p?.photo_url || 'assets/logo.png'; }

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
  const c = calc(player);
  const monthsText = c.months > 1 ? `, correspondiente a ${c.months} meses de adeudo.` : '.';
  return `Hola, buen día. Les recordamos amablemente que está pendiente el pago de la mensualidad de Ducks Basketball Academy por ${money(c.amount)}${monthsText}\n\nPara facilitar el proceso, pueden ingresar al Portal de Papás:\n${window.DUCKS_PORTAL_URL || location.origin}\n\nAgradecemos mucho su apoyo para mantener el control administrativo. 🏀🦆`;
}
function whatsappUrl(player){
  const phone = String(player.phone||'').replace(/\D/g,'');
  if(!phone) return '';
  return `https://wa.me/${phone}?text=${encodeURIComponent(reminderMessage(player))}`;
}
function whatsappButtons(player){
  const c = calc(player);
  if(c.status !== 'Vencido' || !player.phone) return '';
  return `<button class="btn secondary" onclick="copyReminder('${player.id}')">Copiar</button><a class="btn green" target="_blank" rel="noopener" href="${whatsappUrl(player)}">WhatsApp</a>`;
}
async function copyReminder(id){
  const p=players.find(x=>x.id===id);
  if(!p) return;
  await navigator.clipboard.writeText(reminderMessage(p));
  toast('Mensaje de WhatsApp copiado');
}
async function copyBank(value, label){
  const clean = String(value||'').replace(/\s+/g,' ');
  try{ await navigator.clipboard.writeText(clean); toast(label + ' copiada'); }
  catch(e){ toast('Copia manualmente: ' + clean); }
}

async function init(){
  if(!isConfigured()){ renderSetup(); return; }
  sb = window.supabase.createClient(window.DUCKS_SUPABASE_URL, window.DUCKS_SUPABASE_ANON_KEY);
  const {data} = await sb.auth.getSession();
  session = data.session;
  renderPublicHome();
}
function renderSetup(){
  app.innerHTML=`<div class="public-site"><div class="academy-main"><div class="parent-card"><h1>Configurar Supabase</h1><div class="notice warning">Falta configurar config.js.</div></div></div></div>`;
}

/* Página pública */
function renderPublicHome(){
  mode='public';
  app.innerHTML=`<div class="public-site">
    <header class="academy-menu">
      <div class="academy-menu-inner">
        <a class="academy-brand" href="#inicio"><img src="assets/logo.png" alt="Ducks"><span>Ducks Basketball Academy</span></a>
        <nav class="academy-links">
          <a href="#inicio">Inicio</a>
          <button type="button" class="primary-menu-btn" onclick="renderParentLogin()">Portal de Papás</button>
          <a href="#calendario">Calendario</a>
          <a href="#academia">Academia</a>
          <a href="#contacto">Contacto</a>
        </nav>
        <button class="btn secondary academy-admin" onclick="renderAdminLogin()">Soy administrador</button>
      </div>
    </header>

    <main class="academy-main">
      <section id="inicio" class="academy-ribbon ribbon-hq">
        <div class="court-lines"></div>
        <div class="ribbon-ball"></div>
        <div class="ribbon-content">
          <img class="ribbon-logo" src="assets/logo.png" alt="Ducks Basketball Academy">
          <div class="ribbon-text">
            <span class="ribbon-kicker">Portal oficial de la academia</span>
            <h1>Ducks Basketball Academy</h1>
            <p>Entrenamiento, disciplina y desarrollo deportivo para niños y jóvenes.</p>
            <div class="ribbon-actions">
              <button class="btn green ribbon-btn" onclick="renderParentLogin()">Entrar al Portal de Papás</button>
              <a href="#academia" class="btn secondary ribbon-btn">Conocer la academia</a>
            </div>
          </div>
        </div>
      </section>

      <section class="quick-parent-card">
        <div>
          <h2>Pagos y comprobantes</h2>
          <p>El Portal de Papás es privado. Cada familia entra con usuario y contraseña para ver únicamente la información de sus hijos.</p>
        </div>
        <button class="btn green" onclick="renderParentLogin()">Entrar al Portal de Papás</button>
      </section>

      <section id="calendario" class="academy-section">
        <h2>Calendario de Juegos</h2>
        <p>Próximamente aquí podrás consultar juegos, torneos, horarios, sedes y categorías.</p>
        <div class="coming-soon"><span>🏀</span><b>Calendario en preparación</b><small>Consulta avisos oficiales de la academia mientras se activa este módulo.</small></div>
      </section>

      <section id="academia" class="academy-section">
        <h2>Academia</h2>
        <p>Ducks Basketball Academy impulsa la disciplina, el trabajo en equipo y el desarrollo deportivo de niños y jóvenes.</p>
        <div class="academy-grid">
          <div><b>Entrenamiento</b><small>Fundamentos, técnica y desarrollo físico.</small></div>
          <div><b>Competencia</b><small>Juegos, torneos y seguimiento por categoría.</small></div>
          <div><b>Comunidad</b><small>Comunicación clara con papás y control administrativo.</small></div>
        </div>
      </section>

      <section id="contacto" class="academy-section contact-section">
        <h2>Contacto</h2>
        <p>Para dudas sobre pagos, entrenamientos, calendario o comprobantes, comunícate con la administración de Ducks Basketball Academy.</p>
        <button class="btn green" onclick="renderParentLogin()">Ir al Portal de Papás</button>
      </section>
    </main>
  </div>`;
}

/* Login papás */
function renderParentLogin(){
  mode='parentLogin';
  app.innerHTML=`<div class="public-site">
    <header class="academy-menu"><div class="academy-menu-inner">
      <a class="academy-brand" href="#" onclick="renderPublicHome()"><img src="assets/logo.png"><span>Ducks Basketball Academy</span></a>
      <nav class="academy-links"><button onclick="renderPublicHome()">Inicio</button><button class="primary-menu-btn" onclick="renderParentLogin()">Portal de Papás</button><button onclick="renderAdminLogin()">Soy administrador</button></nav>
    </div></header>
    <main class="academy-main">
      <div class="login-card">
        <div class="parent-title"><img src="assets/logo.png"><div><h1>Portal de Papás</h1><div class="sub">Acceso privado por familia</div></div></div>
        <div class="notice success"><b>Protección de información:</b> al iniciar sesión solo podrás ver a tus hijos asignados.</div>
        <form id="parentLoginForm" class="parent-form">
          <label class="label full">Correo del papá / tutor<input id="parentEmail" class="input" type="email" required placeholder="correo@ejemplo.com"></label>
          <label class="label full">Contraseña<input id="parentPassword" class="input" type="password" required placeholder="Contraseña"></label>
          <div class="full"><button class="btn green" style="width:100%;font-size:18px;padding:14px">Entrar al Portal de Papás</button></div>
        </form>
        <div class="sub" style="margin-top:12px">Las cuentas son creadas por administración. Si no tienes acceso, solicita tu usuario.</div>
      </div>
    </main>
  </div>`;
  document.getElementById('parentLoginForm').onsubmit=parentLogin;
}
async function parentLogin(e){
  e.preventDefault();
  const email=document.getElementById('parentEmail').value.trim();
  const password=document.getElementById('parentPassword').value;
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){toast('No se pudo iniciar sesión: '+error.message); return;}
  session=data.session;
  await loadParentData();
  renderParentPortal();
}
async function loadParentData(){
  const email=session?.user?.email;
  parentPlayers=[]; parentPayments=[]; parentLinks=[];
  const links=await sb.from('parent_player_links').select('*').eq('parent_email',email).eq('active',true);
  if(links.error){toast('Error cargando relación de jugadores: '+links.error.message); return;}
  parentLinks=links.data||[];
  const ids=parentLinks.map(x=>x.player_id);
  if(!ids.length) return;
  const pr=await sb.from('players').select('id,name,category,uniform_number,monthly_fee,payment_day,status,photo_url').in('id',ids).order('name');
  if(pr.error){toast('Error cargando jugadores: '+pr.error.message); return;}
  parentPlayers=pr.data||[];
  const py=await sb.from('payments').select('*').in('player_id',ids).order('created_at',{ascending:false});
  if(py.error){toast('Error cargando pagos: '+py.error.message); return;}
  parentPayments=py.data||[];
}
function renderParentPortal(){
  mode='parentPortal';
  const cards = parentPlayers.map(p=>{
    const c=calc(p,parentPayments);
    const history=parentPayments.filter(x=>x.player_id===p.id).slice(0,6);
    return `<div class="family-player-card">
      <div class="family-head">
        <img src="${playerPhotoUrl(p)}" alt="">
        <div>
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.category||'')} · Uniforme #${esc(p.uniform_number||'-')}</p>
          <span class="status ${c.status}">${c.status}</span>
        </div>
      </div>
      <div class="family-kpis">
        <div><small>Último pago</small><b>${esc(c.last||'Sin registro')}</b></div>
        <div><small>Meses pendientes</small><b>${c.months}</b></div>
        <div><small>Adeudo actual</small><b class="amount">${money(c.amount)}</b></div>
      </div>
      <details class="history-box">
        <summary>Ver historial y comprobantes</summary>
        ${history.length?`<table class="mini-table"><thead><tr><th>Fecha</th><th>Monto</th><th>Estatus</th><th>Evidencia</th></tr></thead><tbody>${history.map(h=>`<tr><td>${esc(h.payment_date)}</td><td>${money(h.amount)}</td><td><span class="status ${statusClass(h.confirmation_status)}">${esc(h.confirmation_status)}</span></td><td>${h.evidence_url?`<a target="_blank" href="${h.evidence_url}">Ver</a>`:'-'}</td></tr>`).join('')}</tbody></table>`:'<p class="sub">Sin pagos registrados.</p>'}
      </details>
      <button class="btn green" onclick="openParentPayment('${p.id}')">Subir comprobante de este jugador</button>
    </div>`;
  }).join('');
  app.innerHTML=`<div class="public-site">
    <header class="academy-menu"><div class="academy-menu-inner">
      <a class="academy-brand" href="#" onclick="renderParentPortal()"><img src="assets/logo.png"><span>Portal de Papás</span></a>
      <nav class="academy-links"><button onclick="renderParentPortal()">Mis hijos</button><button onclick="openParentPayment()">Subir comprobante</button></nav>
      <button class="btn secondary academy-admin" onclick="logoutToHome()">Cerrar sesión</button>
    </div></header>
    <main class="academy-main">
      <section class="academy-ribbon private-ribbon">
        <div class="court-lines"></div>
        <div class="ribbon-content">
          <img class="ribbon-logo small" src="assets/logo.png" alt="Ducks">
          <div class="ribbon-text">
            <span class="ribbon-kicker">Acceso privado</span>
            <h1>Bienvenido al Portal de Papás</h1>
            <p>Solo se muestra la información de los jugadores asignados a tu familia.</p>
          </div>
        </div>
      </section>

      <section class="parent-card">
        <div class="parent-title"><img src="assets/logo.png"><div><h1>Mis jugadores</h1><div class="sub">${esc(session?.user?.email||'')}</div></div></div>
        ${parentPlayers.length?`<div class="family-grid">${cards}</div>`:`<div class="notice warning">Tu cuenta aún no tiene jugadores asignados. Contacta a administración.</div>`}
      </section>

      <section class="bank-card">
        <div class="bank-head"><div><span class="bank-chip">BBVA MX</span><h2>Datos para depósito o transferencia</h2><p>Copia la cuenta o CLABE, realiza tu pago y después adjunta el comprobante.</p></div><img src="assets/logo.png" alt="Ducks"></div>
        <div class="bank-grid">
          <div class="bank-item"><small>Cuenta</small><strong>${BANK_ACCOUNT}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_ACCOUNT,'Cuenta')">Copiar cuenta</button></div>
          <div class="bank-item"><small>CLABE</small><strong>${BANK_CLABE}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_CLABE,'CLABE')">Copiar CLABE</button></div>
          <div class="bank-item full"><small>Beneficiario / referencia</small><strong>${BANK_BENEFICIARY}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_BENEFICIARY,'Beneficiario')">Copiar beneficiario</button></div>
        </div>
      </section>
    </main>
  </div>`;
}
function openParentPayment(playerId=''){
  if(!parentPlayers.length){toast('No tienes jugadores asignados.'); return;}
  const selected = playerId ? parentPlayers.find(p=>p.id===playerId) : parentPlayers[0];
  const options = parentPlayers.map(p=>`<option value="${p.id}" ${p.id===selected.id?'selected':''}>${esc(p.name)} · #${esc(p.uniform_number||'-')}</option>`).join('');
  const modal=document.createElement('div'); modal.className='modalbg open'; modal.id='parentPayModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>Subir comprobante</h3><button class="btn secondary" onclick="closeModal('parentPayModal')">Cerrar</button></div><div class="modal-body">
    <div class="notice success"><b>Pago seguro:</b> confirma que el jugador seleccionado sea correcto antes de enviar.</div>
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
  if(!parentPlayers.some(p=>p.id===player_id)){toast('Jugador no autorizado para esta cuenta.'); return;}
  const player=parentPlayers.find(p=>p.id===player_id);
  const file=document.getElementById('parentPayEvidence').files[0];
  try{
    const evidence_url=await uploadFile(file,'evidencias');
    const payDate=document.getElementById('parentPayDate').value;
    const row={player_id,student_name:player?.name||'',payment_date:payDate,period:period(payDate),amount:Number(document.getElementById('parentPayAmount').value||0),method:document.getElementById('parentPayMethod').value,submitted_by:session?.user?.email||'Papá',notes:document.getElementById('parentPayNotes').value,confirmation_status:'Pendiente de confirmación',evidence_url,evidence_name:file.name};
    const {error}=await sb.from('payments').insert(row);
    if(error) throw error;
    closeModal('parentPayModal');
    toast('Comprobante enviado. Queda pendiente de confirmación.');
    await loadParentData();
    renderParentPortal();
  }catch(err){toast('Error: '+err.message);}
}

/* Login admin */
function renderAdminLogin(){
  mode='adminLogin';
  app.innerHTML = `<div class="public-site"><header class="academy-menu"><div class="academy-menu-inner"><a class="academy-brand" href="#" onclick="renderPublicHome()"><img src="assets/logo.png"><span>Ducks Basketball Academy</span></a><nav class="academy-links"><button onclick="renderPublicHome()">Inicio</button><button onclick="renderParentLogin()">Portal de Papás</button></nav></div></header>
  <main class="academy-main"><div class="login-card">
    <div class="parent-title"><img src="assets/logo.png"><div><h1>Administrador</h1><div class="sub">Acceso interno Ducks</div></div></div>
    <form id="loginForm" class="parent-form">
      <label class="label full">Email<input id="loginEmail" class="input" type="email" required></label>
      <label class="label full">Password<input id="loginPassword" class="input" type="password" required></label>
      <div class="full"><button class="btn green">Entrar como administrador</button></div>
    </form>
  </div></main></div>`;
  document.getElementById('loginForm').onsubmit=login;
}
async function login(e){
  e.preventDefault();
  const {data,error}=await sb.auth.signInWithPassword({email:document.getElementById('loginEmail').value,password:document.getElementById('loginPassword').value});
  if(error){toast(error.message);return;}
  session=data.session; mode='admin'; page='dashboard'; renderShell(); await loadAdminData(); renderPage();
}
async function logoutToHome(){ await sb.auth.signOut(); session=null; renderPublicHome(); }
async function logout(){ await logoutToHome(); }

/* Data admin */
async function loadAdminData(){
  const pr=await sb.from('players').select('*').order('id');
  if(pr.error){toast('Error cargando jugadores: '+pr.error.message); return;}
  players=pr.data||[];
  const py=await sb.from('payments').select('*').order('created_at',{ascending:false});
  if(py.error){toast('Error cargando pagos: '+py.error.message); return;}
  payments=py.data||[];
  const ln=await sb.from('parent_player_links').select('*').order('parent_email');
  parentLinks=ln.error?[]:(ln.data||[]);
}
async function refresh(){ if(mode==='admin'){await loadAdminData(); renderShell(); renderPage();} }

function renderShell(){
  app.innerHTML = `<div class="shell">
  <aside class="side">
    <div class="brand"><img class="brand-logo" src="assets/logo.png" alt="Ducks"><div><h1>Ducks Academy CRM</h1><p>Administración interna</p></div></div>
    <div class="nav">
      <button data-page="dashboard">📊 Dashboard</button>
      <button data-page="players">🏀 Jugadores</button>
      <button data-page="parents">👨‍👩‍👧 Papás</button>
      <button data-page="payments">💳 Pagos</button>
      <button data-page="evidence">📎 Evidencias</button>
      <button data-page="whatsapp">📲 WhatsApp vencidos</button>
      <button data-page="public">🌐 Ver página pública</button>
      <button data-page="settings">⚙️ Configuración</button>
    </div>
    <div class="help">v2.8: portal privado de papás por familia.</div>
  </aside>
  <main class="main">
    <div class="top"><div><h2 id="title"></h2><p id="subtitle">Ducks Basketball Academy</p></div><div class="tools"><input id="search" class="input" placeholder="Buscar..." value="${esc(q)}"><button class="btn secondary" id="authBtn">Cerrar sesión</button></div></div>
    <div id="content"></div>
  </main></div>`;
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page; if(page==='public'){renderPublicHome(); return;} renderPage();});
  document.getElementById('search').oninput=e=>{q=e.target.value; renderPage();};
  document.getElementById('authBtn').onclick=logout;
}
function setTitle(t){ 
  const el=document.getElementById('title'); if(el) el.textContent=t;
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
}
function renderPage(){
  if(mode!=='admin'){ renderPublicHome(); return; }
  if(page==='dashboard') renderDashboard();
  if(page==='players') renderPlayers();
  if(page==='parents') renderParents();
  if(page==='payments') renderPayments();
  if(page==='evidence') renderEvidence();
  if(page==='whatsapp') renderWhatsApp();
  if(page==='settings') renderSettings();
}
function filteredPlayers(){
  const s=q.toLowerCase().trim();
  return players.filter(p=>!s || [p.id,p.name,p.tutor,p.phone,p.category,p.uniform_number].join(' ').toLowerCase().includes(s));
}

/* Admin pages */
function renderDashboard(){
  setTitle('Dashboard ejecutivo');
  const rows=players.map(p=>({...p,c:calc(p)}));
  const active=rows.filter(p=>p.status==='Activo').length;
  const debtors=rows.filter(p=>p.c.amount>0);
  const overdue=rows.filter(p=>p.c.status==='Vencido').length;
  const pendingEvidence=payments.filter(p=>p.confirmation_status==='Pendiente de confirmación').length;
  const totalDebt=debtors.reduce((a,p)=>a+p.c.amount,0);
  document.getElementById('content').innerHTML=`<div class="kpis">
    <div class="kpi"><small>Jugadores</small><strong>${players.length}</strong></div>
    <div class="kpi green"><small>Activos</small><strong>${active}</strong></div>
    <div class="kpi orange"><small>Con adeudo</small><strong>${debtors.length}</strong></div>
    <div class="kpi red"><small>Vencidos</small><strong>${overdue}</strong></div>
    <div class="kpi orange"><small>Por confirmar</small><strong>${pendingEvidence}</strong></div>
    <div class="kpi red"><small>Adeudo total</small><strong>${money(totalDebt)}</strong></div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Jugadores con adeudo</h3></div><div class="tablewrap"><table><thead><tr><th>Foto</th><th>ID</th><th>Jugador</th><th>Núm.</th><th>Tutor</th><th>Último pago</th><th>Meses</th><th>Adeudo</th><th>Estado</th><th>WhatsApp</th></tr></thead><tbody>
  ${debtors.sort((a,b)=>b.c.amount-a.c.amount).map(p=>`<tr><td>${thumb(p.photo_url)}</td><td>${p.id}</td><td><b>${esc(p.name)}</b><br><small>${esc(p.category||'')}</small></td><td><span class="uniform">#${esc(p.uniform_number||'-')}</span></td><td>${esc(p.tutor||'')}</td><td>${esc(p.c.last||'')}</td><td>${p.c.months}</td><td class="amount">${money(p.c.amount)}</td><td><span class="status ${p.c.status}">${p.c.status}</span></td><td>${whatsappButtons(p)}</td></tr>`).join('')||'<tr><td colspan="10">Sin adeudos</td></tr>'}
  </tbody></table></div></div>`;
}
function renderPlayers(){
  setTitle('Jugadores');
  const list=filteredPlayers();
  document.getElementById('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>Base de jugadores</h3><button class="btn green" onclick="openPlayerForm()">+ Nuevo jugador</button></div><div class="cards">
  ${list.map(p=>{const c=calc(p);return `<div class="card">${thumb(p.photo_url)}<h4>${esc(p.name)}</h4><p><span class="uniform">#${esc(p.uniform_number||'-')}</span></p><p><b>ID:</b> ${p.id} · <b>Categoría:</b> ${esc(p.category||'')}</p><p><b>Tutor:</b> ${esc(p.tutor||'')}</p><p><b>WhatsApp:</b> ${esc(p.phone||'')}</p><p><b>Adeudo:</b> <span class="amount">${money(c.amount)}</span> · <span class="status ${c.status}">${c.status}</span></p><div class="actions"><button class="btn secondary" onclick="openPlayerForm('${p.id}')">Editar</button><button class="btn green" onclick="openPaymentForm('${p.id}')">Pago</button>${whatsappButtons(p)}<button class="btn red" onclick="deletePlayer('${p.id}')">Eliminar</button></div></div>`}).join('')||'<div class="card">Sin jugadores</div>'}
  </div></div>`;
}
function renderParents(){
  setTitle('Papás / Accesos privados');
  const emailSet=[...new Set(parentLinks.map(x=>x.parent_email))].sort();
  document.getElementById('content').innerHTML=`<div class="notice warning"><b>Importante:</b> primero crea el usuario del papá en Supabase Authentication. Después asígnale aquí uno o varios jugadores usando el mismo correo.</div>
  <div class="panel"><div class="panel-head"><h3>Asignar jugador a papá</h3></div><div class="modal-body">
    <form id="parentLinkForm" class="form-grid">
      <label class="label">Correo del papá<input id="linkEmail" class="input" type="email" required placeholder="papá@correo.com"></label>
      <label class="label">Jugador<select id="linkPlayer" class="select" required><option value="">Selecciona...</option>${players.map(p=>`<option value="${p.id}">${p.id} · ${esc(p.name)}</option>`).join('')}</select></label>
      <label class="label full">Nombre visible / relación<input id="linkName" class="input" placeholder="Mamá, Papá, Tutor..."></label>
      <div class="full"><button class="btn green">Asignar jugador</button></div>
    </form>
  </div></div>
  <div class="panel"><div class="panel-head"><h3>Familias asignadas</h3></div><div class="tablewrap"><table><thead><tr><th>Correo papá</th><th>Jugador</th><th>Relación</th><th>Activo</th><th>Acción</th></tr></thead><tbody>
  ${parentLinks.map(l=>{const p=players.find(x=>x.id===l.player_id); return `<tr><td><b>${esc(l.parent_email)}</b></td><td>${esc(l.player_id)} · ${esc(p?.name||'')}</td><td>${esc(l.parent_name||'')}</td><td>${l.active?'Sí':'No'}</td><td><button class="btn red" onclick="deleteParentLink('${l.id}')">Eliminar</button></td></tr>`}).join('')||'<tr><td colspan="5">Sin asignaciones</td></tr>'}
  </tbody></table></div></div>`;
  document.getElementById('parentLinkForm').onsubmit=saveParentLink;
}
async function saveParentLink(e){
  e.preventDefault();
  const row={parent_email:document.getElementById('linkEmail').value.trim().toLowerCase(),player_id:document.getElementById('linkPlayer').value,parent_name:document.getElementById('linkName').value.trim(),active:true};
  const {error}=await sb.from('parent_player_links').insert(row);
  if(error) toast(error.message); else {toast('Jugador asignado al papá'); await refresh(); page='parents'; renderPage();}
}
async function deleteParentLink(id){
  if(!confirm('¿Eliminar asignación?')) return;
  const {error}=await sb.from('parent_player_links').delete().eq('id',id);
  if(error) toast(error.message); else {toast('Asignación eliminada'); await refresh(); page='parents'; renderPage();}
}
function renderPayments(){
  setTitle('Pagos');
  document.getElementById('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>Historial de pagos</h3><button class="btn green" onclick="openPaymentForm()">+ Registrar pago</button></div><div class="tablewrap"><table><thead><tr><th>ID</th><th>Alumno</th><th>Fecha</th><th>Periodo</th><th>Monto</th><th>Método</th><th>Estatus</th><th>Evidencia</th><th>Acción</th></tr></thead><tbody>
  ${payments.map(p=>`<tr><td>${String(p.id).slice(0,8)}</td><td><b>${esc(p.student_name||'')}</b><br><small>${esc(p.player_id)}</small></td><td>${esc(p.payment_date)}</td><td>${esc(p.period||'')}</td><td class="amount">${money(p.amount)}</td><td>${esc(p.method||'')}</td><td><span class="status ${statusClass(p.confirmation_status)}">${esc(p.confirmation_status)}</span></td><td>${p.evidence_url?`<a class="btn secondary" target="_blank" href="${p.evidence_url}">Ver</a>`:'-'}</td><td><button class="btn red" onclick="deletePayment('${p.id}')">Eliminar</button></td></tr>`).join('')||'<tr><td colspan="9">Sin pagos</td></tr>'}
  </tbody></table></div></div>`;
}
function renderEvidence(){
  setTitle('Evidencias por confirmar');
  const pend=payments.filter(p=>p.confirmation_status==='Pendiente de confirmación');
  document.getElementById('content').innerHTML=`<div class="notice warning">Al confirmar un pago, se reflejará automáticamente en el dashboard y adeudos.</div><div class="panel"><div class="panel-head"><h3>Pendientes</h3></div><div class="tablewrap"><table><thead><tr><th>Alumno</th><th>Fecha</th><th>Periodo</th><th>Monto</th><th>Enviado por</th><th>Evidencia</th><th>Acción</th></tr></thead><tbody>
  ${pend.map(p=>`<tr><td><b>${esc(p.student_name)}</b><br><small>${esc(p.player_id)}</small></td><td>${p.payment_date}</td><td>${esc(p.period||'')}</td><td class="amount">${money(p.amount)}</td><td>${esc(p.submitted_by||'')}</td><td>${p.evidence_url?`<a class="btn secondary" target="_blank" href="${p.evidence_url}">Ver evidencia</a>`:'-'}</td><td><button class="btn green" onclick="confirmPayment('${p.id}')">Confirmar</button> <button class="btn red" onclick="rejectPayment('${p.id}')">Rechazar</button></td></tr>`).join('')||'<tr><td colspan="7">No hay evidencias pendientes.</td></tr>'}
  </tbody></table></div></div>`;
}
function renderWhatsApp(){
  setTitle('WhatsApp vencidos');
  const rows=players.map(p=>({...p,c:calc(p)})).filter(p=>p.c.status==='Vencido'&&p.phone).sort((a,b)=>b.c.amount-a.c.amount);
  document.getElementById('content').innerHTML=`<div class="notice warning"><b>Enviar recordatorios:</b> cada botón abre WhatsApp con el mensaje listo.</div>
  <div class="panel"><div class="panel-head"><h3>Jugadores vencidos con WhatsApp</h3></div><div class="tablewrap"><table><thead><tr><th>ID</th><th>Jugador</th><th>Tutor</th><th>WhatsApp</th><th>Meses</th><th>Adeudo</th><th>Acción</th></tr></thead><tbody>
  ${rows.map(p=>`<tr><td>${p.id}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.tutor||'')}</td><td>${esc(p.phone||'')}</td><td>${p.c.months}</td><td class="amount">${money(p.c.amount)}</td><td>${whatsappButtons(p)}</td></tr>`).join('')||'<tr><td colspan="7">No hay jugadores vencidos con WhatsApp registrado.</td></tr>'}
  </tbody></table></div></div>`;
}
function renderSettings(){
  setTitle('Configuración');
  const msg=`Hola, buen día. 🏀\n\nPara proteger la información de cada familia, ahora los pagos y comprobantes se registran desde el Portal de Papás privado.\n\nLiga:\n${window.DUCKS_PORTAL_URL||location.origin}\n\nCada papá debe entrar con su usuario y contraseña asignados por la academia.\n\nGracias por su apoyo y compromiso. 🦆🏀`;
  document.getElementById('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>Configuración profesional</h3></div><div class="modal-body">
    <p><b>Usuario:</b> ${session?.user?.email||'Sin sesión'}</p>
    <div class="notice"><b>Link público:</b><br><a href="${window.DUCKS_PORTAL_URL||location.origin}" target="_blank">${window.DUCKS_PORTAL_URL||location.origin}</a></div>
    <label class="label full">Mensaje sugerido para WhatsApp<textarea id="parentMsg" class="input" rows="10">${msg}</textarea></label>
    <div class="tools" style="margin-top:12px"><button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('parentMsg').value); toast('Mensaje copiado')">Copiar mensaje</button></div>
  </div></div>`;
}

/* Common uploads and CRUD */
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
    <label class="label">ID jugador<input id="pId" class="input" value="${esc(p?.id||nextId())}" ${p?'readonly':''} required></label>
    <label class="label">Nombre<input id="pName" class="input" value="${esc(p?.name||'')}" required></label>
    <label class="label">Tutor<input id="pTutor" class="input" value="${esc(p?.tutor||'')}"></label>
    <label class="label">WhatsApp<input id="pPhone" class="input" value="${esc(p?.phone||'')}"></label>
    <label class="label">Categoría<input id="pCategory" class="input" value="${esc(p?.category||'')}"></label>
    <label class="label">Estado<select id="pStatus" class="select"><option ${p?.status==='Activo'?'selected':''}>Activo</option><option ${p?.status==='Inactivo'?'selected':''}>Inactivo</option><option ${p?.status==='Baja'?'selected':''}>Baja</option></select></label>
    <label class="label">Mensualidad<input id="pFee" class="input" type="number" min="0" step="50" value="${esc(p?.monthly_fee||300)}"></label>
    <label class="label">Día de pago<input id="pDay" class="input" type="number" min="1" max="31" value="${esc(p?.payment_day||5)}"></label>
    <label class="label">Número uniforme<input id="pUniform" class="input" value="${esc(p?.uniform_number||'')}"></label>
    <label class="label">Foto<input id="pPhoto" class="input" type="file" accept="image/*"></label>
    <label class="label full">Notas<textarea id="pNotes" class="input">${esc(p?.notes||'')}</textarea></label>
    <div class="full actions"><button class="btn green">Guardar jugador</button></div>
  </form></div></div>`;
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
    const row={id,name:document.getElementById('pName').value.trim(),tutor:document.getElementById('pTutor').value.trim(),phone:normalizePhone(document.getElementById('pPhone').value),category:document.getElementById('pCategory').value.trim(),status:document.getElementById('pStatus').value,monthly_fee:Number(document.getElementById('pFee').value||0),payment_day:Number(document.getElementById('pDay').value||1),uniform_number:document.getElementById('pUniform').value.trim(),photo_url,notes:document.getElementById('pNotes').value.trim()};
    const result=oldPlayer?await sb.from('players').update(row).eq('id',oldPlayer.id):await sb.from('players').insert(row);
    if(result.error) throw result.error;
    toast(oldPlayer?'Jugador actualizado':'Jugador agregado'); closeModal('playerModal'); await refresh();
  }catch(err){toast('Error: '+err.message);}
}
async function deletePlayer(id){const p=players.find(x=>x.id===id); if(!p)return; if(!confirm(`¿Eliminar a ${p.name}? También se eliminarán sus pagos.`))return; const {error}=await sb.from('players').delete().eq('id',id); if(error)toast(error.message); else{toast('Jugador eliminado'); await refresh();}}
function openPaymentForm(playerId=''){
  const selected=playerId?players.find(p=>p.id===playerId):null;
  const modal=document.createElement('div'); modal.className='modalbg open'; modal.id='paymentModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>Registrar pago confirmado</h3><button class="btn secondary" onclick="closeModal('paymentModal')">Cerrar</button></div><div class="modal-body"><form id="paymentForm" class="form-grid">
    <label class="label full">Jugador<select id="payPlayer" class="select" required><option value="">Selecciona...</option>${players.map(p=>`<option value="${p.id}" ${p.id===playerId?'selected':''}>${p.id} · ${esc(p.name)}</option>`).join('')}</select></label>
    <label class="label">Fecha<input id="payDate" class="input" type="date" value="${todayISO()}" required></label>
    <label class="label">Periodo<input id="payPeriod" class="input" value="${period(todayISO())}"></label>
    <label class="label">Monto<input id="payAmount" class="input" type="number" min="0" step="50" value="${esc(selected?.monthly_fee||300)}" required></label>
    <label class="label">Método<select id="payMethod" class="select"><option></option><option>Transferencia</option><option>Depósito</option><option>Efectivo</option><option>Tarjeta</option><option>Otro</option></select></label>
    <label class="label">Evidencia opcional<input id="payEvidence" class="input" type="file" accept="image/*,application/pdf"></label>
    <label class="label full">Notas<textarea id="payNotes" class="input"></textarea></label>
    <div class="full actions"><button class="btn green">Guardar pago confirmado</button></div>
  </form></div></div>`;
  document.body.appendChild(modal);
  document.getElementById('payPlayer').onchange=()=>{const p=players.find(x=>x.id===document.getElementById('payPlayer').value); if(p) document.getElementById('payAmount').value=p.monthly_fee||0;};
  document.getElementById('paymentForm').onsubmit=savePaymentForm;
}
async function savePaymentForm(e){
  e.preventDefault();
  const player_id=document.getElementById('payPlayer').value;
  const player=players.find(p=>p.id===player_id);
  const file=document.getElementById('payEvidence').files[0];
  try{
    const evidence_url=file?await uploadFile(file,'evidencias'):'';
    const row={player_id,student_name:player?.name||'',payment_date:document.getElementById('payDate').value,period:document.getElementById('payPeriod').value||period(document.getElementById('payDate').value),amount:Number(document.getElementById('payAmount').value||0),method:document.getElementById('payMethod').value,notes:document.getElementById('payNotes').value,confirmation_status:'Confirmado',evidence_url,evidence_name:file?.name||'',submitted_by:'Admin',confirmed_at:new Date().toISOString()};
    const {error}=await sb.from('payments').insert(row);
    if(error) throw error;
    toast('Pago guardado y confirmado'); closeModal('paymentModal'); await refresh(); page='payments'; renderPage();
  }catch(err){toast('Error: '+err.message);}
}
async function confirmPayment(id){const {error}=await sb.from('payments').update({confirmation_status:'Confirmado',confirmed_at:new Date().toISOString()}).eq('id',id); if(error)toast(error.message); else{toast('Pago confirmado'); await refresh();}}
async function rejectPayment(id){const {error}=await sb.from('payments').update({confirmation_status:'Rechazado'}).eq('id',id); if(error)toast(error.message); else{toast('Pago rechazado'); await refresh();}}
async function deletePayment(id){if(!confirm('¿Eliminar pago?'))return; const {error}=await sb.from('payments').delete().eq('id',id); if(error)toast(error.message); else{toast('Pago eliminado'); await refresh();}}

window.renderPublicHome=renderPublicHome;
window.renderParentLogin=renderParentLogin;
window.renderAdminLogin=renderAdminLogin;
window.renderLogin=renderAdminLogin;
window.logoutToHome=logoutToHome;
window.copyBank=copyBank;
window.openParentPayment=openParentPayment;
window.openPlayerForm=openPlayerForm;
window.deletePlayer=deletePlayer;
window.openPaymentForm=openPaymentForm;
window.confirmPayment=confirmPayment;
window.rejectPayment=rejectPayment;
window.deletePayment=deletePayment;
window.closeModal=closeModal;
window.copyReminder=copyReminder;
window.deleteParentLink=deleteParentLink;

init();
