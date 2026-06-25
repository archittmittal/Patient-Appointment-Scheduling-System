# Load Testing — Patient Appointment Scheduling System

Performance and concurrency testing scripts for the backend API using [K6](https://k6.io).

---

## Prerequisites

### Install K6

**macOS (Homebrew)**
```bash
brew install k6
```

**Linux**
```bash
sudo apt-get install -y gnupg software-properties-common
curl -s https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**Verify**
```bash
k6 version
```

---

## Configuration

Set the target base URL via environment variable (defaults to `http://localhost:7860`):

```bash
export BASE_URL=http://localhost:7860
```

The dry-run scripts use a seeded test patient account. Ensure the backend seed has been run:
```bash
cd backend && npm run db:seed
```

Default test credentials (matching seed data):
| Variable | Default |
|---|---|
| `TEST_EMAIL` | `patient@test.com` |
| `TEST_PASSWORD` | `Test@1234` |
| `TEST_DOCTOR_ID` | `1` |

Override at runtime:
```bash
k6 run -e BASE_URL=http://localhost:7860 \
        -e TEST_EMAIL=patient@test.com \
        -e TEST_PASSWORD=Test@1234 \
        load-tests/k6/dry-run.js
```

---

## Scripts

| Script | VUs | Duration | Purpose |
|---|---|---|---|
| `dry-run.js` | 50 | ~90 s | Smoke test — all routes, local |
| `scenarios/01_auth_login.js` | 50 | 60 s | Auth endpoint stress |
| `scenarios/02_book_appointment.js` | 200 | 2 min | Appointment booking peak |
| `scenarios/03_opd_queue_fetch.js` | 500 | 3 min | Queue read throughput |
| `full-profile.js` | 1,000 | 5 min | Full stress — staging only |

---

## Running Tests

### Dry-run (recommended first)
```bash
# From project root:
npm run load-test:dry

# Or directly:
bash load-tests/run-dry-run.sh
```

### Individual scenario
```bash
k6 run load-tests/k6/scenarios/01_auth_login.js
k6 run load-tests/k6/scenarios/02_book_appointment.js
k6 run load-tests/k6/scenarios/03_opd_queue_fetch.js
```

### Full stress test (staging only — never run against production)
```bash
npm run load-test:full
```

---

## Interpreting Results

K6 prints a summary table after each run. Key metrics:

| Metric | What it means | Target |
|---|---|---|
| `http_req_duration p(95)` | 95th-percentile latency | < 1,000 ms |
| `http_req_failed` | Fraction of failed requests | < 1% |
| `http_reqs` | Total requests sent | — |
| `vus_max` | Peak virtual users active | — |
| `checks` | Percentage of passed assertions | 100% |

A ✓ next to a threshold means it passed; ✗ means it failed — investigate with `k6 run --http-debug`.

---

## CI Integration

The GitHub Actions `load-test` job (`.github/workflows/load-test.yml`) runs on every merge to `main`. It uses a lightweight 10-VU variant of the dry-run to act as a performance regression gate. The job:

1. Starts the backend with test environment variables.
2. Waits for the server to be healthy.
3. Runs `dry-run.js` with `--vus 10 --duration 30s`.
4. Fails the workflow if any threshold is breached.
