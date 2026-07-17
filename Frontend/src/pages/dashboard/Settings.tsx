import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await userService.updateProfile({ username: username.trim() || undefined, bio: bio.trim() });
      toast.success('Profile updated');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to save');
      toast.error(String(msg));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await userService.deleteAccount();
      toast('Account deleted', { icon: '🗑️' });
      signOut();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to delete account');
      toast.error(String(msg));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-text-muted mt-1">Manage your profile and account preferences.</p>
      </div>

      <form onSubmit={handleSave} className="card p-5 space-y-4">
        <h3 className="font-display font-semibold text-sm mb-1">Profile</h3>
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={40}
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input opacity-60 cursor-not-allowed" value={user?.email ?? ''} readOnly />
          <p className="text-xs text-text-faint mt-1">Email cannot be changed.</p>
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea
            className="input min-h-20 resize-none"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <div className="card p-5 border border-danger/30">
        <h3 className="font-display font-semibold text-sm mb-1 text-danger">Danger zone</h3>
        <p className="text-xs text-text-muted mb-4">
          Deleting your account permanently removes all notes, projects, tasks and files. This cannot be undone.
        </p>

        {!confirmDelete ? (
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-danger font-medium">Are you absolutely sure?</p>
            <div className="flex gap-3">
              <button
                className="btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
