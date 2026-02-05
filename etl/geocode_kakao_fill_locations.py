import os
import time
import requests
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv
from pathlib import Path


def _load_env():
    """현재 작업 디렉토리와 무관하게 repo_root/backend/.env를 우선 로드."""
    repo_root = Path(__file__).resolve().parents[1]
    candidates = [
        repo_root / "backend" / ".env",
        repo_root / ".env",
    ]
    for p in candidates:
        if p.exists():
            load_dotenv(p)
            return str(p)
    load_dotenv()
    return None


_ENV_PATH = _load_env()

DB_HOST = os.environ.get("PGHOST", "localhost").strip()
DB_PORT = int(os.environ.get("PGPORT", "5432").strip())
DB_NAME = os.environ.get("PGDATABASE", "proptech").strip()
DB_USER = os.environ.get("PGUSER", "postgres").strip()
DB_PASSWORD = os.environ.get("PGPASSWORD", "").strip()

KAKAO_KEY = os.environ.get("KAKAO_REST_API_KEY", "").strip()
SLEEP_SEC = 0.12
BATCH = 200

# 제주 지역코드(5자리) -> 시군구 이름(주소 문자열에 넣기)
CITY_BY_LAWD = {
    "50110": "제주시",
    "50130": "서귀포시",
}

ADDR_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

# ✅ 변경: apt_trade -> v_apt_places (매매+전월세 통합)
SELECT_MISSING = """
SELECT DISTINCT t.lawd_cd, t.umd_nm, t.apt_nm, t.jibun
FROM v_apt_places t
LEFT JOIN apt_location l
  ON t.lawd_cd = l.lawd_cd
 AND t.umd_nm  = l.umd_nm
 AND t.apt_nm  = l.apt_nm
 AND COALESCE(t.jibun,'') = COALESCE(l.jibun,'')
WHERE l.id IS NULL
  AND t.lawd_cd IN ('50110','50130')
LIMIT %s;
"""

UPSERT_LOC = """
INSERT INTO apt_location (
  lawd_cd, umd_nm, apt_nm, jibun,
  lat, lng, geom,
  kakao_address, kakao_place_id
) VALUES (
  %(lawd_cd)s, %(umd_nm)s, %(apt_nm)s, %(jibun)s,
  %(lat)s, %(lng)s,
  ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326),
  %(kakao_address)s, %(kakao_place_id)s
)
ON CONFLICT (lawd_cd, umd_nm, apt_nm, jibun)
DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  geom = EXCLUDED.geom,
  kakao_address = EXCLUDED.kakao_address,
  kakao_place_id = EXCLUDED.kakao_place_id,
  updated_at = now();
"""

INSERT_FAIL = """
INSERT INTO geocode_fail (lawd_cd, umd_nm, apt_nm, jibun, query_text, reason)
VALUES (%s, %s, %s, %s, %s, %s);
"""


def kakao_get(url, query):
    headers = {"Authorization": f"KakaoAK {KAKAO_KEY}"}
    r = requests.get(url, headers=headers, params={"query": query}, timeout=15)
    r.raise_for_status()
    return r.json()


def geocode_one(lawd_cd, umd_nm, apt_nm, jibun):
    # 주소 문자열(성공률 높은 순서로 시도)
    city = CITY_BY_LAWD.get(lawd_cd, "")
    # 1) 지번 주소 검색 (가장 안정적)
    if city and umd_nm and jibun:
        q1 = f"제주특별자치도 {city} {umd_nm} {jibun}"
        j = kakao_get(ADDR_URL, q1)
        docs = j.get("documents", [])
        if docs:
            d = docs[0]
            x = float(d["x"])
            y = float(d["y"])
            addr = (d.get("address") or {}).get("address_name") or d.get("address_name")
            return {"lat": y, "lng": x, "kakao_address": addr, "kakao_place_id": None}

    # 2) 키워드(단지명) 검색 fallback
    if city and apt_nm:
        q2 = f"{apt_nm} {city}"
        j = kakao_get(KEYWORD_URL, q2)
        docs = j.get("documents", [])
        if docs:
            d = docs[0]
            x = float(d["x"])
            y = float(d["y"])
            addr = d.get("address_name") or d.get("road_address_name")
            pid = d.get("id")
            return {"lat": y, "lng": x, "kakao_address": addr, "kakao_place_id": pid}

    return None


def main():
    if not DB_PASSWORD:
        raise RuntimeError("PGPASSWORD(.env) 비어있음")
    if not KAKAO_KEY:
        raise RuntimeError("KAKAO_REST_API_KEY(.env) 비어있음")

    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD
    )
    conn.autocommit = False

    try:
        total_done = 0
        while True:
            with conn.cursor() as cur:
                cur.execute(SELECT_MISSING, (BATCH,))
                rows = cur.fetchall()

            if not rows:
                print("No missing locations. Done.")
                break

            upserts = []
            fails = 0

            for lawd_cd, umd_nm, apt_nm, jibun in rows:
                time.sleep(SLEEP_SEC)
                try:
                    res = geocode_one(lawd_cd, umd_nm, apt_nm, jibun)
                    if res is None:
                        fails += 1
                        with conn.cursor() as curf:
                            qtxt = f"{lawd_cd}|{umd_nm}|{jibun}|{apt_nm}"
                            curf.execute(
                                INSERT_FAIL, (lawd_cd, umd_nm, apt_nm, jibun, qtxt, "no result")
                            )
                            conn.commit()
                        continue

                    upserts.append(
                        {
                            "lawd_cd": lawd_cd,
                            "umd_nm": umd_nm,
                            "apt_nm": apt_nm,
                            "jibun": jibun,
                            "lat": res["lat"],
                            "lng": res["lng"],
                            "kakao_address": res["kakao_address"],
                            "kakao_place_id": res["kakao_place_id"],
                        }
                    )

                except Exception as e:
                    fails += 1
                    with conn.cursor() as curf:
                        qtxt = f"{lawd_cd}|{umd_nm}|{jibun}|{apt_nm}"
                        curf.execute(INSERT_FAIL, (lawd_cd, umd_nm, apt_nm, jibun, qtxt, str(e)))
                        conn.commit()

            if upserts:
                with conn.cursor() as curu:
                    execute_batch(curu, UPSERT_LOC, upserts, page_size=200)
                conn.commit()

            total_done += len(rows)
            print(
                f"batch_done={len(rows)} upserted={len(upserts)} fails={fails} total_processed={total_done}"
            )

    finally:
        conn.close()


if __name__ == "__main__":
    main()
