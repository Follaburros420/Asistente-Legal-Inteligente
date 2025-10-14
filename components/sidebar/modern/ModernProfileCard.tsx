'use client'

import { motion } from 'framer-motion'
import { Settings, LogOut, ChevronRight, Mail, Shield } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChatbotUIContext } from '@/context/context'
import { useContext, useState } from 'react'
import { supabase } from '@/lib/supabase/browser-client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ProfileSettings } from '@/components/utility/profile-settings'

export function ModernProfileCard() {
  const { profile } = useContext(ChatbotUIContext)
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Sesión cerrada correctamente')
  }

  if (!profile) return null

  return (
    <div className="border-t border-border/40 bg-gradient-to-t from-muted/30 to-transparent">
      <div className="p-4">
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 transition-all group border border-transparent hover:border-border/50"
            >
              {/* Avatar con indicador online */}
              <div className="relative">
                <Avatar className="w-11 h-11 border-2 border-primary/30 ring-2 ring-background">
                  <AvatarImage src={profile.image_url || undefined} alt={profile.display_name || profile.username} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary font-bold text-lg">
                    {(profile.display_name || profile.username || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* Indicador online */}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              </div>

              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">
                    {profile.display_name || profile.username}
                  </p>
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    Pro
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {profile.username || 'Usuario'}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-all group-hover:translate-x-0.5" />
            </motion.button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>
              <div className="space-y-3">
                {/* Header del dropdown */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12 border-2 border-primary/30">
                      <AvatarImage src={profile.image_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary font-bold">
                        {(profile.display_name || profile.username || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base">{profile.display_name || profile.username}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {profile.username && `@${profile.username}`}
                    </p>
                  </div>
                </div>

                {/* Badge profesional */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <Shield className="w-4 h-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-xs font-medium">Cuenta Profesional</p>
                    <p className="text-[10px] text-muted-foreground">Acceso completo a todas las funciones</p>
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {/* Configuración */}
            <DropdownMenuItem asChild className="cursor-pointer">
              <div>
                <ProfileSettings />
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Cerrar sesión */}
            <DropdownMenuItem 
              onClick={handleSignOut} 
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

