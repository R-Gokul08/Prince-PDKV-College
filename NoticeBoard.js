// ================================================================
//  NoticeBoard.js  —  Complete Logic
//  Table : notices_informations
//  Login : login_information
// ================================================================

let currentUser    = null;   // supabase user object
let userProfile    = null;   // row from login_information
let notices        = [];     // all notices loaded from DB
let currentFilter  = 'all';  // active filter tab

// ── BADGE COLOURS per type ──────────────────────────────────────
const TYPE_BADGE = {
  event:  { emoji: '🎉', label: 'Event',  colour: '#4CAF50' },
  exam:   { emoji: '📝', label: 'Exam',   colour: '#F44336' },
  notice: { emoji: '📢', label: 'Notice', colour: '#2196F3' }
};

// ════════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadNotices();
  setupFilters();
  setupRealtime();
  setupFormListeners();
});

// ════════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════════
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    const { data } = await supabase
      .from('login_information')       // ← underscore
      .select('*')
      .eq('id', currentUser.id)
      .single();
    userProfile = data || {};
  }
  updateUIAfterAuth();
}

function updateUIAfterAuth() {
  const loggedIn = !!currentUser;
  document.getElementById('loginBtn').style.display     = loggedIn ? 'none'   : 'inline-block';
  document.getElementById('signupBtn').style.display    = loggedIn ? 'none'   : 'inline-block';
  document.getElementById('logoutBtn').style.display    = loggedIn ? 'inline-block' : 'none';
  document.getElementById('addNoticeBtn').style.display = loggedIn ? 'inline-block' : 'none';

  const userInfoEl = document.getElementById('userInfo');
  userInfoEl.style.display = loggedIn ? 'inline-block' : 'none';
  if (loggedIn) {
    userInfoEl.textContent =
      `👋 Hi, ${userProfile?.name || currentUser.email.split('@')[0]}!`;
  }
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  userProfile = null;
  updateUIAfterAuth();
  renderNotices();          // re-render to hide registered state
  showAlert('Logged out successfully!');
}

// Toggle Sign-In ↔ Sign-Up inside auth modal
window.toggleAuthMode = function(e) {
  e.preventDefault();
  const form   = document.getElementById('authForm');
  const isLogin = form.dataset.type === 'login';
  showAuth(isLogin ? 'signup' : 'login');
};

function showAuth(type) {
  document.getElementById('authTitle').textContent =
    type === 'signup' ? 'Create Account' : 'Sign In';
  document.getElementById('toggleAuth').textContent =
    type === 'signup' ? 'Already have an account? Sign In'
                      : "Don't have an account? Sign Up";
  document.getElementById('signupFields').style.display =
    type === 'signup' ? 'block' : 'none';
  document.getElementById('authForm').dataset.type = type;
  openModal('authModal');
}

// ════════════════════════════════════════════════════════════════
//  LOAD & RENDER NOTICES
// ════════════════════════════════════════════════════════════════
async function loadNotices() {
  const { data, error } = await supabase
    .from('notices_informations')       // ← correct table name
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error(error);
    showAlert('Failed to load notices: ' + error.message, 'error');
    return;
  }
  notices = data || [];
  renderNotices();
}

function renderNotices() {
  const container = document.getElementById('noticesList');
  const filtered  = currentFilter === 'all'
    ? notices
    : notices.filter(n => n.type === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px;margin-bottom:12px;">📭</div>
        <p>No ${currentFilter === 'all' ? '' : currentFilter + ' '}notices found.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(n => buildNoticeCard(n)).join('');
}

function buildNoticeCard(notice) {
  const regs        = Array.isArray(notice.registrations) ? notice.registrations : [];
  const regCount    = regs.length;
  const userEmail   = currentUser?.email || '';
  const isRegistered = userEmail && regs.some(r => r.email === userEmail);
  const badge       = TYPE_BADGE[notice.type] || TYPE_BADGE.notice;

  // Format date nicely
  const dateStr = notice.date
    ? new Date(notice.date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
      })
    : '—';

  // Action button logic
  let btnLabel, btnClass, btnDisabled = '';
  if (notice.type === 'notice') {
    btnLabel = '📖 View Details';
    btnClass = 'view-btn';
  } else if (isRegistered) {
    btnLabel   = '✅ You\'re Registered!';
    btnClass   = 'registered-btn';
    btnDisabled = 'disabled';
  } else if (currentUser) {
    btnLabel = '📋 Register Now';
    btnClass = 'register-btn';
  } else {
    btnLabel = '🔐 Sign In to Register';
    btnClass = 'signin-reg-btn';
  }

  return `
    <div class="notice-card" data-type="${notice.type}">
      <div class="card-top-bar" style="background:${badge.colour}"></div>

      <div class="card-header">
        <span class="type-badge" style="background:${badge.colour}20;color:${badge.colour};border:1px solid ${badge.colour}40;">
          ${badge.emoji} ${badge.label}
        </span>
      </div>

      <h3 class="notice-title">${escHtml(notice.title)}</h3>

      <div class="notice-meta">
        <span>📅 ${dateStr}</span>
        ${notice.time ? `<span>⏰ ${notice.time}</span>` : '<span>⏰ All Day</span>'}
        ${notice.type !== 'notice'
          ? `<span class="reg-count">👥 ${regCount} Registered</span>`
          : ''}
      </div>

      <p class="notice-desc">${escHtml(notice.description || '')}</p>

      <button class="action-btn ${btnClass}"
              onclick="handleAction('${notice.id}', '${notice.type}')"
              ${btnDisabled}>
        ${btnLabel}
      </button>
    </div>
  `;
}

// Escape HTML to prevent XSS
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════════════════
//  FILTERS
// ════════════════════════════════════════════════════════════════
function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.type;
      renderNotices();
    });
  });
}

// ════════════════════════════════════════════════════════════════
//  REALTIME — auto-refresh when DB changes
// ════════════════════════════════════════════════════════════════
function setupRealtime() {
  supabase
    .channel('notices-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notices_informations' },
      () => loadNotices()
    )
    .subscribe();
}

// ════════════════════════════════════════════════════════════════
//  ACTION HANDLER (button on each card)
// ════════════════════════════════════════════════════════════════
window.handleAction = function(noticeId, type) {
  if (type === 'notice') {
    const n = notices.find(x => x.id === noticeId);
    if (n) showAlert(`📢 ${n.title}\n\n${n.description || 'No additional details.'}`, 'info');
    return;
  }
  if (!currentUser) {
    // Not logged in — show registration form WITHOUT pre-fill
    openRegisterModal(noticeId, false);
    return;
  }
  // Logged in — open with pre-filled data
  openRegisterModal(noticeId, true);
};

// ════════════════════════════════════════════════════════════════
//  REGISTER MODAL
// ════════════════════════════════════════════════════════════════
function openRegisterModal(noticeId, prefill) {
  const notice = notices.find(n => n.id === noticeId);
  if (!notice) return;

  // Check if already registered
  const regs = Array.isArray(notice.registrations) ? notice.registrations : [];
  const email = currentUser?.email || '';
  if (email && regs.some(r => r.email === email)) {
    showAlert('✅ You are already registered for this event!', 'info');
    return;
  }

  document.getElementById('noticeTitleReg').textContent   = notice.title;
  document.getElementById('noticeDetailsReg').textContent =
    `📅 ${notice.date}  ${notice.time ? '⏰ ' + notice.time : ''}  |  👥 ${regs.length} already registered`;

  // Pre-fill if logged in
  if (prefill && userProfile) {
    document.getElementById('regName').value  = userProfile.name  || '';
    document.getElementById('regPhone').value = userProfile.phone || '';
    document.getElementById('regRegno').value = userProfile.regno || '';
    document.getElementById('regYear').value  = userProfile.year  || '';

    // Show green "auto-filled" status
    const statusEl = document.getElementById('regStatus');
    statusEl.textContent = '✅ Details auto-filled from your profile. You can edit if needed.';
    statusEl.className   = 'reg-status filled';
  } else {
    // Clear fields
    ['regName','regPhone','regRegno','regYear'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('regStatus').textContent = '';
    document.getElementById('regStatus').className   = 'reg-status';
  }

  document.getElementById('registerModal').dataset.noticeId = noticeId;
  openModal('registerModal');
}

// ════════════════════════════════════════════════════════════════
//  SHOW ADD NOTICE MODAL
// ════════════════════════════════════════════════════════════════
function showAddNotice() {
  if (!currentUser) {
    showAlert('Please sign in first to add a notice.', 'error');
    return;
  }
  // Reset form
  document.getElementById('addNoticeForm').reset();
  openModal('addNoticeModal');
}

// ════════════════════════════════════════════════════════════════
//  FORM LISTENERS
// ════════════════════════════════════════════════════════════════
function setupFormListeners() {

  // ── AUTH FORM ──────────────────────────────────────────────
  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type     = e.target.dataset.type;
    const email    = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (type === 'signup') {
      const name  = document.getElementById('authName').value.trim();
      const regno = document.getElementById('authRegno').value.trim();
      const phone = document.getElementById('authPhone').value.trim();
      const year  = document.getElementById('authYear').value.trim();
      const dept  = document.getElementById('authDept').value.trim();

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return showAlert(error.message, 'error');

      // Insert profile into login_information
      await supabase.from('login_information').insert({
        id: data.user.id,
        name, regno, phone, year, dept
      });

      showAlert('🎉 Account created! Please check your email to confirm.', 'success');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return showAlert(error.message, 'error');
      showAlert('✅ Login successful! Welcome back.', 'success');
    }

    closeModal('authModal');
    await checkAuth();
    renderNotices();
  });

  // ── ADD NOTICE FORM ────────────────────────────────────────
  document.getElementById('addNoticeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return showAlert('Please sign in first.', 'error');

    const newNotice = {
      id:           'notice_' + Date.now(),
      title:        document.getElementById('noticeTitle').value.trim(),
      type:         document.getElementById('noticeType').value,
      date:         document.getElementById('noticeDate').value,
      time:         document.getElementById('noticeTime').value || null,
      description:  document.getElementById('noticeDesc').value.trim(),
      registrations: [],
      created_by:   currentUser.id
    };

    const { error } = await supabase
      .from('notices_informations')     // ← correct table
      .insert(newNotice);

    if (error) return showAlert('Failed to publish: ' + error.message, 'error');

    showAlert('🚀 Notice published successfully!', 'success');
    closeModal('addNoticeModal');
    // Realtime will auto-refresh, but reload anyway for instant feedback
    await loadNotices();
  });

  // ── REGISTER FORM ──────────────────────────────────────────
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const noticeId = document.getElementById('registerModal').dataset.noticeId;
    const notice   = notices.find(n => n.id === noticeId);
    if (!notice) return;

    const name  = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const regno = document.getElementById('regRegno').value.trim();
    const year  = document.getElementById('regYear').value.trim();
    const email = currentUser ? currentUser.email : `${regno}@guest.com`;

    // Prevent duplicate registration
    const regs = Array.isArray(notice.registrations) ? notice.registrations : [];
    if (regs.some(r => r.email === email || r.regno === regno)) {
      showAlert('⚠️ You are already registered for this event!', 'error');
      return;
    }

    const regEntry = {
      name, phone, regno, year, email,
      registered_at: new Date().toISOString()
    };

    const updatedRegs = [...regs, regEntry];
    const { error } = await supabase
      .from('notices_informations')
      .update({ registrations: updatedRegs })
      .eq('id', noticeId);

    if (error) return showAlert('Registration failed: ' + error.message, 'error');

    showAlert(`🎉 Successfully registered for "${notice.title}"!`, 'success');
    closeModal('registerModal');
    await loadNotices();
  });
}

// ════════════════════════════════════════════════════════════════
//  MODAL HELPERS
// ════════════════════════════════════════════════════════════════
function openModal(id)  { document.getElementById(id).style.display = 'block'; }
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; };

// Close modal when clicking outside it
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) closeModal(e.target.id);
});

// ════════════════════════════════════════════════════════════════
//  ALERT HELPER
// ════════════════════════════════════════════════════════════════
let alertTimer = null;
function showAlert(message, type = 'success') {
  const alertEl  = document.getElementById('customAlert');
  const boxEl    = document.getElementById('alertBox');
  const iconEl   = document.getElementById('alertIcon');
  const msgEl    = document.getElementById('alertMessage');

  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  iconEl.textContent = icons[type] || '✅';
  msgEl.textContent  = message;
  boxEl.className    = `alert-box alert-${type}`;
  alertEl.classList.add('show');

  if (alertTimer) clearTimeout(alertTimer);
  alertTimer = setTimeout(() => alertEl.classList.remove('show'), 5000);
}

window.closeAlert = function() {
  clearTimeout(alertTimer);
  document.getElementById('customAlert').classList.remove('show');
};

// Expose showAddNotice & showAuth globally
window.showAddNotice = showAddNotice;
window.showAuth      = showAuth;
window.logout        = logout;
