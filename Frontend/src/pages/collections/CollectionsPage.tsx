import {
  FiSend, FiFolderPlus, FiSliders, FiDownload,
  FiGlobe, FiShield, FiClock, FiCode,
} from 'react-icons/fi';

const features = [
  {
    icon: FiFolderPlus,
    title: 'Organised Collections',
    description:
      'Group related API requests into collections and sub-folders — just like Postman. Keep your workspace, staging, and production endpoints neatly separated.',
  },
  {
    icon: FiSliders,
    title: 'Environment Variables',
    description:
      'Define variables like {{baseUrl}} or {{authToken}} per environment. Switch between Dev, Staging, and Prod with a single click without editing every request.',
  },
  {
    icon: FiShield,
    title: 'Auth Presets',
    description:
      'Save Bearer tokens, API keys, Basic auth, and OAuth 2.0 configurations per collection. No more copy-pasting tokens into every tab.',
  },
  {
    icon: FiGlobe,
    title: 'Response Viewer',
    description:
      'Inspect responses with syntax-highlighted JSON, status codes, headers, timing, and size — all in a clean split-panel layout.',
  },
  {
    icon: FiClock,
    title: 'Request History',
    description:
      'Every request you fire is automatically saved to history with its full response. Replay or diff any past call in seconds.',
  },
  {
    icon: FiDownload,
    title: 'Import & Export',
    description:
      'Import existing Postman v2.1 or OpenAPI 3 collections instantly. Export to share with your team or back up your work.',
  },
  {
    icon: FiCode,
    title: 'Code Snippets',
    description:
      'Generate ready-to-copy request code in curl, Axios, fetch, Python requests, and more — straight from any saved request.',
  },
  {
    icon: FiSend,
    title: 'Execution Ready',
    description:
      'Fire real HTTP requests directly from the browser. View live responses alongside your saved examples and test assertions.',
  },
];

export default function CollectionsPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="relative rounded-xl border border-border bg-surface overflow-hidden px-8 py-12">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 70% 50%, rgba(232,163,61,0.08) 0%, transparent 65%)',
          }}
        />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brass-400 bg-brass-400/10 border border-brass-400/20 rounded-full px-3 py-1 mb-4">
            <FiSend size={11} /> Coming Soon
          </span>
          <h1 className="font-display text-3xl font-semibold leading-tight mb-3">
            API Collection Manager
          </h1>
          <p className="text-text-muted leading-relaxed">
            A full-featured HTTP client built right into DevVault. Organise, execute, and
            document every API your projects depend on — without leaving your dashboard or
            juggling separate tools.
          </p>
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-4">What's coming</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="card p-5 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-brass-400/10 flex items-center justify-center">
                <Icon size={17} className="text-brass-400" />
              </div>
              <div>
                <h3 className="font-medium text-sm mb-1">{title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow preview */}
      <div className="card p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold">How it will work</h2>
        <ol className="space-y-3">
          {[
            {
              step: '1',
              title: 'Create a collection',
              body: 'Name it after your project or service — e.g. "DevVault API". Add sub-folders for auth, users, notes, and so on.',
            },
            {
              step: '2',
              title: 'Add requests',
              body: 'Define method, URL, headers, query params, and request body. Reference environment variables anywhere with {{variable}} syntax.',
            },
            {
              step: '3',
              title: 'Set up environments',
              body: 'Create a Dev environment pointing to localhost:4000 and a Prod one pointing to your live domain. Switch instantly.',
            },
            {
              step: '4',
              title: 'Fire & inspect',
              body: 'Hit Send. View the response body, status, latency, and headers side by side. Save the response as an example for documentation.',
            },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-4">
              <span className="w-7 h-7 shrink-0 rounded-full bg-brass-400/10 text-brass-400 text-xs font-bold flex items-center justify-center">
                {step}
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-text-muted leading-relaxed mt-0.5">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
