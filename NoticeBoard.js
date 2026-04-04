import { supabase } from './supabaseClient.js'
import {
  initStickyHeader, initHamburger, initScrollAnimations,
  openModal, closeModal, initModalCloseHandlers,
  showToast, initAuth, openAuthModal, logoutUser,
  getCurrentUser, getUserProfile, onAuthChange,
  initRipple, showSkeletonNotices, initPageTransitions
} from './shared.js'

let notices       = []
let currentFilter = 'all'
let searchQuery   = ''

const TYPE_CONFIG = {
  event:  { emoji: '🎉', label: 'Event',  color: '#4CAF50', badgeClass: 'badge-green' },
  exam:   { emoji: '📝', label: 'Exam',   color: '#F44336', badgeClass: 'badge-red'   },
  notice: { emoji: '📢', label: 'Notice', color: '#2196F3', badgeClass: 'badge-blue'  }
}

// ── BOOT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initPageTransitions()
  initScrollAnimations()
  initModalCloseHandlers()
  initRipple()
  setupFilters()
  setupRegisterForm()
  showSkeletonNotices()

  await initAuth()

  document.getElementById('headerLoginBtn')
    ?.addEventListener('click', () => openAuthModal('login'))

  document.querySelectorAll('.global-header-logout')
    .forEach(btn => btn.addEventListener('click', () => logoutUser()))

  // Re-render when auth state changes (login/logout)
  onAuthChange((user, profile) => {
    updateHeroGreeting(user, profile)
    renderNotices()
  })

  await loadNotices()
  setupRealtime()
})

function updateHeroGreeting(user, profile) {
  const greeting = document.getElementById('userGreeting')
  if (!greeting) return
  if (user) {
    greeting.style.display  = 'inline-flex'
    greeting.textContent    = `👋 Hi, ${profile?.name || user.email.split('@')[0]}!`
  } else {
    greeting.style.display  = 'none'
  }
}

// ── LOAD & RENDER ─────────────────────────────────────────────
async function loadNotices() {
  const { data, error } = await supabase
    .from('notices_informations')
    .select('*')
    .order('date', { ascending: true })

  if (error) { showToast('Failed to load notices: ' + error.message, 'error'); return }
  notices = data || []
  renderNotices()
}

function renderNotices() {
  const container   = document.getElementById('noticesList')
  if (!container) return
  const currentUser = getCurrentUser()

  let filtered = currentFilter === 'all'
    ? notices
    : notices.filter(n => n.type === currentFilter)

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(n =>
      (n.title       || '').toLowerCase().includes(q) ||
      (n.description || '').toLowerCase().includes(q) ||
      (n.type        || '').toLowerCase().includes(q)
    )
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="nb-empty">
        <div class="nb-empty-icon">📭</div>
        <p>No ${
          searchQuery
            ? `results for "<strong>${escHtml(searchQuery)}</strong>"`
            : (currentFilter === 'all' ? '' : currentFilter + ' ') + 'notices found.'
        }.</p>
      </div>`
    return
  }

  container.innerHTML = filtered.map(n => buildCard(n, currentUser)).join('')
}

function buildCard(n, currentUser) {
  const cfg    = TYPE_CONFIG[n.type] || TYPE_CONFIG.notice
  const regs   = Array.isArray(n.registrations) ? n.registrations : []
  const isReg  = currentUser && regs.some(r => r.email === currentUser.email)
  const dateStr = n.date
    ? new Date(n.date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
      })
    : '—'

  let btnHtml
  if (n.type === 'notice') {
    btnHtml = `<button class="notice-action-btn nb-view-btn" onclick="handleAction('${n.id}','notice')">
                 <i class="fas fa-eye"></i> View Details</button>`
  } else if (isReg) {
    btnHtml = `<button class="notice-action-btn nb-regd-btn" disabled>
                 <i class="fas fa-check-circle"></i> Registered!</button>`
  } else if (currentUser) {
    btnHtml = `<button class="notice-action-btn nb-reg-btn" onclick="handleAction('${n.id}','${n.type}')">
                 <i class="fas fa-clipboard-check"></i> Register Now</button>`
  } else {
    btnHtml = `<button class="notice-action-btn nb-signin-btn" onclick="openGlobalAuth()">
                 <i class="fas fa-sign-in-alt"></i> Sign In to Register</button>`
  }

  return `
    <div class="notice-card">
      <div class="notice-top-bar" style="background:${cfg.color};"></div>
      <div class="notice-card-body">
        <div class="notice-card-header">
          <span class="badge ${cfg.badgeClass}">${cfg.emoji} ${cfg.label}</span>
          ${n.type !== 'notice' ? `<span class="reg-count-chip"><i class="fas fa-users"></i> ${regs.length} Registered</span>` : ''}
        </div>
        <h3 class="notice-card-title">${escHtml(n.title)}</h3>
        <div class="notice-meta">
          <span><i class="fas fa-calendar"></i> ${dateStr}</span>
          <span><i class="fas fa-clock"></i> ${n.time || 'All Day'}</span>
        </div>
        <p class="notice-desc">${escHtml(n.description || '')}</p>
        ${btnHtml}
      </div>
    </div>`
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── FILTERS ───────────────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll('.nb-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nb-filter').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentFilter = btn.dataset.type
      renderNotices()
    })
  })

  // Live search with debounce
  let searchTimer
  document.getElementById('nbSearchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value.trim()
      renderNotices()
    }, 250)
  })
}

// ── REALTIME ──────────────────────────────────────────────────
function setupRealtime() {
  supabase
    .channel('nb-realtime')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'notices_informations'
    }, loadNotices)
    .subscribe()
}

// ── ACTIONS ───────────────────────────────────────────────────
window.handleAction = function (id, type) {
  if (type === 'notice') {
    const n = notices.find(x => x.id === id)
    if (!n) return
    showToast(`${n.title}: ${n.description || 'No additional details.'}`, 'info', 8000)
    return
  }
  openRegisterModal(id)
}

window.openGlobalAuth = function () {
  openAuthModal('login')
}

function openRegisterModal(noticeId) {
  const currentUser = getCurrentUser()
  const userProfile = getUserProfile()
  const notice      = notices.find(n => n.id === noticeId)
  if (!notice) return

  const regs = Array.isArray(notice.registrations) ? notice.registrations : []

  // Already registered check
  if (currentUser && regs.some(r => r.email === currentUser.email)) {
    showToast('You are already registered for this event!', 'info')
    return
  }

  // Populate modal
  const titleEl = document.getElementById('regModalTitle')
  if (titleEl) titleEl.textContent = notice.title

  const detailsEl = document.getElementById('regDetails')
  if (detailsEl) {
    detailsEl.textContent = `📅 ${notice.date || '—'}  ${notice.time ? '⏰ ' + notice.time : ''}  |  👥 ${regs.length} already registered`
  }

  const statusEl = document.getElementById('regStatus')

  // FIX: null-check each field before setting value
  const setField = (id, val) => {
    const el = document.getElementById(id)
    if (el) el.value = val || ''
  }

  if (currentUser && userProfile) {
    setField('regName',  userProfile.name)
    setField('regPhone', userProfile.phone)
    setField('regRegno', userProfile.regno)
    setField('regYear',  userProfile.year)
    if (statusEl) {
      statusEl.style.display = 'block'
      statusEl.textContent   = '✅ Details auto-filled from your profile. You can edit if needed.'
    }
  } else {
    setField('regName', ''); setField('regPhone', '')
    setField('regRegno', ''); setField('regYear', '')
    if (statusEl) statusEl.style.display = 'none'
  }

  const modal = document.getElementById('registerModal')
  if (modal) modal.dataset.noticeId = noticeId

  openModal('registerModal')
}

// ── REGISTER FORM ─────────────────────────────────────────────
function setupRegisterForm() {
  const form = document.getElementById('registerForm')
  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const currentUser = getCurrentUser()
    const modal       = document.getElementById('registerModal')
    const noticeId    = modal?.dataset.noticeId
    const notice      = notices.find(n => n.id === noticeId)
    if (!notice) return

    const name  = document.getElementById('regName')?.value.trim()
    const phone = document.getElementById('regPhone')?.value.trim()
    const regno = document.getElementById('regRegno')?.value.trim().toUpperCase()
    const year  = document.getElementById('regYear')?.value.trim()

    // FIX: validate required fields before submitting
    if (!name || !phone || !regno) {
      showToast('Please fill Name, Phone and Register Number.', 'warning')
      return
    }

    const email = currentUser ? currentUser.email : `${regno}@guest.pdkv`
    const regs  = Array.isArray(notice.registrations) ? notice.registrations : []

    // Duplicate check on both email and regno
 if (regs.some(r => r.email === email || r.regno === regno)) {
      showToast('You are already registered for this event!', 'warning')
      return
    }

    // Access control: regno must exist in student_credentials or teacher_credentials
    const [studentCred, teacherCred] = await Promise.all([
      supabase.from('student_credentials').select('register_no').eq('register_no', regno).maybeSingle(),
      supabase.from('teacher_credentials').select('register_no').eq('register_no', regno).maybeSingle()
    ])
    if ((!studentCred.data && !teacherCred.data) || studentCred.error || teacherCred.error) {
      showToast('You have no access to register this event or program.', 'error')
      return
    }

    const submitBtn = form.querySelector('[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering…'
    }

    const updatedRegs = [
      ...regs,
      { name, phone, regno, year, email, registered_at: new Date().toISOString() }
    ]

    const { error } = await supabase
      .from('notices_informations')
      .update({ registrations: updatedRegs })
      .eq('id', noticeId)

    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Registration'
    }

    if (error) { showToast('Registration failed: ' + error.message, 'error'); return }

    showToast(`Successfully registered for "${notice.title}"! 🎉`, 'success')
    closeModal('registerModal')
    await loadNotices()
  })
}