export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    const mod = await import("pdf-parse");
    const pdfParse = (mod as { default?: (b: Buffer) => Promise<{ text: string }> }).default ??
      (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
    const out = await pdfParse(buffer);
    return out.text;
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const { default: mammoth } = await import("mammoth");
    const out = await mammoth.extractRawText({ buffer });
    return out.value;
  }
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}
