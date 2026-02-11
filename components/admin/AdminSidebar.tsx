"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Database,
  Network,
  FileText,
  Activity,
  Home
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  title: string
  href: string
  icon: typeof LayoutDashboard
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Usuarios", href: "/admin/users", icon: Users },
  { title: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { title: "Storage", href: "/admin/analytics/storage", icon: Database },
  { title: "Base de Datos", href: "/admin/database", icon: Database },
  { title: "Ops Ingestion", href: "/admin/operations/ingestion", icon: Activity },
  { title: "Diagramas", href: "/admin/diagrams", icon: Network },
  { title: "Logs", href: "/admin/logs", icon: FileText }
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="p-4">
        <Link 
          href="/"
          className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Home className="h-5 w-5" />
          <span className="font-semibold">Volver al Chat</span>
        </Link>
      </div>
      
      <nav className="px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || 
            (item.href !== "/admin" && pathname.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-gray-900 text-white dark:bg-gray-700"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.title}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

