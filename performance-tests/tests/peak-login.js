// PERF-005: 173 luot dang nhap rai deu trong 15 phut, 0,192 req/s.
import { requireRunPermission } from '../config/env.js';
import { apiThresholds, TECH_ERROR_THRESHOLD } from '../config/thresholds.js';
import { loginFlow } from '../flows/login-flow.js';
import { LOGIN_NAME } from '../lib/auth.js';
import { buildSummary } from '../lib/summary.js';

export const options = {
  scenarios: {
    peak_login: {
      executor: 'constant-arrival-rate',
      rate: 173,
      timeUnit: '15m',
      duration: '15m',
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  },
  thresholds: { ...apiThresholds('login', LOGIN_NAME), ...TECH_ERROR_THRESHOLD },
};

export function setup() {
  requireRunPermission();
}

export default function () {
  loginFlow();
}

export const handleSummary = buildSummary('PERF-005', [{ api: 'login', name: LOGIN_NAME }]);
