export interface PdfFile {
  id: string;
  file: File;
  displayName: string;
  pageCount: number | null;
  size: number;
  isValid: boolean;
  error?: string;
}

