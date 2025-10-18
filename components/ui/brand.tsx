"use client"

import Link from "next/link"
import { FC } from "react"

interface BrandProps {
  theme?: "dark" | "light"
}

export const Brand: FC<BrandProps> = ({ theme = "dark" }) => {
  return (
    <Link
      className="flex cursor-pointer flex-col items-center hover:opacity-50"
      href="#"
      onClick={(e) => e.preventDefault()}
    >
      <div className="text-center">
        <div className="text-4xl font-bold tracking-wide">
          <span className="bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">
            ALI
          </span>
        </div>
        <div className="text-lg font-medium mt-1 text-gray-600 dark:text-gray-300">
          Asistente Legal Inteligente
        </div>
      </div>
    </Link>
  )
}
