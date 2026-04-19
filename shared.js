// ================================================================
// shared.js — PDKV College v5
// 8-digit OTP via Supabase Edge Functions + Resend
//
// WHERE TO PUT YOUR KEYS:
//   - SUPABASE_URL and SUPABASE_ANON_KEY are already filled below
//     (they come from your supabaseClient.js — no change needed)
//   - RESEND_API_KEY goes in Supabase secrets (NOT here in frontend code)
//     Run: supabase secrets set RESEND_API_KEY=re_xxx --project-ref zsuonqltlodkzrqlhsnm
// ================================================================

import { supabase } from './supabaseClient.js'
import { injectSpeedInsights } from '@vercel/speed-insights'

injectSpeedInsights({ debug: false })

// ── YOUR SUPABASE PROJECT DETAILS ─────────────────────────────
// These are already correct for your project (zsuonqltlodkzrqlhsnm)
// Do NOT change these unless you move to a different Supabase project
const SUPABASE_URL      = 'https://zsuonqltlodkzrqlhsnm.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdW9ucWx0bG9ka3pycWxoc25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODUwNzAsImV4cCI6MjA4OTE2MTA3MH0.Ea8xTDxxp6GaDfUNuByjkQaUcFxJPrdO1VrzG06cTH4'
const EDGE_BASE         = `${SUPABASE_URL}/functions/v1`

// In-memory OTP verification state
// { 'email@example.com' → { verified: true, timestamp: 1234567890 } }
const _otpVerifiedMap = new Map()

// ── TOAST NOTIFICATIONS ───────────────────────────────────────
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
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`
  container.appendChild(toast)
  setTimeout(() => {
    toast.classList.add('toast-exit')
    toast.addEventListener('animationend', () => toast.remove(), { once: true })
  }, duration)
}

// ── OTP API CALLS ─────────────────────────────────────────────
// Calls the send-otp Edge Function — returns { success, error? }
export async function sendOtp(email) {
  try {
    const res = await fetch(`${EDGE_BASE}/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || 'Failed to send OTP' }
    return data
  } catch (err) {
    console.error('sendOtp network error:', err)
    return { success: false, error: 'Network error. Please check your connection and try again.' }
  }
}

// Calls the verify-otp Edge Function — returns { success, email?, error?, attempts_remaining? }
export async function verifyOtp(email, otp) {
  try {
    const res = await fetch(`${EDGE_BASE}/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email: email.toLowerCase().trim(), otp: otp.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      _otpVerifiedMap.set(email.toLowerCase().trim(), { verified: true, timestamp: Date.now() })
    }
    return data
  } catch (err) {
    console.error('verifyOtp network error:', err)
    return { success: false, error: 'Network error. Please check your connection and try again.' }
  }
}

// Check if an email was verified in this browser session (valid 30 min)
export function isOtpVerified(email) {
  const key    = email.toLowerCase().trim()
  const record = _otpVerifiedMap.get(key)
  if (!record || !record.verified) return false
  if (Date.now() - record.timestamp > 30 * 60 * 1000) {
    _otpVerifiedMap.delete(key)
    return false
  }
  return true
}

export function clearOtpVerification(email) {
  _otpVerifiedMap.delete(email.toLowerCase().trim())
}

// Backward-compat exports used by Courses.js
export { sendOtp as sendEmailOtp }
export function isEmailOtpVerified(email) { return isOtpVerified(email) }
export function clearOtpState(email)      { clearOtpVerification(email) }
export async function verifyEmailOtp(email, token) { return verifyOtp(email, token) }

// ── OTP MODAL CSS ─────────────────────────────────────────────
function _injectOtpStyles() {
  if (document.getElementById('pdkv-otp-styles')) return
  const s = document.createElement('style')
  s.id = 'pdkv-otp-styles'
  s.textContent = `
/* ─── OTP Modal Overlay ──────────────────────────────────────── */
#pdkv-otp-overlay {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(8, 10, 46, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s ease;
}
#pdkv-otp-overlay.otp-show {
  opacity: 1;
  pointer-events: all;
}
#pdkv-otp-box {
  background: #fff;
  border-radius: 26px;
  width: 100%; max-width: 448px;
  box-shadow: 0 28px 72px rgba(26, 35, 126, 0.22), 0 8px 24px rgba(0,0,0,0.14);
  overflow: hidden;
  transform: scale(0.88) translateY(30px);
  transition: transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
}
#pdkv-otp-overlay.otp-show #pdkv-otp-box {
  transform: scale(1) translateY(0);
}

/* Header */
.otp-hdr {
  background: linear-gradient(135deg, #1a237e 0%, #3949ab 52%, #388E3C 100%);
  padding: 28px 30px 24px;
  text-align: center; color: #fff; position: relative;
}
.otp-hdr-logo {
  width: 60px; height: 60px; border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.32);
  display: block; margin: 0 auto 13px;
}
.otp-hdr h3 {
  font-family: 'Poppins', sans-serif;
  font-size: 1.18rem; font-weight: 800; margin: 0 0 6px;
  letter-spacing: -0.02em;
}
.otp-hdr p {
  font-size: 0.83rem; opacity: 0.80; margin: 0; line-height: 1.55;
}
.otp-hdr p strong {
  background: rgba(255,255,255,0.16);
  padding: 1px 8px; border-radius: 50px; font-weight: 800;
}
.otp-close-x {
  position: absolute; top: 13px; right: 15px;
  width: 30px; height: 30px; border-radius: 50%;
  background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.22);
  color: #fff; cursor: pointer; font-size: 1rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.otp-close-x:hover { background: rgba(255,255,255,0.28); transform: rotate(90deg) scale(1.1); }

/* Body */
.otp-body { padding: 26px 30px 24px; }

/* Instruction text */
.otp-instr {
  font-size: 0.84rem; color: #6b7280; line-height: 1.65;
  margin: 0 0 22px; text-align: center;
}

/* 8 digit boxes */
.otp-digits {
  display: flex; gap: 7px; justify-content: center;
  margin-bottom: 6px;
}
.otp-d {
  width: 44px; height: 54px;
  border: 2px solid #e5e7eb; border-radius: 13px;
  background: #f9fafb; color: #1a237e;
  font-size: 1.42rem; font-weight: 900; text-align: center;
  font-family: 'Poppins', 'Courier New', monospace;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  outline: none; caret-color: #4CAF50;
}
.otp-d:focus {
  border-color: #3949ab;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(57, 73, 171, 0.10);
  transform: translateY(-3px) scale(1.06);
}
.otp-d.d-filled { border-color: #4CAF50; background: #f0fdf4; }
.otp-d.d-err {
  border-color: #ef4444 !important;
  background: #fef2f2 !important;
  animation: dShake 0.4s ease;
}
@keyframes dShake {
  0%,100%{transform:translateX(0);}
  25%{transform:translateX(-6px);}
  75%{transform:translateX(6px);}
}

/* Progress dots */
.otp-dots {
  display: flex; justify-content: center; gap: 5px; margin-bottom: 16px;
}
.otp-dots span {
  width: 6px; height: 6px; border-radius: 50%;
  background: #e5e7eb;
  transition: background 0.22s ease;
}
.otp-dots span.dot-on { background: #4CAF50; }

/* Timer & resend row */
.otp-timer-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 0.79rem; color: #9ca3af;
  margin-bottom: 16px;
}
.otp-countdown { font-weight: 700; color: #3949ab; }
.otp-countdown.otp-expiring { color: #ef4444; }
.otp-resend {
  background: none; border: 1px solid rgba(76,175,80,0.32);
  color: #388E3C; font-size: 0.79rem; font-weight: 700;
  cursor: pointer; padding: 4px 11px; border-radius: 50px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  transition: all 0.22s ease;
  display: none; align-items: center; gap: 5px;
}
.otp-resend.resend-show { display: inline-flex; }
.otp-resend:hover:not(:disabled) { background: rgba(76,175,80,0.08); }
.otp-resend:disabled { opacity: 0.5; cursor: not-allowed; }

/* Error / success message */
.otp-msg {
  font-size: 0.82rem; font-weight: 600; text-align: center;
  padding: 10px 14px; border-radius: 11px;
  margin-bottom: 14px; display: none;
}
.otp-msg.m-err {
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.22);
  color: #b91c1c;
}
.otp-msg.m-ok {
  background: rgba(76,175,80,0.09);
  border: 1px solid rgba(76,175,80,0.26);
  color: #166534;
}

/* Verify button */
.otp-btn {
  width: 100%; padding: 13px;
  background: linear-gradient(135deg, #1a237e, #3949ab);
  color: #fff; border: none; border-radius: 50px;
  font-size: 0.94rem; font-weight: 800; cursor: pointer;
  font-family: 'Plus Jakarta Sans', sans-serif;
  transition: all 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 4px 16px rgba(26,35,126,0.30);
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.otp-btn:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 10px 28px rgba(26,35,126,0.42);
}
.otp-btn:disabled { opacity: 0.58; cursor: not-allowed; transform: none; }
.otp-btn.btn-verified {
  background: linear-gradient(135deg, #4CAF50, #388E3C);
  box-shadow: 0 4px 16px rgba(76,175,80,0.38);
}

/* ─── Inline email field with OTP trigger ──────────────────── */
.otp-email-row {
  display: flex; gap: 8px; align-items: stretch;
}
.otp-email-row .form-input { flex: 1; min-width: 0; }
.otp-trigger-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 16px; border-radius: 11px;
  font-size: 0.80rem; font-weight: 700; white-space: nowrap; flex-shrink: 0;
  background: linear-gradient(135deg, #3949ab, #1a237e);
  color: #fff; border: none; cursor: pointer;
  font-family: 'Plus Jakarta Sans', sans-serif;
  transition: all 0.30s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 3px 10px rgba(26,35,126,0.26);
}
.otp-trigger-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(26,35,126,0.38);
}
.otp-trigger-btn:disabled { opacity: 0.60; cursor: not-allowed; transform: none; }
.otp-trigger-btn.trig-verified {
  background: linear-gradient(135deg, #4CAF50, #388E3C);
  box-shadow: 0 3px 10px rgba(76,175,80,0.28);
}

/* Verified chip shown below email field */
.otp-chip {
  display: none; align-items: center; gap: 5px;
  background: rgba(76,175,80,0.09); border: 1px solid rgba(76,175,80,0.26);
  color: #166534; font-size: 0.76rem; font-weight: 700;
  padding: 4px 11px; border-radius: 50px; margin-top: 6px; width: fit-content;
}
.otp-chip.chip-show {
  display: inline-flex;
  animation: chipIn 0.38s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes chipIn { from{transform:scale(0.7);opacity:0;} to{transform:scale(1);opacity:1;} }

.otp-hint {
  font-size: 0.75rem; color: #9ca3af;
  margin-top: 5px; display: flex; align-items: center; gap: 4px;
}

/* Verified email input state */
.form-input.email-locked {
  background: rgba(76,175,80,0.04);
  border-color: rgba(76,175,80,0.32);
}

/* ─── Responsive ─────────────────────────────────────────────── */
@media (max-width: 480px) {
  .otp-d { width: 36px; height: 46px; font-size: 1.2rem; border-radius: 10px; }
  .otp-digits { gap: 5px; }
  .otp-hdr, .otp-body { padding-left: 18px; padding-right: 18px; }
}
`
  document.head.appendChild(s)
}

// ── OTP MODAL STATE ───────────────────────────────────────────
let _otpCallback    = null
let _otpTimer       = null
let _otpEmail       = ''

function _buildModal() {
  const overlay = document.createElement('div')
  overlay.id = 'pdkv-otp-overlay'
  overlay.innerHTML = `
    <div id="pdkv-otp-box" role="dialog" aria-modal="true" aria-label="Email Verification">
      <div class="otp-hdr">
        <img
          src="https://yt3.googleusercontent.com/ytc/AIdro_k_qv60q5J-ADkI2QNCezEuT1zrK5KTSCIZMtIrhxphKU8=s900-c-k-c0x00ffffff-no-rj"
          alt="PDKV" class="otp-hdr-logo" />
        <h3>Verify Your Email</h3>
        <p>We sent an 8-digit code to<br><strong id="otp-email-lbl"></strong></p>
        <button class="otp-close-x" id="otp-x" aria-label="Close">✕</button>
      </div>
      <div class="otp-body">
        <p class="otp-instr">
          Enter the 8-digit code from your email inbox below.
          Check your spam folder if you don't see it.
        </p>
        <div class="otp-digits" id="otp-digits">
          ${[0,1,2,3,4,5,6,7].map(i =>
            `<input class="otp-d" id="otp-d${i}" type="text"
              inputmode="numeric" pattern="[0-9]" maxlength="1"
              autocomplete="${i===0 ? 'one-time-code' : 'off'}"
              aria-label="Digit ${i+1}" />`
          ).join('')}
        </div>
        <div class="otp-dots">
          ${[0,1,2,3,4,5,6,7].map(i => `<span id="dot${i}"></span>`).join('')}
        </div>
        <div class="otp-timer-row">
          <span class="otp-countdown" id="otp-cd">Expires in 10:00</span>
          <button class="otp-resend" id="otp-resend" disabled>
            <i class="fas fa-redo-alt"></i> Resend Code
          </button>
        </div>
        <div class="otp-msg" id="otp-msg"></div>
        <button class="otp-btn" id="otp-verify-btn">
          <i class="fas fa-shield-check"></i> Verify & Continue
        </button>
      </div>
    </div>`
  document.body.appendChild(overlay)

  // Wire digit inputs
  const digits = () => [...document.querySelectorAll('.otp-d')]

  digits().forEach((inp, i) => {
    inp.addEventListener('input', e => {
      const v = e.target.value.replace(/\D/g, '')
      e.target.value = v ? v[0] : ''
      e.target.classList.toggle('d-filled', !!v)
      e.target.classList.remove('d-err')
      _updateDots(digits())
      if (v && i < 7) digits()[i + 1]?.focus()
    })
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) digits()[i - 1]?.focus()
      if (e.key === 'Enter') _doVerify()
    })
    inp.addEventListener('paste', e => {
      e.preventDefault()
      const pasted = (e.clipboardData || window.clipboardData)
        .getData('text').replace(/\D/g, '').slice(0, 8)
      const ds = digits()
      pasted.split('').forEach((ch, idx) => {
        if (ds[idx]) { ds[idx].value = ch; ds[idx].classList.add('d-filled') }
      })
      _updateDots(ds)
      const nxt = ds.findIndex(d => !d.value)
      ;(nxt >= 0 ? ds[nxt] : ds[7])?.focus()
    })
  })

  document.getElementById('otp-verify-btn')?.addEventListener('click', _doVerify)
  document.getElementById('otp-resend')?.addEventListener('click', _doResend)
  document.getElementById('otp-x')?.addEventListener('click', () => {
    if (confirm('Cancel email verification? Your sign-in will not proceed.')) _closeModal()
  })
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      if (confirm('Cancel email verification? Your sign-in will not proceed.')) _closeModal()
    }
  })
}

function _updateDots(ds) {
  ds.forEach((d, i) => document.getElementById(`dot${i}`)?.classList.toggle('dot-on', !!d.value))
}

function _setMsg(text, type = 'err') {
  const el = document.getElementById('otp-msg')
  if (!el) return
  el.textContent = text
  el.className   = `otp-msg m-${type}`
  el.style.display = 'block'
}

function _clearMsg() {
  const el = document.getElementById('otp-msg')
  if (el) el.style.display = 'none'
}

function _getCode() {
  return [...document.querySelectorAll('.otp-d')].map(d => d.value).join('')
}

function _startTimer(sec = 600) {
  clearInterval(_otpTimer)
  let rem    = sec
  const cd   = document.getElementById('otp-cd')
  const resnd = document.getElementById('otp-resend')

  const tick = () => {
    if (!cd) return
    const m = Math.floor(rem / 60)
    const s = rem % 60
    cd.textContent = `Expires in ${m}:${String(s).padStart(2, '0')}`
    cd.classList.toggle('otp-expiring', rem <= 60)
    if (rem <= 0) {
      clearInterval(_otpTimer)
      cd.textContent = 'Code expired'
      if (resnd) { resnd.disabled = false; resnd.classList.add('resend-show') }
      return
    }
    rem--
  }
  tick()
  _otpTimer = setInterval(tick, 1000)

  // Show resend after 60 seconds
  setTimeout(() => {
    if (resnd) { resnd.disabled = false; resnd.classList.add('resend-show') }
  }, 60000)
}

async function _doVerify() {
  const code = _getCode()
  const btn  = document.getElementById('otp-verify-btn')
  const ds   = document.querySelectorAll('.otp-d')
  _clearMsg()

  if (code.length < 8) {
    _setMsg('Please enter all 8 digits of your verification code.')
    ds.forEach(d => { if (!d.value) d.classList.add('d-err') })
    return
  }

  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…'

  const result = await verifyOtp(_otpEmail, code)

  btn.disabled = false
  btn.innerHTML = '<i class="fas fa-shield-check"></i> Verify & Continue'

  if (!result.success) {
    _setMsg(result.error || 'Incorrect code. Please try again.')
    ds.forEach(d => d.classList.add('d-err'))
    setTimeout(() => ds.forEach(d => d.classList.remove('d-err')), 800)
    return
  }

  // Success
  clearInterval(_otpTimer)
  _setMsg('Email verified successfully!', 'ok')
  btn.classList.add('btn-verified')
  btn.innerHTML = '<i class="fas fa-check-circle"></i> Verified!'

  setTimeout(() => {
    _closeModal()
    if (_otpCallback) _otpCallback(_otpEmail)
  }, 700)
}

async function _doResend() {
  const resnd = document.getElementById('otp-resend')
  if (resnd) { resnd.disabled = true; resnd.innerHTML = '<i class="fas fa-spinner fa-spin"></i>' }

  const result = await sendOtp(_otpEmail)

  if (!result.success) {
    _setMsg(result.error || 'Failed to resend. Please try again.')
    if (resnd) {
      resnd.disabled = false
      resnd.innerHTML = '<i class="fas fa-redo-alt"></i> Resend Code'
    }
    return
  }

  // Reset inputs
  document.querySelectorAll('.otp-d').forEach(d => { d.value = ''; d.classList.remove('d-filled','d-err') })
  document.querySelectorAll('.otp-dots span').forEach(d => d.classList.remove('dot-on'))
  const cd = document.getElementById('otp-cd')
  if (cd) cd.classList.remove('otp-expiring')
  _clearMsg()
  _startTimer(600)
  if (resnd) {
    resnd.disabled = true
    resnd.innerHTML = '<i class="fas fa-redo-alt"></i> Resend Code'
    resnd.classList.remove('resend-show')
  }
  showToast('New verification code sent to your email.', 'success')
  setTimeout(() => document.getElementById('otp-d0')?.focus(), 100)
}

function _closeModal() {
  clearInterval(_otpTimer)
  const ov = document.getElementById('pdkv-otp-overlay')
  if (ov) {
    ov.classList.remove('otp-show')
    setTimeout(() => ov.remove(), 280)
  }
  _otpCallback = null
}

/**
 * Open the OTP verification modal.
 * Sends OTP to email first, then shows modal.
 * Calls onVerified(email) when user successfully verifies.
 */
export async function openOtpModal(email, onVerified) {
  _injectOtpStyles()

  const normalizedEmail = email.toLowerCase().trim()

  // Already verified this session? Skip modal.
  if (isOtpVerified(normalizedEmail)) {
    onVerified(normalizedEmail)
    return
  }

  // Send OTP
  const result = await sendOtp(normalizedEmail)
  if (!result.success) {
    showToast(result.error || 'Failed to send verification code. Please try again.', 'error', 5000)
    return
  }

  _otpEmail    = normalizedEmail
  _otpCallback = onVerified

  // Remove old modal if any
  document.getElementById('pdkv-otp-overlay')?.remove()
  _buildModal()

  // Set email label
  const lbl = document.getElementById('otp-email-lbl')
  if (lbl) lbl.textContent = normalizedEmail

  // Show modal
  const ov = document.getElementById('pdkv-otp-overlay')
  requestAnimationFrame(() => requestAnimationFrame(() => ov?.classList.add('otp-show')))

  _startTimer(600)
  setTimeout(() => document.getElementById('otp-d0')?.focus(), 400)
}

// ── GLOBAL window.pdkvSendOtp ─────────────────────────────────
// Called by onclick="pdkvSendOtp(...)" in auth modal buttons
window.pdkvSendOtp = async function(emailInputId, wrapperId) {
  const emailInput = document.getElementById(emailInputId)
  const email      = emailInput?.value?.trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Please enter a valid email address first.', 'warning')
    emailInput?.focus()
    return
  }

  const triggerBtn = document.getElementById(`${wrapperId}_sendBtn`)
  if (triggerBtn) {
    triggerBtn.disabled = true
    triggerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'
  }

  openOtpModal(email, (verifiedEmail) => {
    // Lock email input
    if (emailInput) { emailInput.readOnly = true; emailInput.classList.add('email-locked') }
    // Update trigger button
    if (triggerBtn) {
      triggerBtn.innerHTML = '<i class="fas fa-check"></i> Verified'
      triggerBtn.classList.add('trig-verified')
      triggerBtn.disabled = true
    }
    // Show verified chip
    const chip = document.getElementById(`${wrapperId}_chip`)
    if (chip) chip.classList.add('chip-show')
    // Hide hint
    const hint = document.getElementById(`${wrapperId}_hint`)
    if (hint) hint.style.display = 'none'
    // Fire event (used by login/signup forms to know OTP is done)
    document.dispatchEvent(new CustomEvent('pdkv:emailVerified', {
      detail: { email: verifiedEmail, emailInputId, wrapperId }
    }))
  })

  // Re-enable button if modal was closed without verifying
  setTimeout(() => {
    if (triggerBtn && !triggerBtn.classList.contains('trig-verified')) {
      triggerBtn.disabled = false
      triggerBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP'
    }
  }, 500)
}

// ── STICKY HEADER + SCROLL PROGRESS + BACK-TO-TOP ─────────── */
export function initStickyHeader() {
  _injectOtpStyles()
  const header = document.querySelector('.site-header')
  if (!header) return

  if (!document.getElementById('scrollProgressBar')) {
    const bar = document.createElement('div'); bar.id = 'scrollProgressBar'
    document.body.prepend(bar)
  }
  if (!document.getElementById('backToTop')) {
    const btn = document.createElement('button'); btn.id = 'backToTop'
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
    document.getElementById('backToTop')?.classList.toggle('visible', scrolled > 400)
  }
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
}

// ── HAMBURGER ─────────────────────────────────────────────────
export function initHamburger() {
  const btn = document.querySelector('.hamburger')
  const nav = document.querySelector('.site-nav')
  if (!btn || !nav) return

  const close = () => {
    btn.classList.remove('open'); nav.classList.remove('open')
    document.body.style.overflow = ''
  }
  btn.addEventListener('click', e => {
    e.stopPropagation()
    const open = btn.classList.toggle('open')
    nav.classList.toggle('open', open)
    document.body.style.overflow = open ? 'hidden' : ''
  })
  nav.querySelectorAll('.nav-link, .nav-auth-btn').forEach(l => l.addEventListener('click', close))
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) close()
  })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close() })
}

// ── SCROLL ANIMATIONS ─────────────────────────────────────────
export function initScrollAnimations() {
  const els = document.querySelectorAll('.animate-fade-up:not(.visible)')
  if (!els.length) return
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80)
        obs.unobserve(entry.target)
      }
    })
  }, { threshold: 0.07, rootMargin: '0px 0px -24px 0px' })
  els.forEach(el => obs.observe(el))
}

// ── COUNTER ANIMATION ─────────────────────────────────────────
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
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = 'true'
        animateCounter(entry.target)
        obs.unobserve(entry.target)
      }
    })
  }, { threshold: 0.4 })
  counters.forEach(c => obs.observe(c))
}

// ── MODAL HELPERS ─────────────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.classList.add('active')
  document.body.style.overflow = 'hidden'
  setTimeout(() => {
    el.querySelector('input:not([type="hidden"]):not([disabled])')?.focus()
  }, 60)
}

export function closeModal(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.classList.remove('active')
  if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = ''
}

export function initModalCloseHandlers() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id) })
  })
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal))
  })
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    const open = document.querySelectorAll('.modal-overlay.active')
    if (open.length) closeModal(open[open.length - 1].id)
  })
}

// ── PASSWORD TOGGLE ───────────────────────────────────────────
export function initPasswordToggles(container) {
  const scope = container || document
  scope.querySelectorAll('.pw-toggle-wrap').forEach(wrap => {
    if (wrap.dataset.pwInit) return
    wrap.dataset.pwInit = '1'
    const inp = wrap.querySelector('input')
    const btn = wrap.querySelector('.pw-eye-btn')
    if (!inp || !btn) return
    btn.addEventListener('click', e => {
      e.preventDefault()
      const show = inp.type === 'password'
      inp.type   = show ? 'text' : 'password'
      btn.innerHTML = show ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>'
      btn.title = show ? 'Hide password' : 'Show password'
    })
  })
}

// ── GLOBAL AUTH SYSTEM ────────────────────────────────────────
let _currentUser = null
let _userProfile = null
const _authCbs   = []

export function onAuthChange(cb)   { _authCbs.push(cb) }
function _notify()                 { _authCbs.forEach(cb => { try { cb(_currentUser, _userProfile) } catch(e){} }) }
export function getCurrentUser()   { return _currentUser }
export function getUserProfile()   { return _userProfile }

async function _fetchProfile(userId) {
  try {
    const { data } = await supabase.from('login_information').select('*').eq('id', userId).maybeSingle()
    _userProfile = data || {}
  } catch { _userProfile = {} }
  updateHeaderAuthUI()
  _notify()
}

export async function initAuth() {
  _injectOtpStyles()
  if (!document.getElementById('globalAuthModal')) {
    document.body.insertAdjacentHTML('beforeend', _authModalHTML())
  }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) { _currentUser = session.user; await _fetchProfile(_currentUser.id) }
  } catch(e) { console.warn('Auth session error:', e) }

  _wireAuthForms()
  updateHeaderAuthUI()
  _notify()

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      _currentUser = session.user
      await _fetchProfile(_currentUser.id)
    } else {
      _currentUser = null; _userProfile = null
    }
    updateHeaderAuthUI(); _notify()
  })
}

// ── AUTH MODAL HTML ───────────────────────────────────────────
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

        <!-- SIGN IN -->
        <div class="auth-tab-panel active" id="loginPanel">
          <form id="globalLoginForm" novalidate>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-envelope"></i> Email</label>
              <div class="otp-email-row">
                <input type="email" id="loginEmail" class="form-input"
                  placeholder="your@email.com" required autocomplete="email" />
                <button type="button" class="otp-trigger-btn" id="login_otp_sendBtn"
                  onclick="pdkvSendOtp('loginEmail','login_otp')">
                  <i class="fas fa-paper-plane"></i> Send OTP
                </button>
              </div>
              <span class="otp-hint" id="login_otp_hint">
                <i class="fas fa-info-circle"></i> Verify your email first, then enter your password
              </span>
              <span class="otp-chip" id="login_otp_chip">
                <i class="fas fa-check-circle"></i> Email Verified
              </span>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-lock"></i> Password</label>
              <div class="pw-toggle-wrap">
                <input type="password" id="loginPassword" class="form-input"
                  placeholder="••••••••" required autocomplete="current-password" />
                <button type="button" class="pw-eye-btn" title="Show password">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
            <button type="submit" class="btn btn-primary"
              style="width:100%;justify-content:center;margin-top:14px;" id="loginSubmitBtn">
              <i class="fas fa-sign-in-alt"></i> Sign In
            </button>
          </form>
        </div>

        <!-- CREATE ACCOUNT -->
        <div class="auth-tab-panel" id="signupPanel">
          <form id="globalSignupForm" novalidate>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-user"></i> Full Name *</label>
              <input type="text" id="signupName" class="form-input"
                placeholder="Your full name" required />
            </div>
            <div class="form-group">
              <label class="form-label">
                <i class="fas fa-id-card"></i> Register Number
                <span style="font-weight:400;opacity:.5;font-size:.74rem;">(optional)</span>
              </label>
              <input type="text" id="signupRegno" class="form-input" placeholder="e.g. 22CS0001" />
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-phone"></i> Phone *</label>
              <input type="tel" id="signupPhone" class="form-input"
                placeholder="+91 99999 99999" required />
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
              <div class="otp-email-row">
                <input type="email" id="signupEmail" class="form-input"
                  placeholder="your@email.com" required autocomplete="email" />
                <button type="button" class="otp-trigger-btn" id="signup_otp_sendBtn"
                  onclick="pdkvSendOtp('signupEmail','signup_otp')">
                  <i class="fas fa-paper-plane"></i> Send OTP
                </button>
              </div>
              <span class="otp-hint" id="signup_otp_hint">
                <i class="fas fa-info-circle"></i> Verify your email before creating an account
              </span>
              <span class="otp-chip" id="signup_otp_chip">
                <i class="fas fa-check-circle"></i> Email Verified
              </span>
            </div>
            <div class="form-group">
              <label class="form-label"><i class="fas fa-lock"></i> Password (min 6 chars) *</label>
              <div class="pw-toggle-wrap">
                <input type="password" id="signupPassword" class="form-input"
                  placeholder="••••••••" required minlength="6" autocomplete="new-password" />
                <button type="button" class="pw-eye-btn" title="Show password">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>
            <button type="submit" class="btn btn-primary"
              style="width:100%;justify-content:center;margin-top:14px;" id="signupSubmitBtn">
              <i class="fas fa-user-plus"></i> Create Account
            </button>
          </form>
        </div>

      </div>
    </div>
  </div>`
}

function _wireAuthForms() {
  document.getElementById('_authClose')?.addEventListener('click', () => closeModal('globalAuthModal'))

  document.querySelectorAll('#globalAuthModal .auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#globalAuthModal .auth-tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('#globalAuthModal .auth-tab-panel').forEach(p => p.classList.remove('active'))
      tab.classList.add('active')
      document.getElementById(tab.dataset.tab + 'Panel')?.classList.add('active')
    })
  })

  initPasswordToggles(document.getElementById('globalAuthModal'))

  // ── SIGN IN ────────────────────────────────────────────────
  document.getElementById('globalLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email    = document.getElementById('loginEmail')?.value.trim()
    const password = document.getElementById('loginPassword')?.value

    if (!email || !password) { showToast('Please enter your email and password.', 'warning'); return }

    if (!isOtpVerified(email)) {
      showToast('Please verify your email with OTP before signing in.', 'warning')
      const sb = document.getElementById('login_otp_sendBtn')
      if (sb) { sb.style.transform = 'scale(1.08)'; setTimeout(() => sb.style.transform = '', 400) }
      return
    }

    const btn = document.getElementById('loginSubmitBtn')
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…'

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In'

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        showToast('Incorrect password, or no account found. Try creating one.', 'error', 5000)
      } else {
        showToast(error.message, 'error')
      }
      return
    }

    if (data.user) {
      await supabase.from('login_information').upsert(
        { id: data.user.id, email, last_login: new Date().toISOString() },
        { onConflict: 'id' }
      )
    }

    showToast('Welcome back! 👋', 'success')
    closeModal('globalAuthModal')
    clearOtpVerification(email)
    document.getElementById('globalLoginForm').reset()
    _resetEmailField('login_otp', 'loginEmail')
  })

  // ── CREATE ACCOUNT ─────────────────────────────────────────
  document.getElementById('globalSignupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name     = document.getElementById('signupName')?.value.trim()
    const regno    = document.getElementById('signupRegno')?.value.trim() || null
    const phone    = document.getElementById('signupPhone')?.value.trim()
    const gender   = document.getElementById('signupGender')?.value
    const email    = document.getElementById('signupEmail')?.value.trim()
    const password = document.getElementById('signupPassword')?.value

    if (!name || !phone || !gender || !email || !password) {
      showToast('Please fill all required fields.', 'warning'); return
    }
    if (password.length < 6) { showToast('Password must be at least 6 characters.', 'warning'); return }

    if (!isOtpVerified(email)) {
      showToast('Please verify your email with OTP before creating an account.', 'warning')
      const sb = document.getElementById('signup_otp_sendBtn')
      if (sb) { sb.style.transform = 'scale(1.08)'; setTimeout(() => sb.style.transform = '', 400) }
      return
    }

    const btn = document.getElementById('signupSubmitBtn')
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account…'

    const { data, error } = await supabase.auth.signUp({ email, password })

    btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account'

    if (error) { showToast(error.message, 'error'); return }

    if (data.user?.id) {
      await supabase.from('login_information').upsert({
        id:         data.user.id,
        name,
        regno,
        phone,
        gender,
        email,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
      }, { onConflict: 'id' })
    }

    showToast('Account created! Welcome to PDKV College 🎉', 'success', 5000)
    closeModal('globalAuthModal')
    clearOtpVerification(email)
    document.getElementById('globalSignupForm').reset()
    _resetEmailField('signup_otp', 'signupEmail')
  })
}

function _resetEmailField(wrapperId, emailInputId) {
  const emailInput = document.getElementById(emailInputId)
  if (emailInput) { emailInput.readOnly = false; emailInput.classList.remove('email-locked') }
  const sendBtn = document.getElementById(`${wrapperId}_sendBtn`)
  if (sendBtn) {
    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP'
    sendBtn.classList.remove('trig-verified')
    sendBtn.disabled = false
    sendBtn.style.transform = ''
  }
  const chip = document.getElementById(`${wrapperId}_chip`)
  if (chip) chip.classList.remove('chip-show')
  const hint = document.getElementById(`${wrapperId}_hint`)
  if (hint) hint.style.display = ''
}

export function updateHeaderAuthUI() {
  const authBtns   = document.querySelectorAll('.global-header-auth')
  const userChips  = document.querySelectorAll('.global-header-user')
  const logoutBtns = document.querySelectorAll('.global-header-logout')
  if (_currentUser) {
    const name  = _userProfile?.name || _currentUser.email.split('@')[0]
    const regno = _userProfile?.regno || ''
    authBtns.forEach(b  => b.style.display = 'none')
    userChips.forEach(c => {
      c.style.display = 'inline-flex'
      c.innerHTML = `<i class="fas fa-user-circle"></i> ${_esc(name)}${regno ? ' · ' + _esc(regno) : ''}`
    })
    logoutBtns.forEach(b => b.style.display = 'inline-flex')
  } else {
    authBtns.forEach(b  => b.style.display = 'inline-flex')
    userChips.forEach(c => c.style.display = 'none')
    logoutBtns.forEach(b => b.style.display = 'none')
  }
}

function _esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export function openAuthModal(tab = 'login') {
  document.querySelectorAll('#globalAuthModal .auth-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('#globalAuthModal .auth-tab-panel').forEach(p => p.classList.remove('active'))
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
  try { await supabase.auth.signOut(); showToast('Signed out successfully.', 'info') }
  catch (e) { showToast('Sign-out error: ' + e.message, 'error') }
}

// ── RIPPLE ────────────────────────────────────────────────────
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
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative'
    btn.appendChild(r)
    r.addEventListener('animationend', () => r.remove(), { once: true })
  })
}

// ── TILT CARDS ────────────────────────────────────────────────
export function initTiltCards(selector = '.fact-card, .qlink-card, .about-stat-card') {
  document.querySelectorAll(selector).forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect()
      const dx   = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2)
      const dy   = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2)
      card.style.transform  = `translateY(-10px) rotateX(${-dy*4}deg) rotateY(${dx*4}deg) scale(1.02)`
      card.style.transition = 'transform 0.12s ease'
    })
    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.55s cubic-bezier(0.34,1.2,0.64,1)'
      card.style.transform  = ''
    })
  })
}

// ── SKELETON NOTICES ──────────────────────────────────────────
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

// ── PAGE TRANSITIONS ──────────────────────────────────────────
export function initPageTransitions() {
  const overlay = document.getElementById('pageTransition')
  if (!overlay) return
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href')
    if (!href || href.startsWith('http') || href.startsWith('#') ||
        href.startsWith('mailto:') || href.startsWith('tel:') ||
        href.startsWith('javascript:') || link.target === '_blank') return
    link.addEventListener('click', (e) => {
      e.preventDefault()
      overlay.classList.add('leaving')
      setTimeout(() => { window.location.href = href }, 265)
    })
  })
}

// ── UTILS ─────────────────────────────────────────────────────
export function formatNumber(n) { return Number(n).toLocaleString('en-IN') }

export async function uploadProfilePhoto(file, bucket, storagePath, imgSelectors = []) {
  if (!file) return null
  const localUrl = URL.createObjectURL(file)
  imgSelectors.forEach(sel => document.querySelectorAll(sel).forEach(img => img.src = localUrl))

  let uploadFile = file
  if (file.size > 1_000_000 && file.type.startsWith('image/')) {
    try { uploadFile = await _compressImage(file, 800, 0.82) } catch (_) {}
  }

  const { error } = await supabase.storage
    .from(bucket).upload(storagePath, uploadFile, { upsert: true, contentType: uploadFile.type })
  URL.revokeObjectURL(localUrl)
  if (error) { showToast('Photo upload failed: ' + error.message, 'error'); return null }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  const finalUrl = `${publicUrl}?t=${Date.now()}`
  imgSelectors.forEach(sel => document.querySelectorAll(sel).forEach(img => img.src = finalUrl))
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
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
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

export async function saveProfile({
  userId, fields, photoFile = null,
  photoBucket = 'image_files', photoPathFn = id => `avatars/${id}.jpg`,
  photoImgSelectors = [], onSuccess = null, onError = null
} = {}) {
  if (!userId) return false
  if (photoFile) {
    const path     = photoPathFn(userId)
    const photoUrl = await uploadProfilePhoto(photoFile, photoBucket, path, photoImgSelectors)
    const { error } = await supabase.from('login_information').upsert({ id: userId, ...fields })
    if (error) { showToast('Save failed: ' + error.message, 'error'); onError?.(error); return false }
    if (photoUrl) supabase.from('login_information').update({ photo_url: photoUrl }).eq('id', userId).catch(() => {})
    onSuccess?.(photoUrl)
  } else {
    const { error } = await supabase.from('login_information').upsert({ id: userId, ...fields })
    if (error) { showToast('Save failed: ' + error.message, 'error'); onError?.(error); return false }
    onSuccess?.(null)
  }
  return true
}

// Compat for Courses.js
export function buildOtpEmailField(fieldId, otpWrapperId, label = 'Email *', placeholder = 'your@email.com') {
  return `
    <div class="form-group">
      <label class="form-label"><i class="fas fa-envelope"></i> ${label}</label>
      <div class="otp-email-row">
        <input type="email" id="${fieldId}" class="form-input" placeholder="${placeholder}" required autocomplete="email"/>
        <button type="button" class="otp-trigger-btn" id="${otpWrapperId}_sendBtn"
          onclick="pdkvSendOtp('${fieldId}','${otpWrapperId}')">
          <i class="fas fa-paper-plane"></i> Send OTP
        </button>
      </div>
      <span class="otp-hint" id="${otpWrapperId}_hint">
        <i class="fas fa-info-circle"></i> Verify your email with OTP first
      </span>
      <span class="otp-chip" id="${otpWrapperId}_chip">
        <i class="fas fa-check-circle"></i> Email Verified
      </span>
    </div>`
}