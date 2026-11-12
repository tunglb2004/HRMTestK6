// Kiem tra response va phan loai: phan hoi mong doi, loi ky thuat (5xx, timeout, mat ket noi), 429.
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// Don vi: theo request.
export const techErrors = new Rate('tech_errors');
export const rateLimited = new Counter('rate_limited');
export const expectedResponseRate = new Rate('expected_response_rate');

export function isTechError(res) {
  return res.status === 0 || res.status >= 500;
}

// Ghi nhan 3 chi so cho moi request. extraTags dung cho cac bai can tach theo stage.
export function record(res, expectedStatuses, extraTags = {}) {
  const expected = expectedStatuses.includes(res.status);
  techErrors.add(isTechError(res), extraTags);
  expectedResponseRate.add(expected, extraTags);
  if (res.status === 429) {
    rateLimited.add(1, extraTags);
  }
  return expected;
}

// Doc data trong envelope { success, data } ma khong lam script dung khi body khong phai JSON.
export function dataOf(res) {
  try {
    const body = res.json();
    return body && body.success === true ? body.data : null;
  } catch (e) {
    return null;
  }
}

// Ma loi va thong bao cua response loi, de log khi gap ma khong mong doi. Khong lay header.
export function errorOf(res) {
  try {
    const body = res.json();
    const err = (body && (body.error || body)) || {};
    const code = err.code || err.errorCode || body.code || '';
    const message = Array.isArray(err.message) ? err.message.join('; ') : (err.message || body.message || '');
    return `${code} ${message}`.trim().slice(0, 200);
  } catch (e) {
    return String(res.body || '').slice(0, 200);
  }
}

export function checkEnvelope(res, status, label) {
  return check(res, {
    [`${label}: HTTP ${status}`]: (r) => r.status === status,
    [`${label}: success = true`]: (r) => dataOf(r) !== null,
  });
}
