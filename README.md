# 🤖 Website Automation Agent

An intelligent browser automation agent that navigates web pages, detects form elements, and fills them autonomously — powered by **OpenAI GPT-4o** and **Playwright**.

---

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Playwright-v1.61+-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI" />
  <img src="https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=for-the-badge" alt="PRs Welcome" />
</p>

---

## 🌟 Overview

This project implements an autonomous AI-driven browser control loop (similar to [Browser Use](https://github.com/browser-use/browser-use)). Given a high-level task, the agent interacts with web pages, dynamically discovers interactive form fields, makes strategic decisions, and completes the automated tasks.

> [!NOTE]
> The default target task runs on the [Shadcn UI Form Demo page](https://ui.shadcn.com/docs/forms/react-hook-form) to fill in the **Username** and **Bio** fields completely from scratch, without any pre-defined selectors!

---

## 🚀 Features

- **Autonomous Agent Loop**: Executes a tool-calling cycle powered by GPT-4o.
- **Computer Vision Guided**: Sends page screenshots as visual feedback to GPT-4o.
- **Smart HTML Truncation**: Extracts only interactive and form-related HTML tags (`input`, `textarea`, `button`, etc.) to keep token count low and context window clean.
- **Colorized Logger**: Custom logger output to console and persistent timestamped log files in `logs/`.
- **Fault-Tolerant execution**: Automatically takes screenshots on error and retries tool executions with alternative selectors if one fails.

---

## 📂 Project Structure

```
website-automation-agent/
├── agent/
│   └── agent.js          # OpenAI tool-calling loop & dispatcher
├── tools/
│   └── browser.js        # Playwright browser interactions (7 primary tools)
├── utils/
│   └── logger.js         # Colored terminal & persistent file logger
├── docs/
│   └── ARCHITECTURE.md   # System flow & architectural decisions
├── logs/                 # Auto-generated log files
├── screenshots/          # Step-by-step & error snapshots
├── main.js               # Main entry point & task definition
├── test-setup.js         # Quick diagnostic script for Playwright
├── .env                  # API keys (ignored by git)
└── package.json          # Node dependencies
```

---

## 🔧 Prerequisites & Setup

### Requirements
- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **OpenAI API Key** (from [OpenAI Platform](https://platform.openai.com/api-keys))

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd website-automation-agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install the Playwright Chromium binary:**
   ```bash
   npx playwright install chromium
   ```

4. **Environment Configuration:**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

> [!IMPORTANT]
> Make sure your API key has active usage credit, as vision-based agent steps consume tokens for image processing.

---

## 🏃 Running the Project

### Run Diagnostics (Check Setup)
Before launching the agent, you can verify your Playwright setup:
```bash
node test-setup.js
```
This script launches chromium, navigates to the target page, scrolls down, saves a test screenshot inside `screenshots/test_page.png`, and prints confirmation status using our custom logger.

### Start the AI Agent
To run the main agent loop:
```bash
node main.js
```
A Chromium window will launch in non-headless mode, and you will see the agent autonomously navigates, scrolls, queries elements, fills the form fields, and takes screenshots of its progress.

---

## 📸 Output & Artifacts

After running the agent, you will see two outputs:

1. **Detailed Logs**: Created in `logs/run_<timestamp>.log`. This records every decision, tool call, arguments, and outcome.
2. **Visual Proof**: Saved in `screenshots/` at key milestones:
   - `step1_page_loaded.png`: Initial page load.
   - `step2_form_visible.png`: After scrolling down to reveal form elements.
   - `step3_username_filled.png`: Username field successfully entered.
   - `step4_bio_filled.png`: Bio field successfully entered.
   - `step5_final.png`: Finished state showing both values.
   - `ERROR_<tool>_<timestamp>.png`: Automatically generated screenshot if any operation fails.

---

## 🛠️ Available Agent Tools

The agent has access to 8 modular tools:

| Tool Name | Parameters | Description |
|---|---|---|
| `open_browser` | None | Launches the Playwright Chromium browser. |
| `navigate_to_url`| `url` | Directs the active page to a specific URL. |
| `take_screenshot`| `filename` (optional) | Saves a PNG screenshot of the current page. |
| `get_page_content`| None | Extracts and truncates interactive/form elements into JSON. |
| `scroll` | `direction` (up/down), `amount` | Scrolls the page by a specific pixel value. |
| `send_keys` | `selector`, `text` | Fills an input element matching the selector. |
| `click_on_screen`| `x`, `y` | Triggers a mouse click at coordinates. |
| `double_click` | `x`, `y` | Triggers a double-click at coordinates. |

---

## 🔍 Troubleshooting

- **"Browser is not open"**: Ensure the agent initiates with `open_browser` first. (The agent loop prompt explicitly enforces this workflow).
- **Element Selector Failures**: GPT-4o uses `get_page_content` to fetch a list of tags. If an element's selector fails, the tool catches the error and returns it to the model. GPT-4o will automatically analyze the failure and attempt a new selector.
- **Playwright binaries missing**: Run `npx playwright install chromium` again.

---

## 📄 License

Distributed under the **ISC License**. See `package.json` for details.