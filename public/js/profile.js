// Check Auth
const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

let currentProfile = {};

async function loadProfile() {
    try {
        const res = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load profile');

        const user = await res.json();
        currentProfile = user;

        // Render User Info
        document.getElementById('userNameDisplay').textContent = user.name;
        document.getElementById('userNidDisplay').textContent = user.nid;

        // Profile Image
        if (user.profile_image) {
            document.getElementById('userAvatar').src = user.profile_image;
        }

        // Populate Form
        const fields = ['name', 'email', 'nid', 'mobile', 'dob', 'address', 'gender'];
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el) {
                el.value = user[field] || '';
                // handle Date format if needed
                if (field === 'dob' && user.dob) {
                    el.value = user.dob.split('T')[0]; // Simple formatting
                }
            }
        });

    } catch (error) {
        console.error(error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Could not load profile data.',
            background: '#0f172a', color: '#fff'
        });
    }
}

async function uploadPhoto(file) {
    const formData = new FormData();
    formData.append('photo', file);

    try {
        const res = await fetch('/api/user/profile/photo', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Upload failed:', res.status, errorText);
            throw new Error(`Upload failed: ${res.status} ${errorText}`);
        }
        const data = await res.json();

        // Update UI
        document.getElementById('userAvatar').src = data.imagePath;

        Swal.fire({
            icon: 'success',
            title: 'Uploaded',
            text: 'Profile photo updated!',
            background: '#0f172a', color: '#fff',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });

    } catch (error) {
        console.error(error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Failed to upload photo.',
            background: '#0f172a', color: '#fff'
        });
    }
}

function enableEdit() {
    console.log('Enable Edit clicked');
    document.getElementById('viewMode').style.display = 'none';
    document.getElementById('editMode').style.display = 'block';

    const inputs = document.querySelectorAll('.profile-input');
    inputs.forEach(input => {
        if (input.id !== 'nid') {
            input.disabled = false;
            input.classList.add('editable');
        }
    });
}

function cancelEdit() {
    document.getElementById('viewMode').style.display = 'block';
    document.getElementById('editMode').style.display = 'none';

    // Reset values
    loadProfile();

    const inputs = document.querySelectorAll('.profile-input');
    inputs.forEach(input => {
        input.disabled = true;
        input.classList.remove('editable');
    });
}

async function saveProfile() {
    console.log('Save Profile clicked');
    const updates = {
        name: document.getElementById('name').value,
        mobile: document.getElementById('mobile').value,
        dob: document.getElementById('dob').value,
        address: document.getElementById('address').value,
        gender: document.getElementById('gender').value,
        email: document.getElementById('email').value,
    };

    try {
        const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });

        if (!res.ok) throw new Error('Failed to update');

        await Swal.fire({
            icon: 'success',
            title: 'Updated',
            text: 'Profile updated successfully!',
            background: '#0f172a', color: '#fff'
        });

        cancelEdit();
        loadProfile();

    } catch (error) {
        console.error(error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to update profile.',
            background: '#0f172a', color: '#fff'
        });
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadProfile();

    const editBtn = document.getElementById('editBtn');
    if (editBtn) editBtn.addEventListener('click', enableEdit);

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveProfile);

    // Photo Upload
    const uploadBtn = document.getElementById('uploadBtn');
    const photoInput = document.getElementById('photoInput');

    if (uploadBtn && photoInput) {
        uploadBtn.addEventListener('click', () => {
            photoInput.click();
        });
    }

    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                uploadPhoto(e.target.files[0]);
            }
        });
    }

    // Sidebar logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });
});
