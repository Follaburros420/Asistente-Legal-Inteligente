"use client"

import { ReactNode, useEffect, useRef, useState } from "react"

interface LayoutEffectProps {
  children: ReactNode
  className?: string
  isInviewState?: {
    trueState: string
    falseState: string
  }
}

export default function LayoutEffect({ 
  children, 
  className = "", 
  isInviewState = { trueState: "opacity-1", falseState: "opacity-0" } 
}: LayoutEffectProps) {
  const [isInView, setIsInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
        }
      },
      { threshold: 0.1 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ${
        isInView ? isInviewState.trueState : isInviewState.falseState
      } ${className}`}
    >
      {children}
    </div>
  )
}

