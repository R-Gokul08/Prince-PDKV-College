import { supabase } from './supabaseClient.js'
import { initStickyHeader, initHamburger, initScrollAnimations, showToast, initAuth, openAuthModal, logoutUser, getCurrentUser, getUserProfile, onAuthChange, initRipple, initPageTransitions } from './shared.js'

const STORAGE_BUCKET = 'image_files'
const STORAGE_FOLDER = 'Student_images'

const DEPT_OPTIONS = [
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
  'Mathematics',
  'Physics',
  'Chemistry',
  'English'
]

document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initPageTransitions()
  initScrollAnimations()
  initRipple()

  await initAuth()

  document.getElementById('headerLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.querySelectorAll('.global-header-logout').forEach(btn => {
    btn.addEventListener('click', async () => { await logoutUser() })
  })

  document.getElementById('promptLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.getElementById('promptSignupBtn')?.addEventListener('click', () => openAuthModal('signup'))

  onAuthChange(async (user, profile) => {
    await handleAuthState(user, profile)
  })

  const user = getCurrentUser()
  const profile = getUserProfile()
  await handleAuthState(user, profile)
})

async function handleAuthState(user, profile) {
  if (!user) { showSection('notLoggedIn'); return }

  const regno = profile?.regno
  if (!regno) {
    showSection('noData')
    document.getElementById('noDataMsg').textContent = 'Your account does not have a register number. Please contact administration.'
    document.getElementById('noDataUserInfo').innerHTML = `<p><i class="fas fa-envelope"></i> Logged in as: <strong>${user.email}</strong></p>`
    return
  }

  showSection('loading')

  const { data: student, error } = await supabase
    .from('student_information')
    .select('*')
    .ilike('register_no', regno)
    .maybeSingle()

  if (error) { showToast('Error fetching records: ' + error.message, 'error'); showSection('noData'); return }

  if (!student) {
    showSection('setupProfile')
    renderSetupForm(user, profile)
    return
  }

  showSection('profile')
  renderProfile(student, profile)
  setupStudentRealtime(regno)
}

function showSection(which) {
  const sections = ['notLoggedIn', 'loading', 'noData', 'profile', 'setupProfile']
  sections.forEach(s => {
    const el = document.getElementById(s + 'Section')
    if (el) el.style.display = which === s ? 'block' : 'none'
  })
}

// ── IMAGE UPLOAD HELPER ───────────────────────────────────────
function buildImageInputHTML(idPrefix) {
  return `
  <div class="img-input-tabs">
    <button type="button" class="img-input-tab active" data-target="${idPrefix}-url-panel"><i class="fas fa-link"></i> Paste URL</button>
    <button type="button" class="img-input-tab" data-target="${idPrefix}-file-panel"><i class="fas fa-upload"></i> Upload File</button>
  </div>
  <div class="img-input-panel active" id="${idPrefix}-url-panel">
    <input type="url" id="${idPrefix}_url" class="form-input" placeholder="https://... (paste image link)" />
  </div>
  <div class="img-input-panel" id="${idPrefix}-file-panel">
    <div class="file-upload-area" id="${idPrefix}_upload_area">
      <input type="file" id="${idPrefix}_file" accept="image/*" />
      <span class="file-upload-icon"><i class="fas fa-cloud-upload-alt"></i></span>
      <div class="file-upload-text"><strong>Click or drag & drop</strong><br>JPG, PNG, GIF — max 5MB</div>
    </div>
    <div class="img-preview-wrap" id="${idPrefix}_preview">
      <img id="${idPrefix}_preview_img" src="" alt="Preview" />
      <button type="button" class="img-preview-remove" id="${idPrefix}_remove"><i class="fas fa-times"></i></button>
    </div>
  </div>`
}

function initImageInputTabs(idPrefix) {
  const tabs = document.querySelectorAll(`[data-target^="${idPrefix}"]`)
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'))
      document.querySelectorAll(`#${idPrefix}-url-panel, #${idPrefix}-file-panel`).forEach(p => p.classList.remove('active'))
      tab.classList.add('active')
      document.getElementById(tab.dataset.target)?.classList.add('active')
    })
  })

  const fileInput = document.getElementById(`${idPrefix}_file`)
  const previewWrap = document.getElementById(`${idPrefix}_preview`)
  const previewImg = document.getElementById(`${idPrefix}_preview_img`)

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      previewImg.src = e.target.result
      previewWrap.classList.add('show')
    }
    reader.readAsDataURL(file)
  })

  document.getElementById(`${idPrefix}_remove`)?.addEventListener('click', () => {
    fileInput.value = ''
    previewImg.src = ''
    previewWrap.classList.remove('show')
  })
}

async function resolveImageUrl(idPrefix, userId) {
  // Check if file tab is active and has file
  const fileInput = document.getElementById(`${idPrefix}_file`)
  if (fileInput?.files[0]) {
    const file = fileInput.files[0]
    const ext = file.name.split('.').pop()
    const path = `${STORAGE_FOLDER}/${userId || Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true })
    if (error) { showToast('Image upload failed: ' + error.message, 'error'); return null }
    const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    return publicUrl
  }
  // Fall back to URL field
  const urlInput = document.getElementById(`${idPrefix}_url`)
  return urlInput?.value.trim() || null
}

// ── SETUP PROFILE FORM ───────────────────────────────────────
function renderSetupForm(user, authProfile) {
  const container = document.getElementById('setupProfileSection')

  const deptOptions = DEPT_OPTIONS.map(d => `<option value="${d}" ${authProfile?.department === d ? 'selected' : ''}>${d}</option>`).join('')

  container.innerHTML = `
    <div class="setup-profile-wrap animate-fade-up">
      <div class="setup-header">
        <div class="setup-icon"><i class="fas fa-id-card"></i></div>
        <h2>Complete Your Student Profile</h2>
        <p>Fill in your details. Exam results &amp; attendance will be updated by admin.</p>
      </div>
      <form id="setupProfileForm" class="setup-form" novalidate>
        <div class="setup-grid">
          <div class="form-group">
            <label class="form-label"><i class="fas fa-user"></i> Full Name *</label>
            <input type="text" id="sp_name" class="form-input" value="${authProfile?.name || ''}" placeholder="Your full name" required />
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-id-card"></i> Register Number *</label>
            <input type="text" id="sp_regno" class="form-input" value="${authProfile?.regno || ''}" placeholder="e.g. 22CS0001" required />
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-venus-mars"></i> Gender *</label>
            <select id="sp_gender" class="form-select" required>
              <option value="">Select Gender</option>
              <option value="Male" ${authProfile?.gender === 'Male' ? 'selected' : ''}>Male</option>
              <option value="Female" ${authProfile?.gender === 'Female' ? 'selected' : ''}>Female</option>
              <option value="Other" ${authProfile?.gender === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-book"></i> Department *</label>
            <select id="sp_dept" class="form-select" required>
              <option value="">Select Department</option>
              ${deptOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-layer-group"></i> Year *</label>
            <select id="sp_year" class="form-select" required>
              <option value="">Select Year</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-phone"></i> Phone Number *</label>
            <input type="tel" id="sp_phone" class="form-input" value="${authProfile?.phone || ''}" placeholder="+91 99999 99999" required />
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-envelope"></i> Email ID *</label>
            <input type="email" id="sp_email" class="form-input" value="${user?.email || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-birthday-cake"></i> Date of Birth</label>
            <input type="date" id="sp_dob" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-shield-alt"></i> Guardian Name</label>
            <input type="text" id="sp_guardian" class="form-input" placeholder="Parent / Guardian name" />
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fab fa-linkedin"></i> LinkedIn Profile</label>
            <input type="url" id="sp_linkedin" class="form-input" placeholder="https://linkedin.com/in/..." />
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fab fa-github"></i> GitHub Profile</label>
            <input type="url" id="sp_github" class="form-input" placeholder="https://github.com/..." />
          </div>
          <div class="form-group setup-full-col">
            <label class="form-label"><i class="fas fa-camera"></i> Profile Photo <span style="opacity:0.6;font-weight:400;">(optional)</span></label>
            ${buildImageInputHTML('sp_img')}
          </div>
        </div>
        <div class="setup-notice">
          <i class="fas fa-clock"></i>
          <div><strong>Exam Results &amp; Attendance</strong> will be visible once admin enters your data.</div>
        </div>
        <button type="submit" class="btn btn-primary setup-submit" id="setupSubmitBtn">
          <i class="fas fa-save"></i> Save My Profile
        </button>
      </form>
    </div>`

  initImageInputTabs('sp_img')

  document.getElementById('setupProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = document.getElementById('setupSubmitBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'

    const name     = document.getElementById('sp_name').value.trim()
    const regno    = document.getElementById('sp_regno').value.trim()
    const gender   = document.getElementById('sp_gender').value
    const dept     = document.getElementById('sp_dept').value
    const year     = document.getElementById('sp_year').value
    const phone    = document.getElementById('sp_phone').value.trim()
    const email    = document.getElementById('sp_email').value.trim()
    const dob      = document.getElementById('sp_dob').value
    const guardian = document.getElementById('sp_guardian').value.trim()
    const linkedin = document.getElementById('sp_linkedin').value.trim()
    const github   = document.getElementById('sp_github').value.trim()

    if (!name || !regno || !gender || !dept || !year || !phone || !email) {
      showToast('Please fill all required fields (*)', 'error')
      btn.disabled = false
      btn.innerHTML = '<i class="fas fa-save"></i> Save My Profile'
      return
    }

    const imageUrl = await resolveImageUrl('sp_img', user.id)

    const payload = {
      register_no: regno, name, gender, department: dept,
      year: parseInt(year), phone, email,
      dob: dob || null, guardian_name: guardian || null,
      linkedin: linkedin || null, github: github || null,
      image_url: imageUrl || null
    }

    const { error } = await supabase.from('student_information').upsert(payload, { onConflict: 'register_no' })

    if (error) {
      showToast('Failed to save: ' + error.message, 'error')
      btn.disabled = false
      btn.innerHTML = '<i class="fas fa-save"></i> Save My Profile'
      return
    }

    showToast('Profile saved successfully! 🎉', 'success')
    const { data: student } = await supabase.from('student_information').select('*').ilike('register_no', regno).maybeSingle()
    if (student) { showSection('profile'); renderProfile(student, authProfile); setupStudentRealtime(regno) }
  })

  setTimeout(() => initScrollAnimations(), 50)
}

// ── RENDER PROFILE ────────────────────────────────────────────
function renderProfile(student, authProfile) {
  const attPct   = student.attendance_percentage || 0
  const attColor = attPct >= 75 ? '#4CAF50' : '#f44336'
  const yearSuffix = ['st','nd','rd','th'][Math.min((student.year || 1) - 1, 3)]

  // Group exams by category
  const exams = Array.isArray(student.exam_details) ? student.exam_details : []
  const categories = ['CIAT1','CIAT2','SEM1','SEM2']
  const categoryLabels = { CIAT1:'CIAT - 1', CIAT2:'CIAT - 2', SEM1:'Semester I', SEM2:'Semester II' }
  const categoryIcons  = { CIAT1:'fas fa-flask', CIAT2:'fas fa-vial', SEM1:'fas fa-graduation-cap', SEM2:'fas fa-award' }
  const categoryColors = { CIAT1:'#2196F3', CIAT2:'#9C27B0', SEM1:'#FF9800', SEM2:'#4CAF50' }

  let examsHtml = ''
  if (exams.length > 0) {
    examsHtml = `<div class="exams-section">`
    categories.forEach(cat => {
      const catExams = exams.filter(e => e.exam_category === cat)
      if (!catExams.length) return
      const passCount = catExams.filter(e => e.result === 'Pass').length
      const avg = Math.round(catExams.reduce((s, e) => s + (e.marks || 0), 0) / catExams.length)
      examsHtml += `
        <div class="exam-category-block" style="--cat-color:${categoryColors[cat]}">
          <div class="exam-cat-header">
            <span class="exam-cat-icon"><i class="${categoryIcons[cat]}"></i></span>
            <span class="exam-cat-label">${categoryLabels[cat]}</span>
            <span class="exam-cat-stats">${passCount}/${catExams.length} Pass &bull; Avg: ${avg}</span>
          </div>
          <div class="exams-grid">
            ${catExams.map(ex => `
              <div class="exam-result-card ${ex.result === 'Pass' ? 'exam-pass' : 'exam-fail'}">
                <div class="exam-subj">${ex.subject}</div>
                <div class="exam-score">
                  <span class="exam-marks">${ex.marks}${ex.max_marks ? '/' + ex.max_marks : '/100'}</span>
                  <span class="exam-result-badge ${ex.result === 'Pass' ? 'pass' : 'fail'}">${ex.result}</span>
                  ${ex.type ? `<span class="exam-type">${ex.type}</span>` : ''}
                </div>
              </div>`).join('')}
          </div>
        </div>`
    })
    examsHtml += `</div>`
  } else {
    examsHtml = `
      <div class="pending-notice">
        <div class="pending-icon"><i class="fas fa-hourglass-half"></i></div>
        <h4>Exam Results Pending</h4>
        <p>Your exam results haven't been entered yet. Please check back after the admin updates your records.</p>
      </div>`
  }

  const attendanceHtml = (student.total_days || student.present_days)
    ? `<div class="attendance-card">
        <h3><i class="fas fa-calendar-check"></i> Attendance Record</h3>
        <div class="attendance-stats">
          <div class="att-stat"><span class="att-num" style="color:${attColor};">${attPct}%</span><span class="att-label">Attendance %</span></div>
          <div class="att-stat"><span class="att-num">${student.present_days || 0}</span><span class="att-label">Days Present</span></div>
          <div class="att-stat"><span class="att-num">${student.absent_days || 0}</span><span class="att-label">Days Absent</span></div>
          <div class="att-stat"><span class="att-num">${student.total_days || 0}</span><span class="att-label">Total Days</span></div>
        </div>
        ${attPct > 0 && attPct < 75 ? `<div class="att-warning att-warn-red">⚠️ Attendance below 75% — condonation required</div>`
          : attPct >= 75 ? `<div class="att-warning att-warn-green">✅ Good attendance — eligible for examinations</div>` : ''}
      </div>`
    : `<div class="pending-notice">
        <div class="pending-icon"><i class="fas fa-calendar-times"></i></div>
        <h4>Attendance Pending</h4>
        <p>Your attendance records haven't been entered yet.</p>
      </div>`

  const photoSrc = student.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=1a237e&color=fff&size=130`

  // Gender icon
  const genderIcon = { Male: 'fas fa-mars', Female: 'fas fa-venus', Other: 'fas fa-transgender' }[student.gender] || 'fas fa-user'

  document.getElementById('profileContent').innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-photo-wrap">
          <img src="${photoSrc}" alt="${student.name}" class="profile-photo" />
          <div class="profile-photo-ring"></div>
        </div>
        <div class="profile-name">${student.name}</div>
        <span class="profile-regno">${student.register_no}</span>
        ${student.department ? `<div class="profile-dept">${student.department} &bull; ${student.year}${yearSuffix} Year</div>` : ''}
        ${student.gender ? `<div class="profile-gender"><i class="${genderIcon}"></i> ${student.gender}</div>` : ''}
      </div>
      <div class="profile-body">
        <div class="profile-info-grid">
          ${student.department ? `<div class="profile-info-item"><div class="profile-info-label"><i class="fas fa-book"></i> Department</div><div class="profile-info-value">${student.department}</div></div>` : ''}
          ${student.year ? `<div class="profile-info-item"><div class="profile-info-label"><i class="fas fa-layer-group"></i> Year</div><div class="profile-info-value">${student.year}${yearSuffix} Year</div></div>` : ''}
          ${student.gender ? `<div class="profile-info-item"><div class="profile-info-label"><i class="fas fa-venus-mars"></i> Gender</div><div class="profile-info-value">${student.gender}</div></div>` : ''}
          ${student.guardian_name ? `<div class="profile-info-item"><div class="profile-info-label"><i class="fas fa-shield-alt"></i> Guardian</div><div class="profile-info-value">${student.guardian_name}</div></div>` : ''}
          ${student.phone ? `<div class="profile-info-item"><div class="profile-info-label"><i class="fas fa-phone"></i> Phone</div><div class="profile-info-value">${student.phone}</div></div>` : ''}
          ${student.email ? `<div class="profile-info-item"><div class="profile-info-label"><i class="fas fa-envelope"></i> Email</div><div class="profile-info-value">${student.email}</div></div>` : ''}
          ${student.dob ? `<div class="profile-info-item"><div class="profile-info-label"><i class="fas fa-birthday-cake"></i> Date of Birth</div><div class="profile-info-value">${student.dob}</div></div>` : ''}
          ${student.linkedin ? `<div class="profile-info-item"><div class="profile-info-label"><i class="fab fa-linkedin"></i> LinkedIn</div><div class="profile-info-value"><a href="${student.linkedin}" target="_blank"><i class="fas fa-external-link-alt"></i> View Profile</a></div></div>` : ''}
          ${student.github ? `<div class="profile-info-item"><div class="profile-info-label"><i class="fab fa-github"></i> GitHub</div><div class="profile-info-value"><a href="${student.github}" target="_blank"><i class="fas fa-external-link-alt"></i> View Profile</a></div></div>` : ''}
        </div>
        ${attendanceHtml}
        ${examsHtml}
      </div>
    </div>`

  initScrollAnimations()
}

// ── REALTIME SYNC ─────────────────────────────────────────────
let _realtimeChannel = null
function setupStudentRealtime(regno) {
  if (_realtimeChannel) supabase.removeChannel(_realtimeChannel)
  _realtimeChannel = supabase
    .channel('student-realtime-' + regno)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_information', filter: `register_no=ilike.${regno}` },
      async () => {
        const { data: student } = await supabase.from('student_information').select('*').ilike('register_no', regno).maybeSingle()
        if (student) { showSection('profile'); renderProfile(student, getUserProfile()) }
      })
    .subscribe()
}