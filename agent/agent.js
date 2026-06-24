import OpenAI from "openai";
import fs from "fs";
import "dotenv/config";
import { logger } from "../utils/logger.js";

import {
  open_browser,
  navigate_to_url,
  take_screenshot,
  click_on_screen,
  send_keys,
  scroll,
  double_click,
  close_browser,
  get_page_content,
} from "../tools/browser.js";

// ─── OpenAI client (routed through OpenRouter) ───────────────────────────
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost",
    "X-Title": "Website Automation Agent",
  },
});

// ─── Tool Definitions ─────────────────────────────────────────────────────
// These are JSON schemas that tell GPT-4o what tools exist and what
// arguments each one expects. GPT-4o uses these to decide which tool
// to call at each step.

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "open_browser",
      description: "Launch a Chromium browser window. Always call this first before any other tool.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to_url",
      description: "Navigate the browser to a specific URL.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full URL to navigate to, including https://" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "take_screenshot",
      description: "Take a screenshot of the current browser state. Use this to visually inspect the page before deciding what to do next.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Optional filename for the screenshot (e.g. 'step1.png'). Defaults to a timestamp." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "click_on_screen",
      description: "Click at specific (x, y) pixel coordinates on the browser screen.",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number", description: "X coordinate (horizontal) to click" },
          y: { type: "number", description: "Y coordinate (vertical) to click" },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_keys",
      description: "Type text into a form field using a CSS selector. More reliable than clicking coordinates for form inputs.",
      parameters: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector for the input element (e.g. 'input[name=\"username\"]' or '#description')" },
          text: { type: "string", description: "The text to type into the field" },
        },
        required: ["selector", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scroll",
      description: "Scroll the page up or down to reveal hidden elements.",
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["up", "down"], description: "Direction to scroll" },
          amount: { type: "number", description: "Number of pixels to scroll (default 400)" },
        },
        required: ["direction"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "double_click",
      description: "Double-click at specific (x, y) pixel coordinates on screen.",
      parameters: {
        type: "object",
        properties: {
          x: { type: "number", description: "X coordinate to double-click" },
          y: { type: "number", description: "Y coordinate to double-click" },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_page_content",
      description: "Get the full HTML source of the current page. Use this to find exact CSS selectors for form fields.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ─── Tool Dispatcher ──────────────────────────────────────────────────────
// Maps tool names (strings from GPT-4o) to actual JS functions.
// When GPT-4o says "call send_keys", this runs the real send_keys().

async function dispatch_tool(tool_name, tool_args) {
  logger.tool(tool_name, "Executing tool");
  logger.tool(tool_name, "Arguments", tool_args);

  switch (tool_name) {
    case "open_browser":       return await open_browser();
    case "navigate_to_url":    return await navigate_to_url(tool_args.url);
    case "take_screenshot":    return await take_screenshot(tool_args.filename);
    case "click_on_screen":    return await click_on_screen(tool_args.x, tool_args.y);
    case "send_keys":          return await send_keys(tool_args.selector, tool_args.text);
    case "scroll":             return await scroll(tool_args.direction, tool_args.amount);
    case "double_click":       return await double_click(tool_args.x, tool_args.y);
    case "get_page_content":   return await get_page_content();
    default:
      throw new Error(`Unknown tool: ${tool_name}`);
  }
}

// ─── Screenshot → Base64 helper ───────────────────────────────────────────
// Reads a saved screenshot PNG and converts it to a base64 string.
// This is how we pass visual information to GPT-4o (vision model).

function screenshot_to_base64(filepath) {
  const buffer = fs.readFileSync(filepath);
  return buffer.toString("base64");
}

// ─── Main Agent Loop ──────────────────────────────────────────────────────
// This is the core of the agent. It:
//   1. Sends the task + tools to GPT-4o
//   2. Checks if GPT-4o wants to call a tool
//   3. Executes the tool and sends the result back
//   4. Repeats until GPT-4o says it's done (no more tool calls)
//   5. Has a max_iterations guard to prevent infinite loops

export async function runAgent(task) {
  logger.separator("AGENT RUN STARTED");
  logger.info("runAgent", "Task received", { task });

  // System prompt — tells GPT-4o how to behave as a browser agent
  const system_prompt = `You are a browser automation agent. Complete web tasks step by step using the provided tools.

Approach:
1. open_browser → navigate_to_url → take_screenshot to see the page
2. get_page_content to find CSS selectors for form fields
3. scroll if needed to find elements
4. send_keys to fill form fields (more reliable than clicking coordinates)
5. take_screenshot to confirm completion

Rules:
- Use get_page_content to find CSS selectors — don't guess
- Prefer send_keys for form inputs
- Only take screenshots when needed (before/after key actions)
- Say "TASK COMPLETE" when done`;

  // The conversation history — starts with just the user task
  // and grows as tools are called and results come back
  const messages = [
    { role: "user", content: task }
  ];

  // Helper: remove all but the most recent screenshot vision message
  // to prevent token usage from growing with each screenshot
  function trimOldScreenshots() {
    let lastScreenshotIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (Array.isArray(messages[i].content) && messages[i].content.some(c => c.type === "image_url")) {
        if (lastScreenshotIdx === -1) {
          lastScreenshotIdx = i; // keep the most recent
        } else {
          // Replace old screenshot with a text summary
          messages[i] = { role: "user", content: "[Previous screenshot removed to save tokens]" };
        }
      }
    }
  }

  const MAX_ITERATIONS = 20;
  let iteration = 0;

  try {
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      logger.agent("iteration", `── Iteration ${iteration} ──`);

      // Trim old screenshots to keep token usage low
      trimOldScreenshots();

      // Send messages + tool definitions to GPT-4o
      let response;
      try {
        response = await openai.chat.completions.create({
          model: "openai/gpt-4o",
          messages: [
            { role: "system", content: system_prompt },
            ...messages,
          ],
          tools: TOOL_DEFINITIONS,
          tool_choice: "auto",
          max_tokens: 1000,
        });
      } catch (apiError) {
        logger.error("agent", `API error: ${apiError.message}`);
        // Stop on payment/auth errors — retrying won't help
        if (apiError.status === 402 || apiError.status === 401) {
          logger.error("agent", "Account limit or auth error. Stopping.");
          break;
        }
        // If context is too long, try removing the last large message
        if (apiError.status === 400 && messages.length > 1) {
          logger.warn("agent", "Trimming last message to reduce context size...");
          messages.pop();
        }
        continue;
      }

      const response_message = response.choices[0].message;
      const finish_reason = response.choices[0].finish_reason;

      // Add GPT-4o's response to conversation history
      messages.push(response_message);

      logger.agent("agent", `Finish reason: ${finish_reason}`);
      if (response_message.content) {
        logger.agent("agent", `GPT-4o says: ${response_message.content}`);
      }

      // ── Stop condition: GPT-4o is done, no more tools to call ──
      if (finish_reason === "stop" || !response_message.tool_calls) {
        logger.agent("agent", "Agent finished. No more tool calls.");
        break;
      }

      // ── Execute each tool GPT-4o requested ──
      for (const tool_call of response_message.tool_calls) {
        const tool_name = tool_call.function.name;
        const tool_args = JSON.parse(tool_call.function.arguments);

        let tool_result;
        let vision_message = null;

        try {
          tool_result = await dispatch_tool(tool_name, tool_args);

          // ── Special case: if a screenshot was taken, send it visually ──
          // GPT-4o is a vision model — we send the PNG as a base64 image
          // so it can literally see what's on screen and make better decisions.
          if (tool_name === "take_screenshot" && tool_result.path) {
            const b64 = screenshot_to_base64(tool_result.path);
            vision_message = {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Screenshot taken. Here is what the browser currently shows:`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${b64}`,
                    detail: "low",
                  },
                },
              ],
            };
          }

        } catch (error) {
          // If a tool fails, report the error back to GPT-4o
          // so it can try a different approach
          logger.error("agent", `Tool error in ${tool_name}: ${error.message}`);
          tool_result = { success: false, error: error.message };
        }

        // Send the tool result back to GPT-4o
        messages.push({
          role: "tool",
          tool_call_id: tool_call.id,
          content: JSON.stringify(tool_result),
        });

        // If we have a vision message (screenshot), add it right after
        if (vision_message) {
          messages.push(vision_message);
        }
      }
    }

    if (iteration >= MAX_ITERATIONS) {
      logger.warn("agent", "Max iterations reached. Stopping.");
    }

  } finally {
    // Always close the browser, even if an error occurred
    await close_browser();
    logger.agent("agent", "Agent run complete.");
    logger.info("agent", "Log file", { path: logger.getLogFile() });
  }
}