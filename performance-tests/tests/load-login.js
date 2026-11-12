// PERF-002: 173 VU dang nhap, moi VU nghi 15 giay, khoang 11,5 req/s. Chay 2 lan: -e HOLD=5m va -e HOLD=15m.
import { sleep } from 'k6';
import { requiredEnv, requireRunPermission } from '../config/env.js';
import { apiThresholds, TECH_ERROR_THRESHOLD } from '../config/thresholds.js';
import { loginFlow } from '../flows/login-flow.js';
import { LOGIN_NAME } from '../lib/auth.js';
import { buildSummary } from '../lib/summary.js';

const HOLD = requiredEnv('HOLD');

export const options = {
  scenarios: {
    load_login: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [{ duration: '2m', target: 173 }, { duration: HOLD, target: 173 }],
      gracefulRampDown: '30s',
    },
  },
  thresholds: { ...apiThresholds('login', LOGIN_NAME), ...TECH_ERROR_THRESHOLD },
};

export function setup() {
  requireRunPermission();
}

export default function () {
  loginFlow();
  sleep(15);
}

export const handleSummary = buildSummary('PERF-002', [{ api: 'login', name: LOGIN_NAME }]);
