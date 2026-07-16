import type { FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuth();

  function handleSave(e: FormEvent) {
    e.preventDefault();
    toast.success('Profile updated');
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
          <input className="input" defaultValue={user?.username} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" defaultValue={user?.email} type="email" />
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea className="input min-h-20 resize-none" defaultValue={user?.bio} />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary">
            Save changes
          </button>
        </div>
      </form>

      <div className="card p-5 border-danger/30">
        <h3 className="font-display font-semibold text-sm mb-1 text-danger">Danger zone</h3>
        <p className="text-xs text-text-muted mb-4">
          Deleting your account permanently removes all notes, projects and files.
        </p>
        <button className="btn-danger">Delete account</button>
      </div>
    </div>
  );
}
