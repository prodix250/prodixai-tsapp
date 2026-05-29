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
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
} from "docx";
import { downloadFile } from "./capacitorDownload";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Helper to clean LaTeX math formats and convert them to a professional readable format using clean bold Unicode.
function cleanMathText(line: string): { text: string; isMath: boolean } {
  let isMath = false;
  let clean = line.trim();
  
  // Handle block math delimiters
  if (clean.startsWith("$$") && clean.endsWith("$$")) {
    clean = clean.slice(2, -2).trim();
    isMath = true;
  } else if (clean.startsWith("$$")) {
    clean = clean.replace(/\$\$/g, "").trim();
    isMath = true;
  } else if (clean.includes("$$")) {
    clean = clean.replace(/\$\$/g, "").trim();
    isMath = true;
  }
  
  // Handle inline math delimiters
  if (clean.includes("$")) {
    clean = clean.replace(/\$/g, "").trim();
    isMath = true;
  }
  
  // Clean up common LaTeX codes and math symbols to make them look beautiful in standard Unicode
  clean = clean
    .replace(/\\times/g, " × ")
    .replace(/\\cdot/g, " · ")
    .replace(/\\div/g, " ÷ ")
    .replace(/\\pm/g, " ± ")
    .replace(/\\mp/g, " ∓ ")
    .replace(/\\le/g, " ≤ ")
    .replace(/\\ge/g, " ≥ ")
    .replace(/\\ne/g, " ≠ ")
    .replace(/\\approx/g, " ≈ ")
    .replace(/\\equiv/g, " ≡ ")
    .replace(/\\in/g, " ∈ ")
    .replace(/\\notin/g, " ∉ ")
    .replace(/\\subset/g, " ⊂ ")
    .replace(/\\supset/g, " ⊃ ")
    .replace(/\\cup/g, " ∪ ")
    .replace(/\\cap/g, " ∩ ")
    .replace(/\\forall/g, " ∀ ")
    .replace(/\\exists/g, " ∃ ")
    .replace(/\\nabla/g, " ∇ ")
    .replace(/\\partial/g, " ∂ ")
    .replace(/\\infty/g, " ∞ ")
    .replace(/\\alpha/g, " α ")
    .replace(/\\beta/g, " β ")
    .replace(/\\gamma/g, " γ ")
    .replace(/\\delta/g, " δ ")
    .replace(/\\theta/g, " θ ")
    .replace(/\\lambda/g, " λ ")
    .replace(/\\mu/g, " μ ")
    .replace(/\\pi/g, " π ")
    .replace(/\\sigma/g, " σ ")
    .replace(/\\omega/g, " ω ")
    .replace(/\\Delta/g, " Δ ")
    .replace(/\\Sigma/g, " Σ ")
    .replace(/\\Omega/g, " Ω ")
    .replace(/\\sqrt\{([^}]+)\}/g, "√($1)")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
    .replace(/_\{([^}]+)\}/g, "_$1")
    .replace(/\^\{([^}]+)\}/g, "^$1");

  return { text: clean, isMath };
}

// Helper to parse formatting (bold/italic) from markdown line
function parseFormattedText(
  text: string, 
  options: { 
    bold?: boolean; 
    italics?: boolean; 
    size?: number; // half-points (e.g. 22 = 11pt)
    color?: string; 
    font?: string; 
  } = {}
): TextRun[] {
  const tokens: { text: string; bold: boolean; italics: boolean }[] = [];
  
  let currentText = "";
  let i = 0;
  let isBold = false;
  let isItalic = false;

  while (i < text.length) {
    if (text.substring(i, i + 2) === "**" || text.substring(i, i + 2) === "__") {
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

  // Text color default (Dark Charcoal #202124)
  return tokens.map(token => new TextRun({
    text: token.text,
    bold: options.bold || token.bold,
    italics: options.italics || token.italics,
    size: options.size ?? 21, // ~10.5pt default
    color: options.color ?? "202124", 
    font: options.font ?? "Calibri"
  }));
}

/**
 * Parses both markdown formatting (*, **) AND LaTeX math expressions ($ or $$)
 * and outputs a beautiful mix of standard runs (Calibri) and mathematical book runs (Times New Roman in italics).
 */
function parseMarkdownAndMathToRuns(
  text: string, 
  options: { 
    bold?: boolean; 
    italics?: boolean; 
    size?: number; // half-points (e.g. 22 = 11pt)
    color?: string; 
    font?: string; 
  } = {}
): TextRun[] {
  const runs: TextRun[] = [];
  
  // Determine if the entire line of text is a block formula (starts with $$) or standalone math
  const cleanLine = text.trim();
  if ((cleanLine.startsWith("$$") && cleanLine.endsWith("$$")) || cleanLine.startsWith("$$")) {
    const mathContent = cleanMathText(cleanLine).text;
    return [
      new TextRun({
        text: mathContent,
        bold: true,
        italics: true,
        size: (options.size ?? 21) + 2, // Slightly larger for equations
        color: "1A73E8", // Beautiful primary brand blue for textbook formulas
        font: "Times New Roman"
      })
    ];
  }

  // Iterate to split raw text into Math parts and Standard Markdown parts
  let currentSegment = "";
  let inMath = false;
  let i = 0;
  
  while (i < text.length) {
    if (text[i] === "$" && (i === 0 || text[i-1] !== "\\")) {
      if (currentSegment) {
        if (inMath) {
          // Process math content (convert latex to beautiful unicode and style with elegant Times serif)
          const parsedMath = cleanMathText(currentSegment).text;
          runs.push(new TextRun({
            text: parsedMath,
            bold: true,             // Bold makes mathematical variables extremely readable like in books!
            italics: true,          // Formulas are elegantly italicized in professional textbooks
            size: options.size ?? 21,
            color: "1A73E8",        // Primary cobalt blue of ProdixAI
            font: "Times New Roman" // Serif text-font for numbers and operators
          }));
        } else {
          // Process standard text part with standard markdown
          runs.push(...parseFormattedText(currentSegment, options));
        }
        currentSegment = "";
      }
      inMath = !inMath;
    } else {
      currentSegment += text[i];
    }
    i++;
  }
  
  if (currentSegment) {
    if (inMath) {
      const parsedMath = cleanMathText(currentSegment).text;
      runs.push(new TextRun({
        text: parsedMath,
        bold: true,
        italics: true,
        size: options.size ?? 21,
        color: "1A73E8",
        font: "Times New Roman"
      }));
    } else {
      runs.push(...parseFormattedText(currentSegment, options));
    }
  }

  return runs;
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
    const rowsData: string[][] = [];
    
    for (const line of tableLines) {
      const cleanLine = line.trim();
      const isAsciiDivider = /^[+\-| =_#~*]+$/.test(cleanLine) && (cleanLine.includes("+") || cleanLine.includes("-") || cleanLine.includes("="));
      if (isAsciiDivider) {
        continue;
      }

      const parts = line.split("|").map(p => p.trim());
      if (parts[0] === "") parts.shift();
      if (parts[parts.length - 1] === "") parts.pop();
      
      const isDivider = parts.every(p => /^[-\s:]+$/.test(p));
      if (!isDivider && parts.length > 0) {
        rowsData.push(parts);
      }
    }
    
    if (rowsData.length === 0) return null;
    
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
                color: "FFFFFF", // White text
                size: 20, // 10pt
                font: "Calibri"
              })
            ],
            alignment: AlignmentType.START,
            spacing: { before: 120, after: 120, line: 276 }
          })
        ],
        shading: {
          fill: brandingColor // Header background: Primary (1A73E8)
        },
        margins: {
          top: 140, // Elegant professional padding
          bottom: 140,
          left: 140,
          right: 140
        }
      });
    });
    
    tableRows.push(new TableRow({ children: headerCells }));
    
    // Create Data Rows with alternating background colors (Zebra Striping)
    dataRowsData.forEach((rowData, rowIndex) => {
      const isEven = rowIndex % 2 === 0;
      const rowFill = isEven ? "FFFFFF" : "F1F3F4"; // White and Secondary (F1F3F4)
      
      const dataCells = rowData.map((cellText) => {
        return new TableCell({
          width: {
            size: colPercentageWidth,
            type: WidthType.PERCENTAGE
          },
          children: [
            new Paragraph({
              children: parseMarkdownAndMathToRuns(cellText, {
                size: 20, // 10pt
                color: bodyColor,
                font: "Calibri"
              }),
              alignment: AlignmentType.START,
              spacing: { before: 100, after: 100, line: 276 }
            })
          ],
          shading: {
            fill: rowFill
          },
          margins: {
            top: 140,
            bottom: 140,
            left: 140,
            right: 140
          }
        });
      });
      
      while (dataCells.length < headerRowData.length) {
        dataCells.push(new TableCell({
          width: {
            size: colPercentageWidth,
            type: WidthType.PERCENTAGE
          },
          children: [new Paragraph("")],
          shading: { fill: rowFill },
          margins: { top: 140, bottom: 140, left: 140, right: 140 }
        }));
      }
      
      tableRows.push(new TableRow({ children: dataCells }));
    });
    
    const professionalBorder = { style: BorderStyle.SINGLE, size: 8, color: "CBD5E1" }; // Soft clean border
    
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
  // Regex for precision VS Code syntax highlighting inside the .docx generator.
  // Correctly balanced with exactly two closing parentheses after literal lookahead open `(?=\s*\())`.
  const tokenRegex = /(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:export|import|from|function|const|let|var|return|if|else|class|default|async|await|try|catch|throw|new|interface|type|extends|implements|typeof|instanceof|switch|case|break|continue|for|while|do|in|of|void|public|private|protected|static|readonly)\b)|(\b[a-zA-Z_]\w*(?=\s*\())|([\+\-\*\/%=<>!&|^~]+|\b\d+(?:\.\d+)?\b|\b(?:true|false|null|undefined)\b)/g;

  let lastIndex = 0;
  const runs: TextRun[] = [];
  let match;

  while ((match = tokenRegex.exec(line)) !== null) {
    const index = match.index;
    
    if (index > lastIndex) {
      runs.push(new TextRun({
        text: line.substring(lastIndex, index),
        size: 19, // ~9.5pt
        color: "D4D4D4", // Default off-white text inside dark boxes
        font: "Consolas"
      }));
    }

    const matchedText = match[0];
    let color = "D4D4D4";
    let italics = false;

    if (match[1]) {
      color = "6A9955"; // Comments: Leafy Green #6A9955
      italics = true;
    } else if (match[2]) {
      color = "CE9178"; // Strings: Orange #CE9178
    } else if (match[3]) {
      color = "569CD6"; // Keywords: Bright Blue #569CD6
    } else if (match[4]) {
      color = "4E97C9"; // Functions: Cyan-Blue #4E97C9
    } else if (match[5]) {
      const matchText = match[5];
      const isNumberOrBool = /^\d+(\.\d+)?$|^(true|false|null|undefined)$/.test(matchText);
      if (isNumberOrBool) {
        color = "CE9178"; // Numbers/Booleans: Orange #CE9178
      } else {
        color = "9D9D9D"; // Operators: Subtle Gray #9D9D9D
      }
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

  if (lastIndex < line.length) {
    runs.push(new TextRun({
      text: line.substring(lastIndex),
      size: 19,
      color: "D4D4D4",
      font: "Consolas"
    }));
  }

  if (runs.length === 0) {
    runs.push(new TextRun({
      text: " ",
      size: 19,
      font: "Consolas"
    }));
  }

  return runs;
}

export async function generateProfessionalDoc(
  title: string, 
  rawMarkdown: string, 
  docType: "letter" | "report" | "general"
) {
  const cleanTitle = title.trim() || "Prodix_Document";
  const lines = rawMarkdown.split("\n");
  const storyParagraphs: (Paragraph | Table)[] = [];

  // Define Professional 5-Color Palette (DOCX style - Hex string format)
  const brandingColor = "1A73E8"; // Primary: Deep Blue Accent
  const secondaryColor = "808080"; // Secondary Label: Gray
  const bodyColor = "202124"; // Text: Dark Charcoal
  const codeBgColor = "1E1E1E"; // Code Background: VS Code Dark

  if (docType === "report") {
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

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    // Markdown Code Block Detector
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
      
      idx = codeIdx; 
      
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
          top: { style: BorderStyle.SINGLE, size: 4, color: codeBgColor },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: codeBgColor },
          left: { style: BorderStyle.SINGLE, size: 4, color: codeBgColor },
          right: { style: BorderStyle.SINGLE, size: 4, color: codeBgColor },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: codeParagraphs,
                shading: {
                  fill: codeBgColor // VS Code Dark Background (#1E1E1E)
                },
                margins: {
                  top: 140, 
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
      continue;
    }

    // Markdown Table Detector and Parser
    if (line.includes("|") && idx < lines.length - 1) {
      const nextLine = lines[idx + 1].trim();
      const isTableDivider = nextLine.includes("|") && /^[|:\s-]+$/.test(nextLine);
      if (isTableDivider) {
        const tableLines: string[] = [];
        let tableIdx = idx;
        while (tableIdx < lines.length && lines[tableIdx].trim().includes("|")) {
          tableLines.push(lines[tableIdx].trim());
          tableIdx++;
        }
        
        idx = tableIdx - 1;
        
        const docxTable = parseMarkdownTable(tableLines, brandingColor, bodyColor);
        if (docxTable) {
          storyParagraphs.push(docxTable);
        }
        continue;
      }
    }

    // Headers
    if (line.startsWith("# ")) {
      const headerText = line.substring(2);
      storyParagraphs.push(
        new Paragraph({
          children: parseMarkdownAndMathToRuns(headerText, {
            bold: true,
            size: 32, // 16pt
            color: brandingColor,
            font: "Calibri"
          }),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 120 }
        })
      );
    } else if (line.startsWith("## ")) {
      const headerText = line.substring(3);
      storyParagraphs.push(
        new Paragraph({
          children: parseMarkdownAndMathToRuns(headerText, {
            bold: true,
            size: 26, // 13pt
            color: brandingColor,
            font: "Calibri"
          }),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 }
        })
      );
    } else if (line.startsWith("### ")) {
      const headerText = line.substring(4);
      storyParagraphs.push(
        new Paragraph({
          children: parseMarkdownAndMathToRuns(headerText, {
            bold: true,
            size: 22, // 11pt
            color: secondaryColor,
            font: "Calibri"
          }),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 80 }
        })
      );
    }
    // Lists
    else if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
      const listContent = line.substring(2);
      storyParagraphs.push(
        new Paragraph({
          children: parseMarkdownAndMathToRuns(listContent, { size: 21, color: bodyColor }),
          bullet: {
            level: 0
          },
          spacing: { before: 40, after: 40, line: 276 }
        })
      );
    } else if (/^\d+\.\s/.test(line)) {
      const listContent = line.replace(/^\d+\.\s/, "");
      storyParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: line.match(/^\d+\.\s/)?.[0] || "1. ", bold: true, size: 21, color: brandingColor }),
            ...parseMarkdownAndMathToRuns(listContent, { size: 21, color: bodyColor })
          ],
          spacing: { before: 60, after: 60, line: 276 }
        })
      );
    }
    // Blockquotes
    else if (line.startsWith("> ")) {
      const blockQuote = line.substring(2);
      storyParagraphs.push(
        new Paragraph({
          children: parseMarkdownAndMathToRuns(blockQuote, { size: 20, italics: true, color: brandingColor }),
          indent: { left: 720 },
          spacing: { before: 120, after: 120, line: 276 }
        })
      );
    }
    // Custom Signatures & Standard text
    else if (line.toLowerCase().startsWith("sincerely,") || line.toLowerCase().startsWith("best regards,") || line.toLowerCase().startsWith("kind regards,")) {
      storyParagraphs.push(
        new Paragraph({
          children: parseMarkdownAndMathToRuns(line, { size: 22, bold: true, color: bodyColor }),
          spacing: { before: 480, after: 60 }
        })
      );
    } else {
      const alignment = docType === "letter" && (line.includes("Sincerely") || line.includes("Regards") || line.includes("Uwumukiza Kevin") || line.includes("Sincerely yours")) 
        ? AlignmentType.START 
        : AlignmentType.BOTH;

      storyParagraphs.push(
        new Paragraph({
          children: parseMarkdownAndMathToRuns(line, { size: 21, color: bodyColor }),
          alignment: alignment,
          spacing: { before: 120, after: 120, line: 276 }
        })
      );
    }
  }

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
                    size: 18, 
                    color: "808080" // Gray Comments
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
                    size: 16, 
                    color: "808080"
                  }),
                  new TextRun({
                    text: "\t\tPage ",
                    size: 16,
                    color: "808080"
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: "808080"
                  })
                ],
                alignment: AlignmentType.END,
                spacing: { before: 120 }
              })
            ]
          })
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: cleanTitle,
                bold: true,
                size: docType === "report" ? 36 : 28, 
                color: brandingColor,
                font: "Calibri"
              })
            ],
            spacing: { before: docType === "report" ? 360 : 120, after: docType === "report" ? 240 : 120 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "_________________________________________________________________________________",
                color: "F1F3F4" // Secondary light divider
              })
            ],
            spacing: { after: 360 }
          }),
          ...storyParagraphs
        ]
      }
    ]
  });

  const baseBlob = await Packer.toBlob(doc);
  const finalBlob = new Blob([baseBlob], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
  
  let words = cleanTitle
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2); 
  
  if (words.length === 0) {
    words = ["Document"];
  }
  
  const shortWords = words.slice(0, 3);
  const formattedFileName = shortWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("_") || "Doc";
  const fileNameWithExt = `${formattedFileName}.docx`;

  await downloadFile(finalBlob, fileNameWithExt);
}

function cleanAndShortenDocTitle(rawTitle: string): string {
  if (!rawTitle) return "Doc";
  let title = rawTitle.replace(/[#*`_-]/g, "").trim();
  const noise = ["official", "report", "document", "inyandiko", "ibaruwa", "yo", "kuri", "yase", "gufasha", "gusaba", "akazi", "y'", "w'", "bwa", "kwa"];
  let words = title.split(/\s+/).filter(w => {
    const wl = w.toLowerCase();
    return w.length > 2 && !noise.includes(wl);
  });
  if (words.length === 0) return "Doc";
  return words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("_");
}

interface SyntaxToken {
  text: string;
  color: [number, number, number];
}

function tokenizeCodeLineForPdf(line: string): SyntaxToken[] {
  // Regex for precision VS Code syntax highlighting inside the .pdf generator.
  // Correctly balanced with exactly two closing parentheses after literal lookahead open `(?=\s*\())`.
  const tokenRegex = /(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:export|import|from|function|const|let|var|return|if|else|class|default|async|await|try|catch|throw|new|interface|type|extends|implements|typeof|instanceof|switch|case|break|continue|for|while|do|in|of|void|public|private|protected|static|readonly)\b)|(\b[a-zA-Z_]\w*(?=\s*\())|([\+\-\*\/%=<>!&|^~]+|\b\d+(\.\d+)?\b|\b(?:true|false|null|undefined)\b)/g;

  let lastIndex = 0;
  const tokens: SyntaxToken[] = [];
  let match;

  while ((match = tokenRegex.exec(line)) !== null) {
    const index = match.index;
    
    if (index > lastIndex) {
      tokens.push({
        text: line.substring(lastIndex, index),
        color: [212, 212, 212] // VS Code Default White/gray text (#D4D4D4)
      });
    }

    const matchedText = match[0];
    let color: [number, number, number] = [212, 212, 212];

    if (match[1]) {
      color = [106, 153, 85]; // Comments: Leafy Green #6A9955 (106, 153, 85)
    } else if (match[2]) {
      color = [206, 145, 120]; // Strings: Orange #CE9178 (206, 145, 120)
    } else if (match[3]) {
      color = [86, 156, 214]; // Keywords: Bright Blue #569CD6 (86, 156, 214)
    } else if (match[4]) {
      color = [78, 151, 201]; // Functions: Cyan-Blue #4E97C9 (78, 151, 201)
    } else if (match[5]) {
      const matchText = match[5];
      const isNumberOrBool = /^\d+(\.\d+)?$|^(true|false|null|undefined)$/.test(matchText);
      if (isNumberOrBool) {
        color = [206, 145, 120]; // Numbers/Booleans: Orange #CE9178 (206, 145, 120)
      } else {
        color = [157, 157, 157]; // Operators: Subtle Gray #9D9D9D (157, 157, 157)
      }
    }

    tokens.push({
      text: matchedText,
      color: color
    });

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({
      text: line.substring(lastIndex),
      color: [212, 212, 212]
    });
  }

  if (tokens.length === 0) {
    tokens.push({
      text: " ",
      color: [212, 212, 212]
    });
  }

  return tokens;
}

interface PdfRichSegment {
  text: string;
  font: "helvetica" | "times" | "courier";
  style: "normal" | "bold" | "italic" | "bolditalic";
  color: [number, number, number];
  size: number;
}

function parseLineToPdfSegments(
  text: string,
  baseColor: [number, number, number],
  baseSize: number,
  isHeader: boolean = false
): PdfRichSegment[] {
  const segments: PdfRichSegment[] = [];
  
  // If the entire text line is block math
  const cleanLine = text.trim();
  if ((cleanLine.startsWith("$$") && cleanLine.endsWith("$$")) || cleanLine.startsWith("$$")) {
    const mathContent = cleanMathText(cleanLine).text;
    return [{
      text: mathContent,
      font: "times",
      style: "bolditalic",
      color: [26, 115, 232], // Royal Blue Signature Brand Color for clean mathematical terms
      size: baseSize + 1
    }];
  }

  // Iterate to split raw text into math segments or text segments
  let currentSegment = "";
  let inMath = false;
  let i = 0;
  
  const addTextSegment = (txt: string, inMathMode: boolean) => {
    if (!txt) return;
    if (inMathMode) {
      const mathText = cleanMathText(txt).text;
      segments.push({
        text: mathText,
        font: "times",
        style: "bolditalic",
        color: [26, 115, 232],
        size: baseSize
      });
    } else {
      // Parse markdown bold (**) and italics (*) inside the non-math segment
      let j = 0;
      let bold = false;
      let italic = false;
      let part = "";
      
      while (j < txt.length) {
        if (txt.substring(j, j + 2) === "**" || txt.substring(j, j + 2) === "__") {
          if (part) {
            segments.push({
              text: part,
              font: "helvetica",
              style: isHeader ? "bold" : (bold ? (italic ? "bolditalic" : "bold") : (italic ? "italic" : "normal")),
              color: baseColor,
              size: baseSize
            });
            part = "";
          }
          bold = !bold;
          j += 2;
        } else if (txt[j] === "*" || txt[j] === "_") {
          if (part) {
            segments.push({
              text: part,
              font: "helvetica",
              style: isHeader ? "bold" : (bold ? (italic ? "bolditalic" : "bold") : (italic ? "italic" : "normal")),
              color: baseColor,
              size: baseSize
            });
            part = "";
          }
          italic = !italic;
          j += 1;
        } else {
          part += txt[j];
          j++;
        }
      }
      if (part) {
        segments.push({
          text: part,
          font: "helvetica",
          style: isHeader ? "bold" : (bold ? (italic ? "bolditalic" : "bold") : (italic ? "italic" : "normal")),
          color: baseColor,
          size: baseSize
        });
      }
    }
  };

  while (i < text.length) {
    if (text[i] === "$" && (i === 0 || text[i - 1] !== "\\")) {
      addTextSegment(currentSegment, inMath);
      currentSegment = "";
      inMath = !inMath;
    } else {
      currentSegment += text[i];
    }
    i++;
  }
  
  addTextSegment(currentSegment, inMath);
  
  return segments;
}

function drawRichParagraphForPdf(
  doc: jsPDF,
  text: string,
  xStart: number,
  yStart: number,
  maxWidth: number,
  baseColor: [number, number, number],
  baseSize: number,
  lineHeight: number,
  checkPageBreakFn: (currentY: number, neededHeight: number) => number,
  isHeader: boolean = false
): number {
  const segments = parseLineToPdfSegments(text, baseColor, baseSize, isHeader);
  
  interface PdfWord {
    text: string;
    segment: PdfRichSegment;
  }
  const words: PdfWord[] = [];
  
  segments.forEach((seg) => {
    const parts = seg.text.split(/(\s+)/);
    parts.forEach((part) => {
      if (part) {
        words.push({
          text: part,
          segment: seg
        });
      }
    });
  });

  let currentY = yStart;
  let currentX = xStart;
  
  let lineSegments: { text: string; segment: PdfRichSegment }[] = [];
  let currentLineWidth = 0;
  
  const flushLine = () => {
    if (lineSegments.length === 0) return;
    
    // Page break is handled dynamically and synchronizes perfectly across blocks
    currentY = checkPageBreakFn(currentY, lineHeight);
    
    lineSegments.forEach((item) => {
      doc.setFont(item.segment.font, item.segment.style);
      doc.setFontSize(item.segment.size);
      doc.setTextColor(item.segment.color[0], item.segment.color[1], item.segment.color[2]);
      
      doc.text(item.text, currentX, currentY);
      currentX += doc.getTextWidth(item.text);
    });
    
    currentY += lineHeight;
    currentX = xStart;
    lineSegments = [];
    currentLineWidth = 0;
  };

  words.forEach((w) => {
    doc.setFont(w.segment.font, w.segment.style);
    doc.setFontSize(w.segment.size);
    const wordWidth = doc.getTextWidth(w.text);
    
    if (currentLineWidth + wordWidth > maxWidth && w.text.trim() !== "") {
      flushLine();
    }
    
    lineSegments.push(w);
    currentLineWidth += wordWidth;
  });
  
  flushLine();
  
  return currentY;
}

export async function generateProfessionalPdf(
  title: string,
  rawMarkdown: string,
  docType: "letter" | "report" | "general"
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const cleanTitle = title.trim() || "Prodix_Document";
  const lines = rawMarkdown.split("\n");

  let y = 20; 
  const marginX = 20;
  const maxPageHeight = 270; 
  const pageWidth = Number(doc.internal.pageSize.getWidth());
  const contentWidth = pageWidth - (marginX * 2);

  const checkPageBreak = (currentY: number, neededHeight: number): number => {
    if (currentY + neededHeight > maxPageHeight) {
      doc.addPage();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128); // Comments/MetaData: Gray #808080
      doc.text("ProdixAI Official Document", pageWidth - marginX, 10, { align: "right" });
      doc.setDrawColor(241, 243, 244); // Secondary Divider Line
      doc.line(marginX, 12, pageWidth - marginX, 12);
      return 20;
    }
    return currentY;
  };

  // Draw first page header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128); // Gray Comments
  doc.text("ProdixAI Official Document", pageWidth - marginX, 10, { align: "right" });

  if (docType === "report") {
    y = checkPageBreak(y, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(26, 115, 232); // Primary Theme Color: 1A73E8 Deep Blue
    doc.text(cleanTitle.toUpperCase(), pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128); // Gray
    doc.text("TECHNICAL BRIEF & INFORMATION REPORT", pageWidth / 2, y, { align: "center" });
    y += 15;
  } else if (docType === "letter") {
    y = checkPageBreak(y, 25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(26, 115, 232); // Primary Theme Color
    doc.text("PRODIXAI SYSTEMS", marginX, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128); // Gray
    doc.text("Kigali, Rwanda  |  Email: contact.prodixai@gmail.com", marginX, y);
    y += 6;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(32, 33, 36); // Text: Dark Charcoal #202124
    doc.text(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, marginX, y);
    y += 10;
  } else {
    y = checkPageBreak(y, 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(26, 115, 232); // Primary Theme Color
    doc.text(cleanTitle, marginX, y);
    y += 8;
  }

  doc.setDrawColor(241, 243, 244); // #F1F3F4 Secondary Divider line
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 10;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    if (i === 0 && (line.startsWith("# ") || line.startsWith("## "))) {
      const headerText = line.replace(/^#+\s+/, "");
      if (headerText.toLowerCase() === cleanTitle.toLowerCase()) {
        continue;
      }
    }

    if (line.startsWith("# ")) {
      const headerText = line.substring(2);
      y = drawRichParagraphForPdf(
        doc,
        headerText,
        marginX,
        y,
        contentWidth,
        [26, 115, 232],
        14,
        6,
        checkPageBreak,
        true
      ) + 4;
    } else if (line.startsWith("## ")) {
      const headerText = line.substring(3);
      y = drawRichParagraphForPdf(
        doc,
        headerText,
        marginX,
        y,
        contentWidth,
        [26, 115, 232],
        12,
        5,
        checkPageBreak,
        true
      ) + 3;
    } else if (line.startsWith("### ")) {
      const headerText = line.substring(4);
      y = drawRichParagraphForPdf(
        doc,
        headerText,
        marginX,
        y,
        contentWidth,
        [128, 128, 128],
        11,
        5,
        checkPageBreak,
        true
      ) + 2;
    } else if (line.startsWith("> ")) {
      const quoteText = line.substring(2);
      const startY = y;
      
      y = drawRichParagraphForPdf(
        doc,
        quoteText,
        marginX + 6,
        y,
        contentWidth - 8,
        [128, 128, 128],
        10,
        5,
        checkPageBreak
      );
      
      const endY = y;
      doc.setDrawColor(26, 115, 232); // Primary color left accent Quote indicator
      doc.setLineWidth(0.8);
      doc.line(marginX + 2, startY - 3, marginX + 2, endY - 3);
      y += 3;
    } else if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
      const listContent = line.substring(2);
      y = checkPageBreak(y, 8);
      doc.setFillColor(26, 115, 232); // Primary color bullets
      doc.circle(marginX + 3, y - 1, 0.8, "F");
      
      y = drawRichParagraphForPdf(
        doc,
        listContent,
        marginX + 8,
        y,
        contentWidth - 8,
        [32, 33, 36],
        10,
        5,
        checkPageBreak
      ) + 1;
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+\.\s)/);
      const numPrefix = match ? match[1] : "1. ";
      const listContent = line.replace(/^\d+\.\s/, "");
      
      y = checkPageBreak(y, 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(26, 115, 232); // Primary color
      doc.text(numPrefix, marginX, y);
      
      y = drawRichParagraphForPdf(
        doc,
        listContent,
        marginX + 8,
        y,
        contentWidth - 8,
        [32, 33, 36],
        10,
        5,
        checkPageBreak
      ) + 1;
    } else if (line.startsWith("```")) {
      const codeLines: string[] = [];
      let codeIdx = i + 1;
      while (codeIdx < lines.length && !lines[codeIdx].trim().startsWith("```")) {
        codeLines.push(lines[codeIdx]);
        codeIdx++;
      }
      i = codeIdx;

      // 4.5mm per line plus 4mm top/bottom padding inside VS Code styled box
      const boxHeight = 8 + (codeLines.length * 4.5);
      y = checkPageBreak(y, boxHeight + 5);

      doc.setFillColor(30, 30, 30); // Code Background: #1E1E1E Dark VS Code (30, 30, 30)
      doc.roundedRect(marginX, y, contentWidth, boxHeight, 1.5, 1.5, "F");

      let currentCodeY = y + 5.5; 
      doc.setFont("courier", "normal");
      doc.setFontSize(8.5);

      codeLines.forEach((codeLine) => {
        let currentX = marginX + 4;
        const tokens = tokenizeCodeLineForPdf(codeLine);
        tokens.forEach(token => {
          doc.setTextColor(token.color[0], token.color[1], token.color[2]);
          doc.text(token.text, currentX, currentCodeY);
          currentX += doc.getTextWidth(token.text);
        });
        currentCodeY += 4.5;
      });

      y += boxHeight + 4;
    } else if (line.startsWith("|")) {
      const tableLines: string[] = [];
      let tableIdx = i;
      while (tableIdx < lines.length && lines[tableIdx].trim().startsWith("|")) {
        tableLines.push(lines[tableIdx].trim());
        tableIdx++;
      }
      i = tableIdx - 1;

      const parsedRows: string[][] = [];
      tableLines.forEach((tLine) => {
        const cleanTLine = tLine.trim();
        const isAsciiDivider = /^[+\-| =_#~*]+$/.test(cleanTLine) && (cleanTLine.includes("+") || cleanTLine.includes("-") || cleanTLine.includes("="));
        if (isAsciiDivider) return;

        const parts = tLine.split("|").map(p => p.trim());
        if (parts[0] === "") parts.shift();
        if (parts[parts.length - 1] === "") parts.pop();

        const isDivider = parts.every(p => /^[-\s:]+$/.test(p));
        if (!isDivider && parts.length > 0) {
          parsedRows.push(parts);
        }
      });

      if (parsedRows.length > 0) {
        const headers = parsedRows[0];
        const body = parsedRows.slice(1);

        // Render dynamically stunning zebra tables with autoTable
        autoTable(doc, {
          startY: y,
          head: [headers],
          body: body,
          theme: "striped",
          headStyles: {
            fillColor: [26, 115, 232], // Primary Theme Color (1A73E8)
            textColor: [255, 255, 255], 
            fontStyle: "bold",
            fontSize: 9,
            font: "helvetica",
            halign: "left"
          },
          bodyStyles: {
            textColor: [32, 33, 36], // Text Dark Charcoal: #202124 (32, 33, 36)
            fontSize: 8.5,
            font: "helvetica"
          },
          alternateRowStyles: {
            fillColor: [241, 243, 244] // Secondary: #F1F3F4 Zebra pattern
          },
          tableLineColor: [203, 213, 225], // clear border (#CBD5E1)
          tableLineWidth: 0.2,
          styles: {
            cellPadding: 3,
            lineColor: [203, 213, 225],
            lineWidth: 0.2
          },
          margin: { left: marginX, right: marginX }
        });

        y = (doc as any).lastAutoTable.finalY + 8;
      }
    } else {
      let pColor: [number, number, number] = [32, 33, 36];
      if (line.toLowerCase().startsWith("sincerely,") || line.toLowerCase().startsWith("best regards,") || line.toLowerCase().startsWith("kind regards,")) {
        y += 4;
      }
      
      y = drawRichParagraphForPdf(
        doc,
        line,
        marginX,
        y,
        contentWidth,
        pColor,
        10,
        5,
        checkPageBreak
      ) + 2;
    }
  }

  const totalPages = doc.internal.pages.length - 1;
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128); // Gray Comments
    doc.text("Powered by ProdixAI Systems", marginX, 287);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - marginX, 287, { align: "right" });
  }

  const pdfOutput = doc.output("blob");
  let wordsList = cleanAndShortenDocTitle(cleanTitle).split("_");
  if (wordsList.length === 0 || !wordsList[0]) wordsList = ["Document"];
  const formattedFileName = wordsList.join("_");
  const fileNameWithExt = `${formattedFileName}.pdf`;

  await downloadFile(pdfOutput, fileNameWithExt);
}
