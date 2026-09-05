const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

let allHistoryData = [];

async function loadHistory() {
    const tableBody = document.getElementById('historyBody');

    try {
        const res = await fetch('/api/dashboard/history', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to fetch history');

        const data = await res.json();
        allHistoryData = Array.isArray(data) ? data : [];
        renderTable(allHistoryData);

    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #f87171; padding: 2rem;">
                    Failed to load history data.
                </td>
            </tr>
        `;
    }
}

function filterHistory(status) {
    // Update buttons
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`button[data-filter="${status}"]`).classList.add('active');

    if (status === 'all') {
        renderTable(allHistoryData);
    } else {
        const filtered = allHistoryData.filter(item => (item.status || 'pending').toLowerCase() === status);
        renderTable(filtered);
    }
}

function renderTable(data) {
    const tableBody = document.getElementById('historyBody');
    tableBody.innerHTML = '';

    if (data.length > 0) {
        data.forEach(item => {
            const date = new Date(item.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            });

            // Status class handling
            const status = (item.status || 'pending').toLowerCase();
            const statusClass = `status-${status}`;

            tableBody.innerHTML += `
                <tr>
                    <td style="color: #cbd5e1;">${date}</td>
                    <td style="font-weight: 500;">${item.service_type}</td>
                    <td style="color: #94a3b8; max-width: 300px;">${item.details || '-'}</td>
                    <td><span class="status-pill ${statusClass}">${item.status || 'Pending'}</span></td>
                </tr>
            `;
        });
    } else {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>
                    No items found.
                </td>
            </tr>
        `;
    }
}

document.addEventListener('DOMContentLoaded', loadHistory);
