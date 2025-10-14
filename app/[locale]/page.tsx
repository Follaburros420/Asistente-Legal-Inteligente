"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirigir a la landing page
    router.push("/landing")
  }, [router])

  return (
    <div className="flex size-full flex-col items-center justify-center">
      <div className="text-lg">Redirigiendo a la página principal...</div>
    </div>
  )
}
