
// Ducks CRM profesional v2.4 - buscador inteligente de jugador con foto en portal papás
const app = document.getElementById('app');
let sb = null;
let session = null;
let page = 'portal';
let players = [];
let payments = [];
let q = '';

function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); }
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function money(n){return Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});}
function todayISO(){return new Date().toISOString().slice(0,10);}
function period(date){return String(date||'').slice(0,7);}
function statusClass(s){return String(s||'').replace(/\s+/g,'');}
function thumb(url){return url?`<div class="thumb"><img src="${url}"></div>`:`<div class="thumb"><div class="emptythumb">Sin foto</div></div>`;}
function isConfigured(){ return window.DUCKS_SUPABASE_URL && window.DUCKS_SUPABASE_ANON_KEY; }
function normalizePhone(v){ const d=String(v||'').replace(/\D/g,''); if(!d)return ''; if(d.startsWith('52')&&d.length===12)return '+'+d; if(d.length===10)return '+52'+d; if(d.length>=11&&d.length<=15)return '+'+d; return String(v||'').trim(); }
function nextId(){ const max=players.reduce((m,p)=>Math.max(m,Number(String(p.id||'').replace(/\D/g,''))||0),0); return 'D'+String(max+1).padStart(3,'0'); }

function calc(player){
  const confirmed = payments.filter(p=>p.player_id===player.id && p.confirmation_status==='Confirmado').sort((a,b)=>String(b.payment_date).localeCompare(String(a.payment_date)));
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
  return `Hola, buen día. Les recordamos amablemente que está pendiente el pago de la mensualidad de Ducks Basketball Academy por ${money(c.amount)}${monthsText}\n\nPara facilitar el proceso, pueden subir su comprobante en el portal oficial:\n${window.DUCKS_PORTAL_URL || location.origin}\n\nAgradecemos mucho su apoyo para mantener el control administrativo. 🏀🦆`;
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

async function init(){
  if(!isConfigured()){ renderSetup(); return; }
  sb = window.supabase.createClient(window.DUCKS_SUPABASE_URL, window.DUCKS_SUPABASE_ANON_KEY);
  const {data} = await sb.auth.getSession();
  session = data.session;
  if(session){ renderShell(); await loadAdminData(); }
  else { await loadPublicPlayers(); }
  renderPage();
}
async function loadPublicPlayers(){
  const {data,error}=await sb.from('players').select('id,name,category,uniform_number,monthly_fee,payment_day,status,photo_url').eq('status','Activo').order('name');
  if(error){toast('Error cargando jugadores: '+error.message); return;}
  players=data||[];
}
async function loadAdminData(){
  const pr=await sb.from('players').select('*').order('id');
  if(pr.error){toast('Error cargando jugadores: '+pr.error.message); return;}
  players=pr.data||[];
  const py=await sb.from('payments').select('*').order('created_at',{ascending:false});
  if(py.error){toast('Error cargando pagos: '+py.error.message); return;}
  payments=py.data||[];
}
async function refresh(){ if(session){await loadAdminData(); renderShell();} else {await loadPublicPlayers();} renderPage(); }

function renderSetup(){ app.innerHTML=`<div class="parent-page"><div class="parent-wrap"><div class="parent-card"><h1>Configurar Supabase</h1><div class="notice warning">Falta configurar config.js.</div></div></div></div>`; }

function renderShell(){
  app.innerHTML = `<div class="shell">
  <aside class="side">
    <div class="brand"><img class="brand-logo" src="assets/logo.png" alt="Ducks"><div><h1>Ducks Academy CRM</h1><p>Portal de pagos y administración</p></div></div>
    <div class="nav">
      <button data-page="dashboard">📊 Dashboard</button>
      <button data-page="players">🏀 Jugadores</button>
      <button data-page="payments">💳 Pagos</button>
      <button data-page="evidence">📎 Evidencias</button>
      <button data-page="whatsapp">📲 WhatsApp vencidos</button>
      <button data-page="portal">👨‍👩‍👧 Ver portal papás</button>
      <button data-page="settings">⚙️ Configuración</button>
    </div>
    <div class="help">v2.3: botón WhatsApp en cada jugador vencido + portal de papás simplificado.</div>
  </aside>
  <main class="main">
    <div class="top"><div><h2 id="title"></h2><p id="subtitle">Ducks Basketball Academy</p></div><div class="tools"><input id="search" class="input" placeholder="Buscar..." value="${esc(q)}"><button class="btn secondary" id="authBtn">Cerrar sesión</button></div></div>
    <div id="content"></div>
  </main></div>`;
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page; renderPage();});
  document.getElementById('search').oninput=e=>{q=e.target.value; renderPage();};
  document.getElementById('authBtn').onclick=logout;
}
function setTitle(t){ 
  const el=document.getElementById('title'); if(el) el.textContent=t;
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
}
function renderPage(){
  if(page==='portal'){ renderPortal(); return; }
  if(!session){ renderLogin(); return; }
  if(!document.getElementById('content')) renderShell();
  if(page==='dashboard') renderDashboard();
  if(page==='players') renderPlayers();
  if(page==='payments') renderPayments();
  if(page==='evidence') renderEvidence();
  if(page==='whatsapp') renderWhatsApp();
  if(page==='settings') renderSettings();
}
function filteredPlayers(){
  const s=q.toLowerCase().trim();
  return players.filter(p=>!s || [p.id,p.name,p.tutor,p.phone,p.category,p.uniform_number].join(' ').toLowerCase().includes(s));
}
function renderLogin(){
  app.innerHTML = `<div class="parent-page"><div class="parent-wrap">
    <div class="parent-admin"><button class="btn secondary" onclick="page='portal'; renderPage()">Volver al portal de papás</button></div>
    <div class="parent-card" style="max-width:720px;margin:60px auto">
      <div class="parent-title"><img src="assets/logo.png"><div><h1>Admin login</h1><div class="sub">Acceso exclusivo para administración Ducks</div></div></div>
      <div class="notice">El portal de papás no requiere usuario. Para editar jugadores, pagos y evidencias inicia sesión.</div>
      <form id="loginForm" class="parent-form">
        <label class="label">Email<input id="loginEmail" class="input" type="email" required></label>
        <label class="label">Password<input id="loginPassword" class="input" type="password" required></label>
        <div class="full"><button class="btn green">Entrar como administrador</button></div>
      </form>
    </div>
  </div></div>`;
  document.getElementById('loginForm').onsubmit=login;
}
async function login(e){
  e.preventDefault();
  const {data,error}=await sb.auth.signInWithPassword({email:document.getElementById('loginEmail').value,password:document.getElementById('loginPassword').value});
  if(error){toast(error.message);return;}
  session=data.session; page='dashboard'; renderShell(); await loadAdminData(); renderPage();
}
async function logout(){ await sb.auth.signOut(); session=null; payments=[]; page='portal'; await loadPublicPlayers(); renderPage(); }

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
  document.getElementById('content').innerHTML=`<div class="notice warning"><b>Enviar recordatorios:</b> cada botón abre WhatsApp con el mensaje listo. Esto funciona desde computadora y celular si WhatsApp está instalado o tienes WhatsApp Web activo.</div>
  <div class="panel"><div class="panel-head"><h3>Jugadores vencidos con WhatsApp</h3></div><div class="tablewrap"><table><thead><tr><th>ID</th><th>Jugador</th><th>Tutor</th><th>WhatsApp</th><th>Meses</th><th>Adeudo</th><th>Acción</th></tr></thead><tbody>
  ${rows.map(p=>`<tr><td>${p.id}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.tutor||'')}</td><td>${esc(p.phone||'')}</td><td>${p.c.months}</td><td class="amount">${money(p.c.amount)}</td><td>${whatsappButtons(p)}</td></tr>`).join('')||'<tr><td colspan="7">No hay jugadores vencidos con WhatsApp registrado.</td></tr>'}
  </tbody></table></div></div>`;
}

function playerPhotoUrl(p){
  return p?.photo_url || 'assets/logo.png';
}
function portalMatchScore(p, term){
  const t = String(term||'').toLowerCase().trim();
  if(!t) return 0;
  const name = String(p.name||'').toLowerCase();
  const id = String(p.id||'').toLowerCase();
  const category = String(p.category||'').toLowerCase();
  const uniform = String(p.uniform_number||'').toLowerCase();
  if(name === t) return 100;
  if(name.startsWith(t)) return 90;
  if(name.includes(t)) return 80;
  if(id.includes(t) || uniform.includes(t)) return 70;
  const words = t.split(/\s+/).filter(Boolean);
  let score = 0;
  for(const w of words){
    if(name.includes(w)) score += 20;
    if(category.includes(w)) score += 5;
  }
  return score;
}
function renderPortalPlayerOptions(term=''){
  const box = document.getElementById('portalPlayerOptions');
  if(!box) return;
  const t = String(term||'').trim();
  let list = [];
  if(t.length >= 2){
    list = players.map(p=>({...p,score:portalMatchScore(p,t)}))
      .filter(p=>p.score>0)
      .sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name))
      .slice(0,8);
  } else {
    list = players.slice().sort((a,b)=>a.name.localeCompare(b.name)).slice(0,6);
  }
  if(!list.length){
    box.innerHTML = '<div class="player-option empty">No encontré coincidencias. Revisa el nombre o apellido.</div>';
    return;
  }
  box.innerHTML = list.map(p=>`<button type="button" class="player-option" onclick="selectPortalPlayer('${p.id}')">
    <img src="${playerPhotoUrl(p)}" alt="">
    <span><b>${esc(p.name)}</b><small>${esc(p.id)} · ${esc(p.category||'Sin categoría')} · #${esc(p.uniform_number||'-')}</small></span>
  </button>`).join('');
}
function selectPortalPlayer(id){
  const p = players.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('portalPlayer').value = p.id;
  document.getElementById('portalSearch').value = p.name;
  document.getElementById('portalAmount').value = p.monthly_fee || 0;
  const selected = document.getElementById('portalSelected');
  if(selected){
    selected.innerHTML = `<div class="selected-player"><img src="${playerPhotoUrl(p)}" alt=""><div><b>${esc(p.name)}</b><small>${esc(p.id)} · ${esc(p.category||'')} · Uniforme #${esc(p.uniform_number||'-')}</small></div></div>`;
  }
  const box = document.getElementById('portalPlayerOptions');
  if(box) box.innerHTML = '';
}

function renderPortal(){
  app.innerHTML=`<div class="parent-page"><div class="parent-wrap">
    <div class="parent-admin"><button class="btn secondary" onclick="renderLogin()">Soy administrador</button></div>
    <img class="parent-cover" src="assets/portal_cover.png" alt="Portal de Papás Ducks">
    <div class="parent-card">
      <div class="parent-title"><img src="assets/logo.png"><div><h1>Sube tu comprobante</h1><div class="sub">Ducks Basketball Academy · Portal de papás</div></div></div>
      <div class="parent-steps">
        <div class="step"><b>1</b><p>Selecciona al jugador</p></div>
        <div class="step"><b>2</b><p>Adjunta comprobante</p></div>
        <div class="step"><b>3</b><p>Envía para confirmar</p></div>
      </div>
      <div class="notice success"><b>Muy fácil:</b> llena los datos, adjunta una foto o PDF del comprobante y presiona enviar. No necesitas usuario ni contraseña.</div>
      <form id="portalForm" class="parent-form">
        <label class="label full">Buscar jugador<input id="portalSearch" class="input" autocomplete="off" placeholder="Escribe nombre o apellido del jugador..." required><input id="portalPlayer" type="hidden" required><span class="simple-help">Escribe mínimo 2 letras. Aparecerán los jugadores más cercanos con foto para evitar errores.</span><div id="portalPlayerOptions" class="player-options"></div><div id="portalSelected"></div></label>
        <label class="label">Fecha de pago<input id="portalDate" class="input" type="date" required value="${todayISO()}"></label>
        <label class="label">Monto pagado<input id="portalAmount" class="input" type="number" min="0" step="50" required placeholder="$"></label>
        <label class="label">Método<select id="portalMethod" class="select" required><option></option><option>Transferencia</option><option>Depósito</option><option>Efectivo</option><option>Otro</option></select></label>
        <label class="label">Nombre de quien envía<input id="portalBy" class="input" placeholder="Papá / Mamá / Tutor"></label>
        <label class="label full">Comprobante<input id="portalEvidence" class="input" type="file" accept="image/*,application/pdf" required><span class="simple-help">Puedes subir foto, captura de pantalla o PDF.</span></label>
        <label class="label full">Comentario opcional<textarea id="portalNotes" class="input" placeholder="Referencia, banco o comentario..."></textarea></label>
        <input id="portalPeriod" type="hidden" value="${period(todayISO())}">
        <div class="full"><button class="btn green" style="width:100%;font-size:18px;padding:14px">Enviar comprobante de pago</button></div>
      </form>
    </div>
  </div></div>`;
  renderPortalPlayerOptions('');
  document.getElementById('portalSearch').oninput=(e)=>{document.getElementById('portalPlayer').value=''; document.getElementById('portalSelected').innerHTML=''; renderPortalPlayerOptions(e.target.value);};
  document.getElementById('portalDate').onchange=()=>{document.getElementById('portalPeriod').value=period(document.getElementById('portalDate').value);};
  document.getElementById('portalForm').onsubmit=submitPortalPayment;
}
function renderSettings(){
  setTitle('Configuración');
  const msg=`Hola, buen día. 🏀\n\nPara mejorar el control administrativo de Ducks Basketball Academy, a partir de ahora los pagos y comprobantes se registrarán en nuestro portal oficial.\n\nLiga del portal:\n${window.DUCKS_PORTAL_URL||location.origin}\n\nInstrucciones:\n1. Selecciona el nombre del jugador.\n2. Captura fecha y monto pagado.\n3. Adjunta el comprobante.\n4. Envía para confirmación.\n\nGracias por su apoyo y compromiso. 🦆🏀`;
  document.getElementById('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>Configuración profesional</h3></div><div class="modal-body">
    <p><b>Usuario:</b> ${session?.user?.email||'Sin sesión'}</p>
    <div class="notice"><b>Link para papás:</b><br><a href="${window.DUCKS_PORTAL_URL||location.origin}" target="_blank">${window.DUCKS_PORTAL_URL||location.origin}</a></div>
    <label class="label full">Mensaje sugerido para WhatsApp<textarea id="parentMsg" class="input" rows="10">${msg}</textarea></label>
    <div class="tools" style="margin-top:12px"><button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('parentMsg').value); toast('Mensaje copiado')">Copiar mensaje</button><button class="btn green" onclick="goPage('whatsapp')">WhatsApp vencidos</button></div>
  </div></div>`;
}

async function uploadFile(file, folder){
  if(!file) return '';
  const clean=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=`${folder}/${Date.now()}_${clean}`;
  const {error}=await sb.storage.from('ducks-files').upload(path,file,{upsert:false});
  if(error) throw error;
  const {data}=sb.storage.from('ducks-files').getPublicUrl(path);
  return data.publicUrl;
}
async function submitPortalPayment(e){
  e.preventDefault();
  const player_id=document.getElementById('portalPlayer').value;
  if(!player_id){toast('Selecciona un jugador de las opciones mostradas.'); return;}
  const player=players.find(p=>p.id===player_id);
  const file=document.getElementById('portalEvidence').files[0];
  try{
    const evidence_url=await uploadFile(file,'evidencias');
    const row={player_id,student_name:player?.name||'',payment_date:document.getElementById('portalDate').value,period:document.getElementById('portalPeriod').value||period(document.getElementById('portalDate').value),amount:Number(document.getElementById('portalAmount').value||0),method:document.getElementById('portalMethod').value,submitted_by:document.getElementById('portalBy').value,notes:document.getElementById('portalNotes').value,confirmation_status:'Pendiente de confirmación',evidence_url,evidence_name:file.name};
    const {error}=await sb.from('payments').insert(row);
    if(error) throw error;
    e.target.reset();
    toast('Comprobante enviado. Queda pendiente de confirmación.');
  }catch(err){toast('Error: '+err.message);}
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
function goPage(p){page=p; renderPage();}

window.selectPortalPlayer=selectPortalPlayer; window.renderLogin=renderLogin; window.openPlayerForm=openPlayerForm; window.deletePlayer=deletePlayer; window.openPaymentForm=openPaymentForm; window.confirmPayment=confirmPayment; window.rejectPayment=rejectPayment; window.deletePayment=deletePayment; window.closeModal=closeModal; window.copyReminder=copyReminder; window.goPage=goPage;

init();
