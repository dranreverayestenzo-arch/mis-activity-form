const STORAGE_KEY = 'activity_app_data_v1';
const STAGES = [
  { id:1, name:'Application' },
];

const SUPABASE_URL = 'https://wohjvtwnhovxanestdmp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cBpuyEPNUwDRhfErXcPs2w_kdbTPWVc';
let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const state = {
  activities: [],
  wifiVouchers: [],
  wifiEditingId: null,
  currentSchoolYear: localStorage.getItem('currentSchoolYear') || '2027-2028',
  schoolYearRecords: JSON.parse(localStorage.getItem('schoolYearRecords') || '[]'),
  archiveView: null,
  wifiShowCount: 15,
  theme: localStorage.getItem('theme') || 'light',
  currentDetail: null,
  formEquipment: [],
  formFile: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

async function load() {
  try { state.wifiVouchers = JSON.parse(localStorage.getItem('wifi_vouchers') || '[]'); } catch { state.wifiVouchers = []; }
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('wifi_vouchers').select('*');
      if (!error && data) state.wifiVouchers = data;
    } catch (e) { console.error(e); }
    try {
      const { data, error } = await supabaseClient.from('activities').select('*').order('createdAt', { ascending: false });
      if (error) throw error;
      state.activities = (data || []).map(a => ({ ...a, status: a.status || 'Upcoming', timeStart: a.timeStart || a.time || '', timeEnd: a.timeEnd || '', stage: 1, compliance: a.compliance || null, equipment: a.equipment || [], hardCopyUrl: a.hardCopyUrl || '' }));
      return;
    } catch (e) { console.error(e); }
  }
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    state.activities = arr.map(a => ({ ...a, status: a.status || 'Upcoming', timeStart: a.timeStart || a.time || '', timeEnd: a.timeEnd || '', stage: 1 }));
  } catch { state.activities = []; }
}
async function saveWifi() {
  localStorage.setItem('wifi_vouchers', JSON.stringify(state.wifiVouchers));
  if (supabaseClient) {
    try { await supabaseClient.from('wifi_vouchers').upsert(state.wifiVouchers, { onConflict: 'id' }); } catch (e) { console.error(e); }
  }
}
function saveSyRecords() {
  localStorage.setItem('schoolYearRecords', JSON.stringify(state.schoolYearRecords));
  localStorage.setItem('currentSchoolYear', state.currentSchoolYear);
}
async function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.activities));
  if (supabaseClient) {
    try {
      await supabaseClient.from('activities').upsert(state.activities, { onConflict: 'id' });
    } catch (e) { console.error(e); }
  }
}
function uid() { return 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2400); }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatDate(d){ if(!d) return ''; const dt=new Date(d); return dt.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
function formatTime(t){
  if(!t) return '';
  const parts = String(t).split(':');
  if(parts.length < 2) return t;
  let h = parseInt(parts[0],10);
  const m = parts[1];
  if(isNaN(h)) return t;
  h = h % 12; if(h === 0) h = 12;
  return h + ':' + m;
}
function formatTimeRange(a){
  if(!a) return '';
  const s = formatTime(a.timeStart || a.time);
  const e = formatTime(a.timeEnd);
  if(s && e) return s + ' - ' + e;
  return s || e || '';
}

function applyTheme(){
  if(state.theme==='dark') document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.removeAttribute('data-theme');
}
$('#themeToggle').addEventListener('click',()=>{ state.theme = state.theme==='dark'?'light':'dark'; localStorage.setItem('theme',state.theme); applyTheme(); });
const notifBtn=$('#notifBtn'); if(notifBtn) notifBtn.addEventListener('click',()=>openStatsModal('upcoming'));
function updateNotifBadge(){
  const today=new Date().toISOString().slice(0,10);
  const count=state.activities.filter(a=>a.status==='Upcoming' && a.dateOfActivity>=today).length;
  const badge=$('#notifBadge'); if(!badge) return;
  badge.textContent=count; badge.style.display = count>0 ? 'inline-block' : 'none';
}
applyTheme();

function showView(name){
  $$('.view').forEach(v=>v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active');
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  if(name==='dashboard') renderDashboard();
  if(name==='list') renderList();
  if(name==='records') renderRecords();
  if(name==='wifi'){ populateWifiCourses(); updateWifiTitles(); }
  if(name==='wifirecords'){ renderWifi(); updateWifiTitles(); }
  if(name==='schoolyears'){ renderSchoolYearRecords(); }
}
$$('.nav-btn, [data-view]').forEach(el=>{
  el.addEventListener('click',()=>{ const v=el.getAttribute('data-view'); if(v) showView(v); });
});

$('#objectives').addEventListener('input',(e)=>{ $('#charCount').textContent=e.target.value.length; });
$('#hardCopy').addEventListener('change',(e)=>{
  const f=e.target.files?.[0]||null;
  state.formFile=f;
  const hp=$('#hardCopyPreview');
  if(hp) hp.textContent = f ? ('Selected: '+f.name) : '';
});

function validateForm(){
  let ok=true;
  const fields=['dateOfApplication','nameOfActivity','dateOfActivity','organizer','timeStart','venue','objectives'];
  $$('.error').forEach(e=>e.textContent='');
  const rules={
    dateOfApplication:'Date of application is required',
    nameOfActivity:v=> v?'': 'Name of activity is required',
    dateOfActivity:v=> v?'': 'Date of activity is required',
    organizer:v=> v?'': 'Organizer/class is required',
    timeStart:v=> v?'': 'Start time is required',
    venue:v=> v?'': 'Venue is required',
    objectives:v=> v?'': 'Objectives are required',
  };
  fields.forEach(f=>{
    const el=$('#'+f); const val=el.value.trim();
    let msg='';
    if(typeof rules[f]==='string'){ if(!val) msg=rules[f]; }
    else { msg=rules[f](val); }
    if(msg){ $('[data-for="'+f+'"]').textContent=msg; ok=false; }
  });
  if($('#nameOfActivity').value.trim().length>0 && $('#nameOfActivity').value.trim().length<3){ $('[data-for="nameOfActivity"]').textContent='At least 3 characters'; ok=false; }
  return ok;
}

$('#activityForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!validateForm()) return;
  const btn=$('#submitBtn'); const spinner=btn.querySelector('.btn-spinner'); const text=btn.querySelector('.btn-text');
  text.hidden=true; spinner.hidden=false; btn.disabled=true;
  await new Promise(r=>setTimeout(r,400));

  const id = $('#activityId').value || uid();
  const existing = state.activities.find(a=>a.id===id);
  let hardCopyUrl = existing?.hardCopyUrl || '';
  const file = state.formFile;
  if (file && supabaseClient) {
    try {
      const path = id + '/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const { error: upErr } = await supabaseClient.storage.from('hard-copies').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabaseClient.storage.from('hard-copies').getPublicUrl(path);
      hardCopyUrl = pub.publicUrl;
    } catch (e) { console.error(e); toast('Hard copy upload failed'); }
  }
  const activity = {
    id,
    dateOfApplication: $('#dateOfApplication').value,
    nameOfActivity: $('#nameOfActivity').value.trim(),
    dateOfActivity: $('#dateOfActivity').value,
    organizer: $('#organizer').value.trim(),
    time: $('#timeStart').value,
    timeStart: $('#timeStart').value,
    timeEnd: $('#timeEnd').value,
    venue: $('#venue').value.trim(),
    requestedBy: $('#requestedBy').value.trim(),
    notedBy: $('#notedBy').value.trim(),
    objectives: $('#objectives').value.trim(),
    stage: existing ? existing.stage : 1,
    status: $('#status').value || existing?.status || 'Upcoming',
    statusNote: existing?.statusNote || '',
    compliance: {
      requirements: '',
      reviewer: $('#reviewer').value.trim(),
      recommendation: $('#recommendation').value,
      notes: '',
      date: new Date().toISOString(),
    },
    equipment: state.formEquipment.length ? [...state.formEquipment] : (existing?.equipment || []),
    hardCopyUrl,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if(existing){ const idx=state.activities.findIndex(a=>a.id===id); state.activities[idx]=activity; toast('Application updated'); }
  else { state.activities.unshift(activity); toast('Application submitted'); }
  await save();
  scheduleNotifications();
  resetForm();
  btn.disabled=false; text.hidden=false; spinner.hidden=true;
  showView('list');
});

function resetForm(){
  $('#activityForm').reset();
  $('#activityId').value='';
  $('#formTitle').textContent='Activity Application';
  $('#charCount').textContent='0';
  $('#status').value='Upcoming';
  state.formEquipment=[];
  state.formFile=null;
  const hc=$('#hardCopy'); if(hc) hc.value='';
  const hp=$('#hardCopyPreview'); if(hp) hp.textContent='';
  renderFormEquip();
  $$('.error').forEach(e=>e.textContent='');
}

$('#resetBtn').addEventListener('click',()=>{ resetForm(); toast('Form reset'); });
$('#newFromList').addEventListener('click',()=>{ resetForm(); showView('form'); });

function renderFormEquip(){
  const tbody=$('#f_eqBody'); if(!tbody) return;
  tbody.innerHTML='';
  const head = document.querySelector('.eq-returned-col');
  if(head) head.style.display = '';
  state.formEquipment.forEach((e,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${escapeHtml(e.item)}</td><td>${e.qty}</td><td><input type="text" value="${escapeHtml(e.borrowedBy||'')}" data-borrowed="${i}" style="width:100%;padding:4px;" /></td><td><input type="date" value="${e.dateBorrowed||''}" data-dateb="${i}" style="width:100%;padding:4px;" /></td><td><button type="button" class="btn ghost small" data-ret="${i}" style="padding:4px 8px;color:${e.returned?'#1a7f37':'#cf222e'};font-weight:600;">${e.returned?'RETURNED':'NO RETURNED'}</button></td><td><button type="button" class="btn ghost small" data-feq="${i}" style="padding:4px 8px;">✕</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-borrowed]').forEach(inp=>inp.addEventListener('input',()=>{ state.formEquipment[+inp.dataset.borrowed].borrowedBy=inp.value; }));
  tbody.querySelectorAll('[data-dateb]').forEach(inp=>inp.addEventListener('change',()=>{ state.formEquipment[+inp.dataset.dateb].dateBorrowed=inp.value; }));
  tbody.querySelectorAll('[data-ret]').forEach(btn=>btn.addEventListener('click',()=>{
    const i=+btn.dataset.ret;
    state.formEquipment[i].returned = !state.formEquipment[i].returned;
    btn.textContent = state.formEquipment[i].returned ? 'RETURNED' : 'NO RETURNED';
    btn.style.color = state.formEquipment[i].returned ? '#1a7f37' : '#cf222e';
  }));
  tbody.querySelectorAll('[data-feq]').forEach(b=>b.addEventListener('click',()=>{
    state.formEquipment.splice(+b.dataset.feq,1); renderFormEquip();
  }));
}
$('#f_addEq').addEventListener('click',()=>{
  const item=$('#f_eqItem').value.trim(); const qty=parseInt($('#f_eqQty').value)||1;
  const borrowedBy=$('#f_eqBy')?.value.trim()||'';
  const dateBorrowed=$('#f_eqDate')?.value||'';
  if(!item){ toast('Enter item name'); return; }
  state.formEquipment.push({ id:uid(), item, qty, borrowedBy, dateBorrowed, returned:false });
  $('#f_eqItem').value=''; $('#f_eqQty').value=''; if($('#f_eqBy')) $('#f_eqBy').value=''; if($('#f_eqDate')) $('#f_eqDate').value='';
  renderFormEquip();
});

function populateFilters(){}
const statusEl=$('#status'); if(statusEl) statusEl.addEventListener('change', renderFormEquip);
['searchInput','filterStatus','filterDate','sortBy'].forEach(id=>{
  const el=$('#'+id); if(!el) return;
  el.addEventListener('input', renderList);
  el.addEventListener('change', renderList);
});
['recSearch','recDateFilter','recMonthFilter'].forEach(id=>{
  const el=$('#'+id); if(!el) return;
  el.addEventListener('input', renderRecords);
  el.addEventListener('change', renderRecords);
});

function renderList(){
  populateFilters();
  const grid=$('#activityGrid'); const empty=$('#emptyState');
  let list=[...state.activities];
  const q=$('#searchInput').value.toLowerCase().trim();
  const date=$('#filterDate').value;
  const sort=$('#sortBy').value;
  const status=$('#filterStatus')?.value||'';
  if(q) list=list.filter(a=>(a.nameOfActivity+' '+a.organizer+' '+a.venue+' '+a.objectives).toLowerCase().includes(q));
  if(status) list=list.filter(a=>a.status===status);
  if(date) list=list.filter(a=>a.dateOfActivity===date);

  list.sort((a,b)=>{
    switch(sort){
      case 'event-asc': return new Date(a.dateOfActivity)-new Date(b.dateOfActivity);
      case 'event-desc': return new Date(b.dateOfActivity)-new Date(a.dateOfActivity);
      case 'app-desc': return new Date(b.dateOfApplication)-new Date(a.dateOfApplication);
      case 'title': return a.nameOfActivity.localeCompare(b.nameOfActivity);
    } return 0;
  });

  grid.innerHTML='';
  if(list.length===0){ empty.hidden=false; return; }
  empty.hidden=true;
  list.forEach(a=>{
    const card=document.createElement('article');
    card.className='activity-card';
    const stageObj=STAGES.find(s=>s.id===a.stage);
    const isDone = a.stage===3;
    card.innerHTML=`
      <div class="card-head">
        <div class="card-title">${escapeHtml(a.nameOfActivity)}</div>
        <div class="card-badges">
          <span class="badge badge-status ${a.status==='Completed'?'completed':''}">${escapeHtml(a.status)}</span>
        </div>
      </div>
      <div class="card-meta">
        <span>📅 Event: ${formatDate(a.dateOfActivity)} ${a.timeStart?'⏰ '+formatTimeRange(a):''}</span>
        <span>👤 ${escapeHtml(a.organizer)}</span>
        <span>📍 ${escapeHtml(a.venue)}</span>
        <span>📝 Applied: ${formatDate(a.dateOfApplication)}</span>
      </div>
      <div class="card-actions">
        <button data-edit="${a.id}">Edit</button>
        <button class="del" data-del="${a.id}">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',(e)=>{ e.stopPropagation(); editActivity(b.dataset.edit); }));
  grid.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',(e)=>{ e.stopPropagation(); deleteActivity(b.dataset.del); }));
}

function editActivity(id){
  const a=state.activities.find(x=>x.id===id); if(!a) return;
  $('#activityId').value=a.id;
  $('#dateOfApplication').value=a.dateOfApplication;
  $('#nameOfActivity').value=a.nameOfActivity;
  $('#dateOfActivity').value=a.dateOfActivity;
  $('#organizer').value=a.organizer;
  $('#timeStart').value=a.timeStart||a.time||'';
  $('#timeEnd').value=a.timeEnd||'';
  $('#venue').value=a.venue;
  $('#requestedBy').value=a.requestedBy||'';
  $('#notedBy').value=a.notedBy||'';
  $('#status').value=a.status||'Upcoming';
  $('#reviewer').value=a.compliance?.reviewer||'';
  $('#recommendation').value=a.compliance?.recommendation||'';
  state.formEquipment=[...(a.equipment||[])];
  state.formFile=null;
  const hc=$('#hardCopy'); if(hc) hc.value='';
  const hp=$('#hardCopyPreview'); if(hp) hp.textContent = a.hardCopyUrl ? 'File already attached' : '';
  renderFormEquip();
  $('#objectives').value=a.objectives;
  $('#charCount').textContent=a.objectives.length;
  $('#formTitle').textContent='Edit Application — '+a.nameOfActivity;
  showView('form');
}

async function deleteActivity(id){
  if(!confirm('Delete this application?')) return;
  state.activities=state.activities.filter(a=>a.id!==id);
  if (supabaseClient) {
    try { await supabaseClient.from('activities').delete().eq('id', id); } catch(e){ console.error(e); }
  }
  save(); toast('Application deleted');
  renderList(); renderDashboard();
  closeDetail();
}

function openDetail(id){
  const a=state.activities.find(x=>x.id===id); if(!a) return;
  state.currentDetail=id;
  renderDetail(a);
  $('#detailModal').hidden=false;
}
function closeDetail(){ $('#detailModal').hidden=true; state.currentDetail=null; }
$$('[data-close]').forEach(el=>el.addEventListener('click',closeDetail));

function openStatsModal(type){
  const today=new Date().toISOString().slice(0,10);
  let list=[...state.activities];
  let title='Applications';
  if(type==='total'){ title='All Applications'; }
  else if(type==='completed'){ list=list.filter(a=>a.status==='Completed'); title='Completed Applications'; }
  else if(type==='upcoming'){ list=list.filter(a=>a.dateOfActivity>=today); title='Upcoming Events'; }
  else if(type==='inprogress'){ list=list.filter(a=>a.status!=='Completed'); title='In Progress'; }
  const mc=$('#statsModalContent');
  let html=`<h2 style="font-family:'Playfair Display',serif;color:var(--maroon);margin:0 0 12px;">${title} (${list.length})</h2>`;
  if(list.length===0){ html+='<p style="color:var(--text-muted);">No applications found.</p>'; }
  else {
    html+='<div style="display:flex;flex-direction:column;gap:8px;">';
    list.forEach(a=>{
      html+=`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface);cursor:pointer;" data-open="${a.id}">
        <div>
          <div style="font-weight:600;color:var(--text);">${escapeHtml(a.nameOfActivity)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${formatDate(a.dateOfActivity)} ${a.timeStart?'⏰ '+formatTimeRange(a):''} • ${escapeHtml(a.organizer)} • ${escapeHtml(a.status)}</div>
        </div>
        <span class="badge badge-status ${a.status==='Completed'?'completed':''}">${escapeHtml(a.status)}</span>
      </div>`;
    });
    html+='</div>';
  }
  mc.innerHTML=html;
  mc.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>{ closeStatsModal(); openDetail(el.dataset.open); }));
  $('#statsModal').hidden=false;
}
function closeStatsModal(){ $('#statsModal').hidden=true; }
$$('[data-close-stats]').forEach(el=>el.addEventListener('click',closeStatsModal));

function renderDetail(a){
  const mc=$('#modalContent');
  const stageObj=STAGES.find(s=>s.id===a.stage);
  let stepperHtml='<div class="stepper">';
  STAGES.forEach(s=>{
    const cls = s.id < a.stage ? 'done' : (s.id===a.stage ? 'current' : '');
    stepperHtml += `<div class="step ${cls}"><div class="step-num">${s.id}</div><div class="step-label">${s.name}</div><span class="step-line"></span></div>`;
  });
  stepperHtml+='</div>';

  let html = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:4px;">
    <h2 style="font-family:'Playfair Display',serif;color:var(--maroon);font-size:24px;margin:0;">${escapeHtml(a.nameOfActivity)}</h2>
    <span class="badge badge-status ${a.status==='Completed'?'completed':''}" style="margin-top:6px;">${escapeHtml(a.status)}</span>
  </div>
  ${stepperHtml}
  <div class="detail-section">
    <h3>Application Details</h3>
    <div class="detail-row"><span class="k">Date of Application</span><span class="v">${formatDate(a.dateOfApplication)}</span></div>
    <div class="detail-row"><span class="k">Name of Activity</span><span class="v">${escapeHtml(a.nameOfActivity)}</span></div>
    <div class="detail-row"><span class="k">Date of Activity</span><span class="v">${formatDate(a.dateOfActivity)}</span></div>
    <div class="detail-row"><span class="k">Organizer / Class</span><span class="v">${escapeHtml(a.organizer)}</span></div>
    <div class="detail-row"><span class="k">Venue</span><span class="v">${escapeHtml(a.venue)}</span></div>
    <div class="detail-row"><span class="k">Start Time</span><span class="v">${formatTime(a.timeStart)||'—'}</span></div>
    <div class="detail-row"><span class="k">End Time</span><span class="v">${formatTime(a.timeEnd)||'—'}</span></div>
    <div class="detail-row"><span class="k">Requested by</span><span class="v">${escapeHtml(a.requestedBy||'—')}</span></div>
    <div class="detail-row"><span class="k">Noted by</span><span class="v">${escapeHtml(a.notedBy||'—')}</span></div>
    <div class="detail-row"><span class="k">Objectives</span><span class="v">${escapeHtml(a.objectives)}</span></div>
    
    <div class="detail-row"><span class="k">Reviewed by</span><span class="v">${escapeHtml(a.compliance?.reviewer||'—')}</span></div>
    <div class="detail-row"><span class="k">Recommendation</span><span class="v">${escapeHtml(a.compliance?.recommendation||'—')}</span></div>
    
    <div class="detail-row"><span class="k">Event Status</span><span class="v">${escapeHtml(a.status)}${a.statusNote?' — '+escapeHtml(a.statusNote):''}</span></div>
    ${a.hardCopyUrl? `<div class="detail-row"><span class="k">Hard Copy</span><span class="v"><a class="btn primary small" href="${a.hardCopyUrl}" target="_blank" rel="noopener" style="text-decoration:none;">View Form</a></span></div>` : ''}
    <div class="detail-row"><span class="k">Equipment Borrowed</span><span class="v">${(a.equipment||[]).length? a.equipment.map(e=>escapeHtml(e.item)+' (Qty: '+e.qty+') - Status: '+(e.returned?'RETURNED':'NO RETURNED')).join('<br>') : '—'}</span></div>
  </div>
  <div style="text-align:right;margin-top:14px;">
    <button class="btn primary small" onclick="printRecord('${a.id}')">Print Record</button>
  </div>`;



  mc.innerHTML=html;

}


function persistDetail(a){
  const idx=state.activities.findIndex(x=>x.id===a.id); if(idx!==-1){ state.activities[idx]=a; save(); }
}

function renderDashboard(){
  const total=state.activities.length;
  const byStage={};
  STAGES.forEach(s=>byStage[s.id]=state.activities.filter(a=>a.stage===s.id).length);
  const completed=state.activities.filter(a=>a.status==='Completed').length;
  const upcoming=state.activities.filter(a=>a.dateOfActivity>=new Date().toISOString().slice(0,10)).length;
  const inProgress=total-completed;
  const grid=$('#statsGrid');
  grid.innerHTML=`
    <div class="stat-card" data-stat="total"><div class="stat-icon">📋</div><div class="stat-value">${total}</div><div class="stat-label">Total Applications</div></div>
    <div class="stat-card" data-stat="completed"><div class="stat-icon">✅</div><div class="stat-value">${completed}</div><div class="stat-label">Completed</div></div>
    <div class="stat-card" data-stat="upcoming"><div class="stat-icon">📅</div><div class="stat-value">${upcoming}</div><div class="stat-label">Upcoming Events</div></div>
    <div class="stat-card" data-stat="inprogress"><div class="stat-icon">⏳</div><div class="stat-value">${inProgress}</div><div class="stat-label">In Progress</div></div>
  `;
  grid.querySelectorAll('[data-stat]').forEach(card=>card.addEventListener('click',()=>openStatsModal(card.dataset.stat)));
  updateNotifBadge();
  const recent=[...state.activities].sort((a,b)=>new Date(a.dateOfActivity)-new Date(b.dateOfActivity)).slice(0,5);
  const rl=$('#recentList'); rl.innerHTML='';
  if(recent.length===0){ rl.innerHTML='<li class="recent-item"><div class="recent-info"><div class="recent-title">No applications yet</div><div class="recent-meta">Create your first one!</div></div></li>'; }
  else {
    recent.forEach(a=>{
      const li=document.createElement('li'); li.className='recent-item';
      li.innerHTML=`<span class="recent-dot"></span><div class="recent-info"><div class="recent-title">${escapeHtml(a.nameOfActivity)}</div><div class="recent-meta">${formatDate(a.dateOfActivity)} ${a.timeStart?'⏰ '+formatTimeRange(a):''}</div></div>`;
      li.addEventListener('click',()=>openDetail(a.id));
      rl.appendChild(li);
    });
  }
  // stage chart removed
}

function monthKey(d){ if(!d) return ''; return d.slice(0,7); }
function monthLabel(key){ if(!key) return ''; const [y,m]=key.split('-'); const dt=new Date(+y,+m-1,1); return dt.toLocaleDateString(undefined,{month:'long',year:'numeric'}); }

function renderRecords(){
  const container=$('#recordsList'); const empty=$('#recordsEmpty');
  const mf=$('#recMonthFilter');
  const prevMf=mf.value;
  const months=[...new Set(state.activities.map(a=>monthKey(a.dateOfActivity)))].filter(Boolean).sort().reverse();
  mf.innerHTML='<option value="">All months</option>'+months.map(m=>`<option value="${m}">${monthLabel(m)}</option>`).join('');
  mf.value=months.includes(prevMf)?prevMf:'';

  let list=[...state.activities];
  const q=($('#recSearch')?.value||'').toLowerCase().trim();
  const d=$('#recDateFilter')?.value||'';
  const m=mf.value;
  if(q) list=list.filter(a=>(a.nameOfActivity+' '+a.organizer+' '+a.venue+' '+a.objectives).toLowerCase().includes(q));
  if(d) list=list.filter(a=>a.dateOfActivity===d);
  if(m) list=list.filter(a=>monthKey(a.dateOfActivity)===m);
  list.sort((a,b)=>new Date(a.dateOfActivity)-new Date(b.dateOfActivity));

  container.innerHTML='';
  if(list.length===0){ empty.hidden=false; return; }
  empty.hidden=true;

  const groups={};
  list.forEach(a=>{ const k=monthKey(a.dateOfActivity)||'Unknown'; (groups[k]=groups[k]||[]).push(a); });
  Object.keys(groups).sort().forEach(key=>{
    const header=document.createElement('div');
    header.style.cssText='margin:18px 0 8px;font-family:Playfair Display,serif;color:var(--maroon);font-size:20px;border-bottom:2px solid var(--border);padding-bottom:6px;';
    header.textContent = key==='Unknown'?'Unknown Date':monthLabel(key)+' ('+groups[key].length+')';
    container.appendChild(header);
    groups[key].forEach(a=>{
      const row=document.createElement('div');
      row.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;background:var(--surface);';
      row.innerHTML=`
        <div>
          <div style="font-weight:600;color:var(--text);">${escapeHtml(a.nameOfActivity)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${formatDate(a.dateOfActivity)} • ${escapeHtml(a.status)}</div>
        </div>
        <button class="btn ghost small" data-view="${a.id}">View</button>
      `;
      container.appendChild(row);
    });
  });
  container.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.view)));
}

function printRecord(id){
  const a=state.activities.find(x=>x.id===id); if(!a) return;
  const html=`<!DOCTYPE html><html><head><title>Activity Record - ${escapeHtml(a.nameOfActivity)}</title>
  <style>body{font-family:Arial,sans-serif;margin:30px;color:#1f1416;}h1{color:#7a1f2b;}h2{color:#7a1f2b;margin-top:20px;font-size:16px;border-bottom:1px solid #7a1f2b;padding-bottom:4px;}table{width:100%;border-collapse:collapse;}td{padding:6px 4px;border-bottom:1px solid #eee;vertical-align:top;}td.k{width:180px;font-weight:bold;color:#555;}@media print{button{display:none;}}</style></head><body>
  <h1>Activity Record</h1>
  <p><strong>${escapeHtml(a.nameOfActivity)}</strong></p>
  <h2>Application Details</h2>
  <table>
    <tr><td class="k">Date of Application</td><td>${formatDate(a.dateOfApplication)}</td></tr>
    <tr><td class="k">Name of Activity</td><td>${escapeHtml(a.nameOfActivity)}</td></tr>
    <tr><td class="k">Date of Activity</td><td>${formatDate(a.dateOfActivity)}</td></tr>
    <tr><td class="k">Organizer / Class</td><td>${escapeHtml(a.organizer)}</td></tr>
    <tr><td class="k">Venue</td><td>${escapeHtml(a.venue)}</td></tr>
    <tr><td class="k">Start Time</td><td>${formatTime(a.timeStart)||'—'}</td></tr>
    <tr><td class="k">End Time</td><td>${formatTime(a.timeEnd)||'—'}</td></tr>
    <tr><td class="k">Requested by</td><td>${escapeHtml(a.requestedBy||'—')}</td></tr>
    <tr><td class="k">Noted by</td><td>${escapeHtml(a.notedBy||'—')}</td></tr>
    <tr><td class="k">Objectives</td><td>${escapeHtml(a.objectives)}</td></tr>
    <tr><td class="k">Event Status</td><td>${escapeHtml(a.status)}${a.statusNote?' — '+escapeHtml(a.statusNote):''}</td></tr>
  </table>
  <h2>Step 2 — Compliance Review</h2>
  <table>
    
    <tr><td class="k">Reviewed By</td><td>${escapeHtml(a.compliance?.reviewer||'—')}</td></tr>
    <tr><td class="k">Recommendation</td><td>${escapeHtml(a.compliance?.recommendation||'—')}</td></tr>
    
  </table>
  <h2>Step 3 — Equipment Borrowed</h2>
  <table>
    <tr><th>Item</th><th>Qty</th><th>Returned Status</th></tr>
    ${(a.equipment||[]).map(e=>`<tr><td>${escapeHtml(e.item)}</td><td>${e.qty}</td><td>${e.returned?'RETURNED':'NO RETURNED'}</td></tr>`).join('')||'<tr><td colspan="3">None</td></tr>'}
  </table>
  <br><button onclick="window.print()">Print</button>
  </body></html>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close();
}

const SEED_VERSION = 'v2-samples';
function seed(){
  if (localStorage.getItem('seedVersion') === SEED_VERSION) return;
  state.activities = [];
  const year = new Date().getFullYear();
  const names = ['Science Fair','Intramurals Opening','Parent-Teacher Meeting','Field Trip','Sports Fest','Cultural Night','Training Seminar','Community Outreach','Quiz Bee','Art Exhibit','Health Checkup','Career Talk'];
  const organizers = ['Grade 10 - Einstein','PE Department','PTA','Science Club','Student Council','Faculty','Guidance Office','Health Office'];
  const venues = ['School Gymnasium','Sports Complex','Auditorium','Library','Classroom 201','Covered Court'];
  const statuses = ['Upcoming','Completed','Cancelled'];
  const recs = ['Approve','Reject','Revise',''];
  for (let m=0; m<12; m++){
    for (let i=0; i<5; i++){
      const day = 2 + i*5;
      const dd = String(day).padStart(2,'0');
      const mm = String(m+1).padStart(2,'0');
      const dateOfActivity = year + '-' + mm + '-' + dd;
      const dateOfApplication = year + '-' + mm + '-01';
      const name = names[(m+i)%names.length] + ' ' + (i+1);
      const org = organizers[(m+i)%organizers.length];
      const venue = venues[(m+i)%venues.length];
      const status = statuses[(m+i)%statuses.length];
      const rec = recs[(m+i)%recs.length];
      state.activities.push({
        id: uid(),
        dateOfApplication,
        nameOfActivity: name,
        dateOfActivity,
        organizer: org,
        timeStart: '08:00',
        timeEnd: '10:00',
        venue,
        requestedBy: 'Requester ' + (i+1),
        notedBy: 'Noter ' + (i+1),
        objectives: 'Objectives for ' + name,
        stage: 1,
        status,
        statusNote: '',
        compliance: { requirements: 'Req list', reviewer: 'Reviewer ' + (i+1), recommendation: rec, notes: 'Notes', date: new Date().toISOString() },
        equipment: i%2===0 ? [{ id:uid(), item:'Chair', qty:10, borrowedBy:'Borrower', dateBorrowed:dateOfActivity, returned: i%3===0 }] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  save();
  localStorage.setItem('seedVersion', SEED_VERSION);
}
const WIFI_COURSES = {
  CCS: ['BS-IT','BS-CS'],
  CAS: ['AB-ENGLISH','AB-POLSCI','AB-FILIPINO'],
  COE: ['BS-CE','BS-ME','BS-EE','BS-ECE','BS-CpE'],
  COC: ['BS-CRIM'],
  CBA: ['BS-BA'],
  CED: ['BE-ED','BS-ED','TCP'],
  GS: ['MA-ED'],
  FACULTY: ['CCS','CAS','CED','BED','ACCT','COC','REGISTRAR','LIBRARY','COC FACULTY','HR ASSOCIATES','GARDENER','MEDIA OFFICER','COE','GS'],
  HS: ['GRADE 7','GRADE 8','GRADE 9','GRADE 10','GRADE 11','GRADE 12'],
};
function populateWifiCourses(){
  const dept = $('#wDept')?.value || 'CCS';
  const sel = $('#wCourse'); if(!sel) return;
  sel.innerHTML = '';
  (WIFI_COURSES[dept]||[]).forEach(c=>{
    const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o);
  });
}
$('#wDept')?.addEventListener('change', populateWifiCourses);

function renderWifi(){
  const container=$('#wifiRecordsList') || $('#wifiList'); if(!container) return;
  const q = ($('#wifiSearch')?.value || '').trim().toLowerCase();
  const dept = ($('#wifiDeptFilter')?.value || '').trim();
  let source = state.wifiVouchers;
  if(state.archiveView){
    const rec = state.schoolYearRecords.find(r=>r.schoolYear===state.archiveView);
    source = rec ? (rec.vouchers||[]) : [];
  }
  let list=[...source].sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(q) list=list.filter(v=>(v.idNo||'').toLowerCase().includes(q));
  if(dept) list=list.filter(v=>v.dept===dept);
  if(list.length===0){ container.innerHTML='<p style="color:var(--text-muted);">No vouchers recorded.</p>'; return; }
  let html='<table><thead><tr><th>ID No.</th><th>Name</th><th>Voucher Code</th><th>Department</th><th>Course</th><th>Date</th><th>Status</th><th style="width:160px;"></th></tr></thead><tbody>';
  list.forEach(v=>{
    const active = isVoucherActive(v);
    html+=`<tr>
      <td>${escapeHtml(v.idNo)}</td>
      <td>${escapeHtml(v.name)}</td>
      <td>${escapeHtml(v.voucher)}</td>
      <td>${escapeHtml(v.dept||'')}</td>
      <td>${escapeHtml(v.course)}</td>
      <td>${formatDate(v.date)}</td>
      <td style="color:${active?'#1a7f37':'#cf222e'};font-weight:600;">${active?'ACTIVE':'EXPIRED'}</td>
      <td style="white-space:nowrap;">
        <button class="btn ghost small" data-wedit="${v.id}">Edit</button>
        <button class="btn ghost small" data-wdel="${v.id}">Delete</button>
      </td>
    </tr>`;
  });
  html+='</tbody></table>';
  container.innerHTML=html;
  container.querySelectorAll('[data-wedit]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.wedit;
    editWifi(id);
  }));
  container.querySelectorAll('[data-wdel]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.wdel;
    if(state.archiveView){
      const rec = state.schoolYearRecords.find(r=>r.schoolYear===state.archiveView);
      if(rec){ rec.vouchers = (rec.vouchers||[]).filter(v=>v.id!==id); saveSyRecords(); }
    } else {
      state.wifiVouchers=state.wifiVouchers.filter(v=>v.id!==id);
      saveWifi();
      if (supabaseClient) {
        supabaseClient.from('wifi_vouchers').delete().eq('id', id).then(({error})=>{ if(error) console.error(error); });
      }
    }
    renderWifi();
  }));
}
$('#wifiSearch')?.addEventListener('input', renderWifi);
$('#wifiDeptFilter')?.addEventListener('change', renderWifi);

function showArchiveModal(idx){
  const rec = state.schoolYearRecords[idx]; if(!rec) return;
  const existing = $('#archiveModal'); if(existing) existing.remove();
  let limit = 15;
  const overlay = document.createElement('div');
  overlay.id = 'archiveModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;';

  function renderBody(){
    const vouchers = rec.vouchers||[];
    const shown = vouchers.slice(0, limit);
    const rows = shown.map(v=>`<tr data-idno="${escapeHtml((v.idNo||'').toLowerCase())}" style="border-bottom:1px solid var(--border,#eee);">
      <td style="padding:10px 12px;">${escapeHtml(v.idNo)}</td>
      <td style="padding:10px 12px;">${escapeHtml(v.name)}</td>
      <td style="padding:10px 12px;">${escapeHtml(v.voucher)}</td>
      <td style="padding:10px 12px;">${escapeHtml(v.dept||'')}</td>
      <td style="padding:10px 12px;">${escapeHtml(v.course)}</td>
      <td style="padding:10px 12px;">${formatDate(v.date)}</td>
      <td style="padding:10px 12px;white-space:nowrap;">
        <button class="btn primary small" data-aedit="${v.id}">Edit</button>
        <button class="btn ghost small" data-adel="${v.id}">Delete</button>
      </td>
    </tr>`).join('');
    const tbody = overlay.querySelector('#archiveTableBody');
    if(tbody){
      tbody.innerHTML = rows || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:12px;">No vouchers.</td></tr>';
      bindRowEvents();
    }
    const sm = overlay.querySelector('#showMoreArchive');
    if(sm){
      sm.style.display = vouchers.length > limit ? 'inline-block' : 'none';
    }
  }

  function bindRowEvents(){
    overlay.querySelectorAll('[data-aedit]').forEach(b=>b.addEventListener('click',()=>{
      overlay.remove();
      state.archiveView = rec.schoolYear;
      state.wifiEditingId = b.dataset.aedit;
      showView('wifi');
      editWifi(b.dataset.aedit);
    }));
    overlay.querySelectorAll('[data-adel]').forEach(b=>b.addEventListener('click',()=>{
      const id = b.dataset.adel;
      if(!confirm('Delete this voucher?')) return;
      rec.vouchers = (rec.vouchers||[]).filter(v=>v.id!==id);
      saveSyRecords();
      overlay.remove();
      showArchiveModal(idx);
      toast('Voucher deleted');
    }));
  }

  overlay.innerHTML = `<div style="background:var(--surface,#fff);border-radius:12px;max-width:900px;width:100%;max-height:80vh;overflow:auto;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.3);font-family:inherit;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h2 style="margin:0;color:var(--maroon,#800000);font-size:20px;">${escapeHtml(rec.schoolYear)} — WIFI VOUCHERS</h2>
      <button class="btn ghost small" id="closeArchiveModal">Close</button>
    </div>
    <div class="toolbar" style="margin-bottom:12px;">
      <div class="search-box">
        <input type="text" id="archiveSearch" placeholder="Search ID number..." style="padding:8px 12px;border:1px solid var(--border,#ccc);border-radius:6px;font-size:13px;" />
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;background:var(--surface,#fff);border-radius:8px;overflow:hidden;font-size:13px;">
      <thead><tr style="background:var(--maroon,#800000);color:#fff;">
        <th style="padding:10px 12px;text-align:left;">ID No.</th>
        <th style="padding:10px 12px;text-align:left;">Name</th>
        <th style="padding:10px 12px;text-align:left;">Voucher Code</th>
        <th style="padding:10px 12px;text-align:left;">Department</th>
        <th style="padding:10px 12px;text-align:left;">Course</th>
        <th style="padding:10px 12px;text-align:left;">Date</th>
        <th style="padding:10px 12px;text-align:left;width:160px;"></th>
      </tr></thead>
      <tbody id="archiveTableBody"></tbody>
    </table>
    <div style="margin-top:12px;text-align:center;">
      <button class="btn primary small" id="showMoreArchive">Show more</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  renderBody();
  $('#archiveSearch')?.addEventListener('input', (e)=>{
    const q = e.target.value.trim().toLowerCase();
    overlay.querySelectorAll('#archiveTableBody tr[data-idno]').forEach(tr=>{
      tr.style.display = (tr.dataset.idno||'').includes(q) ? '' : 'none';
    });
  });
  $('#closeArchiveModal').addEventListener('click', ()=>overlay.remove());
  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  $('#showMoreArchive')?.addEventListener('click', ()=>{ limit += 15; renderBody(); });
}

function renderSchoolYearRecords(){
  const container = $('#schoolYearRecordsList'); if(!container) return;
  if(!state.schoolYearRecords.length){ container.innerHTML='<p style="color:var(--text-muted);">No school year records yet.</p>'; return; }
  let html='';
  state.schoolYearRecords.forEach((rec, idx)=>{
    const rows = (rec.vouchers||[]).map(v=>`<tr>
      <td>${escapeHtml(v.idNo)}</td>
      <td>${escapeHtml(v.name)}</td>
      <td>${escapeHtml(v.voucher)}</td>
      <td>${escapeHtml(v.dept||'')}</td>
      <td>${escapeHtml(v.course)}</td>
      <td>${formatDate(v.date)}</td>
    </tr>`).join('');
    html += `<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:12px;overflow:hidden;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--surface-2);">
        <span>📄 ${escapeHtml(rec.schoolYear)} (WIFI VOUCHERS)</span>
        <div style="display:flex;gap:6px;">
          <button class="btn primary small" data-syview="${idx}">View</button>
          <button class="btn ghost small" data-sydel="${idx}">Delete</button>
        </div>
      </div>
      <div id="sytable-${idx}" style="display:none;padding:10px;">
        <table><thead><tr><th>ID No.</th><th>Name</th><th>Voucher Code</th><th>Department</th><th>Course</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('[data-syview]').forEach(b=>b.addEventListener('click',()=>{
    const idx = parseInt(b.dataset.syview,10);
    showArchiveModal(idx);
  }));
  container.querySelectorAll('[data-sydel]').forEach(b=>b.addEventListener('click',()=>{
    const idx = parseInt(b.dataset.sydel,10);
    if(!confirm('Delete this school year record?')) return;
    state.schoolYearRecords.splice(idx,1);
    saveSyRecords();
    renderSchoolYearRecords();
    toast('School year record deleted');
  }));
}

function viewSchoolYear(idx){
  const rec = state.schoolYearRecords[idx]; if(!rec) return;
  const url = window.location.href.split(/[?#]/)[0] + '#archive=' + encodeURIComponent(rec.schoolYear);
  window.open(url, 'archivePopup', 'width=900,height=700,resizable=yes,scrollbars=yes');
}

$('#newSchoolYearBtn')?.addEventListener('click', ()=>{
  if(!confirm('Start a new school year? Current vouchers will be archived.')) return;
  const input = prompt('Enter new school year (e.g. 2028-2029):', state.currentSchoolYear);
  if(!input) return;
  const archived = { schoolYear: state.currentSchoolYear, vouchers: [...state.wifiVouchers] };
  state.schoolYearRecords.unshift(archived);
  state.wifiVouchers = [];
  state.currentSchoolYear = input.trim();
  state.archiveView = null;
  saveWifi();
  saveSyRecords();
  showView('wifirecords');
  renderSchoolYearRecords();
  toast('New school year started: ' + state.currentSchoolYear);
});

function updateWifiTitles(){
  const sy = (state.archiveView || state.currentSchoolYear).split('#')[0];
  document.querySelectorAll('#view-wifi .hero h1, #view-wifirecords .hero h1').forEach(h=>{
    if(h.textContent.includes('WIFI VOUCHERS')) h.textContent = 'WIFI VOUCHERS SY ' + sy + (h.textContent.includes('Records') ? ' - Records' : '');
  });
}
function isVoucherActive(v){
  if(!v.date) return false;
  const diff = (Date.now() - new Date(v.date).getTime()) / (1000*60*60*24);
  return diff <= 150;
}
function activeVoucherForId(idNo){
  return state.wifiVouchers.find(v=>v.idNo===idNo && isVoucherActive(v));
}
$('#wIdNo')?.addEventListener('input', ()=>{
  const idNo = $('#wIdNo').value.trim();
  const msg = $('#wIdMsg');
  if(!msg) return;
  const existing = idNo ? activeVoucherForId(idNo) : null;
  if(existing && existing.id !== state.wifiEditingId){
    msg.textContent = 'VOUCHER ALREADY OBTAINED';
    msg.style.color = '#cf222e';
  } else {
    msg.textContent = '';
  }
});
function editWifi(id){
  let v = null;
  if(state.archiveView){
    const rec = state.schoolYearRecords.find(r=>r.schoolYear===state.archiveView);
    v = (rec?.vouchers||[]).find(x=>x.id===id);
  } else {
    v = state.wifiVouchers.find(x=>x.id===id);
  }
  if(!v) return;
  state.wifiEditingId = id;
  showView('wifi');
  $('#wIdNo').value = v.idNo || '';
  $('#wName').value = v.name || '';
  $('#wVoucher').value = v.voucher || '';
  $('#wDept').value = v.dept || 'CCS';
  populateWifiCourses();
  $('#wCourse').value = v.course || '';
  $('#wDate').value = v.date || '';
  const btn = $('#wifiForm')?.querySelector('button[type="submit"]');
  if (btn) btn.textContent = 'Update Voucher';
  const msg = $('#wIdMsg'); if (msg) msg.textContent = '';
}
function cancelWifiEdit(){
  state.wifiEditingId = null;
  const btn = $('#wifiForm')?.querySelector('button[type="submit"]');
  if (btn) btn.textContent = 'Save Voucher';
}
$('#wifiForm')?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const editingId = state.wifiEditingId;
  const v={
    id: editingId || uid(),
    idNo: $('#wIdNo').value.trim(),
    name: $('#wName').value.trim(),
    voucher: $('#wVoucher').value.trim(),
    dept: $('#wDept').value,
    course: $('#wCourse').value,
    date: $('#wDate').value,
    schoolYear: state.currentSchoolYear,
  };
  if(!v.idNo||!v.name||!v.voucher||!v.course||!v.date){ toast('Fill all fields'); return; }
  const existing = activeVoucherForId(v.idNo);
  if(existing && existing.id !== v.id){
    const msg=$('#wIdMsg');
    if(msg){ msg.textContent='VOUCHER ALREADY OBTAINED'; msg.style.color='#cf222e'; }
    toast('Active voucher exists for this ID');
    return;
  }
  if(state.archiveView){
    if(!editingId){ toast('Cannot add in archive view'); return; }
    const rec = state.schoolYearRecords.find(r=>r.schoolYear===state.archiveView);
    if(rec){
      const idx = (rec.vouchers||[]).findIndex(x=>x.id===editingId);
      if(idx>=0) rec.vouchers[idx] = v; else (rec.vouchers||[]).unshift(v);
      saveSyRecords();
    }
    state.archiveView = null;
  } else if(editingId){
    const idx = state.wifiVouchers.findIndex(x=>x.id===editingId);
    if(idx>=0) state.wifiVouchers[idx] = v; else state.wifiVouchers.unshift(v);
  } else {
    state.wifiVouchers.unshift(v);
  }
  if(!state.archiveView) saveWifi();
  state.wifiEditingId = null;
  const btn = $('#wifiForm')?.querySelector('button[type="submit"]');
  if (btn) btn.textContent = 'Save Voucher';
  $('#wifiForm').reset();
  populateWifiCourses();
  const msg=$('#wIdMsg'); if(msg) msg.textContent='';
  toast(editingId ? 'Voucher updated' : 'Voucher saved');
  renderWifi();
});
async function initApp(){ await load(); let params = new URLSearchParams(window.location.search); if(!params.get('archive') && window.location.hash){ params = new URLSearchParams(window.location.hash.replace(/^#/,'')); } state.archiveView = params.get('archive'); renderDashboard(); updateWifiTitles(); if(state.archiveView){ showView('wifirecords'); toast('Viewing ' + state.archiveView); } else { showView('dashboard'); } updateNotifBadge(); scheduleNotifications(); }

function scheduleNotifications(){
  if(!('Notification' in window)) return;
  const notified = new Set(JSON.parse(localStorage.getItem('notifiedEvents')||'[]'));
  const notify = (a)=>{
    if(notified.has(a.id)) return;
    if(Notification.permission==='granted'){
      try { new Notification('Upcoming Event in 1 hour', { body: a.nameOfActivity + ' at ' + formatTime(a.timeStart) + (a.venue ? ' — ' + a.venue : '') }); } catch(e){}
    }
    toast('Reminder: ' + a.nameOfActivity + ' starts in 1 hour');
    notified.add(a.id);
    localStorage.setItem('notifiedEvents', JSON.stringify([...notified]));
  };
  if(Notification.permission==='default') Notification.requestPermission();
  state.activities.forEach(a=>{
    if(a.status!=='Upcoming') return;
    if(!a.dateOfActivity || !a.timeStart) return;
    const dt = new Date(a.dateOfActivity + 'T' + a.timeStart);
    const eventTime = dt.getTime();
    if(isNaN(eventTime)) return;
    if(eventTime <= Date.now()) return;
    if(notified.has(a.id)) return;
    const notifyAt = eventTime - 60*60*1000;
    const delay = notifyAt - Date.now();
    if(delay <= 0){
      // less than 1 hour away
      notify(a);
    } else if(delay <= 7*24*60*60*1000){
      setTimeout(()=>notify(a), delay);
    }
  });
  if(!window._notifInterval){
    window._notifInterval = setInterval(()=>scheduleNotifications(), 60000);
  }
}
const loginScreen = $('#loginScreen');
const appArea = $('#appArea');
function showApp(){ loginScreen.style.display='none'; appArea.style.display='block'; if(!window._inited){ window._inited=true; initApp(); } }
function showLogin(){ loginScreen.style.display='flex'; appArea.style.display='none'; }
$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const u = $('#loginUser').value.trim();
  const p = $('#loginPass').value;
  if (u === 'sysad' && p === 'eXecute022711') {
    sessionStorage.setItem('loggedIn','1');
    showApp();
  } else {
    $('#loginError').textContent = 'Invalid username or password';
  }
});
$('#logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('loggedIn');
  showLogin();
});
if (sessionStorage.getItem('loggedIn') === '1') showApp(); else showLogin();
