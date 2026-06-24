import { runAgent } from "./agent/agent.js";

const task = `
Go to https://ui.shadcn.com/docs/forms/react-hook-form

On this page there is a demo form with two fields:
- A "Username" input field
- A "Bio" textarea field (description)

Your job:
1. Navigate to the page
2. Scroll down to find the form (it is below the code examples)
3. Fill in the Username field with: "JohnDoe"
4. Fill in the Bio field with: "This is an automated message filled in by an AI agent."
5. Take a screenshot to confirm both fields are filled
`;

await runAgent(task);