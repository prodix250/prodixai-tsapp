import { Filesystem, Directory } from "@capacitor/filesystem";
import { Toast } from "@capacitor/toast";
import { Capacitor } from "@capacitor/core";

// Helper to convert a Blob to base64 (with option to strip the data-url prefix)
function blobToBase64(blob: Blob, stripPrefix = true): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const result = reader.result as string;
        if (stripPrefix) {
          const commaIndex = result.indexOf(",");
          if (commaIndex !== -1) {
            resolve(result.substring(commaIndex + 1));
          } else {
            resolve(result);
          }
        } else {
          resolve(result);
        }
      } catch (err) {
        reject(err);
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
      console.log(`[CapacitorDownload] Initiating native download for: ${fileName}`);
      let base64Data = "";

      // Convert or fetch binary data to Base64
      if (urlOrBlob instanceof Blob) {
        base64Data = await blobToBase64(urlOrBlob, true);
      } else if (typeof urlOrBlob === "string" && urlOrBlob.startsWith("data:")) {
        const commaIndex = urlOrBlob.indexOf(",");
        if (commaIndex !== -1) {
          base64Data = urlOrBlob.substring(commaIndex + 1);
        } else {
          base64Data = urlOrBlob;
        }
      } else if (typeof urlOrBlob === "string") {
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

      // Request permissions
      try {
        console.log("[CapacitorDownload] Requesting write permissions");
        const permStatus = await Filesystem.requestPermissions();
        if (permStatus.publicStorage !== "granted") {
          console.warn("[CapacitorDownload] Storage write permissions not granted");
        }
      } catch (permErr: any) {
        console.warn("[CapacitorDownload] Failed to request permissions:", permErr);
      }

      // Save to Directory.Documents
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      console.log(`[CapacitorDownload] File successfully saved to local URI: ${writeResult.uri}`);

      // Show native success toast (NEVER alert)
      await Toast.show({
        text: `Saved: ${fileName} in Documents`,
        duration: "long",
      });

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
  } catch (error: any) {
    const errorMsg = error?.message || String(error) || "Unknown error occurred";
    console.error("[CapacitorDownload] Error performing file save:", error);

    // Show native error toast (NEVER alert)
    try {
      await Toast.show({
        text: `Download Failed: ${errorMsg}`,
        duration: "long",
      });
    } catch (toastErr) {
      console.error("[CapacitorDownload] Toast display failed:", toastErr);
    }
    
    // Web emergency fallback if on android browser but capacitor native failed
    try {
      if (typeof urlOrBlob === "string" && !urlOrBlob.startsWith("data:")) {
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
