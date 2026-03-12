// Wait for page to load completely
console.log("hi");

window.addEventListener('load', function() {
    console.log('Page loaded, initializing auth...');
    
    // Get all elements
    const loginForm = document.getElementById('loginFormElement');
    const signupForm = document.getElementById('signupFormElement');
    const loginDiv = document.getElementById('loginForm');
    const signupDiv = document.getElementById('signupForm');
    const welcomeDiv = document.getElementById('welcomeMessage');
    const showSignup = document.getElementById('showSignupBtn');
    const showLogin = document.getElementById('showLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    console.log('Elements found:', {loginForm, signupForm, showSignup, showLogin});
    
    // Check if user is logged in
    if (localStorage.getItem('currentUser')) {
        showWelcome(JSON.parse(localStorage.getItem('currentUser')));
        return;
    }
    
    // Toggle forms
    showSignup.addEventListener('click', function() {
        loginDiv.style.display = 'none';
        signupDiv.style.display = 'block';
    });
    
    showLogin.addEventListener('click', function() {
        signupDiv.style.display = 'none';
        loginDiv.style.display = 'block';
    });
    
    // Signup
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = {
            name: document.getElementById('signupName').value,
            regNo: document.getElementById('signupRegNo').value,
            phone: document.getElementById('signupPhone').value,
            email: document.getElementById('signupEmail').value,
            password: document.getElementById('signupPassword').value
        };
        
        if (validateSignup(formData) && !userExists(formData.email)) {
            localStorage.setItem('users', JSON.stringify(
                JSON.parse(localStorage.getItem('users') || '[]').concat([formData])
            ));
            showCustomAlert('✅ Signup successful! Please login.', 'success');
            signupForm.reset();
            signupDiv.style.display = 'none';
            loginDiv.style.display = 'block';
        }
    });
    
    // Login
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            showWelcome(user);
        } else {
            showCustomAlert('❌ Invalid email or password!', 'error');
        }
    });
    
    // Logout
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        welcomeDiv.style.display = 'none';
        loginDiv.style.display = 'block';
        showCustomAlert('👋 Logged out successfully!', 'success');
    });
});

function validateSignup(data) {
    if (data.name.length < 2) return showCustomAlert('Name too short', 'error'), false;
    if (!/^\d{10,12}$/.test(data.regNo)) return showCustomAlert('Invalid Register No', 'error'), false;
    if (!/^\d{10}$/.test(data.phone)) return showCustomAlert('Phone must be 10 digits', 'error'), false;
    if (!data.email.includes('@')) return showCustomAlert('Invalid email', 'error'), false;
    if (data.password.length < 6) return showCustomAlert('Password too short', 'error'), false;
    return true;
}

function userExists(email) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find(u => u.email === email)) {
        showCustomAlert('❌ Email already exists!', 'error');
        return true;
    }
    return false;
}

function showWelcome(user) {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userRegNo').textContent = user.regNo;
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userPhone').textContent = user.phone;
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('welcomeMessage').style.display = 'block';
}

function showCustomAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `custom-alert show alert-${type}`;
    alert.innerHTML = `
        <div class="alert-box">
            <span class="alert-icon">${type === 'success' ? '✅' : '❌'}</span>
            <div class="alert-message">${message}</div>
            <button class="alert-close-btn" onclick="this.closest('.custom-alert').remove()">OK</button>
        </div>
    `;
    document.body.appendChild(alert);
    
    setTimeout(() => alert.remove(), 4000);
}
