import {
  initStickyHeader, initHamburger, initScrollAnimations,
  initAuth, openAuthModal, logoutUser,
  initRipple, initTiltCards, initPageTransitions
} from './shared.js'

document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initPageTransitions()
  initScrollAnimations()
  initRipple()
  initTiltCards('.fac-club-card, .fac-canteen-card, .fac-class-card')

  initFacParticles()

  await initAuth()

  document.getElementById('headerLoginBtn')
    ?.addEventListener('click', () => openAuthModal('login'))

  document.querySelectorAll('.global-header-logout')
    .forEach(btn => btn.addEventListener('click', () => logoutUser()))
})

function initFacParticles() {
  const container = document.getElementById('facParticles')
  if (!container) return

  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0.3;'
  container.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  let W, H, particles, rafId

  // FIX: size canvas using its own offsetWidth/Height (not container) after append
  function resize() {
    W = canvas.width  = canvas.offsetWidth  || container.offsetWidth
    H = canvas.height = canvas.offsetHeight || container.offsetHeight
  }

  function Particle() {
    this.reset = function () {
      this.x  = Math.random() * W
      this.y  = Math.random() * H
      this.r  = Math.random() * 2 + 0.5
      this.vx = (Math.random() - 0.5) * 0.4
      this.vy = (Math.random() - 0.5) * 0.4 - 0.2
      this.a  = Math.random() * 0.6 + 0.2
    }
    this.reset()
  }

  function init() {
    resize()
    particles = Array.from({ length: 80 }, () => new Particle())
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
    rafId = requestAnimationFrame(draw)
  }

  init()
  draw()

  // FIX: debounce resize to avoid thrashing
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resize, 120)
  })
}