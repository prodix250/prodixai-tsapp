import React, { useEffect, useState } from "react";

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
}

export function AttachmentMenu({ isOpen, onClose, onFileSelect }: AttachmentMenuProps) {
  const [shouldRender, setRender] = useState(isOpen);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setRender(true);
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setRender(false);
  };

  if (!shouldRender) return null;

  return (
    <>
      <div 
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0"}`} 
        onClick={onClose} 
      />
      
      <div 
        className={`absolute bottom-full mb-[10px] left-2 right-2 sm:left-12 sm:w-[320px] bg-[#1f2c34] rounded-[20px] z-50 py-8 px-6 shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-300 ease-out transform origin-bottom-left ${isOpen ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"}`}
        onTransitionEnd={handleAnimationEnd}
      >
        <div className="flex flex-row justify-around items-center px-1">
          {/* Camera Button */}
          <label 
            htmlFor="cameraInput"
            className="flex flex-col items-center gap-3 group outline-none cursor-pointer"
          >
            <div className="w-[50px] h-[50px] rounded-full bg-[#f05b5b] flex justify-center items-center transform group-active:scale-95 transition-transform">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </div>
            <span className="text-[11px] font-sans text-white text-center">Camera</span>
          </label>

          {/* Gallery Button */}
          <label 
            htmlFor="galleryInput"
            className="flex flex-col items-center gap-3 group outline-none cursor-pointer"
          >
            <div className="w-[50px] h-[50px] rounded-full bg-[#a368ff] flex justify-center items-center transform group-active:scale-95 transition-transform">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
            <span className="text-[11px] font-sans text-white text-center">Gallery</span>
          </label>

          {/* Files Button */}
          <label 
            htmlFor="fileInput"
            className="flex flex-col items-center gap-3 group outline-none cursor-pointer"
          >
            <div className="w-[50px] h-[50px] rounded-full bg-[#1eb08d] flex justify-center items-center transform group-active:scale-95 transition-transform">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <span className="text-[11px] font-sans text-white text-center">Files</span>
          </label>
        </div>
      </div>

      {/* Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 text-center max-w-[90%]">
          {toastMessage}
        </div>
      )}
    </>
  );
}
