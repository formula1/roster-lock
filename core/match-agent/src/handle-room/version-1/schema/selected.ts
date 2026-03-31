import { SelectedPiece, UserInput } from "@match-lock/shared";
import { z, ZodType } from "zod";

const SelectedPieceSchema: z.ZodType<SelectedPiece> = z.lazy(() =>
  z.object({
    id: z.string(),
    required: z.record(z.string(), z.array(SelectedPieceSchema)),
  }).strict()
);

export const UserSelectionSchema: z.ZodType<UserInput["userSelection"]> = z.record(z.string(), z.array(SelectedPieceSchema));
