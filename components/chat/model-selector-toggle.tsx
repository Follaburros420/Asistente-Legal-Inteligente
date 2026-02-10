import { useContext, useState } from "react"
import { ALIContext } from "@/context/context"
import { cn } from "@/lib/utils"
import { ChatSettings, OpenRouterLLMID } from "@/types"
import { IconBrain, IconCpu, IconChevronDown, IconBolt, IconInfinity, IconLock } from "@tabler/icons-react"
import { useModelUsage, formatRemainingCount } from "@/lib/hooks/use-model-usage"
import { toast } from "sonner"

// Internal model IDs - not exposed to users
// M1 y M1 Pro ambos usan Gemini 3 Pro Preview según configuración
export const M1_SMALL_MODEL = "google/gemini-2.0-flash-thinking-exp:free"
export const M1_MODEL = "google/gemini-3-pro-preview"
export const M1_PRO_MODEL = "google/gemini-3-pro-preview"

const MODELS = [
  {
    id: M1_SMALL_MODEL,
    name: "M1 Small",
    description: "Ligero y veloz",
    icon: IconBolt,
    iconColor: "text-emerald-500",
    bgColor: "from-emerald-500/15 to-emerald-600/10"
  },
  {
    id: M1_MODEL,
    name: "M1",
    description: "Eficiente y rápido",
    icon: IconCpu,
    iconColor: "text-primary",
    bgColor: "from-primary/15 to-primary/10"
  },
  {
    id: M1_PRO_MODEL,
    name: "M1 Pro",
    description: "Razonamiento avanzado",
    icon: IconBrain,
    iconColor: "text-violet-500",
    bgColor: "from-violet-500/15 to-violet-600/10"
  },
]

export const ModelSelectorToggle = () => {
  const { chatSettings, setChatSettings, profile } = useContext(ALIContext)
  const { canUseModel, getRemainingForModel, getUsageForModel, isLoading: usageLoading } = useModelUsage()

  // Use M1 as default if chatSettings is null
  const currentModel = chatSettings?.model || M1_MODEL
  const selectedModel = MODELS.find(m => m.id === currentModel) || MODELS[0]
  const [isOpen, setIsOpen] = useState(false)
  
  // Check if user is on student plan
  const isStudentPlan = profile?.plan_type === 'basic'
  const isProfessionalPlan = profile?.plan_type === 'pro' || profile?.plan_type === 'enterprise'

  const handleModelChange = (modelId: string) => {
    // Check if user can use this model
    if (!canUseModel(modelId)) {
      const usage = getUsageForModel(modelId)
      toast.error(`Has alcanzado el límite de ${usage?.monthly_limit || 0} consultas para ${usage?.model_name || 'este modelo'} este mes.`, {
        description: 'Prueba con M1 Small (ilimitado) o actualiza al Plan Profesional.',
        action: {
          label: 'Usar M1 Small',
          onClick: () => handleModelChange(M1_SMALL_MODEL)
        }
      })
      return
    }
    
    if (chatSettings) {
      setChatSettings({
        ...chatSettings,
        model: modelId as OpenRouterLLMID
      })
    } else {
      const defaultSettings: ChatSettings = {
        model: modelId as OpenRouterLLMID,
        prompt: profile?.default_prompt || "Eres un asistente legal inteligente especializado en derecho colombiano.",
        temperature: profile?.default_temperature || 0.5,
        contextLength: profile?.default_context_length || 4096,
        includeProfileContext: true,
        includeWorkspaceInstructions: true,
        embeddingsProvider: "openai"
      }
      setChatSettings(defaultSettings)
    }
    setIsOpen(false)
  }

  const SelectedIcon = selectedModel.icon
  
  // Get remaining for selected model (for badge display)
  const selectedRemaining = getRemainingForModel(selectedModel.id)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 h-9 px-3",
          "bg-secondary/30 backdrop-blur-sm rounded-lg",
          "border border-border/50 hover:border-border",
          "shadow-sm hover:shadow",
          "transition-all duration-200"
        )}
      >
        <SelectedIcon size={14} className={selectedModel.iconColor} />
        <span className="text-xs font-semibold">{selectedModel.name}</span>
        {/* Show remaining count for student plan */}
        {isStudentPlan && selectedRemaining !== null && (
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full",
            selectedRemaining === 0 ? "bg-red-500/20 text-red-400" :
            selectedRemaining <= 5 ? "bg-amber-500/20 text-amber-400" :
            "bg-muted text-muted-foreground"
          )}>
            {selectedRemaining}
          </span>
        )}
        <IconChevronDown 
          size={14} 
          className={cn(
            "text-muted-foreground/60 transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Dropdown */}
          <div className={cn(
            "absolute right-0 top-full mt-2 z-50",
            "min-w-[280px] p-1.5",
            "bg-background/95 backdrop-blur-md rounded-xl",
            "border border-border/60 shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}>
            {/* Header for student plan */}
            {isStudentPlan && (
              <div className="px-2.5 py-2 mb-1 border-b border-border/30">
                <p className="text-[11px] text-muted-foreground">
                  Plan Estudiantil • Uso mensual
                </p>
              </div>
            )}
            
            {MODELS.map((model) => {
              const Icon = model.icon
              const isSelected = model.id === currentModel
              const modelCanUse = canUseModel(model.id)
              const remaining = getRemainingForModel(model.id)
              const usage = getUsageForModel(model.id)
              const isUnlimited = remaining === null || usage?.is_unlimited
              
              return (
                <button
                  key={model.id}
                  onClick={() => handleModelChange(model.id)}
                  disabled={!modelCanUse}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-lg",
                    "transition-colors duration-150",
                    modelCanUse ? "hover:bg-muted/50" : "opacity-60 cursor-not-allowed",
                    isSelected && "bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0",
                    "bg-gradient-to-br",
                    model.bgColor,
                    !modelCanUse && "opacity-50"
                  )}>
                    {!modelCanUse ? (
                      <IconLock size={18} className="text-muted-foreground" />
                    ) : (
                    <Icon size={18} className={model.iconColor} />
                    )}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-semibold whitespace-nowrap",
                        !modelCanUse && "text-muted-foreground"
                      )}>
                        {model.name}
                      </span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {model.description}
                    </span>
                    </div>
                    {/* Usage info for student plan */}
                    {isStudentPlan && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isUnlimited ? (
                          <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                            <IconInfinity size={12} />
                            Ilimitado
                          </span>
                        ) : (
                          <span className={cn(
                            "text-[10px]",
                            !modelCanUse ? "text-red-400" :
                            remaining !== null && remaining <= 5 ? "text-amber-400" :
                            "text-muted-foreground"
                          )}>
                            {!modelCanUse ? "Agotado este mes" :
                             usage ? `${usage.usage_count}/${usage.monthly_limit} usados` :
                             "Cargando..."}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Check mark for selected */}
                  {isSelected && modelCanUse && (
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                  )}
                </button>
              )
            })}
            
            {/* Footer for upgrade CTA */}
            {isStudentPlan && (
              <div className="px-2.5 py-2 mt-1 border-t border-border/30">
                <a 
                  href="/precios" 
                  className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
                  onClick={() => setIsOpen(false)}
                >
                  ✨ Actualiza a Profesional para uso ilimitado
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
