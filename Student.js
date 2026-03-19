import { supabase } from './supabaseClient.js'
import { initStickyHeader, initHamburger, initScrollAnimations, showToast } from './shared.js'

document.addEventListener('DOMContentLoaded', () => {
  if (window.history.replaceState) window.history.replaceState(null, null, window.location.href)

  initStickyHeader()
  initHamburger()
  initScrollAnimations()

  const formSection    = document.getElementById('formSection')
  const profileSection = document.getElementById('profileSection')
  const studentForm    = document.getElementById('studentForm')
  const backBtn        = document.getElementById('backToFormBtn')
  const examEntries    = document.getElementById('examEntries')
  const addExamBtn     = document.getElementById('addExamBtn')
  const totalDaysInput = document.getElementById('totalDays')
  const presentInput   = document.getElementById('presentDays')
  const absentInput    = document.getElementById('absentDays')
  const attDisplay     = document.getElementById('attendanceDisplay')
  const imgInput       = document.getElementById('studentImage')
  const imgPreview     = document.getElementById('imgPreview')

  // ── Restore session ──────────────────────────────────────
  const saved = sessionStorage.getItem('pdkv_student')
  if (saved) {
    showProfile(JSON.parse(saved))
    return
  }

  // ── Image preview ────────────────────────────────────────
  imgInput.addEventListener('change', () => {
    const file = imgInput.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      imgPreview.innerHTML = `<img src="${e.target.result}" alt="Preview" />`
    }
    reader.readAsDataURL(file)
  })

  // ── Attendance calc ──────────────────────────────────────
  function calcAttendance() {
    const total   = parseInt(totalDaysInput.value) || 0
    const present = parseInt(presentInput.value)   || 0
    if (total > 0 && present <= total) {
      const absent = total - present
      const pct    = ((present / total) * 100).toFixed(2)
      absentInput.value = absent
      attDisplay.style.display = 'block'
      const color = parseFloat(pct) >= 75 ? 'var(--accent)' : 'var(--danger)'
      attDisplay.innerHTML = `<i class="fas fa-chart-bar" style="color:${color};margin-right:8px;"></i>Attendance: <span style="color:${color}">${pct}%</span> &nbsp;|&nbsp; Present: ${present} &nbsp;|&nbsp; Absent: ${absent}`
    } else {
      attDisplay.style.display = 'none'
    }
  }

  totalDaysInput.addEventListener('input', calcAttendance)
  presentInput.addEventListener('input', calcAttendance)

  // ── Add / Remove Exam ─────────────────────────────────────
  addExamBtn.addEventListener('click', () => {
    const entry = document.createElement('div')
    entry.className = 'exam-entry'
    entry.innerHTML = `
      <input type="text"   class="form-input exam-subject" placeholder="Subject Name" />
      <input type="number" class="form-input exam-marks"   placeholder="Marks (0-100)" min="0" max="100" />
      <select class="form-select exam-result">
        <option value="">Pass/Fail</option>
        <option value="Pass">✅ Pass</option>
        <option value="Fail">❌ Fail</option>
      </select>
      <select class="form-select exam-type">
        <option value="">Sem/CIA</option>
        <option value="Semester">Semester</option>
        <option value="CIA">CIA</option>
      </select>
      <button type="button" class="remove-exam-btn" onclick="removeExam(this)"><i class="fas fa-times"></i></button>
    `
    examEntries.appendChild(entry)
  })

  window.removeExam = (btn) => {
    if (examEntries.children.length > 1) btn.closest('.exam-entry').remove()
  }

  // ── Form submit ───────────────────────────────────────────
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const submitBtn = document.getElementById('submitBtn')
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'
    submitBtn.disabled = true

    try {
      const dob = new Date(document.getElementById('dob').value).toLocaleDateString('en-GB')
      const formData = {
        name:            document.getElementById('studentName').value.trim(),
        guardian_name:   document.getElementById('guardianName').value.trim(),
        register_no:     document.getElementById('registerNo').value.trim(),
        department:      document.getElementById('department').value.trim(),
        year:            parseInt(document.getElementById('year').value),
        phone:           document.getElementById('phone').value.trim(),
        email:           document.getElementById('email').value.trim(),
        linkedin:        document.getElementById('linkedin').value.trim() || null,
        github:          document.getElementById('github').value.trim() || null,
        dob,
        total_days:      parseInt(totalDaysInput.value) || 0,
        present_days:    parseInt(presentInput.value) || 0,
        absent_days:     parseInt(absentInput.value) || 0,
        attendance_percentage: parseFloat(attDisplay.textContent?.match(/[\d.]+/)?.[0] || 0)
      }

      // Exams
      const exams = Array.from(document.querySelectorAll('.exam-entry')).map(entry => {
        const subject = entry.querySelector('.exam-subject').value.trim()
        const marks   = entry.querySelector('.exam-marks').value.trim()
        return subject && marks ? {
          subject, marks: parseInt(marks),
          result: entry.querySelector('.exam-result').value || 'Not Specified',
          type:   entry.querySelector('.exam-type').value   || 'Not Specified'
        } : null
      }).filter(Boolean)
      formData.exam_details = exams.length ? exams : null

      // Check duplicate
      const { data: existing } = await supabase
        .from('student_information')
        .select('register_no')
        .eq('register_no', formData.register_no)
        .maybeSingle()

      if (existing) {
        showToast('Register number already exists!', 'error')
        return
      }

      // Image upload
      let imageUrl = null
      if (imgInput.files[0]) {
        const file    = imgInput.files[0]
        const fileExt = file.name.split('.').pop().toLowerCase()
        const fileName= `Student_images/${formData.register_no}.${fileExt}`
        const { error: upErr } = await supabase.storage.from('Image_files').upload(fileName, file, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('Image_files').getPublicUrl(fileName)
          imageUrl = urlData.publicUrl
        }
      }

      // Insert
      const { data: saved, error } = await supabase
        .from('student_information')
        .insert([{ ...formData, image_url: imageUrl }])
        .select()
        .single()

      if (error) throw error

      sessionStorage.setItem('pdkv_student', JSON.stringify(saved))
      showToast('Student data saved successfully!', 'success')
      showProfile(saved)

    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      submitBtn.innerHTML = '<i class="fas fa-save"></i> Submit Student Data'
      submitBtn.disabled = false
    }
  })

  // ── Back to form ──────────────────────────────────────────
  backBtn.addEventListener('click', () => {
    sessionStorage.removeItem('pdkv_student')
    formSection.style.display = 'block'
    profileSection.style.display = 'none'
    studentForm.reset()
    imgPreview.innerHTML = '<i class="fas fa-user-circle"></i>'
    examEntries.innerHTML = examEntries.children[0]?.outerHTML || ''
    attDisplay.style.display = 'none'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  // ── Show profile ──────────────────────────────────────────
  function showProfile(student) {
    formSection.style.display = 'none'
    profileSection.style.display = 'block'

    const attPct = student.attendance_percentage || 0
    const attColor = attPct >= 75 ? '#4CAF50' : '#f44336'

    const examsHtml = student.exam_details?.length
      ? `<div class="exams-section">
           <h3><i class="fas fa-graduation-cap"></i> Exam Results</h3>
           <div class="exams-grid">
             ${student.exam_details.map(ex => `
               <div class="exam-result-card ${ex.result === 'Pass' ? 'exam-pass' : 'exam-fail'}">
                 <div class="exam-subj">${ex.subject}</div>
                 <div class="exam-score">Marks: ${ex.marks}/100 &bull; ${ex.result} &bull; ${ex.type}</div>
               </div>`).join('')}
           </div>
         </div>`
      : `<div style="text-align:center;padding:30px;background:var(--bg-light);border-radius:var(--radius-md);color:var(--text-muted);">
           <i class="fas fa-clipboard" style="font-size:2.5rem;margin-bottom:12px;opacity:0.4;display:block;"></i>
           <p>No exam details recorded</p>
         </div>`

    document.getElementById('profileContent').innerHTML = `
      <div class="profile-card">
        <div class="profile-header">
          <img src="${student.image_url || 'https://via.placeholder.com/130x130/1a237e/FFFFFF?text=' + encodeURIComponent(student.name[0])}"
               alt="${student.name}" class="profile-photo" />
          <div class="profile-name">${student.name}</div>
          <span class="profile-regno">${student.register_no}</span>
        </div>
        <div class="profile-body">
          <div class="profile-info-grid">
            <div class="profile-info-item"><div class="profile-info-label">Department</div><div class="profile-info-value">${student.department}</div></div>
            <div class="profile-info-item"><div class="profile-info-label">Year</div><div class="profile-info-value">${student.year}${['st','nd','rd','th'][Math.min(student.year-1,3)]} Year</div></div>
            <div class="profile-info-item"><div class="profile-info-label">Guardian</div><div class="profile-info-value">${student.guardian_name}</div></div>
            <div class="profile-info-item"><div class="profile-info-label">Phone</div><div class="profile-info-value">${student.phone}</div></div>
            <div class="profile-info-item"><div class="profile-info-label">Email</div><div class="profile-info-value">${student.email}</div></div>
            <div class="profile-info-item"><div class="profile-info-label">Date of Birth</div><div class="profile-info-value">${student.dob}</div></div>
            ${student.linkedin ? `<div class="profile-info-item"><div class="profile-info-label">LinkedIn</div><div class="profile-info-value"><a href="${student.linkedin}" target="_blank"><i class="fas fa-link"></i> View Profile</a></div></div>` : ''}
            ${student.github   ? `<div class="profile-info-item"><div class="profile-info-label">GitHub</div><div class="profile-info-value"><a href="${student.github}" target="_blank"><i class="fas fa-link"></i> View Profile</a></div></div>` : ''}
          </div>

          <div class="attendance-card">
            <h3><i class="fas fa-calendar-check"></i> Attendance Record</h3>
            <div class="attendance-stats">
              <div class="att-stat">
                <span class="att-num" style="color:${attColor};">${attPct}%</span>
                <span class="att-label">Attendance %</span>
              </div>
              <div class="att-stat">
                <span class="att-num">${student.present_days}</span>
                <span class="att-label">Days Present</span>
              </div>
              <div class="att-stat">
                <span class="att-num">${student.absent_days}</span>
                <span class="att-label">Days Absent</span>
              </div>
              <div class="att-stat">
                <span class="att-num">${student.total_days}</span>
                <span class="att-label">Total Days</span>
              </div>
            </div>
          </div>

          ${examsHtml}
        </div>
      </div>`

    window.scrollTo({ top: 0, behavior: 'smooth' })
    initScrollAnimations()
  }
})
