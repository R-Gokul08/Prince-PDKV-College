import { supabase } from './supabaseClient.js'
import {
  initStickyHeader, initHamburger, initScrollAnimations,
  openModal, closeModal, initModalCloseHandlers, showToast,
  initAuth, openAuthModal, logoutUser,
  getCurrentUser, getUserProfile, onAuthChange
} from './shared.js'

let notices = [], currentFilter = 'all'

const TYPE_CONFIG = {
  event:  { emoji: '🎉', label: 'Event',  color: '#22c55e', badgeClass: 'badge-green' },
  exam:   { emoji: '📝', label: 'Exam',   color: '#ef4444', badgeClass: 'badge-red'   },
  notice: { emoji: '📢', label: 'Notice', color: '#3b82f6', badgeClass: 'badge-blue'  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initScrollAnimations()
  initModalCloseHandlers()
  setupFilters()
  setupRegForm()

  await initAuth()

  document.getElementById('headerLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.querySelectorAll('.global-header-logout').forEach(btn =>
    btn.addEventListener('click', async () => { await logoutUser() })
  )

  onAuthChange((user, profile) => {
    updateHeroGreeting(user, profile)
    renderNotices()
  })

  await loadNotices()
  setupRealtime()
})

function updateHeroGreeting(user, profile) {
  const el = document.getElementById('userGreeting')
  if (!el) return
  el.style.display = user ? 'inline-flex' : 'none'
  if (user) el.textContent = `👋 Hi, ${profile?.name || user.email.split('@')[0]}!`
}

async function loadNotices() {
  const { data, error } = await supabase
    .from('notices_informations').select('*').order('date', { ascending: true })
  if (error) { showToast('Failed to load notices: ' + error.message, 'error'); return }
  notices = data || []
  renderNotices()
}

function renderNotices() {
  const user      = getCurrentUser()
  const container = document.getElementById('noticesList')
  const filtered  = currentFilter === 'all' ? notices : notices.filter(n => n.type === currentFilter)
  if (!filtered.length) {
    container.innerHTML = `<div class="nb-empty"><div class="nb-empty-icon">📭</div><p>No ${currentFilter === 'all' ? '' : currentFilter + ' '}notices found.</p></div>`
    return
  }
  container.innerHTML = filtered.map(n => buildCard(n, user)).join('')
}

function buildCard(n, user) {
  const cfg   = TYPE_CONFIG[n.type] || TYPE_CONFIG.notice
  const regs  = Array.isArray(n.registrations) ? n.registrations : []
  const isReg = user && regs.some(r => r.email === user.email)
  const date  = n.date ? new Date(n.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }) : '—'

  let btn = ''
  if (n.type === 'notice') {
    btn = `<button class="notice-action-btn nb-view-btn" onclick="handleAction('${n.id}','notice')"><i class="fas fa-eye"></i> View Details</button>`
  } else if (isReg) {
    btn = `<button class="notice-action-btn nb-regd-btn" disabled><i class="fas fa-check-circle"></i> Registered!</button>`
  } else if (user) {
    btn = `<button class="notice-action-btn nb-reg-btn" onclick="handleAction('${n.id}','event')"><i class="fas fa-clipboard-check"></i> Register Now</button>`
  } else {
    btn = `<button class="notice-action-btn nb-signin-btn" onclick="openGlobalAuth()"><i class="fas fa-sign-in-alt"></i> Sign In to Register</button>`
  }

  return `
    <div class="notice-card">
      <div class="notice-top-bar" style="background:${cfg.color};"></div>
      <div class="notice-card-body">
        <div class="notice-card-header">
          <span class="badge ${cfg.badgeClass}">${cfg.emoji} ${cfg.label}</span>
          ${n.type !== 'notice' ? `<span class="reg-count-chip"><i class="fas fa-users"></i> ${regs.length}</span>` : ''}
        </div>
        <h3 class="notice-card-title">${esc(n.title)}</h3>
        <div class="notice-meta">
          <span><i class="fas fa-calendar"></i> ${date}</span>
          ${n.time ? `<span><i class="fas fa-clock"></i> ${n.time}</span>` : '<span><i class="fas fa-clock"></i> All Day</span>'}
        </div>
        <p class="notice-desc">${esc(n.description || '')}</p>
        ${btn}
      </div>
    </div>`
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

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

function setupRealtime() {
  supabase.channel('nb-rt')
    .on('postgres_changes', { event:'*', schema:'public', table:'notices_informations' }, loadNotices)
    .subscribe()
}

window.handleAction = function(id, type) {
  if (type === 'notice') {
    const n = notices.find(x => x.id === id)
    if (n) showToast(`${n.title}: ${n.description || 'No details.'}`, 'info', 7000)
    return
  }
  openRegisterModal(id)
}
window.openGlobalAuth = () => openAuthModal('login')

function openRegisterModal(noticeId) {
  const user    = getCurrentUser()
  const profile = getUserProfile()
  const notice  = notices.find(n => n.id === noticeId)
  if (!notice) return
  const regs = Array.isArray(notice.registrations) ? notice.registrations : []
  if (user && regs.some(r => r.email === user.email)) { showToast('Already registered!', 'info'); return }

  document.getElementById('regModalTitle').textContent = notice.title
  document.getElementById('regDetails').textContent =
    `📅 ${notice.date}  ${notice.time ? '⏰ ' + notice.time : ''}  |  👥 ${regs.length} registered`

  const statusEl = document.getElementById('regStatus')
  if (user && profile) {
    document.getElementById('regName').value  = profile.name  || ''
    document.getElementById('regPhone').value = profile.phone || ''
    document.getElementById('regRegno').value = profile.regno || ''
    document.getElementById('regYear').value  = profile.year  || ''
    statusEl.style.display = 'block'
    statusEl.textContent   = '✅ Details auto-filled from your profile.'
  } else {
    ['regName','regPhone','regRegno','regYear'].forEach(id => document.getElementById(id).value = '')
    statusEl.style.display = 'none'
  }
  document.getElementById('registerModal').dataset.noticeId = noticeId
  openModal('registerModal')
}

function setupRegForm() {
  document.getElementById('registerForm')?.addEventListener('submit', async e => {
    e.preventDefault()
    const user     = getCurrentUser()
    const noticeId = document.getElementById('registerModal').dataset.noticeId
    const notice   = notices.find(n => n.id === noticeId)
    if (!notice) return

    const name  = document.getElementById('regName').value.trim()
    const phone = document.getElementById('regPhone').value.trim()
    const regno = document.getElementById('regRegno').value.trim()
    const year  = document.getElementById('regYear').value.trim()
    const email = user ? user.email : `${regno}@guest.pdkv`

    const regs = Array.isArray(notice.registrations) ? notice.registrations : []
    if (regs.some(r => r.email === email || r.regno === regno)) {
      showToast('Already registered!', 'warning'); return
    }

    const { error } = await supabase
      .from('notices_informations')
      .update({ registrations: [...regs, { name, phone, regno, year, email, registered_at: new Date().toISOString() }] })
      .eq('id', noticeId)

    if (error) { showToast('Registration failed: ' + error.message, 'error'); return }
    showToast(`Registered for "${notice.title}"! 🎉`, 'success')
    closeModal('registerModal')
    await loadNotices()
  })
}