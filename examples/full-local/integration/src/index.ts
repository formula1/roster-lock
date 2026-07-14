import { Command } from "commander";
import { runIntegration } from "./run";
import { runGame } from "./run-game";
import { setupServers } from "./setupServers";
import { requireEnv } from "./lib/env";

const program = new Command();

program
  .name("full-local")
  .description("Orchestration CLI for the full-local example");

program
  .command("run")
  .description("Full pipeline: docker compose up, match-agent, server-setup, N game-headless players, teardown")
  .argument("[numPlayers]", "number of players", "2")
  .action(async (numPlayersArg: string)=>{
    await runIntegration(Number(numPlayersArg) || 2);
  });

program
  .command("run-game")
  .description(
    "Fast-iteration: assumes docker compose services and server-setup are already up; " +
    "just builds+starts match-agent and N game-headless players"
  )
  .argument("[numPlayers]", "number of players", "2")
  .action(async (numPlayersArg: string)=>{
    await runGame(Number(numPlayersArg) || 2);
  });

program
  .command("server-setup")
  .description("Register the matchmaker + game coordinator with the relay (assumes docker services are already up)")
  .action(async ()=>{
    await setupServers({
      publicRelayServerUrl: requireEnv("PUBLIC_RELAY_SERVER_URL"),
      publicMatchmakerUrl: requireEnv("PUBLIC_MATCHMAKER_URL"),
      gameCoordinatorUrl: requireEnv("GAME_COORDINATOR_URL"),
      initialAdminUsername: requireEnv("INITIAL_ADMIN_USERNAME"),
      initialAdminPassword: requireEnv("INITIAL_ADMIN_PASSWORD"),
      gameCoordinatorId: requireEnv("GAME_COORDINATOR_ID"),
      coordinatorApiKey: requireEnv("COORDINATOR_API_KEY"),
    });
    console.log("Server setup complete: matchmaker and game coordinator registered with relay.");
  });

program.parseAsync().catch(()=>{
  process.exitCode = 1;
});
