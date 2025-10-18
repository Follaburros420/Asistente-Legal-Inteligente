import { Tables } from "@/supabase/types"

export interface BibliographyItem {
  title: string
  url: string
  type: string
}

export interface ChatMessage {
  message: Tables<"messages">
  fileItems: string[]
  bibliography?: BibliographyItem[]
}
