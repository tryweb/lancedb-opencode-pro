## Context

The plugin already provides durable long-term memory and scope isolation, but there is no workflow support for host listen port coordination across multiple projects. Teams that generate multiple `docker-compose.yml` files on one host can accidentally reuse host ports, causing runtime conflicts. The current codebase has no compose generation layer, so the safest integration point is a new memory tool that plans/records host port assignments before users author compose mappings.

## Goals / Non-Goals

**Goals:**
- Add a tool that proposes non-conflicting host ports for multiple services in one request.
- Persist selected assignments in long-term memory under `global` scope so all projects can reuse one registry.
- Combine remembered reservations with live host port availability checks before assignment.
- Keep existing memory tools backward-compatible.

**Non-Goals:**
- Auto-edit or generate `docker-compose.yml` files.
- Provide hard locking semantics across concurrent external writers.
- Replace OS/network-level service discovery tooling.

## Decisions

1. **Introduce `memory_port_plan` as a non-destructive planner with optional persistence**
   - Rationale: Compose generation is outside this plugin, so the plugin should provide planning output that upstream agents/scripts can consume.
   - Alternative considered: direct compose mutation command. Rejected due to repository-agnostic plugin boundaries and high accidental-change risk.

2. **Store port reservations as memory records in `global` scope with typed metadata**
   - Rationale: global scope is intentionally shared across projects on the same host and already supported by retrieval filters.
   - Alternative considered: separate local file registry. Rejected to avoid second storage system outside LanceDB.

3. **Use live bind-probe checks for candidate host ports during planning**
   - Rationale: memory alone cannot guarantee that a port is currently free; probing prevents stale reservation-only logic.
   - Alternative considered: memory-only conflict checks. Rejected because it misses external/non-registered processes.

4. **Upsert reservation entries per project+service+protocol before writing new records**
   - Rationale: avoids unbounded stale duplicates and keeps registry easier to inspect.
   - Alternative considered: append-only history. Rejected for increased noise and higher lookup cost.

## Risks / Trade-offs

- [Race between planners] Two planners could pick the same free port concurrently before persistence. → Mitigation: document best-effort semantics and keep live probe + persisted reservation checks; recommend immediate compose apply after planning.
- [Stale reservations] Global records can become outdated if services are removed. → Mitigation: planner always checks live availability and supports reassignment when remembered port is occupied.
- [Probe overhead] Sequential port probing can be slow with narrow ranges and many used ports. → Mitigation: bounded range with clear error when exhausted, and support preferred host ports.

## Migration Plan

1. Add new port planning utility module and `memory_port_plan` tool.
2. Add regression tests for planning, reservation persistence, and conflict avoidance behavior.
3. Update command/spec documentation through OpenSpec artifacts.
4. Rollback strategy: remove new tool export and port utility module; existing memory tools remain unaffected.

## Open Questions

- Should future iterations add explicit reservation TTL/expiry to automatically prune stale port claims?
- Should protocol support expand beyond TCP in v1, or remain TCP-first with protocol metadata extensibility?
