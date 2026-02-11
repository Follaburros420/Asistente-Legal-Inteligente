export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/supabase/types"
import { env } from "@/lib/env/runtime-env"
import { requireAdminApiAccess } from "@/lib/admin/require-admin-api"

export async function GET() {
  try {
    const auth = await requireAdminApiAccess()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const supabaseAdmin = createSupabaseClient<Database>(
      env.supabaseUrl(),
      env.supabaseServiceRole(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    const users = (data?.users as any[]) || []

    if (usersError) {
      return NextResponse.json(
        { error: "Error al obtener usuarios", details: usersError.message },
        { status: 500 }
      )
    }

    const activeUsers = users.length
    const inactiveUsers = 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const newUsersToday = users.filter((u) => new Date(u.created_at || "") >= today).length

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const newUsersThisWeek = users.filter((u) => new Date(u.created_at || "") >= weekAgo).length

    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    const newUsersThisMonth = users.filter((u) => new Date(u.created_at || "") >= monthAgo).length

    const supabase = supabaseAdmin
    const { data: subscriptions } = await supabase
      .from("subscriptions")
      .select("*")
      .then((res) => (res.error ? { data: [] } : res))

    const activeSubscriptions =
      subscriptions?.filter((s: any) => s.status === "active").length || 0

    let plans: any[] = []
    const plansRes = await supabase.from("plans").select("id, name")
    if (!plansRes.error) {
      plans = plansRes.data || []
    }

    const subscriptionsByPlan =
      plans?.map((plan: any) => ({
        plan_name: plan.name,
        count:
          subscriptions?.filter(
            (s: any) => s.plan_id === plan.id && s.status === "active"
          ).length || 0
      })) || []

    const { data: chats } = await supabase
      .from("chats")
      .select("id")
      .then((res) => (res.error ? { data: [] } : res))
    const { data: messages } = await supabase
      .from("messages")
      .select("id")
      .then((res) => (res.error ? { data: [] } : res))

    const filesRes = await supabase.from("files").select("id, size, tokens")
    const files = (filesRes.error ? [] : filesRes.data) as any[]

    const totalStorage =
      files?.reduce((acc: number, f: any) => acc + (f.size || 0), 0) || 0
    const totalTokens =
      files?.reduce((acc: number, f: any) => acc + (f.tokens || 0), 0) || 0

    let invoices: any[] = []
    const invRes = await supabase
      .from("invoices")
      .select("amount_in_cents, status, created_at")
    if (!invRes.error) {
      invoices = invRes.data || []
    }

    const totalRevenue =
      invoices
        ?.filter((i) => i.status === "paid")
        .reduce((acc, i) => acc + (i.amount_in_cents || 0), 0) || 0

    const monthAgoRevenue = new Date()
    monthAgoRevenue.setMonth(monthAgoRevenue.getMonth() - 1)
    const revenueThisMonth =
      invoices
        ?.filter(
          (i) => i.status === "paid" && new Date(i.created_at) >= monthAgoRevenue
        )
        .reduce((acc, i) => acc + (i.amount_in_cents || 0), 0) || 0

    return NextResponse.json({
      total_users: users.length,
      active_users: activeUsers,
      inactive_users: inactiveUsers,
      new_users_today: newUsersToday,
      new_users_this_week: newUsersThisWeek,
      new_users_this_month: newUsersThisMonth,
      total_revenue: totalRevenue / 100,
      revenue_this_month: revenueThisMonth / 100,
      active_subscriptions: activeSubscriptions,
      subscriptions_by_plan: subscriptionsByPlan,
      total_chats: chats?.length || 0,
      total_messages: messages?.length || 0,
      total_files: files?.length || 0,
      total_storage: totalStorage,
      total_tokens: totalTokens
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error al obtener métricas",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
