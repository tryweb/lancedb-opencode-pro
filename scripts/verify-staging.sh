#!/bin/bash
# Staging verification script
# Simulates real npm install of the plugin to verify correctness before release
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Staging Verification for lancedb-opencode-pro${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo

# Step 1: Build
echo -e "${YELLOW}[1/6] Building project...${NC}"
npm run build 2>&1 | tail -3
echo -e "${GREEN}✓ Build complete${NC}"

# Step 2: Pack
echo
echo -e "${YELLOW}[2/6] Packing plugin tarball...${NC}"
TARBALL=$(npm pack --quiet 2>&1)
TARBALL=$(ls *.tgz | head -1)
echo -e "${GREEN}✓ Created: $TARBALL${NC}"

# Step 3: Ensure Docker image exists
echo
echo -e "${YELLOW}[3/6] Checking Docker image...${NC}"
IMAGE_NAME="lancedb-opencode-pro-opencode-dev"
if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo -e "${YELLOW}  Image not found, building...${NC}"
    docker compose build --no-cache opencode-dev
fi
echo -e "${GREEN}✓ Docker image ready${NC}"

# Step 4: Start staging container
echo
echo -e "${YELLOW}[4/6] Starting staging container...${NC}"
# Clean up any existing staging container
docker rm -f opencode-staging 2>/dev/null || true

docker run -d \
  --name opencode-staging \
  -p 4097:4096 \
  -e OPENCODE_SERVER_PASSWORD=staging \
  -e LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  --add-host=host.docker.internal:host-gateway \
  "$IMAGE_NAME" \
  sleep infinity

# Wait for container to be ready
sleep 2
echo -e "${GREEN}✓ Staging container running${NC}"

# Step 5: Install and verify plugin
echo
echo -e "${YELLOW}[5/6] Installing plugin in staging environment...${NC}"
docker cp "$TARBALL" opencode-staging:/tmp/plugin.tgz
docker exec opencode-staging npm install -g /tmp/plugin.tgz 2>&1

echo
echo -e "${YELLOW}     Verifying plugin loads correctly...${NC}"
VERIFY_OUTPUT=$(docker exec opencode-staging node -e "
const plugin = require('/usr/lib/node_modules/lancedb-opencode-pro');
const pkg = require('/usr/lib/node_modules/lancedb-opencode-pro/package.json');
console.log('Plugin loaded: ' + pkg.name);
console.log('Version: ' + pkg.version);
console.log('Type: ' + typeof plugin);
" 2>&1)

echo "$VERIFY_OUTPUT"
echo -e "${GREEN}✓ Plugin verified in staging${NC}"

# Step 6: Cleanup
echo
echo -e "${YELLOW}[6/6] Cleaning up...${NC}"
docker stop opencode-staging >/dev/null 2>&1
docker rm opencode-staging >/dev/null 2>&1
rm -f "$TARBALL"
echo -e "${GREEN}✓ Cleanup complete${NC}"

echo
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Staging verification PASSED${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo
echo "The plugin can be installed and loaded correctly via npm."
echo "Ready for release."
