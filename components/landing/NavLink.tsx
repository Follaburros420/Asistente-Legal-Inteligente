"use client"

import Link from "next/link"
import { ReactNode } from "react"

interface NavLinkProps {
  href: string
  children: ReactNode
  className?: string
}

export default function NavLink({ href, children, className = "" }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-lg transition-colors duration-150 ${className}`}
    >
      {children}
    </Link>
  )
}

