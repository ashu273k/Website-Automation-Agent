import fs from "fs";
import path from "path";

// ─── Log levels ────────────────────────────────────────────────────────────
// Each level has a label and a console color code (ANSI escape sequences).
// This makes INFO green, WARN yellow, ERROR red in supported terminals.

const LEVELS = {
  INFO:  { label: "INFO ", color: "\x1b[32m" },  // green
  WARN:  { label: "WARN ", color: "\x1b[33m" },  // yellow
  ERROR: { label: "ERROR", color: "\x1b[31m" },  // red
  TOOL:  { label: "TOOL ", color: "\x1b[36m" },  // cyan  — tool calls
  AGENT: { label: "AGENT", color: "\x1b[35m" },  // magenta — agent decisions
};

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";

// ─── Log file setup ────────────────────────────────────────────────────────
// Every run writes to logs/run_<timestamp>.log so you never lose history.
// The logs/ folder is created automatically if it doesn't exist.

const logsDir = path.resolve("logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFileName = `run_${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
const logFilePath = path.join(logsDir, logFileName);
const logStream   = fs.createWriteStream(logFilePath, { flags: "a" });

// ─── Core log function ─────────────────────────────────────────────────────
// Writes to both the terminal (with color) and the log file (plain text).

function log(level, action, message, data = null) {
  const timestamp = new Date().toISOString();
  const { label, color } = LEVELS[level] || LEVELS.INFO;

  // ── Terminal output (colored) ──
  const prefix = `${color}${BOLD}[${label}]${RESET} ${"\x1b[2m"}${timestamp}${RESET}`;
  const actionTag = action ? ` ${BOLD}(${action})${RESET}` : "";
  console.log(`${prefix}${actionTag} ${message}`);
  if (data) {
    console.log(`       `, data);
  }

  // ── File output (plain text, no color codes) ──
  const fileLine = `[${label}] ${timestamp}${action ? ` (${action})` : ""} ${message}`;
  logStream.write(fileLine + "\n");
  if (data) {
    logStream.write(`        ${JSON.stringify(data)}\n`);
  }
}

// ─── Public logger API ─────────────────────────────────────────────────────
// These are the functions you import and call throughout the project.

export const logger = {
  info:  (action, message, data) => log("INFO",  action, message, data),
  warn:  (action, message, data) => log("WARN",  action, message, data),
  error: (action, message, data) => log("ERROR", action, message, data),
  tool:  (action, message, data) => log("TOOL",  action, message, data),
  agent: (action, message, data) => log("AGENT", action, message, data),

  // Logs a clean separator line — useful to mark the start of a new run
  separator: (title = "") => {
    const line = "─".repeat(50);
    const msg = title ? `\n${line}\n  ${title}\n${line}` : `\n${line}`;
    console.log(msg);
    logStream.write(msg + "\n");
  },

  // Returns the path of the current log file so you can reference it
  getLogFile: () => logFilePath,
};