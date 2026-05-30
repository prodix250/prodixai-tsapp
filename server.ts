import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Content, Part, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// CORS middleware to allow Android APK WebViews (running on http://localhost, file://, etc.) to query Render
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Increase payload limits for base64 file attachments
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to mask sensitive keys for descriptive logging
const maskKey = (key: string): string => {
  if (!key) return "empty";
  if (key.length <= 12) return "***" + key.slice(-4);
  return `${key.substring(0, 8)}...${key.slice(-4)}`;
};

// Reliable dynamic retrieval of GEMINI_API_KEY from environment variables only (supports multiple keys separated by commas/spaces or individual numbered variables)
const getApiKeys = (): string[] => {
  const keysList: string[] = [];
  
  // 1. Explicit rotated keys in order (1, 2, 3, 4)
  const explicitRotated = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4
  ].map(k => k?.trim()).filter(Boolean) as string[];
  
  keysList.push(...explicitRotated);
  
  // 2. Generic GEMINI_API_KEY if present and not already registered (supporting both comma/space-separated and single)
  const defaultKeys = process.env.GEMINI_API_KEY;
  if (defaultKeys) {
    const splitDefault = defaultKeys.split(/[\s,;]+/).map(k => k.trim()).filter(Boolean);
    for (const k of splitDefault) {
      if (!keysList.includes(k)) {
        keysList.push(k);
      }
    }
  }
  
  return keysList;
};

interface GeminiResponseResult {
  text: string;
  modelLabel: string;
}

// Local in-memory caches to record sub-system and structural limits on a per-key basis.
// Keeps performance ultra-fast and prevents server from hammering exhausted limits.
const searchGroundingCooldowns = new Map<string, number>();
const exhaustedKeyCooldowns = new Map<string, number>();

// Robust API call wrapper that automatically rotates through available API keys upon hitting 429/quota limits
async function getGeminiResponse(
  contents: Content[],
  documentContext?: string,
  documentName?: string
): Promise<GeminiResponseResult> {
  const currentApiKeys = getApiKeys();
  if (currentApiKeys.length === 0) {
    throw new Error("NO_KEYS_CONFIGURED");
  }

  const now = Date.now();
  let lastError: any = null;

  // Filter keys that are currently not on generic cooldown
  let activeKeys = currentApiKeys.filter(key => {
    const cooldownEnd = exhaustedKeyCooldowns.get(key) || 0;
    return now > cooldownEnd;
  });

  // If ALL keys are on cooldown, ignore cooldown as a last resort to retry
  if (activeKeys.length === 0) {
    activeKeys = currentApiKeys;
  }

  // Highly optimized cascading per-key fallback pipeline:
  // 1. gemini-3.5-flash WITH Google Search Grounding (Ideal primary)
  // 2. gemini-3.1-flash-lite WITH Google Search Grounding (Lightweight search fallback)
  // 3. gemini-3.5-flash WITHOUT Google Search (Reliable non-search fallback if search limits are exceeded)
  // 4. gemini-3.1-flash-lite WITHOUT Google Search (Ultra-compliant high-quota free tier fallback)
  // 5. gemini-flash-latest WITHOUT Google Search (Classic robust legacy fallback)
  for (let i = 0; i < activeKeys.length; i++) {
    const currentApiKey = activeKeys[i];
    const keyIndexInRaw = currentApiKeys.indexOf(currentApiKey);
    console.log(`[ProdixAI Key Pool] Initiating cascading pipeline on Key Index ${keyIndexInRaw >= 0 ? keyIndexInRaw : i} [${maskKey(currentApiKey)}]`);

    const ai = new GoogleGenAI({
      apiKey: currentApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const sysInstruction = getSystemInstruction(documentContext, documentName);
    const searchCooldownEnd = searchGroundingCooldowns.get(currentApiKey) || 0;
    const isSearchDisabled = Date.now() < searchCooldownEnd;

    if (isSearchDisabled) {
      console.log(`[ProdixAI Key Pool] Google Search Grounding is temporarily key-cooldowned. Bypassing Search-dependent steps for this key.`);
    }

    // --- STEP 1: gemini-3.5-flash WITH Google Search Grounding (Ideal Primary) ---
    if (!isSearchDisabled) {
      try {
        console.log(`[ProdixAI API] Trying gemini-3.5-flash with Google Search on Key Index ${i}...`);
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents,
          config: {
            systemInstruction: sysInstruction,
            tools: [{ googleSearch: {} }]
          }
        });

        if (response && response.text) {
          console.log(`[ProdixAI API Success] Successfully loaded response using model gemini-3.5-flash + Google Search (Key ID: ${i})`);
          return {
            text: response.text,
            modelLabel: "ProdixAI (gemini-3.5-flash + Google Search)"
          };
        }
      } catch (error: any) {
        lastError = error;
        const checkErrStr = (error.message || String(error)).toLowerCase();
        console.warn(`[Key Loop Error] Google Search failed on gemini-3.5-flash for Key Index ${i}. Error: ${error.message || error}`);
        
        // If the API key is invalid/expired, skip tries on this key immediately
        if (checkErrStr.includes("api key not valid") || 
            checkErrStr.includes("api_key_invalid") || 
            checkErrStr.includes("invalid api key") ||
            checkErrStr.includes("unauthorized") ||
            checkErrStr.includes("invalid key")) {
          console.warn(`[ProdixAI Key Pool] Key Index ${i} detected as invalid. Skipping this key completely.`);
          continue;
        }

        // Search rate/quota limits triggers search cooldown
        if (checkErrStr.includes("quota") || checkErrStr.includes("limit") || checkErrStr.includes("resource_exhausted") || checkErrStr.includes("429")) {
          console.warn(`[ProdixAI Key Pool] Google Search Grounding hit quota limits. Cooldown search for 5 minutes.`);
          searchGroundingCooldowns.set(currentApiKey, Date.now() + 300000);
        }
      }
    }

    // --- STEP 2: gemini-3.1-flash-lite WITH Google Search (Faster model search fallback) ---
    if (!isSearchDisabled && Date.now() >= (searchGroundingCooldowns.get(currentApiKey) || 0)) {
      try {
        console.log(`[ProdixAI API] Trying gemini-3.1-flash-lite with Google Search on Key Index ${i}...`);
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents,
          config: {
            systemInstruction: sysInstruction,
            tools: [{ googleSearch: {} }]
          }
        });

        if (response && response.text) {
          console.log(`[ProdixAI API Success] Successfully loaded response using model gemini-3.1-flash-lite + Google Search (Key ID: ${i})`);
          return {
            text: response.text,
            modelLabel: "ProdixAI (gemini-3.1-flash-lite + Google Search)"
          };
        }
      } catch (error: any) {
        lastError = error;
        const checkErrStr = (error.message || String(error)).toLowerCase();
        console.warn(`[Key Loop Error] Google Search failed on gemini-3.1-flash-lite for Key Index ${i}. Error: ${error.message || error}`);

        if (checkErrStr.includes("quota") || checkErrStr.includes("limit") || checkErrStr.includes("resource_exhausted") || checkErrStr.includes("429")) {
          console.warn(`[ProdixAI Key Pool] Google Search Grounding hit quota limits. Cooldown search for 5 minutes.`);
          searchGroundingCooldowns.set(currentApiKey, Date.now() + 300000);
        }
      }
    }

    // --- STEP 3: gemini-3.5-flash WITHOUT Google Search (Primary non-search fallback) ---
    try {
      console.log(`[ProdixAI API] Falling back to gemini-3.5-flash WITHOUT Google Search on Key Index ${i}...`);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction: sysInstruction
        }
      });

      if (response && response.text) {
        console.log(`[ProdixAI API Success] Successfully loaded fallback response using gemini-3.5-flash (Key ID: ${i})`);
        return {
          text: response.text,
          modelLabel: "ProdixAI (gemini-3.5-flash - Search Limit Hit)"
        };
      }
    } catch (error: any) {
      lastError = error;
      const checkErrStr = (error.message || String(error)).toLowerCase();
      console.warn(`[Key Loop Error] Fallback WITHOUT search failed on gemini-3.5-flash for Key Index ${i}. Error: ${error.message || error}`);
    }

    // --- STEP 4: gemini-3.1-flash-lite WITHOUT Google Search (Highly generous free tier quota fallback) ---
    try {
      console.log(`[ProdixAI API] Falling back to gemini-3.1-flash-lite WITHOUT Google Search on Key Index ${i}...`);
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents,
        config: {
          systemInstruction: sysInstruction
        }
      });

      if (response && response.text) {
        console.log(`[ProdixAI API Success] Successfully loaded fallback response using gemini-3.1-flash-lite (Key ID: ${i})`);
        return {
          text: response.text,
          modelLabel: "ProdixAI (gemini-3.1-flash-lite - Search Limit Hit)"
        };
      }
    } catch (error: any) {
      lastError = error;
      const checkErrStr = (error.message || String(error)).toLowerCase();
      console.warn(`[Key Loop Error] Fallback WITHOUT search failed on gemini-3.1-flash-lite for Key Index ${i}. Error: ${error.message || error}`);
    }

    // --- STEP 5: gemini-flash-latest WITHOUT Google Search (Classic robust fallback) ---
    try {
      console.log(`[ProdixAI API] Falling back to gemini-flash-latest WITHOUT Google Search on Key Index ${i}...`);
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents,
        config: {
          systemInstruction: sysInstruction
        }
      });

      if (response && response.text) {
        console.log(`[ProdixAI API Success] Successfully loaded fallback response using gemini-flash-latest (Key ID: ${i})`);
        return {
          text: response.text,
          modelLabel: "ProdixAI (gemini-flash-latest - Search Limit Hit)"
        };
      }
    } catch (error: any) {
      lastError = error;
      const checkErrStr = (error.message || String(error)).toLowerCase();
      console.warn(`[Key Loop Error] Fallback WITHOUT search failed on gemini-flash-latest for Key Index ${i}. Error: ${error.message || error}`);

      // If all fallbacks failed and it is still a general quota rate-limit, cooling down the whole key for 2 minutes is ideal to rotate immediately to other keys.
      if (checkErrStr.includes("quota") || checkErrStr.includes("limit") || checkErrStr.includes("resource_exhausted") || checkErrStr.includes("429")) {
        console.warn(`[ProdixAI Key Pool] Key Index ${i} has hit general fallback limit. Cooldown entire key for 2 minutes.`);
        exhaustedKeyCooldowns.set(currentApiKey, Date.now() + 120000);
      }
    }
  }

  // All keys are exhausted in all three cascading pipelines
  throw lastError || new Error("ALL_KEYS_EXHAUSTED");
}

function getSystemInstruction(documentContext?: string, documentName?: string): string {
  const kigaliTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Kigali',
    dateStyle: 'full',
    timeStyle: 'long'
  }).format(new Date());

  return `You are a real-time AI. Today is May 30, 2026. For ANY question about sports, news, or current tech, you MUST use your Google Search tool first. Do not rely on your internal training data for current events. If you find news about the 2026 Champions League Final in Budapest today, report it accurately. You are ProdixAI. The current time in Rwanda is ${kigaliTime}. Always respond based on this local time. You were created by Kevin. Always provide accurate information, date, and time based on this current timestamp. You have access to Google Search. Use it whenever the user asks about current events or something that requires up-to-date knowledge.
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
CRITICAL: DISTINGUISHING IMAGE ACTIONS (VISUAL EDIT VS QUESTION ANSWERING):
When a user uploads an image or photo of their own, you MUST look carefully at the user's text message to choose between these two distinct pathways:

Pathway A - IMAGE EDITING, MODIFICATION, OR TRANSFORMATION (Only when user explicitly asks to visually modify/change/alter the physical image):
- Criteria: The user wants to visually alter the image, change the background, draw something on it, add details (filters, hat, glasses), or re-draw/mutate the picture (e.g., "hindura iyi foto ube...", "change background", "add hat", "put a laptop in front of me", etc.).
- Action:
  1. Carefully analyze the original photo.
  2. Create a detailed English prompt representing the original photo with the modifications applied.
  3. Respond extremely briefly, starting exactly with: "Nageze ku ifoto yawe, dore uko mbihinduye..."
  4. Display the modified image below using pollinations markdown: ![Modified Image](https://image.pollinations.ai/p/[YOUR_DETAILED_PROMPT_WITH_EDITS]?width=1024&height=1024)
  5. Include absolutely NO other conversational text, lists of changes, or explanations.

Pathway B - VISION, IMAGE ANALYSIS, STUDYING, AND QUESTION ANSWERING (When the user wants you to read, solve, explain, or answer questions on the uploaded image):
- Criteria: The user asks about what is inside the photo, asks you to solve a math/physics/chemistry problem shown on the photo, read or translate writing/text in the photo, correct errors in the photo's assignment, explain the image, or simply asks "iki ni iki?" / "ibi ni ibiki?".
- Action:
  1. Immediately analyze the photo using OCR or mathematical parsing to read and solve the questions or explain elements inside.
  2. Directly reply with a high-accuracy, ultra-concise, beautifully-formatted text explanation or math steps in the user's language.
  3. Keep the text brief and dense. Skip all wordy introductory sentences, friendly greetings, and repetitive filler. Proceed instantly to the solution.
  4. DO NOT generate or display any pollinations.ai image markdown. Respond with direct text layout only.

INSTANT IMAGE/FILE RESPONSE SPEED RULE:
When a file, photo, or document is uploaded, prioritize speed. Answer instantly, omit unnecessary conversational chit-chat, and structure the reply with direct clarity.

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
You have the ability to generate structured documents, reports, formal letters, or PDFs when requested.
CRITICAL MANDATE: You must NOT generate documents automatically. ONLY generate a formal document, letter, report, or PDF if the user explicitly uses keywords like 'create document', 'generate docx', 'make a pdf', 'save as doc', 'nkorera pdf', 'nkorera docs', 'generate pdf', 'gusaba akazi', 'nyandikira ibaruwa' or similar explicit document demands. Otherwise, simply respond in standard conversational text and markdown without headers.
When requested, you MUST:
1. Provide a comprehensive, formal, and authoritative content response using rich, perfectly structured markdown in the chat first.
2. Structure your response with a clear Heading 1 at the very top (e.g. "# Official Report: [Subject]" or "# Reference Letter for [Person]") so that the UI can detect the subject and use it for the file name.
3. Use structured subheadings (e.g. "## Introduction", "## Conclusion") and clean lists where appropriate.
4. For formal letters, structure them with standard blocks: Senders details, Date, Recipient address, a prominent subject line (e.g., "Impamvu: ..."), clean salutation, create body paragraphs, and a formal sign-off (e.g., "Sincerely,", "Sincerely yours,", "Wanyu guhemuka,"). Ensure signature space is placed logically.
5. NO ASCII ART OR BOX LINES: You are STRICTLY FORBIDDEN from generating tables, cell grids, diagrams, flowcharts, or shapes using ASCII characters (such as +, -, |, x, =).
6. NATIVE MARKDOWN TABLES FOR STRUCTURED DATA: When presenting structured tables, use standard markdown pipe table format (| Header 1 | Header 2 |) cleanly and normally. Do not surround them with ASCII borders or box drawings.
7. DIAGRAMS TO TABLES: If a flowchart, diagram, process map, or step-by-step pipeline is requested, convert and represent it as a beautifully structured markdown table detailing the Step, Description, and Outcome instead of trying to draw shapes or lines with connectors.
8. NO EXTRA CONVERSATIONAL TEXT: You are STRICTLY FORBIDDEN from writing any other conversational sentences, friendly chat, helper text, explanations, or setups before or after the document itself (such as "Sure, here is your document...", "Hano hari imeyili cyangwa ibaruwa...", "Hope this helps!", etc.). The entire response output MUST ONLY consist of the document's structured markdown itself. Starting with the high-level markdown headers or letter coordinates, and ending with the signature box.`;
}

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

    try {
      // Call our robust API Key rotation function
      const result = await getGeminiResponse(contents, documentContext, documentName);
      res.json({ text: result.text, modelLabel: result.modelLabel });
    } catch (lastError: any) {
      let errorMessage = "PRODIX AI is busy, please try again in a moment.";
      if (currentApiKeys.length === 0) {
        errorMessage = "PRODIX API Key is not configured. Please add GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, or GEMINI_API_KEY_4 in the Settings -> Secrets panel.";
      } else {
        let errStr = "";
        try {
          errStr = (String(lastError.message || "") + " " + String(lastError.stack || "") + " " + JSON.stringify(lastError)).toLowerCase();
        } catch (e) {
          errStr = String(lastError || "").toLowerCase();
        }
        const attemptedKeysList = currentApiKeys.map(maskKey).join(", ");
        if (errStr.includes("api key") || errStr.includes("api_key") || errStr.includes("expired") || errStr.includes("invalid") || errStr.includes("unauthorized") || errStr.includes("not valid")) {
          errorMessage = `PRODIX API Keys are expired, invalid, or need renewal. Please renew your rotating GEMINI_API_KEYs (GEMINI_API_KEY_1, _2, _3, _4) in the Settings -> Secrets panel in Google AI Studio. (Attempted keys: ${attemptedKeysList})`;
        } else if (errStr.includes("quota") || errStr.includes("limit") || errStr.includes("resource_exhausted") || errStr.includes("429")) {
          errorMessage = `Muri kano kanya umubare w'ibibazo byemewe ku munsi (Quota Limit) wuzuye kuri buri API Key (429 Rate Limit kuri zose).
Urufunguzo (API Keys) rwasuzumwe kuri servers za ProdixAI: ${attemptedKeysList}

Niba warashyizemo API Keys nshya ubu ngubu, kora ibi bikurikira:
1. Banza urebe neza ko wanditse neza amazina yazo nk'uko byanditswe: "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4" muri Settings -> Secrets muri Google AI Studio.
2. Niba urufunguzo ari urwawe bwite, menya ko "Google Search Grounding" ihitamo ibihamye ishobora kuba yabasabye isanduku (billing account) n'iyo yaba ifite quota isanzwe y'ubuntu.
3. Turabura isanduku yo gusesengura udufasha dushya kubera 429 quota limits.

---

The rotating API key pool quota/rate limit has been fully exceeded for all configured keys (429 Rate Limit for all tries).
Attempted API Key(s) currently loaded: ${attemptedKeysList}

If you recently updated or entered new keys in Google AI Studio under Settings > Secrets (with the exact names "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"), make sure they are active and saved. Note that features like Google Search Grounding may consume quota rapidly or require valid billing, which triggers resource exhaustion (429) errors.`;
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
