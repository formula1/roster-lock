import type { OllamaTool } from "../types";
import { ASSISTANT_PAGES, findAssistantPage } from "../pages";

export const LIST_PAGES_TOOL: OllamaTool<{}> = {
  name: "list_pages",
  description: "List the app's pages (id, title, description) you can send the user to with navigate.",
  progressPendingMessage: "Looking at available pages…",
  parameters: { type: "object", properties: {}, required: [] },
  async run(){
    return ASSISTANT_PAGES.map(page => ({ id: page.id, title: page.title, description: page.description, params: page.params }));
  }
};

export const NAVIGATE_TOOL: OllamaTool<{ pageId: string, params?: Record<string, string>, reason: string }> = {
  name: "navigate",
  description: "Send the user's app to a specific page so they can complete a task there themselves. Use list_pages first if you're not sure of the page id.",
  progressPendingMessage: "Navigating…",
  parameters: {
    type: "object",
    properties: {
      pageId: { type: "string", enum: ASSISTANT_PAGES.map(page => page.id) },
      params: {
        type: "object",
        nullable: true,
        description: "Only needed for pages whose description says they need a param, e.g. { \"pieceType\": \"character\" } for selection-piece.",
        additionalProperties: { type: "string" },
        required: [],
      },
      reason: { type: "string", description: "One short sentence explaining why, shown to the user." },
    },
    required: ["pageId", "reason"],
  },
  async run(args, globals){
    const { pageId, params, reason } = args;
    const page = findAssistantPage(pageId);
    if (!page) return { error: `Unknown pageId "${pageId}"` };
    try {
      globals.navigate(page, params, reason);
      return { navigated: true, pageId };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
};
