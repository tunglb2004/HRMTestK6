// Tong hop ket qua: so mau, p95, p99, muc dat thang A, B theo tung API, ghi vao results/.
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { classify } from '../config/thresholds.js';

function metricValue(data, key, field) {
  const metric = data.metrics[key];
  return metric && metric.values ? metric.values[field] : undefined;
}

// apis: [{ api: 'login', name: 'POST /v1/auth/login' }]
export function buildSummary(caseId, apis, recovery = null) {
  return (data) => {
    const tech = metricValue(data, 'tech_errors', 'rate') || 0;
    const rows = apis.map(({ api, name }) => {
      const p95 = metricValue(data, `http_req_duration{api:${api}}`, 'p(95)');
      const p99 = metricValue(data, `http_req_duration{api:${api}}`, 'p(99)');
      const samples = metricValue(data, `http_reqs{name:${name}}`, 'count') || 0;
      // Khong co mau thi khong duoc xep loai, tranh bao Dat khi bai chua chay.
      const grade = p95 === undefined || samples === 0 ? null : classify(p95, p99, tech);
      return { api, samples, p95, p99, grade };
    });
    const result = { caseId, techErrorRate: tech, apis: rows, recovery: recovery ? recovery(data) : null };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const lines = [`\n=== ${caseId} ===`, `Lỗi kỹ thuật: ${(tech * 100).toFixed(2)}%`];
    for (const row of rows) {
      const grade = row.grade
        ? `A${row.grade.a}, B${row.grade.b}, ${row.grade.verdict}`
        : 'không có số đo';
      const timing = !row.grade ? '' :`p95=${row.p95.toFixed(0)}ms p99=${row.p99.toFixed(0)}ms `;
      lines.push(`${row.api}: mẫu=${row.samples} ${timing}${grade}`);
    }
    if (result.recovery) {
      lines.push(`Phục hồi: ${result.recovery.conclusion}`);
    }
    return {
      // Bang day du cua k6 (checks, thoi gian tung metric, threshold) roi den dong xep loai.
      stdout: `${textSummary(data, { indent: ' ', enableColors: false })}\n${lines.join('\n')}\n`,
      [`results/summary-${caseId}-${stamp}.json`]: JSON.stringify({ result, metrics: data.metrics }, null, 2),
    };
  };
}
