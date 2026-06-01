/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ChatList } from "./components/ChatList";
import { ChatInterface } from "./components/ChatInterface";
import { ChatSession } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { Check, AlertCircle } from "lucide-react";

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("prodixai-theme");
    return saved === "dark";
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem("prodixai-sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed
          .filter((s: any) => s.contactName !== "New Chat" && s.id !== "init" && !s.contactName.includes("New Chat"))
          .map((s: any) => {
            const date = s.lastMessageTime ? new Date(s.lastMessageTime) : undefined;
            return {
              ...s,
              lastMessageTime: date && !isNaN(date.getTime()) ? date : undefined
            };
          });
      } catch (e) {}
    }
    return [];
  });

  const [activeSession, setActiveSession] = useState<ChatSession | null>(() => {
    const savedActiveId = localStorage.getItem("prodixai-active-session-id");
    if (savedActiveId && savedActiveId !== "") {
      const savedSessions = localStorage.getItem("prodixai-sessions");
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          const found = parsed.find((s: any) => s.id === savedActiveId);
          if (found) {
            const date = found.lastMessageTime ? new Date(found.lastMessageTime) : undefined;
            return {
              ...found,
              lastMessageTime: date && !isNaN(date.getTime()) ? date : undefined
            };
          }
        } catch (e) {}
      }
    }
    return null;
  });

  // Custom Toast State for standard styled notification component
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastSuccess, setToastSuccess] = useState<boolean>(true);

  useEffect(() => {
    const handleDownloadEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ success: boolean; message: string }>;
      if (customEvent.detail) {
        setToastMessage(customEvent.detail.message);
        setToastSuccess(customEvent.detail.success);
        setShowToast(true);
      }
    };

    window.addEventListener("prodixai-download", handleDownloadEvent);
    return () => {
      window.removeEventListener("prodixai-download", handleDownloadEvent);
    };
  }, []);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeSession) {
      localStorage.setItem("prodixai-active-session-id", activeSession.id);
    } else {
      localStorage.removeItem("prodixai-active-session-id");
    }
  }, [activeSession]);

  useEffect(() => {
    const sessionsToSave = sessions.filter(s => !s.isTemporary);
    localStorage.setItem("prodixai-sessions", JSON.stringify(sessionsToSave));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem("prodixai-theme", isDarkMode ? "dark" : "light");
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: `ai-${Date.now()}`,
      contactName: "ProdixAI",
      lastMessage: "Start chatting...",
      lastMessageTime: new Date()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSession(newSession);
  };

  const createNewTemporaryChat = () => {
    const newSession: ChatSession = {
      id: `temp-${Date.now()}`,
      contactName: "Temporary Chat",
      lastMessage: "Temporary session started...",
      lastMessageTime: new Date(),
      isTemporary: true
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSession(newSession);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    localStorage.removeItem(`prodixai-messages-${id}`);
    if (activeSession?.id === id) {
      setActiveSession(null);
    }
  };

  const renameSession = (id: string, newName: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, contactName: newName } : s));
    if (activeSession?.id === id) {
      setActiveSession(prev => prev ? { ...prev, contactName: newName } : null);
    }
  };

  const updateSession = (id: string, updates: Partial<ChatSession>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (activeSession?.id === id) {
       setActiveSession(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const deleteAllSessions = () => {
    sessions.forEach(s => {
      localStorage.removeItem(`prodixai-messages-${s.id}`);
    });
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("prodixai-messages-")) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem("prodixai-sessions");
    setSessions([]);
    setActiveSession(null);
  };

  // Responsive full height handling
  return (
    <div className="h-[100dvh] w-full bg-black flex items-center justify-center">
      {/* Container for desktop centering, full width on mobile */}
      <div className="w-full max-w-3xl h-full bg-wa-bg relative overflow-hidden flex flex-col transition-colors duration-200">
          <div className="flex-1 w-full relative overflow-hidden transition-transform duration-300">
             {activeSession ? (
               <div className="absolute inset-0 z-10 bg-wa-bg flex">
                 <ChatInterface 
                   key={activeSession.id}
                   session={activeSession} 
                   onBack={() => setActiveSession(null)} 
                   onUpdateSession={updateSession}
                   onNewChat={createNewChat}
                 />
               </div>
             ) : null}
             <div className="absolute inset-0 z-0 bg-wa-bg flex">
               <ChatList 
                 sessions={sessions}
                 onSelectChat={setActiveSession} 
                 onNewChat={createNewChat}
                 onNewTemporaryChat={createNewTemporaryChat}
                 onDeleteSession={deleteSession}
                 onRenameSession={renameSession}
                 onDeleteAllChats={deleteAllSessions}
                 isDarkMode={isDarkMode} 
                 toggleTheme={toggleTheme} 
               />
             </div>
          </div>

          {/* Custom Styled Notification Component */}
          <AnimatePresence>
            {showToast && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 30, x: "-50%" }}
                animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                exit={{ opacity: 0, scale: 0.9, y: 15, x: "-50%" }}
                transition={{ duration: 0.25, ease: [0.21, 1.02, 0.43, 1.01] }}
                className="absolute bottom-6 left-1/2 z-[9999] flex items-center gap-3 px-5 py-3.5 bg-[#1f2c33] border border-[#00a884]/40 rounded-xl shadow-2xl backdrop-blur-md min-w-[260px] max-w-[90%]"
              >
                <div className={`p-1.5 rounded-full ${toastSuccess ? "bg-[#00a884]/20" : "bg-red-500/20"}`}>
                  {toastSuccess ? (
                    <Check className="w-4 h-4 text-[#00df82]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#00df82] font-bold text-sm tracking-wide truncate">
                    {toastMessage}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>
    </div>
  );
}
