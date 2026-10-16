const form = document.querySelector('#converter');
const files = document.querySelector('#files');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
let objectURL;
function resetResult() {
  result.hidden = true;
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = null;
  document.querySelector('#preview').removeAttribute('src');
  status.textContent = '';
}
document.querySelectorAll('[data-mode]').forEach(button => {
  button.addEventListener('click', () => {
    const pdf = button.dataset.mode === 'pdf';
    form.elements.mode.value = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(tab => {
      const active = tab === button;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    files.accept = pdf ? '.pdf' : '.mp4,.mov,.avi,.mkv,.wmv,.flv';
    files.value = '';
    document.querySelector('#selection').replaceChildren();
    document.querySelector('#formats').textContent = pdf ? 'PDF' : 'MP4 / MOV / AVI / MKV / WMV / FLV';
    document.querySelector('#pdf-setting').hidden = !pdf;
    document.querySelector('#video-setting').hidden = pdf;
    document.querySelector('#note').textContent = pdf ? 'ページ順に再生する、無限ループの GIF を作成します（最大50ページ）。' : '動画は120秒・出力3600フレーム以内。サイズや FPS を下げると軽量化できます。';
    resetResult();
  });
});
function showFiles() {
  resetResult();
  document.querySelector('#selection').replaceChildren(...Array.from(files.files, file => {
    const li = document.createElement('li');
    li.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    return li;
  }));
}
files.addEventListener('change', showFiles);
const drop = document.querySelector('#drop');
['dragover', 'dragleave', 'drop'].forEach(type => drop.addEventListener(type, event => {
  event.preventDefault();
  drop.classList.toggle('over', type === 'dragover');
  if (type === 'drop' && !files.disabled) {
    files.files = event.dataTransfer.files;
    showFiles();
  }
}));
form.addEventListener('submit', async event => {
  event.preventDefault();
  resetResult();
  if (files.files.length > 10 || Array.from(files.files).reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024) {
    status.textContent = '最大10件・合計100MB以内で選択してください。';
    return;
  }
  const data = new FormData(form);
  const controls = [...document.querySelectorAll('button, input, select')];
  controls.forEach(control => control.disabled = true);
  status.textContent = '変換中です。ファイルによっては数分かかります…';
  try {
    const response = await fetch('/convert', {method: 'POST', body: data});
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || '変換に失敗しました。時間を置いて再試行してください。');
    }
    const blob = await response.blob();
    objectURL = URL.createObjectURL(blob);
    const zip = blob.type.includes('zip');
    const download = document.querySelector('#download');
    download.href = objectURL;
    download.download = zip ? 'converted.zip' : 'converted.gif';
    const preview = document.querySelector('#preview');
    preview.hidden = zip;
    if (!zip) preview.src = objectURL;
    document.querySelector('#zip-note').hidden = !zip;
    result.hidden = false;
    status.textContent = zip ? '処理が完了しました。ZIP 内の結果を確認してください。' : 'GIF を作成しました。';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    controls.forEach(control => control.disabled = false);
  }
});
