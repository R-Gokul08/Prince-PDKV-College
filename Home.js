// ============================================================
//  Home.js  —  Auth logic (Login / Signup / Logout)
//  Table used: login_information  (underscore, NOT hyphen)
// ============================================================

import { supabase } from './supabaseClient.js';

// ── DOM references ───────────────────────────────────────────
const loginDiv    = document.getElementById('loginForm');
const signupDiv   = document.getElementById('signupForm');
const welcomeDiv  = document.getElementById('welcomeMessage');

const loginFormEl  = document.getElementById('loginFormElement');
const signupFormEl = document.getElementById('signupFormElement');

const showSignupBtn  = document.getElementById('showSignupBtn');
const showLoginBtn   = document.getElementById('showLoginBtn');
const logoutBtn      = document.getElementById('logoutBtn');

const loginSubmitBtn  = document.getElementById('loginSubmitBtn');
const signupSubmitBtn = document.getElementById('signupSubmitBtn');

// ── Helper: set button loading state ────────────────────────
function setLoading(btn, isLoading, originalText) {
  btn.disabled    = isLoading;
  btn.textContent = isLoading ? '⏳ Please wait...' : originalText;
}

// ── Helper: show toast alert ─────────────────────────────────
function showAlert(message, type = 'error') {
  // Remove any previous alert
  document.querySelectorAll('.toast-alert').forEach(el => el.remove());

  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  toast.textContent = message;

  Object.assign(toast.style, {
    position:        'fixed',
    top:             '22px',
    left:            '50%',
    transform:       'translateX(-50%)',
    background:      type === 'success' ? '#4CAF50' : '#e53935',
    color:           '#fff',
    padding:         '14px 30px',
    borderRadius:    '10px',
    boxShadow:       '0 6px 24px rgba(0,0,0,0.25)',
    zIndex:          '99999',
    fontWeight:      'bold',
    fontSize:        '15px',
    maxWidth:        '90vw',
    textAlign:       'center',
    animation:       'fadeSlideIn 0.3s ease',
  });

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transition = 'opacity 0.5s';
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

// ── Helper: switch visible panel ────────────────────────────
function showPanel(panel) {
  loginDiv.style.display   = 'none';
  signupDiv.style.display  = 'none';
  welcomeDiv.style.display = 'none';
  panel.style.display      = 'block';
}

// ============================================================
//  1.  TOGGLE  Login ↔ Signup
// ============================================================
showSignupBtn.addEventListener('click', () => {
  loginFormEl.reset();
  showPanel(signupDiv);
});

showLoginBtn.addEventListener('click', () => {
  signupFormEl.reset();
  showPanel(loginDiv);
});

// ============================================================
//  2.  AUTO-CHECK SESSION  (page load)
// ============================================================
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await renderWelcome(session.user);
  }
})();

// ============================================================
//  3.  SIGN UP
// ============================================================
signupFormEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name     = document.getElementById('signupName').value.trim();
  const regno    = document.getElementById('signupRegNo').value.trim();
  const phone    = document.getElementById('signupPhone').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  // ── Client-side validation ───────────────────────────────
  if (name.length < 3) {
    showAlert('❌ Full name must be at least 3 characters.'); return;
  }
  if (regno.length < 5) {
    showAlert('❌ Register No must be at least 5 characters.'); return;
  }
  if (!/^\d{10}$/.test(phone)) {
    showAlert('❌ Phone number must be exactly 10 digits (numbers only).'); return;
  }
  if (!email.includes('@')) {
    showAlert('❌ Please enter a valid email address.'); return;
  }
  if (password.length < 6) {
    showAlert('❌ Password must be at least 6 characters.'); return;
  }

  setLoading(signupSubmitBtn, true, '✅ Create Account');

  try {
    // ── Step 1: Create auth user ─────────────────────────
    const { data: authData, error: authError } =
      await supabase.auth.signUp({ email, password });

    if (authError) throw authError;
    if (!authData?.user) throw new Error('Signup failed — please try again.');

    // ── Step 2: Save profile to login_information table ──
    const { error: dbError } = await supabase
      .from('login_information')           // ← underscore table name
      .insert([{
        id:    authData.user.id,           // FK → auth.users.id
        name:  name,
        regno: regno,
        phone: phone,
        email: email,
      }]);

    if (dbError) throw dbError;

    showAlert('✅ Account created! Please log in now.', 'success');
    signupFormEl.reset();
    showPanel(loginDiv);

  } catch (err) {
    // Friendly error messages
    let msg = err.message || 'Something went wrong.';
    if (msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already been registered') ||
        msg.toLowerCase().includes('user already')) {
      msg = 'This email is already registered. Please log in.';
    }
    showAlert('❌ ' + msg);

  } finally {
    setLoading(signupSubmitBtn, false, '✅ Create Account');
  }
});

// ============================================================
//  4.  LOGIN
// ============================================================
loginFormEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  setLoading(loginSubmitBtn, true, '🚀 Login');

  try {
    // ── Step 1: Authenticate with Supabase Auth ──────────
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) throw authError;

    // ── Step 2: Verify profile exists in login_information
    //           If not → account was never fully registered
    const { data: profile, error: profileError } = await supabase
      .from('login_information')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      // Auth record exists but profile is missing → force sign out
      await supabase.auth.signOut();
      showAlert('❌ Account does not exist. Kindly Sign Up first!');
      showPanel(signupDiv);
      return;
    }

    // ── Step 3: All good → show dashboard ───────────────
    await renderWelcome(authData.user, profile);

  } catch (err) {
    let msg = err.message || 'Login failed.';
    if (msg.toLowerCase().includes('invalid login credentials') ||
        msg.toLowerCase().includes('invalid credentials')) {
      msg = 'Incorrect email or password. Please try again.';
    }
    showAlert('❌ ' + msg);

  } finally {
    setLoading(loginSubmitBtn, false, '🚀 Login');
  }
});

// ============================================================
//  5.  LOGOUT
// ============================================================
logoutBtn.addEventListener('click', async () => {
  setLoading(logoutBtn, true, '👋 Logout');

  await supabase.auth.signOut();

  showPanel(loginDiv);
  loginFormEl.reset();
  showAlert('👋 Logged out successfully!', 'success');

  // Re-enable button after panel switch
  setLoading(logoutBtn, false, '👋 Logout');
});

// ============================================================
//  6.  RENDER WELCOME DASHBOARD
// ============================================================
async function renderWelcome(user, profile = null) {
  // Fetch profile only if not already passed in (avoids extra DB call)
  if (!profile) {
    const { data } = await supabase
      .from('login_information')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data;
  }

  document.getElementById('userName').textContent  = profile?.name  ?? 'Student';
  document.getElementById('userRegNo').textContent = profile?.regno ?? 'N/A';
  document.getElementById('userEmail').textContent = user.email     ?? 'N/A';
  document.getElementById('userPhone').textContent = profile?.phone ?? 'N/A';

  showPanel(welcomeDiv);
}
