"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useEffect, useRef, useState, ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PlaceholdersAndVanishInput({
  placeholders,
  onChange,
  onSubmit,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onPaste,
  value = "",
  disabled = false,
  className,
  textareaRef,
  leftElement,
  rightElement,
  showSuggestions = true
}: {
  placeholders: string[]
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onCompositionStart?: () => void
  onCompositionEnd?: () => void
  onPaste?: (e: React.ClipboardEvent) => void
  value?: string
  disabled?: boolean
  className?: string
  textareaRef?: React.RefObject<HTMLTextAreaElement>
  leftElement?: ReactNode
  rightElement?: ReactNode
  showSuggestions?: boolean
}) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0)
  const [animating, setAnimating] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const startAnimation = () => {
    if (!showSuggestions) return
    
    intervalRef.current = setInterval(() => {
      setAnimating(true)
      setTimeout(() => {
        setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length)
        setAnimating(false)
      }, 1000)
    }, 3000)
  }

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState !== "visible" && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    } else if (document.visibilityState === "visible") {
      startAnimation()
    }
  }, [placeholders.length])

  useEffect(() => {
    if (showSuggestions) {
      startAnimation()
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [handleVisibilityChange, showSuggestions])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const newDataRef = useRef<any[]>([])
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const activeTextareaRef = textareaRef || internalTextareaRef
  const [inputValue, setInputValue] = useState(value)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const draw = useCallback(() => {
    if (!activeTextareaRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = 800
    canvas.height = 800
    ctx.clearRect(0, 0, 800, 800)
    const computedStyles = getComputedStyle(activeTextareaRef.current)

    const fontSize = parseFloat(computedStyles.getPropertyValue("font-size"))
    ctx.font = `${fontSize * 2}px ${computedStyles.fontFamily}`
    ctx.fillStyle = "#FFF"
    ctx.fillText(inputValue, 16, 40)

    const imageData = ctx.getImageData(0, 0, 800, 800)
    const pixelData = imageData.data
    const newData: any[] = []

    for (let t = 0; t < 800; t++) {
      let i = 4 * t * 800
      for (let n = 0; n < 800; n++) {
        if (pixelData[i] !== 0) {
          const o = {
            x: n,
            y: t,
            color: [
              pixelData[i],
              pixelData[i + 1],
              pixelData[i + 2],
              pixelData[i + 3]
            ]
          }
          newData.push(o)
        }
        i += 4
      }
    }

    newDataRef.current = newData.map(({ x, y, color }) => ({
      x,
      y,
      r: 1,
      color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`
    }))
  }, [inputValue])

  useEffect(() => {
    draw()
  }, [inputValue, draw])

  const animate = (start: number) => {
    const animateFrame = (pos: number = 0) => {
      requestAnimationFrame(() => {
        const newArr = []
        for (let i = 0; i < newDataRef.current.length; i++) {
          const current = newDataRef.current[i]
          if (current.x < pos) {
            newArr.push(current)
          } else {
            if (current.r <= 0) {
              current.r = 0
              continue
            }
            current.x += Math.random() > 0.5 ? 1 : -1
            current.y += Math.random() > 0.5 ? 1 : -1
            current.r -= 0.05 * Math.random()
            newArr.push(current)
          }
        }
        newDataRef.current = newArr
        const ctx = canvasRef.current?.getContext("2d")
        if (ctx) {
          ctx.clearRect(pos, 0, 800, 800)
          newDataRef.current.forEach((t) => {
            const { x: n, y: i, r: s, color } = t
            if (n > pos) {
              ctx.beginPath()
              ctx.rect(n, i, s, s)
              ctx.fillStyle = color
              ctx.strokeStyle = color
              ctx.stroke()
            }
          })
        }
        if (newDataRef.current.length > 0) {
          animateFrame(pos - 8)
        } else {
          setInputValue("")
          setAnimating(false)
        }
      })
    }
    animateFrame(start)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Llamar al onKeyDown externo si existe
    if (onKeyDown) {
      onKeyDown(e)
    }
    
    // Solo manejar enter aquí si no fue manejado externamente
    if (!e.defaultPrevented && e.key === "Enter" && !e.shiftKey && !disabled) {
      e.preventDefault()
      vanishAndSubmit()
    }
  }

  const vanishAndSubmit = () => {
    if (!inputValue || disabled) return
    
    setAnimating(true)
    draw()

    const value = inputValue
    if (value && activeTextareaRef.current) {
      const maxX = newDataRef.current.reduce(
        (prev, current) => (current.x > prev ? current.x : prev),
        0
      )
      animate(maxX)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    vanishAndSubmit()
    onSubmit && onSubmit(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    
    // Detener animaciones cuando el usuario empiece a escribir
    if (newValue.length > 0 && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
      setAnimating(false)
    }
    
    onChange && onChange(e)
  }

  return (
    <div
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-xl bg-white shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),_0px_1px_0px_0px_rgba(25,28,33,0.02),_0px_0px_0px_1px_rgba(25,28,33,0.08)] transition duration-200 dark:bg-zinc-800 border-2 border-input",
        inputValue && "bg-gray-50/50 dark:bg-zinc-900/50",
        className
      )}
    >
      <canvas
        className={cn(
          "pointer-events-none absolute left-2 top-[20%] origin-top-left scale-50 transform pr-20 text-base invert filter dark:invert-0 sm:left-8",
          !animating ? "opacity-0" : "opacity-100"
        )}
        ref={canvasRef}
      />
      
      {/* Elemento izquierdo (ej: botón de archivo) */}
      {leftElement && (
        <div className="absolute left-3 top-1/2 z-[100] -translate-y-1/2 pointer-events-auto">
          {leftElement}
        </div>
      )}
      
      <textarea
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onPaste={onPaste}
        ref={activeTextareaRef}
        value={inputValue}
        disabled={disabled}
        rows={1}
        className={cn(
          "relative z-50 w-full resize-none border-none bg-transparent px-14 py-4 text-sm text-black focus:outline-none focus:ring-0 sm:text-base dark:text-white",
          animating && "text-transparent dark:text-transparent"
        )}
        style={{
          minHeight: "60px",
          maxHeight: "400px"
        }}
      />

      {/* Elemento derecho (ej: botón de enviar/stop) */}
      {rightElement && (
        <div className="absolute right-3 top-1/2 z-[100] -translate-y-1/2 pointer-events-auto">
          <div className="relative">
            {rightElement}
          </div>
        </div>
      )}

      {/* Placeholders animados */}
      {showSuggestions && (
        <div className="pointer-events-none absolute inset-0 flex items-center px-14 text-sm leading-none text-gray-400 sm:text-base">
          {!inputValue && (
            <AnimatePresence mode="wait">
              {!animating && (
                <motion.p
                  initial={{
                    y: 5,
                    opacity: 0
                  }}
                  key={`current-placeholder-${currentPlaceholder}`}
                  animate={{
                    y: 0,
                    opacity: 1
                  }}
                  exit={{
                    y: -15,
                    opacity: 0
                  }}
                  transition={{
                    duration: 0.3,
                    ease: "linear"
                  }}
                  className="w-[calc(100%-2rem)] truncate text-left"
                >
                  {placeholders[currentPlaceholder]}
                </motion.p>
              )}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  )
}

