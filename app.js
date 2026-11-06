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
  theme: localStorage.getItem('theme') || 'light',
  currentDetail: null,
  formEquipment: [],
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

async function load() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('activities').select('*').order('createdAt', { ascending: false });
      if (error) throw error;
      state.activities = (data || []).map(a => ({ ...a, status: a.status || 'Upcoming', timeStart: a.timeStart || a.time || '', timeEnd: a.timeEnd || '', stage: 1, compliance: a.compliance || null, equipment: a.equipment || [] }));
      return;
    } catch (e) { console.error(e); }
  }
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    state.activities = arr.map(a => ({ ...a, status: a.status || 'Upcoming', timeStart: a.timeStart || a.time || '', timeEnd: a.timeEnd || '', stage: 1 }));
  } catch { state.activities = []; }
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

function applyTheme(){
  if(state.theme==='dark') document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.removeAttribute('data-theme');
}
$('#themeToggle').addEventListener('click',()=>{ state.theme = state.theme==='dark'?'light':'dark'; localStorage.setItem('theme',state.theme); applyTheme(); });
applyTheme();

function showView(name){
  $$('.view').forEach(v=>v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active');
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  if(name==='dashboard') renderDashboard();
  if(name==='list') renderList();
  if(name==='records') renderRecords();
}
$$('.nav-btn, [data-view]').forEach(el=>{
  el.addEventListener('click',()=>{ const v=el.getAttribute('data-view'); if(v) showView(v); });
});

$('#objectives').addEventListener('input',(e)=>{ $('#charCount').textContent=e.target.value.length; });

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
      requirements: $('#requirements').value.trim(),
      reviewer: $('#reviewer').value.trim(),
      recommendation: $('#recommendation').value,
      notes: $('#compNotes').value.trim(),
      date: new Date().toISOString(),
    },
    equipment: state.formEquipment.length ? [...state.formEquipment] : (existing?.equipment || []),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if(existing){ const idx=state.activities.findIndex(a=>a.id===id); state.activities[idx]=activity; toast('Application updated'); }
  else { state.activities.unshift(activity); toast('Application submitted'); }
  await save();
  resetForm();
  btn.disabled=false; text.hidden=false; spinner.hidden=true;
  showView('list');
});

function resetForm(){
  $('#activityForm').reset();
  $('#activityId').value='';
  $('#charCount').textContent='0';
  $('#status').value='Upcoming';
  state.formEquipment=[];
  renderFormEquip();
  $$('.error').forEach(e=>e.textContent='');
}

$('#resetBtn').addEventListener('click',()=>{ resetForm(); toast('Form reset'); });
$('#newFromList').addEventListener('click',()=>{ resetForm(); showView('form'); });

function renderFormEquip(){
  const tbody=$('#f_eqBody'); if(!tbody) return;
  tbody.innerHTML='';
  state.formEquipment.forEach((e,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${escapeHtml(e.item)}</td><td>${e.qty}</td><td>${escapeHtml(e.borrowedBy)}</td><td>${formatDate(e.dateBorrowed)}</td><td>${e.returned?'Yes':'No'}</td><td><button type="button" class="btn ghost small" data-feq="${i}" style="padding:4px 8px;">✕</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-feq]').forEach(b=>b.addEventListener('click',()=>{
    state.formEquipment.splice(+b.dataset.feq,1); renderFormEquip();
  }));
}
$('#f_addEq').addEventListener('click',()=>{
  const item=$('#f_eqItem').value.trim(); const qty=parseInt($('#f_eqQty').value)||1;
  const by=$('#f_eqBy').value.trim(); const date=$('#f_eqDate').value;
  if(!item){ toast('Enter item name'); return; }
  state.formEquipment.push({ id:uid(), item, qty, borrowedBy:by, dateBorrowed:date, returned:false });
  $('#f_eqItem').value=''; $('#f_eqQty').value=''; $('#f_eqBy').value=''; $('#f_eqDate').value='';
  renderFormEquip();
});

function populateFilters(){}
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
        <span>📅 Event: ${formatDate(a.dateOfActivity)} ${a.timeStart?'⏰ '+a.timeStart+(a.timeEnd?' - '+a.timeEnd:''):''}</span>
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
  $('#requirements').value=a.compliance?.requirements||'';
  $('#reviewer').value=a.compliance?.reviewer||'';
  $('#recommendation').value=a.compliance?.recommendation||'';
  $('#compNotes').value=a.compliance?.notes||'';
  state.formEquipment=[...(a.equipment||[])];
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

function renderDetail(a){
  const mc=$('#modalContent');
  const stageObj=STAGES.find(s=>s.id===a.stage);
  let stepperHtml='<div class="stepper">';
  STAGES.forEach(s=>{
    const cls = s.id < a.stage ? 'done' : (s.id===a.stage ? 'current' : '');
    stepperHtml += `<div class="step ${cls}"><div class="step-num">${s.id}</div><div class="step-label">${s.name}</div><span class="step-line"></span></div>`;
  });
  stepperHtml+='</div>';

  let html = `<h2 style="font-family:'Playfair Display',serif;color:var(--maroon);font-size:24px;margin-bottom:4px;">${escapeHtml(a.nameOfActivity)}</h2>
  ${stepperHtml}
  <div class="detail-section">
    <h3>Application Details</h3>
    <div class="detail-row"><span class="k">Date of Application</span><span class="v">${formatDate(a.dateOfApplication)}</span></div>
    <div class="detail-row"><span class="k">Name of Activity</span><span class="v">${escapeHtml(a.nameOfActivity)}</span></div>
    <div class="detail-row"><span class="k">Date of Activity</span><span class="v">${formatDate(a.dateOfActivity)} ${a.timeStart?('at '+a.timeStart+(a.timeEnd?' - '+a.timeEnd:'')):''}</span></div>
    <div class="detail-row"><span class="k">Organizer / Class</span><span class="v">${escapeHtml(a.organizer)}</span></div>
    <div class="detail-row"><span class="k">Venue</span><span class="v">${escapeHtml(a.venue)}</span></div>
    <div class="detail-row"><span class="k">Start Time</span><span class="v">${a.timeStart||'—'}</span></div>
    <div class="detail-row"><span class="k">End Time</span><span class="v">${a.timeEnd||'—'}</span></div>
    <div class="detail-row"><span class="k">Requested by</span><span class="v">${escapeHtml(a.requestedBy||'—')}</span></div>
    <div class="detail-row"><span class="k">Noted by</span><span class="v">${escapeHtml(a.notedBy||'—')}</span></div>
    <div class="detail-row"><span class="k">Objectives</span><span class="v">${escapeHtml(a.objectives)}</span></div>
    <div class="detail-row"><span class="k">Compliance Requirements</span><span class="v">${escapeHtml(a.compliance?.requirements||'—')}</span></div>
    <div class="detail-row"><span class="k">Reviewed by</span><span class="v">${escapeHtml(a.compliance?.reviewer||'—')}</span></div>
    <div class="detail-row"><span class="k">Recommendation</span><span class="v">${escapeHtml(a.compliance?.recommendation||'—')}</span></div>
    <div class="detail-row"><span class="k">Compliance Notes</span><span class="v">${escapeHtml(a.compliance?.notes||'—')}</span></div>
    <div class="detail-row"><span class="k">Event Status</span><span class="v">${escapeHtml(a.status)}${a.statusNote?' — '+escapeHtml(a.statusNote):''}</span></div>
    <div class="detail-row"><span class="k">Equipment Borrowed</span><span class="v">${(a.equipment||[]).length? a.equipment.map(e=>escapeHtml(e.item)+' (x'+e.qty+')'+(e.returned?' ✔':'')).join(', ') : '—'}</span></div>
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
  const grid=$('#statsGrid');
  grid.innerHTML=`
    <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${total}</div><div class="stat-label">Total Applications</div></div>
    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${completed}</div><div class="stat-label">Completed</div></div>
    <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-value">${upcoming}</div><div class="stat-label">Upcoming Events</div></div>
    <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-value">${total-completed}</div><div class="stat-label">In Progress</div></div>
  `;
  const recent=state.activities.slice(0,5);
  const rl=$('#recentList'); rl.innerHTML='';
  if(recent.length===0){ rl.innerHTML='<li class="recent-item"><div class="recent-info"><div class="recent-title">No applications yet</div><div class="recent-meta">Create your first one!</div></div></li>'; }
  else {
    recent.forEach(a=>{
      const li=document.createElement('li'); li.className='recent-item';
      li.innerHTML=`<span class="recent-dot"></span><div class="recent-info"><div class="recent-title">${escapeHtml(a.nameOfActivity)}</div><div class="recent-meta">${formatDate(a.dateOfActivity)} ${a.timeStart?'⏰ '+a.timeStart+(a.timeEnd?' - '+a.timeEnd:''):''}</div></div>`;
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
  list.sort((a,b)=>new Date(b.dateOfActivity)-new Date(a.dateOfActivity));

  container.innerHTML='';
  if(list.length===0){ empty.hidden=false; return; }
  empty.hidden=true;

  const groups={};
  list.forEach(a=>{ const k=monthKey(a.dateOfActivity)||'Unknown'; (groups[k]=groups[k]||[]).push(a); });
  Object.keys(groups).sort().reverse().forEach(key=>{
    const header=document.createElement('div');
    header.style.cssText='margin:18px 0 8px;font-family:Playfair Display,serif;color:var(--maroon);font-size:20px;border-bottom:2px solid var(--border);padding-bottom:6px;';
    header.textContent = key==='Unknown'?'Unknown Date':monthLabel(key)+' ('+groups[key].length+')';
    container.appendChild(header);
    groups[key].forEach(a=>{
      const stageObj=STAGES.find(s=>s.id===a.stage);
      const card=document.createElement('div');
      card.className='detail-section';
      card.style.marginBottom='16px';
      card.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
          <h3 style="margin:0;">${escapeHtml(a.nameOfActivity)}</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span class="badge badge-status ${a.status==='Completed'?'completed':''}">${escapeHtml(a.status)}</span>
            <button class="btn ghost small" data-print="${a.id}">Print Record</button>
          </div>
        </div>
        <div class="detail-row"><span class="k">Date of Application</span><span class="v">${formatDate(a.dateOfApplication)}</span></div>
        <div class="detail-row"><span class="k">Date of Activity</span><span class="v">${formatDate(a.dateOfActivity)} ${a.timeStart?'at '+a.timeStart+(a.timeEnd?' - '+a.timeEnd:''):''}</span></div>
        <div class="detail-row"><span class="k">Organizer / Class</span><span class="v">${escapeHtml(a.organizer)}</span></div>
        <div class="detail-row"><span class="k">Venue</span><span class="v">${escapeHtml(a.venue)}</span></div>
        <div class="detail-row"><span class="k">Start Time</span><span class="v">${a.timeStart||'—'}</span></div>
        <div class="detail-row"><span class="k">End Time</span><span class="v">${a.timeEnd||'—'}</span></div>
        <div class="detail-row"><span class="k">Requested by</span><span class="v">${escapeHtml(a.requestedBy||'—')}</span></div>
        <div class="detail-row"><span class="k">Noted by</span><span class="v">${escapeHtml(a.notedBy||'—')}</span></div>
        <div class="detail-row"><span class="k">Objectives</span><span class="v">${escapeHtml(a.objectives)}</span></div>
        <div class="detail-row"><span class="k">Compliance Review</span><span class="v">${a.compliance? (escapeHtml(a.compliance.recommendation||'—') + (a.compliance.reviewer?' by '+escapeHtml(a.compliance.reviewer):'')) : '—'}</span></div>
        <div class="detail-row"><span class="k">Event Status</span><span class="v">${escapeHtml(a.status)}${a.statusNote?' — '+escapeHtml(a.statusNote):''}</span></div>
        <div class="detail-row"><span class="k">Equipment Borrowed</span><span class="v">${(a.equipment||[]).length? a.equipment.map(e=>escapeHtml(e.item)+' (x'+e.qty+')').join(', ') : '—'}</span></div>
      `;
      container.appendChild(card);
    });
  });
  container.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>printRecord(b.dataset.print)));
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
    <tr><td class="k">Date of Activity</td><td>${formatDate(a.dateOfActivity)} ${a.timeStart?('at '+a.timeStart+(a.timeEnd?' - '+a.timeEnd:'')):''}</td></tr>
    <tr><td class="k">Organizer / Class</td><td>${escapeHtml(a.organizer)}</td></tr>
    <tr><td class="k">Venue</td><td>${escapeHtml(a.venue)}</td></tr>
    <tr><td class="k">Start Time</td><td>${a.timeStart||'—'}</td></tr>
    <tr><td class="k">End Time</td><td>${a.timeEnd||'—'}</td></tr>
    <tr><td class="k">Requested by</td><td>${escapeHtml(a.requestedBy||'—')}</td></tr>
    <tr><td class="k">Noted by</td><td>${escapeHtml(a.notedBy||'—')}</td></tr>
    <tr><td class="k">Objectives</td><td>${escapeHtml(a.objectives)}</td></tr>
    <tr><td class="k">Event Status</td><td>${escapeHtml(a.status)}${a.statusNote?' — '+escapeHtml(a.statusNote):''}</td></tr>
  </table>
  <h2>Step 2 — Compliance Review</h2>
  <table>
    <tr><td class="k">Requirements</td><td>${escapeHtml(a.compliance?.requirements||'—')}</td></tr>
    <tr><td class="k">Reviewed By</td><td>${escapeHtml(a.compliance?.reviewer||'—')}</td></tr>
    <tr><td class="k">Recommendation</td><td>${escapeHtml(a.compliance?.recommendation||'—')}</td></tr>
    <tr><td class="k">Notes</td><td>${escapeHtml(a.compliance?.notes||'—')}</td></tr>
  </table>
  <h2>Step 3 — Equipment Borrowed</h2>
  <table>
    <tr><th>Item</th><th>Qty</th><th>Borrowed By</th><th>Date Borrowed</th><th>Returned</th></tr>
    ${(a.equipment||[]).map(e=>`<tr><td>${escapeHtml(e.item)}</td><td>${e.qty}</td><td>${escapeHtml(e.borrowedBy)}</td><td>${formatDate(e.dateBorrowed)}</td><td>${e.returned?'Yes':'No'}</td></tr>`).join('')||'<tr><td colspan="5">None</td></tr>'}
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
async function initApp(){ await load(); seed(); renderDashboard(); showView('dashboard'); }
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
