import { ChatbotUIContext } from "@/context/context"
import {
  PROFILE_CONTEXT_MAX,
  PROFILE_DISPLAY_NAME_MAX,
  PROFILE_USERNAME_MAX,
  PROFILE_USERNAME_MIN
} from "@/db/limits"
import { updateProfile } from "@/db/profile"
import { uploadProfileImage } from "@/db/storage/profile-images"
import { supabase } from "@/lib/supabase/browser-client"
import {
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconLoader2,
  IconLogout,
  IconUser
} from "@tabler/icons-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { FC, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { SIDEBAR_ICON_SIZE } from "../sidebar/sidebar-switcher"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import ImagePicker from "../ui/image-picker"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { LimitDisplay } from "../ui/limit-display"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "../ui/sheet"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { ThemeSwitcher } from "./theme-switcher"

interface ProfileSettingsProps {
  trigger?: ReactNode
}

const debounce = <Args extends unknown[]>(
  func: (...args: Args) => void,
  wait: number
) => {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: Args) => {
    if (timeout) clearTimeout(timeout)

    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

export const ProfileSettings: FC<ProfileSettingsProps> = ({ trigger }) => {
  const { profile, setProfile } = useContext(ChatbotUIContext)
  const router = useRouter()

  const buttonRef = useRef<HTMLButtonElement>(null)

  const [isOpen, setIsOpen] = useState(false)

  const [displayName, setDisplayName] = useState(profile?.display_name || "")
  const [username, setUsername] = useState(profile?.username || "")
  const [usernameAvailable, setUsernameAvailable] = useState(true)
  const [loadingUsername, setLoadingUsername] = useState(false)
  const [profileImageSrc, setProfileImageSrc] = useState(profile?.image_url || "")
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [profileInstructions, setProfileInstructions] = useState(
    profile?.profile_context || ""
  )

  const resetForm = useCallback(() => {
    setDisplayName(profile?.display_name || "")
    setUsername(profile?.username || "")
    setProfileImageSrc(profile?.image_url || "")
    setProfileImageFile(null)
    setProfileInstructions(profile?.profile_context || "")
    setUsernameAvailable(true)
    setLoadingUsername(false)
  }, [profile])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const handleSave = async () => {
    if (!profile) return

    try {
      let profileImageUrl = profile.image_url
      let profileImagePath = profile.image_path || ""

      if (profileImageFile) {
        const { path, url } = await uploadProfileImage(profile, profileImageFile)
        profileImageUrl = url ?? profileImageUrl
        profileImagePath = path
      }

      const updatedProfile = await updateProfile(profile.id, {
        ...profile,
        display_name: displayName,
        username,
        profile_context: profileInstructions,
        image_url: profileImageUrl,
        image_path: profileImagePath
      })

      setProfile(updatedProfile)
      toast.success("Perfil actualizado correctamente.")
      setIsOpen(false)
    } catch (error) {
      toast.error("No se pudo guardar la configuración.")
    }
  }

  const checkUsernameAvailability = useCallback(
    debounce(async (candidate: string) => {
      if (!candidate) return

      if (candidate.length < PROFILE_USERNAME_MIN) {
        setUsernameAvailable(false)
        return
      }

      if (candidate.length > PROFILE_USERNAME_MAX) {
        setUsernameAvailable(false)
        return
      }

      const usernameRegex = /^[a-zA-Z0-9_]+$/
      if (!usernameRegex.test(candidate)) {
        setUsernameAvailable(false)
        toast.error(
          "El nombre de usuario solo puede contener letras, números o guiones bajos."
        )
        return
      }

      setLoadingUsername(true)

      const response = await fetch(`/api/username/available`, {
        method: "POST",
        body: JSON.stringify({ username: candidate })
      })

      const data = await response.json()
      const isAvailable = data.isAvailable

      setUsernameAvailable(
        candidate === profile?.username ? true : Boolean(isAvailable)
      )
      setLoadingUsername(false)
    }, 400),
    [profile?.username]
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      buttonRef.current?.click()
    }
  }

  const themeControls = useMemo(
    () => (
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Tema</span>
        <ThemeSwitcher />
      </div>
    ),
    []
  )

  if (!profile) return null

  return (
    <Sheet
      open={isOpen}
      onOpenChange={open => {
        setIsOpen(open)
        if (open) resetForm()
      }}
    >
      <SheetTrigger asChild>
        {trigger || (
          <Button size="icon" variant="ghost">
            <IconUser size={SIDEBAR_ICON_SIZE} />
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        className="flex flex-col justify-between"
        side="left"
        onKeyDown={handleKeyDown}
      >
        <div className="grow overflow-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg font-semibold">
              Configuración de perfil
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              Mantén actualizados tus datos y credenciales para mejorar las respuestas del asistente.
            </p>
          </SheetHeader>

          <div className="mt-4 flex items-center gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
            <Avatar className="h-12 w-12 border-2 border-primary/30 ring-2 ring-background">
              <AvatarImage
                src={profile.image_url || undefined}
                alt={profile.display_name || profile.username}
              />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-lg font-bold text-primary">
                {(profile.display_name || profile.username || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">
                  {profile.display_name || profile.username}
                </p>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  Pro
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {profile.username || "Usuario sin alias"}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={handleSignOut}
            >
              <IconLogout className="mr-1" size={16} />
              Cerrar sesión
            </Button>
          </div>

          <div className="mt-6 space-y-6 rounded-lg border border-border/60 bg-background/60 p-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="username">Nombre de usuario</Label>
                {username !== profile.username && (
                  <span
                    className={
                      usernameAvailable
                        ? "text-xs font-medium text-emerald-500"
                        : "text-xs font-medium text-red-500"
                    }
                  >
                    {usernameAvailable ? "Disponible" : "No disponible"}
                  </span>
                )}
              </div>

              <div className="relative">
                <Input
                  id="username"
                  className="pr-10"
                  placeholder="ej. abogada.civil"
                  value={username}
                  onChange={event => {
                    setUsername(event.target.value)
                    checkUsernameAvailability(event.target.value)
                  }}
                  minLength={PROFILE_USERNAME_MIN}
                  maxLength={PROFILE_USERNAME_MAX}
                />
                {username !== profile.username && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
                    {loadingUsername ? (
                      <IconLoader2 className="h-4 w-4 animate-spin" />
                    ) : usernameAvailable ? (
                      <IconCircleCheckFilled className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <IconCircleXFilled className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <LimitDisplay used={username.length} limit={PROFILE_USERNAME_MAX} />
                <span>
                  {PROFILE_USERNAME_MIN}-{PROFILE_USERNAME_MAX} caracteres
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="display-name">Nombre visible</Label>
              <Input
                id="display-name"
                placeholder="Nombre que verán tus clientes en la conversación"
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                maxLength={PROFILE_DISPLAY_NAME_MAX}
              />
              <div className="text-xs text-muted-foreground">
                <LimitDisplay used={displayName.length} limit={PROFILE_DISPLAY_NAME_MAX} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Imagen de perfil</Label>
              <ImagePicker
                src={profileImageSrc}
                image={profileImageFile}
                height={72}
                width={72}
                onSrcChange={setProfileImageSrc}
                onImageChange={setProfileImageFile}
              />
              <p className="text-xs text-muted-foreground">
                Sube una imagen cuadrada para que se vea nítida en el chat.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="profile-context">
                Contexto para el asistente
              </Label>
              <TextareaAutosize
                id="profile-context"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed"
                placeholder="Describe tu especialidad, estilo de respuesta o cualquier información relevante."
                value={profileInstructions}
                onValueChange={setProfileInstructions}
                minRows={5}
                maxRows={10}
                maxLength={PROFILE_CONTEXT_MAX}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <LimitDisplay used={profileInstructions.length} limit={PROFILE_CONTEXT_MAX} />
                <span>Máximo {PROFILE_CONTEXT_MAX} caracteres.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            {themeControls}

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>

              <Button ref={buttonRef} onClick={handleSave}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
