import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runRelayConformanceSuite } from "@roster-lock/relay-conformance";
import { createCloudflareHarness } from "./harness";

runRelayConformanceSuite(createCloudflareHarness(), { describe, it, expect, beforeAll, afterAll });
