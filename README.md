# ImgOrPdf2Gif

動画と PDF を GIF に変換する日本語 Web アプリです。添付された `mp4togif.py` と `pdftogif.py` の処理を Web 用に統合しました。元のバッチスクリプトと操作マニュアルも残しています。

## GitHub Pages 版（サーバー不要）

`docs/` が公開用の静的アプリです。GitHub の **Settings → Pages → Deploy from a branch** で **main / /docs** を選んで保存してください（`dox` ではなく `docs`）。ビルド作業は不要です。

公開先: `https://yagi-031382.github.io/ImgOrPdf2Gif/`

動画・PDFをブラウザ内で変換し、ファイルをサーバーへ送信しません。依存ライブラリも同梱しています。PC の最新 Chrome / Edge / Firefox を推奨します。動画はブラウザが再生できる MP4 / WebM / MOV に対応し、コーデックによっては変換できません。動画は60秒・600フレームまで、PDFは50ページまで、合計100MB・10件までです。ブラウザのメモリを守るため総フレーム画素数にも上限があります。初期設定は幅480px・15 FPSです。PDFのページサイズが異なる場合は共通キャンバスの余白を白で埋めます。パスワード付きPDFは非対応です。大量のファイルやスマートフォンではメモリ不足になる場合があります。

ローカル確認:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# ブラウザでポート8000の /docs/ を開く（file:// での直接実行は不可）
```

ブラウザ統合テスト（Linux、Node.js 20以上、Python環境とFFmpegが必要）:

```bash
npm ci
# 上記の静的サーバーを起動した状態で実行
npm run test:pages
```

実ブラウザでPDF・WebMを変換し、ダウンロードしたGIFのフレーム数・表示時間・サイズ、部分失敗ZIP、外部送信がないことを検証します。

## Python サーバー版の起動

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
