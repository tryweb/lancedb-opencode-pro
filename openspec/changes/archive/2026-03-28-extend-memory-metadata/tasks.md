## 1. Schema Design

- [x] 1.1 Define TypeScript interfaces for extended MemoryRecord
- [x] 1.2 Define TypeScript interfaces for extended FeedbackEvent
- [x] 1.3 Document new optional fields

## 2. Database Schema Updates

- [x] 2.1 Add userId column to memories table (nullable)
- [x] 2.2 Add teamId column to memories table (nullable)
- [x] 2.3 Add sourceSessionId column to memories table (nullable)
- [x] 2.4 Add confidence column to memories table (nullable, float)
- [x] 2.5 Add tags column to memories table (nullable, JSON array)
- [x] 2.6 Add status column to memories table (nullable, default 'active')
- [x] 2.7 Add parentId column to memories table (nullable)
- [x] 2.8 Add sourceSessionId column to effectiveness_events (nullable)
- [x] 2.9 Add confidenceDelta column to effectiveness_events (nullable)
- [x] 2.10 Add relatedMemoryId column to effectiveness_events (nullable)
- [x] 2.11 Add context column to effectiveness_events (nullable, JSON)

## 3. Migration Mechanism Implementation

- [x] 3.1 Add schema version tracking
- [x] 3.2 Implement migration runner on init
- [x] 3.3 Add column existence check before add
- [x] 3.4 Add migration logging
- [x] 3.5 Handle migration failures gracefully

## 4. Backward Compatibility

- [x] 4.1 Ensure existing queries work without changes
- [x] 4.2 Add null-safe field handling in code
- [x] 4.3 Test upgrade from existing database

## 5. Testing

- [x] 5.1 Add unit tests for new field handling
- [x] 5.2 Add migration tests
- [x] 5.3 Test backward compatibility
