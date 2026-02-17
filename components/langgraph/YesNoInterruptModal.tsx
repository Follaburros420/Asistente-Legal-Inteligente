"use client"

/**
 * YesNoInterruptModal Component
 * 
 * Modal for displaying yes/no questions during document drafting.
 * Supports grouped questions with dependencies.
 */

import * as React from "react"
import { 
  HelpCircle, 
  Check, 
  X, 
  ChevronDown, 
  ChevronRight,
  Info,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ============================================================================
// TYPES
// ============================================================================

export interface Question {
  id: string
  label: string
  type: "yes_no" | "text" | "select"
  default?: string | boolean
  depends_on?: {
    question_id: string
    value: any
  }
  section?: string
  required?: boolean
  help?: string
  options?: string[]
}

export interface InterruptPayload {
  ui_type: "yes_no_list" | "text_input" | "document_preview"
  title: string
  why_needed: string
  what_happens_next?: string
  questions: Question[]
  explain?: string
}

export interface YesNoInterruptModalProps {
  payload: InterruptPayload
  onSubmit: (answers: Record<string, any>) => void
  onCancel: () => void
  isOpen?: boolean
}

// ============================================================================
// QUESTION ITEM COMPONENT
// ============================================================================

interface QuestionItemProps {
  question: Question
  value: any
  onChange: (id: string, value: any) => void
  disabled?: boolean
}

function QuestionItem({ question, value, onChange, disabled }: QuestionItemProps) {
  const [showHelp, setShowHelp] = React.useState(false)
  
  const handleChange = (newValue: any) => {
    onChange(question.id, newValue)
  }
  
  return (
    <div className="py-3 border-b last:border-b-0">
      <div className="flex items-start gap-3">
        {/* Question content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Label 
              htmlFor={question.id} 
              className="text-sm font-medium cursor-pointer"
            >
              {question.label}
            </Label>
            {question.required && (
              <Badge variant="outline" className="text-xs">
                Requerido
              </Badge>
            )}
            {question.help && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => setShowHelp(!showHelp)}
                    >
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">{question.help}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {/* Input based on type */}
          {question.type === "yes_no" && (
            <div className="flex items-center gap-4 mt-2">
              <Button
                type="button"
                variant={value === true ? "default" : "outline"}
                size="sm"
                onClick={() => handleChange(true)}
                disabled={disabled}
                className="min-w-[80px]"
              >
                {value === true && <Check className="h-3 w-3 mr-1" />}
                Sí
              </Button>
              <Button
                type="button"
                variant={value === false ? "default" : "outline"}
                size="sm"
                onClick={() => handleChange(false)}
                disabled={disabled}
                className="min-w-[80px]"
              >
                {value === false && <X className="h-3 w-3 mr-1" />}
                No
              </Button>
            </div>
          )}
          
          {question.type === "text" && (
            <Textarea
              id={question.id}
              value={value || ""}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Escribe tu respuesta..."
              className="mt-2 min-h-[60px]"
              disabled={disabled}
            />
          )}
          
          {question.type === "select" && question.options && (
            <Select
              value={value || ""}
              onValueChange={handleChange}
              disabled={disabled}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecciona una opción" />
              </SelectTrigger>
              <SelectContent>
                {question.options.map((option, i) => (
                  <SelectItem key={i} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {/* Help text */}
          {showHelp && question.help && (
            <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded p-2">
              {question.help}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION GROUP COMPONENT
// ============================================================================

interface SectionGroupProps {
  section: string
  questions: Question[]
  answers: Record<string, any>
  onAnswerChange: (id: string, value: any) => void
}

function SectionGroup({ section, questions, answers, onAnswerChange }: SectionGroupProps) {
  const [isOpen, setIsOpen] = React.useState(true)
  
  // Filter questions based on dependencies
  const visibleQuestions = questions.filter(q => {
    if (!q.depends_on) return true
    
    const dependentAnswer = answers[q.depends_on.question_id]
    return dependentAnswer === q.depends_on.value
  })
  
  if (visibleQuestions.length === 0) return null
  
  const answeredCount = visibleQuestions.filter(q => {
    const answer = answers[q.id]
    return answer !== undefined && answer !== null && answer !== ""
  }).length
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:text-primary">
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span className="font-medium">{section}</span>
        <Badge variant="secondary" className="text-xs ml-auto">
          {answeredCount}/{visibleQuestions.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6">
          {visibleQuestions.map(question => (
            <QuestionItem
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={onAnswerChange}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function YesNoInterruptModal({
  payload,
  onSubmit,
  onCancel,
  isOpen = true
}: YesNoInterruptModalProps) {
  // Initialize answers with defaults
  const [answers, setAnswers] = React.useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {}
    for (const q of payload.questions) {
      if (q.default !== undefined) {
        initial[q.id] = q.default
      }
    }
    return initial
  })
  
  // Group questions by section
  const groupedQuestions = React.useMemo(() => {
    const groups: Record<string, Question[]> = {}
    for (const q of payload.questions) {
      const section = q.section || "General"
      if (!groups[section]) {
        groups[section] = []
      }
      groups[section].push(q)
    }
    return groups
  }, [payload.questions])
  
  // Handle answer change
  const handleAnswerChange = (id: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [id]: value
    }))
  }
  
  // Check if all required questions are answered
  const canSubmit = React.useMemo(() => {
    for (const q of payload.questions) {
      if (q.required) {
        const answer = answers[q.id]
        if (answer === undefined || answer === null || answer === "") {
          return false
        }
      }
    }
    return true
  }, [payload.questions, answers])
  
  // Handle submit
  const handleSubmit = () => {
    onSubmit(answers)
  }
  
  // Count total and answered
  const totalCount = payload.questions.length
  const answeredCount = Object.values(answers).filter(
    v => v !== undefined && v !== null && v !== ""
  ).length
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            {payload.title}
          </DialogTitle>
          <DialogDescription>
            {payload.why_needed}
          </DialogDescription>
        </DialogHeader>
        
        {/* Progress */}
        <div className="flex items-center gap-2 py-2">
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(answeredCount / totalCount) * 100}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {answeredCount}/{totalCount}
          </span>
        </div>
        
        {/* Questions */}
        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-2">
            {Object.entries(groupedQuestions).map(([section, questions]) => (
              <SectionGroup
                key={section}
                section={section}
                questions={questions}
                answers={answers}
                onAnswerChange={handleAnswerChange}
              />
            ))}
          </div>
        </ScrollArea>
        
        {/* What happens next */}
        {payload.what_happens_next && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">¿Qué pasa después?</span>
            </div>
            <p className="text-muted-foreground">
              {payload.what_happens_next}
            </p>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// COMPACT VERSION FOR INLINE USE
// ============================================================================

export function YesNoQuestionList({
  questions,
  answers,
  onAnswerChange,
  className
}: {
  questions: Question[]
  answers: Record<string, any>
  onAnswerChange: (id: string, value: any) => void
  className?: string
}) {
  // Group by section
  const groupedQuestions = React.useMemo(() => {
    const groups: Record<string, Question[]> = {}
    for (const q of questions) {
      const section = q.section || "General"
      if (!groups[section]) {
        groups[section] = []
      }
      groups[section].push(q)
    }
    return groups
  }, [questions])
  
  return (
    <div className={cn("space-y-4", className)}>
      {Object.entries(groupedQuestions).map(([section, qs]) => (
        <div key={section}>
          <h4 className="text-sm font-medium mb-2">{section}</h4>
          <div className="space-y-2">
            {qs.map(question => (
              <QuestionItem
                key={question.id}
                question={question}
                value={answers[question.id]}
                onChange={onAnswerChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}