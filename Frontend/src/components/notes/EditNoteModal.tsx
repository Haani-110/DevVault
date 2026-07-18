import { useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { FiX } from 'react-icons/fi';
import { useTheme } from '@/hooks/useTheme';
import type { Note } from '@/types';

interface Props {
  note: Note;
  onClose: () => void;
  onSave: (id: string, data: { title: string; content: string; tags: string[] }) => void;
}

export default function EditNoteModal({ note, onClose, onSave }: Props) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagsInput, setTagsInput] = useState(note.tags.join(', '));

  function handleSubmit() {
    if (!title.trim()) return;
    onSave(note.id, {
      title: title.trim(),
      content,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        data-color-mode={theme}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <h3 className="font-display font-semibold">Edit note</h3>
          <button onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text">
            <FiX size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3 min-h-0">
          <input
            className="input"
            placeholder="Note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <input
            className="input"
            placeholder="Tags, comma separated"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
          <div className="rounded overflow-hidden border border-border">
            <MDEditor
              value={content}
              onChange={(v) => setContent(v ?? '')}
              height={220}
              preview="edit"
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!title.trim()}>
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
