"use client"

import { InputHTMLAttributes } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export default function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${className}`}
      {...props}
    />
  )
}

