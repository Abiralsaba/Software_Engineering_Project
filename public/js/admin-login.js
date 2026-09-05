/**
 * Admin Login/Register JavaScript
 */

// Force logout on login page load (Strict Security)
localStorage.removeItem('adminToken');
localStorage.removeItem('adminName');


const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const pendingNotice = document.getElementById('pendingNotice');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

// Toggle between login and register forms
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.add('active');
    pendingNotice.style.display = 'none';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('hidden');
    registerForm.classList.remove('active');
});

// Login Form Submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

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
                title: 'Welcome!',
                text: `Logged in as ${data.admin.name}`,
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                window.location.href = 'reports.html';
            });
        } else {
            // Check if pending
            if (data.status === 'pending') {
                pendingNotice.style.display = 'block';
            }

            Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: data.error || 'Invalid credentials'
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Network error. Please try again.'
        });
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
});

// Register Form Submit
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const mobile = document.getElementById('regMobile').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    // Validate passwords match
    if (password !== confirmPassword) {
        Swal.fire({
            icon: 'error',
            title: 'Password Mismatch',
            text: 'Passwords do not match'
        });
        return;
    }

    registerBtn.disabled = true;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

    try {
        const response = await fetch('/api/admin/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, mobile, password })
        });

        const data = await response.json();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Registration Successful!',
                text: data.message || 'Your account is pending admin approval.',
                confirmButtonText: 'OK'
            }).then(() => {
                // Switch to login form and show pending notice
                loginForm.classList.remove('hidden');
                registerForm.classList.remove('active');
                pendingNotice.style.display = 'block';

                // Pre-fill email
                document.getElementById('loginEmail').value = email;
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Registration Failed',
                text: data.error || 'Failed to register'
            });
        }
    } catch (error) {
        console.error('Registration error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Network error. Please try again.'
        });
    } finally {
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Register';
    }
});
