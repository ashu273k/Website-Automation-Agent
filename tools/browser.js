import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { logger } from "../utils/logger.js";

// ─── Shared browser state ──────────────────────────────────────────────────
let browser = null;
let page    = null;

// ─── Internal helper: auto-screenshot on error ─────────────────────────────
// Called inside every catch block. Saves a screenshot stamped with the
// failing tool name so you can see exactly what the browser looked like
// when things went wrong.

async function screenshotOnError(toolName) {
  try {
    if (!page) return;
    const filepath = path.resolve(`screenshots/ERROR_${toolName}_${Date.now()}.png`);
    await page.screenshot({ path: filepath });
    logger.warn(toolName, `Error screenshot saved`, { path: filepath });
  } catch {
    // Silently ignore — we're already in an error state
  }
}

/**
 * Launches a Chromium browser instance with a 1280x720 viewport.
 * Must be called before any other browser tool.
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function open_browser() {
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
    logger.tool("open_browser", "Browser launched successfully");
    return { success: true, message: "Browser opened successfully." };
  } catch (error) {
    logger.error("open_browser", error.message);
    throw error;
  }
}

/**
 * Navigates the browser to the specified URL.
 * @param {string} url - Full URL including https://
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function navigate_to_url(url) {
  try {
    if (!page) throw new Error("Browser is not open. Call open_browser first.");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    logger.tool("navigate_to_url", `Navigated to ${url}`);
    return { success: true, message: `Navigated to ${url}` };
  } catch (error) {
    logger.error("navigate_to_url", error.message, { url });
    await screenshotOnError("navigate_to_url");
    throw error;
  }
}

/**
 * Captures a PNG screenshot of the current browser viewport.
 * @param {string|null} filename - Optional filename. Defaults to timestamp.
 * @returns {Promise<{success: boolean, path: string, message: string}>}
 */
export async function take_screenshot(filename = null) {
  try {
    if (!page) throw new Error("Browser is not open. Call open_browser first.");

    const screenshotsDir = path.resolve("screenshots");
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const name     = filename || `screenshot_${Date.now()}.png`;
    const filepath = path.join(screenshotsDir, name);

    await page.screenshot({ path: filepath, fullPage: false });
    logger.tool("take_screenshot", `Screenshot saved`, { path: filepath });
    return { success: true, path: filepath, message: `Screenshot saved to ${filepath}` };
  } catch (error) {
    logger.error("take_screenshot", error.message);
    throw error;
  }
}

/**
 * Clicks on a specific point on the screen.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function click_on_screen(x, y) {
  try {
    if (!page) throw new Error("Browser is not open. Call open_browser first.");
    await page.mouse.click(x, y);
    await page.waitForTimeout(500);
    logger.tool("click_on_screen", `Clicked at (${x}, ${y})`);
    return { success: true, message: `Clicked at coordinates (${x}, ${y})` };
  } catch (error) {
    logger.error("click_on_screen", error.message, { x, y });
    await screenshotOnError("click_on_screen");
    throw error;
  }
}

/**
 * Sends text to a specific input field.
 * @param {string} selector - CSS selector for the input field
 * @param {string} text - Text to type
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function send_keys(selector, text) {
  try {
    if (!page) throw new Error("Browser is not open. Call open_browser first.");

    // Wait for the element to exist before trying to interact with it
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.click(selector);
    await page.fill(selector, text);

    logger.tool("send_keys", `Typed into "${selector}"`, { text });
    return { success: true, message: `Typed "${text}" into element "${selector}"` };
  } catch (error) {
    logger.error("send_keys", error.message, { selector, text });
    await screenshotOnError("send_keys");
    // Return error as result instead of throwing — lets GPT-4o retry
    // with a different selector rather than crashing the whole run
    return { success: false, error: error.message, selector };
  }
}

// ─── Tool 6: scroll ───────────────────────────────────────────────────────

/**
 * Scrolls the browser window in the specified direction.
 * @param {string} direction - "down" or "up"
 * @param {number} amount - Pixels to scroll
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function scroll(direction = "down", amount = 400) {
  try {
    if (!page) throw new Error("Browser is not open. Call open_browser first.");
    const scrollAmount = direction === "down" ? amount : -amount;
    await page.evaluate((px) => window.scrollBy(0, px), scrollAmount);
    await page.waitForTimeout(300);
    logger.tool("scroll", `Scrolled ${direction} by ${amount}px`);
    return { success: true, message: `Scrolled ${direction} by ${amount}px` };
  } catch (error) {
    logger.error("scroll", error.message, { direction, amount });
    await screenshotOnError("scroll");
    throw error;
  }
}

/**
 * Double-clicks on a specific point on the screen.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function double_click(x, y) {
  try {
    if (!page) throw new Error("Browser is not open. Call open_browser first.");
    await page.mouse.dblclick(x, y);
    await page.waitForTimeout(500);
    logger.tool("double_click", `Double-clicked at (${x}, ${y})`);
    return { success: true, message: `Double-clicked at coordinates (${x}, ${y})` };
  } catch (error) {
    logger.error("double_click", error.message, { x, y });
    await screenshotOnError("double_click");
    throw error;
  }
}

/**
 * Closes the browser instance.
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function close_browser() {
  try {
    if (browser) {
      await browser.close();
      browser = null;
      page    = null;
      logger.tool("close_browser", "Browser closed cleanly");
    }
    return { success: true, message: "Browser closed." };
  } catch (error) {
    logger.error("close_browser", error.message);
    throw error;
  }
}

// ─── Utility: get_page_content ────────────────────────────────────────────
// Extracts only form-related elements from the page, keeping the output small
// enough to fit within the LLM context window. Full page HTML for modern
// React sites can easily exceed 1M+ characters.

/**
 * Extracts the HTML content of the current page, focusing on form-related elements.
 * @returns {Promise<{success: boolean, content: string, message: string}>}
 */
export async function get_page_content() {
  try {
    if (!page) throw new Error("Browser is not open. Call open_browser first.");

    // Extract only interactive/form elements and their attributes
    const elements = await page.evaluate(() => {
      const selectors = [
        "input", "textarea", "select", "button",
        "form", "label", "[role='textbox']", "[contenteditable='true']",
      ];
      const results = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el) => {
          const attrs = {};
          for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
          }
          results.push({
            tag: el.tagName.toLowerCase(),
            attrs,
            text: el.textContent?.slice(0, 100) || "",
            outerHTML: el.outerHTML.slice(0, 300),
          });
        });
      }
      return results;
    });

    const content = JSON.stringify(elements, null, 2);
    // Safety truncation to ~8K chars (~2K tokens) to stay within token limits
    const MAX_CHARS = 8000;
    const truncated = content.length > MAX_CHARS
      ? content.slice(0, MAX_CHARS) + "\n... (truncated)"
      : content;

    logger.tool("get_page_content", `Extracted ${elements.length} form elements`, { chars: truncated.length });
    return { success: true, content: truncated, message: `Found ${elements.length} interactive elements on the page.` };
  } catch (error) {
    logger.error("get_page_content", error.message);
    await screenshotOnError("get_page_content");
    throw error;
  }
}