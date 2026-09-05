/**
 * NID Wing - Election Commission Bangladesh
 * Complete NID Services JavaScript Module
 * @author Central Govt Portal
 */

const NID = {
    // API Base
    API_BASE: '/api/nid',

    // Bangladesh Location Data
    divisions: [
        { id: 1, name: 'Dhaka', bn: 'ঢাকা' },
        { id: 2, name: 'Chittagong', bn: 'চট্টগ্রাম' },
        { id: 3, name: 'Rajshahi', bn: 'রাজশাহী' },
        { id: 4, name: 'Khulna', bn: 'খুলনা' },
        { id: 5, name: 'Barisal', bn: 'বরিশাল' },
        { id: 6, name: 'Sylhet', bn: 'সিলেট' },
        { id: 7, name: 'Rangpur', bn: 'রংপুর' },
        { id: 8, name: 'Mymensingh', bn: 'ময়মনসিংহ' }
    ],

    districts: {
        1: [
            { id: 1, name: 'Dhaka', bn: 'ঢাকা' },
            { id: 2, name: 'Faridpur', bn: 'ফরিদপুর' },
            { id: 3, name: 'Gazipur', bn: 'গাজীপুর' },
            { id: 4, name: 'Gopalganj', bn: 'গোপালগঞ্জ' },
            { id: 5, name: 'Kishoreganj', bn: 'কিশোরগঞ্জ' },
            { id: 6, name: 'Madaripur', bn: 'মাদারীপুর' },
            { id: 7, name: 'Manikganj', bn: 'মানিকগঞ্জ' },
            { id: 8, name: 'Munshiganj', bn: 'মুন্সীগঞ্জ' },
            { id: 9, name: 'Narayanganj', bn: 'নারায়ণগঞ্জ' },
            { id: 10, name: 'Narsingdi', bn: 'নরসিংদী' },
            { id: 11, name: 'Rajbari', bn: 'রাজবাড়ী' },
            { id: 12, name: 'Shariatpur', bn: 'শরীয়তপুর' },
            { id: 13, name: 'Tangail', bn: 'টাঙ্গাইল' }
        ],
        2: [
            { id: 14, name: 'Chittagong', bn: 'চট্টগ্রাম' },
            { id: 15, name: 'Bandarban', bn: 'বান্দরবান' },
            { id: 16, name: 'Brahmanbaria', bn: 'ব্রাহ্মণবাড়িয়া' },
            { id: 17, name: 'Chandpur', bn: 'চাঁদপুর' },
            { id: 18, name: 'Comilla', bn: 'কুমিল্লা' },
            { id: 19, name: "Cox's Bazar", bn: 'কক্সবাজার' },
            { id: 20, name: 'Feni', bn: 'ফেনী' },
            { id: 21, name: 'Khagrachari', bn: 'খাগড়াছড়ি' },
            { id: 22, name: 'Lakshmipur', bn: 'লক্ষ্মীপুর' },
            { id: 23, name: 'Noakhali', bn: 'নোয়াখালী' },
            { id: 24, name: 'Rangamati', bn: 'রাঙ্গামাটি' }
        ],
        3: [
            { id: 25, name: 'Rajshahi', bn: 'রাজশাহী' },
            { id: 26, name: 'Bogra', bn: 'বগুড়া' },
            { id: 27, name: 'Chapainawabganj', bn: 'চাঁপাইনবাবগঞ্জ' },
            { id: 28, name: 'Joypurhat', bn: 'জয়পুরহাট' },
            { id: 29, name: 'Naogaon', bn: 'নওগাঁ' },
            { id: 30, name: 'Natore', bn: 'নাটোর' },
            { id: 31, name: 'Nawabganj', bn: 'নবাবগঞ্জ' },
            { id: 32, name: 'Pabna', bn: 'পাবনা' },
            { id: 33, name: 'Sirajganj', bn: 'সিরাজগঞ্জ' }
        ],
        4: [
            { id: 34, name: 'Khulna', bn: 'খুলনা' },
            { id: 35, name: 'Bagerhat', bn: 'বাগেরহাট' },
            { id: 36, name: 'Chuadanga', bn: 'চুয়াডাঙ্গা' },
            { id: 37, name: 'Jessore', bn: 'যশোর' },
            { id: 38, name: 'Jhenaidah', bn: 'ঝিনাইদহ' },
            { id: 39, name: 'Kushtia', bn: 'কুষ্টিয়া' },
            { id: 40, name: 'Magura', bn: 'মাগুরা' },
            { id: 41, name: 'Meherpur', bn: 'মেহেরপুর' },
            { id: 42, name: 'Narail', bn: 'নড়াইল' },
            { id: 43, name: 'Satkhira', bn: 'সাতক্ষীরা' }
        ],
        5: [
            { id: 44, name: 'Barisal', bn: 'বরিশাল' },
            { id: 45, name: 'Barguna', bn: 'বরগুনা' },
            { id: 46, name: 'Bhola', bn: 'ভোলা' },
            { id: 47, name: 'Jhalokati', bn: 'ঝালকাঠি' },
            { id: 48, name: 'Patuakhali', bn: 'পটুয়াখালী' },
            { id: 49, name: 'Pirojpur', bn: 'পিরোজপুর' }
        ],
        6: [
            { id: 50, name: 'Sylhet', bn: 'সিলেট' },
            { id: 51, name: 'Habiganj', bn: 'হবিগঞ্জ' },
            { id: 52, name: 'Moulvibazar', bn: 'মৌলভীবাজার' },
            { id: 53, name: 'Sunamganj', bn: 'সুনামগঞ্জ' }
        ],
        7: [
            { id: 54, name: 'Rangpur', bn: 'রংপুর' },
            { id: 55, name: 'Dinajpur', bn: 'দিনাজপুর' },
            { id: 56, name: 'Gaibandha', bn: 'গাইবান্ধা' },
            { id: 57, name: 'Kurigram', bn: 'কুড়িগ্রাম' },
            { id: 58, name: 'Lalmonirhat', bn: 'লালমনিরহাট' },
            { id: 59, name: 'Nilphamari', bn: 'নীলফামারী' },
            { id: 60, name: 'Panchagarh', bn: 'পঞ্চগড়' },
            { id: 61, name: 'Thakurgaon', bn: 'ঠাকুরগাঁও' }
        ],
        8: [
            { id: 62, name: 'Mymensingh', bn: 'ময়মনসিংহ' },
            { id: 63, name: 'Jamalpur', bn: 'জামালপুর' },
            { id: 64, name: 'Netrokona', bn: 'নেত্রকোণা' },
            { id: 65, name: 'Sherpur', bn: 'শেরপুর' }
        ]
    },

    // Initialize
    init: function () {
        this.checkAuth();
        this.loadDivisions();
        this.loadDashboard();
        this.setupFormListeners();
        this.setupMinDates();
    },

    // Check Authentication
    checkAuth: function () {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'register.html';
            return;
        }
    },

    // Get Auth Headers
    getHeaders: function () {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        };
    },

    // Setup Min Dates
    setupMinDates: function () {
        const today = new Date().toISOString().split('T')[0];
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + 3); // Min 3 days from now
        const minDateStr = minDate.toISOString().split('T')[0];

        const aptDate = document.getElementById('apt-date');
        const smtBioDate = document.getElementById('smt-bio-date');

        if (aptDate) aptDate.min = minDateStr;
        if (smtBioDate) smtBioDate.min = minDateStr;
    },

    // ====================== SECTION NAVIGATION ======================
    showSection: function (sectionId) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.style.display = 'none';
        });

        // Show selected section
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'block';
        }

        // Update nav active state
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`.nav-links a[onclick*="${sectionId}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Load section data
        this.loadSectionData(sectionId);

        // Close mobile sidebar
        if (window.innerWidth < 992) {
            if (typeof toggleSidebar === 'function') toggleSidebar();
        }
    },

    loadSectionData: function (section) {
        switch (section) {
            case 'overview':
                this.loadDashboard();
                break;
            case 'profile':
                this.loadProfile();
                break;
            case 'correction':
                this.loadCorrections();
                break;
            case 'reissue':
                this.loadReissues();
                this.loadCenters('rei-center');
                break;
            case 'smart-card':
                this.loadSmartCards();
                this.loadCenters('smt-center');
                break;
            case 'address':
                this.loadAddressChanges();
                break;
            case 'verification':
                this.loadVerifications();
                break;
            case 'appointments':
                this.loadAppointments();
                this.loadCenters('apt-center');
                break;
            case 'family':
                this.loadFamily();
                break;
            case 'applications':
                this.loadAllApplications();
                break;
        }
    },

    // ====================== DASHBOARD ======================
    loadDashboard: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/dashboard`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load dashboard');

            const data = await response.json();

            // Update stats
            document.getElementById('stat-corrections').textContent = data.stats?.corrections || 0;
            document.getElementById('stat-reissues').textContent = data.stats?.reissues || 0;
            document.getElementById('stat-smart-cards').textContent = data.stats?.smart_cards || 0;
            document.getElementById('stat-address').textContent = data.stats?.address_changes || 0;
            document.getElementById('stat-verifications').textContent = data.stats?.verifications || 0;

            // Update NID Card Preview
            if (data.profile) {
                document.getElementById('card-name-bn').textContent = data.profile.name_bn || '—';
                document.getElementById('card-name-en').textContent = data.profile.name_en || '—';
                document.getElementById('card-father').textContent = data.profile.father_name_bn || '—';
                document.getElementById('card-mother').textContent = data.profile.mother_name_bn || '—';
                document.getElementById('card-dob').textContent = data.profile.date_of_birth ? this.formatDate(data.profile.date_of_birth) : '—';
                document.getElementById('card-nid-number').textContent = `NID: ${data.profile.nid_number || '—'}`;

                const statusEl = document.getElementById('card-status');
                if (data.profile.profile_status || data.profile.nid_status) {
                    const profileStatus = data.profile.profile_status || data.profile.nid_status;
                    statusEl.textContent = `Status: ${profileStatus}`;
                    statusEl.className = 'card-status';
                    if (profileStatus === 'Active') statusEl.classList.add('status-approved');
                    else if (profileStatus === 'Pending') statusEl.classList.add('status-pending');
                }
            }

            // Load recent applications
            this.renderRecentApplications(data.recentApplications || []);

            // Load fee structure
            this.loadFees();

        } catch (error) {
            console.error('Dashboard error:', error);
            this.showToast('Failed to load dashboard', 'error');
        }
    },

    renderRecentApplications: function (apps) {
        const container = document.getElementById('recentApplicationsList');

        if (!apps || apps.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard"></i>
                    <p>কোনো সাম্প্রতিক আবেদন নেই</p>
                </div>
            `;
            return;
        }

        let html = '<div class="app-timeline">';
        apps.forEach(app => {
            html += `
                <div class="app-timeline-item">
                    <div class="app-timeline-date">${this.formatDate(app.created_at)}</div>
                    <div class="app-timeline-content">
                        <strong>${app.type}</strong> - ${app.ref_no || app.reference_number}
                        <span class="status-badge ${this.getStatusClass(app.status)}">${app.status}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    },

    loadFees: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/fees`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load fees');

            const fees = await response.json();
            const container = document.getElementById('feeStructure');

            let html = '';
            fees.forEach(fee => {
                html += `
                    <div class="fee-item">
                        <h5>${fee.service_type}</h5>
                        <div class="fee-amount">৳${fee.normal_fee}</div>
                        <div class="fee-desc">${fee.urgent_fee ? 'Urgent: ৳' + fee.urgent_fee : ''}</div>
                    </div>
                `;
            });

            container.innerHTML = html || '<p style="color:var(--nid-text-muted);">Fee information not available</p>';

        } catch (error) {
            console.error('Fees error:', error);
        }
    },

    // ====================== PROFILE ======================
    loadProfile: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/profile`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load profile');

            const result = await response.json();

            // handle the wrapper response: {exists: true, profile: {...}} or {exists: false, based_on_registration: {...}}
            let profile;
            if (result.exists && result.profile) {
                profile = result.profile;
            } else if (result.based_on_registration) {
                profile = result.based_on_registration;
            } else if (result.exists === undefined) {
                profile = result;
            } else {
                return; // No profile data
            }

            if (profile) {
                // Basic info
                document.getElementById('prof-name-bn').value = profile.name_bn || '';
                document.getElementById('prof-name-en').value = profile.name_en || '';
                document.getElementById('prof-father-bn').value = profile.father_name_bn || '';
                document.getElementById('prof-father-en').value = profile.father_name_en || '';
                document.getElementById('prof-mother-bn').value = profile.mother_name_bn || '';
                document.getElementById('prof-mother-en').value = profile.mother_name_en || '';
                document.getElementById('prof-spouse-bn').value = profile.spouse_name_bn || '';
                document.getElementById('prof-spouse-en').value = profile.spouse_name_en || '';

                // Birth & Identity
                if (profile.date_of_birth) {
                    document.getElementById('prof-dob').value = profile.date_of_birth.split('T')[0];
                }
                document.getElementById('prof-birth-place-bn').value = profile.birth_place_bn || '';
                document.getElementById('prof-birth-place-en').value = profile.birth_place_en || '';
                document.getElementById('prof-birth-cert').value = profile.birth_certificate_no || '';
                document.getElementById('prof-gender').value = profile.gender || '';
                document.getElementById('prof-blood').value = profile.blood_group || 'Unknown';

                // Contact
                document.getElementById('prof-mobile1').value = profile.mobile_primary || '';
                document.getElementById('prof-mobile2').value = profile.mobile_secondary || '';
                document.getElementById('prof-email').value = profile.email || '';

                // Present Address
                if (profile.present_division_id || profile.present_division) {
                    await this.setLocationDropdowns('prof-present', profile.present_division_id || profile.present_division, profile.present_district_id || profile.present_district, profile.present_upazila_id || profile.present_upazila);
                }
                document.getElementById('prof-present-po').value = profile.present_post_office || '';
                document.getElementById('prof-present-pc').value = profile.present_post_code || '';
                document.getElementById('prof-present-ward').value = profile.present_ward_no || '';
                document.getElementById('prof-present-village-bn').value = profile.present_village_bn || '';
                document.getElementById('prof-present-village-en').value = profile.present_village_en || '';
                document.getElementById('prof-present-road').value = profile.present_road_no || profile.present_road || '';
                document.getElementById('prof-present-house').value = profile.present_house_no || '';

                // Permanent Address
                if (profile.permanent_division_id || profile.permanent_division) {
                    await this.setLocationDropdowns('prof-perm', profile.permanent_division_id || profile.permanent_division, profile.permanent_district_id || profile.permanent_district, profile.permanent_upazila_id || profile.permanent_upazila);
                }
                document.getElementById('prof-perm-po').value = profile.permanent_post_office || '';
                document.getElementById('prof-perm-pc').value = profile.permanent_post_code || '';
                document.getElementById('prof-perm-ward').value = profile.permanent_ward_no || '';
                document.getElementById('prof-perm-village-bn').value = profile.permanent_village_bn || '';
                document.getElementById('prof-perm-village-en').value = profile.permanent_village_en || '';
                document.getElementById('prof-perm-road').value = profile.permanent_road_no || profile.permanent_road || '';
                document.getElementById('prof-perm-house').value = profile.permanent_house_no || '';

                // Other
                document.getElementById('prof-education').value = profile.educational_qualification || '';
                document.getElementById('prof-occupation-bn').value = profile.occupation_bn || '';
                document.getElementById('prof-occupation-en').value = profile.occupation || profile.occupation_en || '';
                document.getElementById('prof-religion').value = profile.religion || 'Islam';

                // Set NID for forms
                document.getElementById('cor-nid').value = profile.nid_number || '';
                document.getElementById('rei-nid').value = profile.nid_number || '';
                document.getElementById('smt-nid').value = profile.nid_number || '';
                document.getElementById('addr-nid').value = profile.nid_number || '';
            }

        } catch (error) {
            console.error('Profile error:', error);
            this.showToast('Failed to load profile', 'error');
        }
    },

    saveProfile: async function (e) {
        e.preventDefault();

        const profileData = {
            name_bn: document.getElementById('prof-name-bn').value,
            name_en: document.getElementById('prof-name-en').value,
            father_name_bn: document.getElementById('prof-father-bn').value,
            father_name_en: document.getElementById('prof-father-en').value,
            mother_name_bn: document.getElementById('prof-mother-bn').value,
            mother_name_en: document.getElementById('prof-mother-en').value,
            spouse_name_bn: document.getElementById('prof-spouse-bn').value,
            spouse_name_en: document.getElementById('prof-spouse-en').value,
            date_of_birth: document.getElementById('prof-dob').value,
            birth_place_bn: document.getElementById('prof-birth-place-bn').value,
            birth_place_en: document.getElementById('prof-birth-place-en').value,
            birth_certificate_no: document.getElementById('prof-birth-cert').value,
            gender: document.getElementById('prof-gender').value,
            blood_group: document.getElementById('prof-blood').value,
            mobile_primary: document.getElementById('prof-mobile1').value,
            mobile_secondary: document.getElementById('prof-mobile2').value,
            email: document.getElementById('prof-email').value,
            present_division_id: document.getElementById('prof-present-div').value,
            present_district_id: document.getElementById('prof-present-dist').value,
            present_upazila_id: document.getElementById('prof-present-upa').value,
            present_post_office: document.getElementById('prof-present-po').value,
            present_post_code: document.getElementById('prof-present-pc').value,
            present_ward_no: document.getElementById('prof-present-ward').value,
            present_village_bn: document.getElementById('prof-present-village-bn').value,
            present_village_en: document.getElementById('prof-present-village-en').value,
            present_road_no: document.getElementById('prof-present-road').value,
            present_house_no: document.getElementById('prof-present-house').value,
            permanent_division_id: document.getElementById('prof-perm-div').value,
            permanent_district_id: document.getElementById('prof-perm-dist').value,
            permanent_upazila_id: document.getElementById('prof-perm-upa').value,
            permanent_post_office: document.getElementById('prof-perm-po').value,
            permanent_post_code: document.getElementById('prof-perm-pc').value,
            permanent_ward_no: document.getElementById('prof-perm-ward').value,
            permanent_village_bn: document.getElementById('prof-perm-village-bn').value,
            permanent_village_en: document.getElementById('prof-perm-village-en').value,
            permanent_road_no: document.getElementById('prof-perm-road').value,
            permanent_house_no: document.getElementById('prof-perm-house').value,
            educational_qualification: document.getElementById('prof-education').value,
            occupation: document.getElementById('prof-occupation-en').value,
            occupation_bn: document.getElementById('prof-occupation-bn').value,
            religion: document.getElementById('prof-religion').value
        };

        try {
            const response = await fetch(`${this.API_BASE}/profile`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(profileData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showToast('Profile saved successfully!', 'success');
            } else {
                throw new Error(result.message || 'Failed to save profile');
            }

        } catch (error) {
            console.error('Save profile error:', error);
            this.showToast(error.message || 'Failed to save profile', 'error');
        }
    },

    copyAddress: function () {
        const sameAddress = document.getElementById('sameAddress').checked;

        if (sameAddress) {
            document.getElementById('prof-perm-div').value = document.getElementById('prof-present-div').value;
            this.loadDistricts('prof-perm');

            setTimeout(() => {
                document.getElementById('prof-perm-dist').value = document.getElementById('prof-present-dist').value;
                this.loadUpazilas('prof-perm');

                setTimeout(() => {
                    document.getElementById('prof-perm-upa').value = document.getElementById('prof-present-upa').value;
                }, 100);
            }, 100);

            document.getElementById('prof-perm-po').value = document.getElementById('prof-present-po').value;
            document.getElementById('prof-perm-pc').value = document.getElementById('prof-present-pc').value;
            document.getElementById('prof-perm-ward').value = document.getElementById('prof-present-ward').value;
            document.getElementById('prof-perm-village-bn').value = document.getElementById('prof-present-village-bn').value;
            document.getElementById('prof-perm-village-en').value = document.getElementById('prof-present-village-en').value;
            document.getElementById('prof-perm-road').value = document.getElementById('prof-present-road').value;
            document.getElementById('prof-perm-house').value = document.getElementById('prof-present-house').value;
        }
    },

    // ====================== CORRECTIONS ======================
    loadCorrections: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/corrections`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load corrections');

            const corrections = await response.json();
            const tbody = document.getElementById('correctionHistoryBody');

            if (!corrections || corrections.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state">কোনো সংশোধন আবেদন নেই</td></tr>';
                return;
            }

            let html = '';
            corrections.forEach(cor => {
                html += `
                    <tr>
                        <td><strong>${cor.request_no || cor.reference_number}</strong></td>
                        <td>${cor.correction_category || cor.correction_type}</td>
                        <td style="max-width:200px;">
                            <small>${cor.current_value}</small> → <small>${cor.corrected_value}</small>
                        </td>
                        <td><span class="status-badge ${this.getStatusClass(cor.status)}">${cor.status}</span></td>
                        <td>${this.formatDate(cor.created_at)}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error('Load corrections error:', error);
        }
    },

    submitCorrection: async function (e) {
        e.preventDefault();

        const formData = new FormData();
        formData.append('nid_number', document.getElementById('cor-nid').value);
        formData.append('correction_type', document.getElementById('cor-type').value);
        formData.append('current_value', document.getElementById('cor-current').value);
        formData.append('corrected_value', document.getElementById('cor-correct').value);
        formData.append('document_description', document.getElementById('cor-doc-desc').value);

        const files = document.getElementById('cor-docs').files;
        for (let i = 0; i < files.length && i < 3; i++) {
            formData.append('documents', files[i]);
        }

        try {
            const response = await fetch(`${this.API_BASE}/corrections`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'আবেদন সফল!',
                    html: `
                        <p>আপনার সংশোধন আবেদন জমা হয়েছে।</p>
                        <strong>Reference: ${result.referenceNumber}</strong>
                    `,
                    confirmButtonColor: '#2563eb'
                });

                document.getElementById('correctionForm').reset();
                this.loadCorrections();
            } else {
                throw new Error(result.message || 'Failed to submit');
            }

        } catch (error) {
            console.error('Submit correction error:', error);
            this.showToast(error.message || 'Failed to submit correction', 'error');
        }
    },

    // ====================== REISSUE ======================
    loadReissues: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/reissue`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load reissues');

            const reissues = await response.json();
            const tbody = document.getElementById('reissueHistoryBody');

            if (!reissues || reissues.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state">কোনো পুনঃইস্যু আবেদন নেই</td></tr>';
                return;
            }

            let html = '';
            reissues.forEach(rei => {
                html += `
                    <tr>
                        <td><strong>${rei.request_no || rei.reference_number}</strong></td>
                        <td>${rei.reason}</td>
                        <td>৳${rei.fee_amount || '—'}</td>
                        <td><span class="status-badge ${this.getStatusClass(rei.status)}">${rei.status}</span></td>
                        <td>${rei.expected_delivery ? this.formatDate(rei.expected_delivery) : '—'}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error('Load reissues error:', error);
        }
    },

    toggleGDFields: function () {
        const reason = document.getElementById('rei-reason').value;
        const gdFields = document.getElementById('gdFields');
        const damagedFields = document.getElementById('damagedFields');

        if (reason === 'Lost' || reason === 'Stolen') {
            gdFields.style.display = 'block';
            damagedFields.style.display = 'none';
        } else if (reason === 'Damaged') {
            gdFields.style.display = 'none';
            damagedFields.style.display = 'block';
        } else {
            gdFields.style.display = 'none';
            damagedFields.style.display = 'none';
        }
    },

    toggleDeliveryFields: function () {
        const delivery = document.getElementById('rei-delivery').value;
        const centerGroup = document.getElementById('centerSelectGroup');
        const addressGroup = document.getElementById('deliveryAddressGroup');

        if (delivery === 'Collection Center') {
            centerGroup.style.display = 'block';
            addressGroup.style.display = 'none';
        } else {
            centerGroup.style.display = 'none';
            addressGroup.style.display = 'block';
        }
    },

    submitReissue: async function (e) {
        e.preventDefault();

        const formData = new FormData();
        formData.append('nid_number', document.getElementById('rei-nid').value);
        formData.append('reason', document.getElementById('rei-reason').value);
        formData.append('details', document.getElementById('rei-details').value);
        formData.append('delivery_type', document.getElementById('rei-delivery').value);
        formData.append('collection_center_id', document.getElementById('rei-center').value || '');
        formData.append('delivery_address', document.getElementById('rei-address').value || '');
        formData.append('gd_number', document.getElementById('rei-gd-num').value || '');
        formData.append('gd_date', document.getElementById('rei-gd-date').value || '');
        formData.append('police_station', document.getElementById('rei-ps').value || '');

        const gdDoc = document.getElementById('rei-gd-doc').files[0];
        if (gdDoc) formData.append('gd_document', gdDoc);

        const damagedPhoto = document.getElementById('rei-damaged-photo').files[0];
        if (damagedPhoto) formData.append('damaged_photo', damagedPhoto);

        try {
            const response = await fetch(`${this.API_BASE}/reissue`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'আবেদন সফল!',
                    html: `
                        <p>আপনার পুনঃইস্যু আবেদন জমা হয়েছে।</p>
                        <strong>Reference: ${result.referenceNumber}</strong>
                    `,
                    confirmButtonColor: '#2563eb'
                });

                document.getElementById('reissueForm').reset();
                this.loadReissues();
            } else {
                throw new Error(result.message || 'Failed to submit');
            }

        } catch (error) {
            console.error('Submit reissue error:', error);
            this.showToast(error.message || 'Failed to submit reissue', 'error');
        }
    },

    // ====================== SMART CARD ======================
    loadSmartCards: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/smart-card`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load smart cards');

            const smartCards = await response.json();
            const tbody = document.getElementById('smartCardHistoryBody');

            if (!smartCards || smartCards.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state">কোনো স্মার্ট কার্ড আবেদন নেই</td></tr>';
                return;
            }

            let html = '';
            smartCards.forEach(sc => {
                const features = [];
                if (sc.include_driving_license) features.push('Driving');
                if (sc.include_passport_info || sc.include_passport) features.push('Passport');
                if (sc.include_health_id) features.push('Health');
                if (sc.include_bank_account) features.push('Bank');

                html += `
                    <tr>
                        <td><strong>${sc.application_no || sc.reference_number}</strong></td>
                        <td>${features.length > 0 ? features.join(', ') : 'Basic'}</td>
                        <td>${sc.center_name || '—'}</td>
                        <td><span class="status-badge ${this.getStatusClass(sc.status)}">${sc.status}</span></td>
                        <td>${this.formatDate(sc.created_at)}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error('Load smart cards error:', error);
        }
    },

    submitSmartCard: async function (e) {
        e.preventDefault();

        const data = {
            nid_number: document.getElementById('smt-nid').value,
            current_card_type: document.getElementById('smt-current-type').value,
            include_driving_license: document.getElementById('smt-driving').checked,
            include_passport: document.getElementById('smt-passport').checked,
            include_health_id: document.getElementById('smt-health').checked,
            include_bank_account: document.getElementById('smt-bank').checked,
            collection_center_id: document.getElementById('smt-center').value,
            biometric_date: document.getElementById('smt-bio-date').value
        };

        try {
            const response = await fetch(`${this.API_BASE}/smart-card`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'আবেদন সফল!',
                    html: `
                        <p>আপনার স্মার্ট কার্ড আবেদন জমা হয়েছে।</p>
                        <strong>Reference: ${result.referenceNumber}</strong>
                    `,
                    confirmButtonColor: '#2563eb'
                });

                document.getElementById('smartCardForm').reset();
                this.loadSmartCards();
            } else {
                throw new Error(result.message || 'Failed to submit');
            }

        } catch (error) {
            console.error('Submit smart card error:', error);
            this.showToast(error.message || 'Failed to submit application', 'error');
        }
    },

    // ====================== ADDRESS CHANGE ======================
    loadAddressChanges: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/address-change`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load address changes');

            const changes = await response.json();
            const tbody = document.getElementById('addressHistoryBody');

            if (!changes || changes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state">কোনো ঠিকানা পরিবর্তন আবেদন নেই</td></tr>';
                return;
            }

            let html = '';
            changes.forEach(ch => {
                html += `
                    <tr>
                        <td><strong>${ch.request_no || ch.reference_number}</strong></td>
                        <td>${ch.address_type}</td>
                        <td>${ch.new_district || ch.new_district_id || ''}, ${ch.new_division || ch.new_division_id || ''}</td>
                        <td><span class="status-badge ${this.getStatusClass(ch.status)}">${ch.status}</span></td>
                        <td>${this.formatDate(ch.created_at)}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error('Load address changes error:', error);
        }
    },

    submitAddressChange: async function (e) {
        e.preventDefault();

        const formData = new FormData();
        formData.append('nid_number', document.getElementById('addr-nid').value);
        formData.append('address_type', document.getElementById('addr-type').value);
        formData.append('old_address', document.getElementById('addr-old').value);
        formData.append('new_division', document.getElementById('addr-new-div').value);
        formData.append('new_district', document.getElementById('addr-new-dist').value);
        formData.append('new_upazila', document.getElementById('addr-new-upa').value);
        formData.append('new_post_office', document.getElementById('addr-new-po').value);
        formData.append('new_post_code', document.getElementById('addr-new-pc').value);
        formData.append('new_ward_no', document.getElementById('addr-new-ward').value);
        formData.append('new_village', document.getElementById('addr-new-village').value);
        formData.append('new_road', document.getElementById('addr-new-road').value);
        formData.append('new_house_no', document.getElementById('addr-new-house').value);
        formData.append('reason', document.getElementById('addr-reason').value);
        formData.append('document_type', document.getElementById('addr-doc-type').value);

        const proofDoc = document.getElementById('addr-doc').files[0];
        if (proofDoc) formData.append('proof_document', proofDoc);

        try {
            const response = await fetch(`${this.API_BASE}/address-change`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'আবেদন সফল!',
                    html: `
                        <p>আপনার ঠিকানা পরিবর্তন আবেদন জমা হয়েছে।</p>
                        <strong>Reference: ${result.referenceNumber}</strong>
                    `,
                    confirmButtonColor: '#2563eb'
                });

                document.getElementById('addressForm').reset();
                this.loadAddressChanges();
            } else {
                throw new Error(result.message || 'Failed to submit');
            }

        } catch (error) {
            console.error('Submit address change error:', error);
            this.showToast(error.message || 'Failed to submit address change', 'error');
        }
    },

    // ====================== VERIFICATION ======================
    loadVerifications: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/verifications`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load verifications');

            const verifications = await response.json();
            const tbody = document.getElementById('verificationHistoryBody');

            if (!verifications || verifications.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-state">কোনো যাচাই করা হয়নি</td></tr>';
                return;
            }

            let html = '';
            verifications.forEach(ver => {
                const isVerified = ver.verification_status === 'Verified' || ver.is_valid;
                html += `
                    <tr>
                        <td>${ver.verify_nid_number || ver.verified_nid || '—'}</td>
                        <td>${ver.verification_type}</td>
                        <td>
                            <span class="status-badge ${isVerified ? 'status-approved' : 'status-rejected'}">
                                ${isVerified ? 'Valid' : ver.verification_status || 'Invalid'}
                            </span>
                        </td>
                        <td>${this.formatDate(ver.created_at)}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error('Load verifications error:', error);
        }
    },

    submitVerification: async function (e) {
        e.preventDefault();

        const data = {
            verification_type: document.getElementById('ver-type').value,
            purpose: document.getElementById('ver-purpose').value,
            verified_nid: document.getElementById('ver-nid').value,
            verified_name: document.getElementById('ver-name').value,
            verified_dob: document.getElementById('ver-dob').value
        };

        try {
            const response = await fetch(`${this.API_BASE}/verify`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                // Show verification result
                const resultContainer = document.getElementById('verificationResult');
                const resultContent = document.getElementById('verResultContent');

                resultContainer.style.display = 'block';

                let html = `
                    <div class="ver-result-card">
                        <div class="ver-result-header">
                            <h4>Verification Result</h4>
                            <span class="status-badge ${result.isValid ? 'status-approved' : 'status-rejected'}">
                                ${result.isValid ? '✓ Valid' : '✗ Invalid'}
                            </span>
                        </div>
                `;

                if (result.data) {
                    html += `
                        <div class="ver-field">
                            <span class="ver-field-label">NID Number</span>
                            <span class="ver-field-value">${result.data.nid_number || '—'}</span>
                        </div>
                        <div class="ver-field">
                            <span class="ver-field-label">Name</span>
                            <span class="ver-field-value ${result.matchResult?.name ? 'ver-match' : 'ver-mismatch'}">${result.data.name_en || '—'}</span>
                        </div>
                        <div class="ver-field">
                            <span class="ver-field-label">Date of Birth</span>
                            <span class="ver-field-value ${result.matchResult?.dob ? 'ver-match' : 'ver-mismatch'}">${result.data.date_of_birth ? this.formatDate(result.data.date_of_birth) : '—'}</span>
                        </div>
                        <div class="ver-field">
                            <span class="ver-field-label">NID Status</span>
                            <span class="ver-field-value">${result.data.nid_status || '—'}</span>
                        </div>
                    `;
                }

                html += '</div>';
                resultContent.innerHTML = html;

                this.loadVerifications();

            } else {
                throw new Error(result.message || 'Verification failed');
            }

        } catch (error) {
            console.error('Submit verification error:', error);
            this.showToast(error.message || 'Verification failed', 'error');
        }
    },

    // ====================== APPOINTMENTS ======================
    loadAppointments: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/appointments`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load appointments');

            const appointments = await response.json();
            const container = document.getElementById('appointmentsList');

            if (!appointments || appointments.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-calendar"></i>
                        <p>কোনো অ্যাপয়েন্টমেন্ট নেই</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="appointment-grid">';
            appointments.forEach(apt => {
                html += `
                    <div class="appointment-card">
                        <div class="appointment-header">
                            <h4>${apt.application_type || apt.appointment_type}</h4>
                            <span class="status-badge ${this.getStatusClass(apt.status)}">${apt.status}</span>
                        </div>
                        <div class="appointment-body">
                            <div class="appointment-info">
                                <i class="fas fa-calendar-day"></i>
                                <span>${this.formatDate(apt.appointment_date)}</span>
                            </div>
                            <div class="appointment-info">
                                <i class="fas fa-clock"></i>
                                <span>${apt.time_slot}</span>
                            </div>
                            <div class="appointment-info">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${apt.center_name || '—'}</span>
                            </div>
                            <div class="appointment-info">
                                <i class="fas fa-ticket-alt"></i>
                                <span>${apt.token_number || apt.appointment_ref || '—'}</span>
                            </div>
                            ${apt.status === 'Scheduled' ? `
                                <div class="appointment-actions">
                                    <button class="btn-nid btn-sm" onclick="NID.rescheduleAppointment(${apt.id})">
                                        <i class="fas fa-edit"></i> Reschedule
                                    </button>
                                    <button class="btn-nid btn-sm btn-danger" onclick="NID.cancelAppointment(${apt.id})">
                                        <i class="fas fa-times"></i> Cancel
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            container.innerHTML = html;

        } catch (error) {
            console.error('Load appointments error:', error);
        }
    },

    loadAvailableSlots: async function () {
        const centerId = document.getElementById('apt-center').value;
        const date = document.getElementById('apt-date').value;

        if (!centerId || !date) return;

        try {
            const response = await fetch(`${this.API_BASE}/appointments/slots/${centerId}/${date}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load slots');

            const slots = await response.json();
            const slotSelect = document.getElementById('apt-slot');

            slotSelect.innerHTML = '<option value="">Select Time Slot</option>';

            if (slots && slots.length > 0) {
                slots.forEach(slot => {
                    const available = slot.available !== undefined ? slot.available : (slot.max_capacity - (slot.booked_count || 0));
                    const timeSlot = slot.slot || slot.time_slot;
                    if (available > 0) {
                        slotSelect.innerHTML += `<option value="${timeSlot}">${timeSlot} (${available} available)</option>`;
                    }
                });
            } else {
                slotSelect.innerHTML += '<option value="">No slots available</option>';
            }

        } catch (error) {
            console.error('Load slots error:', error);
        }
    },

    submitAppointment: async function (e) {
        e.preventDefault();

        const data = {
            appointment_type: document.getElementById('apt-type').value,
            collection_center_id: document.getElementById('apt-center').value,
            appointment_date: document.getElementById('apt-date').value,
            time_slot: document.getElementById('apt-slot').value
        };

        try {
            const response = await fetch(`${this.API_BASE}/appointments`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'অ্যাপয়েন্টমেন্ট সফল!',
                    html: `
                        <p>আপনার অ্যাপয়েন্টমেন্ট বুক হয়েছে।</p>
                        <strong>Token: ${result.tokenNumber}</strong>
                    `,
                    confirmButtonColor: '#2563eb'
                });

                document.getElementById('appointmentForm').reset();
                this.loadAppointments();
            } else {
                throw new Error(result.message || 'Failed to book appointment');
            }

        } catch (error) {
            console.error('Submit appointment error:', error);
            this.showToast(error.message || 'Failed to book appointment', 'error');
        }
    },

    cancelAppointment: async function (id) {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'Cancel Appointment?',
            text: 'আপনি কি নিশ্চিত এই অ্যাপয়েন্টমেন্ট বাতিল করতে চান?',
            showCancelButton: true,
            confirmButtonText: 'Yes, Cancel',
            cancelButtonText: 'No',
            confirmButtonColor: '#ef4444'
        });

        if (!confirm.isConfirmed) return;

        try {
            const response = await fetch(`${this.API_BASE}/appointments/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (response.ok) {
                this.showToast('Appointment cancelled', 'success');
                this.loadAppointments();
            } else {
                throw new Error('Failed to cancel');
            }

        } catch (error) {
            console.error('Cancel appointment error:', error);
            this.showToast('Failed to cancel appointment', 'error');
        }
    },

    // ====================== FAMILY MEMBERS ======================
    loadFamily: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/family`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load family');

            const members = await response.json();
            const container = document.getElementById('familyList');

            if (!members || members.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>কোনো পরিবারের সদস্য যুক্ত নেই</p>
                    </div>
                `;
                return;
            }

            let html = '<div class="family-grid">';
            members.forEach(member => {
                html += `
                    <div class="family-card">
                        <div class="family-card-header">
                            <div>
                                <h4>${member.member_name || '—'}</h4>
                                <span class="family-nid">${member.member_nid || '—'}</span>
                                <span class="family-relation">${member.relation || member.relationship}</span>
                            </div>
                            <div class="family-actions">
                                <button onclick="NID.removeFamilyMember(${member.id})" class="delete" title="Remove">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            container.innerHTML = html;

        } catch (error) {
            console.error('Load family error:', error);
        }
    },

    showAddFamilyModal: function () {
        Swal.fire({
            title: 'Add Family Member',
            html: `
                <div style="text-align: left;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #94a3b8;">Member's NID</label>
                    <input id="swal-family-nid" class="swal2-input" placeholder="NID Number">

                    <label style="display: block; margin-bottom: 0.5rem; margin-top: 1rem; color: #94a3b8;">Member's Name</label>
                    <input id="swal-family-name" class="swal2-input" placeholder="Full Name">

                    <label style="display: block; margin-bottom: 0.5rem; margin-top: 1rem; color: #94a3b8;">Relationship</label>
                    <select id="swal-family-rel" class="swal2-input">
                        <option value="Spouse">স্বামী/স্ত্রী (Spouse)</option>
                        <option value="Father">পিতা (Father)</option>
                        <option value="Mother">মাতা (Mother)</option>
                        <option value="Son">পুত্র (Son)</option>
                        <option value="Daughter">কন্যা (Daughter)</option>
                        <option value="Brother">ভাই (Brother)</option>
                        <option value="Sister">বোন (Sister)</option>
                        <option value="Grandfather">দাদা/নানা</option>
                        <option value="Grandmother">দাদী/নানী</option>
                        <option value="Other">অন্যান্য</option>
                    </select>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Add Member',
            confirmButtonColor: '#2563eb',
            preConfirm: () => {
                return {
                    member_nid: document.getElementById('swal-family-nid').value,
                    member_name: document.getElementById('swal-family-name').value,
                    relationship: document.getElementById('swal-family-rel').value
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                await this.addFamilyMember(result.value);
            }
        });
    },

    addFamilyMember: async function (data) {
        try {
            const response = await fetch(`${this.API_BASE}/family`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                this.showToast('Family member added', 'success');
                this.loadFamily();
            } else {
                throw new Error(result.message || 'Failed to add');
            }

        } catch (error) {
            console.error('Add family error:', error);
            this.showToast(error.message || 'Failed to add family member', 'error');
        }
    },

    removeFamilyMember: async function (id) {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'Remove Family Member?',
            text: 'আপনি কি নিশ্চিত এই সদস্যকে সরাতে চান?',
            showCancelButton: true,
            confirmButtonText: 'Yes, Remove',
            cancelButtonText: 'No',
            confirmButtonColor: '#ef4444'
        });

        if (!confirm.isConfirmed) return;

        try {
            const response = await fetch(`${this.API_BASE}/family/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (response.ok) {
                this.showToast('Family member removed', 'success');
                this.loadFamily();
            } else {
                throw new Error('Failed to remove');
            }

        } catch (error) {
            console.error('Remove family error:', error);
            this.showToast('Failed to remove member', 'error');
        }
    },

    // ====================== ALL APPLICATIONS ======================
    loadAllApplications: async function () {
        try {
            const response = await fetch(`${this.API_BASE}/all-applications`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load applications');

            const apps = await response.json();
            const tbody = document.getElementById('allApplicationsBody');

            if (!apps || apps.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state">কোনো আবেদন নেই</td></tr>';
                return;
            }

            let html = '';
            apps.forEach(app => {
                html += `
                    <tr>
                        <td><strong>${app.ref_no || app.reference_number}</strong></td>
                        <td>${app.type}</td>
                        <td><span class="status-badge ${this.getStatusClass(app.status)}">${app.status}</span></td>
                        <td>${this.formatDate(app.created_at)}</td>
                        <td>
                            <button class="btn-nid btn-sm" onclick="NID.viewApplicationDetails('${app.ref_no || app.reference_number}')">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

        } catch (error) {
            console.error('Load all applications error:', error);
        }
    },

    trackApplication: async function () {
        const refNo = document.getElementById('trackRefNo').value.trim();

        if (!refNo) {
            this.showToast('Please enter a reference number', 'warning');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/track/${encodeURIComponent(refNo)}`, {
                headers: this.getHeaders()
            });

            const result = await response.json();
            const resultContainer = document.getElementById('trackResult');

            if (response.ok && result) {
                resultContainer.style.display = 'block';
                resultContainer.innerHTML = `
                    <div class="ver-result-card">
                        <div class="ver-result-header">
                            <h4>${result.reference_number || result.request_no || result.application_no || refNo}</h4>
                            <span class="status-badge ${this.getStatusClass(result.status)}">${result.status}</span>
                        </div>
                        <div class="ver-field">
                            <span class="ver-field-label">Type</span>
                            <span class="ver-field-value">${result.type || 'N/A'}</span>
                        </div>
                        <div class="ver-field">
                            <span class="ver-field-label">Submitted</span>
                            <span class="ver-field-value">${this.formatDate(result.created_at)}</span>
                        </div>
                        ${result.remarks ? `
                            <div class="ver-field">
                                <span class="ver-field-label">Remarks</span>
                                <span class="ver-field-value">${result.remarks}</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            } else {
                resultContainer.style.display = 'block';
                resultContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>Application not found</p>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Track application error:', error);
            this.showToast('Failed to track application', 'error');
        }
    },

    viewApplicationDetails: async function (refNo) {
        document.getElementById('trackRefNo').value = refNo;
        await this.trackApplication();
    },

    // ====================== CENTERS ======================
    loadCenters: async function (selectId) {
        try {
            const response = await fetch(`${this.API_BASE}/centers`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error('Failed to load centers');

            const centers = await response.json();
            const select = document.getElementById(selectId);

            if (!select) return;

            select.innerHTML = '<option value="">Select Center</option>';

            centers.forEach(center => {
                select.innerHTML += `<option value="${center.id}">${center.center_name}${center.address ? ' - ' + center.address : ''}</option>`;
            });

        } catch (error) {
            console.error('Load centers error:', error);
        }
    },

    // ====================== LOCATION DROPDOWNS ======================
    loadDivisions: function () {
        const divSelects = [
            'prof-present-div',
            'prof-perm-div',
            'addr-new-div'
        ];

        divSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Select Division</option>';
                this.divisions.forEach(div => {
                    select.innerHTML += `<option value="${div.name}">${div.bn} (${div.name})</option>`;
                });
            }
        });
    },

    loadDistricts: function (prefix) {
        const divSelect = document.getElementById(`${prefix}-div`);
        const distSelect = document.getElementById(`${prefix}-dist`);
        const upaSelect = document.getElementById(`${prefix}-upa`);

        if (!divSelect || !distSelect) return;

        const divName = divSelect.value;
        const div = this.divisions.find(d => d.name === divName);

        distSelect.innerHTML = '<option value="">Select District</option>';
        if (upaSelect) upaSelect.innerHTML = '<option value="">Select Upazila</option>';

        if (div && this.districts[div.id]) {
            this.districts[div.id].forEach(dist => {
                distSelect.innerHTML += `<option value="${dist.name}">${dist.bn} (${dist.name})</option>`;
            });
        }
    },

    loadUpazilas: function (prefix) {
        // Note: For full implementation, you would need upazila data
        // This is a simplified version
        const upaSelect = document.getElementById(`${prefix}-upa`);
        if (upaSelect) {
            upaSelect.innerHTML = '<option value="">Select Upazila</option>';
            // Add common upazilas or load from API
            const commonUpazilas = ['Sadar', 'North', 'South', 'East', 'West', 'Central'];
            commonUpazilas.forEach(upa => {
                upaSelect.innerHTML += `<option value="${upa}">${upa}</option>`;
            });
        }
    },

    setLocationDropdowns: async function (prefix, division, district, upazila) {
        const divSelect = document.getElementById(`${prefix}-div`);
        if (divSelect && division) {
            divSelect.value = division;
            this.loadDistricts(prefix);

            setTimeout(() => {
                const distSelect = document.getElementById(`${prefix}-dist`);
                if (distSelect && district) {
                    distSelect.value = district;
                    this.loadUpazilas(prefix);

                    setTimeout(() => {
                        const upaSelect = document.getElementById(`${prefix}-upa`);
                        if (upaSelect && upazila) {
                            // Add the upazila if not exists
                            if (!Array.from(upaSelect.options).some(opt => opt.value === upazila)) {
                                upaSelect.innerHTML += `<option value="${upazila}">${upazila}</option>`;
                            }
                            upaSelect.value = upazila;
                        }
                    }, 50);
                }
            }, 50);
        }
    },

    // ====================== FORM SETUP ======================
    setupFormListeners: function () {
        const forms = {
            'profileForm': this.saveProfile.bind(this),
            'correctionForm': this.submitCorrection.bind(this),
            'reissueForm': this.submitReissue.bind(this),
            'smartCardForm': this.submitSmartCard.bind(this),
            'addressForm': this.submitAddressChange.bind(this),
            'verifyForm': this.submitVerification.bind(this),
            'appointmentForm': this.submitAppointment.bind(this)
        };

        Object.keys(forms).forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                form.addEventListener('submit', forms[formId]);
            }
        });
    },

    // ====================== UTILITIES ======================
    formatDate: function (dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    },

    getStatusClass: function (status) {
        const statusMap = {
            'Pending': 'status-pending',
            'Draft': 'status-pending',
            'Processing': 'status-processing',
            'Submitted': 'status-pending',
            'Under Review': 'status-processing',
            'Document Verification': 'status-processing',
            'Payment Pending': 'status-pending',
            'Biometric Appointment': 'status-processing',
            'Biometric Done': 'status-processing',
            'Card Production': 'status-processing',
            'Card Printing': 'status-processing',
            'Quality Check': 'status-processing',
            'Ready for Collection': 'status-completed',
            'Verified': 'status-approved',
            'Updated': 'status-approved',
            'Approved': 'status-approved',
            'Completed': 'status-completed',
            'Delivered': 'status-completed',
            'Rejected': 'status-rejected',
            'Scheduled': 'status-processing',
            'Confirmed': 'status-processing',
            'Missed': 'status-rejected',
            'Rescheduled': 'status-pending',
            'Cancelled': 'status-rejected',
            'Mismatch': 'status-rejected',
            'Not Found': 'status-rejected'
        };
        return statusMap[status] || 'status-pending';
    },

    showToast: function (message, type = 'info') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });

        Toast.fire({
            icon: type,
            title: message
        });
    }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    NID.init();
});
