import io
import shutil
import subprocess
import zipfile

from PIL import Image
from app import app


def pdf_bytes():
    stream = io.BytesIO()
    pages = [Image.new('RGB', (64, 48), color) for color in ['red', 'blue']]
    pages[0].save(stream, format='PDF', save_all=True, append_images=pages[1:])
    return stream.getvalue()


def test_index():
    assert app.test_client().get('/').status_code == 200


def test_pdf_conversion():
    response = app.test_client().post('/convert', data={
        'mode': 'pdf', 'duration': '500', 'files': (io.BytesIO(pdf_bytes()), '日本語.pdf')})
    assert response.status_code == 200
    image = Image.open(io.BytesIO(response.data))
    assert image.n_frames == 2
    assert image.info['duration'] == 500
    assert image.info['loop'] == 0


def test_video_conversion(tmp_path):
    video = tmp_path / 'clip.mp4'
    subprocess.run([shutil.which('ffmpeg'), '-v', 'error', '-f', 'lavfi', '-i',
                    'testsrc=size=64x48:rate=10:duration=1', '-pix_fmt', 'yuv420p', str(video)], check=True)
    response = app.test_client().post('/convert', data={
        'mode': 'video', 'files': (io.BytesIO(video.read_bytes()), 'clip.mp4')})
    assert response.status_code == 200
    image = Image.open(io.BytesIO(response.data))
    assert image.size == (64, 48)
    assert image.n_frames == 10


def test_partial_batch():
    response = app.test_client().post('/convert', data={'mode': 'pdf', 'files': [
        (io.BytesIO(pdf_bytes()), '../valid.pdf'), (io.BytesIO(b'bad'), 'bad.pdf')]})
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.data)) as archive:
        assert set(archive.namelist()) == {'1_valid.gif', 'errors.txt'}
        assert 'bad.pdf' in archive.read('errors.txt').decode()


def test_invalid_requests():
    client = app.test_client()
    assert client.post('/convert', data={'mode': 'other'}).status_code == 400
    assert client.post('/convert', data={'mode': 'pdf', 'width': '-1',
        'files': (io.BytesIO(b'bad'), 'bad.pdf')}).status_code == 400
    assert client.post('/convert', data={'mode': 'pdf',
        'files': (io.BytesIO(b'bad'), 'bad.exe')}).status_code == 400
