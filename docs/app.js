import { convertFile, makeZip } from './converter.js';
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
    files.accept = pdf ? '.pdf' : '.mp4,.webm,.mov';
    files.value = '';
    document.querySelector('#selection').replaceChildren();
    document.querySelector('#formats').textContent = pdf ? 'PDF' : 'MP4 / WebM / MOV（ブラウザ対応形式）';
    document.querySelector('#pdf-setting').hidden = !pdf;
    document.querySelector('#video-setting').hidden = pdf;
    document.querySelector('#note').textContent = pdf ? 'ページ順に再生する、無限ループの GIF を作成します（最大50ページ）。' : '動画は60秒・600フレーム以内。サイズや FPS を下げると軽量化できます。';
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
  const options = Object.fromEntries(new FormData(form));
  const selected = Array.from(files.files);
  const controls = [...document.querySelectorAll('button, input, select')];
  controls.forEach(control => control.disabled = true);
  const successes = [], errors = [];
  try {
    for (const [index, file] of selected.entries()) {
      try {
        const blob = await convertFile(file, options, progress => {
          status.textContent = `${index + 1}/${selected.length} ${file.name}: ${progress}`;
        });
        const name = `${index + 1}_${file.name.replace(/\.[^.]+$/, '').replace(/[\\/]/g, '_')}.gif`;
        successes.push({name, blob});
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    }
    if (!successes.length) throw new Error(errors.join('\n') || 'ファイルを選択してください。');
    const blob = successes.length === 1 && !errors.length ? successes[0].blob : await makeZip(successes, errors);
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
    status.textContent = errors.length ? `一部のファイルを変換できませんでした。\n${errors.join('\n')}` : 'GIF を作成しました。';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    controls.forEach(control => control.disabled = false);
  }
});
