
// Can select pieces as a part of the config
// This is useful if players just want to play a specific stage without the chance of another being chosen
// Final Destination Fox only

import { SelectedPiece } from "../../../request/shared";

// When selecting personal pieces, the array will be applied to all players
export type SelectionPreselectedConfig = {
  type: "preselected",
  pieces: Array<SelectedPiece>
};
