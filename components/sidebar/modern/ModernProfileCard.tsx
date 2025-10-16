'use client'

import { motion } from "framer-motion"
import { Mail, ChevronRight } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChatbotUIContext } from "@/context/context"
import { useContext } from "react"
import { ProfileSettings } from "@/components/utility/profile-settings"

export function ModernProfileCard() {
  const { profile } = useContext(ChatbotUIContext)

  if (!profile) return null

  const profileTrigger = (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition-all hover:border-border/50 hover:bg-muted/50"
    >
      <div className="relative">
        <Avatar className="h-11 w-11 border-2 border-primary/30 ring-2 ring-background">
          <AvatarImage src={profile.image_url || undefined} alt={profile.display_name || profile.username} />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-lg font-bold text-primary">
            {(profile.display_name || profile.username || "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
      </div>

      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">
            {profile.display_name || profile.username}
          </p>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            Pro
          </Badge>
        </div>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          {profile.username || "Usuario"}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
    </motion.button>
  )

  return (
    <div className="border-t border-border/40 bg-gradient-to-t from-muted/30 to-transparent">
      <div className="p-4">
        <ProfileSettings trigger={profileTrigger} />
      </div>
    </div>
  )
}

