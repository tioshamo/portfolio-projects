@echo off
chcp 65001 > nul
title 英単語アプリ

echo ========================================
echo  英単語学習アプリを起動しています...
echo ========================================
echo.

REM スクリプトのあるフォルダへ移動
cd /d "%~dp0"

REM .env ファイルを読み込む
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if not "%%A"=="" if not "%%B"=="" set "%%A=%%B"
    )
)

REM ANTHROPIC_API_KEY が未設定の場合は入力を求める
if "%ANTHROPIC_API_KEY%"=="" (
    echo ANTHROPIC_API_KEY が設定されていません。
    echo .env ファイルに ANTHROPIC_API_KEY=your_key_here と記入してください。
    set /p ANTHROPIC_API_KEY="または今すぐ入力してください: "
    echo.
)

REM 依存パッケージをインストール（未インストールの場合のみ）
echo 依存パッケージを確認しています...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [エラー] パッケージのインストールに失敗しました。
    echo Python と pip がインストールされているか確認してください。
    pause
    exit /b 1
)
echo.

REM 2秒後にブラウザを開く（バックグラウンドで実行）
start "" cmd /c "timeout /t 2 /nobreak > nul & start http://127.0.0.1:5000"

REM Flaskサーバーを起動
echo サーバーを起動しました。ブラウザで http://127.0.0.1:5000 が開きます。
echo 終了するには Ctrl+C を押してください。
echo.
python app.py

echo.
echo サーバーが停止しました。
pause
