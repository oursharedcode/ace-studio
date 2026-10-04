import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import pkg from "../package.json";
// The palette's eight layers live in src/blocks/, one file per layer. BLOCKS is
// the Prompt layer: the health score and the hallucination badge read only it.
import { LAYERS, ALL_BLOCKS, PROMPT_BLOCKS as BLOCKS } from "./blocks";

const APP_VERSION = pkg.version;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCaretIndex(el, clientX, clientY) {
  // Use caretPositionFromPoint or caretRangeFromPoint to find insert position
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    return pos ? pos.offset : el.value.length;
  }
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(clientX, clientY);
    return range ? range.startOffset : el.value.length;
  }
  return el.value.length;
}

function getTextareaInsertIndex(textarea, clientX, clientY) {
  // Clone textarea as a div to measure character positions
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.style.cssText = `
    position: fixed; visibility: hidden; pointer-events: none;
    top: ${textarea.getBoundingClientRect().top}px;
    left: ${textarea.getBoundingClientRect().left}px;
    width: ${textarea.clientWidth}px;
    height: ${textarea.clientHeight}px;
    padding: ${style.padding};
    font: ${style.font};
    font-size: ${style.fontSize};
    font-family: ${style.fontFamily};
    line-height: ${style.lineHeight};
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-y: scroll;
    box-sizing: border-box;
  `;

  const text = textarea.value;
  let bestIndex = text.length;
  let bestDist = Infinity;

  // We'll use a simpler approach: use range/caret APIs on a hidden contenteditable
  const div = document.createElement("div");
  div.setAttribute("contenteditable", "true");
  div.style.cssText = mirror.style.cssText + `
    background: transparent; color: transparent; z-index: -9999;
    overflow: hidden;
  `;
  // Escape HTML
  div.innerText = text;
  document.body.appendChild(div);

  try {
    const range = document.caretRangeFromPoint
      ? document.caretRangeFromPoint(clientX, clientY)
      : null;

    if (range && div.contains(range.startContainer)) {
      // Walk the text nodes to compute offset
      let offset = 0;
      const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node === range.startContainer) {
          bestIndex = offset + range.startOffset;
          break;
        }
        offset += node.textContent.length;
      }
    } else {
      // Fallback: nearest line heuristic
      const rect = textarea.getBoundingClientRect();
      const relY = clientY - rect.top + textarea.scrollTop;
      const relX = clientX - rect.left;
      const lineH = parseInt(style.lineHeight) || 20;
      const lineIndex = Math.floor(relY / lineH);
      const lines = text.split("\n");
      let charOffset = 0;
      for (let i = 0; i < Math.min(lineIndex, lines.length - 1); i++) {
        charOffset += lines[i].length + 1;
      }
      const lineText = lines[Math.min(lineIndex, lines.length - 1)] || "";
      const charsPerPx = lineText.length / (textarea.clientWidth - 32) || 0.1;
      const charInLine = Math.round(relX * charsPerPx);
      bestIndex = charOffset + Math.min(charInLine, lineText.length);
    }
  } finally {
    document.body.removeChild(div);
  }

  return Math.max(0, Math.min(bestIndex, text.length));
}

// ─── Block Card Component ─────────────────────────────────────────────────────

function BlockCard({ block, onDragStart }) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("blockId", block.id);
        e.dataTransfer.effectAllowed = "copy";
        // Custom drag image
        const ghost = document.createElement("div");
        ghost.textContent = `${block.emoji} ${block.label}`;
        ghost.style.cssText = `
          position:fixed; top:-200px; left:-200px;
          background:${block.color}; color:#fff; padding:8px 14px;
          border-radius:8px; font:700 13px/1 'IBM Plex Mono',monospace;
          white-space:nowrap; box-shadow:0 4px 20px ${block.glow};
          pointer-events:none;
        `;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 60, 20);
        setTimeout(() => document.body.removeChild(ghost), 0);
        onDragStart(block.id);
        setIsPressed(true);
      }}
      onDragEnd={() => setIsPressed(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 10px",
        marginBottom: 0,
        borderRadius: 10,
        border: `1.5px solid ${block.color}55`,
        background: isPressed
          ? block.color + "33"
          : `linear-gradient(135deg, ${block.color}18, ${block.color}08)`,
        cursor: "grab",
        userSelect: "none",
        transition: "all 0.15s ease",
        transform: isPressed ? "scale(0.97)" : "scale(1)",
        boxShadow: isPressed ? `0 0 0 2px ${block.color}66` : "none",
      }}
      onMouseEnter={(e) => {
        if (!isPressed) {
          e.currentTarget.style.background = `linear-gradient(135deg, ${block.color}30, ${block.color}15)`;
          e.currentTarget.style.borderColor = block.color + "99";
          e.currentTarget.style.transform = "translateX(3px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isPressed) {
          e.currentTarget.style.background = `linear-gradient(135deg, ${block.color}18, ${block.color}08)`;
          e.currentTarget.style.borderColor = block.color + "55";
          e.currentTarget.style.transform = "translateX(0)";
        }
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{block.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: block.color, letterSpacing: 0.3 }}>
          {block.label}
        </div>
      </div>
      {/* "Why?" icon — only on built-in blocks that have a why explanation */}
      {block.why && (
        <span
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.stopPropagation()}
          draggable={false}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 15, height: 15, borderRadius: "50%",
            border: `1px solid ${block.color}88`, color: block.color,
            fontSize: 8, fontWeight: 700, cursor: "default",
            userSelect: "none", flexShrink: 0, letterSpacing: 0,
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const tip = document.getElementById("why-block-tooltip");
            if (tip) {
              tip.style.left = Math.max(8, rect.right - 280) + "px";
              tip.style.borderColor = block.color + "99";
              tip.innerText = block.why;
              tip.style.display = "block";
              // The palette is long: near the bottom of the window, open upwards.
              const below = rect.bottom + 6;
              const fits = below + tip.offsetHeight <= window.innerHeight - 8;
              tip.style.top = (fits ? below : Math.max(8, rect.top - 6 - tip.offsetHeight)) + "px";
            }
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            const tip = document.getElementById("why-block-tooltip");
            if (tip) tip.style.display = "none";
          }}
        >
          ?
        </span>
      )}
    </div>
  );
}

// ─── Block Model Helpers ──────────────────────────────────────────────────────

let _blkSeq = 0;
const makeBlockId = () => `blk-${Date.now()}-${++_blkSeq}`;

const makeFreeBlock = (text = "") => ({
  id: makeBlockId(),
  blockId: null,
  label: null,
  color: null,
  text,
});

const makeNamedBlock = (tpl) => ({
  id: makeBlockId(),
  blockId: tpl.id,
  label: tpl.label,
  color: tpl.color,
  text: tpl.text,
});

// The editor's blocks are kept in localStorage, so a reload or a closed tab
// does not lose the document
const EDITOR_KEY = "ace_studio_editor";

const loadEditorBlocks = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(EDITOR_KEY) || "null");
    if (Array.isArray(saved) && saved.length > 0 &&
        saved.every((b) => b && typeof b.id === "string" && typeof b.text === "string")) {
      return saved;
    }
  } catch { /* unreadable: start empty */ }
  return [makeFreeBlock()];
};

// ─── Agent Skill folder export ───────────────────────────────────────────────
// A skill is a folder (SKILL.md + references/ + scripts/ + assets/), not one
// file. The editor is a single buffer, so a multi-file skill is encoded with
// "=== file: <path> ===" boundary markers and split back out on export, then
// packed into a deployable folder-shaped .zip — with zero dependencies.

const SKILL_FILE_MARKER = /^===[ \t]*file:[ \t]*(.+?)[ \t]*===[ \t]*$/gm;

function strToUtf8(str) {
  return new TextEncoder().encode(str);
}

// Split the editor buffer into { path, content } files on boundary markers.
// With no markers the whole buffer becomes SKILL.md.
function parseSkillFiles(text) {
  const markers = [...text.matchAll(SKILL_FILE_MARKER)];
  if (markers.length === 0) {
    return [{ path: "SKILL.md", content: text.trim() + "\n" }];
  }
  const files = [];
  for (let i = 0; i < markers.length; i++) {
    const path = markers[i][1].trim().replace(/^\.?\//, "").replace(/\\/g, "/");
    const start = markers[i].index + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    const content = text.slice(start, end).replace(/^\n+/, "").replace(/\s+$/, "") + "\n";
    if (path && !path.includes("..")) files.push({ path, content });
  }
  return files.length ? files : [{ path: "SKILL.md", content: text.trim() + "\n" }];
}

// Lowercase-with-hyphens, max 64 chars — the rule for a skill's folder name.
function slugifySkillName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

// Read the skill name from SKILL.md frontmatter `name:`; fall back to a default.
function deriveSkillName(files) {
  const skillMd = files.find((f) => /(^|\/)SKILL\.md$/i.test(f.path));
  let name = "";
  if (skillMd) {
    const m = skillMd.content.match(/^[ \t]*name:[ \t]*(.+?)[ \t]*$/m);
    if (m) name = m[1].trim();
  }
  return slugifySkillName(name) || "my-skill";
}

// CRC-32 (IEEE 802.3), table-free.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) { out.set(a, pos); pos += a.length; }
  return out;
}

const u16le = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
const u32le = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

// Build an uncompressed (STORE method) .zip from [{ name, data }] entries.
// A directory entry has a name ending in "/" and empty data. Returns Uint8Array.
function buildZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = strToUtf8(entry.name);
    const data = entry.data || new Uint8Array(0);
    const crc = crc32(data);
    const size = data.length;

    const local = concatBytes([
      u32le(0x04034b50), // local file header signature
      u16le(20),         // version needed to extract
      u16le(0x0800),     // general purpose flag: UTF-8 filename
      u16le(0),          // compression method: 0 = store
      u16le(0), u16le(0), // mod time, mod date
      u32le(crc), u32le(size), u32le(size),
      u16le(nameBytes.length), u16le(0),
      nameBytes, data,
    ]);
    locals.push(local);

    central.push(concatBytes([
      u32le(0x02014b50), // central directory header signature
      u16le(20), u16le(20), // version made by, version needed
      u16le(0x0800), u16le(0), // flag, method
      u16le(0), u16le(0),      // mod time, date
      u32le(crc), u32le(size), u32le(size),
      u16le(nameBytes.length), u16le(0), u16le(0), // name, extra, comment lengths
      u16le(0), u16le(0),                          // disk #, internal attrs
      u32le(entry.name.endsWith("/") ? 0x10 : 0),  // external attrs (dir bit)
      u32le(offset),                               // local header offset
      nameBytes,
    ]));

    offset += local.length;
  }

  const centralBytes = concatBytes(central);
  const eocd = concatBytes([
    u32le(0x06054b50), // end of central directory signature
    u16le(0), u16le(0),
    u16le(entries.length), u16le(entries.length),
    u32le(centralBytes.length), u32le(offset),
    u16le(0),
  ]);

  return concatBytes([...locals, centralBytes, eocd]);
}

// Assemble a deployable skill folder (zip entries) from the editor buffer.
function buildSkillZip(promptText) {
  const files = parseSkillFiles(promptText);
  const skill = deriveSkillName(files);

  const entries = [];
  const seenDirs = new Set([""]);
  entries.push({ name: `${skill}/`, data: new Uint8Array(0) });

  const ensureDirs = (path) => {
    const parts = path.split("/");
    parts.pop();
    let cur = "";
    for (const p of parts) {
      cur += p + "/";
      if (!seenDirs.has(cur)) { seenDirs.add(cur); entries.push({ name: `${skill}/${cur}`, data: new Uint8Array(0) }); }
    }
  };

  for (const f of files) {
    ensureDirs(f.path);
    entries.push({ name: `${skill}/${f.path}`, data: strToUtf8(f.content) });
  }
  // Always surface the canonical sibling folders, even when empty.
  for (const d of ["references/", "scripts/", "assets/"]) {
    if (!seenDirs.has(d)) { seenDirs.add(d); entries.push({ name: `${skill}/${d}`, data: new Uint8Array(0) }); }
  }

  return { skill, bytes: buildZip(entries) };
}

// ─── Open an Agent Skill from Bitbucket Cloud ────────────────────────────────
// Bitbucket Cloud's REST API sends permissive CORS headers (Access-Control-
// Allow-Origin: * and Allow-Headers: Authorization), so the browser reads repos
// directly — no backend or proxy. We recursively list a repo once, find every
// SKILL.md, parse its frontmatter into a searchable index, then pull the chosen
// skill's whole folder into the editor buffer using the same
// "=== file: <path> ===" markers the exporter already round-trips.

const BB_API = "https://api.bitbucket.org/2.0";

// Files we can't represent in a text buffer — skipped on open (noted to user).
const BB_BINARY_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "pdf", "zip", "gz", "tar",
  "tgz", "7z", "rar", "mp3", "mp4", "mov", "avi", "wav", "ogg", "woff", "woff2",
  "ttf", "otf", "eot", "jar", "class", "wasm", "bin", "exe", "dll", "so",
  "dylib", "pyc", "png", "xlsx", "docx", "pptx",
]);
const bbIsBinary = (path) => BB_BINARY_EXT.has((path.split(".").pop() || "").toLowerCase());

// Build an Authorization header from a pasted credential:
//   ""              → anonymous (public repos)
//   "user:app_pw"   → Basic  (Bitbucket app password)
//   "ATxxx…"        → Bearer (repo/workspace access token or OAuth token)
function bbAuthHeaders(token) {
  const t = (token || "").trim();
  if (!t) return {};
  if (t.includes(":")) return { Authorization: "Basic " + btoa(t) };
  return { Authorization: "Bearer " + t };
}

const bbStripQuotes = (s) => (s || "").replace(/^['"]|['"]$/g, "").trim();

// Pull { workspace, repo, ref, path } out of a pasted Bitbucket URL or a plain
// "workspace/repo[/path]" slug. Returns null if it can't be understood.
function parseBitbucketSource(input) {
  const s = (input || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (!/(^|\.)bitbucket\.org$/i.test(u.hostname)) return null;
    let parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (/^api\./i.test(u.hostname)) {                        // api.bitbucket.org/2.0/repositories/{ws}/{repo}/…
      const ri = parts.indexOf("repositories");
      if (ri >= 0) parts = parts.slice(ri + 1);
    }
    const [workspace, repo] = parts;
    let ref = "", path = "";
    const at = parts.indexOf("src");
    if (at >= 0) { ref = parts[at + 1] || ""; path = parts.slice(at + 2).join("/"); }
    return workspace && repo ? { workspace, repo, ref, path } : null;
  } catch {
    const parts = s.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { workspace: parts[0], repo: parts[1], ref: "", path: parts.slice(2).join("/") };
  }
}

// Minimal YAML-frontmatter reader for SKILL.md — enough to index name,
// description, and tags/keywords (inline [a, b] or block "- a" lists). The whole
// frontmatter block is kept as `raw` so search can match any other metadata.
function parseSkillFrontmatter(md) {
  const meta = { name: "", description: "", tags: [], raw: "" };
  const m = (md || "").match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return meta;
  meta.raw = m[1];
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    if (kv) {
      key = kv[1].toLowerCase();
      const val = kv[2].trim();
      if (key === "name") meta.name = bbStripQuotes(val);
      else if (key === "description") meta.description = bbStripQuotes(val);
      else if ((key === "tags" || key === "keywords") && val.startsWith("[")) {
        meta.tags.push(...val.replace(/^\[|\]$/g, "").split(",").map(bbStripQuotes).filter(Boolean));
      }
      continue;
    }
    const li = line.match(/^[ \t]*-[ \t]+(.*)$/);
    if (li && (key === "tags" || key === "keywords")) meta.tags.push(bbStripQuotes(li[1]));
  }
  return meta;
}

// fetch wrapper that surfaces Bitbucket's JSON error message + HTTP status.
async function bbFetch(url, token, signal) {
  const res = await fetch(url, { headers: bbAuthHeaders(token), signal });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch { /* non-JSON body */ }
    const err = new Error(detail || `Bitbucket returned HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

const bbEncPath = (p) => (p || "").split("/").filter(Boolean).map(encodeURIComponent).join("/");
const bbRepoBase = (ws, repo) => `${BB_API}/repositories/${encodeURIComponent(ws)}/${encodeURIComponent(repo)}`;

// Resolve the default branch when the user didn't pin a ref.
async function bbResolveRef(ws, repo, ref, token, signal) {
  if (ref) return ref;
  try {
    const j = await (await bbFetch(`${bbRepoBase(ws, repo)}?fields=mainbranch.name`, token, signal)).json();
    return j?.mainbranch?.name || "HEAD";
  } catch { return "HEAD"; }
}

// One recursive listing of a repo subtree. Returns the snapshot commit hash
// (stable, slash-free — used for every later file fetch and as a cache key) plus
// a flat [{ path, size }] of files.
async function bbListTree(ws, repo, ref, path, token, signal) {
  const dir = (path || "").replace(/^\/+|\/+$/g, "");
  let url = `${bbRepoBase(ws, repo)}/src/${encodeURIComponent(ref)}/${dir ? bbEncPath(dir) + "/" : ""}` +
    `?max_depth=10&pagelen=100&fields=values.path,values.type,values.size,values.commit.hash,next`;
  const files = [];
  let commit = "";
  while (url) {
    const j = await (await bbFetch(url, token, signal)).json();
    for (const v of j.values || []) {
      if (!commit) commit = v.commit?.hash || "";
      if (v.type === "commit_file") files.push({ path: v.path, size: v.size || 0 });
    }
    if (files.length > 20000) break; // hard safety cap
    url = j.next || "";
  }
  return { commit: commit || ref, files };
}

const bbFetchFile = async (ws, repo, ref, path, token, signal) =>
  (await bbFetch(`${bbRepoBase(ws, repo)}/src/${encodeURIComponent(ref)}/${bbEncPath(path)}`, token, signal)).text();

// Run `fn` over items with limited concurrency, reporting progress as it goes.
async function bbMapPool(items, limit, fn, onProgress) {
  const out = new Array(items.length);
  let i = 0, done = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
      if (onProgress) onProgress(++done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

// Inverse of parseSkillFiles: pack { path, content } files back into one editor
// buffer. A lone SKILL.md loads as raw text (no markers needed); anything richer
// gets "=== file: <path> ===" boundaries, SKILL.md first.
function buildBufferFromSkillFiles(files) {
  const ordered = [...files].sort((a, b) => {
    const rank = (p) => (/(^|\/)SKILL\.md$/i.test(p) ? 0 : 1);
    return rank(a.path) - rank(b.path) || a.path.localeCompare(b.path);
  });
  if (ordered.length === 1 && /(^|\/)SKILL\.md$/i.test(ordered[0].path)) {
    return ordered[0].content.replace(/\s+$/, "") + "\n";
  }
  return ordered.map((f) => `=== file: ${f.path} ===\n${f.content.replace(/\s+$/, "")}\n`).join("\n");
}

// ─── BlockRow Component ───────────────────────────────────────────────────────
// One block in the block-based prompt editor.
// Owns its own contenteditable div + a left colour-strip segment.

const BLOCK_PH_RE = /\[[A-Z][A-Z0-9_/ ]*\]/g;

function buildBlockHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(new RegExp(BLOCK_PH_RE.source, "g"),
      (m) => `<span class="ph-chip" data-ph="${m}">${m}</span>`);
}

// Text of a block div or fragment as the editor reads it: <br> and each new
// <div> the browser inserts on Enter count as one newline
function walkBlockText(root) {
  let t = "";
  const walk = (n) => {
    if (n.nodeType === Node.TEXT_NODE) { t += n.textContent; return; }
    if (n.nodeType === Node.ELEMENT_NODE) {
      if (n.tagName === "BR") { t += "\n"; return; }
      if (n.tagName === "DIV" && t.length > 0 && !t.endsWith("\n")) t += "\n";
      n.childNodes.forEach(walk);
    }
  };
  root.childNodes.forEach(walk);
  return t;
}

function extractBlockText(el) {
  return walkBlockText(el).replace(/\n$/, "");
}

// Caret position in a block, in characters of its text
function readCaretInDiv(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return extractBlockText(el).length;
  const before = document.createRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  return walkBlockText(before.cloneContents()).length;
}

// Put the caret at a character offset in a block rendered by buildBlockHtml,
// whose text nodes hold the whole text, newlines included
function setCaretInDiv(el, offset) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = offset;
  let node;
  let placed = false;
  while ((node = walker.nextNode())) {
    if (left <= node.textContent.length) { r.setStart(node, left); placed = true; break; }
    left -= node.textContent.length;
  }
  if (!placed) r.selectNodeContents(el);
  r.collapse(placed);
  sel.removeAllRanges();
  sel.addRange(r);
}

// Fill copy n (from 0) of a [TOKEN] in a block's text, or every copy when n is
// null. Returns the new text and the offset just after the last value written,
// or a null caret when that copy is not there. Slicing, not String.replace,
// so a "$" in the value stays literal.
function fillPlaceholder(text, token, n, value) {
  let out = "";
  let last = 0;
  let seen = -1;
  let caret = null;
  for (const m of text.matchAll(new RegExp(BLOCK_PH_RE.source, "g"))) {
    if (m[0] !== token) continue;
    seen += 1;
    if (n !== null && seen !== n) continue;
    out += text.slice(last, m.index) + value;
    last = m.index + token.length;
    caret = out.length;
  }
  return { text: out + text.slice(last), caret };
}

function BlockRow({
  block, sk,
  onTextChange, onEnterAtStart, onEnterAtEnd, onBackspaceAtStart,
  onPlaceholderClick, onDismissPlaceholder, onFocus,
  divRef: externalDivRef,
}) {
  const divRef = useRef(null);
  const setRef = (el) => {
    divRef.current = el;
    if (externalDivRef) externalDivRef.current = el;
  };

  // Keep DOM in sync when block.text changes externally (drop, undo, load…).
  // A layout effect, so the DOM is current before AceStudio places the caret.
  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const html = buildBlockHtml(block.text);
    if (el.innerHTML !== html) {
      // A rewrite while typing (a new line, a chip forming) keeps the caret
      // where it was, counted in characters
      const focused = document.activeElement === el;
      const caret = focused ? readCaretInDiv(el) : 0;
      el.innerHTML = html;
      if (focused) setCaretInDiv(el, Math.min(caret, block.text.length));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.text]);

  return (
    <div style={{ display: "flex", position: "relative", minHeight: 27 }}>
      {/* Colour-strip segment — tooltip shows block label */}
      <div
        title={block.label || undefined}
        style={{
          width: 4,
          flexShrink: 0,
          alignSelf: "stretch",
          background: block.color || "transparent",
          borderRadius: 2,
          marginRight: 8,
          opacity: block.color ? 1 : 0,
          cursor: block.label ? "default" : "auto",
          transition: "opacity 0.15s",
        }}
      />
      {/* Contenteditable for this block */}
      <div
        ref={setRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-block-id={block.id}
        style={{
          flex: 1,
          outline: "none",
          minHeight: 24,
          fontSize: 13.5,
          lineHeight: 1.8,
          fontFamily: "'IBM Plex Mono', monospace",
          color: sk.editorText,
          caretColor: sk.caret,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
        onFocus={() => onFocus && onFocus(block.id)}
        onClick={(e) => {
          const span = e.target.closest?.(".ph-chip");
          if (span) onPlaceholderClick(e, span, block.id);
          else onDismissPlaceholder && onDismissPlaceholder();
        }}
        onInput={(e) => {
          const newText = extractBlockText(e.currentTarget);
          if (newText !== block.text) onTextChange(block.id, newText);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            const caret = readCaretInDiv(divRef.current);
            const len = block.text.length;
            if (len > 0 && caret === 0) {
              // Enter at very start → insert free block BEFORE this one
              e.preventDefault();
              onEnterAtStart(block.id);
            } else if (caret >= len) {
              // Enter at or after end → new free block AFTER
              e.preventDefault();
              onEnterAtEnd(block.id);
            }
            // caret in middle: let browser add a line within this block
          }
          if (e.key === "Backspace") {
            // Backspace before the first character joins this block onto the
            // one above; with text selected, the browser deletes the selection
            if (window.getSelection()?.isCollapsed && readCaretInDiv(divRef.current) === 0) {
              e.preventDefault();
              onBackspaceAtStart(block.id);
            }
          }
        }}
      />
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function AceStudio() {
  // ── Block model ───────────────────────────────────────────────────────────
  const [blocks, setBlocks] = useState(loadEditorBlocks);
  // promptText is derived from blocks — kept for export, copy, health-score, etc.
  const promptText = useMemo(() => blocks.map((b) => b.text).join("\n"), [blocks]);
  // Stable ref so async callbacks can read current blocks without stale closures
  const blocksRef = useRef(blocks);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);
  // Set the blocks and the ref together, for handlers that build the next
  // array from blocksRef and must not see a stale one on the next keystroke
  const applyBlocks = useCallback((next) => {
    blocksRef.current = next;
    setBlocks(next);
  }, []);

  // Save the document a moment after each change, and at once when the tab is
  // hidden or closed
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(EDITOR_KEY, JSON.stringify(blocks)); } catch { /* quota */ }
    }, 400);
    return () => clearTimeout(t);
  }, [blocks]);
  useEffect(() => {
    const flush = () => {
      try { localStorage.setItem(EDITOR_KEY, JSON.stringify(blocksRef.current)); } catch { /* quota */ }
    };
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);
  // blockDivRefs: block.id → the contenteditable DOM element
  const blockDivRefs = useRef({});
  // Which block currently has focus (used by drop handler)
  const focusedBlockId = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [insertedFlash, setInsertedFlash] = useState(null); // {blockId, ts}
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dropIndicator, setDropIndicator] = useState(null); // {x,y}
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [undoBounce, setUndoBounce] = useState(false);
  const [redoBounce, setRedoBounce] = useState(false);
  const [exportFlash, setExportFlash] = useState(false); // brief green flash on export
  const [skin, setSkin] = useState("black"); // "black" | "white" | "grey"
  const [showGallery, setShowGallery] = useState(false);  // Template Gallery modal
  const [gallerySelectedId, setGallerySelectedId] = useState("summarise"); // selected template id
  const [galleryTab, setGalleryTab] = useState("example"); // "example" | "template"
  const [showExportMenu, setShowExportMenu] = useState(false); // export format dropdown
  // ── Open-from-Bitbucket browser ──
  const [showBitbucket, setShowBitbucket] = useState(false);   // Bitbucket modal open
  const [bbInput, setBbInput] = useState("");                  // pasted URL or "workspace/repo[/path]"
  const [bbToken, setBbToken] = useState(() => { try { return localStorage.getItem("ace_studio_bb_token") || ""; } catch { return ""; } });
  const [bbRemember, setBbRemember] = useState(() => { try { return !!localStorage.getItem("ace_studio_bb_token"); } catch { return false; } });
  const [bbStatus, setBbStatus] = useState("idle");            // idle | scanning | ready | opening | error
  const [bbError, setBbError] = useState("");                  // human-readable failure
  const [bbProgress, setBbProgress] = useState({ done: 0, total: 0 }); // SKILL.md indexing progress
  const [bbIndex, setBbIndex] = useState([]);                  // [{ id, name, description, tags, dir, skillPath }]
  const [bbRepoInfo, setBbRepoInfo] = useState(null);          // { workspace, repo, ref, commit, files }
  const [bbQuery, setBbQuery] = useState("");                  // search text
  const [bbActiveTags, setBbActiveTags] = useState([]);        // tag-chip filters (AND)
  const [bbOpeningId, setBbOpeningId] = useState(null);        // index id currently being opened
  const bbAbortRef = useRef(null);                             // AbortController for in-flight scan/open
  const [bbRecent, setBbRecent] = useState(() => { try { return JSON.parse(localStorage.getItem("ace_studio_bb_recent") || "[]"); } catch { return []; } }); // [{ workspace, repo, ref, path, key, ts }]
  const [showBbRecent, setShowBbRecent] = useState(false);     // recent-repos dropdown open
  const [customBlocks, setCustomBlocks] = useState([]); // [{id, label, emoji, color, text}]
  const [customFolded, setCustomFolded] = useState(true);
  const [openLayers, setOpenLayers] = useState({}); // { [layerId]: true } — every layer starts folded
  const [unsavedBlocks, setUnsavedBlocks] = useState(false); // true if custom blocks have unsaved changes
  const [showBlocksLoadConfirm, setShowBlocksLoadConfirm] = useState(false); // confirm before overwriting custom blocks
  const [pendingBlocksLoad, setPendingBlocksLoad] = useState(null); // parsed blocks array waiting for confirmation
  const [blocksLoadError, setBlocksLoadError] = useState(""); // validation error message
  const [showNewBlockModal, setShowNewBlockModal] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null); // null = create mode, id = edit mode
  const [nbLabel, setNbLabel] = useState("");
  const [nbEmoji, setNbEmoji] = useState("✨");
  const [nbColor, setNbColor] = useState("#7C3AED");
  const [nbText, setNbText] = useState("");
  // Custom block reorder drag state
  const [reorderDragId, setReorderDragId] = useState(null);  // block id being reordered
  const [reorderOverId, setReorderOverId] = useState(null);  // block id currently hovered
  // Inline placeholder substitution
  const [activePlaceholder, setActivePlaceholder] = useState(null); // {blockId, placeholder, occurrence, copies, x, y}
  const [placeholderInput, setPlaceholderInput] = useState("");
  const placeholderInputRef = useRef(null);
  const [placeholderNavIdx, setPlaceholderNavIdx] = useState(0); // cycling index for the progress bar counter click
  const editorRef = useRef(null);   // editor container div (for drop zone bounds)
  const dropZoneRef = useRef(null);

  useEffect(() => {
    const words = promptText.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(promptText ? words : 0);
    setCharCount(promptText.length);
  }, [promptText]);

  // ── Focus helpers ─────────────────────────────────────────────────────────
  const focusFirstBlock = useCallback(() => {
    const bs = blocksRef.current;
    if (bs.length > 0) blockDivRefs.current[bs[0].id]?.focus();
  }, []);

  const focusLastBlock = useCallback(() => {
    const bs = blocksRef.current;
    if (bs.length > 0) blockDivRefs.current[bs[bs.length - 1].id]?.focus();
  }, []);

  // Focus a block and put the caret at a character offset (the end when
  // omitted). Called with a change to the blocks; applied in the same commit,
  // so a key pressed straight after a join or a split is not lost.
  const pendingFocusRef = useRef(null);
  const focusBlockAt = useCallback((id, offset) => {
    pendingFocusRef.current = { id, offset };
  }, []);
  useLayoutEffect(() => {
    const p = pendingFocusRef.current;
    if (!p) return;
    pendingFocusRef.current = null;
    const el = blockDivRefs.current[p.id];
    if (!el) return;
    el.focus();
    setCaretInDiv(el, p.offset ?? extractBlockText(el).length);
  }, [blocks]);

  // ── Undo / Redo — snapshots are Block[] arrays ────────────────────────────
  // The stacks live in refs and are changed outside state updaters, so a step
  // is recorded once; the state copies drive the buttons.
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  // The typing run the newest snapshot covers: { id, at }. Typing in the same
  // block with no pause over a second adds to that step instead of a new one.
  const typingRef = useRef(null);

  const syncHistory = useCallback(() => {
    setUndoStack(undoRef.current);
    setRedoStack(redoRef.current);
  }, []);

  const pushUndo = useCallback((blocksSnapshot) => {
    undoRef.current = [...undoRef.current.slice(-49), blocksSnapshot];
    redoRef.current = [];
    typingRef.current = null;
    syncHistory();
  }, [syncHistory]);

  // Show a snapshot and focus the first block it changes, caret at the end
  const restoreSnapshot = useCallback((restored) => {
    const current = blocksRef.current;
    const changed = restored.find((b, i) => current[i]?.id !== b.id || current[i]?.text !== b.text)
      || restored[restored.length - 1];
    applyBlocks(restored);
    setActivePlaceholder(null);
    if (changed) focusBlockAt(changed.id);
  }, [applyBlocks, focusBlockAt]);

  const handleUndo = useCallback(() => {
    if (undoRef.current.length === 0) return;
    const restored = undoRef.current[undoRef.current.length - 1];
    undoRef.current = undoRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current.slice(-49), blocksRef.current];
    typingRef.current = null;
    syncHistory();
    restoreSnapshot(restored);
    setUndoBounce(true);
    setTimeout(() => setUndoBounce(false), 350);
  }, [syncHistory, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const restored = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    undoRef.current = [...undoRef.current.slice(-49), blocksRef.current];
    typingRef.current = null;
    syncHistory();
    restoreSnapshot(restored);
    setRedoBounce(true);
    setTimeout(() => setRedoBounce(false), 350);
  }, [syncHistory, restoreSnapshot]);

  // ── Block operations ──────────────────────────────────────────────────────

  // Update text of one block; delete it if emptied (keep minimum 1 block)
  const updateBlockText = useCallback((id, text) => {
    const prev = blocksRef.current;
    const idx = prev.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const now = Date.now();
    const run = typingRef.current;
    if (!run || run.id !== id || now - run.at > 1000) pushUndo(prev);
    typingRef.current = { id, at: now };
    if (!text) {
      if (prev.length > 1) {
        // Block emptied and not the only block → delete it, focus neighbour
        const above = prev[idx - 1];
        applyBlocks(prev.filter((b) => b.id !== id));
        typingRef.current = null;
        if (above) focusBlockAt(above.id);
        else focusBlockAt(prev[idx + 1].id, 0);
        return;
      }
      // Only block: strip colour/label so the colour strip disappears
      applyBlocks([{ ...prev[idx], blockId: null, label: null, color: null, text: "" }]);
      return;
    }
    const next = [...prev];
    next[idx] = { ...next[idx], text };
    applyBlocks(next);
  }, [pushUndo, applyBlocks, focusBlockAt]);

  // Enter at end of block → new free block inserted after
  const handleEnterAtEnd = useCallback((blockId) => {
    const nb = makeFreeBlock();
    const prev = blocksRef.current;
    pushUndo(prev);
    const idx = prev.findIndex((b) => b.id === blockId);
    const next = [...prev];
    next.splice(idx + 1, 0, nb);
    applyBlocks(next);
    focusBlockAt(nb.id, 0);
  }, [pushUndo, applyBlocks, focusBlockAt]);

  // Enter before first char of block → new free block inserted before
  const handleEnterAtStart = useCallback((blockId) => {
    const nb = makeFreeBlock();
    const prev = blocksRef.current;
    pushUndo(prev);
    const idx = prev.findIndex((b) => b.id === blockId);
    const next = [...prev];
    next.splice(idx, 0, nb);
    applyBlocks(next);
    focusBlockAt(nb.id, 0);
  }, [pushUndo, applyBlocks, focusBlockAt]);

  // Backspace before the first character joins the block onto the end of the
  // one above, as deleting the line break between them would. The joined block
  // keeps the upper block's template, or this one's when the upper is free
  // text. An empty first block is removed instead, when others follow it.
  const handleBackspaceAtStart = useCallback((blockId) => {
    const prev = blocksRef.current;
    const idx = prev.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const cur = prev[idx];
    if (idx === 0) {
      if (cur.text || prev.length === 1) return;
      pushUndo(prev);
      applyBlocks(prev.slice(1));
      focusBlockAt(prev[1].id, 0);
      return;
    }
    const above = prev[idx - 1];
    const keep = above.blockId || !cur.blockId ? above : cur;
    const joined = { ...keep, id: above.id, text: above.text + cur.text };
    pushUndo(prev);
    applyBlocks([...prev.slice(0, idx - 1), joined, ...prev.slice(idx + 1)]);
    focusBlockAt(above.id, above.text.length);
  }, [pushUndo, applyBlocks, focusBlockAt]);

  // Drop a template block: insert named block after the currently focused block
  const handleBlockDrop = useCallback((templateBlockId) => {
    const tpl = [...customBlocks, ...ALL_BLOCKS].find((b) => b.id === templateBlockId);
    if (!tpl) return;
    const nb = makeNamedBlock(tpl);
    const prev = blocksRef.current;
    pushUndo(prev);
    const focId = focusedBlockId.current;
    const idx = focId ? prev.findIndex((b) => b.id === focId) : prev.length - 1;
    const insertAfter = idx === -1 ? prev.length - 1 : idx;
    const next = [...prev];
    // If the currently focused block is an empty free block, replace it
    if (focId && prev[insertAfter]?.blockId === null && prev[insertAfter]?.text === "") {
      next[insertAfter] = nb;
    } else {
      next.splice(insertAfter + 1, 0, nb);
    }
    applyBlocks(next);
    setActivePlaceholder(null);
    setInsertedFlash({ blockId: templateBlockId, ts: Date.now() });
    setTimeout(() => setInsertedFlash(null), 800);
    setTimeout(() => blockDivRefs.current[nb.id]?.focus(), 20);
  }, [customBlocks, pushUndo, applyBlocks]);

  // Placeholder clicked inside a BlockRow
  const handlePlaceholderClick = useCallback((e, span, blockId) => {
    e.preventDefault();
    const rect = span.getBoundingClientRect();
    const containerRect = dropZoneRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    // Which copy of the token was clicked, when the block repeats it
    const copies = [...(blockDivRefs.current[blockId]?.querySelectorAll(".ph-chip") || [])]
      .filter((c) => c.dataset.ph === span.dataset.ph);
    setActivePlaceholder({
      blockId,
      placeholder: span.dataset.ph,
      occurrence: Math.max(0, copies.indexOf(span)),
      copies: copies.length,
      x: rect.left - containerRect.left,
      y: rect.bottom - containerRect.top + 6,
      spanRect: rect,
    });
    setPlaceholderInput("");
    setTimeout(() => placeholderInputRef.current?.focus(), 30);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
    setDropIndicator({ x: e.clientX, y: e.clientY });
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
      setDropIndicator(null);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const templateBlockId = e.dataTransfer.getData("blockId");
    setIsDragOver(false);
    setActiveBlockId(null);
    setDropIndicator(null);
    if (templateBlockId) handleBlockDrop(templateBlockId);
  }, [handleBlockDrop]);

  const clearAll = () => {
    if (blocks.length > 0 && blocks.some((b) => b.text)) pushUndo(blocks);
    const empty = makeFreeBlock();
    applyBlocks([empty]);
    setActivePlaceholder(null);
    setTimeout(() => blockDivRefs.current[empty.id]?.focus(), 10);
  };

  const copyPrompt = () => {
    if (!promptText) return;

    // Capture any selected text from the contenteditable before focus changes
    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && sel.toString().length > 0;
    const textToCopy = hasSelection ? sel.toString() : promptText;

    const succeed = () => { setCopied(true);    setTimeout(() => setCopied(false), 2000); };
    const fail    = () => { setCopied("error"); setTimeout(() => setCopied(false), 2000); };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).then(succeed).catch(() => {
        execCommandCopy(textToCopy) ? succeed() : fail();
      });
      return;
    }
    execCommandCopy(textToCopy) ? succeed() : fail();
  };

  // document.execCommand fallback — creates a temporary textarea off-screen
  const execCommandCopy = (text) => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      // Restore focus to the focused block
      setTimeout(() => focusLastBlock(), 10);
      return ok;
    } catch {
      return false;
    }
  };

  const activeBlock = [...customBlocks, ...ALL_BLOCKS].find((b) => b.id === activeBlockId);

  // ── Load custom blocks from localStorage ──────────────────────────────────
  const BLOCKS_KEY = "ace_studio_blocks";

  useEffect(() => {
    try {
      const storedBlocks = localStorage.getItem(BLOCKS_KEY);
      if (storedBlocks) setCustomBlocks(JSON.parse(storedBlocks));
    } catch { /* ignore corrupt data */ }
  }, []);

  // Warn before closing if there are unsaved blocks
  useEffect(() => {
    const handler = (e) => {
      if (unsavedBlocks) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsavedBlocks]);

  // ── Custom block helpers ──────────────────────────────────────────────────

  // Serialize a block to .block file format (JSON)
  const blockToFileContent = (block) => JSON.stringify({
    version: "1.0",
    label: block.label,
    emoji: block.emoji,
    color: block.color,
    text: block.text,
  }, null, 2);

  // Save all custom blocks to a folder as *.block files via File System Access API
  const blocksFileInputRef = useRef(null);

  const saveBlocksToFolder = (blocks) => {
    const payload = JSON.stringify({
      version: "1.0",
      exportedAt: new Date().toISOString(),
      blocks: blocks.map((b) => ({ label: b.label, emoji: b.emoji, color: b.color, text: b.text })),
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blocks.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setUnsavedBlocks(false);
  };

  const handleBlocksFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBlocksLoadError("");
    try {
      const raw = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setBlocksLoadError("Cannot load blocks from the file — the file is not valid JSON.");
        return;
      }

      // Accept either {blocks:[...]} wrapper or a bare array
      const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed.blocks) ? parsed.blocks : null;

      if (!candidates || candidates.length === 0) {
        setBlocksLoadError("Cannot load blocks from the file — no block entries found.");
        return;
      }

      // Each entry must have at least a non-empty label and text field
      const valid = candidates.filter((b) =>
        b && typeof b === "object" &&
        typeof b.label === "string" && b.label.trim() !== "" &&
        typeof b.text === "string" && b.text.trim() !== ""
      );

      if (valid.length === 0) {
        setBlocksLoadError("Cannot load block/blocks from the file — entries are missing required fields (label, text).");
        return;
      }

      const arr = valid.map((b, i) => ({
        id: `custom-${Date.now()}-${i}`,
        label: b.label.trim(),
        emoji: b.emoji || "✨",
        color: b.color || "#7C3AED",
        glow: (b.color || "#7C3AED") + "44",
        text: b.text,
        isCustom: true,
      }));

      if (customBlocks.length > 0) {
        setPendingBlocksLoad(arr);
        setShowBlocksLoadConfirm(true);
      } else {
        setCustomBlocks(arr);
        try { localStorage.setItem("ace_studio_blocks", JSON.stringify(arr)); } catch { /* quota */ }
      }
    } catch (err) {
      console.error("Failed to load blocks.json:", err);
      setBlocksLoadError("Cannot load blocks from the file — an unexpected error occurred.");
    }
  };

  const confirmBlocksLoad = () => {
    const arr = pendingBlocksLoad;
    setCustomBlocks(arr);
    try { localStorage.setItem("ace_studio_blocks", JSON.stringify(arr)); } catch { /* quota */ }
    setPendingBlocksLoad(null);
    setShowBlocksLoadConfirm(false);
  };

  // Add a new custom block from the modal form
  const confirmNewBlock = () => {
    if (!nbLabel.trim() || !nbText.trim()) return;
    const newBlock = {
      id: `custom-${Date.now()}`,
      label: nbLabel.trim(),
      emoji: nbEmoji || "✨",
      color: nbColor,
      glow: nbColor + "44",
      text: nbText,
      isCustom: true,
    };
    const updated = [newBlock, ...customBlocks];
    setCustomBlocks(updated);
    // Persist to localStorage immediately
    try { localStorage.setItem(BLOCKS_KEY, JSON.stringify(updated)); } catch { /* quota */ }
    setUnsavedBlocks(true);
    setShowNewBlockModal(false);
    setNbLabel(""); setNbEmoji("✨"); setNbColor("#7C3AED"); setNbText("");
  };

  const confirmEditBlock = () => {
    if (!nbLabel.trim() || !nbText.trim()) return;
    const updated = customBlocks.map((b) =>
      b.id === editingBlockId
        ? { ...b, label: nbLabel.trim(), emoji: nbEmoji || "✨", color: nbColor, glow: nbColor + "44", text: nbText }
        : b
    );
    setCustomBlocks(updated);
    try { localStorage.setItem(BLOCKS_KEY, JSON.stringify(updated)); } catch { /* quota */ }
    setUnsavedBlocks(true);
    setShowNewBlockModal(false);
    setEditingBlockId(null);
    setNbLabel(""); setNbEmoji("✨"); setNbColor("#7C3AED"); setNbText("");
  };

  // Delete a custom block
  const deleteCustomBlock = (id) => {
    const updated = customBlocks.filter((b) => b.id !== id);
    setCustomBlocks(updated);
    try { localStorage.setItem(BLOCKS_KEY, JSON.stringify(updated)); } catch { /* quota */ }
    setUnsavedBlocks(true);
  };

  // Reorder: drop dragId block onto overId position
  const reorderCustomBlocks = (dragId, overId) => {
    if (!dragId || !overId || dragId === overId) return;
    const arr = [...customBlocks];
    const fromIdx = arr.findIndex((b) => b.id === dragId);
    const toIdx   = arr.findIndex((b) => b.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    setCustomBlocks(arr);
    try { localStorage.setItem(BLOCKS_KEY, JSON.stringify(arr)); } catch { /* quota */ }
    setUnsavedBlocks(true);
  };

  // ── Inline placeholder substitution ──────────────────────────────────────

  const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9_/ ]*\]/g;

  const getPlaceholders = (text) => {
    const results = [];
    const re = new RegExp(PLACEHOLDER_RE.source, "g");
    let m;
    while ((m = re.exec(text)) !== null) {
      results.push({ index: m.index, placeholder: m[0], length: m[0].length });
    }
    return results;
  };

  // Commit placeholder substitution — updates the specific block that contains it
  // Fills the copy that was clicked, or with `all` every copy in the block
  const commitPlaceholder = (all = false) => {
    if (!activePlaceholder) return;
    const { blockId, placeholder, occurrence } = activePlaceholder;
    const val = placeholderInput;
    const block = blocksRef.current.find((b) => b.id === blockId);
    const filled = val && block ? fillPlaceholder(block.text, placeholder, all ? null : occurrence, val) : null;
    setActivePlaceholder(null);
    if (!filled || filled.caret === null) return;
    pushUndo(blocksRef.current);
    applyBlocks(blocksRef.current.map((b) => (b.id === blockId ? { ...b, text: filled.text } : b)));
    setPlaceholderInput("");
    focusBlockAt(blockId, filled.caret);
  };

  // ── Export prompt as .prompt file ─────────────────────────────────────────
  const handleExport = async () => {
    if (!promptText.trim()) return;

    // Build the .prompt file payload
    const payload = JSON.stringify({
      version: "1.0",
      exportedAt: new Date().toISOString(),
      wordCount: promptText.trim().split(/\s+/).filter(Boolean).length,
      text: promptText,
    }, null, 2);

    const blob = new Blob([payload], { type: "application/json" });

    // Derive a default filename from the first meaningful words
    const suggested = "Template.prompt";

    // Primary path: File System Access API (shows native Save As dialog)
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: suggested,
          types: [{
            description: "Prompt file",
            accept: { "application/json": [".prompt"] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setExportFlash(true);
        setTimeout(() => setExportFlash(false), 1400);
        return;
      } catch (err) {
        // User cancelled the dialog — do nothing
        if (err.name === "AbortError") return;
        // Other error — fall through to download fallback
      }
    }

    // Fallback: programmatic <a> download (no dialog, straight to Downloads)
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggested;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportFlash(true);
    setTimeout(() => setExportFlash(false), 1400);
  };

  // ── Export format builders ────────────────────────────────────────────────
  const EXPORT_FORMATS = [
    {
      id: "prompt",
      label: ".prompt JSON",
      icon: "📄",
      desc: "ACE Studio native format",
      ext: ".prompt",
      mime: "application/json",
      build: (text) => JSON.stringify({
        version: "1.0",
        exportedAt: new Date().toISOString(),
        wordCount: text.trim().split(/\s+/).filter(Boolean).length,
        text,
      }, null, 2),
    },
    {
      id: "python",
      label: "Python string",
      icon: "🐍",
      desc: "Escaped string literal for Python code",
      ext: ".py",
      mime: "text/plain",
      build: (text) => {
        const escaped = text
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n");
        return `prompt = "${escaped}"\n`;
      },
    },
    {
      id: "openai",
      label: "OpenAI messages",
      icon: "🤖",
      desc: "JSON messages array with a system message",
      ext: ".json",
      mime: "application/json",
      build: (text) => JSON.stringify([
        { role: "system", content: text }
      ], null, 2),
    },
    {
      // The Messages API takes the system prompt as a top-level field and
      // rejects a "system" role; it needs at least one user turn
      id: "anthropic",
      label: "Anthropic messages",
      icon: "🧠",
      desc: "JSON system field plus a user turn to fill",
      ext: ".json",
      mime: "application/json",
      build: (text) => JSON.stringify({
        system: text,
        messages: [{ role: "user", content: "[USER_MESSAGE]" }],
      }, null, 2),
    },
    {
      id: "markdown",
      label: "Markdown documentation",
      icon: "📝",
      desc: "Formatted .md file for docs / wikis",
      ext: ".md",
      mime: "text/markdown",
      build: (text) => {
        const date = new Date().toISOString().slice(0, 10);
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        return `# Prompt\n\n> Exported from ACE Studio on ${date}  \n> ${words} words\n\n---\n\n${text}\n`;
      },
    },
    {
      id: "system",
      label: "System prompt block",
      icon: "📋",
      desc: "Copy-paste ready — just paste into any chat UI",
      ext: ".txt",
      mime: "text/plain",
      build: (text) => `--- SYSTEM PROMPT ---\n${text}\n--- END SYSTEM PROMPT ---\n`,
    },
  ];

  const handleExportAs = async (fmt) => {
    if (!promptText.trim()) return;
    setShowExportMenu(false);
    const content = fmt.build(promptText);
    const blob = new Blob([content], { type: fmt.mime });
    const suggested = `Template${fmt.ext}`;

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: fmt.label, accept: { [fmt.mime]: [fmt.ext] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setExportFlash(true);
        setTimeout(() => setExportFlash(false), 1400);
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggested;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportFlash(true);
    setTimeout(() => setExportFlash(false), 1400);
  };

  // Export the buffer as a deployable Agent Skill folder, packed into a .zip.
  const handleExportSkill = async () => {
    if (!promptText.trim()) return;
    setShowExportMenu(false);
    const { skill, bytes } = buildSkillZip(promptText);
    const blob = new Blob([bytes], { type: "application/zip" });
    const suggested = `${skill}.zip`;

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: "Agent Skill folder (zip)", accept: { "application/zip": [".zip"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setExportFlash(true);
        setTimeout(() => setExportFlash(false), 1400);
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggested;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportFlash(true);
    setTimeout(() => setExportFlash(false), 1400);
  };


  // ── Load a .prompt file from the user's machine via <input type="file"> ──
  const fileInputRef = useRef(null);

  const handleFileInputChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const raw = await file.text();
      let text = raw;
      try {
        const parsed = JSON.parse(raw);
        text = parsed.text ?? raw;
      } catch {
        // Not valid JSON — use raw content as-is
      }
      pushUndo(blocksRef.current);
      const loaded = makeFreeBlock(text);
      applyBlocks([loaded]);
      setTimeout(() => blockDivRefs.current[loaded.id]?.focus(), 20);
    } catch (err) {
      console.error("Failed to load .prompt file:", err);
    } finally {
      e.target.value = "";
    }
  };

  // ── Open a skill from Bitbucket Cloud ──────────────────────────────────────
  const BB_MAX_SKILLS = 300;     // cap SKILL.md files indexed for the browser
  const BB_MAX_OPEN_FILES = 100; // cap files pulled into the buffer for one skill

  // Folder a SKILL.md lives in (the skill root), relative to the repo.
  const bbSkillDir = (skillPath) => skillPath.replace(/(^|\/)SKILL\.md$/i, "").replace(/\/+$/, "");

  // Turn an HTTP failure into a sentence a human can act on.
  const bbErrorMessage = (err) => {
    switch (err?.status) {
      case 401: return "Authentication failed (401). Check your access token or app password.";
      case 403: return "Access denied (403). The token may lack repository read scope.";
      case 404: return "Not found (404). Check the workspace / repo / branch — or it's private and needs a token.";
      case 429: return "Rate limited by Bitbucket (429). Wait a moment and try again.";
      default:
        if (err?.message === "Failed to fetch") return "Network or CORS error reaching Bitbucket. Check the URL and your connection.";
        return err?.message || "Something went wrong talking to Bitbucket.";
    }
  };

  const bbPersistToken = (token, remember) => {
    try {
      if (remember && token.trim()) localStorage.setItem("ace_studio_bb_token", token.trim());
      else localStorage.removeItem("ace_studio_bb_token");
    } catch { /* private mode / quota — token simply isn't remembered */ }
  };

  // ── Recent repos (persisted, no token stored) ──
  const bbRecentKey = (s) => `${s.workspace}/${s.repo}|${s.ref || ""}|${s.path || ""}`;
  // A canonical string that round-trips through parseBitbucketSource.
  const bbSourceToInput = (s) =>
    s.ref
      ? `https://bitbucket.org/${s.workspace}/${s.repo}/src/${s.ref}/${s.path || ""}`.replace(/\/+$/, "")
      : [s.workspace, s.repo, s.path].filter(Boolean).join("/");

  const bbSaveRecent = (list) => { try { localStorage.setItem("ace_studio_bb_recent", JSON.stringify(list)); } catch { /* quota */ } };

  const bbPushRecent = (src) => {
    const key = bbRecentKey(src);
    const entry = { workspace: src.workspace, repo: src.repo, ref: src.ref || "", path: src.path || "", key, ts: Date.now() };
    setBbRecent((cur) => { const next = [entry, ...cur.filter((e) => e.key !== key)].slice(0, 8); bbSaveRecent(next); return next; });
  };

  const bbRemoveRecent = (key, e) => {
    e.stopPropagation();
    setBbRecent((cur) => { const next = cur.filter((x) => x.key !== key); bbSaveRecent(next); return next; });
  };

  const handleBitbucketRecent = (entry) => {
    setShowBbRecent(false);
    setBbInput(bbSourceToInput(entry));
    handleBitbucketScan({ workspace: entry.workspace, repo: entry.repo, ref: entry.ref, path: entry.path });
  };

  // Scan a repo: list it once, then index every SKILL.md by its frontmatter.
  // `srcOverride` lets a recent-repos click scan without waiting on setBbInput.
  const handleBitbucketScan = async (srcOverride) => {
    const src = srcOverride && srcOverride.workspace ? srcOverride : parseBitbucketSource(bbInput);
    if (!src) { setBbError("Enter a Bitbucket repo URL or workspace/repo."); setBbStatus("error"); return; }
    setShowBbRecent(false);
    bbPersistToken(bbToken, bbRemember);

    bbAbortRef.current?.abort();
    const ctrl = new AbortController();
    bbAbortRef.current = ctrl;
    const token = bbToken.trim();

    setBbStatus("scanning"); setBbError(""); setBbIndex([]); setBbRepoInfo(null);
    setBbActiveTags([]); setBbQuery(""); setBbProgress({ done: 0, total: 0 });

    try {
      const ref = await bbResolveRef(src.workspace, src.repo, src.ref, token, ctrl.signal);
      const { commit, files } = await bbListTree(src.workspace, src.repo, ref, src.path, token, ctrl.signal);
      if (ctrl.signal.aborted) return;
      const skillFiles = files.filter((f) => /(^|\/)SKILL\.md$/i.test(f.path)).slice(0, BB_MAX_SKILLS);
      setBbRepoInfo({ ...src, ref, commit, files });
      bbPushRecent(src); // repo was reachable — remember it (empty ref = follow default branch)

      if (skillFiles.length === 0) {
        setBbStatus("ready");
        setBbError("No SKILL.md found here. A skill is a folder containing a SKILL.md — try a different repo or path.");
        return;
      }

      setBbProgress({ done: 0, total: skillFiles.length });
      const index = await bbMapPool(skillFiles, 6, async (f) => {
        let meta = { name: "", description: "", tags: [], raw: "" };
        try {
          meta = parseSkillFrontmatter(await bbFetchFile(src.workspace, src.repo, commit, f.path, token, ctrl.signal));
        } catch { /* unreadable SKILL.md — still list it by path */ }
        const dir = bbSkillDir(f.path);
        return {
          id: f.path,
          skillPath: f.path,
          dir,
          name: meta.name || dir.split("/").pop() || src.repo,
          description: meta.description,
          tags: meta.tags,
          haystack: `${meta.name} ${meta.description} ${meta.tags.join(" ")} ${meta.raw} ${f.path}`.toLowerCase(),
        };
      }, (done, total) => setBbProgress({ done, total }));
      if (ctrl.signal.aborted) return;

      index.sort((a, b) => a.name.localeCompare(b.name));
      setBbIndex(index);
      setBbStatus("ready");
    } catch (err) {
      if (err.name === "AbortError") return;
      setBbStatus("error");
      setBbError(bbErrorMessage(err));
    }
  };

  // Open one indexed skill: fetch its whole folder into the editor buffer.
  const handleBitbucketOpen = async (entry) => {
    if (!bbRepoInfo) return;
    const { workspace, repo, commit, files } = bbRepoInfo;
    const token = bbToken.trim();
    const prefix = entry.dir ? entry.dir + "/" : "";
    const inFolder = files.filter((f) => (prefix ? f.path.startsWith(prefix) : true));
    const picked = inFolder.filter((f) => !bbIsBinary(f.path)).slice(0, BB_MAX_OPEN_FILES);

    bbAbortRef.current?.abort();
    const ctrl = new AbortController();
    bbAbortRef.current = ctrl;
    setBbOpeningId(entry.id); setBbStatus("opening"); setBbError("");
    setBbProgress({ done: 0, total: picked.length });

    try {
      const fetched = await bbMapPool(picked, 6, async (f) => ({
        path: prefix ? f.path.slice(prefix.length) : f.path,
        content: await bbFetchFile(workspace, repo, commit, f.path, token, ctrl.signal),
      }), (done, total) => setBbProgress({ done, total }));
      if (ctrl.signal.aborted) return;

      pushUndo(blocksRef.current);
      const loaded = makeFreeBlock(buildBufferFromSkillFiles(fetched));
      applyBlocks([loaded]);
      setBbStatus("ready"); setBbOpeningId(null); setShowBitbucket(false);
      setTimeout(() => blockDivRefs.current[loaded.id]?.focus(), 20);
    } catch (err) {
      setBbOpeningId(null);
      if (err.name === "AbortError") { setBbStatus("ready"); return; }
      setBbStatus("error");
      setBbError(bbErrorMessage(err));
    }
  };

  const handleBitbucketCancel = () => {
    bbAbortRef.current?.abort();
    setBbOpeningId(null);
    setBbStatus(bbIndex.length ? "ready" : "idle");
  };

  // Tags across the index (most common first) and the search/tag-filtered view.
  const bbAllTags = useMemo(() => {
    const counts = new Map();
    for (const s of bbIndex) for (const t of s.tags) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [bbIndex]);

  const bbFilteredIndex = useMemo(() => {
    const q = bbQuery.trim().toLowerCase();
    return bbIndex.filter((s) => {
      if (q && !s.haystack.includes(q)) return false;
      if (bbActiveTags.length && !bbActiveTags.every((t) => s.tags.includes(t))) return false;
      return true;
    });
  }, [bbIndex, bbQuery, bbActiveTags]);

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo. Text boxes
  // outside the editor (placeholder fill, block form, Bitbucket search) keep
  // the browser's own undo. With Shift held the key arrives as "Z".
  useEffect(() => {
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target;
      if (t instanceof HTMLElement &&
          (t.matches("input, textarea, select") || (t.isContentEditable && !t.closest("[data-block-id]")))) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  // ── Skin tokens ────────────────────────────────────────────────────────────
  const SKINS = {
    black: {
      appBg:        "#0A0E1A",
      headerBg:     "linear-gradient(180deg, #0F1428 0%, #0A0E1A 100%)",
      headerBorder: "#252D42",
      sidebarBg:    "#0C101E",
      cardBg:       "#0A0E1A",
      card2Bg:      "#0F1428",
      panelBg:      "#0B0F1F",
      border:       "#252D42",
      border2:      "#374457",
      text:         "#E2E8F0",
      textMuted:    "#9AA3B0",
      textDim:      "#8B95A8",
      textFaint:    "#374151",
      inputBg:      "#0A0E1A",
      scrollBg:     "#0C101E",
      scrollThumb:  "#374457",
      modalBg:      "#0F1428",
      accentStats:  "#A78BFA",
      arrowColor:   "#1B2235",
      dropZoneBg:   "#0A0E1A",
      caret:        "#A78BFA",
      editorText:   "#D1D5DB",
    },
    white: {
      appBg:        "#FFFFFF",
      headerBg:     "linear-gradient(180deg, #F8F9FA 0%, #FFFFFF 100%)",
      headerBorder: "#DEE2E6",
      sidebarBg:    "#F1F3F5",
      cardBg:       "#FFFFFF",
      card2Bg:      "#F8F9FA",
      panelBg:      "#F8F9FA",
      border:       "#DEE2E6",
      border2:      "#CED4DA",
      text:         "#212529",
      textMuted:    "#495057",
      textDim:      "#6C757D",
      textFaint:    "#ADB5BD",
      inputBg:      "#FFFFFF",
      scrollBg:     "#F1F3F5",
      scrollThumb:  "#CED4DA",
      modalBg:      "#FFFFFF",
      accentStats:  "#6D28D9",
      arrowColor:   "#DEE2E6",
      dropZoneBg:   "#FFFFFF",
      caret:        "#6D28D9",
      editorText:   "#0A0A0A",
    },
    grey: {
      appBg:        "#2B2D31",
      headerBg:     "linear-gradient(180deg, #313338 0%, #2B2D31 100%)",
      headerBorder: "#3F4147",
      sidebarBg:    "#2B2D31",
      cardBg:       "#2B2D31",
      card2Bg:      "#313338",
      panelBg:      "#313338",
      border:       "#3F4147",
      border2:      "#4E5058",
      text:         "#DBDEE1",
      textMuted:    "#B5BAC1",
      textDim:      "#949BA4",
      textFaint:    "#6D6F78",
      inputBg:      "#1E1F22",
      scrollBg:     "#2B2D31",
      scrollThumb:  "#4E5058",
      modalBg:      "#313338",
      accentStats:  "#C4A8FF",
      arrowColor:   "#3F4147",
      dropZoneBg:   "#2B2D31",
      caret:        "#C4A8FF",
      editorText:   "#DBDEE1",
    },
  };
  const sk = SKINS[skin];

  return (
    <div
      style={{
        height: "100%",
        background: sk.appBg,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'IBM Plex Mono', 'Fira Code', monospace",
        color: sk.text,
        overflow: "hidden",
      }}
    >
      {/* Google Font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Syne:wght@700;800&display=swap" />
      <style>{`
        * { box-sizing: border-box; }
        ::selection { background: #7C3AED55; color: ${sk.text}; }
        textarea:focus { outline: none; }
        textarea { resize: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${sk.scrollBg}; }
        ::-webkit-scrollbar-thumb { background: ${sk.scrollThumb}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${sk.border2}; }

        @keyframes undoBounce {
          0%   { transform: rotate(0deg) scale(1); }
          30%  { transform: rotate(-30deg) scale(1.15); }
          60%  { transform: rotate(10deg) scale(0.95); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes blockInsert {
          0% { background: #7C3AED33; }
          50% { background: #7C3AED22; }
          100% { background: transparent; }
        }
        @keyframes ripple {
          0% { transform: scale(0); opacity: 0.8; }
          100% { transform: scale(4); opacity: 0; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 #7C3AED33; }
          50% { box-shadow: 0 0 0 8px #7C3AED00; }
        }
        .drop-zone-active {
          animation: pulse-glow 1.2s ease infinite;
        }
        .block-card-dragging {
          opacity: 0.5 !important;
          transform: scale(0.95) !important;
        }
        .ph-chip {
          background: #F59E0B28;
          color: #F59E0B;
          border-radius: 4px;
          padding: 1px 2px;
          cursor: pointer;
          border-bottom: 1.5px dashed #F59E0B99;
          transition: background 0.15s, color 0.15s;
        }
        .ph-chip:hover {
          background: #F59E0B44;
          color: #FCD34D;
        }
      `}</style>

      {/* ── Header ── */}
      <header
        style={{
          borderBottom: `1px solid ${sk.headerBorder}`,
          padding: "10px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          background: sk.headerBg,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: "linear-gradient(135deg, #7C3AED, #EC4899)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ✦
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                background: "linear-gradient(90deg, #E2E8F0 0%, #A78BFA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: -0.5,
                paddingBottom: 3,
              }}
            >
              ACE Studio
            </h1>
            <span style={{ fontSize: 10, fontWeight: 400, color: sk.textMuted, letterSpacing: 0.3 }}>v{APP_VERSION}</span>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: sk.textMuted, letterSpacing: 0.5 }}>
            AUTOMATED COMPUTER ENGINEERING
          </p>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          {/* Stats */}
          {promptText && (
            <div
              style={{
                display: "flex",
                gap: 12,
                marginRight: 8,
                animation: "fadeSlideIn 0.2s ease",
              }}
            >
              {[
                { v: wordCount, l: "words" },
                { v: charCount, l: "chars" },
              ].map((s) => (
                <div key={s.l} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: sk.accentStats,
                      lineHeight: 1,
                    }}
                  >
                    {s.v}
                  </div>
                  <div style={{ fontSize: 10, color: sk.textMuted, letterSpacing: 0.5 }}>
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={copyPrompt}
            disabled={!promptText}
            style={{
              background: copied === "error" ? "#EF4444" : copied ? "#10B981" : sk.border,
              color: copied ? "#fff" : sk.textMuted,
              border: `1px solid ${copied === "error" ? "#EF4444" : copied ? "#10B981" : sk.border2}`,
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: promptText ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              transition: "all 0.2s",
              opacity: promptText ? 1 : 0.4,
              letterSpacing: 0.3,
            }}
          >
            {copied === "error" ? "✕ FAILED" : copied ? "✓ COPIED" : "📋 COPY"}
          </button>
          <button
            onClick={clearAll}
            disabled={!promptText}
            style={{
              background: "transparent",
              color: sk.textMuted,
              border: `1px solid ${sk.border}`,
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              opacity: promptText ? 1 : 0.4,
              letterSpacing: 0.3,
            }}
          >
            CLEAR
          </button>

          {/* ── Skin switcher ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
            {[
              { key: "black", label: "●", title: "Black",  bg: "#0A0E1A", ring: "#A78BFA" },
              { key: "white", label: "●", title: "White",  bg: "#FFFFFF",  ring: "#6D28D9" },
              { key: "grey",  label: "●", title: "Grey",   bg: "#2B2D31",  ring: "#C4A8FF" },
            ].map((s) => (
              <button
                key={s.key}
                title={`${s.title} skin`}
                onClick={() => setSkin(s.key)}
                style={{
                  width: 16, height: 16,
                  borderRadius: "50%",
                  background: s.bg,
                  border: skin === s.key
                    ? `2px solid ${s.ring}`
                    : `2px solid ${sk.border2}`,
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 0.2s",
                  transform: skin === s.key ? "scale(1.3)" : "scale(1)",
                  boxShadow: skin === s.key ? `0 0 0 1px ${s.ring}55` : "none",
                  outline: "none",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/* ── Divider ── */}
          <div style={{ width: 1, height: 22, background: sk.border, margin: "0 4px" }} />

          {/* ── Export split button ── */}
          <div style={{ position: "relative", display: "inline-flex" }}>
            {/* Main label — clicking opens format menu */}
            <button
              onClick={() => { if (promptText) setShowExportMenu(v => !v); }}
              disabled={!promptText}
              style={{
                background: exportFlash ? "#10B981" : sk.card2Bg,
                color: exportFlash ? "#fff" : "#34D399",
                border: `1px solid ${exportFlash ? "#10B981" : "#34D39944"}`,
                borderRadius: "8px 0 0 8px",
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: promptText ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                transition: "all 0.2s",
                opacity: promptText ? 1 : 0.4,
                letterSpacing: 0.3,
                borderRight: "none",
              }}
              onMouseEnter={(e) => {
                if (promptText && !exportFlash) {
                  e.currentTarget.style.background = "#34D39922";
                  e.currentTarget.style.borderColor = "#34D399";
                }
              }}
              onMouseLeave={(e) => {
                if (!exportFlash) {
                  e.currentTarget.style.background = sk.card2Bg;
                  e.currentTarget.style.borderColor = "#34D39944";
                }
              }}
            >
              {exportFlash ? "✓ EXPORTED" : "⬇ EXPORT"}
            </button>
            {/* Chevron / caret */}
            <button
              onClick={() => { if (promptText) setShowExportMenu(v => !v); }}
              disabled={!promptText}
              title="Choose export format"
              style={{
                background: exportFlash ? "#10B981" : sk.card2Bg,
                color: exportFlash ? "#fff" : "#34D399",
                border: `1px solid ${exportFlash ? "#10B981" : "#34D39944"}`,
                borderRadius: "0 8px 8px 0",
                padding: "7px 7px",
                fontSize: 10,
                fontWeight: 700,
                cursor: promptText ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                transition: "all 0.2s",
                opacity: promptText ? 1 : 0.4,
                borderLeft: `1px solid ${exportFlash ? "#10B98188" : "#34D39922"}`,
              }}
              onMouseEnter={(e) => {
                if (promptText && !exportFlash) {
                  e.currentTarget.style.background = "#34D39922";
                }
              }}
              onMouseLeave={(e) => {
                if (!exportFlash) e.currentTarget.style.background = sk.card2Bg;
              }}
            >
              {showExportMenu ? "▲" : "▼"}
            </button>

            {/* ── Format dropdown ── */}
            {showExportMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: sk.card2Bg,
                  border: `1px solid ${sk.border}`,
                  borderRadius: 10,
                  boxShadow: "0 8px 32px #0008",
                  zIndex: 9999,
                  minWidth: 270,
                  overflow: "hidden",
                }}
                onMouseLeave={() => setShowExportMenu(false)}
              >
                <div style={{ padding: "8px 12px 4px", fontSize: 10, color: sk.textFaint, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
                  Export as…
                </div>
                {EXPORT_FORMATS.map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => handleExportAs(fmt)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      borderTop: `1px solid ${sk.border}`,
                      padding: "9px 14px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      color: sk.text,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = sk.card3Bg || "#ffffff18"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 16, width: 22, textAlign: "center", flexShrink: 0 }}>{fmt.icon}</span>
                    <span>
                      <span style={{ fontSize: 12, fontWeight: 700, display: "block" }}>{fmt.label}</span>
                      <span style={{ fontSize: 10, color: sk.textFaint }}>{fmt.desc}</span>
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: sk.textFaint, flexShrink: 0 }}>{fmt.ext}</span>
                  </button>
                ))}
                <button
                  onClick={handleExportSkill}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    borderTop: `2px solid ${sk.border}`,
                    padding: "9px 14px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    color: sk.text,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = sk.card3Bg || "#ffffff18"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 16, width: 22, textAlign: "center", flexShrink: 0 }}>🧩</span>
                  <span>
                    <span style={{ fontSize: 12, fontWeight: 700, display: "block" }}>Agent Skill folder</span>
                    <span style={{ fontSize: 10, color: sk.textFaint }}>Deployable SKILL.md + folders, zipped</span>
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: sk.textFaint, flexShrink: 0 }}>.zip</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Load button ── */}
          <button
            onClick={() => { if (fileInputRef.current) fileInputRef.current.click(); }}
            style={{
              background: sk.card2Bg,
              color: "#60A5FA",
              border: "1px solid #60A5FA44",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
              letterSpacing: 0.3,
              position: "relative",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#60A5FA22";
              e.currentTarget.style.borderColor = "#60A5FA";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = sk.card2Bg;
              e.currentTarget.style.borderColor = "#60A5FA44";
            }}
          >
            📂 LOAD
          </button>

          {/* ── Open from Bitbucket button ── */}
          <button
            onClick={() => { setShowBitbucket(true); if (bbStatus === "error") { setBbStatus(bbIndex.length ? "ready" : "idle"); setBbError(""); } }}
            title="Open an Agent Skill stored on Atlassian Bitbucket"
            style={{
              background: sk.card2Bg,
              color: "#2684FF",
              border: "1px solid #2684FF55",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
              letterSpacing: 0.3,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#2684FF22";
              e.currentTarget.style.borderColor = "#2684FF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = sk.card2Bg;
              e.currentTarget.style.borderColor = "#2684FF55";
            }}
          >
            🧺 BITBUCKET
          </button>

          {/* Template Gallery button */}
          <button
            onClick={() => setShowGallery(true)}
            style={{
              background: "linear-gradient(135deg, #7C3AED22, #EC489922)",
              color: "#C084FC",
              border: "1px solid #7C3AED66",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
              letterSpacing: 0.3,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #7C3AED44, #EC489933)";
              e.currentTarget.style.borderColor = "#7C3AED99";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #7C3AED22, #EC489922)";
              e.currentTarget.style.borderColor = "#7C3AED66";
            }}
          >
            ✨ QUICK START
          </button>
        </div>
      </header>


      {/* ════════════════ NEW BLOCK MODAL ════════════════ */}
      {showNewBlockModal && (
        <div
          onClick={() => setShowNewBlockModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9200,
            background: "rgba(8,11,20,0.88)",
            backdropFilter: "blur(7px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 384, maxWidth: "calc(100vw - 48px)",
              background: sk.modalBg,
              border: `1px solid ${sk.border}`,
              borderRadius: 11,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 16px 60px #00000099",
            }}
          >
            {/* Header */}
            <div style={{ padding: "10px 16px 8px", borderBottom: `1px solid ${sk.border}`, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ fontSize: 18 }}>{nbEmoji || "✨"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: sk.text, letterSpacing: 0.3 }}>{editingBlockId ? "EDIT BLOCK" : "CREATE BLOCK"}</div>
                <div style={{ fontSize: 10, color: sk.textDim, marginTop: 2 }}>{editingBlockId ? "Changes are saved immediately to your custom blocks" : "New block will appear at the top of Template Blocks"}</div>
              </div>
              <button onClick={() => { setShowNewBlockModal(false); setEditingBlockId(null); }} style={{ background: "transparent", border: "none", color: sk.textDim, fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: "11px 16px 14px", display: "flex", flexDirection: "column", gap: 9 }}>

              {/* Emoji selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: sk.textMuted, letterSpacing: 1, display: "block", marginBottom: 7 }}>EMOJI</label>
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: 5,
                  background: sk.inputBg, border: `1px solid ${sk.border}`,
                  borderRadius: 9, padding: "8px",
                }}>
                  {[
                    "✨","🔥","⚡","🌟","💎","🚀","🎪","🔮","🗝️","🧩",
                    "🎩","🎲","🔭","🧬","🧲","💠","🔑","🧿","🎴","🃏",
                    "🏗️","🔧","🔩","⚗️","🧪","📡","🛰️","🧭","🗃️","📎",
                  ].map((em) => (
                    <button
                      key={em}
                      onClick={() => setNbEmoji(em)}
                      style={{
                        width: 29, height: 29,
                        borderRadius: 7,
                        border: `1.5px solid ${nbEmoji === em ? nbColor : sk.border}`,
                        background: nbEmoji === em ? nbColor + "33" : "transparent",
                        fontSize: 18, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.12s",
                        transform: nbEmoji === em ? "scale(1.15)" : "scale(1)",
                        boxShadow: nbEmoji === em ? `0 0 0 2px ${nbColor}55` : "none",
                        flexShrink: 0,
                      }}
                      title={em}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Label row */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: sk.textMuted, letterSpacing: 1, display: "block", marginBottom: 5 }}>LABEL</label>
                <input
                  autoFocus
                  value={nbLabel}
                  onChange={(e) => setNbLabel(e.target.value)}
                  placeholder="My Custom Block"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: sk.inputBg, border: `1px solid ${sk.border}`,
                    borderRadius: 8, padding: "7px 13px",
                    fontSize: 13, color: sk.text,
                    fontFamily: "'IBM Plex Mono', monospace", outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = nbColor; }}
                  onBlur={(e) => { e.target.style.borderColor = sk.border; }}
                />
              </div>

              {/* Colour */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: sk.textMuted, letterSpacing: 1, display: "block", marginBottom: 7 }}>COLOUR</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {["#7C3AED","#0EA5E9","#10B981","#F59E0B","#EC4899","#F97316","#14B8A6","#6366F1","#F43F5E","#84CC16","#0369A1","#B45309","#64748B","#16A34A"].map((c) => (
                    <div
                      key={c}
                      onClick={() => setNbColor(c)}
                      style={{
                        width: 22, height: 22, borderRadius: "50%", background: c,
                        cursor: "pointer", flexShrink: 0, transition: "transform 0.15s",
                        transform: nbColor === c ? "scale(1.35)" : "scale(1)",
                        boxShadow: nbColor === c ? `0 0 0 2px ${sk.cardBg}, 0 0 0 4px ${c}` : "none",
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={nbColor}
                    onChange={(e) => setNbColor(e.target.value)}
                    title="Pick any colour"
                    style={{ width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0, background: "none" }}
                  />
                </div>
              </div>

              {/* Template text */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: sk.textMuted, letterSpacing: 1, display: "block", marginBottom: 5 }}>TEMPLATE TEXT</label>
                <textarea
                  value={nbText}
                  onChange={(e) => setNbText(e.target.value)}
                  placeholder={"Use [PLACEHOLDERS] for fields the user should fill in.\nExample:\nYour role: [ROLE]\nYour task: [TASK]"}
                  rows={5}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: sk.inputBg, border: `1px solid ${sk.border}`,
                    borderRadius: 8, padding: "8px 13px",
                    fontSize: 12, color: sk.text,
                    fontFamily: "'IBM Plex Mono', monospace", outline: "none",
                    resize: "vertical", lineHeight: 1.7,
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = nbColor; }}
                  onBlur={(e) => { e.target.style.borderColor = sk.border; }}
                />
              </div>

              {/* Preview strip */}
              {(nbLabel || nbText) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 10, color: sk.textFaint, flexShrink: 0 }}>Preview:</div>
                  <div style={{
                    position: "relative",
                    width: 163, flexShrink: 0,
                    padding: "10px 13px", borderRadius: 10,
                    border: `1.5px solid ${nbColor}55`,
                    background: `linear-gradient(135deg, ${nbColor}18, ${nbColor}08)`,
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{nbEmoji || "✨"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: nbColor, letterSpacing: 0.3 }}>{nbLabel || "Untitled"}</div>
                    </div>
                    {/* Dummy pencil */}
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
                      <path d="M7.5 1.5L9.5 3.5L3.5 9.5L1 10L1.5 7.5L7.5 1.5Z" stroke={nbColor} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {/* Dummy × */}
                    <span style={{ fontSize: 11, color: nbColor, opacity: 0.35, lineHeight: 1, flexShrink: 0 }}>✕</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 0 }}>
                <button
                  onClick={() => { setShowNewBlockModal(false); setEditingBlockId(null); }}
                  style={{
                    background: "transparent", color: sk.textDim,
                    border: `1px solid ${sk.border}`, borderRadius: 8,
                    padding: "7px 20px", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >CANCEL</button>
                <button
                  onClick={editingBlockId ? confirmEditBlock : confirmNewBlock}
                  disabled={!nbLabel.trim() || !nbText.trim()}
                  style={{
                    background: nbColor, color: "#fff",
                    border: "none", borderRadius: 8,
                    padding: "7px 24px", fontSize: 12, fontWeight: 700,
                    cursor: (!nbLabel.trim() || !nbText.trim()) ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    opacity: (!nbLabel.trim() || !nbText.trim()) ? 0.4 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {editingBlockId ? "✓ Save Changes" : `${nbEmoji || "✨"} Add & Close`}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ════════════════ TEMPLATE GALLERY MODAL ════════════════ */}
      {showGallery && (() => {
        // ── Template definitions ──────────────────────────────────────────────
        // Each template has: id, emoji, title, description, example, template.
        // Sections follow built-in block order: Role → Context → Task →
        // Constraints → Think Step-by-Step → Output Format → Self-Verify.
        const GALLERY = [
          {
            id: "summarise",
            emoji: "📄",
            title: "Summarise a Document",
            description: "Condense any document into a crisp executive summary.",
            example: `You are an expert technical writer with 10 years of experience in documentation and knowledge management. Your approach is clear, concise, and audience-focused.

Context: The user is working on internal documentation for the Platform Engineering team. Key constraints: the audience are senior stakeholders with limited time.

Your task is to summarise the document provided below. Focus on key decisions, outcomes, and action items. Do NOT include implementation details or raw data.

Constraints:
- Only use information provided in the document content
- If unsure about intent, say "I don't know"
- Limit response to 200 words

Think step by step:
1. Identify what the document is about
2. List the key decisions or findings
3. Identify action items or owners
4. State a one-sentence conclusion

Respond using this format:
## Executive Summary
Structure: [Overview, Key Decisions, Action Items, Conclusion]
Max length: 200 words

Before responding:
1. Verify each claim appears in the source document
2. Flag any ambiguous sections with [?]
3. Check your summary is self-contained`,

            template: `You are an expert [ROLE] with [X] years of experience in [SPECIALTY]. Your approach is [STYLE].

Context: The user is working on [DOCUMENT_SOURCE]. Key constraints: the audience are [AUDIENCE].

Your task is to summarise the document provided below. Focus on [FOCUS_AREAS]. Do NOT include [EXCLUSIONS].

Constraints:
- Only use information provided in the document content
- If unsure about intent, say "I don't know"
- Limit response to [N] words

Think step by step:
1. Identify what the document is about
2. List the key decisions or findings
3. Identify action items or owners
4. State a one-sentence conclusion

Respond using this format:
[FORMAT_TYPE]
Structure: [SECTIONS]
Max length: [N] words

Before responding:
1. Verify each claim appears in the source document
2. Flag any ambiguous sections with [?]
3. Check your summary is self-contained`,
          },
          {
            id: "prd",
            emoji: "📋",
            title: "Write a PRD",
            description: "Generate a full Product Requirements Document from a feature brief.",
            example: `You are an expert product manager with 8 years of experience in SaaS product development. Your approach is structured, user-centric, and data-driven.

Context: The user is working on a new notification preferences feature for a SaaS mobile app. Key constraints: must align with existing design system and Q3 roadmap.

Your task is to write a complete PRD for the feature described below. Focus on user stories, acceptance criteria, and technical constraints. Do NOT include engineering implementation details or cost estimates.

Constraints:
- Only use information provided in the brief
- If a requirement is ambiguous, flag it with [NEEDS CLARIFICATION]
- Limit response to 600 words

Think step by step:
1. Identify the problem being solved
2. Define the target user and their goals
3. List functional and non-functional requirements
4. Identify risks and open questions

Respond using this format:
## Product Requirements Document
Structure: [Problem Statement, Goals, User Stories, Acceptance Criteria, Risks, Open Questions]
Max length: 600 words

Before responding:
1. Verify every requirement traces back to a user need
2. Flag any missing information with [?]
3. Check requirements are testable and measurable`,

            template: `You are an expert [ROLE] with [X] years of experience in [SPECIALTY]. Your approach is [STYLE].

Context: The user is working on [FEATURE_NAME] for [PRODUCT]. Key constraints: [CONSTRAINTS].

Your task is to write a complete PRD for the feature described below. Focus on [FOCUS_AREAS]. Do NOT include [EXCLUSIONS].

Constraints:
- Only use information provided in the brief
- If a requirement is ambiguous, flag it with [NEEDS CLARIFICATION]
- Limit response to [N] words

Think step by step:
1. Identify the problem being solved
2. Define the target user and their goals
3. List functional and non-functional requirements
4. Identify risks and open questions

Respond using this format:
[FORMAT_TYPE]
Structure: [SECTIONS]
Max length: [N] words

Before responding:
1. Verify every requirement traces back to a user need
2. Flag any missing information with [?]
3. Check requirements are testable and measurable`,
          },
          {
            id: "meeting",
            emoji: "🗒️",
            title: "Generate Meeting Notes",
            description: "Turn a raw meeting transcript into structured, actionable notes.",
            example: `You are an expert business analyst with 6 years of experience in facilitation and documentation. Your approach is structured, neutral, and action-oriented.

Context: The user is working on documenting a sprint planning meeting for the Core Platform team. Key constraints: audience are engineers and their direct manager.

Your task is to generate structured meeting notes from the transcript provided below. Focus on decisions made, action items with owners, and blockers raised. Do NOT include small talk, repetition, or off-topic tangents.

Constraints:
- Only use information from the transcript
- If a speaker or owner is unclear, write [OWNER TBD]
- Limit response to 400 words

Think step by step:
1. Identify the meeting purpose and attendees
2. Extract key decisions and their rationale
3. List action items with owners and due dates
4. Note any blockers or parking lot items

Respond using this format:
## Meeting Notes — [DATE]
Structure: [Attendees, Purpose, Key Decisions, Action Items, Blockers, Next Steps]
Max length: 400 words

Before responding:
1. Verify every action item has an owner
2. Flag unclear attributions with [?]
3. Check the notes can stand alone without the transcript`,

            template: `You are an expert [ROLE] with [X] years of experience in [SPECIALTY]. Your approach is [STYLE].

Context: The user is working on documenting a [MEETING_TYPE] for [TEAM]. Key constraints: audience are [AUDIENCE].

Your task is to generate structured meeting notes from the transcript below. Focus on [FOCUS_AREAS]. Do NOT include [EXCLUSIONS].

Constraints:
- Only use information from the transcript
- If a speaker or owner is unclear, write [OWNER TBD]
- Limit response to [N] words

Think step by step:
1. Identify the meeting purpose and attendees
2. Extract key decisions and their rationale
3. List action items with owners and due dates
4. Note any blockers or parking lot items

Respond using this format:
[FORMAT_TYPE]
Structure: [SECTIONS]
Max length: [N] words

Before responding:
1. Verify every action item has an owner
2. Flag unclear attributions with [?]
3. Check the notes can stand alone without the transcript`,
          },
          {
            id: "techspec",
            emoji: "🔍",
            title: "Review a Technical Spec",
            description: "Critically review a technical specification for gaps, risks, and ambiguities.",
            example: `You are an expert software architect with 12 years of experience in distributed systems and API design. Your approach is rigorous, systematic, and constructive.

Context: The user is working on a technical spec for a new event-streaming service at Acme Corp. Key constraints: must comply with existing security standards and support 10k events/sec.

Your task is to review the technical specification provided below. Focus on identifying gaps, ambiguities, scalability risks, and missing error-handling. Do NOT rewrite the spec or suggest alternative architectures.

Constraints:
- Only evaluate the spec as written
- If something is unclear, flag it explicitly rather than assuming
- Limit response to 500 words

Think step by step:
1. Understand the stated purpose and scope
2. Identify missing or underspecified sections
3. Assess scalability, security, and failure modes
4. List concrete recommendations with severity (High/Medium/Low)

Respond using this format:
## Spec Review
Structure: [Summary, Critical Gaps, Risks, Recommendations by Severity, Open Questions]
Max length: 500 words

Before responding:
1. Verify each finding is supported by the spec text
2. Flag assumptions with [ASSUMED]
3. Ensure recommendations are actionable`,

            template: `You are an expert [ROLE] with [X] years of experience in [SPECIALTY]. Your approach is [STYLE].

Context: The user is working on [SPEC_NAME] at [COMPANY]. Key constraints: [CONSTRAINTS].

Your task is to review the technical specification provided below. Focus on [FOCUS_AREAS]. Do NOT [EXCLUSIONS].

Constraints:
- Only evaluate the spec as written
- If something is unclear, flag it explicitly rather than assuming
- Limit response to [N] words

Think step by step:
1. Understand the stated purpose and scope
2. Identify missing or underspecified sections
3. Assess scalability, security, and failure modes
4. List concrete recommendations with severity

Respond using this format:
[FORMAT_TYPE]
Structure: [SECTIONS]
Max length: [N] words

Before responding:
1. Verify each finding is supported by the spec text
2. Flag assumptions with [ASSUMED]
3. Ensure recommendations are actionable`,
          },
          {
            id: "issues",
            emoji: "📊",
            title: "Analyse Issue Tracker Patterns",
            description: "Identify trends, bottlenecks, and quality issues across a set of issue-tracker tickets.",
            example: `You are an expert engineering manager with 9 years of experience in agile delivery and team performance analysis. Your approach is data-driven, candid, and improvement-focused.

Context: The user is working on a quarterly retrospective for the Search Platform team at Acme Corp. Key constraints: tickets span one quarter and include bugs, stories, and tech debt items.

Your task is to analyse the issue-tracker ticket data provided below. Focus on recurring bug categories, cycle time patterns, and blocked tickets. Do NOT make assumptions about team morale or individual performance.

Constraints:
- Only use data provided in the ticket export
- If a pattern has fewer than 3 instances, note it as anecdotal
- Limit response to 400 words

Think step by step:
1. Categorise tickets by type and status
2. Identify the most frequent issue categories
3. Spot cycle time outliers and their causes
4. Suggest two to three targeted improvements

Respond using this format:
## Ticket Pattern Analysis — Q3 2025
Structure: [Volume Summary, Top Issue Categories, Cycle Time Analysis, Blockers, Recommendations]
Max length: 400 words

Before responding:
1. Verify every insight is backed by ticket data
2. Flag low-confidence patterns with [ANECDOTAL]
3. Keep recommendations specific and actionable`,

            template: `You are an expert [ROLE] with [X] years of experience in [SPECIALTY]. Your approach is [STYLE].

Context: The user is working on [RETROSPECTIVE_TYPE] for [TEAM] at [COMPANY]. Key constraints: [CONSTRAINTS].

Your task is to analyse the issue-tracker ticket data provided below. Focus on [FOCUS_AREAS]. Do NOT [EXCLUSIONS].

Constraints:
- Only use data provided in the ticket export
- If a pattern has fewer than [N] instances, note it as anecdotal
- Limit response to [N] words

Think step by step:
1. Categorise tickets by type and status
2. Identify the most frequent issue categories
3. Spot cycle time outliers and their causes
4. Suggest targeted improvements

Respond using this format:
[FORMAT_TYPE]
Structure: [SECTIONS]
Max length: [N] words

Before responding:
1. Verify every insight is backed by ticket data
2. Flag low-confidence patterns with [ANECDOTAL]
3. Keep recommendations specific and actionable`,
          },
          {
            id: "release",
            emoji: "📝",
            title: "Draft Release Notes",
            description: "Transform a list of merged PRs or tickets into polished release notes.",
            example: `You are an expert technical writer with 7 years of experience in developer communications and release management. Your approach is clear, user-focused, and concise.

Context: The user is working on release notes for version 3.4.0 of a Data Connector plugin. Key constraints: audience are both technical users and non-technical system admins.

Your task is to draft release notes from the list of changes provided below. Focus on user-visible impact, upgrade instructions, and breaking changes. Do NOT include internal ticket IDs, implementation details, or developer jargon.

Constraints:
- Only include changes listed in the provided changelog
- If impact is unclear, write [IMPACT TBD]
- Limit response to 300 words

Think step by step:
1. Group changes into: New Features, Improvements, Bug Fixes, Breaking Changes
2. Rewrite each item in user-facing language
3. Highlight any breaking changes prominently
4. Add a one-sentence version summary

Respond using this format:
## Release Notes — v3.4.0
Structure: [Version Summary, New Features, Improvements, Bug Fixes, Breaking Changes, Upgrade Notes]
Max length: 300 words

Before responding:
1. Verify every item maps to a provided change
2. Flag unclear impact with [?]
3. Ensure breaking changes section is visible and prominent`,

            template: `You are an expert [ROLE] with [X] years of experience in [SPECIALTY]. Your approach is [STYLE].

Context: The user is working on release notes for [VERSION] of [PRODUCT]. Key constraints: audience are [AUDIENCE].

Your task is to draft release notes from the list of changes below. Focus on [FOCUS_AREAS]. Do NOT include [EXCLUSIONS].

Constraints:
- Only include changes listed in the provided changelog
- If impact is unclear, write [IMPACT TBD]
- Limit response to [N] words

Think step by step:
1. Group changes into: New Features, Improvements, Bug Fixes, Breaking Changes
2. Rewrite each item in user-facing language
3. Highlight any breaking changes prominently
4. Add a one-sentence version summary

Respond using this format:
[FORMAT_TYPE]
Structure: [SECTIONS]
Max length: [N] words

Before responding:
1. Verify every item maps to a provided change
2. Flag unclear impact with [?]
3. Ensure breaking changes section is visible and prominent`,
          },
        ];

        const selectedId = gallerySelectedId;
        const setSelectedId = setGallerySelectedId;
        const tab = galleryTab;
        const setTab = setGalleryTab;
        const selected = GALLERY.find((t) => t.id === selectedId) || GALLERY[0];

        const loadTemplate = () => {
          pushUndo(blocksRef.current);
          const text = tab === "example" ? selected.example : selected.template;
          const loaded = makeFreeBlock(text);
          applyBlocks([loaded]);
          setShowGallery(false);
          setTimeout(() => blockDivRefs.current[loaded.id]?.focus(), 20);
        };

        return (
          <div
            onClick={() => setShowGallery(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 9200,
              background: "rgba(8,11,20,0.88)",
              backdropFilter: "blur(7px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 820, maxWidth: "calc(100vw - 48px)",
                height: "78vh", maxHeight: 640,
                background: sk.modalBg,
                border: `1px solid ${sk.border}`,
                borderRadius: 12,
                display: "flex", flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 24px 80px #00000099",
              }}
            >
              {/* Modal header */}
              <div style={{ padding: "14px 20px 12px", borderBottom: `1px solid ${sk.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 20 }}>✨</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sk.text, letterSpacing: 0.5 }}>QUICK START — TEMPLATE GALLERY</div>
                  <div style={{ fontSize: 10, color: sk.textDim, marginTop: 2 }}>Choose a template · preview Example or Template · load into editor</div>
                </div>
                <button onClick={() => setShowGallery(false)} style={{ background: "transparent", border: "none", color: sk.textDim, fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
              </div>

              {/* Body: left list + right preview */}
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                {/* Left: template list */}
                <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${sk.border}`, overflowY: "auto", padding: "10px 8px" }}>
                  {GALLERY.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        padding: "10px 10px",
                        borderRadius: 8,
                        marginBottom: 4,
                        cursor: "pointer",
                        background: selectedId === t.id ? "#7C3AED22" : "transparent",
                        border: `1px solid ${selectedId === t.id ? "#7C3AED66" : "transparent"}`,
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { if (selectedId !== t.id) e.currentTarget.style.background = sk.card2Bg; }}
                      onMouseLeave={(e) => { if (selectedId !== t.id) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{t.emoji}</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: selectedId === t.id ? "#C084FC" : sk.text, letterSpacing: 0.2, lineHeight: 1.3 }}>{t.title}</div>
                        <div style={{ fontSize: 10, color: sk.textDim, marginTop: 3, lineHeight: 1.4 }}>{t.description}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right: preview */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                  {/* Tab bar */}
                  <div style={{ display: "flex", borderBottom: `1px solid ${sk.border}`, flexShrink: 0 }}>
                    {[
                      { key: "example",  label: "✅ Ready-to-use Example" },
                      { key: "template", label: "📋 Template with Placeholders" },
                    ].map((tb) => (
                      <button
                        key={tb.key}
                        onClick={() => setTab(tb.key)}
                        style={{
                          padding: "9px 18px",
                          fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                          background: tab === tb.key ? "#7C3AED22" : "transparent",
                          color: tab === tb.key ? "#C084FC" : sk.textMuted,
                          border: "none",
                          borderBottom: tab === tb.key ? "2px solid #7C3AED" : "2px solid transparent",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                      >
                        {tb.label}
                      </button>
                    ))}
                  </div>

                  {/* Preview text */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                    <pre style={{
                      margin: 0,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11,
                      lineHeight: 1.75,
                      color: sk.textDim,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}>
                      {tab === "example" ? selected.example : selected.template}
                    </pre>
                  </div>

                  {/* Footer */}
                  <div style={{ padding: "12px 20px", borderTop: `1px solid ${sk.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: sk.textFaint }}>
                      {tab === "example" ? "Filled placeholders — ready to send" : "Contains [PLACEHOLDERS] — fill before sending"}
                    </span>
                    <button
                      onClick={loadTemplate}
                      style={{
                        background: "linear-gradient(135deg, #7C3AED, #EC4899)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 20px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        letterSpacing: 0.3,
                        boxShadow: "0 4px 16px #7C3AED44",
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                    >
                      Load into Editor →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ── Hidden file input for blocks LOAD ── */}
      <input
        ref={blocksFileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleBlocksFileChange}
      />

      {/* ── Confirm overwrite modal for blocks LOAD ── */}
      {showBlocksLoadConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "#000a", zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: sk.card2Bg, border: `1px solid ${sk.border}`,
            borderRadius: 14, padding: "28px 28px 22px", maxWidth: 380, width: "90%",
            boxShadow: "0 16px 48px #0008",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: sk.text, marginBottom: 10 }}>
              Replace Custom Blocks?
            </div>
            <div style={{ fontSize: 13, color: sk.textFaint, lineHeight: 1.6, marginBottom: 22 }}>
              You already have <strong style={{ color: sk.text }}>{customBlocks.length} custom block{customBlocks.length !== 1 ? "s" : ""}</strong>. Loading from file will remove all of them and replace with the blocks from <strong style={{ color: sk.text }}>blocks.json</strong>.
              <br /><br />
              This action cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowBlocksLoadConfirm(false); setPendingBlocksLoad(null); }}
                style={{
                  background: "transparent", color: sk.textFaint,
                  border: `1px solid ${sk.border}`, borderRadius: 8,
                  padding: "8px 18px", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = sk.text; e.currentTarget.style.borderColor = sk.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = sk.textFaint; e.currentTarget.style.borderColor = sk.border; }}
              >
                Cancel
              </button>
              <button
                onClick={confirmBlocksLoad}
                style={{
                  background: "#EF444422", color: "#EF4444",
                  border: "1px solid #EF444466", borderRadius: 8,
                  padding: "8px 18px", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#EF444433"; e.currentTarget.style.borderColor = "#EF4444"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#EF444422"; e.currentTarget.style.borderColor = "#EF444466"; }}
              >
                Replace & Load
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ OPEN FROM BITBUCKET MODAL ════════════════ */}
      {showBitbucket && (
        <div
          onClick={() => setShowBitbucket(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9300,
            background: "rgba(8,11,20,0.88)",
            backdropFilter: "blur(7px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 720, maxWidth: "100%", maxHeight: "86vh",
              background: sk.modalBg,
              border: `1px solid ${sk.border}`,
              borderRadius: 12,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 16px 60px #00000099",
            }}
          >
            {/* Header */}
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${sk.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🧺</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: sk.text, letterSpacing: 0.3 }}>Open skill from Bitbucket</div>
                <div style={{ fontSize: 10.5, color: sk.textDim, marginTop: 2 }}>Browse a Bitbucket Cloud repo, search by name / description / tags, and load a skill into the editor</div>
              </div>
              <button onClick={() => setShowBitbucket(false)} style={{ background: "transparent", border: "none", color: sk.textDim, fontSize: 17, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>✕</button>
            </div>

            {/* Source bar */}
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${sk.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ position: "relative", display: "flex", gap: 8 }}>
                <input
                  value={bbInput}
                  onChange={(e) => setBbInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && bbStatus !== "scanning" && bbStatus !== "opening") handleBitbucketScan(); }}
                  placeholder="bitbucket.org/workspace/repo  —  or a full /src/<branch>/<path> URL"
                  spellCheck={false}
                  style={{
                    flex: 1, minWidth: 0, boxSizing: "border-box",
                    background: sk.inputBg, color: sk.text,
                    border: `1px solid ${sk.border}`, borderRadius: 8,
                    padding: "9px 11px", fontSize: 12.5, fontFamily: "inherit", outline: "none",
                  }}
                />
                {bbRecent.length > 0 && (
                  <button
                    onClick={() => setShowBbRecent((v) => !v)}
                    title="Recently scanned repos"
                    style={{
                      flexShrink: 0, background: sk.inputBg, color: sk.textMuted,
                      border: `1px solid ${sk.border}`, borderRadius: 8,
                      padding: "0 11px", fontSize: 11.5, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                    }}
                  >🕘 Recent {showBbRecent ? "▲" : "▼"}</button>
                )}
                {showBbRecent && bbRecent.length > 0 && (
                  <div
                    onMouseLeave={() => setShowBbRecent(false)}
                    style={{
                      position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 10,
                      background: sk.card2Bg, border: `1px solid ${sk.border2}`, borderRadius: 9,
                      boxShadow: "0 10px 34px #0009", overflow: "hidden", maxHeight: 260, overflowY: "auto",
                    }}
                  >
                    <div style={{ padding: "7px 12px 4px", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: sk.textFaint }}>Recent repos</div>
                    {bbRecent.map((entry) => (
                      <div
                        key={entry.key}
                        onClick={() => handleBitbucketRecent(entry)}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", borderTop: `1px solid ${sk.border}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = sk.card3Bg || "#ffffff12"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <span style={{ fontSize: 14 }}>🧺</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: sk.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.workspace}/{entry.repo}</span>
                          {(entry.ref || entry.path) && (
                            <span style={{ display: "block", fontSize: 10, color: sk.textDim, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {entry.ref ? `@${entry.ref}` : ""}{entry.ref && entry.path ? " " : ""}{entry.path ? `/${entry.path}` : ""}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={(e) => bbRemoveRecent(entry.key, e)}
                          title="Remove from recent"
                          style={{ flexShrink: 0, background: "transparent", border: "none", color: sk.textFaint, fontSize: 13, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#F87171"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = sk.textFaint; }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={bbToken}
                  onChange={(e) => setBbToken(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && bbStatus !== "scanning" && bbStatus !== "opening") handleBitbucketScan(); }}
                  type="password"
                  placeholder="Access token / app password — blank for public repos"
                  spellCheck={false}
                  style={{
                    flex: 1, minWidth: 220, boxSizing: "border-box",
                    background: sk.inputBg, color: sk.text,
                    border: `1px solid ${sk.border}`, borderRadius: 8,
                    padding: "8px 11px", fontSize: 12, fontFamily: "inherit", outline: "none",
                  }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: sk.textMuted, cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" checked={bbRemember} onChange={(e) => { setBbRemember(e.target.checked); bbPersistToken(bbToken, e.target.checked); }} />
                  Remember
                </label>
                {bbStatus === "scanning" || bbStatus === "opening" ? (
                  <button
                    onClick={handleBitbucketCancel}
                    style={{ background: "transparent", color: "#F87171", border: "1px solid #F8717155", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                  >✕ Cancel</button>
                ) : (
                  <button
                    onClick={() => handleBitbucketScan()}
                    style={{ background: "#2684FF", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                  >🔍 Scan repo</button>
                )}
              </div>
              {(bbStatus === "scanning" || bbStatus === "opening") && (
                <div style={{ fontSize: 11, color: sk.textMuted }}>
                  {bbStatus === "scanning"
                    ? (bbProgress.total ? `Indexed ${bbProgress.done}/${bbProgress.total} SKILL.md…` : "Listing repository…")
                    : `Fetching ${bbProgress.done}/${bbProgress.total} files…`}
                </div>
              )}
              {bbError && <div style={{ fontSize: 11, color: "#F87171" }}>{bbError}</div>}
            </div>

            {/* Search + tag filters */}
            {bbIndex.length > 0 && (
              <div style={{ padding: "10px 16px", borderBottom: `1px solid ${sk.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  value={bbQuery}
                  onChange={(e) => setBbQuery(e.target.value)}
                  placeholder={`Search ${bbIndex.length} skill${bbIndex.length === 1 ? "" : "s"} by name, description, tags…`}
                  spellCheck={false}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: sk.inputBg, color: sk.text,
                    border: `1px solid ${sk.border}`, borderRadius: 8,
                    padding: "8px 11px", fontSize: 12, fontFamily: "inherit", outline: "none",
                  }}
                />
                {bbAllTags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {bbAllTags.slice(0, 40).map((t) => {
                      const on = bbActiveTags.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() => setBbActiveTags((cur) => on ? cur.filter((x) => x !== t) : [...cur, t])}
                          style={{
                            background: on ? "#2684FF" : "transparent",
                            color: on ? "#fff" : sk.textMuted,
                            border: `1px solid ${on ? "#2684FF" : sk.border2}`,
                            borderRadius: 999, padding: "2px 9px", fontSize: 10.5, fontWeight: 600,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >{t}</button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Results list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
              {bbStatus === "idle" && bbIndex.length === 0 && (
                <div style={{ padding: "28px 16px", textAlign: "center", color: sk.textDim, fontSize: 12, lineHeight: 1.8 }}>
                  Paste a Bitbucket Cloud repo above and press <b>Scan repo</b>.<br />
                  Every folder containing a <span style={{ fontFamily: "monospace", color: sk.textMuted }}>SKILL.md</span> becomes a searchable entry.
                </div>
              )}
              {bbIndex.length > 0 && bbFilteredIndex.length === 0 && (
                <div style={{ padding: "24px 16px", textAlign: "center", color: sk.textDim, fontSize: 12 }}>
                  No skills match{bbQuery ? ` “${bbQuery}”` : ""}{bbActiveTags.length ? " with the selected tags" : ""}.
                </div>
              )}
              {bbFilteredIndex.map((s) => {
                const opening = bbOpeningId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => { if (bbStatus !== "opening") handleBitbucketOpen(s); }}
                    disabled={bbStatus === "opening"}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      background: opening ? "#2684FF22" : "transparent",
                      border: `1px solid ${opening ? "#2684FF" : sk.border}`,
                      borderRadius: 9, padding: "10px 12px", marginBottom: 6,
                      cursor: bbStatus === "opening" ? "default" : "pointer",
                      fontFamily: "inherit", color: sk.text, transition: "all 0.12s",
                    }}
                    onMouseEnter={(e) => { if (!opening && bbStatus !== "opening") { e.currentTarget.style.borderColor = sk.border2; e.currentTarget.style.background = sk.card2Bg; } }}
                    onMouseLeave={(e) => { if (!opening) { e.currentTarget.style.borderColor = sk.border; e.currentTarget.style.background = "transparent"; } }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800 }}>{s.name}</span>
                      <span style={{ fontSize: 10, color: sk.textFaint, fontFamily: "monospace" }}>{s.dir || "(repo root)"}</span>
                      {opening && <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#2684FF", fontWeight: 700 }}>Opening… {bbProgress.done}/{bbProgress.total}</span>}
                    </div>
                    {s.description && <div style={{ fontSize: 11, color: sk.textMuted, marginTop: 3, lineHeight: 1.5 }}>{s.description}</div>}
                    {s.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                        {s.tags.slice(0, 12).map((t) => (
                          <span key={t} style={{ fontSize: 9.5, color: sk.textDim, background: sk.card2Bg, border: `1px solid ${sk.border}`, borderRadius: 999, padding: "1px 7px" }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: "8px 16px", borderTop: `1px solid ${sk.border}`, display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: sk.textFaint }}>
              <span style={{ flex: 1, fontFamily: "monospace" }}>
                {bbRepoInfo
                  ? `${bbRepoInfo.workspace}/${bbRepoInfo.repo} @ ${(bbRepoInfo.commit || bbRepoInfo.ref || "").slice(0, 7)}`
                  : "Bitbucket Cloud · read-only"}
              </span>
              <span>🔒 Token stays in your browser — use a read-only, repo-scoped token</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Hidden file input for LOAD — filtered to .prompt files ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".prompt"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      {/* ── Hallucination risk tooltip — root level, never clipped ── */}
      <div
        id="halluc-risk-tooltip"
        style={{
          display: "none",
          position: "fixed",
          background: "#1E293B",
          color: "#E2E8F0",
          border: "1px solid #334155",
          borderRadius: 7,
          padding: "8px 11px",
          fontSize: 11,
          lineHeight: 1.6,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px #0008",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      />

      {/* ── "Why?" block explainer tooltip — root level, never clipped ── */}
      <div
        id="why-block-tooltip"
        style={{
          display: "none",
          position: "fixed",
          background: "#1E293B",
          color: "#E2E8F0",
          border: "1px solid #334155",
          borderRadius: 7,
          padding: "8px 11px",
          fontSize: 11,
          lineHeight: 1.6,
          maxWidth: 280,
          whiteSpace: "normal",
          boxShadow: "0 4px 16px #0008",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      />

      {/* ── Drag-help tooltip — rendered at root level so it's never clipped ── */}
      <div
        id="drag-help-tooltip"
        style={{
          display: "none",
          position: "fixed",
          background: "#1E293B",
          color: "#E2E8F0",
          border: "1px solid #334155",
          borderRadius: 7,
          padding: "8px 11px",
          fontSize: 11,
          lineHeight: 1.7,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px #0008",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        1. Click on a template block<br/>
        2. Hold it<br/>
        3. Drag to the right<br/>
        4. Drop on the prompt editor
      </div>

      {/* ── Main Layout ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── LEFT: Block Library ── */}
        <aside
          style={{
            width: 350,
            flexShrink: 0,
            borderRight: `1px solid ${sk.border}`,
            background: sk.sidebarBg,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 14px 10px",
              borderBottom: `1px solid ${sk.border}`,
              flexShrink: 0,
              minHeight: 56,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: sk.border2, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: sk.textDim }}>
                TEMPLATE BLOCKS
              </span>
              <span
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 15, height: 15, borderRadius: "50%",
                  border: `1px solid ${sk.textDim}`, color: sk.textDim,
                  fontSize: 9, fontWeight: 700, cursor: "default",
                  userSelect: "none", flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const tip = document.getElementById("drag-help-tooltip");
                  if (tip) {
                    tip.style.top = (rect.bottom + 6) + "px";
                    tip.style.left = rect.left + "px";
                    tip.style.display = "block";
                  }
                }}
                onMouseLeave={() => {
                  const tip = document.getElementById("drag-help-tooltip");
                  if (tip) tip.style.display = "none";
                }}
              >
                i
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "10px 10px 20px",
              flex: 1,
              overflowY: "auto",
            }}
          >
            {/* ── CUSTOM section ── */}
            <div style={{ display: "flex", alignItems: "center", padding: "0 4px 6px", marginTop: 2 }}>
              <span
                onClick={() => setCustomFolded((f) => !f)}
                style={{ fontSize: 9, fontWeight: 700, color: sk.textDim, letterSpacing: 1.5, flex: 1, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }}
              >
                CUSTOM
                <span style={{ display: "inline-block", transform: customFolded ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 0.2s", fontSize: 8, lineHeight: 1 }}>▶</span>
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {/* NEW */}
                <button
                  onClick={() => { setNbLabel(""); setNbEmoji("✨"); setNbColor("#7C3AED"); setNbText(""); setShowNewBlockModal(true); }}
                  title="Create a new custom block"
                  style={{ background: "transparent", border: `1px solid ${sk.border}`, borderRadius: 6, color: sk.textMuted, fontSize: 9, fontWeight: 700, cursor: "pointer", padding: "2px 7px", lineHeight: 1, letterSpacing: 2, transition: "all 0.15s", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 3 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#A78BFA"; e.currentTarget.style.borderColor = "#A78BFA"; e.currentTarget.style.background = "#A78BFA18"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = sk.textMuted; e.currentTarget.style.borderColor = sk.border; e.currentTarget.style.background = "transparent"; }}
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ flexShrink: 0 }}><line x1="4.5" y1="1" x2="4.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="1" y1="4.5" x2="8" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  NEW
                </button>
                {/* LOAD */}
                <button
                  onClick={() => blocksFileInputRef.current && blocksFileInputRef.current.click()}
                  title={"Import custom blocks from a blocks.json file.\nOnly files exported from ACE Studio or Prompt Engineering Studio are supported.\nIf you have existing custom blocks, you will be asked to confirm before they are replaced."}
                  style={{ background: "transparent", border: `1px solid ${sk.border}`, borderRadius: 6, color: sk.textMuted, fontSize: 9, fontWeight: 700, cursor: "pointer", padding: "2px 7px", lineHeight: 1, letterSpacing: 2, transition: "all 0.15s", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#A78BFA"; e.currentTarget.style.borderColor = "#A78BFA"; e.currentTarget.style.background = "#A78BFA18"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = sk.textMuted; e.currentTarget.style.borderColor = sk.border; e.currentTarget.style.background = "transparent"; }}
                >
                  LOAD
                </button>
                {/* SAVE */}
                {customBlocks.length > 0 && (
                  <button
                    onClick={() => saveBlocksToFolder(customBlocks)}
                    title={"Export all custom blocks to a blocks.json file.\nThe file is saved to your browser's Downloads folder.\nUse LOAD to restore them in a future session."}
                    style={{ background: "transparent", border: `1px solid ${sk.border}`, borderRadius: 6, color: sk.textMuted, fontSize: 9, fontWeight: 700, cursor: "pointer", padding: "2px 7px", lineHeight: 1, letterSpacing: 2, transition: "all 0.15s", fontFamily: "inherit" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#A78BFA"; e.currentTarget.style.borderColor = "#A78BFA"; e.currentTarget.style.background = "#A78BFA18"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = sk.textMuted; e.currentTarget.style.borderColor = sk.border; e.currentTarget.style.background = "transparent"; }}
                  >
                    SAVE
                  </button>
                )}
              </div>
            </div>
            {blocksLoadError && (
              <div style={{
                margin: "0 4px 8px",
                padding: "7px 10px",
                background: "#EF444418",
                border: "1px solid #EF444455",
                borderRadius: 7,
                fontSize: 10,
                color: "#EF4444",
                lineHeight: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
              }}>
                <span style={{ flexShrink: 0 }}>⚠</span>
                <span>{blocksLoadError}</span>
                <button
                  onClick={() => setBlocksLoadError("")}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 11, padding: 0, flexShrink: 0 }}
                >✕</button>
              </div>
            )}
            {!customFolded && customBlocks.length === 0 ? (
              <div style={{ padding: "6px 6px 10px", fontSize: 10, color: sk.textFaint, fontStyle: "italic" }}>
                No custom blocks yet. Use +NEW or LOAD to create one.
              </div>
            ) : !customFolded ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {customBlocks.map((block) => {
                const isDragging = reorderDragId === block.id;
                const isOver    = reorderOverId  === block.id && reorderDragId !== block.id;
                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("reorderBlockId", block.id);
                      e.dataTransfer.setData("blockId", block.id);
                      e.dataTransfer.effectAllowed = "copyMove";
                      setReorderDragId(block.id);
                      setActiveBlockId(block.id);
                      const ghost = document.createElement("div");
                      ghost.textContent = `${block.emoji} ${block.label}`;
                      ghost.style.cssText = `
                        position:fixed;top:-200px;left:-200px;
                        background:${block.color};color:#fff;padding:6px 12px;
                        border-radius:8px;font:700 12px/1 'IBM Plex Mono',monospace;
                        white-space:nowrap;pointer-events:none;opacity:0.9;
                      `;
                      document.body.appendChild(ghost);
                      e.dataTransfer.setDragImage(ghost, 60, 18);
                      setTimeout(() => document.body.removeChild(ghost), 0);
                    }}
                    onDragEnd={() => {
                      setReorderDragId(null);
                      setReorderOverId(null);
                      setActiveBlockId(null);
                    }}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes("reorderblockid")) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setReorderOverId(block.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (reorderOverId === block.id) setReorderOverId(null);
                    }}
                    onDrop={(e) => {
                      const dragId = e.dataTransfer.getData("reorderBlockId");
                      if (dragId) {
                        e.preventDefault();
                        e.stopPropagation();
                        reorderCustomBlocks(dragId, block.id);
                      }
                      setReorderOverId(null);
                    }}
                    style={{
                      position: "relative",
                      opacity: isDragging ? 0.35 : 1,
                      transform: isOver ? "translateY(2px)" : "none",
                      transition: "opacity 0.15s, transform 0.1s",
                      borderRadius: 10,
                      boxShadow: isOver
                        ? `0 -2px 0 0 ${block.color}, inset 0 0 0 1.5px ${block.color}55`
                        : "none",
                      cursor: "grab",
                    }}
                  >
                    <BlockCard block={block} onDragStart={setActiveBlockId} />
                    {/* Edit button */}
                    <button
                      onClick={() => {
                        setEditingBlockId(block.id);
                        setNbLabel(block.label);
                        setNbEmoji(block.emoji || "✨");
                        setNbColor(block.color || "#7C3AED");
                        setNbText(block.text);
                        setShowNewBlockModal(true);
                      }}
                      title="Edit block"
                      style={{
                        position: "absolute", top: 6, right: 28,
                        background: "transparent", border: "none",
                        color: sk.textFaint, fontSize: 11,
                        cursor: "pointer", padding: "1px 4px",
                        lineHeight: 1, borderRadius: 4,
                        transition: "all 0.15s",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#A78BFA"; e.currentTarget.style.background = "#A78BFA18"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = sk.textFaint; e.currentTarget.style.background = "transparent"; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M7.5 1.5L9.5 3.5L3.5 9.5L1 10L1.5 7.5L7.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => deleteCustomBlock(block.id)}
                      title="Remove block"
                      style={{
                        position: "absolute", top: 6, right: 6,
                        background: "transparent", border: "none",
                        color: sk.textFaint, fontSize: 11,
                        cursor: "pointer", padding: "1px 4px",
                        lineHeight: 1, borderRadius: 4,
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "#EF444418"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = sk.textFaint; e.currentTarget.style.background = "transparent"; }}
                    >✕</button>
                  </div>
                );
              })}
              </div>
            ) : null}

            {/* ── The layers, from one model call up to a holding of organisations ── */}
            {LAYERS.map((layer, i) => {
              const open = !!openLayers[layer.id];
              return (
                <div key={layer.id}>
                  <div style={{ height: 1, background: sk.border, margin: "8px 4px 10px" }} />
                  <div
                    onClick={() => setOpenLayers((o) => ({ ...o, [layer.id]: !o[layer.id] }))}
                    style={{ fontSize: 9, fontWeight: 700, color: sk.textDim, letterSpacing: 1.5, padding: "0 4px 6px", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <span style={{ color: layer.color }}>{i + 1}</span>
                    {layer.label.toUpperCase()}
                    <span style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", fontSize: 8, lineHeight: 1 }}>▶</span>
                    <span style={{ marginLeft: "auto", fontWeight: 400, letterSpacing: 0.3 }}>{layer.unit}</span>
                  </div>
                  {open && layer.groups.map((group) => (
                    <div key={group.id}>
                      {group.label && (
                        <div style={{ fontSize: 9, color: sk.textDim, letterSpacing: 1, padding: "4px 4px 4px" }}>
                          {group.label.toUpperCase()}
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 4, marginBottom: 4 }}>
                        {group.blocks.map((block) => (
                          <BlockCard
                            key={block.id}
                            block={block}
                            onDragStart={setActiveBlockId}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Hallucination Risk Badge — left corner of sidebar bottom */}
          {(() => {
            const hasGrounding   = promptText.includes((BLOCKS.find((x) => x.id === "grounding")   || {}).text?.slice(0, 12) || "\x00");
            const hasConstraints = promptText.includes((BLOCKS.find((x) => x.id === "constraints") || {}).text?.slice(0, 12) || "\x00");
            const hasUncertainty = promptText.includes((BLOCKS.find((x) => x.id === "uncertainty") || {}).text?.slice(0, 12) || "\x00");
            const riskFactors = [
              !hasGrounding   && "Grounding",
              !hasConstraints && "Constraints",
              !hasUncertainty && "Uncertainty",
            ].filter(Boolean);
            const riskLevel =
              riskFactors.length === 0 ? "LOW" :
              riskFactors.length === 1 ? "MEDIUM" :
              riskFactors.length === 2 ? "HIGH" : "VERY HIGH";
            const riskColor =
              riskFactors.length === 0 ? "#10B981" :
              riskFactors.length === 1 ? "#F59E0B" :
              riskFactors.length === 2 ? "#F97316" : "#EF4444";
            const tooltipText = riskFactors.length === 0
              ? "Hallucination Risk: LOW  →  Good job! Grounding, Constraints & Uncertainty are set."
              : `Hallucination Risk: ${riskLevel}  →  Add ${riskFactors.join(" & ")} to reduce`;
            return (
              <div style={{ padding: "10px 14px", borderTop: `1px solid ${sk.border}`, display: "flex", alignItems: "center", gap: 7, flexShrink: 0, background: sk.sidebarBg }}>
                <span
                  style={{ fontSize: 15, cursor: "default", userSelect: "none", filter: `drop-shadow(0 0 4px ${riskColor})`, transition: "filter 0.3s" }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const tip = document.getElementById("halluc-risk-tooltip");
                    if (tip) { tip.style.top = (rect.top - 6) + "px"; tip.style.left = rect.right + 8 + "px"; tip.style.transform = "translateY(-100%)"; tip.style.borderColor = riskColor; tip.innerText = tooltipText; tip.style.display = "block"; }
                  }}
                  onMouseLeave={() => { const tip = document.getElementById("halluc-risk-tooltip"); if (tip) tip.style.display = "none"; }}
                >
                  {riskFactors.length === 0 ? "✅" : "⚠️"}
                </span>
                <span
                  style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, color: riskColor, border: `1px solid ${riskColor}66`, borderRadius: 4, padding: "1px 5px", background: riskColor + "18", transition: "all 0.3s", cursor: "default", userSelect: "none" }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const tip = document.getElementById("halluc-risk-tooltip");
                    if (tip) { tip.style.top = (rect.top - 6) + "px"; tip.style.left = rect.right + 8 + "px"; tip.style.transform = "translateY(-100%)"; tip.style.borderColor = riskColor; tip.innerText = tooltipText; tip.style.display = "block"; }
                  }}
                  onMouseLeave={() => { const tip = document.getElementById("halluc-risk-tooltip"); if (tip) tip.style.display = "none"; }}
                >
                  RISK: {riskLevel}
                </span>
                {/* ⓘ info icon — reuses the halluc-risk tooltip */}
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 15, height: 15, borderRadius: "50%",
                    border: `1px solid ${sk.textDim}`, color: sk.textDim,
                    fontSize: 9, fontWeight: 700, cursor: "default",
                    userSelect: "none", flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const tip = document.getElementById("halluc-risk-tooltip");
                    if (tip) { tip.style.top = (rect.top - 6) + "px"; tip.style.left = rect.right + 8 + "px"; tip.style.transform = "translateY(-100%)"; tip.style.borderColor = riskColor; tip.innerText = tooltipText; tip.style.display = "block"; }
                  }}
                  onMouseLeave={() => { const tip = document.getElementById("halluc-risk-tooltip"); if (tip) tip.style.display = "none"; }}
                >
                  i
                </span>
              </div>
            );
          })()}
        </aside>

        {/* ── CENTER: Arrow / visual bridge ── */}
        <div
          style={{
            width: 48,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: sk.cardBg,
            borderRight: `1px solid ${sk.border}`,
            gap: 6,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                fontSize: 14,
                color: activeBlock
                  ? activeBlock.color
                  : sk.border,
                transition: "color 0.3s ease",
                transform: `translateX(${activeBlock ? 2 : 0}px)`,
                transitionDelay: `${i * 60}ms`,
                animation: activeBlock ? `fadeSlideIn 0.3s ease ${i * 80}ms both` : "none",
              }}
            >
              ▶
            </div>
          ))}
        </div>

        {/* ── RIGHT: Prompt Drop Zone ── */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Drop zone header */}
          <div
            style={{
              padding: "14px 24px 10px",
              borderBottom: `1px solid ${sk.border}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: sk.panelBg,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isDragOver ? "#10B981" : sk.border2,
                transition: "background 0.2s",
                boxShadow: isDragOver ? "0 0 8px #10B981" : "none",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.5,
                color: isDragOver ? "#10B981" : sk.textDim,
                transition: "color 0.2s",
              }}
            >
              {isDragOver
                ? `DROP TO INSERT "${activeBlock?.label?.toUpperCase() || "BLOCK"}"`
                : "EDITOR · DROP ZONE"}
            </span>

            {/* ── Undo button ── */}
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title={`Undo (Ctrl+Z) · ${undoStack.length} step${undoStack.length !== 1 ? "s" : ""} available`}
              style={{
                marginLeft: "auto",
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: `1.5px solid ${undoStack.length > 0 ? sk.textMuted : sk.border}`,
                background: undoStack.length > 0 ? "#10151C" : "transparent",
                cursor: undoStack.length > 0 ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.2s ease",
                boxShadow: undoStack.length > 0 ? "0 0 0 0 #7C3AED00" : "none",
                padding: 0,
              }}
              onMouseEnter={(e) => {
                if (undoStack.length > 0) {
                  e.currentTarget.style.borderColor = "#7C3AED";
                  e.currentTarget.style.background = "#7C3AED22";
                  e.currentTarget.style.boxShadow = "0 0 10px #7C3AED44";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = undoStack.length > 0 ? sk.textMuted : sk.border;
                e.currentTarget.style.background = undoStack.length > 0 ? "#10151C" : "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Rounded arrow SVG (counter-clockwise arc with arrowhead) */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{
                  animation: undoBounce ? "undoBounce 0.35s ease" : "none",
                  opacity: undoStack.length > 0 ? 1 : 0.2,
                  transition: "opacity 0.2s",
                }}
              >
                {/* Arc: clockwise from left side going up-right */}
                <path
                  d="M3.5 8 A4.5 4.5 0 1 1 8 12.5"
                  stroke={undoStack.length > 0 ? "#A78BFA" : sk.textMuted}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Arrowhead at the end of the arc (pointing right-down) */}
                <polyline
                  points="6,5.5 3.5,8 1,5.5"
                  stroke={undoStack.length > 0 ? "#A78BFA" : sk.textMuted}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </button>

            {/* Undo step counter badge */}
            {undoStack.length > 0 && (
              <div
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  color: sk.textMuted,
                  letterSpacing: 0.5,
                  minWidth: 12,
                }}
              >
                {undoStack.length}
              </div>
            )}

            {/* ── Redo button ── */}
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title={`Redo (Ctrl+Y) · ${redoStack.length} step${redoStack.length !== 1 ? "s" : ""} available`}
              style={{
                marginLeft: 10,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: `1.5px solid ${redoStack.length > 0 ? sk.textMuted : sk.border}`,
                background: redoStack.length > 0 ? "#10151C" : "transparent",
                cursor: redoStack.length > 0 ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.2s ease",
                padding: 0,
              }}
              onMouseEnter={(e) => {
                if (redoStack.length > 0) {
                  e.currentTarget.style.borderColor = "#10B981";
                  e.currentTarget.style.background = "#10B98122";
                  e.currentTarget.style.boxShadow = "0 0 10px #10B98144";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = redoStack.length > 0 ? sk.textMuted : sk.border;
                e.currentTarget.style.background = redoStack.length > 0 ? "#10151C" : "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Mirror of undo arrow — counter-clockwise arc, arrowhead on right */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{
                  animation: redoBounce ? "undoBounce 0.35s ease" : "none",
                  opacity: redoStack.length > 0 ? 1 : 0.2,
                  transition: "opacity 0.2s",
                  transform: "scaleX(-1)", // mirror the undo arrow
                }}
              >
                <path
                  d="M3.5 8 A4.5 4.5 0 1 1 8 12.5"
                  stroke={redoStack.length > 0 ? "#34D399" : sk.textMuted}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  fill="none"
                />
                <polyline
                  points="6,5.5 3.5,8 1,5.5"
                  stroke={redoStack.length > 0 ? "#34D399" : sk.textMuted}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </button>

            {/* Redo step counter badge */}
            {redoStack.length > 0 && (
              <div
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  color: sk.textMuted,
                  letterSpacing: 0.5,
                  minWidth: 12,
                }}
              >
                {redoStack.length}
              </div>
            )}
          </div>

          {/* Textarea drop zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={isDragOver ? "drop-zone-active" : ""}
            style={{
              flex: 1,
              position: "relative",
              transition: "all 0.15s ease",
              background: isDragOver
                ? `radial-gradient(ellipse at ${dropIndicator ? dropIndicator.x - (dropZoneRef.current?.getBoundingClientRect().left || 0) : 50}px ${dropIndicator ? dropIndicator.y - (dropZoneRef.current?.getBoundingClientRect().top || 0) : 50}px, #7C3AED15 0%, transparent 60%)`
                : sk.cardBg,
            }}
          >
            {/* Drop target crosshair overlay */}
            {isDragOver && dropIndicator && (
              <div
                style={{
                  position: "fixed",
                  left: dropIndicator.x - 20,
                  top: dropIndicator.y - 20,
                  width: 40,
                  height: 40,
                  pointerEvents: "none",
                  zIndex: 9999,
                }}
              >
                {/* Crosshair lines */}
                <div style={{
                  position: "absolute", left: "50%", top: 0, bottom: 0,
                  width: 1, background: activeBlock ? activeBlock.color : "#7C3AED",
                  opacity: 0.8, transform: "translateX(-50%)",
                }}/>
                <div style={{
                  position: "absolute", top: "50%", left: 0, right: 0,
                  height: 1, background: activeBlock ? activeBlock.color : "#7C3AED",
                  opacity: 0.8, transform: "translateY(-50%)",
                }}/>
                <div style={{
                  position: "absolute", left: "50%", top: "50%",
                  width: 8, height: 8, borderRadius: "50%",
                  background: activeBlock ? activeBlock.color : "#7C3AED",
                  transform: "translate(-50%,-50%)",
                  boxShadow: `0 0 12px ${activeBlock ? activeBlock.color : "#7C3AED"}`,
                }}/>
              </div>
            )}

            {/* Empty state hint */}
            {!promptText && !isDragOver && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  gap: 12,
                  zIndex: 1,
                }}
              >
                <div style={{ fontSize: 48, opacity: 0.08, lineHeight: 1 }}>✦</div>
                <div style={{ fontSize: 12, color: sk.border, letterSpacing: 1, fontWeight: 700, textAlign: "center", lineHeight: 1.8 }}>
                  DRAG BLOCKS FROM THE LEFT<br />OR START TYPING BELOW
                </div>
              </div>
            )}

            {/* ── Block-based editor ── */}
            <div
              ref={editorRef}
              onClick={(e) => {
                // Click in empty space below blocks → focus last block
                if (!e.target.closest("[data-block-id]")) {
                  const bs = blocksRef.current;
                  if (bs.length > 0) blockDivRefs.current[bs[bs.length - 1].id]?.focus();
                  setActivePlaceholder(null);
                }
              }}
              style={{
                position: "absolute",
                top: 0, right: 0, bottom: 0, left: 0,
                width: "100%",
                height: "100%",
                padding: "24px 28px 24px 20px",
                overflowY: "auto",
                overflowX: "hidden",
                boxSizing: "border-box",
                cursor: "text",
                zIndex: 2,
                animation: insertedFlash ? "blockInsert 0.6s ease" : "none",
              }}
            >
              {blocks.map((block) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  sk={sk}
                  onTextChange={updateBlockText}
                  onEnterAtEnd={handleEnterAtEnd}
                  onEnterAtStart={handleEnterAtStart}
                  onBackspaceAtStart={handleBackspaceAtStart}
                  onPlaceholderClick={handlePlaceholderClick}
                  onDismissPlaceholder={() => setActivePlaceholder(null)}
                  onFocus={(id) => { focusedBlockId.current = id; }}
                  divRef={{
                    get current() { return blockDivRefs.current[block.id]; },
                    set current(el) { blockDivRefs.current[block.id] = el; },
                  }}
                />
              ))}
            </div>

            {/* ── Floating placeholder input — appears below the clicked [PLACEHOLDER] ── */}
            {activePlaceholder && (
              <div
                style={{
                  position: "absolute",
                  left: Math.min(
                    Math.max(activePlaceholder.x, 8),
                    (dropZoneRef.current?.clientWidth || 600) - 260
                  ),
                  top: activePlaceholder.y,
                  zIndex: 9999,
                  background: sk.modalBg,
                  border: "1.5px solid #F59E0B",
                  borderRadius: 9,
                  boxShadow: "0 8px 32px #00000066, 0 0 0 1px #F59E0B22",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  minWidth: 240,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", letterSpacing: 1 }}>
                  REPLACE PLACEHOLDER
                </div>
                <div style={{ fontSize: 11, color: sk.textDim, marginTop: -3 }}>
                  {activePlaceholder.placeholder}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    ref={placeholderInputRef}
                    value={placeholderInput}
                    onChange={(e) => setPlaceholderInput(e.target.value)}
                    placeholder="Type replacement…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitPlaceholder(e.shiftKey); }
                      if (e.key === "Escape") { setActivePlaceholder(null); editorRef.current?.focus(); }
                    }}
                    style={{
                      flex: 1,
                      background: sk.inputBg,
                      border: "1px solid #F59E0B66",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: sk.text,
                      fontFamily: "'IBM Plex Mono', monospace",
                      outline: "none",
                      caretColor: "#F59E0B",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "#F59E0B"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#F59E0B66"; }}
                  />
                  <button
                    onClick={() => commitPlaceholder(false)}
                    disabled={!placeholderInput.trim()}
                    style={{
                      background: placeholderInput.trim() ? "#F59E0B" : sk.border,
                      color: placeholderInput.trim() ? "#0A0E1A" : sk.textFaint,
                      border: "none", borderRadius: 6,
                      padding: "6px 12px", fontSize: 11, fontWeight: 700,
                      cursor: placeholderInput.trim() ? "pointer" : "default",
                      fontFamily: "inherit", transition: "all 0.15s", flexShrink: 0,
                    }}
                  >
                    ↵ Replace
                  </button>
                </div>
                <div style={{ fontSize: 10, color: sk.textFaint, maxWidth: 240, lineHeight: 1.5 }}>
                  {activePlaceholder.copies > 1
                    ? `Enter replaces this one · Shift+Enter all ${activePlaceholder.copies} in the block · Esc to cancel`
                    : "Enter to replace · Esc to cancel"}
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          {(() => {
            // ── Prompt Health Score ───────────────────────────────────────────
            // Each criterion is worth a fixed number of points (total = 100).
            // We check whether the prompt text contains a given block by looking
            // for the first 12 chars of its default text — the same heuristic
            // used by the block usage dots above.
            const hasBlock = (id) => {
              const b = [...BLOCKS, ...customBlocks].find((x) => x.id === id);
              return b ? promptText.includes(b.text.slice(0, 12)) : false;
            };

            // A template counts as used when a block dropped from it is in the
            // editor. Prompt-layer and custom blocks also match on their opening
            // text, as hasBlock does, so a prompt loaded from a file is still
            // recognised. That match looks only at text with
            // no template behind it: the front matter of a skill would
            // otherwise count as a Separator. The other layers match by id
            // only, because several of their templates open with the same line.
            const matchesByText = new Set([...BLOCKS, ...customBlocks]);
            const looseText = blocks.filter((x) => !x.blockId).map((x) => x.text).join("\n");
            const isTemplateUsed = (tpl) =>
              blocks.some((x) => x.blockId === tpl.id) ||
              (matchesByText.has(tpl) && looseText.includes(tpl.text.slice(0, 12)));

            // Count unfilled [PLACEHOLDER] tokens
            const unfilledCount = promptText ? getPlaceholders(promptText).length : 0;

            // Scoring criteria — weights must sum to 100
            const criteria = [
              { id: "role",        label: "Role",        points: 20, met: hasBlock("role") },
              { id: "task",        label: "Task",        points: 20, met: hasBlock("task") },
              { id: "constraints", label: "Constraints", points: 15, met: hasBlock("constraints") },
              { id: "grounding",   label: "Grounding",   points: 15, met: hasBlock("grounding") },
              { id: "uncertainty", label: "Uncertainty", points: 10, met: hasBlock("uncertainty") },
              { id: "format",      label: "Output Format", points: 10, met: hasBlock("format") },
              // Placeholders filled: full 10pts if none remain, partial otherwise
              {
                id: "placeholders",
                label: "Placeholders filled",
                points: 10,
                met: promptText.length > 0 && unfilledCount === 0,
                partial: promptText.length > 0 && unfilledCount > 0
                  ? Math.max(0, 10 - unfilledCount * 2)  // lose 2pts per unfilled token
                  : null,
              },
            ];

            const score = promptText
              ? criteria.reduce((sum, c) => {
                  if (c.met) return sum + c.points;
                  if (c.partial != null) return sum + c.partial;
                  return sum;
                }, 0)
              : 0;

            // Letter grade
            const grade =
              score >= 93 ? "A+" :
              score >= 90 ? "A"  :
              score >= 87 ? "A-" :
              score >= 83 ? "B+" :
              score >= 80 ? "B"  :
              score >= 77 ? "B-" :
              score >= 73 ? "C+" :
              score >= 70 ? "C"  :
              score >= 67 ? "C-" :
              score >= 60 ? "D"  : "F";

            // Bar colour: green → yellow → red
            const barColor =
              score >= 80 ? "#10B981" :
              score >= 60 ? "#F59E0B" :
              score >= 40 ? "#F97316" : "#EF4444";

            const missing = criteria.filter((c) => !c.met && c.partial == null);

            // Total filled bar segments out of 10
            const filledSegs = Math.round(score / 10);

            return (
              <div
                style={{
                  borderTop: `1px solid ${sk.border}`,
                  padding: "8px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  background: sk.panelBg,
                  flexShrink: 0,
                }}
              >
                {/* Row 1: Placeholder progress bar + block usage dots */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

                  {/* ── Placeholder Completion Progress Bar ── */}
                  {promptText && (() => {
                    // All [PLACEHOLDER] tokens in the original default block texts —
                    // we compare total ever-possible vs currently remaining unfilled.
                    // "Total" = unique placeholders across ALL blocks ever inserted.
                    // Simpler heuristic: count how many placeholders existed before
                    // any filling = unfilled + already-filled tokens no longer present.
                    // Since filled tokens are replaced with plain text we can't count
                    // them directly, so we track: total = max(unfilled, last known total).
                    // Best practical approach: total placeholders = unfilled now +
                    // (initial total − unfilled).  We derive initial total from a
                    // stable reference: scan the BLOCKS default texts for all [P] tokens
                    // that appear in the current prompt text context.
                    // Simplest correct approach for UX: total = unfilled + filled count.
                    // "Filled" = placeholders the user has already replaced =
                    // we count words that WERE placeholders by tracking a running max.
                    // → Use a ref-free approach: total segments = unfilledCount + filledCount
                    //   where filledCount is stored in a separate state that resets when
                    //   prompt is cleared. Since we can't add state here, we use:
                    //   total = the highest placeholder count ever seen (approximated
                    //   by reading all default block texts that appear in the prompt).
                    const allBlockTexts = [...ALL_BLOCKS, ...customBlocks];
                    // Count how many [PLACEHOLDER] tokens exist across all blocks
                    // whose content is currently present in the prompt
                    let totalInBlocks = 0;
                    allBlockTexts.forEach((b) => {
                      if (isTemplateUsed(b)) {
                        const re = new RegExp(PLACEHOLDER_RE.source, "g");
                        let m;
                        while ((m = re.exec(b.text)) !== null) totalInBlocks++;
                      }
                    });
                    // Total = max of block-derived count and current unfilled count
                    // (user may have typed extra placeholders manually)
                    const total = Math.max(totalInBlocks, unfilledCount);
                    const filled = total - unfilledCount;
                    const segments = Math.max(total, 1);
                    const barColor = unfilledCount === 0 ? "#10B981" : "#F59E0B";

                    // Navigate to the next unfilled placeholder on click
                    const navigateToNext = () => {
                      const all = getPlaceholders(promptText);
                      if (!all.length) return;
                      const nextIdx = placeholderNavIdx % all.length;
                      setPlaceholderNavIdx(nextIdx + 1);
                      // Find the ph-chip span in the editor DOM and simulate a click
                      const chips = dropZoneRef.current?.querySelectorAll(".ph-chip");
                      if (chips && chips[nextIdx]) {
                        chips[nextIdx].scrollIntoView({ block: "nearest", behavior: "smooth" });
                        chips[nextIdx].click();
                      }
                    };

                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        {/* Label */}
                        <span style={{ fontSize: 10, fontWeight: 700, color: sk.textMuted, letterSpacing: 1, flexShrink: 0 }}>
                          PLACEHOLDERS
                        </span>

                        {/* Segmented bar — one segment per total placeholder */}
                        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                          {Array.from({ length: Math.min(segments, 10) }).map((_, i) => (
                            <div
                              key={i}
                              style={{
                                width: 14, height: 8, borderRadius: 2,
                                background: i < Math.min(filled, 10) ? barColor : sk.border,
                                transition: "background 0.3s ease",
                                boxShadow: i < Math.min(filled, 10) ? `0 0 4px ${barColor}88` : "none",
                              }}
                            />
                          ))}
                        </div>

                        {/* Counter — clickable to cycle through unfilled ones */}
                        <span
                          onClick={unfilledCount > 0 ? navigateToNext : undefined}
                          title={unfilledCount > 0 ? "Click to jump to next unfilled placeholder" : "All placeholders filled"}
                          style={{
                            fontSize: 10, fontWeight: 700,
                            color: unfilledCount === 0 ? "#10B981" : "#F59E0B",
                            cursor: unfilledCount > 0 ? "pointer" : "default",
                            flexShrink: 0,
                            userSelect: "none",
                            textDecoration: unfilledCount > 0 ? "underline dotted" : "none",
                          }}
                        >
                          [{filled} / {total} filled]
                        </span>
                      </div>
                    );
                  })()}

                  {/* Block usage dots */}
                  <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                    {ALL_BLOCKS.filter(isTemplateUsed).map((b) => (
                      <div
                        key={b.id}
                        title={b.label}
                        style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: b.color, boxShadow: `0 0 6px ${b.color}`,
                        }}
                      />
                    ))}
                  </div>

                  {promptText && (
                    <div style={{ fontSize: 10, color: sk.textDim, fontWeight: 700, letterSpacing: 0.5 }}>
                      {ALL_BLOCKS.filter(isTemplateUsed).length} BLOCKS USED
                    </div>
                  )}
                </div>

                {/* Row 2: Prompt Health Score bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Label */}
                  <span style={{ fontSize: 10, fontWeight: 700, color: sk.textMuted, letterSpacing: 1, flexShrink: 0 }}>
                    PROMPT QUALITY
                  </span>

                  {/* Segmented bar — 10 segments */}
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: 14, height: 8, borderRadius: 2,
                          background: i < filledSegs ? barColor : sk.border,
                          transition: "background 0.3s ease",
                          boxShadow: i < filledSegs ? `0 0 4px ${barColor}88` : "none",
                        }}
                      />
                    ))}
                  </div>

                  {/* Percentage */}
                  <span style={{ fontSize: 11, fontWeight: 700, color: barColor, flexShrink: 0, minWidth: 32 }}>
                    {promptText ? `${score}%` : "—"}
                  </span>

                  {/* Letter grade */}
                  {promptText && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: sk.panelBg, background: barColor,
                      borderRadius: 4, padding: "1px 5px", flexShrink: 0,
                    }}>
                      {grade}
                    </span>
                  )}

                  {/* Missing criteria */}
                  {promptText && missing.length > 0 && (
                    <span style={{ fontSize: 10, color: sk.textFaint, marginLeft: 4 }}>
                      Missing: {missing.map((c) => c.label).join(" · ")}
                    </span>
                  )}

                  {promptText && missing.length === 0 && (
                    <span style={{ fontSize: 10, color: "#10B981", marginLeft: 4 }}>
                      ✓ All criteria met
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </main>
      </div>
    </div>
  );
}
