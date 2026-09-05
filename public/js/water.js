/**
 * ==============================================
 * পানি সম্পদ মন্ত্রণালয়
 * Ministry of Water Resources — Frontend JS
 * ==============================================
 */

const WaterApp = {
    token: localStorage.getItem('token'),
    API: '/api/water',

    init() {
        if (!this.token) {
            window.location.href = 'index.html';
            return;
        }
        this.setupNavigation();
        this.loadStats();
        this.loadActivity();
        this.loadDivisions();
        this.bindForms();
    },

    // ================== NAVIGATION ==================
    setupNavigation() {
        window.showSection = (id) => {
            document.querySelectorAll('.content-section').forEach(el => el.style.display = 'none');
            const section = document.getElementById(id);
            if (section) section.style.display = 'block';

            document.querySelectorAll('.sidebar .nav-links a').forEach(a => a.classList.remove('active'));
            const map = {
                'overview': 'Overview',
                'connection': 'Water Connection',
                'bill': 'Pay Bill',
                'quality': 'Water Quality',
                'complaints': 'Complaints',
                'projects': 'Projects'
            };
            const text = map[id];
            if (text) {
                Array.from(document.querySelectorAll('.sidebar .nav-links a'))
                    .find(a => a.innerText.includes(text))?.classList.add('active');
            }

            // Lazy-load section data
            if (id === 'connection') this.loadMyConnections();
            if (id === 'bill') this.loadMyBills();
            if (id === 'quality') this.loadMyQualityReports();
            if (id === 'complaints') this.loadMyComplaints();
            if (id === 'projects') this.loadProjects();
        };
    },

    // ================== API HELPERS ==================
    async fetchAPI(url) {
        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'index.html';
                return null;
            }
            if (!res.ok) throw new Error(res.statusText);
            return res.json();
        } catch (err) {
            console.error('fetchAPI error:', err);
            return null;
        }
    },

    async postAPI(url, body) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(body)
            });
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'index.html';
                return null;
            }
            return res.json();
        } catch (err) {
            console.error('postAPI error:', err);
            return null;
        }
    },

    // ================== STATS ==================
    async loadStats() {
        const data = await this.fetchAPI(`${this.API}/my-stats`);
        if (!data) return;
        document.getElementById('stat-connections').textContent = data.total_connections || 0;
        document.getElementById('stat-active').textContent = data.active_connections || 0;
        document.getElementById('stat-bills').textContent = data.total_bills || 0;
        document.getElementById('stat-pending-bills').textContent = data.pending_bills || 0;
        document.getElementById('stat-complaints').textContent = data.total_complaints || 0;
        document.getElementById('stat-quality').textContent = data.total_quality_reports || 0;
    },

    // ================== ACTIVITY ==================
    async loadActivity() {
        const data = await this.fetchAPI(`${this.API}/my-activity`);
        const container = document.getElementById('recentActivityContainer');
        if (!data || !data.length) {
            container.innerHTML = '<p style="color: #64748b; text-align: center; padding: 20px;">No recent activity found.</p>';
            return;
        }
        container.innerHTML = data.map(item => `
            <div class="activity-item">
                <div class="activity-info">
                    <span class="activity-type">${item.type}</span>
                    <span class="activity-title">${item.title || '-'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="badge badge-${(item.status || '').toLowerCase().replace(/\s+/g, '-')}">${item.status}</span>
                    <span class="activity-date">${this.formatDate(item.created_at)}</span>
                </div>
            </div>
        `).join('');
    },

    // ================== LOCATIONS ==================
    async loadDivisions() {
        const divs = await this.fetchAPI(`${this.API}/locations/divisions`);
        if (!divs) return;
        const prefixes = ['conn', 'qual', 'comp'];
        prefixes.forEach(prefix => {
            const el = document.getElementById(`${prefix}-division`);
            if (el) {
                const first = el.querySelector('option');
                el.innerHTML = '';
                if (first) el.appendChild(first);
                divs.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.name;
                    opt.textContent = d.name;
                    el.appendChild(opt);
                });
            }
        });
        // Also populate project filter
        const projDiv = document.getElementById('proj-filter-division');
        if (projDiv) {
            const firstOpt = projDiv.querySelector('option');
            projDiv.innerHTML = '';
            if (firstOpt) projDiv.appendChild(firstOpt);
            divs.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.name;
                opt.textContent = d.name;
                projDiv.appendChild(opt);
            });
        }
    },

    async loadDistricts(prefix) {
        const divEl = document.getElementById(`${prefix}-division`);
        const distEl = document.getElementById(`${prefix}-district`);
        const upaEl = document.getElementById(`${prefix}-upazila`);
        if (!divEl || !distEl) return;

        distEl.innerHTML = '<option value="">-- Select --</option>';
        if (upaEl) upaEl.innerHTML = '<option value="">-- Select --</option>';

        const divName = divEl.value;
        if (!divName) return;

        // Need division id — re-fetch
        const divs = await this.fetchAPI(`${this.API}/locations/divisions`);
        if (!divs) return;
        const div = divs.find(d => d.name === divName);
        if (!div) return;

        const dists = await this.fetchAPI(`${this.API}/locations/districts/${div.id}`);
        if (!dists) return;
        dists.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.name;
            opt.dataset.id = d.id;
            opt.textContent = d.name;
            distEl.appendChild(opt);
        });
    },

    async loadUpazilas(prefix) {
        const distEl = document.getElementById(`${prefix}-district`);
        const upaEl = document.getElementById(`${prefix}-upazila`);
        if (!distEl || !upaEl) return;

        upaEl.innerHTML = '<option value="">-- Select --</option>';
        const selectedOpt = distEl.options[distEl.selectedIndex];
        const distId = selectedOpt?.dataset?.id;
        if (!distId) return;

        const upas = await this.fetchAPI(`${this.API}/locations/upazilas/${distId}`);
        if (!upas) return;
        upas.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.name;
            opt.textContent = u.name;
            upaEl.appendChild(opt);
        });
    },

    // ================== FORM BINDINGS ==================
    bindForms() {
        // Connection form
        const connForm = document.getElementById('connectionForm');
        if (connForm) {
            connForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = connForm.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

                const body = {
                    holder_name: document.getElementById('conn-name').value,
                    nid_number: document.getElementById('conn-nid').value,
                    phone: document.getElementById('conn-phone').value,
                    connection_type: document.getElementById('conn-type').value,
                    pipe_size: document.getElementById('conn-pipe').value,
                    wasa_region: document.getElementById('conn-region').value,
                    division: document.getElementById('conn-division').value,
                    district: document.getElementById('conn-district').value,
                    upazila: document.getElementById('conn-upazila').value,
                    ward_no: document.getElementById('conn-ward').value,
                    address: document.getElementById('conn-address').value
                };

                const res = await this.postAPI(`${this.API}/connection/apply`, body);
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application';

                if (res && res.success) {
                    Swal.fire('Success!', `Application submitted. Connection No: ${res.connection_number}`, 'success');
                    connForm.reset();
                    this.loadMyConnections();
                    this.loadStats();
                } else {
                    Swal.fire('Error', res?.error || 'Failed to submit application', 'error');
                }
            });
        }

        // Bill form
        const billForm = document.getElementById('billForm');
        if (billForm) {
            // Auto-calculate total
            const amtEl = document.getElementById('bill-amount');
            const surEl = document.getElementById('bill-surcharge');
            const totEl = document.getElementById('bill-total');
            const calcTotal = () => {
                const amt = parseFloat(amtEl.value) || 0;
                const sur = parseFloat(surEl.value) || 0;
                totEl.value = (amt + sur).toFixed(2);
            };
            amtEl.addEventListener('input', calcTotal);
            surEl.addEventListener('input', calcTotal);

            billForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = billForm.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

                const body = {
                    connection_number: document.getElementById('bill-conn-no').value,
                    billing_month: document.getElementById('bill-month').value,
                    meter_reading_prev: parseFloat(document.getElementById('bill-prev').value) || 0,
                    meter_reading_current: parseFloat(document.getElementById('bill-current').value) || 0,
                    amount: parseFloat(document.getElementById('bill-amount').value),
                    surcharge: parseFloat(document.getElementById('bill-surcharge').value) || 0,
                    total_amount: parseFloat(document.getElementById('bill-total').value),
                    payment_method: document.getElementById('bill-method').value,
                    transaction_id: document.getElementById('bill-txn').value
                };

                const res = await this.postAPI(`${this.API}/bill/pay`, body);
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-money-bill-wave"></i> Pay Bill';

                if (res && res.success) {
                    Swal.fire('Success!', 'Bill payment recorded.', 'success');
                    billForm.reset();
                    this.loadMyBills();
                    this.loadStats();
                } else {
                    Swal.fire('Error', res?.error || 'Failed to process payment', 'error');
                }
            });
        }

        // Quality report form
        const qualForm = document.getElementById('qualityForm');
        if (qualForm) {
            qualForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = qualForm.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

                const body = {
                    source_type: document.getElementById('qual-source').value,
                    issue_type: document.getElementById('qual-issue').value,
                    severity: document.getElementById('qual-severity').value,
                    affected_people: parseInt(document.getElementById('qual-affected').value) || 0,
                    division: document.getElementById('qual-division').value,
                    district: document.getElementById('qual-district').value,
                    upazila: document.getElementById('qual-upazila').value,
                    location_details: document.getElementById('qual-location').value,
                    description: document.getElementById('qual-desc').value
                };

                const res = await this.postAPI(`${this.API}/quality/report`, body);
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Report';

                if (res && res.success) {
                    Swal.fire('Success!', 'Water quality report submitted.', 'success');
                    qualForm.reset();
                    this.loadMyQualityReports();
                    this.loadStats();
                } else {
                    Swal.fire('Error', res?.error || 'Failed to submit report', 'error');
                }
            });
        }

        // Complaint form
        const compForm = document.getElementById('complaintForm');
        if (compForm) {
            compForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = compForm.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

                const body = {
                    complaint_type: document.getElementById('comp-type').value,
                    priority: document.getElementById('comp-priority').value,
                    division: document.getElementById('comp-division').value,
                    district: document.getElementById('comp-district').value,
                    upazila: document.getElementById('comp-upazila').value,
                    contact_phone: document.getElementById('comp-phone').value,
                    address: document.getElementById('comp-address').value,
                    description: document.getElementById('comp-desc').value
                };

                const res = await this.postAPI(`${this.API}/complaint/submit`, body);
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Complaint';

                if (res && res.success) {
                    Swal.fire('Success!', 'Complaint filed successfully.', 'success');
                    compForm.reset();
                    this.loadMyComplaints();
                    this.loadStats();
                } else {
                    Swal.fire('Error', res?.error || 'Failed to file complaint', 'error');
                }
            });
        }
    },

    // ================== DATA LOADERS ==================

    // --- Connections ---
    async loadMyConnections() {
        const data = await this.fetchAPI(`${this.API}/connection/my-connections`);
        const tbody = document.getElementById('myConnectionsBody');
        if (!data || !data.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;">No connections found.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(c => `
            <tr>
                <td style="font-weight:600;color:#7dd3fc;">${c.connection_number || '-'}</td>
                <td>${c.connection_type}</td>
                <td>${c.wasa_region || '-'}</td>
                <td>${c.district || '-'}</td>
                <td><span class="badge badge-${(c.status || '').toLowerCase().replace(/\s+/g, '-')}">${c.status}</span></td>
                <td>${this.formatDate(c.created_at)}</td>
            </tr>
        `).join('');
    },

    // --- Bills ---
    async loadMyBills() {
        const data = await this.fetchAPI(`${this.API}/bill/my-bills`);
        const tbody = document.getElementById('myBillsBody');
        if (!data || !data.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;">No bills found.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(b => `
            <tr>
                <td style="font-weight:600;color:#7dd3fc;">${b.connection_number || '-'}</td>
                <td>${b.billing_month || '-'}</td>
                <td>${b.units_consumed || 0}</td>
                <td>৳${parseFloat(b.total_amount || 0).toLocaleString()}</td>
                <td>${b.payment_method || '-'}</td>
                <td><span class="badge badge-${(b.status || '').toLowerCase().replace(/\s+/g, '-')}">${b.status}</span></td>
                <td>${this.formatDate(b.created_at)}</td>
            </tr>
        `).join('');
    },

    // --- Quality Reports ---
    async loadMyQualityReports() {
        const data = await this.fetchAPI(`${this.API}/quality/my-reports`);
        const tbody = document.getElementById('myQualityBody');
        if (!data || !data.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;">No reports found.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(q => `
            <tr>
                <td>${q.source_type}</td>
                <td>${q.issue_type}</td>
                <td><span class="severity-${(q.severity || '').toLowerCase()}">${q.severity}</span></td>
                <td>${q.district || '-'}</td>
                <td><span class="badge badge-${(q.status || '').toLowerCase().replace(/\s+/g, '-')}">${q.status}</span></td>
                <td>${this.formatDate(q.created_at)}</td>
            </tr>
        `).join('');
    },

    // --- Complaints ---
    async loadMyComplaints() {
        const data = await this.fetchAPI(`${this.API}/complaint/my-complaints`);
        const tbody = document.getElementById('myComplaintsBody');
        if (!data || !data.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;">No complaints found.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(c => `
            <tr>
                <td>${c.complaint_type}</td>
                <td><span class="priority-${(c.priority || '').toLowerCase()}">${c.priority}</span></td>
                <td>${c.district || '-'}</td>
                <td><span class="badge badge-${(c.status || '').toLowerCase().replace(/\s+/g, '-')}">${c.status}</span></td>
                <td>${c.assigned_to || '<span style="color:#64748b;">Not assigned</span>'}</td>
                <td>${this.formatDate(c.created_at)}</td>
            </tr>
        `).join('');
    },

    // --- Projects ---
    async loadProjects() {
        const division = document.getElementById('proj-filter-division')?.value || '';
        const type = document.getElementById('proj-filter-type')?.value || '';
        let url = `${this.API}/projects/list?`;
        if (division) url += `division=${encodeURIComponent(division)}&`;
        if (type) url += `type=${encodeURIComponent(type)}&`;

        const data = await this.fetchAPI(url);
        const grid = document.getElementById('projectGrid');
        if (!data || !data.length) {
            grid.innerHTML = '<p style="color:#64748b;text-align:center;grid-column:1/-1;">No projects found.</p>';
            return;
        }
        grid.innerHTML = data.map(p => `
            <div class="project-card">
                <h4>${p.project_name}</h4>
                ${p.project_name_bn ? `<div class="project-bn">${p.project_name_bn}</div>` : ''}
                <div class="project-meta">
                    <span><i class="fas fa-map-marker-alt"></i> ${p.division}${p.district ? ', ' + p.district : ''}</span>
                    <span><i class="fas fa-tags"></i> ${p.project_type}</span>
                    ${p.budget_crore ? `<span><i class="fas fa-coins"></i> ৳${p.budget_crore} Cr</span>` : ''}
                    ${p.implementing_agency ? `<span><i class="fas fa-building"></i> ${p.implementing_agency}</span>` : ''}
                </div>
                ${p.description ? `<div class="project-desc">${p.description}</div>` : ''}
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                    <span class="badge badge-${(p.status || '').toLowerCase().replace(/\s+/g, '-')}">${p.status}</span>
                    ${p.beneficiaries ? `<span style="color:#94a3b8;font-size:0.72rem;"><i class="fas fa-users" style="color:#0ea5e9;"></i> ${Number(p.beneficiaries).toLocaleString()} beneficiaries</span>` : ''}
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${p.progress_percent || 0}%"></div></div>
                <div class="progress-text">
                    <span>Progress</span>
                    <span>${p.progress_percent || 0}%</span>
                </div>
            </div>
        `).join('');
    },

    // ================== UTILS ==================
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
};

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => WaterApp.init());
