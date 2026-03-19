import { initStickyHeader, initHamburger, initScrollAnimations, openModal, closeModal, initModalCloseHandlers, showToast } from './shared.js'

const courseData = {
  'btech-cse': {
    title: 'B.Tech Computer Science and Engineering',
    badge: 'B.Tech • 4 Years',
    badgeClass: 'badge-blue',
    seats: '60 Seats',
    desc: 'A flagship 4-year undergraduate program affiliated with Anna University. Focuses on software development, algorithms, artificial intelligence, data science, and networking. Strong industry placements in TCS, Infosys, Zoho, and more.',
    link: 'https://www.princedrkvasudevan.com/departments/BE.CSE.html',
    img: 'https://ddn.gehu.ac.in/uploads/image/Nw1oCYC1-trending-course-gehu-1-jpg.webp'
  },
  'btech-ece': {
    title: 'B.Tech Electronics & Communication Engineering',
    badge: 'B.Tech • 4 Years',
    badgeClass: 'badge-green',
    seats: '60 Seats',
    desc: '4-year program covering communication systems, VLSI design, embedded systems, and signal processing. Anna University affiliated, AICTE approved. Total fees approx. ₹2 Lakh. Admission via TNEA.',
    link: 'https://www.shiksha.com/college/prince-dr-k-vasudevan-college-of-engineering-and-technology-chennai-53970/course-b-e-in-electronics-and-communication-engineering-539701',
    img: 'https://sru.edu.in/assets/schools/ece/ece.png'
  },
  'btech-mech': {
    title: 'B.Tech Mechanical Engineering',
    badge: 'B.Tech • 4 Years',
    badgeClass: 'badge-gold',
    seats: '60 Seats',
    desc: '4-year UG program focusing on design, manufacturing, and thermal engineering. Lateral entry available (3 years). Strong industry connections and hands-on lab experience with modern machinery.',
    link: 'https://www.shiksha.com/college/prince-dr-k-vasudevan-college-of-engineering-and-technology-chennai-53970/courses/be-btech-bc',
    img: 'https://cache.careers360.mobi/media/article_images/2020/5/6/B-Tech-in-Mechanical-and-Automation-Engineering.jpg'
  },
  'btech-civil': {
    title: 'B.Tech Civil Engineering',
    badge: 'B.Tech • 4 Years',
    badgeClass: 'badge-blue',
    seats: '60 Seats',
    desc: '4-year program covering structural engineering, construction management, geotechnical engineering, and environmental engineering. Anna University affiliated. Emphasis on practical training and site visits.',
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://sijoul.sandipuniversity.edu.in/engineering-technology/images/header/UG/Civil.jpg'
  },
  'mtech-cse': {
    title: 'M.Tech Computer Science and Engineering',
    badge: 'M.Tech • 2 Years',
    badgeClass: 'badge-red',
    seats: '9 Seats',
    desc: '2-year postgraduate program with only 9 seats, admission via GATE/TANCET. Advanced topics in algorithms, cloud computing, machine learning, and distributed networks. Excellent for research aspirants.',
    link: 'https://www.shiksha.com/college/prince-dr-k-vasudevan-college-of-engineering-and-technology-chennai-53970/courses/me-mtech-bc',
    img: 'https://theredpen.in/wp-content/uploads/2024/09/medium-shot-man-wearing-vr-glasses-1-scaled.jpg'
  },
  'mtech-vlsi': {
    title: 'M.Tech VLSI Design',
    badge: 'M.Tech • 2 Years',
    badgeClass: 'badge-red',
    seats: '18 Seats',
    desc: '2-year PG program focusing on CMOS design, semiconductor technology, HDL programming, and embedded systems. High industry demand with excellent career prospects in chip design companies.',
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://www.msruas.ac.in/assets/frontend/images/oview-img-vlsi.webp'
  },
  'mba': {
    title: 'Master of Business Administration (MBA)',
    badge: 'MBA • 2 Years',
    badgeClass: 'badge-gold',
    seats: '60 Seats',
    desc: '2-year full-time MBA program affiliated with Anna University, AICTE approved. Specializations in marketing, finance, and HR. Features industry projects, internships, and guest lectures from business leaders.',
    link: 'https://psvpec.in/mba/',
    img: 'https://media.istockphoto.com/id/1159875854/photo/mba-with-man.jpg?s=612x612&w=0&k=20&c=fm3BxaCV0OksY-P-khvO7mv1jdWLYHFlYEPaHEvZlVo='
  },
  'arts': {
    title: 'Arts and Humanities',
    badge: 'Arts & Humanities',
    badgeClass: 'badge-green',
    seats: 'Multiple',
    desc: 'Programs fostering critical thinking, communication, and cultural studies. Prepares students for diverse career paths in education, media, public service, and creative industries.',
    link: 'https://www.princedrkvasudevan.com',
    img: 'https://t3.ftcdn.net/jpg/16/92/35/14/360_F_1692351410_kBjDpoScGMXZf0ZA28VEKTWLTV5KnO6P.jpg'
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initStickyHeader()
  initHamburger()
  initScrollAnimations()
  initModalCloseHandlers()

  // Course card click -> open modal
  document.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.course
      const data = courseData[id]
      if (!data) return

      document.getElementById('modalTitle').textContent = data.title
      document.getElementById('modalImg').src = data.img
      document.getElementById('modalImg').alt = data.title
      document.getElementById('modalDesc').textContent = data.desc
      document.getElementById('modalLink').href = data.link

      const badge = document.getElementById('modalBadge')
      badge.textContent = data.badge
      badge.className = `badge ${data.badgeClass}`

      const seats = document.getElementById('modalSeats')
      seats.innerHTML = `<i class="fas fa-users"></i> ${data.seats}`

      openModal('courseModal')
    })
  })

  // Close button
  document.getElementById('modalCloseBtn').addEventListener('click', () => closeModal('courseModal'))

  // Filter buttons
  document.querySelectorAll('.cf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cf-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')

      const filter = btn.dataset.filter
      document.querySelectorAll('.course-card').forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.classList.remove('hidden')
        } else {
          card.classList.add('hidden')
        }
      })
    })
  })
})
