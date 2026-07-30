#!/bin/bash

# Function to cleanup processes
cleanup() {
    echo "🧹 Cleaning up..."
    if [ ! -z "$VITE_PID" ]; then
        kill $VITE_PID 2>/dev/null
        echo "🌐 Stopped Vite dev server"
    fi
    exit ${1:-0}
}

# Set up signal handlers
trap 'cleanup 1' INT TERM

# Clear all snap-related environment variables
for var in $(env | grep -E '^SNAP' | cut -d= -f1); do
    unset "$var"
done

# Set clean PATH without snap directories
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/sam/.cargo/bin"

# Set clean library path - be more aggressive about avoiding snap libraries
export LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu:/usr/lib:/lib"

# Clear other potentially problematic variables
unset LD_PRELOAD
unset LIBRARY_PATH
unset SNAP_DESKTOP_RUNTIME
unset SNAP_INSTANCE_NAME
unset SNAP_INSTANCE_KEY

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🚀 Starting MatchLock Prep App Development Environment"
echo "📦 Cleaned environment variables"
echo "🔧 Using PATH: $PATH"
echo "📚 Using LD_LIBRARY_PATH: $LD_LIBRARY_PATH"
echo "📁 Working directory: $SCRIPT_DIR"

# Change to script directory
cd "$SCRIPT_DIR" || exit 1

# Kill any existing processes on port 5173
echo "🧹 Cleaning up any existing processes on port 5173..."
lsof -ti:5173 | xargs -r kill -9 2>/dev/null || true
sleep 1

# Clean Vite cache
echo "🗑️  Clearing Vite cache..."
rm -rf node_modules/.vite 2>/dev/null || true

# Start Vite dev server in background
echo "🌐 Starting Vite dev server..."
npm run dev:vite &
VITE_PID=$!

# Wait for Vite to start
echo "⏳ Waiting for Vite to start..."
sleep 4

# Check if Vite is running
if ! curl -s http://localhost:5173 > /dev/null; then
    echo "❌ Vite dev server failed to start"
    cleanup 1
fi

echo "✅ Vite dev server is running at http://localhost:5173"

# Start Tauri app in dev mode (bypass beforeDevCommand)
echo "🦀 Starting Tauri app..."
cd src-tauri || cleanup 1

# Try to run Tauri with better error handling
echo "🔧 Running Tauri with clean environment..."

# First attempt: try with current environment
if TAURI_DEV_SERVER_URL="http://localhost:5173" RUST_LOG=debug cargo run 2>&1; then
    # Success - Tauri exited normally
    cleanup 0
fi

# If first attempt failed, try with GTK-compatible clean environment
echo "⚠️  First attempt failed, trying with GTK-compatible environment..."
echo "🧼 Using env -i with GTK environment variables..."

if env -i \
    HOME="$HOME" \
    USER="$USER" \
    DISPLAY="$DISPLAY" \
    WAYLAND_DISPLAY="$WAYLAND_DISPLAY" \
    XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
    XDG_SESSION_TYPE="$XDG_SESSION_TYPE" \
    XDG_CURRENT_DESKTOP="$XDG_CURRENT_DESKTOP" \
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/sam/.cargo/bin" \
    LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu" \
    TAURI_DEV_SERVER_URL="http://localhost:5173" \
    RUST_BACKTRACE=1 \
    RUST_LOG=debug \
    cargo run 2>&1; then
    # Success with GTK-compatible environment
    cleanup 0
fi

# Both attempts failed
echo "❌ Tauri failed to start with both normal and clean environments"
echo "💡 This might be due to library conflicts. Try:"
echo "   1. Restart your terminal session completely"
echo "   2. Run: sudo apt update && sudo apt upgrade"
echo "   3. Check if you have conflicting snap packages: snap list"
echo "   4. Try running from a non-snap terminal"
echo "   5. Check Rust installation: rustc --version && cargo --version"
cleanup 1
