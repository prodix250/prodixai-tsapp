/**
 * Parses raw text from PDF files using pdf.js loaded via CDN
 */
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) {
    throw new Error("Warning: Still loading pdf.js library. Please try uploading the document again in a few seconds.");
  }
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

/**
 * Parses raw text from DOCX files using mammoth loaded via CDN
 */
async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = (window as any).mammoth;
  if (!mammoth) {
    throw new Error("Warning: Still loading mammoth library. Please try uploading the DOCX again in a few seconds.");
  }
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

/**
 * Parses raw text from PPTX files using JSZip and an optimized XML regex parser
 */
async function extractTextFromPPTX(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZip = (window as any).JSZip;
  if (!JSZip) {
    throw new Error("Warning: Still loading JSZip library. Please try uploading the PPTX again in a few seconds.");
  }
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlFiles = Object.keys(zip.files).filter(path => 
    path.startsWith("ppt/slides/slide") && path.endsWith(".xml")
  );
  
  // Sort slides numerically
  xmlFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10);
    const numB = parseInt(b.match(/\d+/)?.[0] || "1", 10);
    return numA - numB;
  });

  let fullText = "";
  for (const file of xmlFiles) {
    const content = await zip.files[file].async("text");
    const matches = content.match(/<a:t>([\s\S]*?)<\/a:t>/g);
    if (matches) {
       const slideText = matches.map(m => m.replace(/<\/?[^>]+(>|$)/g, "")).join(" ");
       fullText += slideText + "\n";
    }
  }
  return fullText;
}

/**
 * Heuristically extracts printable text strings from legacy binary documents (like .doc or .ppt)
 * by finding sequences of printable ASCII and UTF-16LE characters.
 */
function extractPrintableText(arrayBuffer: ArrayBuffer): string {
  const view = new Uint8Array(arrayBuffer);
  const len = view.length;
  
  // 1. Try UTF-16LE scan first (extremely common for MS Word document paragraphs)
  // We look for sequences of character codes 32..126 or common Rwandese / Accent letters, followed by a 0 byte.
  let utf16Seg = "";
  let utf16Paragraphs: string[] = [];
  
  for (let i = 0; i < len - 1; i += 2) {
    const charCode = view[i] + (view[i + 1] << 8);
    const isPrintable = 
      (charCode >= 32 && charCode <= 126) || 
      charCode === 9 || charCode === 10 || charCode === 13 ||
      (charCode >= 192 && charCode <= 382); // European / Rwandan accented Latin range
      
    if (isPrintable) {
      utf16Seg += String.fromCharCode(charCode);
    } else {
      if (utf16Seg.trim().length >= 4) {
        utf16Paragraphs.push(utf16Seg);
      }
      utf16Seg = "";
    }
  }
  if (utf16Seg.trim().length >= 4) {
    utf16Paragraphs.push(utf16Seg);
  }

  // 2. Also try single-byte ASCII/ANSI scan
  let asciiSeg = "";
  let asciiParagraphs: string[] = [];
  for (let i = 0; i < len; i++) {
    const byte = view[i];
    const isPrintable = 
      (byte >= 32 && byte <= 126) || 
      byte === 9 || byte === 10 || byte === 13;
      
    if (isPrintable) {
      asciiSeg += String.fromCharCode(byte);
    } else {
      if (asciiSeg.trim().length >= 4) {
        asciiParagraphs.push(asciiSeg);
      }
      asciiSeg = "";
    }
  }
  if (asciiSeg.trim().length >= 4) {
    asciiParagraphs.push(asciiSeg);
  }

  // Check which scan extracted more realistic text paragraphs
  const cleanAndCombineParts = (paragraphs: string[]): string => {
    return paragraphs
      .map(p => p.replace(/[\r\n\t]+/g, " ").replace(/\s\s+/g, " ").trim())
      .filter(p => {
        // Exclude system words/symbols, typical of binary file structures
        if (p.includes("<?xml") || p.includes("<a:") || p.includes("xmlns:") || p.includes("Normal.dotm")) {
          return false;
        }
        // Word segments should contain at least some spaces and letters
        const letterCount = (p.match(/[a-zA-Z]/g) || []).length;
        return letterCount > p.length * 0.35; // At least 35% alphabetic/textual
      })
      .join("\n\n");
  };

  const utf16Cleaned = cleanAndCombineParts(utf16Paragraphs);
  const asciiCleaned = cleanAndCombineParts(asciiParagraphs);

  const combined = utf16Cleaned.length > asciiCleaned.length ? utf16Cleaned : asciiCleaned;
  
  if (combined.trim().length < 20) {
    return asciiParagraphs
      .map(p => p.trim())
      .filter(p => p.length > 5)
      .join("\n");
  }

  return combined;
}

/**
 * Extracts raw text from File (PDF, DOCX, PPTX, TXT, DOC, PPT, etc.)
 */
export async function extractTextFromDocument(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  // Use a highly compatible FileReader promise supporting 100% of mobile in-app webviews
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file into ArrayBuffer"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Selected file loading failed."));
    reader.readAsArrayBuffer(file);
  });

  switch (extension) {
    case 'pdf':
      return await extractTextFromPDF(arrayBuffer);
    case 'docx':
      return await extractTextFromDOCX(arrayBuffer);
    case 'pptx':
      return await extractTextFromPPTX(arrayBuffer);
    case 'doc':
    case 'ppt':
    case 'xls':
    case 'xlsx':
      // Gracefully parse binary or unsupported document types using automated heuristic printable extractor
      return extractPrintableText(arrayBuffer);
    case 'txt': {
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(arrayBuffer);
    }
    default:
      // If any other file occurs, fall back to extracting text so we never crash the user
      try {
        return extractPrintableText(arrayBuffer);
      } catch (err) {
        throw new Error(`Cannot parse .${extension} files. Please select a PDF, DOCX, PPTX or TXT instead.`);
      }
  }
}
