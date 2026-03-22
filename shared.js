// ============================================================
// shared.js — PDKV College v5 (fully debugged + enhanced)
// ============================================================
import { supabase } from './supabaseClient.js'

/* ── TOAST ──────────────────────────────────────────────────── */
export function showToast(message, type = 'success', duration = 4000) {
  let container = document.querySelector('.toast-container')
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }
  const toast = document.createElement('div')
  toast.className = `toast${type !== 'success' ? ' ' + type : ''}`
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '✅'}</span><span>${message}</span>`
  container.appendChild(toast)
  setTimeout(() => {
    toast.classList.add('toast-exit')
    toast.addEventListener('animationend', () => toast.remove(), { once: true })
  }, duration)
}

/* ── STICKY HEADER + SCROLL PROGRESS + BACK-TO-TOP ─────────── */
export function initStickyHeader() {
  const header = document.querySelector('.site-header')
  if (!header) return

  if (!document.getElementById('scrollProgressBar')) {
    const bar = document.createElement('div')
    bar.id = 'scrollProgressBar'
    document.body.prepend(bar)
  }

  if (!document.getElementById('backToTop')) {
    const btn = document.createElement('button')
    btn.id = 'backToTop'
    btn.setAttribute('aria-label', 'Back to top')
    btn.innerHTML = '<i class="fas fa-chevron-up"></i>'
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
    document.body.appendChild(btn)
  }

  const onScroll = () => {
    const scrolled = window.scrollY
    header.classList.toggle('scrolled', scrolled > 60)
    const bar = document.getElementById('scrollProgressBar')
    if (bar) {
      const docH = document.documentElement.scrollHeight - window.innerHeight
      bar.style.width = (docH > 0 ? (scrolled / docH) * 100 : 0) + '%'
    }
    const btt = document.getElementById('backToTop')
    if (btt) btt.classList.toggle('visible', scrolled > 400)
  }

  onScroll() // run immediately
  window.addEventListener('scroll', onScroll, { passive: true })
}

/* ── HAMBURGER ───────────────────────────────────────────────── */
export function initHamburger() {
  const btn = document.querySelector('.hamburger')
  const nav = document.querySelector('.site-nav')
  if (!btn || !nav) return

  const close = () => {
    btn.classList.remove('open')
    nav.classList.remove('open')
    document.body.style.overflow = ''
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const isOpen = btn.classList.toggle('open')
    nav.classList.toggle('open', isOpen)
    document.body.style.overflow = isOpen ? 'hidden' : ''
  })

  nav.querySelectorAll('.nav-link, .nav-auth-btn').forEach(link =>
    link.addEventListener('click', close)
  )

  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) close()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
}

/* ── SCROLL ANIMATIONS ───────────────────────────────────────── */
export function initScrollAnimations() {
  const els = document.querySelectorAll('.animate-fade-up:not(.visible)')
  if (!els.length) return

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80)
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.07, rootMargin: '0px 0px -24px 0px' })

  els.forEach(el => observer.observe(el))
}

/* ── COUNTER ANIMATION (fixed: decimal + percent support) ────── */
export function animateCounter(el) {
  const target    = parseFloat(el.dataset.target)
  if (isNaN(target)) return
  const isDecimal = String(el.dataset.target).includes('.')
  const isPercent = el.dataset.percent === 'true'
  const duration  = 1800
  const startTime = performance.now()

  const fmt = (val) => {
    const n   = isDecimal ? parseFloat(val.toFixed(2)) : Math.floor(val)
    const str = isDecimal ? n.toFixed(2) : n.toLocaleString('en-IN')
    return str + (isPercent ? '%' : '')
  }

  const tick = (now) => {
    const progress = Math.min((now - startTime) / duration, 1)
    const eased    = 1 - Math.pow(1 - progress, 3) // ease-out cubic
    el.textContent = fmt(target * eased)
    if (progress < 1) requestAnimationFrame(tick)
    else el.textContent = fmt(target) // exact final value
  }

  requestAnimationFrame(tick)
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
  }, { threshold: 0.4 })
  counters.forEach(c => observer.observe(c))
}

/* ── MODAL HELPERS ───────────────────────────────────────────── */
export function openModal(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.classList.add('active')
  document.body.style.overflow = 'hidden'
  setTimeout(() => {
    const focusable = el.querySelector(
      'input:not([type="hidden"]):not([disabled]), button:not([disabled]), textarea, select, [tabindex="0"]'
    )
    focusable?.focus()
  }, 60)
}

export function closeModal(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.classList.remove('active')
  if (!document.querySelector('.modal-overlay.active')) {
    document.body.style.overflow = ''
  }
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
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    const open = document.querySelectorAll('.modal-overlay.active')
    if (open.length) closeModal(open[open.length - 1].id)
  })
}

/* ── GLOBAL AUTH ─────────────────────────────────────────────── */
let _currentUser  = null
let _userProfile  = null
const _authCbs    = []

export function onAuthChange(cb) { _authCbs.push(cb) }
function _notify() { _authCbs.forEach(cb => { try { cb(_currentUser, _userProfile) } catch(e){} }) }

export function getCurrentUser() { return _currentUser }
export function getUserProfile() { return _userProfile }

export async function initAuth() {
  if (!document.getElementById('globalAuthModal')) {
    document.body.insertAdjacentHTML('beforeend', _authModalHTML())
  }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      _currentUser = session.user
      const { data } = await supabase
        .from('login_information').select('*').eq('id', _currentUser.id).maybeSingle()
      _userProfile = data || {}
    }
  } catch(e) { console.warn('Auth session error:', e) }

  _wireAuthForms()
  updateHeaderAuthUI()
  _notify()

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      _currentUser = session.user
      const { data } = await supabase
        .from('login_information').select('*').eq('id', _currentUser.id).maybeSingle()
        .catch(() => ({ data: {} }))
      _userProfile = data || {}
    } else {
      _currentUser = null; _userProfile = null
    }
    updateHeaderAuthUI()
    _notify()
  })
}

function _authModalHTML() {
  return `
  <div class="modal-overlay" id="globalAuthModal" role="dialog" aria-modal="true">
    <div class="modal-box">
      <div class="modal-header">
        <h3>My Account</h3>
        <button class="modal-close" aria-label="Close" id="_authClose">&times;</button>
      </div>
      <div class="modal-body">
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login"  id="loginTab">Sign In</button>
          <button class="auth-tab"        data-tab="signup" id="signupTab">Create Account</button>
        </div>
        <div class="auth-tab-panel active" id="loginPanel">
          <form id="globalLoginForm" novalidate>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-envelope"></i> Email</label>
              <input type="email" id="loginEmail" class="form-input" placeholder="your@email.com" required autocomplete="email"/>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-lock"></i> Password</label>
              <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required autocomplete="current-password"/>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:10px;" id="loginSubmitBtn">
              <i class="fas fa-sign-in-alt"></i> Sign In
            </button>
          </form>
        </div>
        <div class="auth-tab-panel" id="signupPanel">
          <form id="globalSignupForm" novalidate>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-user"></i> Full Name *</label>
              <input type="text" id="signupName" class="form-input" placeholder="Your full name" required/>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-id-card"></i> Register Number *</label>
              <input type="text" id="signupRegno" class="form-input" placeholder="e.g. 22CS0001" required/>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-phone"></i> Phone *</label>
              <input type="tel" id="signupPhone" class="form-input" placeholder="+91 99999 99999" required/>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-venus-mars"></i> Gender *</label>
              <select id="signupGender" class="form-select" required>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-envelope"></i> Email *</label>
              <input type="email" id="signupEmail" class="form-input" placeholder="your@email.com" required autocomplete="email"/>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-lock"></i> Password (min 6 chars) *</label>
              <input type="password" id="signupPassword" class="form-input" placeholder="••••••••" required minlength="6" autocomplete="new-password"/>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:10px;" id="signupSubmitBtn">
              <i class="fas fa-user-plus"></i> Create Account
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>`
}

function _wireAuthForms() {
  // Close button
  document.getElementById('_authClose')?.addEventListener('click', () => closeModal('globalAuthModal'))

  // Tab switching
  document.querySelectorAll('#globalAuthModal .auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#globalAuthModal .auth-tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('#globalAuthModal .auth-tab-panel').forEach(p => p.classList.remove('active'))
      tab.classList.add('active')
      document.getElementById(tab.dataset.tab + 'Panel')?.classList.add('active')
    })
  })

  // Login
  document.getElementById('globalLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn  = document.getElementById('loginSubmitBtn')
    const email    = document.getElementById('loginEmail')?.value.trim()
    const password = document.getElementById('loginPassword')?.value
    if (!email || !password) { showToast('Please enter email and password.', 'warning'); return }
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In…'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'
    if (error) { showToast(error.message, 'error'); return }
    showToast('Welcome back! 👋', 'success')
    closeModal('globalAuthModal')
    document.getElementById('globalLoginForm').reset()
  })

  // Signup
  document.getElementById('globalSignupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn      = document.getElementById('signupSubmitBtn')
    const name     = document.getElementById('signupName')?.value.trim()
    const regno    = document.getElementById('signupRegno')?.value.trim()
    const phone    = document.getElementById('signupPhone')?.value.trim()
    const gender   = document.getElementById('signupGender')?.value
    const email    = document.getElementById('signupEmail')?.value.trim()
    const password = document.getElementById('signupPassword')?.value
    if (!name||!regno||!phone||!gender||!email||!password) { showToast('Fill all required fields.','warning'); return }
    if (password.length < 6) { showToast('Password must be at least 6 characters.','warning'); return }
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…'
    const { data, error } = await supabase.auth.signUp({ email, password })
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'
    if (error) { showToast(error.message, 'error'); return }
    if (data.user) {
      await supabase.from('login_information').upsert({ id: data.user.id, name, regno, phone, gender, email })
        .catch(() => {})
    }
    showToast('Account created! Check your email to verify. 🎉', 'success')
    closeModal('globalAuthModal')
    document.getElementById('globalSignupForm').reset()
  })
}

export function updateHeaderAuthUI() {
  const authBtns   = document.querySelectorAll('.global-header-auth')
  const userChips  = document.querySelectorAll('.global-header-user')
  const logoutBtns = document.querySelectorAll('.global-header-logout')
  if (_currentUser) {
    const name  = _userProfile?.name || _currentUser.email.split('@')[0]
    const regno = _userProfile?.regno || ''
    authBtns.forEach(b  => { b.style.display = 'none' })
    userChips.forEach(c => {
      c.style.display = 'inline-flex'
      c.innerHTML = `<i class="fas fa-user-circle"></i> ${name}${regno ? ' · ' + regno : ''}`
    })
    logoutBtns.forEach(b => { b.style.display = 'inline-flex' })
  } else {
    authBtns.forEach(b  => { b.style.display = 'inline-flex' })
    userChips.forEach(c => { c.style.display = 'none' })
    logoutBtns.forEach(b => { b.style.display = 'none' })
  }
}

export function openAuthModal(tab = 'login') {
  document.getElementById('signupTab')?.classList.remove('active')
  document.getElementById('loginTab')?.classList.remove('active')
  document.getElementById('signupPanel')?.classList.remove('active')
  document.getElementById('loginPanel')?.classList.remove('active')
  if (tab === 'signup') {
    document.getElementById('signupTab')?.classList.add('active')
    document.getElementById('signupPanel')?.classList.add('active')
  } else {
    document.getElementById('loginTab')?.classList.add('active')
    document.getElementById('loginPanel')?.classList.add('active')
  }
  openModal('globalAuthModal')
}

export async function logoutUser() {
  try {
    await supabase.auth.signOut()
    showToast('Signed out successfully.', 'info')
  } catch (e) {
    showToast('Sign-out error: ' + e.message, 'error')
  }
}

/* ── RIPPLE EFFECT ───────────────────────────────────────────── */
export function initRipple() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn, .nav-link')
    if (!btn || btn.disabled) return
    const rect = btn.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2.2
    const x    = e.clientX - rect.left - size / 2
    const y    = e.clientY - rect.top  - size / 2
    const r    = document.createElement('span')
    r.className = 'ripple'
    r.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`
    const pos = getComputedStyle(btn).position
    if (pos === 'static') btn.style.position = 'relative'
    btn.appendChild(r)
    r.addEventListener('animationend', () => r.remove(), { once: true })
  })
}

/* ── TILT CARDS ──────────────────────────────────────────────── */
export function initTiltCards(selector = '.fact-card, .qlink-card, .about-stat-card') {
  document.querySelectorAll(selector).forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect()
      const dx   = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2)
      const dy   = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2)
      card.style.transform  = `translateY(-10px) rotateX(${-dy * 4}deg) rotateY(${dx * 4}deg) scale(1.02)`
      card.style.transition = 'transform 0.12s ease'
    })
    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.55s cubic-bezier(0.34,1.2,0.64,1)'
      card.style.transform  = ''
    })
  })
}

/* ── SKELETON NOTICES ────────────────────────────────────────── */
export function showSkeletonNotices(containerId = 'noticesList') {
  const c = document.getElementById(containerId)
  if (!c) return
  c.innerHTML = Array(3).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-line short"></div>
      <div class="skeleton skeleton-line tall" style="width:82%;margin-top:4px;"></div>
      <div class="skeleton skeleton-line medium"></div>
      <div class="skeleton skeleton-line full"></div>
      <div class="skeleton skeleton-line full"></div>
      <div class="skeleton skeleton-line" style="height:40px;border-radius:10px;margin-top:8px;"></div>
    </div>`).join('')
}

/* ── PAGE TRANSITIONS ────────────────────────────────────────── */
export function initPageTransitions() {
  const overlay = document.getElementById('pageTransition')
  if (!overlay) return
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href')
    if (
      !href ||
      href.startsWith('http')  ||
      href.startsWith('#')     ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')    ||
      href.startsWith('javascript:') ||
      link.target === '_blank'
    ) return
    link.addEventListener('click', (e) => {
      e.preventDefault()
      overlay.classList.add('leaving')
      setTimeout(() => { window.location.href = href }, 265)
    })
  })
}

/* ── UTILS ───────────────────────────────────────────────────── */
export function formatNumber(n) { return Number(n).toLocaleString('en-IN') }