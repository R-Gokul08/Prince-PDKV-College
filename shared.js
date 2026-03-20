// ── Shared utilities — PDKV College ──────────────────────
import { supabase } from './supabaseClient.js'

// ── Toast ─────────────────────────────────────────────────
export function showToast(message, type = 'success', duration = 4200) {
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

// ── Sticky header ─────────────────────────────────────────
export function initStickyHeader() {
  const h = document.querySelector('.site-header')
  if (!h) return
  window.addEventListener('scroll', () => {
    h.classList.toggle('scrolled', window.scrollY > 60)
  }, { passive: true })
}

// ── Hamburger ─────────────────────────────────────────────
export function initHamburger() {
  const btn = document.querySelector('.hamburger')
  const nav = document.querySelector('.site-nav')
  if (!btn || !nav) return
  btn.addEventListener('click', () => {
    btn.classList.toggle('open')
    nav.classList.toggle('open')
  })
  nav.querySelectorAll('.nav-link').forEach(l =>
    l.addEventListener('click', () => { btn.classList.remove('open'); nav.classList.remove('open') })
  )
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      btn.classList.remove('open'); nav.classList.remove('open')
    }
  })
}

// ── Scroll animations ─────────────────────────────────────
export function initScrollAnimations() {
  const els = document.querySelectorAll('.animate-fade-up')
  if (!els.length) return
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 75)
        obs.unobserve(entry.target)
      }
    })
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' })
  els.forEach(el => obs.observe(el))
}

// ── Counter animation ─────────────────────────────────────
export function animateCounter(el) {
  const target = parseFloat(el.dataset.target)
  const isDecimal = String(target).includes('.')
  const isPercent = el.dataset.percent === 'true'
  const duration  = 1900
  const startTime = performance.now()
  function update(now) {
    const p = Math.min((now - startTime) / duration, 1)
    const e = 1 - Math.pow(1 - p, 3)
    const c = target * e
    el.textContent = (isDecimal ? c.toFixed(2) : Math.floor(c).toLocaleString('en-IN')) + (isPercent ? '%' : '')
    if (p < 1) requestAnimationFrame(update)
    else el.textContent = (isDecimal ? target.toFixed(2) : Math.floor(target).toLocaleString('en-IN')) + (isPercent ? '%' : '')
  }
  requestAnimationFrame(update)
}

export function initCounters() {
  const counters = document.querySelectorAll('[data-target]')
  if (!counters.length) return
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && !e.target.dataset.animated) {
        e.target.dataset.animated = 'true'
        animateCounter(e.target)
        obs.unobserve(e.target)
      }
    })
  }, { threshold: 0.5 })
  counters.forEach(c => obs.observe(c))
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
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id) })
  })
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal))
  })
}

// ================================================================
// GLOBAL AUTH SYSTEM
// ================================================================
let _user    = null
let _profile = null
const _listeners = []

export function onAuthChange(cb)    { _listeners.push(cb) }
export function getCurrentUser()    { return _user }
export function getUserProfile()    { return _profile }

function _notify() { _listeners.forEach(cb => cb(_user, _profile)) }

export async function initAuth() {
  if (!document.getElementById('globalAuthModal')) {
    document.body.insertAdjacentHTML('beforeend', _authModalHTML())
  }

  // Load session
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    _user = session.user
    const { data } = await supabase
      .from('login_information').select('*').eq('id', _user.id).maybeSingle()
    _profile = data || {}
  }

  _setupHandlers()
  updateHeaderAuthUI()
  _notify()

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      _user = session.user
      const { data } = await supabase
        .from('login_information').select('*').eq('id', _user.id).maybeSingle()
      _profile = data || {}
    } else {
      _user = null; _profile = null
    }
    updateHeaderAuthUI()
    _notify()
  })
}

function _authModalHTML() {
  return `
  <div class="modal-overlay" id="globalAuthModal">
    <div class="modal-box">
      <div class="modal-header">
        <h3 id="globalAuthTitle">Account</h3>
        <button class="modal-close" onclick="document.getElementById('globalAuthModal').classList.remove('active');document.body.style.overflow=''">&times;</button>
      </div>
      <div class="modal-body">
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login"  id="loginTab">Sign In</button>
          <button class="auth-tab"        data-tab="signup" id="signupTab">Create Account</button>
        </div>
        <!-- LOGIN -->
        <div class="auth-tab-panel active" id="loginPanel">
          <form id="globalLoginForm" novalidate>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-envelope"></i> Email</label>
              <input type="email" id="loginEmail" class="form-input" placeholder="your@email.com" required />
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-lock"></i> Password</label>
              <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:10px;" id="loginSubmitBtn">
              <i class="fas fa-sign-in-alt"></i> Sign In
            </button>
          </form>
        </div>
        <!-- SIGNUP -->
        <div class="auth-tab-panel" id="signupPanel">
          <form id="globalSignupForm" novalidate>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-user"></i> Full Name *</label>
              <input type="text" id="signupName" class="form-input" placeholder="Your full name" required />
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-id-card"></i> Register Number *</label>
              <input type="text" id="signupRegno" class="form-input" placeholder="e.g. 22CS0001" required />
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-phone"></i> Phone Number *</label>
              <input type="tel" id="signupPhone" class="form-input" placeholder="+91 99999 99999" required />
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-envelope"></i> Email *</label>
              <input type="email" id="signupEmail" class="form-input" placeholder="your@email.com" required />
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-lock"></i> Password *</label>
              <input type="password" id="signupPassword" class="form-input" placeholder="Min 6 characters" required />
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

function _setupHandlers() {
  // Tab switching
  document.querySelectorAll('#globalAuthModal .auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#globalAuthModal .auth-tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('#globalAuthModal .auth-tab-panel').forEach(p => p.classList.remove('active'))
      tab.classList.add('active')
      document.getElementById(tab.dataset.tab + 'Panel').classList.add('active')
    })
  })

  // Login
  document.getElementById('globalLoginForm').addEventListener('submit', async e => {
    e.preventDefault()
    const btn = document.getElementById('loginSubmitBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In…'
    const { error } = await supabase.auth.signInWithPassword({
      email:    document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value
    })
    if (error) {
      showToast(error.message, 'error')
      btn.disabled = false
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'
      return
    }
    showToast('Welcome back! Login successful.', 'success')
    closeModal('globalAuthModal')
    btn.disabled = false
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'
    document.getElementById('globalLoginForm').reset()
  })

  // Signup
  document.getElementById('globalSignupForm').addEventListener('submit', async e => {
    e.preventDefault()
    const btn = document.getElementById('signupSubmitBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…'
    const name  = document.getElementById('signupName').value.trim()
    const regno = document.getElementById('signupRegno').value.trim()
    const phone = document.getElementById('signupPhone').value.trim()
    const email = document.getElementById('signupEmail').value.trim()
    const pass  = document.getElementById('signupPassword').value
    if (!name || !regno || !phone || !email || !pass) {
      showToast('Please fill in all required fields.', 'error')
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'
      return
    }
    const { data, error } = await supabase.auth.signUp({ email, password: pass })
    if (error) {
      showToast(error.message, 'error')
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'
      return
    }
    if (data.user) {
      await supabase.from('login_information').upsert({ id: data.user.id, name, regno, phone, email })
    }
    showToast('Account created! You can now sign in.', 'success')
    closeModal('globalAuthModal')
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'
    document.getElementById('globalSignupForm').reset()
  })
}

export function updateHeaderAuthUI() {
  const loggedIn = !!_user
  const name   = _profile?.name  || (_user?.email?.split('@')[0] ?? '')
  const regno  = _profile?.regno || ''

  document.querySelectorAll('.global-header-auth').forEach(el =>
    el.style.display = loggedIn ? 'none' : 'inline-flex')
  document.querySelectorAll('.global-header-user').forEach(el => {
    el.style.display = loggedIn ? 'inline-flex' : 'none'
    if (loggedIn) el.innerHTML = `<i class="fas fa-user-circle"></i> ${name}${regno ? ' · ' + regno : ''}`
  })
  document.querySelectorAll('.global-header-logout').forEach(el =>
    el.style.display = loggedIn ? 'inline-flex' : 'none')
}

export function openAuthModal(tab = 'login') {
  const lTab = document.getElementById('loginTab')
  const sTab = document.getElementById('signupTab')
  const lPan = document.getElementById('loginPanel')
  const sPan = document.getElementById('signupPanel')
  if (tab === 'signup') {
    lTab?.classList.remove('active'); sTab?.classList.add('active')
    lPan?.classList.remove('active'); sPan?.classList.add('active')
  } else {
    sTab?.classList.remove('active'); lTab?.classList.add('active')
    sPan?.classList.remove('active'); lPan?.classList.add('active')
  }
  openModal('globalAuthModal')
}

export async function logoutUser() {
  await supabase.auth.signOut()
  showToast('Logged out successfully.', 'info')
}