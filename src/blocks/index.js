import { PROMPT_BLOCKS } from "./prompt";
import { SPEC_BLOCKS, STEERING_BLOCKS, SKILL_BLOCKS } from "./context";
import { HARNESS_BLOCKS } from "./harness";
import { LOOP_BLOCKS } from "./loop";
import { GRAPH_BLOCKS } from "./graph";
import { FLEET_BLOCKS } from "./fleet";
import { ORGANISATION_BLOCKS } from "./organisation";
import { HOLDING_BLOCKS } from "./holding";

// The palette on the left of the studio, top to bottom. Each layer wraps the
// one above it: a prompt sits inside a context, a context inside a harness,
// and so on up to a holding of several organisations.
//
// To add a layer, append an entry here. To add a template, append a block to
// the layer's file. Block ids must be unique across every layer, because a
// dragged block is looked up by id alone.
export const LAYERS = [
  {
    id: "prompt",
    label: "Prompt",
    unit: "one model call",
    color: "#7C3AED",
    groups: [{ id: "prompt", blocks: PROMPT_BLOCKS }],
  },
  {
    id: "context",
    label: "Context",
    unit: "what the model is given",
    color: "#14B8A6",
    groups: [
      { id: "specs", label: "Specs", blocks: SPEC_BLOCKS },
      { id: "steering", label: "Steering", blocks: STEERING_BLOCKS },
      { id: "skills", label: "Skills", blocks: SKILL_BLOCKS },
    ],
  },
  {
    id: "harness",
    label: "Harness",
    unit: "one agent and its tools",
    color: "#3B82F6",
    groups: [{ id: "harness", blocks: HARNESS_BLOCKS }],
  },
  {
    id: "loop",
    label: "Loop",
    unit: "one agent, many turns",
    color: "#F43F5E",
    groups: [{ id: "loop", blocks: LOOP_BLOCKS }],
  },
  {
    id: "graph",
    label: "Graph",
    unit: "agents wired in fixed steps",
    color: "#A855F7",
    groups: [{ id: "graph", blocks: GRAPH_BLOCKS }],
  },
  {
    id: "fleet",
    label: "Fleet",
    unit: "many agents in parallel",
    color: "#F97316",
    groups: [{ id: "fleet", blocks: FLEET_BLOCKS }],
  },
  {
    id: "organisation",
    label: "Organisation",
    unit: "agents as a company",
    color: "#10B981",
    groups: [{ id: "organisation", blocks: ORGANISATION_BLOCKS }],
  },
  {
    id: "holding",
    label: "Holding",
    unit: "several organisations",
    color: "#EAB308",
    groups: [{ id: "holding", blocks: HOLDING_BLOCKS }],
  },
];

export const ALL_BLOCKS = LAYERS.flatMap((layer) => layer.groups.flatMap((group) => group.blocks));

export { PROMPT_BLOCKS };
