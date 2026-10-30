/**
 * Shared PDF text extraction (pdf-parse v2 API).
 * Returns { text, pages } or throws if nothing readable — callers decide the
 * honest user-facing message.
 */
export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = (result.text ?? "").replace(/\u0000/g, "").trim();
    const pages = Array.isArray(result.pages) ? result.pages.length : Number((result as { numpages?: number }).numpages ?? 0);
    return { text, pages };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
