import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { formatDistanceToNow } from 'date-fns';
import { FiX, FiEdit2, FiStar, FiTrash2, FiCopy, FiCheck } from 'react-icons/fi';
import clsx from 'clsx';
import { useTheme } from '@/hooks/useTheme';
import Badge from '@/components/ui/Badge';
import type { Snippet } from '@/types';

interface Props {
  snippet: Snippet;
  onClose: () => void;
  onEdit: (snippet: Snippet) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SnippetPreviewModal({ snippet, onClose, onEdit, onToggleFavorite, onDelete }: Props) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const lineCount = snippet.code.split('\n').length;
  // A little headroom so short snippets don't look cramped, capped so long
  // ones don't push the modal off-screen — the editor scrolls internally past this.
  const editorHeight = Math.min(Math.max(lineCount * 19, 120), 420);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-semibold text-lg truncate">{snippet.title}</h2>
              <Badge tone="muted">{snippet.language}</Badge>
              {snippet.project && (
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0"
                  style={{
                    color: snippet.project.color,
                    borderColor: `${snippet.project.color}55`,
                    backgroundColor: `${snippet.project.color}15`,
                  }}
                >
                  {snippet.project.name}
                </span>
              )}
            </div>
            {snippet.description && (
              <p className="text-xs text-text-muted mt-1">{snippet.description}</p>
            )}
            <p className="text-xs text-text-faint mt-1">
              Updated {formatDistanceToNow(new Date(snippet.updatedAt), { addSuffix: true })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors shrink-0"
            aria-label="Close"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="relative rounded overflow-hidden border border-border">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-raised/60">
              <span className="text-[11px] text-text-faint font-mono">{lineCount} lines</span>
              <button
                onClick={handleCopy}
                aria-label="Copy code"
                className="flex items-center gap-1 text-[11px] text-text-faint hover:text-text transition-colors"
              >
                {copied ? <FiCheck size={11} className="text-ok" /> : <FiCopy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <Editor
              height={editorHeight}
              language={snippet.language}
              value={snippet.code}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                folding: false,
                renderLineHighlight: 'none',
              }}
            />
          </div>
        </div>

        {snippet.tags.length > 0 && (
          <div className="px-5 pb-3 flex gap-1.5 flex-wrap">
            {snippet.tags.map((tag) => (
              <Badge key={tag} tone="muted">{tag}</Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleFavorite(snippet.id)}
              aria-label="Toggle favorite"
              className={clsx(
                'w-8 h-8 flex items-center justify-center rounded hover:bg-surface-hover transition-colors',
                snippet.isFavorite ? 'text-brass-400' : 'text-text-muted hover:text-brass-400',
              )}
            >
              <FiStar size={14} fill={snippet.isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => onDelete(snippet.id)}
              aria-label="Delete snippet"
              className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-surface-hover transition-colors"
            >
              <FiTrash2 size={14} />
            </button>
          </div>
          <button className="btn-primary" onClick={() => onEdit(snippet)}>
            <FiEdit2 size={14} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}
