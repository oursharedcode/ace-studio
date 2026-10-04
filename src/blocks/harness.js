// Layer 3 — Harness. Everything around the model inside one agent: the
// instructions file, tools, permissions, hooks, subagents, sandbox, memory.

export const HARNESS_BLOCKS = [
  {
    id: "harness-instructions",
    emoji: "📜",
    label: "Agent Instructions",
    color: "#3B82F6",
    glow: "#3B82F644",
    text: `# [PROJECT_NAME] — instructions for coding agents

## What this repo is
[ONE_PARAGRAPH_SUMMARY]

## Commands
- Install: \`[INSTALL_COMMAND]\`
- Run: \`[DEV_COMMAND]\`
- Test: \`[TEST_COMMAND]\`
- Lint / typecheck: \`[LINT_COMMAND]\`

## Rules that are easy to break
- [RULE_1]
- [RULE_2]
- Never touch: [PROTECTED_PATHS]

## How to verify a change
1. [VERIFICATION_STEP_1]
2. [VERIFICATION_STEP_2]

## Ask before
- [ACTION_NEEDING_APPROVAL]`,
    why: "📜 Agent instructions file (AGENTS.md / CLAUDE.md)\n• Loaded into every session, so each line is paid for every time\n• Holds commands and rules the code does not show by itself\n• 'Ask before' marks where the agent stops and checks in",
  },
  {
    id: "harness-tool",
    emoji: "🔧",
    label: "Tool Definition",
    color: "#2563EB",
    glow: "#2563EB44",
    text: `{
  "name": "[TOOL_NAME]",
  "description": "[WHAT_IT_DOES]. Use when [WHEN_TO_USE]. Do not use for [WHEN_NOT_TO_USE]. Returns [RETURN_SHAPE].",
  "input_schema": {
    "type": "object",
    "properties": {
      "[PARAM_1]": {
        "type": "string",
        "description": "[PARAM_1_MEANING], for example [EXAMPLE_VALUE]"
      },
      "[PARAM_2]": {
        "type": "integer",
        "description": "[PARAM_2_MEANING]"
      }
    },
    "required": ["[PARAM_1]"]
  }
}`,
    why: "🔧 Tool definition\n• The description is the only manual the model gets for this tool\n• Says when to use the tool and when to leave it alone\n• One example value per parameter and the shape of the result",
  },
  {
    id: "harness-permissions",
    emoji: "🔐",
    label: "Permissions",
    color: "#60A5FA",
    glow: "#60A5FA44",
    text: `# Permissions — [AGENT_NAME]

Allow without asking
- Read: [READABLE_PATHS]
- Run: [SAFE_COMMANDS]

Ask first
- Write outside [WORKING_DIRECTORY]
- Run: [COMMAND_NEEDING_APPROVAL]
- Any network call except to [ALLOWED_HOSTS]

Always deny
- Read or print: [SECRET_PATHS]
- Run: [DESTRUCTIVE_COMMAND]
- Push to [PROTECTED_BRANCH]

When a call is denied: stop, report what was blocked and why, and propose another way. Do not retry the same thing in a different form.`,
    why: "🔐 Permission policy\n• Three lists: allowed, ask first, always denied\n• Deny rules cover secrets and actions that cannot be undone\n• Tells the agent what to do after a denial, so it does not look for a way round",
  },
  {
    id: "harness-hooks",
    emoji: "🎣",
    label: "Hooks",
    color: "#06B6D4",
    glow: "#06B6D444",
    text: `# Hooks — [AGENT_NAME]

Before a tool call
- Match: [TOOL_OR_COMMAND_PATTERN]
- Run: \`[CHECK_COMMAND]\`
- If it fails: block the call and return the message to the agent

After a file edit
- Match: [FILE_GLOB]
- Run: \`[FORMAT_OR_LINT_COMMAND]\`
- If it fails: return the output to the agent as feedback

When the agent says it is done
- Run: \`[TEST_COMMAND]\`
- If it fails: do not let the turn end; return the failing output`,
    why: "🎣 Hooks\n• Commands the harness itself runs around tool calls\n• For rules that must hold on every call\n• A stop hook that runs the tests checks 'done' before the turn ends",
  },
  {
    id: "harness-subagent",
    emoji: "🤖",
    label: "Subagent",
    color: "#38BDF8",
    glow: "#38BDF844",
    text: `---
name: [SUBAGENT_NAME]
description: [WHAT_IT_DOES]. Use when [WHEN_TO_DELEGATE].
tools: [ALLOWED_TOOLS]
model: [MODEL]
---

You are a [ROLE] working for another agent, not for the user.

Your job: [SINGLE_RESPONSIBILITY]

You start with no memory of the parent conversation. Everything you need is in the task you were given. If something is missing, say so instead of guessing.

Return, in this order:
1. [ANSWER_OR_VERDICT]
2. Evidence: files and line numbers
3. What you did not check`,
    why: "🤖 Subagent definition\n• A separate context window for one narrow job\n• The description decides when the parent hands work to it\n• Only its last message comes back, so the template fixes its shape",
  },
  {
    id: "harness-mcp",
    emoji: "🔌",
    label: "MCP Servers",
    color: "#0284C7",
    glow: "#0284C744",
    text: `{
  "mcpServers": {
    "[LOCAL_SERVER_NAME]": {
      "command": "[LAUNCH_COMMAND]",
      "args": ["[ARG_1]"],
      "env": { "[API_KEY_VAR]": "\${[API_KEY_VAR]}" }
    },
    "[REMOTE_SERVER_NAME]": {
      "type": "http",
      "url": "[SERVER_URL]"
    }
  }
}`,
    why: "🔌 MCP server config (.mcp.json)\n• Connects the agent to outside systems through one protocol\n• Keys come from environment variables and stay out of the file\n• Every server adds tool descriptions to the context, so connect only what the work needs",
  },
  {
    id: "harness-sandbox",
    emoji: "📦",
    label: "Sandbox",
    color: "#0EA5E9",
    glow: "#0EA5E944",
    text: `# Sandbox — [AGENT_NAME]

Filesystem
- Read and write: [WORKING_DIRECTORY]
- Read only: [READ_ONLY_PATHS]
- No access: everything else, including [SECRET_PATHS]

Network
- Allowed hosts: [ALLOWED_HOSTS]
- Everything else: blocked

Limits
- Time per command: [COMMAND_TIMEOUT]
- Disk: [DISK_LIMIT]
- Processes left running after the session: none

Credentials available inside: [SCOPED_CREDENTIALS]
Lifetime: [EPHEMERAL_OR_PERSISTENT]`,
    why: "📦 Sandbox\n• Limits what the agent can reach even when a prompt or a permission rule fails\n• Credentials inside are scoped to the task and nothing wider\n• With a tight sandbox, fewer actions need a human approval",
  },
  {
    id: "harness-memory",
    emoji: "🗃️",
    label: "Memory Policy",
    color: "#6366F1",
    glow: "#6366F144",
    text: `# Memory — [AGENT_NAME]

Where: [MEMORY_DIRECTORY], one fact per file, listed in [INDEX_FILE]

Save only what is
- durable: still true next week, beyond this task
- applicable: it would change what you do in a later session

Save: [THINGS_WORTH_SAVING]
Never save: secrets, [SENSITIVE_DATA], anything the repo already records

Before relying on a memory: check it against the current code. A memory describes the day it was written.
When a memory turns out wrong: correct or delete it. Do not add a second one that contradicts it.`,
    why: "🗃️ Memory policy\n• Decides what survives the end of a session\n• A note can be out of date, so it is checked against the code before use\n• One fact per file keeps corrections simple",
  },
  {
    id: "harness-done",
    emoji: "🏁",
    label: "Definition of Done",
    color: "#818CF8",
    glow: "#818CF844",
    text: `# Definition of done — [TASK_TYPE]

The work is finished only when all of these are true:
- [ ] \`[TEST_COMMAND]\` passes, and the output is shown
- [ ] \`[LINT_COMMAND]\` passes
- [ ] [BEHAVIOUR_CHECK] was observed, not assumed
- [ ] No unrelated files changed
- [ ] [DOCS_OR_CHANGELOG] updated if behaviour changed

Report
- What changed: [FILES_AND_SUMMARY]
- How it was verified: the commands run and their results
- What was not done or not verified, and why`,
    why: "🏁 Definition of done\n• Lists the checks that must pass before the agent may say it is finished\n• Asking for command output makes a skipped check visible\n• The report has a line for what was not verified",
  },
];
