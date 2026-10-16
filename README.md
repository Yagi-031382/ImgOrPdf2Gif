# ImgOrPdf2Gif

動画と PDF を GIF に変換する日本語 Web アプリです。添付された `mp4togif.py` と `pdftogif.py` の処理を Web 用に統合しました。元のバッチスクリプトと操作マニュアルも残しています。

## 起動

Python 3.10 以上、FFmpeg、Poppler が必要です。Ubuntu では次で導入できます。

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg poppler-utils python3-venv
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

ブラウザでサーバーのポート 5000 を開きます。動画／PDF モードを選び、ファイルと設定を指定して変換してください。1件の成功は GIF をプレビュー・ダウンロードできます。複数件や一部失敗の場合は ZIP をダウンロードします。失敗理由の概要は ZIP 内の `errors.txt` に保存されます。

- 動画: MP4 / MOV / AVI / MKV / WMV / FLV（利用できるコーデックは FFmpeg に依存）。標準では元の FPS と解像度を維持します。幅・FPS の軽量化設定があります。
- PDF: ページ順で無限ループ。ページ表示時間と出力幅を指定できます。標準は100 DPI・長辺1080px以内です。
- アップロードは合計100MB・10件まで。動画は120秒かつ出力3600フレーム以内、PDF は50ページまでです。
- ファイルは一時ディレクトリで処理し、リクエスト終了時に削除します。結果は永続保存されないためダウンロードしてください。
- 変換は同期処理です。高解像度動画はメモリと時間を消費するため、小さな出力幅・FPS を推奨します。

## テスト

```bash
.venv/bin/pip install pytest==8.4.2
.venv/bin/python -m pytest -q
```

実際の PDF・動画変換、フレーム数・表示時間、部分失敗を含む ZIP、不正入力を検証します。

## 運用範囲

個人・信頼できるネットワーク内での開発利用を想定しています。認証はありません。インターネット公開時は別途、認証、ジョブキュー、プロセス単位の資源制限とタイムアウト、HTTPS、運用向け WSGI サーバーを用意してください。Flask 開発サーバーのまま公開しないでください。
