import React, { useState, useEffect } from "react";
import { 
  Search, 
  MoreVertical, 
  MessageSquare, 
  Moon, 
  Sun, 
  Edit2, 
  Trash2, 
  Check, 
  X as CloseIcon,
  Phone, 
  Users, 
  Rss, 
  Video, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Volume2, 
  Heart,
  Plus,
  Compass,
  CheckCircle2,
  Lock
} from "lucide-react";
import { ChatSession } from "../types";
import { format } from "date-fns";
import { cn } from "../lib/utils";

interface ChatListProps {
  sessions: ChatSession[];
  onSelectChat: (session: ChatSession) => void;
  onNewChat: () => void;
  onNewTemporaryChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newName: string) => void;
  onDeleteAllChats: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export function ChatList({ 
  sessions, 
  onSelectChat, 
  onNewChat, 
  onNewTemporaryChat,
  onDeleteSession, 
  onRenameSession, 
  onDeleteAllChats, 
  isDarkMode, 
  toggleTheme 
}: ChatListProps) {
  const [activeTab, setActiveTab] = useState<"chats" | "updates" | "communities" | "calls">("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // States for immersive mock simulators
  const [activeCallSim, setActiveCallSim] = useState<{
    name: string;
    type: "voice" | "video";
    avatar: string;
    status: string;
  } | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const [activeStatusStory, setActiveStatusStory] = useState<{
    name: string;
    image: string;
    time: string;
    avatar: string;
  } | null>(null);

  // Dynamic user interaction states
  const [followedChannels, setFollowedChannels] = useState<Record<string, boolean>>({});
  const [joinedCommunities, setJoinedCommunities] = useState<Record<string, boolean>>({});

  // Active status progress bar effect
  useEffect(() => {
    let interval: any;
    if (activeStatusStory) {
      interval = setTimeout(() => {
        setActiveStatusStory(null);
      }, 5000); // closes story automatically after 5s
    }
    return () => clearTimeout(interval);
  }, [activeStatusStory]);

  // Calling simulation duration counter
  useEffect(() => {
    let interval: any;
    if (activeCallSim) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCallSim]);

  const toggleFollowChannel = (id: string) => {
    setFollowedChannels(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleJoinCommunity = (id: string) => {
    setJoinedCommunities(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMenuClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (menuOpenId === id) setMenuOpenId(null);
      else setMenuOpenId(id);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setMenuOpenId(null);
      onDeleteSession(id);
  };

  const handleRenameStart = (e: React.MouseEvent, session: ChatSession) => {
      e.stopPropagation();
      setMenuOpenId(null);
      setEditingId(session.id);
      setEditName(session.contactName);
  };

  const handleRenameSave = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (editName.trim()) {
        onRenameSession(id, editName.trim());
      }
      setEditingId(null);
  };

  const handleRenameCancel = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingId(null);
  };

  const filteredSessions = sessions.filter(session => 
    session.contactName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    session.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-wa-bg w-full max-w-3xl mx-auto sm:border-x sm:border-wa-divider shadow-2xl relative overflow-hidden">
      
      {/* App Bar / Header */}
      <div className="header-anim px-4 pt-4 pb-3 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-white font-medium text-xl leading-tight">Prodix<span className="font-bold text-orange-500">AI</span></h1>
          <span className="text-[12px] text-white/75 leading-none font-light">active</span>
        </div>
        <div className="flex items-center text-white gap-4">
          <button onClick={toggleTheme} className="p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer" title="Shift theme">
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-300" /> : <Moon className="w-5 h-5" />}
          </button>
          <div className="relative">
            <button 
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer text-white flex items-center justify-center border-none bg-transparent outline-none"
            >
              <MoreVertical className="w-5 h-5 text-white" />
            </button>
            {headerMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-wa-panel text-wa-text rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.2)] border border-wa-divider overflow-hidden z-50 py-1 origin-top-right animate-in fade-in slide-in-from-top-2 duration-100 font-normal">
                  <button 
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      onNewTemporaryChat();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-[#00a884]/10 text-wa-text font-medium text-[14px] flex items-center gap-2 transition-colors cursor-pointer border-none bg-transparent outline-none border-b border-wa-divider/30"
                  >
                    <Lock className="w-4 h-4 text-[#00a884]" /> Temporary Chat
                  </button>
                  <button 
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setShowClearAllConfirm(true);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-500 font-medium text-[14px] flex items-center gap-2 transition-colors cursor-pointer border-none bg-transparent outline-none whitespace-nowrap"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" /> Delete All Chats
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* RENDER VIEW BASED ON ACTIVE TAB */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        
        {/* TAB 1: CHATS VIEW */}
        {activeTab === "chats" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Search Bar */}
            <div className="bg-transparent px-3 py-2 shrink-0">
              <div className="bg-wa-panel rounded-full flex items-center px-4 py-1.5 h-10 border border-wa-divider">
                <Search className="w-5 h-5 text-wa-text-muted mr-3" />
                <input 
                  type="text" 
                  placeholder="Search chats..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-wa-text w-full placeholder-wa-text-muted text-[15px]" 
                />
              </div>
            </div>

            {/* Chat List Wrapper */}
            <div className="flex-1 overflow-y-auto w-full">
              {filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[80%] p-8 text-center text-wa-text-muted">
                  <div 
                    onClick={onNewChat}
                    className="w-24 h-24 bg-wa-panel rounded-full flex items-center justify-center mb-6 shadow-md border border-wa-divider cursor-pointer hover:scale-[1.03] active:scale-95 transition-transform group relative"
                  >
                    <div className="absolute inset-0 bg-[#00a884] opacity-0 group-hover:opacity-10 rounded-full transition-opacity"></div>
                    <div className="text-[#00a884] text-3xl font-bold tracking-tighter">PX<span className="text-orange-500 font-extrabold">AI</span></div>
                  </div>
                  <h2 className="text-2xl font-medium text-wa-text mb-3">Prodix AI Assistant</h2>
                  <p className="text-[15px] leading-relaxed max-w-md mx-auto">
                    Start a new chat or select an existing one to begin. I am ready to assist you and analyze your documents!
                  </p>
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <div 
                    key={session.id} 
                    className="group flex items-center px-3 py-3 hover:bg-wa-panel cursor-pointer transition-colors border-b border-wa-divider/30"
                    onClick={() => {
                      if (editingId !== session.id) {
                        onSelectChat(session);
                      }
                    }}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      "w-[50px] h-[50px] rounded-full shrink-0 mr-3 flex items-center justify-center overflow-hidden relative border shadow-sm",
                      session.isTemporary 
                        ? "bg-amber-600/90 border-amber-500/20" 
                        : "bg-[#00a884]/90 border-white/5"
                    )}>
                      {session.isTemporary ? (
                        <Lock className="w-5 h-5 text-white stroke-[2.5]" />
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <div className="text-white text-base font-bold tracking-tighter leading-none">PX<span className="text-orange-500 font-extrabold">AI</span></div>
                          <div className="text-white text-[8px] font-extrabold uppercase tracking-widest mt-0.5 leading-none">Prodix</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1 pt-1 relative">
                      <div className="flex items-center justify-between mb-1">
                        {editingId === session.id ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <input 
                              type="text" 
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 bg-wa-bg text-wa-text border border-wa-divider rounded px-2 py-1 outline-none text-[15px]"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSave(e as any, session.id);
                                if (e.key === "Escape") handleRenameCancel(e as any);
                              }}
                            />
                            <button onClick={(e) => handleRenameSave(e, session.id)} className="p-1 text-wa-accent hover:bg-black/5 dark:hover:bg-white/5 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={handleRenameCancel} className="p-1 text-red-500 hover:bg-black/5 dark:hover:bg-white/5 rounded"><CloseIcon className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <>
                            <h2 className="text-wa-text font-semibold text-[16px] truncate flex-1 pr-2 flex items-center gap-1.5">
                              {session.contactName}
                              {session.isTemporary && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-500 uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold">Temp</span>
                              )}
                            </h2>
                            <span className="text-[11px] shrink-0 font-medium text-wa-text-muted">
                              {(() => {
                                const date = session.lastMessageTime;
                                const isValid = date instanceof Date && !isNaN(date.getTime());
                                return format(isValid ? date : new Date(), "HH:mm");
                              })()}
                            </span>
                          </>
                        )}
                      </div>
                      
                      {!editingId || editingId !== session.id ? (
                        <div className="flex items-center justify-between relative">
                          <p className="text-wa-text-muted text-[13.5px] truncate flex-1 pr-2 leading-relaxed">
                            {session.lastMessage}
                          </p>
                          
                          {/* More Menu Toggle */}
                          <div className="flex items-center gap-1 shrink-0">
                            {session.unreadCount && (
                              <div className="bg-wa-accent text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center">
                                {session.unreadCount}
                              </div>
                            )}
                            <button 
                              onClick={(e) => handleMenuClick(e, session.id)} 
                              className="p-1 text-wa-text-muted hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                            >
                              <MoreVertical className="w-4.5 h-4.5" />
                            </button>
                          </div>

                          {/* Dropdown Menu */}
                          {menuOpenId === session.id && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }} />
                              <div className="absolute right-0 top-full mt-1 w-36 bg-wa-panel rounded-lg shadow-xl border border-wa-divider overflow-hidden z-30 slide-in-from-top-2 animate-in font-normal text-sm">
                                <button 
                                  onClick={(e) => handleRenameStart(e, session)} 
                                  className="w-full text-left px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 text-wa-text text-[13px] flex items-center gap-2 transition-colors cursor-pointer border-none bg-transparent outline-none"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-wa-text-muted" /> Rename
                                </button>
                                <button 
                                  onClick={(e) => handleDelete(e, session.id)} 
                                  className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-500 text-[13px] flex items-center gap-2 transition-colors cursor-pointer border-none bg-transparent outline-none"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" /> Delete chat
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: UPDATES (STATUSES & CHANNELS) */}
        {activeTab === "updates" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 py-4 animate-in fade-in slide-in-from-right-4 duration-200">
            {/* Status section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-wa-text font-bold text-lg">Status</span>
                <span 
                  onClick={() => setActiveStatusStory({ name: "Kevin (Owner)", time: "Just now", avatar: "👨‍💻", image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&auto=format&fit=crop" })}
                  className="text-xs text-[#00a884] font-semibold cursor-pointer hover:underline"
                >
                  View all
                </span>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-4 pt-1 select-none scrollbar-none">
                {/* My Status */}
                <div className="flex flex-col items-center cursor-pointer shrink-0 group">
                  <div className="relative w-15 h-15 rounded-full bg-wa-panel flex items-center justify-center border-2 border-dashed border-wa-divider mb-1 group-hover:scale-105 transition-transform">
                    <div className="w-13 h-13 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-semibold">
                      Me
                    </div>
                    <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#00a884] text-white rounded-full flex items-center justify-center border-2 border-wa-panel">
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>
                  <span className="text-[11px] text-wa-text font-medium">My Status</span>
                </div>

                {/* Simulated status cards */}
                {[
                  { name: "Kevin (Owner)", time: "Just now", avatar: "👨‍💻", image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&auto=format&fit=crop" },
                  { name: "ProdixAI Core", time: "12 mins ago", avatar: "🤖", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop" },
                  { name: "Google AI Community", time: "2 hours ago", avatar: "☁️", image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop" },
                  { name: "Amani Tech", time: "5 hours ago", avatar: "✨", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop" },
                ].map((st, i) => (
                  <div 
                    key={i} 
                    className="flex flex-col items-center cursor-pointer shrink-0 group"
                    onClick={() => setActiveStatusStory(st)}
                  >
                    <div className="w-15 h-15 rounded-full p-[2.5px] border-2 border-[#00a884] mb-1 group-hover:scale-105 transition-transform duration-150">
                      <div className="w-full h-full rounded-full bg-slate-800 text-lg flex items-center justify-center select-none shadow-inner">
                        {st.avatar}
                      </div>
                    </div>
                    <span className="text-[11px] text-wa-text font-medium truncate max-w-[80px]">{st.name.split(" ")[0]}</span>
                    <span className="text-[9px] text-wa-text-muted mt-0.5">{st.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-wa-divider/30 my-3" />

            {/* Channels listing */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <span className="text-wa-text font-bold text-lg">Channels</span>
                <span className="text-xs text-[#00a884] font-semibold cursor-pointer hover:underline flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" /> Find channels
                </span>
              </div>
              <p className="text-xs text-wa-text-muted mb-4">
                Stay updated on your interests. Find channels to follow and get the latest news in tech and AI.
              </p>

              {/* Channel list */}
              <div className="space-y-3">
                {[
                  { id: "ch1", name: "ProdixAI Community", followers: "3.4M", desc: "Official updates for the Prodix AI ecosystem, model announcements, and releases.", avatar: "🚀" },
                  { id: "ch2", name: "Tech Kigali Hub", followers: "128K", desc: "Discover new packages, tech events, hackathons, and developer community meetings.", avatar: "💻" },
                  { id: "ch3", name: "Google Workspace Experts", followers: "890K", desc: "Developers passionate about Google APIs, Sheets automation, and Workspace integration tips.", avatar: "📂" },
                ].map((ch) => {
                  const isFollowing = !!followedChannels[ch.id];
                  return (
                    <div key={ch.id} className="flex gap-3 p-3 bg-wa-panel/40 border border-wa-divider/20 rounded-xl hover:border-[#00a884]/30 transition-all duration-200">
                      <div className="w-11 h-11 rounded-full bg-slate-800 flex items-center justify-center text-xl shrink-0 select-none">
                        {ch.avatar}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[14px] font-semibold text-wa-text block leading-tight">{ch.name}</span>
                            <span className="text-[10px] text-wa-accent font-medium mt-0.5 block">{ch.followers} followers</span>
                          </div>
                          <button 
                            onClick={() => toggleFollowChannel(ch.id)}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all duration-150 border",
                              isFollowing 
                                ? "bg-transparent text-wa-text-muted border-wa-divider hover:bg-white/5" 
                                : "bg-[#00a884] hover:bg-[#019373] text-white border-transparent"
                            )}
                          >
                            {isFollowing ? "Following" : "Follow"}
                          </button>
                        </div>
                        <p className="text-[12px] text-wa-text-muted mt-1.5 leading-relaxed truncate-2-lines line-clamp-2">
                          {ch.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COMMUNITIES VIEW */}
        {activeTab === "communities" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 py-4 animate-in fade-in slide-in-from-right-4 duration-200 text-left">
            <div className="text-center p-4 bg-wa-panel/30 rounded-xl border border-wa-divider/20 mb-5">
              <div className="w-12 h-12 bg-[#00a884]/15 rounded-xl flex items-center justify-center text-[#00a884] mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-wa-text">WhatsApp Communities</h2>
              <p className="text-xs text-wa-text-muted mt-1 max-w-sm mx-auto leading-relaxed">
                Meet like-minded groups, discuss new features, innovations, and latest updates!
              </p>
            </div>

            <div className="space-y-5">
              {[
                {
                  id: "com1",
                  title: "Kigali Developer Forum",
                  desc: "Community for engineers building web and mobile applications in Rwanda.",
                  icon: "🇷🇼",
                  groups: ["Kigali Web developers", "React-Native enthusiasts", "Careers & Jobs Channel"]
                },
                {
                  id: "com2",
                  title: "AI Developers & Prompters",
                  desc: "General discussion and hacks regarding AI integrations, LLMs, and Google APIs.",
                  icon: "💡",
                  groups: ["AI agents builds", "API Keys & Integrations", "Creative Prompters corner"]
                }
              ].map((com) => {
                const isJoined = !!joinedCommunities[com.id];
                return (
                  <div key={com.id} className="bg-wa-panel border border-wa-divider/30 rounded-xl pb-2 overflow-hidden shadow-sm transition-all duration-200">
                    <div className="p-3 border-b border-wa-divider/20 flex items-center justify-between bg-black/5 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 text-lg flex items-center justify-center select-none shadow">
                          {com.icon}
                        </div>
                        <div>
                          <span className="text-[14px] font-bold text-wa-text block leading-tight">{com.title}</span>
                          <span className="text-[11px] text-wa-text-muted mt-0.5 block">{com.groups.length} groups inside</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleJoinCommunity(com.id)}
                        className={cn(
                          "px-3.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center gap-1 border",
                          isJoined 
                            ? "bg-transparent text-green-500 border-green-500/30 font-medium" 
                            : "bg-[#00a884] hover:bg-[#019373] text-white border-transparent"
                        )}
                      >
                        {isJoined ? (
                          <>
                            <Check className="w-3 h-3" /> Joined
                          </>
                        ) : "Join"}
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="text-[12.5px] text-wa-text-muted leading-relaxed">
                        {com.desc}
                      </p>
                      
                      <div className="mt-3.5 space-y-2">
                        {com.groups.map((grp, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 px-2.5 bg-black/10 dark:bg-black/20 rounded-lg border border-wa-divider/10 hover:border-[#00a884]/20 transition-all duration-150">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <div className="w-2 h-2 rounded-full bg-[#00a884]" />
                              <span className="text-[12.5px] text-wa-text font-medium truncate">{grp}</span>
                            </div>
                            <span className="text-[10px] text-wa-text-muted cursor-pointer hover:text-wa-accent font-semibold flex items-center">
                              View ›
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: CALLS VIEW */}
        {activeTab === "calls" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-200">
            {/* Create Call Link */}
            <div className="flex items-center gap-4 px-4 py-3.5 hover:bg-wa-panel/40 cursor-pointer border-b border-wa-divider/20 text-left">
              <div className="w-11 h-11 rounded-full bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
              </div>
              <div>
                <span className="text-[14.5px] font-bold text-wa-text block leading-none">Create call link</span>
                <span className="text-xs text-wa-text-muted mt-1 block leading-none">Share a secure encryption connection</span>
              </div>
            </div>

            <span className="text-xs text-wa-text font-bold uppercase tracking-wider px-4 py-3 bg-black/5 dark:bg-white/5 text-left select-none text-wa-text-muted">
              Recent
            </span>

            {/* List of recent calls */}
            <div className="divide-y divide-wa-divider/30 text-left">
              {[
                { name: "Kevin (AI Developer)", time: "Today, 10:24 AM", type: "voice", action: "incoming", avatar: "👨‍💻", missed: false },
                { name: "Prodix Voice Support", time: "Yesterday, 2:15 PM", type: "video", action: "outgoing", avatar: "🤖", missed: false },
                { name: "Google API Consultant", time: "Yesterday, 09:30 AM", type: "voice", action: "incoming", avatar: "📁", missed: true },
                { name: "Amani Tech Lead", time: "May 22, 5:40 PM", type: "voice", action: "outgoing", avatar: "✨", missed: false },
              ].map((call, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-3 hover:bg-wa-panel transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-[44px] h-[44px] rounded-full bg-slate-800 text-lg flex items-center justify-center select-none shadow">
                      {call.avatar}
                    </div>
                    <div>
                      <span className={cn("text-[14px] font-semibold block leading-tight", call.missed ? "text-red-500" : "text-wa-text")}>
                        {call.name}
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                        {call.action === "incoming" ? (
                          <ArrowDownLeft className={cn("w-3.5 h-3.5", call.missed ? "text-red-500" : "text-green-500")} />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />
                        )}
                        <span className="text-[11.5px] text-wa-text-muted leading-none">{call.time}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Clickable call launchers */}
                  <div className="flex gap-2.5">
                    <button 
                      onClick={() => setActiveCallSim({ name: call.name, type: "voice", avatar: call.avatar, status: "Ringing Securely..." })}
                      className="p-2.5 hover:bg-black/10 dark:hover:bg-white/10 text-[#00a884] rounded-full transition-colors cursor-pointer"
                      title="Voice call simulator"
                    >
                      <Phone className="w-4 h-4 fill-current" />
                    </button>
                    <button 
                      onClick={() => setActiveCallSim({ name: call.name, type: "video", avatar: call.avatar, status: "Starting Video Feed..." })}
                      className="p-2.5 hover:bg-black/10 dark:hover:bg-white/10 text-[#00a884] rounded-full transition-colors cursor-pointer"
                      title="Video call simulator"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM TAB BAR (MADE FULLY CLICKABLE) */}
      <div className="bg-wa-panel border-t border-wa-divider px-2 py-2 flex justify-around items-center shrink-0 pb-safe z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.15)] relative">
        
        {/* Chats Button */}
        <button 
          onClick={() => setActiveTab("chats")}
          className={cn(
            "flex flex-col items-center gap-1 group w-18 cursor-pointer select-none border-none bg-transparent outline-none transition-all duration-200 py-1.5 rounded-xl",
            activeTab === "chats" ? "text-wa-accent font-semibold" : "text-wa-text-muted hover:text-wa-text"
          )}
        >
          <div className={cn(
            "w-14 h-8 rounded-full flex items-center justify-center transition-all duration-200-ease",
            activeTab === "chats" ? "bg-[#00a884]/15 text-[#00a884]" : "group-hover:bg-black/5 dark:group-hover:bg-white/5"
          )}>
            <MessageSquare className="w-5 h-5 fill-current" />
          </div>
          <span className="text-[11px] font-bold tracking-tight">Chats</span>
        </button>

        {/* Updates Button */}
        <button 
          onClick={() => setActiveTab("updates")}
          className={cn(
            "flex flex-col items-center gap-1 group w-18 cursor-pointer select-none border-none bg-transparent outline-none transition-all duration-200 py-1.5 rounded-xl",
            activeTab === "updates" ? "text-wa-accent font-semibold" : "text-wa-text-muted hover:text-wa-text"
          )}
        >
          <div className={cn(
            "w-14 h-8 rounded-full flex items-center justify-center transition-all duration-200-ease",
            activeTab === "updates" ? "bg-[#00a884]/15 text-[#00a884]" : "group-hover:bg-black/5 dark:group-hover:bg-white/5"
          )}>
            <Rss className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold tracking-tight">Updates</span>
        </button>

        {/* Communities Button */}
        <button 
          onClick={() => setActiveTab("communities")}
          className={cn(
            "flex flex-col items-center gap-1 group w-18 cursor-pointer select-none border-none bg-transparent outline-none transition-all duration-200 py-1.5 rounded-xl",
            activeTab === "communities" ? "text-wa-accent font-semibold" : "text-wa-text-muted hover:text-wa-text"
          )}
        >
          <div className={cn(
            "w-14 h-8 rounded-full flex items-center justify-center transition-all duration-200-ease",
            activeTab === "communities" ? "bg-[#00a884]/15 text-[#00a884]" : "group-hover:bg-black/5 dark:group-hover:bg-white/5"
          )}>
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold tracking-tight">Community</span>
        </button>

        {/* Calls Button */}
        <button 
          onClick={() => setActiveTab("calls")}
          className={cn(
            "flex flex-col items-center gap-1 group w-18 cursor-pointer select-none border-none bg-transparent outline-none transition-all duration-200 py-1.5 rounded-xl",
            activeTab === "calls" ? "text-wa-accent font-semibold" : "text-wa-text-muted hover:text-wa-text"
          )}
        >
          <div className={cn(
            "w-14 h-8 rounded-full flex items-center justify-center transition-all duration-200-ease",
            activeTab === "calls" ? "bg-[#00a884]/15 text-[#00a884]" : "group-hover:bg-black/5 dark:group-hover:bg-white/5"
          )}>
            <Phone className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold tracking-tight">Calls</span>
        </button>
      </div>

      {/* Floating Action Button (FAB) on Chat List */}
      {activeTab === "chats" && (
        <button 
          onClick={onNewChat}
          className="absolute right-5 bottom-[84px] w-[52px] h-[52px] bg-[#00a884] hover:bg-[#019373] active:scale-95 text-white rounded-full flex items-center justify-center shadow-lg border border-white/5 z-30 transition-all duration-150 cursor-pointer hover:scale-105"
          title="New Chat"
        >
          <MessageSquare className="w-5 h-5 text-white fill-current shrink-0" />
        </button>
      )}

      {/* IMMERSIVE VIDEO & VOICE CALL SIMULATOR MODAL */}
      {activeCallSim && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col justify-between p-6 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Incoming Video Feed mock layer */}
          {activeCallSim.type === "video" && (
            <div className="absolute inset-0 z-0 bg-slate-900 overflow-hidden opacity-40">
              <div className="w-full h-full bg-gradient-to-tr from-slate-950 via-teal-950 to-indigo-950 animate-pulse" />
            </div>
          )}

          {/* Secure Call Header */}
          <div className="z-10 flex flex-col items-center mt-12 text-center text-white">
            <span className="text-xs bg-white/10 px-3 py-1.5 rounded-full font-medium tracking-wide flex items-center gap-1.5 text-green-400 border border-white/5 select-none animate-pulse">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> End-to-End Encrypted
            </span>
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-5xl mt-8 shadow-2xl relative border-2 border-white/20 select-none">
              {activeCallSim.avatar}
              {activeCallSim.type === "video" && (
                <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center border-2 border-slate-950">
                  <Video className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold mt-5 tracking-tight">{activeCallSim.name}</h2>
            <span className="text-sm font-medium text-slate-300 mt-2 font-mono">
              {callDuration > 0 ? formatDuration(callDuration) : activeCallSim.status}
            </span>
          </div>

          {/* Animated Wave Indicator (Voice Call ONLY) */}
          {activeCallSim.type === "voice" && (
            <div className="z-10 flex items-center justify-center gap-1 h-12 w-full max-w-xs mx-auto text-green-500 opacity-80 mt-4 select-none">
              <Volume2 className="w-6 h-6 mr-2 text-[#00a884] animate-bounce" />
              {[0, 1, 2, 3, 4, 3, 2, 1, 0].map((val, idx) => (
                <span 
                  key={idx} 
                  style={{ height: `${(val + 1) * 6}px` }} 
                  className="w-1 bg-[#00a884] rounded-full animate-pulse mx-[1px]" 
                />
              ))}
            </div>
          )}

          {/* Active Call Controls Footer */}
          <div className="z-10 flex flex-col items-center gap-8 mb-10 w-full">
            <div className="flex justify-center gap-6">
              <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all text-white border border-white/5 cursor-not-allowed">
                <Volume2 className="w-5 h-5" />
              </button>
              <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all text-white border border-white/5 cursor-not-allowed">
                <Heart className="w-5 h-5 fill-current text-rose-500 animate-ping" style={{ animationDuration: '2s' }} />
              </button>
              <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all text-white border border-white/5 cursor-not-allowed">
                <Video className="w-5 h-5" />
              </button>
            </div>
            <button 
              onClick={() => setActiveCallSim(null)}
              className="lg:w-48 w-full py-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-sm tracking-widest uppercase rounded-full flex items-center justify-center gap-2 shadow-2xl transition-all cursor-pointer border border-white/10"
            >
              <Phone className="w-4.5 h-4.5 rotate-[135deg] fill-current" /> End Call
            </button>
          </div>
        </div>
      )}

      {/* FULL-SCREEN MOCK STATUS STORY VIEWER */}
      {activeStatusStory && (
        <div className="fixed inset-0 z-[100] bg-neutral-950 flex flex-col justify-between p-4 animate-in fade-in scale-in duration-200">
          
          {/* Progress timer bar */}
          <div className="w-full flex gap-1 mt-4 px-1 z-10 shrink-0">
            <div className="h-1 bg-[#00a884] rounded-full flex-1 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-white/45 w-full animate-out slide-out-to-right-full duration-[5000ms] ease-linear" />
            </div>
          </div>

          {/* Story header info */}
          <div className="z-10 flex items-center justify-between text-white mt-3 px-1">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full p-[2px] border-2 border-[#00a884] flex items-center justify-center text-lg bg-neutral-800">
                {activeStatusStory.avatar}
              </div>
              <div className="text-left">
                <span className="text-sm font-bold block leading-tight">{activeStatusStory.name}</span>
                <span className="text-[11px] text-white/70 block">{activeStatusStory.time}</span>
              </div>
            </div>
            <button 
              onClick={() => setActiveStatusStory(null)}
              className="p-1.5 hover:bg-white/10 rounded-full text-white cursor-pointer transition-colors"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Background/Center beautiful status presentation card */}
          <div className="absolute inset-0 z-0 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-neutral-900/60 backdrop-blur-md relative">
              <img 
                src={activeStatusStory.image} 
                alt="Status content" 
                className="w-full h-80 object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="p-5 text-center text-white bg-neutral-900 border-t border-white/5">
                <p className="text-[14px] leading-relaxed text-slate-200 font-medium font-sans">
                  "This is how we build engaging experiences! ProdixAI is transforming everything."
                </p>
              </div>
            </div>
          </div>

          {/* Reply mockup block */}
          <div className="z-10 pb-6 text-center text-white/55 text-xs select-none">
            Tap anywhere to close
          </div>
        </div>
      )}

      {/* Clear All Dialog */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-wa-panel rounded-xl max-w-sm w-full border border-wa-divider p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-wa-text font-bold text-lg mb-2">Delete All Chats</h3>
            <p className="text-wa-text-muted text-[14px] mb-6 leading-normal text-left">
              Are you sure you want to delete all chats? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 text-sm">
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className="px-4 py-2 border border-wa-divider rounded-lg text-wa-text hover:bg-white/5 active:scale-[0.98] transition-all cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteAllChats();
                  setShowClearAllConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg active:scale-[0.98] transition-all cursor-pointer font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
