// Layer 5 — Graph. Several model calls or agents wired into a workflow whose
// steps are fixed in advance: nodes, edges, shared state, routing, gates.

export const GRAPH_BLOCKS = [
  {
    id: "graph-workflow",
    emoji: "🕸️",
    label: "Workflow Spec",
    color: "#A855F7",
    glow: "#A855F744",
    text: `# Workflow — [WORKFLOW_NAME]

Purpose: [WHAT_IT_PRODUCES]
Input: [INPUT_SHAPE]
Output: [OUTPUT_SHAPE]

Nodes
1. [NODE_1] — [WHAT_NODE_1_DOES]
2. [NODE_2] — [WHAT_NODE_2_DOES]
3. [NODE_3] — [WHAT_NODE_3_DOES]

Edges
- start → [NODE_1]
- [NODE_1] → [NODE_2]
- [NODE_2] → [NODE_3] when [CONDITION]; otherwise back to [NODE_1]
- [NODE_3] → end

Runs in parallel: [PARALLEL_NODES]
Needs a human: [GATED_NODES]
Most passes around any cycle: [MAX_CYCLES]`,
    why: "🕸️ Workflow spec\n• Code decides the order of the steps; the model works inside each step\n• Writing the edges down shows every cycle and where it ends\n• Fits work whose steps are known in advance; open-ended work suits a single agent better",
  },
  {
    id: "graph-node",
    emoji: "🔲",
    label: "Node Contract",
    color: "#9333EA",
    glow: "#9333EA44",
    text: `# Node — [NODE_NAME]

Does one thing: [SINGLE_RESPONSIBILITY]

Reads from state: [INPUT_KEYS]
Writes to state: [OUTPUT_KEYS]
Model: [MODEL]
Tools: [ALLOWED_TOOLS]

Prompt
You receive [INPUT_DESCRIPTION]. [INSTRUCTION]
Return only JSON that matches the schema, with no prose around it.

Output schema
{
  "[FIELD_1]": "[TYPE_AND_MEANING_1]",
  "[FIELD_2]": "[TYPE_AND_MEANING_2]",
  "confidence": "high | medium | low"
}

On invalid output: retry [N] times with the validation error, then route to [FALLBACK_NODE].`,
    why: "🔲 Node contract\n• One job, declared inputs, a typed output\n• The schema lets the next node rely on what it receives\n• Reading only the listed state keys keeps the node's context small",
  },
  {
    id: "graph-state",
    emoji: "🧾",
    label: "Shared State",
    color: "#C084FC",
    glow: "#C084FC44",
    text: `# State — [WORKFLOW_NAME]

| Key | Type | Written by | Read by | Merge rule |
|-----|------|------------|---------|------------|
| [KEY_1] | [TYPE_1] | [WRITER_1] | [READERS_1] | replace |
| [KEY_2] | list of [TYPE_2] | [PARALLEL_WRITERS] | [READERS_2] | append |
| [KEY_3] | [TYPE_3] | [WRITER_3] | [READERS_3] | replace |

Checkpoint after: every node
Resume: from the last checkpoint, with the same state
Kept out of state: [LARGE_OR_SECRET_DATA] — store a reference to it, not the content`,
    why: "🧾 Shared state\n• The one record every node reads from and writes to\n• Keys with parallel writers need a merge rule, or the last write wins\n• Checkpoints let a failed run resume where it stopped",
  },
  {
    id: "graph-router",
    emoji: "🔀",
    label: "Router",
    color: "#E879F9",
    glow: "#E879F944",
    text: `# Router — [ROUTER_NAME]

Classify the input into exactly one route.

Routes
- [ROUTE_A]: [WHEN_TO_CHOOSE_A]. Example: [EXAMPLE_A]
- [ROUTE_B]: [WHEN_TO_CHOOSE_B]. Example: [EXAMPLE_B]
- [ROUTE_C]: [WHEN_TO_CHOOSE_C]. Example: [EXAMPLE_C]
- unclear: none of the above fits, or two fit equally well

Return JSON: { "route": "<one of the names above>", "reason": "<one sentence>" }

If you are choosing between two routes, return "unclear". Do not guess.
"unclear" goes to: [FALLBACK_NODE_OR_HUMAN]`,
    why: "🔀 Router\n• Sends each input down the branch built for it\n• Every route has one example next to its definition\n• An explicit 'unclear' route stops a wrong guess from running a whole branch",
  },
  {
    id: "graph-fanout",
    emoji: "🌿",
    label: "Fan-out / Fan-in",
    color: "#D946EF",
    glow: "#D946EF44",
    text: `# Fan-out — [STAGE_NAME]

Split [INPUT] into: [UNITS_OF_WORK]
Run one worker per unit, at most [MAX_PARALLEL] at a time.

Each worker gets
- its own unit and [SHARED_CONTEXT]
- nothing from the other workers

Each worker returns: [WORKER_OUTPUT_SCHEMA]

Fan-in
- Merge by: [MERGE_RULE]
- Duplicates: [DEDUPE_RULE]
- Workers that disagree: [CONFLICT_RULE]
- A worker that fails or times out: [RETRY_OR_SKIP], and name it in the result as missing`,
    why: "🌿 Fan-out / fan-in\n• Independent units of work run side by side, each in its own context\n• Merge, duplicate and conflict rules are written before the workers start\n• A failed worker is reported as a gap in the result",
  },
  {
    id: "graph-verifier",
    emoji: "🔍",
    label: "Verifier Node",
    color: "#C026D3",
    glow: "#C026D344",
    text: `# Verifier — [WHAT_IT_CHECKS]

You are checking another agent's work. You did not write it, and you gain nothing if it passes.

You receive [ARTIFACT] and [ACCEPTANCE_CRITERIA]. You do not receive the author's reasoning.

For each criterion
- Try to show that it is not met.
- Run or read the evidence yourself: [HOW_TO_CHECK]

Return JSON
{
  "verdict": "pass | fail",
  "failures": [{ "criterion": "", "evidence": "", "where": "" }],
  "not_checked": []
}

Fail anything you could not check. On "fail" the workflow returns to [AUTHOR_NODE] with your failures, for at most [MAX_ROUNDS] rounds.`,
    why: "🔍 Verifier node\n• A second context that sees the work without the reasoning behind it\n• Asked to look for failures, and to fail what it could not check\n• The round limit ends an author-verifier cycle that does not converge",
  },
  {
    id: "graph-gate",
    emoji: "🚦",
    label: "Human Gate",
    color: "#A78BFA",
    glow: "#A78BFA44",
    text: `# Human gate — before [GATED_ACTION]

Pause the workflow and show the approver:
- What will happen: [ACTION_SUMMARY]
- What it changes: [AFFECTED_SYSTEMS]
- Whether it can be undone: [REVERSIBILITY]
- Evidence: [DIFF_OR_PREVIEW]

Approver: [APPROVER_ROLE]
Choices: approve, reject with a reason, or edit and approve

While waiting: the state is checkpointed and nothing downstream runs
No answer after [TIMEOUT]: [TIMEOUT_ACTION]
On reject: route to [REVISION_NODE] with the reason`,
    why: "🚦 Human gate\n• A pause before an action that is costly or hard to undo\n• The approver is shown the evidence along with the question\n• What happens on no answer is decided in advance",
  },
  {
    id: "graph-retry",
    emoji: "♻️",
    label: "Retry & Fallback",
    color: "#8B5CF6",
    glow: "#8B5CF644",
    text: `# Failure policy — [WORKFLOW_NAME]

| Failure | Action | Limit | Then |
|---------|--------|-------|------|
| Output fails the schema | retry with the validation error | [SCHEMA_RETRIES] | [FALLBACK_NODE] |
| Tool or API error | retry with backoff [BACKOFF] | [TOOL_RETRIES] | mark the step failed |
| Timeout after [NODE_TIMEOUT] | retry once | 1 | [TIMEOUT_FALLBACK] |
| Verifier rejects | return to the author with the failures | [MAX_ROUNDS] | human gate |
| Low confidence | [LOW_CONFIDENCE_ACTION] | – | – |

Steps that must not run twice: [NON_IDEMPOTENT_STEPS] — look for an earlier result before retrying
Limits for a whole run: [MAX_STEPS] steps, [MAX_DURATION], [MAX_BUDGET]
When a run fails: keep the state and the trace at [TRACE_LOCATION]`,
    why: "♻️ Retry and fallback\n• Each kind of failure has its own action and its own limit\n• Steps with side effects are checked before any retry\n• State and trace are kept so the failure can be investigated",
  },
];
