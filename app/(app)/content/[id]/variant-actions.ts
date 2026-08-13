"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import { generateContentVariants } from "@/lib/content-variants/generate";

export async function generateContentVariantsAction(id: string) {
  const access = await requireApprovedUserAccess();
  await generateContentVariants({
    contentId: id,
    access,
    source: "manual",
  });

  revalidatePath(`/content/${id}`);
}
