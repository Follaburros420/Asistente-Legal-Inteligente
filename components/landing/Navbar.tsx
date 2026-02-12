"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Menu, X } from "lucide-react"
import { motion } from "framer-motion"
import Brand from "./Brand"
import ThemeToggle from "./ThemeToggle"
import { Button } from "@/components/ui/button"

export default function Navbar() {
  const [state, setState] = useState(false)
  const menuBtnEl = useRef<HTMLDivElement>(null)
  const menuEl = useRef<HTMLDivElement>(null)

  const navigation = [
    { name: "Características", href: "/landing#features" },
    { name: "Precios", href: "/landing#pricing" },
    { name: "Testimonios", href: "/landing#testimonials" },
    { name: "FAQs", href: "/landing#faqs" },
  ]

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const isClickInsideMenu = menuBtnEl.current?.contains(target) || menuEl.current?.contains(target)
      if (!isClickInsideMenu && state) {
        setState(false)
      }
    }

    if (state) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [state])

  return (
    <motion.header 
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 2.0, ease: "easeOut" }}
    >
      <div className="custom-screen">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Brand className="w-32" />

          {/* Desktop Navigation */}
          <nav className="hidden md:flex md:flex-1 md:items-center md:justify-center md:gap-6">
            {navigation.map((item, idx) => (
              <Link
                key={idx}
                href={item.href}
                className="text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex md:items-center md:gap-4">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Comenzar</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div ref={menuBtnEl} className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                setState(!state)
              }}
              className="md:hidden"
              type="button"
            >
              {state ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {state && (
          <div ref={menuEl} className="md:hidden border-t border-border/40 py-4">
            <nav className="flex flex-col gap-4">
              {navigation.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
                  onClick={() => setState(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-border/40">
                <Button variant="outline" asChild className="justify-center font-semibold text-base">
                  <Link href="/login">Iniciar Sesión</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Comenzar</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </motion.header>
  )
}
