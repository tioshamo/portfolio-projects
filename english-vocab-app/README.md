# 英単語学習アプリ

 自分専用に作成したAI 英単語学習アプリです。わからない英単語や英文を AI で解析し、そのまま単語帳に保存し、反復テストで定着を確認できます。

## ポートフォリオ要約

- 日本語の発音説明、英単語、英文、日本文の 4 パターンを AI で解釈
- 単語の意味、発音記号、カタカナ、品詞、例文、日本語訳をまとめて表示
- 保存した単語を SQLite に永続化
- 苦手度と出題プールを使った反復テスト機能を実装
- Flask API と Vanilla JavaScript でフロントからバックまで一貫して構築

## 主な機能

### 1. AI チャット

- 日本語で発音を説明すると該当しそうな英単語を推定
- 英単語やフレーズを入力すると詳細解説を返却
- 英文を入力すると全文和訳と語句分解を表示
- 日本文を入力すると英訳と語句分解を表示

### 2. 単語帳

- 調べた単語やフレーズをワンクリックで保存
- 保存済みの単語一覧、詳細確認、削除に対応
- 文章分解で不要な語句は非表示登録して学習対象を整理可能

### 3. 単語テスト

- 登録済み単語からテストを生成
- 出題済み単語をプールから外し、偏りを抑制
- 回答結果に応じて苦手度を更新
- 起動間隔と設定時刻に応じてテストを自動生成

### 4. 設定

- 1 回あたりの出題数を変更
- 1 日の生成回数を変更
- テスト生成時刻を変更

## 技術スタック

- Backend: Python, Flask
- Frontend: HTML, CSS, Vanilla JavaScript
- Database: SQLite
- AI: Anthropic Claude API

## 工夫した点

- AI の出力形式を JSON に固定し、フロント側で安定して描画できるようにした
- `hidden_words` と `quiz_pool` を分けて、学習対象の整理と出題の偏り抑制を両立した
- 回答結果に応じて `difficulty` を更新し、苦手単語の復習優先度を持たせた
- 検索で終わらず、保存、非表示管理、テストまで学習フローを一続きにした

## 画面イメージ

ポートフォリオには次の流れが伝わるスクリーンショットか短い動画を添えるのが効果的です。

1. AI チャットで単語や文章を解析
2. 単語帳へ保存
3. テストを生成して回答
4. 結果画面で定着度を確認

<img width="1512" height="827" alt="スクリーンショット 2026-05-20 14 41 24" src="https://github.com/user-attachments/assets/ed5b34ec-6230-4798-8888-3fb7a57e8438" />
<img width="1512" height="827" alt="スクリーンショット 2026-05-20 14 41 42" src="https://github.com/user-attachments/assets/ec66f06c-ef6e-4106-bd15-2a1c7aa6b94c" />
<img width="1512" height="827" alt="スクリーンショット 2026-05-20 14 42 09" src="https://github.com/user-attachments/assets/3c4c51f4-b32f-494f-aa88-45b431d5887a" />
<img width="1512" height="827" alt="スクリーンショット 2026-05-20 14 42 32" src="https://github.com/user-attachments/assets/53ca3901-532c-4a78-84ee-8cca6c470486" />




## セットアップ

### 前提

- Python 3.9 以上を推奨
- Anthropic API キー

### かんたん起動

通常は次の方法で起動できます。

- Windows: 起動.bat をダブルクリック
- macOS: 起動.command をダブルクリック

macOS で初回だけセキュリティ設定によりブロックされた場合は、`起動.command` を右クリックして「開く」を選んでください。

各起動ファイルは、必要に応じて `.env` の作成、依存パッケージの確認、ブラウザ起動まで行います。

### 手動起動

起動ファイルが使えない場合や、環境を自分で確認しながら進めたい場合は次の手順で起動できます。

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python3 app.py
```

Windows では手動で `.env` を作る代わりに、次でも構いません。

```bat
copy .env.example .env
```

`.env` には少なくとも次を設定します。

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PORT=5000
FLASK_DEBUG=1
```

ブラウザで `http://127.0.0.1:5000` を開くと利用できます。

## ディレクトリ構成

```text
.
|-- app.py
|-- database.py
|-- requirements.txt
|-- templates/
|   `-- index.html
|-- static/
|   |-- css/style.css
|   `-- js/app.js
|-- 仕様書
|-- 起動.command
`-- 起動.bat
```


