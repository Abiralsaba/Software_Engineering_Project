/* ============================================
   Admin Water Resources Panel - JavaScript
   পানি সম্পদ প্রশাসন | Water Administration
   ============================================ */

const AdminWater = {
    API: '/api/water/admin',
    token: localStorage.getItem('adminToken'),
    currentTab: 'dashboard',

    /* ======================== INIT ======================== */
    init() {
        if (!this.token) {
            window.location.href = 'index.html#admin';
            return;
        }
        this.loadStats();
    },

    /* ======================== AUTH HELPERS ======================== */
    async fetchAPI(endpoint) {
        try {
            const res = await fetch(`${this.API}${endpoint}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.status === 401 || res.status === 403) {
                this.handleAuthError();
                return null;
            }
            return res.json();
        } catch (err) {
            console.error('fetchAPI error:', err);
            return null;
        }
    },

    async putAPI(endpoint, body) {
        try {
            const res = await fetch(`${this.API}${endpoint}`, {
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
            return res.json();
        } catch (err) {
            console.error('putAPI error:', err);
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
            if (res.status === 401 || res.status === 403) {
                this.handleAuthError();
                return null;
            }
            return res.json();
        } catch (err) {
            console.error('postAPI error:', err);
            return null;
        }
    },

    async deleteAPI(endpoint) {
        try {
            const res = await fetch(`${this.API}${endpoint}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.status === 401 || res.status === 403) {
                this.handleAuthError();
                return null;
            }
            return res.json();
        } catch (err) {
            console.error('deleteAPI error:', err);
            return null;
        }
    },

    handleAuthError() {
        Swal.fire('Session Expired', 'Please login again.', 'warning').then(() => {
            localStorage.removeItem('adminToken');
            window.location.href = 'index.html#admin';
        });
    },

    /* ======================== TAB NAVIGATION ======================== */
    showTab(tab) {
        document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

        const tabEl = document.getElementById(`tab-${tab}`);
        if (tabEl) tabEl.style.display = 'block';

        const navEl = document.getElementById(`nav-${tab}`);
        if (navEl) navEl.classList.add('active');

        this.currentTab = tab;

        switch (tab) {
            case 'dashboard': this.loadStats(); break;
            case 'connections': this.loadConnections(); break;
            case 'bills': this.loadBills(); break;
            case 'quality': this.loadQuality(); break;
            case 'complaints': this.loadComplaints(); break;
            case 'projects': this.loadProjects(); break;
        }
    },

    /* ======================== DASHBOARD STATS ======================== */
    async loadStats() {
        try {
            const data = await this.fetchAPI('/stats');
            if (!data || !data.stats) return;
            const s = data.stats;

            document.getElementById('adm-total-conn').textContent = s.total_connections || 0;
            document.getElementById('adm-pending-conn').textContent = s.pending_connections || 0;
            document.getElementById('adm-active-conn').textContent = s.active_connections || 0;
            document.getElementById('adm-total-bills').textContent = s.total_bills || 0;
            document.getElementById('adm-paid-bills').textContent = s.paid_bills || 0;
            document.getElementById('adm-revenue').textContent = Number(s.total_revenue || 0).toLocaleString();
            document.getElementById('adm-total-complaints').textContent = s.total_complaints || 0;
            document.getElementById('adm-open-complaints').textContent = s.open_complaints || 0;
            document.getElementById('adm-total-quality').textContent = s.total_quality || 0;
            document.getElementById('adm-critical-quality').textContent = s.critical_quality || 0;
            document.getElementById('adm-total-projects').textContent = s.total_projects || 0;
            document.getElementById('adm-ongoing-projects').textContent = s.ongoing_projects || 0;
        } catch (err) {
            console.error('Stats load error:', err);
        }
    },

    /* ======================== CONNECTIONS ======================== */
    async loadConnections() {
        const tbody = document.getElementById('adminConnBody');
        tbody.innerHTML = '<tr><td colspan="8" class="water-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const status = document.getElementById('conn-filter-status').value;
            const search = document.getElementById('conn-filter-search').value;
            let params = new URLSearchParams();
            if (status) params.append('status', status);
            if (search) params.append('search', search);

            const data = await this.fetchAPI(`/connections?${params.toString()}`);
            if (!data) return;

            const rows = data.connections || [];
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data-td"><i class="fas fa-faucet-drip"></i>No connections found</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(c => `
                <tr>
                    <td style="font-weight:600;color:#7dd3fc;">${this.esc(c.connection_number || 'N/A')}</td>
                    <td>${this.esc(c.holder_name || '-')}</td>
                    <td>${this.esc(c.connection_type || '-')}</td>
                    <td>${this.esc(c.wasa_region || '-')}</td>
                    <td>${this.esc(c.district || '-')}</td>
                    <td><span class="badge ${this.badgeClass(c.status)}">${this.esc(c.status)}</span></td>
                    <td>${this.fmtDate(c.created_at)}</td>
                    <td>
                        <button class="btn-action btn-action-view" onclick="AdminWater.viewConnection(${c.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn-action btn-action-update" onclick="AdminWater.updateConnectionModal(${c.id}, '${this.esc(c.status)}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Connections error:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="no-data-td">Error loading data</td></tr>';
        }
    },

    async viewConnection(id) {
        const data = await this.fetchAPI(`/connections/${id}`);
        if (!data || !data.connection) return;
        const c = data.connection;

        document.getElementById('modalTitle').textContent = 'Connection Details';
        document.getElementById('modalBody').innerHTML = `
            <div class="detail-grid">
                <div class="detail-section-title"><i class="fas fa-faucet-drip"></i> Connection Info</div>
                <div class="detail-row"><span class="detail-label">Connection No.</span><span class="detail-value" style="color:#7dd3fc;font-weight:700;">${this.esc(c.connection_number || 'N/A')}</span></div>
                <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge ${this.badgeClass(c.status)}">${this.esc(c.status)}</span></span></div>
                <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${this.esc(c.connection_type || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Pipe Size</span><span class="detail-value">${this.esc(c.pipe_size || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Region</span><span class="detail-value">${this.esc(c.wasa_region || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Monthly Rate</span><span class="detail-value">৳${c.monthly_rate || 0}</span></div>
                <div class="detail-section-title"><i class="fas fa-user"></i> Holder Info</div>
                <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${this.esc(c.holder_name || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">NID</span><span class="detail-value">${this.esc(c.nid_number || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${this.esc(c.phone || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">User (System)</span><span class="detail-value">${this.esc(c.user_name || '-')} (${this.esc(c.user_email || '-')})</span></div>
                <div class="detail-section-title"><i class="fas fa-map-marker-alt"></i> Address</div>
                <div class="detail-row"><span class="detail-label">Division</span><span class="detail-value">${this.esc(c.division || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">District</span><span class="detail-value">${this.esc(c.district || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Upazila</span><span class="detail-value">${this.esc(c.upazila || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Ward</span><span class="detail-value">${this.esc(c.ward_no || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Full Address</span><span class="detail-value">${this.esc(c.address || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Applied</span><span class="detail-value">${this.fmtDate(c.created_at)}</span></div>
                <div class="detail-row"><span class="detail-label">Approved</span><span class="detail-value">${this.fmtDate(c.approved_date)}</span></div>
                ${c.admin_remarks ? `<div class="detail-row full-width"><span class="detail-label">Admin Remarks</span><span class="detail-value">${this.esc(c.admin_remarks)}</span></div>` : ''}
            </div>
        `;
        this.openModal();
    },

    updateConnectionModal(id, currentStatus) {
        document.getElementById('modalTitle').textContent = 'Update Connection';
        const statuses = ['Pending', 'Approved', 'Active', 'Rejected', 'Suspended', 'Disconnected'];
        document.getElementById('modalBody').innerHTML = `
            <div class="status-update-section">
                <h3><i class="fas fa-edit"></i> Update Connection Status</h3>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Status</label>
                <select id="updateStatus">
                    ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Monthly Rate (৳)</label>
                <input type="number" id="updateRate" step="0.01" placeholder="0.00">
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Admin Remarks</label>
                <textarea id="updateRemarks" rows="3" placeholder="Enter admin remarks..."></textarea>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="AdminWater.closeModal()">Cancel</button>
                    <button class="btn-water" onclick="AdminWater.updateConnection(${id})"><i class="fas fa-save"></i> Update</button>
                </div>
            </div>
        `;
        this.openModal();
    },

    async updateConnection(id) {
        const status = document.getElementById('updateStatus').value;
        const monthly_rate = document.getElementById('updateRate').value || 0;
        const admin_remarks = document.getElementById('updateRemarks').value;
        const data = await this.putAPI(`/connections/${id}`, { status, monthly_rate, admin_remarks });
        if (data && data.success) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadConnections();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update', 'error');
        }
    },

    /* ======================== BILLS ======================== */
    async loadBills() {
        const tbody = document.getElementById('adminBillBody');
        tbody.innerHTML = '<tr><td colspan="8" class="water-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const status = document.getElementById('bill-filter-status').value;
            const search = document.getElementById('bill-filter-search').value;
            let params = new URLSearchParams();
            if (status) params.append('status', status);
            if (search) params.append('search', search);

            const data = await this.fetchAPI(`/bills?${params.toString()}`);
            if (!data) return;

            const rows = data.bills || [];
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data-td"><i class="fas fa-file-invoice-dollar"></i>No bills found</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(b => `
                <tr>
                    <td>#${b.id}</td>
                    <td>${this.esc(b.user_name || '-')}</td>
                    <td style="font-weight:600;color:#7dd3fc;">${this.esc(b.connection_number || '-')}</td>
                    <td>${this.esc(b.billing_month || '-')}</td>
                    <td>৳${parseFloat(b.total_amount || 0).toLocaleString()}</td>
                    <td>${this.esc(b.payment_method || '-')}</td>
                    <td><span class="badge ${this.badgeClass(b.status)}">${this.esc(b.status)}</span></td>
                    <td>
                        <button class="btn-action btn-action-view" onclick="AdminWater.viewBill(${b.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn-action btn-action-update" onclick="AdminWater.updateBillModal(${b.id}, '${this.esc(b.status)}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Bills error:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="no-data-td">Error loading data</td></tr>';
        }
    },

    async viewBill(id) {
        const data = await this.fetchAPI(`/bills/${id}`);
        if (!data || !data.bill) return;
        const b = data.bill;

        document.getElementById('modalTitle').textContent = 'Bill Payment Details';
        document.getElementById('modalBody').innerHTML = `
            <div class="detail-grid">
                <div class="detail-section-title"><i class="fas fa-file-invoice-dollar"></i> Bill Info</div>
                <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">#${b.id}</span></div>
                <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge ${this.badgeClass(b.status)}">${this.esc(b.status)}</span></span></div>
                <div class="detail-row"><span class="detail-label">Connection No.</span><span class="detail-value" style="color:#7dd3fc;">${this.esc(b.connection_number || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Billing Month</span><span class="detail-value">${this.esc(b.billing_month || '-')}</span></div>
                <div class="detail-section-title"><i class="fas fa-tachometer-alt"></i> Meter Readings</div>
                <div class="detail-row"><span class="detail-label">Previous</span><span class="detail-value">${b.meter_reading_prev || 0}</span></div>
                <div class="detail-row"><span class="detail-label">Current</span><span class="detail-value">${b.meter_reading_current || 0}</span></div>
                <div class="detail-row"><span class="detail-label">Units Consumed</span><span class="detail-value">${b.units_consumed || 0}</span></div>
                <div class="detail-section-title"><i class="fas fa-money-bill-wave"></i> Payment</div>
                <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">৳${parseFloat(b.amount || 0).toLocaleString()}</span></div>
                <div class="detail-row"><span class="detail-label">Surcharge</span><span class="detail-value">৳${parseFloat(b.surcharge || 0).toLocaleString()}</span></div>
                <div class="detail-row"><span class="detail-label">Total</span><span class="detail-value" style="font-weight:700;color:#34d399;">৳${parseFloat(b.total_amount || 0).toLocaleString()}</span></div>
                <div class="detail-row"><span class="detail-label">Method</span><span class="detail-value">${this.esc(b.payment_method || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Transaction ID</span><span class="detail-value">${this.esc(b.transaction_id || 'N/A')}</span></div>
                <div class="detail-row"><span class="detail-label">Paid</span><span class="detail-value">${this.fmtDate(b.paid_date)}</span></div>
                <div class="detail-section-title"><i class="fas fa-user"></i> User</div>
                <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${this.esc(b.user_name || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Submitted</span><span class="detail-value">${this.fmtDate(b.created_at)}</span></div>
                ${b.admin_remarks ? `<div class="detail-row full-width"><span class="detail-label">Admin Remarks</span><span class="detail-value">${this.esc(b.admin_remarks)}</span></div>` : ''}
            </div>
        `;
        this.openModal();
    },

    updateBillModal(id, currentStatus) {
        document.getElementById('modalTitle').textContent = 'Update Bill Status';
        const statuses = ['Pending', 'Paid', 'Overdue', 'Failed'];
        document.getElementById('modalBody').innerHTML = `
            <div class="status-update-section">
                <h3><i class="fas fa-edit"></i> Change Status</h3>
                <select id="updateStatus">
                    ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Admin Remarks</label>
                <textarea id="updateRemarks" rows="3" placeholder="Enter admin remarks..."></textarea>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="AdminWater.closeModal()">Cancel</button>
                    <button class="btn-water" onclick="AdminWater.updateBill(${id})"><i class="fas fa-save"></i> Update</button>
                </div>
            </div>
        `;
        this.openModal();
    },

    async updateBill(id) {
        const status = document.getElementById('updateStatus').value;
        const admin_remarks = document.getElementById('updateRemarks').value;
        const data = await this.putAPI(`/bills/${id}`, { status, admin_remarks });
        if (data && data.success) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadBills();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update', 'error');
        }
    },

    /* ======================== WATER QUALITY ======================== */
    async loadQuality() {
        const tbody = document.getElementById('adminQualBody');
        tbody.innerHTML = '<tr><td colspan="8" class="water-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const status = document.getElementById('qual-filter-status').value;
            const severity = document.getElementById('qual-filter-severity').value;
            const search = document.getElementById('qual-filter-search').value;
            let params = new URLSearchParams();
            if (status) params.append('status', status);
            if (severity) params.append('severity', severity);
            if (search) params.append('search', search);

            const data = await this.fetchAPI(`/quality?${params.toString()}`);
            if (!data) return;

            const rows = data.reports || [];
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data-td"><i class="fas fa-flask"></i>No quality reports found</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(q => `
                <tr>
                    <td>#${q.id}</td>
                    <td>${this.esc(q.user_name || '-')}</td>
                    <td>${this.esc(q.source_type || '-')}</td>
                    <td>${this.esc(q.issue_type || '-')}</td>
                    <td><span class="severity-${(q.severity || '').toLowerCase()}">${this.esc(q.severity)}</span></td>
                    <td>${this.esc(q.district || '-')}</td>
                    <td><span class="badge ${this.badgeClass(q.status)}">${this.esc(q.status)}</span></td>
                    <td>
                        <button class="btn-action btn-action-view" onclick="AdminWater.viewQuality(${q.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn-action btn-action-update" onclick="AdminWater.updateQualityModal(${q.id}, '${this.esc(q.status)}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Quality error:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="no-data-td">Error loading data</td></tr>';
        }
    },

    async viewQuality(id) {
        const data = await this.fetchAPI(`/quality/${id}`);
        if (!data || !data.report) return;
        const q = data.report;

        document.getElementById('modalTitle').textContent = 'Water Quality Report Details';
        document.getElementById('modalBody').innerHTML = `
            <div class="detail-grid">
                <div class="detail-section-title"><i class="fas fa-flask"></i> Report Info</div>
                <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">#${q.id}</span></div>
                <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge ${this.badgeClass(q.status)}">${this.esc(q.status)}</span></span></div>
                <div class="detail-row"><span class="detail-label">Source</span><span class="detail-value">${this.esc(q.source_type || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Issue</span><span class="detail-value">${this.esc(q.issue_type || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Severity</span><span class="detail-value"><span class="severity-${(q.severity || '').toLowerCase()}">${this.esc(q.severity)}</span></span></div>
                <div class="detail-row"><span class="detail-label">Affected People</span><span class="detail-value">${q.affected_people || 0}</span></div>
                <div class="detail-section-title"><i class="fas fa-map-marker-alt"></i> Location</div>
                <div class="detail-row"><span class="detail-label">Division</span><span class="detail-value">${this.esc(q.division || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">District</span><span class="detail-value">${this.esc(q.district || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Upazila</span><span class="detail-value">${this.esc(q.upazila || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Location Details</span><span class="detail-value">${this.esc(q.location_details || '-')}</span></div>
                <div class="detail-section-title"><i class="fas fa-user"></i> Reporter</div>
                <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${this.esc(q.user_name || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Description</span><span class="detail-value">${this.esc(q.description || '-')}</span></div>
                ${q.test_result ? `<div class="detail-row full-width"><span class="detail-label">Test Result</span><span class="detail-value">${this.esc(q.test_result)}</span></div>` : ''}
                ${q.admin_remarks ? `<div class="detail-row full-width"><span class="detail-label">Admin Remarks</span><span class="detail-value">${this.esc(q.admin_remarks)}</span></div>` : ''}
                <div class="detail-row"><span class="detail-label">Reported</span><span class="detail-value">${this.fmtDate(q.created_at)}</span></div>
            </div>
        `;
        this.openModal();
    },

    updateQualityModal(id, currentStatus) {
        document.getElementById('modalTitle').textContent = 'Update Quality Report';
        const statuses = ['Reported', 'Under Investigation', 'Testing', 'Action Taken', 'Resolved', 'Closed'];
        document.getElementById('modalBody').innerHTML = `
            <div class="status-update-section">
                <h3><i class="fas fa-edit"></i> Update Quality Report</h3>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Status</label>
                <select id="updateStatus">
                    ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Test Result</label>
                <textarea id="updateTestResult" rows="3" placeholder="Enter test result details..."></textarea>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Admin Remarks</label>
                <textarea id="updateRemarks" rows="3" placeholder="Enter admin remarks..."></textarea>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="AdminWater.closeModal()">Cancel</button>
                    <button class="btn-water" onclick="AdminWater.updateQuality(${id})"><i class="fas fa-save"></i> Update</button>
                </div>
            </div>
        `;
        this.openModal();
    },

    async updateQuality(id) {
        const status = document.getElementById('updateStatus').value;
        const test_result = document.getElementById('updateTestResult').value;
        const admin_remarks = document.getElementById('updateRemarks').value;
        const data = await this.putAPI(`/quality/${id}`, { status, test_result, admin_remarks });
        if (data && data.success) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadQuality();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update', 'error');
        }
    },

    /* ======================== COMPLAINTS ======================== */
    async loadComplaints() {
        const tbody = document.getElementById('adminCompBody');
        tbody.innerHTML = '<tr><td colspan="8" class="water-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const status = document.getElementById('wcomp-filter-status').value;
            const priority = document.getElementById('wcomp-filter-priority').value;
            const search = document.getElementById('wcomp-filter-search').value;
            let params = new URLSearchParams();
            if (status) params.append('status', status);
            if (priority) params.append('priority', priority);
            if (search) params.append('search', search);

            const data = await this.fetchAPI(`/complaints?${params.toString()}`);
            if (!data) return;

            const rows = data.complaints || [];
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data-td"><i class="fas fa-exclamation-triangle"></i>No complaints found</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(c => `
                <tr>
                    <td>#${c.id}</td>
                    <td>${this.esc(c.user_name || '-')}</td>
                    <td>${this.esc(c.complaint_type || '-')}</td>
                    <td><span class="priority-${(c.priority || '').toLowerCase()}">${this.esc(c.priority)}</span></td>
                    <td>${this.esc(c.district || '-')}</td>
                    <td><span class="badge ${this.badgeClass(c.status)}">${this.esc(c.status)}</span></td>
                    <td>${this.fmtDate(c.created_at)}</td>
                    <td>
                        <button class="btn-action btn-action-view" onclick="AdminWater.viewComplaint(${c.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn-action btn-action-update" onclick="AdminWater.updateComplaintModal(${c.id}, '${this.esc(c.status)}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Complaints error:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="no-data-td">Error loading data</td></tr>';
        }
    },

    async viewComplaint(id) {
        const data = await this.fetchAPI(`/complaints/${id}`);
        if (!data || !data.complaint) return;
        const c = data.complaint;

        document.getElementById('modalTitle').textContent = 'Complaint Details';
        document.getElementById('modalBody').innerHTML = `
            <div class="detail-grid">
                <div class="detail-section-title"><i class="fas fa-exclamation-triangle"></i> Complaint Info</div>
                <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">#${c.id}</span></div>
                <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge ${this.badgeClass(c.status)}">${this.esc(c.status)}</span></span></div>
                <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${this.esc(c.complaint_type || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Priority</span><span class="detail-value"><span class="priority-${(c.priority || '').toLowerCase()}">${this.esc(c.priority)}</span></span></div>
                <div class="detail-section-title"><i class="fas fa-map-marker-alt"></i> Location</div>
                <div class="detail-row"><span class="detail-label">Division</span><span class="detail-value">${this.esc(c.division || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">District</span><span class="detail-value">${this.esc(c.district || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Upazila</span><span class="detail-value">${this.esc(c.upazila || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Address</span><span class="detail-value">${this.esc(c.address || '-')}</span></div>
                <div class="detail-section-title"><i class="fas fa-user"></i> Complainant</div>
                <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${this.esc(c.user_name || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${this.esc(c.contact_phone || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Description</span><span class="detail-value">${this.esc(c.description || '-')}</span></div>
                ${c.assigned_to ? `<div class="detail-row"><span class="detail-label">Assigned To</span><span class="detail-value">${this.esc(c.assigned_to)}</span></div>` : ''}
                ${c.resolution ? `<div class="detail-row full-width"><span class="detail-label">Resolution</span><span class="detail-value">${this.esc(c.resolution)}</span></div>` : ''}
                ${c.admin_remarks ? `<div class="detail-row full-width"><span class="detail-label">Admin Remarks</span><span class="detail-value">${this.esc(c.admin_remarks)}</span></div>` : ''}
                <div class="detail-row"><span class="detail-label">Filed</span><span class="detail-value">${this.fmtDate(c.created_at)}</span></div>
                ${c.resolved_date ? `<div class="detail-row"><span class="detail-label">Resolved</span><span class="detail-value">${this.fmtDate(c.resolved_date)}</span></div>` : ''}
            </div>
        `;
        this.openModal();
    },

    updateComplaintModal(id, currentStatus) {
        document.getElementById('modalTitle').textContent = 'Update Complaint';
        const statuses = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
        document.getElementById('modalBody').innerHTML = `
            <div class="status-update-section">
                <h3><i class="fas fa-edit"></i> Update Complaint</h3>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Status</label>
                <select id="updateStatus">
                    ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Assigned To</label>
                <input type="text" id="updateAssigned" placeholder="Engineer / Team name...">
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Resolution</label>
                <textarea id="updateResolution" rows="3" placeholder="Resolution details..."></textarea>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Admin Remarks</label>
                <textarea id="updateRemarks" rows="2" placeholder="Admin remarks..."></textarea>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="AdminWater.closeModal()">Cancel</button>
                    <button class="btn-water" onclick="AdminWater.updateComplaint(${id})"><i class="fas fa-save"></i> Update</button>
                </div>
            </div>
        `;
        this.openModal();
    },

    async updateComplaint(id) {
        const status = document.getElementById('updateStatus').value;
        const assigned_to = document.getElementById('updateAssigned').value;
        const resolution = document.getElementById('updateResolution').value;
        const admin_remarks = document.getElementById('updateRemarks').value;
        const data = await this.putAPI(`/complaints/${id}`, { status, assigned_to, resolution, admin_remarks });
        if (data && data.success) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadComplaints();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update', 'error');
        }
    },

    /* ======================== PROJECTS ======================== */
    async loadProjects() {
        const tbody = document.getElementById('adminProjBody');
        tbody.innerHTML = '<tr><td colspan="8" class="water-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const data = await this.fetchAPI('/projects');
            if (!data) return;

            const rows = data.projects || [];
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data-td"><i class="fas fa-project-diagram"></i>No projects found</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(p => `
                <tr>
                    <td>${this.esc(p.project_name)}</td>
                    <td>${this.esc(p.project_type || '-')}</td>
                    <td>${this.esc(p.division || '-')}</td>
                    <td>৳${p.budget_crore || 0}</td>
                    <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:4px;height:6px;overflow:hidden;">
                                <div style="width:${p.progress_percent || 0}%;height:100%;background:linear-gradient(90deg,#0369a1,#0ea5e9);border-radius:4px;"></div>
                            </div>
                            <span style="font-size:0.75rem;color:#94a3b8;">${p.progress_percent || 0}%</span>
                        </div>
                    </td>
                    <td><span class="badge ${this.badgeClass(p.status)}">${this.esc(p.status)}</span></td>
                    <td><span class="badge ${p.is_active ? 'badge-active' : 'badge-inactive'}">${p.is_active ? 'Yes' : 'No'}</span></td>
                    <td>
                        <button class="btn-action btn-action-edit" onclick="AdminWater.editProjectModal(${p.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-action btn-action-delete" onclick="AdminWater.deleteProject(${p.id}, '${this.esc(p.project_name)}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Projects error:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="no-data-td">Error loading data</td></tr>';
        }
    },

    showAddProjectForm() {
        document.getElementById('modalTitle').textContent = 'Add New Water Project';
        document.getElementById('modalBody').innerHTML = this.projectFormHTML();
        this.openModal();
    },

    async editProjectModal(id) {
        const data = await this.fetchAPI(`/projects/${id}`);
        if (!data || !data.project) return;
        document.getElementById('modalTitle').textContent = 'Edit Water Project';
        document.getElementById('modalBody').innerHTML = this.projectFormHTML(data.project);
        this.openModal();
    },

    projectFormHTML(p = {}) {
        const isEdit = !!p.id;
        return `
            <form id="projectForm" onsubmit="event.preventDefault(); AdminWater.${isEdit ? `saveProject(${p.id})` : 'addProject()'}">
                <div class="project-form-group">
                    <label>Project Name (English) *</label>
                    <input type="text" id="projName" value="${this.esc(p.project_name || '')}" required>
                </div>
                <div class="project-form-group">
                    <label>Project Name (Bangla)</label>
                    <input type="text" id="projNameBn" value="${this.esc(p.project_name_bn || '')}">
                </div>
                <div class="project-form-row">
                    <div class="project-form-group">
                        <label>Project Type *</label>
                        <select id="projType" required>
                            ${['Flood Control','Irrigation','Drainage','River Dredging','Embankment','Water Treatment Plant','Pipeline Extension','Sewerage','Desalination','Water Supply','Other'].map(t => 
                                `<option value="${t}" ${p.project_type === t ? 'selected' : ''}>${t}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="project-form-group">
                        <label>Implementing Agency</label>
                        <input type="text" id="projAgency" value="${this.esc(p.implementing_agency || '')}" placeholder="BWDB, WASA, DPHE...">
                    </div>
                </div>
                <div class="project-form-row">
                    <div class="project-form-group">
                        <label>Division *</label>
                        <input type="text" id="projDivision" value="${this.esc(p.division || '')}" required>
                    </div>
                    <div class="project-form-group">
                        <label>District</label>
                        <input type="text" id="projDistrict" value="${this.esc(p.district || '')}">
                    </div>
                </div>
                <div class="project-form-row">
                    <div class="project-form-group">
                        <label>Budget (Crore ৳)</label>
                        <input type="number" id="projBudget" step="0.01" value="${p.budget_crore || ''}">
                    </div>
                    <div class="project-form-group">
                        <label>Beneficiaries</label>
                        <input type="number" id="projBeneficiaries" value="${p.beneficiaries || ''}">
                    </div>
                </div>
                <div class="project-form-row">
                    <div class="project-form-group">
                        <label>Start Date</label>
                        <input type="date" id="projStart" value="${p.start_date ? p.start_date.split('T')[0] : ''}">
                    </div>
                    <div class="project-form-group">
                        <label>Expected Completion</label>
                        <input type="date" id="projEnd" value="${p.expected_completion ? p.expected_completion.split('T')[0] : ''}">
                    </div>
                </div>
                <div class="project-form-row">
                    <div class="project-form-group">
                        <label>Progress (%)</label>
                        <input type="number" id="projProgress" min="0" max="100" value="${p.progress_percent || 0}">
                    </div>
                    <div class="project-form-group">
                        <label>Status</label>
                        <select id="projStatus">
                            ${['Planned','Ongoing','Completed','Suspended','Cancelled'].map(s => 
                                `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                ${isEdit ? `
                <div class="project-form-group">
                    <label>Active</label>
                    <select id="projActive">
                        <option value="1" ${p.is_active !== 0 ? 'selected' : ''}>Active</option>
                        <option value="0" ${p.is_active === 0 ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>` : ''}
                <div class="project-form-group">
                    <label>Description</label>
                    <textarea id="projDesc" rows="3" placeholder="Project description...">${this.esc(p.description || '')}</textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="AdminWater.closeModal()">Cancel</button>
                    <button type="submit" class="btn-water"><i class="fas fa-save"></i> ${isEdit ? 'Save Changes' : 'Add Project'}</button>
                </div>
            </form>
        `;
    },

    getProjectFormData() {
        return {
            project_name: document.getElementById('projName').value,
            project_name_bn: document.getElementById('projNameBn').value || null,
            project_type: document.getElementById('projType').value,
            implementing_agency: document.getElementById('projAgency').value || null,
            division: document.getElementById('projDivision').value,
            district: document.getElementById('projDistrict').value || null,
            budget_crore: document.getElementById('projBudget').value || 0,
            beneficiaries: document.getElementById('projBeneficiaries').value || 0,
            start_date: document.getElementById('projStart').value || null,
            expected_completion: document.getElementById('projEnd').value || null,
            progress_percent: document.getElementById('projProgress').value || 0,
            status: document.getElementById('projStatus').value,
            description: document.getElementById('projDesc').value || null,
            is_active: document.getElementById('projActive')?.value ?? 1
        };
    },

    async addProject() {
        const body = this.getProjectFormData();
        if (!body.project_name) return Swal.fire('Error', 'Project name is required', 'error');

        const data = await this.postAPI('/projects', body);
        if (data && data.success) {
            Swal.fire('Added!', data.message, 'success');
            this.closeModal();
            this.loadProjects();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to add project', 'error');
        }
    },

    async saveProject(id) {
        const body = this.getProjectFormData();
        if (!body.project_name) return Swal.fire('Error', 'Project name is required', 'error');

        const data = await this.putAPI(`/projects/${id}`, body);
        if (data && data.success) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadProjects();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update project', 'error');
        }
    },

    async deleteProject(id, name) {
        const result = await Swal.fire({
            title: 'Delete Project?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#0369a1',
            confirmButtonText: 'Yes, Delete'
        });

        if (!result.isConfirmed) return;

        const data = await this.deleteAPI(`/projects/${id}`);
        if (data && data.success) {
            Swal.fire('Deleted!', data.message, 'success');
            this.loadProjects();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to delete project', 'error');
        }
    },

    /* ======================== MODAL HELPERS ======================== */
    openModal() {
        document.getElementById('detailModalOverlay').classList.add('active');
    },

    closeModal() {
        document.getElementById('detailModalOverlay').classList.remove('active');
    },

    /* ======================== UTILITY HELPERS ======================== */
    badgeClass(status) {
        if (!status) return 'badge-pending';
        const s = status.toLowerCase().replace(/\s+/g, '-');
        return `badge-${s}`;
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    fmtDate(d) {
        if (!d) return '-';
        try {
            return new Date(d).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        } catch { return '-'; }
    },

    logout() {
        Swal.fire({
            title: 'Logout?',
            text: 'Are you sure you want to logout?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0369a1',
            confirmButtonText: 'Logout'
        }).then(r => {
            if (r.isConfirmed) {
                localStorage.removeItem('adminToken');
                window.location.href = 'index.html#admin';
            }
        });
    }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => AdminWater.init());
