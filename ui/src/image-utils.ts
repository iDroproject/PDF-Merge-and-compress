import { PDFDocument } from "pdf-lib";

// Declare global heic2any loaded from CDN
declare global {
  interface Window {
    heic2any: (options: {
      blob: Blob;
      toType?: string;
      quality?: number;
    }) => Promise<Blob | Blob[]>;
  }
}

// Timeout wrapper for async operations
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

export async function convertHeicToJpeg(file: File): Promise<Blob> {
  console.log(
    `Starting HEIC conversion for ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`
  );

  // Check if heic2any is loaded from CDN
  if (typeof window.heic2any !== "function") {
    throw new Error("HEIC conversion library not loaded. Please refresh the page.");
  }

  try {
    const result = await withTimeout(
      window.heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.85,
      }),
      120000, // 2 minute timeout for large files
      `HEIC conversion timed out for ${file.name}`
    );

    // heic2any can return a single blob or array of blobs
    const blob = Array.isArray(result) ? result[0] : result;
    console.log(`HEIC conversion complete: ${(blob.size / 1024).toFixed(1)} KB`);
    return blob;
  } catch (error) {
    console.error("HEIC conversion error details:", error);

    // Try to provide more helpful error message
    if (error instanceof Error) {
      throw new Error(`HEIC conversion failed: ${error.message}`);
    }
    throw new Error(
      "HEIC conversion failed - the file may be corrupted or in an unsupported format"
    );
  }
}

export async function convertImageToPdf(
  imageFile: File | Blob,
  fileName: string
): Promise<File> {
  // Convert HEIC first if needed
  let imageBlob: Blob = imageFile;
  const isHeic =
    imageFile instanceof File &&
    (imageFile.name.toLowerCase().endsWith(".heic") ||
      imageFile.name.toLowerCase().endsWith(".heif"));

  if (isHeic) {
    console.log(`Converting HEIC: ${fileName}`);
    imageBlob = await convertHeicToJpeg(imageFile as File);
  }

  // Load image to get dimensions
  const imageUrl = URL.createObjectURL(imageBlob);
  const img = await loadImage(imageUrl);
  URL.revokeObjectURL(imageUrl);

  console.log(`Image dimensions: ${img.width}x${img.height}`);

  // Create PDF with image
  const pdfDoc = await PDFDocument.create();

  // Convert image blob to array buffer
  const imageBytes = await imageBlob.arrayBuffer();

  // Embed image based on type
  let embeddedImage;
  const type = imageBlob.type || "image/jpeg";

  if (type.includes("png")) {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else {
    // Default to JPEG for everything else (including converted HEIC)
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  }

  // Add page with image dimensions (72 DPI standard)
  const pageWidth = img.width * 0.75;
  const pageHeight = img.height * 0.75;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([new Uint8Array(pdfBytes)], {
    type: "application/pdf",
  });

  // Create a File object with .pdf extension
  const pdfFileName =
    fileName.replace(/\.(heic|heif|jpg|jpeg|png|webp)$/i, "") + ".pdf";
  return new File([pdfBlob], pdfFileName, { type: "application/pdf" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export function isImageFile(file: File): boolean {
  const imageExtensions = [".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp"];
  const fileName = file.name.toLowerCase();
  const isImageExtension = imageExtensions.some((ext) => fileName.endsWith(ext));
  const isImageMime = file.type.startsWith("image/");
  // Also check for HEIC that might not have proper MIME type
  const isHeicMime =
    file.type === "" &&
    (fileName.endsWith(".heic") || fileName.endsWith(".heif"));

  return isImageExtension || isImageMime || isHeicMime;
}

// For non-HEIC images, check if they can be converted directly
export function isNonHeicImage(file: File): boolean {
  const nonHeicExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  const fileName = file.name.toLowerCase();
  return nonHeicExtensions.some((ext) => fileName.endsWith(ext));
}
