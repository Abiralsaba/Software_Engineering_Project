import { useCallback, useEffect, useRef, useState } from 'react';
import CitizenShell, { resolveAssetUrl } from '../../layouts/CitizenShell.jsx';
import Modal from '../../components/Modal.jsx';
import RouteLoading from '../../components/RouteLoading.jsx';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';

function timeAgo(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function CommunityPage() {
  const [view, setView] = useState('discover');
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [group, setGroup] = useState(null);
  const [comments, setComments] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { submitting, runLocked } = useSubmissionLock();
  const actionLocks = useRef(new Set());

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [all, mine, summary] = await Promise.all([
        apiRequest('/api/community/groups'),
        apiRequest('/api/community/my-groups'),
        apiRequest('/api/dashboard/summary')
      ]);
      setGroups(Array.isArray(all) ? all : []);
      setMyGroups(Array.isArray(mine) ? mine : []);
      setCurrentUserId(summary.user?.id || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  async function once(key, action) {
    if (actionLocks.current.has(key)) return;
    actionLocks.current.add(key);
    try { await action(); } finally { actionLocks.current.delete(key); }
  }

  async function openGroup(id) {
    setView('detail');
    setGroup(null);
    setError('');
    try {
      setGroup(await apiRequest(`/api/community/groups/${id}`));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function createGroup(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    await runLocked(async () => {
      const body = new FormData();
      body.append('name', formElement.elements.name.value.trim());
      body.append('description', formElement.elements.description.value.trim());
      const file = formElement.elements.cover_image.files[0];
      if (file) body.append('cover_image', file);
      try {
        const data = await apiRequest('/api/community/groups', { method: 'POST', body });
        await alerts.success('Created!', data.message);
        formElement.reset();
        setView('discover');
        await loadGroups();
      } catch (requestError) {
        setError(requestError.message);
        await alerts.error(requestError.message);
      }
    });
  }

  async function saveGroup(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    await runLocked(async () => {
      const body = new FormData();
      body.append('name', formElement.elements.name.value.trim());
      body.append('description', formElement.elements.description.value.trim());
      const file = formElement.elements.cover_image.files[0];
      if (file) body.append('cover_image', file);
      else if (modal.group.cover_image && !formElement.elements.remove_cover.checked) body.append('keep_existing_cover', 'true');
      try {
        const data = await apiRequest(`/api/community/groups/${modal.group.id}`, { method: 'PUT', body });
        await alerts.success('Updated!', data.message);
        setModal(null);
        setView('discover');
        await loadGroups();
      } catch (requestError) {
        setError(requestError.message);
        await alerts.error(requestError.message);
      }
    });
  }

  async function membership(action) {
    if (!group) return;
    await once(`membership-${group.id}`, async () => {
      try {
        await apiRequest(`/api/community/groups/${group.id}/${action}`, { method: 'POST' });
        await openGroup(group.id);
        await loadGroups();
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  async function createPost(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    await runLocked(async () => {
      const body = new FormData();
      body.append('content', formElement.elements.content.value.trim());
      const file = formElement.elements.post_image.files[0];
      if (file) body.append('post_image', file);
      try {
        const data = await apiRequest(`/api/community/groups/${group.id}/posts`, { method: 'POST', body });
        await alerts.success('Posted!', data.message);
        setModal(null);
        await openGroup(group.id);
      } catch (requestError) {
        setError(requestError.message);
        await alerts.error(requestError.message);
      }
    });
  }

  async function savePost(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    await runLocked(async () => {
      const body = new FormData();
      body.append('content', formElement.elements.content.value.trim());
      const file = formElement.elements.post_image.files[0];
      if (file) body.append('post_image', file);
      else if (modal.post.image_url && !formElement.elements.remove_image.checked) body.append('keep_existing_image', 'true');
      try {
        const data = await apiRequest(`/api/community/posts/${modal.post.id}`, { method: 'PUT', body });
        await alerts.success('Updated!', data.message);
        setModal(null);
        await openGroup(group.id);
      } catch (requestError) {
        setError(requestError.message);
        await alerts.error(requestError.message);
      }
    });
  }

  async function toggleLike(post) {
    await once(`like-${post.id}`, async () => {
      try {
        const data = await apiRequest(`/api/community/posts/${post.id}/like`, { method: 'POST' });
        setGroup(current => ({ ...current, posts: current.posts.map(row => row.id === post.id ? { ...row, liked_by_me: data.liked, like_count: Math.max(0, Number(row.like_count || 0) + (data.liked ? 1 : -1)) } : row) }));
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  async function togglePostComments(postId) {
    const nextOpen = !openComments[postId];
    setOpenComments(current => ({ ...current, [postId]: nextOpen }));
    if (nextOpen && !comments[postId]) {
      try {
        const rows = await apiRequest(`/api/community/posts/${postId}/comments`);
        setComments(current => ({ ...current, [postId]: rows }));
      } catch (requestError) {
        setError(requestError.message);
      }
    }
  }

  async function addComment(event, postId) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const content = formElement.elements.content.value.trim();
    if (!content) return;
    await once(`comment-${postId}`, async () => {
      try {
        const data = await apiRequest(`/api/community/posts/${postId}/comments`, { method: 'POST', body: { content } });
        setComments(current => ({ ...current, [postId]: [...(current[postId] || []), data.comment] }));
        setGroup(current => ({ ...current, posts: current.posts.map(row => row.id === postId ? { ...row, comment_count: Number(row.comment_count || 0) + 1 } : row) }));
        formElement.reset();
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  async function saveComment(event) {
    event.preventDefault();
    const content = event.currentTarget.elements.content.value.trim();
    await runLocked(async () => {
      try {
        await apiRequest(`/api/community/comments/${modal.comment.id}`, { method: 'PUT', body: { content } });
        setComments(current => ({ ...current, [modal.postId]: current[modal.postId].map(row => row.id === modal.comment.id ? { ...row, content } : row) }));
        setModal(null);
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  async function deleteComment(postId, commentId) {
    await once(`delete-comment-${commentId}`, async () => {
      try {
        await apiRequest(`/api/community/comments/${commentId}`, { method: 'DELETE' });
        setComments(current => ({ ...current, [postId]: current[postId].filter(row => row.id !== commentId) }));
        setGroup(current => ({ ...current, posts: current.posts.map(row => row.id === postId ? { ...row, comment_count: Math.max(0, Number(row.comment_count || 0) - 1) } : row) }));
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  return (
    <CitizenShell pageStyles={['/css/community.css']}>
      <header className="react-page-header"><div><h1>Community</h1><p>Connect and share in moderated citizen groups.</p></div><div className="react-chip-row"><button className={view === 'discover' ? 'active' : ''} type="button" onClick={() => setView('discover')}>Discover</button><button className={view === 'mine' ? 'active' : ''} type="button" onClick={() => setView('mine')}>My Groups</button><button className={view === 'create' ? 'active' : ''} type="button" onClick={() => setView('create')}>Create Group</button></div></header>
      {error && <div className="react-dashboard-error" role="alert">{error}</div>}
      {loading ? <RouteLoading label="Loading communities…" /> : <>
        {view === 'discover' && <GroupGrid title="Discover Communities" groups={groups} onOpen={openGroup} />}
        {view === 'mine' && <GroupGrid title="My Groups" groups={myGroups} onOpen={openGroup} />}
        {view === 'create' && <section className="react-panel react-narrow-panel"><h2>Create New Community</h2><GroupForm onSubmit={createGroup} submitting={submitting} /></section>}
        {view === 'detail' && <GroupDetail group={group} currentUserId={currentUserId} comments={comments} openComments={openComments} onBack={() => setView('discover')} onMembership={membership} onEditGroup={() => setModal({ type: 'edit-group', group })} onCreatePost={() => setModal({ type: 'create-post' })} onEditPost={post => setModal({ type: 'edit-post', post })} onLike={toggleLike} onToggleComments={togglePostComments} onAddComment={addComment} onEditComment={(postId, comment) => setModal({ type: 'edit-comment', postId, comment })} onDeleteComment={deleteComment} />}
      </>}
      {modal?.type === 'edit-group' && <Modal title="Edit Group" onClose={() => setModal(null)}><GroupForm group={modal.group} onSubmit={saveGroup} submitting={submitting} /></Modal>}
      {modal?.type === 'create-post' && <Modal title="Create Post" onClose={() => setModal(null)}><PostForm onSubmit={createPost} submitting={submitting} /></Modal>}
      {modal?.type === 'edit-post' && <Modal title="Edit Post" onClose={() => setModal(null)}><PostForm post={modal.post} onSubmit={savePost} submitting={submitting} /></Modal>}
      {modal?.type === 'edit-comment' && <Modal title="Edit Comment" onClose={() => setModal(null)}><form className="react-form-stack" onSubmit={saveComment}><label>Comment<textarea name="content" defaultValue={modal.comment.content} required /></label><button className="btn-primary" disabled={submitting} type="submit">Save</button></form></Modal>}
    </CitizenShell>
  );
}

function GroupGrid({ title, groups, onOpen }) {
  return <section><h2>{title}</h2><div className="groups-grid react-group-grid">{groups.map(group => <button className="group-card react-group-card" type="button" onClick={() => onOpen(group.id)} key={group.id}>{group.cover_image ? <img className="group-cover" src={resolveAssetUrl(group.cover_image)} alt="" /> : <div className="group-cover"><i className="fas fa-users" /></div>}<div className="group-info"><div className="group-name">{group.name}</div><div className="group-desc">{group.description || 'No description'}</div><div className="group-meta"><span><i className="fas fa-users" /> {group.member_count} members</span>{group.my_role && <span>{group.my_role}</span>}</div></div></button>)}{!groups.length && <p className="react-empty-state">No communities found.</p>}</div></section>;
}

function GroupForm({ group, onSubmit, submitting }) {
  return <form className="react-form-stack" onSubmit={onSubmit}><label>Group Name<input name="name" minLength="3" defaultValue={group?.name || ''} required /></label><label>Description<textarea name="description" rows="4" defaultValue={group?.description || ''} /></label><label>Cover Image<input name="cover_image" type="file" accept="image/*" /></label>{group?.cover_image && <label className="react-check-label"><input name="remove_cover" type="checkbox" /> Remove existing cover</label>}<button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Submitting…' : group ? 'Save for Re-approval' : 'Submit for Approval'}</button><p>Images are limited by the existing backend to 5MB and image extensions.</p></form>;
}

function PostForm({ post, onSubmit, submitting }) {
  return <form className="react-form-stack" onSubmit={onSubmit}><label>Post Content<textarea name="content" rows="5" defaultValue={post?.content || ''} required /></label><label>Image<input name="post_image" type="file" accept="image/*" /></label>{post?.image_url && <label className="react-check-label"><input name="remove_image" type="checkbox" /> Remove existing image</label>}<button className="btn-primary" disabled={submitting} type="submit">{submitting ? 'Submitting…' : post ? 'Save for Re-approval' : 'Submit Post'}</button></form>;
}

function GroupDetail({ group, currentUserId, comments, openComments, onBack, onMembership, onEditGroup, onCreatePost, onEditPost, onLike, onToggleComments, onAddComment, onEditComment, onDeleteComment }) {
  if (!group) return <RouteLoading label="Loading group…" />;
  const isAdmin = group.my_role === 'admin' || Number(group.created_by) === Number(currentUserId);
  const isCreator = Number(group.created_by) === Number(currentUserId);
  return <section><button className="btn-secondary" type="button" onClick={onBack}><i className="fas fa-arrow-left" /> Back</button><div className="group-header react-community-header">{group.cover_image && <img src={resolveAssetUrl(group.cover_image)} alt="" />}<div><h1>{group.name}</h1><p>{group.description}</p><span>{group.member_count} members</span><div className="react-modal-actions">{group.is_member && !isCreator ? <button className="btn-secondary" type="button" onClick={() => onMembership('leave')}>Leave</button> : !group.is_member ? <button className="btn-primary react-auto-width" type="button" onClick={() => onMembership('join')}>Join</button> : <span>Group creator</span>}{isAdmin && <button className="btn-secondary" type="button" onClick={onEditGroup}><i className="fas fa-edit" /> Edit Group</button>}</div></div></div>{group.is_member && <button className="create-post-box react-create-post" type="button" onClick={onCreatePost}><i className="fas fa-pen" /> What&apos;s on your mind?</button>}<div className="post-feed">{group.posts.map(post => <article className="post-card" key={post.id}><div className="post-header"><div className="post-avatar">{String(post.author_name || 'U')[0]}</div><div><div className="post-author">{post.author_name}</div><div className="post-time">{timeAgo(post.created_at)}</div></div>{Number(post.user_id) === Number(currentUserId) && <button className="react-icon-button" type="button" aria-label={`Edit post by ${post.author_name}`} onClick={() => onEditPost(post)}><i className="fas fa-edit" /></button>}</div><div className="post-content">{post.content}</div>{post.image_url && <img className="react-post-image" src={resolveAssetUrl(post.image_url)} alt="Post attachment" />}<div className="post-actions"><button className={`post-action-btn ${post.liked_by_me ? 'liked' : ''}`} type="button" onClick={() => onLike(post)}><i className="fas fa-heart" /> {post.like_count || 0}</button><button className="post-action-btn" type="button" onClick={() => onToggleComments(post.id)}><i className="fas fa-comment" /> {post.comment_count || 0}</button></div>{openComments[post.id] && <div className="comments-section react-comments"><div>{(comments[post.id] || []).map(comment => <div className="comment-item" key={comment.id}><div className="comment-avatar">{String(comment.author_name || 'U')[0]}</div><div className="comment-body"><div className="comment-author">{comment.author_name}</div><div className="comment-text">{comment.content}</div></div>{Number(comment.user_id) === Number(currentUserId) && <div className="comment-actions"><button type="button" aria-label="Edit comment" onClick={() => onEditComment(post.id, comment)}><i className="fas fa-edit" /></button><button type="button" aria-label="Delete comment" onClick={() => onDeleteComment(post.id, comment.id)}><i className="fas fa-trash" /></button></div>}</div>)}{comments[post.id] && !comments[post.id].length && <p>No comments yet.</p>}</div><form className="react-comment-form" onSubmit={event => onAddComment(event, post.id)}><input name="content" aria-label={`Comment on post ${post.id}`} placeholder="Write a comment…" required /><button type="submit" aria-label="Submit comment"><i className="fas fa-paper-plane" /></button></form></div>}</article>)}{!group.posts.length && <p className="react-empty-state">No approved posts yet.</p>}</div></section>;
}
