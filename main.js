import { runAgent } from "./agent/agent.js";
import { logger } from "./utils/logger.js";
import { runAgentWithRetry } from "./agent/agent.js";

// ─── Target Task ───────────────────────────────────────────────────────────
// This is the instruction given to GPT-4o. The more specific you are
// about what the page looks like, the more reliably the agent performs.
// We give it fallback selectors so it can recover if the first one fails.

const task = `
You are automating a form on the shadcn/ui documentation website.

STEP 1 — Open the browser.

STEP 2 — Navigate to this exact URL:
https://ui.shadcn.com/docs/forms/react-hook-form

STEP 3 — Take a screenshot called "step1_page_loaded.png" to see the initial state.

STEP 4 — Scroll down by 800 pixels to reveal the interactive form demo.
The form is located below all the code examples on the page.

STEP 5 — Take a screenshot called "step2_form_visible.png" to confirm the form is visible.

STEP 6 — Get the page content to find the exact CSS selectors for the form fields.
The form has two fields:
  - A text input for "Username" 
  - A textarea for "Bio" (this is the description field)

Look for selectors like:
  - input[name="username"] or input[placeholder*="shadcn"] or #username
  - textarea[name="bio"] or textarea[placeholder*="Tell"] or #bio

STEP 7 — Fill in the Username field with: JohnDoe_AI_Agent

STEP 8 — Take a screenshot called "step3_username_filled.png" to confirm.

STEP 9 — Fill in the Bio textarea with: 
"This form was automatically filled by an AI browser automation agent built with OpenAI GPT-4o and Playwright."

STEP 10 — Take a screenshot called "step4_bio_filled.png" to confirm.

STEP 11 — Take a final screenshot called "step5_final.png" showing both fields filled.

STEP 12 — Say "TASK COMPLETE" and summarize what you did.

IMPORTANT RULES:
- If a CSS selector fails, read the page HTML again with get_page_content and find an alternative selector
- If the form is not visible after scrolling 800px, scroll down another 400px and try again
- Never guess selectors — always verify them from the actual page HTML
- Take a screenshot after every major action so you can see what happened
`;

// ─── Run ───────────────────────────────────────────────────────────────────
logger.separator("WEBSITE AUTOMATION AGENT — PHASE 5");
logger.info("main", "Starting target task run");

try {
  await runAgentWithRetry(task);
  logger.info("main", "Agent completed successfully");
} catch (error) {
  logger.error("main", `Agent failed: ${error.message}`);
  process.exit(1);
}