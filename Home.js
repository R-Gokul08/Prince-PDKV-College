document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 PDKV College App Loading...");
    
    // Wait for Supabase
    let attempts = 0;
    while (!window.supabase && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    const supabase = window.supabase;
    if (!supabase) {
        showCustomAlert('❌ Database connection failed!', 'error');
        return;
    }

    console.log("✅ All systems ready!");

    // Elements
    const loginDiv = document.getElementById('loginForm');
    const signupDiv = document.getElementById('signupForm');
    const welcomeDiv = document.getElementById('welcomeMessage');
    const showSignupBtn = document.getElementById('showSignupBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginForm = document.getElementById('loginFormElement');
    const signupForm = document.getElementById('signupFormElement');

    // Toggle Forms
    showSignupBtn.onclick = () => {
        loginDiv.style.display = 'none';
        signupDiv.style.display = 'block';
        document.getElementById('signupName').focus();
    };

    showLoginBtn.onclick = () => {
        signupDiv.style.display = 'none';
        loginDiv.style.display = 'block';
        document.getElementById('loginEmail').focus();
    };

    // Check Session
    await checkSession();

    // SIGNUP
    signupForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value.trim();
        const regno = document.getElementById('signupRegNo').value.trim().toUpperCase();
        const phone = document.getElementById('signupPhone').value.trim();
        const email = document.getElementById('signupEmail').value.trim().toLowerCase();
        const password = document.getElementById('signupPassword').value;

        if (!name || !regno || phone.length !== 10 || !/^\d{10}$/.test(phone) || password.length < 6) {
            showCustomAlert('❌ Invalid Input!\nPhone: 10 digits only\nPassword: 6+ chars', 'error');
            return;
        }

        try {
            const { data: existing } = await supabase
                .from('login-information')
                .select('email,regno')
                .or(`email.eq.${email},regno.eq.${regno}`);

            if (existing?.length) {
                showCustomAlert('❌ Account exists!\nEmail or RegNo already registered', 'error');
                return;
            }

            const { data: authData, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;

            await supabase.from('login-information').insert({
                id: authData.user.id, name, regno, phone, email
            });

            showCustomAlert('✅ Account created!\nPlease login now.', 'success');
            signupForm.reset();
            showLoginBtn.click();

        } catch (err) {
            showCustomAlert('❌ Signup failed: ' + err.message, 'error');
        }
    };

    // LOGIN
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                showCustomAlert('❌ Account doesn\'t exist!\nPlease Sign Up first.', 'error');
                return;
            }

            const { data: profile } = await supabase
                .from('login-information')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (!profile) {
                showCustomAlert('❌ Profile missing! Contact admin.', 'error');
                await supabase.auth.signOut();
                return;
            }

            showWelcome(data.user, profile);
            loginForm.reset();

        } catch (err) {
            showCustomAlert('❌ Login failed: ' + err.message, 'error');
        }
    };

    // LOGOUT
    logoutBtn.onclick = async
    })