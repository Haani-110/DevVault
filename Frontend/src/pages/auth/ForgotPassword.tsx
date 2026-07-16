import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      toast.error('Enter a valid email');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h2 className="font-display text-2xl font-semibold mb-1.5">Check your inbox</h2>
        <p className="text-sm text-text-muted mb-8">
          If an account exists for <span className="text-text">{email}</span>, a reset link is on
          its way.
        </p>
        <Link to="/login" className="btn-ghost w-full">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1.5">Reset your password</h2>
      <p className="text-sm text-text-muted mb-8">
        Enter the email tied to your account and we'll send a reset link.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          Send reset link
        </button>
      </form>
      <p className="text-sm text-text-muted text-center mt-6">
        <Link to="/login" className="text-brass-400 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
