import { supabase } from './supabaseClient.js'
import { initStickyHeader, initHamburger, initScrollAnimations, showToast, initAuth, openAuthModal, logoutUser, getCurrentUser, getUserProfile, onAuthChange } from './shared.js'

document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initScrollAnimations()

  // Init global auth
  await initAuth()

  // Wire up header auth buttons
  document.getElementById('headerLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.querySelectorAll('.global-header-logout').forEach(btn => {
    btn.addEventListener('click', async () => {
      await logoutUser()
    })
  })

  // Login prompt buttons
  document.getElementById('promptLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.getElementById('promptSignupBtn')?.addEventListener('click', () => openAuthModal('signup'))

  // React to auth changes
  onAuthChange(async (user, profile) => {
    await handleAuthState(user, profile)
  })

  // Initial state
  const user = getCurrentUser()
  const profile = getUserProfile()
  await handleAuthState(user, profile)
})

async function handleAuthState(user, profile) {
  if (!user) {
    showSection('notLoggedIn')
    return
  }

  // User is logged in — get their register number from login_information
  const regno = profile?.regno
  if (!regno) {
    showSection('noData')
    document.getElementById('noDataMsg').textContent =
      'Your account does not have a register number associated. Please contact the college administration.'
    document.getElementById('noDataUserInfo').innerHTML =
      `<p><i class="fas fa-envelope"></i> Logged in as: <strong>${user.email}</strong></p>`
    return
  }

  showSection('loading')

  // Fetch student data by register number
  const { data: student, error } = await supabase
    .from('student_information')
    .select('*')
    .ilike('register_no', regno)
    .maybeSingle()

  if (error) {
    showToast('Error fetching records: ' + error.message, 'error')
    showSection('noData')
    return
  }

  if (!student) {
    showSection('noData')
    document.getElementById('noDataMsg').textContent =
      `No academic records found for register number "${regno}". Your data may not have been entered yet.`
    document.getElementById('noDataUserInfo').innerHTML = `
      <p><i class="fas fa-id-card"></i> Register No: <strong>${regno}</strong></p>
      <p><i class="fas fa-user"></i> Name: <strong>${profile?.name || '—'}</strong></p>
      <p><i class="fas fa-envelope"></i> Email: <strong>${user.email}</strong></p>
    `
    return
  }

  showSection('profile')
  renderProfile(student, profile)
}

function showSection(which) {
  document.getElementById('notLoggedInSection').style.display = which === 'notLoggedIn' ? 'block' : 'none'
  document.getElementById('loadingSection').style.display     = which === 'loading'      ? 'block' : 'none'
  document.getElementById('noDataSection').style.display      = which === 'noData'       ? 'block' : 'none'
  document.getElementById('profileSection').style.display     = which === 'profile'      ? 'block' : 'none'
}

function renderProfile(student, authProfile) {
  const attPct   = student.attendance_percentage || 0
  const attColor = attPct >= 75 ? '#4CAF50' : '#f44336'

  const yearSuffix = ['st','nd','rd','th'][Math.min((student.year||1) - 1, 3)]

  const examsHtml = student.exam_details?.length
    ? `<div class="exams-section">
         <h3><i class="fas fa-graduation-cap"></i> Exam Results</h3>
         <div class="exams-grid">
           ${student.exam_details.map(ex => `
             <div class="exam-result-card ${ex.result === 'Pass' ? 'exam-pass' : 'exam-fail'}">
               <div class="exam-subj">${ex.subject}</div>
               <div class="exam-score">Marks: ${ex.marks}/100 &bull; <strong>${ex.result}</strong> &bull; ${ex.type}</div>
             </div>`).join('')}
         </div>
       </div>`
    : `<div style="text-align:center;padding:30px;background:var(--bg-light);border-radius:var(--radius-md);color:var(--text-muted);">
         <i class="fas fa-clipboard" style="font-size:2.5rem;margin-bottom:12px;opacity:0.4;display:block;"></i>
         <p>No exam details recorded</p>
       </div>`

  const photoSrc = student.image_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=1a237e&color=fff&size=130`

  document.getElementById('profileContent').innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <img src="${photoSrc}" alt="${student.name}" class="profile-photo" />
        <div class="profile-name">${student.name}</div>
        <span class="profile-regno">${student.register_no}</span>
        ${student.department ? `<div style="margin-top:8px;opacity:0.8;font-size:0.95rem;">${student.department} &bull; ${student.year}${yearSuffix} Year</div>` : ''}
      </div>

      <div class="profile-body">
        <div class="profile-info-grid">
          ${student.department ? `<div class="profile-info-item"><div class="profile-info-label">Department</div><div class="profile-info-value">${student.department}</div></div>` : ''}
          ${student.year ? `<div class="profile-info-item"><div class="profile-info-label">Year</div><div class="profile-info-value">${student.year}${yearSuffix} Year</div></div>` : ''}
          ${student.guardian_name ? `<div class="profile-info-item"><div class="profile-info-label">Guardian</div><div class="profile-info-value">${student.guardian_name}</div></div>` : ''}
          ${student.phone ? `<div class="profile-info-item"><div class="profile-info-label">Phone</div><div class="profile-info-value">${student.phone}</div></div>` : ''}
          ${student.email ? `<div class="profile-info-item"><div class="profile-info-label">Email</div><div class="profile-info-value">${student.email}</div></div>` : ''}
          ${student.dob ? `<div class="profile-info-item"><div class="profile-info-label">Date of Birth</div><div class="profile-info-value">${student.dob}</div></div>` : ''}
          ${student.linkedin ? `<div class="profile-info-item"><div class="profile-info-label">LinkedIn</div><div class="profile-info-value"><a href="${student.linkedin}" target="_blank"><i class="fas fa-link"></i> View Profile</a></div></div>` : ''}
          ${student.github ? `<div class="profile-info-item"><div class="profile-info-label">GitHub</div><div class="profile-info-value"><a href="${student.github}" target="_blank"><i class="fas fa-link"></i> View Profile</a></div></div>` : ''}
        </div>

        ${(student.total_days || student.present_days) ? `
        <div class="attendance-card">
          <h3><i class="fas fa-calendar-check"></i> Attendance Record</h3>
          <div class="attendance-stats">
            <div class="att-stat">
              <span class="att-num" style="color:${attColor};">${attPct}%</span>
              <span class="att-label">Attendance %</span>
            </div>
            <div class="att-stat">
              <span class="att-num">${student.present_days || 0}</span>
              <span class="att-label">Days Present</span>
            </div>
            <div class="att-stat">
              <span class="att-num">${student.absent_days || 0}</span>
              <span class="att-label">Days Absent</span>
            </div>
            <div class="att-stat">
              <span class="att-num">${student.total_days || 0}</span>
              <span class="att-label">Total Days</span>
            </div>
          </div>
          ${attPct < 75 && attPct > 0 ? `<div style="margin-top:14px;padding:10px 14px;background:rgba(244,67,54,0.1);border-radius:8px;color:#c62828;font-size:0.88rem;font-weight:600;text-align:center;">
            ⚠️ Attendance below 75% — condonation required
          </div>` : attPct >= 75 ? `<div style="margin-top:14px;padding:10px 14px;background:rgba(76,175,80,0.1);border-radius:8px;color:#388E3C;font-size:0.88rem;font-weight:600;text-align:center;">
            ✅ Good attendance — eligible for examinations
          </div>` : ''}
        </div>` : ''}

        ${examsHtml}
      </div>
    </div>`

  initScrollAnimations()
}