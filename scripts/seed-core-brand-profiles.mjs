import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const profiles = [
  {
    brandName: "StadioMate",
    description:
      "AI-powered sports booking hub for discovering and booking sports facilities, sports experiences, packages, group trips, and events across Asia.",
    positioning:
      "The fast, simple, AI-assisted sports booking platform for athletes, teams, travellers, venues, and tour providers across Southeast Asia.",
    defaultTone: "Clear, energetic, helpful, modern, and commercially confident.",
    targetAudience:
      "Sports players, travelling golfers, teams, group organisers, venues, sports operators, tour providers, and regional partners.",
    preferredWebsites: ["https://stadiomate.com/", "https://chat.stadiomate.com/"],
    sports: ["Golf", "Padel", "Tennis", "Pickleball", "Muay Thai", "Futsal", "Bouldering"],
    regions: ["Southeast Asia", "Asia"],
    countries: ["Thailand", "Singapore", "Indonesia", "Cambodia", "Vietnam", "Malaysia"],
    contentPillars: [
      "AI-powered sports booking",
      "Sports facilities and venues",
      "Golf trips and sports travel",
      "Group events and split payments",
      "Regional sports packages",
      "Athli booking assistant",
    ],
    audiencePersonas: [
      "Travelling golfers planning short breaks",
      "Local players booking facilities",
      "Group organisers arranging sports events",
      "Venues and tour providers seeking distribution",
    ],
    keyOffers: [
      "Book sports facilities and packages across Asia",
      "Compare facilities, packages, and prices",
      "Create events and split payments",
      "Chat with Athli for booking support",
      "List venues and packages with StadioMate",
    ],
    proofPoints: [
      "94 venues, 58 packages, 5 countries, and 15 regions shown on the live site",
      "AI-powered search and smart scheduling",
      "Supports facilities, packages, events, and group payment flows",
    ],
    seoKeywords: [
      "sports booking Asia",
      "golf trips Southeast Asia",
      "AI sports booking",
      "book sports facilities",
      "sports packages Asia",
      "Athli",
      "StadioMate",
    ],
    competitors: ["Traditional tee-time marketplaces", "Manual sports tour operators", "Venue-direct booking flows"],
    voiceExamples: [
      "Tell Athli what you want and compare useful options in minutes.",
      "Book sports and sports packages across Asia with less friction.",
    ],
    visualGuidelines:
      "Use real venue, course, event, travel, and player imagery. Prioritise active, destination-specific images over generic sports visuals.",
    instagramGuidelines:
      "Lead with clear hooks, destination or sport context, useful trip/booking value, and concise CTAs to explore or chat with Athli.",
    facebookGuidelines:
      "Use practical booking, venue, event, and package angles with accessible language for groups and travellers.",
    linkedinGuidelines:
      "Emphasise platform growth, partner distribution, AI booking infrastructure, and operator value.",
    blogGuidelines:
      "Publish useful destination guides, short-trip ideas, venue/package explainers, launch updates, and operator-facing growth stories.",
    emailGuidelines:
      "Keep emails direct and benefit-led, focused on new venues, trip ideas, launch access, or partner opportunities.",
    adGuidelines:
      "Focus on specific sport, destination, price/package value, and a simple booking or enquiry CTA.",
    bannedPhrases: ["revolutionary", "game-changing", "world-class unless specifically substantiated"],
    preferredCTAs: ["Explore StadioMate", "Chat with Athli", "Book your sport", "List with StadioMate"],
  },
  {
    brandName: "Ixara Connect",
    description:
      "Unified B2B partner commerce platform for sports venues, villa operators, booking agents, and experience providers across Southeast Asia.",
    positioning:
      "The partner operating layer for sales, distribution, inventory, quotations, bookings, and AI-enabled commercial workflows across the Ixara ecosystem.",
    defaultTone: "Professional, operational, clear, partner-first, and commercially grounded.",
    targetAudience:
      "Sports venues, villa operators, experience providers, booking agents, resellers, commercial partners, and internal operations teams.",
    preferredWebsites: ["https://connect.ixara.tech/", "https://ixara.tech/"],
    sports: ["Golf", "Sports experiences", "Premium travel", "Hospitality", "Villas"],
    regions: ["Southeast Asia"],
    countries: ["Thailand", "Singapore", "Indonesia", "Cambodia", "Vietnam", "Malaysia"],
    contentPillars: [
      "Partner commerce operations",
      "Inventory and booking workflows",
      "Distribution and reseller enablement",
      "AI-assisted quotations and sales",
      "Commercial data quality",
      "Ixara ecosystem infrastructure",
    ],
    audiencePersonas: [
      "Venue operator managing bookings and distribution",
      "Villa operator packaging stays and experiences",
      "Booking agent creating faster quotations",
      "Internal operator maintaining clean commercial data",
    ],
    keyOffers: [
      "Partner access to inventory, quotations, bookings, and AI distribution tools",
      "Cleaner sales and distribution workflows",
      "AI-enabled operational support for partner commerce",
      "Connected platform access across sports, villas, and experience providers",
    ],
    proofPoints: [
      "Positioned on IxaraTech as the B2B platform powering sales, distribution, and AI for partners",
      "Built for sports venues, villa operators, booking agents, and experience providers",
      "Part of IxaraTech's Southeast Asia experience commerce ecosystem",
    ],
    seoKeywords: [
      "B2B partner commerce",
      "booking operations platform",
      "AI distribution tools",
      "Southeast Asia experience commerce",
      "Ixara Connect",
      "partner booking platform",
    ],
    competitors: ["Manual partner spreadsheets", "Disconnected booking CRMs", "Generic reseller portals"],
    voiceExamples: [
      "Give partners a cleaner way to manage inventory, quotations, bookings, and distribution.",
      "Turn operational data into a more useful commercial layer.",
    ],
    visualGuidelines:
      "Use clean product, dashboard, partner, operations, inventory, and commercial workflow visuals. Avoid overly consumer-travel styling.",
    instagramGuidelines:
      "Use concise partner-value posts, product updates, and operational wins with a B2B tone.",
    facebookGuidelines:
      "Explain practical partner benefits in simple language, especially around reach, bookings, and workflow clarity.",
    linkedinGuidelines:
      "Lead with B2B value, operational efficiency, AI-assisted workflows, data quality, and partner growth across Southeast Asia.",
    blogGuidelines:
      "Publish partner playbooks, operational explainers, product updates, distribution strategy, and ecosystem infrastructure stories.",
    emailGuidelines:
      "Prioritise clear partner outcomes, setup next steps, feature launches, and commercial workflow value.",
    adGuidelines:
      "Target partner operators with specific operational pain points and measurable workflow improvements.",
    bannedPhrases: ["magic", "fully autonomous", "set and forget", "revolutionary"],
    preferredCTAs: ["Request partner access", "Explore Ixara Connect", "Book a partner walkthrough", "Connect with IxaraTech"],
  },
  {
    brandName: "Nollux",
    description:
      "Private villa and luxury travel platform for curated villas, wellness, premium experiences, and AI concierge-assisted trip planning.",
    positioning:
      "Curated luxury stays and experiences across Asia, supported by Astoru, an AI concierge for premium travel planning.",
    defaultTone: "Elegant, calm, premium, personal, concise, and trust-building.",
    targetAudience:
      "Luxury travellers, villa guests, families, private groups, wellness travellers, golf travellers, and high-value leisure customers.",
    preferredWebsites: ["https://nollux.asia/"],
    sports: ["Golf", "Wellness", "Luxury travel", "Private villas", "Experiences"],
    regions: ["Southeast Asia", "Asia"],
    countries: ["Thailand", "Indonesia", "Vietnam", "Malaysia", "Singapore"],
    contentPillars: [
      "Curated villas",
      "Luxury travel planning",
      "Wellness and premium experiences",
      "AI concierge with Astoru",
      "Private group trips",
      "Golf, transport, and personalised itineraries",
    ],
    audiencePersonas: [
      "Luxury traveller seeking curated villa stays",
      "Family or group planning a private escape",
      "Wellness traveller looking for a refined itinerary",
      "Golf traveller combining premium stays with experiences",
    ],
    keyOffers: [
      "Curated villas",
      "Wellness and premium experiences",
      "AI concierge trip support with Astoru",
      "Early access to the new Nollux experience",
    ],
    proofPoints: [
      "Live site positions Nollux around curated villas, wellness, experiences, and Astoru",
      "IxaraTech describes Nollux Asia as luxury villas, seamless bookings, and intelligent travel",
      "Part of the IxaraTech premium travel and experience commerce ecosystem",
    ],
    seoKeywords: [
      "luxury villas Asia",
      "curated villa stays",
      "AI travel concierge",
      "premium travel Asia",
      "wellness experiences",
      "Nollux",
      "Astoru",
    ],
    competitors: ["Luxury villa marketplaces", "Private travel concierges", "Premium experience agencies"],
    voiceExamples: [
      "Curated villas, wellness, and experiences with Astoru, your AI concierge.",
      "Plan a more personal premium stay with intelligent travel support.",
    ],
    visualGuidelines:
      "Use refined, real luxury villa, oceanfront, wellness, dining, transport, and destination imagery. Keep compositions spacious and premium.",
    instagramGuidelines:
      "Lead with visual desire, calm premium copy, destination cues, and concise early-access or enquiry CTAs.",
    facebookGuidelines:
      "Use accessible luxury travel stories for families, private groups, villas, wellness, and experiences.",
    linkedinGuidelines:
      "Focus on premium travel infrastructure, partner ecosystem value, AI concierge strategy, and high-value travel commerce.",
    blogGuidelines:
      "Publish destination guides, villa inspiration, wellness itineraries, premium trip planning, and Astoru concierge stories.",
    emailGuidelines:
      "Keep copy refined and direct: curated villas, early access, destination drops, and personal planning support.",
    adGuidelines:
      "Use specific destination or experience-led luxury propositions with a calm enquiry CTA.",
    bannedPhrases: ["cheap", "budget", "mass-market", "generic luxury", "ultimate unless substantiated"],
    preferredCTAs: ["Join early access", "Explore Nollux", "Plan with Astoru", "Request a private itinerary"],
  },
];

for (const profile of profiles) {
  await prisma.brandProfile.upsert({
    where: { brandName: profile.brandName },
    create: profile,
    update: profile,
  });
  console.log(`Upserted ${profile.brandName}`);
}

await prisma.$disconnect();
