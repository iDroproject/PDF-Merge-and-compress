import { PDFDocument } from "pdf-lib";

export interface PdfValidationResult {
  isValid: boolean;
  pageCount: number | null;
  error?: string;
}

export async function validateAndGetPageCount(
  file: File
): Promise<PdfValidationResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Check for PDF magic bytes (%PDF-)
    const header = new Uint8Array(arrayBuffer.slice(0, 5));
    const headerStr = String.fromCharCode(...header);
    if (!headerStr.startsWith("%PDF")) {
      return {
        isValid: false,
        pageCount: null,
        error: "Not a valid PDF file (missing PDF header)",
      };
    }

    const pdf = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
    });
    return {
      isValid: true,
      pageCount: pdf.getPageCount(),
    };
  } catch (error) {
    return {
      isValid: false,
      pageCount: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer, {
    ignoreEncryption: true,
  });
  return pdf.getPageCount();
}

export async function mergePdfs(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i + 1, files.length);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, {
        ignoreEncryption: true,
      });
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    } catch (error) {
      console.error(`Error processing file "${file.name}":`, error);
      throw new Error(
        `Failed to process "${file.name}": ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  return mergedPdf.save();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function downloadPdf(data: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(data)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

