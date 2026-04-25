/**
 * Extract text from uploaded resume files (PDF or DOCX).
 *
 * PDF:  Uses pdf-parse v2 class-based API (PDFParse).
 * DOCX: Uses mammoth.convertToHtml() so hyperlink URLs are preserved,
 *       then strips HTML while keeping link targets inline.
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    return extractDocxText(buffer);
  }
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}

/* ------------------------------------------------------------------ */
/*  PDF — pdf-parse v2 (class-based API)                               */
/* ------------------------------------------------------------------ */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/*  DOCX — mammoth + HTML-to-text (preserves hyperlinks)               */
/* ------------------------------------------------------------------ */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const { default: mammoth } = await import("mammoth");

  // 1. Convert to HTML so we keep <a href="..."> links
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const html = htmlResult.value;

  // 2. Turn <a href="url">text</a>  →  text (url)
  //    so the LLM can see every hyperlink even when the visible text is just a label.
  const withLinks = html.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_match: string, href: string, text: string) => {
      const plainText = stripTags(text).trim();
      // Avoid duplicating the URL if the visible text already IS the URL
      if (plainText === href || `${plainText}/` === href || plainText === `${href}/`) {
        return plainText;
      }
      return href ? `${plainText} (${href})` : plainText;
    },
  );

  // 3. Replace block-level tags with newlines, strip remaining tags
  const text = stripTags(withLinks);

  // 4. Also grab the pure raw text for sections that mammoth might format oddly
  const rawResult = await mammoth.extractRawText({ buffer });
  const rawText = rawResult.value;

  // 5. Merge: use HTML-based text as primary (has links), append raw text
  //    so the LLM has both perspectives.  Deduplicate is handled by smartTruncate
  //    in parse.ts if the combined text is too long.
  return `${text}\n\n--- RAW TEXT (for cross-reference) ---\n\n${rawText}`;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|h[1-6]|tr|li|blockquote|section|article|header|footer|hr)[^>]*>/gi, "\n")
    .replace(/<\/?(ul|ol|table|thead|tbody|tfoot)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
