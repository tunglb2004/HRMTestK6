// PERF-008: VU dong, cac bac 50, 100, 173, 300, 500, 1000, moi bac giu 5 phut.
// Bac <= 173 giu tieu chi nghiem thu; bac > 173 chi tim gioi han, dung khi loi >= 5% hoac p95 >= 1s.
import exec from 'k6/execution';
import { requireRunPermission } from '../config/env.js';
import { ACCEPT } from '../config/thresholds.js';
import { loginFlow } from '../flows/login-flow.js';
import { LOGIN_NAME } from '../lib/auth.js';
import { buildSummary } from '../lib/summary.js';

const LEVELS = [50, 100, 173, 300, 500, 1000];
const RAMP_SECONDS = 30;
const HOLD_SECONDS = 300;
const STEP_MS = (RAMP_SECONDS + HOLD_SECONDS) * 1000;

function buildThresholds() {
  const thresholds = {
    'http_req_duration{api:login}': ['p(95)>=0'],
    [`http_reqs{name:${LOGIN_NAME}}`]: ['count>=0'],
    [`http_req_failed{name:${LOGIN_NAME}}`]: ['rate>=0'],
  };
  for (const level of LEVELS) {
    if (level <= 173) {
      thresholds[`http_req_duration{stage:s${level}}`] = [`p(95)<${ACCEPT.p95}`, `p(99)<${ACCEPT.p99}`];
      thresholds[`tech_errors{stage:s${level}}`] = [`rate<${ACCEPT.techErrorRate}`];
    } else {
      thresholds[`http_req_duration{stage:s${level}}`] = [{ threshold: `p(95)<${ACCEPT.p95}`, abortOnFail: true, delayAbortEval: '1m' }];
      thresholds[`tech_errors{stage:s${level}}`] = [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '1m' }];
    }
  }
  return thresholds;
}

export const options = {
  scenarios: {
    stress_login: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: LEVELS.flatMap((target) => [
        { duration: `${RAMP_SECONDS}s`, target },
        { duration: `${HOLD_SECONDS}s`, target },
      ]),
      gracefulRampDown: '30s',
    },
  },
  thresholds: buildThresholds(),
};

function stageTag() {
  const index = Math.floor(exec.instance.currentTestRunDuration / STEP_MS);
  return `s${LEVELS[Math.min(index, LEVELS.length - 1)]}`;
}

export function setup() {
  requireRunPermission();
}

export default function () {
  loginFlow({ stage: stageTag() });
}

export const handleSummary = buildSummary('PERF-008', [{ api: 'login', name: LOGIN_NAME }]);
