// ==================== SUPABASE CONFIG ====================
// CHANGE THESE TWO LINES WITH YOUR REAL SUPABASE DETAILS
const SUPABASE_URL = 'https://zsuonqltlodkzrqlhsnm.supabase.co';     // ← Your URL
const SUPABASE_ANON_KEY = 'sb_publishable_GPhUq8fpXNSAHkYRSMLBcQ_ST0r9c5R'; // ← Your anon key

// Wait until Supabase is fully loaded from CDN
function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error("Supabase not loaded yet. Retrying...");
        setTimeout(initSupabase, 100);
        return;
    }

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ==================== DOM ELEMENTS ====================
    const loginDiv = document.getElementById('loginForm');
    const signupDiv = document.getElementById('signupForm');
    const welcomeDiv = document.getElementById('welcomeMessage');

    const showSignupBtn = document.getElementById('showSignupBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    const loginForm = document.getElementById('loginFormElement');
    const signupForm = document.getElementById('signupFormElement');

    // ==================== TOGGLE FORMS (This was the main issue) ====================
    if (showSignupBtn) {
        showSignupBtn.addEventListener('click', () => {
            loginDiv.style.display = 'none';
            signupDiv.style.display = 'block';
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', () => {
            signupDiv.style.display = 'none';
            loginDiv.style.display = 'block';
        });
    }

    // ==================== CHECK IF USER ALREADY LOGGED IN ====================
    async function checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            showWelcome(session.user, supabaseClient);
        }
    }
    checkSession();

    // ==================== SIGNUP ====================
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const full_name = document.getElementById('signupName').value.trim();
        const reg_no = document.getElementById('signupRegNo').value.trim();
        const phone = document.getElementById('signupPhone').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;

        if (full_name.length < 3 || !/^\d{10,12}$/.test(reg_no) || !/^\d{10}$/.test(phone) || password.length < 6) {
            showCustomAlert('Please fill all fields correctly', 'error');
            return;
        }

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { data: { full_name, reg_no, phone } }
            });

            if (error) throw error;

            await supabaseClient.from('students').insert({
                id: data.user.id,
                full_name,
                reg_no,
                phone,
                email
            });

            showCustomAlert('✅ Account created! Please check your email to verify.', 'success');
            signupForm.reset();
            signupDiv.style.display = 'none';
            loginDiv.style.display = 'block';

        } catch (err) {
            showCustomAlert('❌ ' + err.message, 'error');
        }
    });

    // ==================== LOGIN ====================
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;

            showWelcome(data.user, supabaseClient);
        } catch (err) {
            showCustomAlert('❌ Invalid email or password!', 'error');
        }
    });

    // ==================== LOGOUT ====================
    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        welcomeDiv.style.display = 'none';
        loginDiv.style.display = 'block';
        showCustomAlert('👋 Logged out successfully!', 'success');
    });

    // ==================== SHOW WELCOME ====================
    async function showWelcome(user, supabaseClient) {
        const { data: profile } = await supabaseClient
            .from('students')
            .select('*')
            .eq('id', user.id)
            .single();

        document.getElementById('userName').textContent = profile?.full_name || user.user_metadata?.full_name || 'Student';
        document.getElementById('userRegNo').textContent = profile?.reg_no || 'N/A';
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('userPhone').textContent = profile?.phone || 'N/A';

        loginDiv.style.display = 'none';
        signupDiv.style.display = 'none';
        welcomeDiv.style.display = 'block';
    }
}

// ==================== CUSTOM ALERT ====================
function showCustomAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position:fixed; top:20px; left:50%; transform:translateX(-50%);
        background:${type==='success'?'#4CAF50':'#f44336'}; color:white; padding:15px 25px;
        border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10000;
    `;
    alertDiv.innerHTML = message;
    document.body.appendChild(alertDiv);

    setTimeout(() => alertDiv.remove(), 5000);
}

// Start everything after page loads
window.addEventListener('load', initSupabase);