const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';
let currentGroupId = null;
let currentUserName = 'User';
let currentUserId = null;

async function loadUserInfo() {
    try {
        const res = await fetch('/api/dashboard/summary', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        currentUserName = data.user?.name || 'User';
        currentUserId = data.user?.id || null;
        document.getElementById('currentUserAvatar').textContent = currentUserName.charAt(0).toUpperCase();
    } catch (e) { console.error(e); }
}
loadUserInfo();

function showTab(tab) {
    ['discover', 'my-groups', 'create', 'group-detail'].forEach(s => {
        const el = document.getElementById(s + '-section');
        if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const navEl = document.getElementById('nav-' + tab);
    if (navEl) navEl.classList.add('active');
    const targetEl = document.getElementById(tab + '-section');
    if (targetEl) targetEl.style.display = 'block';
    if (tab === 'discover') loadGroups();
    if (tab === 'my-groups') loadMyGroups();
}

async function loadGroups() {
    const grid = document.getElementById('groupsGrid');
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';
    try {
        const res = await fetch('/api/community/groups', { headers: { 'Authorization': `Bearer ${token}` } });
        const groups = await res.json();
        if (groups.length === 0) {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-users-slash"></i><p>No communities yet.</p></div>';
            return;
        }
        grid.innerHTML = groups.map(g => `
            <div class="group-card" onclick="openGroup(${g.id})">
                <div class="group-cover" ${g.cover_image ? `style="background-image: url('${g.cover_image}'); background-size: cover; background-position: center;"` : ''}>${!g.cover_image ? '<i class="fas fa-users"></i>' : ''}</div>
                <div class="group-info">
                    <div class="group-name">${escapeHtml(g.name)}</div>
                    <div class="group-desc">${escapeHtml(g.description || 'No description')}</div>
                    <div class="group-meta"><span><i class="fas fa-users"></i> ${g.member_count}</span></div>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); grid.innerHTML = '<div class="empty-state"><p>Failed to load</p></div>'; }
}

async function loadMyGroups() {
    const grid = document.getElementById('myGroupsGrid');
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const res = await fetch('/api/community/my-groups', { headers: { 'Authorization': `Bearer ${token}` } });
        const groups = await res.json();
        if (groups.length === 0) {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-layer-group"></i><p>No groups joined.</p></div>';
            return;
        }
        grid.innerHTML = groups.map(g => `
            <div class="group-card" onclick="openGroup(${g.id})">
                <div class="group-cover" ${g.cover_image ? `style="background-image: url('${g.cover_image}'); background-size: cover; background-position: center;"` : ''}>${!g.cover_image ? '<i class="fas fa-users"></i>' : ''}</div>
                <div class="group-info">
                    <div class="group-name">${escapeHtml(g.name)}</div>
                    <div class="group-meta"><span><i class="fas fa-users"></i> ${g.member_count}</span><span>${g.my_role}</span></div>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function openGroup(groupId) {
    currentGroupId = groupId;
    showTab('group-detail');
    const header = document.getElementById('groupDetailHeader');
    const postsContainer = document.getElementById('postsContainer');
    header.innerHTML = '<p style="color: white;">Loading...</p>';
    try {
        const res = await fetch(`/api/community/groups/${groupId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const group = await res.json();
        // Apply cover image to header if exists
        if (group.cover_image) {
            header.style.backgroundImage = `linear-gradient(rgba(102, 126, 234, 0.7), rgba(118, 75, 162, 0.7)), url('${group.cover_image}')`;
            header.style.backgroundSize = 'cover';
            header.style.backgroundPosition = 'center';
        } else {
            header.style.backgroundImage = 'linear-gradient(135deg, #667eea, #764ba2)';
        }
        const isGroupAdmin = group.my_role === 'admin' || group.created_by == currentUserId;
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h1>${escapeHtml(group.name)}</h1>
                    <p>${escapeHtml(group.description || '')}</p>
                    <div class="group-meta" style="color: rgba(255,255,255,0.7); margin-bottom: 1rem;">
                        <span><i class="fas fa-users"></i> ${group.member_count} members</span>
                    </div>
                    <div>${group.is_member ? `<button class="btn-leave" onclick="leaveGroup(${group.id})">Leave</button>` : `<button class="btn-join" onclick="joinGroup(${group.id})">Join</button>`}</div>
                </div>
                ${isGroupAdmin ? `<button onclick="openEditGroupModal(${group.id}, '${encodeURIComponent(group.name)}', '${encodeURIComponent(group.description || '')}', '${group.cover_image || ''}')" style="background: rgba(255,255,255,0.2); border: none; border-radius: 8px; padding: 0.5rem 1rem; color: white; cursor: pointer;"><i class="fas fa-edit"></i> Edit Group</button>` : ''}
            </div>
        `;
        document.getElementById('createPostBox').style.display = group.is_member ? 'flex' : 'none';
        if (group.posts.length === 0) {
            postsContainer.innerHTML = '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>No posts yet.</p></div>';
        } else {
            postsContainer.innerHTML = group.posts.map(p => renderPost(p)).join('');
        }
    } catch (e) { console.error(e); header.innerHTML = '<p style="color: #ef4444;">Failed to load</p>'; }
}

function renderPost(post) {
    const initials = (post.author_name || 'U').charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(new Date(post.created_at));
    const isAuthor = post.user_id == currentUserId; // Use == for type coercion
    return `
        <div class="post-card" id="post-${post.id}" data-content="${encodeURIComponent(post.content)}" data-image="${post.image_url || ''}">
            <div class="post-header">
                <div class="post-avatar">${initials}</div>
                <div style="flex: 1;"><div class="post-author">${escapeHtml(post.author_name)}</div><div class="post-time">${timeAgo}</div></div>
                ${isAuthor ? `<button class="post-edit-btn" onclick="openEditPostModalFromElement(${post.id})" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 0.5rem;" title="Edit post"><i class="fas fa-edit"></i></button>` : ''}
            </div>
            <div class="post-content">${escapeHtml(post.content)}</div>
            ${post.image_url ? `<img src="${post.image_url}" style="width: 100%; border-radius: 8px; margin-bottom: 1rem;">` : ''}
            <div class="post-actions">
                <button class="post-action-btn ${post.liked_by_me ? 'liked' : ''}" onclick="toggleLike(${post.id}, this)"><i class="fas fa-heart"></i> <span>${post.like_count}</span></button>
                <button class="post-action-btn" onclick="toggleComments(${post.id})"><i class="fas fa-comment"></i> <span>${post.comment_count}</span></button>
            </div>
            <div class="comments-section" id="comments-${post.id}" style="display: none;">
                <div id="comments-list-${post.id}"></div>
                <div class="comment-input-wrapper"><input type="text" class="comment-input" id="comment-input-${post.id}" placeholder="Write a comment..." onkeypress="handleCommentKeypress(event, ${post.id})"></div>
            </div>
        </div>
    `;
}

async function joinGroup(groupId) {
    try {
        const res = await fetch(`/api/community/groups/${groupId}/join`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) { Swal.fire({ icon: 'success', title: 'Joined!', background: '#1e293b', color: '#fff', timer: 1500 }); openGroup(groupId); }
        else throw new Error(data.error);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message, background: '#1e293b', color: '#fff' }); }
}

async function leaveGroup(groupId) {
    const confirm = await Swal.fire({ title: 'Leave?', showCancelButton: true, background: '#1e293b', color: '#fff' });
    if (!confirm.isConfirmed) return;
    try {
        const res = await fetch(`/api/community/groups/${groupId}/leave`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) { Swal.fire({ icon: 'success', title: 'Left', background: '#1e293b', color: '#fff', timer: 1500 }); showTab('discover'); }
    } catch (e) { Swal.fire({ icon: 'error', text: e.message, background: '#1e293b', color: '#fff' }); }
}

async function toggleLike(postId, btn) {
    try {
        const res = await fetch(`/api/community/posts/${postId}/like`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) {
            btn.classList.toggle('liked', data.liked);
            const countSpan = btn.querySelector('span');
            let count = parseInt(countSpan.textContent);
            countSpan.textContent = data.liked ? count + 1 : count - 1;
        }
    } catch (e) { console.error(e); }
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (section.style.display === 'none') { section.style.display = 'block'; loadComments(postId); }
    else section.style.display = 'none';
}

async function loadComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    list.innerHTML = '<p style="color: #64748b;">Loading...</p>';
    try {
        const res = await fetch(`/api/community/posts/${postId}/comments`, { headers: { 'Authorization': `Bearer ${token}` } });
        const comments = await res.json();
        if (comments.length === 0) {
            list.innerHTML = '<p style="color: #64748b;">No comments yet</p>';
        } else {
            list.innerHTML = comments.map(c => {
                const isOwner = c.user_id == currentUserId;
                return `
                    <div class="comment-item" id="comment-${c.id}" data-content="${encodeURIComponent(c.content)}">
                        <div class="comment-avatar">${(c.author_name || 'U').charAt(0)}</div>
                        <div class="comment-body" style="flex: 1;">
                            <div class="comment-author">${escapeHtml(c.author_name)}</div>
                            <div class="comment-text">${escapeHtml(c.content)}</div>
                        </div>
                        ${isOwner ? `
                            <div class="comment-actions" style="display: flex; gap: 0.5rem;">
                                <button type="button" onclick="event.stopPropagation(); editComment(${c.id}, ${postId})" style="background: none; border: none; color: #94a3b8; cursor: pointer;" title="Edit"><i class="fas fa-edit"></i></button>
                                <button type="button" onclick="event.stopPropagation(); deleteComment(${c.id}, ${postId})" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="Delete"><i class="fas fa-trash"></i></button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }
    } catch (e) { list.innerHTML = '<p style="color: #ef4444;">Failed</p>'; }
}

async function editComment(commentId, postId) {
    const commentEl = document.getElementById(`comment-${commentId}`);
    const currentContent = decodeURIComponent(commentEl.dataset.content || '');

    const { value: newContent, isConfirmed } = await Swal.fire({
        title: 'Edit Comment',
        input: 'textarea',
        inputValue: currentContent,
        inputPlaceholder: 'Edit your comment...',
        showCancelButton: true,
        background: '#1e293b',
        color: '#fff',
        confirmButtonText: 'Save',
        inputValidator: (value) => {
            if (!value || !value.trim()) {
                return 'Comment cannot be empty';
            }
        }
    });

    if (isConfirmed && newContent) {
        try {
            const res = await fetch(`/api/community/comments/${commentId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content: newContent.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'Updated!', timer: 1500, showConfirmButton: false, background: '#1e293b', color: '#fff' });
                loadComments(postId);
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            Swal.fire({ icon: 'error', text: e.message, background: '#1e293b', color: '#fff' });
        }
    }
}

async function deleteComment(commentId, postId) {
    const confirmResult = await Swal.fire({
        title: 'Delete Comment?',
        text: 'This cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Delete',
        background: '#1e293b',
        color: '#fff'
    });

    if (confirmResult.isConfirmed) {
        try {
            const res = await fetch(`/api/community/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false, background: '#1e293b', color: '#fff' });
                loadComments(postId);
                // update comment count in UI
                const btn = document.querySelector(`#post-${postId} .post-action-btn:nth-child(2) span`);
                if (btn) btn.textContent = Math.max(0, parseInt(btn.textContent) - 1);
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            Swal.fire({ icon: 'error', text: e.message, background: '#1e293b', color: '#fff' });
        }
    }
}

async function handleCommentKeypress(e, postId) {
    if (e.key === 'Enter') {
        const input = document.getElementById(`comment-input-${postId}`);
        const content = input.value.trim();
        if (!content) return;
        try {
            const res = await fetch(`/api/community/posts/${postId}/comments`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
            if (res.ok) { input.value = ''; loadComments(postId); const btn = document.querySelector(`#post-${postId} .post-action-btn:nth-child(2) span`); if (btn) btn.textContent = parseInt(btn.textContent) + 1; }
        } catch (e) { console.error(e); }
    }
}

let coverImageFile = null;

function handleCoverImageUpload(input) {
    if (input.files && input.files[0]) {
        coverImageFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('coverPreviewImg').src = e.target.result;
            document.getElementById('coverPreview').style.display = 'block';
            document.getElementById('uploadBtnText').textContent = 'Change cover image';
        };
        reader.readAsDataURL(coverImageFile);
    }
}

function removeCoverImage() {
    coverImageFile = null;
    document.getElementById('groupCoverFile').value = '';
    document.getElementById('coverPreview').style.display = 'none';
    document.getElementById('coverPreviewImg').src = '';
    document.getElementById('uploadBtnText').textContent = 'Click to upload cover image';
}

document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('groupName').value.trim();
    const description = document.getElementById('groupDesc').value.trim();

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    if (coverImageFile) {
        formData.append('cover_image', coverImageFile);
    }

    try {
        const res = await fetch('/api/community/groups', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Created!', text: data.message, background: '#1e293b', color: '#fff' });
            document.getElementById('createGroupForm').reset();
            removeCoverImage();
            showTab('my-groups');
        }
        else throw new Error(data.error);
    } catch (e) { Swal.fire({ icon: 'error', text: e.message, background: '#1e293b', color: '#fff' }); }
});

function openCreatePostModal() { document.getElementById('createPostModal').style.display = 'flex'; }
function closeCreatePostModal() {
    document.getElementById('createPostModal').style.display = 'none';
    document.getElementById('createPostForm').reset();
    removePostImage();
}

let postImageFile = null;

function handlePostImageUpload(input) {
    if (input.files && input.files[0]) {
        postImageFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('postPreviewImg').src = e.target.result;
            document.getElementById('postImagePreview').style.display = 'block';
            document.getElementById('postUploadBtnText').textContent = 'Change image';
        };
        reader.readAsDataURL(postImageFile);
    }
}

function removePostImage() {
    postImageFile = null;
    document.getElementById('postImageFile').value = '';
    document.getElementById('postImagePreview').style.display = 'none';
    document.getElementById('postPreviewImg').src = '';
    document.getElementById('postUploadBtnText').textContent = 'Click to add an image';
}

document.getElementById('createPostForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('postContent').value.trim();
    if (!currentGroupId) return;

    const formData = new FormData();
    formData.append('content', content);
    if (postImageFile) {
        formData.append('post_image', postImageFile);
    }

    try {
        const res = await fetch(`/api/community/groups/${currentGroupId}/posts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Posted!', text: data.message, background: '#1e293b', color: '#fff' });
            closeCreatePostModal();
        }
        else throw new Error(data.error);
    } catch (e) { Swal.fire({ icon: 'error', text: e.message, background: '#1e293b', color: '#fff' }); }
});

function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function formatTimeAgo(date) { const s = Math.floor((new Date() - date) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h'; return Math.floor(s / 86400) + 'd'; }

// Edit Post Functions
let editPostImageFile = null;
let keepExistingImage = false;

function openEditPostModalFromElement(postId) {
    const postElement = document.getElementById(`post-${postId}`);
    const content = decodeURIComponent(postElement.dataset.content || '');
    const imageUrl = postElement.dataset.image || '';
    openEditPostModal(postId, content, imageUrl);
}

function openEditPostModal(postId, content, imageUrl) {
    document.getElementById('editPostId').value = postId;
    document.getElementById('editPostContent').value = content;
    editPostImageFile = null;
    keepExistingImage = !!imageUrl;

    if (imageUrl) {
        document.getElementById('editPostPreviewImg').src = imageUrl;
        document.getElementById('editPostImagePreview').style.display = 'block';
        document.getElementById('editPostUploadBtnText').textContent = 'Change image';
    } else {
        document.getElementById('editPostImagePreview').style.display = 'none';
        document.getElementById('editPostUploadBtnText').textContent = 'Click to add an image';
    }

    document.getElementById('editPostModal').style.display = 'flex';
}

function closeEditPostModal() {
    document.getElementById('editPostModal').style.display = 'none';
    document.getElementById('editPostForm').reset();
    removeEditPostImage();
}

function handleEditPostImageUpload(input) {
    if (input.files && input.files[0]) {
        editPostImageFile = input.files[0];
        keepExistingImage = false;
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('editPostPreviewImg').src = e.target.result;
            document.getElementById('editPostImagePreview').style.display = 'block';
            document.getElementById('editPostUploadBtnText').textContent = 'Change image';
        };
        reader.readAsDataURL(editPostImageFile);
    }
}

function removeEditPostImage() {
    editPostImageFile = null;
    keepExistingImage = false;
    document.getElementById('editPostImageFile').value = '';
    document.getElementById('editPostImagePreview').style.display = 'none';
    document.getElementById('editPostPreviewImg').src = '';
    document.getElementById('editPostUploadBtnText').textContent = 'Click to add an image';
}

document.getElementById('editPostForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const postId = document.getElementById('editPostId').value;
    const content = document.getElementById('editPostContent').value.trim();

    const formData = new FormData();
    formData.append('content', content);
    if (editPostImageFile) {
        formData.append('post_image', editPostImageFile);
    } else if (keepExistingImage) {
        formData.append('keep_existing_image', 'true');
    }

    try {
        const res = await fetch(`/api/community/posts/${postId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Your post has been updated and is pending re-approval.',
                background: '#1e293b',
                color: '#fff'
            });
            closeEditPostModal();
            // Refresh group to update posts
            if (currentGroupId) openGroup(currentGroupId);
        }
        else throw new Error(data.error);
    } catch (e) {
        Swal.fire({ icon: 'error', text: e.message, background: '#1e293b', color: '#fff' });
    }
});

// Edit Group Functions
let editGroupCoverFile = null;
let keepExistingGroupCover = false;

function openEditGroupModal(groupId, encodedName, encodedDesc, coverUrl) {
    document.getElementById('editGroupId').value = groupId;
    document.getElementById('editGroupName').value = decodeURIComponent(encodedName);
    document.getElementById('editGroupDesc').value = decodeURIComponent(encodedDesc);
    editGroupCoverFile = null;
    keepExistingGroupCover = !!coverUrl;

    if (coverUrl) {
        document.getElementById('editGroupCoverPreviewImg').src = coverUrl;
        document.getElementById('editGroupCoverPreview').style.display = 'block';
        document.getElementById('editGroupUploadBtnText').textContent = 'Change cover image';
    } else {
        document.getElementById('editGroupCoverPreview').style.display = 'none';
        document.getElementById('editGroupUploadBtnText').textContent = 'Click to add cover image';
    }

    document.getElementById('editGroupModal').style.display = 'flex';
}

function closeEditGroupModal() {
    document.getElementById('editGroupModal').style.display = 'none';
    document.getElementById('editGroupForm').reset();
    removeEditGroupCover();
}

function handleEditGroupCoverUpload(input) {
    if (input.files && input.files[0]) {
        editGroupCoverFile = input.files[0];
        keepExistingGroupCover = false;
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('editGroupCoverPreviewImg').src = e.target.result;
            document.getElementById('editGroupCoverPreview').style.display = 'block';
            document.getElementById('editGroupUploadBtnText').textContent = 'Change cover image';
        };
        reader.readAsDataURL(editGroupCoverFile);
    }
}

function removeEditGroupCover() {
    editGroupCoverFile = null;
    keepExistingGroupCover = false;
    document.getElementById('editGroupCoverFile').value = '';
    document.getElementById('editGroupCoverPreview').style.display = 'none';
    document.getElementById('editGroupCoverPreviewImg').src = '';
    document.getElementById('editGroupUploadBtnText').textContent = 'Click to add cover image';
}

document.getElementById('editGroupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = document.getElementById('editGroupId').value;
    const name = document.getElementById('editGroupName').value.trim();
    const description = document.getElementById('editGroupDesc').value.trim();

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    if (editGroupCoverFile) {
        formData.append('cover_image', editGroupCoverFile);
    } else if (keepExistingGroupCover) {
        formData.append('keep_existing_cover', 'true');
    }

    try {
        const res = await fetch(`/api/community/groups/${groupId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Group has been updated and is pending re-approval.',
                background: '#1e293b',
                color: '#fff'
            });
            closeEditGroupModal();
            showTab('my-groups');
        }
        else throw new Error(data.error);
    } catch (e) {
        Swal.fire({ icon: 'error', text: e.message, background: '#1e293b', color: '#fff' });
    }
});

loadGroups();
