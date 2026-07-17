import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import { api } from '@/lib/axios';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch {
      // Always show success to prevent email enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-brass-400/10 border border-brass-400/30 flex items-center justify-center mx-auto mb-5">
          <FiCheckCircle size={24} className="text-brass-400" />
        </div>
        <h2 className="font-display text-2xl font-semibold mb-2">Check your inbox</h2>
        <p className="text-sm text-text-muted mb-2 leading-relaxed">
          If an account exists for <span className="text-text font-medium">{email}</span>, a
          password reset link is on its way.
        </p>
        <p className="text-xs text-text-faint mb-8">
          The link expires in 1 hour. Check your spam folder if you don't see it.
        </p>
        <Link to="/login" className="btn-ghost w-full">
          <FiArrowLeft size={14} /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1.5">Reset your password</h2>
      <p className="text-sm text-text-muted mb-8 leading-relaxed">
        Enter the email tied to your account and we'll send you a secure reset link.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <div className="relative">
            <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={15} />
            <input
              id="email"
              type="email"
              className="input pl-9"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || !email.trim()}
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="text-sm text-text-muted text-center mt-6">
        <Link to="/login" className="text-brass-400 hover:underline inline-flex items-center gap-1.5">
          <FiArrowLeft size={13} /> Back to sign in
        </Link>
      </p>
    </div>
  );
}
