import React, { useState, useEffect, useMemo, useRef } from "react";
import { Download, Loader2, RotateCcw, AlertCircle } from "lucide-react";
import { downloadFile } from "../lib/capacitorDownload";

function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch (e) {
    try {
      // Decode with unencoded % symbols handled safely
      return decodeURIComponent(str.replace(/%(?![0-9a-fA-F]{2})/g, "%25"));
    } catch (e2) {
      return str.replace(/%/g, " percent");
    }
  }
}

function getPromptFromUrl(url: string): string {
  if (!url) return "";
  try {
    url = url.trim();
    let promptStart = -1;
    if (url.includes("/prompt/")) {
      promptStart = url.indexOf("/prompt/") + "/prompt/".length;
    } else if (url.includes("/p/")) {
      promptStart = url.indexOf("/p/") + "/p/".length;
    }
    
    let extracted = "";
    if (promptStart !== -1) {
      const questionMarkIndex = url.indexOf("?", promptStart);
      if (questionMarkIndex !== -1) {
        extracted = url.substring(promptStart, questionMarkIndex);
      } else {
        extracted = url.substring(promptStart);
      }
    } else {
      const lastSlashText = url.lastIndexOf("/");
      if (lastSlashText !== -1 && lastSlashText > 8) { // past https://
        const questionMarkIndex = url.indexOf("?", lastSlashText);
        if (questionMarkIndex !== -1) {
          extracted = url.substring(lastSlashText + 1, questionMarkIndex);
        } else {
          extracted = url.substring(lastSlashText + 1);
        }
      }
    }
    
    if (!extracted) {
      return "Professional Image";
    }
    
    let decoded = safeDecodeURIComponent(extracted).trim();
    // Strip surrounding and nested bracket symbols that are often output by AI models literal schema imitation
    decoded = decoded.replace(/[\[\]]/g, "").trim();
    return decoded || "Professional Image";
  } catch (e) {
    console.error("Error getting prompt from URL", e);
    return "Professional Image";
  }
}

function sanitizePrompt(prompt: string): string {
  if (!prompt) return "Professional Image";
  
  // Safely remove any bracket markers like [ or ]
  let cleaned = prompt
    .trim()
    .replace(/[\[\]]/g, "")
    .replace(/[?#&=\\\/%+*^@|<>:;`"]/g, " ")
    .replace(/\s+/g, " ");
  
  // Truncate prompt length safely (max 180 chars) to prevent 414 Request-URI Too Large / CDN issues
  if (cleaned.length > 180) {
    const truncated = cleaned.substring(0, 180);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 40) {
      cleaned = truncated.substring(0, lastSpace).trim();
    } else {
      cleaned = truncated.trim();
    }
  }
  return cleaned.trim() || "Professional Image";
}

function getProxyUrl(url: string): string {
  if (!url) return "";
  if (!url.includes("pollinations.ai") && !url.includes("image.pollinations.ai")) {
    return url;
  }
  
  let baseApi = "/api/proxy-image";
  if (typeof window !== "undefined" && window.location) {
    const { protocol } = window.location;
    const isWebProtocol = protocol.startsWith("http");
    
    if (!isWebProtocol) {
      // Fallback for Android APK webviews running on file:// or custom local schemas
      baseApi = "https://prodixai-tsapp.onrender.com/api/proxy-image";
    } else {
      // Standard browser previews or web deployments route directly to our local proxy
      baseApi = "/api/proxy-image";
    }
  }

  return `${baseApi}?url=${encodeURIComponent(url)}`;
}

// Local storage cache for successfully loaded image URLs to prevent infinite reloading or flashing
function getSavedLoadedStatus(url: string): boolean {
  try {
    return localStorage.getItem(`prodixai-img-loaded-${encodeURIComponent(url)}`) === "true";
  } catch (e) {
    return false;
  }
}

function setSavedLoadedStatus(url: string, isLoaded: boolean) {
  try {
    if (isLoaded) {
      localStorage.setItem(`prodixai-img-loaded-${encodeURIComponent(url)}`, "true");
    } else {
      localStorage.removeItem(`prodixai-img-loaded-${encodeURIComponent(url)}`);
    }
  } catch (e) {}
}

export function WatermarkedImage({ url }: { url: string }) {
  const isPollinations = useMemo(() => url.includes("pollinations.ai") || url.includes("image.pollinations.ai"), [url]);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [autoRetryAttempt, setAutoRetryAttempt] = useState<number>(0);
  const [useProxy, setUseProxy] = useState<boolean>(isPollinations);

  // NOTE: For Android, ensure 'android:usesCleartextTraffic="true"' is set in your AndroidManifest.xml
  // if you are loading images over HTTP or from domains that might be treated as unencrypted.

  // Calculate stable deterministic seed
  const stableSeed = useMemo(() => {
    const rawPrompt = getPromptFromUrl(url);
    const cleanPrompt = sanitizePrompt(rawPrompt);
    
    // Check if the source URL already contains a seed parameter
    try {
      const match = url.match(/[?&]seed=(\d+)/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    } catch (e) {}

    // Fallback: Generate a deterministic hash from the prompt
    let hash = 0;
    for (let i = 0; i < cleanPrompt.length; i++) {
      const char = cleanPrompt.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 1000000;
  }, [url]);

  // Improved URL generation with retry logic
  const activeUrl = useMemo(() => {
    if (!url || (!url.includes("image.pollinations.ai") && !url.includes("pollinations.ai"))) return url;
    
    const rawPrompt = getPromptFromUrl(url);
    const cleanPrompt = sanitizePrompt(rawPrompt) || "Image";
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    
    return `/api/generate-image?prompt=${encodedPrompt}&cb=${autoRetryAttempt}`;
  }, [url, autoRetryAttempt]);

  const [status, setStatus] = useState<"loading" | "success" | "error">(() => {
    return getSavedLoadedStatus(activeUrl) ? "success" : "loading";
  });

  const [isDownloading, setIsDownloading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset counters when URL changes
  useEffect(() => {
    setAutoRetryAttempt(0);
    setRetryCount(0);
    setUseProxy(isPollinations);
    setStatus("loading");
  }, [url, isPollinations]);

  // Update status when activeUrl changes
  useEffect(() => {
    if (getSavedLoadedStatus(activeUrl)) {
      setStatus("success");
    } else {
      setStatus("loading");
    }
  }, [activeUrl]);

  const handleRetry = () => {
    setStatus("loading");
    setSavedLoadedStatus(activeUrl, false); 
    setAutoRetryAttempt(0); 
    setUseProxy(isPollinations);
    setRetryCount((prev) => prev + 1); 
  };

  // ... (rest of the functions remain the same)
  
  const triggerFallbackDownload = () => {
    downloadFile(activeUrl, `ProdixAI-${Date.now()}.jpg`);
  };

  // Handle high quality watermark render on download via canvas dynamically
  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.src = activeUrl;

      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          const width = img.naturalWidth || img.width || 768;
          const height = img.naturalHeight || img.height || 768;
          canvas.width = width;
          canvas.height = height;

          if (ctx) {
            // Draw baseline image
            ctx.drawImage(img, 0, 0, width, height);

            // Watermark text config setup
            const fontSize = Math.max(20, Math.floor(width * 0.04));
            ctx.font = `bold ${fontSize}px sans-serif`;

            // Drop shadow configuration for text legibility
            ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
            ctx.shadowBlur = Math.max(4, Math.floor(width * 0.008));
            ctx.shadowOffsetX = Math.max(2, Math.floor(width * 0.003));
            ctx.shadowOffsetY = Math.max(2, Math.floor(width * 0.003));

            const textProdix = "Prodix";
            const textAI = "AI";

            const prodixWidth = ctx.measureText(textProdix).width;
            const aiWidth = ctx.measureText(textAI).width;
            const totalWidth = prodixWidth + aiWidth;

            const margin = width * 0.04;
            const xStart = width - totalWidth - margin;
            const yPos = height - margin;

            // Draw 'Prodix' in white
            ctx.fillStyle = "#ffffff";
            ctx.fillText(textProdix, xStart, yPos);

            // Draw 'AI' in orange
            ctx.fillStyle = "#f97316";
            ctx.fillText(textAI, xStart + prodixWidth, yPos);

            // Export to PNG & download via platform-safe downloader
            const dataUrl = canvas.toDataURL("image/png");
            await downloadFile(dataUrl, `ProdixAI-${Date.now()}.png`);
          } else {
            throw new Error("Canvas context is null");
          }
        } catch (err) {
          console.error("Canvas flow failed, falling back to direct download link", err);
          triggerFallbackDownload();
        } finally {
          setIsDownloading(false);
        }
      };

      img.onerror = () => {
        console.warn("Image load for canvas failed, running direct url download fallback.");
        triggerFallbackDownload();
        setIsDownloading(false);
      };
    } catch (e) {
      console.error("Watermarked dynamic download failed:", e);
      triggerFallbackDownload();
      setIsDownloading(false);
    }
  };

  if (status === "error") {
    return (
      <div className="w-full py-5 px-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-sans flex flex-col items-center justify-center rounded-lg mt-2 gap-3 text-center">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Failed to load image. (Ifoto yanze kuza.)</span>
        </div>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retry (Gerageza na none)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden mt-1 mb-1 shadow-sm border border-wa-divider/30 group">
      {status === "loading" && (
        <div className="w-full h-64 bg-black/10 dark:bg-white/10 animate-pulse rounded-lg flex flex-col items-center justify-center mt-2">
          <div className="text-wa-text-muted text-2xl font-bold tracking-tighter mb-2 animate-bounce">
            PX<span className="text-orange-500 font-extrabold">AI</span>
          </div>
          <span className="text-sm text-wa-text-muted animate-pulse font-sans">Generating... (Itubanya...)</span>
        </div>
      )}
      
      <img 
        key={autoRetryAttempt}
        ref={imgRef}
        src={activeUrl} 
        alt="Generated UI" 
        referrerPolicy="no-referrer"
        onLoad={() => {
          setStatus("success");
          setSavedLoadedStatus(activeUrl, true);
        }}
        onError={() => {
          if (autoRetryAttempt < 4) {
            console.warn(`Image request failed. Retry attempt #${autoRetryAttempt + 1} ...`);
            setAutoRetryAttempt((prev) => prev + 1);
          } else {
            console.error(`All image pipelines and retries completed with failure.`);
            setStatus("error");
          }
        }}
        className={`w-full h-auto max-h-[350px] sm:max-h-[450px] object-cover rounded-lg transition-opacity duration-300 ${status === "loading" ? "opacity-0 absolute top-0 left-0 w-full h-full pointer-events-none" : "opacity-100 relative"}`}
      />

      {status === "success" && (
        <>
          <div className="absolute bottom-3 right-3 flex items-center gap-0.5 font-sans pointer-events-none select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-black/30 px-2 py-0.5 rounded-md backdrop-blur-xs">
            <span className="text-white text-[15px] sm:text-[18px] font-bold tracking-tight">Prodix</span>
            <span className="text-[#f97316] text-[15px] sm:text-[18px] font-extrabold tracking-tight">AI</span>
          </div>

          <button 
            onClick={handleDownload}
            disabled={isDownloading}
            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors drop-shadow-md flex items-center justify-center"
            title="Download Image"
          >
            {isDownloading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
          </button>
        </>
      )}
    </div>
  );
}
