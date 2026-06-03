import { ChatMessage, Attachment } from "./types";

export async function sendMessageToAI(
  history: ChatMessage[], 
  message: string, 
  file?: Attachment, 
  documentContext?: string, 
  documentName?: string,
  files?: Attachment[]
): Promise<{text: string, modelLabel?: string}> {
  try {
    // Detemine correct API URL depending on the runtime environment (APK, Web view, Render, Dev)
    let apiUrl = "/api/chat";
    if (typeof window !== "undefined" && window.location) {
      const { hostname, protocol, port } = window.location;
      
      const isWebDeployment = hostname.includes("onrender.com") || hostname.includes("run.app");
      const isLocalWebDev = (hostname === "localhost" || hostname === "127.0.0.1") && port;
      
      if (!isWebDeployment && !isLocalWebDev) {
        // Fallback for Android APK webviews (Capacitor/Cordova/WebView) to query Render directly
        apiUrl = "https://prodixai-tsapp.onrender.com/api/chat";
      }
    }

    // Clean history to remove huge base64 payloads of previous files/photos,
    // and preserve the actual full length of any doc creation messages.
    // The AI only needs the textual messages of the history, not the massive duplicate base64 data!
    const cleanedHistory = (history || []).map((msg: any) => {
      const actualText = msg.fullDocText || msg.text || "";
      const cleanedMsg = {
        ...msg,
        text: actualText
      };

      if (cleanedMsg.attachment && cleanedMsg.attachment.base64) {
        const { base64, ...rest } = cleanedMsg.attachment;
        cleanedMsg.attachment = rest;
      }

      if (cleanedMsg.attachments && Array.isArray(cleanedMsg.attachments)) {
        cleanedMsg.attachments = cleanedMsg.attachments.map((att: any) => {
          if (att && att.base64) {
            const { base64, ...rest } = att;
            return rest;
          }
          return att;
        });
      }

      return cleanedMsg;
    });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        history: cleanedHistory,
        message,
        file,
        documentContext,
        documentName,
        files
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error calling /api/chat:", error);
    throw new Error(error.message || "PRODIX AI is busy, please try again in a moment.");
  }
}
