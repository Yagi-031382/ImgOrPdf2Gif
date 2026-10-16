import * as pdfjs from './vendor/pdf.mjs';
import { zipSync, strToU8 } from './vendor/fflate.js';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
const PIXEL_BUDGET = 90_000_000;

function encode(gif, progress) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { gif.abort(); reject(new Error('GIF作成がタイムアウトしました。出力サイズを下げてください。')); }, 180000);
    const stop = () => clearTimeout(timer);
    gif.on('progress', value => progress(`GIF作成 ${Math.round(value * 100)}%`));
    gif.on('finished', blob => { stop(); resolve(blob); });
    gif.on('abort', () => { stop(); reject(new Error('GIF作成が中断されました。')); });
    try { gif.render(); } catch (error) { stop(); reject(error); }
  }).finally(() => { for (const worker of gif.activeWorkers.concat(gif.freeWorkers)) worker.terminate(); });
}
function encoder(width, height) {
  return new window.GIF({workers: 2, quality: 10, width, height, repeat: 0,
    workerScript: new URL('./vendor/gif.worker.js', import.meta.url).href});
}
function budget(width, height, frames) {
  if (width * height * frames > PIXEL_BUDGET) throw new Error('処理量が上限を超えます。出力幅・FPSを下げるか、短い動画・ページ数の少ないPDFを選んでください。');
}
function waitEvent(element, event, action) {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); element.removeEventListener(event, done); element.removeEventListener('error', failed); };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('このブラウザでは動画を読み込めません。MP4（H.264）またはWebMをお試しください。')); };
    const timer = setTimeout(failed, 30000);
    element.addEventListener(event, done, {once: true});
    element.addEventListener('error', failed, {once: true});
    action();
  });
}
async function videoGif(file, options, progress) {
  if (!/\.(mp4|webm|mov)$/i.test(file.name)) throw new Error('動画はMP4 / WebM / MOVを選んでください。');
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  const url = URL.createObjectURL(file);
  try {
    await waitEvent(video, 'loadeddata', () => { video.src = url; video.load(); });
    const fps = Number(options.fps) || 15;
    const frames = Math.ceil(video.duration * fps);
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 60 || frames > 600) throw new Error('動画は60秒・出力600フレーム以内にしてください。');
    const width = Number(options.width) || 480;
    const height = Math.max(1, Math.round(video.videoHeight * width / video.videoWidth));
    budget(width, height, frames);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const gif = encoder(width, height);
    for (let i = 0; i < frames; i++) {
      const time = i / fps;
      if (Math.abs(video.currentTime - time) > 0.00001) await waitEvent(video, 'seeked', () => { video.currentTime = time; });
      context.drawImage(video, 0, 0, width, height);
      gif.addFrame(context, {copy: true, delay: 1000 / fps});
      progress(`動画読み込み ${i + 1}/${frames}`);
    }
    return await encode(gif, progress);
  } finally {
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}
async function pdfGif(file, options, progress) {
  if (!/\.pdf$/i.test(file.name)) throw new Error('PDFファイルを選んでください。');
  const task = pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: new URL('./vendor/cmaps/', import.meta.url).href, cMapPacked: true,
    standardFontDataUrl: new URL('./vendor/standard_fonts/', import.meta.url).href,
    isEvalSupported: false});
  task.onPassword = () => task.destroy();
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 50) throw new Error('PDFは50ページ以内にしてください。');
    const width = Number(options.width) || 480;
    // ページサイズが異なるPDFも共通キャンバスに収める。
    let height = 1;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i), view = page.getViewport({scale: 1});
      height = Math.max(height, Math.ceil(view.height * width / view.width));
      page.cleanup();
    }
    budget(width, height, pdf.numPages);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const gif = encoder(width, height);
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i), view = page.getViewport({scale: 1});
      const viewport = page.getViewport({scale: width / view.width});
      context.fillStyle = 'white'; context.fillRect(0, 0, width, height);
      await page.render({canvasContext: context, viewport, background: 'white'}).promise;
      gif.addFrame(context, {copy: true, delay: Number(options.duration) || 1000});
      page.cleanup(); progress(`PDF読み込み ${i}/${pdf.numPages}`);
    }
    return await encode(gif, progress);
  } catch (error) {
    if (/password|destroy/i.test(error.message)) throw new Error('パスワード付きPDFには対応していません。');
    throw error;
  } finally { await task.destroy(); }
}
export async function convertFile(file, options, progress = () => {}) {
  progress('読み込み中…');
  return options.mode === 'pdf' ? pdfGif(file, options, progress) : videoGif(file, options, progress);
}
export async function makeZip(results, errors) {
  const entries = Object.create(null);
  for (const {name, blob} of results) entries[name] = new Uint8Array(await blob.arrayBuffer());
  if (errors.length) entries['errors.txt'] = strToU8(errors.join('\n'));
  return new Blob([zipSync(entries, {level: 0})], {type: 'application/zip'});
}
