"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Expand, PenTool, ArrowRight, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getSelectionRect } from "@/lib/textarea-utils";

interface SelectionMenuProps {
  onRewrite: (text: string, prompt?: string) => void;
  onExpand: (text: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export function SelectionMenu({ onRewrite, onExpand, textareaRef }: SelectionMenuProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      // 1. Check if we have a textarea ref
      if (!textareaRef?.current) return;

      const textarea = textareaRef.current;
      const { selectionStart, selectionEnd } = textarea;

      // 2. Check if there is a selection
      if (selectionStart === selectionEnd) {
        setPosition(null);
        setSelectedText("");
        setShowCustomInput(false);
        return;
      }

      // 3. Get selected text
      const text = textarea.value.substring(selectionStart, selectionEnd);
      if (!text.trim()) {
         setPosition(null);
         return;
      }
      setSelectedText(text);

      // 4. Calculate position relative to viewport
      try {
        // We'll use a hidden div mirror technique to find coordinates
        // For now, let's use a simpler heuristic if the utility is complex to integrate perfectly,
        // but since we wrote the utility, let's try to use it.
        const rect = getSelectionRect(textarea);
        
        if (rect) {
            setPosition({
                top: rect.top - 50, // 50px offset to float above
                left: rect.left, 
            });
        }
      } catch (e) {
        console.error("Failed to calculate selection position", e);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    // Also listen to specific events on the textarea if possible, but selectionchange is usually enough
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [textareaRef]);

  if (!position) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPrompt.trim()) {
      onRewrite(selectedText, customPrompt);
      setShowCustomInput(false);
      setCustomPrompt("");
      // Clear selection logic might differ for textarea, simple blur might work or setting selection range
      if (textareaRef?.current) {
         textareaRef.current.setSelectionRange(textareaRef.current.selectionEnd, textareaRef.current.selectionEnd);
         textareaRef.current.focus();
      }
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 transform -translate-x-1/2 flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-border rounded-lg shadow-xl animate-in fade-in zoom-in duration-200"
      style={{ top: position.top, left: position.left }}
    >
      {showCustomInput ? (
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1 p-1">
          <Input
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="输入改写指令..."
            className="h-7 w-48 text-xs border-none focus-visible:ring-0 px-2 bg-transparent"
            autoFocus
          />
          <Button type="submit" size="icon" variant="ghost" className="h-6 w-6">
            <ArrowRight className="w-3 h-3" />
          </Button>
          <Button 
            type="button" 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6 text-muted-foreground"
            onClick={() => setShowCustomInput(false)}
          >
            <MoreHorizontal className="w-3 h-3" />
          </Button>
        </form>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onRewrite(selectedText, "润色这段文字，使其更加生动流畅");
              if (textareaRef?.current) {
                 textareaRef.current.setSelectionRange(textareaRef.current.selectionEnd, textareaRef.current.selectionEnd);
                 textareaRef.current.focus();
              }
            }}
            className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
          >
            <PenTool className="w-3.5 h-3.5" />
            润色
          </Button>
          <div className="w-px h-4 bg-border/50" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onExpand(selectedText);
              if (textareaRef?.current) {
                 textareaRef.current.setSelectionRange(textareaRef.current.selectionEnd, textareaRef.current.selectionEnd);
                 textareaRef.current.focus();
              }
            }}
            className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
          >
            <Expand className="w-3.5 h-3.5" />
            扩写
          </Button>
          <div className="w-px h-4 bg-border/50" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCustomInput(true)}
            className="h-7 px-2 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI 改写
          </Button>
        </>
      )}
    </div>
  );
}
