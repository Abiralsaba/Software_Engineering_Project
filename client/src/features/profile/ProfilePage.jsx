import { useEffect, useRef, useState } from 'react';
import CitizenShell, { resolveAssetUrl } from '../../layouts/CitizenShell.jsx';
import RouteLoading from '../../components/RouteLoading.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';

const emptyProfile = { name: '', email: '', nid: '', mobile: '', dob: '', address: '', gender: '' };

export default function ProfilePage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [draft, setDraft] = useState(emptyProfile);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const photoInput = useRef(null);

  async function loadProfile() {
    setError('');
    try {
      const data = await apiRequest('/api/user/profile');
      const normalized = { ...emptyProfile, ...data, dob: data.dob ? data.dob.split('T')[0] : '' };
      setProfile(normalized);
      setDraft(normalized);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProfile(); }, []);

  function update(event) {
    setDraft(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/user/profile', {
        method: 'PUT',
        body: { name: draft.name, mobile: draft.mobile, address: draft.address, gender: draft.gender }
      });
      await alerts.success('Updated', 'Profile updated successfully.');
      setEditing(false);
      await loadProfile();
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(event) {
    const [file] = event.target.files || [];
    if (!file) return;
    const form = new FormData();
    form.append('photo', file);
    try {
      const data = await apiRequest('/api/user/profile/photo', { method: 'POST', body: form });
      setProfile(current => ({ ...current, profile_image: data.imagePath }));
      setDraft(current => ({ ...current, profile_image: data.imagePath }));
      await alerts.success('Uploaded', 'Profile photo updated.');
    } catch (requestError) {
      setError(requestError.message);
      await alerts.error(requestError.message);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <CitizenShell pageStyles={['/css/profile.css']}>
      <header className="react-page-header"><div><h1>My Profile</h1><p>View and maintain your citizen information.</p></div></header>
      {loading ? <RouteLoading label="Loading profile…" /> : (
        <section className="profile-card react-profile-card">
          <div className="react-profile-summary">
            <div className="react-profile-photo"><img src={resolveAssetUrl(profile.profile_image) || 'https://ui-avatars.com/api/?name=Citizen'} alt="Citizen profile" /><button type="button" aria-label="Upload profile photo" onClick={() => photoInput.current?.click()}><i className="fas fa-camera" /></button><input ref={photoInput} type="file" accept="image/*" onChange={uploadPhoto} hidden /></div>
            <div><h2>{profile.name || 'Citizen'}</h2><p>NID: {profile.nid || '—'}</p></div>
          </div>
          {error && <div className="react-dashboard-error" role="alert">{error}</div>}
          <form onSubmit={save}>
            <div className="react-profile-actions">{editing ? <><button className="btn-secondary" type="button" onClick={() => { setDraft(profile); setEditing(false); }}>Cancel</button><button className="btn-primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save Changes'}</button></> : <button className="btn-primary" type="button" onClick={() => setEditing(true)}><i className="fas fa-edit" /> Edit Profile</button>}</div>
            <div className="react-form-grid react-profile-fields">
              <ProfileField label="Full Name" name="name" value={draft.name} onChange={update} disabled={!editing} />
              <ProfileField label="Mobile Number" name="mobile" value={draft.mobile} onChange={update} disabled={!editing} />
              <ProfileField label="Email Address (Read Only)" name="email" type="email" value={draft.email} disabled />
              <ProfileField label="NID Number (Read Only)" name="nid" value={draft.nid} disabled />
              <ProfileField label="Date of Birth (Read Only)" name="dob" type="date" value={draft.dob} disabled />
              <label className="form-group">Gender<select className="form-control profile-input" name="gender" value={draft.gender} onChange={update} disabled={!editing}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label>
              <label className="form-group react-grid-wide">Present Address<textarea className="form-control profile-input" name="address" rows="3" value={draft.address} onChange={update} disabled={!editing} /></label>
            </div>
          </form>
        </section>
      )}
    </CitizenShell>
  );
}

function ProfileField({ label, ...props }) {
  return <label className="form-group">{label}<input className="form-control profile-input" {...props} /></label>;
}
