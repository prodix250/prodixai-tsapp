import { ChatMessage, Attachment } from "./types";

export async function sendMessageToAI(
  history: ChatMessage[], 
  message: string, 
  file?: Attachment, 
  documentContext?: string, 
  documentName?: string
): Promise<{text: string, modelLabel?: string}> {
  try {
    const response = await fetch("/api/chat", {
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
