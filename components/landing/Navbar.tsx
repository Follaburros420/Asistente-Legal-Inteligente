"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Menu, X } from "lucide-react"
import Brand from "./Brand"
import NavLink from "./NavLink"
import ThemeToggle from "./ThemeToggle"
import { Button } from "@/components/ui/button"

export default function Navbar() {
  const [state, setState] = useState(false)
  const menuBtnEl = useRef<HTMLDivElement>(null)

  const navigation = [
    { name: "Características", href: "/landing#features" },
    { name: "Precios", href: "/landing#pricing" },
    { name: "Testimonios", href: "/landing#testimonials" },
    { name: "FAQs", href: "/landing#faqs" },
  ]

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuBtnEl.current && !menuBtnEl.current.contains(target)) {
        setState(false)
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
              <Link href="/login">Comenzar</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div ref={menuBtnEl} className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setState(!state)}
              className="md:hidden"
            >
              {state ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {state && (
          <div className="md:hidden border-t border-border/40 py-4">
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
                <Button variant="ghost" asChild className="justify-start">
                  <Link href="/login">Iniciar Sesión</Link>
                </Button>
                <Button asChild>
                  <Link href="/login">Comenzar</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
