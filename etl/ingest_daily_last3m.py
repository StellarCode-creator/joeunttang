import os
import time
import requests
import psycopg2
from psycopg2.extras import execute_batch
import xml.etree.ElementTree as ET
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

def _load_env():
    repo_root = Path(__file__).resolve().parents[1]
    env_path = repo_root / "backend" / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        return str(env_path)
    load_dotenv()
    return None

_ENV_PATH = _load_env()

BASE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
SERVICE_KEY = os.environ.get("MOLIT_SERVICE_KEY", "").strip()

DB_HOST = os.environ.get("PGHOST", "localhost").strip()
DB_PORT = int(os.environ.get("PGPORT", "5432").strip())
DB_NAME = os.environ.get("PGDATABASE", "proptech").strip()
DB_USER = os.environ.get("PGUSER", "postgres").strip()
DB_PASSWORD = os.environ.get("PGPASSWORD", "").strip()

LAWD_CDS = [x.strip() for x in os.environ.get("LAWD_CDS", "50110,50130").split(",") if x.strip()]
LOOKBACK_MONTHS = int(os.environ.get("DAILY_LOOKBACK_MONTHS", "3"))

NUM_OF_ROWS = 1000
SLEEP_SEC = 0.15
TIMEOUT = 20

INSERT_SQL = """
INSERT INTO apt_trade (
  lawd_cd, deal_ymd, umd_nm, apt_nm, jibun,
  deal_year, deal_month, deal_day,
  deal_amount_manwon, exclu_use_ar, floor, build_year,
  dealing_gbn, estate_agent_sgg_nm, rgst_date, apt_dong,
  cdeal_type, cdeal_day, sler_gbn, buyer_gbn, land_leasehold_gbn
) VALUES (
  %(lawd_cd)s, %(deal_ymd)s, %(umd_nm)s, %(apt_nm)s, %(jibun)s,
  %(deal_year)s, %(deal_month)s, %(deal_day)s,
  %(deal_amount_manwon)s, %(exclu_use_ar)s, %(floor)s, %(build_year)s,
  %(dealing_gbn)s, %(estate_agent_sgg_nm)s, %(rgst_date)s, %(apt_dong)s,
  %(cdeal_type)s, %(cdeal_day)s, %(sler_gbn)s, %(buyer_gbn)s, %(land_leasehold_gbn)s
)
ON CONFLICT DO NOTHING;
"""

def months_last_n(n: int):
    now = datetime.now()
    y, m = now.year, now.month
    out = []
    for i in range(n):
        yy = y
        mm = m - i
        while mm <= 0:
            yy -= 1
            mm += 12
        out.append(f"{yy:04d}{mm:02d}")
    return sorted(set(out))

def text_or_none(el, tag):
    t = el.findtext(tag)
    return t.strip() if t and t.strip() else None

def to_int_amount(s):
    if not s:
        return None
    return int(s.replace(",", ""))

def to_float(s):
    if not s:
        return None
    return float(s)

def fetch_page(lawd_cd, deal_ymd, page_no):
    if not SERVICE_KEY:
        raise RuntimeError("MOLIT_SERVICE_KEY(.env) 비어있음(인코딩 키 필요)")
    params = {
        "serviceKey": SERVICE_KEY,
        "LAWD_CD": lawd_cd,
        "DEAL_YMD": deal_ymd,
        "pageNo": str(page_no),
        "numOfRows": str(NUM_OF_ROWS),
    }
    r = requests.get(BASE_URL, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.text

def parse(xml_text):
    root = ET.fromstring(xml_text)
    code = (root.findtext("./header/resultCode") or "").strip()
    msg = (root.findtext("./header/resultMsg") or "").strip()
    if code != "000":
        return code, msg, 0, []

    total_count_text = (root.findtext("./body/totalCount") or "0").strip()
    total_count = int(total_count_text) if total_count_text.isdigit() else 0

    items = []
    for it in root.findall("./body/items/item"):
        sgg_cd = text_or_none(it, "sggCd")
        umd_nm = text_or_none(it, "umdNm")
        apt_nm = text_or_none(it, "aptNm")
        jibun = text_or_none(it, "jibun")

        deal_year = int(text_or_none(it, "dealYear") or 0)
        deal_month = int(text_or_none(it, "dealMonth") or 0)
        deal_day = int(text_or_none(it, "dealDay") or 0)
        deal_amount = to_int_amount(text_or_none(it, "dealAmount") or "")
        exclu = to_float(text_or_none(it, "excluUseAr") or "")
        floor = int(text_or_none(it, "floor") or 0) if text_or_none(it, "floor") else None
        build_year = int(text_or_none(it, "buildYear") or 0) if text_or_none(it, "buildYear") else None

        if not (sgg_cd and umd_nm and apt_nm and deal_year and deal_month and deal_day and deal_amount is not None):
            continue

        items.append({
            "lawd_cd": sgg_cd,
            "deal_ymd": f"{deal_year:04d}{deal_month:02d}",
            "umd_nm": umd_nm,
            "apt_nm": apt_nm,
            "jibun": jibun,
            "deal_year": deal_year,
            "deal_month": deal_month,
            "deal_day": deal_day,
            "deal_amount_manwon": deal_amount,
            "exclu_use_ar": exclu,
            "floor": floor,
            "build_year": build_year,
            "dealing_gbn": text_or_none(it, "dealingGbn"),
            "estate_agent_sgg_nm": text_or_none(it, "estateAgentSggNm"),
            "rgst_date": text_or_none(it, "rgstDate"),
            "apt_dong": text_or_none(it, "aptDong"),
            "cdeal_type": text_or_none(it, "cdealType"),
            "cdeal_day": text_or_none(it, "cdealDay"),
            "sler_gbn": text_or_none(it, "slerGbn"),
            "buyer_gbn": text_or_none(it, "buyerGbn"),
            "land_leasehold_gbn": text_or_none(it, "landLeaseholdGbn"),
        })
    return code, msg, total_count, items

def main():
    if not DB_PASSWORD:
        raise RuntimeError("PGPASSWORD(.env) 비어있음")
    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD)
    conn.autocommit = False

    target_months = months_last_n(LOOKBACK_MONTHS)
    print(f"Target months: {target_months}, LAWD_CDS={LAWD_CDS}")

    try:
        with conn.cursor() as cur:
            for lawd in LAWD_CDS:
                for yyyymm in target_months:
                    page = 1
                    fetched = 0
                    while True:
                        time.sleep(SLEEP_SEC)
                        xml_text = fetch_page(lawd, yyyymm, page)
                        code, msg, total_count, items = parse(xml_text)

                        if code != "000":
                            print(f"[{lawd} {yyyymm}] {code} {msg}")
                            break
                        if not items:
                            break

                        execute_batch(cur, INSERT_SQL, items, page_size=500)
                        conn.commit()

                        fetched += len(items)
                        if page * NUM_OF_ROWS >= total_count:
                            break
                        page += 1

                    print(f"[{lawd} {yyyymm}] fetched_items={fetched}")

        with conn.cursor() as cur2:
            cur2.execute("SELECT COUNT(*) FROM apt_trade;")
            print("apt_trade total =", cur2.fetchone()[0])

    finally:
        conn.close()

if __name__ == "__main__":
    main()
