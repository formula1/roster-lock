import { UserInput, SelectedPiece } from "@roster-lock/types";
import { z, ZodType } from "zod";

const SelectedPieceSchema: ZodType<SelectedPiece> = z.lazy(() =>
  z.object({
    id: z.string(),
    required: z.record(z.string(), z.object({
      mandatory: z.array(SelectedPieceSchema),
      selectable: z.array(SelectedPieceSchema),
    })),
  }).strict()
);

export const UserSelectionSchema: z.ZodType<UserInput["userSelection"]> = z.record(z.string(), z.array(SelectedPieceSchema));
