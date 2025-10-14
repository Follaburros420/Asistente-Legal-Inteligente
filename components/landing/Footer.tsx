"use client"

import Link from "next/link"
import { Facebook, Twitter, Linkedin, Mail } from "lucide-react"

export default function Footer() {
  return (
    <footer className="w-full bg-background border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-primary">Asistente Legal Inteligente</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Transformando la práctica legal con inteligencia artificial avanzada.
            </p>
            <div className="flex gap-4">
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-200 hover:scale-110">
                <Facebook className="size-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-200 hover:scale-110">
                <Twitter className="size-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-200 hover:scale-110">
                <Linkedin className="size-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-200 hover:scale-110">
                <Mail className="size-5" />
              </Link>
            </div>
          </div>

          {/* Producto */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Producto</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/landing#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Características
                </Link>
              </li>
              <li>
                <Link href="/landing#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Precios
                </Link>
              </li>
              <li>
                <Link href="/landing#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Testimonios
                </Link>
              </li>
              <li>
                <Link href="/landing#faqs" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Empresa</h3>
            <ul className="space-y-3">
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Sobre Nosotros
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Contacto
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Carreras
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Privacidad
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Términos
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Seguridad
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 mt-8 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              © 2024 Asistente Legal Inteligente. Todos los derechos reservados.
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              Hecho con <span className="text-red-500">❤️</span> en Colombia
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}