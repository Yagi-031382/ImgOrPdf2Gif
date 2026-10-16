"""動画・PDFをGIFに変換するローカルWebアプリ。"""
import io
import tempfile
import zipfile
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file
from moviepy import VideoFileClip
from pdf2image import convert_from_path, pdfinfo_from_path

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv'}


@app.get('/')
def index():
    return render_template('index.html')


@app.errorhandler(413)
def too_large(error):
    return jsonify(error='アップロードは合計100MB以内にしてください。'), 413


@app.post('/convert')
def convert():
    mode = request.form.get('mode')
    files = request.files.getlist('files')
    if mode not in {'video', 'pdf'} or not files or len(files) > 10:
        return jsonify(error='モードとファイルを指定してください（最大10件）。'), 400
    try:
        duration = int(request.form.get('duration', '1000'))
        width = int(request.form.get('width', '0'))
        fps = int(request.form.get('fps', '0'))
        if duration < 100 or duration > 10000 or width not in {0, 480, 720, 1080} or fps not in {0, 10, 15, 24}:
            raise ValueError
    except ValueError:
        return jsonify(error='変換設定が不正です。'), 400
    results, errors = [], []
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        for index, upload in enumerate(files):
            # 表示名以外にはユーザー指定のパスを使用しない。
            name = (upload.filename or '').replace('\\', '/').rsplit('/', 1)[-1]
            ext = Path(name).suffix.lower()
            if ext not in (VIDEO_EXTENSIONS if mode == 'video' else {'.pdf'}):
                errors.append(f'{name}: このモードでは対応していない形式です。')
                continue
            source, target = root / f'{index}{ext}', root / f'{index}.gif'
            upload.save(source)
            try:
                if mode == 'video':
                    with VideoFileClip(str(source)) as clip:
                        actual_fps = fps or clip.fps
                        if clip.duration > 120 or clip.duration * actual_fps > 3600:
                            raise ValueError('動画は120秒・出力3600フレーム以内にしてください。')
                        output = clip.resized(width=width) if width else clip
                        try:
                            output.write_gif(str(target), fps=actual_fps, logger=None)
                        finally:
                            if output is not clip:
                                output.close()
                else:
                    count = pdfinfo_from_path(str(source), timeout=30)['Pages']
                    if count > 50:
                        raise ValueError('PDFは50ページ以内にしてください。')
                    paths = convert_from_path(str(source), dpi=100, size=width or 1080,
                                              output_folder=directory, paths_only=True,
                                              thread_count=2, timeout=60, fmt='png')
                    from PIL import Image
                    pages = []
                    try:
                        for path in paths:
                            with Image.open(path) as image:
                                pages.append(image.convert('RGB'))
                        pages[0].save(target, save_all=True, append_images=pages[1:],
                                      duration=duration, loop=0, optimize=True)
                    finally:
                        for page in pages:
                            page.close()
                results.append((f'{index + 1}_{Path(name).stem}.gif', target.read_bytes()))
            except Exception:
                app.logger.warning('Conversion failed for file %s', index, exc_info=True)
                errors.append(f'{name}: 変換できませんでした。ファイルの破損・暗号化、動画120秒／3600フレーム、PDF50ページの上限を確認してください。')
        if not results:
            return jsonify(error='\n'.join(errors) or 'ファイルを選択してください。'), 400
        # ZIP内に結果と失敗一覧を格納。単独成功時はGIFを直接返す。
        if len(results) == 1 and not errors:
            return send_file(io.BytesIO(results[0][1]), mimetype='image/gif',
                             as_attachment=True, download_name=results[0][0])
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
            for name, data in results:
                bundle.writestr(name, data)
            if errors:
                bundle.writestr('errors.txt', '\n'.join(errors))
        archive.seek(0)
        return send_file(archive, mimetype='application/zip', as_attachment=True,
                         download_name='converted.zip')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
