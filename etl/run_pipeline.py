import os
import sys
import argparse
import subprocess
from pathlib import Path
from dotenv import load_dotenv
import requests

REPO_ROOT = Path(__file__).resolve().parents[1]

def _load_env():
    env1 = REPO_ROOT / "backend" / ".env"
    if env1.exists():
        load_dotenv(env1)
        return str(env1)
    env2 = REPO_ROOT / ".env"
    if env2.exists():
        load_dotenv(env2)
        return str(env2)
    load_dotenv()
    return None

def _run_py(rel_path: str, extra_env: dict | None = None) -> None:
    script_path = REPO_ROOT / rel_path
    if not script_path.exists():
        raise FileNotFoundError(f"Missing script: {script_path}")

    env = os.environ.copy()
    if extra_env:
        env.update({k: str(v) for k, v in extra_env.items() if v is not None})

    cmd = [sys.executable, str(script_path)]
    print(f"\n[RUN] {' '.join(cmd)}")
    subprocess.run(cmd, cwd=str(REPO_ROOT), env=env, check=True)

def _refresh_api():
    url = os.environ.get("API_REFRESH_URL", "").strip()
    token = os.environ.get("ADMIN_TOKEN", "").strip()

    if not url:
        print("[SKIP] API_REFRESH_URL not set")
        return

    headers = {}
    if token:
        headers["x-admin-token"] = token

    print(f"\n[REFRESH] GET {url}")
    r = requests.get(url, headers=headers, timeout=30)
    print(f"[REFRESH] status={r.status_code} body={r.text[:300]}")
    r.raise_for_status()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["backfill", "daily", "geocode"], default="daily")
    parser.add_argument("--domain", choices=["sale", "rent", "all"], default="sale",
                        help="sale=매매, rent=전월세, all=둘다")
    parser.add_argument("--start", help="START_YYYYMM for backfill (e.g. 200601)")
    parser.add_argument("--end", help="END_YYYYMM for backfill (e.g. 201912)")
    parser.add_argument("--lawd", help="LAWD_CDS comma separated (e.g. 50110,50130)")
    parser.add_argument("--lookback", type=int, help="DAILY_LOOKBACK_MONTHS (default 3)")
    parser.add_argument("--refresh", action="store_true", help="Call API_REFRESH_URL after pipeline")
    args = parser.parse_args()

    env_path = _load_env()
    print(f"[ENV] loaded: {env_path}")

    extra_env: dict[str, str] = {}
    if args.lawd:
        extra_env["LAWD_CDS"] = args.lawd
    if args.lookback is not None:
        extra_env["DAILY_LOOKBACK_MONTHS"] = str(args.lookback)
    if args.start:
        extra_env["START_YYYYMM"] = args.start
    if args.end:
        extra_env["END_YYYYMM"] = args.end

    SALE_BACKFILL = "etl/ingest_apt_trade.py"
    SALE_DAILY = "etl/ingest_daily_last3m.py"

    RENT_BACKFILL = "etl/ingest_rent_backfill.py"
    RENT_DAILY = "etl/ingest_rent_daily_last3m.py"

    GEOCODE = "etl/geocode_kakao_fill_locations.py"

    try:
        if args.mode == "geocode":
            _run_py(GEOCODE, extra_env=extra_env)

        elif args.mode == "backfill":
            if args.domain in ("sale", "all"):
                _run_py(SALE_BACKFILL, extra_env=extra_env)
            if args.domain in ("rent", "all"):
                _run_py(RENT_BACKFILL, extra_env=extra_env)

            _run_py(GEOCODE, extra_env=extra_env)

        else:  # daily
            if args.domain in ("sale", "all"):
                _run_py(SALE_DAILY, extra_env=extra_env)
            if args.domain in ("rent", "all"):
                _run_py(RENT_DAILY, extra_env=extra_env)

            _run_py(GEOCODE, extra_env=extra_env)

        if args.refresh:
            _refresh_api()

        print("\n[OK] pipeline finished")

    except subprocess.CalledProcessError as e:
        print(f"\n[FAIL] command failed: {e}")
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()
