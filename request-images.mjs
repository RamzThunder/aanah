import {MAX_IMAGES, MAX_IMAGE_BYTES, MAX_IMAGE_EDGE, MAX_ORIGINAL_BYTES} from './request-image-rules.mjs';
const canvasBlob = (canvas, mime, quality) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('사진을 줄이지 못했어요. 다른 사진으로 다시 시도해 주세요.')), mime, quality));
const sizeLabel = bytes => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;

export async function compressImage(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('PNG·JPG·WebP 사진을 첨부해 주세요.');
  if (!file.size || file.size > MAX_ORIGINAL_BYTES) throw new Error('원본 사진은 장당 20MB 이하로 골라 주세요.');
  const url = URL.createObjectURL(file), image = new Image();
  try {
    image.src = url; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 80000000) throw new Error('사진 크기가 너무 커요. 필요한 부분만 캡처해서 첨부해 주세요.');
    const canvas = document.createElement('canvas');
    let edge = Math.min(MAX_IMAGE_EDGE, Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 7; attempt++) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      // canvas 재인코딩으로 촬영 위치 등 원본 메타데이터도 저장하지 않는다.
      for (const quality of [.9, .8, .7]) {
        let blob = await canvasBlob(canvas, 'image/webp', quality);
        if (blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', quality);
        if (blob.size <= MAX_IMAGE_BYTES) return {blob, width: canvas.width, height: canvas.height};
      }
      edge = Math.floor(edge * .8);
    }
    throw new Error('사진 용량을 충분히 줄이지 못했어요. 필요한 부분만 캡처해서 첨부해 주세요.');
  } finally {URL.revokeObjectURL(url);}
}

export function createImagePicker(form) {
  const input = form.querySelector('#images'), list = form.querySelector('#imagePreviews'), status = form.querySelector('#imageStatus');
  const error = form.querySelector('#imageError'), drop = form.querySelector('#imageDrop');
  let items = [], queue = Promise.resolve(), locked = false, pending = 0;
  function render() {
    list.replaceChildren();
    for (const item of items) {
      const card = document.createElement('div'); card.className = 'image-preview';
      const image = document.createElement('img'); image.src = item.url; image.alt = item.name;
      const name = document.createElement('span'); name.textContent = item.name;
      const size = document.createElement('small'); size.textContent = `${sizeLabel(item.originalSize)} → ${sizeLabel(item.blob.size)}`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '삭제'; remove.disabled = locked;
      remove.setAttribute('aria-label', `${item.name} 첨부 삭제`);
      remove.onclick = () => {error.textContent = ''; URL.revokeObjectURL(item.url); items = items.filter(entry => entry !== item); render();};
      card.append(image, name, size, remove); list.append(card);
    }
    input.disabled = locked;
    form.querySelector('#imagesClear').hidden = !items.length && !error.textContent;
    form.querySelector('#imagesClear').disabled = locked || pending > 0;
    status.textContent = pending ? '사진 크기와 용량을 줄이는 중…' : items.length ? `${items.length}/${MAX_IMAGES}장 · 전송 용량 ${sizeLabel(items.reduce((sum, item) => sum + item.blob.size, 0))}` : '';
  }
  function add(files) {
    if (locked) return;
    const selected = [...files]; if (!selected.length) return;
    pending++; render();
    queue = queue.then(async () => {
      error.textContent = '';
      for (const file of selected) {
        if (items.length >= MAX_IMAGES) {error.textContent = `사진은 ${MAX_IMAGES}장까지 첨부할 수 있어요.`; break;}
        try {
          const {blob} = await compressImage(file);
          items.push({blob, name: file.name || '붙여넣은 캡처', originalSize: file.size, url: URL.createObjectURL(blob)});
        } catch (err) {error.textContent = err.message;}
      }
    }).finally(() => {pending--; render();});
  }
  input.onchange = () => {add(input.files); input.value = '';};
  form.addEventListener('paste', event => {
    if (drop.closest('[hidden]')) return;
    const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
    if (files.length) {event.preventDefault(); add(files);}
  });
  drop.addEventListener('dragover', event => {event.preventDefault(); if (!locked) drop.classList.add('dragging');});
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', event => {event.preventDefault(); drop.classList.remove('dragging'); add(event.dataTransfer.files);});
  function clear() {for (const item of items) URL.revokeObjectURL(item.url); items = []; error.textContent = ''; render();}
  form.querySelector('#imagesClear').onclick = clear;
  return {
    async files() {await queue; if (error.textContent) throw new Error('첨부 사진을 확인하거나 ‘첨부 모두 지우기’를 누른 뒤 다시 보내 주세요.'); return items.map(item => item.blob);},
    lock(value) {locked = value; render();},
    clear,
  };
}
