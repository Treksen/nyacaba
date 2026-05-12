import { useEffect, useRef, useState } from 'react';
import { Save, Lock, Camera, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { roleLabel, roleBadgeClass } from '../../lib/constants';
import { uploadAvatar, removeAvatar } from '../../lib/avatar';
import PageHeader from '../../components/ui/PageHeader';
import Avatar from '../../components/ui/Avatar';

export default function Profile() {
  const { profile, refreshProfile, user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [updatingPwd, setUpdatingPwd] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        email: profile.email || '',
      });
    }
  }, [profile]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name,
      phone: form.phone,
    }).eq('id', profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Profile updated'); refreshProfile(); }
  }

  async function updatePassword(e) {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) return toast.error('Passwords do not match');
    if (pwd.next.length < 8) return toast.error('Password must be at least 8 characters');
    setUpdatingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setUpdatingPwd(false);
    if (error) toast.error(error.message);
    else { toast.success('Password updated'); setPwd({ current: '', next: '', confirm: '' }); }
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      await uploadAvatar(file, profile.id);
      await refreshProfile();
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err.message || 'Could not upload photo');
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleRemovePhoto() {
    if (!profile?.avatar_url) return;
    if (!confirm('Remove your profile photo?')) return;
    setUploadingAvatar(true);
    try {
      await removeAvatar(profile.id);
      await refreshProfile();
      toast.success('Photo removed');
    } catch (err) {
      toast.error(err.message || 'Could not remove photo');
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Your Account" title="Profile" description="Update your information and security." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card-padded text-center lg:col-span-1">
          <div className="relative inline-block">
            <Avatar
              src={profile?.avatar_url}
              name={profile?.full_name}
              size="3xl"
              className="!rounded-2xl mb-4 mx-auto block"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 right-0 w-9 h-9 rounded-full bg-primary-900 text-cream-50 grid place-items-center shadow-lg hover:bg-primary-800 transition disabled:opacity-50"
              title="Change photo"
            >
              <Camera size={16}/>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePhotoSelect}
            />
          </div>

          <h2 className="font-display text-xl font-semibold mt-2">{profile?.full_name}</h2>
          <p className="text-sm text-ink-600 mt-1">{profile?.email}</p>
          <div className="mt-3 inline-block">
            <span className={roleBadgeClass(profile?.role)}>
              {roleLabel(profile?.role)}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="btn-secondary text-xs !py-1.5"
            >
              <Camera size={12}/> {uploadingAvatar ? 'Working…' : (profile?.avatar_url ? 'Change photo' : 'Upload photo')}
            </button>
            {profile?.avatar_url && (
              <button
                onClick={handleRemovePhoto}
                disabled={uploadingAvatar}
                className="btn-ghost text-xs !py-1.5 text-rose-700 hover:bg-rose-50"
              >
                <Trash2 size={12}/> Remove
              </button>
            )}
          </div>
          {/* <p className="text-[11px] text-ink-500 mt-2 px-2">
            JPG, PNG, HEIC — any size. We auto-crop and compress to ~50&nbsp;KB.
          </p> */}

          {/* <p className="text-xs text-ink-500 mt-4">User ID</p>
          <p className="text-xs font-mono text-ink-700 break-all">{user?.id}</p> */}
        </div>

        <div className="lg:col-span-2 space-y-5">
          <form onSubmit={saveProfile} className="card-padded">
            <h3 className="font-display text-lg font-semibold mb-4">Personal details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Full name</label>
                <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}/>
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" disabled value={form.email}/>
                <p className="text-xs text-ink-500 mt-1">Email is managed by your auth account.</p>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}/>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save size={16}/> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>

          <form onSubmit={updatePassword} className="card-padded">
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <Lock size={16}/> Change password
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">New password</label>
                <input type="password" minLength={8} required className="input" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })}/>
              </div>
              <div className="md:col-span-2">
                <label className="label">Confirm new password</label>
                <input type="password" minLength={8} required className="input" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}/>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" disabled={updatingPwd} className="btn-primary">
                {updatingPwd ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
