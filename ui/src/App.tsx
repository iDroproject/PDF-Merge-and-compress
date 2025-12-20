import { useState, useRef, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableItem } from "./SortableItem";
import { PdfFile } from "./types";
import {
  validateAndGetPageCount,
  mergePdfs,
  formatFileSize,
  downloadPdf,
} from "./pdf-utils";
import {
  compressToTargetSize,
  COMPRESSION_PRESETS,
  PresetKey,
  compressPdf,
  CompressionProgress,
} from "./compress-utils";

type AppState = "idle" | "merging" | "success" | "compressing";

function App() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [outputName, setOutputName] = useState("merged");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState({ current: 0, total: 0 });
  const [mergedPdfData, setMergedPdfData] = useState<Uint8Array | null>(null);
  const [compressProgress, setCompressProgress] =
    useState<CompressionProgress | null>(null);
  const [targetSizeMB, setTargetSizeMB] = useState<string>("10");
  const [compressionPreset, setCompressionPreset] =
    useState<PresetKey>("medium");
  const [useTargetSize, setUseTargetSize] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleFiles = useCallback(async (newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
    );

    const processedFiles: PdfFile[] = await Promise.all(
      pdfFiles.map(async (file) => {
        const validation = await validateAndGetPageCount(file);

        return {
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          displayName: file.name.replace(/\.pdf$/i, ""),
          pageCount: validation.pageCount,
          size: file.size,
          isValid: validation.isValid,
          error: validation.error,
        };
      })
    );

    setFiles((prev) => [...prev, ...processedFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const updateFileName = useCallback((id: string, newName: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, displayName: newName } : f))
    );
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setOutputName("merged");
    setMergedPdfData(null);
  }, []);

  const validFiles = files.filter((f) => f.isValid);
  const invalidFiles = files.filter((f) => !f.isValid);

  const handleMerge = async () => {
    if (validFiles.length < 2) return;

    setAppState("merging");
    setMergeProgress({ current: 0, total: validFiles.length });

    try {
      const mergedPdf = await mergePdfs(
        validFiles.map((f) => f.file),
        (current, total) => setMergeProgress({ current, total })
      );

      console.log(`Merge complete. Size: ${(mergedPdf.length / (1024 * 1024)).toFixed(2)} MB`);
      
      if (mergedPdf.length === 0) {
        throw new Error("Merge produced an empty file");
      }

      setMergedPdfData(mergedPdf);
      setAppState("success");
    } catch (error) {
      console.error("Merge failed:", error);
      setAppState("idle");
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Failed to merge PDFs:\n\n${errorMessage}`);
    }
  };

  const handleDownload = () => {
    if (mergedPdfData) {
      downloadPdf(mergedPdfData, outputName);
    }
  };

  const handleCompress = async () => {
    if (!mergedPdfData) {
      alert("No PDF data to compress");
      return;
    }

    console.log(`Starting compression. Input size: ${(mergedPdfData.length / (1024 * 1024)).toFixed(2)} MB`);
    
    setAppState("compressing");
    setCompressProgress(null);

    try {
      let compressedPdf: Uint8Array;

      if (useTargetSize) {
        const target = parseFloat(targetSizeMB) || 10;
        console.log(`Target size compression: ${target} MB`);
        compressedPdf = await compressToTargetSize(
          mergedPdfData,
          target,
          setCompressProgress
        );
      } else {
        const preset = COMPRESSION_PRESETS[compressionPreset];
        console.log(`Preset compression: ${compressionPreset}, quality: ${preset.quality}, scale: ${preset.scale}`);
        compressedPdf = await compressPdf(
          mergedPdfData,
          { quality: preset.quality, scale: preset.scale },
          setCompressProgress
        );
      }

      console.log(`Compression complete. Output size: ${(compressedPdf.length / (1024 * 1024)).toFixed(2)} MB`);

      if (compressedPdf.length === 0) {
        throw new Error("Compression produced an empty file");
      }

      setMergedPdfData(compressedPdf);
      setAppState("success");
    } catch (error) {
      console.error("Compression failed:", error);
      setAppState("success"); // Go back to success state to show the uncompressed version
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(`Failed to compress PDF:\n\n${errorMessage}`);
    }
  };

  const handleStartOver = () => {
    setAppState("idle");
    setMergedPdfData(null);
  };

  const totalPages = validFiles.reduce((acc, f) => acc + (f.pageCount || 0), 0);
  const totalSize = validFiles.reduce((acc, f) => acc + f.size, 0);
  const mergedSizeBytes = mergedPdfData ? mergedPdfData.length : 0;
  const mergedSizeMB = mergedSizeBytes / (1024 * 1024);
  const targetMB = parseFloat(targetSizeMB) || 10;
  const isOverTarget = mergedSizeMB > targetMB;
  
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div className="logo">
            <div className="logo-icon">PDF</div>
            <h1>PDF Merger</h1>
          </div>
          <p>
            Merge & compress PDFs. Everything happens in your browser.
          </p>
        </header>

        <div
          className={`dropzone ${isDragging ? "dragging" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="dropzone-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3>Drop PDF files here</h3>
          <p>or click to browse • No file size limit</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFileInput}
          />
        </div>

        {files.length > 0 && (
          <>
            <div className="file-list">
              <div className="file-list-header">
                <h2>Files to merge</h2>
                <span className="file-count">
                  {validFiles.length} valid
                  {invalidFiles.length > 0 && (
                    <span style={{ color: "var(--danger)" }}>
                      {" "}
                      • {invalidFiles.length} invalid
                    </span>
                  )}{" "}
                  • {totalPages} pages • {formatFileSize(totalSize)}
                </span>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={files.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {files.map((file, index) => (
                    <SortableItem
                      key={file.id}
                      file={file}
                      index={index}
                      onNameChange={updateFileName}
                      onRemove={removeFile}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            <div className="output-section">
              <label>Output filename</label>
              <div className="output-input-wrapper">
                <input
                  type="text"
                  className="output-input"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  placeholder="merged"
                />
                <span className="output-extension">.pdf</span>
              </div>
            </div>

            <div className="action-bar">
              <button className="btn btn-secondary" onClick={clearAll}>
                Clear All
              </button>
              <button
                className="btn btn-primary"
                onClick={handleMerge}
                disabled={validFiles.length < 2}
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
                  <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
                  <path d="M18 3h3v3" />
                  <path d="M10 14L21 3" />
                </svg>
                Merge {validFiles.length} PDFs
              </button>
            </div>
          </>
        )}

        {files.length === 0 && (
          <div className="empty-state">
            <p>No PDF files added yet. Drop files above or click to browse.</p>
          </div>
        )}
      </div>

      <footer className="footer">
        <p>
          Files are processed locally in your browser. Nothing is uploaded to
          any server.
        </p>
      </footer>

      {appState === "merging" && (
        <div className="progress-overlay">
          <div className="progress-card">
            <div className="spinner" />
            <h3>Merging PDFs...</h3>
            <p>
              Processing file {mergeProgress.current} of {mergeProgress.total}
            </p>
          </div>
        </div>
      )}

      {appState === "compressing" && (
        <div className="progress-overlay">
          <div className="progress-card">
            <div className="spinner" />
            <h3>Compressing PDF...</h3>
            <p>
              {compressProgress?.stage === "rendering" &&
                `Rendering page ${compressProgress.current} of ${compressProgress.total}`}
              {compressProgress?.stage === "compressing" &&
                `Compression attempt ${compressProgress.current} of ${compressProgress.total}`}
              {compressProgress?.stage === "building" && "Building final PDF..."}
            </p>
            {compressProgress?.currentSizeMB !== undefined && (
              <p className="compress-size-preview">
                Current size: {formatSize(compressProgress.currentSizeMB * 1024 * 1024)}
              </p>
            )}
          </div>
        </div>
      )}

      {appState === "success" && mergedPdfData && (
        <div className="progress-overlay">
          <div className="success-card-large">
            <div className="success-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3>Merge Complete!</h3>

            <div className="size-display">
              <span className="size-label">PDF size:</span>
              <span
                className={`size-value ${isOverTarget && useTargetSize ? "size-over" : "size-good"}`}
              >
                {formatSize(mergedSizeBytes)}
              </span>
              {!isOverTarget && useTargetSize && mergedSizeBytes > 0 && (
                <span className="size-badge">✓ Under target</span>
              )}
            </div>

            <div className="compression-section">
              <h4>Compress PDF</h4>

              <div className="compression-toggle">
                <label className="toggle-option">
                  <input
                    type="radio"
                    name="compressionMode"
                    checked={useTargetSize}
                    onChange={() => setUseTargetSize(true)}
                  />
                  <span>Target size</span>
                </label>
                <label className="toggle-option">
                  <input
                    type="radio"
                    name="compressionMode"
                    checked={!useTargetSize}
                    onChange={() => setUseTargetSize(false)}
                  />
                  <span>Preset</span>
                </label>
              </div>

              {useTargetSize ? (
                <div className="target-size-input">
                  <label>Maximum file size:</label>
                  <div className="size-input-wrapper">
                    <input
                      type="number"
                      value={targetSizeMB}
                      onChange={(e) => setTargetSizeMB(e.target.value)}
                      min="1"
                      max="500"
                      step="1"
                    />
                    <span>MB</span>
                  </div>
                </div>
              ) : (
                <div className="preset-select">
                  <label>Compression level:</label>
                  <select
                    value={compressionPreset}
                    onChange={(e) =>
                      setCompressionPreset(e.target.value as PresetKey)
                    }
                  >
                    {Object.entries(COMPRESSION_PRESETS).map(([key, preset]) => (
                      <option key={key} value={key}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                className="btn btn-compress"
                onClick={handleCompress}
                disabled={!useTargetSize && mergedSizeMB < 1}
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
                  <path d="M12 3v12" />
                  <path d="m8 11 4 4 4-4" />
                  <path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />
                </svg>
                Compress PDF
              </button>
            </div>

            <div className="success-actions">
              <button className="btn btn-secondary" onClick={handleStartOver}>
                Start Over
              </button>
              <button className="btn btn-primary" onClick={handleDownload}>
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
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
