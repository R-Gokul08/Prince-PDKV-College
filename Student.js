// ================================================================
// Student.js — PDKV Student Portal
// Login → student_credentials
// Profile → student_information  (image → image_files/Student_images)
// Attendance → attendance_information
// Exams → exam_information
// Session persists until manual logout (sessionStorage)
// ================================================================
import { supabase }                               from './supabaseClient.js'
import { initStickyHeader, initHamburger, initScrollAnimations,
         showToast, initAuth, openAuthModal, logoutUser,
         getCurrentUser, initRipple, initPageTransitions } from './shared.js'

// ── constants ────────────────────────────────────────────────
const BUCKET   = 'image_files'
const FOLDER   = 'Student_images'
const SESS_KEY = 'st_regno'

const DEPTS = [
  'Computer Science & Engineering',
  'Artificial Intelligence & Data Science',
  'Cyber Security',
  'Electronics & Communication Engineering',
  'Electrical & Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Master of Business Administration',
  'M.Tech Computer Science & Engineering',
  'M.Tech VLSI Design',
  'Mathematics','Physics','Chemistry','English'
]

// ── state ─────────────────────────────────────────────────────
let _regno   = null
let _rtCh    = null

// ── boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader(); initHamburger(); initPageTransitions(); initRipple()
  initParticles()
  await initAuth()

  document.getElementById('headerLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.querySelectorAll('.global-header-logout').forEach(b => b.addEventListener('click', async () => logoutUser()))

  const saved = sessionStorage.getItem(SESS_KEY)
  if (saved) { _regno = saved; await loadPortal(saved) }
  else        showSec('login')

  document.getElementById('loginForm')?.addEventListener('submit', handleLogin)
  initFadeUp()
})

// ── particles canvas ──────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('stCanvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let W, H, pts

  const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight }
  const colours = ['rgba(0,245,212,', 'rgba(59,130,246,', 'rgba(139,92,246,']

  function P() {
    this.reset = () => {
      this.x = Math.random()*W; this.y = Math.random()*H
      this.r = Math.random()*1.6+0.4
      this.vx = (Math.random()-.5)*.28; this.vy = -Math.random()*.35-.08
      this.a = Math.random()*.45+.12
      this.c = colours[Math.floor(Math.random()*3)]
    }
    this.reset()
  }
  const init = () => { resize(); pts = Array.from({length:75}, () => new P()) }
  const draw = () => {
    ctx.clearRect(0,0,W,H)
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
      ctx.fillStyle = p.c + p.a + ')'; ctx.fill()
      p.x += p.vx; p.y += p.vy
      if (p.x<-5||p.x>W+5||p.y<-5||p.y>H+5) p.reset()
    })
    requestAnimationFrame(draw)
  }
  init(); draw()
  window.addEventListener('resize', resize)
}

function initFadeUp() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e,i) => {
      if (e.isIntersecting) { setTimeout(() => e.target.classList.add('vis'), i*75); obs.unobserve(e.target) }
    })
  }, { threshold:.07, rootMargin:'0px 0px -18px 0px' })
  document.querySelectorAll('.sp-up:not(.vis)').forEach(el => obs.observe(el))
}

// ── section switcher ──────────────────────────────────────────
function showSec(id) {
  ['login','loading','setup','profile'].forEach(s => {
    const el = document.getElementById(`sec${cap(s)}`)
    if (el) el.style.display = s===id ? 'block' : 'none'
  })
  setTimeout(initFadeUp, 80)
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

// ── login ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault()
  const regno = document.getElementById('inRegno')?.value?.trim().toUpperCase()
  const pass  = document.getElementById('inPass')?.value
  if (!regno||!pass) { showMsg('Please enter Register No. & Password.','err'); return }

  const btn = document.getElementById('loginBtn')
  btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Signing In…'
  hideMsg()

  const { data, error } = await supabase
    .from('student_credentials')
    .select('*')
    .eq('register_no', regno)
    .maybeSingle()

  if (error)          { showMsg('Database error — try again.','err');        resetBtn(btn); return }
  if (!data)          { showMsg('Register number not found. Contact admin.','err'); resetBtn(btn); return }
  if (data.password !== pass) { showMsg('Incorrect password.','err');        resetBtn(btn); return }

  sessionStorage.setItem(SESS_KEY, regno)
  _regno = regno
  showToast(`Welcome! Signed in as ${regno}`, 'success')
  await loadPortal(regno)
  resetBtn(btn)
}

function showMsg(txt, type='err') {
  const el = document.getElementById('loginMsg')
  if (!el) return
  el.className = `sp-msg sp-msg-${type}`
  el.innerHTML = `<i class="fas fa-${type==='err'?'exclamation-circle':'check-circle'}"></i> ${txt}`
  el.style.display = 'flex'
}
function hideMsg() { const el=document.getElementById('loginMsg'); if(el) el.style.display='none' }
function resetBtn(b) { b.disabled=false; b.innerHTML='<i class="fas fa-sign-in-alt"></i> Sign In' }

// public for HTML onclick
window.stLogout = () => {
  sessionStorage.removeItem(SESS_KEY)
  _regno = null
  if (_rtCh) { supabase.removeChannel(_rtCh); _rtCh=null }
  showSec('login')
  showToast('Logged out.','info')
}

// ── load portal ───────────────────────────────────────────────
async function loadPortal(regno) {
  showSec('loading')
  const { data: stu } = await supabase
    .from('student_information')
    .select('*')
    .ilike('register_no', regno)
    .maybeSingle()

  if (!stu) { showSec('setup'); renderSetup(regno) }
  else       { showSec('profile'); await renderProfile(stu); setupRT(regno) }
}

// ── image upload ──────────────────────────────────────────────
async function uploadImg(fileInputId, key) {
  const inp = document.getElementById(fileInputId)
  const f = inp?.files?.[0]
  if (!f) return null
  const ext  = f.name.split('.').pop()
  const path = `${FOLDER}/${key}_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, f, {upsert:true})
  if (error) { showToast('Image upload failed: '+error.message,'error'); return null }
  const { data:{publicUrl} } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return publicUrl
}

function bindPreview(fileId, wrapId, imgId, rmId) {
  document.getElementById(fileId)?.addEventListener('change', () => {
    const f = document.getElementById(fileId).files[0]; if (!f) return
    const r = new FileReader()
    r.onload = e => { document.getElementById(imgId).src=e.target.result; document.getElementById(wrapId).classList.add('show') }
    r.readAsDataURL(f)
  })
  document.getElementById(rmId)?.addEventListener('click', () => {
    document.getElementById(fileId).value=''
    document.getElementById(imgId).src=''
    document.getElementById(wrapId).classList.remove('show')
  })
}

// ── SETUP FORM ────────────────────────────────────────────────
function renderSetup(regno) {
  const c = document.getElementById('secSetup')
  if (!c) return
  const dOpts = DEPTS.map(d=>`<option>${d}</option>`).join('')

  c.innerHTML = `
  <div class="st-wrap">
   <div class="st-setup-outer">
    <div class="st-setup-header">
      <div class="st-setup-icon"><i class="fas fa-id-card-alt"></i></div>
      <h2 class="st-setup-h2">Complete Your Profile</h2>
      <p class="st-setup-sub">Hi <strong style="color:var(--sp-cyan)">${esc(regno)}</strong>! Fill your details below. Attendance &amp; exam results will appear once your teacher records them.</p>
    </div>
    <div class="sp-glass st-setup-card">
      <form id="setupForm" novalidate>
        <div class="sp-grid">

          <div class="sp-section-divider">
            <span class="sp-section-divider-label"><i class="fas fa-user"></i> Personal</span>
            <div class="sp-section-divider-line"></div>
          </div>

          <div class="sp-form-group">
            <label class="sp-label"><i class="fas fa-id-badge"></i> Register No</label>
            <input class="sp-input" value="${esc(regno)}" readonly/>
          </div>
          <div class="sp-form-group">
            <label class="sp-label"><i class="fas fa-user"></i> Full Name *</label>
            <input id="sp_name" class="sp-input" placeholder="Your full name" required/>
          </div>
          <div class="sp-form-group">
            <label class="sp-label"><i class="fas fa-envelope"></i> Email ID *</label>
            <input id="sp_email" type="email" class="sp-input" placeholder="your@email.com" required/>
          </div>
          <div class="sp-form-group">
            <label class="sp-label"><i class="fas fa-phone"></i> Phone Number *</label>
            <input id="sp_phone" type="tel" class="sp-input" placeholder="+91 99999 99999" required/>
          </div>
          <div class="sp-form-group">
            <label class="sp-label"><i class="fas fa-venus-mars"></i> Gender *</label>
            <select id="sp_gender" class="sp-select" required>
              <option value="">Select Gender</option>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
          <div class="sp-form-group">
            <label class="sp-label"><i class="fas fa-birthday-cake"></i> Date of Birth</label>
            <input id="sp_dob" type="date" class="sp-input"/>
          </div>
          <div class="sp-form-group">
            <label class="sp-label"><i class="fas fa-shield-alt"></i> Guardian Name</label>
            <input id="sp_guardian" class="sp-input" placeholder="Parent / Guardian name"/>
          </div>

          <div class="sp-section-divider">
            <span class="sp-section-divider-label"><i class="fas fa-graduation-cap"></i> Academic</span>
            <div class="sp-section-divider-line"></div>
          </div>

          <div class="sp-form-group">
            <label class="sp-label"><i class="fas fa-book"></i> Department *</label>
            <select id="sp_dept" class="sp-select" required>
              <option value="">Select Department</option>${dOpts}
            </select>
          </div>
          <div class="sp-form-group">
            <label class="sp-label"><i class="fas fa-layer-group"></i> Year *</label>
            <select id="sp_year" class="sp-select" required>
              <option value="">Select Year</option>
              <option value="1">1st Year</option><option value="2">2nd Year</option>
              <option value="3">3rd Year</option><option value="4">4th Year</option>
            </select>
          </div>

          <div class="sp-section-divider">
            <span class="sp-section-divider-label"><i class="fas fa-link"></i> Online Profiles</span>
            <div class="sp-section-divider-line"></div>
          </div>

          <div class="sp-form-group">
            <label class="sp-label"><i class="fab fa-linkedin"></i> LinkedIn</label>
            <input id="sp_linkedin" type="url" class="sp-input" placeholder="https://linkedin.com/in/…"/>
          </div>
          <div class="sp-form-group">
            <label class="sp-label"><i class="fab fa-github"></i> GitHub</label>
            <input id="sp_github" type="url" class="sp-input" placeholder="https://github.com/…"/>
          </div>

          <div class="sp-section-divider">
            <span class="sp-section-divider-label"><i class="fas fa-map-marker-alt"></i> Address &amp; Photo</span>
            <div class="sp-section-divider-line"></div>
          </div>

          <div class="sp-form-group sp-full">
            <label class="sp-label"><i class="fas fa-home"></i> Address</label>
            <textarea id="sp_address" class="sp-textarea" placeholder="Door No., Street, Area, City…"></textarea>
          </div>

          <div class="sp-form-group sp-full">
            <label class="sp-label"><i class="fas fa-camera"></i> Profile Photo <span style="opacity:.5;font-weight:400">(optional)</span></label>
            <div class="sp-upload" id="spUploadArea">
              <input type="file" id="sp_img" accept="image/*"/>
              <span class="sp-upload-icon"><i class="fas fa-cloud-upload-alt"></i></span>
              <div class="sp-upload-text"><strong>Click or drag &amp; drop</strong> your photo<br><small>JPG, PNG, WEBP — max 5 MB</small></div>
            </div>
            <div class="sp-img-pre" id="spImgPre"><img id="spImgPreImg" src="" alt=""/><button type="button" class="sp-img-rm" id="spImgRm"><i class="fas fa-times"></i></button></div>
          </div>

          <div class="sp-notice-strip sp-full">
            <i class="fas fa-clock"></i>
            <div><strong>Note:</strong> Your attendance &amp; exam results will appear in this portal once your teachers record them.</div>
          </div>

        </div><!-- grid -->
        <button type="submit" class="sp-btn sp-btn-primary sp-btn-full" id="setupBtn" style="margin-top:8px">
          <i class="fas fa-save"></i> Save My Profile
        </button>
      </form>
    </div>
   </div>
  </div>`

  bindPreview('sp_img','spImgPre','spImgPreImg','spImgRm')
  setTimeout(initFadeUp, 60)

  document.getElementById('setupForm').addEventListener('submit', async e => {
    e.preventDefault()
    const btn = document.getElementById('setupBtn')
    btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…'

    const g = id => document.getElementById(id)?.value?.trim() || null

    const name   = g('sp_name'); const email = g('sp_email')
    const phone  = g('sp_phone'); const gender = g('sp_gender')
    const dept   = g('sp_dept');  const year   = g('sp_year')

    if (!name||!email||!phone||!gender||!dept||!year) {
      showToast('Fill all required fields (*)','warning')
      btn.disabled=false; btn.innerHTML='<i class="fas fa-save"></i> Save My Profile'; return
    }

    const imgUrl = await uploadImg('sp_img', regno)

    const payload = {
      register_no: regno, name, email, phone, gender,
      department: dept, year: parseInt(year),
      dob:           g('sp_dob'),
      guardian_name: g('sp_guardian'),
      linkedin:      g('sp_linkedin'),
      github:        g('sp_github'),
      address:       g('sp_address'),
      image_url:     imgUrl || null,
      updated_at:    new Date().toISOString()
    }

    const { error } = await supabase.from('student_information')
      .upsert(payload, {onConflict:'register_no'})

    btn.disabled=false; btn.innerHTML='<i class="fas fa-save"></i> Save My Profile'

    if (error) { showToast('Failed: '+error.message,'error'); return }

    showToast('Profile saved! 🎉','success')
    const { data:stu } = await supabase.from('student_information').select('*').ilike('register_no',regno).maybeSingle()
    if (stu) { showSec('profile'); await renderProfile(stu); setupRT(regno) }
  })
}

// ── RENDER PROFILE ────────────────────────────────────────────
async function renderProfile(stu) {
  const c = document.getElementById('secProfile')
  if (!c) return

  const sfx = ['','st','nd','rd','th'][Math.min(stu.year||1,4)]||'th'
  const photo = stu.image_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(stu.name||stu.register_no)}&background=00f5d4&color=020c1b&size=200&bold=true`
  const gIco = {Male:'fas fa-mars',Female:'fas fa-venus',Other:'fas fa-transgender'}[stu.gender]||'fas fa-user'

  c.innerHTML = `
  <div class="st-wrap">
   <div>
    <!-- Hero -->
    <div class="sp-glass st-prof-hero sp-up">
      <div class="st-av-wrap">
        <img src="${photo}" alt="${esc(stu.name)}" class="st-av"/>
        <div class="st-av-ring"></div>
      </div>
      <div class="st-prof-info">
        <div class="st-prof-name">${esc(stu.name||stu.register_no)}</div>
        <div class="st-prof-regno">${esc(stu.register_no)}</div>
        <div class="st-prof-dept">${esc(stu.department||'')}${stu.year?` &bull; ${stu.year}${sfx} Year`:''}</div>
        <div class="st-badges">
          ${stu.gender?`<span class="sp-badge sp-badge-cyan"><i class="${gIco}"></i> ${esc(stu.gender)}</span>`:''}
          ${stu.department?`<span class="sp-badge sp-badge-blue"><i class="fas fa-book"></i> ${esc(stu.department.split(' ').pop())}</span>`:''}
          ${stu.year?`<span class="sp-badge sp-badge-gold"><i class="fas fa-layer-group"></i> Year ${stu.year}</span>`:''}
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="st-prof-actions sp-up">
      <button class="sp-btn sp-btn-ghost" onclick="stEdit()"><i class="fas fa-edit"></i> Edit Profile</button>
      <button class="sp-btn sp-btn-danger" onclick="stLogout()"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
    </div>

    <!-- Info grid -->
    <div class="st-info-grid sp-up">
      ${ic('fas fa-envelope','spi-cyan','Email',stu.email)}
      ${ic('fas fa-phone','spi-blue','Phone',stu.phone)}
      ${stu.gender?ic('fas fa-venus-mars','spi-violet','Gender',stu.gender):''}
      ${stu.dob?ic('fas fa-birthday-cake','spi-gold','Date of Birth',stu.dob):''}
      ${stu.guardian_name?ic('fas fa-shield-alt','spi-green','Guardian',stu.guardian_name):''}
      ${stu.address?ic('fas fa-map-marker-alt','spi-red','Address',stu.address):''}
      ${stu.linkedin?icLink('fab fa-linkedin','spi-blue','LinkedIn',stu.linkedin):''}
      ${stu.github?icLink('fab fa-github','spi-violet','GitHub',stu.github):''}
    </div>

    <!-- Attendance -->
    <div id="attSec" class="sp-up"></div>

    <!-- Exams -->
    <div id="examSec" class="sp-up"></div>
   </div>
  </div>`

  setTimeout(initFadeUp, 80)
  await Promise.all([loadAtt(stu.register_no), loadExam(stu.register_no)])
}

function ic(icon, cls, label, val) {
  if (!val) return ''
  return `<div class="sp-glass st-info-card">
    <div class="st-info-icon ${cls}"><i class="${icon}"></i></div>
    <div class="st-info-body"><div class="st-info-lbl">${label}</div><div class="st-info-val">${esc(val)}</div></div>
  </div>`
}
function icLink(icon, cls, label, href) {
  return `<div class="sp-glass st-info-card">
    <div class="st-info-icon ${cls}"><i class="${icon}"></i></div>
    <div class="st-info-body"><div class="st-info-lbl">${label}</div>
    <div class="st-info-val"><a href="${href}" target="_blank"><i class="fas fa-external-link-alt"></i> View Profile</a></div></div>
  </div>`
}

window.stEdit = () => { if (_regno) { showSec('setup'); renderSetup(_regno) } }

// ── ATTENDANCE ────────────────────────────────────────────────
async function loadAtt(regno) {
  const c = document.getElementById('attSec'); if (!c) return

  const { data } = await supabase.from('attendance_information')
    .select('*').ilike('register_no',regno).maybeSingle()

  if (!data||(!data.total_days&&!data.present_days)) {
    c.innerHTML = pendHTML('fas fa-calendar-times','rgba(59,130,246,0.12)','#93c5fd',
      'Attendance Not Updated Yet','Your teacher hasn\'t recorded any sessions yet. Check back after classes begin.')
    return
  }

  const total   = +data.total_days   || 0
  const present = +data.present_days || 0
  const absent  = +data.absent_days  || Math.max(0,total-present)
  const pct     = total>0 ? (present/total*100).toFixed(1) : '0.0'
  const pNum    = parseFloat(pct)

  const col = pNum>=75?'var(--sp-green)':pNum>=65?'var(--sp-gold)':'var(--sp-red)'
  const R=54, circ=2*Math.PI*R, dashoff=circ*(1-Math.min(pNum,100)/100)

  let warnTxt='', warnCls='saw-good'
  if      (pNum>=75) { warnTxt=`✅ Good standing! Attendance meets the 75% requirement.` }
  else if (pNum>=65) {
    const need=Math.ceil((0.75*total-present)/0.25)
    warnTxt=`⚠️ Low attendance! Attend <strong>${Math.max(0,need)}</strong> more consecutive classes to reach 75%.`
    warnCls='saw-mid'
  } else { warnTxt=`🚨 Critical attendance! Immediate improvement required.`; warnCls='saw-bad' }

  const absArr = Array.isArray(data.absent_details)?data.absent_details:[]
  const absHtml = absArr.length>0?`
    <div class="st-abs-wrap">
      <div class="st-abs-title"><i class="fas fa-times-circle"></i> Absent Sessions</div>
      <div class="st-abs-chips">
        ${absArr.slice(0,24).map(d=>`<span class="st-abs-chip"><i class="fas fa-calendar-times"></i>${d.date?new Date(d.date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'}):d.date||'—'}${d.period?` · P${d.period}`:''}</span>`).join('')}
        ${absArr.length>24?`<span class="st-abs-chip">+${absArr.length-24} more</span>`:''}
      </div>
    </div>`:''

  c.innerHTML = `
  <div class="sp-glass st-att-card">
    <div class="st-att-heading"><i class="fas fa-calendar-check"></i> Attendance Record</div>
    <div class="st-att-body">
      <div class="st-donut-wrap">
        <svg viewBox="0 0 124 124" class="st-donut-svg">
          <circle cx="62" cy="62" r="${R}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
          <circle cx="62" cy="62" r="${R}" fill="none" stroke="${col}"
            stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${circ.toFixed(2)}"
            stroke-dashoffset="${dashoff.toFixed(2)}"
            style="transition:stroke-dashoffset 1.2s cubic-bezier(0.34,1.2,0.64,1);
                   transform:rotate(-90deg);transform-origin:center;
                   filter:drop-shadow(0 0 7px ${col}88)"/>
        </svg>
        <div class="st-donut-center">
          <span class="st-donut-pct" style="color:${col}">${pct}%</span>
          <span class="st-donut-lbl">Attendance</span>
        </div>
      </div>
      <div class="st-att-stats">
        ${statBox(present,'Present','fas fa-check','rgba(16,185,129,0.14)','var(--sp-green)','rgba(16,185,129,0.1)')}
        ${statBox(absent,'Absent','fas fa-times','rgba(244,63,94,0.14)','var(--sp-red)','rgba(244,63,94,0.1)')}
        ${statBox(total,'Total Days','fas fa-calendar-alt','rgba(59,130,246,0.14)','#93c5fd','rgba(59,130,246,0.1)')}
      </div>
    </div>
    <div class="st-att-warn ${warnCls}">${warnTxt}</div>
    ${absHtml}
  </div>`
}

function statBox(n,lbl,ico,icoBg,icoCol,cardBg) {
  return `<div class="sp-glass st-att-stat" style="background:${cardBg}">
    <div class="st-att-stat-ico" style="background:${icoBg};color:${icoCol}"><i class="${ico}"></i></div>
    <span class="st-att-num" style="color:${icoCol}">${n}</span>
    <span class="st-att-lbl">${lbl}</span>
  </div>`
}

// ── EXAM ──────────────────────────────────────────────────────
async function loadExam(regno) {
  const c = document.getElementById('examSec'); if (!c) return

  const { data } = await supabase.from('exam_information')
    .select('*').ilike('register_no',regno)
    .order('semester',{ascending:true}).order('exam_type',{ascending:true}).order('subject_name',{ascending:true})

  if (!data||!data.length) {
    c.innerHTML = pendHTML('fas fa-file-alt','rgba(139,92,246,0.12)','#c4b5fd',
      'Exam Results Not Available','Results will appear here after admin enters your marks.')
    return
  }

  const groups={}
  data.forEach(r => {
    if(!groups[r.semester]) groups[r.semester]={}
    if(!groups[r.semester][r.exam_type]) groups[r.semester][r.exam_type]=[]
    groups[r.semester][r.exam_type].push(r)
  })
  const sems = Object.keys(groups).map(Number).sort((a,b)=>a-b)

  const typeCfg = {
    'CIAT1':      {label:'CIAT – I',         ico:'fas fa-pencil-alt',     col:'#3b82f6'},
    'CIAT2':      {label:'CIAT – II',        ico:'fas fa-pen-nib',        col:'#8b5cf6'},
    'Final Exam': {label:'Final Examination',ico:'fas fa-graduation-cap', col:'#f43f5e'}
  }

  c.innerHTML = `
  <div class="sp-glass st-exam-card">
    <div class="st-exam-heading"><i class="fas fa-file-alt"></i> Exam Results</div>
    <div class="st-sem-tabs">
      ${sems.map((s,i)=>`<button class="st-sem-tab${i===0?' act':''}" data-sem="${s}" onclick="stSem(${s})">${s<5?`Sem ${s}`:`Semester ${s}`}</button>`).join('')}
    </div>
    ${sems.map((sem,si)=>`
    <div id="sp${sem}" class="st-sem-panel${si>0?' hide':''}">
      ${Object.keys(typeCfg).map(typ=>{
        const rows=groups[sem]?.[typ]; if(!rows?.length) return ''
        const cfg=typeCfg[typ]
        const tot=rows.reduce((s,r)=>s+(+r.marks_obtained||0),0)
        const maxTot=rows.reduce((s,r)=>s+(+r.max_marks||100),0)
        const passN=rows.filter(r=>{const p=r.max_marks>0?r.marks_obtained/r.max_marks*100:0;return typ==='Final Exam'?p>=50:p>=40}).length
        return `
        <div class="st-exam-block" style="border-top:3px solid ${cfg.col}">
          <div class="st-exam-block-hdr">
            <div class="st-exam-block-ico" style="background:${cfg.col}22;color:${cfg.col}"><i class="${cfg.ico}"></i></div>
            <div><div class="st-exam-block-name">${cfg.label}</div>
            <div class="st-exam-block-meta">${passN}/${rows.length} Pass &bull; Avg: ${rows.length?(tot/rows.length).toFixed(1):0}/${(maxTot/rows.length).toFixed(0)}</div></div>
          </div>
          <div class="st-tbl-wrap"><table class="st-tbl">
            <thead><tr><th>Subject</th><th>Code</th><th>Marks</th><th>Max</th><th>%</th><th>Status</th></tr></thead>
            <tbody>${rows.map(r=>{
              const mx=+r.max_marks||100,ob=+r.marks_obtained||0
              const p=mx>0?(ob/mx*100).toFixed(1):'—'
              const pass=typ==='Final Exam'?(ob/mx*100)>=50:(ob/mx*100)>=40
              return `<tr><td class="st-sname">${esc(r.subject_name)}</td>
              <td>${r.subject_code?`<span class="st-scode">${esc(r.subject_code)}</span>`:'—'}</td>
              <td><strong>${ob}</strong></td><td>${mx}</td><td>${p}%</td>
              <td><span class="st-chip ${pass?'st-chip-pass':'st-chip-fail'}"><i class="fas fa-${pass?'check':'times'}"></i>${pass?'Pass':'Fail'}</span></td></tr>`
            }).join('')}</tbody>
            <tfoot><tr><td colspan="2"><strong>Total</strong></td>
            <td><strong>${tot.toFixed(1)}</strong></td><td>${maxTot.toFixed(0)}</td>
            <td><strong>${maxTot>0?(tot/maxTot*100).toFixed(1):'—'}%</strong></td><td></td></tr></tfoot>
          </table></div>
        </div>`
      }).join('')}
    </div>`).join('')}
  </div>`

  window.stSem = sem => {
    document.querySelectorAll('.st-sem-tab').forEach(t=>t.classList.toggle('act',+t.dataset.sem===sem))
    document.querySelectorAll('[id^="sp"]').forEach(p=>{ if(/^sp\d+$/.test(p.id)) p.classList.toggle('hide',p.id!=='sp'+sem) })
  }
}

// ── REALTIME ──────────────────────────────────────────────────
function setupRT(regno) {
  if (_rtCh) supabase.removeChannel(_rtCh)
  _rtCh = supabase.channel('st-rt-'+regno)
    .on('postgres_changes',{event:'*',schema:'public',table:'attendance_information'},
      ()=>loadAtt(regno))
    .on('postgres_changes',{event:'*',schema:'public',table:'exam_information'},
      ()=>loadExam(regno))
    .subscribe()
}

// ── HELPERS ───────────────────────────────────────────────────
function pendHTML(ico,icoBg,icoCol,title,sub) {
  return `<div class="st-pending">
    <div class="st-pend-ico" style="background:${icoBg};color:${icoCol}"><i class="${ico}"></i></div>
    <h4>${title}</h4><p>${sub}</p>
  </div>`
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}