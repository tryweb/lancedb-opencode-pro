# Tasks: Feedback-Driven Ranking

## Implementation Tasks

- [ ] **T1**: Add `feedbackWeight` to `RetrievalConfig` in `src/types.ts`
  - Location: `src/types.ts` line ~55
  - Add field: `feedbackWeight?: number;`

- [ ] **T2**: Add feedback weight configuration parsing in `src/config.ts`
  - Location: `src/config.ts` line ~17-38
  - Parse `LANCEDB_OPENCODE_PRO_FEEDBACK_WEIGHT` env var
  - Parse `retrieval.feedbackWeight` from config file
  - Default: 0.3, Range: 0.0 to 1.0

- [ ] **T3**: Add `getMemoryFeedbackStats` method in `src/store.ts`
  - Location: `src/store.ts` new method
  - Query `effectiveness_events` for feedback on specific memory
  - Return: `{ helpful: number, unhelpful: number, wrong: number, helpfulRate: number }`
  - Window: Last 30 days only

- [ ] **T4**: Calculate feedback factor in `src/store.ts` search method
  - Location: `src/store.ts` `search()` method around line 185-262
  - Add `feedbackWeight` parameter to search params
  - Calculate feedback factor per memory
  - Apply to scoring: `score *= feedbackFactor`

- [ ] **T5**: Wire feedback weight through `src/index.ts`
  - Location: `src/index.ts` around line 78-84 and 223-229
  - Pass `feedbackWeight` from config to search calls
  - Both `memory_search` tool and auto-recall

## Testing Tasks

- [ ] **T6**: Add unit tests for feedback factor calculation
  - Location: `test/unit/feedback-factor.test.ts` (new file)
  - Test helpful boost calculation
  - Test wrong penalty calculation
  - Test neutral fallback
  - Test mixed feedback

- [ ] **T7**: Add unit tests for config parsing
  - Location: `test/unit/config.test.ts` or similar
  - Test env var parsing
  - Test default value
  - Test range clamping

- [ ] **T8**: Add integration test for feedback-driven ranking
  - Location: `test/regression/plugin.test.ts`
  - Create memories with different feedback
  - Verify ranking order changes

- [ ] **T9**: Add e2e test for feedback-driven ranking
  - Location: `scripts/e2e-opencode-memory.mjs`
  - End-to-end test: create memory → give feedback → search → verify ranking

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required |
|-------------|------|------------|-----|----------|
| Feedback factor calculation | T6 | T8 | - | yes |
| Configuration options | T7 | - | - | yes |
| Feedback window bounded | T6 | T8 | - | yes |
| Graceful failure | T6 | T8 | - | yes |
| Ranking improvement | - | T8 | T9 | yes |

## Pre-Implementation Gate

Before starting T1-T5:
- [ ] Verify OpenSpec status shows change ready
- [ ] Review `src/types.ts` current RetrievalConfig structure
- [ ] Review `src/config.ts` current retrieval config parsing
- [ ] Review `src/store.ts` current search method signature

## Definition of Done

1. All tasks T1-T9 completed
2. `npm run build` passes
3. `npm run test` passes (all unit tests)
4. Docker verification passes: `docker compose build && docker compose up -d && docker compose exec opencode-dev npm run verify`
5. Feature branch pushed with all changes
