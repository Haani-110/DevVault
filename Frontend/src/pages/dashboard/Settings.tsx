import { useState, useRef, type FormEvent } from 'react';
import { FiLock, FiEye, FiEyeOff, FiCheck, FiCamera, FiUser } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { userService } from '@/services/userService';
import { authService } from '@/services/authService';
import toast from 'react-hot-toast';

function resizeImageToBase64(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Profile fields
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [website, setWebsite] = useState(user?.website ?? '');
  const [githubUrl, setGithubUrl] = useState(user?.githubUrl ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(user?.linkedinUrl ?? '');

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change password fields
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const pwStrength = (() => {
    if (!newPw) return 0;
    let s = 0;
    if (newPw.length >= 8) s++;
    if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return s;
  })();
  const pwStrengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][pwStrength];
  const pwStrengthColor = ['', 'bg-red-400', 'bg-brass-400', 'bg-yellow-400', 'bg-green-400'][pwStrength];

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    try {
      const base64 = await resizeImageToBase64(file);
      setAvatarPreview(base64);
      setAvatarBase64(base64);
    } catch {
      toast.error('Failed to process image');
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await userService.updateProfile({
        username: username.trim() || undefined,
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        githubUrl: githubUrl.trim(),
        linkedinUrl: linkedinUrl.trim(),
        ...(avatarBase64 ? { avatarUrl: avatarBase64 } : {}),
      });
      setUser(updated);
      setAvatarBase64(null);
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

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setChangingPw(true);
    try {
      await authService.changePassword(currentPw, newPw);
      toast.success('Password changed successfully');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to change password');
      toast.error(String(msg));
    } finally {
      setChangingPw(false);
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

      {/* Profile */}
      <form onSubmit={handleSave} className="card p-5 space-y-5">
        <h3 className="font-display font-semibold text-sm mb-1">Profile</h3>

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full bg-surface-raised border-2 border-border overflow-hidden flex items-center justify-center">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <FiUser size={28} className="text-text-faint" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brass-400 text-ink flex items-center justify-center hover:bg-brass-300 transition-colors shadow-md"
              title="Change photo"
            >
              <FiCamera size={13} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{user?.username}</p>
            <p className="text-xs text-text-muted mt-0.5">{user?.email}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-brass-400 hover:text-brass-300 mt-1.5 transition-colors"
            >
              Upload a photo from your computer
            </button>
            {avatarBase64 && (
              <p className="text-xs text-green-400 mt-0.5">New photo selected — save to apply</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={40}
              placeholder="your_username"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input opacity-60 cursor-not-allowed" value={user?.email ?? ''} readOnly />
            <p className="text-xs text-text-faint mt-1">Cannot be changed.</p>
          </div>
        </div>

        <div>
          <label className="label">Bio</label>
          <textarea
            className="input min-h-20 resize-none"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            placeholder="Tell the world what you're building…"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="San Francisco, CA"
              maxLength={100}
            />
          </div>
          <div>
            <label className="label">Website</label>
            <input
              className="input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yoursite.com"
              maxLength={200}
              type="url"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">GitHub URL</label>
            <input
              className="input"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/username"
              maxLength={200}
              type="url"
            />
          </div>
          <div>
            <label className="label">LinkedIn URL</label>
            <input
              className="input"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/username"
              maxLength={200}
              type="url"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Change Password */}
      <form onSubmit={handleChangePassword} className="card p-5 space-y-4">
        <div>
          <h3 className="font-display font-semibold text-sm mb-0.5">Change password</h3>
          <p className="text-xs text-text-faint">Must be at least 8 characters.</p>
        </div>

        <div>
          <label className="label">Current password</label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={14} />
            <input
              type={showPw ? 'text' : 'password'}
              className="input pl-9 pr-10"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text"
              tabIndex={-1}
            >
              {showPw ? <FiEyeOff size={14} /> : <FiEye size={14} />}
            </button>
          </div>
        </div>

        <div>
          <label className="label">New password</label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={14} />
            <input
              type={showPw ? 'text' : 'password'}
              className="input pl-9"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {newPw.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1,2,3,4].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= pwStrength ? pwStrengthColor : 'bg-surface-hover'}`} />
                ))}
              </div>
              <p className="text-xs text-text-faint">{pwStrengthLabel}</p>
            </div>
          )}
        </div>

        <div>
          <label className="label">Confirm new password</label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={14} />
            <input
              type={showPw ? 'text' : 'password'}
              className="input pl-9 pr-10"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              required
            />
            {confirmPw && confirmPw === newPw && (
              <FiCheck size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />
            )}
          </div>
          {confirmPw && confirmPw !== newPw && (
            <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="btn-primary"
            disabled={changingPw || !currentPw || !newPw || newPw !== confirmPw}
          >
            {changingPw ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>

      {/* Danger zone */}
      <div className="card p-5 border border-danger/30">
        <h3 className="font-display font-semibold text-sm mb-1 text-danger">Danger zone</h3>
        <p className="text-xs text-text-muted mb-4">
          Deleting your account permanently removes all notes, snippets, projects, tasks and files. This cannot be undone.
        </p>

        {!confirmDelete ? (
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-danger font-medium">Are you absolutely sure?</p>
            <div className="flex gap-3 flex-wrap">
              <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </button>
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
