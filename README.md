# PDF Merge & Compress

A modern web application to merge multiple PDF files and compress them to a target size. Everything runs locally in your browser - no files are uploaded to any server.

![PDF Merger](https://img.shields.io/badge/PDF-Merger-orange) ![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

- 🔗 **Merge PDFs** - Combine multiple PDF files into one
- 📦 **Compress PDFs** - Reduce file size with target size or preset options
- 🔄 **Drag & Drop** - Easy file upload with drag and drop
- 📝 **Rename Files** - Rename PDFs before merging
- ↕️ **Reorder Files** - Drag to reorder the merge sequence
- ✅ **Validation** - Automatically detects invalid PDF files
- 🔒 **Privacy** - 100% client-side processing, files never leave your browser
- 📱 **Responsive** - Works on desktop and mobile

## Screenshots

### File Upload & Management
- Drag and drop PDF files
- See page count and file size for each PDF
- Invalid files are highlighted in red
- Reorder files by dragging

### Compression Options
- **Target Size Mode**: Set a maximum file size (e.g., 10 MB)
- **Preset Mode**: Choose from Extreme, High, Medium, Low, or Minimal compression

## Quick Start

### Web UI

```bash
cd ui
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

### CLI Tool

```bash
npm install
npm run merge -- file1.pdf file2.pdf -o output.pdf
```

## Usage

### Web Interface

1. **Add PDFs**: Drag files into the drop zone or click to browse
2. **Review**: Check file sizes and page counts; invalid files show in red
3. **Reorder**: Drag the handle (⋮⋮) to change merge order
4. **Rename**: Click filename to edit (for organization)
5. **Set Output Name**: Enter your desired filename
6. **Merge**: Click "Merge X PDFs"
7. **Compress** (optional): 
   - Set target size (e.g., 10 MB) or choose a preset
   - Click "Compress PDF"
8. **Download**: Click "Download PDF"

### CLI

```bash
# Basic merge
npm run merge -- doc1.pdf doc2.pdf doc3.pdf

# With custom output name
npm run merge -- doc1.pdf doc2.pdf -o combined.pdf

# Using absolute paths
npm run merge -- ~/Documents/report1.pdf ~/Documents/report2.pdf -o ~/Desktop/merged.pdf
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **PDF Processing**: [pdf-lib](https://pdf-lib.js.org/) for merging
- **PDF Rendering**: [PDF.js](https://mozilla.github.io/pdf.js/) for compression
- **Drag & Drop**: [@dnd-kit](https://dndkit.com/)
- **Styling**: Custom CSS with CSS variables

## How Compression Works

The compression feature works by:
1. Rendering each PDF page to a canvas using PDF.js
2. Converting the canvas to JPEG with adjustable quality
3. Rebuilding the PDF with compressed images

This allows significant file size reduction, especially for PDFs with images or scanned documents.

## Limitations

- Compression converts pages to images (may affect text selectability)
- Very high compression ratios will reduce image quality
- Large files may take time to process (runs in browser)
- Some encrypted PDFs may not be processable

## Development

```bash
# Install dependencies
cd ui && npm install

# Start dev server
npm run dev

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

## License

MIT
