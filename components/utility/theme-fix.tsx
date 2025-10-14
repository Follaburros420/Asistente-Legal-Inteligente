"use client"

import { useEffect } from "react"

export function ThemeFix() {
  useEffect(() => {
    // Forzar tema oscuro inmediatamente
    const html = document.documentElement
    const body = document.body
    
    // Agregar clase dark al HTML
    html.classList.add("dark")
    
    // Aplicar estilos de respaldo inmediatamente
    body.style.backgroundColor = "hsl(0, 0%, 3.9%)"
    body.style.color = "hsl(0, 0%, 98%)"
    body.style.transition = "background-color 0.2s, color 0.2s"
    
    // Verificar que se aplicó correctamente
    console.log("🌙 Tema oscuro aplicado:", {
      htmlClasses: html.className,
      bodyClasses: body.className,
      bodyBackground: body.style.backgroundColor,
      bodyColor: body.style.color
    })
  }, [])

  return null
}















