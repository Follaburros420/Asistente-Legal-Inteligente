"use client"

import Link from "next/link"
import { FC } from "react"
import { LegalSVG } from "../icons/legal-svg"

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
      <div className="mb-2">
        <LegalSVG theme={theme === "dark" ? "dark" : "light"} scale={0.4} />
      </div>

      <div className="text-3xl font-bold tracking-wide text-center">
        <span className="bg-gradient-to-r from-yellow-600 to-yellow-400 bg-clip-text text-transparent">
          Asistente Legal
        </span>
        <div className="text-lg font-medium mt-1">Colombia</div>
      </div>
    </Link>
  )
}
