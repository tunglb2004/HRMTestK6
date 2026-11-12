// Do phuc hoi tu tai tham do: p95 theo cua so 1 phut so voi 120% muc nen, trong vong 5 phut sau su kien.
import exec from 'k6/execution';

export const RECOVERY_RATIO = 1.2;
const WINDOW_MS = 60 * 1000;

// Tag cua so 1 phut, tinh theo thoi gian tu luc bat dau bai test.
export function windowTag() {
  return `w${Math.floor(exec.instance.currentTestRunDuration / WINDOW_MS)}`;
}

function metricName(scenario, window) {
  return `http_req_duration{scenario:${scenario},window:w${window}}`;
}

// Khai bao submetric cho tung cua so; dieu kien luon dung, chi de k6 xuat so.
export function windowThresholds(scenario, minutes) {
  const result = {};
  for (let i = 0; i < minutes; i += 1) {
    result[metricName(scenario, i)] = ['p(95)>=0'];
  }
  return result;
}

function p95Of(data, scenario, window) {
  const metric = data.metrics[metricName(scenario, window)];
  const value = metric && metric.values ? metric.values['p(95)'] : undefined;
  return value === undefined ? null : value;
}

// baseline, after la danh sach chi so phut. Khong co mau thi tra ve khong ket luan duoc.
export function evaluateRecovery(data, scenario, baseline, after) {
  const base = baseline.map((w) => p95Of(data, scenario, w)).filter((v) => v !== null && v > 0);
  if (!base.length) {
    return { baselineMs: null, limitMs: null, recoveredAtMinute: null, conclusion: 'Không có mẫu nền' };
  }
  // Lay phut tot nhat lam nen: mot phut nen bi nhieu khong duoc lam noi long tieu chi phuc hoi.
  const baselineMs = Math.min(...base);
  const limitMs = baselineMs * RECOVERY_RATIO;
  for (const w of after) {
    const value = p95Of(data, scenario, w);
    if (value !== null && value <= limitMs) {
      return { baselineMs, limitMs, recoveredAtMinute: w, conclusion: 'Đã phục hồi' };
    }
  }
  return { baselineMs, limitMs, recoveredAtMinute: null, conclusion: 'Chưa phục hồi trong 5 phút' };
}
