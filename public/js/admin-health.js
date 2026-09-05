/* ============================================
   Admin Health Panel - JavaScript
   স্বাস্থ্য প্রশাসন | Health Administration
   ============================================ */

const AdminHealth = {
    API: '/api/health/admin',
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
        const res = await fetch(`${this.API}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (res.status === 401 || res.status === 403) {
            this.handleAuthError();
            return null;
        }
        return res.json();
    },

    async postAPI(endpoint, body) {
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
    },

    async putAPI(endpoint, body) {
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
    },

    async deleteAPI(endpoint) {
        const res = await fetch(`${this.API}${endpoint}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (res.status === 401 || res.status === 403) {
            this.handleAuthError();
            return null;
        }
        return res.json();
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

        // Load data for the tab
        switch (tab) {
            case 'dashboard': this.loadStats(); break;
            case 'health-cards': this.loadHealthCards(); break;
            case 'vaccinations': this.loadVaccinations(); break;
            case 'appointments': this.loadAppointments(); break;
            case 'ambulance': this.loadAmbulance(); break;
            case 'complaints': this.loadComplaints(); break;
            case 'hospitals': this.loadHospitals(); break;
        }
    },

    /* ======================== DASHBOARD STATS ======================== */
    async loadStats() {
        try {
            const data = await this.fetchAPI('/stats');
            if (!data || !data.stats) return;
            const s = data.stats;

            document.getElementById('adm-total-cards').textContent = s.total_cards || 0;
            document.getElementById('adm-pending-cards').textContent = s.pending_cards || 0;
            document.getElementById('adm-approved-cards').textContent = s.approved_cards || 0;
            document.getElementById('adm-total-vaccines').textContent = s.total_vaccinations || 0;
            document.getElementById('adm-total-appts').textContent = s.total_appointments || 0;
            document.getElementById('adm-pending-appts').textContent = s.pending_appointments || 0;
            document.getElementById('adm-total-ambulance').textContent = s.total_ambulance || 0;
            document.getElementById('adm-active-ambulance').textContent = s.active_ambulance || 0;
            document.getElementById('adm-total-complaints').textContent = s.total_complaints || 0;
            document.getElementById('adm-total-hospitals').textContent = s.total_hospitals || 0;
            document.getElementById('adm-today-appts').textContent = s.today_appointments || 0;
        } catch (err) {
            console.error('Stats load error:', err);
        }
    },

    /* ======================== HEALTH CARDS ======================== */
    async loadHealthCards() {
        const tbody = document.getElementById('adminHcBody');
        tbody.innerHTML = '<tr><td colspan="8" class="health-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const status = document.getElementById('hc-filter-status').value;
            const search = document.getElementById('hc-filter-search').value;
            let params = new URLSearchParams();
            if (status) params.append('status', status);
            if (search) params.append('search', search);

            const data = await this.fetchAPI(`/health-cards?${params.toString()}`);
            if (!data) return;

            const cards = data.cards || [];
            if (cards.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data-td"><i class="fas fa-id-card-alt"></i>No health card applications found</td></tr>';
                return;
            }

            tbody.innerHTML = cards.map(c => `
                <tr>
                    <td>${this.esc(c.card_number || 'N/A')}</td>
                    <td>${this.esc(c.full_name || c.username || '-')}</td>
                    <td>${this.esc(c.nid_number || '-')}</td>
                    <td>${this.esc(c.blood_group || '-')}</td>
                    <td>${this.esc(c.district || '-')}</td>
                    <td><span class="badge ${this.badgeClass(c.status)}">${this.esc(c.status)}</span></td>
                    <td>${this.fmtDate(c.created_at)}</td>
                    <td>
                        <button class="btn-action btn-action-view" onclick="AdminHealth.viewHealthCard(${c.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn-action btn-action-update" onclick="AdminHealth.updateHealthCardModal(${c.id}, '${this.esc(c.status)}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Health cards error:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="no-data-td">Error loading data</td></tr>';
        }
    },

    async viewHealthCard(id) {
        const data = await this.fetchAPI(`/health-cards/${id}`);
        if (!data || !data.card) return;
        const c = data.card;

        document.getElementById('modalTitle').textContent = 'Health Card Details';
        document.getElementById('modalBody').innerHTML = `
            <div class="detail-grid">
                <div class="detail-section-title"><i class="fas fa-id-card-alt"></i> Card Information</div>
                <div class="detail-row"><span class="detail-label">Card No.</span><span class="detail-value">${this.esc(c.card_number || 'Not Assigned')}</span></div>
                <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge ${this.badgeClass(c.status)}">${this.esc(c.status)}</span></span></div>
                <div class="detail-section-title"><i class="fas fa-user"></i> Personal Info</div>
                <div class="detail-row"><span class="detail-label">Full Name</span><span class="detail-value">${this.esc(c.full_name || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">NID</span><span class="detail-value">${this.esc(c.nid_number || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Date of Birth</span><span class="detail-value">${this.fmtDate(c.date_of_birth)}</span></div>
                <div class="detail-row"><span class="detail-label">Blood Group</span><span class="detail-value">${this.esc(c.blood_group || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Gender</span><span class="detail-value">${this.esc(c.gender || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${this.esc(c.phone || '-')}</span></div>
                <div class="detail-section-title"><i class="fas fa-map-marker-alt"></i> Address</div>
                <div class="detail-row"><span class="detail-label">Division</span><span class="detail-value">${this.esc(c.division || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">District</span><span class="detail-value">${this.esc(c.district || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Upazila</span><span class="detail-value">${this.esc(c.upazila || '-')}</span></div>
                <div class="detail-section-title"><i class="fas fa-heartbeat"></i> Medical Info</div>
                <div class="detail-row full-width"><span class="detail-label">Allergies</span><span class="detail-value">${this.esc(c.allergies || 'None')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Chronic Diseases</span><span class="detail-value">${this.esc(c.chronic_diseases || 'None')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Emergency Contact</span><span class="detail-value">${this.esc(c.emergency_contact || 'N/A')}</span></div>
                <div class="detail-row"><span class="detail-label">Applied</span><span class="detail-value">${this.fmtDate(c.created_at)}</span></div>
            </div>
        `;
        this.openModal();
    },

    updateHealthCardModal(id, currentStatus) {
        document.getElementById('modalTitle').textContent = 'Update Health Card Status';
        const statuses = ['Pending', 'Approved', 'Rejected'];
        document.getElementById('modalBody').innerHTML = `
            <div class="status-update-section">
                <h3><i class="fas fa-edit"></i> Change Status</h3>
                <select id="updateStatus">
                    ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Admin Note (optional)</label>
                <textarea id="updateNote" rows="3" placeholder="Enter admin note..."></textarea>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="AdminHealth.closeModal()">Cancel</button>
                    <button class="btn-health" onclick="AdminHealth.updateHealthCard(${id})"><i class="fas fa-save"></i> Update</button>
                </div>
            </div>
        `;
        this.openModal();
    },

    async updateHealthCard(id) {
        const status = document.getElementById('updateStatus').value;
        const note = document.getElementById('updateNote').value;
        const data = await this.putAPI(`/health-cards/${id}`, { status, admin_note: note });
        if (data && data.message) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadHealthCards();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update', 'error');
        }
    },

    /* ======================== VACCINATIONS ======================== */
    async loadVaccinations() {
        const tbody = document.getElementById('adminVacBody');
        tbody.innerHTML = '<tr><td colspan="9" class="health-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const status = document.getElementById('vac-filter-status').value;
            const search = document.getElementById('vac-filter-search').value;
            let params = new URLSearchParams();
            if (status) params.append('status', status);
            if (search) params.append('search', search);

            const data = await this.fetchAPI(`/vaccinations?${params.toString()}`);
            if (!data) return;

            const vacs = data.vaccinations || [];
            if (vacs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="no-data-td"><i class="fas fa-syringe"></i>No vaccination records found</td></tr>';
                return;
            }

            tbody.innerHTML = vacs.map(v => `
                <tr>
                    <td>#${v.id}</td>
                    <td>${this.esc(v.full_name || v.username || '-')}</td>
                    <td>${this.esc(v.vaccine_name)}</td>
                    <td>${this.esc(v.vaccine_type)}</td>
                    <td>${this.esc(v.dose_number || '-')}</td>
                    <td>${this.fmtDate(v.vaccination_date || v.scheduled_date)}</td>
                    <td>${this.esc(v.vaccination_center || '-')}</td>
                    <td><span class="badge ${this.badgeClass(v.status)}">${this.esc(v.status)}</span></td>
                    <td>
                        <button class="btn-action btn-action-view" onclick="AdminHealth.viewVaccination(${v.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn-action btn-action-update" onclick="AdminHealth.updateVaccinationModal(${v.id}, '${this.esc(v.status)}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Vaccinations error:', err);
            tbody.innerHTML = '<tr><td colspan="9" class="no-data-td">Error loading data</td></tr>';
        }
    },

    async viewVaccination(id) {
        const data = await this.fetchAPI(`/vaccinations/${id}`);
        if (!data || !data.vaccination) return;
        const v = data.vaccination;

        document.getElementById('modalTitle').textContent = 'Vaccination Details';
        document.getElementById('modalBody').innerHTML = `
            <div class="detail-grid">
                <div class="detail-section-title"><i class="fas fa-syringe"></i> Vaccination Info</div>
                <div class="detail-row"><span class="detail-label">Vaccine</span><span class="detail-value">${this.esc(v.vaccine_name)}</span></div>
                <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${this.esc(v.vaccine_type)}</span></div>
                <div class="detail-row"><span class="detail-label">Dose</span><span class="detail-value">${this.esc(v.dose_number || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge ${this.badgeClass(v.status)}">${this.esc(v.status)}</span></span></div>
                <div class="detail-section-title"><i class="fas fa-user"></i> Patient</div>
                <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${this.esc(v.full_name || v.username || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">NID</span><span class="detail-value">${this.esc(v.nid_number || '-')}</span></div>
                <div class="detail-section-title"><i class="fas fa-calendar"></i> Schedule</div>
                <div class="detail-row"><span class="detail-label">Scheduled</span><span class="detail-value">${this.fmtDate(v.scheduled_date)}</span></div>
                <div class="detail-row"><span class="detail-label">Vaccinated</span><span class="detail-value">${this.fmtDate(v.vaccination_date)}</span></div>
                <div class="detail-row"><span class="detail-label">Center</span><span class="detail-value">${this.esc(v.vaccination_center || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Batch No.</span><span class="detail-value">${this.esc(v.batch_number || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Certificate No.</span><span class="detail-value">${this.esc(v.certificate_number || 'N/A')}</span></div>
            </div>
        `;
        this.openModal();
    },

    updateVaccinationModal(id, currentStatus) {
        document.getElementById('modalTitle').textContent = 'Update Vaccination Status';
        const statuses = ['Registered', 'Scheduled', 'Completed', 'Cancelled'];
        document.getElementById('modalBody').innerHTML = `
            <div class="status-update-section">
                <h3><i class="fas fa-edit"></i> Change Status</h3>
                <select id="updateStatus">
                    ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <div id="vacExtraFields"></div>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="AdminHealth.closeModal()">Cancel</button>
                    <button class="btn-health" onclick="AdminHealth.updateVaccination(${id})"><i class="fas fa-save"></i> Update</button>
                </div>
            </div>
        `;

        document.getElementById('updateStatus').addEventListener('change', (e) => {
            const extra = document.getElementById('vacExtraFields');
            if (e.target.value === 'Completed') {
                extra.innerHTML = `
                    <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block; margin-top:8px;">Vaccination Date</label>
                    <input type="date" id="vacDate" value="${new Date().toISOString().split('T')[0]}">
                    <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Batch Number</label>
                    <input type="text" id="vacBatch" placeholder="Batch number...">
                `;
            } else if (e.target.value === 'Scheduled') {
                extra.innerHTML = `
                    <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block; margin-top:8px;">Scheduled Date</label>
                    <input type="date" id="vacScheduleDate">
                    <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Vaccination Center</label>
                    <input type="text" id="vacCenter" placeholder="Center name...">
                `;
            } else {
                extra.innerHTML = '';
            }
        });

        this.openModal();
    },

    async updateVaccination(id) {
        const status = document.getElementById('updateStatus').value;
        const body = { status };

        if (status === 'Completed') {
            const d = document.getElementById('vacDate');
            const b = document.getElementById('vacBatch');
            if (d) body.vaccination_date = d.value;
            if (b) body.batch_number = b.value;
        } else if (status === 'Scheduled') {
            const d = document.getElementById('vacScheduleDate');
            const c = document.getElementById('vacCenter');
            if (d) body.scheduled_date = d.value;
            if (c) body.vaccination_center = c.value;
        }

        const data = await this.putAPI(`/vaccinations/${id}`, body);
        if (data && data.message) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadVaccinations();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update', 'error');
        }
    },

    /* ======================== APPOINTMENTS ======================== */
    async loadAppointments() {
        const tbody = document.getElementById('adminAptBody');
        tbody.innerHTML = '<tr><td colspan="8" class="health-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const status = document.getElementById('apt-filter-status').value;
            const date = document.getElementById('apt-filter-date').value;
            const search = document.getElementById('apt-filter-search').value;
            let params = new URLSearchParams();
            if (status) params.append('status', status);
            if (date) params.append('date', date);
            if (search) params.append('search', search);

            const data = await this.fetchAPI(`/appointments?${params.toString()}`);
            if (!data) return;

            const appts = data.appointments || [];
            if (appts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data-td"><i class="fas fa-calendar-check"></i>No appointments found</td></tr>';
                return;
            }

            tbody.innerHTML = appts.map(a => `
                <tr>
                    <td>#${a.id}</td>
                    <td>${this.esc(a.patient_name || a.username || '-')}</td>
                    <td>${this.esc(a.hospital_name || '-')}</td>
                    <td>${this.esc(a.department || '-')}</td>
                    <td>${this.fmtDate(a.appointment_date)}</td>
                    <td><span class="urgency-${(a.urgency || 'normal').toLowerCase()}">${this.esc(a.urgency || 'Normal')}</span></td>
                    <td><span class="badge ${this.badgeClass(a.status)}">${this.esc(a.status)}</span></td>
                    <td>
                        <button class="btn-action btn-action-view" onclick="AdminHealth.viewAppointment(${a.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn-action btn-action-update" onclick="AdminHealth.updateAppointmentModal(${a.id}, '${this.esc(a.status)}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Appointments error:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="no-data-td">Error loading data</td></tr>';
        }
    },

    async viewAppointment(id) {
        const data = await this.fetchAPI(`/appointments/${id}`);
        if (!data || !data.appointment) return;
        const a = data.appointment;

        document.getElementById('modalTitle').textContent = 'Appointment Details';
        document.getElementById('modalBody').innerHTML = `
            <div class="detail-grid">
                <div class="detail-section-title"><i class="fas fa-calendar-check"></i> Appointment Info</div>
                <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">#${a.id}</span></div>
                <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge ${this.badgeClass(a.status)}">${this.esc(a.status)}</span></span></div>
                <div class="detail-row"><span class="detail-label">Hospital</span><span class="detail-value">${this.esc(a.hospital_name || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Department</span><span class="detail-value">${this.esc(a.department || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${this.fmtDate(a.appointment_date)}</span></div>
                <div class="detail-row"><span class="detail-label">Urgency</span><span class="detail-value"><span class="urgency-${(a.urgency || 'normal').toLowerCase()}">${this.esc(a.urgency || 'Normal')}</span></span></div>
                <div class="detail-section-title"><i class="fas fa-user"></i> Patient Info</div>
                <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${this.esc(a.patient_name || a.username || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${this.esc(a.phone || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Symptoms</span><span class="detail-value">${this.esc(a.symptoms || 'Not specified')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Notes</span><span class="detail-value">${this.esc(a.notes || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Prescription</span><span class="detail-value">${this.esc(a.prescription || 'Not provided')}</span></div>
            </div>
        `;
        this.openModal();
    },

    updateAppointmentModal(id, currentStatus) {
        document.getElementById('modalTitle').textContent = 'Update Appointment';
        const statuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No Show'];
        document.getElementById('modalBody').innerHTML = `
            <div class="status-update-section">
                <h3><i class="fas fa-edit"></i> Update</h3>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Status</label>
                <select id="updateStatus">
                    ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Prescription / Doctor Notes</label>
                <textarea id="updatePrescription" rows="3" placeholder="Prescription details..."></textarea>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="AdminHealth.closeModal()">Cancel</button>
                    <button class="btn-health" onclick="AdminHealth.updateAppointment(${id})"><i class="fas fa-save"></i> Update</button>
                </div>
            </div>
        `;
        this.openModal();
    },

    async updateAppointment(id) {
        const status = document.getElementById('updateStatus').value;
        const prescription = document.getElementById('updatePrescription').value;
        const data = await this.putAPI(`/appointments/${id}`, { status, prescription });
        if (data && data.message) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadAppointments();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update', 'error');
        }
    },

    /* ======================== AMBULANCE ======================== */
    async loadAmbulance() {
        const tbody = document.getElementById('adminAmbBody');
        tbody.innerHTML = '<tr><td colspan="8" class="health-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const status = document.getElementById('amb-filter-status').value;
            const search = document.getElementById('amb-filter-search').value;
            let params = new URLSearchParams();
            if (status) params.append('status', status);
            if (search) params.append('search', search);

            const data = await this.fetchAPI(`/ambulance?${params.toString()}`);
            if (!data) return;

            const ambs = data.requests || [];
            if (ambs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data-td"><i class="fas fa-ambulance"></i>No ambulance requests found</td></tr>';
                return;
            }

            tbody.innerHTML = ambs.map(a => `
                <tr>
                    <td>#${a.id}</td>
                    <td>${this.esc(a.patient_name || a.username || '-')}</td>
                    <td>${this.esc(a.emergency_type || '-')}</td>
                    <td>${this.esc(a.pickup_address || '-')}</td>
                    <td><span class="urgency-${(a.urgency || 'normal').toLowerCase()}">${this.esc(a.urgency || 'Normal')}</span></td>
                    <td>${this.esc(a.ambulance_type || '-')}</td>
                    <td><span class="badge ${this.badgeClass(a.status)}">${this.esc(a.status)}</span></td>
                    <td>
                        <button class="btn-action btn-action-view" onclick="AdminHealth.viewAmbulance(${a.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn-action btn-action-update" onclick="AdminHealth.updateAmbulanceModal(${a.id}, '${this.esc(a.status)}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Ambulance error:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="no-data-td">Error loading data</td></tr>';
        }
    },

    async viewAmbulance(id) {
        const data = await this.fetchAPI(`/ambulance/${id}`);
        if (!data || !data.request) return;
        const a = data.request;

        document.getElementById('modalTitle').textContent = 'Ambulance Request Details';
        document.getElementById('modalBody').innerHTML = `
            <div class="detail-grid">
                <div class="detail-section-title"><i class="fas fa-ambulance"></i> Request Info</div>
                <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">#${a.id}</span></div>
                <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="badge ${this.badgeClass(a.status)}">${this.esc(a.status)}</span></span></div>
                <div class="detail-row"><span class="detail-label">Urgency</span><span class="detail-value"><span class="urgency-${(a.urgency || 'normal').toLowerCase()}">${this.esc(a.urgency || 'Normal')}</span></span></div>
                <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${this.esc(a.ambulance_type || '-')}</span></div>
                <div class="detail-section-title"><i class="fas fa-user"></i> Patient</div>
                <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${this.esc(a.patient_name || a.username || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${this.esc(a.phone || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Emergency</span><span class="detail-value">${this.esc(a.emergency_type || '-')}</span></div>
                <div class="detail-section-title"><i class="fas fa-map-marker-alt"></i> Location</div>
                <div class="detail-row full-width"><span class="detail-label">Pickup</span><span class="detail-value">${this.esc(a.pickup_address || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Destination</span><span class="detail-value">${this.esc(a.destination_hospital || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Notes</span><span class="detail-value">${this.esc(a.additional_notes || '-')}</span></div>
                <div class="detail-row"><span class="detail-label">Requested</span><span class="detail-value">${this.fmtDate(a.created_at)}</span></div>
            </div>
        `;
        this.openModal();
    },

    updateAmbulanceModal(id, currentStatus) {
        document.getElementById('modalTitle').textContent = 'Update Ambulance Request';
        const statuses = ['Requested', 'Dispatched', 'En Route', 'Arrived', 'Completed', 'Cancelled'];
        document.getElementById('modalBody').innerHTML = `
            <div class="status-update-section">
                <h3><i class="fas fa-edit"></i> Change Status</h3>
                <select id="updateStatus">
                    ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="AdminHealth.closeModal()">Cancel</button>
                    <button class="btn-health" onclick="AdminHealth.updateAmbulance(${id})"><i class="fas fa-save"></i> Update</button>
                </div>
            </div>
        `;
        this.openModal();
    },

    async updateAmbulance(id) {
        const status = document.getElementById('updateStatus').value;
        const data = await this.putAPI(`/ambulance/${id}`, { status });
        if (data && data.message) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadAmbulance();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update', 'error');
        }
    },

    /* ======================== COMPLAINTS ======================== */
    async loadComplaints() {
        const tbody = document.getElementById('adminCompBody');
        tbody.innerHTML = '<tr><td colspan="7" class="health-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const status = document.getElementById('comp-filter-status').value;
            const search = document.getElementById('comp-filter-search').value;
            let params = new URLSearchParams();
            if (status) params.append('status', status);
            if (search) params.append('search', search);

            const data = await this.fetchAPI(`/complaints?${params.toString()}`);
            if (!data) return;

            const comps = data.complaints || [];
            if (comps.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="no-data-td"><i class="fas fa-exclamation-triangle"></i>No complaints found</td></tr>';
                return;
            }

            tbody.innerHTML = comps.map(c => `
                <tr>
                    <td>#${c.id}</td>
                    <td>${this.esc(c.full_name || c.username || '-')}</td>
                    <td>${this.esc(c.complaint_type || '-')}</td>
                    <td>${this.esc(c.hospital_name || '-')}</td>
                    <td><span class="badge ${this.badgeClass(c.status)}">${this.esc(c.status)}</span></td>
                    <td>${this.fmtDate(c.created_at)}</td>
                    <td>
                        <button class="btn-action btn-action-view" onclick="AdminHealth.viewComplaint(${c.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn-action btn-action-update" onclick="AdminHealth.updateComplaintModal(${c.id}, '${this.esc(c.status)}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Complaints error:', err);
            tbody.innerHTML = '<tr><td colspan="7" class="no-data-td">Error loading data</td></tr>';
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
                <div class="detail-row"><span class="detail-label">Hospital</span><span class="detail-value">${this.esc(c.hospital_name || '-')}</span></div>
                <div class="detail-section-title"><i class="fas fa-user"></i> Complainant</div>
                <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${this.esc(c.full_name || c.username || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Description</span><span class="detail-value">${this.esc(c.description || '-')}</span></div>
                <div class="detail-row full-width"><span class="detail-label">Admin Response</span><span class="detail-value">${this.esc(c.resolution || 'Not responded yet')}</span></div>
                <div class="detail-row"><span class="detail-label">Submitted</span><span class="detail-value">${this.fmtDate(c.created_at)}</span></div>
            </div>
        `;
        this.openModal();
    },

    updateComplaintModal(id, currentStatus) {
        document.getElementById('modalTitle').textContent = 'Update Complaint';
        const statuses = ['Submitted', 'Under Review', 'Resolved', 'Rejected'];
        document.getElementById('modalBody').innerHTML = `
            <div class="status-update-section">
                <h3><i class="fas fa-edit"></i> Update Complaint</h3>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Status</label>
                <select id="updateStatus">
                    ${statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <label style="color:#94a3b8; font-size:0.78rem; margin-bottom:4px; display:block;">Admin Response</label>
                <textarea id="updateResponse" rows="4" placeholder="Enter response to the complaint..."></textarea>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="AdminHealth.closeModal()">Cancel</button>
                    <button class="btn-health" onclick="AdminHealth.updateComplaint(${id})"><i class="fas fa-save"></i> Update</button>
                </div>
            </div>
        `;
        this.openModal();
    },

    async updateComplaint(id) {
        const status = document.getElementById('updateStatus').value;
        const admin_response = document.getElementById('updateResponse').value;
        const data = await this.putAPI(`/complaints/${id}`, { status, admin_response });
        if (data && data.message) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadComplaints();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update', 'error');
        }
    },

    /* ======================== HOSPITALS ======================== */
    async loadHospitals() {
        const tbody = document.getElementById('adminHospBody');
        tbody.innerHTML = '<tr><td colspan="8" class="health-loader"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const data = await this.fetchAPI('/hospitals');
            if (!data) return;

            const hosps = data.hospitals || [];
            if (hosps.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="no-data-td"><i class="fas fa-hospital"></i>No hospitals found</td></tr>';
                return;
            }

            tbody.innerHTML = hosps.map(h => `
                <tr>
                    <td>${this.esc(h.name)}</td>
                    <td>${this.esc(h.hospital_type || '-')}</td>
                    <td>${this.esc(h.division || '-')}</td>
                    <td>${this.esc(h.district || '-')}</td>
                    <td>${h.total_beds || '-'}</td>
                    <td>${h.icu_beds || '-'}</td>
                    <td><span class="badge ${h.is_active ? 'badge-active' : 'badge-inactive'}">${h.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                        <button class="btn-action btn-action-edit" onclick="AdminHealth.editHospitalModal(${h.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn-action btn-action-delete" onclick="AdminHealth.deleteHospital(${h.id}, '${this.esc(h.name)}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Hospitals error:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="no-data-td">Error loading data</td></tr>';
        }
    },

    showAddHospitalForm() {
        document.getElementById('modalTitle').textContent = 'Add New Hospital';
        document.getElementById('modalBody').innerHTML = this.hospitalFormHTML();
        this.openModal();
    },

    async editHospitalModal(id) {
        const data = await this.fetchAPI(`/hospitals/${id}`);
        if (!data || !data.hospital) return;
        const h = data.hospital;

        document.getElementById('modalTitle').textContent = 'Edit Hospital';
        document.getElementById('modalBody').innerHTML = this.hospitalFormHTML(h);
        this.openModal();
    },

    hospitalFormHTML(h = {}) {
        const isEdit = !!h.id;
        return `
            <form id="hospitalForm" onsubmit="event.preventDefault(); AdminHealth.${isEdit ? `saveHospital(${h.id})` : 'addHospital()'}">
                <div class="hospital-form-group">
                    <label>Hospital Name *</label>
                    <input type="text" id="hospName" value="${this.esc(h.name || '')}" required>
                </div>
                <div class="hospital-form-row">
                    <div class="hospital-form-group">
                        <label>Type</label>
                        <select id="hospType">
                            <option value="Medical College" ${h.hospital_type === 'Medical College' ? 'selected' : ''}>Medical College</option>
                            <option value="District Hospital" ${h.hospital_type === 'District Hospital' ? 'selected' : ''}>District Hospital</option>
                            <option value="Specialized Hospital" ${h.hospital_type === 'Specialized Hospital' ? 'selected' : ''}>Specialized Hospital</option>
                            <option value="Upazila Health Complex" ${h.hospital_type === 'Upazila Health Complex' ? 'selected' : ''}>Upazila Health Complex</option>
                            <option value="Union Sub-Center" ${h.hospital_type === 'Union Sub-Center' ? 'selected' : ''}>Union Sub-Center</option>
                            <option value="Community Clinic" ${h.hospital_type === 'Community Clinic' ? 'selected' : ''}>Community Clinic</option>
                            <option value="Private Hospital" ${h.hospital_type === 'Private Hospital' ? 'selected' : ''}>Private Hospital</option>
                        </select>
                    </div>
                    <div class="hospital-form-group">
                        <label>Division</label>
                        <input type="text" id="hospDivision" value="${this.esc(h.division || '')}">
                    </div>
                </div>
                <div class="hospital-form-row">
                    <div class="hospital-form-group">
                        <label>District</label>
                        <input type="text" id="hospDistrict" value="${this.esc(h.district || '')}">
                    </div>
                    <div class="hospital-form-group">
                        <label>Phone</label>
                        <input type="text" id="hospPhone" value="${this.esc(h.phone || '')}">
                    </div>
                </div>
                <div class="hospital-form-group">
                    <label>Address</label>
                    <input type="text" id="hospAddress" value="${this.esc(h.address || '')}">
                </div>
                <div class="hospital-form-row">
                    <div class="hospital-form-group">
                        <label>Total Beds</label>
                        <input type="number" id="hospBeds" value="${h.total_beds || ''}">
                    </div>
                    <div class="hospital-form-group">
                        <label>ICU Beds</label>
                        <input type="number" id="hospICU" value="${h.icu_beds || ''}">
                    </div>
                </div>
                <div class="hospital-form-row">
                    <div class="hospital-form-group">
                        <label>Available Beds</label>
                        <input type="number" id="hospEmergency" value="${h.available_beds || ''}">
                    </div>
                    <div class="hospital-form-group">
                        <label>Active</label>
                        <select id="hospActive">
                            <option value="1" ${h.is_active !== 0 ? 'selected' : ''}>Active</option>
                            <option value="0" ${h.is_active === 0 ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                </div>
                <div class="hospital-form-group">
                    <label>Departments (comma separated)</label>
                    <input type="text" id="hospDepts" value="${this.esc(h.departments || '')}" placeholder="Medicine, Surgery, Cardiology...">
                </div>
                <div class="hospital-form-group">
                    <label>Services / Facilities (comma separated)</label>
                    <input type="text" id="hospServices" value="${this.esc(h.facilities || '')}" placeholder="X-Ray, MRI, Dialysis...">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="AdminHealth.closeModal()">Cancel</button>
                    <button type="submit" class="btn-health"><i class="fas fa-save"></i> ${isEdit ? 'Save Changes' : 'Add Hospital'}</button>
                </div>
            </form>
        `;
    },

    getHospitalFormData() {
        return {
            name: document.getElementById('hospName').value,
            hospital_type: document.getElementById('hospType').value,
            division: document.getElementById('hospDivision').value,
            district: document.getElementById('hospDistrict').value,
            phone: document.getElementById('hospPhone').value,
            address: document.getElementById('hospAddress').value,
            total_beds: document.getElementById('hospBeds').value || null,
            icu_beds: document.getElementById('hospICU').value || null,
            available_beds: document.getElementById('hospEmergency').value || null,
            is_active: document.getElementById('hospActive').value,
            departments: document.getElementById('hospDepts').value,
            facilities: document.getElementById('hospServices').value
        };
    },

    async addHospital() {
        const body = this.getHospitalFormData();
        if (!body.name) return Swal.fire('Error', 'Hospital name is required', 'error');

        const data = await this.postAPI('/hospitals', body);
        if (data && data.message) {
            Swal.fire('Added!', data.message, 'success');
            this.closeModal();
            this.loadHospitals();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to add hospital', 'error');
        }
    },

    async saveHospital(id) {
        const body = this.getHospitalFormData();
        if (!body.name) return Swal.fire('Error', 'Hospital name is required', 'error');

        const data = await this.putAPI(`/hospitals/${id}`, body);
        if (data && data.message) {
            Swal.fire('Updated!', data.message, 'success');
            this.closeModal();
            this.loadHospitals();
        } else {
            Swal.fire('Error', data?.error || 'Failed to update hospital', 'error');
        }
    },

    async deleteHospital(id, name) {
        const result = await Swal.fire({
            title: 'Delete Hospital?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Yes, Delete'
        });

        if (!result.isConfirmed) return;

        const data = await this.deleteAPI(`/hospitals/${id}`);
        if (data && data.message) {
            Swal.fire('Deleted!', data.message, 'success');
            this.loadHospitals();
            this.loadStats();
        } else {
            Swal.fire('Error', data?.error || 'Failed to delete hospital', 'error');
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
            confirmButtonColor: '#dc2626',
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
document.addEventListener('DOMContentLoaded', () => AdminHealth.init());
