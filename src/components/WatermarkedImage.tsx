import React, { useState, useEffect, useMemo, useRef } from "react";
import { Download, Loader2, RotateCcw, AlertCircle } from "lucide-react";
import { downloadFile } from "../lib/capacitorDownload";

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
    
    if (promptStart === -1) {
      const lastSlashText = url.lastIndexOf("/");
      if (lastSlashText !== -1 && lastSlashText < url.length - 1) {
        promptStart = lastSlashText + 1;
      } else {
        return url;
      }
    }
    
    const questionMarkIndex = url.indexOf("?", promptStart);
    let promptStr = "";
    if (questionMarkIndex !== -1) {
      promptStr = url.substring(promptStart, questionMarkIndex);
    } else {
      promptStr = url.substring(promptStart);
    }
    
    return decodeURIComponent(promptStr).trim();
  } catch (e) {
    console.error("Error getting prompt from URL", e);
    return url;
  }
}

function sanitizePrompt(prompt: string): string {
  if (!prompt) return "Professional Image";
  return prompt
    .trim()
    // Remove characters that specifically break URL parsing or Pollinations query format,
    // like ?, #, &, =, %, /, \, +, *, ^, @, etc.
    .replace(/[?#&=\\\/%+*^@|<>:;`"]/g, "")
    // replace multiple spaces with a single space
    .replace(/\s+/g, " ");
}

export function WatermarkedImage({ url }: { url: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [isDownloading, setIsDownloading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  // Generate a stable random base seed once per component instance
  const randomSeed = useMemo(() => Math.floor(Math.random() * 1000000), []);

  // Generate a stable URL using sanitization and correct pollination format
  const cleanUrl = useMemo(() => {
    if (!url || (!url.includes("image.pollinations.ai") && !url.includes("pollinations.ai"))) return url;
    const rawPrompt = getPromptFromUrl(url);
    const cleanPrompt = sanitizePrompt(rawPrompt);
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    
    const seed = randomSeed + retryCount;
    return `https://image.pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`;
  }, [url, retryCount, randomSeed]);

  useEffect(() => {
    setStatus("loading");
  }, [cleanUrl]);

  const handleRetry = () => {
    setStatus("loading");
    setRetryCount((prev) => prev + 1); // increment retry key to force a seed shift and clear cache
  };

  // Handle high quality watermark render on download via canvas dynamically
  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.src = cleanUrl;

      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          const width = img.naturalWidth || img.width || 1024;
          const height = img.naturalHeight || img.height || 1024;
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

  const triggerFallbackDownload = () => {
    downloadFile(cleanUrl, `ProdixAI-${Date.now()}.jpg`);
  };

  if (status === "error") {
    return (
      <div className="w-full py-5 px-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-sans flex flex-col items-center justify-center rounded-lg mt-2 gap-3 text-center">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Ifoto yanze kuza kubera interineti cyangwa ko urubuga ruhuze.</span>
        </div>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Gerageza na none</span>
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
          <span className="text-sm text-wa-text-muted animate-pulse font-sans">Ndirimo gutunganya ifoto yawe, akanya gato...</span>
        </div>
      )}
      
      <img 
        ref={imgRef}
        src={cleanUrl} 
        alt="Generated UI" 
        referrerPolicy="no-referrer"
        onLoad={() => {
          setStatus("success");
        }}
        onError={() => {
          if (retryCount < 3) {
            console.warn(`Pollinations image loading failed in image tag. Retrying #${retryCount + 1}...`);
            setRetryCount((prev) => prev + 1);
          } else {
            setStatus("error");
          }
        }}
        className={`w-full h-auto max-h-[350px] sm:max-h-[450px] object-cover rounded-lg transition-opacity duration-300 ${status === "loading" ? "opacity-0 absolute w-0 h-0" : "opacity-100 relative"}`}
      />

      {status === "success" && (
        <>
          {/* Watermark Applied via CSS Overlay on UI - immediately visible */}
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
