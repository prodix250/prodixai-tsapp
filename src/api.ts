import { ChatMessage, Attachment } from "./types";

export async function sendMessageToAI(
  history: ChatMessage[], 
  message: string, 
  file?: Attachment, 
  documentContext?: string, 
  documentName?: string
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

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        history,
        message,
        file,
        documentContext,
        documentName
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
