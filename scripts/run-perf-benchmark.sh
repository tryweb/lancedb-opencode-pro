#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

Usage() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --real         Use real Ollama embedding (requires LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL)"
  echo "  --quick        Quick profile (500 records, 50 queries)"
  echo "  --standard     Standard profile (2000 records, 200 queries)"
  echo "  --ollama URL    Ollama base URL (default: http://192.168.11.206:11434)"
  echo "  --model MODEL  Embedding model (default: nomic-embed-text)"
  echo "  --help         Show this help"
  echo ""
  echo "Examples:"
  echo "  $0                           # Mock mode, quick profile"
  echo "  $0 --real                    # Real Ollama mode"
  echo "  $0 --real --ollama http://localhost:11434 --model nomic-embed-text"
  exit 0
}

PROFILE="quick"
REAL=0
OLLAMA_URL="${LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL:-http://192.168.11.206:11434}"
MODEL="nomic-embed-text"

while [[ $# -gt 0 ]]; do
  case $1 in
    --real)
      REAL=1
      shift
      ;;
    --quick)
      PROFILE="quick"
      shift
      ;;
    --standard)
      PROFILE="standard"
      shift
      ;;
    --ollama)
      OLLAMA_URL="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --help|-h)
      Usage
      ;;
    *)
      echo "Unknown option: $1"
      Usage
      ;;
  esac
done

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Performance Benchmark for lancedb-opencode-pro${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo

if [ "$REAL" = "1" ]; then
  echo -e "${YELLOW}[Mode] Real Ollama Embedding${NC}"
  echo -e "  URL:   $OLLAMA_URL"
  echo -e "  Model: $MODEL"
else
  echo -e "${YELLOW}[Mode] Mock Embedding (fast)${NC}"
fi
echo -e "  Profile: $PROFILE"
echo

echo -e "${YELLOW}[1/3] Building project...${NC}"
/home/devuser/.bun/bin/bun run build:test 2>&1 | tail -3
echo -e "${GREEN}✓ Build complete${NC}"

echo
echo -e "${YELLOW}[2/3] Running performance benchmark...${NC}"
if [ "$REAL" = "1" ]; then
  RESULT=$(LANCEDB_OPENCODE_PRO_BENCHMARK_REAL=1 \
    LANCEDB_OPENCODE_PRO_OLLAMA_BASE_URL="$OLLAMA_URL" \
    LANCEDB_OPENCODE_PRO_EMBEDDING_MODEL="$MODEL" \
    /home/devuser/.bun/bin/bun run benchmark:perf 2>&1)
else
  RESULT=$(LANCEDB_OPENCODE_PRO_BENCHMARK_REAL=0 /home/devuser/.bun/bin/bun run benchmark:perf 2>&1)
fi

echo "$RESULT"

if echo "$RESULT" | grep -q "All hard gates passed"; then
  echo
  echo -e "${YELLOW}[3/3] Results Summary${NC}"

  SEARCH_P50=$(echo "$RESULT" | grep -o '"searchP50": [^,]*' | head -1 | cut -d: -f2)
  SEARCH_P99=$(echo "$RESULT" | grep -o '"searchP99": [^,]*' | head -1 | cut -d: -f2)
  INSERT_AVG=$(echo "$RESULT" | grep -o '"insertAvg": [^,]*' | head -1 | cut -d: -f2)
  RECALL=$(echo "$RESULT" | grep -o '"recallAt10": [^,]*' | head -1 | cut -d: -f2)

  echo -e "  ${GREEN}search.p50:${NC} ${SEARCH_P50}ms"
  echo -e "  ${GREEN}search.p99:${NC} ${SEARCH_P99}ms"
  echo -e "  ${GREEN}insert.avg:${NC} ${INSERT_AVG}ms"
  echo -e "  ${GREEN}recall@10:${NC} ${RECALL}"

  echo
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ Performance benchmark PASSED${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  exit 0
else
  echo
  echo -e "${RED}═══════════════════════════════════════════${NC}"
  echo -e "${RED}  ❌ Performance benchmark FAILED${NC}"
  echo -e "${RED}═══════════════════════════════════════════${NC}"
  exit 1
fi