#!/bin/bash

# AgentBazaar Test Runner
# Workaround for cargo-build-sbf issues on Apple Silicon

set -e

echo "🧪 AgentBazaar Test Runner"
echo "========================="

# Check if program exists
if [ ! -f "target/deploy/agent_bazaar.so" ]; then
    echo "❌ Program not found. Please build first with: anchor build"
    exit 1
fi

# Start test validator with program pre-loaded
echo "🚀 Starting test validator..."
solana-test-validator --reset --quiet \
  --bpf-program 4sNnsVkYeYHGZiM7YjTtisSyBMQnGiecUdjwx2c9wcAb target/deploy/agent_bazaar.so &
VALIDATOR_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up..."
    kill $VALIDATOR_PID 2>/dev/null || true
    wait $VALIDATOR_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for validator to start
sleep 8
echo "✅ Validator started with program pre-loaded"

# Run tests
echo "🧪 Running tests..."
ANCHOR_PROVIDER_URL=http://localhost:8899 ANCHOR_WALLET=~/.config/solana/id.json npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts

echo "✅ Test run completed"