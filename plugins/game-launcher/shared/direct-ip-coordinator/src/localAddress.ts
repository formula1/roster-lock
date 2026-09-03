import { networkInterfaces } from "node:os";

// Every non-internal IPv4 address this machine's own network interfaces
// report - a machine can have more than one (wired + wifi, a VPN, a Docker
// bridge), and there's no reliable way to know upfront which one a given
// client can actually reach, so every candidate is reported and the
// coordinator/client side picks. IPv6 is skipped: Ikemen's `-ip` only ever
// gets handed one of these by buildArgs, and IPv4 is the safer default
// given the game side has no fallback if the wrong family is unreachable.
export function getLocalNetworkAddresses(): Array<string> {
  const interfaces = networkInterfaces();
  const addresses: Array<string> = [];
  for(const entries of Object.values(interfaces)){
    for(const entry of entries ?? []){
      if(entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}
