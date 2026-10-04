# ACE Studio

ACE stands for Automated Computer Engineering. This is a drag-and-drop studio
for the documents agentic AI work is written in, with templates for eight
layers down the left side. It is a static single-page React app with no
backend and no accounts. Everything the user writes stays in their browser
(`localStorage`) or on their own disk.

Live page: <https://www.oursharedcode.com/ace-studio/>

## Where it comes from

The studio combines two earlier projects:

- [`prompt-engineering-studio`](https://github.com/oursharedcode/prompt-engineering-studio)
  gave the shell: Vite, React 18, the right rail with the visitor map, the
  static prose under the app, and the GitHub Pages deployment.
- `prompt-and-context-engineering-studio` gave the editor: the Prompt blocks,
  the Context blocks (specs, steering, skills), the skill-folder `.zip` export
  and *Open from Bitbucket*.

On top of those it adds six layers of templates: Harness, Loop, Graph, Fleet,
Organisation and Holding.

## The eight layers

| # | Layer        | Unit                         | Templates | File                                                       |
| - | ------------ | ---------------------------- | --------- | ---------------------------------------------------------- |
| 1 | Prompt       | one model call               | 12        | [`src/blocks/prompt.js`](./src/blocks/prompt.js)             |
| 2 | Context      | what the model is given      | 13        | [`src/blocks/context.js`](./src/blocks/context.js)           |
| 3 | Harness      | one agent and its tools      | 9         | [`src/blocks/harness.js`](./src/blocks/harness.js)           |
| 4 | Loop         | one agent, many turns        | 8         | [`src/blocks/loop.js`](./src/blocks/loop.js)                 |
| 5 | Graph        | agents wired in fixed steps  | 8         | [`src/blocks/graph.js`](./src/blocks/graph.js)               |
| 6 | Fleet        | many agents in parallel      | 8         | [`src/blocks/fleet.js`](./src/blocks/fleet.js)               |
| 7 | Organisation | agents as a company          | 9         | [`src/blocks/organisation.js`](./src/blocks/organisation.js) |
| 8 | Holding      | several organisations        | 8         | [`src/blocks/holding.js`](./src/blocks/holding.js)           |

75 templates in total. The palette is drawn from the `LAYERS` array in
[`src/blocks/index.js`](./src/blocks/index.js); nothing about a layer is
hard-coded in the component.

### Adding a template

Append an object to the layer's file:

```js
{
  id: "loop-example",        // unique across every layer
  emoji: "🔁",
  label: "Example",
  color: "#F43F5E",
  glow: "#F43F5E44",
  text: `Starter text with [PLACEHOLDERS]`,
  why: "🔁 Title\n• What the document is for\n• One line per point",
}
```

Three things to know:

- `[UPPERCASE_TOKENS]` in `text` become chips. Filling a chip replaces the
  first occurrence of that token only, so give each cell of a table its own
  token (`[TASK_1]`, `[TASK_2]`).
- Windows 10 draws emoji up to Emoji 12. A newer one shows as an empty box
  there, so pick from the older sets.
- Outside the Prompt layer a template counts as "used" only by its `id`. The
  Prompt layer and custom blocks are also recognised by their first 12
  characters, which is how a prompt loaded from a file is still scored.

### Adding a layer

Create `src/blocks/<name>.js` exporting an array of templates, then add an
entry to `LAYERS` in [`src/blocks/index.js`](./src/blocks/index.js). A layer
can hold several groups, each with its own sub-heading; Context does.

## Features carried over

- Block editor with drag-and-drop, inline editing, placeholder chips,
  undo/redo, live word and character count.
- Custom blocks: create, edit, delete, reorder, and save or load the library
  as `blocks.json`. A `blocks.json` from Prompt Engineering Studio loads here.
- Export as `.prompt` JSON, Python string, OpenAI or Anthropic messages JSON,
  Markdown, plain text, or an Agent Skill folder packed into a `.zip`.
- In-browser library with colour-coded projects, and three themes.
- Health score and hallucination badge. Both read the Prompt layer only.
- Right rail: an AdSense slot (hidden until IDs are set) and the visitor map.

Saved work is kept under `ace_studio_*` keys in `localStorage`. Prompt
Engineering Studio uses `prompt_studio_*` keys on the same origin, so the two
libraries are separate. Custom blocks move between them through `blocks.json`.

## Local development

```bash
npm install
npm run dev        # http://localhost:5300
npm run build      # static site in ./dist
npm run preview    # http://localhost:4300
```

Ports are pinned in [`vite.config.js`](./vite.config.js) and are `strictPort`,
so a clash fails instead of drifting to another number.

The visitor map shows "Visitor stats unavailable" in local dev. The counter
Worker accepts requests from the production origin and from Prompt Engineering
Studio's two local ports, and 5300 and 4300 are not on that list. To see the
map locally, add them to the allowlist at the top of
`deploy/visitor-stats-worker.js` in the `prompt-engineering-studio` repo and
redeploy the Worker.

## Site configuration

[`src/config.js`](./src/config.js) holds three values:

| Key               | What it is                                                         |
| ----------------- | ------------------------------------------------------------------ |
| `adsenseClient`   | AdSense publisher ID. Empty until the domain is approved.          |
| `adsenseSlot`     | Slot ID of a vertical display unit. Empty until then.              |
| `visitorStatsUrl` | The visitor-counter Worker shared with Prompt Engineering Studio.  |

The ad rail renders nothing until both AdSense values are set. Both studios
post to the same Worker, so there is one visitor tally for the two pages.

## Written content

[`index.html`](./index.html) carries static prose under `<div id="root">`
describing the eight layers. React owns `#root` and nothing else, so the prose
is there with JavaScript off. Its styles are in
[`src/page-notes.css`](./src/page-notes.css).

Two build traps, both met in Prompt Engineering Studio:

- Do not put HTML files in `public/`. Vite 5 treats them as extra input and
  the build fails with `No matching HTML proxy module found`.
- Do not use inline `<style>` blocks in an HTML page. Link a stylesheet.

The ten prompt-writing guides are not copied here. The page links to them at
<https://www.oursharedcode.com/prompt-engineering-studio/guides/>.

## Deployment

Pushing to `main` runs
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml), which builds
the site and publishes `dist/` to GitHub Pages (repo **Settings → Pages →
Source: GitHub Actions**).

The `oursharedcode` root Pages site carries the custom domain
`www.oursharedcode.com`, and GitHub serves every project site of the account
under it at the repository's name. This repo is therefore live at
`https://www.oursharedcode.com/ace-studio/` with no DNS or routing to set up.
Renaming the repo changes the URL.

## File formats

| File          | Contents                                                              |
| ------------- | --------------------------------------------------------------------- |
| `*.prompt`    | JSON `{ version, exportedAt, wordCount, text }`                        |
| `blocks.json` | JSON `{ version, exportedAt, blocks: [{label, emoji, color, text}] }` |
