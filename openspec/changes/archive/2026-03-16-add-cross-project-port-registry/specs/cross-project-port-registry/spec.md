## ADDED Requirements

### Requirement: Cross-project host port planning
The system MUST provide a host-port planning workflow that accepts a project identifier and a set of service container ports, then returns non-conflicting host port assignments for all requested services.

#### Scenario: Planner returns non-conflicting assignments in one request
- **WHEN** user requests a plan for multiple services with required container ports
- **THEN** the system returns one host port per service with no duplicates within the returned plan

#### Scenario: Preferred host port is reused only when safe
- **WHEN** user provides a preferred host port for a service
- **THEN** the system uses that host port only if it is not already reserved in registry memory and is currently available on the host

### Requirement: Global reservation persistence
The system MUST persist accepted host-port assignments into durable long-term memory under `global` scope with structured metadata containing project, service, host port, container port, and protocol.

#### Scenario: Reservation survives subsequent planning calls
- **WHEN** a previous plan persisted reservations for project services
- **THEN** subsequent planning calls treat those host ports as reserved unless explicitly replaced by an updated reservation for the same project service identity

#### Scenario: Updated assignment replaces stale reservation for same service
- **WHEN** a project service is re-planned with a different host port
- **THEN** the system replaces the previous reservation record for that project service identity instead of retaining conflicting duplicates
