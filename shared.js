// Shared utilities used across all pages
import { supabase } from './supabaseClient.js'

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

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 80)
    const bar = document.getElementById('scrollProgressBar')
    if (bar) {
      const docH = document.documentElement.scrollHeight - window.innerHeight
      bar.style.width = (docH > 0 ? (window.scrollY / docH) * 100 : 0) + '%'
    }
    const btt = document.getElementById('backToTop')
    if (btt) btt.classList.toggle('visible', window.scrollY > 400)
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

  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      btn.classList.remove('open')
      nav.classList.remove('open')
    })
  })

  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      btn.classList.remove('open')
      nav.classList.remove('open')
    }
  })
}

// ── Intersection Observer for fade-up animations ─────────
export function initScrollAnimations() {
  const els = document.querySelectorAll('.animate-fade-up:not(.visible)')
  if (!els.length) return

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 90)
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' })

  els.forEach(el => observer.observe(el))
}

// ── Counter animation ─────────────────────────────────────
export function animateCounter(el) {
  const target = parseFloat(el.dataset.target)
  const isDecimal = String(target).includes('.')
  const isPercent = el.dataset.percent === 'true'
  const duration = 1800
  const startTime = performance.now()

  function update(now) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = target * eased
    el.textContent = isDecimal
      ? current.toFixed(2) + (isPercent ? '%' : '')
      : Math.floor(current).toLocaleString('en-IN') + (isPercent ? '%' : '')
    if (progress < 1) requestAnimationFrame(update)
    else el.textContent = (isDecimal ? target.toFixed(2) : Math.floor(target).toLocaleString('en-IN')) + (isPercent ? '%' : '')
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

// ── GLOBAL AUTH SYSTEM ─────────────────────────────────────
let _currentUser = null
let _userProfile = null
const _authListeners = []

export function onAuthChange(cb) { _authListeners.push(cb) }
function notifyAuthListeners() { _authListeners.forEach(cb => cb(_currentUser, _userProfile)) }

export function getCurrentUser() { return _currentUser }
export function getUserProfile() { return _userProfile }

export async function initAuth() {
  if (!document.getElementById('globalAuthModal')) {
    document.body.insertAdjacentHTML('beforeend', getAuthModalHTML())
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    _currentUser = session.user
    const { data } = await supabase.from('login_information').select('*').eq('id', _currentUser.id).maybeSingle()
    _userProfile = data || {}
  }

  setupAuthModalHandlers()
  updateHeaderAuthUI()
  notifyAuthListeners()

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      _currentUser = session.user
      const { data } = await supabase.from('login_information').select('*').eq('id', _currentUser.id).maybeSingle()
      _userProfile = data || {}
    } else {
      _currentUser = null
      _userProfile = null
    }
    updateHeaderAuthUI()
    notifyAuthListeners()
  })
}

function getAuthModalHTML() {
  return `
  <div class="modal-overlay" id="globalAuthModal">
    <div class="modal-box">
      <div class="modal-header">
        <h3 id="globalAuthTitle">Account</h3>
        <button class="modal-close" onclick="document.getElementById('globalAuthModal').classList.remove('active');document.body.style.overflow=''">&times;</button>
      </div>
      <div class="modal-body">
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login" id="loginTab">Sign In</button>
          <button class="auth-tab" data-tab="signup" id="signupTab">Create Account</button>
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
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" id="loginSubmitBtn">
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
              <input type="email" id="signupEmail" class="form-input" placeholder="your@email.com" required />
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-lock"></i> Password *</label>
              <input type="password" id="signupPassword" class="form-input" placeholder="Min 6 characters" required />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" id="signupSubmitBtn">
              <i class="fas fa-user-plus"></i> Create Account
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>`
}

function setupAuthModalHandlers() {
  document.querySelectorAll('#globalAuthModal .auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#globalAuthModal .auth-tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('#globalAuthModal .auth-tab-panel').forEach(p => p.classList.remove('active'))
      tab.classList.add('active')
      document.getElementById(tab.dataset.tab + 'Panel').classList.add('active')
    })
  })

  document.getElementById('globalLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = document.getElementById('loginSubmitBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In…'
    const email = document.getElementById('loginEmail').value.trim()
    const password = document.getElementById('loginPassword').value
    const { error } = await supabase.auth.signInWithPassword({ email, password })
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

  document.getElementById('globalSignupForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = document.getElementById('signupSubmitBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account…'

    const name     = document.getElementById('signupName').value.trim()
    const regno    = document.getElementById('signupRegno').value.trim()
    const phone    = document.getElementById('signupPhone').value.trim()
    const gender   = document.getElementById('signupGender').value
    const email    = document.getElementById('signupEmail').value.trim()
    const password = document.getElementById('signupPassword').value

    if (!name || !regno || !phone || !gender || !email || !password) {
      showToast('Please fill in all required fields.', 'error')
      btn.disabled = false
      btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'
      return
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      showToast(error.message, 'error')
      btn.disabled = false
      btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'
      return
    }

    if (data.user) {
      await supabase.from('login_information').upsert({ id: data.user.id, name, regno, phone, gender, email })
    }

    showToast('Account created! You may need to verify your email.', 'success')
    closeModal('globalAuthModal')
    btn.disabled = false
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'
    document.getElementById('globalSignupForm').reset()
  })
}

export function updateHeaderAuthUI() {
  const authBtns   = document.querySelectorAll('.global-header-auth')
  const userChips  = document.querySelectorAll('.global-header-user')
  const logoutBtns = document.querySelectorAll('.global-header-logout')

  if (_currentUser) {
    const displayName = _userProfile?.name || _currentUser.email.split('@')[0]
    const regno = _userProfile?.regno || ''
    authBtns.forEach(btn => btn.style.display = 'none')
    userChips.forEach(chip => {
      chip.style.display = 'inline-flex'
      chip.innerHTML = `<i class="fas fa-user-circle"></i> ${displayName}${regno ? ' · ' + regno : ''}`
    })
    logoutBtns.forEach(btn => btn.style.display = 'inline-flex')
  } else {
    authBtns.forEach(btn => btn.style.display = 'inline-flex')
    userChips.forEach(chip => chip.style.display = 'none')
    logoutBtns.forEach(btn => btn.style.display = 'none')
  }
}

export function openAuthModal(tab = 'login') {
  const loginTab    = document.getElementById('loginTab')
  const signupTab   = document.getElementById('signupTab')
  const loginPanel  = document.getElementById('loginPanel')
  const signupPanel = document.getElementById('signupPanel')

  if (tab === 'signup') {
    loginTab?.classList.remove('active');  signupTab?.classList.add('active')
    loginPanel?.classList.remove('active'); signupPanel?.classList.add('active')
  } else {
    signupTab?.classList.remove('active'); loginTab?.classList.add('active')
    signupPanel?.classList.remove('active'); loginPanel?.classList.add('active')
  }
  openModal('globalAuthModal')
}

export async function logoutUser() {
  await supabase.auth.signOut()
  showToast('Logged out successfully!', 'info')
}

// ── Ripple effect ──────────────────────────────────────────
export function initRipple() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn')
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    const x = e.clientX - rect.left - size / 2
    const y = e.clientY - rect.top - size / 2
    const ripple = document.createElement('span')
    ripple.className = 'ripple'
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`
    btn.appendChild(ripple)
    ripple.addEventListener('animationend', () => ripple.remove())
  })
}

// ── Tilt effect on cards ──────────────────────────────────
export function initTiltCards(selector = '.fact-card, .qlink-card, .about-stat-card') {
  document.querySelectorAll(selector).forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect()
      const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
      const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
      card.style.transform = `translateY(-10px) rotateX(${-dy * 5}deg) rotateY(${dx * 5}deg) scale(1.02)`
    })
    card.addEventListener('mouseleave', () => {
      card.style.transform = ''
      card.style.transition = 'transform 0.5s cubic-bezier(0.34,1.2,0.64,1)'
    })
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform 0.15s ease'
    })
  })
}

// ── Skeleton notice cards ─────────────────────────────────
export function showSkeletonNotices(containerId = 'noticesList') {
  const container = document.getElementById(containerId)
  if (!container) return
  container.innerHTML = Array(3).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-line short"></div>
      <div class="skeleton skeleton-line tall" style="width:80%;margin-top:4px;"></div>
      <div class="skeleton skeleton-line medium"></div>
      <div class="skeleton skeleton-line full"></div>
      <div class="skeleton skeleton-line full"></div>
      <div class="skeleton skeleton-line" style="height:40px;border-radius:10px;margin-top:8px;"></div>
    </div>`).join('')
}

// ── Page transitions ──────────────────────────────────────
export function initPageTransitions() {
  const overlay = document.getElementById('pageTransition')
  if (!overlay) return

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href')
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto') || href.startsWith('tel')) return
    if (link.target === '_blank') return
    link.addEventListener('click', (e) => {
      e.preventDefault()
      overlay.classList.add('leaving')
      setTimeout(() => { window.location.href = href }, 280)
    })
  })
}

export function formatNumber(n) { return n.toLocaleString('en-IN') }