import {
  FiLock, FiKey, FiDatabase, FiTerminal,
  FiShield, FiEyeOff, FiCopy, FiRefreshCw,
} from 'react-icons/fi';

const features = [
  {
    icon: FiKey,
    title: 'API Keys & Tokens',
    description:
      'Store third-party API keys, personal access tokens, and OAuth secrets with a name, service label, and expiry date. Never dig through .env files again.',
  },
  {
    icon: FiDatabase,
    title: 'Database Credentials',
    description:
      'Keep host, port, username, password, and database name together in one encrypted entry. Supports PostgreSQL, MySQL, MongoDB, Redis, and more.',
  },
  {
    icon: FiTerminal,
    title: 'SSH Keys',
    description:
      'Paste and store your private and public SSH keys securely. Tag them by server or environment so you always know which key belongs where.',
  },
  {
    icon: FiShield,
    title: 'AES-256 Encryption',
    description:
      'Every credential is encrypted with AES-256-GCM before it hits the database. Your master key never leaves your browser — zero-knowledge by design.',
  },
  {
    icon: FiEyeOff,
    title: 'Reveal on Demand',
    description:
      'Sensitive values stay masked by default. Click to reveal only when you need them, with an optional auto-hide timer after 30 seconds.',
  },
  {
    icon: FiCopy,
    title: 'One-Click Copy',
    description:
      'Copy any secret value straight to your clipboard without ever exposing it on screen. Clipboard is auto-cleared after 60 seconds.',
  },
  {
    icon: FiRefreshCw,
    title: 'Rotation Reminders',
    description:
      'Set an expiry date on any credential. DevVault will alert you before it expires so you rotate secrets before they become a security liability.',
  },
  {
    icon: FiLock,
    title: 'Vault Lock',
    description:
      'Lock your vault with a master PIN when stepping away. All entries become inaccessible until you re-authenticate, even if the tab stays open.',
  },
];

const credentialTypes = [
  { label: 'API Key', color: '#E8A33D', example: 'sk-...openai / AKIA...aws' },
  { label: 'Database', color: '#5EEAD4', example: 'postgres://user:pass@host/db' },
  { label: 'SSH Key', color: '#818CF8', example: '-----BEGIN OPENSSH PRIVATE KEY-----' },
  { label: 'Token', color: '#34D399', example: 'ghp_...github / xoxb-...slack' },
  { label: 'Password', color: '#F87171', example: 'Login credentials for any service' },
  { label: 'Note', color: '#60A5FA', example: 'Any other sensitive free-form text' },
];

export default function PasswordVaultPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative rounded-xl border border-border bg-surface overflow-hidden px-8 py-12">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 30% 60%, rgba(129,140,248,0.09) 0%, transparent 65%)',
          }}
        />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brass-400 bg-brass-400/10 border border-brass-400/20 rounded-full px-3 py-1 mb-4">
            <FiLock size={11} /> Coming Soon
          </span>
          <h1 className="font-display text-3xl font-semibold leading-tight mb-3">
            Password Vault
          </h1>
          <p className="text-text-muted leading-relaxed">
            A secure, encrypted store for every secret your developer life depends on — API
            keys, database passwords, SSH keys, tokens, and more. Everything in one place,
            zero-knowledge encrypted, always within reach.
          </p>
        </div>
      </div>

      {/* Credential types */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-4">What you can store</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {credentialTypes.map(({ label, color, example }) => (
            <div key={label} className="card p-4 flex items-start gap-3">
              <span
                className="mt-0.5 w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-text-faint font-mono mt-0.5 truncate">{example}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-4">Security features</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="card p-5 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Icon size={17} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="font-medium text-sm mb-1">{title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security note */}
      <div className="card p-6 border-indigo-500/20 bg-indigo-500/5">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
            <FiShield size={20} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">Zero-knowledge architecture</h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Your vault is encrypted client-side before anything is sent to the server. DevVault
              never sees your plaintext secrets — only you hold the key. Even a full database
              breach would expose nothing readable. Encryption is powered by AES-256-GCM with a
              key derived from your account credentials using PBKDF2.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
