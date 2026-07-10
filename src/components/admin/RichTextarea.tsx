import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

const BULLET_RE = /^(\s*)([-*•])\s(.*)$/;
const NUM_RE = /^(\s*)(\d+)\.\s(.*)$/;

/**
 * Textarea com suporte a:
 * - Tab / Shift+Tab para indentação (2 espaços)
 * - Enter continua bullets (-, *, •) e listas numeradas (1.)
 * - Enter em bullet vazio remove o marcador
 *
 * IMPORTANTE: API controlada — onChange recebe a STRING nova (não o evento).
 */
export const RichTextarea = React.forwardRef<HTMLTextAreaElement, Props>(
  ({ className, value, onChange, onKeyDown, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setRefs = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    };

    const applyChange = (newVal: string, caret: number) => {
      onChange(newVal);
      // restaura o caret após o React re-renderizar
      requestAnimationFrame(() => {
        const el = innerRef.current;
        if (el) el.setSelectionRange(caret, caret);
      });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;

      const ta = e.currentTarget;
      const { selectionStart, selectionEnd } = ta;
      const val = value;

      // Tab / Shift+Tab
      if (e.key === "Tab") {
        e.preventDefault();
        const lineStart = val.lastIndexOf("\n", selectionStart - 1) + 1;
        if (e.shiftKey) {
          const lineHead = val.slice(lineStart, lineStart + 2);
          const remove = lineHead.startsWith("  ") ? 2 : lineHead.startsWith(" ") ? 1 : 0;
          if (remove === 0) return;
          const newVal = val.slice(0, lineStart) + val.slice(lineStart + remove);
          applyChange(newVal, Math.max(lineStart, selectionStart - remove));
        } else {
          const newVal = val.slice(0, selectionStart) + "  " + val.slice(selectionEnd);
          applyChange(newVal, selectionStart + 2);
        }
        return;
      }

      // Enter: continua bullet
      if (e.key === "Enter" && !e.shiftKey) {
        const lineStart = val.lastIndexOf("\n", selectionStart - 1) + 1;
        const currentLine = val.slice(lineStart, selectionStart);

        const bm = currentLine.match(BULLET_RE);
        const nm = currentLine.match(NUM_RE);

        if (bm) {
          const [, indent, marker, content] = bm;
          if (content.trim() === "") {
            e.preventDefault();
            const newVal = val.slice(0, lineStart) + val.slice(selectionStart);
            applyChange(newVal, lineStart);
            return;
          }
          e.preventDefault();
          const insert = `\n${indent}${marker} `;
          const newVal = val.slice(0, selectionStart) + insert + val.slice(selectionEnd);
          applyChange(newVal, selectionStart + insert.length);
          return;
        }

        if (nm) {
          const [, indent, num, content] = nm;
          if (content.trim() === "") {
            e.preventDefault();
            const newVal = val.slice(0, lineStart) + val.slice(selectionStart);
            applyChange(newVal, lineStart);
            return;
          }
          e.preventDefault();
          const next = parseInt(num, 10) + 1;
          const insert = `\n${indent}${next}. `;
          const newVal = val.slice(0, selectionStart) + insert + val.slice(selectionEnd);
          applyChange(newVal, selectionStart + insert.length);
          return;
        }
      }
    };

    return (
      <Textarea
        ref={setRefs}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn("font-mono text-sm leading-relaxed", className)}
        {...props}
      />
    );
  },
);
RichTextarea.displayName = "RichTextarea";
