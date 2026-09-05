/**
 * e-Passport Services — Frontend Application
 * Department of Immigration & Passports (DIP)
 * Government of the People's Republic of Bangladesh
 */

const PassportApp = {
    token: localStorage.getItem('token'),
    API: '/api/passport',
    currentStep: 1,
    totalSteps: 5,
    feeSchedule: [],
    offices: [],

    // ===================== INIT =====================
    init() {
        if (!this.token) {
            window.location.href = 'index.html';
            return;
        }
        this.setupNavigation();
        this.setupServiceTypeListeners();
        this.loadStats();
        this.loadRecentActivity();
        this.loadOfficesDropdown();
        this.loadDivisions();
        this.loadFeeSchedule();
        this.calculateFee();
        this.calcFee();
    },

    // ===================== NAVIGATION =====================
    setupNavigation() {
        window.showSection = (id) => {
            document.querySelectorAll('.content-section').forEach(el => el.style.display = 'none');
            const section = document.getElementById(id);
            if (section) section.style.display = 'block';

            document.querySelectorAll('.sidebar .nav-links a').forEach(a => a.classList.remove('active'));
            const nameMap = {
                'overview': 'Overview',
                'apply': 'New Application',
                'track': 'Track Application',
                'applications': 'My Applications',
                'fees': 'Fee Calculator',
                'offices': 'Passport Offices',
                'guidelines': 'Guidelines'
            };
            const text = nameMap[id];
            if (text) {
                Array.from(document.querySelectorAll('.sidebar .nav-links a'))
                    .find(a => a.innerText.includes(text))?.classList.add('active');
            }

            // Load section-specific data
            if (id === 'applications') this.loadMyApplications();
            if (id === 'offices') this.loadOffices();
            if (id === 'fees') this.calcFee();
            if (id === 'apply') {
                this.togglePreviousPassport();
                this.calculateFee();
            }
        };

        // Multi-step form functions
        window.nextStep = (step) => this.goToStepValidated(step);
        window.prevStep = (step) => this.goToStep(step);
        window.goToStep = (step) => this.goToStep(step);

        // Form functions
        window.calculateFee = () => this.calculateFee();
        window.calcFee = () => this.calcFee();
        window.handleSameAddress = () => this.handleSameAddress();
        window.handleFileSelect = (input, cardId) => this.handleFileSelect(input, cardId);
        window.submitApplication = () => this.submitApplication();
        window.trackApplication = () => this.trackApplication();
        window.toggleGuideline = (header) => this.toggleGuideline(header);

        // Location helpers
        window.loadDistricts = (prefix) => this.loadDistricts(prefix);
        window.loadUpazilas = (prefix) => this.loadUpazilas(prefix);
    },

    // ===================== SERVICE TYPE LISTENERS =====================
    setupServiceTypeListeners() {
        const radios = document.querySelectorAll('input[name="service_type"]');
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                document.querySelectorAll('.service-type-option').forEach(opt => opt.classList.remove('selected'));
                radio.closest('.service-type-option').classList.add('selected');
                this.togglePreviousPassport();
                this.calculateFee();
            });
        });
    },

    togglePreviousPassport() {
        const serviceType = document.querySelector('input[name="service_type"]:checked')?.value;
        const prevSection = document.getElementById('previousPassportSection');
        const uploadOld = document.getElementById('uploadOldPassport');
        const uploadAffidavit = document.getElementById('uploadAffidavit');
        const penaltyRow = document.getElementById('penaltyRow');

        const needsPrev = ['Renewal', 'Lost Replacement', 'Damaged Replacement', 'Correction', 'Duplicate'].includes(serviceType);
        const needsAffidavit = serviceType === 'Lost Replacement';
        const hasPenalty = ['Lost Replacement', 'Damaged Replacement'].includes(serviceType);

        if (prevSection) prevSection.style.display = needsPrev ? 'block' : 'none';
        if (uploadOld) uploadOld.style.display = needsPrev ? 'flex' : 'none';
        if (uploadAffidavit) uploadAffidavit.style.display = needsAffidavit ? 'flex' : 'none';
        if (penaltyRow) penaltyRow.style.display = hasPenalty ? 'flex' : 'none';
    },

    // ===================== API HELPERS =====================
    async fetchAPI(url) {
        try {
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.token}` } });
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'index.html';
                return null;
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || res.statusText);
            }
            return res.json();
        } catch (e) {
            console.error('API Error:', e);
            throw e;
        }
    },

    async postAPI(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
            body: JSON.stringify(body)
        });
        return res.json();
    },

    async putAPI(url, body) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
            body: JSON.stringify(body)
        });
        return res.json();
    },

    // ===================== STATS =====================
    async loadStats() {
        try {
            const data = await this.fetchAPI(`${this.API}/stats`);
            if (data) {
                document.getElementById('stat-total').textContent = data.total || 0;
                document.getElementById('stat-active').textContent = data.active || 0;
                document.getElementById('stat-delivered').textContent = data.delivered || 0;
                document.getElementById('stat-pending').textContent = data.pending || 0;
            }
        } catch (e) {
            console.error('Failed to load stats', e);
        }
    },

    // ===================== RECENT ACTIVITY =====================
    async loadRecentActivity() {
        const container = document.getElementById('recentApplicationsContainer');
        try {
            const data = await this.fetchAPI(`${this.API}/recent-activity`);
            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div class="pp-empty-state">
                        <i class="fas fa-passport"></i>
                        <p>No applications yet. Start by applying for an e-Passport!</p>
                    </div>`;
                return;
            }
            container.innerHTML = `
                <div style="overflow-x: auto;">
                    <table class="pp-table">
                        <thead>
                            <tr>
                                <th>App Number</th>
                                <th>Service</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(app => `
                                <tr>
                                    <td style="font-family: monospace; color: var(--pp-accent);">${app.application_number}</td>
                                    <td>${app.service_type}</td>
                                    <td>${app.passport_type}</td>
                                    <td><span class="badge-${this.statusClass(app.status)}">${app.status}</span></td>
                                    <td>${this.formatDate(app.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
        } catch (e) {
            container.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 2rem;">Failed to load recent activity.</p>';
        }
    },

    // ===================== MULTI-STEP FORM =====================
    goToStep(step) {
        if (step < 1 || step > this.totalSteps) return;
        // Hide all steps
        document.querySelectorAll('.form-step').forEach(el => el.classList.remove('active'));
        const target = document.getElementById(`step${step}`);
        if (target) target.classList.add('active');

        // Update step indicator
        this.updateStepIndicator(step);
        this.currentStep = step;

        // If going to review step, build summary
        if (step === 5) this.buildReviewSummary();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    goToStepValidated(step) {
        // Validate current step before advancing
        if (step > this.currentStep) {
            if (!this.validateStep(this.currentStep)) return;
        }
        this.goToStep(step);
    },

    validateStep(step) {
        if (step === 1) {
            const office = document.getElementById('preferredOffice').value;
            if (!office) {
                Swal.fire({ icon: 'warning', title: 'Select Passport Office', text: 'Please select your preferred Regional Passport Office.', background: '#0f172a', color: '#fff' });
                return false;
            }
            return true;
        }
        if (step === 2) {
            const name = document.getElementById('fullNameEn').value.trim();
            const father = document.getElementById('fatherNameEn').value.trim();
            const mother = document.getElementById('motherNameEn').value.trim();
            const dob = document.getElementById('dateOfBirth').value;
            const gender = document.getElementById('gender').value;

            if (!name || !father || !mother || !dob || !gender) {
                Swal.fire({ icon: 'warning', title: 'Missing Required Fields', text: 'Please fill in all required personal information fields.', background: '#0f172a', color: '#fff' });
                return false;
            }
            return true;
        }
        if (step === 3) {
            const div = document.getElementById('presentDivision').value;
            const dist = document.getElementById('presentDistrict').value;
            if (!div || !dist) {
                Swal.fire({ icon: 'warning', title: 'Missing Address', text: 'Please select at least Division and District for present address.', background: '#0f172a', color: '#fff' });
                return false;
            }
            return true;
        }
        if (step === 4) {
            const mobile = document.getElementById('mobileNumber').value.trim();
            if (!mobile) {
                Swal.fire({ icon: 'warning', title: 'Mobile Number Required', text: 'Please enter your mobile number.', background: '#0f172a', color: '#fff' });
                return false;
            }
            return true;
        }
        return true;
    },

    updateStepIndicator(activeStep) {
        const circles = document.querySelectorAll('.step-circle');
        const lines = document.querySelectorAll('.step-line');

        circles.forEach((circle, i) => {
            const num = i + 1;
            circle.classList.remove('active', 'completed');
            if (num < activeStep) circle.classList.add('completed');
            else if (num === activeStep) circle.classList.add('active');
        });

        lines.forEach((line, i) => {
            line.classList.remove('active');
            if (i + 1 < activeStep) line.classList.add('active');
        });
    },

    // ===================== FEE CALCULATION (Application Form) =====================
    async calculateFee() {
        const passportType = document.getElementById('passportType')?.value || 'Ordinary';
        const pageCount = document.getElementById('pageCount')?.value || '48';
        const validityYears = document.getElementById('validityYears')?.value || '5';
        const deliveryType = document.getElementById('deliveryType')?.value || 'Regular';
        const serviceType = document.querySelector('input[name="service_type"]:checked')?.value || 'New';

        try {
            const data = await this.fetchAPI(
                `${this.API}/fee/calculate?passport_type=${passportType}&page_count=${pageCount}&validity_years=${validityYears}&delivery_type=${deliveryType}&service_type=${serviceType}`
            );
            if (data) {
                document.getElementById('feeBase').textContent = `৳ ${this.formatMoney(data.base_fee)}`;
                document.getElementById('feeTotal').textContent = `৳ ${this.formatMoney(data.total_fee)}`;
                if (data.penalty > 0) {
                    document.getElementById('feePenalty').textContent = `৳ ${this.formatMoney(data.penalty)}`;
                    document.getElementById('penaltyRow').style.display = 'flex';
                }
            }
        } catch (e) {
            // Fallback calculation
            this.calculateFeeLocal('feeBase', 'feeTotal', 'feePenalty', 'penaltyRow',
                passportType, pageCount, validityYears, deliveryType, serviceType);
        }
    },

    // ===================== FEE CALCULATION (Fee Calculator Section) =====================
    async calcFee() {
        const passportType = document.getElementById('calcPassportType')?.value || 'Ordinary';
        const pageCount = document.getElementById('calcPageCount')?.value || '48';
        const validity = document.getElementById('calcValidity')?.value || '5';
        const delivery = document.getElementById('calcDelivery')?.value || 'Regular';
        const serviceType = document.getElementById('calcServiceType')?.value || 'New';

        try {
            const data = await this.fetchAPI(
                `${this.API}/fee/calculate?passport_type=${passportType}&page_count=${pageCount}&validity_years=${validity}&delivery_type=${delivery}&service_type=${serviceType}`
            );
            if (data) {
                document.getElementById('calcFeeBase').textContent = `৳ ${this.formatMoney(data.base_fee)}`;
                document.getElementById('calcFeeTotal').textContent = `৳ ${this.formatMoney(data.total_fee)}`;
                if (data.penalty > 0) {
                    document.getElementById('calcFeePenalty').textContent = `৳ ${this.formatMoney(data.penalty)}`;
                    document.getElementById('calcPenaltyRow').style.display = 'flex';
                } else {
                    document.getElementById('calcPenaltyRow').style.display = 'none';
                }
            }
        } catch (e) {
            this.calculateFeeLocal('calcFeeBase', 'calcFeeTotal', 'calcFeePenalty', 'calcPenaltyRow',
                passportType, pageCount, validity, delivery, serviceType);
        }
    },

    calculateFeeLocal(baseId, totalId, penaltyId, penaltyRowId, passportType, pages, validity, delivery, serviceType) {
        // Fallback fee table (BDT) for Ordinary type
        const feeTable = {
            '48_5': 3450, '48_10': 5750,
            '64_5': 4600, '64_10': 6900
        };
        const deliveryMultiplier = { 'Regular': 1, 'Express': 2, 'Super Express': 4 };

        let baseFee = feeTable[`${pages}_${validity}`] || 3450;
        baseFee *= (deliveryMultiplier[delivery] || 1);

        let penalty = 0;
        if (['Lost Replacement', 'Damaged Replacement'].includes(serviceType)) penalty = 5000;

        const total = baseFee + penalty;

        document.getElementById(baseId).textContent = `৳ ${this.formatMoney(baseFee)}`;
        document.getElementById(totalId).textContent = `৳ ${this.formatMoney(total)}`;
        if (penalty > 0) {
            document.getElementById(penaltyId).textContent = `৳ ${this.formatMoney(penalty)}`;
            document.getElementById(penaltyRowId).style.display = 'flex';
        } else {
            document.getElementById(penaltyRowId).style.display = 'none';
        }
    },

    async loadFeeSchedule() {
        try {
            const data = await this.fetchAPI(`${this.API}/fees`);
            if (data) this.feeSchedule = data;
        } catch (e) { console.error('Failed to load fee schedule', e); }
    },

    // ===================== LOCATIONS =====================
    async loadDivisions() {
        try {
            const divs = await this.fetchAPI(`${this.API}/locations/divisions`);
            if (!divs) return;

            ['presentDivision', 'permanentDivision'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerHTML = '<option value="">Select Division</option>';
                    divs.forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = d.id;
                        opt.textContent = d.name;
                        el.appendChild(opt);
                    });
                }
            });
        } catch (e) { console.error('Failed to load divisions', e); }
    },

    async loadDistricts(prefix) {
        const divId = document.getElementById(`${prefix}Division`)?.value;
        const distSelect = document.getElementById(`${prefix}District`);
        const upaSelect = document.getElementById(`${prefix}Upazila`);
        if (distSelect) distSelect.innerHTML = '<option value="">Select District</option>';
        if (upaSelect) upaSelect.innerHTML = '<option value="">Select Upazila</option>';

        if (!divId) return;
        try {
            const dists = await this.fetchAPI(`${this.API}/locations/districts/${divId}`);
            if (dists) {
                dists.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = d.name;
                    distSelect.appendChild(opt);
                });
            }
        } catch (e) { console.error(e); }
    },

    async loadUpazilas(prefix) {
        const distId = document.getElementById(`${prefix}District`)?.value;
        const upaSelect = document.getElementById(`${prefix}Upazila`);
        if (!upaSelect) return;
        upaSelect.innerHTML = '<option value="">Select Upazila</option>';

        if (!distId) return;
        try {
            const upas = await this.fetchAPI(`${this.API}/locations/upazilas/${distId}`);
            if (upas) {
                upas.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.textContent = u.name;
                    upaSelect.appendChild(opt);
                });
            }
        } catch (e) { console.error(e); }
    },

    // ===================== SAME ADDRESS HANDLER =====================
    handleSameAddress() {
        const checked = document.getElementById('sameAsPresent').checked;
        const permFields = document.getElementById('permanentAddressFields');

        if (checked) {
            // Copy present to permanent
            const fields = ['Division', 'District', 'Upazila', 'PostOffice', 'PostalCode', 'VillageRoad', 'CareOf'];
            fields.forEach(field => {
                const src = document.getElementById(`present${field}`);
                const dest = document.getElementById(`permanent${field}`);
                if (src && dest) {
                    dest.value = src.value;
                    if (src.tagName === 'SELECT') {
                        // Trigger change to load dependent dropdowns
                        dest.dispatchEvent(new Event('change'));
                    }
                }
            });
            permFields.style.opacity = '0.5';
            permFields.style.pointerEvents = 'none';
        } else {
            permFields.style.opacity = '1';
            permFields.style.pointerEvents = 'auto';
        }
    },

    // ===================== FILE UPLOAD HANDLER =====================
    handleFileSelect(input, cardId) {
        const card = document.getElementById(cardId);
        const fileNameDiv = card.querySelector('.file-name');

        if (input.files && input.files[0]) {
            const file = input.files[0];
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (file.size > maxSize) {
                Swal.fire({ icon: 'error', title: 'File Too Large', text: 'Maximum file size is 5MB.', background: '#0f172a', color: '#fff' });
                input.value = '';
                return;
            }

            card.classList.add('has-file');
            fileNameDiv.textContent = file.name;
        } else {
            card.classList.remove('has-file');
            fileNameDiv.textContent = '';
        }
    },

    // ===================== OFFICES =====================
    async loadOfficesDropdown() {
        try {
            const data = await this.fetchAPI(`${this.API}/offices`);
            if (!data) return;
            this.offices = data;
            const select = document.getElementById('preferredOffice');
            if (select) {
                select.innerHTML = '<option value="">Select Passport Office</option>';
                data.forEach(office => {
                    const opt = document.createElement('option');
                    opt.value = office.office_code;
                    opt.textContent = `${office.office_name} (${office.office_name_bn || office.division})`;
                    select.appendChild(opt);
                });
            }
        } catch (e) { console.error('Failed to load offices', e); }
    },

    async loadOffices() {
        const grid = document.getElementById('officesGrid');
        try {
            let data = this.offices;
            if (!data || data.length === 0) {
                data = await this.fetchAPI(`${this.API}/offices`);
                this.offices = data;
            }
            if (!data || data.length === 0) {
                grid.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 3rem;">No offices found.</p>';
                return;
            }

            grid.innerHTML = data.map(office => `
                <div class="office-card">
                    <div class="office-header">
                        <i class="fas fa-building-columns"></i>
                        <div>
                            <h4>${office.office_name}</h4>
                            ${office.office_name_bn ? `<span class="bn" style="font-size: 0.85rem;">${office.office_name_bn}</span>` : ''}
                        </div>
                    </div>
                    <div class="office-details">
                        ${office.address ? `<p><i class="fas fa-map-marker-alt"></i> ${office.address}</p>` : ''}
                        ${office.phone ? `<p><i class="fas fa-phone"></i> ${office.phone}</p>` : ''}
                        ${office.email ? `<p><i class="fas fa-envelope"></i> ${office.email}</p>` : ''}
                        ${office.division ? `<p><i class="fas fa-map"></i> ${office.division} Division</p>` : ''}
                        <p><i class="fas fa-clock"></i> ${office.working_hours || 'Sun-Thu: 9:00 AM - 5:00 PM'}</p>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            grid.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 3rem;">Failed to load offices.</p>';
        }
    },

    // ===================== BUILD REVIEW SUMMARY =====================
    buildReviewSummary() {
        const container = document.getElementById('reviewSummary');
        const serviceType = document.querySelector('input[name="service_type"]:checked')?.value || '-';
        const passportType = document.getElementById('passportType')?.selectedOptions[0]?.text || '-';
        const pages = document.getElementById('pageCount')?.selectedOptions[0]?.text || '-';
        const validity = document.getElementById('validityYears')?.selectedOptions[0]?.text || '-';
        const delivery = document.getElementById('deliveryType')?.selectedOptions[0]?.text || '-';
        const office = document.getElementById('preferredOffice')?.selectedOptions[0]?.text || '-';
        const feeTotal = document.getElementById('feeTotal')?.textContent || '৳ 0';

        const name = document.getElementById('fullNameEn')?.value || '-';
        const nameBn = document.getElementById('fullNameBn')?.value || '';
        const father = document.getElementById('fatherNameEn')?.value || '-';
        const mother = document.getElementById('motherNameEn')?.value || '-';
        const dob = document.getElementById('dateOfBirth')?.value || '-';
        const gender = document.getElementById('gender')?.value || '-';
        const nid = document.getElementById('nidNumber')?.value || '-';
        const mobile = document.getElementById('mobileNumber')?.value || '-';
        const email = document.getElementById('emailAddress')?.value || '-';

        const presDivText = document.getElementById('presentDivision')?.selectedOptions[0]?.text || '-';
        const presDistText = document.getElementById('presentDistrict')?.selectedOptions[0]?.text || '-';

        container.innerHTML = `
            <div class="review-section">
                <h4><i class="fas fa-cogs"></i> Service Details</h4>
                <div class="review-row"><span>Application Type</span><span>${serviceType}</span></div>
                <div class="review-row"><span>Passport Type</span><span>${passportType}</span></div>
                <div class="review-row"><span>Pages / Validity</span><span>${pages} / ${validity}</span></div>
                <div class="review-row"><span>Delivery</span><span>${delivery}</span></div>
                <div class="review-row"><span>Preferred Office</span><span>${office}</span></div>
                <div class="review-row"><span>Estimated Fee</span><span style="color: var(--pp-gold); font-weight: 700;">${feeTotal}</span></div>
            </div>
            <div class="review-section">
                <h4><i class="fas fa-user"></i> Personal Information</h4>
                <div class="review-row"><span>Full Name</span><span>${name} ${nameBn ? '(' + nameBn + ')' : ''}</span></div>
                <div class="review-row"><span>Father's Name</span><span>${father}</span></div>
                <div class="review-row"><span>Mother's Name</span><span>${mother}</span></div>
                <div class="review-row"><span>Date of Birth</span><span>${dob}</span></div>
                <div class="review-row"><span>Gender</span><span>${gender}</span></div>
                <div class="review-row"><span>NID Number</span><span>${nid}</span></div>
            </div>
            <div class="review-section">
                <h4><i class="fas fa-map-location-dot"></i> Address</h4>
                <div class="review-row"><span>Present Location</span><span>${presDivText}, ${presDistText}</span></div>
            </div>
            <div class="review-section">
                <h4><i class="fas fa-phone"></i> Contact</h4>
                <div class="review-row"><span>Mobile</span><span>${mobile}</span></div>
                <div class="review-row"><span>Email</span><span>${email || 'N/A'}</span></div>
            </div>
        `;
    },

    // ===================== SUBMIT APPLICATION =====================
    async submitApplication() {
        // Final validation
        if (!document.getElementById('agreeTerms').checked) {
            Swal.fire({ icon: 'warning', title: 'Terms Required', text: 'You must agree to the declaration before submitting.', background: '#0f172a', color: '#fff' });
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        // Collect form data
        const formData = {
            service_type: document.querySelector('input[name="service_type"]:checked')?.value,
            passport_type: document.getElementById('passportType').value,
            page_count: parseInt(document.getElementById('pageCount').value),
            validity_years: parseInt(document.getElementById('validityYears').value),
            delivery_type: document.getElementById('deliveryType').value,
            preferred_office: document.getElementById('preferredOffice').value,

            full_name_en: document.getElementById('fullNameEn').value.trim().toUpperCase(),
            full_name_bn: document.getElementById('fullNameBn').value.trim(),
            father_name_en: document.getElementById('fatherNameEn').value.trim(),
            father_name_bn: document.getElementById('fatherNameBn').value.trim(),
            mother_name_en: document.getElementById('motherNameEn').value.trim(),
            mother_name_bn: document.getElementById('motherNameBn').value.trim(),
            spouse_name_en: document.getElementById('spouseNameEn').value.trim(),
            spouse_name_bn: document.getElementById('spouseNameBn').value.trim(),
            date_of_birth: document.getElementById('dateOfBirth').value,
            gender: document.getElementById('gender').value,
            religion: document.getElementById('religion').value,
            marital_status: document.getElementById('maritalStatus').value,
            nid_number: document.getElementById('nidNumber').value.trim(),
            birth_certificate_no: document.getElementById('birthCertNo').value.trim(),
            blood_group: document.getElementById('bloodGroup').value,
            profession: document.getElementById('profession').value.trim(),
            education: document.getElementById('education').value,
            tin_number: document.getElementById('tinNumber').value.trim(),
            distinguishing_mark: document.getElementById('distinguishingMark').value.trim(),

            present_division: document.getElementById('presentDivision').selectedOptions[0]?.text || '',
            present_district: document.getElementById('presentDistrict').selectedOptions[0]?.text || '',
            present_upazila: document.getElementById('presentUpazila').selectedOptions[0]?.text || '',
            present_post_office: document.getElementById('presentPostOffice').value.trim(),
            present_postal_code: document.getElementById('presentPostalCode').value.trim(),
            present_village_road: document.getElementById('presentVillageRoad').value.trim(),

            permanent_division: document.getElementById('permanentDivision').selectedOptions[0]?.text || '',
            permanent_district: document.getElementById('permanentDistrict').selectedOptions[0]?.text || '',
            permanent_upazila: document.getElementById('permanentUpazila').selectedOptions[0]?.text || '',
            permanent_post_office: document.getElementById('permanentPostOffice').value.trim(),
            permanent_postal_code: document.getElementById('permanentPostalCode').value.trim(),
            permanent_village_road: document.getElementById('permanentVillageRoad').value.trim(),

            mobile_number: document.getElementById('mobileNumber').value.trim(),
            email: document.getElementById('emailAddress').value.trim(),
            emergency_contact_name: document.getElementById('emergencyName').value.trim(),
            emergency_contact_phone: document.getElementById('emergencyPhone').value.trim(),
            emergency_contact_relation: document.getElementById('emergencyRelation').value,

            old_passport_number: document.getElementById('oldPassportNumber').value.trim(),
            old_passport_issue_date: document.getElementById('oldPassportIssueDate').value,
            old_passport_expiry_date: document.getElementById('oldPassportExpiryDate').value,
            old_passport_issue_place: document.getElementById('oldPassportIssuePlace').value.trim()
        };

        // Build height string
        const ft = document.getElementById('heightFt').value;
        const inches = document.getElementById('heightIn').value;
        if (ft) formData.height = `${ft}'${inches || 0}"`;

        try {
            const result = await this.postAPI(`${this.API}/apply`, formData);

            if (result.error) {
                Swal.fire({ icon: 'error', title: 'Submission Failed', text: result.error, background: '#0f172a', color: '#fff' });
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application';
                return;
            }

            // Upload documents if any
            const appId = result.applicationId || result.id;
            if (appId) {
                await this.uploadDocuments(appId);
            }

            Swal.fire({
                icon: 'success',
                title: 'Application Submitted!',
                html: `
                    <p style="margin-bottom: 0.5rem;">Your e-Passport application has been submitted successfully.</p>
                    <p style="font-size: 1.2rem; font-weight: 700; color: #85c1e9; margin: 1rem 0;">
                        Application No: ${result.applicationNumber || 'N/A'}
                    </p>
                    <p style="font-size: 0.85rem; color: #94a3b8;">Please save this number for tracking your application.</p>
                `,
                background: '#0f172a',
                color: '#fff',
                confirmButtonColor: '#1a5276'
            }).then(() => {
                // Reset form and go to overview
                document.getElementById('passportApplicationForm').reset();
                this.currentStep = 1;
                this.goToStep(1);
                showSection('overview');
                this.loadStats();
                this.loadRecentActivity();
            });
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Submission Failed', text: e.message || 'An error occurred while submitting.', background: '#0f172a', color: '#fff' });
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Application';
        }
    },

    // ===================== UPLOAD DOCUMENTS =====================
    async uploadDocuments(appId) {
        const form = document.getElementById('passportApplicationForm');
        const files = form.querySelectorAll('input[type="file"]');
        const formData = new FormData();
        let hasFiles = false;

        files.forEach(input => {
            if (input.files && input.files[0]) {
                formData.append(input.name, input.files[0]);
                hasFiles = true;
            }
        });

        if (!hasFiles) return;

        try {
            const res = await fetch(`${this.API}/upload-documents/${appId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: formData
            });
            const data = await res.json();
            if (!res.ok) console.error('Document upload error:', data);
        } catch (e) {
            console.error('Document upload failed:', e);
        }
    },

    // ===================== TRACK APPLICATION =====================
    async trackApplication() {
        const appNumber = document.getElementById('trackingNumber').value.trim();
        const resultDiv = document.getElementById('trackingResult');
        const emptyDiv = document.getElementById('trackingEmpty');

        if (!appNumber) {
            Swal.fire({ icon: 'info', title: 'Enter Application Number', text: 'Please enter your passport application number.', background: '#0f172a', color: '#fff' });
            return;
        }

        resultDiv.style.display = 'none';
        emptyDiv.innerHTML = '<div class="pp-loading"><div class="pp-spinner"></div></div>';

        try {
            const res = await this.fetchAPI(`${this.API}/track/${appNumber}`);
            if (!res || res.error || !res.application) {
                emptyDiv.innerHTML = `
                    <div class="pp-empty-state">
                        <i class="fas fa-circle-xmark" style="color: #ef4444;"></i>
                        <p>No application found with number: <strong>${appNumber}</strong></p>
                        <p style="font-size: 0.85rem; color: #64748b;">Please check the number and try again.</p>
                    </div>`;
                return;
            }

            const data = res.application;

            emptyDiv.style.display = 'none';
            resultDiv.style.display = 'block';

            const statusSteps = [
                { key: 'Submitted', label: 'Application Submitted', icon: 'fa-paper-plane' },
                { key: 'Payment Verified', label: 'Payment Verified', icon: 'fa-credit-card' },
                { key: 'Under Review', label: 'Under Review', icon: 'fa-magnifying-glass' },
                { key: 'Biometric Scheduled', label: 'Biometric Scheduled', icon: 'fa-fingerprint' },
                { key: 'Biometric Completed', label: 'Biometric Done', icon: 'fa-check-circle' },
                { key: 'Police Verification', label: 'Police Verification', icon: 'fa-shield-halved' },
                { key: 'Printing', label: 'Passport Printing', icon: 'fa-print' },
                { key: 'Ready for Delivery', label: 'Ready for Delivery', icon: 'fa-box' },
                { key: 'Delivered', label: 'Delivered', icon: 'fa-truck' }
            ];

            const currentIndex = statusSteps.findIndex(s => s.key === data.status);

            resultDiv.innerHTML = `
                <div style="text-align: center; margin-bottom: 2rem;">
                    <h3 style="color: var(--pp-accent); margin-bottom: 0.5rem;">Application: ${data.application_number}</h3>
                    <p style="color: #cbd5e1;">Name: <strong>${data.full_name_en}</strong> | Type: ${data.passport_type} | ${data.page_count} Pages</p>
                    <span class="badge-${this.statusClass(data.status)}" style="font-size: 1rem; padding: 0.5rem 1.5rem;">${data.status}</span>
                </div>

                <div class="pp-timeline">
                    ${statusSteps.map((step, i) => {
                let state = 'pending';
                if (i < currentIndex) state = 'completed';
                else if (i === currentIndex) state = 'current';
                return `
                            <div class="timeline-item ${state}">
                                <div class="timeline-dot ${state}">
                                    <i class="fas ${step.icon}"></i>
                                </div>
                                <div class="timeline-content">
                                    <strong>${step.label}</strong>
                                    ${state === 'completed' ? '<span style="color: #34d399; font-size: 0.8rem;"><i class="fas fa-check"></i> Completed</span>' : ''}
                                    ${state === 'current' ? '<span style="color: var(--pp-gold); font-size: 0.8rem;"><i class="fas fa-clock"></i> Current Stage</span>' : ''}
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>

                ${data.status === 'Rejected' ? `
                    <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 1.5rem; margin-top: 1.5rem;">
                        <h4 style="color: #f87171;"><i class="fas fa-exclamation-triangle"></i> Application Rejected</h4>
                        <p style="color: #fca5a5;">${data.rejection_reason || 'No reason specified. Contact your nearest passport office for details.'}</p>
                    </div>
                ` : ''}
            `;
        } catch (e) {
            emptyDiv.innerHTML = `
                <div class="pp-empty-state">
                    <i class="fas fa-circle-xmark" style="color: #ef4444;"></i>
                    <p>Application not found or an error occurred.</p>
                </div>`;
        }
    },

    // ===================== MY APPLICATIONS =====================
    async loadMyApplications() {
        const container = document.getElementById('applicationsTableContainer');
        container.innerHTML = '<div class="pp-loading"><div class="pp-spinner"></div></div>';

        try {
            const data = await this.fetchAPI(`${this.API}/my-applications`);
            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div class="pp-empty-state">
                        <i class="fas fa-folder-open"></i>
                        <p>You don't have any passport applications yet.</p>
                        <button class="btn-pp" onclick="showSection('apply')" style="margin-top: 1rem;">Apply Now</button>
                    </div>`;
                return;
            }

            container.innerHTML = `
                <table class="pp-table">
                    <thead>
                        <tr>
                            <th>Application No.</th>
                            <th>Service Type</th>
                            <th>Passport Type</th>
                            <th>Fee (৳)</th>
                            <th>Status</th>
                            <th>Applied Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(app => `
                            <tr>
                                <td style="font-family: monospace; color: var(--pp-accent); font-weight: 600;">${app.application_number}</td>
                                <td>${app.service_type}</td>
                                <td>${app.passport_type} - ${app.page_count}pg</td>
                                <td style="color: var(--pp-gold);">৳ ${this.formatMoney(app.total_fee)}</td>
                                <td><span class="badge-${this.statusClass(app.status)}">${app.status}</span></td>
                                <td>${this.formatDate(app.created_at)}</td>
                                <td>
                                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                        <button class="btn-pp-outline" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="PassportApp.viewApplication(${app.id})">
                                            <i class="fas fa-eye"></i> View
                                        </button>
                                        ${['Submitted', 'Payment Verified'].includes(app.status) ? `
                                            <button class="btn-pp-danger" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="PassportApp.cancelApplication(${app.id})">
                                                <i class="fas fa-times"></i> Cancel
                                            </button>
                                        ` : ''}
                                        ${app.status === 'Submitted' ? `
                                            <button class="btn-pp-gold" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="PassportApp.recordPayment(${app.id})">
                                                <i class="fas fa-credit-card"></i> Pay
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (e) {
            container.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 3rem;">Failed to load applications.</p>';
        }
    },

    // ===================== VIEW APPLICATION =====================
    async viewApplication(id) {
        try {
            const data = await this.fetchAPI(`${this.API}/application/${id}`);
            if (!data || !data.application) return;
            const app = data.application;

            Swal.fire({
                title: `Application: ${app.application_number}`,
                html: `
                    <div style="text-align: left; max-height: 60vh; overflow-y: auto; font-size: 0.9rem; line-height: 1.8;">
                        <p><strong>Service:</strong> ${app.service_type}</p>
                        <p><strong>Type:</strong> ${app.passport_type} - ${app.page_count} Pages - ${app.validity_years} Years</p>
                        <p><strong>Delivery:</strong> ${app.delivery_type}</p>
                        <p><strong>Status:</strong> <span style="color: #85c1e9;">${app.status}</span></p>
                        <hr style="border-color: rgba(255,255,255,0.1); margin: 0.8rem 0;">
                        <p><strong>Name:</strong> ${app.full_name_en} ${app.full_name_bn ? '(' + app.full_name_bn + ')' : ''}</p>
                        <p><strong>Father:</strong> ${app.father_name_en || '-'}</p>
                        <p><strong>Mother:</strong> ${app.mother_name_en || '-'}</p>
                        <p><strong>DOB:</strong> ${app.date_of_birth ? new Date(app.date_of_birth).toLocaleDateString() : '-'}</p>
                        <p><strong>Gender:</strong> ${app.gender || '-'}</p>
                        <p><strong>NID:</strong> ${app.nid_number || '-'}</p>
                        <p><strong>Mobile:</strong> ${app.mobile_number || '-'}</p>
                        <hr style="border-color: rgba(255,255,255,0.1); margin: 0.8rem 0;">
                        <p><strong>Fee:</strong> ৳ ${this.formatMoney(app.total_fee)}</p>
                        <p><strong>Payment:</strong> ${app.payment_status || 'Pending'}</p>
                        <p><strong>Applied:</strong> ${this.formatDate(app.created_at)}</p>
                    </div>
                `,
                background: '#0f172a',
                color: '#fff',
                width: 600,
                confirmButtonColor: '#1a5276'
            });
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load application details.', background: '#0f172a', color: '#fff' });
        }
    },

    // ===================== CANCEL APPLICATION =====================
    async cancelApplication(id) {
        const result = await Swal.fire({
            title: 'Cancel Application?',
            text: 'This action cannot be undone. Your application will be permanently cancelled.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Yes, Cancel It',
            background: '#0f172a',
            color: '#fff'
        });

        if (!result.isConfirmed) return;

        try {
            const data = await this.putAPI(`${this.API}/application/${id}/cancel`, {});
            if (data.error) {
                Swal.fire({ icon: 'error', title: 'Failed', text: data.error, background: '#0f172a', color: '#fff' });
                return;
            }
            Swal.fire({ icon: 'success', title: 'Cancelled', text: 'Your application has been cancelled.', background: '#0f172a', color: '#fff' });
            this.loadMyApplications();
            this.loadStats();
        } catch (e) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to cancel application.', background: '#0f172a', color: '#fff' });
        }
    },

    // ===================== RECORD PAYMENT =====================
    // ===================== PAY ONLINE (SSLCOMMERZ) =====================
    async recordPayment(id) {
        try {
            const result = await Swal.fire({
                title: 'Pay Online',
                text: 'You will be redirected to SSLCommerz payment gateway.',
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#1a5276',
                cancelButtonColor: '#475569',
                confirmButtonText: 'Proceed to Pay',
                background: '#0f172a',
                color: '#fff'
            });

            if (!result.isConfirmed) return;

            // Show loading
            Swal.fire({
                title: 'Initiating Payment...',
                text: 'Please wait while we redirect you.',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); },
                background: '#0f172a',
                color: '#fff'
            });

            const res = await this.postAPI(`${this.API}/payment/init`, { applicationId: id });

            if (res.url) {
                window.location.href = res.url;
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Payment Error',
                    text: res.error || 'Failed to initiate payment.',
                    background: '#0f172a',
                    color: '#fff'
                });
            }
        } catch (e) {
            console.error('Payment Init Error:', e);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'An unexpected error occurred.',
                background: '#0f172a',
                color: '#fff'
            });
        }
    },

    // ===================== GUIDELINES ACCORDION =====================
    toggleGuideline(header) {
        const content = header.nextElementSibling;
        const isActive = header.classList.contains('active');

        // Close all
        document.querySelectorAll('.guideline-header').forEach(h => h.classList.remove('active'));
        document.querySelectorAll('.guideline-content').forEach(c => c.classList.remove('active'));

        // Toggle clicked
        if (!isActive) {
            header.classList.add('active');
            content.classList.add('active');
        }
    },

    // ===================== UTILITY HELPERS =====================
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
            'Biometric Completed': 'biometric-completed',
            'Police Verification': 'police-verification',
            'Printing': 'printing',
            'Ready for Delivery': 'ready',
            'Delivered': 'delivered',
            'Rejected': 'rejected',
            'Cancelled': 'cancelled',
            'On Hold': 'on-hold',
            'Pending': 'submitted'
        };
        return map[status] || 'submitted';
    }
};

// ===================== BOOT =====================
document.addEventListener('DOMContentLoaded', () => {
    PassportApp.init();

    // Enter key on tracking input
    const trackInput = document.getElementById('trackingNumber');
    if (trackInput) {
        trackInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') PassportApp.trackApplication();
        });
    }
});
