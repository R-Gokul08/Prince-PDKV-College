// ================================================================
// Teacher.js v2 (debugged)
// Fixes:
//   - _selStu Set reassignment bug (was reassigning to new Set, losing
//     reference — now mutate existing Set via clear()+add())
//   - saveAtt: btn always re-enabled on error paths
//   - Realtime channel cleaned up on re-login
//   - showSec: key construction corrected
//   - Modal close null guards added
//   - selDept: correct Set mutation
// TASK 1: Teacher profile image saved to image_files/Teacher_images/
//         and displayed prominently near name/details in profile
// TASK 2: Classroom creation stored in classrooms Supabase table
// ================================================================
import { supabase } from './supabaseClient.js'
import {
  initStickyHeader, initHamburger, initScrollAnimations,
  showToast, initAuth, openAuthModal, logoutUser,
  getCurrentUser, initRipple, initPageTransitions, initPasswordToggles
} from './shared.js'

const BUCKET   = 'image_files'
const TCH_FOLD = 'Teacher_images'
const SESS_KEY = 'pdkv_tc_regno'

const DEPTS = [
  'Computer Science & Engineering','Artificial Intelligence & Data Science',
  'Cyber Security','Electronics & Communication Engineering',
  'Electrical & Electronics Engineering','Mechanical Engineering',
  'Civil Engineering','Mathematics','Physics','Chemistry','English',
  'MBA','M.Tech CSE','M.Tech VLSI'
]
const DESIGS = [
  'Professor & Head','Professor','Associate Professor','Assistant Professor',
  'Senior Lecturer','Lecturer','Lab Instructor','Teaching Assistant'
]

let _regno  = null
let _profile = null
let _stus   = []
let _rooms  = []
// FIX: never reassign this Set — always mutate it
const _selStu = new Set()
let _attSt  = {}
let _attStus = []
let _rtCh   = null

// ── BOOT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader(); initHamburger(); initPageTransitions(); initRipple()

  const saved = sessionStorage.getItem(SESS_KEY)
  if (saved) {
    _regno = saved
    showSec('loading')
    loadPortal(saved)
  } else {
    showSec('login')
  }

  document.getElementById('loginForm')?.addEventListener('submit', doLogin)
  document.getElementById('headerLoginBtn')
    ?.addEventListener('click', () => openAuthModal('login'))
  document.querySelectorAll('.global-header-logout')
    .forEach(b => b.addEventListener('click', () => logoutUser()))

  initAuth()
  initPasswordToggles(document.getElementById('secLogin'))
  initFU()
})

function initFU() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en, i) => {
      if (en.isIntersecting) {
        setTimeout(() => en.target.classList.add('v'), i * 72)
        obs.unobserve(en.target)
      }
    })
  }, { threshold: .07, rootMargin: '0px 0px -16px 0px' })
  document.querySelectorAll('.tu:not(.v)').forEach(el => obs.observe(el))
}

// ── SECTION SWITCHER ──────────────────────────────────────────
function showSec(id) {
  ['login','loading','setup','profile'].forEach(s => {
    // FIX: correct capitalisation for secLogin, secLoading etc.
    const key = 'sec' + s.charAt(0).toUpperCase() + s.slice(1)
    const el  = document.getElementById(key)
    if (el) el.style.display = s === id ? 'block' : 'none'
  })
  setTimeout(initFU, 75)
}

// ── ESCAPE ────────────────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) }
  catch { return d }
}
function sfx(n) { return { 1:'st', 2:'nd', 3:'rd', 4:'th' }[n] || 'th' }

// ── LOGIN ─────────────────────────────────────────────────────
async function doLogin(e) {
  e.preventDefault()
  const regno = document.getElementById('inRegno')?.value?.trim().toUpperCase()
  const pass  = document.getElementById('inPass')?.value
  if (!regno || !pass) { setMsg('Enter Register No. & Password', 'err'); showToast('Enter Register No. & Password', 'warning'); return }

  const btn = document.getElementById('loginBtn')
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In…'
  clearMsg()

  const [credRes, profileRes] = await Promise.all([
    supabase.from('teacher_credentials').select('password').eq('register_no', regno).maybeSingle(),
    supabase.from('teacher_information').select('*').ilike('register_no', regno).maybeSingle()
  ])

  btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'

  if (credRes.error || !credRes.data)      { setMsg('Register number not found.', 'err'); showToast('Register number not found.', 'error'); return }
  if (credRes.data.password !== pass)       { setMsg('Incorrect password.', 'err'); showToast('Incorrect password.', 'error'); return }

  sessionStorage.setItem(SESS_KEY, regno)
  _regno = regno
  showToast(`Welcome, Teacher ${regno}!`, 'success')

  const t = profileRes.data || null
  if (!t) {
    showSec('setup'); await renderSetup(regno, null)
  } else {
    _profile = t; showSec('profile'); await renderProfile(t)
  }
}

function setMsg(txt, tp) {
  const e = document.getElementById('loginMsg'); if (!e) return
  e.className = `tc-msg tc-${tp}`
  e.innerHTML = `<i class="fas fa-${tp === 'err' ? 'exclamation-circle' : 'check-circle'}"></i> ${txt}`
  e.style.display = 'flex'
}
function clearMsg() { const e = document.getElementById('loginMsg'); if (e) e.style.display = 'none' }

window.tcLogout = () => {
  sessionStorage.removeItem(SESS_KEY); _regno = null; _profile = null
  // FIX: clean up realtime on logout
  if (_rtCh) { supabase.removeChannel(_rtCh); _rtCh = null }
  showSec('login')
  showToast('Logged out.', 'info')
}

// ── TASK 1: IMAGE UPLOAD ──────────────────────────────────────
// Saves teacher photo to image_files/Teacher_images/<regno>.<ext>
async function uploadImg(fileInputId, folder, key) {
  const inp = document.getElementById(fileInputId)
  const f   = inp?.files?.[0]
  if (!f) return null
  const ext  = f.name.split('.').pop().toLowerCase()
  // Stable filename = register_no.ext — same path, upsert overwrites old photo
  const storagePath = `${folder}/${key}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, f, { upsert: true, contentType: f.type })
  if (error) { showToast('Upload failed: ' + error.message, 'error'); return null }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  // Cache-bust so browser does not serve stale image
  return publicUrl + '?t=' + Date.now()
}

// TASK 1: Resolve teacher photo — from DB url or storage listing
async function resolveTeacherPhoto(regno, savedUrl) {
  // If DB has a URL already, refresh its cache-bust and return it
  if (savedUrl && savedUrl.startsWith('http')) {
    const base = savedUrl.split('?')[0]
    return base + '?t=' + Date.now()
  }
  // No DB url — try listing the Teacher_images folder filtered by this regno
  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(TCH_FOLD, { search: regno })
    if (!error && files && files.length > 0) {
      const match = files.find(f2 => f2.name && (f2.name.startsWith(regno + '.') || f2.name === regno))
      if (match) {
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(`${TCH_FOLD}/${match.name}`)
        return publicUrl + '?t=' + Date.now()
      }
    }
  } catch (_) { /* storage list failed — fall through to avatar */ }
  return null
}

function bindPrev(fId, wId, iId, rmId) {
  document.getElementById(fId)?.addEventListener('change', () => {
    const f = document.getElementById(fId).files[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => {
      const img  = document.getElementById(iId)
      const wrap = document.getElementById(wId)
      if (img)  img.src = ev.target.result
      if (wrap) wrap.classList.add('show')
    }
    r.readAsDataURL(f)
  })
  document.getElementById(rmId)?.addEventListener('click', () => {
    const fi   = document.getElementById(fId)
    const img  = document.getElementById(iId)
    const wrap = document.getElementById(wId)
    if (fi)   fi.value = ''
    if (img)  img.src  = ''
    if (wrap) wrap.classList.remove('show')
  })
}

// ── LOAD PORTAL ───────────────────────────────────────────────
async function loadPortal(regno) {
  showSec('loading')
  const { data: t, error } = await supabase
    .from('teacher_information').select('*').ilike('register_no', regno).maybeSingle()

  if (error) { showToast('Error loading profile: ' + error.message, 'error'); showSec('login'); return }

  if (!t) {
    showSec('setup'); await renderSetup(regno, null)
  } else {
    _profile = t; showSec('profile'); await renderProfile(t)
  }
}

// ── SETUP FORM ────────────────────────────────────────────────
async function renderSetup(regno, existingData) {
  if (existingData === undefined) {
    const { data } = await supabase.from('teacher_information')
      .select('*').ilike('register_no', regno).maybeSingle()
    existingData = data || null
  }

  const isEdit = !!existingData
  const d      = existingData || {}
  const c      = document.getElementById('secSetup'); if (!c) return

  const dO  = DEPTS.map(dep  => `<option ${d.department === dep  ? 'selected' : ''}>${dep}</option>`).join('')
  const dsO = DESIGS.map(des => `<option ${d.designation === des ? 'selected' : ''}>${des}</option>`).join('')
  const gO  = ['Male','Female','Other'].map(g => `<option ${d.gender === g ? 'selected' : ''}>${g}</option>`).join('')

  c.innerHTML = `
  <div class="tc-wrap"><div class="tc-setup-outer">
    <div class="tc-setup-hdr">
      <div class="tc-setup-icon"><i class="fas fa-chalkboard-teacher"></i></div>
      <h2 class="tc-setup-h2">${isEdit ? 'Edit Your Profile' : 'Complete Your Profile'}</h2>
      <p class="tc-setup-sub">Hi <strong style="color:var(--tamb)">${esc(regno)}</strong>! ${isEdit ? 'Update your details below.' : 'Fill your details to activate the portal.'}</p>
    </div>
    <div class="tg tc-setup-card">
      <form id="setupForm" novalidate>
        <div class="tgrid">
          <div class="tdiv"><span class="tdiv-lbl"><i class="fas fa-user"></i> Personal</span><div class="tdiv-line"></div></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-id-badge"></i> Register No</label>
            <input class="ti" value="${esc(regno)}" readonly /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-user"></i> Full Name *</label>
            <input id="f_name" class="ti" value="${esc(d.name||'')}" placeholder="Dr. / Mr. / Ms. Full Name" required /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-envelope"></i> Email *</label>
            <input id="f_email" type="email" class="ti" value="${esc(d.email||'')}" placeholder="your@email.com" required /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-phone"></i> Phone *</label>
            <input id="f_phone" type="tel" class="ti" value="${esc(d.phone||'')}" placeholder="+91 99999 99999" required /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-venus-mars"></i> Gender *</label>
            <select id="f_gender" class="ts" required><option value="">Select</option>${gO}</select></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-calendar-alt"></i> Date of Joining</label>
            <input id="f_joining" type="date" class="ti" value="${esc(d.joining_date||'')}" /></div>
          <div class="tdiv"><span class="tdiv-lbl"><i class="fas fa-graduation-cap"></i> Professional</span><div class="tdiv-line"></div></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-building"></i> Department *</label>
            <select id="f_dept" class="ts" required><option value="">Select</option>${dO}</select></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-user-tie"></i> Designation *</label>
            <select id="f_desig" class="ts" required><option value="">Select</option>${dsO}</select></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-award"></i> Qualification *</label>
            <input id="f_qual" class="ti" value="${esc(d.qualification||'')}" placeholder="e.g. M.E., Ph.D" required /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-briefcase"></i> Experience</label>
            <input id="f_exp" class="ti" value="${esc(d.experience||'')}" placeholder="e.g. 8 Years" /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-flask"></i> Specialization</label>
            <input id="f_spec" class="ti" value="${esc(d.specialization||'')}" placeholder="e.g. Machine Learning" /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-hashtag"></i> Employee ID</label>
            <input id="f_empid" class="ti" value="${esc(d.employee_id||'')}" placeholder="e.g. PDKV-TCH-001" /></div>
          <div class="tg-fg tgfull"><label class="tl"><i class="fas fa-book-open"></i> Subjects Handling</label>
            <input id="f_subjects" class="ti" value="${esc(d.subjects||'')}" placeholder="e.g. Data Structures, DBMS (comma separated)" /></div>
          <div class="tdiv"><span class="tdiv-lbl"><i class="fas fa-map-marker-alt"></i> Address &amp; Photo</span><div class="tdiv-line"></div></div>
          <div class="tg-fg tgfull"><label class="tl"><i class="fas fa-home"></i> Address</label>
            <textarea id="f_addr" class="tta" placeholder="Your residential address">${esc(d.address||'')}</textarea></div>
          <div class="tg-fg tgfull">
            <label class="tl"><i class="fas fa-camera"></i> Profile Photo *
              <span style="opacity:.4;font-weight:400">${isEdit ? '(leave blank to keep existing)' : '(required — will be saved to Teacher_images)'}</span></label>
            ${d.image_url ? `<div class="tc-existing-photo" style="margin-bottom:10px">
              <img src="${esc(d.image_url)}" onerror="this.parentElement.style.display='none'" />
              <span>Current photo — upload new to replace</span></div>` : ''}
            <div class="tc-upload" id="tUpArea">
              <input type="file" id="f_img" accept="image/*" ${!isEdit && !d.image_url ? 'required' : ''} />
              <span class="tc-upload-ico"><i class="fas fa-cloud-upload-alt"></i></span>
              <div class="tc-upload-txt"><strong>Click or drag &amp; drop your photo</strong><br><small>JPG, PNG — max 5 MB • Saved to Teacher_images folder</small></div>
            </div>
            <div class="tc-img-prev" id="tImgPrev">
              <img id="tImgPrevImg" src="" alt="" />
              <button type="button" class="tc-img-rm" id="tImgRm"><i class="fas fa-times"></i></button>
            </div>
          </div>
        </div>
        ${isEdit ? `<button type="button" class="tb tb-ghost tb-full" style="margin-top:8px" onclick="tcCancelEdit()">
          <i class="fas fa-arrow-left"></i> Cancel</button>` : ''}
        <button type="submit" class="tb tb-pri tb-full" id="setupBtn" style="margin-top:8px">
          <i class="fas fa-save"></i> ${isEdit ? 'Update My Profile' : 'Save My Profile'}
        </button>
      </form>
    </div>
  </div></div>`

  bindPrev('f_img','tImgPrev','tImgPrevImg','tImgRm')
  setTimeout(initFU, 55)

  document.getElementById('setupForm').addEventListener('submit', async ev => {
    ev.preventDefault()
    const btn = document.getElementById('setupBtn')
    btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isEdit ? 'Updating…' : 'Saving…'}`

    const g = id => document.getElementById(id)?.value?.trim() || null
    const name  = g('f_name'); const email = g('f_email')
    const phone = g('f_phone'); const gender = g('f_gender')
    const dept  = g('f_dept');  const desig  = g('f_desig'); const qual = g('f_qual')

    if (!name || !email || !phone || !gender || !dept || !desig || !qual) {
      showToast('Fill required fields (*)', 'warning')
      btn.disabled = false; btn.innerHTML = `<i class="fas fa-save"></i> ${isEdit ? 'Update My Profile' : 'Save My Profile'}`; return
    }

    // TASK 1: Upload image to image_files/Teacher_images/<regno>.<ext>
    let imgUrl = d.image_url || null
    const imgFile = document.getElementById('f_img')?.files?.[0]
    if (imgFile) {
      showToast('Uploading photo to Teacher_images…', 'info', 2500)
      // key = regno so path = Teacher_images/TCH001.jpg — always consistent
      const newUrl = await uploadImg('f_img', TCH_FOLD, regno)
      if (newUrl) {
        imgUrl = newUrl
        showToast('Photo uploaded successfully! ✅', 'success', 2000)
      }
    } else if (!isEdit && !d.image_url) {
      showToast('Please upload a profile photo.', 'warning')
      btn.disabled = false; btn.innerHTML = `<i class="fas fa-save"></i> Save My Profile`; return
    }

    const { error } = await supabase.from('teacher_information').upsert({
      register_no: regno, name, email, phone, gender,
      department:     dept, designation: desig, qualification: qual,
      experience:     g('f_exp'),     specialization: g('f_spec'),
      employee_id:    g('f_empid'),   subjects:        g('f_subjects'),
      joining_date:   g('f_joining'), address:         g('f_addr'),
      image_url: imgUrl, updated_at: new Date().toISOString()
    }, { onConflict: 'register_no' })

    btn.disabled = false; btn.innerHTML = `<i class="fas fa-save"></i> ${isEdit ? 'Update My Profile' : 'Save My Profile'}`

    if (error) { showToast('Failed: ' + error.message, 'error'); return }

    showToast(isEdit ? 'Profile updated! ✅' : 'Profile saved! 🎉', 'success')

    // Re-fetch the saved record from DB so we have all fields
    const { data: t } = await supabase.from('teacher_information')
      .select('*').ilike('register_no', regno).maybeSingle()

    if (t) {
      // TASK 1: If we just uploaded a new image, inject the fresh URL so renderProfile
      // shows it immediately without waiting for storage listing
      if (imgUrl) t.image_url = imgUrl
      _profile = t
      showSec('profile')
      await renderProfile(t)
    }
  })
}

// ── EDIT / CANCEL ─────────────────────────────────────────────
window.tcEdit = async () => {
  if (!_regno) return
  showSec('setup')
  await renderSetup(_regno, _profile || null)
}

window.tcCancelEdit = () => {
  if (!_regno) return
  showSec('profile')
}

// ── TASK 1: RENDER PROFILE ────────────────────────────────────
// Teacher photo displayed prominently at top center, above name and details
async function renderProfile(t) {
  const c = document.getElementById('secProfile'); if (!c) return

  const fallbackPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name || t.register_no)}&background=ff9f1c&color=060912&size=200&bold=true`

  // TASK 1: If DB already has a URL (e.g. freshly injected after upload), use it immediately
  let photo
  if (t.image_url && t.image_url.startsWith('http')) {
    // Refresh cache-bust so browser always fetches the latest version
    photo = t.image_url.split('?')[0] + '?t=' + Date.now()
  } else {
    // No URL in DB — try storage listing (first-time or URL lost)
    const found = await resolveTeacherPhoto(t.register_no, null)
    photo = found || fallbackPhoto
    // Silently save the found URL back to DB for next time
    if (found) {
      supabase.from('teacher_information')
        .update({ image_url: found })
        .ilike('register_no', t.register_no)
        .then(() => {})
    }
  }

  const subjs = t.subjects ? t.subjects.split(',').map(s => s.trim()).filter(Boolean) : []

  // TASK 1: Photo displayed at TOP CENTER above name with large avatar ring
  // The photo is prominently placed as the centerpiece of the profile hero
  c.innerHTML = `
  <div class="tc-wrap"><div>

    <!-- TASK 1: Profile Hero — Photo centered at top, name and details beside/below -->
    <div class="tg tc-prof-hero tu" style="flex-direction:column;align-items:center;text-align:center;padding:clamp(32px,5vw,52px) 28px 36px;">

      <!-- TASK 1: Large centered teacher photo -->
      <div class="tc-av-wrap" style="margin-bottom:20px;position:relative;width:140px;height:140px;">
        <img
          src="${photo}"
          alt="${esc(t.name || t.register_no)}"
          class="tc-av"
          id="tcProfileImg"
          style="width:140px;height:140px;border-radius:50%;object-fit:cover;display:block;
                 border:4px solid transparent;
                 background:linear-gradient(var(--tc-surface),var(--tc-surface)) padding-box,
                             linear-gradient(135deg,var(--tc-amber),var(--tc-blue2) 50%,var(--tc-teal)) border-box;
                 box-shadow:0 0 0 6px rgba(245,158,11,0.12), 0 16px 48px rgba(0,0,0,0.55);
                 transition:transform .5s cubic-bezier(0.34,1.56,0.64,1);"
          onerror="this.onerror=null;this.src='${fallbackPhoto}'"
        />
        <div class="tc-av-ring" style="position:absolute;inset:-9px;border-radius:50%;
          border:2px solid transparent;
          background:linear-gradient(var(--tc-dark),var(--tc-dark)) padding-box,
                      linear-gradient(135deg,var(--tc-amber),var(--tc-blue2),var(--tc-teal)) border-box;
          animation:tcRing 11s linear infinite;pointer-events:none;"></div>
        <!-- Photo indicator badge -->
        <div style="position:absolute;bottom:4px;right:4px;width:28px;height:28px;border-radius:50%;
          background:linear-gradient(135deg,var(--tc-amber),var(--tc-amber2));
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid var(--tc-dark);">
          <i class="fas fa-camera" style="font-size:0.58rem;color:var(--tc-void);"></i>
        </div>
      </div>

      <!-- Name, designation, dept displayed centered below photo -->
      <div class="tc-prof-info" style="z-index:1;">
        <div class="tc-prof-name" style="font-size:clamp(1.6rem,3vw,2.2rem);margin-bottom:8px;">${esc(t.name || t.register_no)}</div>
        <div class="tc-prof-desig" style="font-size:1rem;margin-bottom:4px;">${esc(t.designation || '')}</div>
        <div class="tc-prof-dept" style="font-size:0.92rem;margin-bottom:16px;">${t.department ? 'Dept. of ' + esc(t.department) : ''}</div>
        <div class="tc-prof-badges" style="justify-content:center;">
          <span class="tbd tb-amber"><i class="fas fa-id-badge"></i> ${esc(t.register_no)}</span>
          ${t.qualification ? `<span class="tbd tb-teal"><i class="fas fa-graduation-cap"></i> ${esc(t.qualification)}</span>` : ''}
          ${t.experience    ? `<span class="tbd tb-green"><i class="fas fa-briefcase"></i> ${esc(t.experience)}</span>` : ''}
          ${t.employee_id   ? `<span class="tbd tb-blue"><i class="fas fa-hashtag"></i> ${esc(t.employee_id)}</span>` : ''}
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="tc-prof-actions tu" style="justify-content:center;margin-bottom:22px;">
      <button class="tb tb-ghost" onclick="tcEdit()"><i class="fas fa-edit"></i> Edit Profile</button>
      <button class="tb tb-danger" onclick="tcLogout()"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
    </div>

    <!-- Info cards grid -->
    <div class="tc-info-grid tu">
      ${tci('fas fa-envelope','tci-amb','Email',t.email)}
      ${tci('fas fa-phone','tci-tel','Phone',t.phone)}
      ${tci('fas fa-venus-mars','tci-vio','Gender',t.gender)}
      ${tci('fas fa-calendar-alt','tci-grn','Date of Joining',t.joining_date)}
      ${tci('fas fa-hashtag','tci-amb','Employee ID',t.employee_id)}
      ${tci('fas fa-flask','tci-tel','Specialization',t.specialization)}
      ${tci('fas fa-briefcase','tci-blu','Experience',t.experience)}
      ${tci('fas fa-map-marker-alt','tci-red','Address',t.address)}
    </div>

    ${subjs.length ? `
    <div class="tg tc-subj-wrap tu">
      <div class="tc-subj-h"><i class="fas fa-book-open"></i> Subjects Handling</div>
      <div class="tc-subj-chips">${subjs.map((s,i)=>`<span class="tc-schip" style="animation-delay:${i*.06}s"><i class="fas fa-book"></i> ${esc(s)}</span>`).join('')}</div>
    </div>` : ''}

    <div id="attMgr" class="tu"></div>
  </div></div>`

  setTimeout(initFU, 80)

  const [sr, rr] = await Promise.all([
    supabase.from('student_information').select('register_no,name,year,department').order('year').order('department').order('name'),
    supabase.from('classrooms').select('*').order('created_at', { ascending: false })
  ])
  _stus  = sr.data || []
  _rooms = rr.data || []
  renderAttMgr()
}

function tci(ico, cls, lbl, val) {
  if (!val) return ''
  return `<div class="tg tc-info-card"><div class="tc-info-icon ${cls}"><i class="${ico}"></i></div><div>
    <div class="tc-info-lbl">${lbl}</div><div class="tc-info-val">${esc(val)}</div>
  </div></div>`
}

// ── ATTENDANCE MANAGER ────────────────────────────────────────
function renderAttMgr() {
  const c = document.getElementById('attMgr'); if (!c) return
  const mine = _rooms.filter(r => r.teacher_regno === _regno)
  c.innerHTML = `
  <div style="margin-top:30px">
    <div class="tc-att-hdr"><i class="fas fa-calendar-check"></i> Attendance Manager</div>
    <div class="tc-tabs">
      <button class="tc-tab on" onclick="tcTab('my',this)"><i class="fas fa-door-open"></i> My Classrooms</button>
      <button class="tc-tab" onclick="tcTab('all',this)"><i class="fas fa-list"></i> All Classrooms</button>
    </div>
    <div id="panMy" class="tc-tpanel on">
      <div style="display:flex;gap:9px;justify-content:flex-end;margin-bottom:16px">
        <button class="tb tb-pri tb-sm" onclick="openCreate()"><i class="fas fa-plus"></i> Create Classroom</button>
      </div>
      <div class="tc-cls-grid" id="gMy">${clsGrid(mine, true)}</div>
    </div>
    <div id="panAll" class="tc-tpanel">
      <div class="tc-cls-grid" id="gAll">${clsGrid(_rooms, false)}</div>
    </div>
  </div>`
}

function clsGrid(rooms, mine) {
  if (!rooms.length) return `<div class="tc-empty" style="grid-column:1/-1">
    <div class="tc-empty-ico">🏫</div>
    <div class="tc-empty-title">${mine ? 'No Classrooms Yet' : 'No Classrooms'}</div>
    <div class="tc-empty-sub">${mine ? 'Click "Create Classroom" to get started.' : 'No classrooms created yet.'}</div>
  </div>`

  let h = rooms.map(r => `
    <div class="tg tc-cls-card" onclick="openRoom('${r.id}')">
      <div class="tc-cls-ico"><i class="fas fa-door-open"></i></div>
      <div class="tc-cls-name">${esc(r.class_name)}</div>
      <div class="tc-cls-meta">
        <div><i class="fas fa-book"></i> ${esc(r.subject || '—')}</div>
        <div><i class="fas fa-user-tie"></i> ${esc(r.teacher_name || r.teacher_regno)}</div>
        ${r.department ? `<div><i class="fas fa-building"></i> ${esc(r.department)}${r.year ? ' · Year ' + r.year : ''}</div>` : ''}
      </div>
      <span class="tc-cls-cnt"><i class="fas fa-users"></i> ${(r.student_regnos || []).length} Students</span>
    </div>`).join('')

  if (mine) h += `<button class="tc-create-btn" onclick="openCreate()"><i class="fas fa-plus-circle"></i><span>Create New Classroom</span></button>`
  return h
}

window.tcTab = (t, btn) => {
  document.querySelectorAll('.tc-tab').forEach(b => b.classList.remove('on'))
  btn.classList.add('on')
  const panMy  = document.getElementById('panMy')
  const panAll = document.getElementById('panAll')
  if (panMy)  panMy.classList.toggle('on',  t === 'my')
  if (panAll) panAll.classList.toggle('on', t === 'all')
}

function refreshGrids() {
  const mine = _rooms.filter(r => r.teacher_regno === _regno)
  const gm = document.getElementById('gMy');  if (gm) gm.innerHTML  = clsGrid(mine, true)
  const ga = document.getElementById('gAll'); if (ga) ga.innerHTML  = clsGrid(_rooms, false)
}

// ── MODAL SYSTEM ──────────────────────────────────────────────
function modal(h) { document.getElementById('tcModals').innerHTML = h }

window.closeM = id => {
  const e = document.getElementById(id)
  if (e) e.classList.remove('open')
}

// ── STUDENT GROUPING ──────────────────────────────────────────
function grpStus(stus) {
  const g = {}
  stus.forEach(s => {
    const y = s.year || '?', d = s.department || 'Unknown'
    if (!g[y]) g[y] = {}
    if (!g[y][d]) g[y][d] = []
    g[y][d].push(s)
  })
  return g
}

function stuSelHTML(groups, filter = '') {
  const yrs = Object.keys(groups).map(Number).sort((a, b) => a - b)
  if (!yrs.length) return `<div style="text-align:center;padding:20px;color:var(--tmut)">No students in system.</div>`
  return yrs.map(yr => {
    const depts = Object.keys(groups[yr]).sort()
    const dh = depts.map(d => {
      let stus = groups[yr][d]
      if (filter) {
        const q = filter.toLowerCase()
        stus = stus.filter(s =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.register_no || '').toLowerCase().includes(q)
        )
      }
      if (!stus.length) return ''
      return `<div class="tc-dp-blk">
        <div class="tc-dp-title">
          <span><i class="fas fa-building"></i> ${esc(d)}</span>
          <button type="button" class="tc-dp-sall" onclick="selDept(${yr},'${encodeURIComponent(d)}')">
            ${stus.every(s => _selStu.has(s.register_no)) ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        ${stus.map(s => `
          <div class="tc-sr${_selStu.has(s.register_no) ? ' sel' : ''}" id="r-${s.register_no}" onclick="selS('${s.register_no}')">
            <div><div class="tc-sr-name">${esc(s.name || '—')}</div>
            <div class="tc-sr-meta">${s.register_no} · ${esc(d)}</div></div>
            <div class="tc-sr-chk" id="ck-${s.register_no}">${_selStu.has(s.register_no) ? '✓' : ''}</div>
          </div>`).join('')}
      </div>`
    }).join('')
    if (!dh.replace(/<[^>]*>/g, '').trim()) return ''
    return `<div class="tc-yr-blk">
      <div class="tc-yr-title"><i class="fas fa-layer-group"></i> Year ${yr}${sfx(yr)}</div>${dh}
    </div>`
  }).join('')
}

function updSelCnt(id = 'selCnt') {
  const e = document.getElementById(id)
  if (e) e.textContent = `${_selStu.size} Selected`
}

window.selS = regno => {
  // FIX: mutate the existing Set — never reassign
  _selStu.has(regno) ? _selStu.delete(regno) : _selStu.add(regno)
  const row = document.getElementById('r-' + regno)
  const chk = document.getElementById('ck-' + regno)
  if (row) row.classList.toggle('sel', _selStu.has(regno))
  if (chk) chk.textContent = _selStu.has(regno) ? '✓' : ''
  updSelCnt()
}

window.selDept = (yr, dEnc) => {
  const d     = decodeURIComponent(dEnc)
  const stus  = _stus.filter(s => s.department === d && String(s.year) === String(yr))
  const allSel = stus.every(s => _selStu.has(s.register_no))
  // FIX: mutate existing Set
  stus.forEach(s => allSel ? _selStu.delete(s.register_no) : _selStu.add(s.register_no))
  const q  = document.getElementById('stuSearch')?.value || ''
  const el = document.getElementById('stuList')
  if (el) el.innerHTML = stuSelHTML(grpStus(_stus), q)
  updSelCnt()
}

window.fltStus = () => {
  const q  = document.getElementById('stuSearch')?.value || ''
  const el = document.getElementById('stuList')
  if (el) el.innerHTML = stuSelHTML(grpStus(_stus), q)
}

// ── TASK 2: CREATE CLASSROOM ───────────────────────────────────
// Stores classroom data in the 'classrooms' Supabase table
window.openCreate = () => {
  // FIX: clear Set by mutating, not reassigning
  _selStu.clear()
  modal(`
  <div class="tc-mo open" id="mCreate">
    <div class="tc-mb tc-mb-lg">
      <div class="tc-mh">
        <div class="tc-mt"><i class="fas fa-plus-circle"></i> Create New Classroom</div>
        <button class="tc-mc" onclick="closeM('mCreate')"><i class="fas fa-times"></i></button>
      </div>
      <div class="tc-mbd">
        <div class="tgrid" style="margin-bottom:18px">
          <div class="tg-fg"><label class="tl"><i class="fas fa-door-open"></i> Classroom Name *</label>
            <input id="cc_name" class="ti" placeholder="e.g. CSE-A 3rd Year Maths" /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-book"></i> Subject *</label>
            <input id="cc_subj" class="ti" placeholder="e.g. Data Structures" /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-building"></i> Department (optional)</label>
            <input id="cc_dept" class="ti" placeholder="Filter" /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-layer-group"></i> Year (optional)</label>
            <select id="cc_year" class="ts"><option value="">Any Year</option>
              ${[1,2,3,4].map(n=>`<option value="${n}">${n}${sfx(n)} Year</option>`).join('')}
            </select></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;flex-wrap:wrap;gap:8px">
          <span style="font-size:.95rem;color:#fff;font-weight:700"><i class="fas fa-users" style="color:var(--tamb);margin-right:7px"></i>Select Students</span>
          <span class="tbd tb-teal" id="selCnt">0 Selected</span>
        </div>
        <div class="tc-msearch tg-fg"><i class="fas fa-search tc-msearch-ico"></i>
          <input id="stuSearch" class="ti" placeholder="Search name or reg no…" oninput="fltStus()" style="padding-left:37px" /></div>
        <div style="max-height:370px;overflow-y:auto;padding-right:3px" id="stuList">${stuSelHTML(grpStus(_stus))}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;padding-top:15px;border-top:1px solid var(--tbord)">
          <button class="tb tb-ghost tb-sm" onclick="closeM('mCreate')">Cancel</button>
          <button class="tb tb-pri" onclick="saveRoom()"><i class="fas fa-save"></i> Create Classroom</button>
        </div>
      </div>
    </div>
  </div>`)
}

// TASK 2: saveRoom — inserts new classroom record into 'classrooms' Supabase table
window.saveRoom = async () => {
  const name = document.getElementById('cc_name')?.value?.trim()
  const subj = document.getElementById('cc_subj')?.value?.trim()
  if (!name || !subj) { showToast('Classroom name & subject required.', 'warning'); return }
  if (_selStu.size === 0) { showToast('Select at least one student.', 'warning'); return }

  const saveBtn = document.querySelector('#mCreate .tb-pri')
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…' }

  // TASK 2: Insert into 'classrooms' table in Supabase
  const { data, error } = await supabase.from('classrooms').insert({
    teacher_regno:  _regno,
    teacher_name:   _profile?.name || _regno,
    class_name:     name,
    subject:        subj,
    department:     document.getElementById('cc_dept')?.value?.trim() || null,
    year:           parseInt(document.getElementById('cc_year')?.value) || null,
    student_regnos: [..._selStu]
  }).select().single()

  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Create Classroom' }

  if (error) { showToast('Failed to create classroom: ' + error.message, 'error'); return }

  showToast(`Classroom "${name}" created and saved! 🎉`, 'success')
  _rooms.unshift(data)
  closeM('mCreate')
  refreshGrids()
}

// ── OPEN ROOM ─────────────────────────────────────────────────
window.openRoom = async id => {
  const room = _rooms.find(r => r.id === id); if (!room) return
  const stus  = _stus.filter(s => (room.student_regnos || []).includes(s.register_no))
  // Any logged-in teacher can mark attendance and edit any classroom
  const isMine = true
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 2)
  const cutoffISO = cutoffDate.toISOString().split('T')[0]

  const { data: sessions = [] } = await supabase.from('attendance_sessions')
    .select('*').eq('classroom_id', id)
    .gte('session_date', cutoffISO)
    .order('session_date', { ascending: false }).order('period').limit(20)

  const sessRows = sessions.length
    ? sessions.map(s => `<tr>
        <td>${fmtDate(s.session_date)}</td>
        <td>Period ${s.period}</td>
        <td>${esc(s.subject_name || '—')}</td>
        <td><span class="tbd tb-teal"><i class="fas fa-users"></i> ${(room.student_regnos || []).length}</span></td>
        <td><button class="tb tb-ghost tb-sm" onclick="viewSess('${s.id}')"><i class="fas fa-eye"></i> View</button></td>
      </tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--tmut);padding:20px">No sessions yet.</td></tr>`

  modal(`
  <div class="tc-mo open" id="mRoom">
    <div class="tc-mb tc-mb-lg">
      <div class="tc-mh">
        <div class="tc-mt"><i class="fas fa-door-open"></i> ${esc(room.class_name)}</div>
        <button class="tc-mc" onclick="closeM('mRoom')"><i class="fas fa-times"></i></button>
      </div>
      <div class="tc-mbd">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:13px;margin-bottom:20px">
          <div>
            <div style="font-size:1.1rem;color:#fff;font-weight:700">${esc(room.class_name)}</div>
            <div style="font-size:.8rem;color:var(--tmut);margin-top:4px">
              <i class="fas fa-book"></i> ${esc(room.subject || '—')} &bull;
              <i class="fas fa-users"></i> ${(room.student_regnos || []).length} Students &bull;
              <i class="fas fa-user-tie"></i> ${esc(room.teacher_name || room.teacher_regno)}
            </div>
          </div>
          ${isMine ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="tb tb-green tb-sm" onclick="openMarkAtt('${id}')"><i class="fas fa-clipboard-check"></i> Mark Attendance</button>
            <button class="tb tb-ghost tb-sm" onclick="openEditRoom('${id}')"><i class="fas fa-edit"></i> Edit Students</button>
          </div>` : ''}
        </div>
        <div style="margin-bottom:20px">
          <div style="font-size:.9rem;color:#fff;font-weight:700;margin-bottom:11px"><i class="fas fa-history" style="color:var(--tamb)"></i> Recent Attendance Sessions</div>
          <div class="tc-tbl-wrap"><table class="tc-tbl">
            <thead><tr><th>Date</th><th>Period</th><th>Subject</th><th>Students</th><th>Action</th></tr></thead>
            <tbody>${sessRows}</tbody>
          </table></div>
        </div>
        <div>
          <div style="font-size:.9rem;color:#fff;font-weight:700;margin-bottom:10px"><i class="fas fa-users" style="color:var(--tamb)"></i> Students in Classroom</div>
          <div style="display:flex;flex-wrap:wrap;gap:7px">
            ${stus.map(s => `<span class="tbd tb-teal"><i class="fas fa-user"></i> ${esc(s.name || s.register_no)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`)
}

// ── MARK ATTENDANCE ───────────────────────────────────────────
window.openMarkAtt = id => {
  const room = _rooms.find(r => r.id === id); if (!room) return
  const stus = _stus.filter(s => (room.student_regnos || []).includes(s.register_no))
  _attSt = {}; stus.forEach(s => { _attSt[s.register_no] = null }); _attStus = stus
  const today = new Date().toISOString().split('T')[0]

  modal(`
  <div class="tc-mo open" id="mAtt">
    <div class="tc-mb tc-mb-md">
      <div class="tc-mh">
        <div class="tc-mt"><i class="fas fa-clipboard-check"></i> Mark Attendance — ${esc(room.class_name)}</div>
        <button class="tc-mc" onclick="closeM('mAtt');openRoom('${id}')"><i class="fas fa-times"></i></button>
      </div>
      <div class="tc-mbd">
        <div class="tc-sess-hdr">
          <div><label>Date *</label><input id="attDate" type="date" value="${today}" class="ti" style="min-width:145px" /></div>
          <div><label>Period *</label>
            <select id="attPer" class="ts" style="min-width:125px">
              ${[1,2,3,4,5,6,7,8].map(p => `<option value="${p}">Period ${p}</option>`).join('')}
            </select></div>
          <div><label>Subject Name *</label>
            <input id="attSubj" class="ti" placeholder="e.g. Python, OOPS" style="min-width:180px" /></div>
        </div>
        <div class="tc-bulk-row">
          <span class="tc-bulk-lbl">Mark All:</span>
          <button class="tb tb-green tb-sm" onclick="markAll('present')"><i class="fas fa-check-double"></i> All Present</button>
          <button class="tb tb-danger tb-sm" onclick="markAll('absent')"><i class="fas fa-times"></i> All Absent</button>
        </div>
        <div style="margin-bottom:13px">
          <div style="display:flex;justify-content:space-between;font-size:.79rem;color:var(--tmut);margin-bottom:5px">
            <span>Marked: <strong id="markedN" style="color:var(--tamb)">0</strong> / ${stus.length}</span>
          </div>
          <div class="tc-prog"><div class="tc-prog-bar" id="progBar" style="width:0%"></div></div>
        </div>
        <div id="attList">
          ${stus.map(s => `
          <div class="tc-att-row" id="ar-${s.register_no}">
            <div><div class="tc-att-sname">${esc(s.name || '—')}</div>
            <div class="tc-att-sreg">${s.register_no}${s.department ? ' · ' + esc(s.department) : ''} · Yr ${s.year || '—'}</div></div>
            <div class="tc-att-tog">
              <button class="tc-p" id="ap-${s.register_no}" onclick="markOne('${s.register_no}','present')"><i class="fas fa-check"></i> P</button>
              <button class="tc-a" id="aa-${s.register_no}" onclick="markOne('${s.register_no}','absent')"><i class="fas fa-times"></i> A</button>
            </div>
          </div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;padding-top:15px;border-top:1px solid var(--tbord)">
          <button class="tb tb-ghost tb-sm" onclick="closeM('mAtt');openRoom('${id}')">Cancel</button>
          <button class="tb tb-pri" id="saveAttBtn" onclick="saveAtt('${id}')"><i class="fas fa-save"></i> Save Attendance</button>
        </div>
      </div>
    </div>
  </div>`)
}

window.markOne = (regno, status) => {
  _attSt[regno] = status
  document.getElementById('ap-' + regno)?.classList.toggle('on', status === 'present')
  document.getElementById('aa-' + regno)?.classList.toggle('on', status === 'absent')
  const marked = Object.values(_attSt).filter(v => v !== null).length
  const tot    = _attStus.length || 1
  const mn     = document.getElementById('markedN'); if (mn) mn.textContent = marked
  const bar    = document.getElementById('progBar'); if (bar) bar.style.width = Math.round(marked / tot * 100) + '%'
}

window.markAll = s => _attStus.forEach(st => markOne(st.register_no, s))

window.saveAtt = async id => {
  const date   = document.getElementById('attDate')?.value
  const period = parseInt(document.getElementById('attPer')?.value)
  const subj   = document.getElementById('attSubj')?.value?.trim()

  if (!date || !period || !subj) { showToast('Enter date, period AND subject name.', 'warning'); return }

  const unmarked = Object.values(_attSt).filter(v => v === null).length
  if (unmarked > 0 && !confirm(`${unmarked} student(s) not marked yet. Proceed?`)) return

  const btn = document.getElementById('saveAttBtn')
  // FIX: always guard null before disabling
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…' }

  const resetBtn = () => { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Attendance' } }

  const { data: sess, error: sErr } = await supabase.from('attendance_sessions')
    .upsert({
      classroom_id: id, teacher_regno: _regno,
      session_date: date, period, subject_name: subj
    }, { onConflict: 'classroom_id,session_date,period' })
    .select().single()

  if (sErr) { showToast('Session error: ' + sErr.message, 'error'); resetBtn(); return }

  const records = _attStus
    .filter(s => _attSt[s.register_no] !== null)
    .map(s => ({
      session_id: sess.id, classroom_id: id,
      register_no: s.register_no, student_name: s.name || '',
      status: _attSt[s.register_no],
      session_date: date, period, subject_name: subj
    }))

  if (records.length) {
    const { error: rErr } = await supabase.from('attendance_records')
      .upsert(records, { onConflict: 'session_id,register_no' })
    if (rErr) { showToast('Records error: ' + rErr.message, 'error'); resetBtn(); return }
  }

  showToast(`Attendance saved for ${records.length} students ✅ (${date} · Period ${period} · ${subj})`, 'success')
  closeM('mAtt')
  openRoom(id)
}

// ── VIEW SESSION ──────────────────────────────────────────────
window.viewSess = async sessId => {
  const { data: recs = [] } = await supabase.from('attendance_records')
    .select('*').eq('session_id', sessId).order('student_name')
  const { data: sess } = await supabase.from('attendance_sessions')
    .select('*').eq('id', sessId).maybeSingle()

  const pr = recs.filter(r => r.status === 'present')
  const ab = recs.filter(r => r.status === 'absent')

  modal(`
  <div class="tc-mo open" id="mSess">
    <div class="tc-mb tc-mb-md">
      <div class="tc-mh"><div class="tc-mt"><i class="fas fa-eye"></i> Session Report</div>
        <button class="tc-mc" onclick="closeM('mSess')"><i class="fas fa-times"></i></button></div>
      <div class="tc-mbd">
        <div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px">
          <span class="tbd tb-amber"><i class="fas fa-calendar"></i> ${sess?.session_date || '—'}</span>
          <span class="tbd tb-teal"><i class="fas fa-clock"></i> Period ${sess?.period || '—'}</span>
          <span class="tbd tb-blue"><i class="fas fa-book"></i> ${esc(sess?.subject_name || '—')}</span>
          <span class="tbd tb-green"><i class="fas fa-check"></i> ${pr.length} Present</span>
          <span class="tbd tb-red"><i class="fas fa-times"></i> ${ab.length} Absent</span>
        </div>
        ${recs.length
          ? `<div class="tc-tbl-wrap"><table class="tc-tbl">
              <thead><tr><th>Student</th><th>Reg No</th><th>Status</th></tr></thead>
              <tbody>${recs.map(r => `<tr>
                <td style="font-weight:700;color:#fff">${esc(r.student_name || '—')}</td>
                <td style="font-family:monospace;color:var(--tmut)">${r.register_no}</td>
                <td><span class="tbd ${r.status === 'present' ? 'tb-green' : 'tb-red'}">
                  <i class="fas fa-${r.status === 'present' ? 'check' : 'times'}"></i> ${r.status}
                </span></td>
              </tr>`).join('')}</tbody>
            </table></div>`
          : `<div class="tc-empty"><div class="tc-empty-title">No records found.</div></div>`}
        <div style="text-align:right;margin-top:15px">
          <button class="tb tb-ghost tb-sm" onclick="closeM('mSess')">Close</button>
        </div>
      </div>
    </div>
  </div>`)
}

// ── EDIT CLASSROOM ────────────────────────────────────────────
window.openEditRoom = id => {
  const room = _rooms.find(r => r.id === id); if (!room) return
  // FIX: clear and re-populate the shared Set — do NOT reassign
  _selStu.clear()
  ;(room.student_regnos || []).forEach(r => _selStu.add(r))

  modal(`
  <div class="tc-mo open" id="mEdit">
    <div class="tc-mb tc-mb-lg">
      <div class="tc-mh">
        <div class="tc-mt"><i class="fas fa-edit"></i> Edit Classroom — ${esc(room.class_name)}</div>
        <button class="tc-mc" onclick="closeM('mEdit');openRoom('${id}')"><i class="fas fa-times"></i></button>
      </div>
      <div class="tc-mbd">
        <div class="tgrid" style="margin-bottom:18px">
          <div class="tg-fg"><label class="tl"><i class="fas fa-door-open"></i> Classroom Name *</label>
            <input id="ec_name" class="ti" value="${esc(room.class_name)}" /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-book"></i> Subject *</label>
            <input id="ec_subj" class="ti" value="${esc(room.subject || '')}" /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-building"></i> Department (optional)</label>
            <input id="ec_dept" class="ti" value="${esc(room.department || '')}" /></div>
          <div class="tg-fg"><label class="tl"><i class="fas fa-layer-group"></i> Year (optional)</label>
            <select id="ec_year" class="ts"><option value="">Any Year</option>
              ${[1,2,3,4].map(n => `<option value="${n}" ${room.year == n ? 'selected' : ''}>${n}${sfx(n)} Year</option>`).join('')}
            </select></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;flex-wrap:wrap;gap:8px">
          <span style="font-size:.95rem;color:#fff;font-weight:700"><i class="fas fa-users" style="color:var(--tamb);margin-right:7px"></i>Edit Students</span>
          <span class="tbd tb-teal" id="selCnt">${_selStu.size} Selected</span>
        </div>
        <div class="tc-msearch tg-fg"><i class="fas fa-search tc-msearch-ico"></i>
          <input id="stuSearch" class="ti" placeholder="Search name or reg no…" oninput="fltStus()" style="padding-left:37px" /></div>
        <div style="max-height:340px;overflow-y:auto;padding-right:3px" id="stuList">${stuSelHTML(grpStus(_stus))}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;padding-top:15px;border-top:1px solid var(--tbord)">
          <button class="tb tb-ghost tb-sm" onclick="closeM('mEdit');openRoom('${id}')">Cancel</button>
          <button class="tb tb-pri" onclick="saveEditRoom('${id}')"><i class="fas fa-save"></i> Save Changes</button>
        </div>
      </div>
    </div>
  </div>`)
}

window.saveEditRoom = async id => {
  const name = document.getElementById('ec_name')?.value?.trim()
  const subj = document.getElementById('ec_subj')?.value?.trim()
  if (!name || !subj) { showToast('Classroom name & subject required.', 'warning'); return }

  const btn = document.querySelector('#mEdit .tb-pri')
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…' }

  const { error } = await supabase.from('classrooms').update({
    class_name:     name, subject:    subj,
    department:     document.getElementById('ec_dept')?.value?.trim() || null,
    year:           parseInt(document.getElementById('ec_year')?.value) || null,
    student_regnos: [..._selStu],
    updated_at:     new Date().toISOString()
  }).eq('id', id)

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Changes' }
  if (error) { showToast('Failed: ' + error.message, 'error'); return }

  // Update local cache
  const idx = _rooms.findIndex(r => r.id === id)
  if (idx >= 0) {
    _rooms[idx].class_name     = name
    _rooms[idx].subject        = subj
    _rooms[idx].department     = document.getElementById('ec_dept')?.value?.trim() || null
    _rooms[idx].year           = parseInt(document.getElementById('ec_year')?.value) || null
    _rooms[idx].student_regnos = [..._selStu]
  }

  showToast('Classroom updated! ✅', 'success')
  closeM('mEdit')
  refreshGrids()
  openRoom(id)
}