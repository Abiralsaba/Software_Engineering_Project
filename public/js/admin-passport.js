/**
 * Admin Passport Panel — JavaScript
 * Manages passport applications: view, filter, update status & dates
 */

const AdminPassport = {
    API: '/api/passport',
    token: localStorage.getItem('adminToken'),
    applications: [],
    currentAppId: null,

    // ===================== INIT =====================
    init() {
        if (!this.token) {
            Swal.fire({
                icon: 'warning',
                title: 'Not Authenticated',
                text: 'Please login as admin first.',
                background: '#0f172a',
                color: '#fff',
                confirmButtonColor: '#1a5276'
            }).then(() => {
                window.location.href = 'index.html#admin';
            });
            return;
        }
        this.loadStats();
        this.loadApplications();
        this.loadOffices();
        this.bindEvents();
    },

    // ===================== EVENTS =====================
    bindEvents() {
        // Filter on enter
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

        // Status change → show/hide date field & rejection field
        const statusSelect = document.getElementById('updateStatus');
        if (statusSelect) {
            statusSelect.addEventListener('change', () => this.onStatusChange());
        }
    },

    // ===================== API HELPERS =====================
    async fetchAPI(url) {
        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.status === 401 || res.status === 403) {
                this.handleAuthError();
                return null;
            }
            return await res.json();
        } catch (e) {
            console.error('Fetch error:', e);
            return null;
        }
    },

    async putAPI(url, body) {
        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(body)
            });
            if (res.status === 401 || res.status === 403) {
                this.handleAuthError();
                return null;
            }
            return await res.json();
        } catch (e) {
            console.error('PUT error:', e);
            return null;
        }
    },

    handleAuthError() {
        Swal.fire({
            icon: 'error',
            title: 'Session Expired',
            text: 'Your admin session has expired. Please login again.',
            background: '#0f172a',
            color: '#fff',
            confirmButtonColor: '#1a5276'
        }).then(() => {
            localStorage.removeItem('adminToken');
            window.location.href = 'index.html#admin';
        });
    },

    // ===================== LOAD STATS =====================
    async loadStats() {
        const data = await this.fetchAPI(`${this.API}/admin/stats`);
        if (!data) return;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setVal('statTotal', data.total || 0);
        setVal('statPending', data.pending || 0);
        setVal('statProcessing', data.processing || 0);
        setVal('statDelivered', data.delivered || 0);
        setVal('statRejected', data.rejected || 0);
        setVal('statRevenue', '৳ ' + this.formatMoney(data.revenue || 0));
        setVal('statToday', data.today || 0);
    },

    // ===================== LOAD OFFICES (for filter) =====================
    async loadOffices() {
        const data = await this.fetchAPI(`${this.API}/offices`);
        const select = document.getElementById('filterOffice');
        if (!data || !select) return;

        data.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.office_code;
            opt.textContent = o.office_name;
            select.appendChild(opt);
        });
    },

    // ===================== LOAD APPLICATIONS =====================
    async loadApplications(filters = {}) {
        const container = document.getElementById('applicationsTableBody');
        const countEl = document.getElementById('appCount');

        if (container) container.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:3rem;"><div class="pp-loading"><div class="pp-spinner"></div></div></td></tr>`;

        let url = `${this.API}/admin/applications?`;
        const params = new URLSearchParams();
        if (filters.status) params.set('status', filters.status);
        if (filters.office) params.set('office', filters.office);
        if (filters.date_from) params.set('date_from', filters.date_from);
        if (filters.date_to) params.set('date_to', filters.date_to);
        if (filters.search) params.set('search', filters.search);
        url += params.toString();

        const data = await this.fetchAPI(url);
        if (!data) {
            if (container) container.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:2rem; color:#64748b;">Failed to load applications.</td></tr>`;
            return;
        }

        this.applications = data;
        if (countEl) countEl.textContent = `${data.length} application${data.length !== 1 ? 's' : ''} found`;

        if (!data.length) {
            container.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:3rem; color:#64748b;">
                <i class="fas fa-folder-open" style="font-size:2rem; display:block; margin-bottom:0.5rem; opacity:0.3;"></i>
                No applications found matching your criteria.
            </td></tr>`;
            return;
        }

        container.innerHTML = data.map(app => `
            <tr onclick="AdminPassport.viewApplication(${app.id})">
                <td class="app-number">${app.application_number || '-'}</td>
                <td>
                    <span class="applicant-name">${app.full_name_en || app.user_name || '-'}</span>
                    <br><span class="applicant-email">${app.user_email || ''}</span>
                </td>
                <td>${app.nid_number || '-'}</td>
                <td>${app.passport_type || '-'}</td>
                <td><span class="badge-${this.statusClass(app.status)}">${app.status}</span></td>
                <td>${app.office_name || '-'}</td>
                <td>${this.formatDate(app.submitted_at)}</td>
                <td><span class="badge-${app.payment_status === 'Paid' ? 'paid' : 'unpaid'}">${app.payment_status || 'Unpaid'}</span></td>
                <td>
                    <div class="admin-actions" onclick="event.stopPropagation()">
                        <button class="btn-admin-view" onclick="AdminPassport.viewApplication(${app.id})" title="View Details">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn-admin-update" onclick="AdminPassport.openUpdateModal(${app.id}, '${app.status}')" title="Update Status">
                            <i class="fas fa-pen"></i> Update
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // ===================== APPLY FILTERS =====================
    applyFilters() {
        const filters = {
            status: document.getElementById('filterStatus')?.value || '',
            office: document.getElementById('filterOffice')?.value || '',
            date_from: document.getElementById('filterDateFrom')?.value || '',
            date_to: document.getElementById('filterDateTo')?.value || '',
            search: document.getElementById('filterSearch')?.value.trim() || ''
        };
        this.loadApplications(filters);
    },

    clearFilters() {
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterOffice').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        document.getElementById('filterSearch').value = '';
        this.loadApplications();
    },

    // ===================== VIEW APPLICATION DETAIL =====================
    async viewApplication(id) {
        this.currentAppId = id;
        const overlay = document.getElementById('detailModalOverlay');
        const body = document.getElementById('modalBody');

        if (!overlay || !body) return;

        body.innerHTML = '<div class="pp-loading" style="padding:3rem;"><div class="pp-spinner"></div></div>';
        overlay.classList.add('active');

        const data = await this.fetchAPI(`${this.API}/admin/application/${id}`);
        if (!data || !data.application) {
            body.innerHTML = '<p style="color:#f87171; text-align:center; padding:2rem;">Failed to load application details.</p>';
            return;
        }

        const app = data.application;
        const history = data.status_history || [];

        // Update modal header
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) modalTitle.textContent = `Application: ${app.application_number}`;

        body.innerHTML = `
            <!-- Current Status Banner -->
            <div style="text-align: center; margin-bottom: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 14px; border: 1px solid rgba(255,255,255,0.06);">
                <span class="badge-${this.statusClass(app.status)}" style="font-size: 1rem; padding: 0.5rem 1.5rem;">${app.status}</span>
                <p style="color: #94a3b8; font-size: 0.82rem; margin-top: 0.5rem;">Last updated: ${this.formatDateTime(app.updated_at)}</p>
            </div>

            <!-- Detail Grid -->
            <div class="detail-grid">
                <!-- Personal Info -->
                <div class="detail-section">
                    <h4><i class="fas fa-user"></i> Applicant Information</h4>
                    <div class="detail-row"><span class="label">Name (EN)</span><span class="value">${app.full_name_en || '-'}</span></div>
                    <div class="detail-row"><span class="label">Name (BN)</span><span class="value">${app.full_name_bn || '-'}</span></div>
                    <div class="detail-row"><span class="label">Father</span><span class="value">${app.father_name_en || '-'}</span></div>
                    <div class="detail-row"><span class="label">Mother</span><span class="value">${app.mother_name_en || '-'}</span></div>
                    <div class="detail-row"><span class="label">DOB</span><span class="value">${this.formatDate(app.date_of_birth)}</span></div>
                    <div class="detail-row"><span class="label">Gender</span><span class="value">${app.gender || '-'}</span></div>
                    <div class="detail-row"><span class="label">NID</span><span class="value">${app.nid_number || '-'}</span></div>
                    <div class="detail-row"><span class="label">Mobile</span><span class="value">${app.mobile_number || '-'}</span></div>
                    <div class="detail-row"><span class="label">Email</span><span class="value">${app.email || '-'}</span></div>
                </div>

                <!-- Service Info -->
                <div class="detail-section">
                    <h4><i class="fas fa-passport"></i> Service Details</h4>
                    <div class="detail-row"><span class="label">Service Type</span><span class="value">${app.service_type || '-'}</span></div>
                    <div class="detail-row"><span class="label">Passport Type</span><span class="value">${app.passport_type || '-'}</span></div>
                    <div class="detail-row"><span class="label">Pages</span><span class="value">${app.page_count || '-'}</span></div>
                    <div class="detail-row"><span class="label">Validity</span><span class="value">${app.validity_years ? app.validity_years + ' Years' : '-'}</span></div>
                    <div class="detail-row"><span class="label">Delivery</span><span class="value">${app.delivery_type || '-'}</span></div>
                    <div class="detail-row"><span class="label">Office</span><span class="value">${app.office_name || '-'}</span></div>
                    <div class="detail-row"><span class="label">Fee</span><span class="value" style="color: var(--pp-gold-light);">৳ ${this.formatMoney(app.total_fee)}</span></div>
                    <div class="detail-row"><span class="label">Payment</span><span class="value"><span class="badge-${app.payment_status === 'Paid' ? 'paid' : 'unpaid'}">${app.payment_status || 'Unpaid'}</span></span></div>
                    <div class="detail-row"><span class="label">Submitted</span><span class="value">${this.formatDateTime(app.submitted_at)}</span></div>
                </div>

                <!-- Address Info -->
                <div class="detail-section">
                    <h4><i class="fas fa-map-marker-alt"></i> Address</h4>
                    <div class="detail-row"><span class="label">Present</span><span class="value">${[app.present_village_road, app.present_post_office, app.present_upazila, app.present_district, app.present_division].filter(Boolean).join(', ') || '-'}</span></div>
                    <div class="detail-row"><span class="label">Permanent</span><span class="value">${[app.permanent_village_road, app.permanent_post_office, app.permanent_upazila, app.permanent_district, app.permanent_division].filter(Boolean).join(', ') || '-'}</span></div>
                </div>

                <!-- Timeline / Dates -->
                <div class="detail-section">
                    <h4><i class="fas fa-calendar-alt"></i> Key Dates</h4>
                    <div class="detail-row"><span class="label">Applied</span><span class="value">${this.formatDateTime(app.submitted_at)}</span></div>
                    <div class="detail-row"><span class="label">Biometric</span><span class="value">${this.formatDateTime(app.biometric_date)}</span></div>
                    <div class="detail-row"><span class="label">Police Verification</span><span class="value">${this.formatDateTime(app.police_verification_date)}</span></div>
                    <div class="detail-row"><span class="label">Approved</span><span class="value">${this.formatDateTime(app.approved_at)}</span></div>
                    <div class="detail-row"><span class="label">Printed</span><span class="value">${this.formatDateTime(app.printed_at)}</span></div>
                    <div class="detail-row"><span class="label">Dispatched</span><span class="value">${this.formatDateTime(app.dispatched_at)}</span></div>
                    <div class="detail-row"><span class="label">Delivered</span><span class="value">${this.formatDateTime(app.delivered_at)}</span></div>
                    ${app.passport_number ? `<div class="detail-row"><span class="label">Passport No.</span><span class="value" style="color: var(--pp-green-light); font-weight:700;">${app.passport_number}</span></div>` : ''}
                </div>
            </div>

            <!-- Status History -->
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 1.2rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--pp-gold-light); font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-clock-rotate-left"></i> Status History
                </h4>
                ${history.length ? `
                    <div class="admin-timeline">
                        ${history.map((h, i) => `
                            <div class="admin-timeline-item">
                                <div class="dot ${i === history.length - 1 ? 'latest' : ''}"></div>
                                <div class="tl-status">${h.old_status} → <strong>${h.new_status}</strong></div>
                                <div class="tl-meta">${this.formatDateTime(h.created_at)} · By: ${h.changed_by || 'System'}</div>
                                ${h.remarks ? `<div class="tl-remark">"${h.remarks}"</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : '<p style="color: #64748b; font-size: 0.85rem; text-align: center; padding: 1rem;">No status history recorded yet.</p>'}
            </div>

            <!-- Update Status Form -->
            <div class="admin-update-form">
                <h4><i class="fas fa-pen-to-square"></i> Update Application Status</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>New Status</label>
                        <select id="updateStatus" onchange="AdminPassport.onStatusChange()">
                            ${this.getStatusOptions(app.status)}
                        </select>
                    </div>
                    <div class="form-group" id="dateFieldGroup" style="display:none;">
                        <label id="dateFieldLabel">Date</label>
                        <input type="datetime-local" id="updateDate">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group full-width rejection-group" id="rejectionGroup">
                        <label>Rejection Reason</label>
                        <textarea id="updateRejectionReason" placeholder="Explain why the application is being rejected..."></textarea>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group full-width">
                        <label>Remarks / Notes</label>
                        <textarea id="updateRemarks" placeholder="Add optional admin remarks..."></textarea>
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn-pp-outline" onclick="AdminPassport.closeModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn-pp-gold" onclick="AdminPassport.updateStatus(${app.id})">
                        <i class="fas fa-check"></i> Update Status
                    </button>
                </div>
            </div>
        `;

        // Trigger status change to show/hide fields
        this.onStatusChange();
    },

    // ===================== STATUS OPTIONS =====================
    getStatusOptions(currentStatus) {
        const allStatuses = [
            'Submitted',
            'Payment Verified',
            'Under Review',
            'Biometric Scheduled',
            'Biometric Enrolled',
            'Police Verification',
            'Police Verification Completed',
            'Approved',
            'Printing',
            'Dispatched',
            'Ready for Delivery',
            'Delivered',
            'Rejected',
            'On Hold',
            'Cancelled'
        ];

        return allStatuses.map(s =>
            `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`
        ).join('');
    },

    // ===================== ON STATUS CHANGE =====================
    onStatusChange() {
        const status = document.getElementById('updateStatus')?.value;
        const dateGroup = document.getElementById('dateFieldGroup');
        const dateLabel = document.getElementById('dateFieldLabel');
        const dateInput = document.getElementById('updateDate');
        const rejGroup = document.getElementById('rejectionGroup');

        // Show/hide rejection reason
        if (rejGroup) {
            if (status === 'Rejected') {
                rejGroup.classList.add('visible');
            } else {
                rejGroup.classList.remove('visible');
            }
        }

        // show/hide date field based on status
        const dateMap = {
            'Biometric Scheduled': 'Biometric Date',
            'Biometric Enrolled': 'Biometric Date',
            'Police Verification': 'Police Verification Date',
            'Police Verification Completed': 'Police Verification Date',
            'Approved': 'Approval Date',
            'Printing': 'Print Date',
            'Dispatched': 'Dispatch Date',
            'Delivered': 'Delivery Date'
        };

        if (dateGroup && dateLabel && dateInput) {
            if (dateMap[status]) {
                dateGroup.style.display = 'flex';
                dateLabel.textContent = dateMap[status];
                // Default to current datetime
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                dateInput.value = now.toISOString().slice(0, 16);
            } else {
                dateGroup.style.display = 'none';
                dateInput.value = '';
            }
        }
    },

    // ===================== UPDATE STATUS =====================
    async updateStatus(id) {
        const status = document.getElementById('updateStatus')?.value;
        const remarks = document.getElementById('updateRemarks')?.value.trim();
        const rejectionReason = document.getElementById('updateRejectionReason')?.value.trim();
        const dateValue = document.getElementById('updateDate')?.value;

        if (!status) {
            Swal.fire({ icon: 'warning', title: 'Select Status', text: 'Please select a status.', background: '#0f172a', color: '#fff' });
            return;
        }

        // Confirm
        const confirm = await Swal.fire({
            title: 'Confirm Status Update',
            html: `<p style="color:#94a3b8;">Update status to <strong style="color:#f4d03f;">${status}</strong>?</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#d4ac0d',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Yes, Update',
            background: '#0f172a',
            color: '#fff'
        });

        if (!confirm.isConfirmed) return;

        // Build payload
        const payload = { status };
        if (remarks) payload.remarks = remarks;
        if (rejectionReason && status === 'Rejected') payload.rejection_reason = rejectionReason;

        // Add custom date based on status
        if (dateValue) {
            const dateFieldMap = {
                'Biometric Scheduled': 'biometric_date',
                'Biometric Enrolled': 'biometric_date',
                'Police Verification': 'police_verification_date',
                'Police Verification Completed': 'police_verification_date',
                'Approved': 'approved_at',
                'Printing': 'printed_at',
                'Dispatched': 'dispatched_at',
                'Delivered': 'delivered_at'
            };
            const field = dateFieldMap[status];
            if (field) payload[field] = dateValue;
        }

        const result = await this.putAPI(`${this.API}/admin/application/${id}/status`, payload);

        if (!result) return;

        if (result.error) {
            Swal.fire({ icon: 'error', title: 'Update Failed', text: result.error, background: '#0f172a', color: '#fff' });
            return;
        }

        Swal.fire({
            icon: 'success',
            title: 'Status Updated!',
            text: result.message || `Status changed to "${status}".`,
            background: '#0f172a',
            color: '#fff',
            confirmButtonColor: '#1a5276'
        });

        // Refresh
        this.closeModal();
        this.loadStats();
        this.applyFilters();
    },

    // ===================== OPEN UPDATE MODAL (quick) =====================
    openUpdateModal(id, currentStatus) {
        this.viewApplication(id);
    },

    // ===================== MODAL CLOSE =====================
    closeModal() {
        const overlay = document.getElementById('detailModalOverlay');
        if (overlay) overlay.classList.remove('active');
        this.currentAppId = null;
    },

    // ===================== UTILITY HELPERS =====================
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
            ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    },

    formatMoney(amount) {
        if (!amount) return '0.00';
        return parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    statusClass(status) {
        const map = {
            'Submitted': 'submitted',
            'Payment Verified': 'payment-verified',
            'Under Review': 'under-review',
            'Biometric Scheduled': 'biometric-scheduled',
            'Biometric Enrolled': 'biometric-enrolled',
            'Biometric Completed': 'biometric-completed',
            'Police Verification': 'police-verification',
            'Police Verification Completed': 'police-verification-completed',
            'Approved': 'approved',
            'Printing': 'printing',
            'Dispatched': 'dispatched',
            'Ready for Delivery': 'ready-for-delivery',
            'Delivered': 'delivered',
            'Rejected': 'rejected',
            'On Hold': 'on-hold',
            'Cancelled': 'cancelled',
            'Pending': 'submitted'
        };
        return map[status] || 'submitted';
    },

    // ===================== LOGOUT =====================
    logout() {
        Swal.fire({
            title: 'Logout?',
            text: 'Are you sure you want to logout?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Yes, Logout',
            background: '#0f172a',
            color: '#fff'
        }).then(result => {
            if (result.isConfirmed) {
                localStorage.removeItem('adminToken');
                window.location.href = 'index.html#admin';
            }
        });
    }
};

// ===================== BOOT =====================
document.addEventListener('DOMContentLoaded', () => {
    AdminPassport.init();
});
