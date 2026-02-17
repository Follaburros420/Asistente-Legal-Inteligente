"use client"

import { Search } from "lucide-react"
import { FC } from "react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DeepResearchToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  disabled?: boolean
}

export const DeepResearchToggle: FC<DeepResearchToggleProps> = ({
  enabled,
  onToggle,
  disabled = false,
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => !disabled && onToggle(!enabled)}
            disabled={disabled}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2 rounded-xl",
              "transition-all duration-200 ease-in-out",
              "text-sm font-medium",
              "border",
              enabled
                ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            aria-pressed={enabled}
            aria-label={enabled ? "Desactivar investigación profunda" : "Activar investigación profunda"}
          >
            <Search
              className={cn(
                "w-4 h-4 transition-all duration-200",
                enabled && "text-primary"
              )}
            />
            <span className="hidden sm:inline">
              {enabled ? "Profunda" : "Investigar"}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">
            {enabled
              ? "Investigación profunda activada. Se realizará una búsqueda exhaustiva con múltiples fuentes."
              : "Activa para realizar una investigación profunda con búsqueda exhaustiva y múltiples fuentes."}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
