import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";

// Use local worker from node_modules
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type PDFPageProxy = Awaited<ReturnType<Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>["getPage"]>>;

export interface CompressionOptions {
  quality: number; // 0.1 to 1.0
  scale: number; // 0.5 to 2.0 (affects resolution)
  targetSizeMB?: number; // Optional target size in MB
}

export interface CompressionProgress {
  stage: "rendering" | "compressing" | "building";
  current: number;
  total: number;
  currentSizeMB?: number;
}

export const COMPRESSION_PRESETS = {
  extreme: { quality: 0.3, scale: 0.5, label: "Extreme (smallest)" },
  high: { quality: 0.5, scale: 0.75, label: "High compression" },
  medium: { quality: 0.7, scale: 1.0, label: "Medium (balanced)" },
  low: { quality: 0.85, scale: 1.0, label: "Low (better quality)" },
  minimal: { quality: 0.95, scale: 1.0, label: "Minimal (best quality)" },
} as const;

export type PresetKey = keyof typeof COMPRESSION_PRESETS;

async function renderPageToImage(
  page: PDFPageProxy,
  scale: number,
  quality: number
): Promise<Uint8Array> {
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  
  if (!context) {
    throw new Error("Failed to get canvas 2d context");
  }

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  console.log(`Rendering page at ${canvas.width}x${canvas.height}`);

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  // Convert to JPEG with specified quality
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  
  if (!dataUrl || dataUrl === "data:,") {
    throw new Error("Canvas produced empty image");
  }
  
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Failed to extract base64 from canvas");
  }
  
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  console.log(`Page rendered, image size: ${bytes.length} bytes`);
  return bytes;
}

export async function compressPdf(
  pdfData: Uint8Array,
  options: CompressionOptions,
  onProgress?: (progress: CompressionProgress) => void
): Promise<Uint8Array> {
  const { quality, scale } = options;

  console.log("Loading PDF with pdf.js...");
  
  // Load PDF with PDF.js for rendering
  const loadingTask = pdfjs.getDocument({ data: pdfData });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  
  console.log(`Compressing PDF with ${numPages} pages, quality: ${quality}, scale: ${scale}`);

  // Create new PDF with pdf-lib
  const newPdf = await PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    onProgress?.({
      stage: "rendering",
      current: i,
      total: numPages,
    });

    console.log(`Processing page ${i} of ${numPages}`);

    try {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });

      // Render page to JPEG
      const imageBytes = await renderPageToImage(page, scale, quality);

      if (imageBytes.length === 0) {
        throw new Error(`Page ${i} rendered as empty image`);
      }

      // Embed image in new PDF
      const image = await newPdf.embedJpg(imageBytes);

      // Calculate page dimensions (72 DPI is PDF standard)
      const pageWidth = viewport.width * 0.75; // Convert to points
      const pageHeight = viewport.height * 0.75;

      // Add page with image
      const newPage = newPdf.addPage([pageWidth, pageHeight]);
      newPage.drawImage(image, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
      
      console.log(`Page ${i} added successfully`);
    } catch (pageError) {
      console.error(`Error processing page ${i}:`, pageError);
      throw new Error(`Failed to process page ${i}: ${pageError instanceof Error ? pageError.message : 'Unknown error'}`);
    }
  }

  onProgress?.({
    stage: "building",
    current: numPages,
    total: numPages,
  });

  console.log("Saving compressed PDF...");
  const result = await newPdf.save();
  console.log(`Compressed PDF saved, size: ${(result.length / (1024 * 1024)).toFixed(2)} MB`);
  
  return result;
}

export async function compressToTargetSize(
  pdfData: Uint8Array,
  targetSizeMB: number,
  onProgress?: (progress: CompressionProgress) => void
): Promise<Uint8Array> {
  const targetBytes = targetSizeMB * 1024 * 1024;
  const currentSize = pdfData.length;

  // If already under target, return original
  if (currentSize <= targetBytes) {
    return pdfData;
  }

  // Start with medium settings and adjust
  let quality = 0.7;
  let scale = 1.0;
  let result = pdfData;
  let attempts = 0;
  const maxAttempts = 5;

  // Estimate initial compression needed
  const ratio = targetBytes / currentSize;

  if (ratio < 0.1) {
    // Need extreme compression
    quality = 0.2;
    scale = 0.4;
  } else if (ratio < 0.2) {
    quality = 0.3;
    scale = 0.5;
  } else if (ratio < 0.3) {
    quality = 0.4;
    scale = 0.6;
  } else if (ratio < 0.5) {
    quality = 0.5;
    scale = 0.75;
  } else {
    quality = 0.7;
    scale = 0.9;
  }

  while (attempts < maxAttempts) {
    attempts++;

    result = await compressPdf(pdfData, { quality, scale }, (p) => {
      onProgress?.({
        ...p,
        currentSizeMB: result.length / (1024 * 1024),
      });
    });

    const resultSizeMB = result.length / (1024 * 1024);

    onProgress?.({
      stage: "compressing",
      current: attempts,
      total: maxAttempts,
      currentSizeMB: resultSizeMB,
    });

    if (result.length <= targetBytes) {
      break;
    }

    // Need more compression
    quality *= 0.7;
    scale *= 0.85;

    // Don't go too low
    quality = Math.max(quality, 0.1);
    scale = Math.max(scale, 0.3);
  }

  return result;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

