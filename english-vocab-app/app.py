import os
import json
import anthropic
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import database as db

load_dotenv()

app = Flask(__name__)


def env_flag(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_anthropic_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY が未設定です。.env または環境変数に設定してください。")
    return anthropic.Anthropic(api_key=api_key)

SYSTEM_PROMPT = """You are an English vocabulary assistant for Japanese learners.

Analyze the user's input and determine which of the following 4 types it is:
1. **japanese_description** – Japanese text describing the sound/pronunciation of an unknown English word (e.g. "アポイントメントみたいな発音の単語")
2. **single_word** – A single English word or short phrase copied from somewhere
3. **english_sentence** – A full English sentence (2+ words forming a sentence)
4. **japanese_sentence** – A full Japanese sentence

Then respond ONLY with a JSON object (no markdown fences, no extra text) following this exact structure:

For type "japanese_description" or "single_word":
{
  "input_type": "single_word",
  "words": [
    {
      "word": "appointment",
      "meaning": "約束、予約",
      "pronunciation": "/əˈpɔɪntmənt/",
      "katakana": "アポイントメント",
      "part_of_speech": "名詞",
      "example": "I have an appointment at 3 PM.",
      "example_translation": "私は午後3時に予約があります。"
    }
  ]
}

For type "english_sentence":
{
  "input_type": "english_sentence",
  "translation": "日本語全訳",
  "words": [
    { "word": "...", "meaning": "...", "pronunciation": "...", "katakana": "...", "part_of_speech": "...", "example": "...", "example_translation": "..." }
  ]
}

For type "japanese_sentence":
{
  "input_type": "japanese_sentence",
  "translation": "Full English translation of the sentence",
  "words": [
    { "word": "...", "meaning": "...", "pronunciation": "...", "katakana": "...", "part_of_speech": "...", "example": "...", "example_translation": "..." }
  ]
}

Rules:
- For sentences, break down every meaningful word or phrase (not articles like "a"/"the" unless specifically important).
- part_of_speech must be in Japanese (名詞、動詞、形容詞、副詞、前置詞、接続詞、代名詞、フレーズ etc.)
- example must be a natural English sentence.
- example_translation must be a natural Japanese translation of the example sentence.
- All fields are required. Do not add any extra fields.
- Output raw JSON only, absolutely no markdown.
"""


@app.route("/")
def index():
    return render_template("index.html")


# ── Chat ──────────────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = (data or {}).get("message", "").strip()
    if not message:
        return jsonify({"error": "メッセージが空です"}), 400

    try:
        client = get_anthropic_client()
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": message}],
        )
        raw = response.content[0].text.strip()
        result = json.loads(raw)

        # Attach hidden flag to each word
        for w in result.get("words", []):
            w["is_hidden"] = db.is_hidden(w.get("word", ""))

        return jsonify(result)
    except json.JSONDecodeError:
        return jsonify({"error": "AIの応答を解析できませんでした", "raw": raw}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Vocabulary ────────────────────────────────────────────────────────────────

@app.route("/api/vocabulary", methods=["GET"])
def vocabulary_list():
    return jsonify(db.get_vocabulary_list())


@app.route("/api/vocabulary", methods=["POST"])
def add_vocabulary():
    data = request.get_json()
    ok = db.add_vocabulary(
        data.get("word", ""),
        data.get("meaning", ""),
        data.get("pronunciation", ""),
        data.get("katakana", ""),
        data.get("part_of_speech", ""),
        data.get("example", ""),
    )
    return jsonify({"success": ok})


@app.route("/api/vocabulary/<int:vocab_id>", methods=["GET"])
def vocabulary_detail(vocab_id):
    v = db.get_vocabulary_by_id(vocab_id)
    if not v:
        return jsonify({"error": "not found"}), 404
    return jsonify(v)


@app.route("/api/vocabulary/<int:vocab_id>", methods=["DELETE"])
def delete_vocabulary(vocab_id):
    db.delete_vocabulary(vocab_id)
    return jsonify({"success": True})


# ── Hidden words ──────────────────────────────────────────────────────────────

@app.route("/api/hidden", methods=["GET"])
def hidden_list():
    return jsonify(db.get_hidden_words())


@app.route("/api/hidden", methods=["POST"])
def add_hidden():
    data = request.get_json()
    db.add_hidden_word(data.get("word", ""))
    return jsonify({"success": True})


@app.route("/api/hidden/<path:word>", methods=["DELETE"])
def remove_hidden(word):
    db.remove_hidden_word(word)
    return jsonify({"success": True})


# ── Tests ─────────────────────────────────────────────────────────────────────

@app.route("/api/tests", methods=["GET"])
def tests_list():
    return jsonify(db.get_tests())


@app.route("/api/tests/generate", methods=["POST"])
def generate_test():
    try:
        questions_per_test = int(db.get_setting("questions_per_test") or 10)
        words = db.pick_words_for_test(questions_per_test)
        if not words:
            return jsonify({"error": "単語帳に単語がありません"}), 400
        test_id = db.create_test(words)
        return jsonify({"test_id": test_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tests/<int:test_id>", methods=["GET"])
def test_detail(test_id):
    detail = db.get_test_detail(test_id)
    if not detail:
        return jsonify({"error": "not found"}), 404
    return jsonify(detail)


@app.route("/api/tests/answer", methods=["POST"])
def submit_answer():
    data = request.get_json()
    db.submit_answer(
        data.get("question_id"),
        data.get("user_answer", ""),
        data.get("is_correct", False),
    )
    return jsonify({"success": True})


@app.route("/api/tests/<int:test_id>/finish", methods=["POST"])
def finish_test(test_id):
    db.finish_test(test_id)
    detail = db.get_test_detail(test_id)
    return jsonify(detail)


# ── Settings ──────────────────────────────────────────────────────────────────

@app.route("/api/settings", methods=["GET"])
def get_settings():
    keys = ["questions_per_test", "daily_count", "generation_times"]
    return jsonify({k: db.get_setting(k) for k in keys})


@app.route("/api/settings", methods=["POST"])
def update_settings():
    data = request.get_json()
    for key in ["questions_per_test", "daily_count", "generation_times"]:
        if key in data:
            db.set_setting(key, data[key])
    return jsonify({"success": True})


# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    db.init_db()
    db.generate_startup_tests()
    port = int(os.environ.get("PORT", "5000"))
    debug = env_flag("FLASK_DEBUG", default=False)
    app.run(debug=debug, port=port)
