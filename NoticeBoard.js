// Sample college notices (March 2026)
const sampleNotices = [
    {
        id: 'midterm1',
        title: '🧮 MIDTERM EXAM - March 17, 2026',
        type: 'exam',
        date: '2026-03-17',
        time: '09:00 AM',
        desc: 'Midterm exams for Sem 2,4,6,8. Time: 9 AM - 12 PM daily. Hall tickets compulsory. Check dept notice boards for seating.'
    },
    {
        id: 'hackathon',
        title: '🚀 ProtoThon Hackathon 2026',
        type: 'event',
        date: '2026-03-28',
        time: '08:00 AM',
        desc: '24hr National Hackathon. Prize: ₹1,50,000. Teams of 2-4. Register by March 20. Main Auditorium.'
    },
    {
        id: 'workshop',
        title: '🤖 AI/ML Workshop',
        type: 'event',
        date: '2026-03-20',
        time: '02:00 PM',
        desc: 'Hands-on AI workshop by AI&DS Dept. Python + TensorFlow. 100 seats only. Certificates provided.'
    },
    {
        id: 'internals',
        title: '📊 Internal Marks Submission',
        type: 'notice',
        date: '2026-03-15',
        time: '05:00 PM',
        desc: 'Faculty deadline for CIA marks. Students check ERP from March 16. Grievances: March 17-19.'
    }
];

let currentUser = null;
let notices = JSON.parse(localStorage.getItem('notices')) || sampleNotices;
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
    localStorage.setItem('notices', JSON.stringify(notices));
    checkAuth();
    loadNotices();
    setupFilters();
});

function checkAuth() {
    const user = localStorage.getItem('currentUser');
    if (user) {
        currentUser = JSON.parse(user);
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('userInfo').style.display = 'inline';
        document.getElementById('userInfo').textContent = `Hi, ${currentUser.name}!`;
        document.getElementById('logoutBtn').style.display = 'inline';
        document.getElementById('addNoticeBtn').style.display = 'inline';
    }
}

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

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

document.getElementById('toggleAuth').onclick = function(e) {
    e.preventDefault();
    const type = document.getElementById('authForm').dataset.type === 'signup' ? 'login' : 'signup';
    showAuth(type);
};

document.getElementById('authForm').onsubmit = function(e) {
    e.preventDefault();
    const type = this.dataset.type;
    
    if (type === 'signup') {
        const user = {
            name: document.getElementById('authName').value,
            email: document.getElementById('authEmail').value,
            password: document.getElementById('authPassword').value,
            regno: document.getElementById('authRegno').value,
            phone: document.getElementById('authPhone').value
        };
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        if (users.find(u => u.email === user.email)) {
            showAlert('Email already exists!', 'error');
            return;
        }
        users.push(user);
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(user));
        showAlert('Account created successfully!');
    } else {
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === document.getElementById('authEmail').value && 
                                   u.password === document.getElementById('authPassword').value);
        if (!user) {
            showAlert('Invalid credentials!', 'error');
            return;
        }
        localStorage.setItem('currentUser', JSON.stringify(user));
        showAlert('Login successful!');
    }
    
    currentUser = JSON.parse(localStorage.getItem('currentUser'));
    checkAuth();
    closeModal('authModal');
    loadNotices();
};

function logout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    document.getElementById('loginBtn').style.display = 'inline';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('addNoticeBtn').style.display = 'none';
    loadNotices();
}

function loadNotices() {
    const container = document.getElementById('noticesList');
    const filtered = notices.filter(n => currentFilter === 'all' || n.type === currentFilter);
    
    container.innerHTML = filtered.map(notice => createNoticeCard(notice)).join('');
}

function createNoticeCard(notice) {
    const isPast = new Date(notice.date) < new Date();
    const isRegistered = currentUser && notice.registrations?.some(r => r.email === currentUser.email);
    const btnText = notice.type === 'notice' ? 'View Details' : 
                   (isRegistered ? '✅ Registered' : (currentUser ? 'Register' : 'Sign In'));
    
    return `
        <div class="notice-card">
            <h3 class="notice-title">${notice.title}</h3>
            <div class="notice-meta">
                📅 ${new Date(notice.date).toLocaleDateString('en-IN')} | 
                ${notice.time || 'All Day'} | 
                👥 ${notice.registrations?.length || 0} registered
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
            loadNotices();
        };
    });
}

function handleAction(noticeId, type) {
    if (!currentUser && type !== 'notice') {
        showAuth('login');
        return;
    }
    if (type === 'notice') {
        showAlert('General notice - No registration needed');
    } else {
        showRegisterModal(noticeId);
    }
}

function showRegisterModal(noticeId) {
    const notice = notices.find(n => n.id === noticeId);
    document.getElementById('noticeTitleReg').textContent = notice.title;
    document.getElementById('noticeDetailsReg').textContent = `${notice.date} | ${notice.desc}`;
    document.getElementById('registerModal').dataset.noticeId = noticeId;
    document.getElementById('registerModal').style.display = 'block';
}

document.getElementById('registerForm').onsubmit = function(e) {
    e.preventDefault();
    const noticeId = document.getElementById('registerModal').dataset.noticeId;
    const notice = notices.find(n => n.id === noticeId);
    
    notice.registrations = notice.registrations || [];
    notice.registrations.push({
        name: document.getElementById('regName').value,
        year: document.getElementById('regYear').value,
        dept: document.getElementById('regDept').value,
        regno: document.getElementById('regRegno').value,
        phone: document.getElementById('regPhone').value,
        email: currentUser.email
    });
    
    localStorage.setItem('notices', JSON.stringify(notices));
    showAlert('Registration successful! Notice shows till event date.');
    closeModal('registerModal');
    loadNotices();
};

function showAddNotice() {
    if (!currentUser) return;
    document.getElementById('addNoticeModal').style.display = 'block';
}

document.getElementById('addNoticeForm').onsubmit = function(e) {
    e.preventDefault();
    const newNotice = {
        id: 'notice_' + Date.now(),
        title: document.getElementById('noticeTitle').value,
        type: document.getElementById('noticeType').value,
        date: document.getElementById('noticeDate').value,
        time: document.getElementById('noticeTime').value,
        desc: document.getElementById('noticeDesc').value,
        registrations: []
    };
    
    notices.unshift(newNotice);
    localStorage.setItem('notices', JSON.stringify(notices));
    showAlert('Notice added successfully!');
    closeModal('addNoticeModal');
    loadNotices();
};

function showAlert(message, type = 'success') {
    const alert = document.getElementById('customAlert');
    const box = document.getElementById('alertBox');
    const icon = document.getElementById('alertIcon');
    const msg = document.getElementById('alertMessage');
    
    box.className = `alert-box alert-${type}`;
    icon.textContent = type === 'success' ? '✅' : '❌';
    msg.textContent = message;
    alert.classList.add('show');
}

function closeAlert() {
    document.getElementById('customAlert').classList.remove('show');
}

window.onclick = function(event) {
    const modals = ['authModal', 'registerModal', 'addNoticeModal'];
    modals.forEach(id => {
        if (event.target.classList.contains('modal')) {
            closeModal(id);
        }
    });
};
