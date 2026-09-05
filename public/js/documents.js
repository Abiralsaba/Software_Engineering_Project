const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

async function loadDocuments() {
    const loading = document.getElementById('loading');
    const container = document.getElementById('docContainer');
    const errorMsg = document.getElementById('errorMsg');

    try {
        const res = await fetch('/api/dashboard/documents', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch documents (Status: ${res.status})`);
        }

        const data = await res.json();

        loading.style.display = 'none';
        container.style.display = 'grid';
        container.innerHTML = '';

        // If API returns "message" it implies no profile found, but we fixed controller to return structure. 
        // however, defensively check keys

        // NID
        if (data.nid) {
            container.innerHTML += renderCard('National ID', 'fa-id-card', data.nid.nid_number, data.nid.expiry_date, data.nid.status, data.nid);
        } else {
            container.innerHTML += renderEmptyCard('National ID', 'fa-id-card', 'No NID Linked', 'NID');
        }

        // Passport
        if (data.passport) {
            container.innerHTML += renderCard('Passport', 'fa-passport', data.passport.passport_number, data.passport.expiry_date, data.passport.status, data.passport);
        } else {
            container.innerHTML += renderEmptyCard('Passport', 'fa-passport', 'No Passport Linked', 'Passport');
        }

        // Tax
        if (data.tax) {
            container.innerHTML += renderCard('Tax TIN', 'fa-file-invoice-dollar', data.tax.tin_number, null, data.tax.status, data.tax);
        } else {
            container.innerHTML += renderEmptyCard('Tax TIN', 'fa-file-invoice-dollar', 'No Tax Record', 'Tax');
        }

        // Land Records
        window.landRecords = data.land || []; // Store globally
        if (data.land && Array.isArray(data.land) && data.land.length > 0) {
            data.land.forEach((l, index) => {
                container.innerHTML += `
                <div class="doc-card">
                    <div class="doc-header">
                        <div class="doc-title">Land Record</div>
                        <i class="fas fa-landmark doc-icon"></i>
                    </div>
                    <div class="doc-body">
                        <p><strong>Khatian:</strong> ${l.khatian_no || 'N/A'}</p>
                        <p><strong>Dag No:</strong> ${l.dag_no || 'N/A'}</p>
                        <p><strong>Area:</strong> ${l.land_size || 0} Acres</p>
                    </div>
                    <div class="btn-group">
                        <button class="btn-sm btn-view" onclick="openLandDetails(${index})">View Details</button>
                    </div>
                </div>`;
            });
        }

    } catch (err) {
        console.error(err);
        loading.style.display = 'none';
        if (err.message.includes('401') || err.message.includes('403')) {
            errorMsg.innerHTML = 'Session expired. <a href="#" onclick="logout()" style="color:#60a5fa">Login Again</a>';
        } else {
            errorMsg.textContent = `Error: ${err.message}`;
        }
        errorMsg.style.display = 'block';
    }
}

function renderCard(title, icon, number, expiry, statusLabel, data) {
    // Check expiry
    let isExpired = false;
    // Handle Pending Status specifically
    const isPending = (data && data.status === 'Pending');
    const isRejected = (data && data.status === 'Rejected');
    const isApproved = (data && data.status === 'Approved');
    const filePath = (data && data.file_path) ? data.file_path : null;

    if (expiry) {
        const expDate = new Date(expiry);
        if (!isNaN(expDate.getTime()) && expDate < new Date()) {
            isExpired = true;
        }
    }

    let badgeClass = isExpired ? 'status-expired' : 'status-active';
    let badgeText = isExpired ? 'Expired' : (statusLabel || 'Active');
    let badgeStyle = '';

    if (isPending) {
        badgeClass = '';
        badgeText = 'Verification Pending';
        badgeStyle = 'background: rgba(59, 130, 246, 0.2); color: #60a5fa;';
    } else if (isRejected) {
        badgeClass = 'status-expired';
        badgeText = 'Rejected';
    }

    // Format expiry date string
    const dateStr = expiry ? new Date(expiry).toLocaleDateString() : 'N/A';

    return `
    <div class="doc-card">
        <div class="doc-header">
            <div class="doc-title">${title}</div>
            <i class="fas ${icon} doc-icon"></i>
        </div>
        <div class="doc-body">
            <p><strong>Number:</strong> ${number || 'N/A'}</p>
            ${!isPending && !isRejected ? `<p><strong>Expiry:</strong> ${dateStr}</p>` : ''}
            <span class="status-badge ${badgeClass}" style="${badgeStyle}">${badgeText}</span>
        </div>
        <div class="btn-group">
            ${filePath ? `<a href="${filePath}" target="_blank" class="btn-sm btn-view" style="text-align:center; text-decoration:none;">View</a>` : ''}
            ${isPending || isRejected || isApproved ?
            `<button class="btn-sm btn-renew" onclick="openOfficialUploadModal('${title.replace('National ID', 'NID').replace('Tax TIN', 'Tax')}')">Edit / Re-upload</button>`
            : (isExpired ? '<button class="btn-sm btn-renew">Renew</button>' : '')}
        </div>
    </div>`;
}

function renderEmptyCard(title, icon, msg, category) {
    const btnText = (category === 'Land') ? 'Link Record' : 'Add Now';
    const btnAction = (category === 'Land') ? "window.location.href='land.html'" : `openOfficialUploadModal('${category}')`;

    return `
    <div class="doc-card" style="border-style: dashed; opacity: 0.7;">
        <div class="doc-header">
            <div class="doc-title">${title}</div>
            <i class="fas ${icon} doc-icon" style="filter: grayscale(1);"></i>
        </div>
        <div class="doc-body">
            <p>${msg}</p>
        </div>
        <div class="btn-group">
            <button class="btn-sm btn-view" style="background: var(--primary-color);" onclick="${btnAction}">${btnText}</button>
        </div>
    </div>`;
}

function applyNow(docType) {
    Swal.fire({
        title: 'Apply for ' + docType,
        text: 'Redirecting to application form...',
        icon: 'info',
        background: '#1e293b',
        color: '#fff'
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadDocuments();
    loadUserDocuments();
});

async function loadUserDocuments() {
    const container = document.getElementById('userDocContainer');
    try {
        const res = await fetch('/api/dashboard/documents/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch user documents');
        const docs = await res.json();

        container.innerHTML = '';
        if (docs.length === 0) {
            container.innerHTML = '<p style="color: #64748b; grid-column: 1/-1; text-align: center;">No personal documents uploaded yet.</p>';
        }

        docs.forEach(doc => {
            let badgeClass = '';
            if (doc.status === 'Approved') badgeClass = 'status-active';
            else if (doc.status === 'Rejected') badgeClass = 'status-expired';
            else badgeClass = 'status-badge'; // default gray/blue-ish needed? use inline style for pending

            let statusStyle = '';
            if (doc.status === 'Pending') statusStyle = 'background: rgba(59, 130, 246, 0.2); color: #60a5fa;'; // Blue for pending

            const fileUrl = doc.file_path ? doc.file_path : '#';

            container.innerHTML += `
            <div class="doc-card">
                <div class="doc-header">
                    <div class="doc-title">${doc.doc_name}</div>
                    <i class="fas ${doc.doc_type === 'PDF' ? 'fa-file-pdf' : 'fa-image'} doc-icon"></i>
                </div>
                <div class="doc-body">
                    <p><strong>Type:</strong> ${doc.doc_type}</p>
                    <p><strong>Uploaded:</strong> ${new Date(doc.created_at).toLocaleDateString()}</p>
                     <span class="status-badge ${badgeClass}" style="${statusStyle}">${doc.status}</span>
                </div>
                <div class="btn-group">
                    <a href="${fileUrl}" target="_blank" class="btn-sm btn-view" style="text-align:center; text-decoration:none;">View</a>
                    <button class="btn-sm btn-renew" onclick="openEditModal(${doc.id}, '${doc.doc_name}', '${doc.doc_type}')">Edit / Re-upload</button>
                </div>
            </div>`;
        });

    } catch (err) {
        console.error(err);
    }
}

const modal = document.getElementById('uploadModal');
const modalTitle = document.getElementById('modalTitle');
const uploadForm = document.getElementById('uploadForm');
const editDocIdInfo = document.getElementById('editDocId');
const submitBtn = document.getElementById('submitBtn');

function openUploadModal() {
    modal.style.display = "block";
    modalTitle.textContent = "Upload Document";
    uploadForm.reset();
    editDocIdInfo.value = '';
    document.getElementById('docFile').required = true;
    submitBtn.textContent = "Upload";
}

function closeUploadModal() {
    modal.style.display = "none";
}

function openEditModal(id, name, type) {
    modal.style.display = "block";
    modalTitle.textContent = "Edit Document";
    document.getElementById('docName').value = name;
    document.getElementById('docType').value = type;
    editDocIdInfo.value = id;
    document.getElementById('docFile').required = false; // File optional on edit
    submitBtn.textContent = "Update";
}

window.onclick = function (event) {
    if (event.target == modal) {
        closeUploadModal();
    }
}

async function handleUpload(e) {
    e.preventDefault();
    const id = editDocIdInfo.value;
    const isEdit = !!id;

    const formData = new FormData();
    formData.append('docType', document.getElementById('docType').value);
    formData.append('docName', document.getElementById('docName').value);

    const fileInput = document.getElementById('docFile');
    if (fileInput.files[0]) {
        formData.append('document', fileInput.files[0]);
    }

    const url = isEdit ? `/api/dashboard/documents/update/${id}` : '/api/dashboard/documents/upload';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        // strict token cleaning: remove anything that is NOT alphanumeric, dot, underscore, or dash
        // jWTs only contain these characters. This strips newlines, spaces, quotes, and invisible control chars
        const cleanToken = token.replace(/[^a-zA-Z0-9\._\-]/g, '');

        if (!cleanToken) {
            throw new Error('Invalid session token. Please login again.');
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${cleanToken}` },
            body: formData
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Request failed');
        }

        Swal.fire({
            icon: 'success',
            title: isEdit ? 'Updated!' : 'Uploaded!',
            text: 'Your document has been submitted for verification.',
            background: '#1e293b',
            color: '#fff'
        });

        closeUploadModal();
        loadUserDocuments(); // Refresh list

    } catch (err) {
        let msg = err.message;
        // Double check for header error just in case
        if (msg.includes('expected pattern') || msg.includes('header')) {
            msg = 'Browser security blocked the request due to invalid session data. Please Logout and Login cleanly.';
        }
        Swal.fire({
            icon: 'error',
            title: 'Authentication Error',
            text: msg,
            footer: '<a href="#" onclick="logout()" style="color: #3b82f6;">Click here to Fix (Logout)</a>',
            background: '#1e293b',
            color: '#fff',
            allowOutsideClick: false
        });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Update' : 'Upload';
    }
}

// --- NEW: Official Document Upload Logic ---

const officialModal = document.getElementById('officialUploadModal');
const officialForm = document.getElementById('officialUploadForm');

function openOfficialUploadModal(category) {
    document.getElementById('officialDocCategory').value = category;
    document.getElementById('officialModalTitle').innerText = category.includes('NID') ? 'Add NID' : (category.includes('Passport') ? 'Add Passport' : 'Add Tax Info');
    // Normalize category for DB 'NID', 'Passport', 'Tax'
    let dbCat = category;
    if (category.includes('NID') || category.includes('National')) dbCat = 'NID';
    else if (category.includes('Tax')) dbCat = 'Tax';

    document.getElementById('officialDocCategory').value = dbCat;
    document.getElementById('officialIdentityNumber').value = ''; // Clear previous input
    officialModal.style.display = 'block';
}

function closeOfficialUploadModal() {
    officialModal.style.display = 'none';
    officialForm.reset();
}

// Close when clicking outside - merged logic
window.onclick = function (event) {
    if (event.target == document.getElementById('uploadModal')) closeUploadModal();
    if (event.target == officialModal) closeOfficialUploadModal();
}

async function handleOfficialUpload(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('officialSubmitBtn');
    const fileInput = document.getElementById('officialDocFile');
    const category = document.getElementById('officialDocCategory').value;
    const identityNumber = document.getElementById('officialIdentityNumber').value;
    console.log('Packaging Upload:', { category, identityNumber });

    const formData = new FormData();
    formData.append('docCategory', category);
    formData.append('identityNumber', identityNumber);
    formData.append('document', fileInput.files[0]);

    const token = localStorage.getItem('token');
    const url = '/api/dashboard/documents/upload-official';

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';

        // Token cleaning
        const cleanToken = token.replace(/[^a-zA-Z0-9\._\-]/g, '');

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${cleanToken}` },
            body: formData
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Upload failed');
        }

        Swal.fire({
            icon: 'success',
            title: 'Submitted!',
            text: 'Your document has been sent for verification.',
            background: '#1e293b',
            color: '#fff'
        });

        closeOfficialUploadModal();
        loadDocuments(); // Refresh official docs list (to show Pending)

    } catch (err) {
        let msg = err.message;
        // handle invalid token / header errors specifically
        if (msg.includes('expected pattern') || msg.includes('header') || msg.includes('Invalid session token')) {
            msg = 'Browser security blocked the request due to invalid session data. Please Logout and Login cleanly.';
        }

        Swal.fire({
            icon: 'error',
            title: 'Authentication Error',
            text: msg,
            footer: '<a href="#" onclick="logout()" style="color: #3b82f6; font-weight: bold;">Click here to Fix (Logout)</a>',
            background: '#1e293b',
            color: '#fff',
            allowOutsideClick: false
        });
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload';
    }
}

// --- Land Details Modal Logic ---
const landModal = document.getElementById('landDetailsModal');

function openLandDetails(index) {
    const record = window.landRecords[index];
    if (!record) return;

    const content = document.getElementById('landDetailsContent');
    content.innerHTML = `
        <div><strong>Division:</strong> <span style="color: #cbd5e1">${record.division || 'N/A'}</span></div>
        <div><strong>District:</strong> <span style="color: #cbd5e1">${record.district || 'N/A'}</span></div>
        <div><strong>Upazila:</strong> <span style="color: #cbd5e1">${record.upazila || 'N/A'}</span></div>
        <div><strong>Mouza:</strong> <span style="color: #cbd5e1">${record.mouza || 'N/A'}</span></div>
        
        <div><strong>Khatian No:</strong> <span style="color: #cbd5e1">${record.khatian_no || 'N/A'}</span></div>
        <div><strong>Dag No:</strong> <span style="color: #cbd5e1">${record.dag_no || 'N/A'}</span></div>
        <div><strong>JL No:</strong> <span style="color: #cbd5e1">${record.jl_no || 'N/A'}</span></div>
        <div><strong>Hold No:</strong> <span style="color: #cbd5e1">${record.hold_no || 'N/A'}</span></div>
        
        <div><strong>Land Size:</strong> <span style="color: #cbd5e1">${record.land_size || 0} Acres</span></div>
        <div><strong>Price:</strong> <span style="color: #cbd5e1">${record.land_price || 'N/A'} BDT</span></div>
        <div><strong>Deed No:</strong> <span style="color: #cbd5e1">${record.deed_no || 'N/A'}</span></div>
        <div><strong>Owner:</strong> <span style="color: #cbd5e1">${record.owner_name || 'N/A'}</span></div>
        
        <div style="grid-column: 1 / -1; margin-top: 10px;">
            <strong>Description/Ownership:</strong><br>
            <span style="color: #cbd5e1">${record.ownership_description || 'N/A'}</span>
        </div>
    `;

    landModal.style.display = 'block';
}

function closeLandModal() {
    landModal.style.display = 'none';
}

// Update generic window click
const oldWindowOnClick = window.onclick;
window.onclick = function (event) {
    if (oldWindowOnClick) oldWindowOnClick(event);
    if (event.target == landModal) closeLandModal();
}
