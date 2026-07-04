// version profesional v2 ducks
const app = document.getElementById('app');
let sb = null;
let session = null;
let page = 'portal';
let players = [];
let payments = [];
let q = '';

function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function money(n){return Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});}
function todayISO(){return new Date().toISOString().slice(0,10);}
function period(date){return String(date||'').slice(0,7);}
function statusClass(s){return String(s||'').replace(/\s+/g,'');}
function thumb(url){return url?`<div class="thumb"><img src="${url}"></div>`:`<div class="thumb"><div class="emptythumb">Sin foto</div></div>`;}
function isConfigured(){ return window.DUCKS_SUPABASE_URL && !window.DUCKS_SUPABASE_URL.includes('TU-PROYECTO') && window.DUCKS_SUPABASE_ANON_KEY && !window.DUCKS_SUPABASE_ANON_KEY.includes('TU_ANON'); }

function calc(player){
  const confirmed = payments.filter(p=>p.player_id===player.id && p.confirmation_status==='Confirmado').sort((a,b)=>String(b.payment_date).localeCompare(String(a.payment_date)));
  const last = confirmed[0]?.payment_date || '';
  const now = new Date();
  const lastD = last ? new Date(last+'T00:00:00') : null;
  const active = String(player.status||'').toLowerCase()==='activo';
  let months = 0;
  if(active){
    months = !lastD ? 1 : Math.max(0,(now.getFullYear()-lastD.getFullYear())*12+(now.getMonth()-lastD.getMonth()));
  }
  const amount = active ? months * Number(player.monthly_fee||0) : 0;
  let status='Inactivo';
  if(active){
    if(months===0) status='Pagado';
    else if(months===1 && now.getDate() <= Number(player.payment_day||1)) status='Pendiente';
    else status='Vencido';
  }
  return {last,months,amount,status};
}

async function init(){
  if(!isConfigured()){ renderSetup(); return; }
  sb = window.supabase.createClient(window.DUCKS_SUPABASE_URL, window.DUCKS_SUPABASE_ANON_KEY);
  const {data} = await sb.auth.getSession();
  session = data.session;
  renderShell();
  await loadPublicPlayers();
  if(session) await loadAdminData();
  renderPage();
}

async function loadPublicPlayers(){
  const {data,error} = await sb.from('public_players').select('*').order('name');
  if(!error && data) players = data;
}
async function loadAdminData(){
  const pr = await sb.from('players').select('*').order('id');
  if(pr.error){ toast('Error cargando jugadores: '+pr.error.message); return; }
  players = pr.data || [];
  const py = await sb.from('payments').select('*').order('created_at',{ascending:false});
  if(py.error){ toast('Error cargando pagos: '+py.error.message); return; }
  payments = py.data || [];
}
async function refresh(){ if(session) await loadAdminData(); else await loadPublicPlayers(); renderPage(); }

function renderSetup(){
  app.innerHTML = `<div class="center"><div class="panel"><div class="panel-head"><h3>Configurar Supabase</h3></div><div class="modal-body">
  <div class="notice warning"><b>Falta configuración.</b> Abre <code>public/config.js</code> y pega tu SUPABASE_URL y SUPABASE_ANON_KEY.</div>
  <p>Después sube la carpeta <b>public</b> a Vercel/Netlify.</p>
  </div></div></div>`;
}

function renderShell(){
  app.innerHTML = `<div class="shell">
  <aside class="side"><div class="brand"><img class="brand-logo" src="assets/logo.png" alt="Ducks"><div><h1>Ducks Academy CRM</h1><p>Portal de pagos y administración</p></div></div>
  <div class="nav">
    <button data-page="dashboard">📊 Dashboard</button>
    <button data-page="players">🏀 Jugadores</button>
    <button data-page="payments">💳 Pagos</button>
    <button data-page="evidence">📎 Evidencias</button>
    <button data-page="portal">👨‍👩‍👧 Portal papás</button>
    <button data-page="settings">⚙️ Configuración</button>
  </div><div class="help">Versión en línea con base de datos Supabase. El portal de papás guarda evidencias como pendiente de confirmación.</div></aside>
  <main class="main">
    <div class="top"><div><h2 id="title"></h2><p id="subtitle">Ducks Basketball Academy</p></div><div class="tools"><input id="search" class="input" placeholder="Buscar..." value="${esc(q)}"><button class="btn secondary" id="authBtn"></button></div></div>
    <div id="content"></div>
  </main></div>`;
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page; renderPage();});
  document.getElementById('search').oninput=e=>{q=e.target.value; renderPage();};
  document.getElementById('authBtn').onclick=()=> session ? logout() : renderLogin();
}

function setTitle(t){ document.getElementById('title').textContent=t; document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); document.getElementById('authBtn').textContent=session?'Cerrar sesión':'Admin login'; }
function requireAdmin(){ if(!session){ renderLogin(); return false; } return true; }

function renderPage(){
  if(!document.getElementById('content')) return;
  if(page==='portal'){ renderPortal(); return; }
  if(page==='settings'){ renderSettings(); return; }
  if(!session){ renderLogin(); return; }
  if(page==='dashboard') renderDashboard();
  if(page==='players') renderPlayers();
  if(page==='payments') renderPayments();
  if(page==='evidence') renderEvidence();
}

function filteredPlayers(){
  const s=q.toLowerCase().trim();
  return players.filter(p=>!s || [p.id,p.name,p.tutor,p.phone,p.category,p.uniform_number].join(' ').toLowerCase().includes(s));
}
function renderDashboard(){
  setTitle('Dashboard ejecutivo');
  const rows = players.map(p=>({...p,c:calc(p)}));
  const active=rows.filter(p=>p.status==='Activo').length;
  const debtors=rows.filter(p=>p.c.amount>0);
  const overdue=rows.filter(p=>p.c.status==='Vencido').length;
  const pendingEvidence=payments.filter(p=>p.confirmation_status==='Pendiente de confirmación').length;
  const totalDebt=debtors.reduce((a,p)=>a+p.c.amount,0);
  document.getElementById('content').innerHTML = `<div class="kpis">
    <div class="kpi"><small>Jugadores</small><strong>${players.length}</strong></div>
    <div class="kpi green"><small>Activos</small><strong>${active}</strong></div>
    <div class="kpi orange"><small>Con adeudo</small><strong>${debtors.length}</strong></div>
    <div class="kpi red"><small>Vencidos</small><strong>${overdue}</strong></div>
    <div class="kpi orange"><small>Por confirmar</small><strong>${pendingEvidence}</strong></div>
    <div class="kpi red"><small>Adeudo total</small><strong>${money(totalDebt)}</strong></div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Jugadores con adeudo</h3></div><div class="tablewrap"><table><thead><tr><th>Foto</th><th>ID</th><th>Jugador</th><th>Núm.</th><th>Tutor</th><th>Último pago</th><th>Meses</th><th>Adeudo</th><th>Estado</th></tr></thead><tbody>
  ${debtors.sort((a,b)=>b.c.amount-a.c.amount).map(p=>`<tr><td>${thumb(p.photo_url)}</td><td>${p.id}</td><td><b>${esc(p.name)}</b><br><small>${esc(p.category||'')}</small></td><td><span class="uniform">#${esc(p.uniform_number||'-')}</span></td><td>${esc(p.tutor||'')}</td><td>${esc(p.c.last||'')}</td><td>${p.c.months}</td><td class="amount">${money(p.c.amount)}</td><td><span class="status ${p.c.status}">${p.c.status}</span></td></tr>`).join('')||'<tr><td colspan="9">Sin adeudos</td></tr>'}
  </tbody></table></div></div>`;
}

function renderPlayers(){
  setTitle('Jugadores');
  const list=filteredPlayers();
  document.getElementById('content').innerHTML = `<div class="panel"><div class="panel-head"><h3>Base de jugadores</h3><button class="btn green" onclick="openPlayerForm()">+ Nuevo jugador</button></div><div class="cards">
  ${list.map(p=>`<div class="card">${thumb(p.photo_url)}<h4>${esc(p.name)}</h4><p><span class="uniform">#${esc(p.uniform_number||'-')}</span></p><p><b>ID:</b> ${p.id} · <b>Categoría:</b> ${esc(p.category||'')}</p><p><b>Tutor:</b> ${esc(p.tutor||'')}</p><p><b>WhatsApp:</b> ${esc(p.phone||'')}</p><p><b>Mensualidad:</b> ${money(p.monthly_fee)} · Día ${p.payment_day}</p><div class="actions"><button class="btn secondary" onclick="openPlayerForm('${p.id}')">Editar</button><button class="btn green" onclick="openPaymentForm('${p.id}')">Pago</button><button class="btn red" onclick="deletePlayer('${p.id}')">Eliminar</button></div></div>`).join('')||'<div class="card">Sin jugadores</div>'}
  </div></div><div id="modalRoot"></div>`;
}

function renderPayments(){
  setTitle('Pagos');
  document.getElementById('content').innerHTML = `<div class="panel"><div class="panel-head"><h3>Historial de pagos</h3></div><div class="tablewrap"><table><thead><tr><th>ID</th><th>Alumno</th><th>Fecha</th><th>Periodo</th><th>Monto</th><th>Método</th><th>Estatus</th><th>Evidencia</th><th>Acción</th></tr></thead><tbody>
  ${payments.map(p=>`<tr><td>${p.id.slice(0,8)}</td><td><b>${esc(p.student_name||'')}</b><br><small>${esc(p.player_id)}</small></td><td>${esc(p.payment_date)}</td><td>${esc(p.period||'')}</td><td class="amount">${money(p.amount)}</td><td>${esc(p.method||'')}</td><td><span class="status ${statusClass(p.confirmation_status)}">${esc(p.confirmation_status)}</span></td><td>${p.evidence_url?`<a class="btn secondary" target="_blank" href="${p.evidence_url}">Ver</a>`:'-'}</td><td><button class="btn red" onclick="deletePayment('${p.id}')">Eliminar</button></td></tr>`).join('')||'<tr><td colspan="9">Sin pagos</td></tr>'}
  </tbody></table></div></div><div id="modalRoot"></div>`;
}

function renderEvidence(){
  setTitle('Evidencias por confirmar');
  const pend=payments.filter(p=>p.confirmation_status==='Pendiente de confirmación');
  document.getElementById('content').innerHTML = `<div class="notice warning">Al confirmar un pago, se reflejará automáticamente en el dashboard y adeudos.</div><div class="panel"><div class="panel-head"><h3>Pendientes</h3></div><div class="tablewrap"><table><thead><tr><th>Alumno</th><th>Fecha</th><th>Periodo</th><th>Monto</th><th>Enviado por</th><th>Evidencia</th><th>Acción</th></tr></thead><tbody>
  ${pend.map(p=>`<tr><td><b>${esc(p.student_name)}</b><br><small>${esc(p.player_id)}</small></td><td>${p.payment_date}</td><td>${esc(p.period||'')}</td><td class="amount">${money(p.amount)}</td><td>${esc(p.submitted_by||'')}</td><td>${p.evidence_url?`<a class="btn secondary" target="_blank" href="${p.evidence_url}">Ver evidencia</a>`:'-'}</td><td><button class="btn green" onclick="confirmPayment('${p.id}')">Confirmar</button> <button class="btn red" onclick="rejectPayment('${p.id}')">Rechazar</button></td></tr>`).join('')||'<tr><td colspan="7">No hay evidencias pendientes.</td></tr>'}
  </tbody></table></div></div>`;
}

function renderPortal(){
  setTitle('Portal de pago para papás');
  document.getElementById('content').innerHTML = `<div class="panel"><div class="panel-head"><h3>Enviar evidencia de pago</h3></div><div class="modal-body">
  <div class="portal-hero">
    <div>
      <h3>Portal oficial de pagos Ducks Basketball Academy</h3>
      <p>Registra tu pago y adjunta el comprobante. El pago quedará pendiente de confirmación administrativa.</p>
      <p class="portal-url">https://ducks-academy-crm.vercel.app</p>
    </div>
    <img src="assets/portal_qr.png" alt="QR Portal Ducks">
  </div>
  <div class="notice success"><b>Instrucciones:</b> selecciona el jugador, captura el monto pagado, adjunta la evidencia y presiona enviar. Una vez revisado, el pago se reflejará en el estado de cuenta.</div>
  <form id="portalForm" class="form-grid">
    <label class="label full">Jugador<select id="portalPlayer" class="select" required><option value="">Selecciona...</option>${players.map(p=>`<option value="${p.id}">${p.id} · ${esc(p.name)} · #${esc(p.uniform_number||'-')}</option>`).join('')}</select></label>
    <label class="label">Fecha de pago<input id="portalDate" class="input" type="date" required value="${todayISO()}"></label>
    <label class="label">Periodo<input id="portalPeriod" class="input" placeholder="2026-07" value="${period(todayISO())}"></label>
    <label class="label">Monto<input id="portalAmount" class="input" type="number" min="0" step="50" required></label>
    <label class="label">Método<select id="portalMethod" class="select" required><option></option><option>Transferencia</option><option>Depósito</option><option>Efectivo</option><option>Otro</option></select></label>
    <label class="label">Nombre de quien envía<input id="portalBy" class="input" placeholder="Papá / Mamá / Tutor"></label>
    <label class="label full">Comprobante<input id="portalEvidence" class="input" type="file" accept="image/*,application/pdf" required></label>
    <label class="label full">Comentarios<textarea id="portalNotes" class="input"></textarea></label>
    <div class="full"><button class="btn green">Enviar evidencia</button></div>
  </form></div></div>`;
  document.getElementById('portalPlayer').onchange=()=>{ const p=players.find(x=>x.id===document.getElementById('portalPlayer').value); if(p) document.getElementById('portalAmount').value=p.monthly_fee||0; };
  document.getElementById('portalForm').onsubmit=submitPortalPayment;
}

function renderSettings(){
  setTitle('Configuración');
  const msg = `Hola, buen día. 🏀\n\nPara mejorar el control administrativo de Ducks Basketball Academy, a partir de ahora los pagos y comprobantes se registrarán en nuestro portal oficial.\n\nLiga del portal:\nhttps://ducks-academy-crm.vercel.app\n\nInstrucciones:\n1. Selecciona el nombre del jugador.\n2. Captura la fecha y monto pagado.\n3. Adjunta el comprobante de pago.\n4. Envía la evidencia para confirmación.\n\nUna vez validado, el pago se reflejará en el estado de cuenta del jugador.\n\nGracias por su apoyo y compromiso. 🦆🏀`;
  document.getElementById('content').innerHTML = `<div class="panel"><div class="panel-head"><h3>Configuración profesional</h3></div><div class="modal-body">
  <p><b>Usuario:</b> ${session?.user?.email||'Sin sesión'}</p>
  <div class="notice"><b>Link oficial para papás:</b><br><a href="https://ducks-academy-crm.vercel.app" target="_blank">https://ducks-academy-crm.vercel.app</a></div>
  <div class="portal-kit"><img src="assets/portal_qr.png" alt="QR"><div><h3>QR del portal</h3><p>Comparte este QR en WhatsApp, impresos o redes sociales para que los papás suban sus comprobantes.</p></div></div>
  <label class="label full">Mensaje sugerido para WhatsApp<textarea id="parentMsg" class="input" rows="10">${msg}</textarea></label>
  <div class="tools" style="margin-top:12px"><button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('parentMsg').value); toast('Mensaje copiado')">Copiar mensaje</button><button class="btn secondary" onclick="refresh()">Recargar datos</button></div>
  </div></div>`;
}

function renderLogin(){
  page='settings';
  setTitle('Admin login');
  document.getElementById('content').innerHTML = `<div class="panel"><div class="panel-head"><h3>Entrar como administrador</h3></div><div class="modal-body">
    <div class="notice">El portal de papás puede recibir evidencias sin login. Para administrar jugadores y confirmar pagos, inicia sesión.</div>
    <form id="loginForm" class="form-grid">
      <label class="label">Email<input id="loginEmail" class="input" type="email" required></label>
      <label class="label">Password<input id="loginPassword" class="input" type="password" required></label>
      <div class="full"><button class="btn green">Entrar</button></div>
    </form>
  </div></div>`;
  document.getElementById('loginForm').onsubmit=login;
}

async function login(e){
  e.preventDefault();
  const email=document.getElementById('loginEmail').value;
  const password=document.getElementById('loginPassword').value;
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){toast(error.message);return;}
  session=data.session;
  page='dashboard';
  renderShell();
  await loadAdminData();
  renderPage();
}
async function logout(){ await sb.auth.signOut(); session=null; payments=[]; page='portal'; renderShell(); await loadPublicPlayers(); renderPage(); }

async function uploadFile(file, folder){
  if(!file) return '';
  const clean=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=`${folder}/${Date.now()}_${clean}`;
  const {error}=await sb.storage.from('ducks-files').upload(path,file,{upsert:false});
  if(error){throw error;}
  const {data}=sb.storage.from('ducks-files').getPublicUrl(path);
  return data.publicUrl;
}

async function submitPortalPayment(e){
  e.preventDefault();
  const player_id=document.getElementById('portalPlayer').value;
  const player=players.find(p=>p.id===player_id);
  const file=document.getElementById('portalEvidence').files[0];
  try{
    const evidence_url=await uploadFile(file,'evidencias');
    const row={
      player_id,
      student_name: player?.name || '',
      payment_date: document.getElementById('portalDate').value,
      period: document.getElementById('portalPeriod').value || period(document.getElementById('portalDate').value),
      amount: Number(document.getElementById('portalAmount').value||0),
      method: document.getElementById('portalMethod').value,
      submitted_by: document.getElementById('portalBy').value,
      notes: document.getElementById('portalNotes').value,
      confirmation_status:'Pendiente de confirmación',
      evidence_url,
      evidence_name:file.name
    };
    const {error}=await sb.from('payments').insert(row);
    if(error) throw error;
    e.target.reset();
    toast('Evidencia enviada. Queda pendiente de confirmación.');
  }catch(err){toast('Error: '+err.message);}
}

async function confirmPayment(id){ const {error}=await sb.from('payments').update({confirmation_status:'Confirmado',confirmed_at:new Date().toISOString()}).eq('id',id); if(error)toast(error.message); else{toast('Pago confirmado'); await refresh();} }
async function rejectPayment(id){ const {error}=await sb.from('payments').update({confirmation_status:'Rechazado'}).eq('id',id); if(error)toast(error.message); else{toast('Pago rechazado'); await refresh();} }
async function deletePayment(id){ if(!confirm('¿Eliminar pago?'))return; const {error}=await sb.from('payments').delete().eq('id',id); if(error)toast(error.message); else{toast('Pago eliminado'); await refresh();} }

window.confirmPayment=confirmPayment; window.rejectPayment=rejectPayment; window.deletePayment=deletePayment; window.refresh=refresh;

init();
