// Luong dang nhap dai dien. Dung cho PERF-002, PERF-005, PERF-006, PERF-007, PERF-008, PERF-012, PERF-013.
import { login } from '../lib/auth.js';

export function loginFlow(extraTags = {}) {
  return login(undefined, undefined, extraTags);
}
