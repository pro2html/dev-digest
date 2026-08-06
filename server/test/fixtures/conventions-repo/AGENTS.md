# Test Repo Agents

- Always use async/await instead of .then() chains.
- Route handlers must return Result<T, ApiError>.
- All service methods take workspaceId as the first parameter.
