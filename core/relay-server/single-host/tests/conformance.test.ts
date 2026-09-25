import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runRelayConformanceSuite } from "@roster-lock/relay-conformance";
import { createSingleHostHarness } from "./harness";

runRelayConformanceSuite(createSingleHostHarness(), { describe, it, expect, beforeAll, afterAll });
