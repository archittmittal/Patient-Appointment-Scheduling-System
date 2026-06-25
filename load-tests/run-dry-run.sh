#!/usr/bin/env bash
# ============================================================
# load-tests/run-dry-run.sh
# Runs the K6 50-VU dry-run smoke test.
# Installs K6 via Homebrew on macOS if not already present.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K6_SCRIPT="${SCRIPT_DIR}/k6/dry-run.js"
RESULTS_DIR="${SCRIPT_DIR}/results"

# ── Colour helpers ─────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colour

info()    { echo -e "${YELLOW}[load-test]${NC} $*"; }
success() { echo -e "${GREEN}[load-test]${NC} $*"; }
error()   { echo -e "${RED}[load-test]${NC} $*" >&2; }

# ── Ensure K6 is installed ─────────────────────────────────
if ! command -v k6 &>/dev/null; then
    info "K6 not found. Attempting install..."

    if [[ "$(uname)" == "Darwin" ]]; then
        if command -v brew &>/dev/null; then
            brew install k6
        else
            error "Homebrew not found. Install K6 manually: https://k6.io/docs/get-started/installation/"
            exit 1
        fi
    elif [[ -f /etc/debian_version ]]; then
        sudo apt-get install -y gnupg software-properties-common
        curl -s https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
            | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update && sudo apt-get install -y k6
    else
        error "Unsupported OS. Install K6 manually: https://k6.io/docs/get-started/installation/"
        exit 1
    fi
fi

K6_VERSION=$(k6 version | head -1)
info "Using: ${K6_VERSION}"

# ── Check backend is reachable ─────────────────────────────
BASE_URL="${BASE_URL:-http://localhost:7860}"
info "Target: ${BASE_URL}"

if ! curl -sf --max-time 5 "${BASE_URL}/" > /dev/null 2>&1; then
    error "Backend not reachable at ${BASE_URL}."
    error "Start the backend with: cd backend && npm run dev"
    error "Then re-run this script."
    exit 1
fi

success "Backend is reachable ✓"

# ── Ensure results dir exists ──────────────────────────────
mkdir -p "${RESULTS_DIR}"

# ── Run dry-run ────────────────────────────────────────────
info "Starting 50-VU dry-run (~90 seconds)..."
echo ""

k6 run \
    -e BASE_URL="${BASE_URL}" \
    -e TEST_EMAIL="${TEST_EMAIL:-patient@test.com}" \
    -e TEST_PASSWORD="${TEST_PASSWORD:-Test@1234}" \
    -e TEST_DOCTOR_ID="${TEST_DOCTOR_ID:-1}" \
    "${K6_SCRIPT}"

EXIT_CODE=$?

echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
    success "✅  Dry-run PASSED — all thresholds met."
    success "Results: ${RESULTS_DIR}/dry-run-summary.json"
else
    error "❌  Dry-run FAILED — one or more thresholds were breached."
    error "Inspect ${RESULTS_DIR}/dry-run-summary.json for details."
    exit $EXIT_CODE
fi
