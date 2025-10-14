"use client"

import { ReactNode } from "react"
import Footer from "./Footer"
import Navbar from "./Navbar"

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1" data-landing>{children}</main>
      <Footer />
    </div>
  )
}
