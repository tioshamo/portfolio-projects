import sqlite3
import json
import random
from datetime import datetime, timedelta

DB_PATH = "vocab.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS vocabulary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL UNIQUE,
            meaning TEXT,
            pronunciation TEXT,
            katakana TEXT,
            part_of_speech TEXT,
            example TEXT,
            difficulty INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS hidden_words (
            word TEXT PRIMARY KEY,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            completed_at TEXT,
            score INTEGER,
            total INTEGER
        );

        CREATE TABLE IF NOT EXISTS test_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id INTEGER NOT NULL,
            vocab_id INTEGER NOT NULL,
            user_answer TEXT,
            is_correct INTEGER,
            FOREIGN KEY (test_id) REFERENCES tests(id),
            FOREIGN KEY (vocab_id) REFERENCES vocabulary(id)
        );

        CREATE TABLE IF NOT EXISTS quiz_pool (
            vocab_id INTEGER PRIMARY KEY,
            FOREIGN KEY (vocab_id) REFERENCES vocabulary(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)

    # Insert default settings if not exist
    defaults = {
        "questions_per_test": "10",
        "daily_count": "2",
        "generation_times": '["07:00", "22:00"]',
        "last_startup": "",
    }
    for key, value in defaults.items():
        c.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (key, value))

    conn.commit()
    conn.close()


def get_setting(key):
    conn = get_conn()
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else None


def set_setting(key, value):
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
    conn.close()


# ── Vocabulary ──────────────────────────────────────────────────────────────

def add_vocabulary(word, meaning, pronunciation, katakana, part_of_speech, example):
    conn = get_conn()
    try:
        conn.execute(
            """INSERT OR IGNORE INTO vocabulary
               (word, meaning, pronunciation, katakana, part_of_speech, example)
               VALUES (?,?,?,?,?,?)""",
            (word, meaning, pronunciation, katakana, part_of_speech, example),
        )
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


def get_vocabulary_list():
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM vocabulary ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_vocabulary_by_id(vocab_id):
    conn = get_conn()
    row = conn.execute("SELECT * FROM vocabulary WHERE id=?", (vocab_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_vocabulary(vocab_id):
    conn = get_conn()
    conn.execute("DELETE FROM vocabulary WHERE id=?", (vocab_id,))
    conn.commit()
    conn.close()


def update_difficulty(vocab_id, difficulty):
    conn = get_conn()
    conn.execute("UPDATE vocabulary SET difficulty=? WHERE id=?", (difficulty, vocab_id))
    conn.commit()
    conn.close()


# ── Hidden words ─────────────────────────────────────────────────────────────

def add_hidden_word(word):
    conn = get_conn()
    conn.execute("INSERT OR IGNORE INTO hidden_words (word) VALUES (?)", (word.lower(),))
    conn.commit()
    conn.close()


def remove_hidden_word(word):
    conn = get_conn()
    conn.execute("DELETE FROM hidden_words WHERE word=?", (word.lower(),))
    conn.commit()
    conn.close()


def get_hidden_words():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM hidden_words ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def is_hidden(word):
    conn = get_conn()
    row = conn.execute("SELECT 1 FROM hidden_words WHERE word=?", (word.lower(),)).fetchone()
    conn.close()
    return row is not None


# ── Quiz pool ────────────────────────────────────────────────────────────────

def _sync_quiz_pool(conn):
    """Add newly registered words that are not yet in the pool."""
    conn.execute("""
        INSERT OR IGNORE INTO quiz_pool (vocab_id)
        SELECT id FROM vocabulary
        WHERE id NOT IN (SELECT vocab_id FROM quiz_pool)
    """)


def pick_words_for_test(n):
    """Pick n random words from the quiz pool. Resets pool when exhausted."""
    conn = get_conn()
    _sync_quiz_pool(conn)

    pool = conn.execute("""
        SELECT v.id, v.word, v.meaning FROM vocabulary v
        INNER JOIN quiz_pool qp ON v.id = qp.vocab_id
    """).fetchall()

    total_vocab = conn.execute("SELECT COUNT(*) AS cnt FROM vocabulary").fetchone()["cnt"]

    if total_vocab == 0:
        conn.close()
        return []

    if len(pool) == 0:
        # Reset pool
        conn.execute("DELETE FROM quiz_pool")
        conn.execute("INSERT INTO quiz_pool (vocab_id) SELECT id FROM vocabulary")
        conn.commit()
        pool = conn.execute("""
            SELECT v.id, v.word, v.meaning FROM vocabulary v
            INNER JOIN quiz_pool qp ON v.id = qp.vocab_id
        """).fetchall()

    selected = random.sample(list(pool), min(n, len(pool)))
    for row in selected:
        conn.execute("DELETE FROM quiz_pool WHERE vocab_id=?", (row["id"],))

    conn.commit()
    conn.close()
    return [dict(r) for r in selected]


# ── Tests ────────────────────────────────────────────────────────────────────

def create_test(words):
    """Create a test with the given list of vocab rows. Returns test_id."""
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO tests (total) VALUES (?)", (len(words),)
    )
    test_id = cur.lastrowid
    for w in words:
        conn.execute(
            "INSERT INTO test_questions (test_id, vocab_id) VALUES (?,?)",
            (test_id, w["id"]),
        )
    conn.commit()
    conn.close()
    return test_id


def get_tests():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM tests ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_test_detail(test_id):
    conn = get_conn()
    test = conn.execute("SELECT * FROM tests WHERE id=?", (test_id,)).fetchone()
    questions = conn.execute("""
        SELECT tq.id, tq.vocab_id, tq.user_answer, tq.is_correct,
               v.word, v.meaning, v.pronunciation, v.katakana, v.part_of_speech, v.example
        FROM test_questions tq
        JOIN vocabulary v ON tq.vocab_id = v.id
        WHERE tq.test_id = ?
    """, (test_id,)).fetchall()
    conn.close()
    if not test:
        return None
    return {"test": dict(test), "questions": [dict(q) for q in questions]}


def submit_answer(question_id, user_answer, is_correct):
    conn = get_conn()
    conn.execute(
        "UPDATE test_questions SET user_answer=?, is_correct=? WHERE id=?",
        (user_answer, 1 if is_correct else 0, question_id),
    )
    # Update difficulty
    row = conn.execute(
        "SELECT vocab_id FROM test_questions WHERE id=?", (question_id,)
    ).fetchone()
    if row:
        vocab_id = row["vocab_id"]
        vocab = conn.execute("SELECT difficulty FROM vocabulary WHERE id=?", (vocab_id,)).fetchone()
        if vocab:
            current = vocab["difficulty"]
            if not is_correct:
                new_diff = 3
            else:
                new_diff = max(0, current - 1)
            conn.execute("UPDATE vocabulary SET difficulty=? WHERE id=?", (new_diff, vocab_id))
    conn.commit()
    conn.close()


def finish_test(test_id):
    conn = get_conn()
    result = conn.execute("""
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) AS correct
        FROM test_questions WHERE test_id=?
    """, (test_id,)).fetchone()
    conn.execute(
        "UPDATE tests SET completed_at=datetime('now','localtime'), score=?, total=? WHERE id=?",
        (result["correct"] or 0, result["total"] or 0, test_id),
    )
    conn.commit()
    conn.close()


# ── Startup test generation ──────────────────────────────────────────────────

def generate_startup_tests():
    """Calculate how many tests to generate since last startup and create them."""
    now = datetime.now()
    last_raw = get_setting("last_startup")
    set_setting("last_startup", now.strftime("%Y-%m-%d %H:%M:%S"))

    try:
        daily_count = int(get_setting("daily_count") or 2)
        questions_per_test = int(get_setting("questions_per_test") or 10)
        gen_times_raw = get_setting("generation_times") or '["07:00","22:00"]'
        gen_times = json.loads(gen_times_raw)
    except Exception:
        return

    # Check vocabulary count
    conn = get_conn()
    vocab_count = conn.execute("SELECT COUNT(*) AS cnt FROM vocabulary").fetchone()["cnt"]
    conn.close()
    if vocab_count < 1:
        return

    if not last_raw:
        # First launch – generate 1 test
        _make_tests(1, questions_per_test)
        return

    try:
        last_dt = datetime.strptime(last_raw, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        _make_tests(1, questions_per_test)
        return

    # Count how many generation slots occurred between last_dt and now
    slots_passed = 0
    cursor = last_dt
    while cursor < now:
        cursor += timedelta(minutes=1)
        t_str = cursor.strftime("%H:%M")
        if t_str in gen_times:
            slots_passed += 1

    # Cap at 5
    to_generate = min(slots_passed, 5)
    if to_generate > 0:
        _make_tests(to_generate, questions_per_test)


def _make_tests(count, questions_per_test):
    for _ in range(count):
        words = pick_words_for_test(questions_per_test)
        if words:
            create_test(words)
