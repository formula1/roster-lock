import type { OllamaTool } from "../types";
import { ASSISTANT_DOCS, findAssistantDoc } from "../docs";

export const LIST_DOCS_TOOL: OllamaTool<{}> = {
  name: "list_docs",
  description: "List available reference docs about this app (id + title). Call this before read_doc if you don't already know the doc id you need.",
  progressPendingMessage: "Checking available docs…",
  parameters: { type: "object", properties: {}, required: [] },
  async run(){
    return ASSISTANT_DOCS.map(doc => ({ id: doc.id, title: doc.title }));
  }
};

export const READ_DOC_TOOL: OllamaTool<{ id: string }> = {
  name: "read_doc",
  description: "Read one reference doc's full content by id, to answer accurately instead of guessing.",
  progressPendingMessage: "Reading docs…",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", enum: ASSISTANT_DOCS.map(doc => doc.id) },
    },
    required: ["id"],
  },
  async run(args){
    const { id } = args;
    const doc = findAssistantDoc(id);
    if (!doc) return { error: `Unknown doc id "${id}"` };
    return { id: doc.id, title: doc.title, content: doc.content };
  }
};
