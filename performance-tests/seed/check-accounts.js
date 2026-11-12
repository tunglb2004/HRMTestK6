// Kiem tra 200 tai khoan, chi doc: dang nhap duoc, co ca, co dia diem, dung trang thai mong doi.
// Chay truoc bai cham cong voi -e EXPECT=notCheckedIn hoac checkedIn,
// va chay lai sau bai de doi soat voi -e EXPECT=checkedIn hoac checkedOut.
import { sleep } from 'k6';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';
import { requiredEnv } from '../config/env.js';
import { accounts } from '../lib/accounts.js';
import { getTodayInfo, stateOf } from '../lib/attendance.js';
import { login } from '../lib/auth.js';

const EXPECT = requiredEnv('EXPECT');
const USERS = 200;
const loginFailed = new Counter('account_login_failed');
const noShift = new Counter('account_no_shift');
const noLocation = new Counter('account_no_location');
const wrongState = new Counter('account_wrong_state');
const accountOk = new Counter('account_ok');

export const options = {
  scenarios: { check: { executor: 'shared-iterations', vus: 2, iterations: USERS, maxDuration: '10m' } },
  thresholds: {
    account_ok: [`count==${USERS}`],
    account_login_failed: ['count==0'],
    account_no_shift: ['count==0'],
    account_no_location: ['count==0'],
    account_wrong_state: ['count==0'],
  },
};

export default function () {
  const account = accounts[exec.scenario.iterationInTest];
  const token = login(account.email, account.password);
  if (!token) {
    loginFailed.add(1);
    console.warn(`Không đăng nhập được: ${account.email}`);
    return;
  }
  const info = getTodayInfo(token);
  const problems = [];
  if (!info.hasShift) { noShift.add(1); problems.push('không có ca'); }
  if (!info.locations || !info.locations.length) { noLocation.add(1); problems.push('không có địa điểm'); }
  if (stateOf(info) !== EXPECT) { wrongState.add(1); problems.push(`trạng thái ${stateOf(info)}`); }
  if (problems.length) {
    console.warn(`${account.email}: ${problems.join(', ')}`);
  } else {
    accountOk.add(1);
  }
  sleep(0.2);
}

function count(data, name) {
  return data.metrics[name] ? data.metrics[name].values.count : 0;
}

export function handleSummary(data) {
  const result = {
    expect: EXPECT,
    ok: count(data, 'account_ok'),
    loginFailed: count(data, 'account_login_failed'),
    noShift: count(data, 'account_no_shift'),
    noLocation: count(data, 'account_no_location'),
    wrongState: count(data, 'account_wrong_state'),
  };
  return {
    stdout: `\nKiểm tra ${USERS} tài khoản: ${JSON.stringify(result)}\n`,
    'results/check-accounts-result.json': JSON.stringify(result, null, 2),
  };
}
