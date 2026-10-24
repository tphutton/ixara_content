import { beforeEach, describe, expect, it } from "vitest";
import { createMetaSelection, readMetaSelection, eligibleMetaPages, selectAuthorizedMetaPage, normalizeInstagramHandle } from "@/lib/social/meta-selection";

const pages = [
  { id: "wrong", name: "Sustainable Golf", access_token: "private-wrong", instagram_business_account: { id: "ig-wrong", username: "sustainablegolf" } },
  { id: "right", name: "StadioMate", access_token: "private-right", instagram_business_account: { id: "ig-right", username: "stadiomate" } },
  { id: "facebook-only", name: "Page only", access_token: "private-fb" },
];
function pending() {
  return createMetaSelection({ accountId: "account", ownerId: "editor", tokenExpiresAt: null, pages });
}
describe("explicit Meta identity selection", () => {
  beforeEach(() => { process.env.SOCIAL_ACCOUNT_ENCRYPTION_KEY = "test-key-for-selection-not-production"; });
  it("encrypts candidates and selects the submitted identity rather than the first page", () => {
    const encrypted = pending();
    expect(encrypted).not.toContain("private-right");
    const saved = readMetaSelection(encrypted, "account", "editor");
    expect(selectAuthorizedMetaPage(saved, saved.id, "right", "instagram").instagram_business_account?.id).toBe("ig-right");
  });
  it("never chooses a default when the submitted selection is blank or unknown", () => {
    const saved = readMetaSelection(pending(), "account", "editor");
    expect(() => selectAuthorizedMetaPage(saved, saved.id, "", "facebook")).toThrow();
    expect(() => selectAuthorizedMetaPage(saved, saved.id, "invented", "facebook")).toThrow();
  });
  it("only offers Instagram identities linked to an authorized Page", () => {
    expect(eligibleMetaPages("instagram", pages).map(p => p.id)).toEqual(["wrong", "right"]);
    const saved = readMetaSelection(pending(), "account", "editor");
    expect(() => selectAuthorizedMetaPage(saved, saved.id, "facebook-only", "instagram")).toThrow();
  });
  it("rejects selections from another editor or account", () => {
    const encrypted = pending();
    expect(() => readMetaSelection(encrypted, "other-account", "editor")).toThrow();
    expect(() => readMetaSelection(encrypted, "account", "other-editor")).toThrow();
  });
  it("rejects an outdated selection form", () => {
    const saved = readMetaSelection(pending(), "account", "editor");
    expect(() => selectAuthorizedMetaPage(saved, "old-selection", "right", "facebook")).toThrow();
  });
  it("rejects expired selection sessions", () => {
    const encrypted = pending();
    const original = Date.now;
    Date.now = () => original() + 11 * 60 * 1000;
    try { expect(() => readMetaSelection(encrypted, "account", "editor")).toThrow(/expired/); }
    finally { Date.now = original; }
  });
  it("normalizes Instagram URLs and handles", () => {
    expect(normalizeInstagramHandle("https://www.instagram.com/stadiomate/")).toBe("@stadiomate");
    expect(normalizeInstagramHandle("stadiomate")).toBe("@stadiomate");
    expect(normalizeInstagramHandle("@stadiomate")).toBe("@stadiomate");
  });
});
