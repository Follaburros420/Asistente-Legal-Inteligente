"use client"

import { ReactNode, ButtonHTMLAttributes } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  className?: string
}

export default function Button({ children, className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 text-white bg-purple-600 hover:bg-purple-500 active:bg-purple-700 rounded-lg transition-colors duration-150 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

