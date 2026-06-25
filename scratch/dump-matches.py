import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/data/goalrush.db"))

if not os.path.exists(db_path):
    print(f"DB not found at: {db_path}")
    exit(1)

print(f"Reading matches from: {db_path}")
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, home_team, away_team, status, kickoff_utc, competition FROM matches ORDER BY kickoff_utc DESC")
    matches = cursor.fetchall()
    print(f"Found {len(matches)} matches in database:\n")
    for m in matches:
        print(f"- ID: {m[0]} | {m[1]} vs {m[2]}")
        print(f"  Status: {m[3]} | Kickoff: {m[4]}")
        print(f"  Competition: {m[5]}\n")
    conn.close()
except Exception as e:
    print(f"Error querying DB: {e}")
