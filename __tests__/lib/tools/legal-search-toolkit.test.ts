jest.mock("@/lib/tools/search/serper-legal-search", () => ({
  searchLegalColombia: jest.fn(async () => [{ title: "ok", url: "https://test.gov.co", snippet: "s" }]),
  searchJurisprudencia: jest.fn(async () => [{ title: "juris", url: "https://test.gov.co", snippet: "s" }]),
  searchArticuloLey: jest.fn(async () => []),
  formatSearchResultsForLLM: jest.fn(() => "formatted-results")
}))

import {
  LEGAL_TOOLS_DEFINITIONS,
  executeTool
} from "@/lib/tools/legal/legal-search-toolkit"
import {
  searchLegalColombia,
  searchJurisprudencia,
  searchArticuloLey,
  formatSearchResultsForLLM
} from "@/lib/tools/search/serper-legal-search"

describe("legal-search-toolkit", () => {
  beforeEach(() => {
    ;(searchLegalColombia as jest.Mock).mockResolvedValue([
      { title: "ok", url: "https://test.gov.co", snippet: "s" }
    ])
    ;(searchJurisprudencia as jest.Mock).mockResolvedValue([
      { title: "juris", url: "https://test.gov.co", snippet: "s" }
    ])
    ;(searchArticuloLey as jest.Mock).mockResolvedValue([])
    ;(formatSearchResultsForLLM as jest.Mock).mockReturnValue("formatted-results")
  })

  test("defines 4 legal tools", () => {
    expect(LEGAL_TOOLS_DEFINITIONS).toHaveLength(4)
  })

  test("executeTool runs search_legal_official with validated args", async () => {
    const result = await executeTool("search_legal_official", {
      query: "  ley 80   contratacion publica  ",
      num_results: 3
    })

    expect(result).toBe("formatted-results")
    expect(searchLegalColombia).toHaveBeenCalledWith("ley 80 contratacion publica", {
      numResults: 3,
      includeAcademic: false
    })
  })

  test("executeTool rejects unknown tool", async () => {
    const result = await executeTool("unknown_tool", { query: "x" })
    expect(result).toContain("Error en herramienta")
  })

  test("executeTool rejects extra fields by strict schema", async () => {
    const result = await executeTool("search_jurisprudencia", {
      query: "tutela salud",
      tribunal: "all",
      bad: true
    })

    expect(result).toContain("Error en herramienta")
    expect(searchJurisprudencia).not.toHaveBeenCalled()
  })

  test("executeTool validates required args in buscar_articulo_ley", async () => {
    const missingNorma = await executeTool("buscar_articulo_ley", { articulo: "25" })
    expect(missingNorma).toContain("Error en herramienta")

    const success = await executeTool("buscar_articulo_ley", {
      articulo: "25",
      norma: "Constitucion Politica"
    })
    expect(searchArticuloLey).toHaveBeenCalledWith("25", "Constitucion Politica")
    expect(success).toContain("No se encontro el articulo")
  })
})
