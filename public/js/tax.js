// =============================================
// NBR Tax Portal - Frontend Logic
// Bangladesh Central Government Portal
// =============================================

const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

const API = '/api/tax';
let taxZones = [];
let userTIN = null;

// =============================================
// SECTION NAVIGATION
// =============================================
function showTaxSection(sectionId) {
    document.querySelectorAll('.tax-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

    const section = document.getElementById(`tax-${sectionId}`);
    if (section) section.classList.add('active');

    // highlight sidebar
    const link = document.querySelector(`.nav-links a[data-section="${sectionId}"]`);
    if (link) link.classList.add('active');

    // Load section data
    switch (sectionId) {
        case 'dashboard': loadDashboard(); break;
        case 'tin': loadTINStatus(); break;
        case 'ereturn': loadReturns(); break;
        case 'calculator': break;
        case 'payments': loadPayments(); break;
        case 'vat': loadVATStatus(); break;
        case 'notices': loadNotices(); break;
        case 'zones': loadZones(); break;
        case 'challan': loadChallans(); break;
    }
}

// =============================================
// DASHBOARD
// =============================================
async function loadDashboard() {
    try {
        const res = await fetch(`${API}/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        // TIN Status
        const tinEl = document.getElementById('dash-tin-status');
        if (data.tin) {
            if (data.tin.status === 'Approved') {
                tinEl.innerHTML = `<span class="tax-badge approved"><i class="fas fa-check-circle"></i> Active</span>`;
                document.getElementById('dash-tin-number').textContent = data.tin.tin_number || '—';
            } else {
                tinEl.innerHTML = `<span class="tax-badge pending"><i class="fas fa-clock"></i> ${data.tin.status}</span>`;
            }
        } else {
            tinEl.innerHTML = `<span class="tax-badge draft"><i class="fas fa-times-circle"></i> Not Registered</span>`;
        }

        // Stats
        document.getElementById('dash-returns-count').textContent = data.returns?.total_returns || 0;
        document.getElementById('dash-tax-paid').textContent = formatBDT(data.payments?.total_paid || 0);
        document.getElementById('dash-pending').textContent = data.returns?.pending_returns || 0;
        document.getElementById('dash-notices').textContent = data.unreadNotices || 0;

    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

// =============================================
// TIN REGISTRATION
// =============================================
async function loadTINStatus() {
    try {
        const res = await fetch(`${API}/tin/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.getElementById('tin-status-display');
        const formContainer = document.getElementById('tin-form-container');

        if (data && data.status === 'Approved') {
            userTIN = data;
            container.innerHTML = `
                <div class="tin-display">
                    <div class="tin-label">Your Taxpayer Identification Number</div>
                    <div class="tin-number">${data.tin_number}</div>
                    <div class="tax-badge approved" style="display: inline-flex; margin-top: 0.5rem;">
                        <i class="fas fa-check-circle"></i> Active & Verified
                    </div>
                </div>
                <div class="tax-card">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div><span style="color: #94a3b8; font-size: 0.8rem;">Name</span><br>
                            <span style="color: #fff;">${data.taxpayer_name}</span></div>
                        <div><span style="color: #94a3b8; font-size: 0.8rem;">NID</span><br>
                            <span style="color: #fff;">${data.nid_number || '—'}</span></div>
                        <div><span style="color: #94a3b8; font-size: 0.8rem;">Tax Zone</span><br>
                            <span style="color: #fff;">${data.zone_name || '—'}</span></div>
                        <div><span style="color: #94a3b8; font-size: 0.8rem;">Taxpayer Type</span><br>
                            <span style="color: #fff;">${data.taxpayer_type}</span></div>
                        <div><span style="color: #94a3b8; font-size: 0.8rem;">Registration Date</span><br>
                            <span style="color: #fff;">${new Date(data.approved_at || data.created_at).toLocaleDateString('en-BD')}</span></div>
                        <div><span style="color: #94a3b8; font-size: 0.8rem;">Source of Income</span><br>
                            <span style="color: #fff;">${data.source_of_income || '—'}</span></div>
                    </div>
                </div>`;
            formContainer.style.display = 'none';
        } else if (data && data.status === 'Pending') {
            container.innerHTML = `
                <div class="tax-info-banner">
                    <i class="fas fa-clock"></i>
                    <p>Your TIN application is under review. You will be notified once it's processed.</p>
                </div>`;
            formContainer.style.display = 'none';
        } else if (data && data.status === 'Rejected') {
            container.innerHTML = `
                <div class="tax-info-banner" style="border-color: rgba(239, 68, 68, 0.2); background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.1));">
                    <i class="fas fa-times-circle" style="color: #f87171;"></i>
                    <p style="color: #fca5a5;">Your TIN application was rejected. ${data.remarks ? 'Reason: ' + data.remarks : ''} You may apply again.</p>
                </div>`;
            formContainer.style.display = 'block';
        } else {
            container.innerHTML = '';
            formContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('TIN status error:', error);
    }
}

async function applyTIN(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        taxpayer_name: form.taxpayer_name.value,
        father_name: form.father_name.value,
        mother_name: form.mother_name.value,
        date_of_birth: form.date_of_birth.value,
        nid_number: form.nid_number.value,
        passport_number: form.passport_number.value,
        mobile: form.mobile.value,
        email: form.email.value,
        present_address: form.present_address.value,
        permanent_address: form.permanent_address.value,
        taxpayer_type: form.taxpayer_type.value,
        source_of_income: form.source_of_income.value,
        zone_id: form.zone_id.value || null
    };

    try {
        const res = await fetch(`${API}/tin/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Application Submitted!', text: 'Your TIN application has been submitted for review.', background: '#0f172a', color: '#fff' });
            form.reset();
            loadTINStatus();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: result.error, background: '#0f172a', color: '#fff' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Failed', text: 'Network error occurred.', background: '#0f172a', color: '#fff' });
    }
}

// =============================================
// E-RETURN FILING
// =============================================
async function loadReturns() {
    try {
        const res = await fetch(`${API}/returns`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.getElementById('returns-list');
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="tax-empty">
                    <i class="fas fa-file-alt"></i>
                    <h4>No Returns Filed</h4>
                    <p>You haven't filed any tax returns yet.</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div style="overflow-x: auto;">
                <table class="tax-data-table">
                    <thead>
                        <tr>
                            <th>Ref No.</th>
                            <th>Assessment Year</th>
                            <th>Total Income</th>
                            <th>Tax Liability</th>
                            <th>Tax Due</th>
                            <th>Status</th>
                            <th>Filed On</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(r => `
                            <tr>
                                <td style="font-family: monospace; color: #60a5fa;">${r.submission_ref}</td>
                                <td>${r.assessment_year}</td>
                                <td>${formatBDT(r.total_income)}</td>
                                <td>${formatBDT(r.net_tax_liability)}</td>
                                <td style="color: ${r.tax_due > 0 ? '#f87171' : '#34d399'};">${formatBDT(r.tax_due)}</td>
                                <td>${getStatusBadge(r.status)}</td>
                                <td>${new Date(r.created_at).toLocaleDateString('en-BD')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (error) {
        console.error('Returns error:', error);
    }
}

async function fileReturn(e) {
    e.preventDefault();
    const form = e.target;

    const data = {
        assessment_year: form.assessment_year.value,
        income_year: form.income_year.value,
        return_type: form.return_type.value,
        salary_income: form.salary_income.value || 0,
        house_property_income: form.house_property_income.value || 0,
        agriculture_income: form.agriculture_income.value || 0,
        business_income: form.business_income.value || 0,
        capital_gains: form.capital_gains.value || 0,
        other_income: form.other_income.value || 0,
        tax_exempted_income: form.tax_exempted_income.value || 0,
        tax_rebate: form.tax_rebate.value || 0,
        tax_paid_advance: form.tax_paid_advance.value || 0,
        tax_deducted_source: form.tax_deducted_source.value || 0,
        total_assets: form.total_assets.value || 0,
        total_liabilities: form.total_liabilities.value || 0,
        total_expenditure: form.total_expenditure.value || 0
    };

    try {
        const res = await fetch(`${API}/returns/file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Return Filed Successfully!',
                html: `
                    <div style="text-align: left; font-size: 0.9rem;">
                        <p><strong>Reference:</strong> ${result.submission_ref}</p>
                        <p><strong>Total Income:</strong> ৳${Number(result.tax_computed.total_income).toLocaleString()}</p>
                        <p><strong>Taxable Income:</strong> ৳${Number(result.tax_computed.taxable_income).toLocaleString()}</p>
                        <p><strong>Net Tax:</strong> ৳${Number(result.tax_computed.net_tax).toLocaleString()}</p>
                        <p><strong>Tax Due:</strong> ৳${Number(result.tax_computed.tax_due).toLocaleString()}</p>
                    </div>`,
                background: '#0f172a', color: '#fff'
            });
            form.reset();
            loadReturns();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: result.error, background: '#0f172a', color: '#fff' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Failed', text: 'Network error.', background: '#0f172a', color: '#fff' });
    }
}

// =============================================
// TAX CALCULATOR
// =============================================
function calculateTax() {
    const income = parseFloat(document.getElementById('calc-income').value) || 0;
    const exempted = parseFloat(document.getElementById('calc-exempted').value) || 0;
    const rebateInvestment = parseFloat(document.getElementById('calc-investment').value) || 0;

    const taxableIncome = Math.max(0, income - exempted);

    // BD Tax Slabs 2025-26
    const slabs = [
        { limit: 350000, rate: 0, label: 'First ৳3,50,000' },
        { limit: 100000, rate: 0.05, label: 'Next ৳1,00,000' },
        { limit: 400000, rate: 0.10, label: 'Next ৳4,00,000' },
        { limit: 500000, rate: 0.15, label: 'Next ৳5,00,000' },
        { limit: 500000, rate: 0.20, label: 'Next ৳5,00,000' },
        { limit: Infinity, rate: 0.25, label: 'Remaining' }
    ];

    let totalTax = 0;
    let remaining = taxableIncome;
    let breakdown = [];

    for (const slab of slabs) {
        if (remaining <= 0) break;
        const applicable = Math.min(remaining, slab.limit);
        const tax = applicable * slab.rate;
        totalTax += tax;
        breakdown.push({ ...slab, applicable, tax });
        remaining -= applicable;
    }

    // Tax rebate (lesser of 15% of investment or tax)
    const maxRebateEligible = Math.min(rebateInvestment, income * 0.25, 10000000);
    const rebate = Math.min(maxRebateEligible * 0.15, totalTax);
    const netTax = Math.max(0, totalTax - rebate);

    // Minimum tax
    const minTax = taxableIncome > 0 ? 5000 : 0;
    const finalTax = Math.max(netTax, minTax);

    // Display
    const resultDiv = document.getElementById('calc-result');
    resultDiv.classList.add('visible');
    resultDiv.innerHTML = `
        <h4 style="color: #34d399; margin-bottom: 1rem;"><i class="fas fa-calculator"></i> Tax Computation Result</h4>
        <div class="calc-breakdown">
            <div class="calc-item">
                <span class="label">Gross Income</span>
                <span class="value">${formatBDT(income)}</span>
            </div>
            <div class="calc-item">
                <span class="label">Tax Exempted</span>
                <span class="value">${formatBDT(exempted)}</span>
            </div>
            <div class="calc-item">
                <span class="label">Taxable Income</span>
                <span class="value">${formatBDT(taxableIncome)}</span>
            </div>
            <div class="calc-item">
                <span class="label">Tax Before Rebate</span>
                <span class="value">${formatBDT(totalTax)}</span>
            </div>
            <div class="calc-item">
                <span class="label">Tax Rebate</span>
                <span class="value" style="color: #34d399;">- ${formatBDT(rebate)}</span>
            </div>
            <div class="calc-item total">
                <span class="label" style="font-size: 1rem; font-weight: 600;">Net Tax Payable</span>
                <span class="value">${formatBDT(finalTax)}</span>
            </div>
        </div>
    `;
}

// =============================================
// PAYMENTS
// =============================================
async function loadPayments() {
    try {
        const res = await fetch(`${API}/payments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.getElementById('payments-list');
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="tax-empty">
                    <i class="fas fa-money-bill-wave"></i>
                    <h4>No Payments Found</h4>
                    <p>You haven't made any tax payments yet.</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div style="overflow-x: auto;">
                <table class="tax-data-table">
                    <thead>
                        <tr>
                            <th>Receipt No.</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Transaction ID</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(p => `
                            <tr>
                                <td style="font-family: monospace; color: #60a5fa;">${p.receipt_no || '—'}</td>
                                <td>${p.payment_type}</td>
                                <td style="font-weight: 600; color: #34d399;">${formatBDT(p.amount)}</td>
                                <td>${p.payment_method}</td>
                                <td>${p.transaction_id || '—'}</td>
                                <td>${getStatusBadge(p.status)}</td>
                                <td>${new Date(p.payment_date).toLocaleDateString('en-BD')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (error) {
        console.error('Payments error:', error);
    }
}

async function makePayment(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        payment_type: form.payment_type.value,
        amount: form.amount.value,
        payment_method: form.payment_method.value,
        bank_name: form.bank_name.value,
        branch_name: form.branch_name.value,
        transaction_id: form.transaction_id.value,
        fiscal_year: form.fiscal_year.value
    };

    try {
        const res = await fetch(`${API}/payments/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: 'success', title: 'Payment Recorded!',
                text: `Receipt No: ${result.receipt_no}`,
                background: '#0f172a', color: '#fff'
            });
            form.reset();
            loadPayments();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: result.error, background: '#0f172a', color: '#fff' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Failed', background: '#0f172a', color: '#fff' });
    }
}

// =============================================
// VAT REGISTRATION
// =============================================
async function loadVATStatus() {
    try {
        const res = await fetch(`${API}/vat/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.getElementById('vat-status-display');
        const formContainer = document.getElementById('vat-form-container');

        if (data && data.status === 'Active') {
            container.innerHTML = `
                <div class="tin-display" style="border-color: rgba(139, 92, 246, 0.3);">
                    <div class="tin-label">Business Identification Number (BIN)</div>
                    <div class="tin-number" style="color: #a78bfa;">${data.bin_number}</div>
                    <div class="tax-badge active" style="display: inline-flex; margin-top: 0.5rem;">
                        <i class="fas fa-check-circle"></i> Active
                    </div>
                </div>
                <div class="tax-card">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div><span style="color: #94a3b8; font-size: 0.8rem;">Business Name</span><br>
                            <span style="color: #fff;">${data.business_name}</span></div>
                        <div><span style="color: #94a3b8; font-size: 0.8rem;">Type</span><br>
                            <span style="color: #fff;">${data.business_type}</span></div>
                        <div><span style="color: #94a3b8; font-size: 0.8rem;">Trade License</span><br>
                            <span style="color: #fff;">${data.trade_license_no || '—'}</span></div>
                        <div><span style="color: #94a3b8; font-size: 0.8rem;">Annual Turnover</span><br>
                            <span style="color: #fff;">${formatBDT(data.annual_turnover)}</span></div>
                    </div>
                </div>`;
            formContainer.style.display = 'none';
        } else if (data && data.status === 'Pending') {
            container.innerHTML = `
                <div class="tax-info-banner">
                    <i class="fas fa-clock"></i>
                    <p>Your VAT registration is under review.</p>
                </div>`;
            formContainer.style.display = 'none';
        } else {
            container.innerHTML = '';
            formContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('VAT status error:', error);
    }
}

async function registerVAT(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        business_name: form.business_name.value,
        business_name_bn: form.business_name_bn.value,
        business_type: form.business_type.value,
        trade_license_no: form.trade_license_no.value,
        business_address: form.business_address.value,
        annual_turnover: form.annual_turnover.value || 0,
        contact_person: form.contact_person.value,
        contact_phone: form.contact_phone.value,
        contact_email: form.contact_email.value
    };

    try {
        const res = await fetch(`${API}/vat/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Submitted!', text: result.message, background: '#0f172a', color: '#fff' });
            form.reset();
            loadVATStatus();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: result.error, background: '#0f172a', color: '#fff' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Failed', background: '#0f172a', color: '#fff' });
    }
}

// =============================================
// NOTICES
// =============================================
async function loadNotices() {
    try {
        const res = await fetch(`${API}/notices`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.getElementById('notices-list');
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="tax-empty">
                    <i class="fas fa-bell-slash"></i>
                    <h4>No Notices</h4>
                    <p>You don't have any tax notices at this time.</p>
                </div>`;
            return;
        }

        container.innerHTML = data.map(n => `
            <div class="notice-item ${n.status === 'Issued' ? 'unread' : ''}">
                <div class="notice-header">
                    <div class="notice-subject">${n.subject}</div>
                    <div class="notice-date">${new Date(n.created_at).toLocaleDateString('en-BD')}</div>
                </div>
                <div class="notice-message">${n.message}</div>
                <div class="notice-meta">
                    <span class="tax-badge ${n.notice_type.toLowerCase()}" style="background: rgba(139,92,246,0.1); color: #a78bfa; border-color: rgba(139,92,246,0.3);">
                        ${n.notice_type}
                    </span>
                    <span class="tax-badge ${n.priority.toLowerCase() === 'urgent' ? 'rejected' : n.priority.toLowerCase() === 'high' ? 'pending' : 'draft'}">
                        ${n.priority}
                    </span>
                    ${n.due_date ? `<span style="color: #64748b; font-size: 0.8rem;"><i class="fas fa-calendar"></i> Due: ${new Date(n.due_date).toLocaleDateString('en-BD')}</span>` : ''}
                </div>
                ${n.status === 'Issued' ? `<button class="btn-nbr secondary" style="margin-top: 0.75rem; padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="markNoticeRead(${n.id})"><i class="fas fa-check"></i> Mark as Read</button>` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Notices error:', error);
    }
}

async function markNoticeRead(id) {
    try {
        await fetch(`${API}/notices/${id}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadNotices();
    } catch (error) { console.error(error); }
}

// =============================================
// TAX ZONES
// =============================================
async function loadZones() {
    try {
        if (taxZones.length === 0) {
            const res = await fetch(`${API}/zones`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            taxZones = await res.json();
        }

        const container = document.getElementById('zones-list');
        container.innerHTML = `
            <div class="zone-grid">
                ${taxZones.map(z => `
                    <div class="zone-card">
                        <div class="zone-name"><i class="fas fa-building"></i> ${z.zone_name}</div>
                        <div class="zone-name-bn">${z.zone_name_bn || ''}</div>
                        <div class="zone-info"><i class="fas fa-map-marker-alt"></i> ${z.district}, ${z.division}</div>
                        <div class="zone-info"><i class="fas fa-hashtag"></i> Code: ${z.zone_code}</div>
                        ${z.office_address ? `<div class="zone-info"><i class="fas fa-location-arrow"></i> ${z.office_address}</div>` : ''}
                    </div>
                `).join('')}
            </div>`;
    } catch (error) {
        console.error('Zones error:', error);
    }
}

// Populate zone dropdowns
async function populateZoneDropdowns() {
    try {
        if (taxZones.length === 0) {
            const res = await fetch(`${API}/zones`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            taxZones = await res.json();
        }

        document.querySelectorAll('.zone-select').forEach(select => {
            const current = select.value;
            select.innerHTML = '<option value="">Select Tax Zone</option>' +
                taxZones.map(z => `<option value="${z.id}">${z.zone_name} (${z.zone_code})</option>`).join('');
            if (current) select.value = current;
        });
    } catch (error) { console.error(error); }
}

// =============================================
// CHALLAN
// =============================================
async function loadChallans() {
    try {
        const res = await fetch(`${API}/challan`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        const container = document.getElementById('challan-list');
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="tax-empty">
                    <i class="fas fa-receipt"></i>
                    <h4>No Challans</h4>
                    <p>No challans generated yet.</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div style="overflow-x: auto;">
                <table class="tax-data-table">
                    <thead>
                        <tr>
                            <th>Challan No.</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Bank</th>
                            <th>Assessment Year</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(c => `
                            <tr>
                                <td style="font-family: monospace; color: #60a5fa;">${c.challan_no}</td>
                                <td>${c.deposit_type}</td>
                                <td style="font-weight: 600; color: #34d399;">${formatBDT(c.amount)}</td>
                                <td>${c.bank_name || '—'} ${c.branch_name ? '(' + c.branch_name + ')' : ''}</td>
                                <td>${c.assessment_year || '—'}</td>
                                <td>${getStatusBadge(c.status)}</td>
                                <td>${new Date(c.deposit_date).toLocaleDateString('en-BD')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (error) {
        console.error('Challan error:', error);
    }
}

async function generateChallan(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        tin_number: form.challan_tin.value,
        assessment_year: form.challan_year.value,
        tax_zone: form.challan_zone.value,
        deposit_type: form.deposit_type.value,
        amount: form.challan_amount.value,
        bank_name: form.challan_bank.value,
        branch_name: form.challan_branch.value
    };

    try {
        const res = await fetch(`${API}/challan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: 'success', title: 'Challan Generated!',
                text: `Challan No: ${result.challan_no}`,
                background: '#0f172a', color: '#fff'
            });
            form.reset();
            loadChallans();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: result.error, background: '#0f172a', color: '#fff' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Failed', background: '#0f172a', color: '#fff' });
    }
}

// =============================================
// HELPER FUNCTIONS
// =============================================
function formatBDT(amount) {
    return '৳' + Number(amount || 0).toLocaleString('en-IN');
}

function getStatusBadge(status) {
    if (!status) return '';
    const s = status.toLowerCase().replace(/\s+/g, '-');
    const classMap = {
        'pending': 'pending',
        'approved': 'approved',
        'accepted': 'accepted',
        'active': 'active',
        'verified': 'verified',
        'rejected': 'rejected',
        'failed': 'failed',
        'cancelled': 'cancelled',
        'submitted': 'submitted',
        'under-review': 'under-review',
        'draft': 'draft',
        'generated': 'submitted',
        'deposited': 'approved',
        'refunded': 'pending'
    };
    const cls = classMap[s] || 'draft';
    return `<span class="tax-badge ${cls}">${status}</span>`;
}

// =============================================
// INITIALIZE
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    populateZoneDropdowns();
    showTaxSection('dashboard');
});
