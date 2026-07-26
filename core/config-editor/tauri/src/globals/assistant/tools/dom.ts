import type { OllamaTool } from "../types";

// Kept small on purpose - a raw outerHTML dump of a React app (inline
// styles, svg paths, hashed class names) would blow a small local model's
// context. This walks the DOM and keeps only what's useful for describing
// the page or writing a CSS selector: tag name, a handful of identifying
// attributes, and direct text content.
const MAX_NODES = 600;
const MAX_TEXT_LENGTH = 200;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "NOSCRIPT"]);
const ATTR_ALLOWLIST = ["id", "class", "role", "title", "placeholder", "aria-label", "name", "type", "href", "data-testid"];

function serializeNode(el: Element, budget: { count: number }): string | null {
  if (budget.count >= MAX_NODES) return null;
  if (SKIP_TAGS.has(el.tagName)) return null;
  budget.count++;

  const tag = el.tagName.toLowerCase();
  const attrs = ATTR_ALLOWLIST
    .map(name => {
      const value = el.getAttribute(name);
      return value ? `${name}="${value}"` : null;
    })
    .filter((v): v is string => v !== null)
    .join(" ");
  const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;

  if (tag === "svg" || tag === "img") {
    return openTag.replace(/>$/, "/>");
  }

  const childParts: Array<string> = [];
  for (const child of Array.from(el.childNodes)) {
    if (budget.count >= MAX_NODES) {
      childParts.push("<!-- truncated -->");
      break;
    }
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) childParts.push(text.slice(0, MAX_TEXT_LENGTH));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const serialized = serializeNode(child as Element, budget);
      if (serialized) childParts.push(serialized);
    }
  }

  return `${openTag}${childParts.join("")}</${tag}>`;
}

export const GET_PAGE_HTML_TOOL: OllamaTool<{ selector?: string }> = {
  name: "get_page_html",
  description: "Get a simplified view of the current page (tag names, id/class/role/aria-label, and text - no styles/scripts) to answer questions about what's on screen or to find a selector for highlight_element. Optionally scope it to one container instead of the whole page.",
  progressPendingMessage: "Looking at the current page…",
  parameters: {
    type: "object",
    properties: {
      selector: {
        type: "string",
        nullable: true,
        description: "Optional CSS selector to scope the result to one container instead of document.body.",
      },
    },
    required: [],
  },
  async run({ selector }) {
    const root = selector ? document.querySelector(selector) : document.body;
    if (!root) {
      return { error: `No element matches selector "${selector}"` };
    }
    const budget = { count: 0 };
    const html = serializeNode(root, budget);
    return { html, truncated: budget.count >= MAX_NODES };
  },
};

const HIGHLIGHT_CLASS = "rosterlock-assistant-highlight";
const HIGHLIGHT_STYLE_ID = "rosterlock-assistant-highlight-style";
let clearHighlightTimeout: ReturnType<typeof setTimeout> | undefined;

function ensureHighlightStyle() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 3px solid #ff5c00 !important;
      outline-offset: 2px !important;
      animation: rosterlock-assistant-pulse 1s ease-in-out 2;
    }
    @keyframes rosterlock-assistant-pulse {
      0%, 100% { outline-color: #ff5c00; }
      50% { outline-color: #ffd54a; }
    }
  `;
  document.head.appendChild(style);
}

function clearHighlights() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => el.classList.remove(HIGHLIGHT_CLASS));
}

export const HIGHLIGHT_ELEMENT_TOOL: OllamaTool<{ selector: string }> = {
  name: "highlight_element",
  description: "Scroll to and highlight an element on the current page by CSS selector, to point the user at something concrete. Use get_page_html first to find a selector that will actually match.",
  progressPendingMessage: "Highlighting something on screen…",
  parameters: {
    type: "object",
    properties: {
      selector: { type: "string", description: "A CSS selector, e.g. \"#roster-piece-character\" or \"[data-testid=publish-button]\"." },
    },
    required: ["selector"],
  },
  async run({ selector }) {
    let matches: NodeListOf<Element>;
    try {
      matches = document.querySelectorAll(selector);
    } catch (e) {
      return { found: false, error: `Invalid CSS selector: ${e instanceof Error ? e.message : String(e)}` };
    }

    clearHighlights();
    if (clearHighlightTimeout) clearTimeout(clearHighlightTimeout);

    if (matches.length === 0) {
      return { found: false, matchCount: 0 };
    }

    ensureHighlightStyle();
    const target = matches[0];
    target.classList.add(HIGHLIGHT_CLASS);
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    clearHighlightTimeout = setTimeout(clearHighlights, 4000);

    return {
      found: true,
      matchCount: matches.length,
      tag: target.tagName.toLowerCase(),
      text: target.textContent?.trim().slice(0, 120),
    };
  },
};
