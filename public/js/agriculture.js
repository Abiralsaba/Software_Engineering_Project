/**
 * Agriculture Ministry - Frontend Application
 * Ministry of Agriculture, Government of Bangladesh
 */

const AgriApp = {
    token: localStorage.getItem('token'),
    API: '/api/agriculture',

    init() {
        if (!this.token) {
            window.location.href = 'index.html';
            return;
        }
        this.setupNavigation();
        this.loadStats();
        this.loadRecentActivity();
        this.loadDivisions();
    },

    // ===================== NAVIGATION =====================
    setupNavigation() {
        window.showSection = (id) => {
            document.querySelectorAll('.content-section').forEach(el => el.style.display = 'none');
            document.getElementById(id).style.display = 'block';

            document.querySelectorAll('.sidebar .nav-links a').forEach(a => a.classList.remove('active'));
            const map = {
                'overview': 'Overview',
                'subsidies': 'Subsidies',
                'crop-reports': 'Crop Reports',
                'expert': 'Expert Q',
                'market': 'Farmer Market',
                'training': 'Training'
            };
            const text = map[id];
            if (text) {
                Array.from(document.querySelectorAll('.sidebar .nav-links a'))
                    .find(a => a.innerText.includes(text))?.classList.add('active');
            }

            // Load section data
            if (id === 'subsidies') this.loadSubsidyHistory();
            if (id === 'crop-reports') this.loadCropReportHistory();
            if (id === 'expert') this.loadExpertQueries();
            if (id === 'market') { this.loadMarketListings(); this.loadMyListings(); }
            if (id === 'training') { this.loadTrainingPrograms(); this.loadMyTrainings(); }
        };
    },

    // ===================== API HELPERS =====================
    async fetchAPI(url) {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.token}` } });
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
            window.location.href = 'index.html';
            return;
        }
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    },

    async postAPI(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
            body: JSON.stringify(body)
        });
        return res.json();
    },

    // ===================== LOCATIONS =====================
    async loadDivisions() {
        try {
            const divs = await this.fetchAPI(`${this.API}/locations/divisions`);
            const selectors = ['sub-division', 'cr-division', 'mkt-division'];
            selectors.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const firstOpt = el.querySelector('option');
                    el.innerHTML = '';
                    el.appendChild(firstOpt);
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
        const divId = document.getElementById(`${prefix}-division`).value;
        const distSelect = document.getElementById(`${prefix}-district`);
        const upaSelect = document.getElementById(`${prefix}-upazila`);
        distSelect.innerHTML = '<option value="">Select District</option>';
        if (upaSelect) upaSelect.innerHTML = '<option value="">Select Upazila</option>';

        if (!divId) return;
        try {
            const dists = await this.fetchAPI(`${this.API}/locations/districts/${divId}`);
            dists.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.name;
                distSelect.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    },

    async loadUpazilas(prefix) {
        const distId = document.getElementById(`${prefix}-district`).value;
        const upaSelect = document.getElementById(`${prefix}-upazila`);
        if (!upaSelect) return;
        upaSelect.innerHTML = '<option value="">Select Upazila</option>';

        if (!distId) return;
        try {
            const upas = await this.fetchAPI(`${this.API}/locations/upazilas/${distId}`);
            upas.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = u.name;
                upaSelect.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    },



    // ===================== OVERVIEW =====================
    async loadStats() {
        try {
            const stats = await this.fetchAPI(`${this.API}/stats`);
            document.getElementById('stat-subsidies').textContent = stats.subsidies || 0;
            document.getElementById('stat-reports').textContent = stats.reports || 0;
            document.getElementById('stat-queries').textContent = stats.queries || 0;
            document.getElementById('stat-listings').textContent = stats.listings || 0;
            document.getElementById('stat-trainings').textContent = stats.trainings || 0;
        } catch (e) { console.error(e); }
    },

    async loadRecentActivity() {
        const container = document.getElementById('recentActivityList');
        if (!container) return;
        try {
            const data = await this.fetchAPI(`${this.API}/recent-activity`);
            if (data.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No recent activity yet. Start by applying for a subsidy or submitting a crop report.</p></div>';
                return;
            }
            container.innerHTML = data.map(item => {
                const iconMap = {
                    'Subsidy': { icon: 'fa-seedling', bg: 'rgba(45, 106, 79, 0.2)', color: '#6ee7b7' },
                    'Crop Report': { icon: 'fa-wheat-awn', bg: 'rgba(212, 160, 23, 0.2)', color: '#f0c040' },
                    'Expert Q&A': { icon: 'fa-comment-dots', bg: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa' }
                };
                const style = iconMap[item.type] || { icon: 'fa-circle', bg: 'rgba(255,255,255,0.05)', color: '#94a3b8' };
                const statusColor = item.status === 'Approved' || item.status === 'Replied' ? '#22c55e' : item.status === 'Rejected' ? '#ef4444' : '#fbbf24';
                return `
                    <div class="activity-item">
                        <div class="activity-info">
                            <div class="activity-icon" style="background: ${style.bg}; color: ${style.color};">
                                <i class="fas ${style.icon}"></i>
                            </div>
                            <div>
                                <div class="activity-title">${item.title}</div>
                                <div class="activity-type">${item.type}</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span style="color: ${statusColor}; font-size: 0.8rem; font-weight: 600;">${item.status}</span>
                            <div class="activity-date">${new Date(item.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            container.innerHTML = '<p style="color: #64748b;">Failed to load activity.</p>';
        }
    },

    // ===================== SUBSIDIES =====================
    async loadSubsidyHistory() {
        const tbody = document.getElementById('subsidyHistoryBody');
        if (!tbody) return;
        try {
            const data = await this.fetchAPI(`${this.API}/subsidy/my-history`);
            if (!data) return;
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:2rem;">No subsidy applications yet.</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(s => `
                <tr>
                    <td>#${s.id}</td>
                    <td>${s.subsidy_type}</td>
                    <td>৳${Number(s.amount_requested).toLocaleString()}</td>
                    <td>${s.district_name || '—'}, ${s.upazila_name || ''}</td>
                    <td><span class="badge-${s.status === 'Approved' ? 'approved' : s.status === 'Rejected' ? 'rejected' : s.status === 'Under Review' ? 'review' : 'pending'}">${s.status}</span></td>
                    <td>${new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="6" style="color:#ef4444; text-align:center;">Failed to load.</td></tr>';
        }
    },

    // ===================== CROP REPORTS =====================
    async loadCropReportHistory() {
        const tbody = document.getElementById('cropReportHistoryBody');
        if (!tbody) return;
        try {
            const data = await this.fetchAPI(`${this.API}/crop-report/my-reports`);
            if (!data) return;
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:2rem;">No crop reports submitted yet.</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(r => `
                <tr>
                    <td>${r.crop_name}</td>
                    <td>${r.crop_variety || '—'}</td>
                    <td>${r.season}</td>
                    <td>${r.yield_metric_ton} MT</td>
                    <td>${r.district_name || '—'}</td>
                    <td>${new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="6" style="color:#ef4444; text-align:center;">Failed to load.</td></tr>';
        }
    },

    // ===================== TRAINING =====================
    async loadMyTrainings() {
        const tbody = document.getElementById('myTrainingBody');
        if (!tbody) return;
        try {
            const data = await this.fetchAPI(`${this.API}/training/my-registrations`);
            if (!data) return;
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:2rem;">Not registered for any training yet.</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(r => `
                <tr>
                    <td>${r.title}</td>
                    <td>${r.location || '—'}</td>
                    <td>${new Date(r.start_date).toLocaleDateString()} - ${new Date(r.end_date).toLocaleDateString()}</td>
                    <td>${r.trainer_name || '—'}</td>
                    <td><span class="badge-approved">${r.status}</span></td>
                </tr>
            `).join('');
        } catch (e) {
            console.error('Training Error:', e);
            tbody.innerHTML = `<tr><td colspan="5" style="color:#ef4444; text-align:center;">Failed to load: ${e.message}</td></tr>`;
        }
    },

    // ===================== EXPERT Q&A =====================
    async loadExpertQueries() {
        const container = document.getElementById('expertQueriesList');
        if (!container) return;
        try {
            const data = await this.fetchAPI(`${this.API}/expert/my-queries`);
            if (!data) return;
            if (data.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                        <i class="fas fa-comments"></i>
                        <p>You haven't asked any questions yet.</p>
                        <button class="btn-agri" style="margin-top: 1rem;" onclick="AgriApp.showAskExpertForm()">
                            <i class="fas fa-comment-medical"></i> Ask Your First Question
                        </button>
                    </div>
    `;
                return;
            }
            container.innerHTML = data.map(q => `
    <div class="query-card">
                    <div class="query-header">
                        <span class="badge-${q.status === 'Replied' ? 'replied' : 'pending'}">${q.status}</span>
                        <span style="color: #64748b; font-size: 0.8rem;">${new Date(q.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="query-question">${q.question}</div>
                    <div class="query-meta">
                        ${q.category ? `<span><i class="fas fa-tag" style="color: var(--agri-gold-light);"></i> ${q.category}</span>` : ''}
                        ${q.crop_name ? `<span><i class="fas fa-leaf" style="color: #6ee7b7;"></i> ${q.crop_name}</span>` : ''}
                    </div>
                    ${q.answer ? `
                        <div class="answer-box">
                            <div class="expert-label"><i class="fas fa-user-check"></i> Expert Reply ${q.answered_by ? '— ' + q.answered_by : ''}</div>
                            <p>${q.answer}</p>
                        </div>
                    ` : '<p style="color: #64748b; font-size: 0.85rem; margin-top: 0.5rem;"><i class="fas fa-hourglass-half"></i> Waiting for expert reply...</p>'
                }
                </div>
    `).join('');
        } catch (e) {
            console.error('Expert Q&A Error:', e);
            container.innerHTML = `<p style="color:#ef4444;">Failed to load queries: ${e.message}</p>`;
        }
    },

    async showAskExpertForm() {
        const { value: formValues } = await Swal.fire({
            title: '🌿 Ask Agriculture Expert',
            html: `
    <div style="text-align: left;">
                    <label style="color: #95d5b2; font-size: 0.85rem; display: block; margin-bottom: 0.3rem;">Category</label>
                    <select id="swal-category" class="swal2-input" style="width: 100%;">
                        <option value="Pest Control">কীটপতঙ্গ (Pest Control)</option>
                        <option value="Soil Health">মাটির স্বাস্থ্য (Soil Health)</option>
                        <option value="Irrigation">সেচ (Irrigation)</option>
                        <option value="Seeds">বীজ (Seeds)</option>
                        <option value="Fertilizer">সার (Fertilizer)</option>
                        <option value="Livestock">গবাদিপশু (Livestock)</option>
                        <option value="Fishery">মৎস্য (Fishery)</option>
                        <option value="Marketing">বাজারজাতকরণ (Marketing)</option>
                        <option value="Weather">আবহাওয়া (Weather)</option>
                        <option value="Other">অন্যান্য (Other)</option>
                    </select>
                    <label style="color: #95d5b2; font-size: 0.85rem; display: block; margin-top: 0.8rem; margin-bottom: 0.3rem;">Related Crop (Optional)</label>
                    <input id="swal-crop" class="swal2-input" placeholder="e.g. Rice, Potato, Jute">
                    <label style="color: #95d5b2; font-size: 0.85rem; display: block; margin-top: 0.8rem; margin-bottom: 0.3rem;">Your Question *</label>
                    <textarea id="swal-question" class="swal2-textarea" placeholder="Describe your problem in detail..." rows="4" style="width: 100%;"></textarea>
                </div>
`,
            background: '#0b1a0f',
            color: '#fff',
            showCancelButton: true,
            confirmButtonColor: '#2d6a4f',
            confirmButtonText: '<i class="fas fa-paper-plane"></i> Submit',
            preConfirm: () => {
                const question = document.getElementById('swal-question').value;
                if (!question.trim()) { Swal.showValidationMessage('Please type your question'); return false; }
                return {
                    question,
                    category: document.getElementById('swal-category').value,
                    crop_name: document.getElementById('swal-crop').value || null
                };
            }
        });

        if (formValues) {
            try {
                await this.postAPI(`${this.API}/expert/ask`, formValues);
                Swal.fire({ icon: 'success', title: 'Question Submitted!', text: 'An agriculture expert will reply soon.', background: '#0b1a0f', color: '#fff', confirmButtonColor: '#2d6a4f' });
                this.loadExpertQueries();
            } catch (e) {
                Swal.fire({ icon: 'error', title: 'Failed', background: '#0b1a0f', color: '#fff' });
            }
        }
    },

    // ===================== FARMER MARKET =====================
    async loadMarketListings() {
        const grid = document.getElementById('marketListingsGrid');
        if (!grid) return;
        try {
            const data = await this.fetchAPI(`${this.API}/market/browse`);
            if (!data) return;
            if (data.length === 0) {
                grid.innerHTML = `
    <div class="empty-state" style="grid-column: 1/-1;">
                        <i class="fas fa-store" style="font-size: 3rem; color: #64748b; margin-bottom: 1rem;"></i>
                        <p style="color: #94a3b8; font-size: 1.1rem;">No market listings available yet.</p>
                        <p style="color: #64748b; font-size: 0.85rem; margin-top: 0.5rem;">Be the first to post your produce for sale!</p>
                        <button class="btn-agri-gold" style="margin-top: 1rem;" onclick="AgriApp.showPostListingForm()">
                            <i class="fas fa-plus"></i> Post a Listing
                        </button>
                    </div> `;
                return;
            }
            grid.innerHTML = data.map(m => `
    <div class="market-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div>
                            <div style="font-size: 1.15rem; font-weight: 700; color: #fff; margin-bottom: 0.3rem;">${m.product_name}</div>
                            <span style="color: #6ee7b7; font-size: 0.8rem; background: rgba(110, 231, 183, 0.1); padding: 2px 8px; border-radius: 8px;">${m.product_category}</span>
                        </div>
                        <div style="text-align: right;">
                            <div class="product-price">৳${Number(m.price_per_unit).toLocaleString()}<span style="font-size: 0.8rem; color: #94a3b8; font-weight: 400;">/${m.unit}</span></div>
                            <span class="badge-${m.status === 'Approved' ? 'approved' : 'pending'}" style="font-size: 0.7rem; margin-top: 0.3rem;">${m.status}</span>
                        </div>
                    </div>
                    <div style="color: #94a3b8; font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; flex-grow: 1;">
                        <div><i class="fas fa-boxes" style="color: var(--agri-gold-light); width: 18px;"></i> ${m.quantity} ${m.unit} available</div>
                        <div><i class="fas fa-map-marker-alt" style="color: #6ee7b7; width: 18px;"></i> ${m.district_name || '—'}, ${m.division_name || '—'}</div>
                        ${m.description ? `<div style="color: #64748b; font-style: italic; margin-top: 0.2rem;">${m.description}</div>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 0.8rem; border-top: 1px solid rgba(255,255,255,0.05); color: #94a3b8; font-size: 0.85rem;">
                        <span><i class="fas fa-user" style="width: 16px;"></i> ${m.farmer_name}</span>
                        <span><i class="fas fa-phone" style="width: 16px;"></i> ${m.phone}</span>
                    </div>
                </div>
    `).join('');
        } catch (e) {
            grid.innerHTML = '<p style="color:#ef4444; grid-column:1/-1;">Failed to load market.</p>';
        }
    },

    async loadMyListings() {
        const tbody = document.getElementById('myListingsBody');
        if (!tbody) return;
        try {
            const data = await this.fetchAPI(`${this.API}/market/my-listings`);
            if (!data) return;
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:2rem;">No listings posted yet.</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(m => `
    <tr>
                    <td>${m.product_name}</td>
                    <td>${m.product_category}</td>
                    <td>${m.quantity} ${m.unit}</td>
                    <td>৳${Number(m.price_per_unit).toLocaleString()}</td>
                    <td><span class="badge-${m.status === 'Approved' ? 'approved' : m.status === 'Rejected' ? 'rejected' : 'pending'}">${m.status}</span></td>
                    <td>${new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
    `).join('');
        } catch (e) {
            console.error('Listings Error:', e);
            tbody.innerHTML = `<tr> <td colspan="6" style="color:#ef4444; text-align:center;">Failed to load: ${e.message}</td></tr> `;
        }
    },

    switchMarketTab(tab) {
        document.getElementById('marketBrowsePanel').style.display = tab === 'browse' ? 'block' : 'none';
        document.getElementById('marketMyPanel').style.display = tab === 'my' ? 'block' : 'none';
        document.getElementById('marketTab-browse').classList.toggle('active', tab === 'browse');
        document.getElementById('marketTab-my').classList.toggle('active', tab === 'my');
    },

    async showPostListingForm() {
        const { value: html } = await Swal.fire({
            title: '🛒 Post Product for Sale',
            html: `
    <div style="text-align: left; max-height: 60vh; overflow-y: auto; padding-right: 0.5rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                        <div>
                            <label style="color: #95d5b2; font-size: 0.82rem;">Farmer Name *</label>
                            <input id="mkt-name" class="swal2-input" placeholder="Your full name" style="width:100%;">
                        </div>
                        <div>
                            <label style="color: #95d5b2; font-size: 0.82rem;">Phone *</label>
                            <input id="mkt-phone" class="swal2-input" placeholder="01XXXXXXXXX" style="width:100%;">
                        </div>
                        <div>
                            <label style="color: #95d5b2; font-size: 0.82rem;">Product Name *</label>
                            <input id="mkt-product" class="swal2-input" placeholder="e.g. Aman Rice" style="width:100%;">
                        </div>
                        <div>
                            <label style="color: #95d5b2; font-size: 0.82rem;">Category *</label>
                            <select id="mkt-category" class="swal2-input" style="width:100%;">
                                <option value="Rice">ধান (Rice)</option>
                                <option value="Wheat">গম (Wheat)</option>
                                <option value="Vegetables">শাকসবজি (Vegetables)</option>
                                <option value="Fruits">ফল (Fruits)</option>
                                <option value="Fish">মাছ (Fish)</option>
                                <option value="Poultry">হাঁস-মুরগি (Poultry)</option>
                                <option value="Dairy">দুগ্ধ (Dairy)</option>
                                <option value="Spices">মসলা (Spices)</option>
                                <option value="Jute">পাট (Jute)</option>
                                <option value="Tea">চা (Tea)</option>
                                <option value="Other">অন্যান্য (Other)</option>
                            </select>
                        </div>
                        <div>
                            <label style="color: #95d5b2; font-size: 0.82rem;">Quantity *</label>
                            <input id="mkt-qty" class="swal2-input" type="number" placeholder="Amount" style="width:100%;">
                        </div>
                        <div>
                            <label style="color: #95d5b2; font-size: 0.82rem;">Unit</label>
                            <select id="mkt-unit" class="swal2-input" style="width:100%;">
                                <option value="kg">kg</option>
                                <option value="ton">Ton</option>
                                <option value="maund">Maund (মণ)</option>
                                <option value="piece">Piece</option>
                                <option value="litre">Litre</option>
                                <option value="dozen">Dozen</option>
                            </select>
                        </div>
                        <div>
                            <label style="color: #95d5b2; font-size: 0.82rem;">Price per Unit (৳) *</label>
                            <input id="mkt-price" class="swal2-input" type="number" placeholder="Price" style="width:100%;">
                        </div>
                        <div>
                            <label style="color: #95d5b2; font-size: 0.82rem;">Email (Optional)</label>
                            <input id="mkt-email" class="swal2-input" type="email" placeholder="your@email.com" style="width:100%;">
                        </div>
                    </div>
                    <div style="margin-top: 0.8rem;">
                        <label style="color: #95d5b2; font-size: 0.82rem;">Description</label>
                        <textarea id="mkt-desc" class="swal2-textarea" placeholder="Describe your product quality, organic/non-organic, etc." style="width:100%;"></textarea>
                    </div>
                </div>
    `,
            width: '680px',
            background: '#0b1a0f',
            color: '#fff',
            showCancelButton: true,
            confirmButtonColor: '#d4a017',
            confirmButtonText: '<i class="fas fa-paper-plane"></i> Post Listing',
            preConfirm: () => {
                const name = document.getElementById('mkt-name').value;
                const phone = document.getElementById('mkt-phone').value;
                const product = document.getElementById('mkt-product').value;
                const qty = document.getElementById('mkt-qty').value;
                const price = document.getElementById('mkt-price').value;
                if (!name || !phone || !product || !qty || !price) {
                    Swal.showValidationMessage('Please fill all required fields');
                    return false;
                }
                return {
                    farmer_name: name,
                    phone,
                    product_name: product,
                    product_category: document.getElementById('mkt-category').value,
                    quantity: qty,
                    unit: document.getElementById('mkt-unit').value,
                    price_per_unit: price,
                    email: document.getElementById('mkt-email').value || null,
                    description: document.getElementById('mkt-desc').value || null
                };
            }
        });

        if (html) {
            try {
                await this.postAPI(`${this.API}/market/listing`, html);
                Swal.fire({ icon: 'success', title: 'Listing Posted!', text: 'Awaiting admin approval before it goes live.', background: '#0b1a0f', color: '#fff', confirmButtonColor: '#2d6a4f' });
                this.loadMyListings();
            } catch (e) {
                Swal.fire({ icon: 'error', title: 'Failed', background: '#0b1a0f', color: '#fff' });
            }
        }
    },

    // ===================== TRAINING =====================
    async loadTrainingPrograms() {
        const container = document.getElementById('trainingProgramsList');
        if (!container) return;
        try {
            const data = await this.fetchAPI(`${this.API}/training/programs`);
            if (!data) return;
            if (data.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-chalkboard"></i><p>No upcoming training programs at the moment.</p></div>';
                return;
            }
            container.className = 'training-grid';
            container.innerHTML = data.map(t => `
    <div class="training-card">
                    <div class="training-header">
                        <div>
                            <div class="training-title">${t.title}</div>
                            <span class="training-category">${t.category}</span>
                        </div>
                        <span class="badge-${t.status === 'Upcoming' ? 'pending' : 'approved'}">${t.status}</span>
                    </div>
                    
                    <div class="training-desc">${t.description || 'No description available for this training program.'}</div>
                    
                    <div class="training-meta">
                        <div class="meta-item"><i class="fas fa-calendar-alt"></i> ${new Date(t.start_date).toLocaleDateString()}</div>
                        <div class="meta-item"><i class="fas fa-map-marker-alt"></i> ${t.location || 'Online'}</div>
                        <div class="meta-item"><i class="fas fa-user-tie"></i> ${t.trainer_name || 'TBA'}</div>
                        <div class="meta-item"><i class="fas fa-users"></i> Capacity: ${t.capacity}</div>
                    </div>

                    <button class="btn-agri" style="margin-top: auto;" onclick="AgriApp.registerTraining(${t.id}, '${t.title}')">
                        <i class="fas fa-clipboard-check"></i> Register Now
                    </button>
                </div>
    `).join('');
        } catch (e) {
            console.error('Training Programs Error:', e);
            container.innerHTML = `<p style="color:#ef4444;">Failed to load programs: ${e.message}</p>`;
        }
    },

    async registerTraining(programId, title) {
        const { value: formValues } = await Swal.fire({
            title: `Register for: ${title} `,
            html: `
    <div class="swal-form-grid">
                    <div class="swal-form-group" style="grid-column: 1/-1;">
                        <label>Your Name *</label>
                        <input id="reg-name" class="form-control" placeholder="Full name">
                    </div>
                    <div class="swal-form-group" style="grid-column: 1/-1;">
                        <label>Phone Number *</label>
                        <input id="reg-phone" class="form-control" placeholder="01XXXXXXXXX">
                    </div>
                </div>
    `,
            background: '#0f172a',
            color: '#fff',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Register',
            preConfirm: () => {
                const name = document.getElementById('reg-name').value;
                const phone = document.getElementById('reg-phone').value;
                if (!name || !phone) { Swal.showValidationMessage('Name and Phone are required'); return false; }
                return { farmer_name: name, phone };
            }
        });

        if (formValues) {
            try {
                const res = await this.postAPI(`${this.API}/training/register/${programId}`, formValues);
                if (res.error) {
                    Swal.fire({ icon: 'warning', title: res.error, background: '#0f172a', color: '#fff' });
                } else {
                    Swal.fire({ icon: 'success', title: 'Registered!', background: '#0f172a', color: '#fff', confirmButtonColor: '#10b981' });
                    this.loadMyTrainings();
                }
            } catch (e) {
                Swal.fire({ icon: 'error', title: 'Failed', background: '#0f172a', color: '#fff' });
            }
        }
    },

    async loadMyTrainings() {
        const tbody = document.getElementById('myTrainingBody');
        if (!tbody) return;
        try {
            const data = await this.fetchAPI(`${this.API}/training/my-registrations`);
            if (!data) return;
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:2rem;">Not registered for any training yet.</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(r => `
                <tr>
                    <td>${r.title}</td>
                    <td>${r.location || '—'}</td>
                    <td>${new Date(r.start_date).toLocaleDateString()} - ${new Date(r.end_date).toLocaleDateString()}</td>
                    <td>${r.trainer_name || '—'}</td>
                    <td><span class="badge-approved">${r.status}</span></td>
                </tr>
            `).join('');
        } catch (e) {
            console.error('Training Error:', e);
            tbody.innerHTML = `<tr><td colspan="5" style="color:#ef4444; text-align:center;">Failed to load: ${e.message}</td></tr>`;
        }
    },

    // ===================== VIEW REPORTS =====================

};

// ===================== FORM HANDLERS =====================
document.addEventListener('DOMContentLoaded', () => {
    AgriApp.init();
    window.AgriApp = AgriApp;

    // Subsidy Form
    document.getElementById('subsidyForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            farmer_name: document.getElementById('sub-farmer-name').value,
            nid_number: document.getElementById('sub-nid').value,
            phone: document.getElementById('sub-phone').value,
            subsidy_type: document.getElementById('sub-type').value,
            crop_type: document.getElementById('sub-crop').value || null,
            amount_requested: document.getElementById('sub-amount').value,
            land_size_acres: document.getElementById('sub-land').value || null,
            land_ownership: document.getElementById('sub-ownership').value,
            division_id: document.getElementById('sub-division').value || null,
            district_id: document.getElementById('sub-district').value || null,
            upazila_id: document.getElementById('sub-upazila').value || null,
            village: document.getElementById('sub-village').value || null,
            bank_name: document.getElementById('sub-bank').value || null,
            bank_branch: document.getElementById('sub-branch').value || null,
            bank_account: document.getElementById('sub-account').value || null
        };

        try {
            const res = await AgriApp.postAPI(`${AgriApp.API}/subsidy/apply`, body);
            if (res.success) {
                Swal.fire({ icon: 'success', title: 'Application Submitted!', text: 'Your subsidy application is under review.', background: '#0b1a0f', color: '#fff', confirmButtonColor: '#2d6a4f' });
                e.target.reset();
                AgriApp.loadSubsidyHistory();
                AgriApp.loadStats();
            } else {
                Swal.fire({ icon: 'error', title: 'Failed', text: res.error || 'Something went wrong.', background: '#0b1a0f', color: '#fff' });
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to submit. Try again.', background: '#0b1a0f', color: '#fff' });
        }
    });

    // Crop Report Form
    document.getElementById('cropReportForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            farmer_name: document.getElementById('cr-farmer-name').value,
            crop_name: document.getElementById('cr-crop').value,
            crop_variety: document.getElementById('cr-variety').value || null,
            season: document.getElementById('cr-season').value,
            yield_metric_ton: document.getElementById('cr-yield').value,
            land_area_acres: document.getElementById('cr-area').value || null,
            fertilizer_used: document.getElementById('cr-fertilizer').value || null,
            irrigation_method: document.getElementById('cr-irrigation').value,
            harvest_date: document.getElementById('cr-harvest-date').value || null,
            market_price_per_ton: document.getElementById('cr-price').value || null,
            division_id: document.getElementById('cr-division').value || null,
            district_id: document.getElementById('cr-district').value || null,
            upazila_id: document.getElementById('cr-upazila').value || null,
            remarks: document.getElementById('cr-remarks').value || null
        };

        try {
            const res = await AgriApp.postAPI(`${AgriApp.API}/crop-report/submit`, body);
            if (res.success) {
                Swal.fire({ icon: 'success', title: 'Report Submitted!', text: 'Crop report recorded successfully.', background: '#0b1a0f', color: '#fff', confirmButtonColor: '#2d6a4f' });
                e.target.reset();
                AgriApp.loadCropReportHistory();
                AgriApp.loadStats();
            } else {
                Swal.fire({ icon: 'error', title: 'Failed', text: res.error, background: '#0b1a0f', color: '#fff' });
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to submit.', background: '#0b1a0f', color: '#fff' });
        }
    });
});
