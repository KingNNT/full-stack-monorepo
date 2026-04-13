// Runs before test files are loaded — must set env vars consumed by
// class decorators (e.g. @Throttle) since decorator metadata is evaluated
// at module import time, before any beforeAll() hook can run.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.THROTTLE_DISABLED = 'true';
