import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/admin/check-admin"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const adminSession = cookieStore.get("admin_session")
  const supabase = createClient(cookieStore)
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (adminSession?.value !== "true" || error || !user || !isAdmin(user.email)) {
    redirect("/admin/login")
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

