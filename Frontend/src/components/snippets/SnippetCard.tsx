import { useState } from 'react';
import { FiStar, FiTrash2, FiEdit2, FiCopy, FiCheck } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import Badge from '@/components/ui/Badge';
import Tilt3D from '@/components/ui/Tilt3D';
import type { Snippet } from '@/types';

interface Props {
  snippet: Snippet;
  onEdit: (snippet: Snippet) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview?: (snippet: Snippet) => void;
}

const LANG_COLORS: Record<string, string> = {
  typescript: 'text-blue-400',
  javascript: 'text-yellow-400',
  python:     'text-green-400',
  rust:       'text-orange-400',
  go:         'text-cyan-400',
  sql:        'text-purple-400',
  bash:       'text-text-muted',
  css:        'text-pink-400',
  html:       'text-red-400',
};

export default function SnippetCard({ snippet, onEdit, onToggleFavorite, onDelete, onPreview }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const langColor = LANG_COLORS[snippet.language.toLowerCase()] ?? 'text-text-faint';
  const lineCount = snippet.code.split('\n').length;

  return (
    <Tilt3D strength={7}>
      <div
        className="card flex flex-col hover:border-brass-400/30 transition-colors group overflow-hidden h-full cursor-pointer"
        onClick={() => onPreview?.(snippet)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 p-4 pb-2">
          <div className="min-w-0">
            <h3 className="font-medium text-sm text-text line-clamp-1">{snippet.title}</h3>
            {snippet.description && (
              <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{snippet.description}</p>
            )}
            {snippet.project && (
              <span
                className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border truncate max-w-[140px]"
                style={{
                  color: snippet.project.color,
                  borderColor: `${snippet.project.color}55`,
                  backgroundColor: `${snippet.project.color}15`,
                }}
                title={snippet.project.name}
              >
                {snippet.project.name}
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onToggleFavorite(snippet.id)}
              aria-label="Toggle favorite"
              className={clsx(
                'w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover',
                snippet.isFavorite ? 'text-brass-400' : 'text-text-muted hover:text-brass-400'
              )}
            >
              <FiStar size={13} fill={snippet.isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => onEdit(snippet)}
              aria-label="Edit snippet"
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-hover"
            >
              <FiEdit2 size={13} />
            </button>
            <button
              onClick={() => onDelete(snippet.id)}
              aria-label="Delete snippet"
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-surface-hover"
            >
              <FiTrash2 size={13} />
            </button>
          </div>
        </div>

        {/* Code preview */}
        <div className="relative mx-4 mb-3 rounded overflow-hidden bg-black/40 border border-border">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
            <div className="flex items-center gap-2">
              <span className={clsx('text-[11px] font-mono font-medium', langColor)}>
                {snippet.language}
              </span>
              <span className="text-[11px] text-text-faint font-mono">{lineCount} lines</span>
            </div>
            <button
              onClick={handleCopy}
              aria-label="Copy code"
              className="flex items-center gap-1 text-[11px] text-text-faint hover:text-text transition-colors"
            >
              {copied ? <FiCheck size={11} className="text-green-400" /> : <FiCopy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 text-xs text-text-muted overflow-hidden max-h-24 overflow-y-hidden leading-relaxed font-mono">
            <code>{snippet.code}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex items-center justify-between gap-2 mt-auto">
          <div className="flex gap-1.5 flex-wrap">
            {snippet.tags.map((tag) => (
              <Badge key={tag} tone="muted">{tag}</Badge>
            ))}
          </div>
          <p className="text-[11px] text-text-faint font-mono shrink-0">
            {formatDistanceToNow(new Date(snippet.updatedAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </Tilt3D>
  );
}
