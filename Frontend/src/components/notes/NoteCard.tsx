import { FiStar, FiTrash2 } from 'react-icons/fi';
import { TbPin, TbPinFilled } from 'react-icons/tb';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import Badge from '@/components/ui/Badge';
import type { Note } from '@/types';

interface Props {
  note: Note;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function NoteCard({ note, onTogglePin, onDelete }: Props) {
  return (
    <div className="card p-4 flex flex-col gap-3 hover:border-brass-400/30 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm text-text line-clamp-1">{note.title}</h3>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onTogglePin(note.id)}
            aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
            className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-brass-400 hover:bg-surface-hover"
          >
            {note.isPinned ? (
              <TbPinFilled size={14} className="text-brass-400" />
            ) : (
              <TbPin size={14} />
            )}
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

      <p className="text-xs text-text-muted line-clamp-3 leading-relaxed">{note.content}</p>

      <div className="flex items-center justify-between mt-1">
        <div className="flex gap-1.5 flex-wrap">
          {note.tags.map((tag) => (
            <Badge key={tag} tone="muted">
              {tag}
            </Badge>
          ))}
        </div>
        <span className={clsx('text-text-faint', note.isFavorite && 'text-brass-400')}>
          <FiStar size={13} fill={note.isFavorite ? 'currentColor' : 'none'} />
        </span>
      </div>

      <p className="text-[11px] text-text-faint font-mono">
        Updated {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
      </p>
    </div>
  );
}
