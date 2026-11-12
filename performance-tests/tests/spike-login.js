// PERF-006: 173 VU dang nhap trong 30 giay, tai tham do 1 req/s chay suot de do phuc hoi.
import { requireRunPermission } from '../config/env.js';
import { TECH_ERROR_THRESHOLD } from '../config/thresholds.js';
import { loginFlow } from '../flows/login-flow.js';
import { LOGIN_NAME } from '../lib/auth.js';
import { evaluateRecovery, windowTag, windowThresholds } from '../lib/recovery.js';
import { buildSummary } from '../lib/summary.js';

const MINUTES = 8;

export const options = {
  scenarios: {
    probe: { executor: 'constant-arrival-rate', exec: 'probe', rate: 1, timeUnit: '1s', duration: `${MINUTES}m`, preAllocatedVUs: 5, maxVUs: 20 },
    spike: { executor: 'constant-arrival-rate', exec: 'spike', rate: 173, timeUnit: '30s', duration: '30s', startTime: '2m', preAllocatedVUs: 173, maxVUs: 173 },
  },
  thresholds: {
    ...TECH_ERROR_THRESHOLD,
    ...windowThresholds('probe', MINUTES),
    'http_req_duration{api:login}': ['p(95)>=0'],
    [`http_reqs{name:${LOGIN_NAME}}`]: ['count>=0'],
    [`http_req_failed{name:${LOGIN_NAME}}`]: ['rate>=0'],
  },
};

export function setup() {
  requireRunPermission();
}

export function probe() {
  loginFlow({ window: windowTag() });
}

export function spike() {
  loginFlow();
}

export const handleSummary = buildSummary(
  'PERF-006',
  [{ api: 'login', name: LOGIN_NAME }],
  (data) => evaluateRecovery(data, 'probe', [0, 1], [3, 4, 5, 6, 7]),
);
