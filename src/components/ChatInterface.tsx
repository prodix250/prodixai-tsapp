import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, MoreVertical, Phone, Video, Paperclip, Send, Camera as CameraIcon, Mic, Check, CheckCheck, Bot, X, Plus, Download, Trash2, FileText, Copy } from "lucide-react";
import { ChatMessage, Attachment, ChatSession } from "../types";
import { cn, fileToBase64, compressImageBase64 } from "../lib/utils";
import { generateProfessionalDoc, generateProfessionalPdf } from "../lib/documentGenerator";
import { format } from "date-fns";
import { AttachmentMenu } from "./AttachmentMenu";
import { sendMessageToAI } from "../api";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { motion, AnimatePresence } from "motion/react";

// Helper to sanitize & extract extremely concise and humanized document names to prevent word-wrapping/overflows and download issues on mobile
function cleanAndShortenDocTitle(rawTitle: string): string {
  if (!rawTitle) return "Doc";
  // Remove markdown, symbols & accents
  let title = rawTitle.replace(/[#*`_-]/g, "").trim();
  
  // Strip out long noisy prefixes
  const noise = ["official", "report", "document", "inyandiko", "ibaruwa", "yo", "kuri", "yase", "gufasha", "gusaba", "akazi", "y'", "w'", "bwa", "kwa"];
  let words = title.split(/\s+/).filter(w => {
    const wl = w.toLowerCase();
    return w.length > 2 && !noise.includes(wl);
  });
  
  if (words.length === 0) {
    words = title.split(/\s+/).filter(w => w.length > 1);
  }
  
  if (words.length === 0) {
    return "Document";
  }
  
  // Keep only the 2 most essential capitalized words to look super elegant
  const short = words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return short.join(" ");
}

function ChatImage({ src, alt, name }: { src?: string; alt: string; name: string }) {
  const [error, setError] = useState(false);
  
  if (error || !src) {
    return (
      <div className="flex items-center gap-2.5 p-3 bg-black/15 dark:bg-black/30 rounded-[8px] border border-white/5 text-left max-w-xs min-w-[240px] select-none">
        <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
          <CameraIcon className="w-5 h-5 shrink-0" />
        </div>
        <div className="flex flex-col overflow-hidden text-left">
          <span className="text-[13px] font-semibold text-wa-text truncate max-w-[150px] leading-tight font-sans" title={name}>
            {name}
          </span>
          <span className="text-[10px] text-wa-text-muted mt-0.5 font-mono">
            Ifoto yoherejwe (Photo)
          </span>
        </div>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      onError={() => setError(true)}
      className="max-w-full h-auto max-h-60 object-cover rounded shadow-sm hover:opacity-90 cursor-pointer transition-opacity" 
    />
  );
}

interface ChatInterfaceProps {
  session: ChatSession;
  onBack: () => void;
  onUpdateSession: (id: string, updates: Partial<ChatSession>) => void;
  onNewChat: () => void;
}

export function ChatInterface({ session, onBack, onUpdateSession, onNewChat }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (session.isTemporary) {
      return [{
        id: "init",
        role: "model",
        text: "This is a **Temporary Chat** with ProdixAI.\n\nYour messages and attachments in this chat will **not be saved** and won't appear in your history once you leave or reload this page. How can I assist you in this private session?",
        timestamp: new Date()
      }];
    }
    const saved = localStorage.getItem(`prodixai-messages-${session.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => {
          const date = m.timestamp ? new Date(m.timestamp) : new Date();
          let attachment = m.attachment;
          if (attachment && attachment.base64 && (!attachment.url || attachment.url.startsWith("blob:"))) {
            attachment = {
              ...attachment,
              url: `data:${attachment.type};base64,${attachment.base64}`
            };
          }
          return {
            ...m,
            timestamp: !isNaN(date.getTime()) ? date : new Date(),
            attachment
          };
        });
      } catch (e) {}
    }
    return [{
      id: "init",
      role: "model",
      text: "Muraho! I am ProdixAI. How can I help you today?",
      timestamp: new Date()
    }];
  });

  const [inputText, setInputText] = useState("");
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customLoadingText, setCustomLoadingText] = useState<string | null>(null);
  const [activeModelLabel, setActiveModelLabel] = useState<string>("Prodix-Pro");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDownloadingDoc, setIsDownloadingDoc] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
  // Document Parsing and RAG states
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [extractedDocText, setExtractedDocText] = useState(session.documentContext || "");
  const [extractedDocName, setExtractedDocName] = useState(session.documentName || "");

  const handleFileSelect = async (file: File) => {
    setAttachedFile(file);
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (["pdf", "docx", "doc", "pptx", "ppt", "txt"].includes(extension || "")) {
      setIsParsingDoc(true);
      setExtractedDocText("");
      setExtractedDocName(file.name);
      
      try {
        const { extractTextFromDocument } = await import("../lib/documentParser");
        const text = await extractTextFromDocument(file);
        setExtractedDocText(text);
        onUpdateSession(session.id, {
          documentContext: text,
          documentName: file.name
        });
      } catch (err: any) {
        console.error("Failed to parse document:", err);
        const errMsg = `[Error parsing file content: ${err.message}]`;
        setExtractedDocText(errMsg);
        onUpdateSession(session.id, {
          documentContext: errMsg,
          documentName: file.name
        });
      } finally {
        setIsParsingDoc(false);
      }
    } else {
      setExtractedDocText("");
      setExtractedDocName("");
      onUpdateSession(session.id, {
        documentContext: undefined,
        documentName: undefined
      });
    }
  };

  const removeAttachment = () => {
    setAttachedFile(null);
    setExtractedDocText("");
    setExtractedDocName("");
    onUpdateSession(session.id, {
      documentContext: undefined,
      documentName: undefined
    });
  };

  // Main helper for document generation UI & data splitting as requested
  const handleDocumentGeneration = (rawAIResponse: string, prevUserText: string) => {
    const textLower = rawAIResponse.toLowerCase();
    const prevTextLower = prevUserText.toLowerCase();

    const userRequestedDoc = 
      prevTextLower.includes("nkorera docs") ||
      prevTextLower.includes("docs ya") ||
      prevTextLower.includes("create a report") ||
      prevTextLower.includes("report about") ||
      prevTextLower.includes("generate a document") ||
      prevTextLower.includes("document for") ||
      prevTextLower.includes("create a document") ||
      prevTextLower.includes("nkorera ibaruwa") ||
      prevTextLower.includes("formal letter") ||
      prevTextLower.includes("nkorera report") ||
      prevTextLower.includes("generate a report") ||
      prevTextLower.includes("nyandikira ibaruwa") ||
      prevTextLower.includes("nyandikira report");

    const containsDocIndicator = 
      rawAIResponse.trim().startsWith("#") || 
      textLower.includes("subject:") || 
      textLower.includes("impamvu:") ||
      textLower.includes("kuri:");

    if (userRequestedDoc || (containsDocIndicator && rawAIResponse.length > 150)) {
      // It's a professional document! Parse title & type
      const titleMatch = rawAIResponse.match(/^#\s+(.+)$/m);
      let docTitle = "Document";
      if (titleMatch && titleMatch[1]) {
        docTitle = cleanAndShortenDocTitle(titleMatch[1]);
      } else {
        const firstLine = rawAIResponse.split("\n")[0]?.replace(/[#*`_-]/g, "").trim();
        if (firstLine && firstLine.length > 5 && firstLine.length < 60) {
          docTitle = cleanAndShortenDocTitle(firstLine);
        } else {
          docTitle = "Document";
        }
      }

      let docType: "letter" | "report" | "general" = "general";
      if (
        prevTextLower.includes("letter") || 
        prevTextLower.includes("ibaruwa") || 
        prevTextLower.includes("nyandikira ibaruwa") ||
        textLower.includes("subject:") ||
        textLower.includes("impamvu:") ||
        textLower.includes("dear ") ||
        textLower.includes("sincerely")
      ) {
        docType = "letter";
      } else if (
        prevTextLower.includes("report") || 
        prevTextLower.includes("brief") || 
        textLower.includes("introduction") || 
        textLower.includes("technical")
      ) {
        docType = "report";
      }

      // Check language bounds
      const isKinyarwanda = 
        prevTextLower.includes("nkorera") || 
        prevTextLower.includes("ndandikira") || 
        prevTextLower.includes("ibaruwa") || 
        prevTextLower.includes("inyandiko") || 
        prevTextLower.includes("amakuru") || 
        prevTextLower.includes("yawe") || 
        prevTextLower.includes("yase") ||
        rawAIResponse.includes("Impamvu") ||
        rawAIResponse.includes("Gusaba");

      let chatResponse = "";
      if (isKinyarwanda) {
        chatResponse = `Nateguye inyandiko (document) yawe ivuga kuri **"${docTitle}"**. Ushobora kuyimanura hasi hano kugira ngo uyisome yose.`;
      } else {
        chatResponse = `I have generated your document regarding **"${docTitle}"**. You can download it below to read the complete content.`;
      }

      return {
        isDocument: true,
        chatResponse,
        documentBlob: rawAIResponse, // Store the full professional text as requested (called documentBlob / full content)
        docTitle,
        docType
      };
    }

    return null;
  };

  const getDocDetails = (msg: ChatMessage, index: number) => {
    if (msg.role !== "model") return null;

    // 1. If we have already parsed and stored the document details, use them directly
    if (msg.fullDocText) {
      return { 
        title: msg.docTitle || "Prodix_Document", 
        type: msg.docType || "general" 
      };
    }

    // 2. Fallback for older/historic messages
    const prevMsg = index > 0 ? messages[index - 1] : undefined;
    const textLower = msg.text.toLowerCase();
    const prevTextLower = prevMsg?.text?.toLowerCase() || "";

    const userRequestedDoc = 
      prevTextLower.includes("nkorera docs") ||
      prevTextLower.includes("docs ya") ||
      prevTextLower.includes("create a report") ||
      prevTextLower.includes("report about") ||
      prevTextLower.includes("generate a document") ||
      prevTextLower.includes("document for") ||
      prevTextLower.includes("create a document") ||
      prevTextLower.includes("nkorera ibaruwa") ||
      prevTextLower.includes("formal letter") ||
      prevTextLower.includes("nkorera report") ||
      prevTextLower.includes("generate a report") ||
      prevTextLower.includes("nyandikira ibaruwa") ||
      prevTextLower.includes("nyandikira report");

    const containsDocIndicator = 
      msg.text.trim().startsWith("#") || 
      textLower.includes("subject:") || 
      textLower.includes("impamvu:") ||
      textLower.includes("kuri:");

    if (userRequestedDoc || (containsDocIndicator && msg.text.length > 150)) {
      const titleMatch = msg.text.match(/^#\s+(.+)$/m);
      let docTitle = "Document";
      if (titleMatch && titleMatch[1]) {
        docTitle = cleanAndShortenDocTitle(titleMatch[1]);
      } else {
        const firstLine = msg.text.split("\n")[0]?.replace(/[#*`_-]/g, "").trim();
        if (firstLine && firstLine.length > 5 && firstLine.length < 60) {
          docTitle = cleanAndShortenDocTitle(firstLine);
        } else {
          docTitle = "Document";
        }
      }

      let docType: "letter" | "report" | "general" = "general";
      if (
        prevTextLower.includes("letter") || 
        prevTextLower.includes("ibaruwa") || 
        prevTextLower.includes("nyandikira ibaruwa") ||
        textLower.includes("subject:") ||
        textLower.includes("impamvu:") ||
        textLower.includes("dear ") ||
        textLower.includes("sincerely")
      ) {
        docType = "letter";
      } else if (
        prevTextLower.includes("report") || 
        prevTextLower.includes("brief") || 
        textLower.includes("introduction") || 
        textLower.includes("technical")
      ) {
        docType = "report";
      }

      return { title: docTitle, type: docType };
    }
    return null;
  };

  const handleDownloadDoc = async (title: string, rawText: string, docType: "letter" | "report" | "general", format: "docx" | "pdf", fullDocText?: string) => {
    try {
      setIsDownloadingDoc(true);
      const textToUse = fullDocText || rawText;
      if (format === "pdf") {
        await generateProfessionalPdf(title, textToUse, docType);
      } else {
        await generateProfessionalDoc(title, textToUse, docType);
      }
    } catch (err) {
      console.error(`Failed to generate ${format} document`, err);
    } finally {
      setIsDownloadingDoc(false);
    }
  };
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const lastSessionIdRef = useRef(session.id);
  const isInitialMountRef = useRef(true);

  const handleClearChat = () => {
    setMessages([]);
    onUpdateSession(session.id, {
      lastMessage: "",
      lastMessageTime: undefined
    });
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (!session.isTemporary) {
      try {
        localStorage.setItem(`prodixai-messages-${session.id}`, JSON.stringify(messages));
      } catch (err) {
        console.error("Failed to save messages to localStorage:", err);
      }
    }
  }, [messages, session.id, session.isTemporary]);

  useEffect(() => {
    // 1. If we switch sessions, scroll all the way down instantly
    if (session.id !== lastSessionIdRef.current) {
      lastSessionIdRef.current = session.id;
      endOfMessagesRef.current?.scrollIntoView({ behavior: "auto" });
      return;
    }

    // 2. If it is the first load of the page, scroll down instantly
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      endOfMessagesRef.current?.scrollIntoView({ behavior: "auto" });
      return;
    }

    // 3. Only scroll to the bottom smoothly if the LAST message was sent by the user
    // This allows the user to read previous content comfortably when the AI responds
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "user") {
      endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, session.id]);

  const handleSend = async () => {
    if (!inputText.trim() && !attachedFile) return;

    const navFile = attachedFile;
    const currentText = inputText.trim();

    let newAttachment: Attachment | undefined = undefined;
    if (navFile) {
      try {
        let base64 = "";
        let finalUrl = "";
        if (navFile.type.startsWith("image/")) {
          base64 = await compressImageBase64(navFile, 600, 600, 0.75);
          finalUrl = `data:${navFile.type};base64,${base64}`;
        } else {
          base64 = await fileToBase64(navFile);
          finalUrl = URL.createObjectURL(navFile);
        }

        newAttachment = {
          name: navFile.name,
          type: navFile.type,
          base64: base64,
          url: finalUrl
        };
      } catch (e) {
        console.error("Failed to read file", e);
      }
    }

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: currentText,
      timestamp: new Date(),
      status: "sent",
      attachment: newAttachment
    };

    setMessages(prev => [...prev, newMessage]);
    onUpdateSession(session.id, {
      lastMessage: currentText,
      lastMessageTime: newMessage.timestamp
    });
    setInputText("");
    setAttachedFile(null);

    // Distinguish if the request is for visual image editing/transformation OR vision/answering questions
    const hasVisualEditIntent = /hindura|change|edit|modify|transform|put|add|replace|background|remove|filter|hat|wear|glasses|shirt|hair|style/i.test(currentText);
    const hasAnalysisIntent = /iki|ibi|soma|somera|kosora|mbarira|correct|solve|explain|what|read|analyze|show|understand/i.test(currentText);

    const isImageEditRequest = !!(
      newAttachment && 
      newAttachment.type.startsWith("image/") && 
      (currentText.trim() === "" || (hasVisualEditIntent && !hasAnalysisIntent))
    );

    if (isImageEditRequest) {
      setCustomLoadingText("Ndirimo guhindura ifoto yawe, akanya gato...");
    } else if (newAttachment) {
      setCustomLoadingText("Ndirimo gusesengura no gusoma idosiye/ifoto yawe, akanya gato...");
    } else {
      setCustomLoadingText(null);
    }

    setIsLoading(true);

    // AI Request
    try {
      // mark message delivered
      setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: "delivered" } : m));
      
      const { text: responseText, modelLabel } = await sendMessageToAI(
        messages, 
        currentText, 
        newAttachment, 
        extractedDocText, 
        extractedDocName
      );
      if (modelLabel) {
        setActiveModelLabel(modelLabel);
      }
      
      // mark message read (blue ticks)
      setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: "read" } : m));

      const docGen = handleDocumentGeneration(responseText, currentText);

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: docGen ? docGen.chatResponse : responseText,
        fullDocText: docGen ? docGen.documentBlob : undefined,
        docTitle: docGen ? docGen.docTitle : undefined,
        docType: docGen ? docGen.docType : undefined,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      onUpdateSession(session.id, {
        lastMessage: docGen ? docGen.chatResponse : responseText,
        lastMessageTime: aiMessage.timestamp
      });

    } catch (error: any) {
       const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: `Error: ${error.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setCustomLoadingText(null);
    }
  };

  return (
    <div className="flex flex-col h-full wa-doodle-bg w-full max-w-3xl mx-auto sm:border-x sm:border-wa-divider shadow-2xl relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between header-anim text-white px-2 py-2 sm:py-3 z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={onBack} className="p-2 -mr-1 rounded-full hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3 cursor-pointer ml-1">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
              {session.avatarUrl ? (
                <img src={session.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="text-white text-[12px] font-bold tracking-tighter leading-none">PX<span className="text-orange-500 font-extrabold">AI</span></div>
                  <div className="text-white text-[7px] font-extrabold uppercase tracking-widest mt-0.5 leading-none">Prodix</div>
                </div>
              )}
            </div>
             <div className="flex flex-col flex-1">
              <span className="font-medium text-[17px] leading-tight">
                 {session.contactName === "ProdixAI" ? (
                   <>Prodix<span className="font-bold text-orange-500">AI</span></>
                 ) : (
                   session.contactName
                 )}
              </span>
              <span className="text-[13px] leading-tight min-h-[18px]">
                {isLoading ? (
                  <span className="flex items-center gap-1 text-[#2aff85] font-semibold">
                    typing
                    <span className="flex gap-0.5 ml-0.5">
                      <span className="w-1 h-1 bg-[#2aff85] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1 h-1 bg-[#2aff85] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1 h-1 bg-[#2aff85] rounded-full animate-bounce"></span>
                    </span>
                  </span>
                ) : (
                  <span className="text-white/80">online</span>
                )}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={onNewChat}
            className="p-3 rounded-full hover:bg-white/20 transition-colors cursor-pointer text-white block outline-none animate-scale-in"
            title="New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button className="p-3 rounded-full hover:bg-white/20 transition-colors hidden sm:block">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-3 rounded-full hover:bg-white/20 transition-colors hidden sm:block">
            <Phone className="w-5 h-5" />
          </button>
          <div className="relative">
            <motion.button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="p-3 rounded-full hover:bg-white/20 transition-colors cursor-pointer block outline-none"
              animate={{ rotate: isMenuOpen ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <MoreVertical className="w-5 h-5 text-white" />
            </motion.button>

            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsMenuOpen(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-2 top-full mt-1 w-56 bg-wa-panel text-wa-text rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.2)] border border-wa-divider z-50 py-1 origin-top-right whitespace-nowrap"
                  >
                    <button
                      onClick={handleClearChat}
                      className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-wa-divider transition-colors flex items-center gap-2 cursor-pointer text-red-500 hover:text-red-600 border-none bg-transparent"
                    >
                      Clear Chat
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 bg-transparent relative">
        <div className="flex justify-center mb-4 z-10">
          <div className="bg-wa-panel text-wa-text-muted text-xs px-3 py-1.5 rounded-lg shadow-sm">
            Ukora gake bikajyenda cyane by <span className="text-[#00a884] font-bold">Kevin</span>
          </div>
        </div>

        {session.isTemporary && (
          <div className="flex justify-center mb-4 px-2">
            <div className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs px-4 py-2.5 rounded-lg shadow-sm max-w-sm text-center flex items-center gap-2">
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span><strong>Temporary Chat:</strong> Your messages won't be saved in your chat history and will be cleared once you close this session.</span>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const docInfo = getDocDetails(msg, idx);
          return (
            <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div 
                className={cn(
                  "relative max-w-[85%] sm:max-w-[75%] rounded-lg px-2 pt-2 pb-1 text-[15px] shadow-sm flex flex-col gap-1",
                  msg.role === "user" ? "bg-wa-bubble-out rounded-tr-none text-wa-text" : "bg-wa-bubble-in rounded-tl-none text-wa-text"
                )}
              >
                {/* Attachment Preview */}
                {msg.attachment && (
                  <div className="mb-1 rounded overflow-hidden max-w-xs min-w-[240px]">
                    {msg.attachment.type.startsWith("image/") ? (
                       <ChatImage src={msg.attachment.url} alt="attachment" name={msg.attachment.name} />
                    ) : (
                       <div className="flex items-center justify-between gap-3 p-2.5 bg-black/10 dark:bg-black/20 hover:bg-black/15 rounded-[8px] transition-colors cursor-pointer border border-white/5">
                         <div className="flex items-center gap-2.5 overflow-hidden">
                           {/* Rich colored file icon indicator */}
                           {(() => {
                             const nameLower = msg.attachment.name.toLowerCase();
                             const isPdf = nameLower.endsWith(".pdf");
                             const isDocx = nameLower.endsWith(".docx") || nameLower.endsWith(".doc");
                             const isPptx = nameLower.endsWith(".pptx") || nameLower.endsWith(".ppt");
                             
                             let iconColor = "bg-red-500 text-white"; // PDF
                             let extLabel = "PDF";
                             if (isDocx) {
                               iconColor = "bg-blue-600 text-white";
                               extLabel = "DOCX";
                             } else if (isPptx) {
                               iconColor = "bg-orange-500 text-white";
                               extLabel = "PPTX";
                             } else {
                               iconColor = "bg-teal-600 text-white";
                               extLabel = "DOC";
                             }
                             
                             return (
                               <div className={cn("w-10 h-10 rounded-lg flex flex-col justify-center items-center shadow-md shrink-0 text-[10px] font-extrabold uppercase select-none tracking-wider", iconColor)}>
                                 <FileText className="w-5 h-5 mb-0.5 shrink-0" />
                                 {extLabel}
                               </div>
                             );
                           })()}
                           <div className="flex flex-col overflow-hidden text-left">
                             <span className="text-[13px] font-semibold text-wa-text truncate max-w-[150px] leading-tight font-sans" title={msg.attachment.name}>
                               {msg.attachment.name}
                             </span>
                             <span className="text-[10px] text-wa-text-muted mt-0.5 font-mono">
                               {msg.attachment.base64 ? `${Math.round(msg.attachment.base64.length * 0.75 / 1024)} KB` : "Document"} • File
                             </span>
                           </div>
                         </div>
                         
                         {/* Download button */}
                         <a 
                           href={msg.attachment.url || "#"} 
                           download={msg.attachment.name}
                           onClick={(e) => {
                             if (!msg.attachment.url) e.preventDefault();
                           }}
                           className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-wa-text-muted cursor-pointer shrink-0"
                           title="Download document"
                         >
                           <Download className="w-4 h-4" />
                         </a>
                       </div>
                    )}
                  </div>
                )}
                
                <div className="flex flex-col gap-1 w-full pt-1">
                  <div className="flex flex-col gap-2 w-full">
                    {msg.role === "model" && (msg.text.includes("expired") || msg.text.includes("renew") || msg.text.includes("Secrets") || msg.text.includes("quota") || msg.text.includes("429")) ? (
                      <div className="flex flex-col gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-wa-text my-1 select-text">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold shrink-0 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0"></span>
                          <span>ProdixAI: Setup Required / Ibikenewe</span>
                        </div>
                        <div className="text-[13px] leading-relaxed text-wa-text flex flex-col gap-2">
                          {msg.text.includes("expired") || msg.text.includes("renew") || msg.text.includes("Secrets") ? (
                            <>
                              <p className="font-semibold text-orange-600 dark:text-orange-400">
                                🔑 Kinyarwanda:
                              </p>
                              <p className="ml-1 text-wa-text-muted">
                                API Key ikoreshwa na ProdixAI yarangiye cyangwa ntabwo ari yo. Kugira ngo ukomeze gukoresha porogaramu neza, jya muri <strong>Settings (akamenyetso k'uruziga runetse hejuru ku mfuruka y'iburyo ya AI Studio) &gt; Secrets Panel</strong>, maze uvugurure agaciro ka <code>GEMINI_API_KEY</code> uheze ukande Save!
                              </p>
                              <p className="font-semibold text-blue-600 dark:text-blue-400 mt-1">
                                🌐 English:
                              </p>
                              <p className="ml-1 text-wa-text-muted">
                                The active Gemini API Key has expired or is invalid. To resume chatting with ProdixAI in development/production, please renew or configure your own valid API Key under <strong>Settings (the gear icon on the top right in AI Studio) &gt; Secrets</strong> (add/edit the variable name <code>GEMINI_API_KEY</code>) to bypass the block.
                              </p>
                            </>
                          ) : (
                            <p className="text-wa-text-muted whitespace-pre-wrap">
                              {msg.text}
                            </p>
                          )}
                          <div className="mt-2 text-[11px] font-mono text-red-500/80 bg-red-500/5 p-2 rounded border border-red-500/10 whitespace-pre-wrap break-all">
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-end gap-2 w-full">
                        <MarkdownRenderer content={msg.text} />
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto self-end float-right leading-none mt-1 select-none">
                      <button
                        onClick={() => {
                          const textToCopy = msg.fullDocText || msg.text;
                          navigator.clipboard.writeText(textToCopy);
                          setCopiedMessageId(msg.id);
                          setTimeout(() => setCopiedMessageId(null), 2000);
                        }}
                        className="p-1 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 rounded-full transition-all cursor-pointer text-wa-text-muted hover:text-wa-text flex items-center justify-center shrink-0 border-none bg-transparent opacity-60 hover:opacity-100"
                        title="Copy message text"
                      >
                        {copiedMessageId === msg.id ? (
                          <Check className="w-[12px] h-[12px] text-green-500 font-bold" />
                        ) : (
                          <Copy className="w-[12px] h-[12px]" />
                        )}
                      </button>
                      
                      <span className="text-[11px] text-wa-text-muted opacity-80">
                        {(() => {
                          const date = msg.timestamp;
                          const isValid = date instanceof Date && !isNaN(date.getTime());
                          return format(isValid ? date : new Date(), "HH:mm");
                        })()}
                      </span>
                      {msg.role === "user" && (
                        <span className="text-wa-blue-tick">
                           {msg.status === "sent" ? <Check className="w-[14px] h-[14px] text-wa-text-muted" /> : 
                            msg.status === "delivered" ? <CheckCheck className="w-[14px] h-[14px] text-wa-text-muted" /> : 
                            <CheckCheck className="w-[14px] h-[14px] text-wa-blue-tick" />}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Word and PDF Document Generation Buttons */}
                  {docInfo && (
                    <div className="mt-2.5 pt-2.5 border-t border-black/10 dark:border-white/10 flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded bg-[#1f5fbf]/10 flex items-center justify-center shrink-0 border border-[#1f5fbf]/20">
                          <span className="text-[14px] font-black text-[#1f5fbf]">W</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-semibold text-wa-text truncate max-w-[180px] sm:max-w-[240px]" title={docInfo.title}>
                            {docInfo.title}
                          </span>
                          <span className="text-[11px] text-wa-text-muted capitalize">
                            {docInfo.type} (.docx / .pdf)
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleDownloadDoc(docInfo.title, msg.text, docInfo.type, "docx", msg.fullDocText)}
                          disabled={isDownloadingDoc}
                          className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#1f5fbf] hover:bg-[#164c9c] active:scale-[0.98] disabled:opacity-50 transition-all text-white rounded font-medium text-[12px] cursor-pointer shadow-sm border-none grow sm:grow-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Word (.DOCX)
                        </button>
                        <button
                          onClick={() => handleDownloadDoc(docInfo.title, msg.text, docInfo.type, "pdf", msg.fullDocText)}
                          disabled={isDownloadingDoc}
                          className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#df2c2c] hover:bg-[#be2121] active:scale-[0.98] disabled:opacity-50 transition-all text-white rounded font-medium text-[12px] cursor-pointer shadow-sm border-none grow sm:grow-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF (.PDF)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && (
           <div className="flex justify-start">
              <div className="bg-wa-bubble-in rounded-lg rounded-tl-none px-3.5 py-3 shadow-sm flex items-center justify-center">
                 <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
                   {/* Outer rotating orbit container */}
                   <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.6s' }}>
                     {/* Orbit Dot 1 - Cyan */}
                     <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_4px_#22d3ee]"></span>
                     {/* Orbit Dot 2 - Fuchsia */}
                     <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 bg-fuchsia-400 rounded-full shadow-[0_0_4px_#e879f9]"></span>
                     {/* Orbit Dot 3 - Blue */}
                     <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_4px_#60a5fa]"></span>
                     {/* Orbit Dot 4 - Emerald */}
                     <span className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-emerald-400 rounded-full shadow-[0_0_4px_#34d399]"></span>
                     
                     {/* Light circular stroke trail */}
                     <div className="absolute inset-x-0.5 inset-y-0.5 rounded-full border border-white/10"></div>
                   </div>
                   {/* Center core pulse */}
                   <div className="w-1 h-1 rounded-full bg-indigo-400/60 animate-pulse"></div>
                 </div>
              </div>
           </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

       {/* Input Area */}
      <div className="bg-transparent border-t border-wa-divider/30 px-2 pt-2.5 pb-2 flex flex-col z-20 shrink-0 relative">
        {/* We moved the attachment menu down here to wrap it properly for relative positioning (bottom-full) */}
        <AttachmentMenu 
          isOpen={isAttachmentOpen} 
          onClose={() => setIsAttachmentOpen(false)} 
          onFileSelect={handleFileSelect}
        />

        {/* Persistent Hidden inputs for PC & Mobile security sandboxing to avoid file drop on menu unmount */}
        <input 
          type="file" 
          id="cameraInput"
          accept="image/*" 
          capture="environment" 
          className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none"
          onChange={(e) => { 
            const file = e.target.files?.[0]; 
            if (file) {
              handleFileSelect(file);
              // Clean input value so same file can be loaded/selected again
              e.target.value = ""; 
            }
            setIsAttachmentOpen(false); 
          }} 
        />
        <input 
          type="file" 
          id="galleryInput"
          accept="image/*" 
          className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none"
          onChange={(e) => { 
            const file = e.target.files?.[0];
            if (file) {
              handleFileSelect(file);
              e.target.value = "";
            }
            setIsAttachmentOpen(false); 
          }} 
        />
        <input 
          type="file" 
          id="fileInput"
          accept=".pdf,.docx,.doc,.pptx,.ppt,.txt"
          className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none"
          onChange={(e) => { 
            const file = e.target.files?.[0];
            if (file) {
              handleFileSelect(file);
              e.target.value = "";
            }
            setIsAttachmentOpen(false); 
          }} 
        />

        {attachedFile && (
          <div className="mx-2 mb-2 bg-wa-panel p-2.5 rounded-lg shadow-md flex items-center gap-2 border border-wa-divider transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
            <Paperclip className="w-4 h-4 text-[#00a884] animate-pulse shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <span className="text-sm text-wa-text truncate block font-semibold">{attachedFile.name}</span>
              {isParsingDoc ? (
                <span className="text-[10px] text-orange-400 font-medium flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping"></span>
                  Parsing document...
                </span>
              ) : (
                <span className="text-[10px] text-green-500 font-medium">
                  {extractedDocText ? "✓ Ready to analyze" : "✓ Document attached"}
                </span>
              )}
            </div>
            <button onClick={removeAttachment} className="p-1 text-red-500 hover:bg-red-500/10 rounded-full shrink-0 transition-colors cursor-pointer">
               <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 px-1">

          {/* Plus Button (Attachment) */}
          <button 
            onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
            className="w-[36px] h-[48px] px-1 flex items-center justify-center transition flex-shrink-0 mt-auto cursor-pointer text-wa-text-muted hover:text-wa-text"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>

          {/* Input Field */}
          <div className="flex-1 border rounded-[25px] flex flex-col px-4 py-1.5 min-h-[48px] mb-1 shadow-xs transition-all duration-200 ease-in-out msg-input-pill-container">
             <textarea 
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
               placeholder="Type a message..."
               className="flex-1 bg-transparent font-medium resize-none focus:outline-none max-h-32 min-h-[24px] py-1.5 text-[15px] leading-snug transition-all duration-200 ease-in-out msg-input-pill"
               rows={1}
               onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault();
                   handleSend();
                 }
               }}
             />
          </div>

          {/* Send / Mic Button */}
          <button 
            onClick={handleSend}
            className="w-[48px] h-[48px] bg-[#00a884] rounded-full flex items-center justify-center text-white shrink-0 mb-1 active:bg-[#008f6f] transition-colors"
          >
            {inputText.trim() || attachedFile ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            )}
          </button>
        </div>
        
        <div className="w-full text-center mt-1 pb-1">
          <span className="text-[10px] text-wa-text-muted uppercase tracking-wider font-medium opacity-60">
            {activeModelLabel === "ProdixAI (Speed-Flash)" ? (
              <>
                Powered by <span className="text-green-600 dark:text-green-400 font-extrabold text-[11px] tracking-wider">KEVIN</span>
              </>
            ) : activeModelLabel?.includes("Google Search") ? (
              "Powered by ProdixAI with Search"
            ) : (
              "Powered by ProdixAI"
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
