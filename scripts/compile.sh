#!/bin/bash

SCRIPT_PATH=$(dirname "$0")
cd "$SCRIPT_PATH/.."
echo "Compiling Match Lock..."

packages=(
  "types"
  "shared"
  "node-services"
  "config-editor"
  "relay-server"
  "match-agent"
)

set -e
for package in "${packages[@]}"; do
  echo "=================================================="
  echo ":: Installing $package"
  echo "=================================================="
  cd "core/$package" && npm install && cd ../..
done
