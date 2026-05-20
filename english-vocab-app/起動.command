#!/bin/bash

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "========================================"
echo " 英単語学習アプリを起動しています..."
echo "========================================"
echo

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp ".env.example" ".env"
  echo ".env.example から .env を作成しました。"
  echo
fi

if [ -f ".env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ""|\#*)
        continue
        ;;
      *=*)
        export "$line"
        ;;
    esac
  done < ".env"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "[エラー] python3 が見つかりません。"
  echo "Python 3 をインストールしてから再実行してください。"
  echo
  read -r -p "Enter キーで終了します..."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "仮想環境を作成しています..."
  python3 -m venv ".venv"
  echo
fi

# shellcheck disable=SC1091
. ".venv/bin/activate"

if [ -z "${ANTHROPIC_API_KEY:-}" ] || [ "${ANTHROPIC_API_KEY}" = "your_anthropic_api_key_here" ]; then
  echo "ANTHROPIC_API_KEY が設定されていません。"
  read -r -p "今ここで API キーを入力してください: " ANTHROPIC_API_KEY
  export ANTHROPIC_API_KEY

  if [ -f ".env" ]; then
    tmp_env=".env.tmp"
    found_key=0
    : > "$tmp_env"
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in
        ANTHROPIC_API_KEY=*)
          printf 'ANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_API_KEY" >> "$tmp_env"
          found_key=1
          ;;
        *)
          printf '%s\n' "$line" >> "$tmp_env"
          ;;
      esac
    done < ".env"
    if [ "$found_key" -eq 0 ]; then
      printf 'ANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_API_KEY" >> "$tmp_env"
    fi
    mv "$tmp_env" ".env"
  else
    printf 'ANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_API_KEY" > ".env"
  fi
  echo ".env に API キーを保存しました。"
  echo
fi

echo "依存パッケージを確認しています..."
python3 -m pip install -r requirements.txt --quiet
if [ $? -ne 0 ]; then
  echo "[エラー] パッケージのインストールに失敗しました。"
  echo
  read -r -p "Enter キーで終了します..."
  exit 1
fi
echo

PORT="${PORT:-5000}"
( sleep 2; open "http://127.0.0.1:${PORT}" ) >/dev/null 2>&1 &

echo "サーバーを起動しました。ブラウザで http://127.0.0.1:${PORT} が開きます。"
echo "終了するには Ctrl+C を押してください。"
echo

python3 app.py
status=$?

echo
echo "サーバーが停止しました。"
read -r -p "Enter キーで終了します..."
exit "$status"
