/**
 * সরকারি বিজ্ঞপ্তি — Government Notices Frontend
 * People's Republic of Bangladesh
 * 
 * Features:
 * - Fetches notices from /api/notices with search, filter, pagination
 * - Displays total stats from API response
 * - Bangla date display
 * - Detail modal with full notice content
 * - Clear filters functionality
 */

let currentPage = 1;
let totalResults = 0;
let departmentsLoaded = false;
let debounceTimer;

// ========================
// INITIALIZATION
// ========================
document.addEventListener('DOMContentLoaded', () => {
    // Set Bangla date
    setBanglaDate();

    // Load initial notices
    loadNotices();

    // Search with debounce
    document.getElementById('searchInput').addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentPage = 1;
            loadNotices();
        }, 350);
    });

    // Filter change handlers
    ['departmentFilter', 'categoryFilter', 'priorityFilter'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            currentPage = 1;
            loadNotices();
            updateClearButton();
        });
    });

    // Clear filters button
    document.getElementById('clearFilters').addEventListener('click', clearAllFilters);

    // Modal close
    document.getElementById('noticeModal').addEventListener('click', (e) => {
        if (e.target.id === 'noticeModal') closeNoticeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeNoticeModal();
    });
});

// ========================
// BANGLA DATE
// ========================
function setBanglaDate() {
    const el = document.getElementById('currentDateBn');
    if (!el) return;

    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const bnMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
        'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

    const now = new Date();
    const day = String(now.getDate()).split('').map(d => bnDigits[parseInt(d)]).join('');
    const month = bnMonths[now.getMonth()];
    const year = String(now.getFullYear()).split('').map(d => bnDigits[parseInt(d)]).join('');

    el.textContent = `${day} ${month}, ${year}`;
}

// ========================
// FETCH & RENDER NOTICES
// ========================
async function loadNotices() {
    const container = document.getElementById('noticesContainer');
    container.innerHTML = `
        <div class="loading-wrap">
            <div class="spinner"></div>
            <p>বিজ্ঞপ্তি লোড হচ্ছে...</p>
        </div>`;

    const search = document.getElementById('searchInput').value.trim();
    const department = document.getElementById('departmentFilter').value;
    const category = document.getElementById('categoryFilter').value;
    const priority = document.getElementById('priorityFilter').value;

    const params = new URLSearchParams({ page: currentPage, limit: 10 });
    if (search) params.set('search', search);
    if (department) params.set('department', department);
    if (category) params.set('category', category);
    if (priority) params.set('priority', priority);

    try {
        const res = await fetch(`/api/notices?${params}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Server error (${res.status})`);
        }

        const data = await res.json();

        // Populate department filter (once)
        if (!departmentsLoaded && data.departments && data.departments.length > 0) {
            const select = document.getElementById('departmentFilter');
            data.departments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept;
                opt.textContent = dept;
                select.appendChild(opt);
            });
            departmentsLoaded = true;
        }

        // Update stats
        totalResults = data.total;
        updateStats(data);

        // Results info
        showResultsInfo(data);

        // Render notices
        if (!data.notices || data.notices.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-search"></i></div>
                    <h3>কোনো বিজ্ঞপ্তি পাওয়া যায়নি</h3>
                    <p>অনুসন্ধান বা ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন</p>
                </div>`;
        } else {
            container.innerHTML = data.notices.map((n, i) => renderNoticeCard(n, i)).join('');
        }

        // Pagination
        renderPagination(data.totalPages || 1, data.page || 1);

    } catch (error) {
        console.error('Notice load error:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <h3>বিজ্ঞপ্তি লোড করতে ব্যর্থ</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>`;
    }
}

function updateStats(data) {
    // Use total from API for overall count
    const el = (id) => document.getElementById(id);
    el('statTotal').textContent = data.total || 0;

    // Category counts from current page notices
    const notices = data.notices || [];
    el('statUrgent').textContent = notices.filter(n => n.category === 'Urgent').length;
    el('statCircular').textContent = notices.filter(n => n.category === 'Circular').length;
    el('statTender').textContent = notices.filter(n => n.category === 'Tender').length;
    el('statRecruitment').textContent = notices.filter(n => n.category === 'Recruitment').length;
}

function showResultsInfo(data) {
    const infoEl = document.getElementById('resultsInfo');
    const countEl = document.getElementById('resultsCount');
    if (data.total > 0) {
        infoEl.style.display = 'flex';
        const start = ((data.page - 1) * 10) + 1;
        const end = Math.min(data.page * 10, data.total);
        countEl.innerHTML = `মোট <strong>${data.total}</strong> টি বিজ্ঞপ্তির মধ্যে <strong>${start}–${end}</strong> টি দেখাচ্ছে`;
    } else {
        infoEl.style.display = 'none';
    }
}

function renderNoticeCard(notice, index) {
    const publishDate = formatBanglaDate(notice.publish_date);

    const categoryBn = {
        'General': 'সাধারণ', 'Urgent': 'জরুরি', 'Circular': 'পরিপত্র',
        'Tender': 'দরপত্র', 'Recruitment': 'নিয়োগ'
    };

    const priorityBn = {
        'High': 'উচ্চ', 'Medium': 'মাঝারি', 'Low': 'সাধারণ'
    };

    return `
        <div class="notice-item pri-${notice.priority} cat-${notice.category}" 
             onclick="openNoticeDetail(${notice.id})"
             style="animation-delay: ${index * 0.06}s">
            <div class="notice-top-row">
                <div class="notice-title-area">
                    <div class="notice-title-bn">${escapeHtml(notice.title_bn || notice.title)}</div>
                    ${notice.title_bn ? `<div class="notice-title-en">${escapeHtml(notice.title)}</div>` : ''}
                </div>
                <div class="notice-tags">
                    <span class="tag tag-${notice.category}">${categoryBn[notice.category] || notice.category}</span>
                    <span class="tag tag-pri-${notice.priority}">${priorityBn[notice.priority] || notice.priority}</span>
                </div>
            </div>
            <div class="notice-excerpt">${escapeHtml(notice.content)}</div>
            <div class="notice-footer">
                <span><i class="fas fa-building"></i> ${escapeHtml(notice.department)}</span>
                ${notice.reference_no ? `<span><i class="fas fa-file-signature"></i> ${escapeHtml(notice.reference_no)}</span>` : ''}
                <span><i class="far fa-calendar"></i> ${publishDate}</span>
                ${notice.expiry_date ? `<span><i class="fas fa-hourglass-end"></i> মেয়াদ: ${formatBanglaDate(notice.expiry_date)}</span>` : ''}
                ${notice.created_by_name ? `<span><i class="fas fa-user-shield"></i> ${escapeHtml(notice.created_by_name)}</span>` : ''}
                ${notice.attachment_url ? `<span><i class="fas fa-paperclip"></i> সংযুক্তি</span>` : ''}
            </div>
        </div>`;
}

// ========================
// NOTICE DETAIL MODAL
// ========================
async function openNoticeDetail(id) {
    const modal = document.getElementById('noticeModal');
    document.getElementById('modalTitleBn').textContent = 'লোড হচ্ছে...';
    document.getElementById('modalTitleEn').textContent = '';
    document.getElementById('modalRef').textContent = '';
    document.getElementById('modalBody').innerHTML = `
        <div class="loading-wrap">
            <div class="spinner"></div>
        </div>`;
    modal.classList.add('active');

    try {
        const res = await fetch(`/api/notices/${id}`);
        if (!res.ok) throw new Error('Notice not found');
        const notice = await res.json();

        // Header
        document.getElementById('modalRef').textContent = notice.reference_no ? `স্মারক: ${notice.reference_no}` : '';
        document.getElementById('modalTitleBn').textContent = notice.title_bn || notice.title;
        document.getElementById('modalTitleEn').textContent = notice.title_bn ? notice.title : '';

        const categoryBn = {
            'General': 'সাধারণ', 'Urgent': 'জরুরি', 'Circular': 'পরিপত্র',
            'Tender': 'দরপত্র', 'Recruitment': 'নিয়োগ'
        };

        const priorityBn = { 'High': 'উচ্চ', 'Medium': 'মাঝারি', 'Low': 'সাধারণ' };

        // Body
        let bodyHtml = `
            <div class="modal-info-grid">
                <div class="modal-info-item">
                    <label>মন্ত্রণালয় / বিভাগ</label>
                    <div class="info-value">${escapeHtml(notice.department)}</div>
                </div>
                <div class="modal-info-item">
                    <label>বিজ্ঞপ্তির ধরন</label>
                    <div class="info-value">
                        <span class="tag tag-${notice.category}">${categoryBn[notice.category] || notice.category}</span>
                    </div>
                </div>
                <div class="modal-info-item">
                    <label>অগ্রাধিকার</label>
                    <div class="info-value">
                        <span class="tag tag-pri-${notice.priority}">${priorityBn[notice.priority] || notice.priority}</span>
                    </div>
                </div>
                <div class="modal-info-item">
                    <label>প্রকাশের তারিখ</label>
                    <div class="info-value">${formatBanglaDate(notice.publish_date)}</div>
                </div>
                <div class="modal-info-item">
                    <label>মেয়াদ উত্তীর্ণ</label>
                    <div class="info-value">${notice.expiry_date ? formatBanglaDate(notice.expiry_date) : 'প্রযোজ্য নয়'}</div>
                </div>
                <div class="modal-info-item">
                    <label>স্মারক নং</label>
                    <div class="info-value" style="font-family: monospace;">${notice.reference_no || 'N/A'}</div>
                </div>
                <div class="modal-info-item">
                    <label>প্রকাশক</label>
                    <div class="info-value"><i class="fas fa-user-shield" style="margin-right: 4px; color: var(--primary-color);"></i> ${notice.created_by_name ? escapeHtml(notice.created_by_name) : 'সিস্টেম'}</div>
                </div>
            </div>`;

        if (notice.attachment_url) {
            bodyHtml += `
                <a href="${escapeHtml(notice.attachment_url)}" target="_blank" class="modal-attachment">
                    <i class="fas fa-download"></i> সংযুক্তি ডাউনলোড করুন
                </a>`;
        }

        bodyHtml += `
            <div class="modal-content-body">
                <div class="content-label">
                    <i class="fas fa-align-left"></i> বিজ্ঞপ্তির বিবরণ
                </div>
                ${escapeHtml(notice.content)}
            </div>`;

        document.getElementById('modalBody').innerHTML = bodyHtml;

    } catch (error) {
        document.getElementById('modalBody').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-exclamation-circle"></i></div>
                <h3>বিজ্ঞপ্তি লোড করতে ব্যর্থ</h3>
            </div>`;
    }
}

function closeNoticeModal() {
    document.getElementById('noticeModal').classList.remove('active');
}

// ========================
// PAGINATION
// ========================
function renderPagination(totalPages, page) {
    const container = document.getElementById('pagination');
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `<button class="page-btn" onclick="goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
    </button>`;

    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
        html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (start > 2) html += `<button class="page-btn" disabled>…</button>`;
    }

    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (end < totalPages) {
        if (end < totalPages - 1) html += `<button class="page-btn" disabled>…</button>`;
        html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="page-btn" onclick="goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
    </button>`;

    container.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    loadNotices();
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================
// FILTER HELPERS
// ========================
function updateClearButton() {
    const hasFilters =
        document.getElementById('searchInput').value.trim() !== '' ||
        document.getElementById('departmentFilter').value !== '' ||
        document.getElementById('categoryFilter').value !== '' ||
        document.getElementById('priorityFilter').value !== '';

    document.getElementById('clearFilters').style.display = hasFilters ? 'inline-flex' : 'none';
}

function clearAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('departmentFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('priorityFilter').value = '';
    document.getElementById('clearFilters').style.display = 'none';
    currentPage = 1;
    loadNotices();
}

// ========================
// UTILITY
// ========================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatBanglaDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('bn-BD', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    } catch {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }
}
