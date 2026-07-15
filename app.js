
async function forceFreshAssetsOnce(){
  const key = 'ducks_cache_fix_v2_70_done';
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

// Ducks CRM profesional v2.66 - botones alineados y reglamento en una sola página
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
let adminNotifications = [];
let registrationApplications = [];
let registrationModuleReady = false;
let notificationsReady = false;
let notificationChannel = null;
let q = '';

const BANK_ACCOUNT = '157 889 8256';
const BANK_CLABE = '012 180 01578898256 3';
const BANK_NAME = 'BBVA';
const BANK_BENEFICIARY = 'DUCKS BASKETBALL';
const PAYMENT_CODI_NOTE = 'Transferencia BBVA predeterminada. El administrador confirmará el comprobante.';

const ACADEMY_WHATSAPP = window.DUCKS_ACADEMY_WHATSAPP || '+5214495498220';
const ACADEMY_WHATSAPP_DIGITS = String(ACADEMY_WHATSAPP).replace(/\D/g,'');
const OFFICIAL_RECEIPT_STAMP_ASSET = 'assets/sello-pago-recibido-coach-arturo.png';
function officialReceiptStampUrl(){ return new URL(OFFICIAL_RECEIPT_STAMP_ASSET, window.location.href).href; }
const OFFICIAL_LOGO_ASSET = 'assets/logo.png';
function officialLogoUrl(){ return new URL(OFFICIAL_LOGO_ASSET, window.location.href).href; }
const ACADEMY_ADDRESS = 'Parque Boulevares 1: Jesús Sotelo Inclán, Bulevares 1ra Secc, 20288 Aguascalientes, Ags.';
const ACADEMY_HOURS = 'Lun a Vie · 5:00 p.m. a 8:00 p.m.';
const ACADEMY_MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ACADEMY_ADDRESS)}`;

const DOCUMENT_TYPES = ['Acta de nacimiento','CURP','Fotografía','Certificado médico','Identificación tutor','Comprobante de pago','Otro'];



function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),4000); }
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function money(n){return Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});}
const ACADEMY_TIME_ZONE = 'America/Mexico_City';
function academyDateParts(value=new Date()){
  const d=value instanceof Date ? value : new Date(value);
  if(Number.isNaN(d.getTime())) return null;
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:ACADEMY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(d);
  const map=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {year:Number(map.year),month:Number(map.month),day:Number(map.day)};
}
function datePartsISO(parts){
  if(!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`;
}
function todayISO(){ return datePartsISO(academyDateParts(new Date())); }
function timestampDateISO(value){
  if(!value) return '';
  const raw=String(value);
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return datePartsISO(academyDateParts(raw)) || raw.slice(0,10);
}
function parseISODate(value){
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return null;
  const parts={year:Number(m[1]),month:Number(m[2]),day:Number(m[3])};
  if(parts.month<1||parts.month>12||parts.day<1||parts.day>31) return null;
  return parts;
}
function dateSerial(parts){ return parts ? Math.floor(Date.UTC(parts.year,parts.month-1,parts.day)/86400000) : NaN; }
function compareDateParts(a,b){ return dateSerial(a)-dateSerial(b); }
function daysInMonth(year,month){ return new Date(Date.UTC(year,month,0)).getUTCDate(); }
function dueDateForMonth(year,month,paymentDay){
  return {year,month,day:Math.min(Math.max(1,Number(paymentDay)||1),daysInMonth(year,month))};
}
function shiftYearMonth(year,month,delta){
  const d=new Date(Date.UTC(year,month-1+delta,1));
  return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1};
}
function nextScheduledDateAfter(reference,paymentDay){
  let due=dueDateForMonth(reference.year,reference.month,paymentDay);
  if(compareDateParts(due,reference)<=0){
    const next=shiftYearMonth(reference.year,reference.month,1);
    due=dueDateForMonth(next.year,next.month,paymentDay);
  }
  return due;
}
function nextMonthScheduledDate(reference,paymentDay){
  const next=shiftYearMonth(reference.year,reference.month,1);
  return dueDateForMonth(next.year,next.month,paymentDay);
}
function dueDatesThrough(firstDue,today,paymentDay){
  let cursor=firstDue;
  let count=0;
  let lastDue=null;
  while(cursor && compareDateParts(cursor,today)<=0 && count<600){
    count++;
    lastDue=cursor;
    const next=shiftYearMonth(cursor.year,cursor.month,1);
    cursor=dueDateForMonth(next.year,next.month,paymentDay);
  }
  return {count,lastDue,nextDue:cursor};
}
const REGISTRATION_BILLING_START={year:2026,month:7,day:10};
const REGISTRATION_BILLING_MARKER='[DUCKS_BILLING_MODE:REGISTRATION]';
const LEGACY_BILLING_MARKER='[DUCKS_BILLING_MODE:LEGACY]';
function stripPlayerBillingMarkers(notes){
  return String(notes||'')
    .replace(/\s*\[DUCKS_BILLING_MODE:(?:REGISTRATION|LEGACY)\]/gi,'')
    .trim();
}
function hasRegistrationBillingMarker(player){
  return String(player?.notes||'').toUpperCase().includes(REGISTRATION_BILLING_MARKER);
}
function hasLegacyBillingMarker(player){
  return String(player?.notes||'').toUpperCase().includes(LEGACY_BILLING_MARKER);
}
function withRegistrationBillingMarker(notes){
  const clean=stripPlayerBillingMarkers(notes);
  return `${clean}${clean?' ':''}${REGISTRATION_BILLING_MARKER}`;
}
function playerCreationHistoryISO(player){
  const rows=playerHistory
    .filter(h=>String(h?.player_id||'')===String(player?.id||'') && String(h?.action||'').toLowerCase()==='create')
    .sort((a,b)=>String(a?.created_at||'').localeCompare(String(b?.created_at||'')));
  return rows.length?timestampDateISO(rows[0].created_at):'';
}
function playerCreatedISO(player){
  // Algunas instalaciones antiguas no tienen created_at en players.
  // En ese caso se usa el evento "create" del historial, sin confundirlo con ediciones posteriores.
  return timestampDateISO(player?.created_at) || playerCreationHistoryISO(player);
}
function usesRegistrationBilling(player){
  // El marcador interno es la fuente principal y también funciona en el Portal de Papás.
  if(hasRegistrationBillingMarker(player)) return true;
  if(hasLegacyBillingMarker(player)) return false;

  // Para jugadores creados desde el 10-jul-2026 se acepta created_at o el evento create del historial.
  // Los jugadores anteriores sin evidencia de alta nueva continúan con el esquema histórico.
  const created=parseISODate(playerCreatedISO(player));
  return !!(created && compareDateParts(created,REGISTRATION_BILLING_START)>=0);
}
async function persistRegistrationBillingMarkers(){
  if(!sb || !players.length) return;
  const candidates=players.filter(p=>usesRegistrationBilling(p) && !hasRegistrationBillingMarker(p));
  for(const player of candidates){
    const notes=withRegistrationBillingMarker(player.notes);
    const {error}=await sb.from('players').update({notes}).eq('id',player.id);
    if(!error) player.notes=notes;
    else console.warn('No se pudo guardar el esquema de cobro del jugador',player.id,error.message);
  }
}
function effectiveRegistrationISO(player){
  const registration=parseISODate(player?.registration_date);
  const created=parseISODate(playerCreatedISO(player));
  const today=parseISODate(todayISO());

  // En jugadores anteriores se muestra la fecha real de ingreso cargada desde el archivo original.
  // El cálculo histórico de adeudos permanece separado y no se reinicia por esta fecha.
  if(!usesRegistrationBilling(player)){
    return datePartsISO(registration)||datePartsISO(created)||todayISO();
  }

  // En altas nuevas, la fecha elegida manualmente es la fuente oficial.
  if(registration){
    if(today && compareDateParts(registration,today)>0){
      if(created && compareDateParts(created,today)<=0) return datePartsISO(created);
      return datePartsISO(today);
    }
    return datePartsISO(registration);
  }
  return datePartsISO(created)||todayISO();
}
function formatAcademyDateTime(value){
  if(!value) return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return String(value).replace('T',' ').slice(0,19);
  return new Intl.DateTimeFormat('es-MX',{
    timeZone:ACADEMY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).format(d);
}
function formatDateDMY(value){
  const p=parseISODate(value);
  if(!p) return '';
  return `${String(p.day).padStart(2,'0')}/${String(p.month).padStart(2,'0')}/${p.year}`;
}
function playerAge(player, referenceISO=todayISO()){
  const birth=parseISODate(player?.birth_date);
  const ref=parseISODate(referenceISO);
  if(!birth||!ref) return null;
  let age=ref.year-birth.year;
  if(ref.month<birth.month || (ref.month===birth.month&&ref.day<birth.day)) age--;
  return age>=0?age:null;
}
function isBirthdayToday(player){
  const birth=parseISODate(player?.birth_date);
  const today=parseISODate(todayISO());
  return !!(birth&&today&&birth.month===today.month&&birth.day===today.day);
}
function birthdayPlayersToday(){
  return players.filter(p=>String(p.status||'').toLowerCase()==='activo'&&isBirthdayToday(p));
}
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
  'birth_date','registration_date','monthly_fee','payment_day','uniform_number','photo_url','notes'
];
function compactPlayerSnapshot(p){
  const o = {};
  PLAYER_EDIT_FIELDS.forEach(k => o[k] = k==='notes' ? stripPlayerBillingMarkers(p?.[k]) : (p?.[k] ?? ''));
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
    category:'Categoría', status:'Estado', birth_date:'Fecha de nacimiento', registration_date:'Fecha de registro',
    monthly_fee:'Mensualidad', payment_day:'Día de pago', uniform_number:'Número uniforme',
    photo_url:'Foto', notes:'Notas'
  };
  return map[k] || k;
}

function nextId(){ const max=players.reduce((m,p)=>Math.max(m,Number(String(p.id||'').replace(/\D/g,''))||0),0); return 'D'+String(max+1).padStart(3,'0'); }
function paymentDayOptions(selectedDay=''){
  const parsed=Number(selectedDay);
  const selected=Number.isInteger(parsed) && parsed>=1 && parsed<=31 ? parsed : null;
  return Array.from({length:31},(_,i)=>i+1)
    .map(day=>`<option value="${day}" ${day===selected?'selected':''}>Día ${day}</option>`)
    .join('');
}

function paymentBalanceAfter(payment){
  const m=String(payment?.notes||'').match(/\[DUCKS_BALANCE_AFTER:([-+]?\d+(?:\.\d+)?)\]/);
  return m ? Number(m[1]) : null;
}
function paymentDebtBefore(payment){
  const m=String(payment?.notes||'').match(/\[DEBT_BEFORE:([-+]?\d+(?:\.\d+)?)\]/);
  return m ? Number(m[1]) : null;
}
function paymentConfirmedAmount(payment){
  const m=String(payment?.notes||'').match(/\[CONFIRMED_AMOUNT:([-+]?\d+(?:\.\d+)?)\]/);
  return m ? Number(m[1]) : null;
}
function paymentTypeTagValue(payment){
  const m=String(payment?.notes||'').match(/\[PAYMENT_TYPE:([^\]]+)\]/);
  return m ? m[1].trim().toLowerCase() : '';
}
function isMonthlyPayment(payment){
  const t=paymentTypeTagValue(payment);
  return !t || t==='mensualidad' || t==='monthly';
}
function paymentTypeLabelFromNotes(notes){
  const m=String(notes||'').match(/\[PAYMENT_TYPE:([^\]]+)\]/);
  const raw=m ? m[1].trim() : '';
  const map={mensualidad:'Mensualidad',inscripcion:'Inscripción',uniforme:'Uniforme',torneo:'Torneo',otro:'Otro',monthly:'Mensualidad'};
  return map[raw.toLowerCase()] || raw || 'Mensualidad';
}
function paymentTypeNoteTag(type){
  const key=String(type||'Mensualidad').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') || 'mensualidad';
  const allowed={mensualidad:1,inscripcion:1,uniforme:1,torneo:1,otro:1};
  return `[PAYMENT_TYPE:${allowed[key]?key:'otro'}]`;
}
function paymentConceptFromType(type,dateISO=todayISO()){
  const t=String(type||'Mensualidad');
  if(t==='Mensualidad') return `Mensualidad ${period(dateISO)}`;
  if(t==='Inscripción') return 'Inscripción';
  if(t==='Uniforme') return 'Uniforme';
  if(t==='Torneo') return 'Torneo';
  return 'Otro concepto';
}
function adminPaymentTypeOptions(selected='Mensualidad'){
  return ['Mensualidad','Inscripción','Uniforme','Torneo','Otro']
    .map(t=>`<option value="${t}" ${t===selected?'selected':''}>${t}</option>`).join('');
}
function cleanPaymentBalanceTags(notes){
  return String(notes||'')
    .replace(/\s*\[DUCKS_BALANCE_AFTER:[^\]]+\]/g,'')
    .replace(/\s*\[DEBT_BEFORE:[^\]]+\]/g,'')
    .replace(/\s*\[CONFIRMED_AMOUNT:[^\]]+\]/g,'')
    .trim();
}
function paymentBalanceSummary(payment,player=null){
  if(!isMonthlyPayment(payment)) return '<span class="payment-balance exact">No afecta mensualidad</span>';
  let balance=paymentBalanceAfter(payment);
  if(player&&usesRegistrationBilling(player)&&payment?.confirmation_status==='Confirmado'){
    const confirmed=confirmedPaymentsForPlayer(player,payments);
    const latest=confirmed[0]||null;
    if(latest&&String(latest.id)===String(payment.id)){
      const current=calcRegistrationPlayer(player,payments);
      balance=current.amount>0?current.amount:(current.credit>0?-current.credit:0);
    }
  }
  if(balance===null || !Number.isFinite(balance)) return '<span class="sub">—</span>';
  if(balance>0) return `<span class="payment-balance debt">Adeudo ${money(balance)}</span>`;
  if(balance<0) return `<span class="payment-balance credit">Crédito ${money(Math.abs(balance))}</span>`;
  return '<span class="payment-balance exact">Sin diferencia</span>';
}
function confirmedPaymentsForPlayer(player,payList=payments){
  // Nunca se filtran pagos por fecha de registro: el historial completo siempre cuenta.
  return payList
    .filter(p=>p.player_id===player.id && p.confirmation_status==='Confirmado' && isMonthlyPayment(p))
    .sort((a,b)=>{
      const ka=`${a.payment_date||''}|${a.confirmed_at||''}|${a.id||''}`;
      const kb=`${b.payment_date||''}|${b.confirmed_at||''}|${b.id||''}`;
      return kb.localeCompare(ka);
    });
}
function calcLegacyPlayer(player,payList=payments){
  // Replica el cálculo histórico para no cambiar meses ni saldos de jugadores existentes.
  const confirmed=confirmedPaymentsForPlayer(player,payList);
  const latest=confirmed[0]||null;
  const last=latest?.payment_date||'';
  const today=parseISODate(todayISO());
  const lastDate=parseISODate(last);
  const active=String(player.status||'').toLowerCase()==='activo';
  const fee=Number(player.monthly_fee||0);
  const paymentDay=Math.max(1,Math.min(31,Number(player.payment_day||1)));
  const elapsedMonths=lastDate&&today
    ? Math.max(0,(today.year-lastDate.year)*12+(today.month-lastDate.month))
    : 0;
  const registrationDate=effectiveRegistrationISO(player);

  if(!active){
    return {last,months:0,amount:0,status:'Inactivo',credit:0,isOverdue:false,paymentDay,registrationDate,billingMode:'legacy'};
  }

  const savedBalance=latest?paymentBalanceAfter(latest):null;
  if(savedBalance!==null && Number.isFinite(savedBalance)){
    const rawBalance=savedBalance+(elapsedMonths*fee);
    const amount=Math.max(0,Math.round(rawBalance*100)/100);
    const credit=Math.max(0,Math.round((-rawBalance)*100)/100);
    const months=amount>0&&fee>0?Math.max(1,Math.ceil(amount/fee)):0;
    const isOverdue=amount>0&&(
      savedBalance>0 ||
      elapsedMonths>1 ||
      (elapsedMonths>=1&&today&&today.day>paymentDay)
    );
    return {
      last,months,amount,
      status:amount<=0?'Pagado':(isOverdue?'Vencido':'Pendiente'),
      credit,isOverdue,paymentDay,registrationDate,balanceAfter:savedBalance,billingMode:'legacy'
    };
  }

  let months=!lastDate?1:elapsedMonths;
  months=Math.max(0,months);
  const amount=months*fee;
  const isOverdue=amount>0&&(months>1||(months===1&&today&&today.day>paymentDay));
  return {
    last,months,amount,status:amount>0?(isOverdue?'Vencido':'Pendiente'):'Pagado',
    credit:0,isOverdue,paymentDay,registrationDate,billingMode:'legacy'
  };
}
function calcRegistrationPlayer(player,payList=payments){
  const today=parseISODate(todayISO());
  const registration=parseISODate(effectiveRegistrationISO(player))||today;
  const active=String(player.status||'').toLowerCase()==='activo';
  const fee=Number(player.monthly_fee||0);
  const paymentDay=Math.max(1,Math.min(31,Number(player.payment_day||1)));
  const confirmed=confirmedPaymentsForPlayer(player,payList);
  const latest=confirmed[0]||null;
  const last=latest?.payment_date||'';

  if(!active){
    return {last,months:0,amount:0,status:'Inactivo',credit:0,isOverdue:false,paymentDay,registrationDate:datePartsISO(registration),billingMode:'registration'};
  }

  // El primer cobro siempre ocurre después de la fecha de alta.
  // No se reinicia el calendario cuando se registra un pago.
  const firstDue=nextScheduledDateAfter(registration,paymentDay);
  const schedule=firstDue&&today?dueDatesThrough(firstDue,today,paymentDay):{count:0,lastDue:null,nextDue:firstDue};

  // Para altas nuevas se usa un estado de cuenta limpio:
  // cargos vencidos/programados menos TODOS los pagos confirmados.
  // Así, un pago realizado el día del alta nunca crea adeudo; se conserva como crédito.
  const totalPaid=confirmed.reduce((sum,p)=>{
    const tagged=paymentConfirmedAmount(p);
    const value=tagged!==null&&Number.isFinite(tagged)?tagged:Number(p.amount||0);
    return sum+(Number.isFinite(value)?value:0);
  },0);
  const totalCharges=schedule.count*fee;
  const rawBalance=totalCharges-totalPaid;
  const amount=Math.max(0,Math.round(rawBalance*100)/100);
  const credit=Math.max(0,Math.round((-rawBalance)*100)/100);
  const months=amount>0&&fee>0?Math.max(1,Math.ceil(amount/fee)):0;
  const isPastLastDue=!!(schedule.lastDue&&today&&compareDateParts(today,schedule.lastDue)>0);
  const isOverdue=amount>0&&isPastLastDue;

  return {
    last,months,amount,
    status:amount<=0?'Pagado':(isOverdue?'Vencido':'Pendiente'),
    credit,isOverdue,paymentDay,
    registrationDate:datePartsISO(registration),
    balanceAfter:rawBalance,
    totalPaid,totalCharges,
    firstDue:firstDue?datePartsISO(firstDue):'',
    nextDue:schedule.nextDue?datePartsISO(schedule.nextDue):'',
    billingMode:'registration'
  };
}
function calc(player,payList=payments){
  return usesRegistrationBilling(player)
    ? calcRegistrationPlayer(player,payList)
    : calcLegacyPlayer(player,payList);
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
  if(!c.isOverdue || !player.phone) return '';
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
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:ACADEMY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${map.year}-${map.month}-${map.day}_${map.hour}-${map.minute}-${map.second}`;
}
function exportCSV(kind){
  const d = backupDate();
  if(kind === 'players'){
    const rows=players.map(p=>({
      ...p,
      notes:stripPlayerBillingMarkers(p.notes),
      registration_date:effectiveRegistrationISO(p),
      billing_scheme:usesRegistrationBilling(p)?'Alta nueva':'Histórico protegido'
    }));
    const headers=[
      {label:'ID',key:'id'}, {label:'Nombre',key:'name'}, {label:'Tutor',key:'tutor'}, {label:'WhatsApp',key:'phone'},
      {label:'Categoria',key:'category'}, {label:'Estado',key:'status'}, {label:'Fecha nacimiento',key:'birth_date'}, {label:'Edad',value:p=>playerAge(p)??''}, {label:'Fecha registro efectiva',key:'registration_date'},
      {label:'Esquema de cobro',key:'billing_scheme'}, {label:'Mensualidad',key:'monthly_fee'}, {label:'Dia pago',key:'payment_day'},
      {label:'Numero uniforme',key:'uniform_number'}, {label:'Foto URL',key:'photo_url'}, {label:'Notas',key:'notes'}
    ];
    downloadText(`ducks_jugadores_${d}.csv`, toCSV(rows, headers));
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

  if(kind === 'notifications'){
    const headers=[
      {label:'ID aviso',key:'id'}, {label:'Tipo',key:'type'}, {label:'Titulo',key:'title'},
      {label:'Mensaje',key:'message'}, {label:'ID jugador',key:'player_id'}, {label:'ID pago',key:'payment_id'},
      {label:'Creado',key:'created_at'}, {label:'Leido',key:'read_at'}, {label:'Clave evento',key:'event_key'}
    ];
    downloadText(`ducks_avisos_${d}.csv`, toCSV(adminNotifications, headers));
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
    admin_notifications: adminNotifications,
    registration_applications: registrationApplications,
    parent_accounts: parentAccounts,
    parent_player_links: parentLinks,
    debts,
    notes: 'Las fotos y comprobantes se respaldan como URLs hacia Supabase Storage.'
  };
  downloadText(`ducks_respaldo_completo_${d}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;');
}


function unreadNotificationCount(){
  return adminNotifications.filter(n=>!n.read_at).length;
}
function notificationTypeIcon(type){
  if(type==='birthday') return '🎂';
  if(type==='evidence') return '📎';
  if(type==='registration') return '📝';
  return '💳';
}
function updateNotificationBadges(){
  const count=unreadNotificationCount();
  document.querySelectorAll('[data-notification-badge]').forEach(el=>{
    el.textContent=count>99?'99+':String(count);
    el.classList.toggle('hidden',count===0);
  });
}
function notificationSeenIds(){
  try{return new Set(JSON.parse(localStorage.getItem('ducks_system_notifications_seen_v257')||'[]'));}
  catch(e){return new Set();}
}
function rememberNotificationSeen(id){
  const seen=notificationSeenIds();
  seen.add(String(id));
  localStorage.setItem('ducks_system_notifications_seen_v257',JSON.stringify([...seen].slice(-300)));
}
async function showSystemNotification(notification){
  if(!notification||!('Notification' in window)||Notification.permission!=='granted') return;
  const seen=notificationSeenIds();
  if(seen.has(String(notification.id))) return;
  const options={
    body:notification.message||'',
    icon:'assets/pwa-icon-192.png',
    badge:'assets/favicon-96.png',
    tag:notification.event_key||String(notification.id),
    data:{url:location.href,notification_id:notification.id},
    renotify:false
  };
  try{
    if('serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.ready;
      await reg.showNotification(notification.title||'Ducks Academy',options);
    }else{
      new Notification(notification.title||'Ducks Academy',options);
    }
    rememberNotificationSeen(notification.id);
  }catch(e){console.warn('No se pudo mostrar aviso del sistema',e);}
}
async function showPendingSystemNotifications(){
  if(!('Notification' in window)||Notification.permission!=='granted') return;
  for(const n of adminNotifications.filter(x=>!x.read_at).slice(0,20).reverse()) await showSystemNotification(n);
}
async function requestAdminNotificationPermission(){
  if(!('Notification' in window)){toast('Este navegador no permite avisos del sistema. Los avisos seguirán disponibles dentro del CRM.');return;}
  const permission=await Notification.requestPermission();
  if(permission==='granted'){
    toast('Avisos del dispositivo activados.');
    await showPendingSystemNotifications();
  }else if(permission==='denied') toast('Los avisos están bloqueados en el navegador. Puedes habilitarlos en los permisos del sitio.');
  else toast('No se activaron los avisos del dispositivo.');
}
async function loadAdminNotifications(){
  notificationsReady=false;
  try{
    const birthdayResult=await sb.rpc('ducks_refresh_birthday_notifications_v257');
    if(birthdayResult.error&&!/could not find|does not exist|schema cache/i.test(birthdayResult.error.message||'')) console.warn(birthdayResult.error.message);
    const nt=await sb.from('admin_notifications_v257').select('*').order('created_at',{ascending:false}).limit(250);
    if(nt.error){
      adminNotifications=[];
      return;
    }
    adminNotifications=nt.data||[];
    notificationsReady=true;
    updateNotificationBadges();
    await showPendingSystemNotifications();
  }catch(e){adminNotifications=[];notificationsReady=false;}
}
function setupNotificationRealtime(){
  if(!sb||!session||notificationChannel) return;
  notificationChannel=sb.channel('ducks-admin-notifications-v257')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'admin_notifications_v257'},payload=>{
      const incoming=payload.new;
      if(!adminNotifications.some(n=>String(n.id)===String(incoming.id))) adminNotifications.unshift(incoming);
      updateNotificationBadges();
      toast(`${notificationTypeIcon(incoming.type)} ${incoming.title}`);
      showSystemNotification(incoming);
      if(incoming.type==='registration'){
        loadRegistrationApplications().then(()=>{if(mode==='admin'&&(page==='registrations'||page==='dashboard')) renderPage();});
      }else if(mode==='admin'&&(page==='notifications'||page==='dashboard')) renderPage();
    })
    .subscribe();
}
async function markNotificationRead(id){
  const row=adminNotifications.find(n=>String(n.id)===String(id));
  if(!row||row.read_at) return;
  const readAt=new Date().toISOString();
  const {error}=await sb.from('admin_notifications_v257').update({read_at:readAt}).eq('id',id);
  if(error){toast('No se pudo marcar el aviso: '+error.message);return;}
  row.read_at=readAt;
  updateNotificationBadges();
  if(page==='notifications') renderNotifications();
}
async function markAllNotificationsRead(){
  const unread=adminNotifications.filter(n=>!n.read_at);
  if(!unread.length){toast('No hay avisos pendientes.');return;}
  const readAt=new Date().toISOString();
  const {error}=await sb.from('admin_notifications_v257').update({read_at:readAt}).is('read_at',null);
  if(error){toast('No se pudieron actualizar los avisos: '+error.message);return;}
  unread.forEach(n=>n.read_at=readAt);
  updateNotificationBadges();
  renderNotifications();
  toast('Todos los avisos quedaron marcados como leídos.');
}
async function openNotificationTarget(id){
  const n=adminNotifications.find(x=>String(x.id)===String(id));
  if(!n) return;
  await markNotificationRead(id);
  q=n.player_id||'';
  const search=document.getElementById('search'); if(search) search.value=q;
  page=n.type==='evidence'?'evidence':(n.type==='payment'?'payments':(n.type==='registration'?'registrations':'players'));
  if(n.type==='registration') await loadRegistrationApplications();
  renderPage();
}
function notificationSetupNotice(){
  if(notificationsReady) return '';
  return `<div class="notice warning"><b>Falta activar el módulo de avisos:</b> ejecuta en Supabase el archivo <b>PASO_12_SQL_FECHAS_Y_AVISOS_v2_57.sql</b> incluido en esta versión.</div>`;
}
function renderNotifications(){
  setTitle('Avisos');
  const list=adminNotifications.filter(n=>{
    const search=q.toLowerCase().trim();
    return !search||[n.title,n.message,n.player_id,n.type].join(' ').toLowerCase().includes(search);
  });
  document.getElementById('content').innerHTML=`${notificationSetupNotice()}<div class="panel"><div class="panel-head"><div><h3>Centro de avisos</h3><p class="sub">Cumpleaños, pagos, evidencias y nuevas solicitudes de ingreso.</p></div><div class="actions"><button class="btn secondary" onclick="requestAdminNotificationPermission()">🔔 Activar avisos del dispositivo</button><button class="btn green" onclick="markAllNotificationsRead()">Marcar todos como leídos</button></div></div><div class="notification-list">${list.map(n=>`<article class="notification-card ${n.read_at?'read':'unread'}"><div class="notification-icon">${notificationTypeIcon(n.type)}</div><div class="notification-content"><div class="notification-title-row"><h4>${esc(n.title)}</h4><span>${esc(formatAcademyDateTime(n.created_at))}</span></div><p>${esc(n.message)}</p><small>${esc(n.player_id||'')}</small></div><div class="notification-actions"><button class="btn secondary" onclick="openNotificationTarget('${n.id}')">Abrir</button>${n.read_at?'':'<button class="btn green" onclick="markNotificationRead(\''+n.id+'\')">Leído</button>'}</div></article>`).join('')||'<div class="notice success">No hay avisos registrados.</div>'}</div></div>`;
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
  document.body.classList.add('ducks-premium-skin');
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
  return `<nav class="public-bottom-nav ducks-main-bottom-nav" aria-label="Navegación principal inferior">
    <button type="button" onclick="renderPublicHome()" aria-label="Inicio"><span class="bottom-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"></path><path d="M5.5 10.5V20h13v-9.5"></path><path d="M9.5 20v-6h5v6"></path></svg></span><span>Inicio</span></button>
    <button type="button" onclick="openPublicNewsHub()" aria-label="Noticias"><span class="bottom-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M8 9h8M8 12h8M8 15h5"></path></svg></span><span>Noticias</span></button>
    <button type="button" class="bottom-logo-action ducks-center-logo" onclick="renderPublicHome()" aria-label="Ducks inicio"><span class="bottom-logo-ring"><img src="assets/logo.png" alt="Ducks"></span></button>
    <button type="button" onclick="openDucksWhatsApp('Hola, quiero información de Ducks Basketball Academy.')" aria-label="Mensajes"><span class="bottom-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 4.8 21l3.3-1A8 8 0 1 0 4 12c0 1.3.3 2.5.8 3.6"></path><path d="M8.6 9.6c.2-.5.5-.5.7-.5h.6c.2 0 .4 0 .5.4.2.5.7 1.7.8 1.8.1.2.1.3 0 .5l-.4.5c-.1.1-.2.2-.1.4.2.4.8 1.2 1.6 1.8 1 .8 1.8 1.1 2.1 1.2.2.1.4 0 .5-.1l.6-.7c.2-.2.3-.2.5-.1l1.8.8c.2.1.4.2.4.4v.4c-.1.6-.7 1.2-1.5 1.4-.6.2-1.3.2-2.1-.1-1.1-.4-2.5-1.2-3.8-2.4-1-1-1.8-2.1-2.3-3.2-.4-.9-.5-1.6-.3-2.2.2-.8.8-1.5 1.4-1.8Z"></path></svg></span><span>Mensajes</span></button>
    <button type="button" onclick="openPublicMoreMenu()" aria-label="Más"><span class="bottom-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.25"></circle><circle cx="12" cy="12" r="1.25"></circle><circle cx="18.5" cy="12" r="1.25"></circle></svg></span><span>Más</span></button>
  </nav>`;
}

function publicVisibleNotifications(){
  return (adminNotifications||[]).filter(n=>!n.read_at && ['birthday','notice','general','announcement'].includes(String(n.type||'').toLowerCase()));
}
function publicNotificationBadgeCount(){
  return publicVisibleNotifications().length;
}

function publicNotificationCard(icon,title,body,action=''){
  return `<article class="public-alert-card"><div class="public-alert-icon">${icon}</div><div><b>${esc(title)}</b><span>${body}</span>${action}</div></article>`;
}
function publicNotificationRows(){
  const rows=[];
  const visible=publicVisibleNotifications();
  const birthdayItems = visible.filter(n=>String(n.type||'').toLowerCase()==='birthday');
  const noticeItems = visible.filter(n=>['notice','general','announcement'].includes(String(n.type||'').toLowerCase()));

  if(noticeItems.length){
    noticeItems.slice(0,6).forEach(n=>rows.push(publicNotificationCard('📣', n.title||'Nuevo aviso', esc(n.body||n.message||'Hay un nuevo aviso disponible.'))));
  }
  if(birthdayItems.length){
    birthdayItems.slice(0,6).forEach(n=>rows.push(publicNotificationCard('🎂', n.title||'Cumpleaños Ducks', esc(n.body||n.message||'Hay un cumpleaños por celebrar.'))));
  }
  if(!rows.length){
    rows.push(publicNotificationCard('🔔','Sin avisos nuevos','No hay avisos ni cumpleaños nuevos por el momento.'));
  }
  return rows.join('');
}
function openPublicNotifications(){
  const previous=document.getElementById('publicNoticeModal');
  if(previous) previous.remove();
  const unread=publicNotificationBadgeCount();
  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='publicNoticeModal';
  modal.innerHTML=`<div class="modal notification-modal public-notification-center"><div class="modal-head"><div><h3>Centro de avisos Ducks</h3><small>${unread?`${unread} aviso(s) nuevo(s)`:'Avisos y cumpleaños'}</small></div><button class="btn secondary" onclick="closeModal('publicNoticeModal')">Cerrar</button></div><div class="modal-body">
    <div class="public-alert-list">${publicNotificationRows()}</div>
    <div class="public-notice-actions">
      <button class="btn green" onclick="closeModal('publicNoticeModal')">Entendido</button>
      <button class="btn secondary" onclick="closeModal('publicNoticeModal');showCalendarNotice()">Calendario</button>
      <button class="btn secondary" onclick="closeModal('publicNoticeModal');installDucksApp()">Instalar app</button>
    </div>
  </div></div>`;
  document.body.appendChild(modal);
}

function openPublicNewsHub(){
  const previous=document.getElementById('publicNewsModal');
  if(previous) previous.remove();
  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='publicNewsModal';
  modal.innerHTML=`<div class="modal wide-modal"><div class="modal-head"><div><h3>Noticias Ducks</h3><small>Novedades rápidas de la academia</small></div><button class="btn secondary" onclick="closeModal('publicNewsModal')">Cerrar</button></div><div class="modal-body"><div class="ducks-news-list">
    <article><h4>Nuevo ingreso abierto</h4><p>El cuestionario digital está disponible para registrar nuevos jugadores directamente desde el portal.</p></article>
    <article><h4>Portal de Papás</h4><p>Consulta pagos, evidencia, historial y estados de cuenta de cada hijo desde Mi cuenta.</p></article>
    <article><h4>Calendario y categorías</h4><p>Revisa partidos, categorías y actividades para mantenerte al día con la academia.</p></article>
  </div></div></div>`;
  document.body.appendChild(modal);
}

function openPublicMoreMenu(){
  const previous=document.getElementById('publicMoreModal');
  if(previous) previous.remove();
  const modal=document.createElement('div');
  modal.className='modalbg open public-more-overlay';
  modal.id='publicMoreModal';
  modal.innerHTML=`<div class="modal public-more-modal"><div class="modal-head"><div><h3>Más opciones</h3><small>Ducks Basketball Academy</small></div><button class="btn secondary" onclick="closeModal('publicMoreModal')">Cerrar</button></div><div class="modal-body"><div class="public-more-grid">
    <button onclick="closeModal('publicMoreModal');renderRegistrationForm()">📝 Nuevo ingreso</button>
    <button onclick="closeModal('publicMoreModal');openParentSectionAction('pay')">💳 Pagos y comprobantes</button>
    <button onclick="closeModal('publicMoreModal');showCalendarNotice()">📅 Calendario</button>
    <button onclick="closeModal('publicMoreModal');openCategoriesInfo()">🏀 Categorías</button>
    <button onclick="closeModal('publicMoreModal');openValuesInfo()">⭐ Valores</button>
    <button onclick="closeModal('publicMoreModal');openDucksRegulation()">📘 Reglamento</button>
    <button onclick="closeModal('publicMoreModal');openDucksWhatsApp('Hola, quiero información de Ducks Basketball Academy.')">☎️ Contacto</button>
    <button onclick="closeModal('publicMoreModal');installDucksApp()">📲 Instalar app</button>
    <button onclick="closeModal('publicMoreModal');renderAdminLogin()">🔐 Administrador</button>
  </div></div></div>`;
  document.body.appendChild(modal);
}

const PORTAL_SEARCH_INDEX = [
  {title:'Inicio', section:'inicio', keywords:'inicio principal video portada ducks academia'},
  {title:'Nuevo ingreso', action:'registration', keywords:'nuevo ingreso registro jugador cuestionario salud inscripción inscripcion'},
  {title:'Pagos y comprobantes', section:'pagos', keywords:'pago pagos comprobante evidencia transferencia efectivo mensualidad portal papás padres'},
  {title:'Calendario de juegos', section:'calendario', keywords:'calendario juego juegos partido partidos torneo fecha horario sede'},
  {title:'Academia', section:'academia', keywords:'academia quiénes somos quienes somos historia formación deportiva'},
  {title:'Entrenamiento', section:'entrenamiento', keywords:'entrenamiento sesiones horarios técnica fundamentos preparación física'},
  {title:'Competencias y comunidad', section:'competencias', keywords:'competencia competencias comunidad torneos familia convivencia'},
  {title:'Reglamento Ducks', section:'reglamento', keywords:'reglamento reglas normas disciplina seguridad conducta'},
  {title:'Categorías', section:'categorias', keywords:'categorias categorías peques infantil intermedia juvenil edades niveles grupo'},
  {title:'Valores', section:'valores', keywords:'valores respeto disciplina trabajo equipo esfuerzo compañerismo'},
  {title:'Contacto', section:'contacto', keywords:'contacto whatsapp teléfono telefono ubicación ubicacion dirección direccion informes'},
  {title:'Mi cuenta / Portal de Papás', action:'account', keywords:'mi cuenta portal papas papás padres usuario contraseña login sesión sesion'}
];
function portalSearchNormalize(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function portalSearchGo(itemTitle){
  const item=PORTAL_SEARCH_INDEX.find(x=>x.title===itemTitle);
  if(!item) return;
  closeModal('portalSearchModal');
  if(item.action==='registration') return renderRegistrationForm();
  if(item.action==='account') return renderParentLogin();
  renderPublicHome();
  setTimeout(()=>document.getElementById(item.section)?.scrollIntoView({behavior:'smooth',block:'start'}),160);
}
function renderPortalSearchResults(query=''){
  const host=document.getElementById('portalSearchResults');
  if(!host) return;
  const q=portalSearchNormalize(query);
  if(!q){ host.innerHTML=''; return; }
  const words=q.split(/\s+/).filter(Boolean);
  const matches=PORTAL_SEARCH_INDEX.filter(item=>{
    const haystack=portalSearchNormalize(`${item.title} ${item.keywords}`);
    return words.every(word=>haystack.includes(word));
  });
  host.innerHTML=matches.length?matches.map(item=>`<button type="button" class="portal-search-result" onclick="portalSearchGo('${item.title.replace(/'/g,"\'")}')"><span class="portal-search-result-icon">${item.action==='account'?'♙':item.action==='registration'?'＋':'⌁'}</span><span><b>${item.title}</b><small>${item.keywords.split(' ').slice(0,7).join(' ')}</small></span><span class="portal-search-arrow">›</span></button>`).join(''):`<div class="portal-search-empty"><b>No encontramos coincidencias.</b><span>Prueba con palabras como pagos, horarios, categorías, reglamento o contacto.</span></div>`;
}
function openPortalSearch(){
  const previous=document.getElementById('portalSearchModal');
  if(previous) previous.remove();
  const modal=document.createElement('div');
  modal.className='modalbg open portal-search-overlay';
  modal.id='portalSearchModal';
  modal.innerHTML=`<div class="modal portal-search-modal"><div class="modal-head"><div><h3>Buscar en el portal</h3><small>Escribe una palabra para localizar una sección</small></div><button class="btn secondary" onclick="closeModal('portalSearchModal')">Cerrar</button></div><div class="modal-body"><label class="portal-search-box"><span>⌕</span><input id="portalSearchInput" type="search" autocomplete="off" placeholder="Ejemplo: pagos, categorías, horarios..." oninput="renderPortalSearchResults(this.value)"></label><div id="portalSearchResults" class="portal-search-results"></div></div></div>`;
  document.body.appendChild(modal);
  setTimeout(()=>document.getElementById('portalSearchInput')?.focus(),80);
}

function adminQuickMenu(){
  return `<header class="admin-top-fixed">
    <div class="admin-top-inner">
      <button onclick="renderPublicHome()" class="admin-home-btn">🏠 Inicio público</button>
      <button onclick="page='dashboard';renderPage()">Dashboard</button>
      <button onclick="page='notifications';renderPage()">Avisos <span class="notification-badge hidden" data-notification-badge>0</span></button>
      <button onclick="page='registrations';renderPage()">Solicitudes</button>
      <button onclick="page='players';renderPage()">Jugadores</button>
      <button onclick="page='parents';renderPage()">Papás</button>
      <button onclick="page='payments';renderPage()">Pagos</button>
      <button onclick="page='documents';renderPage()">Documentos</button>
      <button onclick="page='backups';renderPage()">Respaldos</button>
    </div>
  </header>`;
}

function renderSetup(){ app.innerHTML=`${publicQuickMenu()}<div class="public-site with-global-menu"><div class="academy-main"><div class="parent-card"><h1>Configurar Supabase</h1><div class="notice warning">Falta configurar config.js.</div></div></div></div>`; }

function scrollToPublicSection(id){
  const target=document.getElementById(id);
  if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
}
function showCalendarNotice(){
  toast('El calendario digital está en preparación. Los horarios oficiales se comunican por los canales de Ducks.');
}
function openDucksWhatsApp(message='Hola, necesito información de Ducks Basketball Academy.'){
  const url=`https://wa.me/${ACADEMY_WHATSAPP_DIGITS}?text=${encodeURIComponent(message)}`;
  window.open(url,'_blank','noopener');
}
function openAcademyStory(){
  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='academyStoryModal';
  modal.innerHTML=`<div class="modal wide-modal section-info-modal"><div class="modal-head"><div><h3>Sobre Ducks Basketball Academy</h3><small>Formación deportiva y desarrollo integral</small></div><button class="btn secondary" onclick="closeModal('academyStoryModal')">Cerrar</button></div><div class="modal-body"><div class="section-info-grid"><article><h4>Nuestra misión</h4><p>Formar niños y jóvenes mediante el basketball, fortaleciendo disciplina, respeto, responsabilidad y trabajo en equipo.</p></article><article><h4>Desarrollo deportivo</h4><p>Trabajamos fundamentos, coordinación, condición física, técnica y comprensión del juego de acuerdo con la edad y nivel de cada jugador.</p></article><article><h4>Comunidad Ducks</h4><p>Promovemos una relación cercana entre jugadores, familias y entrenadores para crear un entorno positivo, seguro y competitivo.</p></article></div><div class="actions"><button class="btn green" onclick="closeModal('academyStoryModal');scrollToPublicSection('entrenamiento')">Conocer entrenamiento</button><button class="btn secondary" onclick="closeModal('academyStoryModal');scrollToPublicSection('contacto')">Contactar academia</button></div></div></div>`;
  document.body.appendChild(modal);
}
function openTrainingInfo(){
  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='trainingInfoModal';
  modal.innerHTML=`<div class="modal wide-modal section-info-modal"><div class="modal-head"><div><h3>Programa de entrenamiento Ducks</h3><small>Sesiones adaptadas por edad y nivel</small></div><button class="btn secondary" onclick="closeModal('trainingInfoModal')">Cerrar</button></div><div class="modal-body"><div class="section-info-grid"><article><h4>Fundamentos</h4><p>Drible, pase, tiro, defensa, coordinación y toma de decisiones.</p></article><article><h4>Preparación física</h4><p>Movilidad, resistencia, velocidad, equilibrio y prevención de lesiones.</p></article><article><h4>Disciplina deportiva</h4><p>Puntualidad, constancia, esfuerzo, respeto y trabajo en equipo.</p></article></div><div class="actions"><button class="btn green" onclick="closeModal('trainingInfoModal');openDucksWhatsApp('Hola, quiero conocer los horarios y categorías de entrenamiento de Ducks Basketball Academy.')">Consultar horarios</button><button class="btn secondary" onclick="closeModal('trainingInfoModal');scrollToPublicSection('categorias')">Ver categorías</button></div></div></div>`;
  document.body.appendChild(modal);
}
function openCommunityInfo(){
  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='communityInfoModal';
  modal.innerHTML=`<div class="modal wide-modal section-info-modal"><div class="modal-head"><div><h3>Competencias y comunidad Ducks</h3><small>Torneos, juegos y convivencia deportiva</small></div><button class="btn secondary" onclick="closeModal('communityInfoModal')">Cerrar</button></div><div class="modal-body"><div class="section-info-grid"><article><h4>Competencias</h4><p>Participación en partidos, torneos y actividades de acuerdo con cada categoría.</p></article><article><h4>Familias</h4><p>Comunicación y acompañamiento de madres, padres y tutores en el proceso deportivo.</p></article><article><h4>Valores</h4><p>Compañerismo, respeto, juego limpio, compromiso y orgullo de representar a Ducks.</p></article></div><div class="actions"><button class="btn green" onclick="closeModal('communityInfoModal');scrollToPublicSection('calendario')">Ver calendario</button><button class="btn secondary" onclick="closeModal('communityInfoModal');openDucksWhatsApp('Hola, quiero información sobre torneos y actividades de la comunidad Ducks.')">Solicitar información</button></div></div></div>`;
  document.body.appendChild(modal);
}

function openCategoriesInfo(){
  document.getElementById('categoriesInfoModal')?.remove();
  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='categoriesInfoModal';
  modal.innerHTML=`<div class="modal categories-detail-modal"><div class="modal-head"><div><h3>Categorías Ducks</h3><small>Desarrollo deportivo según edad y etapa</small></div><button class="btn secondary" onclick="closeModal('categoriesInfoModal')">Cerrar</button></div><div class="modal-body categories-detail-body">
    <div class="notice success"><b>Formación progresiva:</b> cada etapa tiene objetivos diferentes. La prioridad es respetar el desarrollo físico, técnico, emocional y competitivo de cada jugador.</div>
    <div class="categories-detail-grid">
      <article class="category-detail-card peques">
        <div class="category-detail-head"><span>6–8 años</span><h4>Peques o Iniciación</h4></div>
        <p class="category-intro">El balón es casi secundario; lo prioritario es el desarrollo motor general.</p>
        <ul>
          <li>Habilidades motrices básicas: correr, saltar, lanzar, atrapar y cambiar de dirección.</li>
          <li>Coordinación óculo-manual con balón, sin exigir perfección técnica: bote simple, recepción y pases cortos.</li>
          <li>Aprendizaje mediante juegos, relevos, dinámicas y actividades cortas y variadas.</li>
          <li>Balón y aro adaptados a su tamaño, cuando sea posible.</li>
          <li>Cero presión por el resultado; el objetivo es que disfruten y se enamoren del deporte.</li>
          <li>Se recomienda que también practiquen otros deportes.</li>
        </ul>
      </article>
      <article class="category-detail-card infantil">
        <div class="category-detail-head"><span>9–11 años</span><h4>Infantil · Aprendizaje de habilidades</h4></div>
        <p class="category-intro">Es la “ventana dorada” del aprendizaje motor: la técnica adquirida aquí tiene gran impacto a largo plazo.</p>
        <ul>
          <li>Fundamentos individuales con atención a la forma: tiro, bote con ambas manos, pases de pecho y picado.</li>
          <li>Defensa básica: postura y desplazamientos laterales.</li>
          <li>Introducción a conceptos tácticos simples: espacios y movimiento sin balón.</li>
          <li>Juegos reducidos 3c3 y 4c4 para aumentar el contacto con el balón.</li>
          <li>Competencia sana, sin colocar el resultado como prioridad.</li>
          <li>Trabajo continuo de coordinación, agilidad y equilibrio.</li>
        </ul>
      </article>
      <article class="category-detail-card intermedia">
        <div class="category-detail-head"><span>12–14 años</span><h4>Intermedio o Consolidación</h4></div>
        <p class="category-intro">Coincide con la pubertad y el estirón; pueden existir cambios temporales en la coordinación.</p>
        <ul>
          <li>Perfeccionamiento técnico bajo presión: velocidad, tiro en movimiento y finalizaciones.</li>
          <li>Fuerza estructurada con peso corporal, estabilidad y prevención de lesiones.</li>
          <li>Evitar cargas pesadas mientras continúa el desarrollo óseo.</li>
          <li>Táctica de equipo: sistemas de ataque y defensa, bloqueos y ayudas defensivas.</li>
          <li>Lectura de juego y toma de decisiones.</li>
          <li>Trabajo por posición sin perder la versatilidad.</li>
          <li>Manejo emocional: frustración, disciplina y competitividad sana.</li>
        </ul>
      </article>
      <article class="category-detail-card juvenil">
        <div class="category-detail-head"><span>15–18 años</span><h4>Juvenil · Especialización y alto rendimiento</h4></div>
        <ul>
          <li>Especialización por posición y perfeccionamiento de habilidades específicas.</li>
          <li>Preparación física avanzada: fuerza progresiva, potencia, velocidad y resistencia específica.</li>
          <li>Táctica avanzada, ajustes según el rival y roles definidos.</li>
          <li>Preparación mental: presión competitiva, liderazgo y resiliencia.</li>
          <li>El resultado y la competencia adquieren mayor relevancia.</li>
          <li>Nutrición deportiva y prevención de lesiones más especializada.</li>
          <li>Para proyección universitaria o profesional, desarrollo de un perfil de juego propio.</li>
        </ul>
      </article>
    </div>
    <div class="actions categories-detail-actions"><button class="btn green" onclick="closeModal('categoriesInfoModal');openDucksWhatsApp('Hola, quiero saber qué categoría corresponde a mi hijo en Ducks Basketball Academy.')">Consultar categoría</button><button class="btn secondary" onclick="closeModal('categoriesInfoModal')">Cerrar</button></div>
  </div></div>`;
  document.body.appendChild(modal);
}

function openValuesInfo(){
  document.getElementById('valuesInfoModal')?.remove();
  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='valuesInfoModal';
  modal.innerHTML=`<div class="modal wide-modal section-info-modal"><div class="modal-head"><div><h3>Valores Ducks</h3><small>Formación integral dentro y fuera de la cancha</small></div><button class="btn secondary" onclick="closeModal('valuesInfoModal')">Cerrar</button></div><div class="modal-body"><div class="section-info-grid"><article><h4>Respeto y disciplina</h4><p>Fomentamos orden, responsabilidad, puntualidad y una convivencia sana.</p></article><article><h4>Trabajo en equipo</h4><p>Enseñamos a colaborar, competir con juego limpio y apoyar a la familia Ducks.</p></article><article><h4>Esfuerzo y compañerismo</h4><p>Buscamos que cada jugador crezca con actitud positiva y compromiso constante.</p></article></div><div class="actions"><button class="btn green" onclick="closeModal('valuesInfoModal');openDucksWhatsApp('Hola, quiero conocer más sobre los valores y la formación integral de Ducks Basketball Academy.')">Vivir Ducks</button><button class="btn secondary" onclick="closeModal('valuesInfoModal');scrollToPublicSection('academia')">Conocer academia</button></div></div></div>`;
  document.body.appendChild(modal);
}

function openAcademyMap(){
  window.open(ACADEMY_MAP_URL,'_blank','noopener');
}

function openDucksRegulation(){
  const modal=document.createElement('div');
  modal.className='modalbg open regulation-viewer-overlay';
  modal.id='ducksRegulationModal';
  modal.innerHTML=`<div class="modal regulation-viewer-modal single-page"><div class="modal-head"><div><h3>Reglamento Interno Ducks</h3><small>Versión resumida de 1 página</small></div><button class="btn secondary" onclick="closeModal('ducksRegulationModal')">Cerrar</button></div><div class="modal-body regulation-viewer-body"><div class="notice success"><b>Consulta rápida:</b> esta versión muestra en una sola vista los lineamientos principales de la academia.</div><div class="regulation-onepage"><div class="regulation-onepage-head"><img src="assets/logo.png" alt="Ducks"><div><h4>Academia de Baloncesto DUCKS</h4><p>Reglamento interno · resumen oficial</p></div></div><div class="regulation-summary-grid"><article><h5>1. Objetivo</h5><ul><li>Fomentar valores, salud, disciplina y desarrollo integral.</li><li>Fortalecer habilidades técnicas, tácticas y competitivas.</li></ul></article><article><h5>2. Inscripción y participación</h5><ul><li>Completar formulario, certificado médico y carta responsiva.</li><li>Cubrir cuotas a tiempo y usar uniforme oficial.</li></ul></article><article><h5>3. Horarios y asistencia</h5><ul><li>Entrenamientos de lunes a viernes de 17:00 a 20:00 hrs.</li><li>La asistencia es obligatoria; faltas deben justificarse.</li></ul></article><article><h5>4. Normas de conducta</h5><ul><li>Respeto, disciplina y puntualidad en todo momento.</li><li>Madres y padres pueden observar sin intervenir en las sesiones.</li></ul></article><article><h5>5. Instalaciones</h5><ul><li>Mantener orden, limpieza y uso correcto de las áreas.</li><li>Depositar basura en su lugar y reportar daños.</li></ul></article><article><h5>6. Entrenadores y personal</h5><ul><li>Planifican, motivan, evalúan y comunican avances.</li><li>Deben promover disciplina y ambiente positivo.</li></ul></article><article><h5>7. Seguridad y salud</h5><ul><li>Seguir medidas de seguridad en entrenamientos y partidos.</li><li>Ante lesiones se avisa de inmediato a la familia.</li></ul></article><article><h5>8. Competencias y torneos</h5><ul><li>Los jugadores seleccionados representan a Ducks.</li><li>Se espera compromiso, esfuerzo y dedicación.</li></ul></article><article><h5>9. Padres de familia</h5><ul><li>Apoyar, motivar y mantener comunicación con la academia.</li><li>Respetar decisiones de entrenadores, árbitros y jueces.</li></ul></article><article><h5>10. Sanciones</h5><ul><li>El incumplimiento puede generar advertencias o expulsión.</li></ul></article><article><h5>11. Modificaciones</h5><ul><li>La dirección puede revisar el reglamento y notificará cambios.</li></ul></article><article class="regulation-highlight"><h5>Compromiso Ducks</h5><p>Buscamos un ambiente seguro, formativo, respetuoso y competitivo para cada jugador y su familia.</p></article></div><div class="regulation-onepage-foot">Para cualquier aclaración, contacta a Ducks Basketball Academy por sus canales oficiales.</div></div><div class="actions regulation-viewer-actions"><button class="btn green" onclick="downloadDucksRegulation()">Descargar PDF</button><button class="btn secondary" onclick="closeModal('ducksRegulationModal')">Cerrar reglamento</button></div></div></div>`;
  document.body.appendChild(modal);
}
function downloadDucksRegulation(){
  const a=document.createElement('a');
  a.href=new URL('assets/reglamento-ducks-1-pagina-v266.pdf',window.location.href).href;
  a.download='Reglamento_Interno_Ducks_1_Pagina.pdf';
  document.body.appendChild(a); a.click(); a.remove();
}
function runPendingParentEntryAction(){
  const action=sessionStorage.getItem('ducks_parent_entry_action')||'';
  sessionStorage.removeItem('ducks_parent_entry_action');
  if(!action) return;
  setTimeout(()=>{
    if(action==='pay') openParentPayNow();
    if(action==='evidence') openParentPayment();
  },260);
}
function resetParentSessionForFreshLogin(){
  parentToken='';
  parentProfile=null;
  parentPlayers=[];
  parentPayments=[];
  parentDocuments=[];
  localStorage.removeItem('ducks_parent_token_v213');
}
async function openParentSectionAction(action='portal'){
  sessionStorage.setItem('ducks_parent_entry_action',action);
  resetParentSessionForFreshLogin();
  renderParentLogin();
}

function renderPublicHome(){
  document.body.classList.add('ducks-premium-skin');
  mode='public'; rememberScreen('public:');
  app.innerHTML=`<div class="public-site ducks-mockup-home">
    <main class="ducks-mockup-wrap">
      <section id="inicio" class="ducks-mockup-screen" aria-label="Portada principal Ducks Basketball Academy">
        <img src="assets/home-premium-v316.webp" alt="Portada principal Ducks Basketball Academy" class="ducks-mockup-image" fetchpriority="high">
        <div class="mockup-screen-bg-fill" aria-hidden="true"></div>
        <div class="mockup-section-gap gap-video"></div>
        <div class="mockup-section-gap gap-cards"></div>
        <div class="mockup-section-gap gap-banner"></div>

        <button class="mockup-hotspot hs-bell" type="button" aria-label="Avisos" onclick="openPublicNotifications()"></button>
        <button class="mockup-hotspot hs-video" type="button" aria-label="Video destacado" onclick="openAcademyStory()"></button>

        <button class="mockup-hotspot hs-card hs-card-1" type="button" aria-label="Nuevo ingreso" onclick="renderRegistrationForm()"></button>
        <button class="mockup-hotspot hs-card hs-card-2" type="button" aria-label="Academia" onclick="openAcademyStory()"></button>
        <button class="mockup-hotspot hs-card hs-card-3" type="button" aria-label="Contacto" onclick="openDucksWhatsApp('Hola, quiero información de Ducks Basketball Academy.')"></button>
        <button class="mockup-hotspot hs-card hs-card-4" type="button" aria-label="Mi cuenta" onclick="renderParentLogin()"></button>

        <button class="mockup-hotspot hs-card hs-card-5" type="button" aria-label="Pagos y comprobantes" onclick="openParentSectionAction('pay')"></button>
        <button class="mockup-hotspot hs-card hs-card-6" type="button" aria-label="Calendario" onclick="showCalendarNotice()"></button>
        <button class="mockup-hotspot hs-card hs-card-7" type="button" aria-label="Categorías" onclick="openCategoriesInfo()"></button>
        <button class="mockup-hotspot hs-card hs-card-8" type="button" aria-label="Valores" onclick="openValuesInfo()"></button>

        <button class="mockup-hotspot hs-banner" type="button" aria-label="Conoce más sobre Ducks" onclick="openAcademyStory()"></button>

        <button class="mockup-hotspot hs-nav-home" type="button" aria-label="Inicio" onclick="renderPublicHome()"></button>
        <button class="mockup-hotspot hs-nav-news" type="button" aria-label="Noticias" onclick="openPublicNewsHub()"></button>
        <button class="mockup-hotspot hs-nav-logo" type="button" aria-label="Ducks inicio" onclick="renderPublicHome()"></button>
        <button class="mockup-hotspot hs-nav-messages" type="button" aria-label="Mensajes" onclick="openDucksWhatsApp('Hola, quiero información de Ducks Basketball Academy.')"></button>
        <button class="mockup-hotspot hs-nav-more" type="button" aria-label="Más opciones" onclick="openPublicMoreMenu()"></button>
      </section>
    </main>
  </div>`;
}

/* Portal papás limpio v210 */

function registrationYesNo(name, question, detailId='', detailLabel='Si la respuesta es sí, explica brevemente'){
  return `<fieldset class="registration-question"><legend>${esc(question)} <span class="required-star">*</span></legend><div class="radio-cards"><label><input type="radio" name="${name}" value="Si" required onchange="toggleRegistrationDetail('${name}','${detailId}')"><span>Sí</span></label><label><input type="radio" name="${name}" value="No" required onchange="toggleRegistrationDetail('${name}','${detailId}')"><span>No</span></label></div>${detailId?`<label id="${detailId}Wrap" class="label registration-detail hidden">${esc(detailLabel)}<textarea id="${detailId}" name="${detailId}" class="input" rows="3"></textarea></label>`:''}</fieldset>`;
}
function toggleRegistrationDetail(name, detailId){
  if(!detailId) return;
  const selected=document.querySelector(`input[name="${name}"]:checked`)?.value;
  const wrap=document.getElementById(detailId+'Wrap');
  const input=document.getElementById(detailId);
  if(!wrap||!input) return;
  const show=selected==='Si';
  wrap.classList.toggle('hidden',!show);
  input.required=show;
  if(!show) input.value='';
}
function renderRegistrationForm(){
  mode='public'; rememberScreen('public:registration');
  app.innerHTML=`${publicQuickMenu()}<div class="public-site with-global-menu registration-page"><main class="academy-main registration-main">
    <section class="registration-form-shell" id="registrationPrintable">
      <div class="registration-form-header"><img src="assets/logo.png" alt="Ducks"><div><span class="eyebrow">Academia Ducks Basketball</span><h1>Cuestionario de ingreso y salud deportiva</h1><p>La información será revisada únicamente por la administración y el entrenador de Ducks.</p></div></div>
      <form id="registrationApplicationForm" class="registration-form">
        <section class="registration-section"><h2>Datos del jugador</h2><div class="form-grid">
          <label class="label full">Nombre completo del niño o niña<input class="input" name="child_name" maxlength="140" required></label>
          <label class="label">Fecha de nacimiento<input class="input" name="birth_date" type="date" max="${todayISO()}" required></label>
          <label class="label">Género<select class="select" name="gender" required><option value="">Selecciona...</option><option>Femenino</option><option>Masculino</option><option>Prefiero no especificar</option></select></label>
          <label class="label">Nombre del padre, madre o tutor<input class="input" name="parent_name" maxlength="140" required></label>
          <label class="label">WhatsApp del padre, madre o tutor<input class="input" name="parent_phone" inputmode="tel" maxlength="30" required></label>
          <label class="label full">Correo electrónico<input class="input" name="parent_email" type="email" maxlength="160" placeholder="Opcional"></label>
        </div></section>
        <section class="registration-section"><h2>Historial médico</h2><p class="section-help">Responde con honestidad. Esta información ayuda al entrenador a conocer condiciones relevantes para la práctica del basketball.</p>
          ${registrationYesNo('chronic_condition','¿El niño ha sido diagnosticado con alguna condición médica crónica? (Ej. asma, diabetes, epilepsia, etc.)','chronic_condition_detail')}
          ${registrationYesNo('recent_injury','¿El niño ha tenido alguna lesión reciente o cirugía?','recent_injury_detail')}
          ${registrationYesNo('regular_medication','¿El niño toma algún medicamento regularmente?','regular_medication_detail')}
          ${registrationYesNo('chest_pain','¿El niño ha experimentado alguna vez dolor en el pecho al hacer ejercicio?')}
          ${registrationYesNo('fainting_dizziness','¿El niño ha perdido el conocimiento o ha tenido mareos durante el ejercicio?')}
        </section>
        <section class="registration-section"><h2>Hábitos de vida</h2>
          <fieldset class="registration-question"><legend>¿Cuántas horas de sueño tiene el niño por noche? <span class="required-star">*</span></legend><div class="number-scale">${Array.from({length:10},(_,i)=>`<label><input type="radio" name="sleep_hours" value="${i+1}" required><span>${i+1}</span></label>`).join('')}</div></fieldset>
          <fieldset class="registration-question"><legend>¿Con qué frecuencia realiza el niño actividad física? (días por semana) <span class="required-star">*</span></legend><div class="number-scale seven">${Array.from({length:7},(_,i)=>`<label><input type="radio" name="activity_days" value="${i+1}" required><span>${i+1}</span></label>`).join('')}</div></fieldset>
          <label class="label">¿Qué otro tipo de actividades físicas o deportes realiza el niño?<textarea class="input" name="other_activities" rows="3" maxlength="800"></textarea></label>
        </section>
        <section class="registration-section"><h2>Evaluación general</h2>
          ${registrationYesNo('physical_limitation','¿El niño tiene alguna condición física que pueda limitar su participación en actividades físicas?','physical_limitation_detail')}
          ${registrationYesNo('other_concern','¿Hay alguna otra condición o preocupación que deba ser considerada antes de que el niño participe en actividades físicas?','other_concern_detail')}
          <label class="label">Comentarios adicionales<textarea class="input" name="comments" rows="4" maxlength="1200"></textarea></label>
        </section>
        <section class="registration-section consent-section"><h2>Consentimiento</h2><label class="consent-check"><input type="checkbox" name="consent" required><span>Confirmo que la información proporcionada es correcta y doy mi consentimiento para que el niño participe en actividades físicas bajo la supervisión de Academia Ducks Basketball.</span></label><label class="label">Nombre completo de quien autoriza<input class="input" name="consent_name" maxlength="140" required></label><p class="privacy-note">Al enviar este formulario autorizas el uso administrativo de los datos para la inscripción, atención deportiva y contacto de la academia. La información no es pública.</p></section>
        <div class="registration-submit-bar"><button type="button" class="btn secondary" onclick="renderPublicHome()">Cancelar</button><button type="button" class="btn secondary" onclick="window.print()">Imprimir / guardar PDF</button><button class="btn green" id="registrationSubmitBtn">Enviar solicitud</button></div>
      </form>
    </section>
  </main></div>`;
  document.getElementById('registrationApplicationForm').onsubmit=submitRegistrationApplication;
  window.scrollTo({top:0,behavior:'smooth'});
}
function formBooleanValue(fd,name){return fd.get(name)==='Si';}
async function submitRegistrationApplication(e){
  e.preventDefault();
  if(!sb){toast('No hay conexión con la base de datos. Recarga el portal.');return;}
  const form=e.currentTarget;
  const fd=new FormData(form);
  const birth=String(fd.get('birth_date')||'');
  if(!birth||birth>todayISO()){toast('Revisa la fecha de nacimiento.');return;}
  const btn=document.getElementById('registrationSubmitBtn');
  btn.disabled=true; btn.textContent='Enviando...';
  const answers={
    chronic_condition:formBooleanValue(fd,'chronic_condition'), chronic_condition_detail:String(fd.get('chronic_condition_detail')||'').trim(),
    recent_injury:formBooleanValue(fd,'recent_injury'), recent_injury_detail:String(fd.get('recent_injury_detail')||'').trim(),
    regular_medication:formBooleanValue(fd,'regular_medication'), regular_medication_detail:String(fd.get('regular_medication_detail')||'').trim(),
    chest_pain:formBooleanValue(fd,'chest_pain'), fainting_dizziness:formBooleanValue(fd,'fainting_dizziness'),
    sleep_hours:Number(fd.get('sleep_hours')||0), activity_days:Number(fd.get('activity_days')||0),
    other_activities:String(fd.get('other_activities')||'').trim(), physical_limitation:formBooleanValue(fd,'physical_limitation'),
    physical_limitation_detail:String(fd.get('physical_limitation_detail')||'').trim(), other_concern:formBooleanValue(fd,'other_concern'),
    other_concern_detail:String(fd.get('other_concern_detail')||'').trim(), comments:String(fd.get('comments')||'').trim()
  };
  const payload={child_name:String(fd.get('child_name')||'').trim(),birth_date:birth,gender:String(fd.get('gender')||''),parent_name:String(fd.get('parent_name')||'').trim(),parent_phone:normalizePhone(fd.get('parent_phone')||''),parent_email:String(fd.get('parent_email')||'').trim(),consent_name:String(fd.get('consent_name')||'').trim(),consent:Boolean(fd.get('consent')),answers};
  try{
    const {data,error}=await sb.rpc('submit_ducks_registration_v259',{p_payload:payload});
    if(error) throw error;
    const result=Array.isArray(data)?data[0]:data;
    const folio=result?.folio||'Solicitud enviada';
    app.innerHTML=`${publicQuickMenu()}<div class="public-site with-global-menu"><main class="academy-main"><section class="registration-success-card"><div class="success-mark">✓</div><h1>Solicitud enviada correctamente</h1><p>Gracias. La administración de Ducks recibió el cuestionario de <b>${esc(payload.child_name)}</b>.</p><div class="folio-box"><small>Folio de seguimiento</small><strong>${esc(folio)}</strong></div><p>Nos pondremos en contacto al WhatsApp registrado para continuar con el proceso de ingreso.</p><div class="actions"><button class="btn green" onclick="renderPublicHome()">Volver al inicio</button><button class="btn secondary" onclick="window.print()">Guardar comprobante</button></div></section></main></div>`;
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(err){
    const missing=/submit_ducks_registration_v259|schema cache|does not exist/i.test(err.message||'');
    toast(missing?'Falta activar el cuestionario en Supabase. Ejecuta PASO_13_SQL_CUESTIONARIO_v2_59.sql.':'No se pudo enviar: '+err.message);
    btn.disabled=false; btn.textContent='Enviar solicitud';
  }
}

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
        <div class="notice success"><b>Protección de información:</b> al entrar desde Pagos y comprobantes se inicia una sesión nueva. Después de identificarte, solo verás tus hijos asignados.</div>
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
      runPendingParentEntryAction();
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
  parentPlayers=Array.isArray(data.players)?data.players:[];
  const allowedPlayerIds=new Set(parentPlayers.map(p=>String(p.id)));
  parentPayments=(Array.isArray(data.payments)?data.payments:[])
    .filter(p=>allowedPlayerIds.has(String(p.player_id)))
    .sort((a,b)=>String(b.payment_date||b.created_at||'').localeCompare(String(a.payment_date||a.created_at||'')));
  const docs = await sb.rpc('ducks_parent_documents_v218',{p_token:parentToken});
  if(!docs.error && docs.data?.ok){
    parentDocuments=(Array.isArray(docs.data.documents)?docs.data.documents:[])
      .filter(d=>allowedPlayerIds.has(String(d.player_id)));
  } else { parentDocuments = []; }
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


function familyPaymentBatchId(payment){
  const m=String(payment?.notes||'').match(/\[FAMILY_PAYMENT:([^\]]+)\]/);
  return m ? m[1] : '';
}
function familyPaymentRows(batchId, list=payments){
  return list.filter(p=>familyPaymentBatchId(p)===batchId);
}
function familyPaymentConcept(){
  const d=new Date();
  const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const family=String(parentProfile?.display_name||parentProfile?.login||'FAMILIA').replace(/\s+/g,' ').trim();
  return `DUCKS FAMILIA ${family} ${ym}`.slice(0,70);
}
function familySuggestedAmount(player){
  const c=calc(player,parentPayments);
  return c.amount>0 ? c.amount : Number(player.monthly_fee||0);
}
function updateFamilyPaymentTotal(){
  const rows=[...document.querySelectorAll('.family-pay-player-row')];
  let total=0, count=0;
  rows.forEach(row=>{
    const check=row.querySelector('.family-pay-check');
    const amount=row.querySelector('.family-pay-amount');
    const enabled=!!check?.checked;
    row.classList.toggle('selected',enabled);
    if(amount) amount.disabled=!enabled;
    if(enabled){ total+=Number(amount?.value||0); count++; }
  });
  const totalEl=document.getElementById('familyPayTotal');
  const countEl=document.getElementById('familyPayCount');
  if(totalEl) totalEl.textContent=money(total);
  if(countEl) countEl.textContent=`${count} hijo${count===1?'':'s'} seleccionado${count===1?'':'s'}`;
}
function toggleAllFamilyPlayers(value){
  document.querySelectorAll('.family-pay-check').forEach(x=>x.checked=!!value);
  updateFamilyPaymentTotal();
}
function selectedFamilyPaymentItems(){
  return [...document.querySelectorAll('.family-pay-player-row')]
    .filter(row=>row.querySelector('.family-pay-check')?.checked)
    .map(row=>({
      player_id:row.dataset.playerId,
      amount:Number(row.querySelector('.family-pay-amount')?.value||0)
    }));
}
function copyFamilyPaymentData(){
  const items=selectedFamilyPaymentItems();
  if(items.length<2){toast('Selecciona por lo menos dos hijos.');return;}
  const total=items.reduce((s,x)=>s+x.amount,0);
  const concept=familyPaymentConcept();
  const text=`Banco: ${BANK_NAME}\nCLABE: ${BANK_CLABE}\nBeneficiario: ${BANK_BENEFICIARY}\nMonto total: ${money(total)}\nConcepto: ${concept}`;
  navigator.clipboard.writeText(text).then(()=>toast('Datos del pago familiar copiados')).catch(()=>toast('No se pudieron copiar los datos'));
}
function openFamilyPayment(){
  if(parentPlayers.length<2){toast('Esta opción requiere por lo menos dos hijos ligados a la cuenta.');return;}
  const rows=parentPlayers.map(p=>{
    const c=calc(p,parentPayments);
    const amount=familySuggestedAmount(p);
    return `<div class="family-pay-player-row selected" data-player-id="${p.id}">
      <label class="family-pay-selector">
        <input class="family-pay-check" type="checkbox" checked onchange="updateFamilyPaymentTotal()">
        <img src="${playerPhotoUrl(p)}" alt="${esc(p.name)}">
        <span><b>${esc(p.name)}</b><small>${c.months} mes(es) pendiente(s) · ${c.status}</small></span>
      </label>
      <label class="family-pay-amount-label">Aplicar a este hijo
        <input class="input family-pay-amount" type="number" min="1" step="50" value="${amount}" oninput="updateFamilyPaymentTotal()">
      </label>
    </div>`;
  }).join('');
  const modal=document.createElement('div');
  modal.className='modalbg open family-pay-overlay';
  modal.id='familyPayModal';
  modal.innerHTML=`<div class="modal family-pay-modal">
    <div class="modal-head family-pay-head"><div><h3>Pago familiar</h3><small>Un solo depósito y un comprobante para varios hijos</small></div></div>
    <div class="modal-body">
      <div class="family-pay-summary">
        <div><small>Total del pago</small><strong id="familyPayTotal">$0.00</strong><span id="familyPayCount"></span></div>
        <button type="button" class="btn secondary" onclick="copyFamilyPaymentData()">Copiar datos de pago</button>
      </div>
      <div class="notice success"><b>¿Cómo funciona?</b> Selecciona los hijos, ajusta el monto de cada uno y sube un solo comprobante. El CRM creará una aplicación individual para cada hijo con la misma evidencia.</div>
      <div class="family-pay-tools"><button type="button" class="btn secondary" onclick="toggleAllFamilyPlayers(true)">Seleccionar todos</button><button type="button" class="btn secondary" onclick="toggleAllFamilyPlayers(false)">Quitar selección</button></div>
      <div class="family-pay-list">${rows}</div>
      <div class="family-bank-compact">
        <div><small>CLABE BBVA</small><b>${BANK_CLABE}</b></div>
        <div><small>Concepto sugerido</small><b>${esc(familyPaymentConcept())}</b></div>
        <button type="button" class="btn green" onclick="copyBank(BANK_CLABE,'CLABE')">Copiar CLABE</button>
      </div>
      <form id="familyPayForm" class="form-grid family-pay-form">
        <label class="label">Fecha de pago<input id="familyPayDate" class="input" type="date" value="${todayISO()}" max="${todayISO()}" required></label>
        <label class="label">Método<select id="familyPayMethod" class="select" required><option>Transferencia</option><option>Depósito</option><option>Efectivo</option><option>Otro</option></select></label>
        <label class="label full">Un solo comprobante<input id="familyPayEvidence" class="input" type="file" accept="image/*,application/pdf" required></label>
        <label class="label full">Comentario opcional<textarea id="familyPayNotes" class="input" placeholder="Referencia bancaria o comentario..."></textarea></label>
        <div class="full"><button class="btn green family-submit-btn">Enviar pago para todos los hijos seleccionados</button></div>
      </form>
    </div>
    <div class="pay-close-footer"><button type="button" class="btn secondary pay-close-btn" onclick="closeModal('familyPayModal')">Cerrar ventana</button></div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('familyPayForm').onsubmit=submitFamilyPayment;
  updateFamilyPaymentTotal();
}
async function submitFamilyPayment(e){
  e.preventDefault();
  const items=selectedFamilyPaymentItems();
  if(items.length<2){toast('Selecciona por lo menos dos hijos para un pago familiar.');return;}
  if(items.some(x=>!x.amount || x.amount<=0)){toast('Todos los montos seleccionados deben ser mayores a cero.');return;}
  const file=document.getElementById('familyPayEvidence').files[0];
  if(!file){toast('Selecciona el comprobante del pago familiar.');return;}
  const submitBtn=document.querySelector('#familyPayForm .family-submit-btn');
  if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Enviando pago familiar...';}
  try{
    const evidence_url=await uploadFile(file,'evidencias/familiares');
    const payDate=document.getElementById('familyPayDate').value;
    if(payDate>todayISO()) throw new Error('La fecha de pago no puede ser posterior a la fecha actual de Aguascalientes.');
    const method=document.getElementById('familyPayMethod').value;
    const comment=document.getElementById('familyPayNotes').value.trim();
    const batchId=`FAM-${Date.now().toString(36).toUpperCase()}`;
    const successes=[]; const failures=[];
    for(let i=0;i<items.length;i++){
      const item=items[i];
      const player=parentPlayers.find(p=>p.id===item.player_id);
      const notes=`${paymentTypeNoteTag('Mensualidad')} [FAMILY_PAYMENT:${batchId}] Pago familiar ${i+1}/${items.length}.${comment?' '+comment:''}`;
      const row={p_token:parentToken,p_player_id:item.player_id,p_payment_date:payDate,p_period:period(payDate),p_amount:item.amount,p_method:method,p_notes:notes,p_evidence_url:evidence_url,p_evidence_name:file.name};
      const {data,error}=await sb.rpc('ducks_parent_submit_payment_v213',row);
      if(error || !data?.ok) failures.push(player?.name||item.player_id);
      else successes.push(player?.name||item.player_id);
    }
    if(!successes.length) throw new Error('No se pudo aplicar el pago a ningún hijo.');
    closeModal('familyPayModal');
    await loadParentData();
    renderParentPortal();
    if(failures.length) toast(`Pago aplicado a ${successes.length} hijo(s). No se pudo aplicar a: ${failures.join(', ')}`);
    else toast(`Pago familiar enviado para ${successes.length} hijos. Queda pendiente de confirmación.`);
  }catch(err){
    toast('Error: '+err.message);
    if(submitBtn){submitBtn.disabled=false;submitBtn.textContent='Enviar pago para todos los hijos seleccionados';}
  }
}

function renderParentPaymentHistory(player){
  const allowedPlayerIds=new Set(parentPlayers.map(p=>String(p.id)));
  if(!allowedPlayerIds.has(String(player?.id))) return '<div class="notice warning">Jugador no autorizado para esta cuenta.</div>';
  const rows=parentPayments
    .filter(p=>String(p.player_id)===String(player.id) && allowedPlayerIds.has(String(p.player_id)))
    .sort((a,b)=>String(b.payment_date||b.created_at||'').localeCompare(String(a.payment_date||a.created_at||'')));
  if(!rows.length) return `<div class="parent-payment-empty"><b>Sin pagos registrados</b><span>Aún no existe historial de pagos para ${esc(player.name)}.</span></div>`;
  return `<div class="parent-payment-history-wrap"><table class="parent-payment-history-table"><thead><tr><th>Fecha</th><th>Periodo</th><th>Monto</th><th>Método</th><th>Estatus</th><th>Comprobante</th></tr></thead><tbody>${rows.map(h=>`<tr><td>${esc(formatDateDMY(h.payment_date)||h.payment_date||'-')}</td><td>${esc(h.period||'-')}</td><td><b>${money(h.amount)}</b></td><td>${esc(h.method||'-')}</td><td><span class="status ${statusClass(h.confirmation_status)}">${esc(h.confirmation_status||'-')}</span></td><td>${h.evidence_url?`<button type="button" class="btn secondary parent-history-evidence" onclick="openEvidencePreview('${h.id}')">Ver</button>`:'-'}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderParentPortal(){
  mode='parentPortal'; rememberScreen('parentPortal:');
  const cards = parentPlayers.map(p=>{
    const c=calc(p,parentPayments);
    return `<div class="family-player-card player-priority-card">
      <div class="player-card-top">
        <div class="player-info-side">
          <div class="family-head"><div><h2>${esc(p.name)}</h2><p>${esc(p.category||'')} · Uniforme #${esc(p.uniform_number||'-')}</p><p class="sub">Nacimiento: ${esc(formatDateDMY(p.birth_date)||'Sin capturar')} · Registro: ${esc(formatDateDMY(effectiveRegistrationISO(p))||'-')}</p><span class="status ${c.status}">${c.status}</span></div></div>
          <div class="family-kpis"><div><small>Último pago</small><b>${esc(c.last||'Sin registro')}</b></div><div><small>Meses pendientes</small><b>${c.months}</b></div><div><small>Adeudo actual</small><b class="amount">${money(c.amount)}</b></div></div>
          <div class="payment-day-highlight"><small>Día de pago</small><b>${esc(p.payment_day||1)} de cada mes</b></div>
        </div>
        <div class="player-photo-side"><img src="${playerPhotoUrl(p)}" alt="Foto de ${esc(p.name)}"></div>
      </div>
      <details class="history-box parent-payment-history"><summary><span>Historial de pagos de ${esc(p.name)}</span><small>Toca para consultar</small></summary>${renderParentPaymentHistory(p)}</details>
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
      <nav class="academy-links"><button onclick="renderParentPortal()">Mis hijos</button>${parentPlayers.length>=2?'<button class="primary-menu-btn" onclick="openFamilyPayment()">Pago familiar</button>':''}<button onclick="openParentPayment()">Subir comprobante</button></nav>
      <div class="header-actions"><button class="btn secondary academy-admin" onclick="parentLogout()">Cerrar sesión</button></div>
    </div></header>
    <main class="academy-main">
      <section class="academy-ribbon private-ribbon"><div class="court-lines"></div><div class="ribbon-content"><img class="ribbon-logo small" src="assets/logo.png"><div class="ribbon-text"><span class="ribbon-kicker">Acceso privado</span><h1>Bienvenido al Portal de Papás</h1><p>${esc(parentProfile?.display_name||parentProfile?.login||'')}</p></div></div></section>
      ${parentPortalActions()}
      ${parentPlayers.length>=2?`<section class="family-payment-banner"><div><span>Pago para varios hijos</span><h2>Realiza un solo pago familiar</h2><p>Selecciona a tus hijos, paga el total y carga un solo comprobante. El pago se aplicará individualmente a cada uno.</p></div><button class="btn green" onclick="openFamilyPayment()">💳 Pagar varios hijos</button></section>`:''}
      <section class="parent-card"><div class="parent-title"><img src="assets/logo.png"><div><h1>Mis jugadores</h1><div class="sub">Solo información asignada a tu familia</div></div></div>${parentPlayers.length?`<div class="family-grid">${cards}</div>`:`<div class="notice warning">Tu cuenta aún no tiene jugadores asignados. Contacta a administración.</div>`}</section>
      <section class="bank-card"><div class="bank-head"><div><span class="bank-chip">BBVA MX</span><h2>Datos para depósito o transferencia</h2><p>Copia la cuenta o CLABE, realiza tu pago y después adjunta el comprobante.</p></div><img src="assets/logo.png"></div><div class="bank-grid"><div class="bank-item"><small>Cuenta</small><strong>${BANK_ACCOUNT}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_ACCOUNT,'Cuenta')">Copiar cuenta</button></div><div class="bank-item"><small>CLABE</small><strong>${BANK_CLABE}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_CLABE,'CLABE')">Copiar CLABE</button></div><div class="bank-item full"><small>Beneficiario / referencia</small><strong>${BANK_BENEFICIARY}</strong><button type="button" class="btn secondary" onclick="copyBank(BANK_BENEFICIARY,'Beneficiario')">Copiar beneficiario</button></div></div></section>
    </main>
  </div>`;
}
function parentLogout(){ parentToken=''; parentProfile=null; parentPlayers=[]; parentPayments=[]; parentDocuments=[]; localStorage.removeItem('ducks_parent_token_v213'); renderPublicHome(); }

function renderParentDocuments(playerId){
  const docs = parentDocuments.filter(d=>d.player_id===playerId);
  if(!docs.length) return '<p class="sub">Aún no hay documentos cargados.</p>';
  return `<table class="mini-table"><thead><tr><th>Tipo</th><th>Nombre</th><th>Fecha</th><th>Archivo</th></tr></thead><tbody>${docs.map(d=>`<tr><td>${esc(d.document_type||'')}</td><td>${esc(d.title||'')}</td><td>${esc(timestampDateISO(d.created_at))}</td><td><a target="_blank" href="${d.file_url}">Ver</a></td></tr>`).join('')}</tbody></table>`;
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
  modal.className='modalbg open pay-now-overlay';
  modal.id='payNowModal';
  modal.innerHTML=`<div class="modal pay-now-modal">
    <div class="modal-head pay-now-head">
      <h3>Pagar ahora</h3>
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
    <div class="pay-close-footer">
      <button class="btn secondary pay-close-btn" onclick="closeModal('payNowModal')">Cerrar ventana</button>
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
      <label class="label">Fecha de pago<input id="parentPayDate" class="input" type="date" value="${todayISO()}" max="${todayISO()}" required></label>
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
    if(payDate>todayISO()) throw new Error('La fecha de pago no puede ser posterior a la fecha actual de Aguascalientes.');
    const parentNotes=document.getElementById('parentPayNotes').value.trim();
    const row={p_token:parentToken,p_player_id:player_id,p_payment_date:payDate,p_period:period(payDate),p_amount:Number(document.getElementById('parentPayAmount').value||0),p_method:document.getElementById('parentPayMethod').value,p_notes:`${paymentTypeNoteTag('Mensualidad')}${parentNotes?' '+parentNotes:''}`,p_evidence_url:evidence_url,p_evidence_name:file.name};
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
async function logout(){ if(notificationChannel){await sb.removeChannel(notificationChannel);notificationChannel=null;} await sb.auth.signOut(); session=null; adminNotifications=[]; renderPublicHome(); }
async function loadRegistrationApplications(){
  if(!sb){registrationApplications=[];registrationModuleReady=false;return;}
  const rg=await sb.from('registration_applications_v259').select('*').order('submitted_at',{ascending:false}).limit(500);
  if(rg.error){registrationApplications=[];registrationModuleReady=false;}
  else{registrationApplications=rg.data||[];registrationModuleReady=true;}
}
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
  await persistRegistrationBillingMarkers();
  await loadRegistrationApplications();
  await loadAdminNotifications();
  setupNotificationRealtime();
}
async function refresh(){ if(mode==='admin'){await loadAdminData(); renderShell(); renderPage();} }
function renderShell(){
  const adminOptions = [
    ['dashboard','📊 Dashboard'],
    ['notifications','🔔 Avisos'],
    ['registrations','📝 Solicitudes'],
    ['players','🏀 Jugadores'],
    ['parents','👨‍👩‍👧 Papás'],
    ['payments','💳 Pagos'],
    ['evidence','📎 Evidencias'],
    ['whatsapp','📲 WhatsApp'],
    ['documents','📁 Documentos'],
    ['history','🕘 Historial'],
    ['backups','💾 Respaldos'],
    ['settings','⚙️ Configuración'],
    ['public','🌐 Página pública']
  ];
  app.innerHTML=`<div class="admin-compact-shell">
    <header class="admin-compact-header admin-dropdown-header">
      <div class="admin-compact-brand">
        <img src="assets/logo.png" alt="Ducks">
        <div><b>Ducks CRM</b><span>Administración interna</span></div>
      </div>
      <div class="admin-dropdown-center">
        <label class="admin-menu-select-wrap">
          <span>Menú administrador</span>
          <select id="adminPageSelect" class="select admin-page-select">${adminOptions.map(([value,label])=>`<option value="${value}" ${page===value?'selected':''}>${label}</option>`).join('')}</select>
        </label>
      </div>
      <div class="admin-compact-tools admin-dropdown-tools">
        <button class="btn secondary admin-compact-bell" id="adminBellBtn">🔔 <span class="notification-badge hidden" data-notification-badge>0</span></button>
        <input id="search" class="input admin-compact-search" placeholder="Buscar..." value="${esc(q)}">
        <button class="btn secondary admin-logout-btn" id="authBtn">Salir</button>
      </div>
    </header>
    <main class="main admin-compact-main">
      <div class="top admin-compact-title">
        <div><h2 id="title"></h2><p id="subtitle">Ducks Basketball Academy</p></div>
      </div>
      <div id="content"></div>
    </main>
  </div>`;
  const pageSelect=document.getElementById('adminPageSelect');
  if(pageSelect) pageSelect.onchange=e=>{ page=e.target.value; if(page==='public'){renderPublicHome(); return;} renderPage(); };
  const bellBtn=document.getElementById('adminBellBtn');
  if(bellBtn) bellBtn.onclick=()=>{ page='notifications'; renderPage(); const sel=document.getElementById('adminPageSelect'); if(sel) sel.value='notifications'; };
  document.getElementById('search').oninput=e=>{q=e.target.value; renderPage();};
  document.getElementById('authBtn').onclick=logout;
  updateNotificationBadges();
}
function setTitle(t){ const el=document.getElementById('title'); if(el) el.textContent=t; document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); const sel=document.getElementById('adminPageSelect'); if(sel && page && sel.value!==page) sel.value=page; }
function renderPage(){ if(mode==='admin') rememberScreen('admin:'+page); if(page==='dashboard') renderDashboard(); if(page==='notifications') renderNotifications(); if(page==='registrations') renderRegistrations(); if(page==='players') renderPlayers(); if(page==='parents') renderParents(); if(page==='payments') renderPayments(); if(page==='evidence') renderEvidence(); if(page==='whatsapp') renderWhatsApp(); if(page==='documents') renderDocuments(); if(page==='history') renderPlayerHistory(); if(page==='backups') renderBackups(); if(page==='settings') renderSettings(); }
function filteredPlayers(){ const s=q.toLowerCase().trim(); return players.filter(p=>!s || [p.id,p.name,p.tutor,p.phone,p.category,p.birth_date,p.registration_date,p.payment_day,p.uniform_number].join(' ').toLowerCase().includes(s)); }

function renderDashboard(){
  setTitle('Dashboard ejecutivo');
  const rows=players.map(p=>({...p,c:calc(p)})); const active=rows.filter(p=>p.status==='Activo').length; const debtors=rows.filter(p=>p.c.amount>0); const overdue=rows.filter(p=>p.c.status==='Vencido').length; const pendingEvidence=payments.filter(p=>p.confirmation_status==='Pendiente de confirmación').length; const totalDebt=debtors.reduce((a,p)=>a+p.c.amount,0); const birthdays=birthdayPlayersToday(); const unread=unreadNotificationCount(); const pendingRegistrations=registrationApplications.filter(r=>r.status==='Pendiente').length;
  const birthdayBanner=birthdays.length?`<div class="notice birthday-notice"><b>🎂 Cumpleaños de hoy:</b> ${birthdays.map(p=>`${esc(p.name)} (${playerAge(p)} años)`).join(', ')}</div>`:'';
  const recentNotices=adminNotifications.filter(n=>!n.read_at).slice(0,3);
  document.getElementById('content').innerHTML=`${iosInstallBanner()}${notificationSetupNotice()}${birthdayBanner}<div class="kpis"><div class="kpi"><small>Jugadores</small><strong>${players.length}</strong></div><div class="kpi green"><small>Activos</small><strong>${active}</strong></div><div class="kpi orange"><small>Con adeudo</small><strong>${debtors.length}</strong></div><div class="kpi red"><small>Vencidos</small><strong>${overdue}</strong></div><div class="kpi orange"><small>Por confirmar</small><strong>${pendingEvidence}</strong></div><div class="kpi green"><small>Solicitudes nuevas</small><strong>${pendingRegistrations}</strong></div><div class="kpi"><small>Avisos nuevos</small><strong>${unread}</strong></div><div class="kpi"><small>Cumpleaños hoy</small><strong>${birthdays.length}</strong></div><div class="kpi red"><small>Adeudo total</small><strong>${money(totalDebt)}</strong></div></div>${recentNotices.length?`<div class="panel compact-notifications"><div class="panel-head"><h3>Avisos recientes</h3><button class="btn secondary" onclick="page='notifications';renderPage()">Ver todos</button></div>${recentNotices.map(n=>`<button class="dashboard-notification" onclick="openNotificationTarget('${n.id}')"><span>${notificationTypeIcon(n.type)}</span><div><b>${esc(n.title)}</b><small>${esc(n.message)}</small></div></button>`).join('')}</div>`:''}
  <div class="panel"><div class="panel-head"><h3>Jugadores con adeudo</h3></div><div class="tablewrap"><table><thead><tr><th>Foto</th><th>ID</th><th>Jugador</th><th>Núm.</th><th>Tutor</th><th>Último pago</th><th>Meses</th><th>Adeudo</th><th>Estado</th><th>WhatsApp</th></tr></thead><tbody>${debtors.sort((a,b)=>b.c.amount-a.c.amount).map(p=>`<tr><td>${thumb(p.photo_url)}</td><td>${p.id}</td><td><b>${esc(p.name)}</b><br><small>${esc(p.category||'')}</small></td><td><span class="uniform">#${esc(p.uniform_number||'-')}</span></td><td>${esc(p.tutor||'')}</td><td>${esc(p.c.last||'')}</td><td>${p.c.months}</td><td class="amount">${money(p.c.amount)}</td><td><span class="status ${p.c.status}">${p.c.status}</span></td><td>${whatsappButtons(p)}</td></tr>`).join('')||'<tr><td colspan="10">Sin adeudos</td></tr>'}</tbody></table></div></div>`;
}

function registrationModuleNotice(){return registrationModuleReady?'':`<div class="notice warning"><b>Falta activar solicitudes:</b> ejecuta en Supabase el archivo <b>PASO_13_SQL_CUESTIONARIO_v2_59.sql</b>.</div>`;}
function registrationStatusClass(status){return status==='Pendiente'?'Pendiente':status==='Convertida'?'Confirmado':status==='Rechazada'?'Rechazado':'Registrado';}
function registrationAnswer(app,key){return app?.answers?.[key];}
function yesNoText(v){return v===true?'Sí':v===false?'No':'-';}
function renderRegistrations(){
  setTitle('Solicitudes de ingreso');
  const search=q.toLowerCase().trim();
  const list=registrationApplications.filter(r=>!search||[r.folio,r.child_name,r.parent_name,r.parent_phone,r.parent_email,r.status].join(' ').toLowerCase().includes(search));
  document.getElementById('content').innerHTML=`${registrationModuleNotice()}<div class="panel"><div class="panel-head"><div><h3>Cuestionarios recibidos</h3><p class="sub">Revisa la información de salud, contacta a la familia y convierte la solicitud en jugador cuando sea aprobada.</p></div><button class="btn secondary" onclick="renderPublicHome();setTimeout(()=>renderRegistrationForm(),100)">Ver formulario público</button></div><div class="tablewrap"><table><thead><tr><th>Folio</th><th>Fecha</th><th>Jugador</th><th>Tutor</th><th>WhatsApp</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${list.map(r=>`<tr><td><b>${esc(r.folio||'')}</b></td><td>${esc(formatAcademyDateTime(r.submitted_at))}</td><td><b>${esc(r.child_name)}</b>${r.medical_alert?'<span class="medical-alert-chip">Revisión médica</span>':''}<br><small>${esc(formatDateDMY(r.birth_date))} · ${esc(r.gender||'')}</small></td><td>${esc(r.parent_name||'')}</td><td>${esc(r.parent_phone||'')}</td><td><span class="status ${registrationStatusClass(r.status)}">${esc(r.status)}</span></td><td><div class="actions"><button class="btn secondary" onclick="openRegistrationDetail('${r.id}')">Revisar</button>${r.status==='Pendiente'?`<button class="btn green" onclick="openRegistrationConvert('${r.id}')">Crear jugador</button><button class="btn red" onclick="updateRegistrationStatus('${r.id}','Rechazada')">Rechazar</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="7">No hay solicitudes.</td></tr>'}</tbody></table></div></div>`;
}
function openRegistrationDetail(id){
  const r=registrationApplications.find(x=>String(x.id)===String(id)); if(!r)return;
  const a=r.answers||{};
  const detail=(label,value,extra='')=>`<div class="application-detail-row"><b>${esc(label)}</b><span>${esc(value)}</span>${extra?`<small>${esc(extra)}</small>`:''}</div>`;
  const modal=document.createElement('div');modal.className='modalbg open';modal.id='registrationDetailModal';
  modal.innerHTML=`<div class="modal wide-modal"><div class="modal-head"><h3>${esc(r.folio)} · ${esc(r.child_name)}</h3><button class="btn secondary" onclick="closeModal('registrationDetailModal')">Cerrar</button></div><div class="modal-body application-detail" id="applicationPrintable"><div class="application-summary"><div><small>Fecha de envío</small><b>${esc(formatAcademyDateTime(r.submitted_at))}</b></div><div><small>Estado</small><b>${esc(r.status)}</b></div><div><small>Tutor</small><b>${esc(r.parent_name)}</b></div><div><small>WhatsApp</small><b>${esc(r.parent_phone)}</b></div></div><h4>Datos del jugador</h4>${detail('Nombre',r.child_name)}${detail('Fecha de nacimiento',formatDateDMY(r.birth_date))}${detail('Género',r.gender)}<h4>Historial médico</h4>${detail('Condición médica crónica',yesNoText(a.chronic_condition),a.chronic_condition_detail)}${detail('Lesión reciente o cirugía',yesNoText(a.recent_injury),a.recent_injury_detail)}${detail('Medicamento regular',yesNoText(a.regular_medication),a.regular_medication_detail)}${detail('Dolor de pecho al hacer ejercicio',yesNoText(a.chest_pain))}${detail('Pérdida de conocimiento o mareos',yesNoText(a.fainting_dizziness))}<h4>Hábitos y evaluación</h4>${detail('Horas de sueño por noche',a.sleep_hours||'-')}${detail('Días de actividad física por semana',a.activity_days||'-')}${detail('Otros deportes o actividades',a.other_activities||'-')}${detail('Condición física limitante',yesNoText(a.physical_limitation),a.physical_limitation_detail)}${detail('Otra condición o preocupación',yesNoText(a.other_concern),a.other_concern_detail)}${detail('Comentarios',a.comments||'-')}<h4>Consentimiento</h4>${detail('Nombre de quien autoriza',r.consent_name||r.parent_name)}<div class="actions"><button class="btn secondary" onclick="window.print()">Imprimir / guardar PDF</button>${r.status==='Pendiente'?`<button class="btn green" onclick="closeModal('registrationDetailModal');openRegistrationConvert('${r.id}')">Crear jugador</button><button class="btn red" onclick="updateRegistrationStatus('${r.id}','Rechazada')">Rechazar</button>`:''}</div></div></div>`;
  document.body.appendChild(modal);
}
async function updateRegistrationStatus(id,status){
  const r=registrationApplications.find(x=>String(x.id)===String(id));if(!r)return;
  if(status==='Rechazada'&&!confirm(`¿Rechazar la solicitud de ${r.child_name}?`))return;
  const {error}=await sb.from('registration_applications_v259').update({status,reviewed_at:new Date().toISOString()}).eq('id',id);
  if(error){toast('No se pudo actualizar: '+error.message);return;}
  toast('Solicitud actualizada'); closeModal('registrationDetailModal'); await refresh(); page='registrations';renderPage();
}
function openRegistrationConvert(id){
  const r=registrationApplications.find(x=>String(x.id)===String(id));if(!r)return;
  const modal=document.createElement('div');modal.className='modalbg open';modal.id='registrationConvertModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>Crear jugador desde solicitud</h3><button class="btn secondary" onclick="closeModal('registrationConvertModal')">Cerrar</button></div><div class="modal-body"><div class="notice success"><b>${esc(r.child_name)}</b><br>Los datos personales y la fecha de nacimiento se copiarán automáticamente. El jugador iniciará con $0 de adeudo.</div><form id="registrationConvertForm" class="form-grid"><label class="label">ID jugador<input id="rcId" class="input" value="${esc(nextId())}" required></label><label class="label">Fecha de registro<input id="rcRegistrationDate" class="input" type="date" max="${todayISO()}" value="${todayISO()}" required></label><label class="label">Día de pago<select id="rcPaymentDay" class="select" required><option value="">Selecciona...</option>${paymentDayOptions('')}</select></label><label class="label">Mensualidad<input id="rcFee" class="input" type="number" min="0" step="50" value="300" required></label><label class="label">Categoría<input id="rcCategory" class="input"></label><label class="label">Número de uniforme<input id="rcUniform" class="input"></label><div class="full actions"><button class="btn green">Crear jugador</button></div></form></div></div>`;
  document.body.appendChild(modal);document.getElementById('registrationConvertForm').onsubmit=e=>convertRegistrationToPlayer(e,id);
}
async function convertRegistrationToPlayer(e,applicationId){
  e.preventDefault();const r=registrationApplications.find(x=>String(x.id)===String(applicationId));if(!r)return;
  const id=document.getElementById('rcId').value.trim();const registration_date=document.getElementById('rcRegistrationDate').value;const payment_day=Number(document.getElementById('rcPaymentDay').value);
  if(players.some(p=>String(p.id).toUpperCase()===id.toUpperCase())){toast('Ese ID ya existe.');return;}
  if(!registration_date||registration_date>todayISO()){toast('Revisa la fecha de registro.');return;}
  const row={id,name:r.child_name,birth_date:r.birth_date,registration_date,tutor:r.parent_name,phone:normalizePhone(r.parent_phone),tutor_2:'',tutor_phone_2:'',category:document.getElementById('rcCategory').value.trim(),status:'Activo',monthly_fee:Number(document.getElementById('rcFee').value||0),payment_day,uniform_number:document.getElementById('rcUniform').value.trim(),photo_url:'',notes:withRegistrationBillingMarker(`Alta desde cuestionario ${r.folio}.`)};
  try{
    const insert=await sb.from('players').insert(row);if(insert.error)throw insert.error;
    await savePlayerHistory(id,{},compactPlayerSnapshot(row),'create');
    const upd=await sb.from('registration_applications_v259').update({status:'Convertida',converted_player_id:id,reviewed_at:new Date().toISOString()}).eq('id',applicationId);if(upd.error)throw upd.error;
    toast('Jugador creado correctamente con saldo inicial de $0.');closeModal('registrationConvertModal');await refresh();page='players';q=id;renderPage();
  }catch(err){toast('No se pudo crear el jugador: '+err.message);}
}

function renderPlayers(){
  setTitle('Jugadores');
  const list=filteredPlayers();
  document.getElementById('content').innerHTML=`<div class="panel"><div class="panel-head"><h3>Base de jugadores</h3><button class="btn green" onclick="openPlayerForm()">+ Nuevo jugador</button></div><div class="cards">${list.map(p=>{const c=calc(p);return `<div class="card">${thumb(p.photo_url)}<h4>${esc(p.name)}</h4><p><span class="uniform">#${esc(p.uniform_number||'-')}</span></p><p><b>ID:</b> ${p.id} · <b>Categoría:</b> ${esc(p.category||'')}</p><p><b>Nacimiento:</b> ${esc(formatDateDMY(p.birth_date)||'Sin capturar')}${playerAge(p)!==null?` · <b>Edad:</b> ${playerAge(p)} años`:''}</p><p><b>Registro:</b> ${esc(formatDateDMY(c.registrationDate||p.registration_date||timestampDateISO(p.created_at))||'-')} · <b>Pago:</b> día ${esc(p.payment_day||'-')}</p>${c.billingMode==='registration'?`<p><b>Primer/Próximo cobro:</b> ${esc(c.nextDue||c.firstDue||'-')}</p>`:`<p><b>Esquema:</b> Histórico protegido</p>`}<p><b>Tutor principal:</b> ${esc(p.tutor||'')}</p><p><b>WhatsApp principal:</b> ${esc(p.phone||'')}</p>${p.tutor_2||p.tutor_phone_2?`<p><b>Tutor secundario:</b> ${esc(p.tutor_2||'')} · ${esc(p.tutor_phone_2||'')}</p>`:''}<p><b>Adeudo:</b> <span class="amount">${money(c.amount)}</span> · <span class="status ${c.status}">${c.status}</span></p><div class="actions"><button class="btn secondary" onclick="openPlayerForm('${p.id}')">Editar</button><button class="btn secondary" onclick="openPlayerHistory('${p.id}')">Historial</button><button class="btn green" onclick="openPaymentForm('${p.id}')">Pago</button>${whatsappButtons(p)}<button class="btn red" onclick="deletePlayer('${p.id}')">Eliminar</button></div></div>`}).join('')||'<div class="card">Sin jugadores. Si aquí no aparecen, revisa que estés logueado como administrador y que la tabla players tenga permisos.'}</div></div>`;
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
  <div class="panel"><div class="panel-head"><h3>Cuentas creadas</h3></div><div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Clave temporal</th><th>WhatsApp</th><th>Activo</th><th>Acción</th></tr></thead><tbody>${parentAccounts.map(a=>`<tr><td><b>${esc(a.display_name)}</b></td><td>${esc(a.login)}</td><td><code>${esc(a.access_code||'')}</code></td><td>${esc(a.phone||'-')}</td><td>${a.active?'Sí':'No'}</td><td><div class="account-action-buttons">
  <button class="btn green account-whatsapp-btn" onclick="sendParentCredentialsWhatsApp('${a.id}')">📲 WhatsApp</button>
  <button class="btn secondary" onclick="editParentAccount('${a.id}')">Modificar</button>
  <button class="btn secondary" onclick="autoLinkAccountFromButton('${a.id}')">Auto ligar</button>
  <button class="btn secondary" onclick="resetParentPassword('${a.id}')">Reset contraseña</button>
  <button class="btn red" onclick="deleteParentAccount('${a.id}')">Eliminar</button>
</div></td></tr>`).join('')||'<tr><td colspan="6">Sin cuentas creadas</td></tr>'}</tbody></table></div></div>
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



function parentCredentialsMessage(account){
  const portalUrl = window.DUCKS_PORTAL_URL || 'https://ducks-academy-crm.vercel.app';
  return `Hola, buen día.

Ya está disponible tu acceso privado al Portal de Papás de Ducks Basketball Academy.

Usuario: ${account.login || ''}
Contraseña temporal: ${account.access_code || ''}

Puedes ingresar desde la aplicación instalada o desde el siguiente enlace:

${portalUrl}

Dentro del portal podrás consultar la información de tus hijos, pagos, adeudos, calendario, documentos y subir comprobantes.

Por seguridad, te recomendamos cambiar tu contraseña después de iniciar sesión.

🏀 Ducks Basketball Academy`;
}

async function sendParentCredentialsWhatsApp(accountId){
  const account = parentAccounts.find(a=>a.id===accountId);
  if(!account){ toast('Cuenta no encontrada'); return; }

  if(!String(account.login||'').trim()){
    toast('La cuenta no tiene usuario asignado.');
    return;
  }
  if(!String(account.access_code||'').trim()){
    toast('La cuenta no tiene contraseña temporal. Usa Reset contraseña primero.');
    return;
  }

  const message = parentCredentialsMessage(account);
  const phone = String(account.phone||'').replace(/\D/g,'');

  if(!phone){
    try{
      await navigator.clipboard.writeText(message);
      toast('La cuenta no tiene WhatsApp. El mensaje de acceso fue copiado.');
    }catch{
      toast('Agrega el WhatsApp del papá para enviar sus datos de acceso.');
    }
    return;
  }

  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl,'_blank','noopener');
}

function editParentAccount(accountId){
  const acc = parentAccounts.find(a=>a.id===accountId);
  if(!acc){ toast('Cuenta no encontrada'); return; }

  const linked = parentLinks
    .filter(l=>l.parent_account_id===accountId && l.active)
    .map(l=>{
      const p=players.find(x=>x.id===l.player_id);
      return p?.name || l.player_id;
    });

  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='editParentAccountModal';
  modal.innerHTML=`<div class="modal parent-account-edit-modal">
    <div class="modal-head">
      <h3>Modificar cuenta de papá/tutor</h3>
      <button class="btn secondary" onclick="closeModal('editParentAccountModal')">Cerrar</button>
    </div>
    <div class="modal-body">
      <div class="notice success">
        <b>Jugadores ligados:</b> ${linked.length ? linked.map(esc).join(', ') : 'Ninguno'}
      </div>
      <form id="editParentAccountForm" class="form-grid">
        <label class="label">Nombre visible
          <input id="editAccName" class="input" required value="${esc(acc.display_name||'')}">
        </label>
        <label class="label">Usuario
          <input id="editAccLogin" class="input" required value="${esc(acc.login||'')}">
        </label>
        <label class="label">WhatsApp
          <input id="editAccPhone" class="input" value="${esc(acc.phone||'')}">
        </label>
        <label class="label">Estado
          <select id="editAccActive" class="select">
            <option value="true" ${acc.active!==false?'selected':''}>Activa</option>
            <option value="false" ${acc.active===false?'selected':''}>Inactiva</option>
          </select>
        </label>
        <label class="label full">Nueva contraseña temporal
          <input id="editAccPassword" class="input" placeholder="Dejar vacío para conservar la actual">
          <small>Solo se cambiará si capturas una nueva contraseña.</small>
        </label>
        <div class="full account-edit-actions">
          <button type="button" class="btn secondary" onclick="closeModal('editParentAccountModal')">Cancelar</button>
          <button class="btn green">Guardar cambios</button>
        </div>
      </form>
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('editParentAccountForm').onsubmit=(e)=>saveParentAccountChanges(e,accountId);
}

async function saveParentAccountChanges(e, accountId){
  e.preventDefault();
  const acc = parentAccounts.find(a=>a.id===accountId);
  if(!acc){ toast('Cuenta no encontrada'); return; }

  const display_name=document.getElementById('editAccName').value.trim();
  const login=document.getElementById('editAccLogin').value.trim().toLowerCase();
  const phone=normalizePhone(document.getElementById('editAccPhone').value);
  const active=document.getElementById('editAccActive').value==='true';
  const newPassword=document.getElementById('editAccPassword').value.trim();

  if(display_name.length<2){ toast('Captura el nombre del papá/tutor'); return; }
  if(login.length<3){ toast('El usuario debe tener al menos 3 caracteres'); return; }
  if(newPassword && newPassword.length<4){ toast('La nueva contraseña debe tener al menos 4 caracteres'); return; }

  const duplicate=parentAccounts.find(a=>
    a.id!==accountId &&
    String(a.login||'').trim().toLowerCase()===login
  );
  if(duplicate){ toast('Ese usuario ya está asignado a otra cuenta'); return; }

  const row={display_name,login,phone,active};
  if(newPassword) row.access_code=newPassword;

  try{
    const {error}=await sb.from('parent_accounts_v213').update(row).eq('id',accountId);
    if(error) throw error;
    closeModal('editParentAccountModal');
    await loadAdminData();
    toast('Cuenta actualizada correctamente');
    page='parents';
    renderShell();
    renderPage();
  }catch(err){
    toast('Error modificando cuenta: '+err.message);
  }
}

async function deleteParentAccount(accountId){
  const acc=parentAccounts.find(a=>a.id===accountId);
  if(!acc){ toast('Cuenta no encontrada'); return; }

  const linked=parentLinks.filter(l=>l.parent_account_id===accountId);
  const playerNames=linked.map(l=>{
    const p=players.find(x=>x.id===l.player_id);
    return p?.name || l.player_id;
  });

  const detail=playerNames.length
    ? `\n\nTambién se eliminarán ${playerNames.length} relación(es) con jugadores:\n- ${playerNames.join('\n- ')}`
    : '\n\nEsta cuenta no tiene jugadores ligados.';

  if(!confirm(`¿Eliminar definitivamente la cuenta de ${acc.display_name} (${acc.login})?${detail}\n\nLos jugadores, pagos y documentos NO se eliminarán.`)) return;

  try{
    const {error}=await sb.from('parent_accounts_v213').delete().eq('id',accountId);
    if(error) throw error;
    await loadAdminData();
    toast('Cuenta eliminada. Los jugadores y su información se conservaron.');
    page='parents';
    renderShell();
    renderPage();
  }catch(err){
    toast('Error eliminando cuenta: '+err.message);
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


function findPaymentForPreview(paymentId){
  return payments.find(p=>String(p.id)===String(paymentId))
    || parentPayments.find(p=>String(p.id)===String(paymentId))
    || null;
}
function evidenceViewerHtml(payment, compact=false){
  const url=String(payment?.evidence_url||'').trim();
  if(!url) return '<div class="notice warning">Este pago no tiene evidencia adjunta.</div>';
  const fileName=String(payment?.evidence_name||url).toLowerCase();
  const isPdf=fileName.includes('.pdf') || /\.pdf(?:$|\?)/i.test(url);
  if(isPdf){
    return `<iframe class="evidence-preview-frame ${compact?'compact':''}" src="${esc(url)}" title="Comprobante de pago"></iframe>`;
  }
  return `<div class="evidence-image-wrap"><img class="evidence-preview-image ${compact?'compact':''}" src="${esc(url)}" alt="Comprobante de pago"></div>`;
}
function openEvidencePreview(paymentId){
  const payment=findPaymentForPreview(paymentId);
  if(!payment){toast('No se encontró el pago.');return;}
  if(!payment.evidence_url){toast('Este pago no tiene evidencia.');return;}
  const modal=document.createElement('div');
  modal.className='modalbg open evidence-preview-overlay';
  modal.id='evidencePreviewModal';
  modal.innerHTML=`<div class="modal evidence-preview-modal">
    <div class="modal-head evidence-preview-head">
      <div><h3>Comprobante de pago</h3><small>${esc(payment.student_name||payment.player_id||'')} · ${esc(payment.payment_date||'')}</small></div>
    </div>
    <div class="modal-body evidence-preview-body">
      ${evidenceViewerHtml(payment)}
    </div>
    <div class="pay-close-footer">
      <button type="button" class="btn secondary pay-close-btn" onclick="closeModal('evidencePreviewModal')">Cerrar evidencia</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}
function paymentDifferenceText(debt,amount){
  const difference=Math.round((Number(debt||0)-Number(amount||0))*100)/100;
  if(difference>0) return {text:`Quedará adeudo de ${money(difference)}`,cls:'debt'};
  if(difference<0) return {text:`Quedará crédito de ${money(Math.abs(difference))}`,cls:'credit'};
  return {text:'Pago exacto: sin diferencia',cls:'exact'};
}
function updatePaymentReviewDifference(){
  const rows=[...document.querySelectorAll('.payment-review-row')];
  let totalReported=0,totalConfirmed=0,totalDifference=0;
  rows.forEach(row=>{
    const debt=Number(row.dataset.debt||0);
    const monthly=row.dataset.monthly!=='0';
    const input=row.querySelector('.payment-review-amount');
    const amount=Number(input?.value||0);
    const result=monthly?paymentDifferenceText(debt,amount):{cls:'exact',text:'No afecta mensualidad'};
    const resultEl=row.querySelector('.payment-review-difference');
    if(resultEl){
      resultEl.className=`payment-review-difference ${result.cls}`;
      resultEl.textContent=result.text;
    }
    totalReported+=Number(row.dataset.reported||0);
    totalConfirmed+=amount;
    if(monthly) totalDifference+=(debt-amount);
  });
  const reportedEl=document.getElementById('reviewReportedTotal');
  const confirmedEl=document.getElementById('reviewConfirmedTotal');
  const differenceEl=document.getElementById('reviewDifferenceTotal');
  if(reportedEl) reportedEl.textContent=money(totalReported);
  if(confirmedEl) confirmedEl.textContent=money(totalConfirmed);
  if(differenceEl){
    differenceEl.textContent=totalDifference>0
      ? `Adeudo restante ${money(totalDifference)}`
      : totalDifference<0
        ? `Crédito total ${money(Math.abs(totalDifference))}`
        : 'Sin diferencia';
    differenceEl.className=`review-total-difference ${totalDifference>0?'debt':totalDifference<0?'credit':'exact'}`;
  }
}
function openPaymentReview(paymentId){
  const payment=payments.find(p=>String(p.id)===String(paymentId));
  if(!payment){toast('No se encontró el pago.');return;}
  const batch=familyPaymentBatchId(payment);
  const rows=(batch?familyPaymentRows(batch,payments):[payment])
    .filter(p=>p.confirmation_status==='Pendiente de confirmación');
  if(!rows.length){toast('Este pago ya no está pendiente.');return;}

  const first=rows[0];
  const rowHtml=rows.map(p=>{
    const player=players.find(x=>x.id===p.player_id);
    const monthly=isMonthlyPayment(p);
    const debt=(player&&monthly)?calc(player).amount:0;
    const initial=Number(p.amount||0);
    const result=monthly?paymentDifferenceText(debt,initial):{cls:'exact',text:'No afecta mensualidad'};
    return `<div class="payment-review-row" data-payment-id="${p.id}" data-debt="${debt}" data-reported="${initial}" data-monthly="${monthly?'1':'0'}">
      <div class="payment-review-player">
        <b>${esc(p.student_name||player?.name||p.player_id)}</b>
        <small>Tipo: <strong>${esc(paymentTypeLabelFromNotes(p.notes))}</strong> · ${monthly?`Adeudo actual: <strong>${money(debt)}</strong>`:'No afecta adeudo mensual'} · Reportado: ${money(initial)}</small>
      </div>
      <label>Monto a confirmar
        <input class="input payment-review-amount" type="number" min="0.01" step="0.01" value="${initial}" oninput="updatePaymentReviewDifference()">
      </label>
      <div class="payment-review-difference ${result.cls}">${result.text}</div>
    </div>`;
  }).join('');

  const modal=document.createElement('div');
  modal.className='modalbg open payment-review-overlay';
  modal.id='paymentReviewModal';
  modal.innerHTML=`<div class="modal payment-review-modal">
    <div class="modal-head payment-review-head">
      <div><h3>${batch?'Revisar pago familiar':'Revisar y confirmar pago'}</h3><small>Verifica el comprobante y captura el monto realmente recibido.</small></div>
    </div>
    <div class="modal-body">
      <div class="payment-review-evidence">${evidenceViewerHtml(first,true)}</div>
      <div class="payment-review-totals">
        <div><small>Total reportado</small><strong id="reviewReportedTotal">$0.00</strong></div>
        <div><small>Total a confirmar</small><strong id="reviewConfirmedTotal">$0.00</strong></div>
        <div><small>Diferencia general</small><strong id="reviewDifferenceTotal" class="review-total-difference">—</strong></div>
      </div>
      <form id="paymentReviewForm">
        <div class="payment-review-list">${rowHtml}</div>
        <div class="payment-review-confirm-area">
          <button class="btn green payment-review-confirm-btn">${batch?'Confirmar pago para todos los hijos':'Confirmar pago'}</button>
        </div>
      </form>
    </div>
    <div class="pay-close-footer">
      <button type="button" class="btn secondary pay-close-btn" onclick="closeModal('paymentReviewModal')">Cerrar sin confirmar</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('paymentReviewForm').onsubmit=confirmReviewedPayment;
  updatePaymentReviewDifference();
}
async function confirmReviewedPayment(e){
  e.preventDefault();
  const rows=[...document.querySelectorAll('#paymentReviewModal .payment-review-row')];
  if(!rows.length){toast('No hay pagos para confirmar.');return;}

  const updates=rows.map(row=>{
    const payment=payments.find(p=>String(p.id)===String(row.dataset.paymentId));
    const amount=Number(row.querySelector('.payment-review-amount')?.value||0);
    const debt=Number(row.dataset.debt||0);
    return {payment,amount,debt,balance:Math.round((debt-amount)*100)/100};
  });
  if(updates.some(x=>!x.payment || !Number.isFinite(x.amount) || x.amount<=0)){
    toast('Captura un monto válido mayor a cero para cada jugador.');
    return;
  }

  const total=updates.reduce((s,x)=>s+x.amount,0);
  const detail=updates.map(x=>{
    const result=isMonthlyPayment(x.payment)?paymentDifferenceText(x.debt,x.amount):{text:'No afecta mensualidad'};
    return `• ${x.payment.student_name}: ${money(x.amount)} — ${result.text}`;
  }).join('\n');
  if(!confirm(`¿Confirmar ${updates.length>1?'estos pagos':'este pago'} por un total de ${money(total)}?\n\n${detail}`)) return;

  const button=document.querySelector('#paymentReviewModal .payment-review-confirm-btn');
  if(button){button.disabled=true;button.textContent='Confirmando...';}
  const failures=[];
  for(const item of updates){
    const baseNotes=cleanPaymentBalanceTags(item.payment.notes);
    const typeTag=paymentTypeTagValue(item.payment)?'':paymentTypeNoteTag('Mensualidad');
    const tags=isMonthlyPayment(item.payment)?`[DUCKS_BALANCE_AFTER:${item.balance.toFixed(2)}] [DEBT_BEFORE:${item.debt.toFixed(2)}] [CONFIRMED_AMOUNT:${item.amount.toFixed(2)}]`:''; 
    const notes=[typeTag,baseNotes,tags].filter(Boolean).join(' ');
    const {error}=await sb.from('payments').update({
      amount:item.amount,
      notes,
      confirmation_status:'Confirmado',
      confirmed_at:new Date().toISOString()
    }).eq('id',item.payment.id);
    if(error) failures.push(`${item.payment.student_name}: ${error.message}`);
  }
  if(failures.length){
    toast('Algunos pagos no se confirmaron: '+failures.join(' | '));
    if(button){button.disabled=false;button.textContent='Intentar nuevamente';}
    await refresh();
    return;
  }
  closeModal('paymentReviewModal');
  await refresh();
  page='payments';
  renderPage();
  toast(`Pago confirmado. El saldo de ${updates.length} jugador(es) fue recalculado.`);
}

function renderPayments(){
  setTitle('Pagos');
  document.getElementById('content').innerHTML=`<div class="notice success"><b>Revisión y saldo por jugador:</b> los pagos pendientes ahora se revisan y confirman directamente desde esta ventana. Cuando el monto confirmado es menor o mayor al adeudo, el CRM conserva la diferencia como adeudo restante o crédito para el siguiente periodo.</div><div class="panel"><div class="panel-head"><h3>Historial de pagos</h3><div class="actions"><button class="btn secondary" onclick="openCashReceiptForm()">🧾 Recibo efectivo</button><button class="btn green" onclick="openPaymentForm()">+ Registrar pago</button></div></div><div class="tablewrap"><table><thead><tr><th>ID</th><th>Alumno</th><th>Fecha</th><th>Tipo</th><th>Periodo</th><th>Monto reportado / confirmado</th><th>Saldo después</th><th>Método</th><th>Estatus</th><th>Evidencia</th><th>Acción</th></tr></thead><tbody>${payments.map(p=>{const pending=p.confirmation_status==='Pendiente de confirmación';const batch=familyPaymentBatchId(p);const pendingGroup=batch?familyPaymentRows(batch,payments).filter(x=>x.confirmation_status==='Pendiente de confirmación'):[];const firstInGroup=!batch||String(pendingGroup[0]?.id)===String(p.id);let action='';if(pending){action=firstInGroup?`<div class="family-admin-actions"><button class="btn green" onclick="openPaymentReview('${p.id}')">${batch?'Revisar familia y confirmar':'Revisar monto y confirmar'}</button></div>`:'<span class="sub">Incluido en revisión familiar</span>';}else{const receiptBtn=String(p.method||'').toLowerCase()==='efectivo'?`<button class="btn secondary" onclick="openCashReceiptPreviewFromPayment('${p.id}')">Recibo</button>`:'';action=`<div class="family-admin-actions">${receiptBtn}<button class="btn red" onclick="deletePayment('${p.id}')">Eliminar</button></div>`;}return `<tr><td>${String(p.id).slice(0,8)}</td><td><b>${esc(p.student_name||'')}</b><br><small>${esc(p.player_id)}</small>${batch?`<br><span class="family-payment-chip">Pago familiar · ${pendingGroup.length||familyPaymentRows(batch,payments).length} hijos</span>`:''}</td><td>${esc(p.payment_date)}</td><td>${esc(paymentTypeLabelFromNotes(p.notes))}</td><td>${esc(p.period||'')}</td><td class="amount">${money(p.amount)}</td><td>${paymentBalanceSummary(p,players.find(x=>x.id===p.player_id))}</td><td>${esc(p.method||'')}</td><td><span class="status ${statusClass(p.confirmation_status)}">${esc(p.confirmation_status)}</span></td><td>${p.evidence_url?`<button class="btn secondary" onclick="openEvidencePreview('${p.id}')">Ver evidencia</button>`:'-'}</td><td>${action}</td></tr>`}).join('')||'<tr><td colspan="11">Sin pagos</td></tr>'}</tbody></table></div></div>`;
}
function renderEvidence(){
  setTitle('Evidencias por confirmar');
  const pend=payments.filter(p=>p.confirmation_status==='Pendiente de confirmación');
  document.getElementById('content').innerHTML=`<div class="notice warning"><b>Consulta de comprobantes:</b> aquí puedes abrir la evidencia enviada y rechazarla cuando no sea válida. La revisión del monto y la confirmación del pago se realizan ahora desde la ventana <b>Pagos</b>.</div><div class="panel"><div class="panel-head"><h3>Pendientes</h3></div><div class="tablewrap"><table><thead><tr><th>Alumno</th><th>Fecha</th><th>Tipo</th><th>Periodo</th><th>Monto reportado</th><th>Adeudo actual</th><th>Enviado por</th><th>Evidencia</th><th>Acción</th></tr></thead><tbody>${pend.map(p=>{const batch=familyPaymentBatchId(p);const group=batch?familyPaymentRows(batch,pend):[];const firstInGroup=!batch||String(group[0]?.id)===String(p.id);const player=players.find(x=>x.id===p.player_id);const debt=(player&&isMonthlyPayment(p))?calc(player).amount:0;return `<tr><td><b>${esc(p.student_name)}</b><br><small>${esc(p.player_id)}</small>${batch?`<br><span class="family-payment-chip">Pago familiar · ${group.length} hijos</span>`:''}</td><td>${esc(p.payment_date)}</td><td>${esc(paymentTypeLabelFromNotes(p.notes))}</td><td>${esc(p.period||'')}</td><td class="amount">${money(p.amount)}</td><td class="amount">${isMonthlyPayment(p)?money(debt):'No afecta'}</td><td>${esc(p.submitted_by||'')}</td><td>${p.evidence_url?`<button class="btn secondary" onclick="openEvidencePreview('${p.id}')">Ver evidencia</button>`:'-'}</td><td>${firstInGroup?`<button class="btn red" onclick="${batch?`rejectFamilyPayment('${batch}')`:`rejectPayment('${p.id}')`}">${batch?'Rechazar pago familiar':'Rechazar'}</button>`:'<span class="sub">Incluido en evidencia familiar</span>'}</td></tr>`}).join('')||'<tr><td colspan="9">No hay evidencias pendientes.</td></tr>'}</tbody></table></div></div>`;
}
function renderWhatsApp(){
  setTitle('WhatsApp vencidos');
  const rows=players
    .map(p=>({...p,c:calc(p)}))
    .filter(p=>p.c.isOverdue===true && p.phone)
    .sort((a,b)=>b.c.amount-a.c.amount);
  document.getElementById('content').innerHTML=`<div class="notice warning"><b>Solo vencidos reales:</b> aquí aparecen únicamente jugadores cuyo día de pago ya pasó y mantienen un adeudo. No se muestran pagos pendientes ni próximos a vencer.</div><div class="panel"><div class="panel-head"><h3>Jugadores vencidos con WhatsApp</h3></div><div class="tablewrap"><table><thead><tr><th>ID</th><th>Jugador</th><th>Tutor</th><th>WhatsApp</th><th>Día de pago</th><th>Meses / saldo</th><th>Adeudo</th><th>Acción</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${p.id}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.tutor||'')}</td><td>${esc(p.phone||'')}</td><td>Día ${esc(p.payment_day||1)}</td><td>${p.c.months} mes(es)</td><td class="amount">${money(p.c.amount)}</td><td>${whatsappButtons(p)}</td></tr>`).join('')||'<tr><td colspan="8">No hay pagos vencidos después de la fecha límite.</td></tr>'}</tbody></table></div></div>`;
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
      ${rows.map(d=>`<tr><td><b>${esc(d.player_name)}</b><br><small>${esc(d.player_id)}</small></td><td>${esc(d.tutor||'')}</td><td>${esc(d.document_type||'')}</td><td>${esc(d.title||'')}</td><td>${esc(d.parent_name||d.submitted_by||'')}<br><small>${esc(d.parent_login||'')}</small></td><td>${esc(timestampDateISO(d.created_at))}</td><td><a class="btn secondary" target="_blank" href="${d.file_url}">Ver</a></td><td>${esc(d.notes||'')}</td></tr>`).join('')||'<tr><td colspan="8">Aún no hay documentos.</td></tr>'}
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
    <div class="kpi"><small>Avisos</small><strong>${adminNotifications.length}</strong></div>
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
      <div><h3>Avisos</h3><p>Historial de cumpleaños, pagos reportados y evidencias recibidas.</p></div>
      <button class="btn green" onclick="exportCSV('notifications')">Descargar CSV</button>
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
      <div><h3>Respaldo completo</h3><p>Archivo JSON con jugadores, pagos, avisos, cuentas, relaciones, documentos y adeudos calculados.</p></div>
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
      ${rows.map(h=>`<tr><td>${esc(formatAcademyDateTime(h.created_at))}</td><td><b>${esc(h.player_name)}</b><br><small>${esc(h.player_id)}</small></td><td>${esc(h.action||'')}</td><td>${esc(h.changed_by||'')}</td><td>${h.changes_list.length?h.changes_list.map(c=>`<span class="history-chip">${esc(fieldLabel(c.field))}</span>`).join(' '):'-'}</td><td><button class="btn secondary" onclick="openHistoryDetail('${h.id}')">Ver</button></td></tr>`).join('')||'<tr><td colspan="6">Aún no hay historial.</td></tr>'}
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
      <span>${esc(formatAcademyDateTime(h.created_at))}</span>
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

function renderSettings(){ setTitle('Configuración'); document.getElementById('content').innerHTML=`${notificationSetupNotice()}<div class="panel"><div class="panel-head"><h3>Configuración</h3></div><div class="modal-body"><div class="notice"><b>Link público:</b><br><a href="${window.DUCKS_PORTAL_URL||location.origin}" target="_blank">${window.DUCKS_PORTAL_URL||location.origin}</a></div><div class="notice success"><b>Avisos administrativos:</b> el CRM conserva alertas de cumpleaños, pagos y evidencias. <button class="btn green" onclick="requestAdminNotificationPermission()">🔔 Activar avisos del dispositivo</button></div><p>El acceso de papás se crea desde el módulo Papás.</p></div></div>`; }

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
  const registrationManaged=!p||usesRegistrationBilling(p);
  const registrationDate=p?effectiveRegistrationISO(p):todayISO();
  const registrationHelp=registrationManaged
    ? '<small>Esta fecha inicia el calendario de cobros. El día del registro el saldo será $0.</small>'
    : '<small>Jugador anterior: se muestra su fecha real de ingreso del archivo original y se conserva intacto su cálculo histórico.</small>';
  const modal=document.createElement('div'); modal.className='modalbg open'; modal.id='playerModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>${p?'Editar jugador':'Nuevo jugador'}</h3><button class="btn secondary" onclick="closeModal('playerModal')">Cerrar</button></div><div class="modal-body"><form id="playerForm" class="form-grid">
    <label class="label">ID jugador<input id="pId" class="input" value="${esc(p?.id||nextId())}" ${p?'readonly':''} required></label><label class="label">Nombre<input id="pName" class="input" value="${esc(p?.name||'')}" required></label><label class="label">Fecha de nacimiento<input id="pBirthDate" class="input" type="date" max="${todayISO()}" value="${esc(p?.birth_date||'')}" required><small>Se utiliza para calcular la edad y enviar el aviso de cumpleaños.</small></label><label class="label">Fecha de registro<input id="pRegistrationDate" class="input" type="date" max="${todayISO()}" value="${esc(registrationDate)}" ${registrationManaged?'required':'readonly'}>${registrationHelp}</label><label class="label">Día de pago<select id="pDay" class="select" required><option value="">Selecciona el día...</option>${paymentDayOptions(p?.payment_day||'')}</select></label><label class="label">Tutor principal<input id="pTutor" class="input" value="${esc(p?.tutor||'')}"></label><label class="label">WhatsApp principal<input id="pPhone" class="input" value="${esc(p?.phone||'')}"></label><label class="label">Tutor secundario<input id="pTutor2" class="input" value="${esc(p?.tutor_2||'')}" placeholder="Opcional"></label><label class="label">WhatsApp secundario<input id="pPhone2" class="input" value="${esc(p?.tutor_phone_2||'')}" placeholder="Opcional"></label><label class="label">Categoría<input id="pCategory" class="input" value="${esc(p?.category||'')}"></label><label class="label">Estado<select id="pStatus" class="select"><option ${p?.status==='Activo'?'selected':''}>Activo</option><option ${p?.status==='Inactivo'?'selected':''}>Inactivo</option><option ${p?.status==='Baja'?'selected':''}>Baja</option></select></label><label class="label">Mensualidad<input id="pFee" class="input" type="number" min="0" step="50" value="${esc(p?.monthly_fee||300)}"></label><label class="label">Número uniforme<input id="pUniform" class="input" value="${esc(p?.uniform_number||'')}"></label><label class="label">Foto<input id="pPhoto" class="input" type="file" accept="image/*"></label><label class="label full">Notas<textarea id="pNotes" class="input">${esc(stripPlayerBillingMarkers(p?.notes||''))}</textarea></label><div class="full actions"><button class="btn green">Guardar jugador</button></div></form></div></div>`;
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
      birth_date:document.getElementById('pBirthDate').value,
      tutor:document.getElementById('pTutor').value.trim(),
      phone:normalizePhone(document.getElementById('pPhone').value),
      tutor_2:document.getElementById('pTutor2')?.value.trim()||'',
      tutor_phone_2:normalizePhone(document.getElementById('pPhone2')?.value||''),
      category:document.getElementById('pCategory').value.trim(),
      status:document.getElementById('pStatus').value,
      monthly_fee:Number(document.getElementById('pFee').value||0),
      payment_day:Number(document.getElementById('pDay').value),
      uniform_number:document.getElementById('pUniform').value.trim(),
      photo_url,
      notes:document.getElementById('pNotes').value.trim()
    };

    if(!row.birth_date){ toast('Selecciona la fecha de nacimiento.'); return; }
    if(row.birth_date>todayISO()){ toast('La fecha de nacimiento no puede ser posterior a hoy.'); return; }

    const registrationManaged=!oldPlayer||usesRegistrationBilling(oldPlayer);
    if(registrationManaged) row.notes=withRegistrationBillingMarker(row.notes);
    const selectedRegistration=document.getElementById('pRegistrationDate').value;
    if(registrationManaged){
      if(!selectedRegistration){ toast('Selecciona la fecha de registro.'); return; }
      if(selectedRegistration>todayISO()){ toast('La fecha de registro no puede ser posterior a la fecha actual de Aguascalientes.'); return; }
      row.registration_date=selectedRegistration;
    }
    if(!Number.isInteger(row.payment_day) || row.payment_day<1 || row.payment_day>31){ toast('Selecciona un día de pago válido.'); return; }

    const beforeSnapshot = oldPlayer ? compactPlayerSnapshot(oldPlayer) : {};
    const afterForHistory=oldPlayer&&!registrationManaged
      ? {...oldPlayer,...row,registration_date:oldPlayer.registration_date}
      : row;
    const afterSnapshot = compactPlayerSnapshot(afterForHistory);

    const result = oldPlayer
      ? await sb.from('players').update(row).eq('id',oldPlayer.id)
      : await sb.from('players').insert(row);

    if(result.error){
      if(/birth_date/i.test(result.error.message||'')){
        throw new Error('Falta habilitar Fecha de nacimiento en Supabase. Ejecuta PASO_12_SQL_FECHAS_Y_AVISOS_v2_57.sql.');
      }
      if(/registration_date/i.test(result.error.message||'')){
        throw new Error('Falta habilitar Fecha de registro en Supabase. Ejecuta el archivo PASO_10_SQL_FECHA_REGISTRO_v2_52.txt incluido en esta versión.');
      }
      throw result.error;
    }

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
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>Registrar pago confirmado</h3><button class="btn secondary" onclick="closeModal('paymentModal')">Cerrar</button></div><div class="modal-body"><form id="paymentForm" class="form-grid"><label class="label full">Jugador<select id="payPlayer" class="select" required><option value="">Selecciona...</option>${players.map(p=>`<option value="${p.id}" ${p.id===playerId?'selected':''}>${p.id} · ${esc(p.name)}</option>`).join('')}</select></label><label class="label">Fecha<input id="payDate" class="input" type="date" value="${todayISO()}" max="${todayISO()}" required onchange="const t=document.getElementById('payType')?.value||'Mensualidad';document.getElementById('payPeriod').value=t==='Mensualidad'?period(this.value):t;document.getElementById('payNotes').placeholder=t==='Mensualidad'?'':'Detalle opcional del concepto';"></label><label class="label">Tipo de pago<select id="payType" class="select" onchange="const d=document.getElementById('payDate').value||todayISO();document.getElementById('payPeriod').value=this.value==='Mensualidad'?period(d):this.value;document.getElementById('payNotes').placeholder=this.value==='Otro'?'Especifica el concepto':'';">${adminPaymentTypeOptions('Mensualidad')}</select></label><label class="label">Periodo / Concepto<input id="payPeriod" class="input" value="${period(todayISO())}"></label><label class="label">Monto<input id="payAmount" class="input" type="number" min="0" step="50" value="${esc(selected?.monthly_fee||300)}" required></label><label class="label">Método<select id="payMethod" class="select"><option></option><option>Transferencia</option><option>Depósito</option><option>Efectivo</option><option>Tarjeta</option><option>Otro</option></select></label><label class="label">Evidencia opcional<input id="payEvidence" class="input" type="file" accept="image/*,application/pdf"></label><label class="label full">Notas<textarea id="payNotes" class="input"></textarea></label><div class="full actions"><button class="btn green">Guardar pago confirmado</button></div></form></div></div>`;
  document.body.appendChild(modal);
  document.getElementById('payPlayer').onchange=()=>{const p=players.find(x=>x.id===document.getElementById('payPlayer').value); if(p) document.getElementById('payAmount').value=p.monthly_fee||0;};
  document.getElementById('paymentForm').onsubmit=savePaymentForm;
}

function makeCashReceiptFolio(dateISO=todayISO(),playerId=''){
  const parts=parseISODate(dateISO)||parseISODate(todayISO());
  const random=(window.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`).replace(/[^a-z0-9]/gi,'').slice(-7).toUpperCase();
  const cleanPlayer=String(playerId||'JUG').replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,8)||'JUG';
  return `DUCKS-EF-${parts.year}${String(parts.month).padStart(2,'0')}${String(parts.day).padStart(2,'0')}-${cleanPlayer}-${random}`;
}
function receiptMetaTag(meta){
  return `[DUCKS_RECEIPT_META:${encodeURIComponent(JSON.stringify(meta||{}))}]`;
}
function readReceiptMeta(notes){
  const match=String(notes||'').match(/\[DUCKS_RECEIPT_META:([^\]]+)\]/);
  if(!match) return {};
  try{return JSON.parse(decodeURIComponent(match[1]));}catch(_){return {};}
}
function defaultCashReceiver(){
  return localStorage.getItem('ducks_cash_receiver_v261') || session?.user?.user_metadata?.full_name || session?.user?.email || 'Administración Ducks';
}
function cashReceiptPlayerSummary(player){
  if(!player) return '<span class="sub">Selecciona un jugador para continuar.</span>';
  return `<div class="cash-receipt-player-summary"><b>${esc(player.name)}</b><small>${esc(player.id)} · Tutor: ${esc(player.tutor||'Sin dato')}</small><small>Mensualidad sugerida: ${money(player.monthly_fee||0)}</small></div>`;
}
function updateCashReceiptPlayer(){
  const playerId=document.getElementById('cashReceiptPlayer')?.value||'';
  const player=players.find(p=>p.id===playerId);
  const info=document.getElementById('cashReceiptPlayerInfo');
  if(info) info.innerHTML=cashReceiptPlayerSummary(player);
  const amountEl=document.getElementById('cashReceiptAmount');
  if(player && amountEl) amountEl.value=player.monthly_fee||300;
  const conceptEl=document.getElementById('cashReceiptConcept');
  if(player && conceptEl && !conceptEl.dataset.edited) conceptEl.value=`Mensualidad ${period(document.getElementById('cashReceiptDate')?.value||todayISO())}`;
}
function initCashSignaturePad(){
  const canvas=document.getElementById('cashReceiptSignature');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#08263c';
  let drawing=false;
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*(canvas.width/r.width),y:(e.clientY-r.top)*(canvas.height/r.height)}};
  const start=e=>{drawing=true;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);canvas.setPointerCapture?.(e.pointerId);e.preventDefault();};
  const move=e=>{if(!drawing)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();canvas.dataset.signed='yes';e.preventDefault();};
  const stop=e=>{drawing=false;canvas.releasePointerCapture?.(e.pointerId);};
  canvas.addEventListener('pointerdown',start);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('pointerleave',stop);
}
function clearCashSignature(){
  const canvas=document.getElementById('cashReceiptSignature');
  if(!canvas)return;
  canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  canvas.dataset.signed='';
}
async function uploadCashSignature(folio){
  const canvas=document.getElementById('cashReceiptSignature');
  if(!canvas || canvas.dataset.signed!=='yes') return '';
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.95));
  if(!blob) return '';
  const file=new File([blob],`${folio}_firma.png`,{type:'image/png'});
  return uploadFile(file,'firmas-recibos');
}
function unitsToWords(n){
  const u=['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE','VEINTE','VEINTIUNO','VEINTIDÓS','VEINTITRÉS','VEINTICUATRO','VEINTICINCO','VEINTISÉIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE'];
  if(n<30) return u[n];
  const tens=['','','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const t=Math.floor(n/10),r=n%10;
  return `${tens[t]}${r?` Y ${u[r]}`:''}`;
}
function hundredsToWords(n){
  if(n===0) return '';
  if(n===100) return 'CIEN';
  const hundreds=['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
  const h=Math.floor(n/100),r=n%100;
  return `${hundreds[h]}${r?` ${unitsToWords(r)}`:''}`.trim();
}
function integerToSpanish(n){
  n=Math.max(0,Math.floor(Number(n)||0));
  if(n===0) return 'CERO';
  if(n>=1000000000) return String(n);
  const millions=Math.floor(n/1000000); n%=1000000;
  const thousands=Math.floor(n/1000); const remainder=n%1000;
  const parts=[];
  if(millions) parts.push(millions===1?'UN MILLÓN':`${integerToSpanish(millions)} MILLONES`);
  if(thousands) parts.push(thousands===1?'MIL':`${hundredsToWords(thousands)} MIL`);
  if(remainder) parts.push(hundredsToWords(remainder));
  return parts.join(' ').replace(/UNO MIL/g,'UN MIL').replace(/UNO MILLONES/g,'UN MILLONES').trim();
}
function amountInWords(amount){
  const value=Math.max(0,Number(amount)||0);
  const pesos=Math.floor(value);
  const cents=Math.round((value-pesos)*100);
  const words=integerToSpanish(pesos).replace(/UNO$/,'UN');
  const currency=pesos===1?'PESO':'PESOS';
  return `${words} ${currency} ${String(cents).padStart(2,'0')}/100 M.N.`;
}
function generateCashReceiptStampAngle(){
  const choices=[-28,-24,-20,-16,-12,12,16,20,24,28];
  return choices[Math.floor(Math.random()*choices.length)];
}
function resolveCashReceiptStampAngle(data){
  const stored=Number(data?.stamp_angle);
  if(Number.isFinite(stored) && stored!==0) return stored;
  const seed=String(data?.folio||data?.player_id||'DUCKS');
  let hash=0;
  for(let i=0;i<seed.length;i++){ hash=((hash<<5)-hash)+seed.charCodeAt(i); hash|=0; }
  const choices=[-28,-24,-20,-16,-12,12,16,20,24,28];
  return choices[Math.abs(hash)%choices.length];
}

function cashReceiptDataFromPayment(player,payment,folio=''){
  const payDate=payment?.payment_date||todayISO();
  const meta=readReceiptMeta(payment?.notes);
  return {
    folio: folio || String(payment?.notes||'').match(/\[CASH_RECEIPT:([^\]]+)\]/)?.[1] || makeCashReceiptFolio(payDate,player?.id||payment?.player_id),
    player_id: player?.id || payment?.player_id || '',
    student_name: player?.name || payment?.student_name || '',
    tutor: player?.tutor || '',
    payment_date: payDate,
    period: payment?.period || period(payDate),
    amount: Number(payment?.amount||0),
    method: 'Efectivo',
    payment_type: meta.payment_type || paymentTypeLabelFromNotes(payment?.notes),
    concept: meta.concept || 'Pago en efectivo de mensualidad',
    observations: meta.observations || '',
    received_by: meta.received_by || payment?.submitted_by || 'Administración Ducks',
    signature_url: meta.signature_url || '',
    stamp_url: meta.stamp_url || '',
    stamp_angle: Number(meta.stamp_angle||0) || 0,
    use_stamp: meta.use_stamp === true || meta.use_stamp === 'true' || !!meta.stamp_url,
    validation: meta.validation || 'Validado desde sesión administrativa',
    generated_at: meta.generated_at || formatAcademyDateTime(payment?.confirmed_at||new Date().toISOString())
  };
}
function cashReceiptHtml(data){
  const logoSrc=new URL('assets/logo.png', window.location.href).href;
  const stampAngle=resolveCashReceiptStampAngle(data);
  return `<section class="cash-receipt-print cash-receipt-formal" id="cashReceiptPrintable">
    <div class="cash-receipt-head">
      <div class="cash-receipt-brand"><img src="${logoSrc}" alt="Ducks"><div><h2>Ducks Basketball Academy</h2><small>RECIBO INTERNO DE PAGO</small></div></div>
      <div class="cash-receipt-status"><span>PAGADO</span><small>Pago recibido en efectivo</small></div>
    </div>
    <div class="cash-receipt-identity">
      <div class="cash-receipt-folio"><small>Folio único</small><strong>${esc(data.folio)}</strong></div>
      <div><small>Fecha de pago</small><strong>${esc(formatDateDMY(data.payment_date)||data.payment_date)}</strong></div>
    </div>
    <div class="cash-receipt-body">
      <div class="cash-receipt-grid">
        <div class="wide"><small>Recibimos de / Tutor</small><strong>${esc(data.tutor||'Sin dato')}</strong></div>
        <div><small>Jugador</small><strong>${esc(data.student_name)}</strong></div>
        <div><small>ID jugador</small><strong>${esc(data.player_id)}</strong></div>
        <div><small>Periodo</small><strong>${esc(data.period||'')}</strong></div>
        <div><small>Tipo de pago</small><strong>${esc(data.payment_type||'Mensualidad')}</strong></div>
        <div><small>Método</small><strong>${esc(data.method||'Efectivo')}</strong></div>
        <div class="wide"><small>Concepto</small><strong>${esc(data.concept||'Pago en efectivo')}</strong></div>
      </div>
      <div class="cash-receipt-total-box">
        <small>Monto recibido</small>
        <strong>${money(data.amount)}</strong>
        <span>${esc(amountInWords(data.amount))}</span>
      </div>
      ${data.observations?`<div class="cash-receipt-observations"><small>Observaciones</small><p>${esc(data.observations)}</p></div>`:''}
      <div class="cash-receipt-signature-block">
        <div class="cash-receipt-signature-line"><div class="cash-receipt-signature-proof">${data.use_stamp?`<img class="cash-receipt-stamp-image" style="transform:rotate(${stampAngle}deg)" src="${esc(data.stamp_url||officialReceiptStampUrl())}" alt="Sello oficial de pago recibido">`:''}${data.signature_url?`<img class="cash-receipt-signature-image" src="${esc(data.signature_url)}" alt="Firma de quien recibió">`:''}</div><strong>${esc(data.received_by||'Administración Ducks')}</strong><span>Nombre y firma/validación de quien recibió</span></div>
        <div class="cash-receipt-verification"><small>Validación administrativa</small><strong>✓ ${esc(data.validation||'Validado')}</strong><span>${esc(data.generated_at)}</span></div>
      </div>
      <div class="cash-receipt-note"><b>Comprobante interno:</b> acredita el pago registrado en el CRM Ducks. No sustituye factura ni CFDI.</div>
    </div>
    <div class="cash-receipt-foot">
      <div><small>Academia</small><strong>Ducks Basketball Academy</strong></div>
      <div><small>Contacto</small><strong>${esc(ACADEMY_WHATSAPP)}</strong></div>
      <div class="wide"><small>Ubicación</small><strong>${esc(ACADEMY_ADDRESS)}</strong></div>
    </div>
  </section>`;
}
function cashReceiptPrintStyles(){
  return `
    @page{size:auto;margin:9mm}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{margin:0;padding:0;background:#fff;color:#0a2035;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.25}
    body{padding:0}
    .cash-receipt-print{width:100%;max-width:190mm;margin:0 auto;background:#fff;border:2px solid #0d3b5f;border-radius:16px;overflow:hidden;box-shadow:none;page-break-inside:avoid;break-inside:avoid}
    .cash-receipt-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 16px;background:linear-gradient(135deg,#073f2f,#0d6748);color:#fff}
    .cash-receipt-brand{display:flex;gap:10px;align-items:center}.cash-receipt-brand img{width:52px;height:52px;object-fit:contain;background:#fff;border-radius:12px;padding:4px}.cash-receipt-brand h2{margin:0 0 2px;font-size:18px;line-height:1.1}.cash-receipt-brand small{letter-spacing:1px;font-size:10px}
    .cash-receipt-status{text-align:center;border:1.5px solid #e9ffbd;border-radius:10px;padding:7px 10px;min-width:118px}.cash-receipt-status span{display:block;font-weight:900;font-size:20px;line-height:1;color:#caff42}.cash-receipt-status small{display:block;margin-top:2px;font-size:10px}
    .cash-receipt-identity{display:grid;grid-template-columns:2fr 1fr;gap:10px;padding:10px 16px;background:#edf7f2;border-bottom:1px solid #d1e7dc}.cash-receipt-identity small,.cash-receipt-grid small,.cash-receipt-foot small,.cash-receipt-observations small,.cash-receipt-verification small{display:block;color:#5a6c78;margin-bottom:3px;font-size:10px}.cash-receipt-identity strong{font-size:12px;word-break:break-all;line-height:1.2}
    .cash-receipt-body{padding:12px 16px 10px}.cash-receipt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px}.cash-receipt-grid>div{border:1px solid #d8e5ea;border-radius:10px;padding:8px 10px;background:#f8fbfc}.cash-receipt-grid .wide{grid-column:1/-1}.cash-receipt-grid strong,.cash-receipt-foot strong{display:block;font-size:12px;line-height:1.2}
    .cash-receipt-total-box{background:linear-gradient(135deg,#b8f000,#ddff75);color:#081d30;border-radius:12px;padding:10px 14px;text-align:center;margin:10px 0;border:1.5px solid #7eae00}.cash-receipt-total-box small{display:block;font-size:10px}.cash-receipt-total-box strong{display:block;font-size:25px;line-height:1.05;margin:2px 0}.cash-receipt-total-box span{display:block;font-weight:800;font-size:10px;line-height:1.2}
    .cash-receipt-observations{border:1px solid #d8e5ea;border-radius:10px;padding:8px 10px;margin:8px 0}.cash-receipt-observations p{margin:0;white-space:pre-wrap;font-size:11px;line-height:1.25}
    .cash-receipt-signature-block{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:end;margin:14px 0 10px}.cash-receipt-signature-line{border-top:1.5px solid #183c4d;padding-top:7px;text-align:center;min-height:62px}.cash-receipt-signature-proof{min-height:96px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;margin:-2px auto 6px;width:100%;max-width:210px}.cash-receipt-stamp-image{display:block;max-width:126px;max-height:72px;object-fit:contain;margin:0 auto}.cash-receipt-signature-image{display:block;max-width:170px;max-height:46px;object-fit:contain;margin:0 auto}.cash-receipt-signature-line strong,.cash-receipt-signature-line span{display:block}.cash-receipt-signature-line strong{font-size:12px;line-height:1.2}.cash-receipt-signature-line span{font-size:10px;color:#5a6c78;margin-top:3px;line-height:1.2}.cash-receipt-verification{border:1px solid #c9e8d8;background:#effaf4;border-radius:10px;padding:9px}.cash-receipt-verification strong,.cash-receipt-verification span{display:block}.cash-receipt-verification strong{color:#087142;font-size:12px;line-height:1.2}.cash-receipt-verification span{font-size:10px;margin-top:4px;color:#4e6760;line-height:1.2}
    .cash-receipt-note{border-left:4px solid #0e8555;background:#edf8f3;padding:8px 10px;border-radius:8px;color:#194535;font-size:10.5px;line-height:1.25;margin-top:8px}
    .cash-receipt-foot{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 16px 12px}.cash-receipt-foot .wide{grid-column:1/-1}
    @media(max-width:700px){.cash-receipt-head,.cash-receipt-signature-block{grid-template-columns:1fr;display:grid}.cash-receipt-identity,.cash-receipt-grid,.cash-receipt-foot{grid-template-columns:1fr}.cash-receipt-grid .wide,.cash-receipt-foot .wide{grid-column:auto}.cash-receipt-status{text-align:left;min-width:0}.cash-receipt-signature-proof{max-width:100%;min-height:88px}.cash-receipt-signature-image{margin:0 auto 4px}.cash-receipt-stamp-image{max-width:118px;max-height:68px}}
    @media print{html,body{width:100%;height:auto}.cash-receipt-print{margin:0 auto;border-radius:12px;transform:none!important;page-break-inside:avoid;break-inside:avoid}.cash-receipt-head,.cash-receipt-body,.cash-receipt-foot,.cash-receipt-identity{page-break-inside:avoid;break-inside:avoid}}
  `;
}

async function loadImageForCanvas(src){
  return await new Promise((resolve,reject)=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('No se pudo cargar imagen: '+src));
    img.src=src;
  });
}
function roundedRectPath(ctx,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}
function wrapCanvasText(ctx,text,x,y,maxWidth,lineHeight,maxLines=999){
  const words=String(text||'').split(/\s+/).filter(Boolean);
  if(!words.length) return y;
  let line='';
  let lines=0;
  for(const word of words){
    const test=line ? `${line} ${word}` : word;
    if(ctx.measureText(test).width>maxWidth && line){
      ctx.fillText(line,x,y);
      y+=lineHeight;
      lines++;
      if(lines>=maxLines) return y;
      line=word;
    } else line=test;
  }
  if(line && lines<maxLines){ ctx.fillText(line,x,y); y+=lineHeight; }
  return y;
}
async function buildCashReceiptImageBlob(data){
  const canvas=document.createElement('canvas');
  canvas.width=1200; canvas.height=1700;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#eef4f7'; ctx.fillRect(0,0,1200,1700);

  ctx.save();
  roundedRectPath(ctx,60,50,1080,1600,28);
  ctx.fillStyle='#ffffff';
  ctx.shadowColor='rgba(7,40,61,0.14)';
  ctx.shadowBlur=24;
  ctx.shadowOffsetY=8;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle='#0f3a4e';
  ctx.fillRect(88,82,1024,124);
  ctx.fillStyle='#0d8d53';
  ctx.fillRect(88,206,1024,16);

  try{
    const logo=await loadImageForCanvas(officialLogoUrl());
    ctx.drawImage(logo,116,95,92,92);
  }catch(e){}

  ctx.fillStyle='#ffffff';
  ctx.font='bold 40px Arial';
  ctx.fillText('Ducks Basketball Academy',232,142);
  ctx.font='24px Arial';
  ctx.fillText('Recibo oficial de pago',232,178);

  roundedRectPath(ctx,850,104,230,74,16);
  ctx.fillStyle='#f2fbf6';
  ctx.fill();
  ctx.strokeStyle='#c6e8d2';
  ctx.lineWidth=2;
  ctx.stroke();
  ctx.fillStyle='#266447';
  ctx.font='bold 21px Arial';
  ctx.fillText('Folio',870,132);
  ctx.font='bold 24px Arial';
  ctx.fillText(String(data.folio||''),870,162);

  const drawLabelValue=(label,value,x,y,width)=>{
    ctx.fillStyle='#58707d';
    ctx.font='bold 19px Arial';
    ctx.fillText(label,x,y);
    ctx.fillStyle='#102a38';
    ctx.font='28px Arial';
    return wrapCanvasText(ctx,String(value||''),x,y+34,width,32,3);
  };

  let y=276;
  const y1=drawLabelValue('Jugador', data.student_name||'', 118, y, 430);
  let y2=drawLabelValue('Fecha', formatDateDMY(data.payment_date)||data.payment_date||'', 650, y, 220);
  y2=drawLabelValue('Periodo', data.period||'', 650, y2+10, 220);
  y=Math.max(y1,y2)+14;
  y=drawLabelValue('Concepto', data.concept||'Pago en efectivo', 118, y, 900)+10;

  const drawInfoBox=(label,val,x,y,w,h,accent=false)=>{
    roundedRectPath(ctx,x,y,w,h,18);
    ctx.fillStyle=accent?'#edf8f3':'#f7fafc';
    ctx.fill();
    ctx.strokeStyle=accent?'#bbe3cd':'#dbe6ec';
    ctx.lineWidth=2;
    ctx.stroke();
    ctx.fillStyle='#5d7580';
    ctx.font='bold 18px Arial';
    ctx.fillText(label,x+22,y+28);
    ctx.fillStyle=accent?'#087142':'#102a38';
    ctx.font='bold 30px Arial';
    wrapCanvasText(ctx,String(val||''),x+22,y+66,w-44,34,2);
  };

  drawInfoBox('Monto', money(data.amount||0), 118, y, 430, 108, true);
  drawInfoBox('Tipo', data.payment_type||'Mensualidad', 572, y, 242, 108, false);
  drawInfoBox('Estatus', 'PAGADO', 832, y, 248, 108, true);
  y += 134;

  drawInfoBox('Recibido por', data.received_by||'Coach Arturo', 118, y, 430, 112, false);
  drawInfoBox('Generado', data.generated_at||formatAcademyDateTime(new Date().toISOString()), 572, y, 508, 112, false);
  y += 146;

  roundedRectPath(ctx,118,y,962,132,18);
  ctx.fillStyle='#fbfdfe';
  ctx.fill();
  ctx.strokeStyle='#dbe6ec';
  ctx.lineWidth=2;
  ctx.stroke();
  ctx.fillStyle='#5d7580';
  ctx.font='bold 19px Arial';
  ctx.fillText('Observaciones',142,y+28);
  ctx.fillStyle='#102a38';
  ctx.font='24px Arial';
  wrapCanvasText(ctx, data.observations||'Sin observaciones adicionales.',142,y+64,918,30,3);
  y += 164;

  roundedRectPath(ctx,118,y,470,228,18);
  ctx.fillStyle='#ffffff';
  ctx.fill();
  ctx.strokeStyle='#dbe6ec';
  ctx.lineWidth=2;
  ctx.stroke();
  ctx.fillStyle='#5d7580';
  ctx.font='bold 19px Arial';
  ctx.fillText('Firma / sello de recibido',142,y+28);

  if(data.stamp_url || data.use_stamp){
    try{
      const stamp=await loadImageForCanvas(data.stamp_url || officialReceiptStampUrl());
      const stampAngle=resolveCashReceiptStampAngle(data) * Math.PI / 180;
      ctx.save();
      ctx.translate(305,y+122);
      ctx.rotate(stampAngle);
      ctx.drawImage(stamp,-112,-112,224,224);
      ctx.restore();
    }catch(e){}
  }
  if(data.signature_url){
    try{
      const sign=await loadImageForCanvas(data.signature_url);
      ctx.drawImage(sign,300,y+120,220,58);
    }catch(e){}
  }

  ctx.strokeStyle='#183c4d';
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(148,y+190);
  ctx.lineTo(548,y+190);
  ctx.stroke();
  ctx.fillStyle='#102a38';
  ctx.font='bold 20px Arial';
  ctx.fillText(String(data.received_by||'Coach Arturo'),196,y+214);
  ctx.fillStyle='#5d7580';
  ctx.font='16px Arial';
  ctx.fillText('Nombre, firma o sello de quien recibió',175,y+235);

  roundedRectPath(ctx,610,y,470,228,18);
  ctx.fillStyle='#edf8f3';
  ctx.fill();
  ctx.strokeStyle='#c6e8d2';
  ctx.lineWidth=2;
  ctx.stroke();
  ctx.fillStyle='#216245';
  ctx.font='bold 20px Arial';
  ctx.fillText('Validación administrativa',636,y+30);
  ctx.fillStyle='#087142';
  ctx.font='bold 32px Arial';
  ctx.fillText('✓ Pago confirmado',636,y+76);
  ctx.fillStyle='#27424f';
  ctx.font='22px Arial';
  wrapCanvasText(ctx, `Periodo cubierto: ${data.period||''}`,636,y+116,400,28,2);
  wrapCanvasText(ctx, 'Recibo interno de Ducks Basketball Academy.',636,y+154,400,28,2);
  y += 264;

  roundedRectPath(ctx,118,y,962,120,18);
  ctx.fillStyle='#fff9ef';
  ctx.fill();
  ctx.strokeStyle='#f0d7a8';
  ctx.lineWidth=2;
  ctx.stroke();
  ctx.fillStyle='#7a5622';
  ctx.font='bold 18px Arial';
  ctx.fillText('Importante',142,y+28);
  ctx.fillStyle='#5c4a2d';
  ctx.font='22px Arial';
  wrapCanvasText(ctx, 'Este comprobante corresponde al pago recibido y validado en el CRM de Ducks Basketball Academy.',142,y+66,918,28,3);

  return await new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.95));
}
function downloadBlobFile(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function prepareCashReceiptShareImage(data){
  try{
    const btn=document.getElementById('cashReceiptWhatsappBtn');
    if(btn){ btn.disabled=false; btn.textContent='Preparando imagen...'; }
    const blob=await buildCashReceiptImageBlob(data);
    const filename=`recibo-${(data.folio||'ducks').replace(/[^a-z0-9_-]/gi,'_')}.png`;
    const file=new File([blob], filename, {type:'image/png'});
    window.currentCashReceiptImageBlob=blob;
    window.currentCashReceiptImageFile=file;
    if(btn){ btn.disabled=false; btn.textContent='Enviar imagen por WhatsApp'; btn.classList.add('ready'); }
  }catch(err){
    console.error(err);
    const btn=document.getElementById('cashReceiptWhatsappBtn');
    if(btn){ btn.disabled=false; btn.textContent='Generar imagen para WhatsApp'; }
    toast('No se pudo preparar la imagen del recibo.');
  }
}

function cashReceiptWhatsappMessage(data){
  return '';
}
async function sendCashReceiptWhatsApp(){
  const data=window.currentCashReceiptData;
  if(!data){toast('No se encontró la información del recibo.');return;}
  const player=players.find(p=>String(p.id)===String(data.player_id));
  const phone=String(player?.phone||player?.tutor_phone||'').replace(/\D/g,'');
  if(!phone){toast('El jugador no tiene un WhatsApp registrado.');return;}

  let file=window.currentCashReceiptImageFile;
  let blob=window.currentCashReceiptImageBlob;
  if(!file || !blob){
    blob=await buildCashReceiptImageBlob(data);
    const filename=`recibo-${(data.folio||'ducks').replace(/[^a-z0-9_-]/gi,'_')}.png`;
    file=new File([blob], filename, {type:'image/png'});
    window.currentCashReceiptImageBlob=blob;
    window.currentCashReceiptImageFile=file;
  }

  if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
    try{
      await navigator.share({ files:[file] });
      toast('Selecciona WhatsApp para enviar únicamente la imagen del recibo.');
      return;
    }catch(err){
      if(String(err?.name||'')==='AbortError') return;
      console.warn('No se pudo compartir directo',err);
    }
  }

  downloadBlobFile(blob, file.name);
  const url=`https://wa.me/${phone}`;
  window.open(url,'_blank','noopener');
  toast('Se descargó la imagen del recibo. Adjúntala manualmente en WhatsApp sin texto adicional.');
}
async function printCashReceipt(){
  const data=window.currentCashReceiptData;
  if(!data){toast('No se encontró la información del recibo.');return;}
  let blob=window.currentCashReceiptImageBlob;
  if(!blob){
    blob=await buildCashReceiptImageBlob(data);
    window.currentCashReceiptImageBlob=blob;
  }
  const imgUrl=URL.createObjectURL(blob);
  const win=window.open('', '_blank', 'width=900,height=1000');
  if(!win){toast('Permite ventanas emergentes para imprimir el recibo.');return;}
  const folio=String(data.folio||'Ducks').replace(/</g,'');
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recibo ${folio}</title><style>
@page{size:letter portrait;margin:8mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#eef4f7;font-family:Arial,Helvetica,sans-serif}
.print-toolbar{position:sticky;top:0;z-index:20;display:flex;justify-content:center;gap:12px;padding:12px;background:#eef4f7;border-bottom:1px solid #cbd9df}
.print-toolbar button{appearance:none;border:0;border-radius:8px;padding:11px 18px;font:700 14px Arial;cursor:pointer}
.print-toolbar .print-btn{background:#0d6748;color:#fff}
.print-toolbar .close-btn{background:#dfe8ec;color:#123247}
.print-page{min-height:calc(100vh - 58px);display:flex;align-items:flex-start;justify-content:center;padding:12px}
.receipt-image{display:block;width:auto;max-width:100%;max-height:calc(100vh - 88px);object-fit:contain;background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.14)}
@media print{html,body{background:#fff}.print-toolbar{display:none!important}.print-page{padding:0;min-height:0}.receipt-image{width:100%;height:auto;max-width:100%;max-height:100%;box-shadow:none;page-break-inside:avoid;break-inside:avoid}}
</style></head><body><div class="print-toolbar"><button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button><button class="close-btn" onclick="window.close()">Cerrar</button></div><div class="print-page"><img class="receipt-image" src="${imgUrl}" alt="Recibo Ducks"></div><script>setTimeout(()=>window.print(),450);window.addEventListener('beforeunload',()=>URL.revokeObjectURL('${imgUrl}'));<\/script></body></html>`);
  win.document.close();
  win.focus();
}
function openCashReceiptPreview(data){
  window.currentCashReceiptData=data;
  const modal=document.createElement('div');
  modal.className='modalbg open';
  modal.id='cashReceiptPreviewModal';
  modal.innerHTML=`<div class="modal wide-modal"><div class="modal-head"><h3>Recibo formal generado</h3><button class="btn secondary" onclick="closeModal('cashReceiptPreviewModal')">Cerrar</button></div><div class="modal-body"><div class="notice success"><b>Recibo generado.</b> Presiona <b>Enviar imagen por WhatsApp</b>; el mensaje será corto y el recibo va como imagen con sello/firma.</div>${cashReceiptHtml(data)}<div class="actions cash-receipt-actions"><button id="cashReceiptWhatsappBtn" class="btn green" onclick="sendCashReceiptWhatsApp()">Enviar imagen por WhatsApp</button><button class="btn secondary" onclick="printCashReceipt()">Imprimir / Guardar PDF</button><button class="btn secondary" onclick="closeModal('cashReceiptPreviewModal')">Cerrar</button></div></div></div>`;
  document.body.appendChild(modal);
  prepareCashReceiptShareImage(data);
}
function openCashReceiptPreviewFromPayment(paymentId){
  const payment=payments.find(p=>String(p.id)===String(paymentId));
  if(!payment){toast('No se encontró el pago.');return;}
  const player=players.find(p=>p.id===payment.player_id);
  openCashReceiptPreview(cashReceiptDataFromPayment(player,payment));
}
function openCashReceiptForm(playerId=''){
  const selected=players.find(x=>x.id===playerId) || players[0] || null;
  const defaultPeriod=period(todayISO());
  const receiver=defaultCashReceiver();
  const modal=document.createElement('div'); modal.className='modalbg open'; modal.id='cashReceiptFormModal';
  modal.innerHTML=`<div class="modal"><div class="modal-head"><h3>Generar recibo formal de efectivo</h3><button class="btn secondary" onclick="closeModal('cashReceiptFormModal')">Cerrar</button></div><div class="modal-body"><div class="notice success"><b>Registro completo:</b> captura los datos del cobro. El CRM guardará el pago como confirmado y emitirá un recibo con folio único, validación administrativa y sello opcional.</div><form id="cashReceiptForm" class="form-grid"><label class="label full">Jugador<select id="cashReceiptPlayer" class="select" required onchange="updateCashReceiptPlayer()"><option value="">Selecciona...</option>${players.map(p=>`<option value="${p.id}" ${selected&&p.id===selected.id?'selected':''}>${p.id} · ${esc(p.name)}</option>`).join('')}</select></label><div id="cashReceiptPlayerInfo" class="full">${cashReceiptPlayerSummary(selected)}</div><label class="label">Fecha<input id="cashReceiptDate" class="input" type="date" value="${todayISO()}" max="${todayISO()}" required onchange="const t=document.getElementById('cashReceiptType')?.value||'Mensualidad';document.getElementById('cashReceiptConcept').value=paymentConceptFromType(t,this.value)"></label><label class="label">Tipo de pago<select id="cashReceiptType" class="select" onchange="const d=document.getElementById('cashReceiptDate').value||todayISO();document.getElementById('cashReceiptConcept').value=paymentConceptFromType(this.value,d);"><option>Mensualidad</option><option>Inscripción</option><option>Uniforme</option><option>Torneo</option><option>Otro</option></select><small>Solo Mensualidad afecta adeudo mensual.</small></label><label class="label">Monto<input id="cashReceiptAmount" class="input" type="number" min="0.01" step="0.01" value="${esc(selected?.monthly_fee||300)}" required></label><label class="label full">Concepto<input id="cashReceiptConcept" class="input" value="Mensualidad ${esc(defaultPeriod)}" oninput="this.dataset.edited='1'" required></label><label class="label full">Recibido por<input id="cashReceiptReceiver" class="input" value="${esc(receiver)}" required><small>Este nombre aparecerá en la línea de validación del recibo.</small></label><label class="label full">Observaciones<textarea id="cashReceiptObservations" class="input" placeholder="Opcional: torneo, inscripción, abono, meses cubiertos, etc."></textarea></label><label class="consent-check full stamp-consent-check"><input id="cashReceiptUseStamp" type="checkbox" checked><span>Insertar sello oficial <b>Pago recibido</b> / <b>Recibido por Coach Arturo</b>.</span></label><div class="cash-stamp-preview full"><img src="${officialReceiptStampUrl()}" alt="Sello oficial Ducks"><div><b>Sello oficial Ducks Basketball Academy</b><small>Se integrará automáticamente dentro del área de firma del recibo.</small></div></div><div class="label full cash-signature-field"><span>Firma digital de quien recibe <small>(opcional, recomendada)</small></span><canvas id="cashReceiptSignature" width="700" height="170"></canvas><div class="actions"><button type="button" class="btn secondary small" onclick="clearCashSignature()">Limpiar firma</button></div></div><label class="consent-check full"><input id="cashReceiptValidation" type="checkbox" required><span>Confirmo que recibí físicamente el efectivo y autorizo registrar este pago como confirmado.</span></label><div class="full actions"><button class="btn green">Registrar pago y generar recibo</button></div></form></div></div>`;
  document.body.appendChild(modal);
  document.getElementById('cashReceiptForm').onsubmit=saveCashReceiptForm;
  initCashSignaturePad();
}
async function saveCashReceiptForm(e){
  e.preventDefault();
  const submitBtn=e.submitter;
  try{
    const player_id=document.getElementById('cashReceiptPlayer').value;
    const payDate=document.getElementById('cashReceiptDate').value || todayISO();
    const amount=Number(document.getElementById('cashReceiptAmount').value||0);
    const payment_type=document.getElementById('cashReceiptType')?.value||'Mensualidad';
    const concept=document.getElementById('cashReceiptConcept').value.trim();
    const received_by=document.getElementById('cashReceiptReceiver').value.trim();
    const observations=document.getElementById('cashReceiptObservations').value.trim();
    const player=players.find(p=>p.id===player_id);
    if(!player){toast('Selecciona un jugador.');return;}
    if(payDate>todayISO()){toast('La fecha no puede ser posterior al día actual.');return;}
    if(!amount || amount<=0){toast('Captura un monto válido.');return;}
    if(!concept || !received_by){toast('Completa el concepto y el nombre de quien recibe.');return;}
    if(!document.getElementById('cashReceiptValidation').checked){toast('Confirma la recepción del efectivo.');return;}
    if(submitBtn){submitBtn.disabled=true;submitBtn.textContent='Generando recibo...';}
    localStorage.setItem('ducks_cash_receiver_v261',received_by);
    const folio=makeCashReceiptFolio(payDate,player_id);
    const generated_at=formatAcademyDateTime(new Date().toISOString());
    const signature_url=await uploadCashSignature(folio);
    const use_stamp=!!document.getElementById('cashReceiptUseStamp')?.checked;
    const stamp_url=use_stamp ? officialReceiptStampUrl() : '';
    const stamp_angle=use_stamp ? generateCashReceiptStampAngle() : 0;
    const meta={payment_type,concept,observations,received_by,signature_url,stamp_url,stamp_angle,use_stamp,validation:'Validado desde sesión administrativa',generated_at};
    const note=`${paymentTypeNoteTag(payment_type)} [CASH_RECEIPT:${folio}] ${receiptMetaTag(meta)} Pago en efectivo registrado desde administración.`;
    const row={player_id,student_name:player.name||'',payment_date:payDate,period:payment_type==='Mensualidad'?period(payDate):payment_type,amount,method:'Efectivo',notes:note,confirmation_status:'Confirmado',evidence_url:'',evidence_name:'',submitted_by:received_by,confirmed_at:new Date().toISOString()};
    const {data,error}=await sb.from('payments').insert(row).select().single();
    if(error){toast(error.message);if(submitBtn){submitBtn.disabled=false;submitBtn.textContent='Registrar pago y generar recibo';}return;}
    closeModal('cashReceiptFormModal');
    await refresh();
    page='payments';
    renderPage();
    openCashReceiptPreview(cashReceiptDataFromPayment(player,data||row,folio));
    toast('Pago en efectivo registrado y recibo formal generado.');
  }catch(err){
    console.error(err); toast('No fue posible generar el recibo: '+(err?.message||err));
    if(submitBtn){submitBtn.disabled=false;submitBtn.textContent='Registrar pago y generar recibo';}
  }
}

async function savePaymentForm(e){
  e.preventDefault();
  const player_id=document.getElementById('payPlayer').value;
  const player=players.find(p=>p.id===player_id);
  const file=document.getElementById('payEvidence').files[0];
  try{
    const payDate=document.getElementById('payDate').value;
    if(payDate>todayISO()) throw new Error('La fecha de pago no puede ser posterior a la fecha actual de Aguascalientes.');
    const evidence_url=file?await uploadFile(file,'evidencias'):'';
    const payType=document.getElementById('payType')?.value||'Mensualidad';
    const baseNotes=document.getElementById('payNotes').value.trim();
    const notes=`${paymentTypeNoteTag(payType)}${baseNotes?' '+baseNotes:''}`;
    const row={player_id,student_name:player?.name||'',payment_date:payDate,period:document.getElementById('payPeriod').value||(payType==='Mensualidad'?period(payDate):payType),amount:Number(document.getElementById('payAmount').value||0),method:document.getElementById('payMethod').value,notes,confirmation_status:'Confirmado',evidence_url,evidence_name:file?.name||'',submitted_by:'Admin',confirmed_at:new Date().toISOString()};
    const {error}=await sb.from('payments').insert(row);
    if(error) throw error;
    toast('Pago guardado y confirmado');
    closeModal('paymentModal');
    await refresh();
    page='payments';
    renderPage();
  }catch(err){toast('Error: '+err.message);}
}

async function confirmFamilyPayment(batchId){
  const row=payments.find(p=>familyPaymentBatchId(p)===batchId && p.confirmation_status==='Pendiente de confirmación');
  if(!row){toast('Este pago familiar ya no tiene registros pendientes.');return;}
  openPaymentReview(row.id);
}
async function rejectFamilyPayment(batchId){
  const rows=payments.filter(p=>familyPaymentBatchId(p)===batchId && p.confirmation_status==='Pendiente de confirmación');
  if(!rows.length){toast('Este pago familiar ya no tiene registros pendientes.');return;}
  if(!confirm(`¿Rechazar el pago familiar para ${rows.length} hijos?`)) return;
  const ids=rows.map(p=>p.id);
  const {error}=await sb.from('payments').update({confirmation_status:'Rechazado'}).in('id',ids);
  if(error) toast('Error: '+error.message); else{toast(`Pago familiar rechazado para ${rows.length} hijos`);await refresh();}
}

async function confirmPayment(id){ openPaymentReview(id); }
async function rejectPayment(id){const {error}=await sb.from('payments').update({confirmation_status:'Rechazado'}).eq('id',id); if(error)toast(error.message); else{toast('Pago rechazado'); await refresh();}}
async function deletePayment(id){if(!confirm('¿Eliminar pago?'))return; const {error}=await sb.from('payments').delete().eq('id',id); if(error)toast(error.message); else{toast('Pago eliminado'); await refresh();}}

window.openPublicNotifications=openPublicNotifications; window.openPublicNewsHub=openPublicNewsHub; window.openPublicMoreMenu=openPublicMoreMenu; window.renderParentPaymentHistory=renderParentPaymentHistory; window.openPortalSearch=openPortalSearch; window.renderPortalSearchResults=renderPortalSearchResults; window.portalSearchGo=portalSearchGo; window.openCategoriesInfo=openCategoriesInfo; window.openValuesInfo=openValuesInfo; window.openAcademyMap=openAcademyMap; window.openParentSectionAction=openParentSectionAction; window.openDucksRegulation=openDucksRegulation; window.downloadDucksRegulation=downloadDucksRegulation; window.scrollToPublicSection=scrollToPublicSection; window.showCalendarNotice=showCalendarNotice; window.openDucksWhatsApp=openDucksWhatsApp; window.openAcademyStory=openAcademyStory; window.openTrainingInfo=openTrainingInfo; window.openCommunityInfo=openCommunityInfo; window.openDucksRegulation=openDucksRegulation; window.downloadDucksRegulation=downloadDucksRegulation; window.showCalendarNotice=showCalendarNotice; window.scrollToPublicSection=scrollToPublicSection; window.openPortalSearch=openPortalSearch; window.renderPortalSearchResults=renderPortalSearchResults; window.portalSearchGo=portalSearchGo; window.openCategoriesInfo=openCategoriesInfo; window.openValuesInfo=openValuesInfo; window.openAcademyMap=openAcademyMap; window.openParentSectionAction=openParentSectionAction; window.renderPublicHome=renderPublicHome; window.renderRegistrationForm=renderRegistrationForm; window.toggleRegistrationDetail=toggleRegistrationDetail; window.renderParentLogin=renderParentLogin; window.renderAdminLogin=renderAdminLogin; window.renderLogin=renderAdminLogin; window.parentLogout=parentLogout; window.copyBank=copyBank; window.openParentPayment=openParentPayment; window.openParentDocument=openParentDocument; window.installDucksApp=installDucksApp; window.goBackSmart=goBackSmart; window.openPlayerForm=openPlayerForm; window.deletePlayer=deletePlayer; window.openPaymentForm=openPaymentForm; window.confirmPayment=confirmPayment; window.rejectPayment=rejectPayment; window.deletePayment=deletePayment; window.closeModal=closeModal; window.copyReminder=copyReminder; window.deleteParentLink=deleteParentLink; window.prefillParent=prefillParent; window.exportCSV=exportCSV; window.exportFullJSON=exportFullJSON; window.exportDocumentsCSV=exportDocumentsCSV; window.resetParentPassword=resetParentPassword; window.autoLinkAccountFromButton=autoLinkAccountFromButton; window.editParentAccount=editParentAccount; window.saveParentAccountChanges=saveParentAccountChanges; window.deleteParentAccount=deleteParentAccount; window.sendParentCredentialsWhatsApp=sendParentCredentialsWhatsApp; window.openFamilyPayment=openFamilyPayment; window.updateFamilyPaymentTotal=updateFamilyPaymentTotal; window.toggleAllFamilyPlayers=toggleAllFamilyPlayers; window.copyFamilyPaymentData=copyFamilyPaymentData; window.confirmFamilyPayment=confirmFamilyPayment; window.rejectFamilyPayment=rejectFamilyPayment; window.openEvidencePreview=openEvidencePreview; window.openPaymentReview=openPaymentReview; window.updatePaymentReviewDifference=updatePaymentReviewDifference; window.confirmReviewedPayment=confirmReviewedPayment; window.openCashReceiptForm=openCashReceiptForm; window.updateCashReceiptPlayer=updateCashReceiptPlayer; window.saveCashReceiptForm=saveCashReceiptForm; window.openCashReceiptPreviewFromPayment=openCashReceiptPreviewFromPayment; window.printCashReceipt=printCashReceipt; window.sendCashReceiptWhatsApp=sendCashReceiptWhatsApp; window.clearCashSignature=clearCashSignature;

init();

window.parentChangeOwnPassword=parentChangeOwnPassword; window.parentExitToHome=parentExitToHome;

window.openParentPayNow=openParentPayNow;

window.copyDefaultPaymentData=copyDefaultPaymentData;

window.requestAdminNotificationPermission=requestAdminNotificationPermission; window.openRegistrationDetail=openRegistrationDetail; window.openRegistrationConvert=openRegistrationConvert; window.updateRegistrationStatus=updateRegistrationStatus; window.markNotificationRead=markNotificationRead; window.markAllNotificationsRead=markAllNotificationsRead; window.openNotificationTarget=openNotificationTarget;

window.openPlayerHistory=openPlayerHistory; window.openHistoryDetail=openHistoryDetail; window.exportPlayerHistoryCSV=exportPlayerHistoryCSV;
