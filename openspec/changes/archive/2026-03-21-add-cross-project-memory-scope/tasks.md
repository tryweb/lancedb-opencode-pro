## 1. Schema and Types

- [x] 1.1 Add `scope: "project" | "global"` field to `MemoryEntry` interface in `src/types.ts`
- [x] 1.2 Add `MemoryScope` type alias for scope values
- [x] 1.3 Add `includeGlobalScope: boolean` config field (default: `true`)
- [x] 1.4 Add `global_detection_threshold: number` config field (default: `2`)
- [x] 1.5 Add `global_discount_factor: number` config field (default: `0.7`)
- [x] 1.6 Add `unused_days_threshold: number` config field (default: `30`)

## 2. Storage Layer

- [x] 2.1 Update LanceDB schema to include `scope` column (already existed)
- [x] 2.2 Modify `putMemory` to accept and store scope metadata (already supported)
- [x] 2.3 Add `getMemoriesByScope(scope: string)` method to `MemoryStore` (via `readByScopes`)
- [x] 2.4 Add `updateMemoryScope(id: string, scope: string)` method
- [x] 2.5 Implement `readGlobalMemories()` method for querying global scope
- [x] 2.6 Update `normalizeMemoryRow` to include scope field with backward-compatible default
- [ ] 2.7 Add recall usage tracking for global memories (lastRecalled, recallCount) — deferred to future

## 3. Dual-Scope Recall

- [x] 3.1 Modify `search()` to accept optional scope filters (already supported)
- [x] 3.2 Implement parallel query of project + global scopes (already supported via `scopes` array)
- [x] 3.3 Implement score merge with global discount factor
- [x] 3.4 Add `source: "global"` metadata to global results (via `record.scope`)
- [x] 3.5 Update auto-recall (system.transform) to include global scope queries (via `buildScopeFilter`)
- [x] 3.6 Respect `includeGlobalScope` config toggle (already supported)

## 4. Global Detection Heuristic

- [x] 4.1 Define `GLOBAL_KEYWORDS` constant array in `src/extract.ts`
- [x] 4.2 Implement `detectGlobalWorthiness(content: string): number` function
- [x] 4.3 Integrate detection into memory storage flow (expose via `isGlobalCandidate`)
- [ ] 4.4 Trigger promotion prompt when threshold is met — deferred (requires LLM integration)
- [x] 4.5 Store memory immediately as project-scoped while awaiting confirmation (default behavior)

## 5. Promotion and Demotion Tools

- [x] 5.1 Implement `memory_scope_promote(id: string, confirm: boolean)` tool
- [x] 5.2 Implement `memory_scope_demote(id: string, confirm: boolean)` tool
- [x] 5.3 Require confirmation flag before executing scope changes
- [x] 5.4 Return updated memory details on successful promotion/demotion

## 6. Global Memory List Tool

- [x] 6.1 Implement `memory_global_list(query?: string, filter?: string)` tool
- [x] 6.2 Support search query within global memories
- [x] 6.3 Support `filter: "unused"` to show memories not recalled in 30 days
- [ ] 6.4 Return usage statistics (lastRecalled, recallCount, projectCount) — deferred

## 7. Unused Global Detection

- [x] 7.1 Implement background task to analyze global memory usage (via `getUnusedGlobalMemories`)
- [x] 7.2 Identify global memories not recalled within `unused_days_threshold`
- [ ] 7.3 Present demotion prompt when unused memories are detected — deferred (requires LLM integration)
- [ ] 7.4 Support batch demotion options — deferred

## 8. Configuration Integration

- [x] 8.1 Update `src/config.ts` to parse new config fields
- [x] 8.2 Add environment variable support for all new config fields
- [ ] 8.3 Update `src/ports.ts` TypeScript interfaces — not needed
- [ ] 8.4 Update README documentation with new config options

## 9. Testing

- [ ] 9.1 Add foundation tests for scope field storage and retrieval
- [ ] 9.2 Add regression tests for dual-scope recall with score discount
- [ ] 9.3 Add tests for global detection heuristic accuracy
- [ ] 9.4 Add tests for promotion/demotion tools
- [ ] 9.5 Add tests for global list tool with filtering
- [ ] 9.6 Run full test suite and verify all tests pass

## 10. Documentation

- [ ] 10.1 Update README with cross-project memory feature documentation
- [ ] 10.2 Document new config options
- [ ] 10.3 Document new tools (`memory_scope_promote`, `memory_scope_demote`, `memory_global_list`)
- [ ] 10.4 Update validation checklist if needed
