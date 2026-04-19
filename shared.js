// ============================================================
// shared.js — PDKV College v6 (OTP Email Verification added)
// All email inputs now require OTP verification before proceeding
// ============================================================
import { supabase } from './supabaseClient.js'
import { injectSpeedInsights } from '@vercel/speed-insights'

injectSpeedInsights({ debug: false })

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

/* ── OTP EMAIL VERIFICATION SYSTEM ─────────────────────────── */
// Stores OTP state per email in memory
const _otpStore = {}

// Generate a 6-digit OTP and send it via Supabase Edge Function / direct email
// We use Supabase's signInWithOtp which sends a 6-digit code to the email
export async function sendEmailOtp(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Invalid email address.' }
  }

  try {
    // Use Supabase's built-in OTP (sends 6-digit code via email)
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        data: { otp_only: true }
      }
    })

    if (error) {
      // Rate limit or other errors
      return { success: false, error: error.message }
    }

    // Mark email as OTP-sent in memory
    _otpStore[email] = { sent: true, verified: false, timestamp: Date.now() }
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message || 'Failed to send OTP.' }
  }
}

// Verify OTP entered by user against Supabase
export async function verifyEmailOtp(email, token) {
  if (!email || !token) return { success: false, error: 'Email and OTP required.' }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: 'email'
    })

    if (error) {
      return { success: false, error: 'Invalid or expired OTP. Please try again.' }
    }

    // Mark as verified
    if (_otpStore[email]) _otpStore[email].verified = true
    return { success: true, session: data.session, user: data.user }
  } catch (e) {
    return { success: false, error: e.message || 'Verification failed.' }
  }
}

// Check if email is verified in current session
export function isEmailOtpVerified(email) {
  return _otpStore[email]?.verified === true
}

// Clear OTP state for email
export function clearOtpState(email) {
  if (email) delete _otpStore[email]
}

/* ── OTP INPUT WIDGET BUILDER ───────────────────────────────── */
// Returns HTML string for an OTP-enabled email field
// fieldId: the email input id
// otpWrapperId: the wrapper div id that will show OTP input
export function buildOtpEmailField(fieldId, otpWrapperId, label = 'Email *', placeholder = 'your@email.com') {
  return `
    <div class="form-group otp-email-group" id="${otpWrapperId}_outer">
      <label class="form-label"><i class="fas fa-envelope"></i> ${label}</label>
      <div class="otp-email-row">
        <input type="email" id="${fieldId}" class="form-input" placeholder="${placeholder}" required autocomplete="email"/>
        <button type="button" class="btn-send-otp" id="${otpWrapperId}_sendBtn" onclick="pdkvSendOtp('${fieldId}','${otpWrapperId}')">
          <i class="fas fa-paper-plane"></i> Send OTP
        </button>
      </div>
      <div id="${otpWrapperId}" class="otp-verify-panel" style="display:none;">
        <div class="otp-info-msg"><i class="fas fa-info-circle"></i> A 6-digit OTP has been sent to your email. Enter it below.</div>
        <div class="otp-input-row">
          <input type="text" id="${otpWrapperId}_code" class="form-input otp-code-input" 
            placeholder="Enter 6-digit OTP" maxlength="6" autocomplete="one-time-code"
            oninput="this.value=this.value.replace(/[^0-9]/g,'')" />
          <button type="button" class="btn-verify-otp" id="${otpWrapperId}_verifyBtn" onclick="pdkvVerifyOtp('${fieldId}','${otpWrapperId}')">
            <i class="fas fa-shield-check"></i> Verify
          </button>
        </div>
        <div class="otp-resend-row">
          <span class="otp-timer" id="${otpWrapperId}_timer"></span>
          <button type="button" class="otp-resend-btn" id="${otpWrapperId}_resendBtn" onclick="pdkvResendOtp('${fieldId}','${otpWrapperId}')" style="display:none;">
            <i class="fas fa-redo"></i> Resend OTP
          </button>
        </div>
        <div class="otp-verified-badge" id="${otpWrapperId}_badge" style="display:none;">
          <i class="fas fa-check-circle"></i> Email Verified!
        </div>
      </div>
    </div>`
}

/* ── GLOBAL OTP HANDLERS (attached to window) ───────────────── */
// These are called by onclick in dynamically injected HTML
window.pdkvSendOtp = async function(fieldId, wrapperId) {
  const emailInput = document.getElementById(fieldId)
  const sendBtn    = document.getElementById(wrapperId + '_sendBtn')
  const panel      = document.getElementById(wrapperId)
  const email      = emailInput?.value?.trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Please enter a valid email address first.', 'warning')
    emailInput?.focus()
    return
  }

  if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…' }

  const result = await sendEmailOtp(email)

  if (!result.success) {
    showToast('Failed to send OTP: ' + result.error, 'error')
    if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP' }
    return
  }

  // Show OTP panel
  if (panel) panel.style.display = 'block'
  if (emailInput) emailInput.readOnly = true
  if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-check"></i> OTP Sent' }
  showToast('OTP sent to ' + email + ' ✉️', 'success')

  // Start 60s countdown timer
  _startOtpTimer(wrapperId, 60)

  // Focus OTP input
  setTimeout(() => document.getElementById(wrapperId + '_code')?.focus(), 200)
}

window.pdkvVerifyOtp = async function(fieldId, wrapperId) {
  const emailInput  = document.getElementById(fieldId)
  const codeInput   = document.getElementById(wrapperId + '_code')
  const verifyBtn   = document.getElementById(wrapperId + '_verifyBtn')
  const badge       = document.getElementById(wrapperId + '_badge')
  const email       = emailInput?.value?.trim()
  const token       = codeInput?.value?.trim()

  if (!token || token.length !== 6) {
    showToast('Please enter the 6-digit OTP.', 'warning')
    codeInput?.focus()
    return
  }

  if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…' }

  const result = await verifyEmailOtp(email, token)

  if (!result.success) {
    showToast(result.error, 'error')
    if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.innerHTML = '<i class="fas fa-shield-check"></i> Verify' }
    codeInput?.select()
    return
  }

  // Success — show verified badge
  if (badge) badge.style.display = 'flex'
  if (codeInput) codeInput.readOnly = true
  if (verifyBtn) { verifyBtn.style.display = 'none' }

  const panel = document.getElementById(wrapperId)
  if (panel) {
    panel.querySelector('.otp-input-row')?.classList.add('verified')
    panel.querySelector('.otp-resend-row')?.style && (panel.querySelector('.otp-resend-row').style.display = 'none')
  }

  showToast('Email verified successfully! ✅', 'success')

  // Fire a custom event so forms can react
  document.dispatchEvent(new CustomEvent('pdkv:emailVerified', { detail: { email, fieldId, wrapperId } }))
}

window.pdkvResendOtp = async function(fieldId, wrapperId) {
  const emailInput = document.getElementById(fieldId)
  const email      = emailInput?.value?.trim()
  const resendBtn  = document.getElementById(wrapperId + '_resendBtn')
  if (!email) return

  if (resendBtn) { resendBtn.disabled = true; resendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>' }

  // Clear verified state
  clearOtpState(email)
  const result = await sendEmailOtp(email)

  if (!result.success) {
    showToast('Failed to resend: ' + result.error, 'error')
    if (resendBtn) { resendBtn.disabled = false; resendBtn.innerHTML = '<i class="fas fa-redo"></i> Resend OTP' }
    return
  }

  // Reset code input
  const codeInput = document.getElementById(wrapperId + '_code')
  if (codeInput) { codeInput.value = ''; codeInput.readOnly = false }
  const badge = document.getElementById(wrapperId + '_badge')
  if (badge) badge.style.display = 'none'

  const verifyBtn = document.getElementById(wrapperId + '_verifyBtn')
  if (verifyBtn) { verifyBtn.style.display = ''; verifyBtn.disabled = false; verifyBtn.innerHTML = '<i class="fas fa-shield-check"></i> Verify' }

  showToast('New OTP sent! ✉️', 'success')
  _startOtpTimer(wrapperId, 60)
}

function _startOtpTimer(wrapperId, seconds) {
  const timerEl   = document.getElementById(wrapperId + '_timer')
  const resendBtn = document.getElementById(wrapperId + '_resendBtn')
  if (resendBtn) resendBtn.style.display = 'none'

  let remaining = seconds
  const tick = () => {
    if (!document.getElementById(wrapperId + '_timer')) return // element removed
    if (timerEl) timerEl.textContent = `Resend in ${remaining}s`
    if (remaining <= 0) {
      if (timerEl) timerEl.textContent = ''
      if (resendBtn) { resendBtn.style.display = 'inline-flex' }
      return
    }
    remaining--
    setTimeout(tick, 1000)
  }
  tick()
}

/* ── OTP CSS INJECTION ──────────────────────────────────────── */
// Inject OTP-specific styles once
function _injectOtpStyles() {
  if (document.getElementById('pdkv-otp-styles')) return
  const style = document.createElement('style')
  style.id = 'pdkv-otp-styles'
  style.textContent = `
    .otp-email-row {
      display: flex; gap: 8px; align-items: stretch;
    }
    .otp-email-row .form-input {
      flex: 1; min-width: 0;
    }
    .btn-send-otp {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 16px; border-radius: var(--radius-sm, 10px);
      font-size: 0.82rem; font-weight: 700;
      background: linear-gradient(135deg, var(--accent2, #2196F3), var(--accent2-dark, #1565C0));
      color: white; border: none; cursor: pointer; white-space: nowrap;
      transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
      font-family: var(--font-body, 'Plus Jakarta Sans', sans-serif);
      flex-shrink: 0;
    }
    .btn-send-otp:hover:not(:disabled) {
      transform: translateY(-2px); box-shadow: 0 6px 18px rgba(33,150,243,0.35);
    }
    .btn-send-otp:disabled { opacity: 0.65; cursor: not-allowed; }

    .otp-verify-panel {
      margin-top: 12px;
      background: linear-gradient(135deg, rgba(33,150,243,0.06), rgba(76,175,80,0.06));
      border: 1.5px solid rgba(33,150,243,0.22);
      border-radius: var(--radius-sm, 10px);
      padding: 14px;
      animation: otpPanelIn 0.4s cubic-bezier(0.34,1.2,0.64,1);
    }
    @keyframes otpPanelIn {
      from { opacity: 0; transform: translateY(-10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .otp-info-msg {
      font-size: 0.80rem; color: var(--accent2-dark, #1565C0);
      margin-bottom: 10px; font-weight: 600;
      display: flex; align-items: center; gap: 6px;
    }
    .otp-input-row {
      display: flex; gap: 8px; margin-bottom: 8px;
    }
    .otp-code-input {
      letter-spacing: 0.25em; font-size: 1.1rem !important;
      font-weight: 800 !important; text-align: center;
      flex: 1;
    }
    .btn-verify-otp {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 16px; border-radius: var(--radius-sm, 10px);
      font-size: 0.82rem; font-weight: 700;
      background: linear-gradient(135deg, var(--accent, #4CAF50), var(--accent-dark, #388E3C));
      color: white; border: none; cursor: pointer; white-space: nowrap;
      transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
      font-family: var(--font-body, 'Plus Jakarta Sans', sans-serif);
      flex-shrink: 0;
    }
    .btn-verify-otp:hover:not(:disabled) {
      transform: translateY(-2px); box-shadow: 0 6px 18px rgba(76,175,80,0.35);
    }
    .btn-verify-otp:disabled { opacity: 0.65; cursor: not-allowed; }
    .otp-resend-row {
      display: flex; align-items: center; gap: 10px; font-size: 0.78rem;
    }
    .otp-timer { color: var(--text-muted, #6b7280); font-weight: 600; }
    .otp-resend-btn {
      display: inline-flex; align-items: center; gap: 5px;
      background: none; border: 1px solid rgba(33,150,243,0.35);
      color: var(--accent2, #2196F3); font-size: 0.78rem; font-weight: 700;
      padding: 4px 12px; border-radius: 50px; cursor: pointer;
      transition: all 0.25s ease; font-family: var(--font-body, 'Plus Jakarta Sans', sans-serif);
    }
    .otp-resend-btn:hover:not(:disabled) { background: rgba(33,150,243,0.08); }
    .otp-verified-badge {
      display: flex; align-items: center; gap: 6px;
      background: rgba(76,175,80,0.10); border: 1px solid rgba(76,175,80,0.28);
      color: var(--accent-dark, #388E3C); font-size: 0.82rem; font-weight: 700;
      padding: 8px 14px; border-radius: var(--radius-sm, 10px); margin-top: 8px;
      animation: verifiedIn 0.45s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes verifiedIn {
      from { transform: scale(0.88); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }
    .otp-verified-badge i { color: var(--accent, #4CAF50); font-size: 1rem; }

    /* Dark theme overrides for Student/Teacher portals */
    .tc-page .otp-verify-panel,
    body[data-dark] .otp-verify-panel,
    .sp-glass .otp-verify-panel {
      background: rgba(0,245,212,0.06); border-color: rgba(0,245,212,0.22);
    }
    .tc-page .otp-info-msg { color: #60a5fa; }
    .tc-page .otp-verified-badge {
      background: rgba(0,245,212,0.10); border-color: rgba(0,245,212,0.28); color: #a7f3d0;
    }

    /* Email verified state — lock icon on input */
    .form-input[readonly].verified-email {
      background: rgba(76,175,80,0.06); border-color: rgba(76,175,80,0.35);
    }
  `
  document.head.appendChild(style)
}

/* ── STICKY HEADER + SCROLL PROGRESS + BACK-TO-TOP ─────────── */
export function initStickyHeader() {
  _injectOtpStyles()
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

  onScroll()
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

/* ── COUNTER ANIMATION ────────────────────────────────────────── */
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
    const eased    = 1 - Math.pow(1 - progress, 3)
    el.textContent = fmt(target * eased)
    if (progress < 1) requestAnimationFrame(tick)
    else el.textContent = fmt(target)
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

/* ── PASSWORD TOGGLE ─────────────────────────────────────────── */
export function initPasswordToggles(container) {
  const scope = container || document
  scope.querySelectorAll('.pw-toggle-wrap').forEach(wrap => {
    if (wrap.dataset.pwInit) return
    wrap.dataset.pwInit = '1'
    const inp = wrap.querySelector('input')
    const btn = wrap.querySelector('.pw-eye-btn')
    if (!inp || !btn) return
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      const show = inp.type === 'password'
      inp.type   = show ? 'text' : 'password'
      btn.innerHTML = show
        ? '<i class="fas fa-eye-slash"></i>'
        : '<i class="fas fa-eye"></i>'
      btn.title = show ? 'Hide password' : 'Show password'
    })
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
  _injectOtpStyles()
  if (!document.getElementById('globalAuthModal')) {
    document.body.insertAdjacentHTML('beforeend', _authModalHTML())
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      _currentUser = session.user
      supabase
        .from('login_information')
        .select('*')
        .eq('id', _currentUser.id)
        .maybeSingle()
        .then(({ data }) => {
          _userProfile = data || {}
          updateHeaderAuthUI()
          _notify()
        })
        .catch(() => { _userProfile = {}; updateHeaderAuthUI(); _notify() })
    }
  } catch(e) { console.warn('Auth session error:', e) }

  _wireAuthForms()
  updateHeaderAuthUI()
  _notify()

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      _currentUser = session.user
      supabase
        .from('login_information')
        .select('*')
        .eq('id', _currentUser.id)
        .maybeSingle()
        .then(({ data }) => {
          _userProfile = data || {}
          updateHeaderAuthUI()
          _notify()
        })
        .catch(() => { _userProfile = {}; updateHeaderAuthUI(); _notify() })
    } else {
      _currentUser = null
      _userProfile = null
      updateHeaderAuthUI()
      _notify()
    }
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

        <!-- ── SIGN IN PANEL ── -->
        <div class="auth-tab-panel active" id="loginPanel">
          <form id="globalLoginForm" novalidate>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-envelope"></i> Email</label>
              <div class="otp-email-row">
                <input type="email" id="loginEmail" class="form-input" placeholder="your@email.com" required autocomplete="email"/>
                <button type="button" class="btn-send-otp" id="login_otp_sendBtn" onclick="pdkvSendOtp('loginEmail','login_otp')">
                  <i class="fas fa-paper-plane"></i> Send OTP
                </button>
              </div>
              <div id="login_otp" class="otp-verify-panel" style="display:none;">
                <div class="otp-info-msg"><i class="fas fa-info-circle"></i> A 6-digit OTP has been sent to your email.</div>
                <div class="otp-input-row">
                  <input type="text" id="login_otp_code" class="form-input otp-code-input"
                    placeholder="Enter 6-digit OTP" maxlength="6" autocomplete="one-time-code"
                    oninput="this.value=this.value.replace(/[^0-9]/g,'')" />
                  <button type="button" class="btn-verify-otp" id="login_otp_verifyBtn" onclick="pdkvVerifyOtp('loginEmail','login_otp')">
                    <i class="fas fa-shield-check"></i> Verify
                  </button>
                </div>
                <div class="otp-resend-row">
                  <span class="otp-timer" id="login_otp_timer"></span>
                  <button type="button" class="otp-resend-btn" id="login_otp_resendBtn" onclick="pdkvResendOtp('loginEmail','login_otp')" style="display:none;">
                    <i class="fas fa-redo"></i> Resend OTP
                  </button>
                </div>
                <div class="otp-verified-badge" id="login_otp_badge" style="display:none;">
                  <i class="fas fa-check-circle"></i> Email Verified!
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-lock"></i> Password</label>
              <div class="pw-toggle-wrap">
                <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required autocomplete="current-password"/>
                <button type="button" class="pw-eye-btn" title="Show password"><i class="fas fa-eye"></i></button>
              </div>
            </div>
            <div id="loginEmailVerifyNote" class="otp-info-msg" style="display:none;margin-bottom:8px;color:#e65100;background:rgba(255,152,0,0.08);border-radius:8px;padding:8px 12px;">
              <i class="fas fa-exclamation-triangle"></i> Please verify your email with OTP before signing in.
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:10px;" id="loginSubmitBtn">
              <i class="fas fa-sign-in-alt"></i> Sign In
            </button>
          </form>
        </div>

        <!-- ── CREATE ACCOUNT PANEL ── -->
        <div class="auth-tab-panel" id="signupPanel">
          <form id="globalSignupForm" novalidate>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-user"></i> Full Name *</label>
              <input type="text" id="signupName" class="form-input" placeholder="Your full name" required/>
            </div>
            <div class="form-group">
              <label class="form-label">
                <i class="fas fa-id-card"></i> Register Number
                <span style="font-weight:400;opacity:0.55;font-size:0.76rem;">(optional)</span>
              </label>
              <input type="text" id="signupRegno" class="form-input" placeholder="e.g. 22CS0001"/>
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
            <!-- Email with OTP verification for signup -->
            <div class="form-group">
              <label class="form-label"><i class="fas fa-envelope"></i> Email *</label>
              <div class="otp-email-row">
                <input type="email" id="signupEmail" class="form-input" placeholder="your@email.com" required autocomplete="email"/>
                <button type="button" class="btn-send-otp" id="signup_otp_sendBtn" onclick="pdkvSendOtp('signupEmail','signup_otp')">
                  <i class="fas fa-paper-plane"></i> Send OTP
                </button>
              </div>
              <div id="signup_otp" class="otp-verify-panel" style="display:none;">
                <div class="otp-info-msg"><i class="fas fa-info-circle"></i> A 6-digit OTP has been sent to your email.</div>
                <div class="otp-input-row">
                  <input type="text" id="signup_otp_code" class="form-input otp-code-input"
                    placeholder="Enter 6-digit OTP" maxlength="6" autocomplete="one-time-code"
                    oninput="this.value=this.value.replace(/[^0-9]/g,'')" />
                  <button type="button" class="btn-verify-otp" id="signup_otp_verifyBtn" onclick="pdkvVerifyOtp('signupEmail','signup_otp')">
                    <i class="fas fa-shield-check"></i> Verify
                  </button>
                </div>
                <div class="otp-resend-row">
                  <span class="otp-timer" id="signup_otp_timer"></span>
                  <button type="button" class="otp-resend-btn" id="signup_otp_resendBtn" onclick="pdkvResendOtp('signupEmail','signup_otp')" style="display:none;">
                    <i class="fas fa-redo"></i> Resend OTP
                  </button>
                </div>
                <div class="otp-verified-badge" id="signup_otp_badge" style="display:none;">
                  <i class="fas fa-check-circle"></i> Email Verified!
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-lock"></i> Password (min 6 chars) *</label>
              <div class="pw-toggle-wrap">
                <input type="password" id="signupPassword" class="form-input" placeholder="••••••••" required minlength="6" autocomplete="new-password"/>
                <button type="button" class="pw-eye-btn" title="Show password"><i class="fas fa-eye"></i></button>
              </div>
            </div>
            <div id="signupEmailVerifyNote" class="otp-info-msg" style="display:none;margin-bottom:8px;color:#e65100;background:rgba(255,152,0,0.08);border-radius:8px;padding:8px 12px;">
              <i class="fas fa-exclamation-triangle"></i> Please verify your email with OTP before creating account.
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

  initPasswordToggles(document.getElementById('globalAuthModal'))

  // ── LOGIN ──
  // When OTP is verified for login, Supabase already creates/logs in the session
  // We then just need to fetch the profile and close
  document.addEventListener('pdkv:emailVerified', async (ev) => {
    const { fieldId } = ev.detail
    // If login email was verified, auto-complete sign in
    if (fieldId === 'loginEmail') {
      const email = document.getElementById('loginEmail')?.value?.trim()
      if (!email) return
      const loginNote = document.getElementById('loginEmailVerifyNote')
      if (loginNote) loginNote.style.display = 'none'

      // Check if we have an active session from OTP verification
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        _currentUser = session.user
        // Fetch or create profile
        const { data: profile } = await supabase.from('login_information')
          .select('*').eq('id', _currentUser.id).maybeSingle()

        if (!profile) {
          // New user — need password set. Show password field.
          showToast('Email verified! Please enter a password to complete sign-in.', 'info', 5000)
        } else {
          _userProfile = profile
          showToast('Signed in successfully! 👋', 'success')
          closeModal('globalAuthModal')
          updateHeaderAuthUI()
          _notify()
        }
      }
    }
  })

  document.getElementById('globalLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email    = document.getElementById('loginEmail')?.value.trim()
    const password = document.getElementById('loginPassword')?.value
    const note     = document.getElementById('loginEmailVerifyNote')

    if (!email || !password) { showToast('Please enter email and password.', 'warning'); return }

    // Require OTP verification
    if (!isEmailOtpVerified(email)) {
      if (note) note.style.display = 'flex'
      showToast('Please verify your email with OTP first.', 'warning')
      document.getElementById('login_otp_sendBtn')?.focus()
      return
    }
    if (note) note.style.display = 'none'

    const btn = document.getElementById('loginSubmitBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In…'

    // Since OTP verification already signs in the user via Supabase,
    // try updating password if provided (for new users) or just confirm session
    const { data: { session } } = await supabase.auth.getSession()

    let signInOk = false

    if (session?.user) {
      // Already signed in via OTP — update password if needed
      const { error: pwErr } = await supabase.auth.updateUser({ password })
      if (!pwErr) signInOk = true
      else {
        // Password update failed — try traditional sign in
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        signInOk = !error
        if (!signInOk) { showToast(error.message, 'error') }
      }
    } else {
      // No session from OTP — try password sign in
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      signInOk = !error
      if (!signInOk) { showToast(error.message, 'error') }
    }

    btn.disabled = false
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'

    if (!signInOk) return

    // Save to login_information
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('login_information').upsert(
        { id: user.id, email, last_login: new Date().toISOString() },
        { onConflict: 'id' }
      )
    }

    showToast('Welcome back! 👋', 'success')
    closeModal('globalAuthModal')
    clearOtpState(email)
    document.getElementById('globalLoginForm').reset()
    document.getElementById('login_otp').style.display = 'none'
    document.getElementById('loginEmail').readOnly = false
    const loginBadge = document.getElementById('login_otp_badge')
    if (loginBadge) loginBadge.style.display = 'none'
  })

  // ── SIGNUP ──
  document.getElementById('globalSignupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name     = document.getElementById('signupName')?.value.trim()
    const regno    = document.getElementById('signupRegno')?.value.trim() || ''
    const phone    = document.getElementById('signupPhone')?.value.trim()
    const gender   = document.getElementById('signupGender')?.value
    const email    = document.getElementById('signupEmail')?.value.trim()
    const password = document.getElementById('signupPassword')?.value
    const note     = document.getElementById('signupEmailVerifyNote')

    if (!name || !phone || !gender || !email || !password) {
      showToast('Fill all required fields.', 'warning'); return
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'warning'); return
    }

    // Require OTP verification
    if (!isEmailOtpVerified(email)) {
      if (note) note.style.display = 'flex'
      showToast('Please verify your email with OTP first.', 'warning')
      document.getElementById('signup_otp_sendBtn')?.focus()
      return
    }
    if (note) note.style.display = 'none'

    const btn = document.getElementById('signupSubmitBtn')
    btn.disabled = true
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…'

    // OTP already created user — update password
    const { data: { session } } = await supabase.auth.getSession()
    let userId = session?.user?.id

    if (session?.user) {
      await supabase.auth.updateUser({ password })
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        showToast(error.message, 'error')
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'
        return
      }
      userId = data.user?.id
    }

    // Save full profile to login_information
    if (userId) {
      await supabase.from('login_information').upsert({
        id: userId, name, regno, phone, gender, email,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString()
      }, { onConflict: 'id' })
    }

    btn.disabled = false
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'

    showToast('Account created successfully! 🎉', 'success')
    closeModal('globalAuthModal')
    clearOtpState(email)
    document.getElementById('globalSignupForm').reset()
    document.getElementById('signup_otp').style.display = 'none'
    document.getElementById('signupEmail').readOnly = false
    const signupBadge = document.getElementById('signup_otp_badge')
    if (signupBadge) signupBadge.style.display = 'none'
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

/* ── FAST PROFILE PHOTO UPLOAD ───────────────────────────────── */
export async function uploadProfilePhoto(file, bucket, storagePath, imgSelectors = []) {
  if (!file) return null

  const localUrl = URL.createObjectURL(file)
  imgSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(img => { img.src = localUrl })
  })

  let uploadFile = file
  if (file.size > 1_000_000 && file.type.startsWith('image/')) {
    try { uploadFile = await _compressImage(file, 800, 0.82) } catch (_) {}
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, uploadFile, { upsert: true, contentType: uploadFile.type })

  URL.revokeObjectURL(localUrl)

  if (error) {
    showToast('Photo upload failed: ' + error.message, 'error')
    return null
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  const finalUrl = `${publicUrl}?t=${Date.now()}`

  imgSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(img => { img.src = finalUrl })
  })

  return finalUrl
}

function _compressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const scale  = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w      = Math.round(img.width  * scale)
        const h      = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Compression failed')); return }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        }, 'image/jpeg', quality)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

/* ── SAVE PROFILE ────────────────────────────────────────────── */
export async function saveProfile({
  userId,
  fields,
  photoFile         = null,
  photoBucket       = 'image_files',
  photoPathFn       = (id) => `avatars/${id}.jpg`,
  photoImgSelectors = [],
  onSuccess         = null,
  onError           = null
} = {}) {
  if (!userId) return false

  if (photoFile) {
    const path = photoPathFn(userId)
    const [photoUrl, { error: dbErr }] = await Promise.all([
      uploadProfilePhoto(photoFile, photoBucket, path, photoImgSelectors),
      supabase.from('login_information').upsert({ id: userId, ...fields })
    ])

    if (dbErr) {
      showToast('Save failed: ' + dbErr.message, 'error')
      onError?.(dbErr)
      return false
    }

    if (photoUrl) {
      supabase.from('login_information')
        .update({ photo_url: photoUrl })
        .eq('id', userId)
        .catch(() => {})
    }

    onSuccess?.(photoUrl)
  } else {
    const { error } = await supabase
      .from('login_information')
      .upsert({ id: userId, ...fields })

    if (error) {
      showToast('Save failed: ' + error.message, 'error')
      onError?.(error)
      return false
    }

    onSuccess?.(null)
  }

  return true
}