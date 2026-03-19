import { supabase } from './supabaseClient.js'
import { initStickyHeader, initHamburger, initScrollAnimations, openModal, closeModal, initModalCloseHandlers, showToast } from './shared.js'

let currentUser   = null
let userProfile   = null
let notices       = []
let currentFilter = 'all'

const TYPE_CONFIG = {
  event:  { emoji: '🎉', label: 'Event',  color: '#4CAF50', badgeClass: 'badge-green' },
  exam:   { emoji: '📝', label: 'Exam',   color: '#F44336', badgeClass: 'badge-red'   },
  notice: { emoji: '📢', label: 'Notice', color: '#2196F3', badgeClass: 'badge-blue'  }
}

// ── BOOT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initScrollAnimations()
  initModalCloseHandlers()
  setupAuthButtons()
  setupFormListeners()
  setupFilters()

  await checkAuth()
  await loadNotices()
  setupRealtime()
})

// ── AUTH ──────────────────────────────────────────────────
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    currentUser = session.user
    const { data } = await supabase
      .from('login_information')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle()
    userProfile = data || {}
  }
  updateAuthUI()
}

function updateAuthUI() {
  const loggedIn = !!currentUser
  document.getElementById('loginBtn').style.display    = loggedIn ? 'none' : 'inline-flex'
  document.getElementById('signupBtn').style.display   = loggedIn ? 'none' : 'inline-flex'
  document.getElementById('logoutBtn').style.display   = loggedIn ? 'inline-flex' : 'none'
  document.getElementById('addNoticeBtn').style.display= loggedIn ? 'inline-flex' : 'none'
  const greeting = document.getElementById('userGreeting')
  greeting.style.display = loggedIn ? 'inline-flex' : 'none'
  if (loggedIn) {
    greeting.textContent = `👋 Hi, ${userProfile?.name || currentUser.email.split('@')[0]}!`
  }
}

function setupAuthButtons() {
  document.getElementById('loginBtn').addEventListener('click',  () => showAuth('login'))
  document.getElementById('signupBtn').addEventListener('click', () => showAuth('signup'))
  document.getElementById('addNoticeBtn').addEventListener('click', showAddNotice)
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut()
    currentUser = null; userProfile = null
    updateAuthUI()
    renderNotices()
    showToast('Logged out successfully!', 'info')
  })
  document.getElementById('toggleAuth').addEventListener('click', () => {
    const form = document.getElementById('authForm')
    showAuth(form.dataset.type === 'login' ? 'signup' : 'login')
  })
}

function showAuth(type) {
  document.getElementById('authModalTitle').textContent = type === 'signup' ? 'Create Account' : 'Sign In'
  document.getElementById('authSubmitBtn').textContent  = type === 'signup' ? 'Create Account' : 'Sign In'
  document.getElementById('signupFields').style.display = type === 'signup' ? 'block' : 'none'
  document.getElementById('authForm').dataset.type = type
  const toggle = document.getElementById('toggleAuth')
  toggle.innerHTML = type === 'signup'
    ? 'Already have an account? <span>Sign In</span>'
    : "Don't have an account? <span>Sign Up</span>"
  openModal('authModal')
}

function showAddNotice() {
  if (!currentUser) return showAuth('login')
  document.getElementById('addNoticeForm').reset()
  openModal('addNoticeModal')
}

// ── LOAD & RENDER ─────────────────────────────────────────
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
  const container = document.getElementById('noticesList')
  const filtered = currentFilter === 'all' ? notices : notices.filter(n => n.type === currentFilter)

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="nb-empty">
        <div class="nb-empty-icon">📭</div>
        <p>No ${currentFilter === 'all' ? '' : currentFilter + ' '}notices found.</p>
      </div>`
    return
  }

  container.innerHTML = filtered.map(buildCard).join('')
}

function buildCard(n) {
  const cfg   = TYPE_CONFIG[n.type] || TYPE_CONFIG.notice
  const regs  = Array.isArray(n.registrations) ? n.registrations : []
  const isReg = currentUser && regs.some(r => r.email === currentUser.email)
  const dateStr = n.date
    ? new Date(n.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' })
    : '—'

  let btnHtml = ''
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
    btnHtml = `<button class="notice-action-btn nb-signin-btn" onclick="showAuth('login')">
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
          ${n.time ? `<span><i class="fas fa-clock"></i> ${n.time}</span>` : '<span><i class="fas fa-clock"></i> All Day</span>'}
        </div>
        <p class="notice-desc">${escHtml(n.description || '')}</p>
        ${btnHtml}
      </div>
    </div>`
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── FILTERS ───────────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll('.nb-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nb-filter').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentFilter = btn.dataset.type
      renderNotices()
    })
  })
}

// ── REALTIME ──────────────────────────────────────────────
function setupRealtime() {
  supabase
    .channel('nb-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notices_informations' }, loadNotices)
    .subscribe()
}

// ── ACTIONS ───────────────────────────────────────────────
window.handleAction = function(id, type) {
  if (type === 'notice') {
    const n = notices.find(x => x.id === id)
    if (!n) return
    showToast(`${n.title}: ${n.description || 'No additional details.'}`, 'info', 8000)
    return
  }
  openRegisterModal(id)
}

window.showAuth = showAuth

function openRegisterModal(noticeId) {
  const notice = notices.find(n => n.id === noticeId)
  if (!notice) return

  const regs = Array.isArray(notice.registrations) ? notice.registrations : []
  if (currentUser && regs.some(r => r.email === currentUser.email)) {
    showToast('You are already registered for this event!', 'info')
    return
  }

  document.getElementById('regModalTitle').textContent = notice.title
  document.getElementById('regDetails').textContent =
    `📅 ${notice.date}  ${notice.time ? '⏰ ' + notice.time : ''}  |  👥 ${regs.length} already registered`

  const statusEl = document.getElementById('regStatus')
  if (currentUser && userProfile) {
    document.getElementById('regName').value  = userProfile.name  || ''
    document.getElementById('regPhone').value = userProfile.phone || ''
    document.getElementById('regRegno').value = userProfile.regno || ''
    document.getElementById('regYear').value  = userProfile.year  || ''
    statusEl.style.display = 'block'
    statusEl.textContent = '✅ Details auto-filled from your profile. You can edit if needed.'
  } else {
    ['regName','regPhone','regRegno','regYear'].forEach(id => document.getElementById(id).value = '')
    statusEl.style.display = 'none'
  }

  document.getElementById('registerModal').dataset.noticeId = noticeId
  openModal('registerModal')
}

// ── FORMS ─────────────────────────────────────────────────
function setupFormListeners() {

  // Auth form
  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const type     = e.target.dataset.type
    const email    = document.getElementById('authEmail').value.trim()
    const password = document.getElementById('authPassword').value
    const btn      = document.getElementById('authSubmitBtn')

    btn.disabled = true
    btn.textContent = type === 'signup' ? 'Creating Account…' : 'Signing In…'

    if (type === 'signup') {
      const name  = document.getElementById('authName').value.trim()
      const regno = document.getElementById('authRegno').value.trim()
      const phone = document.getElementById('authPhone').value.trim()
      const year  = document.getElementById('authYear').value.trim()
      const dept  = document.getElementById('authDept').value.trim()

      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { showToast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Create Account'; return }

      await supabase.from('login_information').insert({ id: data.user.id, name, regno, phone, year, dept })
      showToast('Account created! Please check your email to confirm.', 'success')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { showToast(error.message, 'error'); btn.disabled = false; btn.textContent = 'Sign In'; return }
      showToast('Welcome back! Login successful.', 'success')
    }

    closeModal('authModal')
    await checkAuth()
    renderNotices()
    btn.disabled = false
  })

  // Add notice form
  document.getElementById('addNoticeForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!currentUser) return showAuth('login')

    const newNotice = {
      id:            'notice_' + Date.now(),
      title:         document.getElementById('noticeTitle').value.trim(),
      type:          document.getElementById('noticeType').value,
      date:          document.getElementById('noticeDate').value,
      time:          document.getElementById('noticeTime').value || null,
      description:   document.getElementById('noticeDesc').value.trim(),
      registrations: [],
      created_by:    currentUser.id
    }

    const { error } = await supabase.from('notices_informations').insert(newNotice)
    if (error) { showToast('Failed to publish: ' + error.message, 'error'); return }

    showToast('Notice published successfully!', 'success')
    closeModal('addNoticeModal')
    await loadNotices()
  })

  // Register form
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const noticeId = document.getElementById('registerModal').dataset.noticeId
    const notice   = notices.find(n => n.id === noticeId)
    if (!notice) return

    const name  = document.getElementById('regName').value.trim()
    const phone = document.getElementById('regPhone').value.trim()
    const regno = document.getElementById('regRegno').value.trim()
    const year  = document.getElementById('regYear').value.trim()
    const email = currentUser ? currentUser.email : `${regno}@guest.pdkv`

    const regs = Array.isArray(notice.registrations) ? notice.registrations : []
    if (regs.some(r => r.email === email || r.regno === regno)) {
      showToast('You are already registered for this event!', 'warning')
      return
    }

    const updatedRegs = [...regs, { name, phone, regno, year, email, registered_at: new Date().toISOString() }]
    const { error } = await supabase
      .from('notices_informations')
      .update({ registrations: updatedRegs })
      .eq('id', noticeId)

    if (error) { showToast('Registration failed: ' + error.message, 'error'); return }

    showToast(`Successfully registered for "${notice.title}"!`, 'success')
    closeModal('registerModal')
    await loadNotices()
  })
}
