import os
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine, text

engine = create_engine(os.getenv("DATABASE_URL"))
with engine.connect() as c:
    rows = c.execute(text(
        """
        SELECT a.id, a.action, a.details, a.created_at, u.email
        FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
        WHERE u.email = 'neelamrishikadamini@gmail.com'
        ORDER BY a.created_at DESC LIMIT 15
        """
    )).fetchall()
    print("recent entries:")
    for r in rows:
        print(r)
    total = c.execute(text(
        """
        SELECT count(*) FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE u.email = 'neelamrishikadamini@gmail.com'
        """
    )).scalar()
    print("TOTAL entries for this user:", total)

    # What actions are in there?
    acts = c.execute(text(
        """
        SELECT a.action, count(*) FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE u.email = 'neelamrishikadamini@gmail.com'
        GROUP BY a.action ORDER BY count(*) DESC
        """
    )).fetchall()
    print("action breakdown:")
    for r in acts:
        print(r)
