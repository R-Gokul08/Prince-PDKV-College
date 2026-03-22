// ================================================================
// Student.js — PDKV Student Portal v3 (debugged)
// Fixes: null guards, realtime cleanup on re-login,
//        achievement modal re-bind, stEdit null check,
//        uploadImg error handling
// ================================================================
import { supabase } from './supabaseClient.js'
import {
  initStickyHeader, initHamburger, initScrollAnimations,
  showToast, initAuth, openAuthModal, logoutUser,
  getCurrentUser, initRipple, initPageTransitions
} from './shared.js'

const BUCKET     = 'image_files'
const ST_FOLDER  = 'Student_images'
const ACH_FOLDER = 'Achievement_images'
const SESS_KEY   = 'st_regno'

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

let _regno = null
let _rtCh  = null

// ── BOOT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initPageTransitions()
  initRipple()
  initParticles()

  const saved = sessionStorage.getItem(SESS_KEY)
  if (saved) {
    _regno = saved
    showSec('loading')
    loadPortal(saved)
  } else {
    showSec('login')
  }

  document.getElementById('loginForm')
    ?.addEventListener('submit', handleLogin)

  document.getElementById('headerLoginBtn')
    ?.addEventListener('click', () => openAuthModal('login'))

  document.querySelectorAll('.global-header-logout')
    .forEach(b => b.addEventListener('click', () => logoutUser()))

  initAuth()
  initFadeUp()
})

// ── PARTICLES ─────────────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('stCanvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let W, H, pts
  const cols = ['rgba(0,245,212,','rgba(59,130,246,','rgba(139,92,246,']

  function P() {
    this.reset = () => {
      this.x  = Math.random() * W
      this.y  = Math.random() * H
      this.r  = Math.random() * 1.6 + 0.4
      this.vx = (Math.random() - .5) * .28
      this.vy = -Math.random() * .35 - .08
      this.a  = Math.random() * .45 + .12
      this.c  = cols[Math.floor(Math.random() * 3)]
    }
    this.reset()
  }

  const resize = () => {
    W = canvas.width  = canvas.offsetWidth
    H = canvas.height = canvas.offsetHeight
  }

  const init = () => { resize(); pts = Array.from({ length: 75 }, () => new P()) }

  const draw = () => {
    ctx.clearRect(0, 0, W, H)
    pts.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = p.c + p.a + ')'
      ctx.fill()
      p.x += p.vx; p.y += p.vy
      if (p.x < -5 || p.x > W + 5 || p.y < -5 || p.y > H + 5) p.reset()
    })
    requestAnimationFrame(draw)
  }

  init(); draw()
  let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(resize, 120) })
}

function initFadeUp() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('vis'), i * 75)
        obs.unobserve(e.target)
      }
    })
  }, { threshold: .07, rootMargin: '0px 0px -18px 0px' })
  document.querySelectorAll('.sp-up:not(.vis)').forEach(el => obs.observe(el))
}

// ── SECTION SWITCHER ──────────────────────────────────────────
function showSec(id) {
  ['login','loading','setup','profile'].forEach(s => {
    const key = 'sec' + s.charAt(0).toUpperCase() + s.slice(1)
    const el  = document.getElementById(key)
    if (el) el.style.display = s === id ? 'block' : 'none'
  })
  setTimeout(initFadeUp, 80)
}

const esc = s => String(s || '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;')

// ── LOGIN ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault()
  const regno = document.getElementById('inRegno')?.value?.trim().toUpperCase()
  const pass  = document.getElementById('inPass')?.value
  if (!regno || !pass) { showMsg('Please enter Register No. & Password.', 'err'); return }

  const btn = document.getElementById('loginBtn')
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In…'
  hideMsg()

  // Fetch credentials AND profile in parallel for speed
  const [credRes, profileRes] = await Promise.all([
    supabase.from('student_credentials').select('password').eq('register_no', regno).maybeSingle(),
    supabase.from('student_information').select('*').ilike('register_no', regno).maybeSingle()
  ])

  btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'

  if (credRes.error)                    { showMsg('Database error — try again.', 'err'); return }
  if (!credRes.data)                    { showMsg('Register number not found. Contact admin.', 'err'); return }
  if (credRes.data.password !== pass)   { showMsg('Incorrect password.', 'err'); return }

  sessionStorage.setItem(SESS_KEY, regno)
  _regno = regno
  showToast(`Welcome! Signed in as ${regno}`, 'success')

  const stu = profileRes.data || null
  if (!stu) {
    showSec('setup')
    await renderSetup(regno, null)
  } else {
    showSec('profile')
    await renderProfile(stu)
    setupRT(regno)
  }
}

function showMsg(txt, type = 'err') {
  const el = document.getElementById('loginMsg'); if (!el) return
  el.className = `sp-msg sp-msg-${type}`
  el.innerHTML = `<i class="fas fa-${type === 'err' ? 'exclamation-circle' : 'check-circle'}"></i> ${txt}`
  el.style.display = 'flex'
}
function hideMsg() { const el = document.getElementById('loginMsg'); if (el) el.style.display = 'none' }

window.stLogout = () => {
  sessionStorage.removeItem(SESS_KEY); _regno = null
  // FIX: always clean up realtime channel on logout
  if (_rtCh) { supabase.removeChannel(_rtCh); _rtCh = null }
  showSec('login')
  showToast('Logged out.', 'info')
}

// ── LOAD PORTAL ───────────────────────────────────────────────
async function loadPortal(regno) {
  showSec('loading')
  const { data: stu, error } = await supabase
    .from('student_information').select('*').ilike('register_no', regno).maybeSingle()

  if (error) {
    showToast('Error loading profile: ' + error.message, 'error')
    showSec('login'); return
  }

  if (!stu) {
    showSec('setup'); await renderSetup(regno, null)
  } else {
    showSec('profile'); await renderProfile(stu); setupRT(regno)
  }
}

// ── IMAGE UPLOAD ──────────────────────────────────────────────
async function uploadImg(fileInputId, folder, key) {
  const inp = document.getElementById(fileInputId)
  const f   = inp?.files?.[0]
  if (!f) return null

  const ext  = f.name.split('.').pop().toLowerCase()
  const path = `${folder}/${key}_${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, f, { upsert: true })
  if (error) { showToast('Image upload failed: ' + error.message, 'error'); return null }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return publicUrl
}

function bindPreview(fileId, wrapId, imgId, rmId) {
  document.getElementById(fileId)?.addEventListener('change', () => {
    const f = document.getElementById(fileId).files[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => {
      const img = document.getElementById(imgId)
      const wrap = document.getElementById(wrapId)
      if (img) img.src = ev.target.result
      if (wrap) wrap.classList.add('show')
    }
    r.readAsDataURL(f)
  })
  document.getElementById(rmId)?.addEventListener('click', () => {
    const fi = document.getElementById(fileId)
    const img = document.getElementById(imgId)
    const wrap = document.getElementById(wrapId)
    if (fi) fi.value = ''
    if (img) img.src = ''
    if (wrap) wrap.classList.remove('show')
  })
}

// ── SETUP / EDIT FORM ─────────────────────────────────────────
async function renderSetup(regno, existingData) {
  if (existingData === undefined) {
    const { data } = await supabase.from('student_information')
      .select('*').ilike('register_no', regno).maybeSingle()
    existingData = data || null
  }

  const isEdit = !!existingData
  const d      = existingData || {}
  const c      = document.getElementById('secSetup'); if (!c) return

  const dOpts = DEPTS.map(dep  => `<option ${d.department === dep  ? 'selected' : ''}>${dep}</option>`).join('')
  const yOpts = [1,2,3,4].map(y => `<option value="${y}" ${d.year == y ? 'selected' : ''}>${y}${['','st','nd','rd','th'][y]} Year</option>`).join('')
  const gOpts = ['Male','Female','Other'].map(g => `<option ${d.gender === g ? 'selected' : ''}>${g}</option>`).join('')

  c.innerHTML = `
  <div class="st-wrap sp-up vis">
    <div class="sp-glass st-setup-card">
      <div class="st-setup-hdr">
        <div class="st-setup-ico"><i class="fas fa-id-card"></i></div>
        <h2>${isEdit ? 'Edit Your Profile' : 'Complete Your Profile'}</h2>
        <p>${isEdit ? 'Update your details below' : 'Fill in your details to access the portal'}</p>
      </div>
      <form id="setupForm">
        <div class="st-form-grid">
          <div class="sp-fg"><label>Register Number *</label>
            <input class="sp-inp" value="${esc(regno)}" readonly /></div>
          <div class="sp-fg"><label>Full Name *</label>
            <input id="sp_name" class="sp-inp" value="${esc(d.name||'')}" placeholder="Your full name" required /></div>
          <div class="sp-fg"><label>Email ID *</label>
            <input id="sp_email" class="sp-inp" type="email" value="${esc(d.email||'')}" placeholder="your@email.com" required /></div>
          <div class="sp-fg"><label>Phone Number *</label>
            <input id="sp_phone" class="sp-inp" type="tel" value="${esc(d.phone||'')}" placeholder="+91 99999 99999" required /></div>
          <div class="sp-fg"><label>Gender *</label>
            <select id="sp_gender" class="sp-inp"><option value="">Select Gender</option>${gOpts}</select></div>
          <div class="sp-fg"><label>Department *</label>
            <select id="sp_dept" class="sp-inp"><option value="">Select Department</option>${dOpts}</select></div>
          <div class="sp-fg"><label>Year *</label>
            <select id="sp_year" class="sp-inp"><option value="">Select Year</option>${yOpts}</select></div>
          <div class="sp-fg"><label>Date of Birth</label>
            <input id="sp_dob" class="sp-inp" type="date" value="${esc(d.dob||'')}" /></div>
          <div class="sp-fg"><label>Guardian Name</label>
            <input id="sp_guardian" class="sp-inp" value="${esc(d.guardian_name||'')}" placeholder="Parent / Guardian name" /></div>
          <div class="sp-fg"><label>LinkedIn Profile</label>
            <input id="sp_linkedin" class="sp-inp" type="url" value="${esc(d.linkedin||'')}" placeholder="https://linkedin.com/in/..." /></div>
          <div class="sp-fg"><label>GitHub Profile</label>
            <input id="sp_github" class="sp-inp" type="url" value="${esc(d.github||'')}" placeholder="https://github.com/..." /></div>
          <div class="sp-fg sp-fg-full"><label>Address</label>
            <textarea id="sp_address" class="sp-inp sp-ta" rows="2" placeholder="Your address">${esc(d.address||'')}</textarea></div>
          <div class="sp-fg sp-fg-full">
            <label>Profile Photo <span class="sp-opt">(optional${isEdit ? ' — leave blank to keep existing' : ''})</span></label>
            ${d.image_url ? `<div class="sp-existing-photo">
              <img src="${esc(d.image_url)}" alt="Current photo" onerror="this.parentElement.style.display='none'" />
              <span>Current photo</span></div>` : ''}
            <div class="sp-upload-area" id="sp_upload_area">
              <input type="file" id="sp_file" accept="image/*" />
              <i class="fas fa-cloud-upload-alt sp-upload-ico"></i>
              <div class="sp-upload-txt"><strong>Click or drag &amp; drop to change photo</strong><br>JPG, PNG — max 5MB</div>
            </div>
            <div class="sp-preview-wrap" id="sp_preview_wrap">
              <img id="sp_preview_img" src="" alt="Preview" />
              <button type="button" class="sp-preview-rm" id="sp_rm"><i class="fas fa-times"></i></button>
            </div>
          </div>
        </div>
        ${isEdit ? `<button type="button" class="sp-btn sp-btn-ghost sp-btn-full" style="margin-top:10px;" onclick="stCancelEdit()">
          <i class="fas fa-arrow-left"></i> Cancel</button>` : ''}
        <button type="submit" class="sp-btn sp-btn-primary sp-btn-full" id="setupBtn">
          <i class="fas fa-save"></i> ${isEdit ? 'Update Profile' : 'Save Profile'}
        </button>
      </form>
    </div>
  </div>`

  bindPreview('sp_file','sp_preview_wrap','sp_preview_img','sp_rm')

  document.getElementById('setupForm').addEventListener('submit', async ev => {
    ev.preventDefault()
    const btn = document.getElementById('setupBtn')
    btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isEdit ? 'Updating…' : 'Saving…'}`

    const g = id => document.getElementById(id)?.value?.trim() || null

    const name     = g('sp_name')
    const email    = g('sp_email')
    const phone    = g('sp_phone')
    const gender   = g('sp_gender')
    const dept     = g('sp_dept')
    const year     = g('sp_year')

    if (!name || !email || !phone || !gender || !dept || !year) {
      showToast('Please fill all required (*) fields.', 'warning')
      btn.disabled = false; btn.innerHTML = `<i class="fas fa-save"></i> ${isEdit ? 'Update Profile' : 'Save Profile'}`
      return
    }

    // Only upload new image if a file was selected; otherwise keep existing
    let imgUrl = d.image_url || null
    if (document.getElementById('sp_file')?.files?.[0]) {
      const newUrl = await uploadImg('sp_file', ST_FOLDER, regno)
      if (newUrl) imgUrl = newUrl
    }

    const { error } = await supabase.from('student_information').upsert({
      register_no: regno, name, email, phone, gender,
      department: dept, year: parseInt(year),
      dob:            g('sp_dob')      || null,
      guardian_name:  g('sp_guardian') || null,
      linkedin:       g('sp_linkedin') || null,
      github:         g('sp_github')   || null,
      address:        g('sp_address')  || null,
      image_url: imgUrl,
      updated_at: new Date().toISOString()
    }, { onConflict: 'register_no' })

    btn.disabled = false; btn.innerHTML = `<i class="fas fa-save"></i> ${isEdit ? 'Update Profile' : 'Save Profile'}`

    if (error) { showToast('Save failed: ' + error.message, 'error'); return }

    showToast(isEdit ? 'Profile updated successfully! ✅' : 'Profile saved! 🎉', 'success')

    const { data: stu } = await supabase.from('student_information')
      .select('*').ilike('register_no', regno).maybeSingle()

    if (stu) { showSec('profile'); await renderProfile(stu); setupRT(regno) }
  })
}

// ── EDIT / CANCEL ─────────────────────────────────────────────
window.stEdit = async () => {
  if (!_regno) return
  showSec('loading')
  const { data: stu } = await supabase.from('student_information')
    .select('*').ilike('register_no', _regno).maybeSingle()
  showSec('setup')
  await renderSetup(_regno, stu || null)
}

window.stCancelEdit = async () => {
  if (!_regno) return
  showSec('loading')
  const { data: stu } = await supabase.from('student_information')
    .select('*').ilike('register_no', _regno).maybeSingle()
  // FIX: null guard — if profile missing, go to setup
  if (stu) { showSec('profile'); await renderProfile(stu); setupRT(_regno) }
  else     { showSec('setup'); await renderSetup(_regno, null) }
}

// ── RENDER PROFILE ────────────────────────────────────────────
async function renderProfile(stu) {
  const c = document.getElementById('secProfile'); if (!c) return
  const sfx = ['','st','nd','rd','th'][Math.min(stu.year || 1, 4)] || 'th'

  const photo = stu.image_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(stu.name || stu.register_no)}&background=00f5d4&color=020c1b&size=200&bold=true`

  const gIco = { Male: 'fas fa-mars', Female: 'fas fa-venus', Other: 'fas fa-transgender' }[stu.gender] || 'fas fa-user'

  c.innerHTML = `
  <div class="st-wrap">
    <div>
      <div class="sp-glass st-prof-hero sp-up">
        <div class="st-av-wrap">
          <img src="${photo}" alt="${esc(stu.name)}" class="st-av"
               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(stu.name || stu.register_no)}&background=00f5d4&color=020c1b&size=200&bold=true'" />
          <div class="st-av-ring"></div>
        </div>
        <div class="st-prof-info">
          <div class="st-prof-name">${esc(stu.name || stu.register_no)}</div>
          <div class="st-prof-regno">${esc(stu.register_no)}</div>
          <div class="st-prof-dept">${esc(stu.department || '')}${stu.year ? ` &bull; ${stu.year}${sfx} Year` : ''}</div>
          <div class="st-badges">
            ${stu.gender    ? `<span class="sp-badge sp-badge-cyan"><i class="${gIco}"></i> ${esc(stu.gender)}</span>` : ''}
            ${stu.department? `<span class="sp-badge sp-badge-blue"><i class="fas fa-book"></i> ${esc(stu.department.split(' ').pop())}</span>` : ''}
            ${stu.year      ? `<span class="sp-badge sp-badge-gold"><i class="fas fa-layer-group"></i> Year ${stu.year}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="st-prof-actions sp-up">
        <button class="sp-btn sp-btn-ghost" onclick="stEdit()"><i class="fas fa-edit"></i> Edit Profile</button>
        <button class="sp-btn sp-btn-danger" onclick="stLogout()"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
      </div>
      <div class="sp-glass st-info-grid sp-up">
        ${infoItem('fas fa-envelope','Email',stu.email)}
        ${infoItem('fas fa-phone','Phone',stu.phone)}
        ${infoItem('fas fa-venus-mars','Gender',stu.gender)}
        ${infoItem('fas fa-birthday-cake','Date of Birth',stu.dob)}
        ${infoItem('fas fa-shield-alt','Guardian',stu.guardian_name)}
        ${infoItem('fas fa-map-marker-alt','Address',stu.address)}
        ${stu.linkedin ? `<div class="st-info-item"><i class="fab fa-linkedin"></i><div>
          <span class="st-il">LinkedIn</span>
          <a href="${esc(stu.linkedin)}" target="_blank" rel="noopener" class="st-link">View Profile <i class="fas fa-external-link-alt"></i></a>
        </div></div>` : ''}
        ${stu.github ? `<div class="st-info-item"><i class="fab fa-github"></i><div>
          <span class="st-il">GitHub</span>
          <a href="${esc(stu.github)}" target="_blank" rel="noopener" class="st-link">View Profile <i class="fas fa-external-link-alt"></i></a>
        </div></div>` : ''}
      </div>
    </div>
    <div>
      <div id="attSec"  class="sp-up"></div>
      <div id="examSec" class="sp-up"></div>
      <div id="achSec"  class="sp-up"></div>
    </div>
  </div>`

  setTimeout(initFadeUp, 80)
  await Promise.all([
    loadAtt(stu.register_no),
    loadExam(stu.register_no),
    loadAchievements(stu.register_no)
  ])
}

function infoItem(ico, lbl, val) {
  if (!val) return ''
  return `<div class="st-info-item"><i class="${ico}"></i><div>
    <span class="st-il">${lbl}</span>
    <span class="st-iv">${esc(val)}</span>
  </div></div>`
}

// ── ATTENDANCE ────────────────────────────────────────────────
async function loadAtt(regno) {
  const c = document.getElementById('attSec'); if (!c) return
  const { data } = await supabase.from('attendance_information')
    .select('*').ilike('register_no', regno).maybeSingle()

  if (!data || (!data.total_days && !data.present_days)) {
    c.innerHTML = pendHTML('fas fa-calendar-times','rgba(59,130,246,0.12)','#93c5fd',
      'Attendance Not Updated Yet',
      'Your teacher hasn\'t recorded any sessions yet. Check back after classes begin.')
    return
  }

  const total   = +data.total_days   || 0
  const present = +data.present_days || 0
  const absent  = Math.max(0, total - present)
  const pct     = total > 0 ? (present / total * 100).toFixed(1) : '0.0'
  const pNum    = parseFloat(pct)
  const col     = pNum >= 75 ? 'var(--sp-green)' : pNum >= 65 ? 'var(--sp-gold)' : 'var(--sp-red)'
  const R = 54, circ = 2 * Math.PI * R
  const dashoff = circ * (1 - Math.min(pNum, 100) / 100)

  let warnTxt = '', warnCls = 'saw-good'
  if (pNum >= 75) {
    warnTxt = '✅ Good standing! Attendance meets the 75% requirement.'
  } else if (pNum >= 65) {
    const need = Math.ceil((0.75 * total - present) / 0.25)
    warnTxt = `⚠️ Low attendance! Attend <strong>${Math.max(0, need)}</strong> more consecutive classes to reach 75%.`
    warnCls = 'saw-mid'
  } else {
    warnTxt = '🚨 Critical attendance! Immediate improvement required.'
    warnCls = 'saw-bad'
  }

  const absArr = Array.isArray(data.absent_details) ? data.absent_details : []
  const absHtml = absArr.length ? `
    <div class="st-abs-wrap">
      <div class="st-abs-title"><i class="fas fa-times-circle"></i> Absent Sessions (${absArr.length})</div>
      <div class="st-abs-chips">
        ${absArr.slice(0, 30).map(d => {
          const dateStr = d.date
            ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            : '—'
          const subjStr = d.subject_name ? ` · ${d.subject_name}` : ''
          return `<span class="st-abs-chip"><i class="fas fa-calendar-times"></i>${dateStr}${d.period ? ` · P${d.period}` : ''}${subjStr}</span>`
        }).join('')}
        ${absArr.length > 30 ? `<span class="st-abs-chip st-abs-more">+${absArr.length - 30} more</span>` : ''}
      </div>
    </div>` : ''

  const periodStats = Array.isArray(data.period_stats) ? data.period_stats : []
  const dayStatsHtml = periodStats.length ? `
    <div class="st-day-stats">
      <div class="st-abs-title"><i class="fas fa-chart-bar"></i> Daily Attendance Breakdown</div>
      <div class="st-day-grid">
        ${periodStats.slice(-14).map(d => {
          const pctD  = d.total > 0 ? ((d.present / d.total) * 100).toFixed(0) : 0
          const colD  = pctD >= 75 ? 'var(--sp-green)' : pctD >= 50 ? 'var(--sp-gold)' : 'var(--sp-red)'
          const dateStr = d.date
            ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            : d.date
          return `<div class="st-day-card">
            <div class="st-day-date">${dateStr}</div>
            <div class="st-day-bar-wrap"><div class="st-day-bar" style="height:${pctD}%;background:${colD}"></div></div>
            <div class="st-day-pct" style="color:${colD}">${pctD}%</div>
            <div class="st-day-sub">${d.present}/${d.total} periods</div>
          </div>`
        }).join('')}
      </div>
    </div>` : ''

  c.innerHTML = `
  <div class="sp-glass st-att-card">
    <div class="st-att-heading"><i class="fas fa-calendar-check"></i> Attendance Record</div>
    <div class="st-att-body">
      <div class="st-donut-wrap">
        <svg viewBox="0 0 124 124" class="st-donut-svg">
          <circle cx="62" cy="62" r="${R}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
          <circle cx="62" cy="62" r="${R}" fill="none" stroke="${col}"
            stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${dashoff.toFixed(2)}"
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
        ${statBox(absent, 'Absent', 'fas fa-times','rgba(244,63,94,0.14)','var(--sp-red)','rgba(244,63,94,0.1)')}
        ${statBox(total,  'Total Days','fas fa-calendar-alt','rgba(59,130,246,0.14)','#93c5fd','rgba(59,130,246,0.1)')}
      </div>
    </div>
    <div class="st-att-warn ${warnCls}">${warnTxt}</div>
    ${dayStatsHtml}
    ${absHtml}
  </div>`
}

function statBox(n, lbl, ico, icoBg, icoCol, cardBg) {
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
    .select('*').ilike('register_no', regno).maybeSingle()

  if (!data?.exam_data || Object.keys(data.exam_data).length === 0) {
    c.innerHTML = pendHTML('fas fa-file-alt','rgba(139,92,246,0.12)','#c4b5fd',
      'Exam Results Not Available',
      'Results will appear here after admin enters your marks.')
    return
  }

  const examData = data.exam_data
  const semKeys  = Object.keys(examData).sort((a,b) => parseInt(a.replace('sem','')) - parseInt(b.replace('sem','')))

  const typeCfg = {
    ciat1: { label: 'CIAT – I',          ico: 'fas fa-pencil-alt',     col: '#3b82f6' },
    ciat2: { label: 'CIAT – II',         ico: 'fas fa-pen-nib',        col: '#8b5cf6' },
    final: { label: 'Final Examination', ico: 'fas fa-graduation-cap', col: '#f43f5e' }
  }

  c.innerHTML = `
  <div class="sp-glass st-exam-card">
    <div class="st-exam-heading"><i class="fas fa-file-alt"></i> Exam Results</div>
    <div class="st-sem-tabs">
      ${semKeys.map((sk, i) => {
        const n = parseInt(sk.replace('sem',''))
        return `<button class="st-sem-tab${i === 0 ? ' act' : ''}" data-sem="${sk}" onclick="stSem('${sk}')">Sem ${n}</button>`
      }).join('')}
    </div>
    ${semKeys.map((sk, si) => `
    <div id="sp_${sk}" class="st-sem-panel${si > 0 ? ' hide' : ''}">
      ${Object.keys(typeCfg).map(typ => {
        const rows = examData[sk]?.[typ]
        if (!rows?.length) return ''
        const cfg    = typeCfg[typ]
        const tot    = rows.reduce((s, r) => s + (+r.marks || 0), 0)
        const maxTot = rows.reduce((s, r) => s + (+r.max   || 100), 0)
        const passN  = rows.filter(r => {
          const p = r.max > 0 ? r.marks / r.max * 100 : 0
          return typ === 'final' ? p >= 50 : p >= 40
        }).length
        return `
        <div class="st-exam-block" style="border-top:3px solid ${cfg.col}">
          <div class="st-exam-block-hdr">
            <div class="st-exam-block-ico" style="background:${cfg.col}22;color:${cfg.col}"><i class="${cfg.ico}"></i></div>
            <div>
              <div class="st-exam-block-name">${cfg.label}</div>
              <div class="st-exam-block-meta">${passN}/${rows.length} Pass &bull; Avg: ${rows.length ? (tot/rows.length).toFixed(1) : 0}/${maxTot > 0 ? (maxTot/rows.length).toFixed(0) : 100}</div>
            </div>
          </div>
          <div class="st-tbl-wrap"><table class="st-tbl">
            <thead><tr><th>Subject</th><th>Code</th><th>Marks</th><th>Max</th><th>%</th><th>Status</th></tr></thead>
            <tbody>
              ${rows.map(r => {
                const mx   = +r.max   || 100
                const ob   = +r.marks || 0
                const p    = mx > 0 ? (ob / mx * 100).toFixed(1) : '—'
                const pass = typ === 'final' ? (ob / mx * 100) >= 50 : (ob / mx * 100) >= 40
                return `<tr>
                  <td class="st-sname">${esc(r.subject || r.subject_name || '—')}</td>
                  <td>${r.code || r.subject_code ? `<span class="st-scode">${esc(r.code || r.subject_code)}</span>` : '—'}</td>
                  <td><strong>${ob}</strong></td><td>${mx}</td><td>${p}%</td>
                  <td><span class="st-chip ${pass ? 'st-chip-pass' : 'st-chip-fail'}">
                    <i class="fas fa-${pass ? 'check' : 'times'}"></i>${pass ? 'Pass' : 'Fail'}
                  </span></td>
                </tr>`
              }).join('')}
            </tbody>
            <tfoot><tr>
              <td colspan="2"><strong>Total</strong></td>
              <td><strong>${tot.toFixed(1)}</strong></td>
              <td>${maxTot.toFixed(0)}</td>
              <td><strong>${maxTot > 0 ? (tot / maxTot * 100).toFixed(1) : '—'}%</strong></td>
              <td></td>
            </tr></tfoot>
          </table></div>
        </div>`
      }).join('')}
    </div>`).join('')}
  </div>`

  window.stSem = sk => {
    document.querySelectorAll('.st-sem-tab').forEach(t => t.classList.toggle('act', t.dataset.sem === sk))
    document.querySelectorAll('[id^="sp_sem"]').forEach(p => p.classList.toggle('hide', p.id !== 'sp_' + sk))
  }
}

// ── ACHIEVEMENTS ──────────────────────────────────────────────
async function loadAchievements(regno) {
  const c = document.getElementById('achSec'); if (!c) return

  const { data } = await supabase.from('student_achievements')
    .select('*').ilike('register_no', regno).order('date_achieved', { ascending: false })

  const typeBadge = {
    academic:  { lbl: 'Academic',  col: '#3b82f6' },
    sports:    { lbl: 'Sports',    col: '#10b981' },
    cultural:  { lbl: 'Cultural',  col: '#f59e0b' },
    technical: { lbl: 'Technical', col: '#8b5cf6' },
    general:   { lbl: 'General',   col: '#64748b' },
  }

  const listHtml = !data?.length
    ? `<div class="st-ach-empty">
        <i class="fas fa-trophy"></i>
        <p>No achievements added yet. Add your first achievement!</p>
      </div>`
    : `<div class="st-ach-grid">
        ${data.map(a => {
          const tb     = typeBadge[a.achievement_type || 'general'] || typeBadge.general
          const certBtn = a.certificate_url
            ? `<a href="${esc(a.certificate_url)}" target="_blank" rel="noopener" class="st-ach-cert-btn">
                <i class="fas fa-certificate"></i> View Certificate</a>` : ''
          return `<div class="st-ach-card">
            ${a.certificate_url && /\.(jpg|jpeg|png|webp|gif)$/i.test(a.certificate_url)
              ? `<div class="st-ach-img-wrap">
                  <img src="${esc(a.certificate_url)}" alt="${esc(a.title)}" class="st-ach-img"
                       onerror="this.parentElement.style.display='none'" /></div>` : ''}
            <div class="st-ach-body">
              <div class="st-ach-top">
                <span class="st-ach-badge" style="background:${tb.col}22;color:${tb.col}">${tb.lbl}</span>
                ${a.date_achieved ? `<span class="st-ach-date"><i class="fas fa-calendar"></i> ${a.date_achieved}</span>` : ''}
              </div>
              <div class="st-ach-title">${esc(a.title)}</div>
              ${a.description ? `<div class="st-ach-desc">${esc(a.description)}</div>` : ''}
              ${certBtn}
            </div>
          </div>`
        }).join('')}
      </div>`

  c.innerHTML = `
  <div class="sp-glass st-ach-card">
    <div class="st-exam-heading"><i class="fas fa-trophy"></i> Achievements</div>
    ${listHtml}
    <button class="sp-btn sp-btn-ghost st-ach-add-btn" onclick="openAchModal('${esc(regno)}')">
      <i class="fas fa-plus-circle"></i> Add Achievement
    </button>
  </div>

  <!-- Achievement Modal -->
  <div id="achModal" class="sp-modal-overlay" style="display:none">
    <div class="sp-modal-box">
      <div class="sp-modal-hdr">
        <h3><i class="fas fa-trophy"></i> Add Achievement</h3>
        <button class="sp-modal-close" onclick="closeAchModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="sp-modal-body">
        <form id="achForm">
          <div class="sp-fg"><label>Title *</label>
            <input id="ach_title" class="sp-inp" placeholder="e.g. First Place — Hackathon 2024" required /></div>
          <div class="sp-fg"><label>Category</label>
            <select id="ach_type" class="sp-inp">
              <option value="general">General</option>
              <option value="academic">Academic</option>
              <option value="sports">Sports</option>
              <option value="cultural">Cultural</option>
              <option value="technical">Technical</option>
            </select></div>
          <div class="sp-fg"><label>Date Achieved</label>
            <input id="ach_date" class="sp-inp" type="date" /></div>
          <div class="sp-fg"><label>Description</label>
            <textarea id="ach_desc" class="sp-inp sp-ta" rows="2" placeholder="Brief description"></textarea></div>
          <div class="sp-fg">
            <label>Certificate / Image <span class="sp-opt">(optional)</span></label>
            <div class="sp-upload-area" id="ach_upload_area">
              <input type="file" id="ach_file" accept="image/*,application/pdf" />
              <i class="fas fa-file-upload sp-upload-ico"></i>
              <div class="sp-upload-txt"><strong>Click or drag &amp; drop</strong><br>Image or PDF — max 5MB</div>
            </div>
            <div class="sp-preview-wrap" id="ach_preview_wrap">
              <img id="ach_preview_img" src="" alt="Preview" />
              <button type="button" class="sp-preview-rm" id="ach_rm"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <button type="submit" class="sp-btn sp-btn-primary sp-btn-full" id="achSaveBtn">
            <i class="fas fa-save"></i> Save Achievement
          </button>
        </form>
      </div>
    </div>
  </div>`

  bindPreview('ach_file','ach_preview_wrap','ach_preview_img','ach_rm')

  // FIX: always re-wire the form after injecting HTML
  document.getElementById('achForm')?.addEventListener('submit', async ev => {
    ev.preventDefault()
    const btn   = document.getElementById('achSaveBtn')
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'

    const title = document.getElementById('ach_title')?.value.trim()
    const type  = document.getElementById('ach_type')?.value
    const date  = document.getElementById('ach_date')?.value
    const desc  = document.getElementById('ach_desc')?.value.trim()

    if (!title) {
      showToast('Title is required.', 'error')
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Achievement'; return
    }

    const certUrl = await uploadImg('ach_file', ACH_FOLDER, regno + '_ach')

    const { error } = await supabase.from('student_achievements').insert({
      register_no: regno, title,
      achievement_type: type,
      date_achieved:    date || null,
      description:      desc || null,
      certificate_url:  certUrl || null
    })

    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Achievement'

    if (error) { showToast('Save failed: ' + error.message, 'error'); return }

    showToast('Achievement saved! 🏆', 'success')
    closeAchModal()
    await loadAchievements(regno)
  })
}

window.openAchModal = () => {
  const m = document.getElementById('achModal'); if (!m) return
  m.style.display = 'flex'
  setTimeout(() => m.classList.add('sp-modal-visible'), 10)
}

window.closeAchModal = () => {
  const m = document.getElementById('achModal'); if (!m) return
  m.classList.remove('sp-modal-visible')
  setTimeout(() => m.style.display = 'none', 300)
}

// ── PENDING PLACEHOLDER ───────────────────────────────────────
function pendHTML(ico, bg, col, title, sub) {
  return `<div class="sp-glass st-pend" style="border-top:3px solid ${col}">
    <div class="st-pend-ico" style="background:${bg};color:${col}"><i class="${ico}"></i></div>
    <div class="st-pend-title">${title}</div>
    <div class="st-pend-sub">${sub}</div>
  </div>`
}

// ── REALTIME ──────────────────────────────────────────────────
function setupRT(regno) {
  // FIX: always remove old channel before creating new one
  if (_rtCh) { supabase.removeChannel(_rtCh); _rtCh = null }

  _rtCh = supabase.channel('st-rt-' + regno)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_information' },
      () => loadAtt(regno))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_information' },
      () => loadExam(regno))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_achievements' },
      () => loadAchievements(regno))
    .subscribe()
}