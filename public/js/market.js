/**
 * Market Info JavaScript
 * Handles market prices display, filtering, and complaint submission
 */

const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/';
}

let allPrices = [];
let currentCategory = 'All';

// Utility
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// =====================
// SECTION NAVIGATION
// =====================

function showSection(section) {
    const hubView = document.getElementById('hubView');
    const pricesSection = document.getElementById('pricesSection');
    const reportSection = document.getElementById('reportSection');

    hubView.style.display = 'none';
    pricesSection.classList.remove('active');
    reportSection.classList.remove('active');

    if (section === 'hub') {
        hubView.style.display = 'block';
    } else if (section === 'prices') {
        pricesSection.classList.add('active');
        loadMarketPrices();
    } else if (section === 'report') {
        reportSection.classList.add('active');
        loadMyComplaints();
    }
}

// =====================
// MARKET PRICES (Public — no auth needed)
// =====================

async function loadMarketPrices() {
    try {
        const res = await fetch('/api/shop/market-prices');
        const prices = await res.json();

        if (Array.isArray(prices)) {
            allPrices = prices;
            renderPrices(prices);
            buildCategoryTabs(prices);
            renderPriceStats(prices);
        } else {
            document.getElementById('priceTableBody').innerHTML = `
                <tr><td colspan="6" class="no-data-msg">
                    <i class="fas fa-exclamation-circle"></i> Failed to load prices
                </td></tr>`;
        }
    } catch (error) {
        console.error('Error loading market prices:', error);
        document.getElementById('priceTableBody').innerHTML = `
            <tr><td colspan="6" class="no-data-msg">
                <i class="fas fa-exclamation-circle"></i> Network error. Please refresh.
            </td></tr>`;
    }
}

function renderPrices(prices) {
    const tbody = document.getElementById('priceTableBody');

    if (prices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="no-data-msg">
            <i class="fas fa-inbox"></i> No prices found for this filter
        </td></tr>`;
        return;
    }

    tbody.innerHTML = prices.map((p, i) => `
        <tr>
            <td style="color: #4b5563;">${i + 1}</td>
            <td>
                <strong>${p.item_name}</strong>
                ${p.item_name_bn ? `<span class="item-bn">${p.item_name_bn}</span>` : ''}
            </td>
            <td><span class="category-badge">${p.category}</span></td>
            <td>per ${p.unit}</td>
            <td class="price-val">৳${parseFloat(p.price).toFixed(2)}</td>
            <td class="effective-date">${formatDate(p.effective_date || p.updated_at)}</td>
        </tr>
    `).join('');
}

function buildCategoryTabs(prices) {
    const categories = ['All', ...new Set(prices.map(p => p.category))];
    const container = document.getElementById('categoryTabs');

    container.innerHTML = categories.map(cat => `
        <span class="category-tab ${cat === currentCategory ? 'active' : ''}" onclick="filterByCategory('${cat}')">${cat}</span>
    `).join('');
}

function filterByCategory(category) {
    currentCategory = category;
    const filtered = category === 'All' ? allPrices : allPrices.filter(p => p.category === category);
    renderPrices(filtered);

    // Update active tab
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent === category);
    });

    // Also apply search filter
    filterPrices();
}

function filterPrices() {
    const searchTerm = document.getElementById('priceSearch').value.toLowerCase();
    let filtered = currentCategory === 'All' ? allPrices : allPrices.filter(p => p.category === currentCategory);

    if (searchTerm) {
        filtered = filtered.filter(p =>
            p.item_name.toLowerCase().includes(searchTerm) ||
            (p.item_name_bn && p.item_name_bn.includes(searchTerm))
        );
    }

    renderPrices(filtered);
}

function renderPriceStats(prices) {
    const categories = [...new Set(prices.map(p => p.category))];
    const container = document.getElementById('priceStats');

    container.innerHTML = `
        <div class="price-stat-card">
            <div class="stat-num">${prices.length}</div>
            <div class="stat-label">Total Items</div>
        </div>
        <div class="price-stat-card">
            <div class="stat-num">${categories.length}</div>
            <div class="stat-label">Categories</div>
        </div>
        <div class="price-stat-card">
            <div class="stat-num">৳${Math.min(...prices.map(p => parseFloat(p.price))).toFixed(0)}</div>
            <div class="stat-label">Lowest Price</div>
        </div>
        <div class="price-stat-card">
            <div class="stat-num">৳${Math.max(...prices.map(p => parseFloat(p.price))).toFixed(0)}</div>
            <div class="stat-label">Highest Price</div>
        </div>
    `;
}

// =====================
// PRICE DIFFERENCE AUTO-CALC
// =====================

function setupPriceDifference() {
    const officialInput = document.querySelector('input[name="official_price"]');
    const chargedInput = document.querySelector('input[name="charged_price"]');
    const diffDisplay = document.getElementById('priceDifference');

    function calcDiff() {
        const official = parseFloat(officialInput.value) || 0;
        const charged = parseFloat(chargedInput.value) || 0;

        if (official > 0 && charged > 0) {
            const diff = charged - official;
            const pct = ((diff / official) * 100).toFixed(1);
            if (diff > 0) {
                diffDisplay.value = `+৳${diff.toFixed(2)} (${pct}% overcharged)`;
                diffDisplay.style.color = '#f87171';
            } else if (diff < 0) {
                diffDisplay.value = `৳${diff.toFixed(2)} (under official)`;
                diffDisplay.style.color = '#4ade80';
            } else {
                diffDisplay.value = 'No difference';
                diffDisplay.style.color = '#94a3b8';
            }
        } else {
            diffDisplay.value = '';
        }
    }

    officialInput.addEventListener('input', calcDiff);
    chargedInput.addEventListener('input', calcDiff);
}

// =====================
// COMPLAINTS
// =====================

document.getElementById('complaintForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Remove the readonly difference field from the payload
    delete data.priceDifference;

    try {
        const res = await fetch('/api/shop/complaints', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: 'Complaint Submitted!',
                text: result.message,
                background: '#1e293b',
                color: '#f1f5f9',
                confirmButtonColor: '#00c9a7'
            });
            form.reset();
            document.getElementById('priceDifference').value = '';
            loadMyComplaints();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Submission Failed',
                text: result.error || 'Failed to submit complaint. Please try again.',
                background: '#1e293b',
                color: '#f1f5f9'
            });
        }
    } catch (error) {
        console.error('Error submitting complaint:', error);
        Swal.fire({
            icon: 'error',
            title: 'Network Error',
            text: 'Could not reach the server. Please check your connection.',
            background: '#1e293b',
            color: '#f1f5f9'
        });
    }
});

async function loadMyComplaints() {
    const container = document.getElementById('myComplaints');
    try {
        const res = await fetch('/api/shop/complaints/my', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const complaints = await res.json();

        if (!Array.isArray(complaints) || complaints.length === 0) {
            container.innerHTML = `
                <div class="no-data-msg">
                    <i class="fas fa-folder-open"></i>
                    You haven't filed any complaints yet.
                </div>`;
            return;
        }

        container.innerHTML = complaints.map(c => `
            <div class="complaint-card">
                <div class="complaint-info">
                    <h4>${c.shop_name} — ${c.item_name}</h4>
                    <p>
                        <i class="fas fa-location-dot" style="color: #64748b;"></i> ${c.shop_location}
                        ${c.shop_phone ? ` &nbsp;|&nbsp; <i class="fas fa-phone" style="color: #64748b;"></i> ${c.shop_phone}` : ''}
                    </p>
                    <p style="margin-top: 0.4rem;">
                        ${c.official_price ? `Official: <span style="color: #4ade80;">৳${parseFloat(c.official_price).toFixed(2)}</span> → ` : ''}
                        Charged: <strong style="color: #f87171;">৳${parseFloat(c.charged_price).toFixed(2)}</strong>
                        ${c.official_price ? ` <span style="color: #f87171; font-size: 0.8rem;">(+${(parseFloat(c.charged_price) - parseFloat(c.official_price)).toFixed(2)} extra)</span>` : ''}
                    </p>
                    ${c.description ? `<p style="margin-top: 0.4rem; font-style: italic; color: #64748b;">"${c.description}"</p>` : ''}
                    ${c.admin_notes ? `<p style="margin-top: 0.4rem; color: #60a5fa;"><i class="fas fa-comment-dots"></i> Admin: ${c.admin_notes}</p>` : ''}
                    <p style="margin-top: 0.5rem; color: #374151; font-size: 0.8rem;"><i class="fas fa-clock"></i> ${formatDate(c.created_at)}</p>
                </div>
                <span class="complaint-status ${c.status}">${c.status}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading complaints:', error);
        container.innerHTML = '<div class="no-data-msg"><i class="fas fa-exclamation-circle"></i> Failed to load complaints. Please refresh.</div>';
    }
}


// =====================
// USER PROFILE (Sidebar)
// =====================

async function loadUserProfile() {
    try {
        const res = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load profile');

        const user = await res.json();

        // Update Name and NID
        if (document.getElementById('userName')) document.getElementById('userName').textContent = user.name;
        if (document.getElementById('userNid')) document.getElementById('userNid').textContent = 'NID: ' + user.nid;

        // Update Avatar
        if (user.profile_image) {
            const avatarEls = document.querySelectorAll('.user-avatar');
            avatarEls.forEach(el => {
                el.innerHTML = `<img src="${user.profile_image}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            });
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        // If auth fails, we might want to logout or just show guest
        // For now, we keep the existing redirect logic at the top of the file
    }
}

// =====================
// INITIALIZE
// =====================

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    setupPriceDifference();
});

