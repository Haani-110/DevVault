import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import Editor from '@monaco-editor/react';
import { useTheme } from '@/hooks/useTheme';
import type { Snippet } from '@/types';
import type { CreateSnippetInput, UpdateSnippetInput } from '@/services/snippetsService';

const LANGUAGES = [
  'plaintext', 'typescript', 'javascript', 'python', 'rust', 'go', 'java',
  'csharp', 'cpp', 'c', 'php', 'ruby', 'swift', 'kotlin', 'sql', 'bash',
  'sh', 'css', 'scss', 'html', 'json', 'yaml', 'toml', 'markdown', 'dockerfile',
  'graphql', 'prisma', 'terraform',
];

interface Props {
  snippet: Snippet | null;
  onClose: () => void;
  onCreate: (input: CreateSnippetInput) => void;
  onUpdate: (id: string, input: UpdateSnippetInput) => void;
}

export default function SnippetModal({ snippet, onClose, onCreate, onUpdate }: Props) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(snippet?.title ?? '');
  const [description, setDescription] = useState(snippet?.description ?? '');
  const [code, setCode] = useState(snippet?.code ?? '');
  const [language, setLanguage] = useState(snippet?.language ?? 'typescript');
  const [tagsInput, setTagsInput] = useState(snippet?.tags.join(', ') ?? '');

  function handleSubmit() {
    if (!title.trim()) return;
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (snippet) {
      onUpdate(snippet.id, { title: title.trim(), description: description.trim() || undefined, code, language, tags });
    } else {
      onCreate({ title: title.trim(), description: description.trim() || undefined, code, language, tags });
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-3xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <h3 className="font-display font-semibold">{snippet ? 'Edit snippet' : 'New snippet'}</h3>
          <button onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text">
            <FiX size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4 min-h-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="label">Title *</label>
              <input
                className="input"
                placeholder="e.g. JWT Auth Guard"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="label">Description</label>
              <input
                className="input"
                placeholder="What does this snippet do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="label">Tags</label>
              <input
                className="input"
                placeholder="auth, nestjs, jwt"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="label">Code</label>
              <select
                className="input py-1 text-xs w-40"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="rounded overflow-hidden border border-border" style={{ height: 240 }}>
              <Editor
                height="240px"
                language={language}
                value={code}
                onChange={(v) => setCode(v ?? '')}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                }}
              />
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!title.trim()}>
            {snippet ? 'Save changes' : 'Save snippet'}
          </button>
        </div>
      </div>
    </div>
  );
}
