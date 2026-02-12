// app/(auth)/layout.tsx
// Layout for authentication routes (login, onboarding, etc.)
// These routes do NOT use locale prefix

import { Inter } from 'next/font/google'
import Script from 'next/script'
import '../[locale]/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Asistente Legal Inteligente',
  description: 'Tu asistente de inteligencia artificial para el derecho colombiano',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <Script src="/env.js" strategy="beforeInteractive" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-ali.svg" type="image/svg+xml" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="shortcut icon" href="/favicon-ali.svg" />
      </head>
      <body className={`${inter.className} dark`}>
        {children}
      </body>
    </html>
  )
}

