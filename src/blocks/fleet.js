// Layer 6 — Fleet. Many agent sessions working in parallel on separate tasks:
// briefs, a queue, isolated workspaces, merging, budgets, monitoring.

export const FLEET_BLOCKS = [
  {
    id: "fleet-manifest",
    emoji: "🚀",
    label: "Fleet Manifest",
    color: "#F97316",
    glow: "#F9731644",
    text: `# Fleet — [FLEET_NAME]

Goal: [OVERALL_GOAL]
Coordinator: [COORDINATOR]
Started by: [OWNER]

| Agent | Task | Workspace | Model | Budget | Status |
|-------|------|-----------|-------|--------|--------|
| [AGENT_1] | [TASK_1] | [WORKSPACE_1] | [MODEL_1] | [BUDGET_1] | queued |
| [AGENT_2] | [TASK_2] | [WORKSPACE_2] | [MODEL_2] | [BUDGET_2] | queued |
| [AGENT_3] | [TASK_3] | [WORKSPACE_3] | [MODEL_3] | [BUDGET_3] | queued |

Tasks that must not run at the same time: [CONFLICTING_TASKS]
Order that matters: [DEPENDENCIES]
The fleet is done when: [FLEET_ACCEPTANCE_CHECK]`,
    why: "🚀 Fleet manifest\n• One table of who is doing what, where, and on what budget\n• Conflicts and dependencies are named before anything starts\n• The fleet has its own acceptance check, apart from each agent's",
  },
  {
    id: "fleet-brief",
    emoji: "📨",
    label: "Task Brief",
    color: "#EA580C",
    glow: "#EA580C44",
    text: `# Brief — [TASK_TITLE]

You are one of several agents working in parallel. You know only what is on this page.

Goal: [GOAL]
What it is for: [WHY_IT_MATTERS]
Done when: [ACCEPTANCE_CHECK]

Already known
- [FACT_OR_FINDING]
- Ruled out, do not retry: [DEAD_ENDS]

Read first: [FILES_AND_DOCS]

Scope
- Change only: [OWNED_PATHS]
- Do not touch: [OTHER_AGENTS_PATHS]
- Ask before: [APPROVAL_REQUIRED_ACTION]

Return
1. The result: [EXPECTED_OUTPUT]
2. How you verified it
3. What you did not do`,
    why: "📨 Task brief\n• A fresh agent knows only what the brief says\n• 'Ruled out' saves it from repeating your dead ends\n• Owned paths keep parallel agents out of each other's files",
  },
  {
    id: "fleet-queue",
    emoji: "📥",
    label: "Work Queue",
    color: "#FB923C",
    glow: "#FB923C44",
    text: `# Queue — [FLEET_NAME]

| ID | Task | Priority | Depends on | Claimed by | State |
|----|------|----------|------------|------------|-------|
| [ID_1] | [TASK_1] | [PRIORITY_1] | – | – | open |
| [ID_2] | [TASK_2] | [PRIORITY_2] | [ID_1] | – | blocked |

Rules
- Claim before you start: write your name and the time under "Claimed by". One task per agent.
- A claim with no update for [CLAIM_TIMEOUT] goes back to open.
- States: open → claimed → in review → done, or failed with a reason.
- Found new work? Add a row. Do not do it unasked.
- Never take a task whose dependency is not done.`,
    why: "📥 Work queue\n• One list every agent claims from, so no task is done twice\n• Claims expire, which recovers work from an agent that died\n• New work goes onto the queue instead of into someone's scope",
  },
  {
    id: "fleet-isolation",
    emoji: "🌳",
    label: "Isolation & Merge",
    color: "#FF8A4C",
    glow: "#FF8A4C44",
    text: `# Isolation and merge — [FLEET_NAME]

Isolation
- One agent = one [WORKTREE_OR_BRANCH_OR_CONTAINER], created from [BASE_BRANCH]
- Shared, read-only: [SHARED_RESOURCES]
- Not shared: ports, local databases, caches. Each agent gets its own: [PER_AGENT_RESOURCES]

Merge
- Order: [MERGE_ORDER]
- Before merging: rebase on [BASE_BRANCH], then \`[TEST_COMMAND]\` must pass
- Merged by: [MERGER], not by the agent that wrote the change
- On a conflict: [CONFLICT_RULE]
- After each merge: run \`[INTEGRATION_CHECK]\` on [BASE_BRANCH]

A change that passed alone and fails after merging goes back to its author with the failing output.`,
    why: "🌳 Isolation and merge\n• Separate workspaces stop agents overwriting each other mid-task\n• Ports and local databases collide as easily as files do\n• Each merge is re-tested: two changes that pass alone can fail together",
  },
  {
    id: "fleet-budget",
    emoji: "💰",
    label: "Budget & Limits",
    color: "#F59E0B",
    glow: "#F59E0B44",
    text: `# Budget — [FLEET_NAME]

Total: [TOTAL_BUDGET] over [TIME_WINDOW]
Running at once: at most [MAX_CONCURRENT] agents
Rate limit shared by all: [RATE_LIMIT]

Per agent
- Spend: [PER_AGENT_BUDGET]
- Time: [PER_AGENT_DURATION]
- Model: [DEFAULT_MODEL]; use [LARGER_MODEL] only for [HARD_TASK_TYPES]

At [WARN_PERCENT] of any limit: report to [COORDINATOR] and carry on
At the limit: stop, write a handoff note, release the claim

Not to be spent on: polling, re-running checks that already passed, retrying with nothing changed`,
    why: "💰 Budget and limits\n• Cost grows with every agent added, so the ceiling is set before launch\n• A per-agent cap contains the one that is going in circles\n• Stopping at the limit includes a handoff note, so the work so far is kept",
  },
  {
    id: "fleet-status",
    emoji: "📡",
    label: "Status Report",
    color: "#D97706",
    glow: "#D9770644",
    text: `# Status — [AGENT_NAME] — [TIMESTAMP]

Task: [TASK_ID]
State: [WORKING / BLOCKED / IN REVIEW / DONE / FAILED]
Verified so far: [CHECKS_PASSED]
Now: [CURRENT_STEP]
Blocked on: [BLOCKER_OR_NONE]
Needs a decision from a human: [QUESTION_OR_NONE]
Spent: [SPEND] of [PER_AGENT_BUDGET]
Next report: [NEXT_REPORT_TIME]`,
    why: "📡 Status report\n• The same fields from every agent, so a fleet can be read at a glance\n• 'Verified so far' reports checks that passed\n• Blockers and questions come up during the work, before the end",
  },
  {
    id: "fleet-monitor",
    emoji: "📊",
    label: "Monitoring",
    color: "#FBBF24",
    glow: "#FBBF2444",
    text: `# Monitoring — [FLEET_NAME]

| Signal | Healthy | Act when |
|--------|---------|----------|
| Last status report | within [REPORT_INTERVAL] | missing for [STALE_AFTER] |
| Checks passing | rising or steady | failing [FAILED_REPORTS] reports in a row |
| Spend per agent | under [PER_AGENT_BUDGET] | over [WARN_PERCENT] |
| Queue | shrinking | growing for [QUEUE_WINDOW] |
| Repeated tool errors | none | the same error [ERROR_REPEATS] times |

Who looks: [MONITOR_ROLE], every [CHECK_INTERVAL]
First response to a bad signal: read the agent's trace at [TRACE_LOCATION]
Then: redirect the agent with a message, restart it from its handoff note, or stop it`,
    why: "📊 Monitoring\n• A short list of signals and the point at which someone acts\n• A missing report counts as a problem to look into\n• The first response is to read the trace, then decide",
  },
  {
    id: "fleet-kill",
    emoji: "🧯",
    label: "Kill Switch",
    color: "#DC2626",
    glow: "#DC262644",
    text: `# Kill switch — [FLEET_NAME]

Stop one agent when
- it crosses a budget or time limit
- it touches [PROTECTED_PATHS] or runs [FORBIDDEN_ACTION]
- it has been stuck for [STUCK_THRESHOLD]

Stop the whole fleet when
- [FLEET_STOP_CONDITION]
- [BASE_BRANCH] is broken and nobody is assigned to fix it
- total spend passes [TOTAL_BUDGET]

How: \`[STOP_COMMAND]\`
Who may do it: [AUTHORISED_ROLES] — any one of them, without discussion

After a stop
- Keep the workspace and the trace
- Roll back: [ROLLBACK_PROCEDURE]
- Restart only after [RESTART_CONDITION]`,
    why: "🧯 Kill switch\n• One known command that stops an agent, or all of them\n• Stop conditions are written down before launch\n• Workspaces are kept after a stop so the cause can be found",
  },
];
