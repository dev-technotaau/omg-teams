"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import FontFamily from "@tiptap/extension-font-family";
import { useCallback, useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Undo,
  Redo,
  RemoveFormatting,
  Code,
  Subscript as SubIcon,
  Superscript as SupIcon,
  Braces,
  Maximize2,
  Minimize2,
  FileCode,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Subscript,
      Superscript,
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
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
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
  const [showSource, setShowSource] = useState(false);

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
          <ToolbarBtn
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <Strikethrough size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive("subscript")}
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            title="Subscript"
          >
            <SubIcon size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive("superscript")}
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            title="Superscript"
          >
            <SupIcon size={14} />
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
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
          >
            <Quote size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code Block"
          >
            <Code size={14} />
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
            onClick={() => {
              const url = prompt("Enter image URL:");
              if (url) editor.chain().focus().setImage({ src: url }).run();
            }}
            title="Insert Image"
          >
            <ImageIcon size={14} />
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
        <select
          className="border-border-default rounded border px-1.5 py-0.5 text-xs"
          onChange={(e) => {
            if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run();
          }}
          defaultValue=""
        >
          <option value="">Font</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <select
          className="border-border-default rounded border px-1.5 py-0.5 text-xs"
          onChange={(e) => {
            if (e.target.value) {
              editor
                .chain()
                .focus()
                .setMark("textStyle", { fontSize: `${e.target.value}pt` })
                .run();
            }
          }}
          defaultValue=""
        >
          <option value="">Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}pt
            </option>
          ))}
        </select>

        {/* Color pickers */}
        <input
          type="color"
          className="h-6 w-6 cursor-pointer rounded border-0"
          title="Text Color"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
        <input
          type="color"
          className="h-6 w-6 cursor-pointer rounded border-0"
          title="Highlight"
          defaultValue="#ffff00"
          onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
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
            <select
              className="border-border-default rounded border px-1.5 py-0.5 text-xs"
              onChange={(e) => {
                if (e.target.value) {
                  insertPlaceholder(e.target.value);
                  e.target.value = "";
                }
              }}
              defaultValue=""
            >
              <option value="">
                <Braces size={12} /> Insert Field...
              </option>
              {dynamicFields.map((f) => (
                <option key={f} value={f}>
                  {`{{${f}}}`}
                </option>
              ))}
            </select>
          </>
        )}

        <ToolbarSep />

        {/* §29.4.1.3 — Additional features: special chars, page break, full-screen, source view */}
        <ToolbarGroup>
          {/* Special characters */}
          <select
            className="border-border-default rounded border px-1 py-0.5 text-xs"
            onChange={(e) => {
              if (e.target.value) {
                editor.chain().focus().insertContent(e.target.value).run();
                e.target.value = "";
              }
            }}
            defaultValue=""
          >
            <option value="">Sym</option>
            {[
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
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Line spacing */}
          <select
            className="border-border-default rounded border px-1 py-0.5 text-xs"
            onChange={(e) => {
              if (e.target.value) {
                editor.chain().focus().setMark("textStyle", { lineHeight: e.target.value }).run();
              }
            }}
            defaultValue=""
          >
            <option value="">Spacing</option>
            {["1", "1.15", "1.5", "2"].map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>

          {/* Page break */}
          <ToolbarBtn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Page Break / Divider"
          >
            <span className="text-[10px] font-bold">PB</span>
          </ToolbarBtn>
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
          {/* Find — trigger browser native find (Ctrl+F) */}
          <button
            type="button"
            onClick={() => {
              // Trigger browser's native find dialog via keyboard shortcut simulation
              document.execCommand("find");
            }}
            className="text-text-muted hover:text-text-primary rounded p-1"
            title="Find (Ctrl+F)"
          >
            <Search size={12} />
          </button>
          {/* Source code view toggle */}
          <button
            type="button"
            onClick={() => setShowSource((v) => !v)}
            className={cn(
              "rounded p-1",
              showSource ? "text-primary-600" : "text-text-muted hover:text-text-primary",
            )}
            title="Toggle HTML source"
          >
            <FileCode size={12} />
          </button>
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

      {/* §29.4.1.3 — Source code view (raw HTML) */}
      {showSource && (
        <div className="border-border-default border-t">
          <textarea
            value={editor.getHTML()}
            onChange={(e) => editor.commands.setContent(e.target.value)}
            className="bg-bg-muted w-full p-3 font-mono text-xs"
            rows={8}
          />
        </div>
      )}
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
