// ==================== SUPABASE CONFIG ====================
// CHANGE THESE TWO LINES WITH YOUR REAL SUPABASE DETAILS
const SUPABASE_URL = 'https://zsuonqltlodkzrqlhsnm.supabase.co';     // ← Your URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdW9ucWx0bG9ka3pycWxoc25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODUwNzAsImV4cCI6MjA4OTE2MTA3MH0.Ea8xTDxxp6GaDfUNuByjkQaUcFxJPrdO1VrzG06cTH4'; // ← Your anon key




// Create Supabase client
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

// ==================== TOGGLE BETWEEN LOGIN & SIGNUP ====================
showSignupBtn.addEventListener('click', () => {
    loginDiv.style.display = 'none';
    signupDiv.style.display = 'block';
});

showLoginBtn.addEventListener('click', () => {
    signupDiv.style.display = 'none';
    loginDiv.style.display = 'block';
});

// ==================== CHECK IF USER IS ALREADY LOGGED IN ====================
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        showWelcome(session.user);
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

    if (full_name.length < 3 || !/^\d{10,12}$/.test(reg_no) || 
        !/^\d{10}$/.test(phone) || password.length < 6) {
        showCustomAlert('Please fill all fields correctly', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { full_name, reg_no, phone } }
        });

        if (error) {
            if (error.message.toLowerCase().includes('rate limit')) {
                showCustomAlert('⏳ Rate limit exceeded. Wait 1 hour or disable email confirmation in Supabase.', 'error');
            } else {
                showCustomAlert('❌ ' + error.message, 'error');
            }
            return;
        }

        // Insert into students table
        await supabaseClient.from('students').insert({
            id: data.user.id,
            full_name,
            reg_no,
            phone,
            email
        });

        showCustomAlert('✅ Account created successfully! You can now login.', 'success');
        signupForm.reset();
        signupDiv.style.display = 'none';
        loginDiv.style.display = 'block';

    } catch (err) {
        console.error(err);
        showCustomAlert('❌ Something went wrong. Please try again.', 'error');
    }
});

// ==================== LOGIN ====================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes("Invalid login credentials")) {
                showCustomAlert('❌ Invalid email or password. Please check again.', 'error');
            } else if (error.message.includes("Email not confirmed")) {
                showCustomAlert('❌ Email not confirmed. Please check your email or disable confirmation in Supabase.', 'error');
            } else {
                showCustomAlert('❌ ' + error.message, 'error');
            }
            return;
        }

        showWelcome(data.user);

    } catch (err) {
        console.error(err);
        showCustomAlert('❌ Login failed. Please try again.', 'error');
    }
});

// ==================== LOGOUT ====================
logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    welcomeDiv.style.display = 'none';
    loginDiv.style.display = 'block';
    showCustomAlert('👋 Logged out successfully!', 'success');
});

// ==================== SHOW WELCOME DASHBOARD ====================
async function showWelcome(user) {
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

// ==================== CUSTOM ALERT ====================
function showCustomAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white; padding: 15px 25px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; font-weight: bold;
    `;
    alertDiv.innerHTML = message;
    document.body.appendChild(alertDiv);

    setTimeout(() => alertDiv.remove(), 5000);
}