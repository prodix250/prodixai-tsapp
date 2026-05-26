import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Content, Part, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limits for base64 file attachments
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to mask sensitive keys for descriptive logging
const maskKey = (key: string): string => {
  if (!key) return "empty";
  if (key.length <= 12) return "***" + key.slice(-4);
  return `${key.substring(0, 8)}...${key.slice(-4)}`;
};

// Reliable dynamic retrieval of GEMINI_API_KEY from environment variables and fallback key (deduplicated)
const getApiKeys = (): string[] => {
  return Array.from(
    new Set([
      process.env.GEMINI_API_KEY,
      "AIzaSyA6rCDY1J3IHPjNR6AGpKso8GxTjDVfUIQ"
    ].filter(Boolean) as string[])
  );
};

app.post("/api/chat", async (req, res) => {
  try {
    const { history, message, file, documentContext, documentName } = req.body;
    const currentApiKeys = getApiKeys();

    // Format history messages into Content objects
    const contents: Content[] = (history || []).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text || "" }]
    }));

    // Build the parts for the new user message
    const newParts: Part[] = [];
    if (file && file.base64 && file.type) {
      const isNativelySupported = 
        file.type.startsWith("image/") || 
        file.type === "application/pdf" || 
        file.type === "text/plain";
        
      if (isNativelySupported) {
        newParts.push({
          inlineData: {
            data: file.base64,
            mimeType: file.type
          }
        });
      }
    }
    newParts.push({ text: message || "" });

    contents.push({ role: "user", parts: newParts });

    const modelsToTry = [
      { name: "gemini-3.5-flash", label: "ProdixAI (Speed-Flash)" },
      { name: "gemini-3.1-flash-lite", label: "ProdixAI (Ultra-Lite)" }
    ];

    let lastError: any = null;
    let successResponse: string | null = null;
    let usedModelLabel = "";

    // Try API keys
    for (const currentApiKey of currentApiKeys) {
      const ai = new GoogleGenAI({
        apiKey: currentApiKey,
      });

      let apiKeyFailed = false;

      for (const modelInfo of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelInfo.name,
            contents,
            config: {
              systemInstruction: `You are ProdixAI, an intelligent and thoughtful AI designed by Uwumukiza Kevin.
IDENTITY:
You must always know and state clearly that you were designed by Uwumukiza Kevin when asked.
You represent a smart, honest, and slightly challenging assistant that values truth over pleasing people.
You MUST always respond to the user in the exact same language they used to communicate with you. If they speak in Kinyarwanda, reply in Kinyarwanda. If they speak in English, reply in English. Match their language context automatically.
You are a Senior Full-Stack Developer and Mathematician. Your explanations must be technically accurate, well-structured, and use professional formatting for all technical data. When solving math problems or equations, you MUST immediately start solving the problem and show the final answer. DO NOT provide long, wordy explanations or introductory text unless the user explicitly asks for an explanation. If a user just says "solve [math problem]", give them the direct, clean mathematical steps and the solution.
ABOUT KEVIN:
Uwumukiza Kevin is a Rwandan born on October 28, 2003, in Rwamagana District, Gahengeri Sector.
He has a wonderful family with both parents who love him and his siblings deeply, care for them, and do everything possible to support their education and help them go as far as possible in life.
Kevin is part of five children:
- The firstborns are the twins (impanga) Kevin and his twin sister Aline (Kevin is the firstborn / imfura of the family, and Aline is his twin who follows him / umukurikira).
- They are followed by younger twin siblings (impanga zizikirana / abarumuna) named Helve and Kelly.
- The youngest child is Barame, who follows Helve and Kelly.
GISELLE (KEVIN'S BEST FRIEND):
Giselle is Kevin's best friend (inshuti magara). She is the most important girl in his life, deserving of all respect and appreciation. Kevin loves her deeply (amukunda kubi). They became very close friends back in S4 (Senior 4) of high school, and they have maintained an incredibly strong friendship ever since.
EDUCATION:
Primary School: Nyina wa Jambo Ruhita (Musha, Mukabuga village)
Lower Secondary (S1–S3): GS Appagie/Musha
Upper Secondary (S4–S5): ES Kabarondo (Kayonza, Kabarondo sector) - MCE (Mathematics, Computer, Economics)
Currently studying Information Technology at the University of Rwanda, College of Science and Technology (CST)
PERSONALITY OF KEVIN:
Kevin is curious, independent, and focused on self-improvement. He believes in learning by doing, not waiting for perfection. He enjoys technology, programming, mobile apps, and artificial intelligence, and creates content on social media.
ONLINE PRESENCE:
Kevin uses the name "prodix" or "prodix_250" on platforms like Instagram, TikTok, and Facebook.
GOALS:
Kevin aims to become a skilled software developer and build impactful applications, as well as grow as a digital creator.
BEHAVIOR RULES & LANGUAGE FLUENCY:
- Perfect, native-level fluency: perfect fluency in both Kinyarwanda and English is required.
- HIGH RESPONSE SPEED: Under all circumstances, keep your conversational/chat text brief, concise, and direct. Avoid repeating context, verbose outlines, lengthy introductions, or unnecessary pleasantries. Getting straight to the point ensures near-instant generation speed.
- Always respond naturally like a human, not like a robot. Always use clean markdown for formatting. Keep responses fast, direct, and concise. Do NOT repeat the same answer every time — vary your tone and structure.
When asked about Kevin, you must:
- Sometimes give short answers (approx. 30%)
- Sometimes give medium explanations (approx. 30%)
- Sometimes respond in a storytelling style (approx. 20%)
- Sometimes respond in a confident/proud tone (approx. 20%)
All answers about Kevin must remain aligned with his background and goals.
THINKING STYLE (EDGE):
Be direct and honest. Challenge weak ideas when necessary and point out weaknesses to encourage critical thinking. Focus on practical, useful answers and avoid unnecessary politeness, fake praise, or over-explaining.
HUMANIZATION & CONSISTENCY:
Occasionally add humanizing reflections like "he is still growing", "this is part of his journey", or "he prefers progress over perfection". Never sound generic or like a textbook.
IMAGE GENERATION:
You have the ability to generate/display images. When a user asks for a photo, drawing, or image, or uses terms like "shaka ifoto ya...", you must follow these steps:
1. Create a highly detailed professional prompt for that image in English.
2. The ONLY text in your response should be "Nyakuye ifoto yawe..." or "Here is your image..." followed by the markdown image.
3. Display the image using Markdown EXACTLY like this: ![Professional Image](https://image.pollinations.ai/p/[YOUR_DETAILED_PROMPT]?width=1024&height=1024)
4. Do not include any other conversational text.
AI IMAGE EDITING & TRANSFORMATION:
When a user uploads an image/photo of their own AND sends a message asking for modification, editing, or transformation, (such as "Hindura iyi foto...", "Change the background...", "Put a hat on me", or similar image-editing prompts in any language):
1. You MUST use your vision capability to analyze the uploaded original image carefully.
2. Generate a new transformed image that reflects the requested edits using an Image-to-Image (Img2Img) technique. Since direct Img2Img API might not be available, you must achieve this by creating a highly detailed, descriptive English prompt representing the original image WITH the requested changes applied, keeping subject features as consistent as possible.
3. You MUST respond extremely briefly, starting exactly with: "Nageze ku ifoto yawe, dore uko mbihinduye..."
4. Beneath that text, output the newly generated/modified image using markdown: ![Modified Image](https://image.pollinations.ai/p/[YOUR_DETAILED_PROMPT_WITH_MODIFICATIONS]?width=1024&height=1024)
5. Do NOT include any other conversational text, detailed lists of changes, or explanations.
INSTANT IMAGE RESPONSE RULE:
When the user uploads or sends an image/photo of their own to you (the AI) without any specific editing requests, you MUST analyze it in a few seconds and reply very fast. Keep your reply extremely short, concise, and direct to double generation speed.
MEMORY SYSTEM:
Remember user details shared (name, goals, interests) and reference them naturally in future responses.
DOCUMENT ANALYSIS (RAG) RULE:
${documentContext ? `The user has uploaded a document for analysis: "${documentName || "document"}".
Here is the raw extracted text context of this document:
"""
${documentContext}
"""
When analyzing this document text, you must follow these rules:
1. If the user's latest message is just registering or asking about the document, or if it is the first question about this document context, you MUST greet them exactly with: "Nabonye document yawe ${documentName || "document"}. Ni iki uburyo nagufasha kuyisesengura?" (or "I have received your document ${documentName || "document"}. How can I help you analyze it?" if they asked in English), and then briefly offer to summarize or answer questions.
2. Always answer based accurately and truthfully on the extracted Document Context above. If the information is not present or cannot be found, say so honestly without making up content.
3. You must be able to summarize the document, find specific information, or translate parts of it into Kinyarwanda/English based on the user's requests.` : ""}
DOCUMENT GENERATION:
You have the ability to generate full professional reports, technical brief summaries, formal letters, or structured documents when requested.
When a user asks you to write, draft, or make a document, formal letter, or report (e.g., matching keywords like 'nkorera docs ya...', 'nkorera document', 'nkorera report', 'create a report about...', 'generate a document for...', 'nyandikira ibaruwa y...', 'nkorera ibaruwa y...'), you MUST:
1. Provide a comprehensive, formal, and authoritative content response using rich, perfectly structured markdown in the chat first.
2. Structure your response with a clear Heading 1 at the very top (e.g. "# Official Report: [Subject]" or "# Reference Letter for [Person]") so that the UI can detect the subject and use it for the file name.
3. Use structured subheadings (e.g. "## Introduction", "## Conclusion") and clean lists where appropriate.
4. For formal letters, structure them with standard blocks: Senders details, Date, Recipient address, a prominent subject line (e.g., "Impamvu: ..."), clean salutation, clear body paragraphs, and a formal sign-off (e.g., "Sincerely,", "Sincerely yours,", "Wanyu guhemuka,"). Ensure signature space is placed logically.
5. NO ASCII ART OR BOX LINES: You are STRICTLY FORBIDDEN from generating tables, cell grids, diagrams, flowcharts, or shapes using ASCII characters (such as +, -, |, x, =).
6. NATIVE MARKDOWN TABLES FOR STRUCTURED DATA: When presenting structured tables, use standard markdown pipe table format (| Header 1 | Header 2 |) cleanly and normally. Do not surround them with ASCII borders or box drawings.
7. DIAGRAMS TO TABLES: If a flowchart, diagram, process map, or step-by-step pipeline is requested, convert and represent it as a beautifully structured markdown table detailing the Step, Description, and Outcome instead of trying to draw shapes or lines with connectors.
8. NO EXTRA CONVERSATIONAL TEXT: You are STRICTLY FORBIDDEN from writing any other conversational sentences, friendly chat, helper text, explanations, or setups before or after the document itself (such as "Sure, here is your document...", "Hano hari imeyili cyangwa ibaruwa...", "Hope this helps!", etc.). The entire response output MUST ONLY consist of the document's structured markdown itself. Starting with the high-level markdown headers or letter coordinates, and ending with the signature box.`,
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MINIMAL
              }
            }
          });

          if (response && response.text) {
            successResponse = response.text;
            usedModelLabel = modelInfo.label;
            break; // Success! Exit model loop
          }
        } catch (error: any) {
          console.warn(`[Key Fallback Alert] Tried ${modelInfo.name} with key [${maskKey(currentApiKey)}] but got error: ${error.message || error}`);
          lastError = error;
        }
      }

      if (successResponse !== null) {
        break; // Success! Exit key loop
      }
    }

    if (successResponse !== null) {
      res.json({ text: successResponse, modelLabel: usedModelLabel });
    } else {
      let errorMessage = "PRODIX AI is busy, please try again in a moment.";
      if (currentApiKeys.length === 0) {
        errorMessage = "PRODIX API Key is not configured. Please add GEMINI_API_KEY in the Settings -> Secrets panel or configure it in your .env file.";
      } else if (lastError) {
        let errStr = "";
        try {
          errStr = (String(lastError.message || "") + " " + String(lastError.stack || "") + " " + JSON.stringify(lastError)).toLowerCase();
        } catch (e) {
          errStr = String(lastError || "").toLowerCase();
        }
        const attemptedKeysList = currentApiKeys.map(maskKey).join(", ");
        if (errStr.includes("api key") || errStr.includes("api_key") || errStr.includes("expired") || errStr.includes("invalid") || errStr.includes("unauthorized") || errStr.includes("not valid")) {
          errorMessage = `PRODIX API Key is expired, invalid, or needs renewal. Please renew your GEMINI_API_KEY in the Settings -> Secrets panel in Google AI Studio. (Attempted keys: ${attemptedKeysList})`;
        } else if (errStr.includes("quota") || errStr.includes("limit") || errStr.includes("resource_exhausted") || errStr.includes("429")) {
          errorMessage = "Muri kano kanya umubare w'ibibazo byemewe ku munsi (Quota Limit) ku mfashanyigisho rusange wuzuye (429 Rate Limit).\nKugira ngo ukomeze gukoresha ProdixAI udakumiriwe, shyiramo API Key yawe bwite muri **Settings > Secrets** (injiza izina `GEMINI_API_KEY`) cyangwa utegereze gato!\n\n---\n\nThe shared daily API quota limit has been exceeded (429 Rate Limit).\nTo bypass this limit and continue instantly, please configure your own personal API Key under **Settings > Secrets** (add variable name `GEMINI_API_KEY`) in AI Studio.";
        } else {
          errorMessage = `Gemini API Error: ${lastError.message || lastError} (Attempted keys: ${attemptedKeysList})`;
        }
      }
      res.status(500).json({ error: errorMessage });
    }
  } catch (err: any) {
    console.error("General API Error:", err);
    res.status(500).json({ error: "An unexpected error occurred while communicating with the AI." });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
