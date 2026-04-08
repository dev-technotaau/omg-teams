"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";

// TextStyle doesn't include a fontSize attribute by default, and
// @tiptap/extension-font-size isn't installed — extend the mark to add one.
const TextStyleWithFontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.fontSize || null,
        renderHTML: (attributes) => {
          if (!(attributes as { fontSize?: string }).fontSize) return {};
          return { style: `font-size: ${(attributes as { fontSize: string }).fontSize}` };
        },
      },
    };
  },
});
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import FontFamily from "@tiptap/extension-font-family";
import { useCallback, useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Link as LinkIcon,
  Table as TableIcon,
  Undo,
  Redo,
  RemoveFormatting,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui";

// ──────────────────────────────────────────────
//  §29.4.1.3 — Tiptap Rich Text Editor
//  Full-featured HTML editor for offer letter body content
// ──────────────────────────────────────────────

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  charLimit?: number;
  lineLimit?: number;
  placeholder?: string;
  className?: string;
  /** Dynamic field placeholders available for insertion */
  dynamicFields?: string[];
}

const FONT_SIZES = ["8", "10", "12", "14", "16", "18", "20", "24", "28", "36"];
const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Helvetica",
  "Georgia",
  "Courier New",
  "Verdana",
];

export function TiptapEditor({
  content,
  onChange,
  charLimit = 5000,
  lineLimit: _lineLimit = 80,
  placeholder = "Start typing...",
  className,
  dynamicFields,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        strike: false,
        blockquote: false,
        codeBlock: false,
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyleWithFontSize,
      Color,
      FontFamily,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      HorizontalRule,
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: charLimit }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "tiptap-editor prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3 [&_h1]:text-[1.75em] [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-[1.4em] [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-[1.15em] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1",
      },
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  const insertPlaceholder = useCallback(
    (field: string) => {
      editor?.chain().focus().insertContent(`{{${field}}}`).run();
    },
    [editor],
  );

  const [isFullScreen, setIsFullScreen] = useState(false);

  if (!editor) return null;

  const chars = editor.storage.characterCount?.characters() ?? 0;
  const words = editor.storage.characterCount?.words() ?? 0;
  const charPct = Math.round((chars / charLimit) * 100);
  const isWarning = charPct >= 90;
  const isLimit = charPct >= 100;

  return (
    <div
      className={cn(
        "border-border-default overflow-hidden rounded-lg border",
        isFullScreen && "bg-bg-page fixed inset-0 z-50 flex flex-col overflow-auto",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="bg-bg-muted border-border-default flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5">
        {/* Text formatting */}
        <ToolbarGroup>
          <ToolbarBtn
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <UnderlineIcon size={14} />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        {/* Alignment */}
        <ToolbarGroup>
          <ToolbarBtn
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="Align Left"
          >
            <AlignLeft size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="Align Center"
          >
            <AlignCenter size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            title="Align Right"
          >
            <AlignRight size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive({ textAlign: "justify" })}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            title="Justify"
          >
            <AlignJustify size={14} />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        {/* Headings */}
        <ToolbarGroup>
          <ToolbarBtn
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            <Heading1 size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            <Heading2 size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            <Heading3 size={14} />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        {/* Lists + Block elements */}
        <ToolbarGroup>
          <ToolbarBtn
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            <List size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
          >
            <ListOrdered size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal Rule"
          >
            <Minus size={14} />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        {/* Insert */}
        <ToolbarGroup>
          <ToolbarBtn
            active={editor.isActive("link")}
            onClick={() => {
              const url = prompt("Enter URL:");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            title="Insert Link"
          >
            <LinkIcon size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            title="Insert Table"
          >
            <TableIcon size={14} />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarSep />

        {/* Font size + family */}
        <Select
          size="sm"
          resetOnSelect
          placeholder="Font"
          options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))}
          onChange={(e) => {
            if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run();
          }}
          className="w-28"
        />

        <Select
          size="sm"
          resetOnSelect
          placeholder="Size"
          options={FONT_SIZES.map((s) => ({ value: String(s), label: `${s}pt` }))}
          onChange={(e) => {
            if (e.target.value) {
              editor
                .chain()
                .focus()
                .setMark("textStyle", { fontSize: `${e.target.value}pt` })
                .run();
            }
          }}
          className="w-20"
        />

        {/* Color pickers */}
        <input
          type="color"
          className="h-6 w-6 cursor-pointer rounded border-0"
          title="Text Color"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
        <ToolbarSep />

        {/* Undo/Redo + Clear */}
        <ToolbarGroup>
          <ToolbarBtn
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            title="Clear Formatting"
          >
            <RemoveFormatting size={14} />
          </ToolbarBtn>
        </ToolbarGroup>

        {/* §29.4.1.3 — Placeholder insertion dropdown */}
        {dynamicFields && dynamicFields.length > 0 && (
          <>
            <ToolbarSep />
            <Select
              size="sm"
              resetOnSelect
              placeholder="Insert Field…"
              options={dynamicFields.map((f) => ({ value: f, label: `{{${f}}}` }))}
              onChange={(e) => {
                if (e.target.value) insertPlaceholder(e.target.value);
              }}
              className="w-36"
            />
          </>
        )}

        <ToolbarSep />

        {/* §29.4.1.3 — Additional features: special chars, page break, full-screen, source view */}
        <ToolbarGroup>
          {/* Special characters */}
          <Select
            size="sm"
            resetOnSelect
            placeholder="Sym"
            options={[
              "©",
              "™",
              "®",
              "§",
              "¶",
              "€",
              "₹",
              "£",
              "¥",
              "°",
              "±",
              "×",
              "÷",
              "→",
              "←",
              "↑",
              "↓",
              "•",
              "…",
              "—",
            ].map((c) => ({ value: c, label: c }))}
            onChange={(e) => {
              if (e.target.value) {
                editor.chain().focus().insertContent(e.target.value).run();
              }
            }}
            className="w-20"
          />

        </ToolbarGroup>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} className="bg-bg-surface min-h-[250px]" />

      {/* §29.4.1.3 — Character/line limit counter */}
      <div
        className={cn(
          "border-border-default flex items-center justify-between border-t px-3 py-1.5 text-xs",
          isLimit
            ? "bg-error-50 text-error-600"
            : isWarning
              ? "bg-warning-50 text-warning-600"
              : "text-text-muted",
        )}
      >
        <span>
          {chars.toLocaleString()} / {charLimit.toLocaleString()} characters | {words} words
        </span>
        <div className="flex items-center gap-1">
          {isLimit && <span className="font-medium">Character limit reached</span>}
          {isWarning && !isLimit && <span className="font-medium">Approaching limit</span>}
          {/* Full-screen toggle */}
          <button
            type="button"
            onClick={() => setIsFullScreen((v) => !v)}
            className="text-text-muted hover:text-text-primary rounded p-1"
            title={isFullScreen ? "Exit full screen" : "Full screen"}
          >
            {isFullScreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

    </div>
  );
}

// ── Toolbar helpers ──

function ToolbarBtn({
  children,
  active,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded p-1.5 transition-colors",
        active ? "bg-primary-100 text-primary-700" : "text-text-secondary hover:bg-bg-hover",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarSep() {
  return <div className="bg-border-default mx-1 h-5 w-px" />;
}
