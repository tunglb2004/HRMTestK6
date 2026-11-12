// Dong bo thoi diem gui. VU khong chia se bo nho nen moc T0 lay tu thoi diem bat dau scenario.
import { sleep } from 'k6';
import exec from 'k6/execution';

const PREPARE_MS = 1000;

// Moi lan lap trong scenario duoc mot moc rieng, trai deu trong cua so windowMs.
export function waitForSlot(windowMs, total) {
  const t0 = exec.scenario.startTime + PREPARE_MS;
  const slot = exec.scenario.iterationInTest % total;
  const target = t0 + (slot * windowMs) / total;
  const wait = target - Date.now();
  if (wait > 0) {
    sleep(wait / 1000);
  }
}
