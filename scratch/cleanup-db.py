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
        print(f"Cleaning DB at: {db_path}")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check initial count
        cursor.execute("SELECT COUNT(*) FROM matches")
        before_count = cursor.fetchone()[0]

        # Delete non-World Cup matches
        cursor.execute("DELETE FROM matches WHERE competition NOT LIKE '%World Cup%'")
        deleted_count = cursor.rowcount

        conn.commit()

        # Check final count
        cursor.execute("SELECT COUNT(*) FROM matches")
        after_count = cursor.fetchone()[0]

        print(f"  - Deleted {deleted_count} non-World Cup matches.")
        print(f"  - Matches remaining: {after_count} (was {before_count}).")
        conn.close()
    except Exception as e:
        print(f"Error cleaning DB at {db_path}: {e}")
