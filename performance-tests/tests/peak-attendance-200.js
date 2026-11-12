// PERF-017 (-e ACTION=checkin): 200 nguoi rai deu 08:30–08:45, 0,222 luot/giay.
// PERF-018 (-e ACTION=checkout): 200 nguoi rai deu 18:00–18:30, 0,111 luot/giay.
// Moi nguoi 1 luot: login → doc thong tin hom nay → cham cong.
import { sleep } from 'k6';
import exec from 'k6/execution';
import { requiredEnv, requireRunPermission } from '../config/env.js';
import { apiThresholds, TECH_ERROR_THRESHOLD } from '../config/thresholds.js';
import { ACTIONS, fullUserFlow } from '../flows/multi-account-flow.js';
import { accounts, requireAccounts } from '../lib/accounts.js';
import { CHECKIN_NAME, CHECKOUT_NAME } from '../lib/attendance.js';
import { LOGIN_NAME } from '../lib/auth.js';
import { buildSummary } from '../lib/summary.js';

const USERS = 200;
const ACTION = requiredEnv('ACTION');
const action = ACTIONS[ACTION];
if (!action) {
  throw new Error('Thiếu ACTION hợp lệ: checkin hoặc checkout.');
}
const CONFIG = ACTION === 'checkin'
  ? { caseId: 'PERF-017', name: CHECKIN_NAME, windowMinutes: 15 }
  : { caseId: 'PERF-018', name: CHECKOUT_NAME, windowMinutes: 30 };
const WINDOW_MS = CONFIG.windowMinutes * 60 * 1000;

export const options = {
  scenarios: {
    peak: {
      executor: 'shared-iterations',
      vus: 40,
      iterations: USERS,
      maxDuration: `${CONFIG.windowMinutes + 5}m`,
    },
  },
  thresholds: {
    ...apiThresholds('login', LOGIN_NAME),
    ...apiThresholds(ACTION, CONFIG.name),
    ...TECH_ERROR_THRESHOLD,
    attendance_success_count: [`count==${USERS}`],
    flow_login_to_attendance_ms: ['p(95)>=0'],
  },
};

export function setup() {
  requireRunPermission();
  requireAccounts(USERS);
  return { startedAt: Date.now() };
}

// Moi nguoi mot moc thoi gian rai deu trong khung gio, VU cho den moc roi moi gui.
export default function (data) {
  const index = exec.scenario.iterationInTest;
  const wait = data.startedAt + (index * WINDOW_MS) / USERS - Date.now();
  if (wait > 0) {
    sleep(wait / 1000);
  }
  fullUserFlow(accounts[index], action);
}

export const handleSummary = buildSummary(CONFIG.caseId, [
  { api: 'login', name: LOGIN_NAME },
  { api: ACTION, name: CONFIG.name },
]);
