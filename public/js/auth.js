// auth.js - Enhanced with SweetAlert2 + Admin Login/Register

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// Custom Toast Mixin
const Toast = (typeof Swal !== 'undefined') ? Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
}) : null;

function showSuccess(title, text) {
    Swal.fire({
        icon: 'success',
        title: title,
        text: text,
        background: '#0f172a',
        color: '#fff',
        confirmButtonColor: '#006a4e'
    });
}

function showError(text) {
    Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: text,
        background: '#0f172a',
        color: '#fff',
        confirmButtonColor: '#f42a41'
    });
}

// ==========================================
//  CITIZEN LOGIN
// ==========================================
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // Show loading
        Swal.showLoading();

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            // Close loading
            Swal.close();

            if (res.ok) {
                Toast.fire({
                    icon: 'success',
                    title: 'Login Successful!'
                });
                localStorage.setItem('token', data.token);
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showError(data.error || 'Login failed');
            }
        } catch (error) {
            Swal.close();
            showError('Network error. Please try again.');
        }
    });
}

// ==========================================
//  CITIZEN REGISTRATION (register.html)
// ==========================================
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const nid = document.getElementById('nid').value;
        const mobile = document.getElementById('mobile').value;
        const dob = document.getElementById('dob').value;
        const gender = document.getElementById('gender').value;
        const address = document.getElementById('address').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        Swal.fire({
            title: 'Creating Identity...',
            text: 'Please wait while we register you securely.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading()
            }
        });

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, nid, mobile, dob, address, gender })
            });

            const data = await res.json();

            if (res.ok) {
                // Auto-login logic
                if (data.token) {
                    localStorage.setItem('token', data.token);
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Welcome, Citizen!',
                    text: 'Registration Successful. You are being logged in...',
                    background: '#006a4e',
                    color: '#fff',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = 'dashboard.html';
                });
            } else {
                const msg = data.errors ? data.errors.map(e => e.msg).join('\n') : (data.error || 'Registration failed');
                showError(msg);
            }
        } catch (error) {
            showError('Network error. Please try again.');
        }
    });
}

// ==========================================
//  TAB SWITCHING (Citizen ↔ Admin)
// ==========================================
const citizenTab = document.getElementById('citizenTab');
const adminTab = document.getElementById('adminTab');
const citizenSection = document.getElementById('citizenSection');
const adminSection = document.getElementById('adminSection');
const headerTitle = document.getElementById('headerTitle');
const headerSubtitle = document.getElementById('headerSubtitle');
const badgeIcon = document.getElementById('badgeIcon');
const badgeText = document.getElementById('badgeText');

function switchToTab(tabName) {
    if (!citizenTab || !adminTab) return;

    // Update tabs
    citizenTab.classList.toggle('active', tabName === 'citizen');
    adminTab.classList.toggle('active', tabName === 'admin');

    // Update sections
    citizenSection.classList.toggle('active', tabName === 'citizen');
    adminSection.classList.toggle('active', tabName === 'admin');

    // Update header
    if (tabName === 'admin') {
        headerTitle.textContent = 'Admin Portal';
        headerSubtitle.textContent = 'Access the Admin Panel';
        badgeIcon.className = 'fas fa-user-shield';
        badgeText.textContent = 'Administrator Access';
    } else {
        headerTitle.textContent = 'গণপ্রজাতন্ত্রী বাংলাদেশ';
        headerSubtitle.textContent = 'Government e-Service Portal';
        badgeIcon.className = 'fas fa-shield-halved';
        badgeText.textContent = 'Secure Government Login';
    }

    // hide pending notice when switching
    const pendingNotice = document.getElementById('adminPendingNotice');
    if (pendingNotice) pendingNotice.style.display = 'none';
}

if (citizenTab) {
    citizenTab.addEventListener('click', () => switchToTab('citizen'));
}
if (adminTab) {
    adminTab.addEventListener('click', () => switchToTab('admin'));
}

// handle #admin hash in URL (for backward compatibility)
if (window.location.hash === '#admin') {
    switchToTab('admin');
}

// ==========================================
//  ADMIN LOGIN / REGISTER TOGGLE
// ==========================================
const adminLoginForm = document.getElementById('adminLoginForm');
const adminRegisterForm = document.getElementById('adminRegisterForm');
const showAdminRegister = document.getElementById('showAdminRegister');
const showAdminLogin = document.getElementById('showAdminLogin');

if (showAdminRegister) {
    showAdminRegister.addEventListener('click', (e) => {
        e.preventDefault();
        adminLoginForm.classList.remove('admin-login-visible');
        adminLoginForm.classList.add('admin-register-hidden');
        adminRegisterForm.classList.remove('admin-register-hidden');
        adminRegisterForm.classList.add('admin-login-visible');
        const pendingNotice = document.getElementById('adminPendingNotice');
        if (pendingNotice) pendingNotice.style.display = 'none';
    });
}

if (showAdminLogin) {
    showAdminLogin.addEventListener('click', (e) => {
        e.preventDefault();
        adminRegisterForm.classList.remove('admin-login-visible');
        adminRegisterForm.classList.add('admin-register-hidden');
        adminLoginForm.classList.remove('admin-register-hidden');
        adminLoginForm.classList.add('admin-login-visible');
    });
}

// ==========================================
//  ADMIN LOGIN FORM SUBMISSION
// ==========================================
if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        const btn = adminLoginForm.querySelector('.btn-submit');

        btn.classList.add('loading');
        btn.innerHTML = '<span>Signing in...</span>';

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('adminName', data.admin.name);

                Swal.fire({
                    icon: 'success',
                    title: 'Welcome, Admin!',
                    text: `Logged in as ${data.admin.name}`,
                    background: '#0f172a',
                    color: '#fff',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = 'reports.html';
                });
            } else {
                // Check if pending
                if (data.status === 'pending') {
                    const pendingNotice = document.getElementById('adminPendingNotice');
                    if (pendingNotice) pendingNotice.style.display = 'block';
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Login Failed',
                    text: data.error || 'Invalid credentials',
                    background: '#0f172a',
                    color: '#fff',
                    confirmButtonColor: '#6366f1'
                });
            }
        } catch (error) {
            console.error('Admin login error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Network error. Please try again.',
                background: '#0f172a',
                color: '#fff',
                confirmButtonColor: '#6366f1'
            });
        } finally {
            btn.classList.remove('loading');
            btn.innerHTML = '<span>Sign In to Admin Panel</span><i class="fas fa-arrow-right"></i>';
        }
    });
}

// ==========================================
//  ADMIN REGISTER FORM SUBMISSION
// ==========================================
if (adminRegisterForm) {
    adminRegisterForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('adminRegName').value;
        const nid = document.getElementById('adminRegNid').value;
        const email = document.getElementById('adminRegEmail').value;
        const mobile = document.getElementById('adminRegMobile').value;
        const password = document.getElementById('adminRegPassword').value;
        const confirmPassword = document.getElementById('adminRegConfirmPassword').value;
        const btn = adminRegisterForm.querySelector('.btn-submit');

        // Validate passwords match
        if (password !== confirmPassword) {
            Swal.fire({
                icon: 'error',
                title: 'Password Mismatch',
                text: 'Passwords do not match',
                background: '#0f172a',
                color: '#fff',
                confirmButtonColor: '#6366f1'
            });
            return;
        }

        btn.classList.add('loading');
        btn.innerHTML = '<span>Registering...</span>';

        try {
            const response = await fetch('/api/admin/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, nid, email, mobile, password })
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Registration Successful!',
                    text: data.message || 'Your account is pending admin approval.',
                    background: '#0f172a',
                    color: '#fff',
                    confirmButtonColor: '#6366f1',
                    confirmButtonText: 'OK'
                }).then(() => {
                    // Switch back to admin login form
                    adminRegisterForm.classList.remove('admin-login-visible');
                    adminRegisterForm.classList.add('admin-register-hidden');
                    adminLoginForm.classList.remove('admin-register-hidden');
                    adminLoginForm.classList.add('admin-login-visible');

                    // Show pending notice
                    const pendingNotice = document.getElementById('adminPendingNotice');
                    if (pendingNotice) pendingNotice.style.display = 'block';

                    // Pre-fill email
                    document.getElementById('adminEmail').value = email;
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Registration Failed',
                    text: data.error || 'Failed to register',
                    background: '#0f172a',
                    color: '#fff',
                    confirmButtonColor: '#6366f1'
                });
            }
        } catch (error) {
            console.error('Admin registration error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Network error. Please try again.',
                background: '#0f172a',
                color: '#fff',
                confirmButtonColor: '#6366f1'
            });
        } finally {
            btn.classList.remove('loading');
            btn.innerHTML = '<span>Register as Admin</span><i class="fas fa-user-plus"></i>';
        }
    });
}
