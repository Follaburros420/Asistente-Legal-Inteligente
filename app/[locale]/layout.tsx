import { Toaster } from "@/components/ui/sonner"
import { GlobalState } from "@/components/utility/global-state"
import { Providers } from "@/components/utility/providers"
import { ThemeFix } from "@/components/utility/theme-fix"
import TranslationsProvider from "@/components/utility/translations-provider"
import { getEnvVar } from "@/lib/env/runtime-env"
import initTranslations from "@/lib/i18n"
import { createClient } from "@/lib/supabase/server"
import { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { cookies } from "next/headers"
import Script from "next/script"
import { ReactNode } from "react"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })
const APP_NAME = "ALI"
const APP_DEFAULT_TITLE = "Inteligencia artificial con todas las de la ley"
const APP_TITLE_TEMPLATE = "%s | ALI"
const APP_DESCRIPTION =
  "Tu asistente legal inteligente potenciado con IA. Consultas legales, redacción de documentos y seguimiento de procesos judiciales en Colombia."

interface RootLayoutProps {
  children: ReactNode
  params: {
    locale: string
  }
}

export const metadata: Metadata = {
  metadataBase: new URL(
    getEnvVar("NEXT_PUBLIC_APP_URL", { fallback: "https://aliado.pro" })
  ),
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/favicon-ali.svg", type: "image/svg+xml" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icon-192x192.png", sizes: "192x192" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "ALI"
  },
  formatDetection: {
    telephone: false
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE
    },
    description: APP_DESCRIPTION,
    images: [
      {
        url: "/ALI compartir.png",
        width: 1200,
        height: 630,
        alt: "ALI - Inteligencia artificial con todas las de la ley"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE
    },
    description: APP_DESCRIPTION,
    images: ["/ALI compartir.png"]
  }
}

export const viewport: Viewport = {
  themeColor: "#000000"
}

const i18nNamespaces = ["translation"]

export default async function RootLayout({
  children,
  params: { locale }
}: RootLayoutProps) {
  const cookieStore = cookies()

  // Get session - handle case where Supabase is not configured (during build)
  let session = null
  try {
    const supabase = createClient(cookieStore)
    session = (await supabase.auth.getSession()).data.session
  } catch {
    // Supabase not configured - continue without session
  }

  const { t, resources } = await initTranslations(locale, i18nNamespaces)

  // Read all public environment variables for client-side injection
  const publicEnv = {
    NEXT_PUBLIC_SUPABASE_URL: getEnvVar("NEXT_PUBLIC_SUPABASE_URL", {
      fallback: ""
    }),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", {
      fallback: ""
    }),
    NEXT_PUBLIC_APP_URL: getEnvVar("NEXT_PUBLIC_APP_URL", { fallback: "" }),
    NEXT_PUBLIC_SITE_URL: getEnvVar("NEXT_PUBLIC_SITE_URL", { fallback: "" }),
    NEXT_PUBLIC_BILLING_ENABLED: getEnvVar("NEXT_PUBLIC_BILLING_ENABLED", {
      fallback: "false"
    }),
    NEXT_PUBLIC_WOMPI_PUBLIC_KEY: getEnvVar("NEXT_PUBLIC_WOMPI_PUBLIC_KEY", {
      fallback: ""
    }),
    NEXT_PUBLIC_WOMPI_BASE_URL: getEnvVar("NEXT_PUBLIC_WOMPI_BASE_URL", {
      fallback: "https://sandbox.wompi.co"
    }),
    NEXT_PUBLIC_OLLAMA_URL: getEnvVar("NEXT_PUBLIC_OLLAMA_URL", { fallback: "" })
  }

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className="dark"
      style={{ colorScheme: "dark" }}
    >
      <head>
        {/* 
          Inline script to inject environment variables immediately.
          This runs before any React code and ensures window.__ENV__ is available.
          Priority: runtime env vars > build-time values (from env.js)
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var env = ${JSON.stringify(publicEnv)};
                // Only override if runtime value is not empty
                window.__ENV__ = window.__ENV__ || {};
                for (var key in env) {
                  if (env[key] && env[key].trim && env[key].trim() !== '') {
                    window.__ENV__[key] = env[key];
                  }
                }
                // Debug logging
                if (window.location.hostname === 'localhost' || window.location.search.includes('debug=1')) {
                  console.log('[layout] Runtime env injected:', {
                    hasSupabaseUrl: !!window.__ENV__.NEXT_PUBLIC_SUPABASE_URL,
                    hasSupabaseKey: !!window.__ENV__.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  });
                }
              })();
            `
          }}
        />
        {/* Fallback: Load env.js for build-time values (will be overridden by inline script above if runtime values exist) */}
        <Script src="/env.js" strategy="beforeInteractive" />
        {/* Meta tags as additional fallback mechanism */}
        <meta
          name="supabase-url"
          content={publicEnv.NEXT_PUBLIC_SUPABASE_URL}
        />
        <meta
          name="supabase-anon-key"
          content={publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY}
        />
        <meta name="app-url" content={publicEnv.NEXT_PUBLIC_APP_URL} />
        <meta name="site-url" content={publicEnv.NEXT_PUBLIC_SITE_URL} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-ali.svg" type="image/svg+xml" />
        <link
          rel="icon"
          type="image/png"
          sizes="48x48"
          href="/favicon-48x48.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="apple-touch-icon" href="/icon-192x192.svg" />
        <link rel="shortcut icon" href="/favicon-ali.svg" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html {
                background-color: hsl(0, 0%, 3.9%) !important;
                color: hsl(0, 0%, 98%) !important;
                color-scheme: dark !important;
              }
              body {
                background-color: hsl(0, 0%, 3.9%) !important;
                color: hsl(0, 0%, 98%) !important;
                margin: 0 !important;
                padding: 0 !important;
                min-height: 100vh !important;
              }
            `
          }}
        />
      </head>
      <body
        className={inter.className}
        style={{
          backgroundColor: "hsl(0, 0%, 3.9%)",
          color: "hsl(0, 0%, 98%)"
        }}
      >
        <Providers
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
          >
            <Toaster richColors position="top-center" duration={3000} />
            <div className="bg-background text-foreground flex min-h-dvh flex-col overflow-y-auto overflow-x-hidden">
              {session ? <GlobalState>{children}</GlobalState> : children}
            </div>
          </TranslationsProvider>
        </Providers>
      </body>
    </html>
  )
}
