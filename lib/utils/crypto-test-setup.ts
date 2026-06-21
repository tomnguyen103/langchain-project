/**
 * Side-effect test setup, imported by crypto.test.ts BEFORE `./crypto`.
 * crypto.ts derives its AES key from env at import time, so these must be set
 * first. A separate module guarantees ordering without top-level await (tsx
 * compiles tests to CJS, where top-level await isn't allowed).
 */
process.env.SKIP_ENV_VALIDATION = "true";
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = "test-encryption-key-at-least-32-chars-long!!";
}

export {};
