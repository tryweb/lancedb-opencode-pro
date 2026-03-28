# Proposal: Complete Episodic Learning Hook Wiring + Tools Exposure

**Change ID**: complete-episodic-learning-hooks  
**Date**: 2026-03-28  
**Status**: Proposed

## Problem Statement

The episodic learning features (BL-003, BL-014-020) were specified in three OpenSpec changes and partially implemented in v0.2.7-0.2.8:

- `2026-03-28-add-episodic-task-schema` - Schema + CRUD methods ✅
- `2026-03-28-add-task-episode-learning` - Episode capture, validation, pattern extraction ✅ (store layer)
- `2026-03-28-add-retry-recovery-evidence` - Retry/recovery tracking ✅ (store layer)

**However, the implementation is incomplete:**
1. ❌ No event hooks to trigger episode capture on session events
2. ❌ No public tools to expose episodic learning to users
3. ❌ Vector similarity not used for task matching (keyword fallback)
4. ❌ Validation outcome parsing not integrated with hooks

This change completes the implementation by adding Hook Wiring + Tools exposure.

## Goals

1. **Hook Wiring**: Connect existing store methods to OpenCode event hooks
2. **Tools Exposure**: Expose episodic learning capabilities as public tools
3. **Vector Similarity**: Upgrade task matching to use embeddings
4. **Integration**: Wire validation outcome parsing into the flow

## Non-Goals

- ML-based pattern extraction (rule-based only)
- Automatic retry execution (suggestions only)
- Changes to existing store schema or types

## Release Impact

**Type**: Internal API + New Tools  
**Changelog Wording**: `user-facing` (new tools exposed)

## References

- `openspec/changes/archive/2026-03-28-add-episodic-task-schema/`
- `openspec/changes/archive/2026-03-28-add-task-episode-learning/`
- `openspec/changes/archive/2026-03-28-add-retry-recovery-evidence/`
- `docs/EPISODIC_LEARNING_INDEX.md`
