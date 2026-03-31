import { prisma } from "@/lib/prisma";

type BrandProfileMatch = Awaited<ReturnType<typeof findBrandProfileByName>>;

type ContentRuleInput = {
  brand: string | null;
  cta: string | null;
  tone: string | null;
  targetAudience: string | null;
  websites: string[];
  sport: string | null;
  region: string | null;
  country: string | null;
  title: string;
  body: string | null;
  hook: string | null;
  sourcePrompt: string | null;
};

type BlogRuleInput = {
  brand: string | null;
  websites: string[];
  sport: string | null;
  region: string | null;
  country: string | null;
  title: string;
  sourcePrompt: string | null;
  text1?: string | null;
  text2?: string | null;
  text3?: string | null;
  text4?: string | null;
  text5?: string | null;
  text6?: string | null;
  text7?: string | null;
  text8?: string | null;
};

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

async function findBrandProfileByName(brandName: string | null) {
  if (!brandName) {
    return null;
  }

  return prisma.brandProfile.findFirst({
    where: {
      brandName: {
        equals: brandName,
        mode: "insensitive",
      },
    },
  });
}

function collectBannedPhraseWarnings(
  profile: BrandProfileMatch,
  fields: Array<{ label: string; value: string | null | undefined }>,
) {
  if (!profile || profile.bannedPhrases.length === 0) {
    return [];
  }

  const warnings: string[] = [];

  for (const phrase of profile.bannedPhrases) {
    const loweredPhrase = phrase.toLowerCase();

    for (const field of fields) {
      if (field.value && field.value.toLowerCase().includes(loweredPhrase)) {
        warnings.push(`"${phrase}" appears in ${field.label}`);
      }
    }
  }

  return warnings;
}

export async function applyBrandRulesToContent<T extends ContentRuleInput>(input: T) {
  const profile = await findBrandProfileByName(input.brand);

  if (!profile) {
    return {
      data: input,
      profile: null,
      warnings: [] as string[],
    };
  }

  const data = {
    ...input,
    cta: input.cta ?? profile.preferredCTAs[0] ?? null,
    tone: input.tone ?? profile.defaultTone ?? null,
    targetAudience: input.targetAudience ?? profile.targetAudience ?? null,
    websites: input.websites.length > 0 ? dedupeStrings(input.websites) : profile.preferredWebsites,
    sport: input.sport ?? (profile.sports.length === 1 ? profile.sports[0] : null),
    region: input.region ?? (profile.regions.length === 1 ? profile.regions[0] : null),
    country: input.country ?? (profile.countries.length === 1 ? profile.countries[0] : null),
  } as T;

  return {
    data,
    profile,
    warnings: collectBannedPhraseWarnings(profile, [
      { label: "title", value: input.title },
      { label: "hook", value: input.hook },
      { label: "body", value: input.body },
      { label: "call to action", value: input.cta },
      { label: "source prompt", value: input.sourcePrompt },
    ]),
  };
}

export async function applyBrandRulesToBlog<T extends BlogRuleInput>(input: T) {
  const profile = await findBrandProfileByName(input.brand);

  if (!profile) {
    return {
      data: input,
      profile: null,
      warnings: [] as string[],
    };
  }

  const data = {
    ...input,
    websites: input.websites.length > 0 ? dedupeStrings(input.websites) : profile.preferredWebsites,
    sport: input.sport ?? (profile.sports.length === 1 ? profile.sports[0] : null),
    region: input.region ?? (profile.regions.length === 1 ? profile.regions[0] : null),
    country: input.country ?? (profile.countries.length === 1 ? profile.countries[0] : null),
  } as T;

  return {
    data,
    profile,
    warnings: collectBannedPhraseWarnings(profile, [
      { label: "title", value: input.title },
      { label: "section 1", value: input.text1 },
      { label: "section 2", value: input.text2 },
      { label: "section 3", value: input.text3 },
      { label: "section 4", value: input.text4 },
      { label: "section 5", value: input.text5 },
      { label: "section 6", value: input.text6 },
      { label: "section 7", value: input.text7 },
      { label: "section 8", value: input.text8 },
      { label: "source prompt", value: input.sourcePrompt },
    ]),
  };
}
