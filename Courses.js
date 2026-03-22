import { supabase } from './supabaseClient.js'
import {
  initStickyHeader, initHamburger, initScrollAnimations,
  openModal, closeModal, initModalCloseHandlers,
  showToast, initAuth, openAuthModal, logoutUser,
  initRipple, initPageTransitions
} from './shared.js'

// ── COURSE DATA ───────────────────────────────────────────────
const courseData = {
  'btech-cse': {
    title: 'B.Tech Computer Science and Engineering',
    badge: 'B.Tech • UG', badgeClass: 'badge-blue',
    duration: '4 Years', seats: '60 Seats',
    desc: 'A flagship 4-year undergraduate program affiliated with Anna University. Focuses on software development, algorithms, artificial intelligence, data science, and networking. Strong industry placements in TCS, Infosys, Zoho, and more.',
    highlights: ['Anna University Affiliated', 'AICTE Approved', 'Admission via TNEA', 'AI & Data Science Tracks'],
    link: 'https://www.princedrkvasudevan.com/departments/BE.CSE.html',
    img: 'https://ddn.gehu.ac.in/uploads/image/Nw1oCYC1-trending-course-gehu-1-jpg.webp'
  },
  'btech-aids': {
    title: 'B.Tech Artificial Intelligence & Data Science',
    badge: 'B.Tech • UG', badgeClass: 'badge-green',
    duration: '4 Years', seats: '60 Seats',
    desc: 'A cutting-edge 4-year program focusing on AI, Machine Learning, Deep Learning, Big Data Analytics, and Natural Language Processing.',
    highlights: ['Machine Learning & Deep Learning', 'Big Data & Analytics', 'Industry Projects', 'AICTE Approved'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=600&q=80'
  },
  'btech-cyber': {
    title: 'B.Tech Cyber Security',
    badge: 'B.Tech • UG', badgeClass: 'badge-red',
    duration: '4 Years', seats: '60 Seats',
    desc: '4-year program in network security, ethical hacking, cryptography, digital forensics, and cybercrime investigation.',
    highlights: ['Ethical Hacking', 'Cryptography & Forensics', 'Cybercrime Investigation', 'High Demand Roles'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80'
  },
  'btech-ece': {
    title: 'B.Tech Electronics & Communication Engineering',
    badge: 'B.Tech • UG', badgeClass: 'badge-blue',
    duration: '4 Years', seats: '60 Seats',
    desc: '4-year program covering communication systems, VLSI design, embedded systems, and signal processing. Anna University affiliated, AICTE approved.',
    highlights: ['Communication Systems', 'VLSI & Embedded', 'Signal Processing', 'Fees ~₹2 Lakh'],
    link: 'https://www.shiksha.com/college/prince-dr-k-vasudevan-college-of-engineering-and-technology-chennai-53970/course-b-e-in-electronics-and-communication-engineering-539701',
    img: 'https://sru.edu.in/assets/schools/ece/ece.png'
  },
  'btech-eee': {
    title: 'B.Tech Electrical & Electronics Engineering',
    badge: 'B.Tech • UG', badgeClass: 'badge-gold',
    duration: '4 Years', seats: '60 Seats',
    desc: '4-year program covering power systems, control systems, electrical machines, renewable energy, and smart grids.',
    highlights: ['Power Systems', 'Control Systems', 'Renewable Energy', 'Smart Grid Technology'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=600&q=80'
  },
  'btech-mech': {
    title: 'B.Tech Mechanical Engineering',
    badge: 'B.Tech • UG', badgeClass: 'badge-gold',
    duration: '4 Years', seats: '60 Seats',
    desc: '4-year UG program focusing on design, manufacturing, and thermal engineering. Lateral entry available.',
    highlights: ['Design & Manufacturing', 'Thermal Engineering', 'Lateral Entry Available', 'Modern Lab Facilities'],
    link: 'https://www.shiksha.com/college/prince-dr-k-vasudevan-college-of-engineering-and-technology-chennai-53970/courses/be-btech-bc',
    img: 'https://cache.careers360.mobi/media/article_images/2020/5/6/B-Tech-in-Mechanical-and-Automation-Engineering.jpg'
  },
  'btech-civil': {
    title: 'B.Tech Civil Engineering',
    badge: 'B.Tech • UG', badgeClass: 'badge-blue',
    duration: '4 Years', seats: '60 Seats',
    desc: '4-year program covering structural engineering, construction management, geotechnical engineering, and environmental engineering.',
    highlights: ['Structural Engineering', 'Construction Management', 'Geo-Technical', 'Site Visit Training'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://sijoul.sandipuniversity.edu.in/engineering-technology/images/header/UG/Civil.jpg'
  },
  'mtech-cse': {
    title: 'M.Tech Computer Science and Engineering',
    badge: 'M.Tech • PG', badgeClass: 'badge-red',
    duration: '2 Years', seats: '9 Seats',
    desc: '2-year postgraduate program. Advanced topics in algorithms, cloud computing, machine learning, and distributed networks.',
    highlights: ['GATE / TANCET Admission', 'Only 9 Seats', 'ML & Cloud Computing', 'Research Oriented'],
    link: 'https://www.shiksha.com/college/prince-dr-k-vasudevan-college-of-engineering-and-technology-chennai-53970/courses/me-mtech-bc',
    img: 'https://theredpen.in/wp-content/uploads/2024/09/medium-shot-man-wearing-vr-glasses-1-scaled.jpg'
  },
  'mtech-vlsi': {
    title: 'M.Tech VLSI Design',
    badge: 'M.Tech • PG', badgeClass: 'badge-red',
    duration: '2 Years', seats: '18 Seats',
    desc: '2-year PG program focusing on CMOS design, semiconductor technology, HDL programming, and embedded systems.',
    highlights: ['CMOS & HDL Design', 'Semiconductor Tech', 'Chip Design Careers', 'High Industry Demand'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://www.msruas.ac.in/assets/frontend/images/oview-img-vlsi.webp'
  },
  'mba': {
    title: 'Master of Business Administration (MBA)',
    badge: 'MBA • PG', badgeClass: 'badge-gold',
    duration: '2 Years', seats: '60 Seats',
    desc: '2-year full-time MBA program. Specializations in marketing, finance, and HR.',
    highlights: ['Marketing / Finance / HR', 'Industry Projects', 'Guest Lectures', 'Anna University Affiliated'],
    link: 'https://psvpec.in/mba/',
    img: 'https://media.istockphoto.com/id/1159875854/photo/mba-with-man.jpg?s=612x612&w=0&k=20&c=fm3BxaCV0OksY-P-khvO7mv1jdWLYHFlYEPaHEvZlVo='
  }
}

// ── BOOT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initPageTransitions()
  initScrollAnimations()
  initModalCloseHandlers()
  initRipple()

  await initAuth()

  document.getElementById('headerLoginBtn')
    ?.addEventListener('click', () => openAuthModal('login'))

  document.querySelectorAll('.global-header-logout')
    .forEach(btn => btn.addEventListener('click', () => logoutUser()))

  // Course card → modal
  document.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('click', () => openCourseModal(card.dataset.course))
  })

  // FIX: close modal button wired explicitly
  document.getElementById('modalCloseBtn')
    ?.addEventListener('click', () => closeModal('courseModal'))

  // Filter buttons
  document.querySelectorAll('.cf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cf-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const filter = btn.dataset.filter
      document.querySelectorAll('.course-card').forEach(card => {
        card.classList.toggle('hidden', filter !== 'all' && card.dataset.category !== filter)
      })
    })
  })

  initAdmissionForm()
})

// ── COURSE MODAL ──────────────────────────────────────────────
function openCourseModal(id) {
  const data = courseData[id]
  if (!data) return

  document.getElementById('modalTitle').textContent = data.title

  const img = document.getElementById('modalImg')
  img.src = ''; img.src = data.img; img.alt = data.title

  document.getElementById('modalDesc').textContent = data.desc

  const linkEl = document.getElementById('modalLink')
  if (linkEl) linkEl.href = data.link

  const badge = document.getElementById('modalBadge')
  badge.textContent = data.badge
  badge.className   = `badge ${data.badgeClass}`

  const seats = document.getElementById('modalSeats')
  if (seats) seats.innerHTML = `<i class="fas fa-users"></i> ${data.seats}`

  const dur = document.getElementById('modalDuration')
  if (dur) dur.innerHTML = `<i class="fas fa-clock"></i> ${data.duration}`

  const hl = document.getElementById('modalHighlights')
  if (hl && data.highlights?.length) {
    hl.innerHTML = `<div class="modal-highlights-grid">${
      data.highlights.map(h =>
        `<span class="modal-highlight-chip"><i class="fas fa-check-circle"></i> ${h}</span>`
      ).join('')
    }</div>`
  } else if (hl) { hl.innerHTML = '' }

  openModal('courseModal')
}

// ── ADMISSION FORM ────────────────────────────────────────────
function initAdmissionForm() {
  const TOTAL_STEPS = 4
  let currentStep   = 1

  // ── Step navigation ──
  function goToStep(step) {
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const panel = document.getElementById(`adm-panel-${i}`)
      if (panel) panel.style.display = (i === step) ? 'block' : 'none'
    }

    document.querySelectorAll('.adm-step').forEach(s => {
      const n = parseInt(s.dataset.step)
      s.classList.remove('active', 'done')
      if (n < step)      s.classList.add('done')
      else if (n === step) s.classList.add('active')
    })

    document.querySelectorAll('.adm-step-line').forEach((line, idx) => {
      line.classList.toggle('done', idx + 1 < step)
    })

    currentStep = step
    if (step === 4) buildReview()

    document.getElementById('admission')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Helpers ──
  const gv  = id => document.getElementById(id)?.value?.trim() || null
  const gn  = id => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v }
  const gi  = id => { const v = parseInt(document.getElementById(id)?.value);   return isNaN(v) ? null : v }
  const gb  = id => document.getElementById(id)?.checked || false

  // ── Expose to HTML onclick ──
  window.admNext = function (fromStep) {
    if (fromStep === 1) {
      if (!gv('adm-name') || !gv('adm-email') || !gv('adm-phone') ||
          !gv('adm-gender') || !gv('adm-dob') || !gv('adm-category') ||
          !gv('adm-address') || !gv('adm-city') || !gv('adm-pincode')) {
        showToast('Please fill all required fields in Step 1.', 'warning'); return
      }
    }
    if (fromStep === 2) {
      if (!gv('adm-tenth') || !gv('adm-tenthSchool') || !gv('adm-tenthBoard') ||
          !gv('adm-twelfth') || !gv('adm-twelfthSchool') || !gv('adm-stream')) {
        showToast('Please fill all required academic details in Step 2.', 'warning'); return
      }
    }
    if (fromStep === 3) {
      if (!gv('adm-course1')) {
        showToast('Please select at least your first course preference.', 'warning'); return
      }
    }
    goToStep(fromStep + 1)
  }

  window.admBack = function (fromStep) { goToStep(fromStep - 1) }

  // ── UG/PG toggle ──
  document.querySelectorAll('input[name="applicantType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isPG = radio.value === 'PG'
      const pgSection = document.getElementById('adm-pg-section')
      if (pgSection) pgSection.style.display = isPG ? 'block' : 'none'
      document.querySelectorAll('.adm-type-btn').forEach(lbl => lbl.classList.remove('active'))
      radio.closest('.adm-type-btn')?.classList.add('active')
    })
  })

  // ── Cutoff calculator ──
  // FIX: guard against NaN — only show result if at least Physics+Chemistry exist
  const calcCutoff = () => {
    const stream    = document.getElementById('adm-stream')?.value || ''
    const physics   = parseFloat(document.getElementById('adm-physics')?.value)   || 0
    const chemistry = parseFloat(document.getElementById('adm-chemistry')?.value) || 0
    const maths     = parseFloat(document.getElementById('adm-maths')?.value)     || 0
    const biology   = parseFloat(document.getElementById('adm-biology')?.value)   || 0

    let cutoff = 0
    if (stream.includes('PCM') && (physics || chemistry || maths)) {
      cutoff = (maths / 2) + (physics / 4) + (chemistry / 4)
    } else if (stream.includes('PCB') && (physics || chemistry || biology)) {
      cutoff = (biology / 2) + (physics / 4) + (chemistry / 4)
    }

    const display = document.getElementById('adm-cutoff-display')
    const hidden  = document.getElementById('adm-cutoff')
    if (display) display.textContent = cutoff > 0 ? cutoff.toFixed(2) : '—'
    if (hidden)  hidden.value        = cutoff > 0 ? cutoff.toFixed(2) : ''
  }

  ;['adm-maths', 'adm-physics', 'adm-chemistry', 'adm-biology', 'adm-stream'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', calcCutoff)
    document.getElementById(id)?.addEventListener('input',  calcCutoff)
  })

  // ── Form submit ──
  document.getElementById('admissionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()

    if (!document.getElementById('adm-declaration')?.checked) {
      showToast('Please agree to the declaration before submitting.', 'warning'); return
    }

    const submitBtn = document.getElementById('adm-submitBtn')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…' }

    const activeType = document.querySelector('input[name="applicantType"]:checked')?.value || 'UG'

    const payload = {
      applicant_type:     activeType,
      name:               gv('adm-name'),
      gender:             gv('adm-gender'),
      dob:                gv('adm-dob'),
      email:              gv('adm-email'),
      phone:              gv('adm-phone'),
      category:           gv('adm-category'),
      quota:              gv('adm-quota'),
      address:            gv('adm-address'),
      city:               gv('adm-city'),
      state:              gv('adm-state') || 'Tamil Nadu',
      pincode:            gv('adm-pincode'),
      tenth_school:       gv('adm-tenthSchool'),
      tenth_board:        gv('adm-tenthBoard'),
      tenth_year:         gi('adm-tenthYear'),
      tenth_percentage:   gn('adm-tenth'),
      twelfth_school:     gv('adm-twelfthSchool'),
      twelfth_board:      gv('adm-twelfthBoard'),
      twelfth_year:       gi('adm-twelfthYear'),
      twelfth_stream:     gv('adm-stream'),
      twelfth_percentage: gn('adm-twelfth'),
      twelfth_physics:    gn('adm-physics'),
      twelfth_chemistry:  gn('adm-chemistry'),
      twelfth_maths:      gn('adm-maths'),
      twelfth_biology:    gn('adm-biology'),
      twelfth_english:    gn('adm-english'),
      twelfth_cutoff:     gn('adm-cutoff'),
      ug_degree:          gv('adm-ugDegree'),
      ug_college:         gv('adm-ugCollege'),
      ug_university:      gv('adm-ugUniversity'),
      ug_year:            gi('adm-ugYear'),
      ug_cgpa:            gn('adm-ugCgpa'),
      ug_percentage:      gn('adm-ugPct'),
      course_pref_1:      gv('adm-course1'),
      course_pref_2:      gv('adm-course2'),
      course_pref_3:      gv('adm-course3'),
      entrance_exam:      gv('adm-entrance'),
      entrance_score:     gv('adm-entranceScore'),
      sports_quota:       gb('adm-sports'),
      ncc_quota:          gb('adm-ncc'),
      extra_curricular:   gv('adm-extra'),
      declaration_agreed: true,
      status:             'Pending'
    }

    // Secondary validation guard
    if (!payload.name || !payload.email || !payload.phone) {
      showToast('Please fill in all required fields.', 'error')
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application' }
      return
    }

    const { error } = await supabase.from('admission_information').insert(payload)

    if (error) {
      showToast('Submission failed: ' + error.message, 'error')
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application' }
      return
    }

    // FIX: escape user data in success HTML to prevent XSS
    const safeName  = esc(payload.name)
    const safeEmail = esc(payload.email)
    const appId     = 'PDKV-' + Date.now().toString().slice(-8)

    const formWrap = document.querySelector('.admission-form-wrap')
    if (formWrap) {
      formWrap.innerHTML = `
        <div class="adm-success">
          <div class="adm-success-icon">🎉</div>
          <h3>Application Submitted Successfully!</h3>
          <p>Thank you <strong>${safeName}</strong>! Your application has been received.
             Our admissions team will contact you at <strong>${safeEmail}</strong> within 2–3 working days.</p>
          <div class="adm-success-id">Application ID: ${appId}</div>
          <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <a href="index.html" class="btn btn-primary"><i class="fas fa-home"></i> Go to Home</a>
            <a href="Courses.html" class="btn btn-outline" style="color:var(--primary)">
              <i class="fas fa-redo"></i> Apply Again</a>
          </div>
        </div>`
    }

    showToast('Application submitted successfully! 🎉 We will contact you soon.', 'success', 6000)
  })

  // ── Review builder ──
  function buildReview() {
    const reviewEl = document.getElementById('adm-review-content')
    if (!reviewEl) return
    const activeType = document.querySelector('input[name="applicantType"]:checked')?.value || 'UG'
    const stream     = gv('adm-stream') || '—'

    reviewEl.innerHTML = `
      <div class="adm-review-section">
        <h4>Personal Info</h4>
        <div class="adm-review-grid">
          ${row('Type',     activeType)}
          ${row('Name',     gv('adm-name'))}
          ${row('Gender',   gv('adm-gender'))}
          ${row('DOB',      gv('adm-dob'))}
          ${row('Email',    gv('adm-email'))}
          ${row('Phone',    gv('adm-phone'))}
          ${row('Category',gv('adm-category'))}
          ${row('Quota',    gv('adm-quota'))}
        </div>
      </div>
      <div class="adm-review-section">
        <h4>Academic Details</h4>
        <div class="adm-review-grid">
          ${row('10th %',    gv('adm-tenth') + '%')}
          ${row('10th Board',gv('adm-tenthBoard'))}
          ${row('12th %',    gv('adm-twelfth') + '%')}
          ${row('12th Stream', stream)}
          ${(stream.includes('PCM') || stream.includes('PCB')) ? `
            ${row('Physics',   gv('adm-physics'))}
            ${row('Chemistry', gv('adm-chemistry'))}
            ${row(stream.includes('PCM') ? 'Maths' : 'Biology',
                  stream.includes('PCM') ? gv('adm-maths') : gv('adm-biology'))}
            ${row('Cutoff', document.getElementById('adm-cutoff-display')?.textContent || '—')}
          ` : ''}
          ${activeType === 'PG' ? `
            ${row('UG Degree',  gv('adm-ugDegree'))}
            ${row('UG College', gv('adm-ugCollege'))}
            ${row('UG CGPA/%',  gv('adm-ugCgpa') || gv('adm-ugPct'))}
          ` : ''}
        </div>
      </div>
      <div class="adm-review-section">
        <h4>Course Preference</h4>
        <div class="adm-review-grid">
          ${row('1st Choice', gv('adm-course1'))}
          ${row('2nd Choice', gv('adm-course2'))}
          ${row('3rd Choice', gv('adm-course3'))}
          ${row('Entrance',   (gv('adm-entrance') || '—') + ' — ' + (gv('adm-entranceScore') || '—'))}
          ${row('Sports Quota', gb('adm-sports') ? 'Yes' : 'No')}
          ${row('NCC',          gb('adm-ncc')    ? 'Yes' : 'No')}
        </div>
      </div>`
  }

  function row(label, value) {
    return `<div class="adm-review-item">
      <span class="adm-review-lbl">${label}</span>
      <span class="adm-review-val">${esc(String(value || '—'))}</span>
    </div>`
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
}