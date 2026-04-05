import { supabase } from './supabaseClient.js'
import {
  initStickyHeader, initHamburger, initScrollAnimations,
  initCounters, initAuth, openAuthModal, logoutUser,
  initRipple, initTiltCards, initPageTransitions
} from './shared.js'

document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initPageTransitions()
  initRipple()

  // Make hero elements visible immediately (before scroll observer fires)
  document.querySelectorAll('.hero-content .animate-fade-up').forEach(el =>
    el.classList.add('visible')
  )

  initScrollAnimations()
  initCounters()
  initTiltCards()

  startTypewriter()
  initParticles()

  await loadGallery()
  await initAuth()

  document.getElementById('headerLoginBtn')
    ?.addEventListener('click', () => openAuthModal('login'))

  document.querySelectorAll('.global-header-logout')
    .forEach(btn => btn.addEventListener('click', () => logoutUser()))
})

// ── GALLERY ───────────────────────────────────────────────────
const MEDIA_EXTS  = ['jpg','jpeg','png','gif','webp','svg','mp4','webm','mov']
const VIDEO_EXTS  = ['mp4','webm','mov']
const FALLBACK_IMG = 'College_Image.png'

function getExt(name) { return name.split('.').pop().toLowerCase() }
function isMedia(f)   { return MEDIA_EXTS.includes(getExt(f.name)) }
function isVideo(f)   { return VIDEO_EXTS.includes(getExt(f.name)) }

function buildMediaItems(files) {
  return files.filter(isMedia).map(file => {
    const { data: { publicUrl } } = supabase.storage
      .from('image_files').getPublicUrl(`College_images/${file.name}`)
    return { url: publicUrl, name: file.name, isVideo: isVideo(file) }
  })
}

async function loadGallery() {
  const galleryGrid = document.getElementById('galleryGrid')
  if (!galleryGrid) return

  // Show skeleton
  galleryGrid.innerHTML = Array(8).fill(0).map(() =>
    `<div class="gallery-item skeleton-gallery"></div>`
  ).join('')

  try {
    const { data: files, error } = await supabase.storage
      .from('image_files')
      .list('College_images', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })

    if (error) throw error

    const mediaItems = buildMediaItems(files || [])

    if (mediaItems.length === 0) {
      renderDefaultGallery(galleryGrid)
      return
    }

    renderGallery(galleryGrid, mediaItems)

    // Polling: compare lengths to detect new uploads
    // FIX: track mediaItems.length in closure correctly
    let lastCount = mediaItems.length
    setInterval(async () => {
      try {
        const { data: newFiles } = await supabase.storage
          .from('image_files')
          .list('College_images', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })
        if (!newFiles) return
        const newMedia = buildMediaItems(newFiles)
        if (newMedia.length !== lastCount) {
          lastCount = newMedia.length
          renderGallery(galleryGrid, newMedia)
        }
      } catch (_) {}
    }, 30000)

  } catch (err) {
    console.error('Gallery load error:', err)
    renderDefaultGallery(galleryGrid)
  }
}

function renderGallery(container, items) {
  container.innerHTML = items.map((item, i) => {
    const altText = item.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    if (item.isVideo) {
      return `
        <div class="gallery-item animate-fade-up" style="transition-delay:${i * 0.06}s;">
          <video autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;display:block;">
            <source src="${item.url}" />
          </video>
          <div class="gallery-video-badge"><i class="fas fa-play-circle"></i></div>
        </div>`
    }
    return `
      <div class="gallery-item animate-fade-up" style="transition-delay:${i * 0.06}s;">
        <img src="${item.url}" alt="Campus - ${altText}" loading="lazy"
             onerror="this.src='${FALLBACK_IMG}'" />
      </div>`
  }).join('')

  // Trigger visible state for new items
  setTimeout(() => {
    container.querySelectorAll('.animate-fade-up:not(.visible)')
      .forEach(el => el.classList.add('visible'))
  }, 80)
}

function renderDefaultGallery(container) {
  const defaults = [
    { url: 'https://www.princedrkvasudevan.com/image/img5.jpg', alt: 'Campus Building' },
    { url: 'https://www.princedrkvasudevan.com/image/img1.jpg', alt: 'Library' },
    { url: 'https://www.eduska.com/assets/user_photo/2621c4362ec6124fe7a6b731e5a23fb7.jpg', alt: 'Campus View' },
    { url: 'https://images.shiksha.com/mediadata/images/1504601387phpG5m3PE.jpeg', alt: 'Laboratory' },
    { url: 'https://www.princedrkvasudevan.com/image/img7.jpg', alt: 'Lab' },
    { url: 'https://www.princedrkvasudevan.com/image/img3.jpg', alt: 'Campus' },
    { url: 'https://images.shiksha.com/mediadata/images/1504601205phpnWD3OX.jpeg', alt: 'Lab Facilities' },
    { url: 'https://www.sikshapedia.com/public/data/colleges/prince-dr-k-vasudevan-college-of-engineering-and-technology-chennai-tamil-nadu/8U_CA2spqD.webp', alt: 'College Campus' }
  ]
  container.innerHTML = defaults.map((img, i) => `
    <div class="gallery-item animate-fade-up" style="transition-delay:${i * 0.06}s;">
      <img src="${img.url}" alt="${img.alt}" loading="lazy" onerror="this.src='${FALLBACK_IMG}'" />
    </div>`).join('')

  setTimeout(() => {
    container.querySelectorAll('.animate-fade-up:not(.visible)')
      .forEach(el => el.classList.add('visible'))
  }, 80)
}

// ── TYPEWRITER ────────────────────────────────────────────────
function startTypewriter() {
  const el = document.getElementById('heroTypewriter')
  if (!el) return

  const phrases = [
    'Nurturing Innovation • Building Careers • Shaping Futures',
    'NAAC A+ • Anna University Affiliated • AICTE Approved',
    '14+ Years of Excellence • 65-Acre Campus • 2,452+ Students',
  ]

  let phraseIdx = 0
  let charIdx   = 0
  let deleting  = false
  let pauseTick = 0

  el.innerHTML = '<span class="typed-cursor"></span>'

  function tick() {
    const phrase = phrases[phraseIdx]

    if (pauseTick > 0) {
      pauseTick--
      setTimeout(tick, 60)
      return
    }

    if (!deleting) {
      // FIX: use <= so final character is shown before pause
      el.innerHTML = phrase.slice(0, charIdx) + '<span class="typed-cursor"></span>'
      charIdx++
      if (charIdx > phrase.length) {
        pauseTick = 28
        deleting  = true
      }
      setTimeout(tick, 52)
    } else {
      el.innerHTML = phrase.slice(0, charIdx) + '<span class="typed-cursor"></span>'
      charIdx--
      if (charIdx < 0) {
        deleting  = false
        phraseIdx = (phraseIdx + 1) % phrases.length
        charIdx   = 0
        pauseTick = 8
      }
      setTimeout(tick, 24)
    }
  }

  setTimeout(tick, 1200)
}

// ── PARTICLES ─────────────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('heroParticles')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let W, H, particles

  function resize() {
    W = canvas.width  = canvas.offsetWidth
    H = canvas.height = canvas.offsetHeight
  }

  function Particle() {
    this.reset = function () {
      this.x  = Math.random() * W
      this.y  = Math.random() * H
      this.r  = Math.random() * 2.2 + 0.5
      this.vx = (Math.random() - 0.5) * 0.4
      this.vy = (Math.random() - 0.5) * 0.4 - 0.2
      this.a  = Math.random() * 0.6 + 0.2
    }
    this.reset()
  }

  function init() {
    resize()
    particles = Array.from({ length: 90 }, () => new Particle())
  }

  function draw() {
    ctx.clearRect(0, 0, W, H)
    particles.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${p.a})`
      ctx.fill()
      p.x += p.vx
      p.y += p.vy
      if (p.x < -5 || p.x > W + 5 || p.y < -5 || p.y > H + 5) p.reset()
    })
    requestAnimationFrame(draw)
  }

  init()
  draw()

  // FIX: debounce resize
  let t
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(resize, 120) })
}