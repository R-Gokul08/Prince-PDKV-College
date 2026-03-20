import { supabase } from './supabaseClient.js'
import { initStickyHeader, initHamburger, initScrollAnimations, showToast, initAuth, openAuthModal, logoutUser, getCurrentUser, initRipple, initPageTransitions } from './shared.js'

let loggedTeacher = null   // teacher row in teacher_information

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

  setupLoginForm()
  setupRegisterForm()
  setupImageUpload()
  setupSearch()

  await loadAllTeachers()
  showSection('notLoggedIn')
})

// ── SECTION SWITCHER ─────────────────────────────────────
function showSection(which) {
  const map = { notLoggedIn: 'tch-notLoggedIn', loading: 'tch-loading', profile: 'tch-profile' }
  Object.values(map).forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; })
  if (which && map[which]) document.getElementById(map[which]).style.display = 'block'
}

// ── LOGIN ─────────────────────────────────────────────────
function setupLoginForm() {
  document.getElementById('tch-loginForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = document.getElementById('tch-loginBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in…'

    const regno = document.getElementById('tch-loginRegno').value.trim()
    const pass  = document.getElementById('tch-loginPass').value

    const { data: teacher, error } = await supabase
      .from('teacher_information')
      .select('*')
      .ilike('register_no', regno)
      .maybeSingle()

    if (error || !teacher) {
      showToast('Teacher not found with that register number.', 'error')
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login'; return
    }

    // Check password via teacher_credentials
    const { data: cred } = await supabase
      .from('teacher_credentials')
      .select('*')
      .eq('register_no', teacher.register_no)
      .maybeSingle()

    if (!cred || cred.password_hash !== pass) {
      showToast('Incorrect password. Please try again.', 'error')
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login'; return
    }

    loggedTeacher = teacher
    showToast(`Welcome back, ${teacher.name}! 👋`, 'success')
    document.getElementById('tch-allTeachers').style.display = 'none'
    showSection('profile')
    renderProfile(teacher)
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login'
  })
}

// ── REGISTER ─────────────────────────────────────────────
function setupRegisterForm() {
  document.getElementById('tch-registerForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = document.getElementById('tch-registerBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account…'

    const name        = document.getElementById('tch-name').value.trim()
    const regno       = document.getElementById('tch-regno').value.trim()
    const email       = document.getElementById('tch-email').value.trim()
    const password    = document.getElementById('tch-password').value
    const phone       = document.getElementById('tch-phone').value.trim()
    const gender      = document.getElementById('tch-gender').value
    const dept        = document.getElementById('tch-dept').value
    const designation = document.getElementById('tch-designation').value
    const subjects    = document.getElementById('tch-subjects').value.split(',').map(s => s.trim()).filter(Boolean)
    const education   = document.getElementById('tch-education').value.trim()
    const experience  = document.getElementById('tch-experience').value.trim()
    const skills      = document.getElementById('tch-skills').value.split(',').map(s => s.trim()).filter(Boolean)
    const languages   = document.getElementById('tch-languages').value.split(',').map(s => s.trim()).filter(Boolean)
    const bio         = document.getElementById('tch-bio').value.trim()

    if (!name || !regno || !email || !password || !phone || !gender || !dept || !designation || subjects.length === 0 || !education) {
      showToast('Please fill in all required fields.', 'error')
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Faculty Account'; return
    }

    // Check duplicate
    const { data: existing } = await supabase.from('teacher_information').select('id').ilike('register_no', regno).maybeSingle()
    if (existing) { showToast('A teacher with this register number already exists.', 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Faculty Account'; return }

    // Handle image upload
    let imageUrl = document.getElementById('tch-imageUrl').value.trim()
    const fileInput = document.getElementById('tch-imageFile')

    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0]
      const ext = file.name.split('.').pop()
      const filePath = `Teacher_images/${regno}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('image_files').upload(filePath, file, { upsert: true })
      if (upErr) {
        showToast('Image upload failed: ' + upErr.message, 'error')
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Faculty Account'; return
      }
      const { data: urlData } = supabase.storage.from('image_files').getPublicUrl(filePath)
      imageUrl = urlData.publicUrl
    }

    const payload = { register_no: regno, name, email, phone, gender, department: dept, designation, subjects, education, experience: experience || null, skills, languages, bio: bio || null, image_url: imageUrl || null }

    const { error: insertErr } = await supabase.from('teacher_information').insert(payload)
    if (insertErr) { showToast('Failed to create account: ' + insertErr.message, 'error'); btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Faculty Account'; return }

    // Store credentials
    await supabase.from('teacher_credentials').insert({ register_no: regno, password_hash: password })

    showToast(`Account created successfully for ${name}! Please log in.`, 'success')
    document.getElementById('tch-registerForm').reset()
    document.getElementById('tch-imgPreviewWrap').style.display = 'none'
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Faculty Account'
    await loadAllTeachers()
  })
}

// ── IMAGE UPLOAD PREVIEW ──────────────────────────────────
function setupImageUpload() {
  const fileInput = document.getElementById('tch-imageFile')
  const preview   = document.getElementById('tch-imgPreview')
  const previewWrap = document.getElementById('tch-imgPreviewWrap')
  const fileName  = document.getElementById('tch-imgFileName')
  const uploadArea = document.getElementById('tch-uploadArea')

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => { preview.src = e.target.result; previewWrap.style.display = 'block'; fileName.textContent = file.name; }
    reader.readAsDataURL(file)
  })

  uploadArea?.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); })
  uploadArea?.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'))
  uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault(); uploadArea.classList.remove('drag-over')
    fileInput.files = e.dataTransfer.files
    fileInput.dispatchEvent(new Event('change'))
  })
}

window.switchImgTab = function(tab) {
  document.querySelectorAll('.tch-img-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab))
  document.getElementById('tch-img-url-panel').style.display = tab === 'url' ? 'block' : 'none'
  document.getElementById('tch-img-upload-panel').style.display = tab === 'upload' ? 'block' : 'none'
}

// ── LOAD ALL TEACHERS ─────────────────────────────────────
async function loadAllTeachers() {
  const grid = document.getElementById('tch-grid')
  if (!grid) return
  grid.innerHTML = '<div class="tch-grid-loading"><div class="spinner"></div><p>Loading faculty…</p></div>'

  const { data: teachers, error } = await supabase.from('teacher_information').select('*').order('name')
  if (error || !teachers?.length) {
    grid.innerHTML = '<div class="tch-grid-loading"><p>No faculty records found yet.</p></div>'; return
  }
  renderTeacherGrid(teachers)
}

function renderTeacherGrid(teachers) {
  const grid = document.getElementById('tch-grid')
  if (!teachers.length) { grid.innerHTML = '<div class="tch-grid-loading"><p>No faculty found.</p></div>'; return }
  grid.innerHTML = teachers.map((t, i) => buildTeacherCard(t, i)).join('')
}

function buildTeacherCard(t, idx) {
  const photo = t.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=1a237e&color=fff&size=90`
  const subjects = (t.subjects || []).slice(0, 3).map(s => `<span>${s}</span>`).join('')
  return `
    <div class="tch-card animate-fade-up" style="animation-delay:${idx*0.06}s">
      <div class="tch-card-header">
        <img src="${photo}" alt="${t.name}" class="tch-card-photo" />
        <div class="tch-card-name">${t.name}</div>
        <div class="tch-card-desig">${t.designation || ''}</div>
      </div>
      <div class="tch-card-body">
        <div class="tch-card-dept">${t.department || ''}</div>
        <div class="tch-card-subjects">${subjects}</div>
        <div class="tch-card-meta">
          ${t.education ? `<span><i class="fas fa-graduation-cap"></i>${t.education.split(',')[0]}</span>` : ''}
          ${t.experience ? `<span><i class="fas fa-briefcase"></i>${t.experience}</span>` : ''}
        </div>
      </div>
    </div>`
}

// ── SEARCH ────────────────────────────────────────────────
function setupSearch() {
  let debounce
  document.getElementById('tchSearch')?.addEventListener('input', async (e) => {
    clearTimeout(debounce)
    debounce = setTimeout(async () => {
      const q = e.target.value.trim().toLowerCase()
      const { data: all } = await supabase.from('teacher_information').select('*').order('name')
      if (!all) return
      const filtered = q ? all.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.department || '').toLowerCase().includes(q) ||
        (t.subjects || []).some(s => s.toLowerCase().includes(q)) ||
        (t.designation || '').toLowerCase().includes(q)
      ) : all
      renderTeacherGrid(filtered)
    }, 250)
  })
}

// ── RENDER LOGGED-IN PROFILE ──────────────────────────────
function renderProfile(t) {
  const photo = t.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=1a237e&color=fff&size=140`
  const subjectTags = (t.subjects || []).map(s => `<span class="tch-tag subject">${s}</span>`).join('')
  const skillTags   = (t.skills || []).map(s => `<span class="tch-tag skill">${s}</span>`).join('')
  const langTags    = (t.languages || []).map(l => `<span class="tch-tag lang">${l}</span>`).join('')

  document.getElementById('tch-profileContent').innerHTML = `
    <div class="tch-profile-card">
      <div class="tch-profile-header">
        <div class="tch-profile-photo-wrap">
          <img src="${photo}" alt="${t.name}" class="tch-profile-photo" />
        </div>
        <div class="tch-profile-info">
          <h2>${t.name}</h2>
          <span class="tch-desig-badge">${t.designation || ''}</span>
          <span class="tch-dept-badge">&nbsp;<i class="fas fa-building"></i>&nbsp;${t.department || ''}</span>
          <div class="tch-profile-actions">
            <button class="tch-edit-btn" onclick="logoutTeacher()"><i class="fas fa-sign-out-alt"></i> Logout</button>
          </div>
        </div>
      </div>
      <div class="tch-profile-body">
        <div class="tch-info-grid">
          ${t.register_no ? `<div class="tch-info-item"><div class="tch-info-label"><i class="fas fa-id-badge"></i> Register No.</div><div class="tch-info-value">${t.register_no}</div></div>` : ''}
          ${t.email ? `<div class="tch-info-item"><div class="tch-info-label"><i class="fas fa-envelope"></i> Email</div><div class="tch-info-value">${t.email}</div></div>` : ''}
          ${t.phone ? `<div class="tch-info-item"><div class="tch-info-label"><i class="fas fa-phone"></i> Phone</div><div class="tch-info-value">${t.phone}</div></div>` : ''}
          ${t.gender ? `<div class="tch-info-item"><div class="tch-info-label"><i class="fas fa-venus-mars"></i> Gender</div><div class="tch-info-value">${t.gender}</div></div>` : ''}
          ${t.education ? `<div class="tch-info-item"><div class="tch-info-label"><i class="fas fa-graduation-cap"></i> Education</div><div class="tch-info-value">${t.education}</div></div>` : ''}
          ${t.experience ? `<div class="tch-info-item"><div class="tch-info-label"><i class="fas fa-briefcase"></i> Experience</div><div class="tch-info-value">${t.experience}</div></div>` : ''}
        </div>
        ${subjectTags ? `<div class="tch-tags-section"><h4><i class="fas fa-chalkboard"></i> Subjects</h4><div class="tch-tags">${subjectTags}</div></div>` : ''}
        ${skillTags ? `<div class="tch-tags-section"><h4><i class="fas fa-tools"></i> Skills</h4><div class="tch-tags">${skillTags}</div></div>` : ''}
        ${langTags ? `<div class="tch-tags-section"><h4><i class="fas fa-language"></i> Languages</h4><div class="tch-tags">${langTags}</div></div>` : ''}
        ${t.bio ? `<div class="tch-bio-section"><h4><i class="fas fa-user"></i> About</h4><p>${t.bio}</p></div>` : ''}
      </div>
    </div>`
  initScrollAnimations()
}

window.logoutTeacher = function() {
  loggedTeacher = null
  showSection('notLoggedIn')
  document.getElementById('tch-allTeachers').style.display = 'block'
  showToast('Logged out successfully.', 'info')
}