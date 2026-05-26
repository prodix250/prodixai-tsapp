import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  Header, 
  Footer,
  PageNumber,
  NumberFormat,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
} from "docx";
import { saveAs } from "file-saver";

// Helper to parse formatting (bold/italic) from markdown line
function parseFormattedText(
  text: string, 
  options: { 
    bold?: boolean; 
    italics?: boolean; 
    size?: number; // half-points (e.g. 24 = 12pt)
    color?: string; 
    font?: string; 
  } = {}
): TextRun[] {
  // Regex to match markdown bold (** or __) and italic (* or _)
  // Simple tokenization of the text to render it in styled spans
  const tokens: { text: string; bold: boolean; italics: boolean }[] = [];
  
  // A simple markdown rich-text inline tokenizer for Docx TextRuns
  let currentText = "";
  let i = 0;
  let isBold = false;
  let isItalic = false;

  while (i < text.length) {
    if (text.substr(i, 2) === "**" || text.substr(i, 2) === "__") {
      if (currentText) {
        tokens.push({ text: currentText, bold: isBold, italics: isItalic });
        currentText = "";
      }
      isBold = !isBold;
      i += 2;
    } else if (text[i] === "*" || text[i] === "_") {
      if (currentText) {
        tokens.push({ text: currentText, bold: isBold, italics: isItalic });
        currentText = "";
      }
      isItalic = !isItalic;
      i += 1;
    } else {
      currentText += text[i];
      i += 1;
    }
  }
  
  if (currentText) {
    tokens.push({ text: currentText, bold: isBold, italics: isItalic });
  }

  // Map tokens to TextRuns
  return tokens.map(token => new TextRun({
    text: token.text,
    bold: options.bold || token.bold,
    italics: options.italics || token.italics,
    size: options.size ?? 22, // 11pt default
    color: options.color ?? "2c3e50", // Dark charcoal off-black
    font: options.font ?? "Calibri"
  }));
}

/**
 * Parses markdown table lines and converts them into an ultra-professional Docx Table
 */
function parseMarkdownTable(
  tableLines: string[], 
  brandingColor: string, 
  bodyColor: string
): Table | null {
  try {
    // Process each row line
    // e.g. | Header 1 | Header 2 |
    const rowsData: string[][] = [];
    
    for (const line of tableLines) {
      // Step 1: Detect and skip lines that are purely ASCII-decorated dividers (e.g., +---+ or |----|)
      const cleanLine = line.trim();
      const isAsciiDivider = /^[+\-| =_#~*]+$/.test(cleanLine) && (cleanLine.includes("+") || cleanLine.includes("-") || cleanLine.includes("="));
      if (isAsciiDivider) {
        continue;
      }

      // Split by '|' and trim parts
      const parts = line.split("|").map(p => p.trim());
      // Remove first and last empty spots if they are empty (typical of | Cell 1 | Cell 2 |)
      if (parts[0] === "") parts.shift();
      if (parts[parts.length - 1] === "") parts.pop();
      
      // Ignore divider lines like |---|---|
      const isDivider = parts.every(p => /^[-\s:]+$/.test(p));
      if (!isDivider && parts.length > 0) {
        rowsData.push(parts);
      }
    }
    
    if (rowsData.length === 0) return null;
    
    // Header is row 0
    const headerRowData = rowsData[0];
    const dataRowsData = rowsData.slice(1);
    
    const tableRows: TableRow[] = [];
    const colPercentageWidth = Math.max(5, Math.floor(100 / headerRowData.length));
    
    // Create Header Row cells
    const headerCells = headerRowData.map((cellText) => {
      return new TableCell({
        width: {
          size: colPercentageWidth,
          type: WidthType.PERCENTAGE
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: cellText,
                bold: true,
                color: "000000", // Dark text on light gray header for high visibility
                size: 20, // 10pt
                font: "Calibri"
              })
            ],
            alignment: AlignmentType.CENTER, // Center-align headers as requested
            spacing: { before: 120, after: 120, line: 276 }
          })
        ],
        shading: {
          fill: "F2F2F2" // Header Row background: light grey (#F2F2F2)
        },
        margins: {
          top: 120, // 120 twips (~2.4mm / minimum of 100 twips padding)
          bottom: 120,
          left: 120,
          right: 120
        }
      });
    });
    
    tableRows.push(new TableRow({ children: headerCells }));
    
    // Create Data Rows with alternating background colors
    dataRowsData.forEach((rowData, rowIndex) => {
      const isEven = rowIndex % 2 === 0;
      const rowFill = isEven ? "F9FAFB" : "FFFFFF"; // High-contrast subtle light grey alternating tint
      
      const dataCells = rowData.map((cellText) => {
        return new TableCell({
          width: {
            size: colPercentageWidth,
            type: WidthType.PERCENTAGE
          },
          children: [
            new Paragraph({
              children: parseFormattedText(cellText, {
                size: 20, // 10pt
                color: bodyColor,
                font: "Calibri"
              }),
              alignment: AlignmentType.START, // Left-aligned body cell text
              spacing: { before: 100, after: 100, line: 276 }
            })
          ],
          shading: {
            fill: rowFill
          },
          margins: {
            top: 120, // 120 twips padding
            bottom: 120,
            left: 120,
            right: 120
          }
        });
      });
      
      // Pad empty cells if mismatch between columns
      while (dataCells.length < headerRowData.length) {
        dataCells.push(new TableCell({
          width: {
            size: colPercentageWidth,
            type: WidthType.PERCENTAGE
          },
          children: [new Paragraph("")],
          shading: { fill: rowFill },
          margins: { top: 120, bottom: 120, left: 120, right: 120 }
        }));
      }
      
      tableRows.push(new TableRow({ children: dataCells }));
    });
    
    // Standard professional 1pt borders (size: 8 in docx borders represents 1pt, color is a sleek corporate gray)
    const professionalBorder = { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" };
    
    return new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      },
      borders: {
        top: professionalBorder,
        bottom: professionalBorder,
        left: professionalBorder,
        right: professionalBorder,
        insideHorizontal: professionalBorder,
        insideVertical: professionalBorder
      },
      rows: tableRows
    });
  } catch (err) {
    console.error("Failed parsing markdown table:", err);
    return null;
  }
}

function tokenizeCodeLine(line: string): TextRun[] {
  // Regex to capture:
  // 1 (comment): //... or /*...*/
  // 2 (string): "... " or '...' or `...`
  // 3 (keyword): export, const, let, return, function, etc.
  // 4 (function): any name followed by (
  // 5 (numberBool): numbers or true/false/null/undefined
  const tokenRegex = /(\/\/.*|\/\*.*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:export|import|from|function|const|let|var|return|if|else|class|default|async|await|try|catch|throw|new|interface|type|extends|implements|typeof|instanceof|switch|case|break|continue|for|while|do|in|of)\b)|(\b[a-zA-Z_]\w*(?=\s*\())|(\b\d+(?:\.\d+)?\b|\b(?:true|false|null|undefined)\b)/g;

  let lastIndex = 0;
  const runs: TextRun[] = [];
  let match;

  while ((match = tokenRegex.exec(line)) !== null) {
    const index = match.index;
    
    // Add normal text before the match
    if (index > lastIndex) {
      runs.push(new TextRun({
        text: line.substring(lastIndex, index),
        size: 19, // ~9.5pt
        color: "ABB2BF",
        font: "Consolas"
      }));
    }

    const matchedText = match[0];

    let color = "ABB2BF";
    let italics = false;

    if (match[1]) {
      color = "5C6370"; // Comment grey
      italics = true;
    } else if (match[2]) {
      color = "98C379"; // String green
    } else if (match[3]) {
      color = "C678DD"; // Keyword purple
    } else if (match[4]) {
      color = "61AFEF"; // Function blue
    } else if (match[5]) {
      color = "D19A66"; // Number/Bool orange
    }

    runs.push(new TextRun({
      text: matchedText,
      size: 19,
      color: color,
      italics: italics,
      font: "Consolas"
    }));

    lastIndex = tokenRegex.lastIndex;
  }

  // Add remaining normal text
  if (lastIndex < line.length) {
    runs.push(new TextRun({
      text: line.substring(lastIndex),
      size: 19,
      color: "ABB2BF",
      font: "Consolas"
    }));
  }

  // If empty line, add relative space to preserve line flow
  if (runs.length === 0) {
    runs.push(new TextRun({
      text: " ",
      size: 19,
      font: "Consolas"
    }));
  }

  return runs;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error("Failed to convert Blob to Base64."));
    };
    reader.readAsDataURL(blob);
  });
}

export async function generateProfessionalDoc(
  title: string, 
  rawMarkdown: string, 
  docType: "letter" | "report" | "general"
) {
  const cleanTitle = title.trim() || "Prodix_Document";
  const lines = rawMarkdown.split("\n");
  const storyParagraphs: (Paragraph | Table)[] = [];

  // Define Branding Palette
  const brandingColor = "1E3A8A"; // Deep Navy
  const secondaryColor = "475569"; // Slate gray
  const bodyColor = "334155"; // Dark Slate
  const accentColor = "0D9488"; // Teal/Green accent

  // Cover / Header block depending on Document Type
  if (docType === "report") {
    // Add Report Header Panel
    storyParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: cleanTitle.toUpperCase(),
            bold: true,
            size: 40, // 20pt
            color: brandingColor,
            font: "Calibri"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "TECHNICAL BRIEF & INFORMATION REPORT",
            bold: true,
            size: 20, // 10pt
            color: secondaryColor,
            font: "Calibri"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 }
      })
    );
  } else if (docType === "letter") {
    // Formal Letter Head
    storyParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "PRODIXAI SYSTEMS",
            bold: true,
            size: 26, // 13pt
            color: brandingColor,
            font: "Calibri"
          })
        ],
        spacing: { before: 120, after: 60 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Kigali, Rwanda  |  Email: contact.prodixai@gmail.com",
            size: 18, // 9pt
            color: secondaryColor,
            font: "Calibri"
          })
        ],
        spacing: { after: 240 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
            italics: true,
            size: 20, // 10pt
            color: bodyColor,
            font: "Calibri"
          })
        ],
        spacing: { after: 360 }
      })
    );
  }

  // Parse lines to build Paragraphs
  let inList = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    // Markdown Code Block Detector (triple backticks)
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      let codeIdx = idx + 1;
      
      while (codeIdx < lines.length) {
        const nextLine = lines[codeIdx];
        if (nextLine.trim().startsWith("```")) {
          break;
        }
        codeLines.push(nextLine);
        codeIdx++;
      }
      
      idx = codeIdx; // advance the main iteration pointer to skip internal code and closing tick
      
      // Tokenize each line into standard TextRuns for Consolas VS Code style syntax coloring
      const codeParagraphs = codeLines.map((codeLine) => {
        return new Paragraph({
          children: tokenizeCodeLine(codeLine),
          spacing: { before: 20, after: 20 }
        });
      });
      
      const codeBlockTable = new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE
        },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "3E4451" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "3E4451" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "3E4451" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "3E4451" },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: codeParagraphs,
                shading: {
                  fill: "282C34" // dark background shading matching VS Code themes
                },
                margins: {
                  top: 140, // 140 twips (~2.8mm padding)
                  bottom: 140,
                  left: 180,
                  right: 180
                }
              })
            ]
          })
        ]
      });
      
      storyParagraphs.push(codeBlockTable);
      inList = false;
      continue;
    }

    // Markdown Table Detector and Parser
    if (line.includes("|") && idx < lines.length - 1) {
      const nextLine = lines[idx + 1].trim();
      const isTableDivider = nextLine.includes("|") && /^[|:\s-]+$/.test(nextLine);
      if (isTableDivider) {
        // Collect all consecutive lines that contain "|"
        const tableLines: string[] = [];
        let tableIdx = idx;
        while (tableIdx < lines.length && lines[tableIdx].trim().includes("|")) {
          tableLines.push(lines[tableIdx].trim());
          tableIdx++;
        }
        
        // Advance the outer loop iterator
        idx = tableIdx - 1;
        
        // Parse raw table lines to beautiful Word docx Table
        const docxTable = parseMarkdownTable(tableLines, brandingColor, bodyColor);
        if (docxTable) {
          storyParagraphs.push(docxTable);
        }
        inList = false;
        continue;
      }
    }

    // Markdown Headers
    if (line.startsWith("# ")) {
      const headerText = line.substring(2);
      storyParagraphs.push(
        new Paragraph({
          children: parseFormattedText(headerText, {
            bold: true,
            size: 32, // 16pt
            color: brandingColor,
            font: "Calibri"
          }),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 120 }
        })
      );
      inList = false;
    } else if (line.startsWith("## ")) {
      const headerText = line.substring(3);
      storyParagraphs.push(
        new Paragraph({
          children: parseFormattedText(headerText, {
            bold: true,
            size: 26, // 13pt
            color: brandingColor,
            font: "Calibri"
          }),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 }
        })
      );
      inList = false;
    } else if (line.startsWith("### ")) {
      const headerText = line.substring(4);
      storyParagraphs.push(
        new Paragraph({
          children: parseFormattedText(headerText, {
            bold: true,
            size: 22, // 11pt
            color: secondaryColor,
            font: "Calibri"
          }),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 80 }
        })
      );
      inList = false;
    }
    // Lists (- or * or numbered list)
    else if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
      const listContent = line.substring(2);
      storyParagraphs.push(
        new Paragraph({
          children: parseFormattedText(listContent, { size: 21, color: bodyColor }),
          bullet: {
            level: 0
          },
          spacing: { before: 40, after: 40, line: 276 } // Professional 1.15 line spacing
        })
      );
      inList = true;
    } else if (/^\d+\.\s/.test(line)) {
      // Numbered List
      const listContent = line.replace(/^\d+\.\s/, "");
      storyParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: line.match(/^\d+\.\s/)?.[0] || "1. ", bold: true, size: 21, color: brandingColor }),
            ...parseFormattedText(listContent, { size: 21, color: bodyColor })
          ],
          spacing: { before: 60, after: 60, line: 276 } // Professional 1.15 line spacing
        })
      );
      inList = true;
    }
    // Blockquotes/Special Highlight Card
    else if (line.startsWith("> ")) {
      const blockQuote = line.substring(2);
      storyParagraphs.push(
        new Paragraph({
          children: parseFormattedText(blockQuote, { size: 20, italics: true, color: secondaryColor }),
          indent: { left: 720 }, // indentation of 0.5 inch
          spacing: { before: 120, after: 120, line: 276 } // Professional 1.15 line spacing
        })
      );
      inList = false;
    }
    // Table/Rulers or custom signatures
    else if (line.toLowerCase().startsWith("sincerely,") || line.toLowerCase().startsWith("best regards,") || line.toLowerCase().startsWith("kind regards,")) {
      storyParagraphs.push(
        new Paragraph({
          children: parseFormattedText(line, { size: 22, bold: true, color: bodyColor }),
          spacing: { before: 480, after: 60 }
        })
      );
      inList = false;
    } else {
      // Normal Paragraph
      const alignment = docType === "letter" && (line.includes("Sincerely") || line.includes("Regards") || line.includes("Uwumukiza Kevin") || line.includes("Sincerely yours")) 
        ? AlignmentType.START 
        : AlignmentType.BOTH;

      storyParagraphs.push(
        new Paragraph({
          children: parseFormattedText(line, { size: 21, color: bodyColor }),
          alignment: alignment,
          spacing: { before: 120, after: 120, line: 276 } // Line spacing of 1.15
        })
      );
      inList = false;
    }
  }

  // Create document sections
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch
              bottom: 1440, // 1 inch
              left: 1440,   // 1 inch
              right: 1440,  // 1 inch
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "ProdixAI Official Document",
                    bold: true,
                    size: 18, // 9pt
                    color: "94a3b8" // Slate light
                  })
                ],
                alignment: AlignmentType.END,
                spacing: { after: 120 }
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Powered by ProdixAI Systems",
                    italics: true,
                    size: 16, // 8pt
                    color: "94a3b8"
                  }),
                  new TextRun({
                    text: "\t\tPage ",
                    size: 16,
                    color: "94a3b8"
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: "94a3b8"
                  })
                ],
                alignment: AlignmentType.END,
                spacing: { before: 120 }
              })
            ]
          })
        },
        children: [
          // Title on Cover / First Paragraph
          new Paragraph({
            children: [
              new TextRun({
                text: cleanTitle,
                bold: true,
                size: docType === "report" ? 36 : 28, // Heading-size
                color: brandingColor,
                font: "Calibri"
              })
            ],
            spacing: { before: docType === "report" ? 360 : 120, after: docType === "report" ? 240 : 120 }
          }),
          // Add Divider Line for visual hierarchy
          new Paragraph({
            children: [
              new TextRun({
                text: "_________________________________________________________________________________",
                color: "CBD5E1" // grey divider border
              })
            ],
            spacing: { after: 360 }
          }),
          // Rest of story paragraphs
          ...storyParagraphs
        ]
      }
    ]
  });

  // Pack and Save
  const baseBlob = await Packer.toBlob(doc);
  // Ensure the exact Word document MIME type is used strictly
  const finalBlob = new Blob([baseBlob], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
  
  // Make filename very short and meaningful (maximum 2-3 essential words)
  let words = cleanTitle
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2); // Filter out helper/short words
  
  if (words.length === 0) {
    words = ["Document"];
  }
  
  // Keep only the first 2-3 essential words to retain 100% compatibility with phone downloads
  const shortWords = words.slice(0, 3);
  const formattedFileName = shortWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("_") || "Doc";
  
  const fileNameWithExt = `${formattedFileName}.docx`;

  // 1. Try Native Mobile sharing first if supported (extremely reliable on phone's Safari, Chrome, in-apps)
  if (navigator.share) {
    try {
      const fileOfBlob = new File([finalBlob], fileNameWithExt, {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });
      // Verify compatibility of sharing files
      if (navigator.canShare && navigator.canShare({ files: [fileOfBlob] })) {
        await navigator.share({
          files: [fileOfBlob],
          title: fileNameWithExt,
          text: `ProdixAI: ${fileNameWithExt}`
        });
        console.log("Document shared successfully via native share panel!");
        return;
      }
    } catch (shareErr) {
      console.warn("Native Web Share API failed or closed, fall back to Base64 file link download.", shareErr);
    }
  }

  // 2. Try high-compatibility Base64 DataURL download block
  try {
    const base64Url = await blobToBase64(finalBlob);
    const a = document.createElement("a");
    a.href = base64Url;
    a.download = fileNameWithExt;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 500);
  } catch (err) {
    console.warn("Base64 download failed, fallback to native file-saver download.", err);
    try {
      saveAs(finalBlob, fileNameWithExt);
    } catch (directErr) {
      console.error("All document download pathways failed on this device.", directErr);
    }
  }
}
