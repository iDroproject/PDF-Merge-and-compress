import { PDFDocument } from "pdf-lib";
import * as fs from "fs/promises";
import * as path from "path";

interface MergeOptions {
  outputPath?: string;
}

async function mergePdfs(
  inputPaths: string[],
  options: MergeOptions = {}
): Promise<string> {
  if (inputPaths.length === 0) {
    throw new Error("No input PDF files provided");
  }

  const mergedPdf = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    const absolutePath = path.resolve(inputPath);
    console.log(`📄 Adding: ${path.basename(absolutePath)}`);

    const pdfBytes = await fs.readFile(absolutePath);
    const pdf = await PDFDocument.load(pdfBytes);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

    for (const page of pages) {
      mergedPdf.addPage(page);
    }
  }

  const outputPath = options.outputPath || generateOutputPath(inputPaths[0]);
  const mergedPdfBytes = await mergedPdf.save();

  await fs.writeFile(outputPath, mergedPdfBytes);

  return outputPath;
}

function generateOutputPath(firstInputPath: string): string {
  const dir = path.dirname(firstInputPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return path.join(dir, `merged-${timestamp}.pdf`);
}

function printUsage(): void {
  console.log(`
📚 PDF Merger - Merge multiple PDFs into one

Usage:
  npx tsx src/index.ts <file1.pdf> <file2.pdf> [...] [-o output.pdf]

Options:
  -o, --output    Specify output file path (default: merged-<timestamp>.pdf)
  -h, --help      Show this help message

Examples:
  npx tsx src/index.ts doc1.pdf doc2.pdf doc3.pdf
  npx tsx src/index.ts doc1.pdf doc2.pdf -o combined.pdf
  npx tsx src/index.ts ~/Documents/*.pdf -o ~/Desktop/all-docs.pdf
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const inputPaths: string[] = [];
  let outputPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-o" || arg === "--output") {
      outputPath = args[++i];
      if (!outputPath) {
        console.error("❌ Error: Output path not specified after -o flag");
        process.exit(1);
      }
    } else if (arg.endsWith(".pdf")) {
      inputPaths.push(arg);
    } else {
      console.error(`❌ Error: Invalid argument or non-PDF file: ${arg}`);
      process.exit(1);
    }
  }

  if (inputPaths.length < 2) {
    console.error("❌ Error: Please provide at least 2 PDF files to merge");
    process.exit(1);
  }

  // Verify all input files exist
  for (const inputPath of inputPaths) {
    try {
      await fs.access(path.resolve(inputPath));
    } catch {
      console.error(`❌ Error: File not found: ${inputPath}`);
      process.exit(1);
    }
  }

  console.log(`\n🔗 Merging ${inputPaths.length} PDF files...\n`);

  try {
    const resultPath = await mergePdfs(inputPaths, { outputPath });
    console.log(`\n✅ Successfully merged PDFs!`);
    console.log(`📁 Output: ${path.resolve(resultPath)}`);
  } catch (error) {
    console.error(
      `\n❌ Error merging PDFs: ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  }
}

main();

