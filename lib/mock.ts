// Mock data for the MindLab prototype. Realistic, calm, product-specific.

export const today = new Date(2026, 4, 1); // May 1, 2026

export const checkInStates = [
  { id: "calm", label: "Calm", color: "hsl(187 100% 50%)" },
  { id: "anxious", label: "Anxious", color: "hsl(32 90% 60%)" },
  { id: "tense", label: "Tense", color: "hsl(12 80% 55%)" },
  { id: "overwhelmed", label: "Overwhelmed", color: "hsl(280 50% 60%)" },
  { id: "numb", label: "Numb", color: "hsl(216 11% 55%)" },
] as const;

export const surfacingNow = [
  {
    kind: "Unfinished Thread",
    title: "The conversation with Mara, still unresolved",
    body: "You wrote about it Tuesday night. You haven't returned to it.",
    meta: "Last touched · 3 days ago",
  },
  {
    kind: "Active Tension",
    title: "Wanting depth · Wanting space",
    body: "Surfaced again in last night's check-in. Sixth time this month.",
    meta: "Active · 22 days",
  },
  {
    kind: "Recent Pattern",
    title: "Late-evening rumination after social plans",
    body: "Appeared four times in the past two weeks.",
    meta: "Strength · High",
  },
];

export const journalEntries = [
  { id: "e1", date: "May 1", title: "The shape of a quiet morning", preview: "Woke before the alarm. Sat with coffee for forty minutes without reaching for anything…", mood: "Calm", tag: "Morning" },
  { id: "e2", date: "Apr 30", title: "After the call with Mara", preview: "There's a particular flavor of disappointment that comes from being almost-understood…", mood: "Tense", tag: "Relationship" },
  { id: "e3", date: "Apr 29", title: "Notes from a long walk", preview: "Three loops of the reservoir. The wind was doing that thing it does in late April…", mood: "Calm", tag: "Walk" },
  { id: "e4", date: "Apr 28", title: "Why does Sunday night feel like this", preview: "It's not the work itself. It's the contraction of the open hours into something narrower…", mood: "Anxious", tag: "Evening" },
  { id: "e5", date: "Apr 27", title: "Reading Berger again", preview: "He keeps catching me on the same sentence. About the way we look at things we love…", mood: "Calm", tag: "Reading" },
  { id: "e6", date: "Apr 26", title: "The Saturday inventory", preview: "Tried the weekly review I keep abandoning. Got eleven minutes in before drifting…", mood: "Numb", tag: "Review" },
  { id: "e7", date: "Apr 25", title: "Small grief, late afternoon", preview: "The light came in low through the kitchen and I thought of my grandmother…", mood: "Tense", tag: "Memory" },
  { id: "e8", date: "Apr 24", title: "A note before the meeting", preview: "I want to be clear without being defensive. Soft without being apologetic…", mood: "Anxious", tag: "Work" },
];

export const journalChatSessions = [
  { id: "jc1", date: "May 1", title: "Sitting with the morning's quiet", turns: 8 },
  { id: "jc2", date: "Apr 29", title: "Unpacking the call with Mara", turns: 14 },
  { id: "jc3", date: "Apr 26", title: "What the Sunday weight is made of", turns: 11 },
  { id: "jc4", date: "Apr 22", title: "When 'fine' is doing too much work", turns: 6 },
  { id: "jc5", date: "Apr 18", title: "On the resistance to rest", turns: 9 },
];

export const exploreSessions = [
  { id: "ex1", date: "Apr 30", title: "Wanting depth · Wanting space", turns: 22, context: "From Tension" },
  { id: "ex2", date: "Apr 27", title: "Late-evening rumination", turns: 17, context: "From Pattern" },
  { id: "ex3", date: "Apr 23", title: "What if 'productive' isn't the frame", turns: 9, context: null },
  { id: "ex4", date: "Apr 19", title: "Re-reading my December entries", turns: 31, context: "From Journal" },
];

export const patterns = [
  { id: "p1", title: "Late-evening rumination after social plans", strength: "High", seen: 14, summary: "Reflective intensity rises in the 90 minutes following social engagements, often spilling into rumination by midnight.", linkedTension: "Wanting depth · Wanting space", linkedAction: "Quiet wind-down ritual" },
  { id: "p2", title: "Morning clarity, evening contraction", strength: "Medium", seen: 9, summary: "The expansive feeling that opens the day reliably narrows by 6pm, often without an external trigger.", linkedTension: "Openness · Containment", linkedAction: "Mid-afternoon check-in" },
  { id: "p3", title: "Avoidance loops around financial review", strength: "Medium", seen: 6, summary: "Tasks tagged 'finance' get touched, postponed, and re-tagged across multiple sessions before completion.", linkedTension: "Want to know · Don't want to see", linkedAction: "Twenty-minute review window" },
  { id: "p4", title: "Reading appears before transitions", strength: "Low", seen: 4, summary: "Long reading sessions cluster in the days before significant calendar shifts.", linkedTension: null, linkedAction: "Permit the drift" },
];

export const tensions = [
  { id: "t1", title: "Wanting depth · Wanting space", pullA: "Wanting depth", pullB: "Wanting space", status: "active", days: 22, summary: "A recurring pull between the desire for close, sustained connection and the equally strong need for unstructured solitude." },
  { id: "t2", title: "Building forward · Honoring the present", pullA: "Build forward", pullB: "Stay present", status: "active", days: 41, summary: "Ambition and presence arriving as competing claims on the same hour." },
  { id: "t3", title: "Want to know · Don't want to see", pullA: "Want to know", pullB: "Don't want to see", status: "active", days: 14, summary: "Curiosity and avoidance circling the same set of facts about money and time." },
  { id: "t4", title: "Speak plainly · Stay generous", pullA: "Speak plainly", pullB: "Stay generous", status: "dormant", days: 3, summary: "The pull between directness and warmth in difficult conversations." },
];

export const actions = {
  stabilize: [
    { id: "a1", title: "Quiet wind-down · 20 minutes", basedOn: "Late-evening rumination", description: "After the next social evening, give yourself a single low-stimulation activity before bed. No second screen.", time: "20m", type: "Ritual" },
    { id: "a2", title: "One sentence to Mara", basedOn: "Unfinished thread", description: "Not a full reply. One honest line, sent or unsent. The shape matters more than the recipient.", time: "5m", type: "Gesture" },
    { id: "a3", title: "Name the pull aloud", basedOn: "Wanting depth · Wanting space", description: "When the tension surfaces today, say both pulls out loud. Don't resolve them. Just witness.", time: "2m", type: "Notice" },
  ],
  build: [
    { id: "a4", title: "Twenty-minute review window", basedOn: "Avoidance loops · Finance", description: "Set a single twenty-minute container this week. End on the timer regardless of what's done.", time: "20m", type: "Experiment" },
    { id: "a5", title: "Write the December re-read", basedOn: "Re-reading old entries", description: "What did past-you know that present-you forgot? One paragraph.", time: "15m", type: "Reflection" },
    { id: "a6", title: "Mid-afternoon check-in", basedOn: "Morning clarity, evening contraction", description: "A 90-second pause at 3pm, before the contraction sets in. State only.", time: "2m", type: "Ritual" },
  ],
};

export const checkInHistory = [
  { date: "May 1", items: [
    { time: "08:14", state: "Calm", tag: "Morning", note: "Coffee. No phone." },
    { time: "13:02", state: "Tense", tag: "Work", note: null },
  ]},
  { date: "Apr 30", items: [
    { time: "22:41", state: "Anxious", tag: "After call", note: "Mara." },
    { time: "17:50", state: "Calm", tag: "Walk", note: null },
    { time: "08:30", state: "Calm", tag: "Morning", note: null },
  ]},
  { date: "Apr 29", items: [
    { time: "21:10", state: "Numb", tag: "Evening", note: null },
    { time: "09:00", state: "Calm", tag: "Morning", note: null },
  ]},
  { date: "Apr 28", items: [
    { time: "23:20", state: "Overwhelmed", tag: "Sunday", note: "The contraction feeling again." },
  ]},
];

export type LibraryItem = {
  id: string;
  type: "Journal" | "Journal Chat" | "Explore" | "Check-in";
  date: string;
  sortKey: number; // higher = newer
  title: string;
  preview: string | null;
  mood: string | null;
  tags: string[];
  signals: number; // count of linked patterns/tensions/threads
  linked: { kind: "Pattern" | "Tension" | "Thread"; label: string }[];
};

export const libraryItems: LibraryItem[] = [
  { id: "l1", type: "Journal", date: "May 1", sortKey: 501, title: "The shape of a quiet morning", preview: "Woke before the alarm. Sat with coffee for forty minutes…", mood: "Calm", tags: ["morning", "reading"], signals: 1, linked: [{ kind: "Pattern", label: "Morning clarity" }] },
  { id: "l2", type: "Journal Chat", date: "May 1", sortKey: 500, title: "Sitting with the morning's quiet", preview: "8 turns · Guided reflection", mood: "Calm", tags: ["morning"], signals: 0, linked: [] },
  { id: "l3", type: "Explore", date: "Apr 30", sortKey: 430, title: "Wanting depth · Wanting space", preview: "22 turns · Open exploration", mood: null, tags: ["relationship"], signals: 1, linked: [{ kind: "Tension", label: "Wanting depth · Wanting space" }] },
  { id: "l4", type: "Journal", date: "Apr 30", sortKey: 429, title: "After the call with Mara", preview: "There's a particular flavor of disappointment…", mood: "Tense", tags: ["relationship", "evening"], signals: 2, linked: [{ kind: "Tension", label: "Speak plainly · Stay generous" }, { kind: "Thread", label: "Mara, unresolved" }] },
  { id: "l5", type: "Check-in", date: "Apr 30", sortKey: 428, title: "Anxious · After call", preview: "Mara.", mood: "Anxious", tags: ["relationship"], signals: 1, linked: [{ kind: "Thread", label: "Mara, unresolved" }] },
  { id: "l6", type: "Journal", date: "Apr 29", sortKey: 420, title: "Notes from a long walk", preview: "Three loops of the reservoir. The wind was doing that thing…", mood: "Calm", tags: ["walk"], signals: 0, linked: [] },
  { id: "l7", type: "Journal Chat", date: "Apr 29", sortKey: 419, title: "Unpacking the call with Mara", preview: "14 turns · Guided reflection", mood: "Tense", tags: ["relationship"], signals: 1, linked: [{ kind: "Tension", label: "Speak plainly · Stay generous" }] },
  { id: "l8", type: "Journal", date: "Apr 28", sortKey: 410, title: "Why does Sunday night feel like this", preview: "It's not the work itself…", mood: "Anxious", tags: ["evening", "work"], signals: 1, linked: [{ kind: "Pattern", label: "Sunday contraction" }] },
  { id: "l9", type: "Explore", date: "Apr 27", sortKey: 400, title: "Late-evening rumination", preview: "17 turns · Open exploration", mood: null, tags: ["evening"], signals: 1, linked: [{ kind: "Pattern", label: "Late-evening rumination" }] },
  { id: "l10", type: "Check-in", date: "Apr 27", sortKey: 399, title: "Calm · Walk", preview: null, mood: "Calm", tags: ["walk"], signals: 0, linked: [] },
  { id: "l11", type: "Journal", date: "Apr 27", sortKey: 398, title: "Reading Berger again", preview: "He keeps catching me on the same sentence…", mood: "Calm", tags: ["reading"], signals: 0, linked: [] },
  { id: "l12", type: "Journal", date: "Apr 25", sortKey: 380, title: "Small grief, late afternoon", preview: "The light came in low through the kitchen…", mood: "Tense", tags: ["memory"], signals: 0, linked: [] },
  { id: "l13", type: "Check-in", date: "Apr 24", sortKey: 370, title: "Overwhelmed · Sunday", preview: "The contraction feeling again.", mood: "Overwhelmed", tags: ["evening"], signals: 1, linked: [{ kind: "Pattern", label: "Sunday contraction" }] },
  { id: "l14", type: "Journal", date: "Apr 22", sortKey: 360, title: "A note before the meeting", preview: "I want to be clear without being defensive…", mood: "Anxious", tags: ["work"], signals: 1, linked: [{ kind: "Tension", label: "Speak plainly · Stay generous" }] },
  { id: "l15", type: "Journal Chat", date: "Apr 22", sortKey: 359, title: "When 'fine' is doing too much work", preview: "6 turns · Guided reflection", mood: "Numb", tags: ["work"], signals: 0, linked: [] },
];

export const journalChatTranscript = [
  { role: "system", text: "Let's start where you are. What's most present this morning?" },
  { role: "user", text: "I woke up earlier than I needed to. The quiet was the first thing I noticed — and then how quickly I wanted to fill it." },
  { role: "system", text: "What did the wanting-to-fill-it feel like in your body?" },
  { role: "user", text: "Tightness behind the sternum. A small forward-lean. Like there was something I was about to be late for, except there wasn't." },
  { role: "system", text: "That forward-lean has shown up in a few of your recent entries. Would it help to look at what was usually waiting on the other side of it?" },
];

export const exploreTranscript = [
  { role: "user", text: "I want to think out loud about the depth/space tension. Not solve it. Just look at it from a few angles." },
  { role: "system", text: "Then let's look at it. When you say 'depth,' is it depth of contact with one person, or depth of attention in general?" },
  { role: "user", text: "Mostly the first. With Mara, specifically. I want to be known carefully, and I also want there to be a door that I can close." },
  { role: "system", text: "Two desires that aren't actually opposites — though they're being treated as if they are. What would it look like if both were true at once?" },
];
