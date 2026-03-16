## ADDED Requirements

### Requirement: Memory-backed port planning command
The system MUST provide a memory management command that plans host port mappings for Docker Compose services and can persist reservations for cross-project conflict avoidance.

#### Scenario: Command returns readable plan output
- **WHEN** user invokes the port planning command with project and service inputs
- **THEN** the command returns machine-readable assignment details including project, service name, host port, container port, protocol, and whether reservation persistence was executed

#### Scenario: Command avoids known and live conflicts
- **WHEN** requested preferred ports overlap with existing global reservations or currently occupied host ports
- **THEN** the command selects alternative ports within the requested range and reports the resulting assignments
