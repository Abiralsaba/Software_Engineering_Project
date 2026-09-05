/**
 * Reports & Analytics JavaScript
 * Admin Dashboard with Approve/Reject functionality
 */

// Use admin token instead of regular token
const adminToken = localStorage.getItem('adminToken');
const adminName = localStorage.getItem('adminName') || 'Admin';

// Redirect to admin login if not authenticated
if (!adminToken) {
    window.location.href = 'index.html#admin';
}

// Current tab
let currentTab = 'overview';

// Data caches
let allServiceRequests = [];
let allLandMutations = [];
let allCommunityGroups = [];
let allCommunityPosts = [];

// =====================
// UTILITY FUNCTIONS
// =====================

// API helper with admin token
async function fetchAdminAPI(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        };
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(`/api/admin/${endpoint}`, options);
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminName');
            window.location.href = 'index.html#admin';
            return null;
        }
        if (!res.ok) throw new Error('API Error');
        return await res.json();
    } catch (err) {
        console.error('Admin API Error:', err);
        return null;
    }
}

// API helper for reports endpoints
async function fetchReportsAPI(endpoint) {
    try {
        const res = await fetch(`/api/reports/${endpoint}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminName');
            window.location.href = 'index.html#admin';
            return null;
        }

        if (!res.ok) throw new Error('API Error');
        return await res.json();
    } catch (err) {
        console.error('Reports API Error:', err);
        return null;
    }
}

// Format number
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return new Intl.NumberFormat().format(num);
}

// Format currency
function formatCurrency(num) {
    if (num === null || num === undefined) return '৳0';
    return '৳' + new Intl.NumberFormat().format(Math.round(num));
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
}

// Get status badge HTML
function getStatusBadge(status) {
    const s = (status || 'pending').toLowerCase();
    return `<span class="status-badge ${s}">${status || 'Pending'}</span>`;
}

// Get tier badge class
function getTierBadge(tier) {
    const tierLower = (tier || '').toLowerCase().replace(' ', '-');
    return `<span class="badge ${tierLower}">${tier}</span>`;
}

// Get rank badge
function getRankBadge(rank) {
    let cls = 'default';
    if (rank === 1) cls = 'gold';
    else if (rank === 2) cls = 'silver';
    else if (rank === 3) cls = 'bronze';
    return `<span class="rank-badge ${cls}">${rank}</span>`;
}

// Logout
function adminLogout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    window.location.href = 'index.html#admin';
}

// =====================
// MODAL FUNCTIONS
// =====================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Close modal on backdrop click
document.querySelectorAll('.admin-modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.admin-modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// =====================
// TAB NAVIGATION
// =====================

function showTab(tab) {
    currentTab = tab;

    // Hide all sections
    ['overview', 'users', 'services', 'land', 'community', 'shop', 'education', 'admissions', 'audit', 'stipends', 'notices', 'agriculture', 'tax'].forEach(t => {
        const el = document.getElementById(t + '-section');
        if (el) el.style.display = 'none';
    });

    // Update nav
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    event.target.closest('a')?.classList.add('active');

    // Show selected section
    const section = document.getElementById(tab + '-section');
    if (section) section.style.display = 'block';

    // Load data for tab
    loadTabData(tab);
}

async function loadTabData(tab) {
    switch (tab) {
        case 'overview': loadOverview(); break;
        case 'users': loadUsers(); break;
        case 'services': loadServices(); break;
        case 'land': loadLand(); break;
        case 'community': loadCommunity(); break;
        case 'shop': loadShop(); break;
        case 'education': loadEducation(); break;
        case 'admissions': loadAdmissions(); break;
        case 'audit': loadAudit(); break;
        case 'stipends': loadStipends(); break;
        case 'notices': loadNotices(); break;
        case 'agriculture': loadAgriculture(); break;
        case 'tax': loadTaxAdmin(); break;
    }
}

// =====================
// OVERVIEW TAB - CLICKABLE STATS
// =====================

async function loadOverview() {
    const summary = await fetchReportsAPI('summary');
    if (summary) {
        document.getElementById('summaryStats').innerHTML = `
            <div class="stat-card clickable" onclick="showUsersModal()">
                <div class="stat-icon blue"><i class="fas fa-users"></i></div>
                <div class="stat-value">${formatNumber(summary.total_users)}</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card clickable" onclick="showServiceRequestsModal()">
                <div class="stat-icon green"><i class="fas fa-tasks"></i></div>
                <div class="stat-value">${formatNumber(summary.total_service_requests)}</div>
                <div class="stat-label">Service Requests</div>
            </div>
            <div class="stat-card clickable" onclick="showLandMutationsModal()">
                <div class="stat-icon purple"><i class="fas fa-map"></i></div>
                <div class="stat-value">${formatNumber(summary.total_land_mutations)}</div>
                <div class="stat-label">Land Mutations</div>
            </div>
            <div class="stat-card clickable" onclick="showCommunityGroupsModal()">
                <div class="stat-icon orange"><i class="fas fa-users-cog"></i></div>
                <div class="stat-value">${formatNumber(summary.total_community_groups)}</div>
                <div class="stat-label">Community Groups</div>
            </div>
            <div class="stat-card clickable" onclick="showCommunityPostsModal()">
                <div class="stat-icon pink"><i class="fas fa-comment"></i></div>
                <div class="stat-value">${formatNumber(summary.total_posts)}</div>
                <div class="stat-label">Community Posts</div>
            </div>
            <div class="stat-card clickable" onclick="showNewUsersModal()">
                <div class="stat-icon cyan"><i class="fas fa-user-plus"></i></div>
                <div class="stat-value">${formatNumber(summary.recent_activity?.new_users_7d || 0)}</div>
                <div class="stat-label">New Users (7 days)</div>
            </div>
        `;
    }

    // Load pivot table
    const pivot = await fetchReportsAPI('service-pivot');
    if (pivot && pivot.data) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Service Type</th>
                    <th>Jan</th><th>Feb</th><th>Mar</th><th>Apr</th><th>May</th><th>Jun</th>
                    <th>Jul</th><th>Aug</th><th>Sep</th><th>Oct</th><th>Nov</th><th>Dec</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>`;

        pivot.data.forEach(row => {
            const isTotal = row.service_type?.includes('TOTAL');
            html += `<tr class="${isTotal ? 'total-row' : ''}">
                <td>${row.service_type || 'Unknown'}</td>
                <td>${row.Jan || 0}</td><td>${row.Feb || 0}</td><td>${row.Mar || 0}</td>
                <td>${row.Apr || 0}</td><td>${row.May || 0}</td><td>${row.Jun || 0}</td>
                <td>${row.Jul || 0}</td><td>${row.Aug || 0}</td><td>${row.Sep || 0}</td>
                <td>${row.Oct || 0}</td><td>${row.Nov || 0}</td><td>${row.Dec || 0}</td>
                <td><strong>${row.Total || 0}</strong></td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('servicePivotTable').innerHTML = html;
    }

    // Load division performance
    const divisions = await fetchReportsAPI('division-performance');
    if (divisions && divisions.length) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Division</th>
                    <th>Districts</th>
                    <th>Upazilas</th>
                    <th>Mutations</th>
                    <th>Pending</th>
                    <th>Total Value</th>
                    <th>Avg Value</th>
                    <th>% of Total</th>
                    <th>Value Rank</th>
                </tr>
            </thead>
            <tbody>`;

        divisions.forEach(row => {
            html += `<tr>
                <td><strong>${row.division_name}</strong></td>
                <td>${row.district_count}</td>
                <td>${row.upazila_count}</td>
                <td>${row.total_mutations}</td>
                <td>${row.pending_mutations}</td>
                <td>${formatCurrency(row.total_land_value)}</td>
                <td>${formatCurrency(row.avg_land_value)}</td>
                <td>${row.pct_of_total_mutations || 0}%</td>
                <td>${getRankBadge(row.value_rank)}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('divisionPerformance').innerHTML = html;
    }
}

// =====================
// USERS MODAL
// =====================

async function showUsersModal() {
    openModal('usersModal');
    const users = await fetchAdminAPI('users');
    if (users) {
        document.getElementById('usersCount').textContent = users.length;
        let html = `<div class="table-responsive"><table class="modal-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>NID</th>
                    <th>Mobile</th>
                    <th>Gender</th>
                    <th>Joined</th>
                </tr>
            </thead>
            <tbody>`;

        users.forEach(user => {
            html += `<tr>
                <td>${user.id}</td>
                <td><strong>${user.name}</strong></td>
                <td>${user.email}</td>
                <td>${user.nid || '-'}</td>
                <td>${user.mobile || '-'}</td>
                <td>${user.gender || '-'}</td>
                <td>${formatDate(user.created_at)}</td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        document.getElementById('usersModalBody').innerHTML = html;
    }
}

async function showNewUsersModal() {
    openModal('newUsersModal');
    const users = await fetchAdminAPI('new-users');
    if (users) {
        document.getElementById('newUsersCount').textContent = users.length;
        let html = `<div class="table-responsive"><table class="modal-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Joined</th>
                </tr>
            </thead>
            <tbody>`;

        users.forEach(user => {
            html += `<tr>
                <td>${user.id}</td>
                <td><strong>${user.name}</strong></td>
                <td>${user.email}</td>
                <td>${user.mobile || '-'}</td>
                <td>${formatDate(user.created_at)}</td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        document.getElementById('newUsersModalBody').innerHTML = html;
    }
}

// =====================
// SERVICE REQUESTS MODAL
// =====================

async function showServiceRequestsModal() {
    openModal('serviceRequestsModal');
    allServiceRequests = await fetchAdminAPI('service-requests') || [];
    document.getElementById('serviceRequestsCount').textContent = allServiceRequests.length;
    renderServiceRequests(allServiceRequests);
}

function filterServiceRequests(status) {
    // Update filter buttons
    document.querySelectorAll('#serviceRequestsModal .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === status ||
            (status === 'all' && btn.textContent === 'All'));
    });

    const filtered = status === 'all'
        ? allServiceRequests
        : allServiceRequests.filter(r => r.status === status);
    renderServiceRequests(filtered);
}

function renderServiceRequests(requests) {
    let html = `<div class="table-responsive"><table class="modal-table">
        <thead>
            <tr>
                <th>ID</th>
                <th>User</th>
                <th>Service Type</th>
                <th>Details</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>`;

    requests.forEach(req => {
        const isPending = req.status === 'pending';
        html += `<tr>
            <td>${req.id}</td>
            <td><strong>${req.user_name || 'N/A'}</strong><div style="font-size:0.8rem;color:#64748b;">${req.user_email || ''}</div></td>
            <td>${req.service_type}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${req.details || '-'}</td>
            <td>${getStatusBadge(req.status)}</td>
            <td>${formatDate(req.created_at)}</td>
            <td class="action-cell">
                ${isPending ? `
                    <button class="action-btn approve" onclick="approveServiceRequest(${req.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="action-btn reject" onclick="rejectServiceRequest(${req.id})">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : '-'}
            </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    document.getElementById('serviceRequestsModalBody').innerHTML = html;
}

async function approveServiceRequest(id) {
    const result = await fetchAdminAPI(`service-requests/${id}/approve`, 'PUT');
    if (result?.success) {
        Swal.fire({ icon: 'success', title: 'Approved!', timer: 1500, showConfirmButton: false });
        showServiceRequestsModal();
        loadOverview();
    }
}

async function rejectServiceRequest(id) {
    const { value: reason } = await Swal.fire({
        title: 'Reject Request',
        input: 'textarea',
        inputLabel: 'Reason for rejection (optional)',
        inputPlaceholder: 'Enter reason...',
        showCancelButton: true,
        confirmButtonText: 'Reject',
        confirmButtonColor: '#ef4444'
    });

    if (reason !== undefined) {
        const result = await fetchAdminAPI(`service-requests/${id}/reject`, 'PUT', { reason });
        if (result?.success) {
            Swal.fire({ icon: 'success', title: 'Rejected', timer: 1500, showConfirmButton: false });
            showServiceRequestsModal();
            loadOverview();
        }
    }
}

// =====================
// LAND MUTATIONS MODAL
// =====================

async function showLandMutationsModal() {
    openModal('landMutationsModal');
    allLandMutations = await fetchAdminAPI('land-mutations') || [];
    document.getElementById('landMutationsCount').textContent = allLandMutations.length;
    renderLandMutations(allLandMutations);
}

function filterLandMutations(status) {
    document.querySelectorAll('#landMutationsModal .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === status ||
            (status === 'all' && btn.textContent === 'All'));
    });

    const filtered = status === 'all'
        ? allLandMutations
        : allLandMutations.filter(m => m.status === status);
    renderLandMutations(filtered);
}

function renderLandMutations(mutations) {
    let html = `<div class="table-responsive"><table class="modal-table">
        <thead>
            <tr>
                <th>Tracking #</th>
                <th>Applicant</th>
                <th>Buyer</th>
                <th>Location</th>
                <th>Khatian/Dag</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>`;

    mutations.forEach(m => {
        const isPending = m.status === 'Pending';
        html += `<tr>
            <td><code>${m.tracking_number}</code></td>
            <td><strong>${m.applicant_name || 'N/A'}</strong></td>
            <td>${m.buyer_name || '-'}</td>
            <td>${m.division_name || ''} > ${m.district_name || ''}</td>
            <td>${m.khatian_no} / ${m.dag_no}</td>
            <td>${formatCurrency(m.land_price)}</td>
            <td>${getStatusBadge(m.status)}</td>
            <td class="action-cell">
                ${isPending ? `
                    <button class="action-btn approve" onclick="approveLandMutation(${m.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="action-btn reject" onclick="rejectLandMutation(${m.id})">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : '-'}
            </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    document.getElementById('landMutationsModalBody').innerHTML = html;
}

async function approveLandMutation(id) {
    const confirm = await Swal.fire({
        title: 'Approve Mutation?',
        text: 'This will transfer land ownership from seller to buyer.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Approve',
        confirmButtonColor: '#10b981'
    });

    if (confirm.isConfirmed) {
        // Show loading state
        Swal.fire({
            title: 'Processing...',
            text: 'Please wait while we update the records.',
            allowOutsideClick: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });

        console.log('Sending approval request for ID:', id);

        try {
            const result = await fetchAdminAPI(`land-mutations/${id}/approve`, 'PUT');
            console.log('Approval Result:', result);

            if (result?.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Approved!',
                    text: 'Land ownership transferred successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
                showLandMutationsModal();
                loadOverview(); // Refresh stats
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Approval Failed',
                    text: result?.error || 'Server returned an error. Check console for details.'
                });
            }
        } catch (err) {
            console.error('Frontend Approval Error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'A network or client-side error occurred.'
            });
        }
    }
}

async function rejectLandMutation(id) {
    const { value: reason } = await Swal.fire({
        title: 'Reject Mutation',
        input: 'textarea',
        inputLabel: 'Reason for rejection (optional)',
        inputPlaceholder: 'Enter reason...',
        showCancelButton: true,
        confirmButtonText: 'Reject',
        confirmButtonColor: '#ef4444'
    });

    if (reason !== undefined) {
        const result = await fetchAdminAPI(`land-mutations/${id}/reject`, 'PUT', { reason });
        if (result?.success) {
            Swal.fire({ icon: 'success', title: 'Rejected', timer: 1500, showConfirmButton: false });
            showLandMutationsModal();
            loadOverview();
        }
    }
}

// =====================
// COMMUNITY GROUPS MODAL
// =====================

async function showCommunityGroupsModal() {
    openModal('communityGroupsModal');
    allCommunityGroups = await fetchAdminAPI('community-groups') || [];
    document.getElementById('communityGroupsCount').textContent = allCommunityGroups.length;
    renderCommunityGroups(allCommunityGroups);
}

function filterCommunityGroups(status) {
    document.querySelectorAll('#communityGroupsModal .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === status ||
            (status === 'all' && btn.textContent === 'All'));
    });

    const filtered = status === 'all'
        ? allCommunityGroups
        : allCommunityGroups.filter(g => g.status === status);
    renderCommunityGroups(filtered);
}

function renderCommunityGroups(groups) {
    let html = `<div class="table-responsive"><table class="modal-table">
        <thead>
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Description</th>
                <th>Creator</th>
                <th>Members</th>
                <th>Posts</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>`;

    groups.forEach(g => {
        const isPending = g.status === 'pending';
        html += `<tr>
            <td>${g.id}</td>
            <td><strong>${g.name}</strong></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.description || '-'}</td>
            <td>${g.creator_name || 'N/A'}</td>
            <td>${g.member_count || 0}</td>
            <td>${g.post_count || 0}</td>
            <td>${getStatusBadge(g.status)}</td>
            <td class="action-cell">
                ${isPending ? `
                    <button class="action-btn approve" onclick="approveCommunityGroup(${g.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="action-btn reject" onclick="rejectCommunityGroup(${g.id})">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : '-'}
            </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    document.getElementById('communityGroupsModalBody').innerHTML = html;
}

async function approveCommunityGroup(id) {
    const result = await fetchAdminAPI(`community-groups/${id}/approve`, 'PUT');
    if (result?.success) {
        Swal.fire({ icon: 'success', title: 'Approved!', timer: 1500, showConfirmButton: false });
        showCommunityGroupsModal();
        loadOverview();
    }
}

async function rejectCommunityGroup(id) {
    const { value: reason } = await Swal.fire({
        title: 'Reject Group',
        input: 'textarea',
        inputLabel: 'Reason for rejection (optional)',
        inputPlaceholder: 'Enter reason...',
        showCancelButton: true,
        confirmButtonText: 'Reject',
        confirmButtonColor: '#ef4444'
    });

    if (reason !== undefined) {
        const result = await fetchAdminAPI(`community-groups/${id}/reject`, 'PUT', { reason });
        if (result?.success) {
            Swal.fire({ icon: 'success', title: 'Rejected', timer: 1500, showConfirmButton: false });
            showCommunityGroupsModal();
            loadOverview();
        }
    }
}

// =====================
// COMMUNITY POSTS MODAL
// =====================

async function showCommunityPostsModal() {
    openModal('communityPostsModal');
    allCommunityPosts = await fetchAdminAPI('community-posts') || [];
    document.getElementById('communityPostsCount').textContent = allCommunityPosts.length;
    renderCommunityPosts(allCommunityPosts);
}

function filterCommunityPosts(status) {
    document.querySelectorAll('#communityPostsModal .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === status ||
            (status === 'all' && btn.textContent === 'All'));
    });

    const filtered = status === 'all'
        ? allCommunityPosts
        : allCommunityPosts.filter(p => p.status === status);
    renderCommunityPosts(filtered);
}

function renderCommunityPosts(posts) {
    let html = `<div class="table-responsive"><table class="modal-table">
        <thead>
            <tr>
                <th>ID</th>
                <th>Content</th>
                <th>Author</th>
                <th>Group</th>
                <th>Likes</th>
                <th>Comments</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>`;

    posts.forEach(p => {
        const isPending = p.status === 'pending';
        const contentPreview = (p.content || '').substring(0, 80) + ((p.content || '').length > 80 ? '...' : '');
        html += `<tr>
            <td>${p.id}</td>
            <td style="max-width:250px;">${contentPreview}</td>
            <td>${p.author_name || 'N/A'}</td>
            <td>${p.group_name || '-'}</td>
            <td>${p.like_count || 0}</td>
            <td>${p.comment_count || 0}</td>
            <td>${getStatusBadge(p.status)}</td>
            <td class="action-cell">
                ${isPending ? `
                    <button class="action-btn approve" onclick="approveCommunityPost(${p.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="action-btn reject" onclick="rejectCommunityPost(${p.id})">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : '-'}
            </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    document.getElementById('communityPostsModalBody').innerHTML = html;
}

async function approveCommunityPost(id) {
    const result = await fetchAdminAPI(`community-posts/${id}/approve`, 'PUT');
    if (result?.success) {
        Swal.fire({ icon: 'success', title: 'Approved!', timer: 1500, showConfirmButton: false });
        showCommunityPostsModal();
        loadOverview();
    }
}

async function rejectCommunityPost(id) {
    const { value: reason } = await Swal.fire({
        title: 'Reject Post',
        input: 'textarea',
        inputLabel: 'Reason for rejection (optional)',
        inputPlaceholder: 'Enter reason...',
        showCancelButton: true,
        confirmButtonText: 'Reject',
        confirmButtonColor: '#ef4444'
    });

    if (reason !== undefined) {
        const result = await fetchAdminAPI(`community-posts/${id}/reject`, 'PUT', { reason });
        if (result?.success) {
            Swal.fire({ icon: 'success', title: 'Rejected', timer: 1500, showConfirmButton: false });
            showCommunityPostsModal();
            loadOverview();
        }
    }
}

// =====================
// OTHER TABS (User Analytics, Services, Land, Community, Audit)
// =====================

async function loadUsers() {
    const engagement = await fetchReportsAPI('user-engagement-scores');
    if (engagement && engagement.length) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>User</th>
                    <th>Logins</th>
                    <th>Posts</th>
                    <th>Comments</th>
                    <th>Groups</th>
                    <th>Score</th>
                    <th>Quartile</th>
                    <th>Percentile</th>
                    <th>Tier</th>
                </tr>
            </thead>
            <tbody>`;

        engagement.forEach(row => {
            html += `<tr>
                <td>${getRankBadge(row.rank_position)}</td>
                <td>
                    <strong>${row.name}</strong>
                    <div style="font-size: 0.8rem; color: #64748b;">${row.email}</div>
                </td>
                <td>${row.login_count}</td>
                <td>${row.post_count}</td>
                <td>${row.comment_count}</td>
                <td>${row.group_count}</td>
                <td><strong>${row.engagement_score}</strong></td>
                <td>Q${row.quartile}</td>
                <td>${row.percentile}%</td>
                <td>${getTierBadge(row.user_tier)}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('userEngagementTable').innerHTML = html;
    }

    const activity = await fetchReportsAPI('user-activity');
    if (activity && activity.distribution) {
        let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">`;

        activity.distribution.forEach(item => {
            html += `
                <div style="text-align: center; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 12px;">
                    ${getTierBadge(item.user_tier)}
                    <div style="font-size: 1.5rem; font-weight: 700; color: white; margin-top: 0.5rem;">${item.count}</div>
                    <div style="color: #64748b; font-size: 0.9rem;">users</div>
                </div>
            `;
        });

        html += '</div>';
        document.getElementById('userTierDistribution').innerHTML = html;
    }
}

async function loadServices() {
    const running = await fetchReportsAPI('running-totals?days=30');
    if (running && running.length) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Service Type</th>
                    <th>Daily Count</th>
                    <th>Running Total</th>
                    <th>% of Daily</th>
                </tr>
            </thead>
            <tbody>`;

        running.slice(0, 30).forEach(row => {
            html += `<tr>
                <td>${formatDate(row.request_date)}</td>
                <td>${row.service_type}</td>
                <td>${row.daily_count}</td>
                <td><strong>${row.running_total}</strong></td>
                <td>${row.pct_of_daily}%</td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('runningTotalsTable').innerHTML = html;
    }

    const dashboard = await fetchReportsAPI('service-dashboard?days=14');
    if (dashboard && dashboard.data) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Service</th>
                    <th>Total</th>
                    <th>Pending</th>
                    <th>Approved</th>
                    <th>Rejected</th>
                    <th>Approval Rate</th>
                </tr>
            </thead>
            <tbody>`;

        dashboard.data.slice(0, 20).forEach(row => {
            html += `<tr>
                <td>${formatDate(row.request_date)}</td>
                <td>${row.service_type}</td>
                <td>${row.total_requests}</td>
                <td>${row.pending_count}</td>
                <td style="color: #34d399;">${row.approved_count}</td>
                <td style="color: #f87171;">${row.rejected_count}</td>
                <td>${row.approval_rate}%</td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('serviceDashboardTable').innerHTML = html;
    }
}

async function loadLand() {
    const rollup = await fetchReportsAPI('land-rollup');
    if (rollup && rollup.length) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Division</th>
                    <th>District</th>
                    <th>Total Mutations</th>
                    <th>Approved</th>
                    <th>Pending</th>
                    <th>Rejected</th>
                    <th>Total Value</th>
                    <th>Avg Value</th>
                </tr>
            </thead>
            <tbody>`;

        rollup.forEach(row => {
            const isTotal = row.division?.includes('TOTAL') || row.district?.includes('Total');
            html += `<tr class="${isTotal ? 'total-row' : ''}">
                <td><strong>${row.division}</strong></td>
                <td>${row.district}</td>
                <td>${row.total_mutations}</td>
                <td style="color: #34d399;">${row.approved}</td>
                <td style="color: #fbbf24;">${row.pending}</td>
                <td style="color: #f87171;">${row.rejected}</td>
                <td>${formatCurrency(row.total_value)}</td>
                <td>${formatCurrency(row.avg_value)}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('landRollupTable').innerHTML = html;
    }

    const landLoc = await fetchReportsAPI('land-by-location');
    if (landLoc && landLoc.length) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Division</th>
                    <th>District</th>
                    <th>Upazila</th>
                    <th>Parcels</th>
                    <th>Approved</th>
                    <th>Total Value</th>
                </tr>
            </thead>
            <tbody>`;

        landLoc.slice(0, 30).forEach(row => {
            if (row.total_parcels > 0) {
                html += `<tr>
                    <td>${row.division || '-'}</td>
                    <td>${row.district || '-'}</td>
                    <td>${row.upazila || '-'}</td>
                    <td>${row.total_parcels}</td>
                    <td>${row.approved_parcels}</td>
                    <td>${formatCurrency(row.total_valuation)}</td>
                </tr>`;
            }
        });

        html += '</tbody></table>';
        document.getElementById('landByLocationTable').innerHTML = html;
    }

    // Load User Land Details Summary
    const userLand = await fetchReportsAPI('user-land-details');
    console.log('User Land Data:', userLand);

    if (userLand === null) {
        document.getElementById('userLandDetailsTable').innerHTML = '<p style="color: #ef4444;">Error loading data. Please restart the backend server to apply recent changes.</p>';
        return;
    }

    if (userLand && userLand.length) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Owner Name</th>
                    <th>NID</th>
                    <th>Mobile</th>
                    <th>Email</th>
                    <th>Total Parcels</th>
                    <th>Total Area</th>
                    <th>Total Value</th>
                    <th>Approved</th>
                    <th>Pending</th>
                    <th>Divisions</th>
                    <th>Districts</th>
                    <th>Khatian No(s)</th>
                    <th>Dag No(s)</th>
                </tr>
            </thead>
            <tbody>`;

        userLand.forEach(row => {
            html += `<tr>
                <td><strong>${row.owner_name}</strong></td>
                <td>${row.owner_nid || '-'}</td>
                <td>${row.owner_mobile || '-'}</td>
                <td>${row.owner_email || '-'}</td>
                <td>${row.total_land_parcels}</td>
                <td>${formatNumber(row.total_land_area)} decimal</td>
                <td>${formatCurrency(row.total_land_value)}</td>
                <td style="color: #10b981;">${row.approved_parcels}</td>
                <td style="color: #f59e0b;">${row.pending_parcels}</td>
                <td>${row.divisions_owned || '-'}</td>
                <td>${row.districts_owned || '-'}</td>
                <td>${row.khatian_numbers || '-'}</td>
                <td>${row.dag_numbers || '-'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('userLandDetailsTable').innerHTML = html;
    } else {
        document.getElementById('userLandDetailsTable').innerHTML = '<p style="color: #64748b;">No land ownership data found.</p>';
    }
}

async function loadCommunity() {
    const analytics = await fetchReportsAPI('community-analytics');
    if (analytics && analytics.length) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Group</th>
                    <th>Created By</th>
                    <th>Members</th>
                    <th>Posts</th>
                    <th>Likes</th>
                    <th>Comments</th>
                    <th>Score</th>
                    <th>Size</th>
                </tr>
            </thead>
            <tbody>`;

        analytics.forEach(row => {
            html += `<tr>
                <td><strong>${row.group_name}</strong></td>
                <td>${row.created_by_name}</td>
                <td>${row.member_count}</td>
                <td>${row.total_posts}</td>
                <td style="color: #f472b6;">${row.total_likes}</td>
                <td style="color: #60a5fa;">${row.total_comments}</td>
                <td><strong>${row.engagement_score}</strong></td>
                <td><span class="badge regular">${row.group_size_category}</span></td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('communityAnalyticsTable').innerHTML = html;
    }

    const performers = await fetchReportsAPI('top-group-performers');
    if (performers && performers.length) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Group</th>
                    <th>Rank</th>
                    <th>User</th>
                    <th>Posts</th>
                    <th>Comments</th>
                    <th>Likes</th>
                    <th>Total Activity</th>
                </tr>
            </thead>
            <tbody>`;

        performers.forEach(row => {
            html += `<tr>
                <td>${row.group_name}</td>
                <td>${getRankBadge(row.rank_in_group)}</td>
                <td><strong>${row.user_name}</strong></td>
                <td>${row.post_count}</td>
                <td>${row.comment_count}</td>
                <td>${row.like_count}</td>
                <td><strong>${row.total_activity}</strong></td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('topPerformersTable').innerHTML = html;
    }
}

async function loadAudit() {
    const audit = await fetchReportsAPI('audit-log?limit=50');
    if (audit && audit.length) {
        let html = `<table class="report-table">
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Table</th>
                    <th>Record ID</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Changes</th>
                </tr>
            </thead>
            <tbody>`;

        audit.forEach(row => {
            const actionColor = row.action === 'INSERT' ? '#34d399' :
                row.action === 'UPDATE' ? '#fbbf24' : '#f87171';

            let changes = '';
            if (row.changed_fields) {
                changes = row.changed_fields;
            } else if (row.new_values) {
                try {
                    const vals = typeof row.new_values === 'string' ?
                        JSON.parse(row.new_values) : row.new_values;
                    changes = Object.keys(vals).slice(0, 3).join(', ');
                } catch (e) { }
            }

            html += `<tr>
                <td>${new Date(row.action_timestamp).toLocaleString()}</td>
                <td><code>${row.table_name}</code></td>
                <td>${row.record_id}</td>
                <td style="color: ${actionColor};"><strong>${row.action}</strong></td>
                <td>${row.user_name || '-'}</td>
                <td style="color: #94a3b8; font-size: 0.85rem;">${changes || '-'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('auditLogTable').innerHTML = html;
    } else {
        document.getElementById('auditLogTable').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-check"></i>
                <p>No audit entries yet. Changes to tables with triggers will appear here.</p>
            </div>
        `;
    }
}

// =====================
// SHOP MANAGEMENT
// =====================

let allShopItems = [];

async function loadShop() {
    // Load shop items
    const items = await fetchAdminAPI('shop-items');
    if (items) {
        allShopItems = items;
        renderShopItems(items);
    }

    // Load orders
    const orders = await fetchAdminAPI('orders');
    if (orders) {
        renderOrders(orders);
    }

    // Setup form handler
    const form = document.getElementById('addProductForm');
    if (form && !form.hasAttribute('data-listener')) {
        form.setAttribute('data-listener', 'true');
        form.addEventListener('submit', addShopItem);
    }

    const editForm = document.getElementById('editProductForm');
    if (editForm && !editForm.hasAttribute('data-listener')) {
        editForm.setAttribute('data-listener', 'true');
        editForm.addEventListener('submit', editShopItem);
    }
}

function renderShopItems(items) {
    let html = `<table class="report-table">
        <thead>
            <tr>
                <th style="width: 50px;">ID</th>
                <th style="width: 80px;">Image</th>
                <th>Name</th>
                <th>Description</th>
                <th>Price</th>
                <th>Stock</th>
                <th style="width: 180px; text-align: center;">Actions</th>
            </tr>
        </thead>
        <tbody>`;

    items.forEach(item => {
        const isIcon = item.image_url && item.image_url.includes('<i');
        const imgHtml = isIcon
            ? item.image_url
            : `<img src="${item.image_url}" alt="${item.name}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">`;

        html += `<tr>
            <td>${item.id}</td>
            <td>${imgHtml}</td>
            <td><strong>${item.name}</strong></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.description || '-'}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${item.stock_quantity || 0}</td>
            <td class="action-cell" style="white-space: nowrap; text-align: center;">
                <button class="action-btn edit" onclick="openEditProductModal(${item.id})" style="background:#3b82f6;color:white;margin-right:5px; padding: 5px 10px;">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn reject" onclick="deleteShopItem(${item.id})" style="padding: 5px 10px;">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('shopItemsTable').innerHTML = html || '<p style="color:#64748b;">No products yet.</p>';
}

function renderOrders(orders) {
    if (!orders || orders.length === 0) {
        document.getElementById('ordersTable').innerHTML = '<p style="color:#64748b;">No orders yet.</p>';
        return;
    }

    let html = `<table class="report-table">
        <thead>
            <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Address</th>
                <th>Date</th>
            </tr>
        </thead>
        <tbody>`;

    orders.forEach(order => {
        // Status Logic: COD = COD, Online = PAID
        let displayStatus = 'PAID';
        let statusColor = '#10b981'; // Green (Success)

        if (order.payment_method === 'COD') {
            displayStatus = 'COD';
            statusColor = '#f59e0b'; // Orange (Pending/COD)
        }

        html += `<tr>
            <td>#${order.id}</td>
            <td><strong>${order.customer_name || 'N/A'}</strong></td>
            <td>${formatCurrency(order.total_amount)}</td>
            <td>${order.payment_method}</td>
            <td>
                <span style="background:${statusColor};color:white;padding:2px 8px;border-radius:12px;font-size:0.8rem;">
                    ${displayStatus}
                </span>
            </td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${order.delivery_address || '-'}</td>
            <td>${formatDate(order.created_at)}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('ordersTable').innerHTML = html;
}

async function updateOrderStatus(orderId, newStatus) {
    if (!newStatus) return;

    try {
        const res = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        const result = await res.json();
        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: 'Status Updated',
                text: `Order #${orderId} marked as ${newStatus}`,
                timer: 1500,
                showConfirmButton: false
            });
            loadShop(); // Reload orders to update the badge
        } else {
            Swal.fire('Error', result.error || 'Failed to update status', 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        Swal.fire('Error', 'Failed to update status', 'error');
    }
}

async function addShopItem(e) {
    e.preventDefault();

    const name = document.getElementById('productName').value;
    const description = document.getElementById('productDescription').value;
    const price = document.getElementById('productPrice').value;
    const imageFile = document.getElementById('productImage').files[0];

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('price', price);
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        const res = await fetch('/api/admin/shop-items', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            },
            body: formData
        });

        const result = await res.json();
        if (result.success) {
            Swal.fire({ icon: 'success', title: 'Product Added!', timer: 1500, showConfirmButton: false });
            document.getElementById('addProductForm').reset();
            loadShop();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: result.error });
        }
    } catch (err) {
        console.error('Add product error:', err);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to add product' });
    }
}

function openEditProductModal(id) {
    const item = allShopItems.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editProductId').value = item.id;
    document.getElementById('editProductName').value = item.name;
    document.getElementById('editProductPrice').value = item.price;
    document.getElementById('editProductStock').value = item.stock_quantity || '';
    document.getElementById('editProductDescription').value = item.description || '';
    document.getElementById('editProductImage').value = ''; // Reset file input

    openModal('editProductModal');
}

async function editShopItem(e) {
    e.preventDefault();

    const id = document.getElementById('editProductId').value;
    const name = document.getElementById('editProductName').value;
    const description = document.getElementById('editProductDescription').value;
    const price = document.getElementById('editProductPrice').value;
    const stock = document.getElementById('editProductStock').value;
    const imageFile = document.getElementById('editProductImage').files[0];

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('stock_quantity', stock);
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        const res = await fetch(`/api/admin/shop-items/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            },
            body: formData
        });

        const result = await res.json();
        if (result.success) {
            Swal.fire({ icon: 'success', title: 'Product Updated!', timer: 1500, showConfirmButton: false });
            closeModal('editProductModal');
            loadShop(); // Reload list
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: result.error || 'Failed to update product' });
        }
    } catch (error) {
        console.error('Error updating product:', error);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update product' });
    }
}

async function deleteShopItem(id) {
    const confirm = await Swal.fire({
        title: 'Delete Product?',
        text: 'This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
        const result = await fetchAdminAPI(`shop-items/${id}`, 'DELETE');
        if (result?.success) {
            Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false });
            loadShop();
        }
    }
}

// =====================
// MARKET SUB-TAB NAVIGATION
// =====================

function showMarketSubTab(panel) {
    // Hide all panels
    ['products', 'prices', 'complaints'].forEach(p => {
        const el = document.getElementById(`marketPanel-${p}`);
        if (el) el.style.display = 'none';
        const btn = document.getElementById(`marketSubTab-${p}`);
        if (btn) btn.classList.remove('active');
    });

    // Show selected panel
    const selected = document.getElementById(`marketPanel-${panel}`);
    if (selected) selected.style.display = 'block';
    const selectedBtn = document.getElementById(`marketSubTab-${panel}`);
    if (selectedBtn) selectedBtn.classList.add('active');

    // Load data
    if (panel === 'prices') loadMarketPrices();
    if (panel === 'complaints') loadAdminComplaints();
}

// =====================
// MARKET PRICES MANAGEMENT
// =====================

let allMarketPrices = [];

async function loadMarketPrices() {
    const prices = await fetchAdminAPI('market-prices');
    if (prices) {
        allMarketPrices = prices;
        renderMarketPrices(prices);
    }

    // Setup form handler
    const form = document.getElementById('addMarketPriceForm');
    if (form && !form.hasAttribute('data-listener')) {
        form.setAttribute('data-listener', 'true');
        form.addEventListener('submit', addMarketPrice);
    }
}

function renderMarketPrices(prices) {
    if (!prices || prices.length === 0) {
        document.getElementById('marketPricesTable').innerHTML = '<p style="color:#64748b;">No market prices yet.</p>';
        return;
    }

    let html = `<table class="report-table">
        <thead>
            <tr>
                <th>ID</th>
                <th>Item Name</th>
                <th>Bangla</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Price (৳)</th>
                <th>Effective Date</th>
                <th style="text-align:center;">Actions</th>
            </tr>
        </thead>
        <tbody>`;

    prices.forEach(p => {
        html += `<tr>
            <td>${p.id}</td>
            <td><strong>${p.item_name}</strong></td>
            <td>${p.item_name_bn || '-'}</td>
            <td><span class="badge regular">${p.category}</span></td>
            <td>${p.unit}</td>
            <td style="color:#10b981;font-weight:600;">৳${parseFloat(p.price).toFixed(2)}</td>
            <td>${formatDate(p.effective_date || p.updated_at)}</td>
            <td class="action-cell" style="white-space:nowrap;text-align:center;">
                <button class="action-btn edit" onclick="editMarketPrice(${p.id})" style="background:#3b82f6;color:white;margin-right:5px;padding:5px 10px;">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn reject" onclick="deleteMarketPrice(${p.id})" style="padding:5px 10px;">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('marketPricesTable').innerHTML = html;
}

async function addMarketPrice(e) {
    e.preventDefault();

    const data = {
        item_name: document.getElementById('mpItemName').value,
        item_name_bn: document.getElementById('mpItemNameBn').value || null,
        category: document.getElementById('mpCategory').value,
        unit: document.getElementById('mpUnit').value,
        price: document.getElementById('mpPrice').value
    };

    try {
        const result = await fetchAdminAPI('market-prices', 'POST', data);
        if (result?.success) {
            Swal.fire({ icon: 'success', title: 'Price Added!', timer: 1500, showConfirmButton: false });
            document.getElementById('addMarketPriceForm').reset();
            loadMarketPrices();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: result?.error || 'Failed to add price' });
        }
    } catch (err) {
        console.error('Add market price error:', err);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to add price' });
    }
}

async function editMarketPrice(id) {
    const item = allMarketPrices.find(p => p.id === id);
    if (!item) return;

    const { value: formValues } = await Swal.fire({
        title: 'Edit Market Price',
        html: `
            <div style="text-align:left;">
                <label style="display:block;margin-bottom:0.3rem;color:#94a3b8;font-size:0.85rem;">Item Name</label>
                <input id="swal-name" class="swal2-input" value="${item.item_name}" style="width:100%;margin:0 0 0.8rem 0;">
                <label style="display:block;margin-bottom:0.3rem;color:#94a3b8;font-size:0.85rem;">Bangla Name</label>
                <input id="swal-nameBn" class="swal2-input" value="${item.item_name_bn || ''}" style="width:100%;margin:0 0 0.8rem 0;">
                <label style="display:block;margin-bottom:0.3rem;color:#94a3b8;font-size:0.85rem;">Category</label>
                <select id="swal-cat" class="swal2-select" style="width:100%;margin:0 0 0.8rem 0;padding:0.5rem;">
                    ${['Rice', 'Vegetables', 'Fish', 'Meat', 'Oil', 'Spices', 'Dairy', 'Fruits', 'Grains', 'Other'].map(c =>
            `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`
        ).join('')}
                </select>
                <label style="display:block;margin-bottom:0.3rem;color:#94a3b8;font-size:0.85rem;">Unit</label>
                <select id="swal-unit" class="swal2-select" style="width:100%;margin:0 0 0.8rem 0;padding:0.5rem;">
                    ${['kg', 'litre', 'piece', 'dozen'].map(u =>
            `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`
        ).join('')}
                </select>
                <label style="display:block;margin-bottom:0.3rem;color:#94a3b8;font-size:0.85rem;">Price (৳)</label>
                <input id="swal-price" type="number" class="swal2-input" value="${item.price}" step="0.01" style="width:100%;margin:0;">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Update',
        confirmButtonColor: '#3b82f6',
        background: '#1e293b',
        color: '#f1f5f9',
        preConfirm: () => ({
            item_name: document.getElementById('swal-name').value,
            item_name_bn: document.getElementById('swal-nameBn').value || null,
            category: document.getElementById('swal-cat').value,
            unit: document.getElementById('swal-unit').value,
            price: document.getElementById('swal-price').value
        })
    });

    if (formValues) {
        const result = await fetchAdminAPI(`market-prices/${id}`, 'PUT', formValues);
        if (result?.success) {
            Swal.fire({ icon: 'success', title: 'Updated!', timer: 1500, showConfirmButton: false });
            loadMarketPrices();
        }
    }
}

async function deleteMarketPrice(id) {
    const confirm = await Swal.fire({
        title: 'Delete Price Item?',
        text: 'This will remove it from the public market price list.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
        const result = await fetchAdminAPI(`market-prices/${id}`, 'DELETE');
        if (result?.success) {
            Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false });
            loadMarketPrices();
        }
    }
}

// =====================
// PRICE COMPLAINTS MANAGEMENT
// =====================

let allAdminComplaints = [];
let currentComplaintFilter = 'all';

async function loadAdminComplaints() {
    const complaints = await fetchAdminAPI('complaints');
    if (complaints) {
        allAdminComplaints = complaints;
        renderAdminComplaints(complaints);
    }
}

function filterComplaints(status) {
    currentComplaintFilter = status;
    const filtered = status === 'all' ? allAdminComplaints : allAdminComplaints.filter(c => c.status === status);
    renderAdminComplaints(filtered);

    // Update button active states
    const buttons = document.querySelectorAll('#marketPanel-complaints .filter-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === status);
    });
}

function renderAdminComplaints(complaints) {
    if (!complaints || complaints.length === 0) {
        document.getElementById('complaintsTable').innerHTML = '<p style="color:#64748b;">No complaints found.</p>';
        return;
    }

    let html = `<table class="report-table">
        <thead>
            <tr>
                <th>ID</th>
                <th>Reporter</th>
                <th>Shop</th>
                <th>Item</th>
                <th>Official ৳</th>
                <th>Charged ৳</th>
                <th>Location</th>
                <th>Status</th>
                <th>Date</th>
                <th style="text-align:center;">Actions</th>
            </tr>
        </thead>
        <tbody>`;

    complaints.forEach(c => {
        const statusColors = {
            pending: '#f59e0b', investigating: '#3b82f6', resolved: '#22c55e', dismissed: '#64748b'
        };
        const statusColor = statusColors[c.status] || '#64748b';

        html += `<tr>
            <td>#${c.id}</td>
            <td><strong>${c.reporter_name || 'Unknown'}</strong><div style="font-size:0.8rem;color:#64748b;">${c.reporter_email || ''}</div></td>
            <td><strong>${c.shop_name}</strong>${c.shop_phone ? `<div style="font-size:0.8rem;color:#64748b;">${c.shop_phone}</div>` : ''}</td>
            <td>${c.item_name}</td>
            <td>${c.official_price ? '৳' + parseFloat(c.official_price).toFixed(2) : '-'}</td>
            <td style="color:#ef4444;font-weight:600;">৳${parseFloat(c.charged_price).toFixed(2)}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.shop_location}</td>
            <td><span style="background:${statusColor};color:white;padding:2px 8px;border-radius:12px;font-size:0.8rem;">${c.status}</span></td>
            <td>${formatDate(c.created_at)}</td>
            <td class="action-cell" style="white-space:nowrap;text-align:center;">
                <select onchange="updateComplaintStatus(${c.id}, this.value)" style="background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:6px;padding:4px 8px;font-size:0.8rem;">
                    <option value="" disabled selected>Change</option>
                    <option value="investigating">Investigate</option>
                    <option value="resolved">Resolve</option>
                    <option value="dismissed">Dismiss</option>
                </select>
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('complaintsTable').innerHTML = html;
}

async function updateComplaintStatus(id, status) {
    if (!status) return;

    const { value: notes } = await Swal.fire({
        title: `Mark as ${status}?`,
        input: 'textarea',
        inputLabel: 'Admin Notes (optional)',
        inputPlaceholder: 'Add notes about this complaint...',
        showCancelButton: true,
        confirmButtonText: 'Update',
        confirmButtonColor: '#3b82f6',
        background: '#1e293b',
        color: '#f1f5f9'
    });

    if (notes !== undefined) {
        const result = await fetchAdminAPI(`complaints/${id}`, 'PUT', { status, admin_notes: notes || null });
        if (result?.success) {
            Swal.fire({ icon: 'success', title: 'Updated!', text: `Complaint marked as ${status}`, timer: 1500, showConfirmButton: false });
            loadAdminComplaints();
        }
    }
}

// =====================
// EDUCATION MANAGEMENT
// =====================

let currentExamType = 'jsc';
let educationBoards = [];
let allEducationResults = [];

// Subject definitions for each exam type
const examSubjects = {
    jsc: [
        { key: 'bangla', label: 'বাংলা (Bangla)' },
        { key: 'english', label: 'ইংরেজি (English)' },
        { key: 'mathematics', label: 'গণিত (Mathematics)' },
        { key: 'general_science', label: 'সাধারণ বিজ্ঞান (General Science)' },
        { key: 'bangladesh_global_studies', label: 'বাংলাদেশ ও বিশ্বপরিচয় (BGS)' },
        { key: 'religion', label: 'ধর্ম (Religion)' },
        { key: 'ict', label: 'তথ্য ও যোগাযোগ প্রযুক্তি (ICT)' }
    ],
    ssc: [
        { key: 'bangla_1st', label: 'বাংলা ১ম পত্র' },
        { key: 'bangla_2nd', label: 'বাংলা ২য় পত্র' },
        { key: 'english_1st', label: 'ইংরেজি ১ম পত্র' },
        { key: 'english_2nd', label: 'ইংরেজি ২য় পত্র' },
        { key: 'mathematics', label: 'গণিত (Mathematics)' },
        { key: 'physics', label: 'পদার্থবিজ্ঞান (Physics)' },
        { key: 'chemistry', label: 'রসায়ন (Chemistry)' },
        { key: 'biology', label: 'জীববিজ্ঞান (Biology)' },
        { key: 'higher_math', label: 'উচ্চতর গণিত (Higher Math)' },
        { key: 'bangladesh_global_studies', label: 'বাংলাদেশ ও বিশ্ব (BGS)' },
        { key: 'religion', label: 'ধর্ম (Religion)' },
        { key: 'ict', label: 'ICT' }
    ],
    hsc: [
        { key: 'bangla_1st', label: 'বাংলা ১ম পত্র' },
        { key: 'bangla_2nd', label: 'বাংলা ২য় পত্র' },
        { key: 'english_1st', label: 'ইংরেজি ১ম পত্র' },
        { key: 'english_2nd', label: 'ইংরেজি ২য় পত্র' },
        { key: 'physics_1st', label: 'পদার্থ ১ম পত্র' },
        { key: 'physics_2nd', label: 'পদার্থ ২য় পত্র' },
        { key: 'chemistry_1st', label: 'রসায়ন ১ম পত্র' },
        { key: 'chemistry_2nd', label: 'রসায়ন ২য় পত্র' },
        { key: 'biology_1st', label: 'জীববিজ্ঞান ১ম পত্র' },
        { key: 'biology_2nd', label: 'জীববিজ্ঞান ২য় পত্র' },
        { key: 'higher_math_1st', label: 'উচ্চতর গণিত ১ম পত্র' },
        { key: 'higher_math_2nd', label: 'উচ্চতর গণিত ২য় পত্র' },
        { key: 'ict', label: 'ICT' }
    ]
};

const gradeOptions = ['A+', 'A', 'A-', 'B', 'C', 'D', 'F'];

let institutionsCache = {}; // Cache institutions by board_id

async function loadEducation() {
    // Load boards
    if (educationBoards.length === 0) {
        const boards = await fetchAdminAPI('education/boards');
        if (boards) {
            educationBoards = boards;
            const boardSelect = document.getElementById('resultBoard');
            boardSelect.innerHTML = '<option value="">Select Board</option>' +
                boards.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

            // Add board change listener to load institutions
            boardSelect.addEventListener('change', async function () {
                await loadInstitutionsForBoard(this.value);
            });
        }
    }

    // Load stats
    const stats = await fetchAdminAPI('education/stats');
    if (stats) {
        document.getElementById('jscCount').textContent = stats.jsc || 0;
        document.getElementById('sscCount').textContent = stats.ssc || 0;
        document.getElementById('hscCount').textContent = stats.hsc || 0;
    }

    // render subject fields and load results
    renderSubjectFields();
    loadEducationResults();

    // Setup form submit
    document.getElementById('addResultForm').onsubmit = submitEducationResult;

    // Setup search
    document.getElementById('educationSearch').oninput = debounce(function () {
        loadEducationResults(this.value);
    }, 300);
}

/**
 * Load institutions for a specific board and populate the dropdown
 */
async function loadInstitutionsForBoard(boardId) {
    const institutionSelect = document.getElementById('resultInstitution');

    if (!boardId) {
        institutionSelect.innerHTML = '<option value="">Select Board First</option>';
        return;
    }

    // Check cache first
    if (institutionsCache[boardId]) {
        populateInstitutionDropdown(institutionsCache[boardId]);
        return;
    }

    // Show loading
    institutionSelect.innerHTML = '<option value="">Loading...</option>';

    const institutions = await fetchAdminAPI(`education/institutions/${boardId}`);
    if (institutions && institutions.length > 0) {
        institutionsCache[boardId] = institutions;
        populateInstitutionDropdown(institutions);
    } else {
        institutionSelect.innerHTML = '<option value="">No institutions found</option>';
    }
}

function populateInstitutionDropdown(institutions) {
    const institutionSelect = document.getElementById('resultInstitution');
    institutionSelect.innerHTML = '<option value="">Select Institution</option>' +
        institutions.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
}

function selectExamType(type) {
    currentExamType = type;

    // Update button states
    document.querySelectorAll('#education-section .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(type));
    });

    // Update label
    document.getElementById('currentExamTypeLabel').textContent = `(${type.toUpperCase()})`;

    // Re-render subject fields
    renderSubjectFields();

    // Reload results
    loadEducationResults();
}

function renderSubjectFields() {
    const container = document.getElementById('subjectGradesContainer');
    const subjects = examSubjects[currentExamType] || [];

    container.innerHTML = subjects.map(s => `
        <div class="form-group">
            <label>${s.label}</label>
            <select id="grade_${s.key}" class="form-control">
                <option value="">-</option>
                ${gradeOptions.map(g => `<option value="${g}">${g}</option>`).join('')}
            </select>
        </div>
    `).join('');
}

async function loadEducationResults(search = '') {
    const results = await fetchAdminAPI(`education/results/${currentExamType}?search=${search}`);
    allEducationResults = results || [];
    renderEducationResults();
}

function renderEducationResults() {
    const container = document.getElementById('educationResultsTable');

    if (allEducationResults.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 2rem;">No results found</p>';
        return;
    }

    let html = `<div class="table-responsive"><table class="modal-table">
        <thead>
            <tr>
                <th>Roll</th>
                <th>Name</th>
                <th>Year</th>
                <th>Board</th>
                <th>Institution</th>
                <th>GPA</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>`;

    allEducationResults.forEach(r => {
        const statusClass = r.result_status === 'Passed' ? 'approved' : (r.result_status === 'Failed' ? 'rejected' : 'pending');
        html += `<tr>
            <td><code>${r.roll_number}</code></td>
            <td><strong>${r.student_name}</strong></td>
            <td>${r.exam_year}</td>
            <td>${r.board_name || '-'}</td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${r.institution_name || '-'}</td>
            <td><span style="color: #fde047; font-weight: 600;">${r.gpa}</span></td>
            <td><span class="status-badge ${statusClass}">${r.result_status}</span></td>
            <td class="action-cell">
                <button class="action-btn approve" onclick="editEducationResult(${r.id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn reject" onclick="deleteEducationResult(${r.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function submitEducationResult(event) {
    event.preventDefault();

    const data = {
        roll_number: document.getElementById('resultRoll').value,
        registration_number: document.getElementById('resultReg').value,
        exam_year: document.getElementById('resultYear').value,
        board_id: document.getElementById('resultBoard').value,
        student_name: document.getElementById('resultName').value,
        father_name: document.getElementById('resultFather').value,
        mother_name: document.getElementById('resultMother').value,
        institution_name: document.getElementById('resultInstitution').value,
        gpa: parseFloat(document.getElementById('resultGPA').value),
        result_status: document.getElementById('resultStatus').value
    };

    // Add subject grades
    const subjects = examSubjects[currentExamType] || [];
    subjects.forEach(s => {
        const el = document.getElementById(`grade_${s.key}`);
        if (el && el.value) {
            data[s.key] = el.value;
        }
    });

    // For SSC/HSC add group
    if (currentExamType !== 'jsc') {
        data.exam_group = 'Science';
    }

    const result = await fetchAdminAPI(`education/results/${currentExamType}`, 'POST', data);

    if (result?.success) {
        Swal.fire({ icon: 'success', title: 'Result Added!', timer: 1500, showConfirmButton: false });
        document.getElementById('addResultForm').reset();
        renderSubjectFields();
        loadEducation();
    } else {
        Swal.fire({ icon: 'error', title: 'Error', text: result?.error || 'Failed to add result' });
    }
}

async function editEducationResult(id) {
    const result = allEducationResults.find(r => r.id === id);
    if (!result) return;

    // Build subject grades HTML
    const subjects = examSubjects[currentExamType] || [];
    let subjectsHtml = subjects.map(s => {
        const currentGrade = result[s.key] || '';
        return `<div style="margin-bottom: 0.5rem;">
            <label style="display: inline-block; width: 200px;">${s.label}</label>
            <select id="edit_grade_${s.key}" class="swal2-select" style="width: 80px;">
                <option value="">-</option>
                ${gradeOptions.map(g => `<option value="${g}" ${g === currentGrade ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
        </div>`;
    }).join('');

    const { value: formData } = await Swal.fire({
        title: 'Edit Result',
        html: `
            <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                <div style="margin-bottom: 1rem;">
                    <label>Student Name</label>
                    <input id="edit_name" class="swal2-input" value="${result.student_name}">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label>GPA</label>
                    <input id="edit_gpa" type="number" step="0.01" min="0" max="5" class="swal2-input" value="${result.gpa}">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label>Status</label>
                    <select id="edit_status" class="swal2-select">
                        <option value="Passed" ${result.result_status === 'Passed' ? 'selected' : ''}>Passed</option>
                        <option value="Failed" ${result.result_status === 'Failed' ? 'selected' : ''}>Failed</option>
                        <option value="Withheld" ${result.result_status === 'Withheld' ? 'selected' : ''}>Withheld</option>
                    </select>
                </div>
                <h4 style="margin: 1rem 0 0.5rem;">Subject Grades</h4>
                ${subjectsHtml}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Update',
        width: '600px',
        preConfirm: () => {
            const data = {
                student_name: document.getElementById('edit_name').value,
                gpa: parseFloat(document.getElementById('edit_gpa').value),
                result_status: document.getElementById('edit_status').value
            };
            subjects.forEach(s => {
                const el = document.getElementById(`edit_grade_${s.key}`);
                if (el) data[s.key] = el.value || null;
            });
            return data;
        }
    });

    if (formData) {
        const updateResult = await fetchAdminAPI(`education/results/${currentExamType}/${id}`, 'PUT', formData);
        if (updateResult?.success) {
            Swal.fire({ icon: 'success', title: 'Updated!', timer: 1500, showConfirmButton: false });
            loadEducation();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update result' });
        }
    }
}

async function deleteEducationResult(id) {
    const confirm = await Swal.fire({
        title: 'Delete Result?',
        text: 'This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
        const result = await fetchAdminAPI(`education/results/${currentExamType}/${id}`, 'DELETE');
        if (result?.success) {
            Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false });
            loadEducation();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete result' });
        }
    }
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// =====================
// ADMISSIONS MANAGEMENT
// =====================

let allUniversities = [];
let allAdmissionPosts = [];
let allApplications = [];
let currentAdmissionsTab = 'universities';

async function loadAdmissions() {
    try {
        // Load stats
        const statsRes = await fetchAdminAPI('admission-stats');
        if (statsRes.success) {
            document.getElementById('universitiesCount').textContent = statsRes.data.totalUniversities || 0;
            document.getElementById('admissionPostsCount').textContent = statsRes.data.totalPosts || 0;
            document.getElementById('applicationsCount').textContent = statsRes.data.totalApplications || 0;
            document.getElementById('pendingApplicationsCount').textContent = statsRes.data.pendingApplications || 0;
        }

        // Load all data
        await Promise.all([
            loadUniversities(),
            loadAdmissionPosts(),
            loadApplicationsList()
        ]);

        // Set up form handlers
        const uniForm = document.getElementById('addUniversityForm');
        if (uniForm) {
            uniForm.onsubmit = addUniversity;
        }

        const postForm = document.getElementById('addAdmissionPostForm');
        if (postForm) {
            postForm.onsubmit = addAdmissionPost;
        }

    } catch (error) {
        console.error('Error loading admissions:', error);
    }
}

function selectAdmissionsTab(tab) {
    currentAdmissionsTab = tab;

    // Update buttons
    document.querySelectorAll('#admissions-section .modal-filter-bar .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Hide all tabs
    document.querySelectorAll('.admissions-tab-content').forEach(el => {
        el.style.display = 'none';
    });

    // Show selected tab
    const tabEl = document.getElementById(tab + '-tab');
    if (tabEl) tabEl.style.display = 'block';
}

// =====================
// UNIVERSITIES
// =====================

async function loadUniversities() {
    try {
        const res = await fetchAdminAPI('universities');
        if (res.success) {
            allUniversities = res.data;
            renderUniversities();
            populateUniversityDropdowns();
        }
    } catch (error) {
        console.error('Error loading universities:', error);
    }
}

function renderUniversities() {
    const container = document.getElementById('universitiesTable');
    if (!container) return;

    if (allUniversities.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No universities found</p>';
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Logo</th>
                        <th>Name</th>
                        <th>Code</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Website</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allUniversities.map(u => `
                        <tr>
                            <td>
                                ${u.logo_url ? `<img src="${u.logo_url}" alt="${u.name}" style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px;">` : '<i class="fas fa-university" style="font-size: 24px; color: #60a5fa;"></i>'}
                            </td>
                            <td>${u.name}</td>
                            <td><strong>${u.short_code}</strong></td>
                            <td><span class="status-badge ${u.university_type === 'Public' ? 'approved' : 'pending'}">${u.university_type}</span></td>
                            <td>${u.location || '-'}</td>
                            <td>${u.website ? `<a href="${u.website}" target="_blank" style="color: #60a5fa;"><i class="fas fa-external-link-alt"></i></a>` : '-'}</td>
                            <td>
                                <button class="action-btn edit" onclick="editUniversity(${u.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function populateUniversityDropdowns() {
    const postUniSelect = document.getElementById('postUniversity');
    const filterUniSelect = document.getElementById('filterAppUniversity');

    const options = allUniversities.map(u => `<option value="${u.id}">${u.name} (${u.short_code})</option>`).join('');

    if (postUniSelect) {
        postUniSelect.innerHTML = '<option value="">Select University</option>' + options;
    }

    if (filterUniSelect) {
        filterUniSelect.innerHTML = '<option value="">All Universities</option>' + options;
    }
}

async function addUniversity(e) {
    e.preventDefault();

    const data = {
        name: document.getElementById('universityName').value.trim(),
        name_bn: document.getElementById('universityNameBn').value.trim() || null,
        short_code: document.getElementById('universityCode').value.trim(),
        university_type: document.getElementById('universityType').value,
        location: document.getElementById('universityLocation').value.trim(),
        website: document.getElementById('universityWebsite').value.trim() || null,
        logo_url: document.getElementById('universityLogo').value.trim() || null,
        description: document.getElementById('universityDescription').value.trim() || null
    };

    try {
        const res = await fetchAdminAPI('universities', 'POST', data);
        if (res.success) {
            Swal.fire('Success!', 'University added successfully', 'success');
            document.getElementById('addUniversityForm').reset();
            loadUniversities();
            // Update stats
            const count = parseInt(document.getElementById('universitiesCount').textContent) + 1;
            document.getElementById('universitiesCount').textContent = count;
        } else {
            console.error('Add University Error:', res);
            // show the specific error message from the backend if available
            Swal.fire('Error', res.error || res.message || 'Failed to add university', 'error');
        }
    } catch (error) {
        console.error('Network/Client Error:', error);
        Swal.fire('Error', error.message || 'Failed to add university', 'error');
    }
}

async function editUniversity(id) {
    const university = allUniversities.find(u => u.id === id);
    if (!university) return;

    const { value: formValues } = await Swal.fire({
        title: 'Edit University',
        html: `
            <div style="text-align: left;">
                <label style="color: #94a3b8;">Name</label>
                <input id="swal-name" class="swal2-input" value="${university.name}">
                <label style="color: #94a3b8;">Short Code</label>
                <input id="swal-code" class="swal2-input" value="${university.short_code}">
                <label style="color: #94a3b8;">Type</label>
                <select id="swal-type" class="swal2-input">
                    ${['Public', 'Private', 'National', 'Medical', 'Engineering'].map(t =>
            `<option value="${t}" ${university.university_type === t ? 'selected' : ''}>${t}</option>`
        ).join('')}
                </select>
                <label style="color: #94a3b8;">Location</label>
                <input id="swal-location" class="swal2-input" value="${university.location || ''}">
                <label style="color: #94a3b8;">Website</label>
                <input id="swal-website" class="swal2-input" value="${university.website || ''}">
                <label style="color: #94a3b8;">Logo URL</label>
                <input id="swal-logo" class="swal2-input" value="${university.logo_url || ''}">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Update',
        preConfirm: () => ({
            name: document.getElementById('swal-name').value,
            short_code: document.getElementById('swal-code').value,
            university_type: document.getElementById('swal-type').value,
            location: document.getElementById('swal-location').value,
            website: document.getElementById('swal-website').value || null,
            logo_url: document.getElementById('swal-logo').value || null
        })
    });

    if (formValues) {
        try {
            const res = await fetchAdminAPI(`universities/${id}`, 'PUT', formValues);
            if (res.success) {
                Swal.fire('Success!', 'University updated', 'success');
                loadUniversities();
            } else {
                Swal.fire('Error', res.message || 'Failed to update', 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Failed to update university', 'error');
        }
    }
}

// =====================
// ADMISSION POSTS
// =====================

async function loadAdmissionPosts() {
    try {
        const res = await fetchAdminAPI('admission-posts');
        if (res.success) {
            allAdmissionPosts = res.data;
            renderAdmissionPosts();
        }
    } catch (error) {
        console.error('Error loading admission posts:', error);
    }
}

function filterAdmissionPosts() {
    const status = document.getElementById('filterPostStatus')?.value || '';
    const filtered = status ? allAdmissionPosts.filter(p => p.status === status) : allAdmissionPosts;
    renderAdmissionPosts(filtered);
}

function renderAdmissionPosts(posts = allAdmissionPosts) {
    const container = document.getElementById('admissionPostsTable');
    if (!container) return;

    if (posts.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No admission posts found</p>';
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>University</th>
                        <th>Session</th>
                        <th>Unit</th>
                        <th>Group</th>
                        <th>Min GPA</th>
                        <th>Fee</th>
                        <th>Dates</th>
                        <th>Status</th>
                        <th>Apps</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${posts.map(p => `
                        <tr>
                            <td><strong>${p.university_name || p.university_id}</strong></td>
                            <td>${p.session}</td>
                            <td><span style="background: rgba(96, 165, 250, 0.2); padding: 2px 8px; border-radius: 4px; color: #60a5fa;">${p.unit}</span></td>
                            <td>${p.required_group || 'Any'}</td>
                            <td>${p.min_gpa}</td>
                            <td>৳${formatNumber(p.application_fee)}</td>
                            <td style="font-size: 0.8rem;">${formatDate(p.application_start)} - ${formatDate(p.application_end)}</td>
                            <td><span class="status-badge ${p.status === 'Active' ? 'approved' : p.status === 'Upcoming' ? 'pending' : 'rejected'}">${p.status}</span></td>
                            <td>${p.application_count || 0}</td>
                            <td>
                                <button class="action-btn edit" onclick="editAdmissionPost(${p.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn reject" onclick="deleteAdmissionPost(${p.id})" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function addAdmissionPost(e) {
    e.preventDefault();

    const data = {
        university_id: document.getElementById('postUniversity').value,
        session: document.getElementById('postSession').value,
        unit: document.getElementById('postUnit').value,
        required_group: document.getElementById('postRequiredGroup').value || null,
        min_gpa: parseFloat(document.getElementById('postMinGPA').value),
        application_fee: parseInt(document.getElementById('postFee').value),
        application_start: document.getElementById('postStartDate').value,
        application_end: document.getElementById('postEndDate').value,
        exam_date: document.getElementById('postExamDate').value || null,
        total_seats: document.getElementById('postSeats').value || null,
        status: document.getElementById('postStatus').value,
        requirements: document.getElementById('postRequirements').value || null
    };

    try {
        const res = await fetchAdminAPI('admission-posts', 'POST', data);
        if (res.success) {
            Swal.fire('Success!', 'Admission post created successfully', 'success');
            document.getElementById('addAdmissionPostForm').reset();
            loadAdmissionPosts();
            // Update stats
            const count = parseInt(document.getElementById('admissionPostsCount').textContent) + 1;
            document.getElementById('admissionPostsCount').textContent = count;
        } else {
            Swal.fire('Error', res.message || 'Failed to create admission post', 'error');
        }
    } catch (error) {
        Swal.fire('Error', 'Failed to create admission post', 'error');
    }
}

async function editAdmissionPost(id) {
    const post = allAdmissionPosts.find(p => p.id === id);
    if (!post) return;

    const { value: formValues } = await Swal.fire({
        title: 'Edit Admission Post',
        width: 600,
        html: `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; text-align: left;">
                <div>
                    <label style="color: #94a3b8; font-size: 0.8rem;">Session</label>
                    <input id="swal-session" class="swal2-input" value="${post.session}" style="margin: 0.25rem 0;">
                </div>
                <div>
                    <label style="color: #94a3b8; font-size: 0.8rem;">Unit</label>
                    <select id="swal-unit" class="swal2-input" style="margin: 0.25rem 0;">
                        ${['A', 'B', 'C', 'D', 'ENG', 'MED'].map(u =>
            `<option value="${u}" ${post.unit === u ? 'selected' : ''}>${u}</option>`
        ).join('')}
                    </select>
                </div>
                <div>
                    <label style="color: #94a3b8; font-size: 0.8rem;">Min GPA</label>
                    <input id="swal-gpa" type="number" step="0.01" class="swal2-input" value="${post.min_gpa}" style="margin: 0.25rem 0;">
                </div>
                <div>
                    <label style="color: #94a3b8; font-size: 0.8rem;">Fee (৳)</label>
                    <input id="swal-fee" type="number" class="swal2-input" value="${post.application_fee}" style="margin: 0.25rem 0;">
                </div>
                <div>
                    <label style="color: #94a3b8; font-size: 0.8rem;">Start Date</label>
                    <input id="swal-start" type="date" class="swal2-input" value="${post.application_start?.split('T')[0] || ''}" style="margin: 0.25rem 0;">
                </div>
                <div>
                    <label style="color: #94a3b8; font-size: 0.8rem;">End Date</label>
                    <input id="swal-end" type="date" class="swal2-input" value="${post.application_end?.split('T')[0] || ''}" style="margin: 0.25rem 0;">
                </div>
                <div>
                    <label style="color: #94a3b8; font-size: 0.8rem;">Total Seats</label>
                    <input id="swal-seats" type="number" class="swal2-input" value="${post.total_seats || ''}" style="margin: 0.25rem 0;">
                </div>
                <div>
                    <label style="color: #94a3b8; font-size: 0.8rem;">Status</label>
                    <select id="swal-status" class="swal2-input" style="margin: 0.25rem 0;">
                        ${['Active', 'Upcoming', 'Closed'].map(s =>
            `<option value="${s}" ${post.status === s ? 'selected' : ''}>${s}</option>`
        ).join('')}
                    </select>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Update',
        preConfirm: () => ({
            session: document.getElementById('swal-session').value,
            unit: document.getElementById('swal-unit').value,
            min_gpa: parseFloat(document.getElementById('swal-gpa').value),
            application_fee: parseInt(document.getElementById('swal-fee').value),
            application_start: document.getElementById('swal-start').value,
            application_end: document.getElementById('swal-end').value,
            total_seats: document.getElementById('swal-seats').value || null,
            status: document.getElementById('swal-status').value
        })
    });

    if (formValues) {
        try {
            const res = await fetchAdminAPI(`admission-posts/${id}`, 'PUT', formValues);
            if (res.success) {
                Swal.fire('Success!', 'Admission post updated', 'success');
                loadAdmissionPosts();
            } else {
                Swal.fire('Error', res.message || 'Failed to update', 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Failed to update admission post', 'error');
        }
    }
}

async function deleteAdmissionPost(id) {
    const result = await Swal.fire({
        title: 'Delete Admission Post?',
        text: 'This action cannot be undone. All applications for this post will also be deleted.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, delete it'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetchAdminAPI(`admission-posts/${id}`, 'DELETE');
            if (res.success) {
                Swal.fire('Deleted!', 'Admission post has been deleted.', 'success');
                loadAdmissionPosts();
                loadAdmissions(); // Refresh stats
            } else {
                Swal.fire('Error', res.message || 'Failed to delete', 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Failed to delete admission post', 'error');
        }
    }
}

// =====================
// APPLICATIONS
// =====================

async function loadApplicationsList() {
    try {
        const res = await fetchAdminAPI('university-applications');
        if (res.success) {
            allApplications = res.data;
            renderApplications();
        }
    } catch (error) {
        console.error('Error loading applications:', error);
    }
}

function filterApplications() {
    const status = document.getElementById('filterAppStatus')?.value || '';
    const university = document.getElementById('filterAppUniversity')?.value || '';
    const search = document.getElementById('searchApplications')?.value?.toLowerCase() || '';

    let filtered = allApplications;

    if (status) {
        filtered = filtered.filter(a => a.application_status === status);
    }

    if (university) {
        filtered = filtered.filter(a => a.university_id == university);
    }

    if (search) {
        filtered = filtered.filter(a =>
            a.hsc_roll?.toString().includes(search) ||
            a.student_name?.toLowerCase().includes(search) ||
            a.application_id?.toLowerCase().includes(search)
        );
    }

    renderApplications(filtered);
}

function renderApplications(apps = allApplications) {
    const container = document.getElementById('applicationsTable');
    if (!container) return;

    if (apps.length === 0) {
        container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No applications found</p>';
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Application ID</th>
                        <th>Student</th>
                        <th>HSC Info</th>
                        <th>University</th>
                        <th>Unit</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Applied On</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${apps.map(a => `
                        <tr>
                            <td><code style="color: #fde047;">${a.application_id}</code></td>
                            <td>
                                <strong>${a.student_name}</strong><br>
                                <small style="color: #94a3b8;">${a.mobile || ''}</small>
                            </td>
                            <td>
                                Roll: ${a.hsc_roll}<br>
                                <small style="color: #94a3b8;">Year: ${a.hsc_year} | GPA: ${a.hsc_gpa}</small>
                            </td>
                            <td>${a.university_name || a.university_id}</td>
                            <td><span style="background: rgba(96, 165, 250, 0.2); padding: 2px 8px; border-radius: 4px; color: #60a5fa;">${a.unit || '-'}</span></td>
                            <td><span class="status-badge ${a.payment_status === 'Paid' ? 'approved' : 'pending'}">${a.payment_status}</span></td>
                            <td><span class="status-badge ${a.application_status === 'Verified' ? 'approved' : a.application_status === 'Rejected' ? 'rejected' : 'pending'}">${a.application_status}</span></td>
                            <td style="font-size: 0.8rem;">${formatDate(a.created_at)}</td>
                            <td>
                                ${a.application_status === 'Submitted' ? `
                                    <button class="action-btn approve" onclick="verifyApplication(${a.id})" title="Verify">
                                        <i class="fas fa-check"></i>
                                    </button>
                                    <button class="action-btn reject" onclick="rejectApplication(${a.id})" title="Reject">
                                        <i class="fas fa-times"></i>
                                    </button>
                                ` : `
                                    <button class="action-btn info" onclick="viewApplicationDetails(${a.id})" title="View Details">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                `}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function verifyApplication(id) {
    const result = await Swal.fire({
        title: 'Verify Application?',
        text: 'This will mark the application as verified.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        confirmButtonText: 'Yes, verify'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetchAdminAPI(`university-applications/${id}/verify`, 'PUT', {
                status: 'Verified'
            });
            if (res.success) {
                Swal.fire('Verified!', 'Application has been verified.', 'success');
                loadApplicationsList();
                loadAdmissions(); // Refresh stats
            } else {
                Swal.fire('Error', res.message || 'Failed to verify', 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Failed to verify application', 'error');
        }
    }
}

async function rejectApplication(id) {
    const { value: reason } = await Swal.fire({
        title: 'Reject Application',
        input: 'textarea',
        inputLabel: 'Reason for rejection',
        inputPlaceholder: 'Enter rejection reason...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Reject',
        inputValidator: (value) => {
            if (!value) {
                return 'Please provide a reason';
            }
        }
    });

    if (reason) {
        try {
            const res = await fetchAdminAPI(`/admin/university-applications/${id}/verify`, 'PUT', {
                status: 'Rejected',
                rejection_reason: reason
            });
            if (res.success) {
                Swal.fire('Rejected!', 'Application has been rejected.', 'success');
                loadApplicationsList();
                loadAdmissions(); // Refresh stats
            } else {
                Swal.fire('Error', res.message || 'Failed to reject', 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Failed to reject application', 'error');
        }
    }
}

async function viewApplicationDetails(id) {
    const app = allApplications.find(a => a.id === id);
    if (!app) return;

    Swal.fire({
        title: `Application: ${app.application_id}`,
        html: `
            <div style="text-align: left; font-size: 0.9rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div><strong>Student:</strong> ${app.student_name}</div>
                    <div><strong>Mobile:</strong> ${app.mobile || 'N/A'}</div>
                    <div><strong>Email:</strong> ${app.email || 'N/A'}</div>
                    <div><strong>HSC Roll:</strong> ${app.hsc_roll}</div>
                    <div><strong>HSC Year:</strong> ${app.hsc_year}</div>
                    <div><strong>HSC GPA:</strong> ${app.hsc_gpa}</div>
                    <div><strong>Board:</strong> ${app.hsc_board || 'N/A'}</div>
                    <div><strong>Group:</strong> ${app.hsc_group || 'N/A'}</div>
                    <div style="grid-column: 1 / -1; border-top: 1px solid #334155; margin: 0.5rem 0; padding-top: 0.5rem;"></div>
                    <div><strong>University:</strong> ${app.university_name}</div>
                    <div><strong>Unit:</strong> ${app.unit || 'N/A'}</div>
                    <div><strong>Payment:</strong> <span class="status-badge ${app.payment_status === 'Paid' ? 'approved' : 'pending'}">${app.payment_status}</span></div>
                    <div><strong>Status:</strong> <span class="status-badge ${app.application_status === 'Verified' ? 'approved' : app.application_status === 'Rejected' ? 'rejected' : 'pending'}">${app.application_status}</span></div>
                    ${app.transaction_id ? `<div><strong>Transaction:</strong> ${app.transaction_id}</div>` : ''}
                    <div><strong>Applied:</strong> ${formatDate(app.created_at)}</div>
                </div>
                ${app.rejection_reason ? `
                    <div style="background: rgba(239, 68, 68, 0.1); padding: 0.5rem; border-radius: 4px; margin-top: 1rem; color: #ef4444;">
                        <strong>Rejection Reason:</strong> ${app.rejection_reason}
                    </div>
                ` : ''}
            </div>
        `,
        width: 600,
        confirmButtonText: 'Close'
    });
}

// =====================
// STIPEND MANAGEMENT
// =====================

let currentStipendTab = 'grants';
let allStipendGrants = [];
let allStipendApplications = [];

async function loadStipends() {
    selectStipendTab(currentStipendTab);

    // Bind form submit if not already bound(checked via attribute or just rebind carefully)
    const form = document.getElementById('addStipendForm');
    if (form) {
        form.onsubmit = handleAddStipend;
    }
}

function selectStipendTab(tab) {
    currentStipendTab = tab;

    // Update buttons
    document.querySelectorAll('#stipends-section .filter-btn').forEach(btn => {
        const btnTab = btn.innerText.includes('Grants') ? 'grants' : 'applications';
        btn.classList.toggle('active', btnTab === tab);
    });

    // Toggle content
    document.getElementById('stipend-grants-tab').style.display = tab === 'grants' ? 'block' : 'none';
    document.getElementById('stipend-applications-tab').style.display = tab === 'applications' ? 'block' : 'none';

    if (tab === 'grants') loadStipendGrants();
    else loadStipendApplications();
}

async function loadStipendGrants() {
    const tableDiv = document.getElementById('stipendGrantsTable');
    tableDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    allStipendGrants = await fetchAdminAPI('stipends') || [];

    if (allStipendGrants.length === 0) {
        tableDiv.innerHTML = '<p class="text-muted">No active grants found.</p>';
        return;
    }

    let html = `<table class="report-table">
        <thead>
            <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Min GPA</th>
                <th>Deadline</th>
                <th>Active</th>
            </tr>
        </thead>
        <tbody>`;

    allStipendGrants.forEach(grant => {
        html += `<tr>
            <td><strong>${grant.title}</strong></td>
            <td>${getTierBadge(grant.type)}</td>
            <td>${formatCurrency(grant.amount)}</td>
            <td>${grant.min_gpa || '-'}</td>
            <td>${formatDate(grant.deadline)}</td>
            <td>${grant.is_active ? '<span class="status-badge approved">Active</span>' : '<span class="status-badge rejected">Inactive</span>'}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    tableDiv.innerHTML = html;
}

async function handleAddStipend(e) {
    e.preventDefault();
    const payload = {
        title: document.getElementById('grantTitle').value,
        amount: document.getElementById('grantAmount').value,
        type: document.getElementById('grantType').value,
        min_gpa: document.getElementById('grantGPA').value,
        max_income: document.getElementById('grantIncome').value,
        deadline: document.getElementById('grantDeadline').value,
        description: document.getElementById('grantDescription').value,
        is_active: true
    };

    try {
        const res = await fetchAdminAPI('stipends', 'POST', payload);
        if (res && res.success) {
            Swal.fire('Success', 'Grant created successfully!', 'success');
            document.getElementById('addStipendForm').reset();
            loadStipendGrants();
        } else {
            Swal.fire('Error', res.error || 'Failed to create grant', 'error');
        }
    } catch (error) {
        console.error('Error creating grant:', error);
        Swal.fire('Error', 'Failed to create grant', 'error');
    }
}

async function loadStipendApplications() {
    const tableDiv = document.getElementById('stipendApplicationsTable');
    tableDiv.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    allStipendApplications = await fetchAdminAPI('stipend-applications') || [];

    if (allStipendApplications.length === 0) {
        tableDiv.innerHTML = '<p class="text-muted">No applications received yet.</p>';
        return;
    }

    let html = `<table class="report-table">
        <thead>
            <tr>
                <th>App No</th>
                <th>Student</th>
                <th>Grant</th>
                <th>GPA</th>
                <th>Income</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>`;

    allStipendApplications.forEach(app => {
        const student = JSON.parse(app.student_details || '{}');
        const financial = JSON.parse(app.financial_info || '{}');
        const isPending = app.status === 'Pending' || app.status === 'Submitted' || app.status === 'Under Review';

        html += `<tr>
            <td>${app.application_no}</td>
            <td>
                <strong>${app.student_name}</strong>
                <div style="font-size:0.8rem; color:#64748b;">${student.institution || ''}</div>
            </td>
            <td>${app.stipend_title}</td>
            <td>${student.gpa || '-'}</td>
            <td>${formatCurrency(financial.monthlyIncome)}</td>
            <td>${getStatusBadge(app.status)}</td>
            <td class="action-cell">
                ${isPending ? `
                    <button class="action-btn approve" onclick="approveStipendApp(${app.id})"><i class="fas fa-check"></i></button>
                    <button class="action-btn reject" onclick="rejectStipendApp(${app.id})"><i class="fas fa-times"></i></button>
                ` : '-'}
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    tableDiv.innerHTML = html;
}

async function approveStipendApp(id) {
    const confirm = await Swal.fire({
        title: 'Approve Application?',
        text: 'This will mark the application as Approved.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Approve',
        confirmButtonColor: '#10b981'
    });

    if (confirm.isConfirmed) {
        const res = await fetchAdminAPI(`stipend-applications/${id}/status`, 'PUT', { status: 'Approved' });
        if (res && res.success) {
            Swal.fire('Approved!', 'Application approved.', 'success');
            loadStipendApplications();
        }
    }
}

async function rejectStipendApp(id) {
    const confirm = await Swal.fire({
        title: 'Reject Application?',
        text: 'This will mark the application as Rejected.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Reject',
        confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
        const res = await fetchAdminAPI(`stipend-applications/${id}/status`, 'PUT', { status: 'Rejected' });
        if (res && res.success) {
            Swal.fire('Rejected', 'Application rejected.', 'success');
            loadStipendApplications();
        }
    }
}

// =====================
// GOVT NOTICES MANAGEMENT
// =====================

let allAdminNotices = [];

async function loadNotices() {
    try {
        const res = await fetch('/api/notices/admin/all', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.status === 401 || res.status === 403) {
            adminLogout();
            return;
        }
        allAdminNotices = await res.json();

        // Update stats
        document.getElementById('adminNoticesTotal').textContent = allAdminNotices.length;
        document.getElementById('adminNoticesUrgent').textContent = allAdminNotices.filter(n => n.category === 'Urgent').length;
        document.getElementById('adminNoticesTenders').textContent = allAdminNotices.filter(n => n.category === 'Tender').length;
        document.getElementById('adminNoticesRecruitment').textContent = allAdminNotices.filter(n => n.category === 'Recruitment').length;

        // Render table
        renderAdminNotices(allAdminNotices);
    } catch (err) {
        console.error('Load notices error:', err);
    }
}

function renderAdminNotices(notices) {
    const container = document.getElementById('adminNoticesTable');
    if (!notices.length) {
        container.innerHTML = '<p style="text-align:center;color:#64748b;padding:2rem;">No notices found</p>';
        return;
    }

    let html = `<div class="table-responsive"><table class="modal-table" style="min-width: 1100px;">
        <thead>
            <tr>
                <th style="width:40px;">ID</th>
                <th style="min-width:280px;">Title</th>
                <th style="min-width:160px;">Department</th>
                <th style="width:100px;">Category</th>
                <th style="width:80px;">Priority</th>
                <th style="width:90px;">Status</th>
                <th style="width:100px;">Published</th>
                <th style="width:90px;">Created By</th>
                <th style="min-width:160px;">Actions</th>
            </tr>
        </thead>
        <tbody>`;

    notices.forEach(n => {
        const catColors = {
            'General': '#60a5fa', 'Urgent': '#f87171', 'Circular': '#c084fc',
            'Tender': '#fbbf24', 'Recruitment': '#34d399'
        };
        const priColors = { 'High': '#f87171', 'Medium': '#60a5fa', 'Low': '#34d399' };
        const pubDate = n.publish_date ? new Date(n.publish_date).toLocaleDateString() : '-';

        html += `<tr>
            <td>${n.id}</td>
            <td>
                <div style="line-height:1.4;">
                    <strong style="display:block; margin-bottom:2px;">${n.title}</strong>
                    ${n.title_bn ? `<div style="font-size:0.75rem; color:#94a3b8; line-height:1.3;">${n.title_bn}</div>` : ''}
                </div>
            </td>
            <td><span style="font-size:0.8rem; display:block; line-height:1.3;">${n.department}</span></td>
            <td><span style="padding:2px 8px;border-radius:12px;font-size:0.75rem;white-space:nowrap;background:${catColors[n.category] || '#64748b'}22;color:${catColors[n.category] || '#64748b'};">${n.category}</span></td>
            <td><span style="padding:2px 8px;border-radius:12px;font-size:0.75rem;white-space:nowrap;background:${priColors[n.priority] || '#64748b'}22;color:${priColors[n.priority] || '#64748b'};">${n.priority}</span></td>
            <td>${getStatusBadge(n.status)}</td>
            <td style="white-space:nowrap;">${pubDate}</td>
            <td style="font-size:0.8rem;">${n.created_by_name || '<span style="color:#64748b">N/A</span>'}</td>
            <td>
                <div style="display:flex; gap:6px; flex-wrap:nowrap;">
                    <button class="action-btn approve" onclick="editNotice(${n.id})" style="white-space:nowrap;">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn reject" onclick="deleteNotice(${n.id})" style="white-space:nowrap;">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// =====================
// EDIT NOTICE
// =====================
function editNotice(id) {
    const notice = allAdminNotices.find(n => n.id === id);
    if (!notice) return;

    // Populate edit form fields
    document.getElementById('editNoticeId').value = notice.id;
    document.getElementById('editNoticeTitle').value = notice.title || '';
    document.getElementById('editNoticeTitleBn').value = notice.title_bn || '';
    document.getElementById('editNoticeDepartment').value = notice.department || '';
    document.getElementById('editNoticeCategory').value = notice.category || 'General';
    document.getElementById('editNoticePriority').value = notice.priority || 'Medium';
    document.getElementById('editNoticeRefNo').value = notice.reference_no || '';
    document.getElementById('editNoticeContent').value = notice.content || '';
    document.getElementById('editNoticeStatus').value = notice.status || 'Published';
    document.getElementById('editNoticeAttachment').value = notice.attachment_url || '';

    // handle dates — format as YYYY-MM-DD for date inputs
    if (notice.publish_date) {
        document.getElementById('editNoticePublishDate').value = new Date(notice.publish_date).toISOString().split('T')[0];
    }
    if (notice.expiry_date) {
        document.getElementById('editNoticeExpiryDate').value = new Date(notice.expiry_date).toISOString().split('T')[0];
    } else {
        document.getElementById('editNoticeExpiryDate').value = '';
    }

    // Open the edit modal
    document.getElementById('editNoticeModal').classList.add('active');
}

async function deleteNotice(id) {
    const confirm = await Swal.fire({
        title: 'Delete Notice?',
        text: 'This will permanently remove this notice.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delete',
        confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
        try {
            const res = await fetch(`/api/notices/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false });
                loadNotices();
            } else {
                Swal.fire('Error', data.error || 'Failed to delete', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Network error', 'error');
        }
    }
}

// Add Notice Form Handler
document.addEventListener('DOMContentLoaded', () => {
    // --- Create Notice Form ---
    const noticeForm = document.getElementById('addNoticeForm');
    if (noticeForm) {
        // Set default publish date to today
        document.getElementById('noticePublishDate').valueAsDate = new Date();

        noticeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const payload = {
                title: document.getElementById('noticeTitle').value,
                title_bn: document.getElementById('noticeTitleBn').value || null,
                department: document.getElementById('noticeDepartment').value,
                category: document.getElementById('noticeCategory').value,
                priority: document.getElementById('noticePriority').value,
                content: document.getElementById('noticeContent').value,
                reference_no: document.getElementById('noticeRefNo').value || null,
                publish_date: document.getElementById('noticePublishDate').value,
                expiry_date: document.getElementById('noticeExpiryDate').value || null,
                attachment_url: document.getElementById('noticeAttachment').value || null,
                status: document.getElementById('noticeStatus').value
            };

            try {
                const res = await fetch('/api/notices', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Notice Published!',
                        text: `Notice #${data.noticeId} created successfully.`,
                        timer: 2000,
                        showConfirmButton: false
                    });
                    noticeForm.reset();
                    document.getElementById('noticePublishDate').valueAsDate = new Date();
                    loadNotices();
                } else {
                    Swal.fire('Error', data.error || 'Failed to create notice', 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Network error occurred', 'error');
            }
        });
    }

    // --- Edit Notice Form ---
    const editForm = document.getElementById('editNoticeForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const noticeId = document.getElementById('editNoticeId').value;
            const payload = {
                title: document.getElementById('editNoticeTitle').value,
                title_bn: document.getElementById('editNoticeTitleBn').value || null,
                department: document.getElementById('editNoticeDepartment').value,
                category: document.getElementById('editNoticeCategory').value,
                priority: document.getElementById('editNoticePriority').value,
                content: document.getElementById('editNoticeContent').value,
                reference_no: document.getElementById('editNoticeRefNo').value || null,
                publish_date: document.getElementById('editNoticePublishDate').value,
                expiry_date: document.getElementById('editNoticeExpiryDate').value || null,
                attachment_url: document.getElementById('editNoticeAttachment').value || null,
                status: document.getElementById('editNoticeStatus').value
            };

            try {
                const res = await fetch(`/api/notices/${noticeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Notice Updated!',
                        text: 'The notice has been updated successfully.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    document.getElementById('editNoticeModal').classList.remove('active');
                    loadNotices();
                } else {
                    Swal.fire('Error', data.error || 'Failed to update notice', 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Network error occurred', 'error');
            }
        });
    }
});

// =====================
// AGRICULTURE ADMIN
// =====================

const AGRI_API = '/api/agriculture';

async function fetchAgriAPI(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
}

async function loadAgriculture() {
    try {
        const stats = await fetchAgriAPI(`${AGRI_API}/admin/stats`);
        document.getElementById('admin-agri-subsidies').textContent = stats.subsidies?.total || 0;
        document.getElementById('admin-agri-sub-pending').textContent = stats.subsidies?.pending || 0;
        document.getElementById('admin-agri-queries').textContent = stats.queries?.total || 0;
        document.getElementById('admin-agri-reports').textContent = stats.reports?.total || 0;
        document.getElementById('admin-agri-market').textContent = stats.market?.total || 0;
    } catch (e) { console.error(e); }
    loadAdminQueries();
}

function switchAgriAdminTab(tab) {
    const tabs = ['queries', 'subsidies', 'crops', 'market', 'training', 'views'];
    tabs.forEach(t => {
        const panel = document.getElementById(`agriPanel-${t}`);
        const btn = document.getElementById(`agriSubTab-${t}`);
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
        if (btn) {
            btn.className = t === tab ? 'report-tab active' : 'report-tab';
        }
    });
    if (tab === 'queries') loadAdminQueries();
    if (tab === 'subsidies') loadAdminSubsidies();
    if (tab === 'crops') loadAdminCropSummary();
    if (tab === 'market') loadAdminMarketListings();
    if (tab === 'training') loadAdminTraining();
    if (tab === 'views') loadAdminAgriViews();
}

// --- Expert Q&A ---
async function loadAdminQueries() {
    const container = document.getElementById('adminQueriesList');
    if (!container) return;
    try {
        const data = await fetchAgriAPI(`${AGRI_API}/admin/queries`);
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color: #64748b; text-align: center; padding: 2rem;">No queries found.</p>';
            return;
        }
        container.innerHTML = data.map(q => `
            <div class="query-card">
                <div class="query-header">
                    <span><strong style="color: #6ee7b7;">${q.user_name || 'User #' + q.user_id}</strong></span>
                    <span class="badge-${q.status === 'Replied' ? 'replied' : 'pending'}">${q.status}</span>
                </div>
                <div class="query-question">${q.question}</div>
                <div class="query-meta">
                    ${q.category ? `<span><i class="fas fa-tag" style="color: #f0c040;"></i> ${q.category}</span>` : ''}
                    ${q.crop_name ? `<span><i class="fas fa-leaf" style="color: #6ee7b7;"></i> ${q.crop_name}</span>` : ''}
                    <span><i class="fas fa-calendar"></i> ${formatDate(q.created_at)}</span>
                </div>
                ${q.answer ? `
                    <div class="answer-box"><div class="expert-label"><i class="fas fa-user-check"></i> ${q.answered_by || 'Expert'}</div><p>${q.answer}</p></div>
                ` : `
                    <button class="btn-agri" style="margin-top: 0.8rem;" onclick="answerQuery(${q.id})">
                        <i class="fas fa-reply"></i> Answer
                    </button>
                `}
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p style="color: #ef4444;">Failed to load queries.</p>';
    }
}

async function answerQuery(id) {
    const { value: formValues } = await Swal.fire({
        title: 'Answer Expert Query',
        html: `
            <textarea id="swal-answer" class="swal2-textarea" placeholder="Type your expert reply..." rows="5" style="width:100%;"></textarea>
            <input id="swal-expert-name" class="swal2-input" placeholder="Your name / designation" style="width:100%;">
        `,
        background: '#0b1a0f',
        color: '#fff',
        showCancelButton: true,
        confirmButtonColor: '#2d6a4f',
        confirmButtonText: '<i class="fas fa-paper-plane"></i> Send Reply',
        preConfirm: () => {
            const answer = document.getElementById('swal-answer').value;
            if (!answer.trim()) { Swal.showValidationMessage('Please type your answer.'); return false; }
            return {
                answer,
                answered_by: document.getElementById('swal-expert-name').value || 'Agriculture Officer'
            };
        }
    });

    if (formValues) {
        try {
            await fetchAgriAPI(`${AGRI_API}/admin/answer/${id}`, 'PUT', formValues);
            Swal.fire({ icon: 'success', title: 'Reply Sent!', background: '#0b1a0f', color: '#fff', timer: 1500, showConfirmButton: false });
            loadAdminQueries();
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Failed', background: '#0b1a0f', color: '#fff' });
        }
    }
}

// --- Subsidies ---
async function loadAdminSubsidies() {
    const tbody = document.getElementById('adminSubsidiesBody');
    if (!tbody) return;
    try {
        const data = await fetchAgriAPI(`${AGRI_API}/admin/subsidies`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b; padding:2rem;">No applications.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(s => {
            const isPending = s.status === 'Pending' || s.status === 'Under Review';
            return `
                <tr>
                    <td>#${s.id}</td>
                    <td>${s.farmer_name}<div style="font-size:0.75rem; color:#64748b;">${s.user_name || ''}</div></td>
                    <td>${s.subsidy_type}</td>
                    <td>৳${Number(s.amount_requested).toLocaleString()}</td>
                    <td>${s.district_name || '—'}</td>
                    <td><span class="badge-${s.status === 'Approved' ? 'approved' : s.status === 'Rejected' ? 'rejected' : 'pending'}">${s.status}</span></td>
                    <td>${formatDate(s.created_at)}</td>
                    <td>
                        ${isPending ? `
                            <button class="btn-agri" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="updateSubsidy(${s.id}, 'Approved')"><i class="fas fa-check"></i></button>
                            <button style="background:#ef4444; color:#fff; border:none; padding:0.4rem 0.8rem; border-radius:8px; cursor:pointer; font-size:0.8rem;" onclick="updateSubsidy(${s.id}, 'Rejected')"><i class="fas fa-times"></i></button>
                        ` : '—'}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" style="color:#ef4444; text-align:center;">Failed to load.</td></tr>';
    }
}

async function updateSubsidy(id, status) {
    const { value: remarks } = await Swal.fire({
        title: `${status} Subsidy #${id}?`,
        input: 'textarea',
        inputLabel: 'Admin Remarks (optional)',
        inputPlaceholder: 'Any notes...',
        showCancelButton: true,
        confirmButtonText: status,
        confirmButtonColor: status === 'Approved' ? '#2d6a4f' : '#ef4444',
        background: '#0b1a0f',
        color: '#fff'
    });

    if (remarks !== undefined) {
        try {
            await fetchAgriAPI(`${AGRI_API}/admin/subsidy/${id}`, 'PUT', { status, admin_remarks: remarks });
            Swal.fire({ icon: 'success', title: `${status}!`, timer: 1500, showConfirmButton: false, background: '#0b1a0f', color: '#fff' });
            loadAdminSubsidies();
            loadAgriculture();
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Failed', background: '#0b1a0f', color: '#fff' });
        }
    }
}

// --- Crop Summary ---
async function loadAdminCropSummary() {
    const tbody = document.getElementById('adminCropSummaryBody');
    if (!tbody) return;
    try {
        const data = await fetchAgriAPI(`${AGRI_API}/admin/crop-summary`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b; padding:2rem;">No crop data yet.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(r => `
            <tr>
                <td>${r.division_name || '—'}</td>
                <td>${r.district_name || '—'}</td>
                <td>${r.crop_name}</td>
                <td>${r.season}</td>
                <td>${r.total_reports}</td>
                <td style="font-weight: 700; color: #6ee7b7;">${Number(r.total_yield_mt || 0).toFixed(2)}</td>
                <td>${r.total_land_acres ? Number(r.total_land_acres).toFixed(2) : '—'}</td>
                <td>${r.avg_market_price ? '৳' + Number(r.avg_market_price).toLocaleString() : '—'}</td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" style="color:#ef4444; text-align:center;">Failed to load.</td></tr>';
    }
}

// --- Market Listings ---
async function loadAdminMarketListings() {
    const tbody = document.getElementById('adminMarketBody');
    if (!tbody) return;
    try {
        const data = await fetchAgriAPI(`${AGRI_API}/admin/market-listings`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b; padding:2rem;">No listings.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(m => {
            const isPending = m.status === 'Pending';
            return `
                <tr>
                    <td>#${m.id}</td>
                    <td>${m.farmer_name}<div style="font-size:0.75rem; color:#64748b;">${m.phone}</div></td>
                    <td>${m.product_name}<div style="font-size:0.75rem; color:#64748b;">${m.product_category}</div></td>
                    <td>${m.quantity} ${m.unit}</td>
                    <td>৳${Number(m.price_per_unit).toLocaleString()}</td>
                    <td>${m.district_name || '—'}</td>
                    <td><span class="badge-${m.status === 'Approved' ? 'approved' : m.status === 'Rejected' ? 'rejected' : 'pending'}">${m.status}</span></td>
                    <td>
                        ${isPending ? `
                            <button class="btn-agri" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="updateMarketListing(${m.id}, 'Approved')"><i class="fas fa-check"></i></button>
                            <button style="background:#ef4444; color:#fff; border:none; padding:0.4rem 0.8rem; border-radius:8px; cursor:pointer; font-size:0.8rem;" onclick="updateMarketListing(${m.id}, 'Rejected')"><i class="fas fa-times"></i></button>
                        ` : '—'}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" style="color:#ef4444; text-align:center;">Failed to load.</td></tr>';
    }
}

async function updateMarketListing(id, status) {
    try {
        await fetchAgriAPI(`${AGRI_API}/admin/market/${id}`, 'PUT', { status });
        Swal.fire({ icon: 'success', title: `${status}!`, timer: 1500, showConfirmButton: false, background: '#0b1a0f', color: '#fff' });
        loadAdminMarketListings();
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Failed', background: '#0b1a0f', color: '#fff' });
    }
}

// --- Training ---
async function loadAdminTraining() {
    const tbody = document.getElementById('adminTrainingBody');
    if (!tbody) return;
    try {
        const data = await fetchAgriAPI(`${AGRI_API}/admin/training`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b; padding:2rem;">No training programs.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(t => `
            <tr>
                <td>#${t.id}</td>
                <td>${t.title}</td>
                <td>${t.category}</td>
                <td>${t.location || (t.district_name || '—')}</td>
                <td>${formatDate(t.start_date)} — ${formatDate(t.end_date)}</td>
                <td>${t.capacity}</td>
                <td style="font-weight:700; color: #6ee7b7;">${t.registered_count || 0}</td>
                <td><span class="badge-${t.status === 'Upcoming' ? 'pending' : t.status === 'Ongoing' ? 'approved' : t.status === 'Completed' ? 'replied' : 'rejected'}">${t.status}</span></td>
            </tr>
        `).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" style="color:#ef4444; text-align:center;">Failed to load.</td></tr>';
    }
}

async function showCreateTrainingForm() {
    const { value: formValues } = await Swal.fire({
        title: '📚 Create Training Program',
        html: `
            <div class="swal-form-grid">
                <div class="swal-form-group" style="grid-column: 1/-1;">
                    <label>Title *</label>
                    <input id="tp-title" class="form-control" placeholder="Training program name">
                </div>
                <div class="swal-form-group">
                    <label>Category *</label>
                    <select id="tp-category" class="form-control">
                        <option value="Crop Management">Crop Management</option>
                        <option value="Pest Control">Pest Control</option>
                        <option value="Modern Farming">Modern Farming</option>
                        <option value="Livestock">Livestock</option>
                        <option value="Fishery">Fishery</option>
                        <option value="Organic Farming">Organic Farming</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Technology">Technology</option>
                    </select>
                </div>
                <div class="swal-form-group">
                    <label>Location *</label>
                    <input id="tp-location" class="form-control" placeholder="Where?">
                </div>
                <div class="swal-form-group">
                    <label>Start Date *</label>
                    <input id="tp-start" class="form-control" type="date">
                </div>
                <div class="swal-form-group">
                    <label>End Date *</label>
                    <input id="tp-end" class="form-control" type="date">
                </div>
                <div class="swal-form-group">
                    <label>Capacity</label>
                    <input id="tp-capacity" class="form-control" type="number" value="50">
                </div>
                <div class="swal-form-group">
                    <label>Trainer Name</label>
                    <input id="tp-trainer" class="form-control" placeholder="Trainer name">
                </div>
                <div class="swal-form-group" style="grid-column: 1/-1;">
                    <label>Description</label>
                    <textarea id="tp-desc" class="form-control" placeholder="Describe the program..." rows="3"></textarea>
                </div>
            </div>
        `,
        width: '700px',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        confirmButtonText: '<i class="fas fa-plus"></i> Create Program',
        background: '#0f172a',
        color: '#fff',
        preConfirm: () => {
            const title = document.getElementById('tp-title').value;
            const start_date = document.getElementById('tp-start').value;
            const end_date = document.getElementById('tp-end').value;
            if (!title || !start_date || !end_date) {
                Swal.showValidationMessage('Title and dates required');
                return false;
            }
            return {
                title,
                category: document.getElementById('tp-category').value,
                location: document.getElementById('tp-location').value,
                start_date,
                end_date,
                capacity: document.getElementById('tp-capacity').value || 50,
                trainer_name: document.getElementById('tp-trainer').value || null,
                description: document.getElementById('tp-desc').value || null
            };
        }
    });

    if (formValues) {
        try {
            await fetchAgriAPI(`${AGRI_API}/admin/training`, 'POST', formValues);
            Swal.fire({ icon: 'success', title: 'Program Created!', background: '#0f172a', color: '#fff', timer: 1500, showConfirmButton: false });
            loadAdminTraining();
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Failed', background: '#0f172a', color: '#fff' });
        }
    }
}

// --- Database Views ---
async function loadAdminAgriViews() {
    const emptyRow = (cols) => `<tr><td colspan="${cols}" style="text-align:center; color:#64748b; padding:2rem;">No data available.</td></tr>`;
    const errorRow = (cols) => `<tr><td colspan="${cols}" style="color:#ef4444; text-align:center;">Failed to load view data.</td></tr>`;

    // District Agriculture Summary
    const districtBody = document.getElementById('viewDistrictBody');
    if (districtBody) {
        try {
            const data = await fetchAgriAPI(`${AGRI_API}/admin/views/district-summary`);
            if (!data || data.length === 0) {
                districtBody.innerHTML = emptyRow(14);
            } else {
                const ratingColors = { 'High Yield': '#6ee7b7', 'Medium Yield': '#fbbf24', 'Low Yield': '#f87171', 'No Data': '#64748b' };
                districtBody.innerHTML = data.map(r => `
                    <tr>
                        <td><strong>${r.district_name}</strong></td>
                        <td>${r.division_name}</td>
                        <td style="font-weight:700; color:#60a5fa;">${r.crop_name}</td>
                        <td>${r.season}</td>
                        <td style="font-weight:700;">${r.total_reports}</td>
                        <td style="font-weight:700; color:#6ee7b7;">${Number(r.total_yield_mt).toFixed(2)}</td>
                        <td>${r.total_land_acres ? Number(r.total_land_acres).toFixed(2) : '—'}</td>
                        <td>${r.avg_price_per_ton ? '৳' + Number(r.avg_price_per_ton).toLocaleString() : '—'}</td>
                        <td style="color:#fbbf24;">৳${Number(r.estimated_crop_value).toLocaleString()}</td>
                        <td style="font-size:0.8rem;">${r.irrigation_methods}</td>
                        <td style="font-weight:700;">${r.total_subsidy_apps}</td>
                        <td>৳${Number(r.total_amount_requested).toLocaleString()}</td>
                        <td style="color:#6ee7b7; font-weight:700;">৳${Number(r.total_amount_approved).toLocaleString()}</td>
                        <td><span style="color:${ratingColors[r.productivity_rating] || '#64748b'}; font-weight:600;">${r.productivity_rating}</span></td>
                    </tr>
                `).join('');
            }
        } catch (e) {
            districtBody.innerHTML = errorRow(14);
        }
    }

    // Training Summary
    const trainingBody = document.getElementById('viewTrainingBody');
    if (trainingBody) {
        try {
            const data = await fetchAgriAPI(`${AGRI_API}/admin/views/training-summary`);
            if (!data || data.length === 0) {
                trainingBody.innerHTML = emptyRow(8);
            } else {
                const demandColors = { 'Full': '#f87171', 'Nearly Full': '#fbbf24', 'Open': '#6ee7b7', 'Low Interest': '#64748b' };
                trainingBody.innerHTML = data.map(r => `
                    <tr>
                        <td><strong>${r.program_title}</strong></td>
                        <td>${r.category}</td>
                        <td>${r.location}</td>
                        <td>${formatDate(r.start_date)} — ${formatDate(r.end_date)}</td>
                        <td>${r.trainer_name}</td>
                        <td style="font-weight:700;">${r.total_registered} / ${r.capacity}</td>
                        <td>${r.fill_rate_pct}%</td>
                        <td><span style="color:${demandColors[r.demand_level] || '#64748b'}; font-weight:600;">${r.demand_level}</span></td>
                    </tr>
                `).join('');
            }
        } catch (e) {
            trainingBody.innerHTML = errorRow(8);
        }
    }
}

// =====================
// TAX / NBR ADMIN
// =====================

let currentTaxTab = 'returns';

async function loadTaxAdmin() {
    try {
        const res = await fetch('/api/admin/tax/stats', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.status === 401 || res.status === 403) { adminLogout(); return; }
        const stats = await res.json();

        document.getElementById('admin-tax-tin-total').textContent = stats.tin?.total_tin || 0;
        document.getElementById('admin-tax-tin-pending').textContent = stats.tin?.pending_tin || 0;
        document.getElementById('admin-tax-returns-total').textContent = stats.returns?.total_returns || 0;
        document.getElementById('admin-tax-returns-pending').textContent = stats.returns?.pending_returns || 0;
        document.getElementById('admin-tax-revenue').textContent = '৳' + Number(stats.payments?.verified_revenue || 0).toLocaleString('en-IN');
        document.getElementById('admin-tax-vat-active').textContent = stats.vat?.active_vat || 0;
    } catch (e) { console.error('Tax stats error:', e); }

    loadTaxAdminTab('returns');
}

function loadTaxAdminTab(tab) {
    currentTaxTab = tab;
    // Update tab buttons
    ['returns', 'tin', 'payments', 'notices'].forEach(t => {
        const btn = document.getElementById(`taxTab-${t}`);
        if (btn) btn.style.background = t === tab ? '' : '#334155';
    });

    const container = document.getElementById('taxAdminContent');
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    switch (tab) {
        case 'returns': loadTaxAdminReturns(); break;
        case 'tin': loadTaxAdminTIN(); break;
        case 'payments': loadTaxAdminPayments(); break;
        case 'notices': loadTaxAdminNoticesTab(); break;
    }
}

async function loadTaxAdminReturns() {
    const container = document.getElementById('taxAdminContent');
    try {
        const res = await fetch('/api/admin/tax/returns', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:2rem;">No tax returns found.</p>';
            return;
        }

        container.innerHTML = `
            <h3 style="color:#fff; margin-bottom:1rem;"><i class="fas fa-file-invoice" style="color:#34d399;"></i> Tax Returns</h3>
            <div class="table-responsive"><table class="report-table">
                <thead>
                    <tr>
                        <th>Ref No.</th>
                        <th>Taxpayer</th>
                        <th>Year</th>
                        <th>Total Income</th>
                        <th>Tax Liability</th>
                        <th>Tax Due</th>
                        <th>Status</th>
                        <th>Filed On</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(r => `
                        <tr>
                            <td style="font-family:monospace; color:#60a5fa;">${r.submission_ref}</td>
                            <td>${r.user_name || 'User #' + r.user_id}</td>
                            <td>${r.assessment_year}</td>
                            <td>৳${Number(r.total_income).toLocaleString('en-IN')}</td>
                            <td>৳${Number(r.net_tax_liability).toLocaleString('en-IN')}</td>
                            <td style="color:${r.tax_due > 0 ? '#f87171' : '#34d399'};">৳${Number(r.tax_due).toLocaleString('en-IN')}</td>
                            <td>${getStatusBadge(r.status)}</td>
                            <td>${formatDate(r.created_at)}</td>
                            <td class="action-cell">
                                ${r.status === 'Submitted' || r.status === 'Under Review' ? `
                                    <button class="action-btn approve" onclick="updateTaxReturn(${r.id}, 'Accepted')"><i class="fas fa-check"></i></button>
                                    <button class="action-btn reject" onclick="updateTaxReturn(${r.id}, 'Rejected')"><i class="fas fa-times"></i></button>
                                ` : '—'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table></div>`;
    } catch (e) {
        container.innerHTML = '<p style="color:#ef4444;text-align:center;">Failed to load returns.</p>';
    }
}

async function updateTaxReturn(id, status) {
    const { value: remarks } = await Swal.fire({
        title: `${status} Return #${id}?`,
        input: 'textarea',
        inputLabel: 'Remarks (optional)',
        showCancelButton: true,
        confirmButtonText: status,
        confirmButtonColor: status === 'Accepted' ? '#10b981' : '#ef4444'
    });

    if (remarks !== undefined) {
        try {
            const res = await fetch(`/api/admin/tax/returns/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                body: JSON.stringify({ status, remarks })
            });
            if (res.ok) {
                Swal.fire({ icon: 'success', title: `${status}!`, timer: 1500, showConfirmButton: false });
                loadTaxAdminReturns();
                loadTaxAdmin();
            }
        } catch (e) { Swal.fire('Error', 'Failed to update.', 'error'); }
    }
}

async function loadTaxAdminTIN() {
    const container = document.getElementById('taxAdminContent');
    try {
        const res = await fetch('/api/admin/tax/tin-applications', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:2rem;">No TIN applications found.</p>';
            return;
        }

        container.innerHTML = `
            <h3 style="color:#fff; margin-bottom:1rem;"><i class="fas fa-id-card" style="color:#34d399;"></i> TIN Applications</h3>
            <div class="table-responsive"><table class="report-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>NID</th>
                        <th>Type</th>
                        <th>Source</th>
                        <th>Mobile</th>
                        <th>TIN</th>
                        <th>Status</th>
                        <th>Applied</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(t => `
                        <tr>
                            <td>#${t.id}</td>
                            <td><strong>${t.taxpayer_name}</strong><div style="font-size:0.75rem; color:#64748b;">${t.user_name || ''}</div></td>
                            <td>${t.nid_number || '—'}</td>
                            <td>${t.taxpayer_type}</td>
                            <td>${t.source_of_income || '—'}</td>
                            <td>${t.mobile || '—'}</td>
                            <td style="font-family:monospace; color:#34d399;">${t.tin_number || '—'}</td>
                            <td>${getStatusBadge(t.status)}</td>
                            <td>${formatDate(t.created_at)}</td>
                            <td class="action-cell">
                                ${t.status === 'Pending' ? `
                                    <button class="action-btn approve" onclick="approveTIN(${t.id})"><i class="fas fa-check"></i></button>
                                    <button class="action-btn reject" onclick="rejectTIN(${t.id})"><i class="fas fa-times"></i></button>
                                ` : '—'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table></div>`;
    } catch (e) {
        container.innerHTML = '<p style="color:#ef4444;text-align:center;">Failed to load TIN applications.</p>';
    }
}

async function approveTIN(id) {
    const confirm = await Swal.fire({
        title: 'Approve TIN Application?',
        text: 'A 12-digit TIN number will be generated automatically.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Approve',
        confirmButtonColor: '#10b981'
    });

    if (confirm.isConfirmed) {
        try {
            const res = await fetch(`/api/admin/tax/tin/${id}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                body: JSON.stringify({ action: 'approve' })
            });
            const result = await res.json();
            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'Approved!', text: `TIN: ${result.tin_number}`, timer: 3000, showConfirmButton: true });
                loadTaxAdminTIN();
                loadTaxAdmin();
            } else {
                Swal.fire('Error', result.error, 'error');
            }
        } catch (e) { Swal.fire('Error', 'Failed', 'error'); }
    }
}

async function rejectTIN(id) {
    const { value: remarks } = await Swal.fire({
        title: 'Reject TIN Application?',
        input: 'textarea',
        inputLabel: 'Reason for rejection',
        inputPlaceholder: 'Enter reason...',
        showCancelButton: true,
        confirmButtonText: 'Reject',
        confirmButtonColor: '#ef4444'
    });

    if (remarks !== undefined) {
        try {
            const res = await fetch(`/api/admin/tax/tin/${id}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                body: JSON.stringify({ action: 'reject', remarks })
            });
            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'Rejected', timer: 1500, showConfirmButton: false });
                loadTaxAdminTIN();
                loadTaxAdmin();
            }
        } catch (e) { Swal.fire('Error', 'Failed', 'error'); }
    }
}

async function loadTaxAdminPayments() {
    const container = document.getElementById('taxAdminContent');
    try {
        const res = await fetch('/api/admin/tax/payments', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:2rem;">No payments found.</p>';
            return;
        }

        container.innerHTML = `
            <h3 style="color:#fff; margin-bottom:1rem;"><i class="fas fa-money-bill-wave" style="color:#34d399;"></i> Tax Payments</h3>
            <div class="table-responsive"><table class="report-table">
                <thead>
                    <tr>
                        <th>Receipt No.</th>
                        <th>Taxpayer</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Transaction ID</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(p => `
                        <tr>
                            <td style="font-family:monospace;">${p.receipt_no || '—'}</td>
                            <td>${p.user_name || 'User #' + p.user_id}</td>
                            <td>${p.payment_type}</td>
                            <td style="font-weight:600; color:#34d399;">৳${Number(p.amount).toLocaleString('en-IN')}</td>
                            <td>${p.payment_method}</td>
                            <td>${p.transaction_id || '—'}</td>
                            <td>${getStatusBadge(p.status)}</td>
                            <td>${formatDate(p.payment_date)}</td>
                            <td class="action-cell">
                                ${p.status === 'Pending' ? `
                                    <button class="action-btn approve" onclick="verifyPayment(${p.id}, 'Verified')"><i class="fas fa-check"></i></button>
                                    <button class="action-btn reject" onclick="verifyPayment(${p.id}, 'Failed')"><i class="fas fa-times"></i></button>
                                ` : '—'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table></div>`;
    } catch (e) {
        container.innerHTML = '<p style="color:#ef4444;text-align:center;">Failed to load payments.</p>';
    }
}

async function verifyPayment(id, status) {
    try {
        const res = await fetch(`/api/admin/tax/payments/${id}/verify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            Swal.fire({ icon: 'success', title: `Payment ${status}!`, timer: 1500, showConfirmButton: false });
            loadTaxAdminPayments();
            loadTaxAdmin();
        }
    } catch (e) { Swal.fire('Error', 'Failed', 'error'); }
}

async function loadTaxAdminNoticesTab() {
    const container = document.getElementById('taxAdminContent');
    container.innerHTML = `
        <h3 style="color:#fff; margin-bottom:1rem;"><i class="fas fa-bell" style="color:#34d399;"></i> Issue Tax Notice</h3>
        <form id="taxNoticeForm" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:2rem;">
            <div class="form-group">
                <label>User ID <span style="color:#f87171;">*</span></label>
                <input type="number" id="tn-user-id" class="form-control" placeholder="Target user ID" required>
            </div>
            <div class="form-group">
                <label>Notice Type</label>
                <select id="tn-type" class="form-control">
                    <option value="Tax Due">Tax Due</option>
                    <option value="Assessment">Assessment</option>
                    <option value="Audit">Audit</option>
                    <option value="Penalty">Penalty</option>
                    <option value="Reminder">Reminder</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group" style="grid-column:1/-1;">
                <label>Subject <span style="color:#f87171;">*</span></label>
                <input type="text" id="tn-subject" class="form-control" placeholder="Notice subject" required>
            </div>
            <div class="form-group" style="grid-column:1/-1;">
                <label>Message <span style="color:#f87171;">*</span></label>
                <textarea id="tn-message" class="form-control" rows="4" placeholder="Notice details..." required></textarea>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="tn-priority" class="form-control">
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                </select>
            </div>
            <div class="form-group">
                <label>Due Date</label>
                <input type="date" id="tn-due-date" class="form-control">
            </div>
            <div style="grid-column:1/-1;">
                <button type="submit" class="btn-primary" style="background:linear-gradient(135deg, #10b981, #059669);"><i class="fas fa-paper-plane"></i> Issue Notice</button>
            </div>
        </form>
        <div id="taxNoticesListAdmin"><div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div></div>
    `;

    // Bind form
    document.getElementById('taxNoticeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            user_id: document.getElementById('tn-user-id').value,
            notice_type: document.getElementById('tn-type').value,
            subject: document.getElementById('tn-subject').value,
            message: document.getElementById('tn-message').value,
            priority: document.getElementById('tn-priority').value,
            due_date: document.getElementById('tn-due-date').value || null
        };

        try {
            const res = await fetch('/api/admin/tax/notices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'Notice Issued!', timer: 1500, showConfirmButton: false });
                e.target.reset();
                loadTaxNoticesList();
            } else {
                Swal.fire('Error', result.error, 'error');
            }
        } catch (err) { Swal.fire('Error', 'Network error', 'error'); }
    });

    loadTaxNoticesList();
}

async function loadTaxNoticesList() {
    const container = document.getElementById('taxNoticesListAdmin');
    if (!container) return;
    try {
        const res = await fetch('/api/admin/tax/notices', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:2rem;">No notices issued yet.</p>';
            return;
        }

        container.innerHTML = `
            <h4 style="color:#94a3b8; margin-bottom:1rem;">Issued Notices</h4>
            <div class="table-responsive"><table class="report-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Type</th>
                        <th>Subject</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Due Date</th>
                        <th>Issued</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(n => `
                        <tr>
                            <td>#${n.id}</td>
                            <td>${n.user_name || 'User #' + n.user_id}</td>
                            <td><span style="padding:2px 8px;border-radius:12px;font-size:0.75rem;background:rgba(139,92,246,0.1);color:#a78bfa;">${n.notice_type}</span></td>
                            <td>${n.subject}</td>
                            <td><span style="padding:2px 8px;border-radius:12px;font-size:0.75rem;background:${n.priority === 'Urgent' ? 'rgba(239,68,68,0.1);color:#f87171' : n.priority === 'High' ? 'rgba(245,158,11,0.1);color:#fbbf24' : 'rgba(100,116,139,0.1);color:#94a3b8'};">${n.priority}</span></td>
                            <td>${getStatusBadge(n.status)}</td>
                            <td>${n.due_date ? formatDate(n.due_date) : '—'}</td>
                            <td>${formatDate(n.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table></div>`;
    } catch (e) {
        container.innerHTML = '<p style="color:#ef4444;text-align:center;">Failed to load notices.</p>';
    }
}

// =====================
// INITIALIZATION
// =====================

document.addEventListener('DOMContentLoaded', () => {
    loadOverview();
});
