# ETL Pipeline

## Daily update
python etl/run_pipeline.py --mode daily

## Backfill
python etl/run_pipeline.py --mode backfill --start 202401 --end 202412



## 실행 방법
python etl/ingest_apt_trade.py
python etl/geocode_kakao_fill_locations.py


사용 예시

전월세 3개월 + 지오코딩: python etl/run_pipeline.py --domain rent --mode daily

매매+전월세 3개월 + 지오코딩: python etl/run_pipeline.py --domain all --mode daily

지오코딩만: python etl/run_pipeline.py --mode geocode