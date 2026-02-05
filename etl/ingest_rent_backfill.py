import os
import time
import requests
import psycopg2
from psycopg2.extras import execute_batch
import xml.etree.ElementTree as ET
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# -----------------------------
# env 로딩 (repo_root/backend/.env)
# -----------------------------
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
# 설정 (제주만 기본)
# -----------------------------
SERVICE_KEY = os.environ.get("MOLIT_SERVICE_KEY", "").strip()

DB_HOST = os.environ.get("PGHOST", "localhost").strip()
DB_PORT = int(os.environ.get("PGPORT", "5432").strip())
DB_NAME = os.environ.get("PGDATABASE", "proptech").strip()
DB_USER = os.environ.get("PGUSER", "postgres").strip()
DB_PASSWORD = os.environ.get("PGPASSWORD", "").strip()

# ✅ 기본값: 제주만 (요청사항). 필요 시 env로 오버라이드 가능
_DEFAULT_LAWD = "50110,50130"
LAWD_CDS = [x.strip() for x in os.environ.get("LAWD_CDS", _DEFAULT_LAWD).split(",") if x.strip()]

# backfill 범위 (env로 오버라이드)
START_YYYYMM = os.environ.get("START_YYYYMM", "200601").strip()
END_YYYYMM = os.environ.get("END_YYYYMM", "201912").strip()

NUM_OF_ROWS = 1000
SLEEP_SEC = 0.15
TIMEOUT = 25

# 전월세 API
BASE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent"

# -----------------------------
# SQL (RAW + DOMAIN)
# -----------------------------
RAW_INSERT = """
INSERT INTO raw_apt_rent (
  lawd_cd, deal_ymd, page_no, num_of_rows,
  result_code, result_msg, total_count,
  payload_xml
) VALUES (
  %(lawd_cd)s, %(deal_ymd)s, %(page_no)s, %(num_of_rows)s,
  %(result_code)s, %(result_msg)s, %(total_count)s,
  %(payload_xml)s
);
"""

DOMAIN_INSERT = """
INSERT INTO apt_trade_rent (
  lawd_cd, deal_ymd, umd_nm, apt_nm, jibun,
  deal_year, deal_month, deal_day,
  deposit_manwon, monthly_rent_manwon,
  contract_term, contract_type, use_rr_right,
  pre_deposit_manwon, pre_monthly_rent_manwon
) VALUES (
  %(lawd_cd)s, %(deal_ymd)s, %(umd_nm)s, %(apt_nm)s, %(jibun)s,
  %(deal_year)s, %(deal_month)s, %(deal_day)s,
  %(deposit_manwon)s, %(monthly_rent_manwon)s,
  %(contract_term)s, %(contract_type)s, %(use_rr_right)s,
  %(pre_deposit_manwon)s, %(pre_monthly_rent_manwon)s
)
ON CONFLICT DO NOTHING;
"""

# -----------------------------
# 유틸
# -----------------------------
def yyyymm_range(start_yyyymm: str, end_yyyymm: str):
    s = datetime.strptime(start_yyyymm, "%Y%m")
    e = datetime.strptime(end_yyyymm, "%Y%m")
    cur = s
    while cur <= e:
        yield cur.strftime("%Y%m")
        year = cur.year + (cur.month // 12)
        month = (cur.month % 12) + 1
        cur = cur.replace(year=year, month=month)

def text_or_none(el, tag: str):
    t = el.findtext(tag)
    if t is None:
        return None
    t = t.strip()
    return t if t else None

def to_int_manwon(s: str | None):
    if s is None:
        return None
    s = s.strip()
    if not s:
        return None
    return int(s.replace(",", ""))

def fetch_page(lawd_cd: str, deal_ymd: str, page_no: int):
    if not SERVICE_KEY:
        raise RuntimeError("MOLIT_SERVICE_KEY(.env) 비어있음 (인코딩 키 필요)")
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

def parse(xml_text: str):
    root = ET.fromstring(xml_text)

    code = (root.findtext("./header/resultCode") or "").strip()
    msg = (root.findtext("./header/resultMsg") or "").strip()

    total_count_text = (root.findtext("./body/totalCount") or "0").strip()
    total_count = int(total_count_text) if total_count_text.isdigit() else 0

    if code != "000":
        return code, msg, total_count, []

    items = []
    for it in root.findall("./body/items/item"):
        # 전월세 응답 필드(안전하게)
        lawd_cd = text_or_none(it, "sggCd") or text_or_none(it, "법정동시군구코드")
        umd_nm = text_or_none(it, "umdNm") or text_or_none(it, "법정동")
        apt_nm = text_or_none(it, "aptNm") or text_or_none(it, "아파트")
        jibun  = text_or_none(it, "jibun") or text_or_none(it, "지번")

        deal_year  = text_or_none(it, "dealYear") or text_or_none(it, "년")
        deal_month = text_or_none(it, "dealMonth") or text_or_none(it, "월")
        deal_day   = text_or_none(it, "dealDay") or text_or_none(it, "일")

        deposit = text_or_none(it, "deposit") or text_or_none(it, "보증금액")
        monthly = text_or_none(it, "monthlyRent") or text_or_none(it, "월세금액")

        contract_term = text_or_none(it, "contractTerm")
        contract_type = text_or_none(it, "contractType")
        use_rr_right  = text_or_none(it, "useRRRight")

        pre_deposit = text_or_none(it, "preDeposit")
        pre_monthly = text_or_none(it, "preMonthlyRent")

        if not (lawd_cd and umd_nm and apt_nm and deal_year and deal_month and deal_day):
            continue

        dy = int(deal_year)
        dm = int(deal_month)
        dd = int(deal_day)

        items.append({
            "lawd_cd": lawd_cd,
            "deal_ymd": f"{dy:04d}{dm:02d}",
            "umd_nm": umd_nm,
            "apt_nm": apt_nm,
            "jibun": jibun,
            "deal_year": dy,
            "deal_month": dm,
            "deal_day": dd,
            "deposit_manwon": to_int_manwon(deposit),
            "monthly_rent_manwon": to_int_manwon(monthly),
            "contract_term": contract_term,
            "contract_type": contract_type,
            "use_rr_right": use_rr_right,
            "pre_deposit_manwon": to_int_manwon(pre_deposit),
            "pre_monthly_rent_manwon": to_int_manwon(pre_monthly),
        })

    return code, msg, total_count, items

# -----------------------------
# main
# -----------------------------
def main():
    if not DB_PASSWORD:
        raise RuntimeError("PGPASSWORD(.env) 비어있음")

    print(f"[rent_backfill] START_YYYYMM={START_YYYYMM} END_YYYYMM={END_YYYYMM} LAWD_CDS={LAWD_CDS}")

    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD
    )
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            for lawd in LAWD_CDS:
                for yyyymm in yyyymm_range(START_YYYYMM, END_YYYYMM):
                    page = 1
                    fetched = 0
                    while True:
                        time.sleep(SLEEP_SEC)
                        xml_text = fetch_page(lawd, yyyymm, page)
                        code, msg, total_count, items = parse(xml_text)

                        # RAW 저장(항상)
                        cur.execute(
                            RAW_INSERT,
                            {
                                "lawd_cd": lawd,
                                "deal_ymd": yyyymm,
                                "page_no": page,
                                "num_of_rows": NUM_OF_ROWS,
                                "result_code": code,
                                "result_msg": msg,
                                "total_count": total_count,
                                "payload_xml": xml_text,
                            },
                        )
                        conn.commit()

                        if code != "000":
                            print(f"[rent {lawd} {yyyymm}] API {code} {msg}")
                            break

                        if not items:
                            break

                        execute_batch(cur, DOMAIN_INSERT, items, page_size=500)
                        conn.commit()

                        fetched += len(items)

                        if page * NUM_OF_ROWS >= total_count:
                            break
                        page += 1

                    print(f"[rent {lawd} {yyyymm}] fetched_items={fetched}")

        with conn.cursor() as c2:
            c2.execute("SELECT COUNT(*) FROM apt_trade_rent;")
            total = c2.fetchone()[0]
        print(f"[rent_backfill] Done. apt_trade_rent total={total}")

    finally:
        conn.close()

if __name__ == "__main__":
    main()
