/**
 * ==============================================
 * স্বাস্থ্য মন্ত্রণালয় — Health Module Frontend JS
 * Ministry of Health and Family Welfare
 * ==============================================
 */

const HealthApp = {
    API: '/api/health',
    token: localStorage.getItem('token'),
    divisions: [],
    hospitals: [],

    // ===================== INIT =====================
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

    // ===================== NAVIGATION =====================
    setupNavigation() {
        window.showSection = (id) => {
            document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
            const target = document.getElementById(id);
            if (target) target.style.display = 'block';

            document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
            const navLink = document.querySelector(`.nav-links a[onclick="showSection('${id}')"]`);
            if (navLink) navLink.classList.add('active');

            // Load section-specific data
            switch (id) {
                case 'health-card': this.loadMyHealthCard(); break;
                case 'vaccination': this.loadVaccinationHistory(); break;
                case 'hospitals': this.loadHospitals(); break;
                case 'appointments': this.loadAppointmentHistory(); this.loadHospitalDropdown(); break;
                case 'ambulance': this.loadAmbulanceHistory(); break;
                case 'complaints': this.loadComplaintHistory(); break;
            }

            // Close mobile sidebar
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                if (sidebar) sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
            }
        };
    },

    // ===================== API HELPERS =====================
    async fetchAPI(url) {
        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = 'index.html';
                return null;
            }
            return await res.json();
        } catch (e) {
            console.error('Fetch error:', e);
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
                window.location.href = 'index.html';
                return null;
            }
            return await res.json();
        } catch (e) {
            console.error('Post error:', e);
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
            return await res.json();
        } catch (e) {
            console.error('Put error:', e);
            return null;
        }
    },

    // ===================== STATS =====================
    async loadStats() {
        const data = await this.fetchAPI(`${this.API}/my-stats`);
        if (!data) return;
        document.getElementById('stat-cards').textContent = data.health_cards || 0;
        document.getElementById('stat-vaccines').textContent = data.vaccinations || 0;
        document.getElementById('stat-appointments').textContent = data.appointments || 0;
        document.getElementById('stat-ambulance').textContent = data.ambulance_requests || 0;
        document.getElementById('stat-complaints').textContent = data.complaints || 0;
    },

    // ===================== ACTIVITY =====================
    async loadActivity() {
        const list = document.getElementById('recentActivityList');
        const data = await this.fetchAPI(`${this.API}/my-activity`);
        if (!data || data.length === 0) {
            list.innerHTML = '<div class="no-data"><i class="fas fa-inbox"></i>No recent activity</div>';
            return;
        }
        list.innerHTML = data.map(a => `
            <div class="activity-item">
                <div class="activity-left">
                    <span class="activity-type">${a.type}</span>
                    <span class="activity-date">${new Date(a.created_at).toLocaleDateString('en-GB')}</span>
                </div>
                <span class="badge badge-${this.getBadgeClass(a.status)}">${a.status}</span>
            </div>
        `).join('');
    },

    // ===================== LOCATIONS =====================
    async loadDivisions() {
        const data = await this.fetchAPI(`${this.API}/locations/divisions`);
        if (!data) return;
        this.divisions = data;
        const selectors = ['hc-division', 'amb-division', 'comp-division', 'hosp-filter-division'];
        selectors.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const firstOpt = el.options[0].outerHTML;
                el.innerHTML = firstOpt + data.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
            }
        });
    },

    async loadDistricts(prefix) {
        const divName = document.getElementById(`${prefix}-division`).value;
        const divObj = this.divisions.find(d => d.name === divName);
        const distSelect = document.getElementById(`${prefix}-district`);
        const upSelect = document.getElementById(`${prefix}-upazila`);

        distSelect.innerHTML = '<option value="">Select District</option>';
        if (upSelect) upSelect.innerHTML = '<option value="">Select Upazila</option>';

        if (!divObj) return;
        const data = await this.fetchAPI(`${this.API}/locations/districts/${divObj.id}`);
        if (data) {
            distSelect.innerHTML = '<option value="">Select District</option>' +
                data.map(d => `<option value="${d.name}" data-id="${d.id}">${d.name}</option>`).join('');
        }
    },

    async loadUpazilas(prefix) {
        const distSelect = document.getElementById(`${prefix}-district`);
        const selected = distSelect.options[distSelect.selectedIndex];
        const distId = selected?.getAttribute('data-id');
        const upSelect = document.getElementById(`${prefix}-upazila`);
        upSelect.innerHTML = '<option value="">Select Upazila</option>';

        if (!distId) return;
        const data = await this.fetchAPI(`${this.API}/locations/upazilas/${distId}`);
        if (data) {
            upSelect.innerHTML = '<option value="">Select Upazila</option>' +
                data.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
        }
    },

    async loadAmbDistricts() {
        const divName = document.getElementById('amb-division').value;
        const divObj = this.divisions.find(d => d.name === divName);
        const distSelect = document.getElementById('amb-district');
        distSelect.innerHTML = '<option value="">Select District</option>';
        if (!divObj) return;
        const data = await this.fetchAPI(`${this.API}/locations/districts/${divObj.id}`);
        if (data) {
            distSelect.innerHTML = '<option value="">Select District</option>' +
                data.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
        }
    },

    async loadCompDistricts() {
        const divName = document.getElementById('comp-division').value;
        const divObj = this.divisions.find(d => d.name === divName);
        const distSelect = document.getElementById('comp-district');
        distSelect.innerHTML = '<option value="">Select District</option>';
        if (!divObj) return;
        const data = await this.fetchAPI(`${this.API}/locations/districts/${divObj.id}`);
        if (data) {
            distSelect.innerHTML = '<option value="">Select District</option>' +
                data.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
        }
    },

    // ===================== HEALTH CARD =====================
    async loadMyHealthCard() {
        const container = document.getElementById('myHealthCardContainer');
        const data = await this.fetchAPI(`${this.API}/health-card/my`);
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-id-card"></i>No health card found. Apply above!</div>';
            return;
        }

        container.innerHTML = data.map(card => `
            <div class="digital-health-card">
                <div class="card-header">
                    <span class="card-title"><i class="fas fa-heartbeat"></i> Digital Health Card — Bangladesh</span>
                    <span class="badge badge-${this.getBadgeClass(card.status)}">${card.status}</span>
                </div>
                <div class="card-number">${card.card_number || 'N/A'}</div>
                <div class="card-details" style="margin-top: 1rem;">
                    <div class="card-field">
                        <span class="label">Full Name</span>
                        <span class="value">${card.full_name}</span>
                    </div>
                    <div class="card-field">
                        <span class="label">NID</span>
                        <span class="value">${card.nid_number}</span>
                    </div>
                    <div class="card-field">
                        <span class="label">Date of Birth</span>
                        <span class="value">${card.date_of_birth ? new Date(card.date_of_birth).toLocaleDateString('en-GB') : 'N/A'}</span>
                    </div>
                    <div class="card-field">
                        <span class="label">Gender</span>
                        <span class="value">${card.gender}</span>
                    </div>
                    <div class="card-field">
                        <span class="label">Blood Group</span>
                        <span class="value">${card.blood_group || 'N/A'}</span>
                    </div>
                    <div class="card-field">
                        <span class="label">Phone</span>
                        <span class="value">${card.phone}</span>
                    </div>
                    <div class="card-field">
                        <span class="label">District</span>
                        <span class="value">${card.district}, ${card.division}</span>
                    </div>
                    <div class="card-field">
                        <span class="label">Applied</span>
                        <span class="value">${new Date(card.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                </div>
                ${card.admin_remarks ? `<div style="margin-top: 1rem; padding: 0.8rem; background: rgba(239,68,68,0.1); border-radius: 8px; border: 1px solid rgba(239,68,68,0.2);"><span style="color: #fca5a5; font-size: 0.8rem;"><i class="fas fa-comment-alt"></i> Admin: ${card.admin_remarks}</span></div>` : ''}
            </div>
        `).join('');
    },

    // ===================== VACCINATION =====================
    onVaccineTypeChange() {
        const type = document.getElementById('vac-type').value;
        const nameInput = document.getElementById('vac-name');
        const vaccineNames = {
            'COVID-19': 'Pfizer / AstraZeneca / Sinopharm / Moderna',
            'Hepatitis B': 'Engerix-B',
            'BCG': 'BCG Vaccine',
            'Polio': 'OPV / IPV',
            'DPT': 'Pentavalent',
            'Measles': 'MR Vaccine',
            'TT': 'Tetanus Toxoid',
            'Pneumococcal': 'PCV-10',
            'Influenza': 'Flu Vaccine',
            'Rabies': 'Rabipur',
            'Typhoid': 'Typhoid Vi',
            'Cholera': 'Shanchol'
        };
        nameInput.placeholder = vaccineNames[type] || 'Vaccine name';
    },

    async loadVaccinationHistory() {
        const tbody = document.getElementById('vaccineHistoryBody');
        const data = await this.fetchAPI(`${this.API}/vaccination/my`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No vaccination records found.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(v => `
            <tr>
                <td>${v.vaccine_name}</td>
                <td>${v.vaccine_type}</td>
                <td>${v.dose_number || 1}</td>
                <td>${v.vaccination_date ? new Date(v.vaccination_date).toLocaleDateString('en-GB') : 'TBD'}</td>
                <td>${v.vaccination_center || '-'}</td>
                <td><span class="badge badge-${this.getBadgeClass(v.status)}">${v.status}</span></td>
                <td>${v.certificate_number ? `<span style="color: #34d399; font-size: 0.8rem;"><i class="fas fa-certificate"></i> ${v.certificate_number}</span>` : '-'}</td>
            </tr>
        `).join('');
    },

    // ===================== HOSPITALS =====================
    async loadHospitals() {
        const grid = document.getElementById('hospitalGrid');
        const data = await this.fetchAPI(`${this.API}/hospitals`);
        if (!data || data.length === 0) {
            grid.innerHTML = '<div class="no-data" style="grid-column: 1/-1;"><i class="fas fa-hospital"></i>No hospitals found.</div>';
            return;
        }
        this.hospitals = data;
        this.renderHospitals(data);
    },

    renderHospitals(hospitals) {
        const grid = document.getElementById('hospitalGrid');
        if (hospitals.length === 0) {
            grid.innerHTML = '<div class="no-data" style="grid-column: 1/-1;"><i class="fas fa-search"></i>No hospitals match your search.</div>';
            return;
        }
        grid.innerHTML = hospitals.map(h => `
            <div class="hospital-item">
                <h4>${h.name}</h4>
                ${h.name_bn ? `<span class="hospital-bn-name">${h.name_bn}</span>` : ''}
                <span class="hospital-type-badge">${h.hospital_type}</span>
                <div class="hospital-info">
                    <span><i class="fas fa-map-marker-alt"></i> ${h.district}, ${h.division}</span>
                    ${h.phone ? `<span><i class="fas fa-phone"></i> ${h.phone}</span>` : ''}
                    ${h.emergency_phone ? `<span><i class="fas fa-phone-volume"></i> Emergency: ${h.emergency_phone}</span>` : ''}
                </div>
                <div class="hospital-beds-row">
                    <span class="bed-badge available"><i class="fas fa-bed"></i> ${h.available_beds}/${h.total_beds} Beds</span>
                    <span class="bed-badge icu"><i class="fas fa-procedures"></i> ${h.available_icu_beds}/${h.icu_beds} ICU</span>
                </div>
                <div class="hospital-tags">
                    ${h.ambulance_available ? '<span class="hospital-tag active"><i class="fas fa-ambulance"></i> Ambulance</span>' : ''}
                    ${h.blood_bank ? '<span class="hospital-tag active"><i class="fas fa-tint"></i> Blood Bank</span>' : ''}
                    ${h.departments ? h.departments.split(',').slice(0, 4).map(d => `<span class="hospital-tag">${d.trim()}</span>`).join('') : ''}
                </div>
            </div>
        `).join('');
    },

    filterHospitals() {
        const division = document.getElementById('hosp-filter-division').value;
        const type = document.getElementById('hosp-filter-type').value;
        const search = document.getElementById('hosp-filter-search').value.toLowerCase();

        let filtered = this.hospitals;
        if (division) filtered = filtered.filter(h => h.division === division);
        if (type) filtered = filtered.filter(h => h.hospital_type === type);
        if (search) filtered = filtered.filter(h =>
            h.name.toLowerCase().includes(search) || (h.name_bn && h.name_bn.includes(search))
        );
        this.renderHospitals(filtered);
    },

    // ===================== APPOINTMENTS =====================
    async loadHospitalDropdown() {
        const select = document.getElementById('apt-hospital');
        if (this.hospitals.length === 0) {
            const data = await this.fetchAPI(`${this.API}/hospitals`);
            if (data) this.hospitals = data;
        }
        select.innerHTML = '<option value="">Select Hospital</option>' +
            this.hospitals.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
    },

    async loadAppointmentHistory() {
        const tbody = document.getElementById('appointmentHistoryBody');
        const data = await this.fetchAPI(`${this.API}/appointment/my`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No appointments found.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(a => `
            <tr>
                <td>${a.hospital_name || '-'}</td>
                <td>${a.department}</td>
                <td>${a.doctor_name || 'TBA'}</td>
                <td>${new Date(a.appointment_date).toLocaleDateString('en-GB')}${a.appointment_time ? ' ' + a.appointment_time : ''}</td>
                <td><span class="badge badge-${a.urgency.toLowerCase()}">${a.urgency}</span></td>
                <td><span class="badge badge-${this.getBadgeClass(a.status)}">${a.status}</span></td>
                <td>${a.status === 'Pending' ? `<button class="btn-cancel-sm" onclick="HealthApp.cancelAppointment(${a.id})"><i class="fas fa-times"></i> Cancel</button>` : (a.prescription ? `<button class="btn-health-sm" onclick="HealthApp.viewPrescription('${this.escapeHtml(a.prescription)}')"><i class="fas fa-file-medical"></i></button>` : '-')}</td>
            </tr>
        `).join('');
    },

    async cancelAppointment(id) {
        const result = await Swal.fire({
            title: 'Cancel Appointment?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, Cancel',
            cancelButtonText: 'No',
            background: '#0f172a',
            color: '#fff',
            confirmButtonColor: '#dc2626'
        });

        if (result.isConfirmed) {
            const data = await this.putAPI(`${this.API}/appointment/cancel/${id}`, {});
            if (data && data.success) {
                Swal.fire({ icon: 'success', title: 'Cancelled', text: 'Appointment has been cancelled.', background: '#0f172a', color: '#fff', timer: 2000 });
                this.loadAppointmentHistory();
                this.loadStats();
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: data?.error || 'Failed to cancel.', background: '#0f172a', color: '#fff' });
            }
        }
    },

    viewPrescription(text) {
        Swal.fire({
            title: 'Prescription',
            html: `<div style="text-align: left; color: #e2e8f0; font-size: 0.9rem; white-space: pre-wrap;">${text}</div>`,
            background: '#0f172a',
            color: '#fff',
            confirmButtonColor: '#dc2626',
            width: '500px'
        });
    },

    // ===================== AMBULANCE =====================
    async loadAmbulanceHistory() {
        const tbody = document.getElementById('ambulanceHistoryBody');
        const data = await this.fetchAPI(`${this.API}/ambulance/my`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No ambulance requests found.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(a => `
            <tr>
                <td>${a.patient_name}</td>
                <td>${a.emergency_type}</td>
                <td>${a.district}, ${a.division}</td>
                <td><span class="badge badge-${a.urgency.toLowerCase()}">${a.urgency}</span></td>
                <td><span class="badge badge-${this.getBadgeClass(a.status)}">${a.status}</span></td>
                <td>${new Date(a.created_at).toLocaleDateString('en-GB')}</td>
            </tr>
        `).join('');
    },

    // ===================== COMPLAINTS =====================
    async loadComplaintHistory() {
        const tbody = document.getElementById('complaintHistoryBody');
        const data = await this.fetchAPI(`${this.API}/complaint/my`);
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">No complaints found.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(c => `
            <tr>
                <td>${c.complaint_type}</td>
                <td>${c.hospital_name || '-'}</td>
                <td><span class="badge badge-${this.getBadgeClass(c.status)}">${c.status}</span></td>
                <td>${c.resolution || '-'}</td>
                <td>${new Date(c.created_at).toLocaleDateString('en-GB')}</td>
            </tr>
        `).join('');
    },

    // ===================== FORM HANDLERS =====================
    bindForms() {
        // Health Card Form
        const hcForm = document.getElementById('healthCardForm');
        if (hcForm) {
            hcForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const body = {
                    full_name: document.getElementById('hc-fullname').value,
                    father_name: document.getElementById('hc-father').value,
                    mother_name: document.getElementById('hc-mother').value,
                    nid_number: document.getElementById('hc-nid').value,
                    date_of_birth: document.getElementById('hc-dob').value,
                    gender: document.getElementById('hc-gender').value,
                    blood_group: document.getElementById('hc-blood').value,
                    phone: document.getElementById('hc-phone').value,
                    emergency_contact: document.getElementById('hc-emergency').value,
                    division: document.getElementById('hc-division').value,
                    district: document.getElementById('hc-district').value,
                    upazila: document.getElementById('hc-upazila').value,
                    address: document.getElementById('hc-address').value,
                    allergies: document.getElementById('hc-allergies').value,
                    chronic_diseases: document.getElementById('hc-chronic').value,
                    disability: document.getElementById('hc-disability').value
                };

                const data = await this.postAPI(`${this.API}/health-card/apply`, body);
                if (data && data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Application Submitted!',
                        html: `Your Health Card Number: <strong>${data.card_number}</strong>`,
                        background: '#0f172a',
                        color: '#fff',
                        confirmButtonColor: '#dc2626'
                    });
                    hcForm.reset();
                    this.loadMyHealthCard();
                    this.loadStats();
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data?.error || 'Submission failed.', background: '#0f172a', color: '#fff' });
                }
            });
        }

        // Vaccination Form
        const vacForm = document.getElementById('vaccineForm');
        if (vacForm) {
            vacForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const body = {
                    vaccine_type: document.getElementById('vac-type').value,
                    vaccine_name: document.getElementById('vac-name').value,
                    dose_number: document.getElementById('vac-dose').value,
                    vaccination_date: document.getElementById('vac-date').value || null,
                    vaccination_center: document.getElementById('vac-center').value || null
                };

                const data = await this.postAPI(`${this.API}/vaccination/register`, body);
                if (data && data.success) {
                    Swal.fire({ icon: 'success', title: 'Registered!', text: 'Vaccination registration successful.', background: '#0f172a', color: '#fff', timer: 2500 });
                    vacForm.reset();
                    this.loadVaccinationHistory();
                    this.loadStats();
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data?.error || 'Registration failed.', background: '#0f172a', color: '#fff' });
                }
            });
        }

        // Appointment Form
        const aptForm = document.getElementById('appointmentForm');
        if (aptForm) {
            aptForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const body = {
                    hospital_id: document.getElementById('apt-hospital').value || null,
                    patient_name: document.getElementById('apt-name').value,
                    patient_age: document.getElementById('apt-age').value || null,
                    patient_gender: document.getElementById('apt-gender').value || null,
                    phone: document.getElementById('apt-phone').value,
                    department: document.getElementById('apt-department').value,
                    doctor_name: document.getElementById('apt-doctor').value || null,
                    appointment_date: document.getElementById('apt-date').value,
                    appointment_time: document.getElementById('apt-time').value || null,
                    symptoms: document.getElementById('apt-symptoms').value || null,
                    urgency: document.getElementById('apt-urgency').value
                };

                const data = await this.postAPI(`${this.API}/appointment/book`, body);
                if (data && data.success) {
                    Swal.fire({ icon: 'success', title: 'Booked!', text: 'Your appointment has been booked.', background: '#0f172a', color: '#fff', timer: 2500 });
                    aptForm.reset();
                    this.loadAppointmentHistory();
                    this.loadStats();
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data?.error || 'Booking failed.', background: '#0f172a', color: '#fff' });
                }
            });
        }

        // Ambulance Form
        const ambForm = document.getElementById('ambulanceForm');
        if (ambForm) {
            ambForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const body = {
                    patient_name: document.getElementById('amb-name').value,
                    phone: document.getElementById('amb-phone').value,
                    emergency_type: document.getElementById('amb-type').value,
                    division: document.getElementById('amb-division').value,
                    district: document.getElementById('amb-district').value,
                    pickup_address: document.getElementById('amb-address').value,
                    destination_hospital: document.getElementById('amb-destination').value || null,
                    urgency: document.getElementById('amb-urgency').value,
                    ambulance_type: document.getElementById('amb-ambulance-type').value
                };

                const data = await this.postAPI(`${this.API}/ambulance/request`, body);
                if (data && data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Request Submitted!',
                        text: 'Emergency services will contact you shortly.',
                        background: '#0f172a',
                        color: '#fff',
                        confirmButtonColor: '#dc2626'
                    });
                    ambForm.reset();
                    this.loadAmbulanceHistory();
                    this.loadStats();
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data?.error || 'Request failed.', background: '#0f172a', color: '#fff' });
                }
            });
        }

        // Complaint Form
        const compForm = document.getElementById('complaintForm');
        if (compForm) {
            compForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const body = {
                    complaint_type: document.getElementById('comp-type').value,
                    hospital_name: document.getElementById('comp-hospital').value || null,
                    division: document.getElementById('comp-division').value || null,
                    district: document.getElementById('comp-district').value || null,
                    description: document.getElementById('comp-description').value
                };

                const data = await this.postAPI(`${this.API}/complaint/submit`, body);
                if (data && data.success) {
                    Swal.fire({ icon: 'success', title: 'Submitted!', text: 'Your complaint has been recorded.', background: '#0f172a', color: '#fff', timer: 2500 });
                    compForm.reset();
                    this.loadComplaintHistory();
                    this.loadStats();
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data?.error || 'Submission failed.', background: '#0f172a', color: '#fff' });
                }
            });
        }
    },

    // ===================== HELPERS =====================
    getBadgeClass(status) {
        const map = {
            'Pending': 'pending', 'Approved': 'approved', 'Rejected': 'rejected',
            'Registered': 'registered', 'Scheduled': 'scheduled', 'Completed': 'completed',
            'Cancelled': 'cancelled', 'Confirmed': 'confirmed', 'No Show': 'noshow',
            'Submitted': 'submitted', 'Under Review': 'review', 'Resolved': 'resolved',
            'Requested': 'requested', 'Dispatched': 'dispatched', 'En Route': 'enroute',
            'Arrived': 'arrived', 'Normal': 'normal', 'Urgent': 'urgent',
            'Emergency': 'emergency', 'Critical': 'critical'
        };
        return map[status] || 'pending';
    },

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
};

// ===================== INIT ON LOAD =====================
document.addEventListener('DOMContentLoaded', () => {
    HealthApp.init();
});
