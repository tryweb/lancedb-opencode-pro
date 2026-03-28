## 1. Type Definitions

- [x] 1.1 Define EpisodicTaskRecord interface in types.ts
- [x] 1.2 Define TaskState type (pending, running, success, failed, timeout)
- [x] 1.3 Define FailureType taxonomy enum

## 2. Database Schema

- [x] 2.1 Create episodic_tasks table in store.ts
- [x] 2.2 Add lazy initialization on first use
- [ ] 2.3 Add index on task state and timestamp

## 3. Store Methods

- [x] 3.1 Implement createTaskEpisode method
- [x] 3.2 Implement updateTaskState method
- [x] 3.3 Implement getTaskEpisode method
- [x] 3.4 Implement queryTaskEpisodes method

## 4. Testing

- [x] 4.1 Add unit tests for task episode CRUD
- [x] 4.2 Add integration tests for lazy initialization
