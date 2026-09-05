// Check Auth
const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

// Fetch Dashboard Data
async function loadDashboard() {
    try {
        // Summary
        const res = await fetch('/api/dashboard/summary', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (document.getElementById('userName')) document.getElementById('userName').textContent = data.user.name;
        if (document.getElementById('userNid')) document.getElementById('userNid').textContent = 'NID: ' + data.user.nid;

        // Update Avatar
        if (data.user.photo_url) {
            const avatarEl = document.querySelector('.user-avatar');
            if (avatarEl) {
                avatarEl.innerHTML = `<img src="${data.user.photo_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            }
        }
        if (document.getElementById('statRequests')) document.getElementById('statRequests').textContent = data.stats.activeRequests;
        if (document.getElementById('statTasks')) document.getElementById('statTasks').textContent = data.stats.completedTasks;
        if (document.getElementById('statNotifs')) document.getElementById('statNotifs').textContent = data.stats.notifications;

        // Departments
        const deptGrid = document.getElementById('deptGrid');
        if (deptGrid) {
            const deptRes = await fetch('/api/dashboard/departments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const depts = await deptRes.json();
            deptGrid.innerHTML = depts.map(d => `
            <a href="${d.link}" class="dept-card" style="text-decoration: none; color: inherit; display: block;">
                <i class="fas ${d.icon}"></i>
                <h4>${d.name}</h4>
                <p style="font-size:0.75rem; color:#94a3b8; margin-top:5px;">${d.desc}</p>
            </a>
        `).join('');
        }

        // Todos
        loadTodos();

    } catch (error) {
        console.error(error);
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    }
}

// =====================================
// CALENDAR & TODO LOGIC
// =====================================
let calendar;

function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || calendar) return; // Prevent double init

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        editable: false, // Set true if you want drag-drop date changing
        events: [],
        eventClick: function (info) {
            viewTask(parseInt(info.event.id, 10));
        }
    });
    calendar.render();
}

function updateCalendarEvents() {
    if (!calendar) return;

    // Clear old events (FullCalendar v5 method)
    calendar.getEvents().forEach(event => event.remove());

    // Add new events
    const events = window.todos
        .filter(t => t.due_date) // Only tasks with dates
        .map(t => {
            // Apply different colors based on status
            const statusClass = 'fc-event-' + t.status;
            return {
                id: String(t.id),
                title: t.title,
                start: t.due_date, // FullCalendar uses ISO strings YYYY-MM-DDTHH:mm
                classNames: [statusClass],
                extendedProps: {
                    description: t.description
                }
            };
        });

    events.forEach(e => calendar.addEvent(e));
}

// Kanban Logic
// Kanban Logic
let sortablesInitialized = false;

async function loadTodos() {
    const res = await fetch('/api/dashboard/todos', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const todos = await res.json();
    window.todos = todos; // Store globally

    ['todo', 'progress', 'done'].forEach(status => {
        const container = document.getElementById(status);
        if (container) {
            container.innerHTML = '';
            todos.filter(t => t.status === status).forEach(t => {
                const el = document.createElement('div');
                el.className = 'kanban-item';
                el.setAttribute('data-id', t.id);
                el.innerHTML = `
                    <div style="width: 100%; cursor: pointer;" onclick="viewTask(${t.id})">
                        <div style="font-weight: 600; font-size: 0.95rem;">${t.title}</div>
                    </div>
                     <div style="display: flex; gap: 8px;">
                        <i class="fas fa-eye" onclick="viewTask(${t.id})" style="cursor: pointer; color: #60a5fa;"></i>
                        <i class="fas fa-trash delete-task" onclick="deleteTask(${t.id}, event)"></i>
                    </div>
                `;
                container.appendChild(el);
            });
        }
    });

    // Initialize Sortable only once
    if (!sortablesInitialized) {
        initSortable();
        sortablesInitialized = true;
    }

    // Initialize & Update Calendar
    initCalendar();
    updateCalendarEvents();
}

function initSortable() {
    ['todo', 'progress', 'done'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            new Sortable(el, {
                group: 'shared',
                animation: 150,
                onEnd: function (evt) {
                    const itemEl = evt.item;
                    const newStatus = evt.to.id; // 'todo', 'progress', 'done'
                    const id = itemEl.getAttribute('data-id');
                    updateTaskStatus(id, newStatus);
                }
            });
        }
    });
}

async function createTask() {
    const { value: formValues } = await Swal.fire({
        title: 'New Task',
        html: `
            <input id="swal-input1" class="swal2-input" placeholder="Task Title">
            <textarea id="swal-input2" class="swal2-textarea" placeholder="Description (Optional)"></textarea>
            <div style="text-align: left; margin-top: 15px;">
                <label style="color: #94a3b8; font-size: 0.85rem; padding-left: 5px;">Due Date & Time (Optional)</label>
                <input id="swal-input3" type="datetime-local" class="swal2-input" style="max-width: 100%;">
            </div>
        `,
        focusConfirm: false,
        background: '#0f172a',
        color: '#fff',
        showCancelButton: true,
        preConfirm: () => {
            const dateVal = document.getElementById('swal-input3').value;

            return {
                title: document.getElementById('swal-input1').value,
                description: document.getElementById('swal-input2').value,
                due_date: dateVal ? new Date(dateVal).toISOString().slice(0, 19).replace('T', ' ') : null
            }
        }
    });

    if (formValues && formValues.title) {
        await fetch('/api/dashboard/todos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formValues)
        });
        loadTodos();
    }
}

function viewTask(id) {
    const task = window.todos.find(t => t.id === id);
    if (!task) return;

    Swal.fire({
        title: task.title,
        text: task.description || 'No description provided.',
        background: '#0f172a',
        color: '#fff',
        confirmButtonColor: '#3b82f6'
    });
}
window.viewTask = viewTask;

async function updateTaskStatus(id, status) {
    await fetch(`/api/dashboard/todos/${id}/move`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
    });
    // Update stats subtly
}

async function deleteTask(id, event) {
    event.stopPropagation(); // prevent drag start
    const result = await Swal.fire({
        title: 'Delete?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        background: '#0f172a',
        color: '#fff'
    });

    if (result.isConfirmed) {
        await fetch(`/api/dashboard/todos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadTodos();
    }
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });
}



// Make functions globally available
// Event Listeners for Modal
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard Script Loaded & Ready (v2 - Links Enabled)');

    const newRequestBtn = document.getElementById('newRequestBtn');
    const closeBtn = document.querySelector('.close-btn');
    const cancelBtn = document.querySelector('.btn-secondary'); // The cancel button in modal

    if (newRequestBtn) {
        newRequestBtn.addEventListener('click', function () {
            console.log('New Request button clicked');
            const modal = document.getElementById('serviceRequestModal');
            if (modal) {
                modal.style.display = 'flex';
                console.log('Modal display set to flex');
            } else {
                console.error('Modal element not found');
            }
        });
    } else {
        console.error('New Request button not found');
    }

    // Close logic
    function closeModal() {
        const modal = document.getElementById('serviceRequestModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeServiceModal = closeModal;

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Category change listener
    const categorySelect = document.getElementById('serviceCategory');
    if (categorySelect) {
        categorySelect.addEventListener('change', function () {
            const category = this.value;
            const subtypeSelect = document.getElementById('serviceSubtype');

            console.log('Category selected:', category);
            subtypeSelect.innerHTML = '<option value="">Select Service Type</option>';

            if (category && serviceTypes[category]) {
                serviceTypes[category].forEach(service => {
                    const option = document.createElement('option');
                    option.value = service.value;
                    option.textContent = service.label;
                    subtypeSelect.appendChild(option);
                });
                subtypeSelect.disabled = false;
                console.log('Subtypes populated');
            } else {
                subtypeSelect.disabled = true;
                console.log('Subtypes disabled');
            }
        });
    } else {
        console.error('Service Category dropdown not found');
    }

    // Service Subtype Mapping
    const serviceTypes = {
        identity: [
            { value: 'nid_correction', label: 'NID Correction' },
            { value: 'birth_cert_correction', label: 'Birth Certificate Correction' },
            { value: 'death_cert_correction', label: 'Death Certificate Correction' },
            { value: 'character_certificate', label: 'Character Certificate' },
            { value: 'income_certificate', label: 'Income Certificate' }
        ],
        education: [
            { value: 'education_sss', label: 'SSC Certificate' },
            { value: 'education_hsc', label: 'HSC Certificate' },
            { value: 'education_jsc', label: 'JSC Certificate' },
            { value: 'education_university_verification', label: 'University Certificate Verification' },
            { value: 'education_transcript', label: 'Transcript Correction' }
        ],
        transport: [
            { value: 'transport_driving_lic_correction', label: 'Driving Licence Correction' },
            { value: 'transport_driving_lic_renew', label: 'Driving Licence Renew' },
            { value: 'transport_vehicle_reg_correction', label: 'Vehicle Reg Correction' },
            { value: 'transport_ownership_transfer', label: 'Ownership Transfer Req' }
        ],
        immigration: [
            { value: 'immigration_visa', label: 'Visa Related Problem' },
            { value: 'immigration_passport_correction', label: 'Passport Correction' },
            { value: 'immigration_emigration_clearance', label: 'Emigration Clearance' }
        ],
        business: [
            { value: 'business_trade_lic', label: 'Trade Licence' },
            { value: 'business_tin_certificate', label: 'TIN Certificate' },
            { value: 'business_vat_reg', label: 'VAT Reg' },
            { value: 'business_company_reg', label: 'Company Reg' },
            { value: 'business_import_export', label: 'Import/Export' }
        ],
        legal: [
            { value: 'legal_gd', label: 'General Diary (GD)' },
            { value: 'legal_case', label: 'Case Filing' },
            { value: 'legal_complain', label: 'File Complaint' }
        ]
    };


    // Handle Form Submission

    
    const submitBtn = document.getElementById('submitRequestBtn');

    // Define the submit handler function
    async function handleServiceSubmit() {
        console.log('Submit function called');

        const category = document.getElementById('serviceCategory').value;
        const subCategory = document.getElementById('serviceSubtype').value;
        const uniqueId = document.getElementById('serviceUniqueId').value;
        const evidenceLink = document.getElementById('serviceEvidence').value;
        const description = document.getElementById('serviceDescription').value;

        console.log('Form Data:', { category, subCategory, uniqueId, description, evidenceLink });

        if (!category || !subCategory || !uniqueId || !description || !evidenceLink) {
            Swal.fire({ icon: 'error', title: 'Missing Information', text: 'Please fill in all fields including the evidence link.', background: '#0f172a', color: '#fff' });
            return;
        }

        const btn = document.getElementById('submitRequestBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        }

        try {
            const res = await fetch('/api/dashboard/services/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    category,
                    subCategory: `req_${subCategory}`,
                    uniqueId,
                    evidenceLink,
                    description
                })
            });

            const data = await res.json();
            console.log('Response:', data);

            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'Request Submitted', text: 'Your request has been filed successfully.', background: '#0f172a', color: '#fff' });
                closeServiceModal();
                const form = document.getElementById('serviceRequestForm');
                if (form) form.reset();
                loadDashboard(); // Refresh stats
            } else {
                throw new Error(data.error || 'Submission failed');
            }
        } catch (error) {
            console.error('Submit Error:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: error.message, background: '#0f172a', color: '#fff' });
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Submit Request';
            }
        }
    }

    if (submitBtn) {
        // Remove old listeners by cloning 
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);

        newBtn.addEventListener('click', handleServiceSubmit);
        console.log('Submit listener attached');
    } else {
        console.error('Submit Button not found');
    }


    window.submitServiceRequestManual = handleServiceSubmit;

    const userProfileSection = document.getElementById('userProfileSection');
    if (userProfileSection) {
        userProfileSection.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }

    // Init
    loadDashboard();
});



// Close Modal Generic
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}
window.closeModal = closeModal;

// 1. Active Requests
async function openActiveRequests() {
    const modal = document.getElementById('activeRequestsModal');
    const list = document.getElementById('activeRequestsList');
    modal.style.display = 'flex';
    list.innerHTML = '<p class="text-center text-muted">Loading...</p>';

    try {
        const res = await fetch('/api/dashboard/services/active', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        if (data.length === 0) {
            list.innerHTML = '<p class="text-center text-muted">No active requests found.</p>';
            return;
        }

        list.innerHTML = data.map(req => `
            <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 0.8rem; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4 style="margin: 0; color: #34d399;">${req.service_type}</h4>
                        <p style="font-size: 0.85rem; color: #cbd5e1; margin: 5px 0;">${req.details}</p>
                        <p style="font-size: 0.75rem; color: #94a3b8;">Created: ${new Date(req.created_at).toLocaleDateString()}</p>
                        ${req.evidence_link ? `<a href="${req.evidence_link}" target="_blank" style="font-size: 0.8rem; color: #60a5fa;">View Evidence <i class="fas fa-external-link-alt"></i></a>` : ''}
                    </div>
                </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        list.innerHTML = '<p class="text-center text-danger">Failed to load requests.</p>';
    }
}
window.openActiveRequests = openActiveRequests;

async function updateRequestStatus(id, status) {
    // Optional: Ask for comment
    const { value: comments } = await Swal.fire({
        title: status === 'approved' ? 'Approve Request?' : 'Reject Request?',
        input: 'text',
        inputLabel: 'Admin Comment (Optional)',
        inputPlaceholder: status === 'approved' ? 'e.g. Documents verified' : 'e.g. Invalid documents',
        showCancelButton: true,
        confirmButtonColor: status === 'approved' ? '#059669' : '#dc2626',
        background: '#0f172a', color: '#fff'
    });

    if (comments !== undefined) {
        try {
            const res = await fetch('/api/dashboard/services/status', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ requestId: id, status, comments })
            });

            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'Updated', timer: 1500, showConfirmButton: false, background: '#0f172a', color: '#fff' });
                closeModal('activeRequestsModal');
                loadDashboard(); // Refresh stats
            } else {
                throw new Error();
            }
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Failed', text: 'Could not update request', background: '#0f172a', color: '#fff' });
        }
    }
}
window.updateRequestStatus = updateRequestStatus; // Make global

// 2. Completed Tasks
async function openCompletedTasks() {
    const modal = document.getElementById('completedTasksModal');
    const tableBody = document.getElementById('completedTasksList');
    const loading = document.getElementById('completedLoading');

    modal.style.display = 'flex';
    tableBody.innerHTML = '';
    loading.style.display = 'block';

    try {
        const res = await fetch('/api/dashboard/services/completed', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        loading.style.display = 'none';

        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding: 20px;">No completed tasks yet.</td></tr>';
            return;
        }

        tableBody.innerHTML = data.map(task => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px;">${task.service_type}</td>
                <td style="padding: 10px; color: #cbd5e1; font-size: 0.9rem;">${task.unique_number}</td>
                <td style="padding: 10px;"><span style="padding: 2px 8px; border-radius: 10px; background: rgba(5, 150, 105, 0.2); color: #34d399; font-size: 0.8rem;">Approved</span></td>
                <td style="padding: 10px; color: #94a3b8; font-size: 0.8rem;">${new Date(task.completed_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        loading.style.display = 'none';
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load tasks.</td></tr>';
    }
}
window.openCompletedTasks = openCompletedTasks;

// Global store for notifications to avoid string escaping issues in HTML
window.notificationsData = [];

// 3. Notifications
async function openNotifications() {
    const modal = document.getElementById('notificationsModal');
    const list = document.getElementById('notificationsList');
    modal.style.display = 'flex';
    list.innerHTML = '<p class="text-center text-muted">Loading...</p>';

    try {
        const res = await fetch('/api/dashboard/notifications', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        window.notificationsData = data; // Store globally

        if (data.length === 0) {
            list.innerHTML = '<p class="text-center text-muted">No notifications.</p>';
            return;
        }

        list.innerHTML = data.map(n => `
            <div id="notif-${n.id}" onclick="openNotificationPopup(${n.id})" style="background: ${n.is_read ? 'transparent' : 'rgba(59, 130, 246, 0.1)'}; padding: 1rem; border-radius: 8px; margin-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: background 0.2s;">
                <div style="display: flex; gap: 10px;">
                    <i class="fas fa-bell" style="color: ${n.is_read ? '#64748b' : '#3b82f6'}; margin-top: 3px;"></i>
                    <div>
                        <p style="margin: 0; font-size: 0.9rem; color: ${n.is_read ? '#94a3b8' : '#fff'};">${n.message.substring(0, 60)}...</p>
                        <p style="margin: 5px 0 0; font-size: 0.7rem; color: #64748b;">${new Date(n.created_at).toLocaleString()}</p>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        list.innerHTML = '<p class="text-center text-danger">Failed to load notifications.</p>';
    }
}
window.openNotifications = openNotifications;

async function openNotificationPopup(id) {
    const n = window.notificationsData.find(item => item.id === id);
    if (!n) return;

    // 1. Show Popup
    await Swal.fire({
        title: 'Notification',
        text: n.message,
        icon: 'info',
        background: '#0f172a',
        color: '#fff',
        confirmButtonColor: '#3b82f6'
    });

    // 2. Mark as Read in UI & Backend
    const el = document.getElementById(`notif-${id}`);
    if (el && el.style.background !== 'transparent') {
        try {
            await fetch(`/api/dashboard/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            // Update UI immediately
            el.style.background = 'transparent';
            el.querySelector('i').style.color = '#64748b';
            el.querySelectorAll('p')[0].style.color = '#94a3b8';

            // update Count (reload dashboard safely)
            loadDashboard();
        } catch (e) {
            console.error(e);
        }
    }
}
window.openNotificationPopup = openNotificationPopup;

async function markRead(id, el) {
    if (el.style.background === 'transparent') return; // Already read styling check (rough)

    try {
        await fetch(`/api/dashboard/notifications/${id}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        el.style.background = 'transparent';
        el.querySelector('i').style.color = '#64748b';
        el.querySelector('p').style.color = '#94a3b8';
        loadDashboard(); // Decrease count
    } catch (e) {
        console.error(e);
    }
}
window.markRead = markRead;
