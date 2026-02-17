import { FileItemChunk } from "@/types"
import { encode } from "gpt-tokenizer"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { CHUNK_OVERLAP, CHUNK_SIZE } from "."

export const processJSON = async (json: Blob): Promise<FileItemChunk[]> => {
  const text = await json.text()
  const data = JSON.parse(text)
  // Convert JSON to readable text format
  const completeText = typeof data === 'string' 
    ? data 
    : JSON.stringify(data, null, 2)

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP
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
