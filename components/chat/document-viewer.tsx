"use client"

import { FC, useState } from "react"
import { DocumentEditor } from "./document-editor"
import { Button } from "../ui/button"
import {
  IconEdit,
  IconEye,
  IconFileTypePdf,
  IconFileTypeDocx
} from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../ui/dialog"

interface DocumentViewerProps {
  content: string
  messageId?: string
}

export const DocumentViewer: FC<DocumentViewerProps> = ({ content, messageId }) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editedContent, setEditedContent] = useState(content)

  return (
    <div className="my-4">
      {/* Vista previa del documento */}
      <div className="border-input rounded-lg border-2 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">📝 Documento Generado</h3>
          <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" className="gap-2">
                <IconEdit size={18} />
                Editar Documento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden">
              <DialogHeader>
                <DialogTitle>Editor de Documentos Legales</DialogTitle>
                <DialogDescription>
                  Edita el documento generado y descárgalo en formato Word o PDF
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[calc(90vh-120px)] overflow-auto">
                <DocumentEditor
                  initialContent={editedContent}
                  onContentChange={setEditedContent}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Contenido del documento (vista previa) */}
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      {/* Instrucciones */}
      <div className="bg-secondary/50 mt-2 rounded-md p-3 text-sm">
        <p className="mb-1 font-semibold">💡 Sugerencias:</p>
        <ul className="ml-4 list-disc space-y-1 text-xs">
          <li>Haz clic en "Editar Documento" para hacer cambios</li>
          <li>Usa las herramientas de formato para ajustar el estilo</li>
          <li>Descarga el documento en formato Word (.docx) o PDF</li>
          <li>El documento se guarda automáticamente mientras editas</li>
        </ul>
      </div>
    </div>
  )
}

