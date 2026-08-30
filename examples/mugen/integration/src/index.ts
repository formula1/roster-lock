import { Command } from "commander";
import { runIntegration } from "./run";
import { setupServers, dockerComposeUp } from "./setupServers";

const DEFAULT_BINARY_LOCATION_HINT = "~/Games/Ikemen-GO-1.0.0-rc.2/Ikemen_GO_Linux";

const program = new Command();

program
  .name("mugen-integration")
  .description("Orchestration CLI for the mugen example - drives ikemen-go end-to-end through match-agent");

program
  .command("run")
  .description(
    "Full pipeline: docker compose up, match-agent, server setup (titled-room/coordinator registration with relay), " +
    "two simulated players, and two real Ikemen GO windows"
  )
  .requiredOption(
    "--binary-location <path>",
    `path to your local Ikemen GO executable (inside a complete install - e.g. ${DEFAULT_BINARY_LOCATION_HINT})`
  )
  .action(async ({ binaryLocation }: { binaryLocation: string })=>{
    await runIntegration(binaryLocation);
  });

program
  .command("server-setup")
  .description("docker compose up, then register titled-room/direct-ip-coordinator with relay-room's admin API (assumes docker services aren't already up)")
  .action(async ()=>{
    await dockerComposeUp();
    await setupServers();
  });

program.parseAsync();
