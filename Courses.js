import { supabase } from './supabaseClient.js'
import { initStickyHeader, initHamburger, initScrollAnimations, openModal, closeModal, initModalCloseHandlers, showToast, initAuth, openAuthModal, logoutUser, initRipple, initPageTransitions } from './shared.js'

// ── Course Data ───────────────────────────────────────────────
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
    desc: 'A cutting-edge 4-year program focusing on AI, Machine Learning, Deep Learning, Big Data Analytics, and Natural Language Processing. Industry-aligned curriculum with real-world project experience.',
    highlights: ['Machine Learning & Deep Learning', 'Big Data & Analytics', 'Industry Projects', 'AICTE Approved'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
  },
  'btech-cyber': {
    title: 'B.Tech Cyber Security',
    badge: 'B.Tech • UG', badgeClass: 'badge-red',
    duration: '4 Years', seats: '60 Seats',
    desc: '4-year program in network security, ethical hacking, cryptography, digital forensics, and cybercrime investigation. Prepares students for high-demand cybersecurity roles in government and industry.',
    highlights: ['Ethical Hacking', 'Cryptography & Forensics', 'Cybercrime Investigation', 'High Demand Roles'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
  },
  'btech-ece': {
    title: 'B.Tech Electronics & Communication Engineering',
    badge: 'B.Tech • UG', badgeClass: 'badge-blue',
    duration: '4 Years', seats: '60 Seats',
    desc: '4-year program covering communication systems, VLSI design, embedded systems, and signal processing. Anna University affiliated, AICTE approved. Total fees approx. ₹2 Lakh. Admission via TNEA.',
    highlights: ['Communication Systems', 'VLSI & Embedded', 'Signal Processing', 'Fees ~₹2 Lakh'],
    link: 'https://www.shiksha.com/college/prince-dr-k-vasudevan-college-of-engineering-and-technology-chennai-53970/course-b-e-in-electronics-and-communication-engineering-539701',
    img: 'https://sru.edu.in/assets/schools/ece/ece.png'
  },
  'btech-eee': {
    title: 'B.Tech Electrical & Electronics Engineering',
    badge: 'B.Tech • UG', badgeClass: 'badge-gold',
    duration: '4 Years', seats: '60 Seats',
    desc: '4-year program covering power systems, control systems, electrical machines, renewable energy, and smart grids. Strong industry connections with power sector companies.',
    highlights: ['Power Systems', 'Control Systems', 'Renewable Energy', 'Smart Grid Technology'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'
  },
  'btech-mech': {
    title: 'B.Tech Mechanical Engineering',
    badge: 'B.Tech • UG', badgeClass: 'badge-gold',
    duration: '4 Years', seats: '60 Seats',
    desc: '4-year UG program focusing on design, manufacturing, and thermal engineering. Lateral entry available (3 years). Strong industry connections and hands-on lab experience with modern machinery.',
    highlights: ['Design & Manufacturing', 'Thermal Engineering', 'Lateral Entry Available', 'Modern Lab Facilities'],
    link: 'https://www.shiksha.com/college/prince-dr-k-vasudevan-college-of-engineering-and-technology-chennai-53970/courses/be-btech-bc',
    img: 'https://cache.careers360.mobi/media/article_images/2020/5/6/B-Tech-in-Mechanical-and-Automation-Engineering.jpg'
  },
  'btech-civil': {
    title: 'B.Tech Civil Engineering',
    badge: 'B.Tech • UG', badgeClass: 'badge-blue',
    duration: '4 Years', seats: '60 Seats',
    desc: '4-year program covering structural engineering, construction management, geotechnical engineering, and environmental engineering. Emphasis on practical training and site visits.',
    highlights: ['Structural Engineering', 'Construction Management', 'Geo-Technical', 'Site Visit Training'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://sijoul.sandipuniversity.edu.in/engineering-technology/images/header/UG/Civil.jpg'
  },
  'mtech-cse': {
    title: 'M.Tech Computer Science and Engineering',
    badge: 'M.Tech • PG', badgeClass: 'badge-red',
    duration: '2 Years', seats: '9 Seats',
    desc: '2-year postgraduate program with only 9 seats, admission via GATE/TANCET. Advanced topics in algorithms, cloud computing, machine learning, and distributed networks. Excellent for research aspirants.',
    highlights: ['GATE / TANCET Admission', 'Only 9 Seats', 'ML & Cloud Computing', 'Research Oriented'],
    link: 'https://www.shiksha.com/college/prince-dr-k-vasudevan-college-of-engineering-and-technology-chennai-53970/courses/me-mtech-bc',
    img: 'https://theredpen.in/wp-content/uploads/2024/09/medium-shot-man-wearing-vr-glasses-1-scaled.jpg'
  },
  'mtech-vlsi': {
    title: 'M.Tech VLSI Design',
    badge: 'M.Tech • PG', badgeClass: 'badge-red',
    duration: '2 Years', seats: '18 Seats',
    desc: '2-year PG program focusing on CMOS design, semiconductor technology, HDL programming, and embedded systems. High industry demand with excellent career prospects in chip design companies.',
    highlights: ['CMOS & HDL Design', 'Semiconductor Tech', 'Chip Design Careers', 'High Industry Demand'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://www.msruas.ac.in/assets/frontend/images/oview-img-vlsi.webp'
  },
  'mba': {
    title: 'Master of Business Administration (MBA)',
    badge: 'MBA • PG', badgeClass: 'badge-gold',
    duration: '2 Years', seats: '60 Seats',
    desc: '2-year full-time MBA program affiliated with Anna University, AICTE approved. Specializations in marketing, finance, and HR. Features industry projects, internships, and guest lectures from business leaders.',
    highlights: ['Marketing / Finance / HR', 'Industry Projects', 'Guest Lectures', 'Anna University Affiliated'],
    link: 'https://psvpec.in/mba/',
    img: 'https://media.istockphoto.com/id/1159875854/photo/mba-with-man.jpg?s=612x612&w=0&k=20&c=fm3BxaCV0OksY-P-khvO7mv1jdWLYHFlYEPaHEvZlVo='
  },
  'arts': {
    title: 'Arts and Humanities',
    badge: 'Arts • UG', badgeClass: 'badge-green',
    duration: '3 Years', seats: 'Multiple',
    desc: 'Programs fostering critical thinking, communication, and cultural studies. Prepares students for diverse career paths in education, media, public service, and creative industries.',
    highlights: ['Critical Thinking', 'Communication Skills', 'Cultural Studies', 'Diverse Career Paths'],
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://t3.ftcdn.net/jpg/16/92/35/14/360_F_1692351410_kBjDpoScGMXZf0ZA28VEKTWLTV5KnO6P.jpg'
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

  document.getElementById('headerLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.querySelectorAll('.global-header-logout').forEach(btn => {
    btn.addEventListener('click', async () => { await logoutUser() })
  })

  // Course card click → modal
  document.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.course
      const data = courseData[id]
      if (!data) return

      document.getElementById('modalTitle').textContent = data.title
      const img = document.getElementById('modalImg')
      img.src = ''; img.src = data.img
      img.alt = data.title
      document.getElementById('modalDesc').textContent = data.desc
      document.getElementById('modalLink').href = data.link

      const badge = document.getElementById('modalBadge')
      badge.textContent = data.badge
      badge.className = `badge ${data.badgeClass}`

      const seats = document.getElementById('modalSeats')
      seats.innerHTML = `<i class="fas fa-users"></i> ${data.seats}`

      const dur = document.getElementById('modalDuration')
      if (dur) {
        dur.innerHTML = `<i class="fas fa-clock"></i> ${data.duration}`
        dur.style.display = data.duration ? '' : 'none'
      }

      const hl = document.getElementById('modalHighlights')
      if (hl && data.highlights?.length) {
        hl.innerHTML = `<div class="modal-highlights-grid">${data.highlights.map(h =>
          `<span class="modal-highlight-chip"><i class="fas fa-check-circle"></i> ${h}</span>`
        ).join('')}</div>`
      } else if (hl) { hl.innerHTML = '' }

      openModal('courseModal')
    })
  })

  document.getElementById('modalCloseBtn')?.addEventListener('click', () => closeModal('courseModal'))

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

  // Admission form
  initAdmissionForm()
})

// ── ADMISSION FORM ────────────────────────────────────────────
function initAdmissionForm() {
  let currentStep = 1
  const totalSteps = 4

  const form = document.getElementById('admissionForm')
  if (!form) return

  // UG/PG toggle
  document.querySelectorAll('.adm-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.adm-type-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const type = btn.dataset.type
      const ugSection = document.getElementById('ug-degree-section')
      if (ugSection) ugSection.style.display = type === 'PG' ? 'block' : 'none'
    })
  })

  function goToStep(step) {
    document.querySelectorAll('.adm-panel').forEach(p => p.classList.remove('active'))
    document.querySelectorAll('.adm-step').forEach(s => {
      const n = parseInt(s.dataset.step)
      s.classList.remove('active','done')
      if (n < step) s.classList.add('done')
      else if (n === step) s.classList.add('active')
    })
    const panel = document.getElementById(`adm-panel-${step}`)
    if (panel) panel.classList.add('active')
    currentStep = step

    // Build review on step 4
    if (step === 4) buildReview()

    // Scroll to form top
    document.getElementById('admission')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Next buttons
  document.querySelectorAll('.adm-next-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentStep < totalSteps) goToStep(currentStep + 1)
    })
  })

  // Back buttons
  document.querySelectorAll('.adm-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentStep > 1) goToStep(currentStep - 1)
    })
  })

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const submitBtn = document.getElementById('admSubmitBtn')
    if (!submitBtn) return

    const declCheck = document.getElementById('adm-declaration')
    if (!declCheck?.checked) {
      showToast('Please agree to the declaration before submitting.', 'warning')
      return
    }

    submitBtn.disabled = true
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…'

    const getVal = (id) => document.getElementById(id)?.value?.trim() || null
    const activeType = document.querySelector('.adm-type-btn.active')?.dataset.type || 'UG'

    const payload = {
      applicant_type: activeType,
      name:           getVal('adm-name'),
      gender:         getVal('adm-gender'),
      dob:            getVal('adm-dob'),
      category:       getVal('adm-category'),
      quota:          getVal('adm-quota'),
      email:          getVal('adm-email'),
      phone:          getVal('adm-phone'),
      address:        getVal('adm-address'),
      tenth_school:   getVal('adm-10th-school'),
      tenth_board:    getVal('adm-10th-board'),
      tenth_year:     parseInt(getVal('adm-10th-year')) || null,
      tenth_percentage: parseFloat(getVal('adm-10th-pct')) || null,
      twelfth_school: getVal('adm-12th-school'),
      twelfth_board:  getVal('adm-12th-board'),
      twelfth_year:   parseInt(getVal('adm-12th-year')) || null,
      twelfth_stream: getVal('adm-12th-stream'),
      twelfth_percentage: parseFloat(getVal('adm-12th-pct')) || null,
      ug_degree:      getVal('adm-ug-degree'),
      ug_college:     getVal('adm-ug-college'),
      ug_year:        parseInt(getVal('adm-ug-year')) || null,
      ug_cgpa:        parseFloat(getVal('adm-ug-cgpa')) || null,
      course_pref_1:  getVal('adm-course1'),
      course_pref_2:  getVal('adm-course2'),
      entrance_exam:  getVal('adm-entrance'),
      entrance_score: getVal('adm-entrance-score'),
      sports_quota:   document.getElementById('adm-sports')?.checked || false,
      ncc_quota:      document.getElementById('adm-ncc')?.checked || false,
      declaration_agreed: true,
      status: 'Pending'
    }

    if (!payload.name || !payload.email || !payload.phone) {
      showToast('Please fill in all required fields.', 'error')
      submitBtn.disabled = false
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application'
      return
    }

    const { error } = await supabase.from('admission_information').insert(payload)

    if (error) {
      showToast('Submission failed: ' + error.message, 'error')
      submitBtn.disabled = false
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application'
      return
    }

    // Show success state
    const successEl = document.getElementById('adm-success')
    const formWrap = document.querySelector('.admission-form-wrap')
    if (successEl) successEl.style.display = 'block'
    if (formWrap) formWrap.style.display = 'none'
    showToast('Application submitted successfully! 🎉 We will contact you soon.', 'success', 6000)
  })

  function buildReview() {
    const reviewEl = document.getElementById('adm-review-content')
    if (!reviewEl) return
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '—'
    const activeType = document.querySelector('.adm-type-btn.active')?.dataset.type || 'UG'

    reviewEl.innerHTML = `
      <div class="adm-review-grid">
        <div class="adm-review-group"><h4>Personal Info</h4>
          <p><strong>Type:</strong> ${activeType}</p>
          <p><strong>Name:</strong> ${getVal('adm-name')}</p>
          <p><strong>Gender:</strong> ${getVal('adm-gender')}</p>
          <p><strong>DOB:</strong> ${getVal('adm-dob')}</p>
          <p><strong>Email:</strong> ${getVal('adm-email')}</p>
          <p><strong>Phone:</strong> ${getVal('adm-phone')}</p>
          <p><strong>Category:</strong> ${getVal('adm-category')}</p>
          <p><strong>Quota:</strong> ${getVal('adm-quota')}</p>
        </div>
        <div class="adm-review-group"><h4>Academic</h4>
          <p><strong>10th %:</strong> ${getVal('adm-10th-pct')}</p>
          <p><strong>10th Board:</strong> ${getVal('adm-10th-board')}</p>
          <p><strong>12th %:</strong> ${getVal('adm-12th-pct')}</p>
          <p><strong>12th Stream:</strong> ${getVal('adm-12th-stream')}</p>
          ${activeType === 'PG' ? `<p><strong>UG Degree:</strong> ${getVal('adm-ug-degree')}</p><p><strong>UG CGPA:</strong> ${getVal('adm-ug-cgpa')}</p>` : ''}
        </div>
        <div class="adm-review-group"><h4>Course Preference</h4>
          <p><strong>1st Choice:</strong> ${getVal('adm-course1')}</p>
          <p><strong>2nd Choice:</strong> ${getVal('adm-course2')}</p>
          <p><strong>Entrance Exam:</strong> ${getVal('adm-entrance')}</p>
          <p><strong>Score:</strong> ${getVal('adm-entrance-score')}</p>
          <p><strong>Sports Quota:</strong> ${document.getElementById('adm-sports')?.checked ? 'Yes' : 'No'}</p>
          <p><strong>NCC Quota:</strong> ${document.getElementById('adm-ncc')?.checked ? 'Yes' : 'No'}</p>
        </div>
      </div>`
  }
}