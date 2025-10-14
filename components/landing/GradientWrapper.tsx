"use client"

import { ReactNode } from "react"

interface GradientWrapperProps {
  children: ReactNode
  className?: string
  wrapperClassName?: string
}

export default function GradientWrapper({ 
  children, 
  className = "", 
  wrapperClassName = "" 
}: GradientWrapperProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-3xl opacity-20 ${className}`}
      />
      <div className="relative">
        {children}
      </div>
    </div>
  )
}

