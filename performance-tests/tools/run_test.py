#!/usr/bin/env python3
"""Chạy một file k6 và lưu kết quả thành '<tên> (lần N)', kèm số CPU/RAM của đúng lần chạy đó.

Cách dùng: python tools/run_test.py tests/smoke.js [tham số k6, ví dụ -e BASE_URL=http://localhost:8080]
"""
import argparse
import datetime
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = Path(os.environ.get("RESULTS_DIR", ROOT / "results"))
QUERIES_FILE = ROOT / "monitoring" / "queries.json"
PROMETHEUS_URL = os.environ.get("PROMETHEUS_URL", "http://localhost:9090").rstrip("/")
TREND_STATS = "avg,min,med,max,p(90),p(95),p(99)"
SECRET_ARG = re.compile(r"((?:PASSWORD|PASS|TOKEN|SECRET|KEY)[A-Z0-9_]*=)\S+", re.I)
SAMPLE_SECONDS = 2


def reserve_run(name):
    """Giành số lần chạy kế tiếp; tạo file bằng chế độ 'x' nên hai lần chạy song song không trùng số."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    pattern = re.compile(rf"^{re.escape(name)} \(lần (\d+)\)")
    used = [int(m.group(1)) for f in RESULTS_DIR.iterdir() if (m := pattern.match(f.name))]
    number = max(used, default=0) + 1
    while True:
        path = RESULTS_DIR / f"{name} (lần {number}).txt"
        try:
            return number, path.open("x", encoding="utf-8")
        except FileExistsError:
            number += 1


def prometheus_ready():
    try:
        with urllib.request.urlopen(f"{PROMETHEUS_URL}/-/ready", timeout=2) as response:
            return response.status == 200
    except (urllib.error.URLError, OSError):
        return False


def summarize(points):
    """points là danh sách (thời điểm epoch, giá trị). Trả về đỉnh, trung bình, thời điểm đỉnh."""
    if not points:
        return None
    moment, peak = max(points, key=lambda item: item[1])
    return {
        "peak": peak,
        "avg": statistics.fmean(value for _, value in points),
        "peak_at": datetime.datetime.fromtimestamp(moment).astimezone().isoformat(timespec="seconds"),
    }


def query_prometheus(query, start, end):
    params = urllib.parse.urlencode({"query": query, "start": start, "end": end, "step": "5s"})
    with urllib.request.urlopen(f"{PROMETHEUS_URL}/api/v1/query_range?{params}", timeout=15) as response:
        series = json.load(response)["data"]["result"]
    return [(float(t), float(v)) for item in series for t, v in item["values"] if v not in ("NaN", "+Inf", "-Inf")]


def resources_from_prometheus(start, end):
    rows = []
    for item in json.loads(QUERIES_FILE.read_text(encoding="utf-8")):
        try:
            stats = summarize(query_prometheus(item["query"], start, end))
        except (urllib.error.URLError, OSError, ValueError, KeyError):
            stats = None
        rows.append({**item, "stats": stats})
    return rows


class LocalSampler(threading.Thread):
    """Đo CPU/RAM bằng psutil khi không có Prometheus: toàn máy, và backend nếu có BACKEND_PORT."""

    def __init__(self, psutil):
        super().__init__(daemon=True)
        self.psutil = psutil
        self.halt = threading.Event()
        self.cpu, self.ram, self.backend_cpu, self.backend_ram = [], [], [], []
        self.process = self.find_backend(os.environ.get("BACKEND_PORT"))

    def find_backend(self, port):
        if not port:
            return None
        for connection in self.psutil.net_connections(kind="tcp"):
            if connection.laddr and connection.laddr.port == int(port) and connection.status == "LISTEN":
                return self.psutil.Process(connection.pid)
        print(f"Cảnh báo: không thấy tiến trình nghe cổng {port}.", file=sys.stderr)
        return None

    def run(self):
        self.psutil.cpu_percent()
        if self.process:
            self.process.cpu_percent()
        while not self.halt.wait(SAMPLE_SECONDS):
            now = time.time()
            self.cpu.append((now, self.psutil.cpu_percent()))
            self.ram.append((now, self.psutil.virtual_memory().used / 1024**3))
            if self.process:
                try:
                    self.backend_cpu.append((now, self.process.cpu_percent()))
                    self.backend_ram.append((now, self.process.memory_info().rss / 1024**3))
                except self.psutil.Error:
                    self.process = None

    def rows(self):
        rows = [
            {"component": "Máy chạy test", "metric": "CPU", "unit": "%", "stats": summarize(self.cpu)},
            {"component": "Máy chạy test", "metric": "RAM", "unit": "GB", "stats": summarize(self.ram)},
        ]
        if self.backend_cpu:
            rows += [
                {"component": "Backend", "metric": "CPU", "unit": "% của 1 nhân", "stats": summarize(self.backend_cpu)},
                {"component": "Backend", "metric": "RAM", "unit": "GB", "stats": summarize(self.backend_ram)},
            ]
        return rows


def start_local_sampler():
    try:
        import psutil
    except ImportError:
        return None
    sampler = LocalSampler(psutil)
    sampler.start()
    return sampler


def k6_version(k6):
    return subprocess.run([k6, "version"], capture_output=True, text=True, encoding="utf-8").stdout.strip()


def run_k6(command, env, log):
    """Chạy k6, vừa in ra màn hình vừa ghi vào file log."""
    process = subprocess.Popen(
        command, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, encoding="utf-8", errors="replace",
    )
    try:
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            log.write(line)
            log.flush()  # mở file khi đang chạy vẫn thấy dòng mới nhất
    except KeyboardInterrupt:
        print("Đang dừng k6, kết quả vẫn được lưu...")
    return process.wait()


def table(rows):
    lines = ["| Thành phần | Chỉ số | Đỉnh | Trung bình | Đơn vị | Thời điểm đỉnh |", "|---|---|---:|---:|---|---|"]
    for row in rows:
        stats = row["stats"]
        cells = (
            (f"{stats['peak']:.2f}", f"{stats['avg']:.2f}", row["unit"], stats["peak_at"])
            if stats else ("không có dữ liệu", "", row["unit"], "")
        )
        lines.append(f"| {row['component']} | {row['metric']} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def write_resources(path, info, source, rows):
    lines = [f"{key}: {value}" for key, value in info.items()] + [f"Nguồn đo tài nguyên: {source}", ""]
    lines.append(table(rows) if rows else "Không có số CPU/RAM: Prometheus không chạy và chưa cài psutil.")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def append_history(name, number, info, outcome):
    history = RESULTS_DIR / "LICH_SU_CHAY.md"
    if not history.exists():
        history.write_text(
            "# Lịch sử chạy\n\n| Test | Lần | Bắt đầu | Kết thúc | Kết quả |\n|---|---:|---|---|---|\n",
            encoding="utf-8",
        )
    with history.open("a", encoding="utf-8") as handle:
        handle.write(f"| {name} | {number} | {info['Bắt đầu']} | {info['Kết thúc']} | {outcome} |\n")


def describe_exit(code):
    return {0: "Đạt threshold", 99: "Có threshold bị vượt"}.get(code, f"k6 dừng với mã {code}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("script", help="File k6 cần chạy")
    parser.add_argument("--name", help="Tên dùng cho file kết quả, mặc định là tên file script")
    args, k6_args = parser.parse_known_args()

    k6 = shutil.which("k6")
    if not k6:
        raise SystemExit("Không tìm thấy k6 trong PATH.")
    script = Path(args.script)
    if not script.is_file():
        raise SystemExit(f"Không tìm thấy file: {script}")

    name = args.name or script.stem
    number, log = reserve_run(name)
    label = f"{name} (lần {number})"
    json_path = RESULTS_DIR / f"{label}.json"
    resources_path = RESULTS_DIR / f"{label} - tài nguyên.txt"

    env = dict(os.environ)
    command = [
        k6, "run", "--summary-trend-stats", TREND_STATS,
        "--summary-export", str(json_path), "--tag", f"testid={label}",
    ]
    use_prometheus = prometheus_ready()
    sampler = None
    if use_prometheus:
        command += ["-o", "experimental-prometheus-rw"]
        env.setdefault("K6_PROMETHEUS_RW_SERVER_URL", f"{PROMETHEUS_URL}/api/v1/write")
        env.setdefault("K6_PROMETHEUS_RW_TREND_STATS", "p(95),p(99),avg,max")
    else:
        print("Prometheus không chạy: không có biểu đồ trực tiếp, đo CPU/RAM bằng psutil nếu có.")
        sampler = start_local_sampler()
    command += [*k6_args, str(script)]

    print(f"Bắt đầu {label}")
    started = time.time()
    with log:
        code = run_k6(command, env, log)
    ended = time.time()

    if use_prometheus:
        time.sleep(6)  # chờ Prometheus thu xong mẫu cuối
        source, rows = f"Prometheus {PROMETHEUS_URL}", resources_from_prometheus(started, ended)
    elif sampler:
        sampler.halt.set()
        sampler.join()
        source, rows = "psutil", sampler.rows()
    else:
        source, rows = "không có", []

    stamp = lambda moment: datetime.datetime.fromtimestamp(moment).astimezone().isoformat(timespec="seconds")
    info = {
        "Lần chạy": label,
        "Script": script.as_posix(),
        "Lệnh chạy": SECRET_ARG.sub(r"\1***", " ".join(["k6 run", *k6_args, script.as_posix()])),
        "Phiên bản k6": k6_version(k6),
        "Bắt đầu": stamp(started),
        "Kết thúc": stamp(ended),
        "Kết quả": describe_exit(code),
    }
    write_resources(resources_path, info, source, rows)
    append_history(name, number, info, info["Kết quả"])
    print(f"Đã lưu: {RESULTS_DIR / label}.txt, .json và file tài nguyên")
    return code


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
