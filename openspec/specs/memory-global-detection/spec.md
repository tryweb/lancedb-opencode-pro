# memory-global-detection Specification

## Purpose

Automatically detect memory content that may be applicable across projects using heuristic keyword matching, and prompt the user to confirm promotion to global scope.

## Requirements

### Requirement: Global keyword detection

The system MUST analyze memory content against a predefined list of cross-project keywords and calculate a match score.

#### Scenario: High keyword match triggers promotion prompt
- **WHEN** memory content matches 2 or more global keywords
- **THEN** the system presents a promotion prompt to the user

#### Scenario: Low keyword match does not trigger prompt
- **WHEN** memory content matches fewer than 2 global keywords
- **THEN** no promotion prompt is shown and memory is stored as project-scoped

### Requirement: Keyword list coverage

The system MUST check for keywords from these categories:
- Linux distributions (alpine, debian, ubuntu, centos, fedora, arch)
- Containers (docker, dockerfile, docker-compose, containerd)
- Orchestration (kubernetes, k8s, helm, kubectl)
- Shells/Systems (bash, shell, linux, unix, posix, busybox)
- Web servers (nginx, apache, caddy)
- Databases (postgres, postgresql, mysql, redis, mongodb, sqlite)
- Cloud platforms (aws, gcp, azure, digitalocean)
- Version control (git, github, gitlab, bitbucket)
- Protocols (api, rest, graphql, grpc, http, https)
- Package managers (npm, yarn, pnpm, pip, cargo, make, cmake)

### Requirement: Detection does not block storage

The system MUST NOT block memory storage while awaiting promotion confirmation.

#### Scenario: Memory stored while awaiting confirmation
- **WHEN** detection triggers promotion prompt
- **THEN** the memory is stored as project-scoped immediately
- **AND** the promotion prompt is presented asynchronously

### Requirement: Keyword detection configurable

The system MUST allow configuration of the global detection threshold via `global_detection_threshold` config (default: 2).
