// Shared utilities used across all pages

// ── Toast notifications ──────────────────────────────────
export function showToast(message, type = 'success', duration = 4000) {
  let container = document.querySelector('.toast-container')
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)
  }

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }
  const toast = document.createElement('div')
  toast.className = `toast ${type !== 'success' ? type : ''}`
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '✅'}</span><span>${message}</span>`
  container.appendChild(toast)

  setTimeout(() => {
    toast.classList.add('toast-exit')
    setTimeout(() => toast.remove(), 300)
  }, duration)
}

// ── Sticky header scroll effect ──────────────────────────
export function initStickyHeader() {
  const header = document.querySelector('.site-header')
  if (!header) return
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 80)
  }, { passive: true })
}

// ── Hamburger menu toggle ─────────────────────────────────
export function initHamburger() {
  const btn = document.querySelector('.hamburger')
  const nav = document.querySelector('.site-nav')
  if (!btn || !nav) return

  btn.addEventListener('click', () => {
    btn.classList.toggle('open')
    nav.classList.toggle('open')
  })

  // Close on nav link click
  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      btn.classList.remove('open')
      nav.classList.remove('open')
    })
  })

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      btn.classList.remove('open')
      nav.classList.remove('open')
    }
  })
}

// ── Intersection Observer for fade-up animations ─────────
export function initScrollAnimations() {
  const els = document.querySelectorAll('.animate-fade-up')
  if (!els.length) return

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80)
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })

  els.forEach(el => observer.observe(el))
}

// ── Counter animation ─────────────────────────────────────
export function animateCounter(el) {
  const target = parseFloat(el.dataset.target)
  const isDecimal = String(target).includes('.')
  const isPercent = el.dataset.percent === 'true'
  let start = 0
  const duration = 1800
  const startTime = performance.now()

  function update(now) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = start + (target - start) * eased

    el.textContent = isDecimal
      ? current.toFixed(2) + (isPercent ? '%' : '')
      : Math.floor(current).toLocaleString('en-IN') + (isPercent ? '%' : '')

    if (progress < 1) requestAnimationFrame(update)
    else {
      el.textContent = (isDecimal ? target.toFixed(2) : Math.floor(target).toLocaleString('en-IN')) + (isPercent ? '%' : '')
    }
  }
  requestAnimationFrame(update)
}

export function initCounters() {
  const counters = document.querySelectorAll('[data-target]')
  if (!counters.length) return

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = 'true'
        animateCounter(entry.target)
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.5 })

  counters.forEach(c => observer.observe(c))
}

// ── Modal helpers ─────────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id)
  if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden' }
}

export function closeModal(id) {
  const el = document.getElementById(id)
  if (el) { el.classList.remove('active'); document.body.style.overflow = '' }
}

export function initModalCloseHandlers() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id)
    })
  })
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal))
  })
}
