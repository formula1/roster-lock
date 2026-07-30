import { AnySchema } from "ajv";
import type { OllamaToolCall, OllamaToolDescription, AssistantGlobals } from "../types";
import type { AssistantProgressHandler } from "../progress";
import { JSON_Unknown } from "@roster-lock/utils";
import { errorToString } from "../../../utils/error";

export type OllamaToolAny = {
  name: string,
  description: string,
  parameters: AnySchema,
  progressPendingMessage: string,
  run(args: any, globals: AssistantGlobals): Promise<JSON_Unknown>
}

export class ToolOrganizer {
  public descriptions: Array<OllamaToolDescription> = []
  runners: Record<string, (args: any, globals: AssistantGlobals)=>Promise<JSON_Unknown>> = {}
  progressMessages: Record<string, string> = {}
  addTool(tool: OllamaToolAny){
    for(const existingTool of this.descriptions){
      if(existingTool.function.name === tool.name){
        throw new Error("Duplicate function name: " + tool.name)
      }
    }
    this.descriptions.push({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    })
    this.runners[tool.name] = tool.run
    this.progressMessages[tool.name] = tool.progressPendingMessage
  }
  runTools(
    calls: Array<OllamaToolCall>, globals: AssistantGlobals, onProgress?: AssistantProgressHandler
  ): Promise<Array<{ role: "tool", tool_name: string, content: string }>>{
    return Promise.all(calls.map(async (toolCall)=>{
      onProgress?.({
        type: "tool_start",
        name: toolCall.function.name,
        message: this.progressMessages[toolCall.function.name] ?? `Running ${toolCall.function.name}…`,
        args: toolCall.function.arguments,
      });
      try {
        const runner = this.runners[toolCall.function.name]
        if(!runner) throw new Error("Missing tool " + toolCall.function.name);
        const result = await runner(toolCall.function.arguments, globals);
        onProgress?.({ type: "tool_end", name: toolCall.function.name, ok: true });
        return {
          role: "tool",
          tool_name: toolCall.function.name,
          content: JSON.stringify(result),
        };
      }catch(e){
        onProgress?.({ type: "tool_end", name: toolCall.function.name, ok: false });
        return {
          role: "tool",
          tool_name: toolCall.function.name,
          content: JSON.stringify({ error: errorToString(e) }),
        };
      }
    }))
  }
}

export const TOOL_ORGANIZER = new ToolOrganizer();
import { LIST_DOCS_TOOL, READ_DOC_TOOL } from "./docs";
TOOL_ORGANIZER.addTool(LIST_DOCS_TOOL);
TOOL_ORGANIZER.addTool(READ_DOC_TOOL);
import { LIST_PAGES_TOOL, NAVIGATE_TOOL } from "./pages";
TOOL_ORGANIZER.addTool(LIST_PAGES_TOOL);
TOOL_ORGANIZER.addTool(NAVIGATE_TOOL);
import { GET_PAGE_HTML_TOOL, HIGHLIGHT_ELEMENT_TOOL } from "./dom";
TOOL_ORGANIZER.addTool(GET_PAGE_HTML_TOOL);
TOOL_ORGANIZER.addTool(HIGHLIGHT_ELEMENT_TOOL);
import { LIST_DIRECTORY_TOOL, READ_FILE_TEXT_TOOL } from "./files";
TOOL_ORGANIZER.addTool(LIST_DIRECTORY_TOOL);
TOOL_ORGANIZER.addTool(READ_FILE_TEXT_TOOL);

