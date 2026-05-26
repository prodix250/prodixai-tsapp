import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      // remove the Data-URL declaration (e.g., "data:image/png;base64,")
      const base64 = base64String.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};
