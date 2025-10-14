import { supabase } from "@/lib/supabase/robust-client"
import { Tables } from "@/supabase/types"

export interface CollectionWithFiles {
  id: string
  name: string
  description: string | null
  files: Tables<"files">[]
}

/**
 * Obtiene todos los archivos de una colección específica
 */
export async function getCollectionFiles(collectionId: string): Promise<CollectionWithFiles | null> {
  try {
    // Primero obtener la información de la colección
    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .select("*")
      .eq("id", collectionId)
      .single()

    if (collectionError) {
      console.error("Error obteniendo colección:", collectionError)
      return null
    }

    if (!collection) {
      return null
    }

    // Obtener los archivos de la colección a través de collection_files
    const { data: collectionFiles, error: filesError } = await supabase
      .from("collection_files")
      .select(`
        file_id,
        files (
          id,
          name,
          type,
          description,
          file_path,
          size,
          tokens,
          user_id,
          created_at,
          updated_at
        )
      `)
      .eq("collection_id", collectionId)

    if (filesError) {
      console.error("Error obteniendo archivos de la colección:", filesError)
      return null
    }

    // Extraer los archivos del resultado
    const files = collectionFiles
      ?.map(cf => cf.files)
      .filter(file => file !== null) as Tables<"files">[] || []

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      files
    }
  } catch (error) {
    console.error("Error en getCollectionFiles:", error)
    return null
  }
}

/**
 * Obtiene todas las colecciones con sus archivos
 */
export async function getAllCollectionsWithFiles(): Promise<CollectionWithFiles[]> {
  try {
    const { data: collections, error: collectionsError } = await supabase
      .from("collections")
      .select("*")
      .order("name")

    if (collectionsError) {
      console.error("Error obteniendo colecciones:", collectionsError)
      return []
    }

    if (!collections) {
      return []
    }

    // Para cada colección, obtener sus archivos
    const collectionsWithFiles = await Promise.all(
      collections.map(async (collection) => {
        const collectionWithFiles = await getCollectionFiles(collection.id)
        return collectionWithFiles || {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          files: []
        }
      })
    )

    return collectionsWithFiles
  } catch (error) {
    console.error("Error en getAllCollectionsWithFiles:", error)
    return []
  }
}

/**
 * Obtiene los IDs de archivos de una colección
 */
export async function getCollectionFileIds(collectionId: string): Promise<string[]> {
  try {
    const { data: collectionFiles, error } = await supabase
      .from("collection_files")
      .select("file_id")
      .eq("collection_id", collectionId)

    if (error) {
      console.error("Error obteniendo IDs de archivos:", error)
      return []
    }

    return collectionFiles?.map(cf => cf.file_id) || []
  } catch (error) {
    console.error("Error en getCollectionFileIds:", error)
    return []
  }
}
