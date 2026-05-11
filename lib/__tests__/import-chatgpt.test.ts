import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  ImportChatGptError,
  IMPORTED_CONTRADICTION_SIDE_FANOUT_CAP,
  ImportRefCache,
  applyImportedContradictionFanoutGuard,
  MAX_IMPORT_FILE_BYTES,
  classifyImportHumanRelevance,
  classifyImportedContradictionPair,
  extractChatGptConversations,
  extractReferenceFromImportedMessage,
  importChatGptExport,
  parseJsonSafe,
  validateImportFile,
} from "../import-chatgpt";

const SAMPLE_EXPORT = [
  {
    title: "Morning plan",
    mapping: {
      a: {
        message: {
          author: { role: "user" },
          create_time: 1730000000,
          content: { parts: ["I skipped the gym and procrastinated today."] },
        },
      },
      b: {
        message: {
          author: { role: "assistant" },
          create_time: 1730000010,
          content: { parts: ["Thanks for sharing."] },
        },
      },
    },
  },
];

describe("import-chatgpt extraction", () => {
  it("extracts conversations/messages from mapping shape", () => {
    const result = extractChatGptConversations(SAMPLE_EXPORT);

    expect(result.errors).toEqual([]);
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0]?.title).toBe("Morning plan");
    expect(result.conversations[0]?.messages).toHaveLength(2);
    expect(result.conversations[0]?.messages[0]?.role).toBe("user");
    expect(result.conversations[0]?.messages[1]?.role).toBe("assistant");
  });

  it("captures per-conversation errors and continues", () => {
    const result = extractChatGptConversations([{}, ...SAMPLE_EXPORT]);
    expect(result.conversations).toHaveLength(1);
    expect(result.errors[0]).toContain("Conversation 1");
  });
});

describe("classifyImportHumanRelevance", () => {
  it("rejects terminal/finder question chatter", () => {
    const result = classifyImportHumanRelevance(
      "do i need to do that in the terminal? i can do that myself in the finder"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("low_context_technical_question");
  });

  it("rejects vector store retriever question chatter", () => {
    const result = classifyImportHumanRelevance(
      "is there an intermediary i need to connect the vector store retriever and chatopen ai"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("low_context_technical_question");
  });

  it("rejects db seed command question chatter", () => {
    const result = classifyImportHumanRelevance(
      "dont i need to do this first: \"db:seed\": \"node prisma/seed.cjs\""
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("low_context_technical_question");
    expect(result.reasons).toContain("tutorial_or_setup_chatter");
  });

  it("rejects Codex result/form-submit workflow chatter", () => {
    const result = classifyImportHumanRelevance(
      "bro wtf... I WANT TO SHOW CODEX THE RESULTS from the form-submit route before we continue."
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("codex_workflow_chatter");
  });

  it("rejects generic project-task conversion chatter", () => {
    const result = classifyImportHumanRelevance(
      "it looks like i need to turn this into this"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("project_task_chatter");
  });

  it("rejects Codex delegation chatter", () => {
    const result = classifyImportHumanRelevance(
      "Bruv codex needs to do half of this shit"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("codex_workflow_chatter");
  });

  it("rejects tutorial pace/debug coordination chatter", () => {
    const result = classifyImportHumanRelevance(
      "we are following the tutorial and the form submit route is still failing during debugging."
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("tutorial_or_setup_chatter");
    expect(result.reasons).toContain("implementation_debug_chatter");
  });

  it("rejects implementation status chatter", () => {
    const result = classifyImportHumanRelevance(
      "Memory governance hardened is complete."
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("implementation_debug_chatter");
  });

  it("rejects terminal install output", () => {
    const result = classifyImportHumanRelevance(
      "user@macbook ~ % pip3 install openai requests python-dotenv\nCollecting openai"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("technical_or_terminal_noise");
  });

  it("rejects Telegram polling/API log output", () => {
    const result = classifyImportHumanRelevance(
      "[INFO] polling getUpdates offset=99331\nTelegram bot API response payload: {\"ok\":true,\"result\":[]}"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("technical_or_terminal_noise");
  });

  it("rejects source-code-heavy navbar snippets", () => {
    const result = classifyImportHumanRelevance(
      "const Navbar = () => {\n  return <nav className=\"w-full p-4\">Home</nav>;\n};\nexport default Navbar;"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("code_or_stacktrace_noise");
  });

  it("rejects Azure sign-out debug-only messages", () => {
    const result = classifyImportHumanRelevance(
      "Azure sign-out redirect failed with status code 500. DEBUG: msal callback token mismatch."
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("technical_or_terminal_noise");
  });

  it("rejects terminal/modelfile setup chatter", () => {
    const result = classifyImportHumanRelevance(
      "i need to update the modelfile but cant remember how we opened it in the terminall"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("project_task_chatter");
  });

  it("rejects change-back instruction workflow question chatter", () => {
    const result = classifyImportHumanRelevance(
      "so do i need to change back? to match antonio then and i dont udnerstand your instructions anyway"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("low_context_technical_question");
  });

  it("rejects failed-query/status output chatter", () => {
    const result = classifyImportHumanRelevance(
      "reply to who saying DONE - trying the form now? Failed query: INSERT INTO Category (name) VALUES ('x')"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("code_or_stacktrace_noise");
  });

  it("rejects generic download workflow question chatter", () => {
    const result = classifyImportHumanRelevance(
      "Bruh im not reading all that, do i need to downlaod it or nto"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("low_context_technical_question");
  });

  it("rejects low-context navigation task chatter", () => {
    const result = classifyImportHumanRelevance(
      "okay so how many pages forward do i need to go this was 120"
    );

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("low_context_technical_question");
  });

  it("accepts emotionally meaningful project frustration", () => {
    const result = classifyImportHumanRelevance(
      "I get frustrated when instructions are unclear and I lose trust in the process."
    );

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual(["import_human_relevance_accepted"]);
  });

  it("accepts sequential-process need", () => {
    const result = classifyImportHumanRelevance(
      "I need the work to stay sequential because otherwise I cannot track what is happening."
    );

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual(["import_human_relevance_accepted"]);
  });

  it("accepts MindLab product thesis/value statement", () => {
    const result = classifyImportHumanRelevance(
      "I want MindLab to reveal patterns and help me understand myself, not just manage tasks."
    );

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual(["import_human_relevance_accepted"]);
  });

  it("accepts overcomplication-under-uncertainty statement", () => {
    const result = classifyImportHumanRelevance(
      "I keep overcomplicating the project when I feel uncertain."
    );

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual(["import_human_relevance_accepted"]);
  });

  it("accepts need for control/visibility statement", () => {
    const result = classifyImportHumanRelevance(
      "I need control and visibility over the process or I start reacting emotionally."
    );

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual(["import_human_relevance_accepted"]);
  });
});

describe("classifyImportedContradictionPair", () => {
  it("rejects ethnic/cultural reflection paired with Stripe/Telegram MVP chatter", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I feel a deep responsibility for ethnic and cultural survival.",
      sideB: "We need to wire Stripe and Telegram to ship the MVP implementation.",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_project_task_pair");
    expect(result.reasons).toContain("contradiction_cross_topic_pair");
  });

  it("rejects assistant/code-process frustration paired with payment/persona planning", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I feel frustrated with the assistant and code process.",
      sideB: "Next we implement payment flow and creator persona onboarding.",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_project_task_pair");
  });

  it("rejects low-context task question pairs", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I must protect my focus and keep things coherent.",
      sideB: "do i need to do that in the terminal? i can do that myself in the finder",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_low_context_pair");
  });

  it("rejects pasted implementation plan paired with philosophical reflection", () => {
    const result = classifyImportedContradictionPair({
      sideA:
        "Context: migration\nGoal: ship the route\nScope: prisma schema + webhook setup\nImplementation requirements: wire db and deploy",
      sideB: "I value coherence and reducing self-deception.",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_pasted_plan_pair");
  });

  it("rejects code/debug setup chatter pairs", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I must keep the API stable for this deploy.",
      sideB: "The Prisma migration is failing and route debug setup is broken again.",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_project_task_pair");
  });

  it("rejects copied-code paired with bolt/supabase/firebase chatter", () => {
    const result = classifyImportedContradictionPair({
      sideA: "NO i didnt fix it, i just copied his code...",
      sideB: "Using Bolt plus Supabase or Firebase...",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_project_task_pair");
  });

  it("rejects code-process complaint paired with new-folder coordination chatter", () => {
    const result = classifyImportedContradictionPair({
      sideA: "no okay i'm glad you understand it but i said that i want to go into it...",
      sideB: "You're saying I called it. I'm missing the new folder...",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_project_task_pair");
  });

  it("rejects prosocial intent paired with codebase complaint chatter", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I want to do what needs to be done for us",
      sideB: "Bro, why do people ask questions like I didn't already give you the entire code...",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_cross_topic_pair");
  });

  it("rejects daily-life intent paired with codebase complaint chatter", () => {
    const result = classifyImportedContradictionPair({
      sideA: "Im going to order on amazon now, i want to clean a dirty bathroom...",
      sideB: "Bro, why do people ask questions like I didn't already give you the entire code...",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_cross_topic_pair");
  });

  it("rejects failed-query chatter paired with red-file status chatter", () => {
    const result = classifyImportedContradictionPair({
      sideA: "reply to who saying DONE - trying the form now? Failed query: INSERT INTO Category...",
      sideB: "but it still shows as red in the file...",
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_project_task_pair");
  });

  it("accepts honesty-vs-conflict contradiction pair", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I want honesty.",
      sideB: "I want honesty, but I avoid conflict.",
    });

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("accepts independence-vs-approval contradiction pair", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I value independence.",
      sideB: "I value independence, but I keep seeking approval.",
    });

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("accepts simplify-life-vs-systems contradiction pair", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I want to simplify my life.",
      sideB: "I want to simplify my life, but I keep adding more systems.",
    });

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("accepts coherence-vs-uncertainty contradiction pair", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I want coherence.",
      sideB: "I want coherence, but I change direction whenever I feel uncertain.",
    });

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });
});

// ── Step 15C: Imported pair quality gates ────────────────────────────────────
//
// Bad sideA cases: conversational corrections should never become contradiction sideA.
// Bad sideB cases: greeting+planning messages with generic device/day-query signals.
// Good cases: real behavioral failures must survive.

describe("classifyImportedContradictionPair — sideA conversational correction gate", () => {
  it("rejects 'i never said that in this conversation bruv' as sideA", () => {
    const result = classifyImportedContradictionPair({
      sideA: "i never said that in this conversation bruv",
      sideB: "but I keep thinking about it and I'm not sure what to do anymore",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_conversational_sideA");
  });

  it("rejects 'I never said it's maybe or maybe not. A theory is a theory' as sideA", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I never said it's maybe or maybe not. A theory is a theory",
      sideB: "I still find myself doubting what I believe about race and science but I keep bringing it up",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_conversational_sideA");
  });

  it("rejects 'that is not what I said' as sideA", () => {
    const result = classifyImportedContradictionPair({
      sideA: "that is not what I said, you're twisting my words",
      sideB: "but I avoid conflict and I don't speak up when I disagree",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_conversational_sideA");
  });

  it("rejects 'you said I said' as sideA", () => {
    const result = classifyImportedContradictionPair({
      sideA: "you said I said I want to be left alone but that wasn't the context",
      sideB: "but I keep seeking validation from others even when I say I don't need it",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_conversational_sideA");
  });

  it("rejects 'I never said I was hyper masculine' as sideA", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I never said I was hyper masculine, I was just explaining the behaviour selection shift",
      sideB: "but it's like women are seen for their oppression across racial lines and gender lines",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_conversational_sideA");
  });
});

describe("classifyImportedContradictionPair — sideB greeting/planning gate", () => {
  it("rejects NOI/Islam goal paired with morning greeting + 'I didn't open my laptop'", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I want to join my local Noi but I don't believe in Islam or the prophet Muhammad",
      sideB: "Good morning, I didn't open my laptop today. What do you think I should do today?",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_weak_behavior_sideB");
  });

  it("rejects productivity organisation goal paired with morning greeting + day-planning query", () => {
    const result = classifyImportedContradictionPair({
      sideA: "i want to organise my chat gpt and also start creating a notion workspace",
      sideB: "Good morning, what do you think I should do today?",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_weak_behavior_sideB");
  });

  it("rejects any sideA paired with morning + 'what should I do today'", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I need to simplify my life and stay focused on what matters",
      sideB: "Morning, what should I do today? I haven't started anything yet.",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_weak_behavior_sideB");
  });

  it("rejects morning opener paired with generic device-status + planning", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I need to finish this book and stop procrastinating",
      sideB: "Good morning. I didn't open my laptop. What do you think I should do today?",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("contradiction_weak_behavior_sideB");
  });
});

describe("classifyImportedContradictionPair — good pairs preserved (Step 15C regression guard)", () => {
  it("keeps 'finish this book' + 'I didn't read again tonight because I kept scrolling'", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I need to finish this book though",
      sideB: "I didn't read again tonight because I kept scrolling on my phone",
    });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("keeps 'review after reading to retain' + 'I skipped the review again and forgot most of it'", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I need to review after I read to retain",
      sideB: "I skipped the review again and forgot most of it",
    });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("keeps 'no weed while studying' + 'but I smoked before studying again'", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I don't want to use weed while studying",
      sideB: "but I smoked before studying again, it's hard to stop the habit",
    });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("keeps 'simplify my life and stay focused' + 'I opened social media again instead of reading'", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I need to simplify my life and stay focused",
      sideB: "I opened social media again instead of reading, I can't seem to stop",
    });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("keeps a durable constraint even when sideA uses 'never' in a durable sense", () => {
    // This is a durable constraint, not a conversational correction
    const result = classifyImportedContradictionPair({
      sideA: "I never want to skip a workout two days in a row",
      sideB: "but I skipped the gym again this week, three sessions missed",
    });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("keeps a constraint with 'I need to sleep before midnight' pattern", () => {
    const result = classifyImportedContradictionPair({
      sideA: "I need to sleep before midnight to function properly",
      sideB: "but I stayed up until 2am again scrolling through my phone",
    });
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });
});

describe("applyImportedContradictionFanoutGuard", () => {
  const mkDetection = (sideA: string, sideB: string) => ({
    title: "Constraint conflict",
    sideA,
    sideB,
    type: "constraint_conflict" as const,
    confidence: "low" as const,
  });

  it("caps repeated sideA anchors", () => {
    const detections = [
      mkDetection("I must protect calm and coherence.", "I want honesty, but I avoid conflict."),
      mkDetection("I must protect calm and coherence.", "I value independence, but I keep seeking approval."),
      mkDetection("I must protect calm and coherence.", "I want to simplify my life, but I keep adding more systems."),
      mkDetection("I must protect calm and coherence.", "I want coherence, but I change direction whenever I feel uncertain."),
      mkDetection("I must protect calm and coherence.", "I want consistency, but I keep switching plans when anxious."),
    ];

    const result = applyImportedContradictionFanoutGuard({
      detections,
      sideAUsage: new Map(),
      sideBUsage: new Map(),
    });

    expect(result.accepted).toHaveLength(IMPORTED_CONTRADICTION_SIDE_FANOUT_CAP);
    expect(result.rejected).toHaveLength(2);
    for (const rejected of result.rejected) {
      expect(rejected.reasons).toContain("contradiction_repeated_side_a");
    }
  });

  it("caps repeated sideB anchors", () => {
    const detections = [
      mkDetection("I must protect calm and coherence.", "I want honesty, but I avoid conflict."),
      mkDetection("I must protect independence.", "I want honesty, but I avoid conflict."),
      mkDetection("I must protect simplicity.", "I want honesty, but I avoid conflict."),
      mkDetection("I must protect trust.", "I want honesty, but I avoid conflict."),
      mkDetection("I must protect focus.", "I want honesty, but I avoid conflict."),
    ];

    const result = applyImportedContradictionFanoutGuard({
      detections,
      sideAUsage: new Map(),
      sideBUsage: new Map(),
    });

    expect(result.accepted).toHaveLength(IMPORTED_CONTRADICTION_SIDE_FANOUT_CAP);
    expect(result.rejected).toHaveLength(2);
    for (const rejected of result.rejected) {
      expect(rejected.reasons).toContain("contradiction_repeated_side_b");
    }
  });

  it("allows first few repeated anchors up to cap", () => {
    const detections = [
      mkDetection("I must protect calm and coherence.", "I want honesty, but I avoid conflict."),
      mkDetection("I must protect calm and coherence.", "I value independence, but I keep seeking approval."),
      mkDetection("I must protect calm and coherence.", "I want to simplify my life, but I keep adding more systems."),
    ];

    const result = applyImportedContradictionFanoutGuard({
      detections,
      sideAUsage: new Map(),
      sideBUsage: new Map(),
    });

    expect(result.accepted).toHaveLength(IMPORTED_CONTRADICTION_SIDE_FANOUT_CAP);
    expect(result.rejected).toHaveLength(0);
  });

  it("does not reject unique valid contradiction pairs", () => {
    const detections = [
      mkDetection("I must protect calm and coherence.", "I want honesty, but I avoid conflict."),
      mkDetection("I must protect independence.", "I value independence, but I keep seeking approval."),
      mkDetection("I must protect simplicity.", "I want to simplify my life, but I keep adding more systems."),
      mkDetection("I must protect coherence.", "I want coherence, but I change direction whenever I feel uncertain."),
    ];

    const result = applyImportedContradictionFanoutGuard({
      detections,
      sideAUsage: new Map(),
      sideBUsage: new Map(),
    });

    expect(result.accepted).toHaveLength(4);
    expect(result.rejected).toHaveLength(0);
  });

  it("caps repeated sideA across multiple guard calls with shared state", () => {
    const sideAUsage = new Map<string, number>();
    const sideBUsage = new Map<string, number>();

    const first = applyImportedContradictionFanoutGuard({
      detections: [
        mkDetection("I must protect calm and coherence.", "I want honesty, but I avoid conflict."),
        mkDetection("I must protect calm and coherence.", "I value independence, but I keep seeking approval."),
      ],
      sideAUsage,
      sideBUsage,
    });
    const second = applyImportedContradictionFanoutGuard({
      detections: [
        mkDetection("I must protect calm and coherence.", "I want to simplify my life, but I keep adding more systems."),
        mkDetection("I must protect calm and coherence.", "I want coherence, but I change direction whenever I feel uncertain."),
      ],
      sideAUsage,
      sideBUsage,
    });

    expect(first.accepted).toHaveLength(2);
    expect(second.accepted).toHaveLength(1);
    expect(second.rejected).toHaveLength(1);
    expect(second.rejected[0]?.reasons).toContain("contradiction_repeated_side_a");
  });

  it("caps repeated sideB across multiple guard calls with shared state", () => {
    const sideAUsage = new Map<string, number>();
    const sideBUsage = new Map<string, number>();

    const sharedSideB = "I want honesty, but I avoid conflict.";
    const first = applyImportedContradictionFanoutGuard({
      detections: [
        mkDetection("I must protect calm.", sharedSideB),
        mkDetection("I must protect independence.", sharedSideB),
      ],
      sideAUsage,
      sideBUsage,
    });
    const second = applyImportedContradictionFanoutGuard({
      detections: [
        mkDetection("I must protect simplicity.", sharedSideB),
        mkDetection("I must protect coherence.", sharedSideB),
      ],
      sideAUsage,
      sideBUsage,
    });

    expect(first.accepted).toHaveLength(2);
    expect(second.accepted).toHaveLength(1);
    expect(second.rejected).toHaveLength(1);
    expect(second.rejected[0]?.reasons).toContain("contradiction_repeated_side_b");
  });
});

describe("import-chatgpt validation", () => {
  it("rejects missing file", () => {
    const result = validateImportFile(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("accepts zip and rejects oversized uploads", () => {
    const zipFile = {
      name: "export.zip",
      type: "application/zip",
      size: 10,
    } as unknown as File;
    const zipResult = validateImportFile(zipFile);
    expect(zipResult.ok).toBe(true);

    const oversized = {
      name: "export.json",
      type: "application/json",
      size: MAX_IMPORT_FILE_BYTES + 1,
    } as unknown as File;
    const bigResult = validateImportFile(oversized);
    expect(bigResult.ok).toBe(false);
    if (!bigResult.ok) {
      expect(bigResult.status).toBe(413);
    }
  });

  it("parses and rejects invalid JSON safely", () => {
    const valid = parseJsonSafe('{"ok":true}');
    expect(valid.ok).toBe(true);

    const invalid = parseJsonSafe("{not-json");
    expect(invalid.ok).toBe(false);
  });
});

describe("import-chatgpt zip handling", () => {
  it("imports from zip when conversations.json is extracted", async () => {
    const extractedJson = Buffer.from(JSON.stringify(SAMPLE_EXPORT));
    const zipExtractor = async () => extractedJson;
    const jsonImporter = async () => ({
      sessionsCreated: 1,
      messagesCreated: 2,
      contradictionsCreated: 0,
      errors: [],
    });

    const result = await importChatGptExport({
      userId: "user_1",
      bytes: Buffer.from("zip-bytes"),
      filename: "chatgpt-export.zip",
      contentType: "application/zip",
      zipExtractor,
      jsonImporter,
    });

    expect(result.sessionsCreated).toBe(1);
    expect(result.messagesCreated).toBe(2);
  });

  it("throws when zip is missing conversations.json", async () => {
    await expect(
      importChatGptExport({
        userId: "user_1",
        bytes: Buffer.from("zip-bytes"),
        filename: "chatgpt-export.zip",
        contentType: "application/zip",
        zipExtractor: async () => {
          throw new ImportChatGptError(400, ["Zip missing conversations.json"]);
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      errors: ["Zip missing conversations.json"],
    });
  });

  it("throws when extracted conversations.json is too large", async () => {
    await expect(
      importChatGptExport({
        userId: "user_1",
        bytes: Buffer.from("zip-bytes"),
        filename: "chatgpt-export.zip",
        contentType: "application/zip",
        zipExtractor: async () => {
          throw new ImportChatGptError(400, [
            "Extracted conversations.json too large. Maximum size is 100 bytes.",
          ]);
        },
      })
    ).rejects.toMatchObject({
      status: 400,
    });
  });
});

type FakeReferenceRow = { statement: string };

function makeMockDb(seedRows: FakeReferenceRow[] = []) {
  const rows = [...seedRows];
  return {
    referenceItem: {
      findMany: async ({ where }: { where: { type?: string } }) => {
        const type = where.type;
        return rows.filter((r) => !type || (r as { type?: string }).type === type);
      },
      create: async ({ data }: { data: { statement: string; type: string } }) => {
        const row = { ...data };
        rows.push(row as FakeReferenceRow);
        return row;
      },
    },
  } as unknown as PrismaClient;
}

describe("extractReferenceFromImportedMessage", () => {
  const baseArgs = {
    userId: "user_test",
    sessionId: "session_test",
    message: { id: "msg_1", content: "" },
  };

  it("creates a goal reference for goal-like messages", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_1", content: "I want to run a marathon this year" },
      db,
      refCache,
    });
    expect(created).toBe(true);
    expect(refCache.get("goal")).toContain("I want to run a marathon this year");
  });

  it("creates a preference reference for preference-like messages", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_2", content: "I prefer working in the mornings" },
      db,
      refCache,
    });
    expect(created).toBe(true);
    expect(refCache.get("preference")).toContain("I prefer working in the mornings");
  });

  it("creates a constraint reference for constraint-like messages", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_3", content: "I must finish the report by Friday" },
      db,
      refCache,
    });
    expect(created).toBe(true);
    expect(refCache.get("constraint")).toContain("I must finish the report by Friday");
  });

  it("returns false and skips creation for non-reference messages", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_4", content: "The weather is nice today" },
      db,
      refCache,
    });
    expect(created).toBe(false);
    expect(refCache.size).toBe(0);
  });

  it("returns false and skips creation for rule-like statements", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_5", content: "When I say hi respond with exactly hello" },
      db,
      refCache,
    });
    expect(created).toBe(false);
  });

  it("deduplicates when token overlap score is 2 or more", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map([
      ["goal", ["I want to run a marathon this year"]],
    ]);
    // "run" + "marathon" overlap → score ≥ 2 → skip
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_6", content: "I want to run a marathon every year" },
      db,
      refCache,
    });
    expect(created).toBe(false);
  });

  it("allows creation when token overlap score is below 2", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map([["goal", ["I want to travel abroad"]]]);
    // "marathon" doesn't overlap with "travel" or "abroad" → score < 2 → create
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_7", content: "I want to run a marathon" },
      db,
      refCache,
    });
    expect(created).toBe(true);
  });

  it("seeds cache from DB on first call for a type", async () => {
    const db = makeMockDb([{ statement: "I prefer dark mode" } as FakeReferenceRow]);
    const refCache: ImportRefCache = new Map();
    // cache is empty initially; DB should be queried to seed it
    await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_8", content: "I prefer dark mode" },
      db,
      refCache,
    });
    // After seeding, cache should contain the DB row. Dedup means no new row created.
    expect(refCache.get("preference")).toContain("I prefer dark mode");
  });

  it("updates cache after a new reference is created", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_9", content: "I prefer reading before bed" },
      db,
      refCache,
    });
    // Second distinct message should still be created (different tokens)
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_10", content: "I prefer coffee over tea" },
      db,
      refCache,
    });
    expect(created).toBe(true);
    expect(refCache.get("preference")?.length).toBe(2);
  });
});

// ── Lifecycle / status regression ────────────────────────────────────────────
//
// Regression guard: imported references MUST be created with status="candidate",
// never "active" or "inactive". Placing them in the wrong status at creation is
// what caused them to appear under "No longer active" in the memory drawer
// (the historical bucket previously used `status !== "active"` which captured
// every candidate, routing 80 imported items to the wrong bucket).

type FullReferenceRow = {
  userId: string;
  type: string;
  statement: string;
  confidence: string;
  status: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
};

function makeMockDbWithCapture(seedActive: string[] = []) {
  const created: FullReferenceRow[] = [];
  const db = {
    referenceItem: {
      findMany: async () =>
        seedActive.map((statement) => ({ statement })),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: FullReferenceRow = {
          userId: data.userId as string,
          type: data.type as string,
          statement: data.statement as string,
          confidence: data.confidence as string,
          status: data.status as string,
          sourceSessionId: (data.sourceSessionId as string | null) ?? null,
          sourceMessageId: (data.sourceMessageId as string | null) ?? null,
        };
        created.push(row);
        return row;
      },
    },
    _created: created,
  } as unknown as PrismaClient & { _created: FullReferenceRow[] };
  return db;
}

describe("extractReferenceFromImportedMessage — lifecycle status", () => {
  const args = {
    userId: "u_lifecycle",
    sessionId: "sess_import_1",
  };

  it("creates imported preference with status=candidate, never active or inactive", async () => {
    const db = makeMockDbWithCapture();
    await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "msg_lc_1", content: "I prefer early morning workouts" },
      db,
      refCache: new Map(),
    });

    const rows = (db as unknown as { _created: FullReferenceRow[] })._created;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("candidate");
    expect(rows[0]!.status).not.toBe("active");
    expect(rows[0]!.status).not.toBe("inactive");
    expect(rows[0]!.status).not.toBe("superseded");
  });

  it("records sourceSessionId and sourceMessageId so provenance is traceable", async () => {
    const db = makeMockDbWithCapture();
    await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "msg_lc_2", content: "I want to learn Spanish this year" },
      db,
      refCache: new Map(),
    });

    const rows = (db as unknown as { _created: FullReferenceRow[] })._created;
    expect(rows[0]!.sourceSessionId).toBe("sess_import_1");
    expect(rows[0]!.sourceMessageId).toBe("msg_lc_2");
  });

  it("imported candidates are NOT immediately superseded or dismissed on creation", async () => {
    const db = makeMockDbWithCapture();
    await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "msg_lc_3", content: "I prefer concise bullet-point answers" },
      db,
      refCache: new Map(),
    });
    await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "msg_lc_4", content: "I want to reduce screen time" },
      db,
      refCache: new Map(),
    });

    const rows = (db as unknown as { _created: FullReferenceRow[] })._created;
    expect(rows).toHaveLength(2);
    // All created items must be candidates — none must have been transitioned
    // to inactive/superseded/dismissed during the import pipeline itself.
    for (const row of rows) {
      expect(row.status).toBe("candidate");
    }
  });

  it("confidence is low for imported references (conservative default)", async () => {
    const db = makeMockDbWithCapture();
    await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "msg_lc_5", content: "I prefer direct feedback over hints" },
      db,
      refCache: new Map(),
    });

    const rows = (db as unknown as { _created: FullReferenceRow[] })._created;
    expect(rows[0]!.confidence).toBe("low");
  });
});

// ── Precision gate tests ──────────────────────────────────────────────────────
//
// Verifies that extractReferenceFromImportedMessage rejects low-quality import
// candidates and keeps clean personal statements, matching the native write path
// precision standards.

describe("extractReferenceFromImportedMessage — precision gates (reject cases)", () => {
  const args = { userId: "u_precision", sessionId: "sess_precision" };

  it("rejects a question-form candidate ('dont i need to run the new code in VSC first?')", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "pg_r1", content: "dont i need to run the new code in VSC first?" },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects a non-first-person-start candidate ('the custom instruction box said i need to limit it to 1500')", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "pg_r2", content: "the custom instruction box said i need to limit it to 1500" },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects CLI/system output with no reference intent ('>>> Hello, how are you?...')", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "pg_r3", content: ">>> Hello, how are you? I can help you with your questions today." },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects a transient task ('I need to send this block in 2 parts.')", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "pg_r4", content: "I need to send this block in 2 parts." },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects a vague preference with only one meaningful content token ('I dont like this structure.')", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "pg_r5", content: "I dont like this structure." },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects an overlong raw message fragment (> 250 chars)", async () => {
    const longContent =
      "I think I want to work on my health and I know nutrition is important and I have been neglecting it for a while now and I really should make better choices about what I eat each day going forward but honestly it has been quite difficult to stick to a plan because there are so many temptations around me every single day";
    expect(longContent.length).toBeGreaterThan(250);

    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "pg_r6", content: longContent },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });
});

describe("extractReferenceFromImportedMessage — precision gates (keep cases)", () => {
  const args = { userId: "u_precision_keep", sessionId: "sess_precision_keep" };

  it("keeps a clear goal: 'My goal is peak body nutrition.'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "pg_k1", content: "My goal is peak body nutrition." },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(true);
    const rows = (db as unknown as { _created: FullReferenceRow[] })._created;
    expect(rows[0]!.type).toBe("goal");
  });

  it("keeps a clear learning goal: 'I need to review after I read to retain better.'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "pg_k2", content: "I need to review after I read to retain better." },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(true);
    const rows = (db as unknown as { _created: FullReferenceRow[] })._created;
    expect(rows[0]!.type).toBe("goal");
  });

  it("keeps a clear food preference: 'I prefer chicken burgers to beef burgers.'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "pg_k3", content: "I prefer chicken burgers to beef burgers." },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(true);
    const rows = (db as unknown as { _created: FullReferenceRow[] })._created;
    expect(rows[0]!.type).toBe("preference");
  });

  it("keeps a clear constraint: 'I can\\'t work effectively when I\\'m switching between too many tasks.'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: {
        id: "pg_k4",
        content: "I can't work effectively when I'm switching between too many tasks.",
      },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(true);
    const rows = (db as unknown as { _created: FullReferenceRow[] })._created;
    expect(rows[0]!.type).toBe("constraint");
  });

  it("keeps and extracts statement from a memory phrase: 'Remember that I prefer concise responses.'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "pg_k5", content: "Remember that I prefer concise responses." },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(true);
    const rows = (db as unknown as { _created: FullReferenceRow[] })._created;
    expect(rows[0]!.type).toBe("preference");
    // The stored statement must be the extracted version, not the raw "Remember that..." content.
    expect(rows[0]!.statement).toBe("I prefer concise responses.");
    expect(rows[0]!.statement).not.toContain("Remember");
  });
});

// ── Residual noise guard tests ────────────────────────────────────────────────
//
// The 8 cases below passed all prior guards (first-person, length, transient-op)
// but are semantically task-like, stale-dated, or conversational noise that
// should not become durable ReferenceItem candidates.

describe("extractReferenceFromImportedMessage — residual noise guard (reject cases)", () => {
  const args = { userId: "u_residual", sessionId: "sess_residual" };

  it("rejects chat/session manipulation task: 'I want to start a new chat…'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: {
        id: "rn_r1",
        content:
          "I want to start a new chat i fucking hate this chat, can you draw up a prompt of work flow with examples so i can hand it off in a new chat",
      },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects watch-video lookup task: 'i must be able to watch the video somewhere'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "rn_r2", content: "i must be able to watch the video somewhere" },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects Codex/option-picking task: 'I like B maybe we can tell codex to do it…'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: {
        id: "rn_r3",
        content:
          "I like B maybe we can tell codex to do it, we need to also evaluate what can go wrong everytime we make changes",
      },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects stale dated delivery chatter: 'I hope to start. content by feb lol…'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: {
        id: "rn_r4",
        content: "I hope to start. content by feb lol but i agree good time line",
      },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects UI/folder operational instruction: 'I do have it but it seems i have another UI components folder…'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: {
        id: "rn_r5",
        content:
          "I do have it but it seems i have another UI components folder! I guess thats the issue, shall i like drag them files into the other ui components folder and delete the folders",
      },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects vague collective goal: 'I want to do what needs to be done for us'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: { id: "rn_r6", content: "I want to do what needs to be done for us" },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects passive reading-list task fragment: 'i was told i need to include Baltasar Gracián…'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: {
        id: "rn_r7",
        content: "i was told i need to include Baltasar Gracián art of worldy wisdom",
      },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });

  it("rejects conversational filler opener masking a constraint: 'I mean, how complicated is the infrared thing?…'", async () => {
    const db = makeMockDbWithCapture();
    const created = await extractReferenceFromImportedMessage({
      ...args,
      message: {
        id: "rn_r8",
        content:
          "I mean, how complicated is the infrared thing? Because I can't code, but you can, so... You can answer the questions when it has them.",
      },
      db,
      refCache: new Map(),
    });
    expect(created).toBe(false);
    expect((db as unknown as { _created: FullReferenceRow[] })._created).toHaveLength(0);
  });
});
