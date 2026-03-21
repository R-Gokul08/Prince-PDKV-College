// ================================================================
// Teacher.js — PDKV Teacher Portal
// Login    → teacher_credentials
// Profile  → teacher_information (image → image_files/Teacher_images)
// Rooms    → classrooms
// Sessions → attendance_sessions + attendance_records
// Summary  → attendance_information (auto via DB trigger)
// Session persists until logout (sessionStorage)
// ================================================================
import { supabase }                               from './supabaseClient.js'
import { initStickyHeader, initHamburger, initScrollAnimations,
         showToast, initAuth, openAuthModal, logoutUser,
         getCurrentUser, initRipple, initPageTransitions } from './shared.js'

// ── constants ─────────────────────────────────────────────────
const BUCKET   = 'image_files'
const FOLDER   = 'Teacher_images'
const SESS_KEY = 'tc_regno'

const DEPTS = [
  'Computer Science & Engineering','Artificial Intelligence & Data Science',
  'Cyber Security','Electronics & Communication Engineering',
  'Electrical & Electronics Engineering','Mechanical Engineering',
  'Civil Engineering','Mathematics','Physics','Chemistry','English',
  'Master of Business Administration','M.Tech Computer Science & Engineering','M.Tech VLSI Design'
]
const DESIGS = [
  'Professor & Head','Professor','Associate Professor','Assistant Professor',
  'Senior Lecturer','Lecturer','Lab Instructor','Teaching Assistant'
]

// ── state ─────────────────────────────────────────────────────
let _regno     = null
let _profile   = null
let _students  = []          // all students
let _rooms     = []          // all classrooms
let _selStus   = new Set()   // selected students for create/edit
let _attState  = {}          // regno→'present'|'absent'|null  (during marking)
let _attStus   = []          // students list during marking

// ── boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader(); initHamburger(); initPageTransitions(); initRipple()
  await initAuth()
  document.getElementById('headerLoginBtn')?.addEventListener('click', ()=>openAuthModal('login'))
  document.querySelectorAll('.global-header-logout').forEach(b=>b.addEventListener('click',()=>logoutUser()))

  const saved = sessionStorage.getItem(SESS_KEY)
  if (saved) { _regno=saved; await loadPortal(saved) }
  else showSec('login')

  document.getElementById('loginForm')?.addEventListener('submit', handleLogin)
  initFadeUp()
})

// ── helpers ───────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function showSec(id) {
  ['login','loading','setup','profile'].forEach(s=>{
    const el=document.getElementById('sec'+s.charAt(0).toUpperCase()+s.slice(1))
    if(el) el.style.display=s===id?'block':'none'
  })
  setTimeout(initFadeUp,80)
}

function initFadeUp() {
  const obs=new IntersectionObserver((entries)=>{
    entries.forEach((e,i)=>{
      if(e.isIntersecting){setTimeout(()=>e.target.classList.add('vis'),i*75);obs.unobserve(e.target)}
    })
  },{threshold:.07,rootMargin:'0px 0px -18px 0px'})
  document.querySelectorAll('.tc-up:not(.vis)').forEach(el=>obs.observe(el))
}

// ── login ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault()
  const regno = document.getElementById('inRegno')?.value?.trim().toUpperCase()
  const pass  = document.getElementById('inPass')?.value
  if (!regno||!pass) { showMsg('Enter Register No. & Password.','err'); return }

  const btn=document.getElementById('loginBtn')
  btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Signing In…'
  hideMsg()

  const { data, error } = await supabase.from('teacher_credentials')
    .select('*').eq('register_no',regno).maybeSingle()

  if (error)                  { showMsg('Database error.','err');             reset(btn); return }
  if (!data)                  { showMsg('Register number not found.','err'); reset(btn); return }
  if (data.password !== pass) { showMsg('Incorrect password.','err');         reset(btn); return }

  sessionStorage.setItem(SESS_KEY, regno)
  _regno = regno
  showToast(`Welcome, Teacher ${regno}!`,'success')
  await loadPortal(regno)
  reset(btn)
}

function showMsg(txt,type='err'){
  const el=document.getElementById('loginMsg');if(!el)return
  el.className=`tc-msg tc-msg-${type}`
  el.innerHTML=`<i class="fas fa-${type==='err'?'exclamation-circle':'check-circle'}"></i> ${txt}`
  el.style.display='flex'
}
function hideMsg(){ const el=document.getElementById('loginMsg');if(el)el.style.display='none' }
function reset(b){ b.disabled=false;b.innerHTML='<i class="fas fa-sign-in-alt"></i> Sign In' }

window.tcLogout = () => {
  sessionStorage.removeItem(SESS_KEY)
  _regno=null;_profile=null
  showSec('login')
  showToast('Logged out.','info')
}

// ── upload ────────────────────────────────────────────────────
async function uploadImg(fileId, key) {
  const inp=document.getElementById(fileId)
  const f=inp?.files?.[0]; if(!f) return null
  const ext=f.name.split('.').pop()
  const path=`${FOLDER}/${key}_${Date.now()}.${ext}`
  const {error}=await supabase.storage.from(BUCKET).upload(path,f,{upsert:true})
  if(error){showToast('Image upload failed: '+error.message,'error');return null}
  const {data:{publicUrl}}=supabase.storage.from(BUCKET).getPublicUrl(path)
  return publicUrl
}

function bindPrev(fId,wId,iId,rId){
  document.getElementById(fId)?.addEventListener('change',()=>{
    const f=document.getElementById(fId).files[0];if(!f)return
    const r=new FileReader();r.onload=e=>{document.getElementById(iId).src=e.target.result;document.getElementById(wId).classList.add('show')}
    r.readAsDataURL(f)
  })
  document.getElementById(rId)?.addEventListener('click',()=>{
    document.getElementById(fId).value='';document.getElementById(iId).src='';document.getElementById(wId).classList.remove('show')
  })
}

// ── load portal ───────────────────────────────────────────────
async function loadPortal(regno) {
  showSec('loading')
  const {data:t}=await supabase.from('teacher_information').select('*').ilike('register_no',regno).maybeSingle()
  if(!t){showSec('setup');renderSetup(regno)}
  else{_profile=t;showSec('profile');await renderProfile(t)}
}

// ── SETUP FORM ────────────────────────────────────────────────
function renderSetup(regno) {
  const c=document.getElementById('secSetup');if(!c)return
  const dO=DEPTS.map(d=>`<option>${d}</option>`).join('')
  const dsO=DESIGS.map(d=>`<option>${d}</option>`).join('')

  c.innerHTML=`
  <div class="tc-wrap">
   <div class="tc-setup-outer">
    <div class="tc-setup-hdr">
      <div class="tc-setup-icon"><i class="fas fa-chalkboard-teacher"></i></div>
      <h2 class="tc-setup-h2">Complete Your Profile</h2>
      <p class="tc-setup-sub">Hi <strong style="color:var(--tc-amber)">${esc(regno)}</strong>! Fill in your details to activate your portal.</p>
    </div>
    <div class="tc-glass tc-setup-card">
      <form id="setupForm" novalidate>
        <div class="tc-grid">
          <div class="tc-sdiv"><span class="tc-sdiv-lbl"><i class="fas fa-user"></i> Personal</span><div class="tc-sdiv-line"></div></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-id-badge"></i> Register No</label><input class="tc-input" value="${esc(regno)}" readonly/></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-user"></i> Full Name *</label><input id="t_name" class="tc-input" placeholder="Dr. / Mr. / Ms. Full Name" required/></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-envelope"></i> Email *</label><input id="t_email" type="email" class="tc-input" placeholder="your@email.com" required/></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-phone"></i> Phone *</label><input id="t_phone" type="tel" class="tc-input" placeholder="+91 99999 99999" required/></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-venus-mars"></i> Gender *</label>
            <select id="t_gender" class="tc-select" required><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-calendar-alt"></i> Date of Joining</label><input id="t_joining" type="date" class="tc-input"/></div>

          <div class="tc-sdiv"><span class="tc-sdiv-lbl"><i class="fas fa-graduation-cap"></i> Professional</span><div class="tc-sdiv-line"></div></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-building"></i> Department *</label>
            <select id="t_dept" class="tc-select" required><option value="">Select</option>${dO}</select></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-user-tie"></i> Designation *</label>
            <select id="t_desig" class="tc-select" required><option value="">Select</option>${dsO}</select></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-award"></i> Qualification *</label><input id="t_qual" class="tc-input" placeholder="e.g. M.E., Ph.D (CSE)" required/></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-briefcase"></i> Experience</label><input id="t_exp" class="tc-input" placeholder="e.g. 8 Years"/></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-flask"></i> Specialization</label><input id="t_spec" class="tc-input" placeholder="e.g. Machine Learning"/></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-hashtag"></i> Employee ID</label><input id="t_empid" class="tc-input" placeholder="e.g. PDKV-TCH-001"/></div>
          <div class="tc-fg tc-full"><label class="tc-label"><i class="fas fa-book-open"></i> Subjects Handling</label><input id="t_subjects" class="tc-input" placeholder="e.g. Data Structures, DBMS, OS  (comma separated)"/></div>

          <div class="tc-sdiv"><span class="tc-sdiv-lbl"><i class="fas fa-map-marker-alt"></i> Address &amp; Photo</span><div class="tc-sdiv-line"></div></div>
          <div class="tc-fg tc-full"><label class="tc-label"><i class="fas fa-home"></i> Address</label><textarea id="t_address" class="tc-textarea" placeholder="Your residential address"></textarea></div>
          <div class="tc-fg tc-full">
            <label class="tc-label"><i class="fas fa-camera"></i> Profile Photo <span style="opacity:.45;font-weight:400">(optional)</span></label>
            <div class="tc-upload" id="tUpArea"><input type="file" id="t_img" accept="image/*"/>
              <span class="tc-upload-icon"><i class="fas fa-cloud-upload-alt"></i></span>
              <div class="tc-upload-text"><strong>Click or drag &amp; drop</strong><br><small>JPG, PNG — max 5 MB</small></div>
            </div>
            <div class="tc-img-pre" id="tImgPre"><img id="tImgPreImg" src="" alt=""/><button type="button" class="tc-img-rm" id="tImgRm"><i class="fas fa-times"></i></button></div>
          </div>
        </div>
        <button type="submit" class="tc-btn tc-btn-primary tc-btn-full" id="setupBtn" style="margin-top:8px">
          <i class="fas fa-save"></i> Save My Profile
        </button>
      </form>
    </div>
   </div>
  </div>`

  bindPrev('t_img','tImgPre','tImgPreImg','tImgRm')
  setTimeout(initFadeUp,60)

  document.getElementById('setupForm').addEventListener('submit', async e=>{
    e.preventDefault()
    const btn=document.getElementById('setupBtn')
    btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…'

    const g=id=>document.getElementById(id)?.value?.trim()||null
    const name=g('t_name'),email=g('t_email'),phone=g('t_phone'),gender=g('t_gender'),dept=g('t_dept'),desig=g('t_desig'),qual=g('t_qual')
    if(!name||!email||!phone||!gender||!dept||!desig||!qual){
      showToast('Fill all required fields (*)','warning');btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> Save My Profile';return
    }

    const imgUrl=await uploadImg('t_img',regno)
    const payload={register_no:regno,name,email,phone,gender,department:dept,designation:desig,qualification:qual,
      experience:g('t_exp'),specialization:g('t_spec'),employee_id:g('t_empid'),subjects:g('t_subjects'),
      joining_date:g('t_joining'),address:g('t_address'),image_url:imgUrl||null,updated_at:new Date().toISOString()}

    const {error}=await supabase.from('teacher_information').upsert(payload,{onConflict:'register_no'})
    btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> Save My Profile'
    if(error){showToast('Failed: '+error.message,'error');return}

    showToast('Profile saved! 🎉','success')
    const {data:t}=await supabase.from('teacher_information').select('*').ilike('register_no',regno).maybeSingle()
    if(t){_profile=t;showSec('profile');await renderProfile(t)}
  })
}

// ── RENDER PROFILE ────────────────────────────────────────────
async function renderProfile(t) {
  const c=document.getElementById('secProfile');if(!c)return

  const photo=t.image_url||`https://ui-avatars.com/api/?name=${encodeURIComponent(t.name||t.register_no)}&background=f59e0b&color=06080f&size=200&bold=true`
  const subjs=t.subjects?t.subjects.split(',').map(s=>s.trim()).filter(Boolean):[]

  c.innerHTML=`
  <div class="tc-wrap">
   <div>
    <!-- Hero -->
    <div class="tc-glass tc-prof-hero tc-up">
      <div class="tc-av-wrap">
        <img src="${photo}" alt="${esc(t.name)}" class="tc-av"/>
        <div class="tc-av-ring"></div>
      </div>
      <div class="tc-prof-info">
        <div class="tc-prof-name">${esc(t.name||t.register_no)}</div>
        <div class="tc-prof-desig">${esc(t.designation||'')}</div>
        <div class="tc-prof-dept">${t.department?'Dept. of '+esc(t.department):''}</div>
        <div class="tc-prof-badges">
          <span class="tc-badge tcb-amber"><i class="fas fa-id-badge"></i> ${esc(t.register_no)}</span>
          ${t.qualification?`<span class="tc-badge tcb-blue"><i class="fas fa-graduation-cap"></i> ${esc(t.qualification)}</span>`:''}
          ${t.experience?`<span class="tc-badge tcb-green"><i class="fas fa-briefcase"></i> ${esc(t.experience)}</span>`:''}
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="tc-prof-actions tc-up">
      <button class="tc-btn tc-btn-ghost" onclick="tcEdit()"><i class="fas fa-edit"></i> Edit Profile</button>
      <button class="tc-btn tc-btn-danger" onclick="tcLogout()"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
    </div>

    <!-- Info grid -->
    <div class="tc-info-grid tc-up">
      ${tci('fas fa-envelope','tci-amber','Email',t.email)}
      ${tci('fas fa-phone','tci-blue','Phone',t.phone)}
      ${t.gender?tci('fas fa-venus-mars','tci-violet','Gender',t.gender):''}
      ${t.joining_date?tci('fas fa-calendar-alt','tci-green','Date of Joining',t.joining_date):''}
      ${t.employee_id?tci('fas fa-hashtag','tci-amber','Employee ID',t.employee_id):''}
      ${t.specialization?tci('fas fa-flask','tci-teal','Specialization',t.specialization):''}
      ${t.experience?tci('fas fa-briefcase','tci-blue','Experience',t.experience):''}
      ${t.address?tci('fas fa-map-marker-alt','tci-red','Address',t.address):''}
    </div>

    ${subjs.length?`
    <div class="tc-glass tc-subj-wrap tc-up">
      <div class="tc-subj-title"><i class="fas fa-book-open"></i> Subjects Handling</div>
      <div class="tc-subj-chips">
        ${subjs.map((s,i)=>`<span class="tc-subj-chip" style="animation-delay:${i*.06}s"><i class="fas fa-book"></i> ${esc(s)}</span>`).join('')}
      </div>
    </div>`:''}

    <!-- Attendance manager -->
    <div id="attMgr" class="tc-up"></div>
   </div>
  </div>`

  setTimeout(initFadeUp,80)

  // Preload data, then render attendance manager
  const [stuRes, rmRes] = await Promise.all([
    supabase.from('student_information').select('register_no,name,year,department').order('year').order('department').order('name'),
    supabase.from('classrooms').select('*').order('created_at',{ascending:false})
  ])
  _students = stuRes.data||[]
  _rooms    = rmRes.data||[]
  renderAttMgr()
}

function tci(icon,cls,label,val){
  if(!val) return ''
  return `<div class="tc-glass tc-info-card">
    <div class="tc-info-icon ${cls}"><i class="${icon}"></i></div>
    <div><div class="tc-info-lbl">${label}</div><div class="tc-info-val">${esc(val)}</div></div>
  </div>`
}

window.tcEdit = ()=>{ if(_regno){showSec('setup');renderSetup(_regno)} }

// ── ATTENDANCE MANAGER ────────────────────────────────────────
function renderAttMgr() {
  const c=document.getElementById('attMgr');if(!c)return
  const mine=_rooms.filter(r=>r.teacher_regno===_regno)

  c.innerHTML=`
  <div style="margin-top:32px">
    <div class="tc-att-hdr"><i class="fas fa-calendar-check"></i> Attendance Manager</div>
    <div class="tc-tabs">
      <button class="tc-tab act" onclick="tcTab('my',this)"><i class="fas fa-door-open"></i> My Classrooms</button>
      <button class="tc-tab" onclick="tcTab('all',this)"><i class="fas fa-list"></i> All Classrooms</button>
    </div>

    <div id="panelMy" class="tc-panel act">
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-bottom:18px">
        <button class="tc-btn tc-btn-primary tc-btn-sm" onclick="openCreate()"><i class="fas fa-plus"></i> Create Classroom</button>
      </div>
      <div class="tc-cls-grid" id="gridMy">${clsGrid(mine,true)}</div>
    </div>

    <div id="panelAll" class="tc-panel">
      <div class="tc-cls-grid" id="gridAll">${clsGrid(_rooms,false)}</div>
    </div>
  </div>`
}

function clsGrid(rooms,mine){
  if(!rooms.length) return `<div class="tc-empty" style="grid-column:1/-1">
    <div class="tc-empty-ico">🏫</div>
    <div class="tc-empty-title">${mine?'No Classrooms Yet':'No Classrooms Found'}</div>
    <div class="tc-empty-sub">${mine?'Click "Create Classroom" to start.':'No classrooms created yet.'}</div>
  </div>`

  let html=rooms.map(r=>`
    <div class="tc-glass tc-cls-card" onclick="openRoom('${r.id}')">
      <div class="tc-cls-ico"><i class="fas fa-door-open"></i></div>
      <div class="tc-cls-name">${esc(r.class_name)}</div>
      <div class="tc-cls-meta">
        <div><i class="fas fa-book"></i> ${esc(r.subject||'—')}</div>
        <div><i class="fas fa-user-tie"></i> ${esc(r.teacher_name||r.teacher_regno)}</div>
        ${r.department?`<div><i class="fas fa-building"></i> ${esc(r.department)}${r.year?' · Year '+r.year:''}</div>`:''}
      </div>
      <span class="tc-cls-count"><i class="fas fa-users"></i> ${(r.student_regnos||[]).length} Students</span>
    </div>`).join('')

  if(mine) html+=`<button class="tc-create-btn" onclick="openCreate()">
    <i class="fas fa-plus-circle"></i><span>Create New Classroom</span>
  </button>`
  return html
}

window.tcTab = (t,btn)=>{
  document.querySelectorAll('.tc-tab').forEach(b=>b.classList.remove('act'))
  btn.classList.add('act')
  document.getElementById('panelMy').classList.toggle('act',t==='my')
  document.getElementById('panelAll').classList.toggle('act',t==='all')
}

// refresh grid helper
function refreshGrids(){
  const mine=_rooms.filter(r=>r.teacher_regno===_regno)
  const gm=document.getElementById('gridMy');if(gm) gm.innerHTML=clsGrid(mine,true)
  const ga=document.getElementById('gridAll');if(ga) ga.innerHTML=clsGrid(_rooms,false)
}

// ── modal helper ──────────────────────────────────────────────
function modal(html){ document.getElementById('tcModals').innerHTML=html }
function closeModal(id){ document.getElementById(id)?.classList.remove('open') }
window.closeM=closeModal

// ── GROUP STUDENTS ────────────────────────────────────────────
function groupStudents(stus){
  const g={}
  stus.forEach(s=>{
    const y=s.year||'Unassigned', d=s.department||'Unknown'
    if(!g[y]) g[y]={}
    if(!g[y][d]) g[y][d]=[]
    g[y][d].push(s)
  })
  return g
}

function sfx(n){ return{1:'st',2:'nd',3:'rd',4:'th'}[n]||'th' }

function stuSelectorHTML(groups,filter=''){
  const years=Object.keys(groups).map(Number).sort((a,b)=>a-b)
  if(!years.length) return `<div style="text-align:center;padding:22px;color:var(--tc-muted)">No students in system.</div>`

  return years.map(yr=>{
    const depts=Object.keys(groups[yr]).sort()
    const dhtml=depts.map(d=>{
      const stus=groups[yr][d].filter(s=>{
        if(!filter) return true
        const q=filter.toLowerCase()
        return (s.name||'').toLowerCase().includes(q)||(s.register_no||'').toLowerCase().includes(q)
      })
      if(!stus.length) return ''
      return `<div class="tc-dept-block">
        <div class="tc-dept-title">
          <span><i class="fas fa-building"></i> ${esc(d)}</span>
          <button type="button" class="tc-dept-sall" onclick="selDept(${yr},'${encodeURIComponent(d)}',this)">${stus.every(s=>_selStus.has(s.register_no))?'Deselect All':'Select All'}</button>
        </div>
        <div>${stus.map(s=>`
          <div class="tc-stu-row${_selStus.has(s.register_no)?' sel':''}" id="row-${s.register_no}" onclick="selStu('${s.register_no}')">
            <div><div class="tc-stu-name">${esc(s.name||'—')}</div><div class="tc-stu-meta">${s.register_no} · ${esc(d)}</div></div>
            <div class="tc-stu-chk" id="chk-${s.register_no}">${_selStus.has(s.register_no)?'✓':''}</div>
          </div>`).join('')}</div>
      </div>`
    }).join('')
    if(!dhtml.replace(/<[^>]*>/g,'').trim()) return ''
    return `<div class="tc-yr-block">
      <div class="tc-yr-title"><i class="fas fa-layer-group"></i> Year ${yr}${sfx(yr)}</div>
      ${dhtml}
    </div>`
  }).join('')
}

function updateSelCount(id='selCount'){
  const el=document.getElementById(id);if(el) el.textContent=`${_selStus.size} Selected`
}

window.selStu = regno=>{
  _selStus.has(regno)?_selStus.delete(regno):_selStus.add(regno)
  const row=document.getElementById('row-'+regno), chk=document.getElementById('chk-'+regno)
  if(row) row.classList.toggle('sel',_selStus.has(regno))
  if(chk) chk.textContent=_selStus.has(regno)?'✓':''
  updateSelCount()
}

window.selDept = (yr,deptEnc,btn)=>{
  const d=decodeURIComponent(deptEnc)
  const stus=_students.filter(s=>s.department===d&&String(s.year)===String(yr))
  const allSel=stus.every(s=>_selStus.has(s.register_no))
  stus.forEach(s=>allSel?_selStus.delete(s.register_no):_selStus.add(s.register_no))
  // re-render list
  const q=document.getElementById('stuSearch')?.value||''
  const g=groupStudents(_students)
  const lEl=document.getElementById('stuList'); if(lEl) lEl.innerHTML=stuSelectorHTML(g,q)
  updateSelCount()
}

window.filterStus=()=>{
  const q=document.getElementById('stuSearch')?.value||''
  const g=groupStudents(_students)
  const lEl=document.getElementById('stuList'); if(lEl) lEl.innerHTML=stuSelectorHTML(g,q)
}

// ── CREATE CLASSROOM ──────────────────────────────────────────
window.openCreate=()=>{
  _selStus.clear()
  const g=groupStudents(_students)
  modal(`
  <div class="tc-modal-ov open" id="mCreate">
    <div class="tc-modal tc-modal-lg">
      <div class="tc-modal-hdr">
        <div class="tc-modal-title"><i class="fas fa-plus-circle"></i> Create New Classroom</div>
        <button class="tc-modal-cls" onclick="closeM('mCreate')"><i class="fas fa-times"></i></button>
      </div>
      <div class="tc-modal-body">
        <div class="tc-grid" style="margin-bottom:20px">
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-door-open"></i> Classroom Name *</label><input id="cc_name" class="tc-input" placeholder="e.g. CSE-A 3rd Year Maths"/></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-book"></i> Subject *</label><input id="cc_subj" class="tc-input" placeholder="e.g. Data Structures"/></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-building"></i> Dept (optional)</label><input id="cc_dept" class="tc-input" placeholder="Filter hint"/></div>
          <div class="tc-fg"><label class="tc-label"><i class="fas fa-layer-group"></i> Year (optional)</label>
            <select id="cc_year" class="tc-select"><option value="">Any Year</option>${[1,2,3,4].map(n=>`<option value="${n}">${n}${sfx(n)} Year</option>`).join('')}</select></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <span style="font-family:'DM Serif Display',serif;font-size:.95rem;color:#fff"><i class="fas fa-users" style="color:var(--tc-amber);margin-right:7px"></i>Select Students</span>
          <span class="tc-badge tcb-blue" id="selCount">0 Selected</span>
        </div>
        <div class="tc-msearch tc-fg"><i class="fas fa-search tc-msearch-ico"></i><input id="stuSearch" class="tc-input" placeholder="Search name or reg no…" oninput="filterStus()" style="padding-left:38px"/></div>
        <div style="max-height:380px;overflow-y:auto;padding-right:4px" id="stuList">${stuSelectorHTML(g)}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--tc-border)">
          <button class="tc-btn tc-btn-ghost tc-btn-sm" onclick="closeM('mCreate')">Cancel</button>
          <button class="tc-btn tc-btn-primary" onclick="saveRoom()"><i class="fas fa-save"></i> Create Classroom</button>
        </div>
      </div>
    </div>
  </div>`)
}

window.saveRoom=async()=>{
  const name=document.getElementById('cc_name')?.value?.trim()
  const subj=document.getElementById('cc_subj')?.value?.trim()
  if(!name||!subj){showToast('Classroom name & subject required.','warning');return}
  if(_selStus.size===0){showToast('Select at least one student.','warning');return}

  const {data,error}=await supabase.from('classrooms').insert({
    teacher_regno:_regno,teacher_name:_profile?.name||_regno,
    class_name:name,subject:subj,
    department:document.getElementById('cc_dept')?.value?.trim()||null,
    year:parseInt(document.getElementById('cc_year')?.value)||null,
    student_regnos:[..._selStus]
  }).select().single()

  if(error){showToast('Failed: '+error.message,'error');return}

  showToast(`Classroom "${name}" created! 🎉`,'success')
  _rooms.unshift(data)
  closeModal('mCreate')
  refreshGrids()
}

// ── OPEN ROOM ─────────────────────────────────────────────────
window.openRoom=async(id)=>{
  const room=_rooms.find(r=>r.id===id);if(!room)return
  const stus=_students.filter(s=>(room.student_regnos||[]).includes(s.register_no))
  const isMine=room.teacher_regno===_regno

  const {data:sessions=[]}=await supabase.from('attendance_sessions')
    .select('*').eq('classroom_id',id).order('session_date',{ascending:false}).order('period').limit(15)

  const sessRows=sessions.length?sessions.map(s=>`
    <tr>
      <td>${new Date(s.session_date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
      <td>Period ${s.period}</td>
      <td><span class="tc-badge tcb-blue">${(room.student_regnos||[]).length} students</span></td>
      <td><button class="tc-btn tc-btn-ghost tc-btn-sm" onclick="viewSess('${s.id}')"><i class="fas fa-eye"></i> View</button></td>
    </tr>`).join(''):`<tr><td colspan="4" style="text-align:center;color:var(--tc-muted);padding:20px">No sessions yet.</td></tr>`

  modal(`
  <div class="tc-modal-ov open" id="mRoom">
    <div class="tc-modal tc-modal-lg">
      <div class="tc-modal-hdr">
        <div class="tc-modal-title"><i class="fas fa-door-open"></i> ${esc(room.class_name)}</div>
        <button class="tc-modal-cls" onclick="closeM('mRoom')"><i class="fas fa-times"></i></button>
      </div>
      <div class="tc-modal-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:22px">
          <div>
            <div style="font-family:'DM Serif Display',serif;font-size:1.2rem;color:#fff">${esc(room.class_name)}</div>
            <div style="font-size:.82rem;color:var(--tc-muted);margin-top:4px">
              <i class="fas fa-book"></i> ${esc(room.subject||'—')} &bull;
              <i class="fas fa-users"></i> ${(room.student_regnos||[]).length} Students &bull;
              <i class="fas fa-user-tie"></i> ${esc(room.teacher_name||room.teacher_regno)}
            </div>
          </div>
          ${isMine?`<div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="tc-btn tc-btn-green tc-btn-sm" onclick="openMarkAtt('${id}')"><i class="fas fa-clipboard-check"></i> Mark Attendance</button>
            <button class="tc-btn tc-btn-ghost tc-btn-sm" onclick="openEditRoom('${id}')"><i class="fas fa-edit"></i> Edit Students</button>
          </div>`:''}
        </div>

        <div style="margin-bottom:22px">
          <div style="font-family:'DM Serif Display',serif;font-style:italic;font-size:.95rem;color:#fff;margin-bottom:12px"><i class="fas fa-history" style="color:var(--tc-amber);font-style:normal"></i> Recent Sessions</div>
          <div class="tc-tbl-wrap">
            <table class="tc-tbl"><thead><tr><th>Date</th><th>Period</th><th>Students</th><th>Action</th></tr></thead>
            <tbody>${sessRows}</tbody></table>
          </div>
        </div>

        <div>
          <div style="font-family:'DM Serif Display',serif;font-style:italic;font-size:.95rem;color:#fff;margin-bottom:10px"><i class="fas fa-users" style="color:var(--tc-amber);font-style:normal"></i> Students in Classroom</div>
          <div style="display:flex;flex-wrap:wrap;gap:7px">
            ${stus.map(s=>`<span class="tc-badge tcb-blue"><i class="fas fa-user"></i> ${esc(s.name||s.register_no)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`)
}

// ── MARK ATTENDANCE ───────────────────────────────────────────
window.openMarkAtt=id=>{
  const room=_rooms.find(r=>r.id===id);if(!room)return
  const stus=_students.filter(s=>(room.student_regnos||[]).includes(s.register_no))
  _attState={}; stus.forEach(s=>{_attState[s.register_no]=null})
  _attStus=stus
  const today=new Date().toISOString().split('T')[0]

  modal(`
  <div class="tc-modal-ov open" id="mAtt">
    <div class="tc-modal tc-modal-md">
      <div class="tc-modal-hdr">
        <div class="tc-modal-title"><i class="fas fa-clipboard-check"></i> Mark Attendance — ${esc(room.class_name)}</div>
        <button class="tc-modal-cls" onclick="closeM('mAtt');openRoom('${id}')"><i class="fas fa-times"></i></button>
      </div>
      <div class="tc-modal-body">
        <div class="tc-sess-hdr">
          <div><label>Date *</label><input id="attDate" type="date" value="${today}" class="tc-input" style="min-width:148px"/></div>
          <div><label>Period *</label>
            <select id="attPeriod" class="tc-select" style="min-width:128px">
              ${[1,2,3,4,5,6,7,8].map(p=>`<option value="${p}">Period ${p}</option>`).join('')}
            </select></div>
          <div id="attSessMsg"></div>
        </div>

        <div class="tc-bulk-row">
          <span class="tc-bulk-lbl">Mark All:</span>
          <button class="tc-btn tc-btn-green tc-btn-sm" onclick="markAll('present')"><i class="fas fa-check-double"></i> All Present</button>
          <button class="tc-btn tc-btn-danger tc-btn-sm" onclick="markAll('absent')"><i class="fas fa-times"></i> All Absent</button>
        </div>

        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--tc-muted);margin-bottom:6px">
            <span>Marked: <strong id="markedN" style="color:var(--tc-amber)">0</strong> / ${stus.length}</span>
          </div>
          <div class="tc-prog"><div class="tc-prog-bar" id="progBar" style="width:0%"></div></div>
        </div>

        <div id="attList">
          ${stus.map(s=>`
          <div class="tc-att-row" id="ar-${s.register_no}">
            <div><div class="tc-att-sname">${esc(s.name||'—')}</div>
            <div class="tc-att-sreg">${s.register_no}${s.department?' · '+esc(s.department):''} · Yr ${s.year||'—'}</div></div>
            <div class="tc-att-toggle">
              <button class="tc-att-p" id="ap-${s.register_no}" onclick="markOne('${s.register_no}','present')"><i class="fas fa-check"></i> P</button>
              <button class="tc-att-a" id="aa-${s.register_no}" onclick="markOne('${s.register_no}','absent')"><i class="fas fa-times"></i> A</button>
            </div>
          </div>`).join('')}
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--tc-border)">
          <button class="tc-btn tc-btn-ghost tc-btn-sm" onclick="closeM('mAtt');openRoom('${id}')">Cancel</button>
          <button class="tc-btn tc-btn-primary" id="saveAttBtn" onclick="saveAtt('${id}')"><i class="fas fa-save"></i> Save Attendance</button>
        </div>
      </div>
    </div>
  </div>`)
}

window.markOne=(regno,status)=>{
  _attState[regno]=status
  document.getElementById(`ap-${regno}`)?.classList.toggle('on',status==='present')
  document.getElementById(`aa-${regno}`)?.classList.toggle('on',status==='absent')
  const marked=Object.values(_attState).filter(v=>v!==null).length
  const tot=_attStus.length||1
  const markedEl=document.getElementById('markedN');if(markedEl)markedEl.textContent=marked
  const bar=document.getElementById('progBar');if(bar)bar.style.width=Math.round(marked/tot*100)+'%'
}

window.markAll=status=>{ _attStus.forEach(s=>markOne(s.register_no,status)) }

window.saveAtt=async(id)=>{
  const date=document.getElementById('attDate')?.value
  const period=parseInt(document.getElementById('attPeriod')?.value)
  if(!date||!period){showToast('Select date & period.','warning');return}

  const unmarked=Object.values(_attState).filter(v=>v===null).length
  if(unmarked>0&&!confirm(`${unmarked} student(s) not marked. Proceed anyway?`)) return

  const btn=document.getElementById('saveAttBtn')
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…'

  // Upsert session
  const {data:sess,error:sErr}=await supabase.from('attendance_sessions')
    .upsert({classroom_id:id,teacher_regno:_regno,session_date:date,period},{onConflict:'classroom_id,session_date,period'})
    .select().single()

  if(sErr){showToast('Session error: '+sErr.message,'error');btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> Save Attendance';return}

  const records=_attStus.filter(s=>_attState[s.register_no]!==null).map(s=>({
    session_id:sess.id,classroom_id:id,register_no:s.register_no,
    student_name:s.name||'',status:_attState[s.register_no],
    session_date:date,period
  }))

  if(records.length){
    const {error:rErr}=await supabase.from('attendance_records').upsert(records,{onConflict:'session_id,register_no'})
    if(rErr){showToast('Records error: '+rErr.message,'error');btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> Save Attendance';return}
  }

  showToast(`Attendance saved for ${records.length} students! ✅`,'success')
  closeModal('mAtt')
  openRoom(id)
  btn.disabled=false;btn.innerHTML='<i class="fas fa-save"></i> Save Attendance'
}

// ── VIEW SESSION ──────────────────────────────────────────────
window.viewSess=async sessId=>{
  const {data:recs=[]}=await supabase.from('attendance_records').select('*').eq('session_id',sessId).order('student_name')
  const {data:sess}=await supabase.from('attendance_sessions').select('*').eq('id',sessId).maybeSingle()
  const pres=recs.filter(r=>r.status==='present')
  const abs=recs.filter(r=>r.status==='absent')

  modal(`
  <div class="tc-modal-ov open" id="mSess">
    <div class="tc-modal tc-modal-md">
      <div class="tc-modal-hdr">
        <div class="tc-modal-title"><i class="fas fa-eye"></i> Session Report</div>
        <button class="tc-modal-cls" onclick="closeM('mSess')"><i class="fas fa-times"></i></button>
      </div>
      <div class="tc-modal-body">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">
          <span class="tc-badge tcb-amber"><i class="fas fa-calendar"></i> ${sess?.session_date||'—'}</span>
          <span class="tc-badge tcb-blue"><i class="fas fa-clock"></i> Period ${sess?.period||'—'}</span>
          <span class="tc-badge tcb-green"><i class="fas fa-check"></i> ${pres.length} Present</span>
          <span class="tc-badge tcb-red"><i class="fas fa-times"></i> ${abs.length} Absent</span>
        </div>
        ${recs.length?`<div class="tc-tbl-wrap"><table class="tc-tbl">
          <thead><tr><th>Student</th><th>Reg No</th><th>Status</th></tr></thead>
          <tbody>${recs.map(r=>`<tr>
            <td style="font-weight:700;color:#fff">${esc(r.student_name||'—')}</td>
            <td style="font-family:'Space Mono',monospace;color:var(--tc-muted)">${r.register_no}</td>
            <td><span class="tc-badge ${r.status==='present'?'tcb-green':'tcb-red'}"><i class="fas fa-${r.status==='present'?'check':'times'}"></i> ${r.status}</span></td>
          </tr>`).join('')}</tbody>
        </table></div>`:
        `<div class="tc-empty"><div class="tc-empty-title">No records.</div></div>`}
        <div style="text-align:right;margin-top:16px">
          <button class="tc-btn tc-btn-ghost tc-btn-sm" onclick="closeM('mSess')">Close</button>
        </div>
      </div>
    </div>
  </div>`)
}

// ── EDIT CLASSROOM ────────────────────────────────────────────
window.openEditRoom=id=>{
  const room=_rooms.find(r=>r.id===id);if(!room)return
  _selStus=new Set(room.student_regnos||[])
  const g=groupStudents(_students)

  modal(`
  <div class="tc-modal-ov open" id="mEdit">
    <div class="tc-modal tc-modal-lg">
      <div class="tc-modal-hdr">
        <div class="tc-modal-title"><i class="fas fa-edit"></i> Edit Students — ${esc(room.class_name)}</div>
        <button class="tc-modal-cls" onclick="closeM('mEdit');openRoom('${id}')"><i class="fas fa-times"></i></button>
      </div>
      <div class="tc-modal-body">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <span style="font-family:'DM Serif Display',serif;font-size:.95rem;color:#fff"><i class="fas fa-users" style="color:var(--tc-amber);margin-right:7px"></i>Select Students</span>
          <span class="tc-badge tcb-blue" id="selCount">${_selStus.size} Selected</span>
        </div>
        <div class="tc-msearch tc-fg"><i class="fas fa-search tc-msearch-ico"></i><input id="stuSearch" class="tc-input" placeholder="Search…" oninput="filterStus()" style="padding-left:38px"/></div>
        <div style="max-height:380px;overflow-y:auto" id="stuList">${stuSelectorHTML(g)}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--tc-border)">
          <button class="tc-btn tc-btn-ghost tc-btn-sm" onclick="closeM('mEdit');openRoom('${id}')">Cancel</button>
          <button class="tc-btn tc-btn-primary" onclick="saveEditRoom('${id}')"><i class="fas fa-save"></i> Save Changes</button>
        </div>
      </div>
    </div>
  </div>`)
}

window.saveEditRoom=async id=>{
  const {error}=await supabase.from('classrooms')
    .update({student_regnos:[..._selStus],updated_at:new Date().toISOString()}).eq('id',id)
  if(error){showToast('Failed: '+error.message,'error');return}
  const idx=_rooms.findIndex(r=>r.id===id);if(idx>=0)_rooms[idx].student_regnos=[..._selStus]
  showToast('Classroom updated!','success')
  closeModal('mEdit')
  openRoom(id)
}