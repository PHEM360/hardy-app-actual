import { useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle as TiptapTextStyle } from "@tiptap/extension-text-style";
import { Color as TiptapColor } from "@tiptap/extension-color";
import TiptapUnderline from "@tiptap/extension-underline";

export function hasRichContent(html: string): boolean {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  resetKey?: string | number;
  minHeight?: number;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  resetKey,
  minHeight = 52,
}: RichTextEditorProps) {
  const [toolbarColor, setToolbarColor] = useState("#000000");
  const colorRef = useRef<HTMLInputElement>(null);

  const editor = useEditor(
    {
      extensions: [StarterKit, TiptapTextStyle, TiptapColor, TiptapUnderline],
      content: value || "",
      onUpdate: ({ editor }) => onChange(editor.getHTML()),
      editorProps: {
        attributes: {
          class: `px-2.5 py-2 text-sm outline-none`,
          style: `min-height: ${minHeight}px`,
        },
      },
    },
    [resetKey]
  );

  if (!editor) return null;

  const applyColor = (color: string) => {
    setToolbarColor(color);
    editor.chain().focus().setColor(color).run();
  };

  const btn = (active: boolean) =>
    `px-2 py-0.5 rounded-md text-xs transition-colors ${
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/60"
    }`;

  return (
    <div className="rounded-xl border-2 border-border bg-input overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border/50 bg-muted/20 flex-wrap">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive("bold")) + " font-bold"}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive("italic")) + " italic"}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btn(editor.isActive("underline")) + " underline"}
        >
          U
        </button>
        <div className="w-px h-3.5 bg-border/60 mx-1" />
        <button
          type="button"
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-muted/60 transition-colors"
          onClick={() => colorRef.current?.click()}
        >
          <span className="text-[10px] text-muted-foreground">A</span>
          <div className="w-3.5 h-1.5 rounded-sm border border-border/60" style={{ backgroundColor: toolbarColor }} />
        </button>
        <input
          ref={colorRef}
          type="color"
          value={toolbarColor}
          onChange={(e) => applyColor(e.target.value)}
          className="sr-only"
        />
        <div className="w-px h-3.5 bg-border/60 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          className="px-2 py-0.5 rounded-md text-[10px] text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          Clear
        </button>
      </div>
      <EditorContent editor={editor} />
      {!hasRichContent(editor.getHTML()) && placeholder && (
        <p className="px-2.5 pb-2 text-sm text-muted-foreground/50 pointer-events-none select-none">
          {placeholder}
        </p>
      )}
    </div>
  );
}
