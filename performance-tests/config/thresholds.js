// Thang do kho p95, p99 va tieu chi nghiem thu da chot: "Dat" la muc 2 thang B tai 173 nguoi.
export const SCALE_A = [
  { level: 1, p95: 2000, p99: 6000 },
  { level: 2, p95: 1000, p99: 3000 },
  { level: 3, p95: 500, p99: 1500 },
];
export const SCALE_B = [
  { level: 1, p95: 2000, p99: 6000 },
  { level: 2, p95: 1000, p99: 2500 },
  { level: 3, p95: 500, p99: 1000 },
];
export const ACCEPT = { p95: 1000, p99: 2500, techErrorRate: 0.01 };

// Du 3 dong de k6 xuat so request, ty le loi va percentile theo tung API.
export function apiThresholds(api, name) {
  return {
    [`http_req_duration{api:${api}}`]: [`p(95)<${ACCEPT.p95}`, `p(99)<${ACCEPT.p99}`],
    [`http_reqs{name:${name}}`]: ['count>=0'],
    [`http_req_failed{name:${name}}`]: ['rate>=0'],
  };
}

export const TECH_ERROR_THRESHOLD = { tech_errors: [`rate<${ACCEPT.techErrorRate}`] };

function highestLevel(scale, p95, p99) {
  return scale.reduce((best, step) => (p95 < step.p95 && p99 < step.p99 ? step.level : best), 0);
}

// a, b la muc cao nhat dat duoc; 0 la chua qua muc 1.
export function classify(p95, p99, techErrorRate) {
  const a = highestLevel(SCALE_A, p95, p99);
  const b = highestLevel(SCALE_B, p95, p99);
  let verdict = 'Không đạt';
  if (techErrorRate < ACCEPT.techErrorRate && b >= 2) {
    verdict = 'Đạt';
  } else if (techErrorRate < ACCEPT.techErrorRate && b >= 1) {
    verdict = 'Đạt có điều kiện';
  }
  return { a, b, verdict };
}
