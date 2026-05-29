import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import "katex/dist/katex.min.css";
import { WatermarkedImage } from "./WatermarkedImage";

interface MarkdownRendererProps {
  content: string;
}

const renderers = {
  code({ node, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const isInline = !match && !className?.includes("language-");
    
    if (isInline) {
      return (
        <code className="bg-wa-message-sent/20 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5 text-sm font-mono" {...props}>
          {children}
        </code>
      );
    }

    return <CodeBlock language={match ? match[1] : "text"} value={String(children).replace(/\n$/, "")} />;
  },
  img({ node, src, alt, ...props }: any) {
    if (src && (src.includes("image.pollinations.ai") || src.includes("pollinations.ai"))) {
      return <WatermarkedImage url={src} />;
    }
    return <img src={src} alt={alt} referrerPolicy="no-referrer" className="max-w-full h-auto rounded-md" {...props} />;
  },
  table({ node, ...props }: any) {
    return (
      <div className="w-full overflow-x-auto my-3 rounded-lg border border-wa-divider/30">
        <table className="w-full border-collapse text-sm text-left" {...props} />
      </div>
    );
  },
  thead({ node, ...props }: any) {
    return <thead className="bg-wa-message-received/50 text-wa-text-primary font-semibold" {...props} />;
  },
  tbody({ node, ...props }: any) {
    return <tbody className="divide-y divide-wa-divider/30" {...props} />;
  },
  tr({ node, ...props }: any) {
    return <tr className="even:bg-black/5 dark:even:bg-white/5 transition-colors" {...props} />;
  },
  th({ node, ...props }: any) {
    return <th className="px-4 py-2 border-b border-wa-divider/30" {...props} />;
  },
  td({ node, ...props }: any) {
    return <td className="px-4 py-2" {...props} />;
  },
  p({ node, children, ...props }: any) {
    // Fix for elements being wrapped in p tags that shouldn't be inline
    // If the p tag only contains an image, we don't need a margin bottom usually, 
    // but for simplicity, we just add standard margins
    return <div className="mb-2 last:mb-0" {...props}>{children}</div>;
  },
  h1({ node, ...props }: any) { return <h1 className="text-xl font-bold mt-4 mb-2" {...props} /> },
  h2({ node, ...props }: any) { return <h2 className="text-lg font-bold mt-4 mb-2" {...props} /> },
  h3({ node, ...props }: any) { return <h3 className="text-md font-bold mt-3 mb-2" {...props} /> },
  ul({ node, ...props }: any) { return <ul className="list-disc pl-5 mb-2 space-y-1" {...props} /> },
  ol({ node, ...props }: any) { return <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} /> },
  li({ node, ...props }: any) { return <li className="pl-1" {...props} /> },
  a({ node, ...props }: any) { return <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} /> },
  blockquote({ node, ...props }: any) { return <blockquote className="border-l-4 border-wa-divider pl-3 italic text-wa-text-muted my-2" {...props} /> },
};

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-body w-full overflow-hidden text-wa-text-primary text-[15px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={renderers}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

const customCodeTheme: { [key: string]: React.CSSProperties } = {
  ...vscDarkPlus,
  'comment': { color: '#9d9d9d', fontWeight: 'bold', fontStyle: 'italic' },
  'punctuation': { color: '#9d9d9d', fontWeight: 'bold' },
  'operator': { color: '#9d9d9d', fontWeight: 'bold' },
  'keyword': { color: '#569cd6', fontWeight: 'bold' },
  'function': { color: '#569cd6', fontWeight: 'bold' },
  'class-name': { color: '#569cd6', fontWeight: 'bold' },
  'string': { color: '#ce9178', fontWeight: 'bold' },
  'number': { color: '#ce9178', fontWeight: 'bold' },
  'boolean': { color: '#ce9178', fontWeight: 'bold' },
  'property': { color: '#ce9178', fontWeight: 'bold' },
  'attr-name': { color: '#ce9178', fontWeight: 'bold' },
  'selector': { color: '#ce9178', fontWeight: 'bold' },
  'constant': { color: '#ce9178', fontWeight: 'bold' },
  'symbol': { color: '#ce9178', fontWeight: 'bold' },
  'variable': { color: '#ce9178', fontWeight: 'bold' },
};

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md overflow-hidden my-3 border border-gray-700/50 bg-[#1e1e1e] shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-b border-gray-700/50 select-none">
        <span className="text-xs text-gray-400 font-mono lowercase">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="p-0 text-sm overflow-x-auto custom-scrollbar">
        <SyntaxHighlighter
          language={language}
          style={customCodeTheme}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontFamily: "JetBrains Mono, Fira Code, monospace",
          }}
          codeTagProps={{
            style: { fontFamily: "JetBrains Mono, Fira Code, monospace" }
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
