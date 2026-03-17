// NoticeBoard.js - Full Code with Persistent Login Across Pages

let currentUser = null;
let notices = [];
let currentFilter = 'all';

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadNotices();
    setupFilters();
    setupRealtime();

    // Listen for auth changes from other pages/tabs
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            currentUser = session.user;
            updateUIAfterAuth();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            updateUIAfterAuth();
        }
    });
});

// ==================== AUTHENTICATION ====================
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        currentUser.profile = profile || {};
    }
    updateUIAfterAuth();
}

function updateUIAfterAuth() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    const addNoticeBtn = document.getElementById('addNoticeBtn');

    if (currentUser) {
        loginBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        userInfo.style.display = 'inline';
        userInfo.textContent = `Hi, ${currentUser.profile?.name || currentUser.email.split('@')[0]}!`;
        logoutBtn.style.display = 'inline';
        addNoticeBtn.style.display = 'inline';
    } else {
        loginBtn.style.display = 'inline';
        signupBtn.style.display = 'inline';
        userInfo.style.display = 'none';
        logoutBtn.style.display = 'none';
        addNoticeBtn.style.display = 'none';
    }
}

async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    updateUIAfterAuth();
}

// ==================== AUTH MODAL ====================
function showAuth(type) {
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const toggle = document.getElementById('toggleAuth');
    
    if (type === 'signup') {
        title.textContent = 'Sign Up';
        toggle.textContent = 'Already have account? Sign In';
        document.getElementById('authName').style.display = 'block';
        document.getElementById('authRegno').style.display = 'block';
        document.getElementById('authPhone').style.display = 'block';
    } else {
        title.textContent = 'Sign In';
        toggle.textContent = "Don't have account? Sign Up";
        document.getElementById('authName').style.display = 'none';
        document.getElementById('authRegno').style.display = 'none';
        document.getElementById('authPhone').style.display = 'none';
    }
    
    document.getElementById('authForm').dataset.type = type;
    modal.style.display = 'block';
}

document.getElementById('toggleAuth').onclick = function(e) {
    e.preventDefault();
    const currentType = document.getElementById('authForm').dataset.type;
    showAuth(currentType === 'signup' ? 'login' : 'signup');
};

document.getElementById('authForm').onsubmit = async function(e) {
    e.preventDefault();
    const type = this.dataset.type;
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (type === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return showAlert(error.message, 'error');

        await supabase.from('profiles').insert({
            id: data.user.id,
            name: document.getElementById('authName').value,
            regno: document.getElementById('authRegno').value,
            phone: document.getElementById('authPhone').value
        });
        showAlert('Account created successfully! Please login.');
    } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return showAlert(error.message, 'error');
        showAlert('Login successful!');
    }

    closeModal('authModal');
    await checkAuth();
};

// ==================== NOTICES ====================
async function loadNotices() {
    const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('date', { ascending: true });

    if (error) return showAlert('Failed to load notices', 'error');
    notices = data || [];
    renderNotices();
}

function renderNotices() {
    const container = document.getElementById('noticesList');
    const filtered = notices.filter(n => currentFilter === 'all' || n.type === currentFilter);
    container.innerHTML = filtered.map(n => createNoticeCard(n)).join('');
}

function createNoticeCard(notice) {
    const registrations = notice.registrations || [];
    const isRegistered = currentUser && registrations.some(r => r.email === currentUser.email);

    const btnText = notice.type === 'notice' ? 'View Details' : 
                   (isRegistered ? '✅ Registered' : (currentUser ? 'Register' : 'Sign In'));

    return `
        <div class="notice-card">
            <h3 class="notice-title">${notice.title}</h3>
            <div class="notice-meta">
                📅 ${new Date(notice.date).toLocaleDateString('en-IN')} | 
                ${notice.time || 'All Day'} | 
                👥 ${registrations.length} registered
            </div>
            <p class="notice-desc">${notice.desc}</p>
            <button class="action-btn ${isRegistered ? 'registered-btn' : 'register-btn'}" 
                    onclick="handleAction('${notice.id}', '${notice.type}')">
                ${btnText}
            </button>
        </div>
    `;
}

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.type;
            renderNotices();
        };
    });
}

// Real-time updates
function setupRealtime() {
    supabase.channel('notices-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
            loadNotices();
        })
        .subscribe();
}

// ==================== ADD NOTICE ====================
document.getElementById('addNoticeForm').onsubmit = async function(e) {
    e.preventDefault();

    const newNotice = {
        id: 'notice_' + Date.now(),
        title: document.getElementById('noticeTitle').value,
        type: document.getElementById('noticeType').value,
        date: document.getElementById('noticeDate').value,
        time: document.getElementById('noticeTime').value || null,
        desc: document.getElementById('noticeDesc').value,
        registrations: [],
        created_by: currentUser?.id
    };

    const { error } = await supabase.from('notices').insert(newNotice);
    if (error) return showAlert('Failed to add notice: ' + error.message, 'error');

    showAlert('Notice added successfully! Visible to all users.');
    closeModal('addNoticeModal');
};

// ==================== REGISTER ====================
function handleAction(noticeId, type) {
    if (!currentUser && type !== 'notice') {
        showAuth('login');
        return;
    }
    if (type === 'notice') {
        showAlert('General notice - No registration needed');
        return;
    }
    showRegisterModal(noticeId);
}

function showRegisterModal(noticeId) {
    const notice = notices.find(n => n.id === noticeId);
    document.getElementById('noticeTitleReg').textContent = notice.title;
    document.getElementById('noticeDetailsReg').textContent = `${notice.date} | ${notice.desc}`;
    document.getElementById('registerModal').dataset.noticeId = noticeId;
    document.getElementById('registerModal').style.display = 'block';
}

document.getElementById('registerForm').onsubmit = async function(e) {
    e.preventDefault();
    const noticeId = document.getElementById('registerModal').dataset.noticeId;
    const notice = notices.find(n => n.id === noticeId);

    const regData = {
        name: document.getElementById('regName').value,
        year: document.getElementById('regYear').value,
        dept: document.getElementById('regDept').value,
        regno: document.getElementById('regRegno').value,
        phone: document.getElementById('regPhone').value,
        email: currentUser.email
    };

    const updatedRegs = [...(notice.registrations || []), regData];

    const { error } = await supabase
        .from('notices')
        .update({ registrations: updatedRegs })
        .eq('id', noticeId);

    if (error) return showAlert('Registration failed', 'error');

    showAlert('Registration successful!');
    closeModal('registerModal');
};

// ==================== MODALS & ALERTS ====================
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function showAlert(message, type = 'success') {
    const alert = document.getElementById('customAlert');
    const box = document.getElementById('alertBox');
    const icon = document.getElementById('alertIcon');
    const msg = document.getElementById('alertMessage');
    
    box.className = `alert-box alert-${type}`;
    icon.textContent = type === 'success' ? '✅' : '❌';
    msg.textContent = message;
    alert.classList.add('show');
    setTimeout(() => alert.classList.remove('show'), 5000);
}

function closeAlert() {
    document.getElementById('customAlert').classList.remove('show');
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal(event.target.id);
    }
};