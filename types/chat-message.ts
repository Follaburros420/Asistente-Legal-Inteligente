import { Tables } from "@/supabase/types";
import { ModelAnswer } from "./model-answer";
import { LegalDraft } from "./draft";

export interface BibliographyItem {
  id?: string;
  title: string;
  url: string;
  type?: string;
  source?: string;
  description?: string;
}

export interface ChatMessage {
  message: Tables<"messages">;
  fileItems: string[];
  bibliography?: BibliographyItem[];
  answer?: ModelAnswer;
  thinking?: string; // Proceso de razonamiento del agente (streaming)
  draft?: LegalDraft; // Borrador legal estructurado
}
