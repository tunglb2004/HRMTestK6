// Kiem tra rate limit cua POST /v1/auth/login. Bat buoc chay truoc moi bai tai login.
// Tang bac 1, 5, 12, 35 lan/giay va dung ngay khi gap 429, 5xx, loi ket noi, hoac khi dang nhap that bai.
// Tong toi da khoang 715 lan login.
//
// Chi chay khi chu moi truong da cho phep, va phai xac nhan bang -e CONFIRM_ALLOWED=yes:
//   k6 run -e HRM_BASE_URL=... -e HRM_EMAIL=... -e HRM_PASSWORD=... -e CONFIRM_ALLOWED=yes seed/check-rate-limit.js
import http from 'k6/http';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.HRM_BASE_URL;
const EMAIL = __ENV.HRM_EMAIL;
const PASSWORD = __ENV.HRM_PASSWORD;

// 12 lan/giay tuong ung PERF-002 (11,5 req/s), 35 lan/giay tuong ung burst PERF-007 (34,6 lan/giay).
const STEPS = [
  { rate: 1, seconds: 30 },
  { rate: 5, seconds: 30 },
  { rate: 12, seconds: 30 },
  { rate: 35, seconds: 5 },
];
const GAP_SECONDS = 5;

const loginOk = new Counter('login_ok');
const rateLimited = new Counter('rate_limited');

function buildScenarios() {
  const scenarios = {};
  let start = 0;
  for (const step of STEPS) {
    scenarios[`step_${step.rate}`] = {
      executor: 'constant-arrival-rate',
      exec: 'login',
      rate: step.rate,
      timeUnit: '1s',
      duration: `${step.seconds}s`,
      startTime: `${start}s`,
      preAllocatedVUs: Math.max(5, step.rate * 2),
      maxVUs: Math.max(10, step.rate * 4),
      env: { STEP: String(step.rate) },
    };
    start += step.seconds + GAP_SECONDS;
  }
  return scenarios;
}

// Dieu kien luon dung, chi de k6 xuat so theo tung bac.
function buildStepThresholds() {
  const thresholds = {};
  for (const { rate } of STEPS) {
    thresholds[`http_req_duration{step:${rate}}`] = ['p(95)>=0'];
    thresholds[`login_ok{step:${rate}}`] = ['count>=0'];
    thresholds[`dropped_iterations{scenario:step_${rate}}`] = ['count>=0'];
  }
  return thresholds;
}

export const options = {
  scenarios: buildScenarios(),
  thresholds: buildStepThresholds(),
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  if (__ENV.CONFIRM_ALLOWED !== 'yes') {
    exec.test.abort('Chua co xac nhan cua chu moi truong. Them -e CONFIRM_ALLOWED=yes khi da duoc phep.');
  }
  if (!BASE_URL || !EMAIL || !PASSWORD) {
    exec.test.abort('Thieu HRM_BASE_URL, HRM_EMAIL hoac HRM_PASSWORD.');
  }
}

export function login() {
  const step = __ENV.STEP;
  const res = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login', step } },
  );

  if (res.status === 200) {
    loginOk.add(1, { step });
    return;
  }
  if (res.status === 429) {
    rateLimited.add(1, { step });
    const retryAfter = res.headers['Retry-After'] || 'khong co';
    const limit = res.headers['X-Ratelimit-Limit'] || 'khong co';
    exec.test.abort(`Gap 429 o bac ${step} lan/giay. Retry-After=${retryAfter}, X-RateLimit-Limit=${limit}.`);
  }
  // Dung ngay de khong lam tang bo dem sai mat khau va khong gay them tai cho server dang loi.
  exec.test.abort(`Dung o bac ${step} lan/giay vi gap HTTP ${res.status}.`);
}

export function handleSummary(data) {
  const ok = data.metrics.login_ok ? data.metrics.login_ok.values.count : 0;
  const limited = data.metrics.rate_limited ? data.metrics.rate_limited.values.count : 0;
  let conclusion = `Khong gap 429 sau ${ok} lan login thanh cong. Neu test dung som vi ly do khac, ket qua nay chua ket luan duoc.`;
  if (limited > 0) {
    conclusion = `Co rate limit: gap 429 sau ${ok} lan login thanh cong. Xem dong log de biet bac va header.`;
  } else if (ok === 0) {
    conclusion = 'Chua kiem tra duoc: khong co lan login nao thanh cong.';
  }
  const steps = STEPS.map(({ rate }) => {
    const duration = data.metrics[`http_req_duration{step:${rate}}`];
    const success = data.metrics[`login_ok{step:${rate}}`];
    const dropped = data.metrics[`dropped_iterations{scenario:step_${rate}}`];
    const values = duration ? duration.values : {};
    return {
      rate,
      ok: success ? success.values.count : 0,
      dropped: dropped ? dropped.values.count : 0,
      medMs: Math.round(values.med || 0),
      p95Ms: Math.round(values['p(95)'] || 0),
      p99Ms: Math.round(values['p(99)'] || 0),
      maxMs: Math.round(values.max || 0),
    };
  });
  const lines = steps.map((s) => `Bac ${s.rate}/s: ok=${s.ok} dropped=${s.dropped} med=${s.medMs}ms p95=${s.p95Ms}ms p99=${s.p99Ms}ms max=${s.maxMs}ms`);
  return {
    stdout: `\n${lines.join('\n')}\n${conclusion}\n`,
    'results/rate-limit-result.json': JSON.stringify({ loginOk: ok, rateLimited: limited, conclusion, steps }, null, 2),
  };
}
