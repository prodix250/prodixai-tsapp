export type MessageRole = "user" | "model";

export interface Attachment {
  name: string;
  type: string;
  base64: string; // The base64 data to send to server
  url?: string; // local URL for display
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
  status?: "sent" | "delivered" | "read";
  attachment?: Attachment;
  fullDocText?: string;
  docTitle?: string;
  docType?: "letter" | "report" | "general";
}

export interface ChatSession {
  id: string;
  contactName: string;
  avatarUrl?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount?: number;
  documentContext?: string;
  documentName?: string;
  isTemporary?: boolean;
}
