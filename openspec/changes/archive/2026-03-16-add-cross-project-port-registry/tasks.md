## 1. Port Planning Core

- [x] 1.1 Add a new `src/ports.ts` utility module for reservation parsing, candidate selection, and host port availability probing.
- [x] 1.2 Implement deterministic assignment logic that supports preferred host ports, fallback range scanning, and duplicate prevention inside one plan.

## 2. Plugin Tool Integration

- [x] 2.1 Add `memory_port_plan` tool in `src/index.ts` with validated args for project, services, port range, and persistence toggle.
- [x] 2.2 Read existing `global` reservation records, upsert project+service reservations, and persist new assignments in long-term memory.

## 3. Validation

- [x] 3.1 Extend regression tests to cover readable planner output and conflict fallback behavior.
- [x] 3.2 Add regression coverage for reservation persistence/upsert behavior across repeated planning calls.
- [x] 3.3 Run typecheck, build, and regression test workflow to verify the change end-to-end.
