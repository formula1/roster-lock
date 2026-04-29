import { Command } from "commander";


const addPiece = new Command("add-piece")
  .description("Add a piece to the config")
  .argument("<config>", "The config to add the piece to")
  .argument("<pieceType>", "The type of piece to add")
  .argument("<pieceFolder>", "The folder containing the piece")
  .action(async (pieceType, pieceFolder) => {
    
  });
