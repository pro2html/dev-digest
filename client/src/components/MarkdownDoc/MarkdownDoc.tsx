"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./markdown-doc.css";

/** GitHub-like markdown for a full document preview (not compact finding/skill cards). */
export function MarkdownDoc({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <div className="dd-md-doc">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
