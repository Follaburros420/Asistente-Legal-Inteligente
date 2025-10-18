"use client"

import Link from "next/link"

interface BrandProps {
  className?: string
}

export default function Brand({ className = "" }: BrandProps) {
  return (
    <Link href="/" className={`flex items-center ${className}`}>
      <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">
        ALI
      </span>
    </Link>
  )
}

