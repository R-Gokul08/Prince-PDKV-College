import { supabase } from './supabaseClient.js'
import {
  initStickyHeader, initHamburger, initScrollAnimations,
  showToast, initAuth, openAuthModal, logoutUser,
  getCurrentUser, getUserProfile, onAuthChange
} from './shared.js'

document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initScrollAnimations()
  spawnParticles()

  await initAuth()

  // Header buttons
  document.getElementById('headerLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.querySelectorAll('.global-header-logout').forEach(btn => {
    btn.addEventListener('click', async () => { await logoutUser() })
  })

  // Prompt buttons
  document.getElementById('promptLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.getElementById('promptSignupBtn')?.addEventListener('click', () => openAuthModal('signup'))

  // Auth changes
  onAuthChange(async (user, profile) => { await handleAuthState(user, profile) })

  // Initial state
  await handleAuthState(getCurrentUser(), getUserProfile())
})

// ── Floating particles ────────────────────────────────────
function spawnParticles() {
  const container = document.getElementById('heroParticles')
  if (!container) return
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div')
    p.className = 'hero-particle'
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${3 + Math.random() * 5}px;
      height: ${3 + Math.random() * 5}px;
      animation-duration: ${6 + Math.random() * 10}s;
      animation-delay: ${Math.random() * 8}s;
      opacity: ${0.1 + Math.random() * 0.3};
    `
    container.appendChild(p)
  }
}

// ── Auth state router ─────────────────────────────────────
async function handleAuthState(user, profile) {
  if (!user) { showSection('notLoggedIn'); return }

  const regno = profile?.regno
  if (!regno) { showSection('notLoggedIn'); return }

  showSection('loading')

  // Check if student record exists
  const { data: student, error } = await supabase
    .from('student_information')
    .select('*')
    .ilike('register_no', regno)
    .maybeSingle()

  if (error) { showToast('Error fetching records: ' + error.message, 'error'); showSection('notLoggedIn'); return }

  if (!student) {
    // New student — show registration form
    showSection('registration')
    prefillRegForm(profile, regno)
    setupRegForm(profile)
  } else {
    // Existing student — show profile
    showSection('profile')
    renderProfile(student)
  }
}

function showSection(which) {
  document.getElementById('notLoggedInSection').style.display  = which === 'notLoggedIn'  ? 'block' : 'none'
  document.getElementById('loadingSection').style.display       = which === 'loading'       ? 'block' : 'none'
  document.getElementById('registrationSection').style.display  = which === 'registration' ? 'block' : 'none'
  document.getElementById('profileSection').style.display       = which === 'profile'       ? 'block' : 'none'
}

// ── Pre-fill reg form from auth profile ───────────────────
function prefillRegForm(profile, regno) {
  const f = id => document.getElementById(id)
  f('regRegno').value = regno
  f('regName').value  = profile?.name  || ''
  f('regPhone').value = profile?.phone || ''
  f('regEmail').value = profile?.email || getCurrentUser()?.email || ''
}

// ── Photo preview ─────────────────────────────────────────
let _imgFile = null
function setupRegForm(profile) {
  const imgInput   = document.getElementById('regImage')
  const imgPreview = document.getElementById('photoPreview')

  imgInput?.addEventListener('change', () => {
    _imgFile = imgInput.files[0]
    if (!_imgFile) return
    const reader = new FileReader()
    reader.onload = e => {
      imgPreview.innerHTML = `<img src="${e.target.result}" alt="Preview" />`
    }
    reader.readAsDataURL(_imgFile)
  })

  // Form submit
  const form = document.getElementById('studentRegForm')
  form?.addEventListener('submit', async e => {
    e.preventDefault()
    await submitRegistration()
  })
}

// ── Submit registration ───────────────────────────────────
async function submitRegistration() {
  const btn = document.getElementById('regSubmitBtn')
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'

  try {
    const user = getCurrentUser()
    const f    = id => document.getElementById(id)

    const name      = f('regName').value.trim()
    const guardian  = f('regGuardian').value.trim()
    const regno     = f('regRegno').value.trim()
    const dept      = f('regDept').value.trim()
    const year      = parseInt(f('regYear').value) || null
    const dob       = f('regDob').value
    const phone     = f('regPhone').value.trim()
    const email     = f('regEmail').value.trim()
    const linkedin  = f('regLinkedin').value.trim() || null
    const github    = f('regGithub').value.trim()   || null

    if (!name || !guardian || !regno || !dept || !year || !dob || !phone || !email) {
      showToast('Please fill in all required fields.', 'error')
      return
    }

    // Double-check no duplicate
    const { data: existing } = await supabase
      .from('student_information')
      .select('register_no')
      .ilike('register_no', regno)
      .maybeSingle()

    if (existing) {
      showToast('A record with this register number already exists.', 'warning')
      showSection('loading')
      await handleAuthState(user, getUserProfile())
      return
    }

    // Upload image if provided
    let image_url = null
    if (_imgFile) {
      const ext  = _imgFile.name.split('.').pop().toLowerCase()
      const path = `Student_images/${regno}.${ext}`
      const { error: upErr } = await supabase.storage.from('Image_files').upload(path, _imgFile, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('Image_files').getPublicUrl(path)
        image_url = urlData.publicUrl
      }
    }

    const dobFormatted = dob
      ? new Date(dob + 'T00:00:00').toLocaleDateString('en-GB')
      : null

    const { data: saved, error: insErr } = await supabase
      .from('student_information')
      .insert([{
        name, guardian_name: guardian, register_no: regno,
        department: dept, year, dob: dobFormatted,
        phone, email, linkedin, github,
        image_url,
        total_days: null, present_days: null, absent_days: null,
        attendance_percentage: null, exam_details: null
      }])
      .select().single()

    if (insErr) throw insErr

    showToast('Profile saved successfully! 🎉', 'success')
    showSection('profile')
    renderProfile(saved)

  } catch (err) {
    showToast('Error: ' + err.message, 'error')
  } finally {
    btn.disabled = false
    btn.innerHTML = '<i class="fas fa-save"></i> Save My Profile'
  }
}

// ── Render profile ────────────────────────────────────────
function renderProfile(student) {
  const attPct   = student.attendance_percentage ?? null
  const attColor = attPct !== null && attPct < 75 ? 'warn' : ''
  const yearSfx  = ['st','nd','rd','th'][Math.min((student.year||1) - 1, 3)]

  const photoSrc = student.image_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'S')}&background=0f1f6b&color=fff&size=160&bold=true`

  // Attendance block
  const hasAttendance = student.total_days || student.present_days

  const attendanceHtml = hasAttendance ? `
    <div class="attendance-card">
      <h3><i class="fas fa-calendar-check"></i> Attendance Record</h3>
      <div class="att-stats-grid">
        <div class="att-stat-box">
          <span class="att-num ${attColor}">${attPct !== null ? attPct + '%' : '—'}</span>
          <span class="att-label">Attendance %</span>
        </div>
        <div class="att-stat-box">
          <span class="att-num">${student.present_days ?? '—'}</span>
          <span class="att-label">Days Present</span>
        </div>
        <div class="att-stat-box">
          <span class="att-num">${student.absent_days ?? '—'}</span>
          <span class="att-label">Days Absent</span>
        </div>
        <div class="att-stat-box">
          <span class="att-num">${student.total_days ?? '—'}</span>
          <span class="att-label">Total Days</span>
        </div>
      </div>
      ${attPct !== null ? `
        <div class="att-status ${attPct >= 75 ? 'good' : 'warn'}">
          ${attPct >= 75
            ? '<i class="fas fa-check-circle"></i> Good attendance — eligible for examinations'
            : '<i class="fas fa-exclamation-triangle"></i> Below 75% — condonation may be required'}
        </div>` : ''}
    </div>` : `
    <div class="pending-card">
      <div class="pending-icon">⏳</div>
      <h3>Attendance Details Pending</h3>
      <p>Your attendance records will appear here once entered by the college administration. Please check back later.</p>
    </div>`

  // Exams block
  const hasExams = student.exam_details?.length > 0
  const examsHtml = hasExams ? `
    <div class="exams-section">
      <h3><i class="fas fa-graduation-cap"></i> Exam Results</h3>
      <div class="exams-grid">
        ${student.exam_details.map(ex => `
          <div class="exam-card ${(ex.result || '').toLowerCase() === 'pass' ? 'pass' : 'fail'}">
            <div class="exam-subject">${escHtml(ex.subject || '—')}</div>
            <div class="exam-meta">
              <span>Marks: <strong>${ex.marks ?? '—'}</strong>/100</span>
              <span class="exam-result-tag">${escHtml(ex.result || '—')}</span>
              <span class="exam-type-tag">${escHtml(ex.type || '—')}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>` : `
    <div class="pending-card">
      <div class="pending-icon">📋</div>
      <h3>Exam Details Pending</h3>
      <p>Your exam results will appear here once entered by the college administration. Please check back after your results are published.</p>
    </div>`

  document.getElementById('profileContent').innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-photo-wrap">
          <img src="${photoSrc}" alt="${escHtml(student.name)}" class="profile-photo"
               onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(student.name||'S')}&background=0f1f6b&color=fff&size=160&bold=true'" />
          <div class="profile-photo-ring"></div>
        </div>
        <div class="profile-name">${escHtml(student.name)}</div>
        <div class="profile-regno">${escHtml(student.register_no)}</div>
        ${student.department || student.year ? `<div class="profile-dept-year">${student.department ? escHtml(student.department) : ''}${student.year ? ' &bull; ' + student.year + yearSfx + ' Year' : ''}</div>` : ''}
      </div>

      <div class="profile-body">
        <div class="profile-info-grid">
          ${student.guardian_name ? `<div class="profile-info-item"><div class="pii-label">Guardian</div><div class="pii-value">${escHtml(student.guardian_name)}</div></div>` : ''}
          ${student.phone  ? `<div class="profile-info-item"><div class="pii-label">Phone</div><div class="pii-value">${escHtml(student.phone)}</div></div>` : ''}
          ${student.email  ? `<div class="profile-info-item"><div class="pii-label">Email</div><div class="pii-value">${escHtml(student.email)}</div></div>` : ''}
          ${student.dob    ? `<div class="profile-info-item"><div class="pii-label">Date of Birth</div><div class="pii-value">${escHtml(student.dob)}</div></div>` : ''}
          ${student.department ? `<div class="profile-info-item"><div class="pii-label">Department</div><div class="pii-value">${escHtml(student.department)}</div></div>` : ''}
          ${student.year   ? `<div class="profile-info-item"><div class="pii-label">Year</div><div class="pii-value">${student.year}${yearSfx} Year</div></div>` : ''}
          ${student.linkedin ? `<div class="profile-info-item"><div class="pii-label">LinkedIn</div><div class="pii-value"><a href="${escAttr(student.linkedin)}" target="_blank"><i class="fab fa-linkedin"></i> View Profile</a></div></div>` : ''}
          ${student.github   ? `<div class="profile-info-item"><div class="pii-label">GitHub</div><div class="pii-value"><a href="${escAttr(student.github)}" target="_blank"><i class="fab fa-github"></i> View Profile</a></div></div>` : ''}
        </div>

        ${attendanceHtml}
        ${examsHtml}
      </div>
    </div>`

  // Subscribe to realtime updates for this student
  supabase
    .channel(`student-${student.register_no}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'student_information',
      filter: `register_no=eq.${student.register_no}`
    }, payload => {
      showToast('Your profile has been updated by administration!', 'info', 5000)
      renderProfile(payload.new)
    })
    .subscribe()
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function escAttr(str) {
  return String(str ?? '').replace(/"/g,'&quot;')
}