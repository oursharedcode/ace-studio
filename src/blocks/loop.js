// Layer 4 — Loop. One agent repeated over time: what each iteration does,
// where state lives between iterations, and when the loop ends.

export const LOOP_BLOCKS = [
  {
    id: "loop-prompt",
    emoji: "🔁",
    label: "Iteration Prompt",
    color: "#F43F5E",
    glow: "#F43F5E44",
    text: `You are running in a loop. Each iteration starts with a fresh context; the files below are your only memory.

Goal: [GOAL]

Every iteration:
1. Read [PROGRESS_FILE] and [PLAN_FILE].
2. Pick the single most important unfinished item. Only one.
3. Do it, then run \`[VERIFY_COMMAND]\`.
4. If it passes, commit with a message that says what changed.
5. Update [PROGRESS_FILE]: what you did, what you learned, what is next.
6. If every item is done and \`[VERIFY_COMMAND]\` passes, write [DONE_MARKER] and stop.

Do not start a second item in the same iteration.`,
    why: "🔁 Iteration prompt\n• The same prompt runs every turn; state lives in files\n• One item per iteration keeps each context small and each commit reviewable\n• The plan is re-read each time, so it can be edited between turns",
  },
  {
    id: "loop-plan",
    emoji: "🗺️",
    label: "Plan File",
    color: "#E11D48",
    glow: "#E11D4844",
    text: `# Plan — [GOAL]

Success means: [ACCEPTANCE_CHECK]

Items, most important first. One item = one iteration = one commit.
- [ ] 1. [ITEM_1] — done when [CHECK_1]
- [ ] 2. [ITEM_2] — done when [CHECK_2]
- [ ] 3. [ITEM_3] — done when [CHECK_3]

Out of scope: [OUT_OF_SCOPE]

The agent may reorder or split items and must say why in [PROGRESS_FILE]. It may not delete an item or change its check.`,
    why: "🗺️ Plan file\n• The loop's to-do list, sized so one item fits one context\n• Every item carries its own check\n• The agent can split work but cannot drop it without a trace",
  },
  {
    id: "loop-progress",
    emoji: "📓",
    label: "Progress File",
    color: "#FB7185",
    glow: "#FB718544",
    text: `# Progress — [GOAL]

## Done
- [COMPLETED_ITEM] (commit [COMMIT_HASH])

## In progress
- [CURRENT_ITEM]: [STATE_AND_NEXT_ACTION]

## Next
- [NEXT_ITEM]

## Learned (things a fresh context would get wrong)
- [GOTCHA_OR_DEAD_END]

## Open questions for a human
- [QUESTION]`,
    why: "📓 Progress file\n• The loop's memory between iterations\n• 'Learned' keeps the next iteration from repeating a dead end\n• Written for a reader with no context: the next iteration",
  },
  {
    id: "loop-verify",
    emoji: "🧪",
    label: "Verification Gate",
    color: "#EF4444",
    glow: "#EF444444",
    text: `# Per-iteration check — [LOOP_NAME]

Run after every change, before committing:
1. \`[FAST_CHECK_COMMAND]\` — must pass
2. \`[TEST_COMMAND]\` — must pass
3. [BEHAVIOUR_CHECK] — look at the result; do not infer it from the code

If a check fails
- Fix the cause. Do not weaken, skip or delete the check.
- If the check itself is wrong, stop and say so. Do not change it.

Never commit while a check is failing. Never mark an item done without the output of its check.`,
    why: "🧪 Verification gate\n• Each iteration proves its own work before the next one builds on it\n• The agent may not edit the check to make it pass\n• A failure is fixed in the iteration that caused it",
  },
  {
    id: "loop-stop",
    emoji: "🛑",
    label: "Stop Conditions",
    color: "#EC4899",
    glow: "#EC489944",
    text: `# Stop conditions — [LOOP_NAME]

Stop with success when
- [SUCCESS_CHECK] passes, and
- [PLAN_FILE] has no open items

Stop and hand back to a human when
- the same check has failed [N] iterations in a row
- an iteration ends with no change to the repo or to [PROGRESS_FILE]
- the next step needs [APPROVAL_REQUIRED_ACTION]

Hard limits, enforced outside the model
- Iterations: [MAX_ITERATIONS]
- Time: [MAX_DURATION]
- Spend: [MAX_BUDGET]`,
    why: "🛑 Stop conditions\n• Sets the exits before the loop starts\n• Success is defined by a check that can be run\n• Iteration, time and spend limits are enforced by the harness, outside the model",
  },
  {
    id: "loop-pacing",
    emoji: "⏱️",
    label: "Pacing",
    color: "#DB2777",
    glow: "#DB277744",
    text: `# Pacing — [LOOP_NAME]

Trigger: [INTERVAL_OR_EVENT]

Between iterations
- Waiting on work the harness reports ([BACKGROUND_TASK]): do not poll; resume when notified
- Waiting on something external ([EXTERNAL_STATE]): check every [POLL_INTERVAL], sized to how fast it changes
- Nothing to wait for: continue immediately

An iteration that finds nothing to do
- writes one line in [PROGRESS_FILE] and ends
- after [N] empty iterations, stretch the interval to [LONG_INTERVAL] or stop`,
    why: "⏱️ Pacing\n• Sets when the next turn fires: a timer, an event, or straight away\n• The poll interval follows how fast the watched thing changes\n• Empty iterations are recorded, then slowed down",
  },
  {
    id: "loop-stuck",
    emoji: "🆘",
    label: "Stuck Protocol",
    color: "#F472B6",
    glow: "#F472B644",
    text: `# When stuck — [LOOP_NAME]

You are stuck if
- the same error has come back [N] times, or
- you are about to try something you already tried, or
- the last [N] iterations changed nothing that the checks can see

Then
1. Stop trying variations.
2. Write to [PROGRESS_FILE]: what you tried, what happened each time, your best guess at the cause.
3. Try one different approach: [ALTERNATIVE_STRATEGY]
4. If that fails too, stop the loop and ask [ESCALATION_CONTACT].

Not allowed as a way out: disabling a check, deleting a test, narrowing the goal without saying so.`,
    why: "🆘 Stuck protocol\n• Names the signs that a loop is going in circles\n• Asks for a written diagnosis before another attempt\n• Rules out the shortcuts that would only look like progress",
  },
  {
    id: "loop-handoff",
    emoji: "🤝",
    label: "Handoff Note",
    color: "#F87171",
    glow: "#F8717144",
    text: `# Handoff — [GOAL]

State: [DONE / PARTLY DONE / BLOCKED]

What works now: [VERIFIED_BEHAVIOUR]
How to check it: \`[VERIFY_COMMAND]\`

What is left
- [REMAINING_ITEM]

What I would do next: [NEXT_STEP]

Things that will catch you out
- [GOTCHA]

Decisions I made that someone should confirm
- [DECISION_AND_REASON]`,
    why: "🤝 Handoff note\n• What the loop leaves for the next session or for a human\n• Keeps what was verified apart from what is only believed\n• Lists decisions the agent made alone, so they can be reviewed",
  },
];
