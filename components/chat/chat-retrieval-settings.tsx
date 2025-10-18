import { ChatbotUIContext } from "@/context/context"
import { IconAdjustmentsHorizontal, IconHelpCircle } from "@tabler/icons-react"
import { FC, useContext, useState } from "react"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger
} from "../ui/dialog"
import { Label } from "../ui/label"
import { Slider } from "../ui/slider"
import { WithTooltip } from "../ui/with-tooltip"

interface ChatRetrievalSettingsProps {}

export const ChatRetrievalSettings: FC<ChatRetrievalSettingsProps> = ({}) => {
  const { sourceCount, setSourceCount } = useContext(ChatbotUIContext)

  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <WithTooltip
          delayDuration={0}
          side="top"
          display={<div>Ajustar configuración de recuperación.</div>}
          trigger={
            <IconAdjustmentsHorizontal
              className="cursor-pointer pt-[4px] hover:opacity-50"
              size={24}
            />
          }
        />
      </DialogTrigger>

      <DialogContent>
        <div className="space-y-3">
          <Label className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div>Cantidad de Fuentes:</div>
              <div>{sourceCount}</div>
            </div>
            
            <WithTooltip
              delayDuration={0}
              side="top"
              display={
                <div className="max-w-xs">
                  <div className="font-semibold mb-1">¿Para qué sirve?</div>
                  <div className="text-sm">
                    Controla cuántos fragmentos de texto se extraen de tus documentos para responder tu consulta. 
                    Más fuentes = más información, pero respuestas más largas.
                  </div>
                </div>
              }
              trigger={
                <IconHelpCircle 
                  className="cursor-help text-muted-foreground hover:text-foreground transition-colors" 
                  size={16} 
                />
              }
            />
          </Label>

          <Slider
            value={[sourceCount]}
            onValueChange={values => {
              setSourceCount(values[0])
            }}
            min={1}
            max={10}
            step={1}
          />
        </div>

        <DialogFooter>
          <Button size="sm" onClick={() => setIsOpen(false)}>
            Guardar y Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
