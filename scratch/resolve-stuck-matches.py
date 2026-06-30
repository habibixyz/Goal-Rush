import sqlite3
import os

paths = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/data/goalrush.db")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../football-engine/backend/data/goalrush.db"))
]

for db_path in paths:
    if not os.path.exists(db_path):
        print(f"DB not found at: {db_path}, skipping.")
        continue

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        print(f"Checking/Updating DB at: {db_path}")

        # Update Germany vs Paraguay (espn_760489) and Netherlands vs Morocco (espn_760488) to FINISHED status
        cursor.execute("UPDATE matches SET status = 'FINISHED' WHERE id IN ('espn_760489', 'espn_760488')")
        conn.commit()

        print(f"  - Updated {cursor.rowcount} matches to FINISHED.")

        # Verify the status
        cursor.execute("SELECT id, home_team, away_team, status FROM matches WHERE id IN ('espn_760489', 'espn_760488')")
        matches = cursor.fetchall()
        for m in matches:
            print(f"  - Match: {m[1]} vs {m[2]} | Status: {m[3]}")

        conn.close()
    except Exception as e:
        print(f"Error updating DB at {db_path}: {e}")
