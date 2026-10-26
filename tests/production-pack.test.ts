import { describe, expect, it } from "vitest";
import { mediaKind, parseProductionPack, publicMediaUrl } from "@/lib/content/production-pack";

describe("existing editorial production packs", () => {
  it("separates exact captions, prompts and Story instructions without losing line breaks", () => {
    const result = parseProductionPack(`SM14-01 | LATEST PRODUCTION PACK
FORMAT: Single image
AI / EDITOR PROMPT:
Create a background. No lettering.
INSTAGRAM CAPTION:
Line one.

Line two: still caption copy.
FACEBOOK CAPTION:
Visit https://app.stadiomate.com/?utm_source=facebook
STORY ADAPTATION (two 1080×1920 frames, reuse artwork):
1. Frame one
2. Frame two
ARCHIVED EARLIER PRODUCTION NOTES (keep sources):
INSTAGRAM CAPTION:
Old copy, not the current caption.`);
    expect(result.sections.find(s => s.title === "INSTAGRAM CAPTION")?.text).toBe("Line one.\n\nLine two: still caption copy.");
    expect(result.sections.find(s => s.title === "FACEBOOK CAPTION")?.text).toContain("https://app.stadiomate.com/");
    expect(result.sections.find(s => s.title.startsWith("STORY ADAPTATION"))?.text).toContain("2. Frame two");
    expect(result.sections.filter(s => s.title === "INSTAGRAM CAPTION")).toHaveLength(1);
    expect(result.archive).toContain("Old copy");
  });
  it("retains old unstructured briefs instead of hiding them", () => {
    expect(parseProductionPack("Film golfer.\nKeep the full club visible.").sections).toEqual([{ title: "Production notes", text: "Film golfer.\nKeep the full club visible." }]);
    expect(parseProductionPack(null).sections).toEqual([]);
  });
  it("preserves the older production pack format", () => {
    const result = parseProductionPack("PRODUCTION PACK 3\nFormat: 5-slide carousel\nExact on-screen sequence:\n1: Title\n2: CTA\nAssets and factual checks: Verify venue.\nExport: editable master");
    expect(result.sections.find(s => s.title === "Exact on-screen sequence")?.text).toBe("1: Title\n2: CTA");
    expect(result.sections.find(s => s.title === "Assets and factual checks")?.text).toBe("Verify venue.");
  });
});

describe("media preview selection", () => {
  it("rejects executable and local URLs", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,test", "file:///private/test", "/tmp/image.png"]) expect(publicMediaUrl(url)).toBeNull();
  });
  it("recognises signed image and video links without using query parameters as extensions", () => {
    expect(mediaKind("https://cdn.example/film.mp4?token=x")).toBe("video");
    expect(mediaKind("https://cdn.example/image.webp?v=1")).toBe("image");
    expect(mediaKind("https://cdn.example/download?file=film.mp4")).toBe("file");
    expect(mediaKind("https://cdn.example/download", "video/mp4")).toBe("video");
    expect(mediaKind("https://cdn.example/guide.pdf", "application/pdf")).toBe("file");
  });
});
