"""One-time backfill utilities.

1. Fills audit_logs.device / location / latitude / longitude for rows that
   predate those columns, deriving them from the stored user_agent and IP.
2. Claims user-data rows (scheduled reports etc.) that were created before
   multi-tenant scoping and have a NULL business_id — they're assigned to
   their owner's business so they don't vanish after the scoping fix.

Safe to re-run (only touches rows that are still missing values).
"""
import os
import sys

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text  # noqa: E402

from app.core.client_info import geolocate, parse_device  # noqa: E402

engine = create_engine(os.getenv("DATABASE_URL"))

LOCAL_IPS = ("127.0.0.1", "::1", "localhost", "0.0.0.0", "unknown", "")


def backfill_audit_context():
    updated = 0
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT id, ip_address, user_agent, location, latitude, device "
                "FROM audit_logs WHERE location IS NULL OR latitude IS NULL OR device IS NULL"
            )
        ).fetchall()
        print(f"audit rows needing context: {len(rows)}")
        for row_id, ip, ua, location, lat, device in rows:
            new_loc, new_lat, new_lng, new_dev = location, lat, None, device
            if not device and ua:
                new_dev = parse_device(ua)
            if not location:
                if ip in LOCAL_IPS:
                    new_loc = "Local"
                else:
                    new_loc, new_lat, new_lng = geolocate(ip)
            elif lat is None and ip not in LOCAL_IPS:
                _l, new_lat, new_lng = geolocate(ip)
            if new_lat is None and new_loc and new_loc not in ("Local", "Unknown"):
                _l, new_lat, new_lng = geolocate(ip)
            conn.execute(
                text(
                    "UPDATE audit_logs SET device=:d, location=:loc, latitude=:lat, "
                    "longitude=:lng WHERE id=:id"
                ),
                {
                    "d": new_dev,
                    "loc": new_loc,
                    "lat": new_lat,
                    "lng": new_lng,
                    "id": row_id,
                },
            )
            updated += 1
        conn.commit()
    print(f"audit rows updated: {updated}")


def claim_orphaned_user_data():
    """Assign NULL-business_id rows to their owner's business (or business 3)."""
    claimed = 0
    with engine.connect() as conn:
        # Tables with a user_id column: resolve via the user's business.
        for table in ("dashboard_layouts", "chat_history"):
            conn.execute(
                text(
                    f"UPDATE {table} SET business_id = "
                    f"(SELECT business_id FROM users WHERE users.id = {table}.user_id) "
                    f"WHERE business_id IS NULL AND user_id IS NOT NULL"
                )
            )
        # Tables without user_id: no way to attribute — assign to the demo
        # business (3) that created them before scoping existed.
        for table in ("scheduled_reports", "custom_report_templates", "prediction_history"):
            conn.execute(text(f"UPDATE {table} SET business_id = 3 WHERE business_id IS NULL"))
        conn.commit()
        for table in ("scheduled_reports", "dashboard_layouts", "custom_report_templates", "prediction_history", "chat_history"):
            left = conn.execute(text(f"SELECT count(*) FROM {table} WHERE business_id IS NULL")).scalar()
            total = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
            print(f"{table}: {total} rows, {left} still unclaimed")
            claimed += total
    return claimed


if __name__ == "__main__":
    backfill_audit_context()
    claim_orphaned_user_data()