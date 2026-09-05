/**
 * Admin NID Panel — JavaScript
 */

const AdminNID = {
    API: '/api/nid/admin',
    token: null,
    applications: [],
    currentApp: null,

    // Status options per table type 
    STATUS_MAP: {
        'nid_applications': ['Draft', 'Submitted', 'Under Review', 'Biometric Pending', 'Verified', 'Approved', 'Rejected', 'Card Printing', 'Ready for Collection', 'Delivered'],
        'nid_correction_requests': ['Draft', 'Submitted', 'Under Review', 'Document Verification', 'Approved', 'Rejected', 'Completed'],
        'nid_reissue_requests': ['Draft', 'Submitted', 'Payment Pending', 'Under Review', 'Verified', 'Card Printing', 'Ready for Collection', 'Delivered', 'Rejected'],
        'nid_address_changes': ['Draft', 'Submitted', 'Under Review', 'Verified', 'Updated', 'Rejected'],
        'nid_smart_card_applications': ['Draft', 'Submitted', 'Payment Pending', 'Biometric Appointment', 'Biometric Done', 'Card Production', 'Quality Check', 'Ready for Collection', 'Delivered', 'Rejected']
    },

    // ===================== INIT =====================
    init() {
        const t = localStorage.getItem('adminToken') || localStorage.getItem('token');
        if (!t) {
            Swal.fire({
                icon: 'warning',
                title: 'Not Authenticated',
                text: 'Please login as admin first.',
                background: '#0f172a',
                color: '#fff',
                confirmButtonColor: '#1a5276'
            }).then(() => {
                window.location.href = 'admin-login.html';
            });
            return;
        }
        this.token = t;
        this.loadStats();
        this.loadApplications();
        this.bindEvents();
    },

    bindEvents() {
        const searchInput = document.getElementById('filterSearch');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.applyFilters();
            });
        }

        // Close modal on overlay click
        const overlay = document.getElementById('detailModalOverlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeModal();
            });
        }

        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    },

    // ===================== API CALLS =====================
    async fetchAPI(endpoint) {
        try {
            const res = await fetch(`${this.API}${endpoint}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.status === 401 || res.status === 403) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Authentication Error',
                    text: 'Your session may have expired. Please login again.',
                    background: '#0f172a',
                    color: '#fff'
                });
                return null;
            }
            if (!res.ok) throw new Error(res.statusText);
            return await res.json();
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    },

    async postAPI(endpoint, body) {
        try {
            const res = await fetch(`${this.API}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(body)
            });
            return await res.json();
        } catch (error) {
            console.error('API Error:', error);
            return { error: 'Network error' };
        }
    },

    // ===================== STATS =====================
    async loadStats() {
        const stats = await this.fetchAPI('/stats');
        if (stats) {
            this.setStat('statTotal', stats.total);
            this.setStat('statPending', stats.pending);
            this.setStat('statProcessing', stats.processing);
            this.setStat('statApproved', stats.approved);
            this.setStat('statRejected', stats.rejected);
            this.setStat('statCorrections', stats.corrections);
        }
    },

    setStat(id, val) {
        const el = document.getElementById(id);
        if (el) el.innerText = (val !== undefined && val !== null) ? val : 0;
    },

    // ===================== APPLICATIONS =====================
    async loadApplications() {
        const apps = await this.fetchAPI('/applications');
        if (apps && Array.isArray(apps)) {
            this.applications = apps;
            this.renderTable(apps);
        } else {
            document.getElementById('appTableBody').innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #f87171;">Failed to load applications. Check server connection.</td></tr>`;
        }
    },

    renderTable(data) {
        const tbody = document.getElementById('appTableBody');
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #94a3b8;">No applications found.</td></tr>`;
            return;
        }

        data.forEach(app => {
            // Name priority: name_en > name_bn > user_name (from reg_info JOIN) > N/A
            const name = app.name_en || app.name_bn || app.user_name || 'N/A';
            const date = app.created_at ? new Date(app.created_at).toLocaleDateString() : '-';

            let statusClass = 'status-pending';
            const s = (app.status || '').toLowerCase();
            if (['approved', 'completed', 'delivered', 'ready for collection', 'updated'].includes(s)) statusClass = 'status-approved';
            else if (['verified', 'under review', 'document verification', 'biometric pending', 'card printing'].includes(s)) statusClass = 'status-verified';
            else if (s === 'rejected') statusClass = 'status-rejected';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span style="font-family: monospace; color: var(--nid-accent);">${app.ref_no || app.id}</span></td>
                <td>${app.type}</td>
                <td>${date}</td>
                <td>${name}</td>
                <td><span class="status-badge ${statusClass}">${app.status}</span></td>
                <td>
                    <button class="action-btn" onclick="AdminNID.viewDetails('${app.ref_no}', '${app.source_table}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    applyFilters() {
        const type = document.getElementById('filterType').value;
        const status = document.getElementById('filterStatus').value;
        const search = document.getElementById('filterSearch').value.toLowerCase();

        const filtered = this.applications.filter(app => {
            const matchesType = !type || app.type === type;
            const matchesStatus = !status || app.status === status;
            const name = (app.name_en || app.name_bn || app.user_name || '').toLowerCase();
            const ref = (app.ref_no || '').toLowerCase();
            const matchesSearch = !search || name.includes(search) || ref.includes(search);

            return matchesType && matchesStatus && matchesSearch;
        });

        this.renderTable(filtered);
    },

    // ===================== DETAILS & ACTIONS =====================
    async viewDetails(refNo, sourceTable) {
        const details = await this.fetchAPI(`/application/${refNo}?table=${sourceTable}`);

        if (!details) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Could not fetch application details', background: '#0f172a', color: '#fff' });
            return;
        }

        this.currentApp = { ...details, sourceTable };
        this.renderModal(details, sourceTable);

        document.getElementById('detailModalOverlay').classList.add('active');
    },

    renderModal(data, table) {
        const content = document.getElementById('modalContent');
        const updateStatus = document.getElementById('updateStatus');
        const adminRemarks = document.getElementById('adminRemarks');

        // Populate status dropdown with correct ENUM values for THIS table type
        const statuses = this.STATUS_MAP[table] || ['Submitted', 'Under Review', 'Approved', 'Rejected'];
        updateStatus.innerHTML = statuses.map(s => `<option value="${s}" ${s === data.status ? 'selected' : ''}>${s}</option>`).join('');

        adminRemarks.value = data.admin_remarks || data.rejection_reason || '';

        // Build detail HTML
        let html = '<div class="detail-grid">';

        // Reference & Status
        html += this.detailItem('Reference No', data.application_no || data.request_no || data.id);
        html += this.detailItem('Current Status', data.status);

        // Name — from application fields or reg_info JOIN
        html += this.detailItem('Name (English)', data.name_en);
        html += this.detailItem('Name (Bangla)', data.name_bn);
        html += this.detailItem('Registered Name', data.user_name);

        // Contact
        html += this.detailItem('Mobile', data.mobile || data.user_mobile);
        html += this.detailItem('Email', data.email || data.user_email);
        html += this.detailItem('User NID', data.nid_number || data.user_nid);

        // Dates
        html += this.detailItem('Date of Birth', data.date_of_birth ? new Date(data.date_of_birth).toLocaleDateString() : null);
        html += this.detailItem('Submitted', data.created_at ? new Date(data.created_at).toLocaleString() : null);

        // Application-specific
        html += this.detailItem('Gender', data.gender);
        html += this.detailItem('Father (EN)', data.father_name_en);
        html += this.detailItem('Mother (EN)', data.mother_name_en);
        html += this.detailItem('Occupation', data.occupation);
        html += this.detailItem('Blood Group', data.blood_group);

        // Correction-specific
        html += this.detailItem('Correction Category', data.correction_category);
        html += this.detailItem('Current Value', data.current_value);
        html += this.detailItem('Corrected Value', data.corrected_value);

        // Reissue-specific
        html += this.detailItem('Reason', data.reason);
        html += this.detailItem('Reason Details', data.reason_details);
        html += this.detailItem('GD Number', data.gd_number);
        html += this.detailItem('Police Station', data.police_station);
        html += this.detailItem('Delivery Type', data.delivery_type);
        html += this.detailItem('Fee Amount', data.fee_amount ? `৳${data.fee_amount}` : null);
        html += this.detailItem('Fee Paid', data.fee_paid === 1 ? 'Yes ✅' : (data.fee_paid === 0 ? 'No ❌' : null));

        // Rejection info
        html += this.detailItem('Rejection Reason', data.rejection_reason);

        html += '</div>';

        // Photo if present
        if (data.photo_url) {
            html += `<h3 style="margin-top: 1.5rem; color: var(--nid-accent);">Attachments</h3><div class="detail-grid">`;
            html += `<div class="detail-item"><span class="detail-label">Photo</span><img src="${data.photo_url}" class="photo-preview" onerror="this.style.display='none'"></div>`;
            if (data.signature_url) html += `<div class="detail-item"><span class="detail-label">Signature</span><img src="${data.signature_url}" class="photo-preview" onerror="this.style.display='none'"></div>`;
            html += '</div>';
        }

        content.innerHTML = html;
    },

    detailItem(label, value) {
        if (value === null || value === undefined || value === '') return '';
        return `
            <div class="detail-item">
                <span class="detail-label">${label}</span>
                <span class="detail-value">${value}</span>
            </div>
        `;
    },

    closeModal() {
        document.getElementById('detailModalOverlay').classList.remove('active');
        this.currentApp = null;
    },

    // ===================== UPDATE STATUS =====================
    async submitStatusUpdate() {
        if (!this.currentApp) return;

        const newStatus = document.getElementById('updateStatus').value;
        const remarks = document.getElementById('adminRemarks').value;
        const refNo = this.currentApp.application_no || this.currentApp.request_no || this.currentApp.id;

        const result = await Swal.fire({
            title: 'Update Status?',
            html: `Change status of <b>${refNo}</b> to <b>${newStatus}</b>?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, Update',
            background: '#0f172a',
            color: '#fff'
        });

        if (result.isConfirmed) {
            const res = await this.postAPI('/update-status', {
                refNo: refNo,
                sourceTable: this.currentApp.sourceTable,
                status: newStatus,
                remarks: remarks
            });

            if (res && res.success) {
                Swal.fire({ icon: 'success', title: 'Updated!', text: res.message || 'Status updated.', background: '#0f172a', color: '#fff', confirmButtonColor: '#10b981' });
                this.closeModal();
                this.loadApplications();
                this.loadStats();
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: (res && res.error) ? res.error : 'Failed to update status', background: '#0f172a', color: '#fff' });
            }
        }
    },

    logout() {
        localStorage.removeItem('adminToken');
        window.location.href = 'admin-login.html';
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => {
    AdminNID.init();
});
