#!/bin/sh
set -e

repo="${IPFS_PATH:-/data/ipfs}"

# Initialize on first run
if [ ! -f "${repo}/config" ]; then
  ipfs init --profile=server
  ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
  ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
fi

# Clear bootstrap so the daemon starts immediately without peer connections
ipfs config --json Bootstrap '[]'

# --offline: no swarm, no DHT — API still serves local content
exec ipfs daemon --migrate=true --offline
