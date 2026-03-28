## 1. Tool Interface Design

- [x] 1.1 Define tool schema for memory_explicit_remember command
- [x] 1.2 Define tool schema for memory_explicit_forget command
- [x] 1.3 Define tool schema for memory_learning_summary command

## 2. Memory Explicit Remember Implementation

- [x] 2.1 Implement memory_explicit_remember handler
- [x] 2.2 Add content validation (minChars threshold)
- [x] 2.3 Add category label support
- [x] 2.4 Integrate with effectiveness event emission

## 3. Memory Explicit Forget Implementation

- [x] 3.1 Implement memory_explicit_forget handler
- [x] 3.2 Add soft-delete logic (status=disabled)
- [x] 3.3 Add hard-delete logic with confirm flag
- [x] 3.4 Update search to exclude disabled memories
- [x] 3.5 Add forget event to effectiveness pipeline

## 4. Learning Summary Implementation

- [x] 4.1 Implement memory_learning_summary handler
- [x] 4.2 Add time window parameter (default 7 days)
- [x] 4.3 Add category grouping logic
- [x] 4.4 Add memory count by category

## 5. Integration and Testing

- [x] 5.1 Register new tools with provider
- [x] 5.2 Add unit tests for each command
- [x] 5.3 Add integration tests for effectiveness pipeline
- [x] 5.4 Update documentation with new commands
