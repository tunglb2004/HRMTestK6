// PERF-013: tai tham do login 1 req/s trong 15 phut; nguoi van hanh restart app o phut 5.
import { requireRunPermission } from '../config/env.js';
import { loginFlow } from '../flows/login-flow.js';
import { LOGIN_NAME } from '../lib/auth.js';
import { evaluateRecovery, windowTag, windowThresholds } from '../lib/recovery.js';
import { buildSummary } from '../lib/summary.js';

const MINUTES = 15;

export const options = {
  scenarios: {
    probe: { executor: 'constant-arrival-rate', rate: 1, timeUnit: '1s', duration: `${MINUTES}m`, preAllocatedVUs: 5, maxVUs: 30 },
  },
  thresholds: {
    ...windowThresholds('probe', MINUTES),
    'http_req_duration{api:login}': ['p(95)>=0'],
    [`http_reqs{name:${LOGIN_NAME}}`]: ['count>=0'],
    [`http_req_failed{name:${LOGIN_NAME}}`]: ['rate>=0'],
  },
};

export function setup() {
  requireRunPermission();
}

export default function () {
  loginFlow({ window: windowTag() });
}

export const handleSummary = buildSummary(
  'PERF-013',
  [{ api: 'login', name: LOGIN_NAME }],
  (data) => evaluateRecovery(data, 'probe', [0, 1, 2, 3], [6, 7, 8, 9, 10]),
);
