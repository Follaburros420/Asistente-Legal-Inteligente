"use client"

import { ReactNode } from "react"

interface SectionWrapperProps {
  children: ReactNode
  className?: string
}

export default function SectionWrapper({ children, className = "" }: SectionWrapperProps) {
  return (
    <section className={`custom-screen py-20 sm:py-32 lg:py-40 ${className}`}>
      {children}
    </section>
  )
}
