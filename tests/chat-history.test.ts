import { describe, expect, it } from "vitest";
import { restoreChronologicalOrder } from "@/lib/ai/chat-service";

describe("restoreChronologicalOrder", () => {
  it("turns the latest database window back into conversation order", () => {
    const newestFirst = ["newest", "middle", "oldest"];

    expect(restoreChronologicalOrder(newestFirst)).toEqual(["oldest", "middle", "newest"]);
    expect(newestFirst).toEqual(["newest", "middle", "oldest"]);
  });
});
