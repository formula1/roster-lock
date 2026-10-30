import { JSONSchemaType } from "ajv";
import { IkemenGameConfig, SUPPORTED_TEAM_MODES } from "./teamMode";

// Split out of index.ts so selectionValidation.ts's validateGameConfig can compile and run this
// same schema (ajv) rather than a second, hand-maintained description of the same shape. Imports
// from ./teamMode rather than ./selectionValidation specifically to avoid a cycle:
// selectionValidation.ts itself imports this schema object.
export const gameConfigSchema: JSONSchemaType<IkemenGameConfig> = {
  type: "object",
  title: "Ikemen GO Match Settings",
  description: "Room-shared settings every participant agrees to before the match starts.",
  properties: {
    teamMode: {
      type: "string",
      title: "Team Mode",
      enum: SUPPORTED_TEAM_MODES,
      default: "single",
      description: "Applies to both sides. Defaults to \"single\" for a solo character pick.",
    },
    roundTime: {
      type: "integer",
      minimum: -1,
      default: -1,
      title: "Round Time",
      description: "Round time in ticks; -1 disables the timer.",
    },
    rounds: {
      type: "integer",
      minimum: 1,
      default: 3,
      title: "Rounds",
      description: "Number of rounds before Ikemen quits.",
    },
  },
  required: ["teamMode", "roundTime", "rounds"],
};
