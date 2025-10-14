"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import { Color } from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import CharacterCount from "@tiptap/extension-character-count"
import { FC, useEffect, useState } from "react"
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconAlignJustified,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconDownload,
  IconFileTypePdf,
  IconFileTypeDocx,
  IconCopy,
  IconTrash
} from "@tabler/icons-react"
import { Button } from "../ui/button"
import { toast } from "sonner"
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx"
import { saveAs } from "file-saver"

interface DocumentEditorProps {
  initialContent?: string
  onContentChange?: (content: string) => void
}

export const DocumentEditor: FC<DocumentEditorProps> = ({
  initialContent = "",
  onContentChange
}) => {
  const [isExporting, setIsExporting] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      TextStyle,
      Color,
      CharacterCount
    ],
    content: initialContent || `
      <h1>Documento Legal</h1>
      <p>Comienza a redactar tu documento aquí...</p>
    `,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[500px] max-w-none p-8"
      }
    },
    onUpdate: ({ editor }) => {
      if (onContentChange) {
        onContentChange(editor.getHTML())
      }
    }
  })

  useEffect(() => {
    if (initialContent && editor && !editor.isDestroyed) {
      editor.commands.setContent(initialContent)
    }
  }, [initialContent, editor])

  if (!editor) {
    return null
  }

  const exportToPDF = async () => {
    setIsExporting(true)
    try {
      // Importación dinámica para evitar problemas SSR
      const html2pdf = (await import("html2pdf.js")).default

      const content = editor.getHTML()
      const element = document.createElement("div")
      element.innerHTML = content
      element.style.padding = "40px"
      element.style.fontFamily = "Times New Roman, serif"
      element.style.fontSize = "12pt"
      element.style.lineHeight = "1.5"

      const opt = {
        margin: [20, 15],
        filename: `documento-legal-${new Date().getTime()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "letter", orientation: "portrait" }
      }

      await html2pdf().set(opt).from(element).save()
      toast.success("PDF descargado exitosamente")
    } catch (error) {
      console.error("Error exportando a PDF:", error)
      toast.error("Error al exportar a PDF")
    } finally {
      setIsExporting(false)
    }
  }

  const exportToWord = async () => {
    setIsExporting(true)
    try {
      const content = editor.getJSON()
      const children: any[] = []

      // Función auxiliar para convertir nodos de TipTap a párrafos de docx
      const processParagraph = (node: any): Paragraph => {
        const textRuns: TextRun[] = []
        
        if (node.content) {
          node.content.forEach((child: any) => {
            if (child.type === "text") {
              const textRun = new TextRun({
                text: child.text || "",
                bold: child.marks?.some((m: any) => m.type === "bold"),
                italics: child.marks?.some((m: any) => m.type === "italic"),
                underline: child.marks?.some((m: any) => m.type === "underline") ? {} : undefined
              })
              textRuns.push(textRun)
            }
          })
        }

        if (textRuns.length === 0) {
          textRuns.push(new TextRun({ text: "" }))
        }

        const alignment = node.attrs?.textAlign
        let alignmentType = AlignmentType.LEFT
        
        if (alignment === "center") alignmentType = AlignmentType.CENTER
        else if (alignment === "right") alignmentType = AlignmentType.RIGHT
        else if (alignment === "justify") alignmentType = AlignmentType.JUSTIFIED

        // Determinar el nivel de encabezado
        if (node.type === "heading") {
          const level = node.attrs?.level || 1
          return new Paragraph({
            children: textRuns,
            heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            alignment: alignmentType
          })
        }

        return new Paragraph({
          children: textRuns,
          alignment: alignmentType
        })
      }

      // Procesar el contenido
      if (content.content) {
        content.content.forEach((node: any) => {
          if (node.type === "paragraph" || node.type === "heading") {
            children.push(processParagraph(node))
          } else if (node.type === "bulletList" && node.content) {
            node.content.forEach((listItem: any) => {
              if (listItem.content) {
                listItem.content.forEach((para: any) => {
                  children.push(new Paragraph({
                    children: para.content ? para.content.map((c: any) => 
                      new TextRun({ text: c.text || "" })
                    ) : [new TextRun({ text: "" })],
                    bullet: { level: 0 }
                  }))
                })
              }
            })
          } else if (node.type === "orderedList" && node.content) {
            node.content.forEach((listItem: any, index: number) => {
              if (listItem.content) {
                listItem.content.forEach((para: any) => {
                  children.push(new Paragraph({
                    children: para.content ? para.content.map((c: any) => 
                      new TextRun({ text: c.text || "" })
                    ) : [new TextRun({ text: "" })],
                    numbering: { reference: "default", level: 0 }
                  }))
                })
              }
            })
          }
        })
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: children
          }
        ]
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `documento-legal-${new Date().getTime()}.docx`)
      toast.success("Documento Word descargado exitosamente")
    } catch (error) {
      console.error("Error exportando a Word:", error)
      toast.error("Error al exportar a Word")
    } finally {
      setIsExporting(false)
    }
  }

  const copyToClipboard = () => {
    const text = editor.getText()
    navigator.clipboard.writeText(text)
    toast.success("Texto copiado al portapapeles")
  }

  const clearDocument = () => {
    if (confirm("¿Estás seguro de que deseas limpiar el documento?")) {
      editor.commands.clearContent()
      toast.success("Documento limpiado")
    }
  }

  return (
    <div className="border-input flex flex-col rounded-lg border-2">
      {/* Barra de herramientas */}
      <div className="border-input flex flex-wrap items-center gap-1 border-b-2 p-2">
        {/* Formato de texto */}
        <div className="flex gap-1 border-r pr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "bg-secondary" : ""}
          >
            <IconBold size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "bg-secondary" : ""}
          >
            <IconItalic size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive("underline") ? "bg-secondary" : ""}
          >
            <IconUnderline size={18} />
          </Button>
        </div>

        {/* Encabezados */}
        <div className="flex gap-1 border-r pr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive("heading", { level: 1 }) ? "bg-secondary" : ""}
          >
            <IconH1 size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive("heading", { level: 2 }) ? "bg-secondary" : ""}
          >
            <IconH2 size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive("heading", { level: 3 }) ? "bg-secondary" : ""}
          >
            <IconH3 size={18} />
          </Button>
        </div>

        {/* Alineación */}
        <div className="flex gap-1 border-r pr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={editor.isActive({ textAlign: "left" }) ? "bg-secondary" : ""}
          >
            <IconAlignLeft size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={editor.isActive({ textAlign: "center" }) ? "bg-secondary" : ""}
          >
            <IconAlignCenter size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={editor.isActive({ textAlign: "right" }) ? "bg-secondary" : ""}
          >
            <IconAlignRight size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            className={editor.isActive({ textAlign: "justify" }) ? "bg-secondary" : ""}
          >
            <IconAlignJustified size={18} />
          </Button>
        </div>

        {/* Listas */}
        <div className="flex gap-1 border-r pr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "bg-secondary" : ""}
          >
            <IconList size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive("orderedList") ? "bg-secondary" : ""}
          >
            <IconListNumbers size={18} />
          </Button>
        </div>

        {/* Acciones */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            title="Copiar texto"
          >
            <IconCopy size={18} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearDocument}
            title="Limpiar documento"
          >
            <IconTrash size={18} />
          </Button>
        </div>

        {/* Exportación */}
        <div className="ml-auto flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={exportToWord}
            disabled={isExporting}
            className="gap-1"
          >
            <IconFileTypeDocx size={18} />
            <span className="hidden sm:inline">Word</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={exportToPDF}
            disabled={isExporting}
            className="gap-1"
          >
            <IconFileTypePdf size={18} />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </div>

      {/* Área de edición */}
      <div className="bg-background min-h-[500px] overflow-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Contador de palabras */}
      <div className="border-input border-t-2 p-2 text-right text-sm text-gray-500">
        {editor.storage.characterCount.words?.()} palabras •{" "}
        {editor.storage.characterCount.characters?.()} caracteres
      </div>
    </div>
  )
}

