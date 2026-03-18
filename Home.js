// ================================================
// Home.js - FINAL FIXED & CLEAN VERSION
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    const supabase = window.supabase;

    if (!supabase) {
        console.error("❌ Supabase is not loaded! Check supabaseClient.js");
        return;
    }

    // DOM Elements
    const loginDiv      = document.getElementById('loginForm');
    const signupDiv     = document.getElementById('signupForm');
    const welcomeDiv    = document.getElementById('welcomeMessage');

    const showSignupBtn = document.getElementById('showSignupBtn');
    const showLoginBtn  = document.getElementById('showLoginBtn');
    const logoutBtn     = document.getElementById('logoutBtn');

    const loginForm     = document.getElementById('loginFormElement');
    const signupForm    = document.getElementById('signupFormElement');

    // Toggle between Login and Signup forms
    showSignupBtn.addEventListener('click', () => {
        loginDiv.style.display = 'none';
        signupDiv.style.display = 'block';
    });

    showLoginBtn.addEventListener('click', () => {
        signupDiv.style.display = 'none';
        loginDiv.style.display = 'block';
    });

    // Check if user is already logged in
    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            showWelcome(session.user);
        }
    }
    checkSession();

    // ====================== SIGN UP ======================
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name    = document.getElementById('signupName').value.trim();
        const regno   = document.getElementById('signupRegNo').value.trim();
        const phone   = document.getElementById('signupPhone').value.trim();
        const email   = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;

        if (!name || !regno || phone.length !== 10 || password.length < 6) {
            showCustomAlert('Please fill all fields correctly!', 'error');
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({ email, password });

            if (error) throw error;

            // Save user details in login-information table
            await supabase.from('login-information').insert({
                id: data.user.id,
                name: name,
                regno: regno,
                phone: phone,
                email: email
            });

            showCustomAlert('✅ Account created successfully! Please Login now.', 'success');
            signupForm.reset();
            signupDiv.style.display = 'none';
            loginDiv.style.display = 'block';

        } catch (err) {
            console.error(err);
            showCustomAlert('❌ ' + err.message, 'error');
        }
    });

    // ====================== LOGIN ======================
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email    = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                showCustomAlert('❌ Account does not exist. Please Sign Up first.', 'error');
                return;
            }

            showWelcome(data.user);

        } catch (err) {
            console.error(err);
            showCustomAlert('❌ Login failed: ' + err.message, 'error');
        }
    });

    // ====================== LOGOUT ======================
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        welcomeDiv.style.display = 'none';
        loginDiv.style.display = 'block';
        showCustomAlert('👋 Logged out successfully!', 'success');
    });

    // ====================== SHOW WELCOME DASHBOARD ======================
    async function showWelcome(user) {
        const { data: profile } = await supabase
            .from('login-information')
            .select('*')
            .eq('id', user.id)
            .single();

        document.getElementById('userName').textContent  = profile?.name || 'Student';
        document.getElementById('userRegNo').textContent = profile?.regno || 'N/A';
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('userPhone').textContent = profile?.phone || 'N/A';

        loginDiv.style.display  = 'none';
        signupDiv.style.display = 'none';
        welcomeDiv.style.display = 'block';
    }

    // ====================== CUSTOM ALERT ======================
    function showCustomAlert(message, type = 'success') {
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
            position: fixed; 
            top: 20px; 
            left: 50%; 
            transform: translateX(-50%);
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            color: white; 
            padding: 15px 25px; 
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
            z-index: 10000; 
            font-weight: bold;
        `;
        alertDiv.innerHTML = message;
        document.body.appendChild(alertDiv);

        setTimeout(() => alertDiv.remove(), 5000);
    }
});