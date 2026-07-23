import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { formatDistanceToNow } from 'date-fns';
import { FiX, FiEdit2, FiStar, FiArchive, FiTrash2 } from 'react-icons/fi';
import { TbPin, TbPinFilled } from 'react-icons/tb';
import clsx from 'clsx';
import { useTheme } from '@/hooks/useTheme';
import Badge from '@/components/ui/Badge';
import type { Note } from '@/types';

interface Props {
  note: Note;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onTogglePin: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function NotePreviewModal({
  note,
  onClose,
  onEdit,
  onTogglePin,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
}: Props) {
  const { theme } = useTheme();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-semibold text-lg truncate">{note.title}</h2>
              {note.project && (
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0"
                  style={{
                    color: note.project.color,
                    borderColor: `${note.project.color}55`,
                    backgroundColor: `${note.project.color}15`,
                  }}
                >
                  {note.project.name}
                </span>
              )}
            </div>
            <p className="text-xs text-text-faint mt-1">
              Updated {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
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

        <div className="flex-1 overflow-y-auto px-5 py-4" data-color-mode={theme}>
          {note.content ? (
            <MDEditor.Markdown source={note.content} style={{ background: 'transparent' }} />
          ) : (
            <p className="text-sm text-text-faint italic">No content</p>
          )}
        </div>

        {note.tags.length > 0 && (
          <div className="px-5 pb-3 flex gap-1.5 flex-wrap">
            {note.tags.map((tag) => (
              <Badge key={tag} tone="muted">#{tag}</Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onTogglePin(note.id)}
              aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
              className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-brass-400 hover:bg-surface-hover transition-colors"
            >
              {note.isPinned ? <TbPinFilled size={15} className="text-brass-400" /> : <TbPin size={15} />}
            </button>
            <button
              onClick={() => onToggleFavorite(note.id)}
              aria-label={note.isFavorite ? 'Unfavorite' : 'Favorite'}
              className={clsx(
                'w-8 h-8 flex items-center justify-center rounded hover:bg-surface-hover transition-colors',
                note.isFavorite ? 'text-brass-400' : 'text-text-muted hover:text-brass-400',
              )}
            >
              <FiStar size={14} fill={note.isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => onToggleArchive(note.id)}
              aria-label={note.isArchived ? 'Unarchive note' : 'Archive note'}
              className={clsx(
                'w-8 h-8 flex items-center justify-center rounded hover:bg-surface-hover transition-colors',
                note.isArchived ? 'text-brass-400' : 'text-text-muted hover:text-text',
              )}
            >
              <FiArchive size={14} />
            </button>
            <button
              onClick={() => onDelete(note.id)}
              aria-label="Delete note"
              className="w-8 h-8 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-surface-hover transition-colors"
            >
              <FiTrash2 size={14} />
            </button>
          </div>
          <button className="btn-primary" onClick={() => onEdit(note)}>
            <FiEdit2 size={14} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}
