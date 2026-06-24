import { chromium } from "playwright";
import path from "path";
import fs from "fs";

// ─── Shared browser state ───────────────────────────────────────────────────
// These are module-level variables so every tool function shares the same
// browser instance across the entire agent run.

let browser = null;
let page = null;

// ─── Tool 1: open_browser ───────────────────────────────────────────────────
// Launches a Chromium browser instance and opens a blank page.
// headless: false means you can SEE the browser window (great for demos/viva).
// Call this once at the start before any other tool.

export async function open_browser() {
  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  page = await context.newPage();
  console.log("[open_browser] Browser launched.");
  return { success: true, message: "Browser opened successfully." };
}

// ─── Tool 2: navigate_to_url ────────────────────────────────────────────────
// Navigates the browser to a given URL.
// waitUntil: "domcontentloaded" waits for the HTML to be parsed before
// returning — faster than "networkidle" but reliable enough for most pages.

export async function navigate_to_url(url) {
  if (!page) throw new Error("Browser is not open. Call open_browser first.");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log(`[navigate_to_url] Navigated to: ${url}`);
  return { success: true, message: `Navigated to ${url}` };
}

// ─── Tool 3: take_screenshot ────────────────────────────────────────────────
// Captures the current browser state as a PNG image.
// The agent calls this to "see" the page — screenshots are passed back to
// OpenAI so it can make decisions about what to do next.
// filename is optional; defaults to a timestamp-based name.

export async function take_screenshot(filename = null) {
  if (!page) throw new Error("Browser is not open. Call open_browser first.");

  const screenshotsDir = path.resolve("screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const name = filename || `screenshot_${Date.now()}.png`;
  const filepath = path.join(screenshotsDir, name);

  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`[take_screenshot] Saved: ${filepath}`);
  return { success: true, path: filepath, message: `Screenshot saved to ${filepath}` };
}

// ─── Tool 4: click_on_screen ────────────────────────────────────────────────
// Performs a mouse click at the given (x, y) coordinates on the screen.
// The agent determines coordinates by analyzing a screenshot.
// We add a small delay after clicking to let any UI changes settle.

export async function click_on_screen(x, y) {
  if (!page) throw new Error("Browser is not open. Call open_browser first.");
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  console.log(`[click_on_screen] Clicked at (${x}, ${y})`);
  return { success: true, message: `Clicked at coordinates (${x}, ${y})` };
}

// ─── Tool 5: send_keys ──────────────────────────────────────────────────────
// Types text into a form field identified by a CSS selector.
// We click the element first to focus it, clear any existing text,
// then type the new value. This mimics what a real user would do.
// Example selector: 'input[name="username"]' or '#description'

export async function send_keys(selector, text) {
  if (!page) throw new Error("Browser is not open. Call open_browser first.");
  await page.click(selector);
  await page.fill(selector, text);
  console.log(`[send_keys] Typed "${text}" into "${selector}"`);
  return { success: true, message: `Typed "${text}" into element "${selector}"` };
}

// ─── Tool 6: scroll ─────────────────────────────────────────────────────────
// Scrolls the page up or down by a given pixel amount.
// direction: "down" or "up"
// amount: pixels to scroll (default 400px — roughly one screen height)
// Useful when form elements are below the visible area.

export async function scroll(direction = "down", amount = 400) {
  if (!page) throw new Error("Browser is not open. Call open_browser first.");
  const scrollAmount = direction === "down" ? amount : -amount;
  await page.evaluate((px) => window.scrollBy(0, px), scrollAmount);
  await page.waitForTimeout(300);
  console.log(`[scroll] Scrolled ${direction} by ${amount}px`);
  return { success: true, message: `Scrolled ${direction} by ${amount}px` };
}

// ─── Tool 7: double_click ───────────────────────────────────────────────────
// Performs a double-click at the given (x, y) coordinates.
// Useful for selecting text in input fields before replacing it,
// or triggering UI elements that require double-click.

export async function double_click(x, y) {
  if (!page) throw new Error("Browser is not open. Call open_browser first.");
  await page.mouse.dblclick(x, y);
  await page.waitForTimeout(500);
  console.log(`[double_click] Double-clicked at (${x}, ${y})`);
  return { success: true, message: `Double-clicked at coordinates (${x}, ${y})` };
}

// ─── Utility: close_browser ─────────────────────────────────────────────────
// Cleanly shuts down the browser. Called at the end of every agent run.

export async function close_browser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    console.log("[close_browser] Browser closed.");
  }
  return { success: true, message: "Browser closed." };
}

// ─── Utility: get_page_content ──────────────────────────────────────────────
// Returns the full HTML of the current page as a string.
// The agent can use this to find element selectors without needing a screenshot.

export async function get_page_content() {
  if (!page) throw new Error("Browser is not open. Call open_browser first.");
  const content = await page.content();
  console.log(`[get_page_content] Retrieved page HTML (${content.length} chars)`);
  return { success: true, content, message: "Page content retrieved." };
}