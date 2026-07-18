import { FiStar, FiTrash2, FiEdit2, FiArchive } from 'react-icons/fi';
import { TbPin, TbPinFilled } from 'react-icons/tb';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import Badge from '@/components/ui/Badge';
import Tilt3D from '@/components/ui/Tilt3D';
import type { Note } from '@/types';

interface Props {
  note: Note;
  onTogglePin: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

/** Strip common markdown syntax for plain-text preview */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/---+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function NoteCard({
  note,
  onTogglePin,
  onToggleFavorite,
  onToggleArchive,
  onEdit,
  onDelete,
}: Props) {
  const preview = stripMarkdown(note.content);
  const words   = wordCount(note.content);

  return (
    <Tilt3D strength={7}>
      <div className="card p-4 flex flex-col gap-3 hover:border-brass-400/30 transition-colors group h-full">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm text-text line-clamp-1">{note.title}</h3>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onTogglePin(note.id)}
              aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-brass-400 hover:bg-surface-hover"
            >
              {note.isPinned ? <TbPinFilled size={14} className="text-brass-400" /> : <TbPin size={14} />}
            </button>
            <button
              onClick={() => onToggleFavorite(note.id)}
              aria-label={note.isFavorite ? 'Unfavorite' : 'Favorite'}
              className={clsx(
                'w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover',
                note.isFavorite ? 'text-brass-400' : 'text-text-muted hover:text-brass-400'
              )}
            >
              <FiStar size={13} fill={note.isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => onEdit(note)}
              aria-label="Edit note"
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-surface-hover"
            >
              <FiEdit2 size={13} />
            </button>
            <button
              onClick={() => onToggleArchive(note.id)}
              aria-label={note.isArchived ? 'Unarchive note' : 'Archive note'}
              className={clsx(
                'w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover',
                note.isArchived ? 'text-brass-400' : 'text-text-muted hover:text-text'
              )}
            >
              <FiArchive size={13} />
            </button>
            <button
              onClick={() => onDelete(note.id)}
              aria-label="Delete note"
              className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-surface-hover"
            >
              <FiTrash2 size={13} />
            </button>
          </div>
        </div>

        <p className="text-xs text-text-muted line-clamp-3 leading-relaxed">
          {preview || <span className="text-text-faint italic">No content</span>}
        </p>

        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex gap-1.5 flex-wrap">
            {note.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} tone="muted">#{tag}</Badge>
            ))}
            {note.tags.length > 3 && <Badge tone="muted">+{note.tags.length - 3}</Badge>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {note.isPinned && <TbPinFilled size={12} className="text-brass-400" />}
            <span className="text-[11px] text-text-faint font-mono">{words} words</span>
          </div>
        </div>

        <p className="text-[11px] text-text-faint font-mono">
          {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
        </p>
      </div>
    </Tilt3D>
  );
}
