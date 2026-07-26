import overview from "./docs/overview.md";
import humanInfo from "./docs/human-info.md";

export type AssistantDoc = {
  id: string,
  title: string,
  content: string,
};

// Kept as full text rather than folded into the system prompt so small local
// models aren't fed everything on every turn - the assistant fetches a doc
// by id via the read_doc tool only when it decides it's relevant.
export const ASSISTANT_DOCS: Array<AssistantDoc> = [
  { id: "overview", title: "App overview, data model, and page map", content: overview },
  { id: "human-info", title: "humanInfo fields and the piece-meta.json convention", content: humanInfo },
];

export function findAssistantDoc(id: string): AssistantDoc | undefined {
  return ASSISTANT_DOCS.find(doc => doc.id === id);
}
