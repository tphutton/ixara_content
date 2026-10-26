export type ProductionSection = { title: string; text: string };

const headings = /^(FORMAT|CAMPAIGN|OBJECTIVE|HOOK|EXACT ON-SCREEN COPY \/ TIMED EDIT|EXACT ON-SCREEN SEQUENCE|VISUAL \/ ASSET DIRECTION|AI \/ EDITOR PROMPT|AUDIO \/ VO|INSTAGRAM CAPTION|FACEBOOK CAPTION|LINK ROUTING|CROSS-BRAND REUSE|STORY ADAPTATION[^:]*|COMMUNITY FOLLOW-UP|MEASUREMENT|FACTUAL \/ ASSET CHECKS|PRODUCTION STANDARD|BATCHING|Assets and factual checks|Export):\s*(.*)$/i;

// Read the existing plain-text packs without changing editorial data or discarding older briefs.
export function parseProductionPack(value: string | null | undefined) {
  const [current = "", ...archiveParts] = (value ?? "").split(/\n\s*ARCHIVED EARLIER PRODUCTION NOTES[^\n]*\n/i);
  const sections: ProductionSection[] = [];
  let section: ProductionSection = { title: "Production notes", text: "" };
  for (const line of current.split("\n")) {
    const match = line.match(headings);
    if (match) {
      if (section.text.trim()) sections.push({ ...section, text: section.text.trim() });
      section = { title: match[1], text: match[2] };
    } else {
      section.text += (section.text ? "\n" : "") + line;
    }
  }
  if (section.text.trim()) sections.push({ ...section, text: section.text.trim() });
  return { sections, archive: archiveParts.join("\n").trim() };
}

export function publicMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function mediaKind(url: string, mime?: string | null, type?: string | null) {
  const pathname = new URL(url).pathname;
  if (mime?.startsWith("video/") || type?.toLowerCase() === "video" || /\.(mp4|webm|mov|m4v)$/i.test(pathname)) return "video";
  if (mime?.startsWith("audio/") || /\.(mp3|wav|ogg)$/i.test(pathname)) return "audio";
  if (mime?.startsWith("image/") || type?.toLowerCase() === "image" || /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(pathname)) return "image";
  return "file";
}
