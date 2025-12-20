import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PdfFile } from "./types";
import { formatFileSize } from "./pdf-utils";

interface SortableItemProps {
  file: PdfFile;
  index: number;
  onNameChange: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

export function SortableItem({
  file,
  index,
  onNameChange,
  onRemove,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`file-item ${isDragging ? "dragging" : ""} ${!file.isValid ? "file-item-invalid" : ""}`}
    >
      <div className="drag-handle" {...attributes} {...listeners}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </div>

      <div className={`file-icon ${!file.isValid ? "file-icon-invalid" : ""}`}>
        {file.isValid ? (
          "PDF"
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>

      <div className="file-info">
        <input
          type="text"
          className={`file-name-input ${!file.isValid ? "file-name-invalid" : ""}`}
          value={file.displayName}
          onChange={(e) => onNameChange(file.id, e.target.value)}
          placeholder="Untitled"
        />
        <div className="file-meta">
          {file.isValid ? (
            <>
              <span>#{index + 1}</span>
              {file.pageCount !== null && <span>{file.pageCount} pages</span>}
              <span>{formatFileSize(file.size)}</span>
            </>
          ) : (
            <span className="file-error">{file.error || "Invalid PDF"}</span>
          )}
        </div>
      </div>

      <button
        className="file-remove"
        onClick={() => onRemove(file.id)}
        title="Remove file"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

