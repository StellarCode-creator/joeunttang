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

# -----------------------------
# 설정
# -----------------------------
SERVICE_KEY = os.environ.get("MOLIT_SERVICE_KEY", "").strip()
DB_HOST = os.environ.get("PGHOST", "localhost").strip()
DB_PORT = int(os.environ.get("PGPORT", "5432").strip())
DB_NAME = os.environ.get("PGDATABASE", "proptech").strip()
DB_USER = os.environ.get("PGUSER", "postgres").strip()
DB_PASSWORD = os.environ.get("PGPASSWORD", "").strip()

# 수집 범위(env로 오버라이드 가능)
START_YYYYMM = os.environ.get("START_YYYYMM", "200601").strip()
END_YYYYMM = os.environ.get("END_YYYYMM", "201912").strip()
LAWD_CDS = [x.strip() for x in os.environ.get("LAWD_CDS", "50110,50130").split(",") if x.strip()]

BASE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"

NUM_OF_ROWS = 1000
SLEEP_SEC = 0.15
TIMEOUT = 20

def yyyymm_range(start_yyyymm: str, end_yyyymm: str):
    s = datetime.strptime(start_yyyymm, "%Y%m")
    e = datetime.strptime(end_yyyymm, "%Y%m")
    cur = s
    while cur <= e:
        yield cur.strftime("%Y%m")
        year = cur.year + (cur.month // 12)
        month = (cur.month % 12) + 1
        cur = cur.replace(year=year, month=month)

def to_int_amount_manwon(s: str):
    if s is None:
        return None
    s = s.strip()
    if not s:
        return None
    return int(s.replace(",", ""))

def to_float(s: str):
    if s is None:
        return None
    s = s.strip()
    if not s:
        return None
    return float(s)

def text_or_none(el, tag: str):
    t = el.findtext(tag)
    return t.strip() if t is not None and t.strip() != "" else None

def fetch_page(lawd_cd: str, deal_ymd: str, page_no: int):
    if not SERVICE_KEY:
        raise RuntimeError("MOLIT_SERVICE_KEY 환경변수가 비어 있습니다. (인코딩 키를 넣으세요)")

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

def parse_response(xml_text: str):
    root = ET.fromstring(xml_text)
    result_code = root.findtext("./header/resultCode")
    result_msg = root.findtext("./header/resultMsg")

    if result_code is None:
        raise RuntimeError("응답에서 resultCode를 찾지 못했습니다.")

    result_code = result_code.strip()
    result_msg = (result_msg or "").strip()

    if result_code != "000":
        return {"ok": False, "result_code": result_code, "result_msg": result_msg, "total_count": 0, "items": []}

    total_count_text = root.findtext("./body/totalCount")
    total_count = int(total_count_text.strip()) if total_count_text and total_count_text.strip().isdigit() else 0

    items = []
    for item_el in root.findall("./body/items/item"):
        sgg_cd = text_or_none(item_el, "sggCd")
        umd_nm = text_or_none(item_el, "umdNm")
        apt_nm = text_or_none(item_el, "aptNm")
        jibun = text_or_none(item_el, "jibun")
        exclu = to_float(text_or_none(item_el, "excluUseAr"))
        deal_year = int(text_or_none(item_el, "dealYear") or 0)
        deal_month = int(text_or_none(item_el, "dealMonth") or 0)
        deal_day = int(text_or_none(item_el, "dealDay") or 0)
        deal_amount = to_int_amount_manwon(text_or_none(item_el, "dealAmount"))
        floor = int(text_or_none(item_el, "floor") or 0) if text_or_none(item_el, "floor") else None
        build_year = int(text_or_none(item_el, "buildYear") or 0) if text_or_none(item_el, "buildYear") else None

        dealing_gbn = text_or_none(item_el, "dealingGbn")
        estate_agent_sgg_nm = text_or_none(item_el, "estateAgentSggNm")
        rgst_date = text_or_none(item_el, "rgstDate")
        apt_dong = text_or_none(item_el, "aptDong")
        cdeal_type = text_or_none(item_el, "cdealType")
        cdeal_day = text_or_none(item_el, "cdealDay")
        sler_gbn = text_or_none(item_el, "slerGbn")
        buyer_gbn = text_or_none(item_el, "buyerGbn")
        land_leasehold_gbn = text_or_none(item_el, "landLeaseholdGbn")

        if not (sgg_cd and umd_nm and apt_nm and deal_year and deal_month and deal_day and deal_amount is not None):
            continue

        items.append({
            "lawd_cd": sgg_cd,
            "deal_ymd": f"{deal_year:04d}{deal_month:02d}",
            "umd_nm": umd_nm,
            "apt_nm": apt_nm,
            "jibun": jibun,
            "exclu_use_ar": exclu,
            "deal_year": deal_year,
            "deal_month": deal_month,
            "deal_day": deal_day,
            "deal_amount_manwon": deal_amount,
            "floor": floor,
            "build_year": build_year,
            "dealing_gbn": dealing_gbn,
            "estate_agent_sgg_nm": estate_agent_sgg_nm,
            "rgst_date": rgst_date,
            "apt_dong": apt_dong,
            "cdeal_type": cdeal_type,
            "cdeal_day": cdeal_day,
            "sler_gbn": sler_gbn,
            "buyer_gbn": buyer_gbn,
            "land_leasehold_gbn": land_leasehold_gbn,
        })

    return {"ok": True, "result_code": result_code, "result_msg": result_msg, "total_count": total_count, "items": items}

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

def main():
    if not DB_PASSWORD:
        raise RuntimeError("PGPASSWORD 환경변수가 비어 있습니다. postgres 비밀번호를 넣으세요.")

    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            for lawd_cd in LAWD_CDS:
                for yyyymm in yyyymm_range(START_YYYYMM, END_YYYYMM):
                    page_no = 1
                    month_seen = 0

                    while True:
                        time.sleep(SLEEP_SEC)
                        xml_text = fetch_page(lawd_cd, yyyymm, page_no)
                        parsed = parse_response(xml_text)

                        if not parsed["ok"]:
                            print(f"[{lawd_cd} {yyyymm}] API not ok: {parsed['result_code']} {parsed['result_msg']}")
                            break

                        items = parsed["items"]
                        if not items:
                            break

                        execute_batch(cur, INSERT_SQL, items, page_size=500)
                        conn.commit()

                        month_seen += len(items)

                        total_count = parsed["total_count"]
                        if page_no * NUM_OF_ROWS >= total_count:
                            break
                        page_no += 1

                    print(f"[{lawd_cd} {yyyymm}] fetched_items={month_seen}")

        with conn.cursor() as cur2:
            cur2.execute("SELECT COUNT(*) FROM apt_trade;")
            final_count = cur2.fetchone()[0]
        print(f"Done. apt_trade COUNT(*) = {final_count}")

    finally:
        conn.close()

if __name__ == "__main__":
    main()
