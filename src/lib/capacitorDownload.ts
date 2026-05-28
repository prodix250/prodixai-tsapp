import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

// Helper to convert a Blob to base64 (with option to strip the data-url prefix)
function blobToBase64(blob: Blob, stripPrefix = true): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (stripPrefix) {
        const base64String = result.substring(result.indexOf(",") + 1);
        resolve(base64String);
      } else {
        resolve(result);
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to convert Blob to Base64."));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads/saves a file across Web (browser) and Android (APK container via Capacitor).
 * 
 * @param urlOrBlob The content to download (a URL string, a Base64 data-url, or a binary Blob).
 * @param fileName The desired file name with extension (e.g. "ProdixAI_Doc.docx" or "Image.png").
 */
export async function downloadFile(urlOrBlob: string | Blob, fileName: string): Promise<boolean> {
  try {
    const isAndroid = Capacitor.isNativePlatform();

    if (isAndroid) {
      console.log(`[CapacitorDownload] Initiating native download/share for: ${fileName}`);
      let base64Data = "";

      if (urlOrBlob instanceof Blob) {
        // Handle direct Blob injection (e.g. DOCX generated client-side)
        base64Data = await blobToBase64(urlOrBlob, true);
      } else if (typeof urlOrBlob === "string" && urlOrBlob.startsWith("data:")) {
        // Handle Base64 Data URLs (e.g. canvases)
        base64Data = urlOrBlob.substring(urlOrBlob.indexOf(",") + 1);
      } else if (typeof urlOrBlob === "string") {
        // Handle remote image or file URL
        console.log(`[CapacitorDownload] Fetching remote file: ${urlOrBlob}`);
        const response = await fetch(urlOrBlob);
        if (!response.ok) {
          throw new Error(`Failed to fetch remote asset: Status ${response.status}`);
        }
        const blob = await response.blob();
        base64Data = await blobToBase64(blob, true);
      } else {
        throw new Error("Invalid input format for downloadFile");
      }

      // 1. Check and request permissions if needed
      try {
        const permStatus = await Filesystem.checkPermissions();
        if (permStatus.publicStorage !== "granted") {
          await Filesystem.requestPermissions();
        }
      } catch (permErr) {
        console.warn("[CapacitorDownload] Failed to check/request permissions:", permErr);
      }

      // 2. Write the base64 content directly to the Directory.Documents folder
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      console.log(`[CapacitorDownload] File successfully saved to local URI in Documents: ${writeResult.uri}`);

      // 3. Inform the user with a simple alert as explicitly requested
      alert("File saved to Documents folder");

      return true;
    } else {
      // BROWSER / WEB FALLBACK
      console.log(`[CapacitorDownload] Running standard Web fallback for: ${fileName}`);

      if (urlOrBlob instanceof Blob) {
        const url = URL.createObjectURL(urlOrBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Clean up memory
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      } else {
        const a = document.createElement("a");
        a.href = urlOrBlob;
        a.download = fileName;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
        }, 100);
      }
      return true;
    }
  } catch (error) {
    console.error("[CapacitorDownload] Error performing file save/share:", error);
    
    // Final emergency fallback if the Capacitor code threw an error but we're on mobile webview
    try {
      if (typeof urlOrBlob === "string") {
        const a = document.createElement("a");
        a.href = urlOrBlob;
        a.download = fileName;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (fallbackError) {
      console.error("[CapacitorDownload] Emergency fallback also failed:", fallbackError);
    }
    
    return false;
  }
}
