// Layer 7 — Organisation. Agents arranged the way a company arranges people:
// a charter, role cards, reporting lines, decision rights, policies, reviews.

export const ORGANISATION_BLOCKS = [
  {
    id: "org-charter",
    emoji: "🏛️",
    label: "Charter",
    color: "#10B981",
    glow: "#10B98144",
    text: `# Charter — [ORGANISATION_NAME]

Mission: [WHAT_IT_EXISTS_TO_DO]
Serves: [CUSTOMER_OR_OWNER]
Accountable human: [ACCOUNTABLE_PERSON]

In scope
- [RESPONSIBILITY_1]
- [RESPONSIBILITY_2]

Out of scope
- [EXCLUDED_AREA]

How success is measured
- [OUTCOME_METRIC]: target [TARGET], checked [HOW_OFTEN]

Never, whatever the instruction
- [HARD_LIMIT_1]
- [HARD_LIMIT_2]

This charter can be changed by [CHARTER_OWNER] only.`,
    why: "🏛️ Charter\n• States what the organisation is for and where it stops\n• Names the human who answers for it\n• Role cards and policies should each trace back to a line here",
  },
  {
    id: "org-role",
    emoji: "👤",
    label: "Role Card",
    color: "#059669",
    glow: "#05966944",
    text: `# Role — [ROLE_TITLE]

Reports to: [MANAGER_ROLE]
Purpose: [WHY_THIS_ROLE_EXISTS]

Responsible for
- [RESPONSIBILITY_1]
- [RESPONSIBILITY_2]

May decide alone: [OWN_DECISIONS]
Must ask [MANAGER_ROLE] before: [ESCALATED_DECISIONS]
Never: [PROHIBITED_ACTIONS]

Receives work from [UPSTREAM_ROLES], as [INPUT_FORMAT]
Hands work to [DOWNSTREAM_ROLES], as [OUTPUT_FORMAT]

Tools and access: [TOOLS_AND_PERMISSIONS]
Model: [MODEL]
Judged on: [QUALITY_MEASURE]`,
    why: "👤 Role card\n• A job description for an agent: purpose, authority, limits\n• Inputs and outputs are named, so roles connect without guessing\n• 'May decide alone' and 'must ask' set how far the role runs unattended",
  },
  {
    id: "org-chart",
    emoji: "🏢",
    label: "Org Chart",
    color: "#34D399",
    glow: "#34D39944",
    text: `# Org chart — [ORGANISATION_NAME]

[ACCOUNTABLE_PERSON] (human)
└─ [LEAD_ROLE] — plans, assigns, reviews
   ├─ [TEAM_A_LEAD]
   │  ├─ [WORKER_ROLE_1]
   │  └─ [WORKER_ROLE_2]
   ├─ [TEAM_B_LEAD]
   │  └─ [WORKER_ROLE_3]
   └─ [REVIEWER_ROLE] — independent of the teams it reviews

Rules
- Every role has exactly one manager.
- A manager directs at most [SPAN_OF_CONTROL] roles.
- Work goes down as a brief and comes back up as a report.
- Roles in different teams talk through [CROSS_TEAM_CHANNEL].
- Humans sit at: [HUMAN_POSITIONS]`,
    why: "🏢 Org chart\n• Shows who assigns work to whom and who reviews it\n• One manager per role avoids conflicting instructions\n• The reviewer sits outside the teams it checks",
  },
  {
    id: "org-decisions",
    emoji: "⚖️",
    label: "Decision Rights",
    color: "#4ADE80",
    glow: "#4ADE8044",
    text: `# Decision rights — [ORGANISATION_NAME]

| Decision | Decides | Must be consulted | Told afterwards |
|----------|---------|-------------------|-----------------|
| [ROUTINE_DECISION] | [WORKER_ROLE] | – | [MANAGER_ROLE] |
| [DESIGN_DECISION] | [LEAD_ROLE] | [REVIEWER_ROLE] | [ACCOUNTABLE_PERSON] |
| Spend above [SPEND_THRESHOLD] | [ACCOUNTABLE_PERSON] | [LEAD_ROLE] | – |
| [IRREVERSIBLE_ACTION] | [ACCOUNTABLE_PERSON] | [LEAD_ROLE] | – |
| A change to a policy or a role card | [POLICY_OWNER] | [AFFECTED_ROLES] | everyone |

If a decision is not in this table, the role asks its manager and the answer is added here.
An agent never approves its own request.`,
    why: "⚖️ Decision rights\n• Says which role may decide what without asking\n• Spending and actions that cannot be undone stay with a human\n• A gap in the table becomes a question, then a new row",
  },
  {
    id: "org-escalation",
    emoji: "📣",
    label: "Escalation Path",
    color: "#14B8A6",
    glow: "#14B8A644",
    text: `# Escalation — [ORGANISATION_NAME]

Escalate when
- the task needs a decision above your rights
- two instructions conflict
- you found something outside your task that looks wrong, such as [EXAMPLES]
- you have been stuck for [STUCK_THRESHOLD]

Path: [WORKER_ROLE] → [MANAGER_ROLE] → [LEAD_ROLE] → [ACCOUNTABLE_PERSON]
Urgent ([URGENT_CRITERIA]): go straight to [ACCOUNTABLE_PERSON] through [URGENT_CHANNEL]

An escalation says
1. What you were doing
2. What you found, with evidence
3. The options, and the one you recommend
4. What you will do while waiting: [SAFE_DEFAULT]

An answer is expected within [RESPONSE_TIME]. With no answer, take [SAFE_DEFAULT]. Do not take the risky option.`,
    why: "📣 Escalation path\n• Gives every agent a place to take a problem it cannot settle\n• The message carries evidence and a recommendation, so it can be answered quickly\n• The safe default covers the case where nobody answers",
  },
  {
    id: "org-cadence",
    emoji: "📅",
    label: "Operating Cadence",
    color: "#0D9488",
    glow: "#0D948844",
    text: `# Operating cadence — [ORGANISATION_NAME]

| When | What | Who | Output |
|------|------|-----|--------|
| Every [SHORT_INTERVAL] | Status reports | every role | one line each, to [MANAGER_ROLE] |
| Daily | Plan the queue | [LEAD_ROLE] | a prioritised queue |
| Daily | Review finished work | [REVIEWER_ROLE] | accepted, or returned with reasons |
| Weekly | Summary for the human | [LEAD_ROLE] | [REPORT_FORMAT] to [ACCOUNTABLE_PERSON] |
| Weekly | Clean up memory and notes | [MAINTAINER_ROLE] | stale entries removed |
| Monthly | Review roles and policies | [ACCOUNTABLE_PERSON] | changes to role cards |

The weekly summary leads with: what shipped, what it cost, what went wrong, what needs a decision.`,
    why: "📅 Operating cadence\n• The recurring meetings of an agent organisation, written as a schedule\n• Review and clean-up are scheduled work with an owner\n• The human gets a regular summary that leads with the decisions needed",
  },
  {
    id: "org-policy",
    emoji: "📏",
    label: "Policy",
    color: "#2DD4BF",
    glow: "#2DD4BF44",
    text: `# Policy — [POLICY_NAME]

Applies to: [ROLES_IN_SCOPE]
Owner: [POLICY_OWNER]
In force from: [START_DATE]

Rule
[THE_RULE_IN_ONE_OR_TWO_SENTENCES]

Why it exists
[REASON_OR_INCIDENT]

In practice
- Allowed: [ALLOWED_EXAMPLE]
- Not allowed: [FORBIDDEN_EXAMPLE]
- Edge case: [EDGE_CASE] → [RULING]

Enforced by: [HOOK_OR_PERMISSION_OR_REVIEW]
Exceptions: granted by [EXCEPTION_APPROVER], recorded in [EXCEPTION_LOG]
Review date: [REVIEW_DATE]`,
    why: "📏 Policy\n• One rule, its reason, and an example on each side of the line\n• The reason helps an agent with a case the rule did not foresee\n• Names the hook, permission or review that enforces it",
  },
  {
    id: "org-review",
    emoji: "📈",
    label: "Performance Review",
    color: "#22C55E",
    glow: "#22C55E44",
    text: `# Performance review — [ROLE_TITLE] — [PERIOD]

Sample: [SAMPLE_SIZE] pieces of finished work, chosen [HOW_SAMPLED]

| Measure | Result | Target |
|---------|--------|--------|
| Accepted on first review | [ACCEPTED_RESULT] | [ACCEPTED_TARGET] |
| Returned, with the main reasons | [RETURNED_RESULT] | [RETURNED_TARGET] |
| Escalations: needed / not needed | [ESCALATION_RESULT] | [ESCALATION_TARGET] |
| Cost per finished task | [COST_RESULT] | [COST_TARGET] |
| Rules broken | [RULES_BROKEN] | 0 |

What went wrong more than once
- [RECURRING_FAILURE] — seen in [EXAMPLES]

Change to make
- To the role card or prompt: [PROMPT_CHANGE]
- To tools or permissions: [HARNESS_CHANGE]
- To the checks: [CHECK_CHANGE]

Re-test the change on [REGRESSION_CASES] before it goes live.
Reviewed by: [REVIEWER]`,
    why: "📈 Performance review\n• Looks at a sample of a role's real output on a schedule\n• A recurring failure leads to a change in the role card, the tools or the checks\n• The change is tested on saved cases before it replaces the old version",
  },
  {
    id: "org-onboarding",
    emoji: "🎒",
    label: "Onboarding Pack",
    color: "#16A34A",
    glow: "#16A34A44",
    text: `# Onboarding — [ROLE_TITLE]

Read in this order
1. The charter: [CHARTER_LOCATION]
2. Your role card: [ROLE_CARD_LOCATION]
3. Policies that apply to you: [POLICY_LIST]
4. How work reaches you: [QUEUE_LOCATION]

Who is who
- Your manager: [MANAGER_ROLE]
- Reviews your work: [REVIEWER_ROLE]
- Escalate to: [ESCALATION_CONTACT]

Three examples of good work in this role: [EXAMPLE_LOCATIONS]
Mistakes earlier holders of this role made: [KNOWN_PITFALLS]

First task: [STARTER_TASK] — small, and reviewed in full before you take work from the queue`,
    why: "🎒 Onboarding pack\n• What a newly started agent in this role reads first\n• Points to documents instead of copying them, so it stays current\n• Begins with one small task that is reviewed in full",
  },
];
