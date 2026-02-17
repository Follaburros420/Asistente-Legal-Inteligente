import { FileItemChunk } from "@/types"
import { encode } from "gpt-tokenizer"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { CHUNK_OVERLAP, CHUNK_SIZE } from "."

export const processCSV = async (csv: Blob): Promise<FileItemChunk[]> => {
  const text = await csv.text()
  // Parse CSV manually - convert to readable format
  const lines = text.split('\n').filter(line => line.trim())
  const completeText = lines.join('\n\n')

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: ["\n\n"]
  })
  const splitDocs = await splitter.createDocuments([completeText])

  let chunks: FileItemChunk[] = []

  for (let i = 0; i < splitDocs.length; i++) {
    const doc = splitDocs[i]

    chunks.push({
      content: doc.pageContent,
      tokens: encode(doc.pageContent).length
    })
  }

  return chunks
}
