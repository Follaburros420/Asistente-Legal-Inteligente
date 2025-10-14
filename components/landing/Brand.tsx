"use client"

import Image from "next/image"

interface BrandProps {
  className?: string
  width?: number
  height?: number
}

export default function Brand({ className = "", width = 110, height = 50 }: BrandProps) {
  return (
    <Image
      src="/legal-logo.svg"
      alt="Asistente Legal Inteligente"
      className={className}
      width={width}
      height={height}
      priority
    />
  )
}

