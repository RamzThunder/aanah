import {MAX_IMAGES, MAX_IMAGE_BYTES, MAX_IMAGE_EDGE, MAX_REQUEST_BYTES, IMAGE_TYPES, imageDimensions} from '../../request-image-rules.mjs';
import {sha256} from './_lib.js';
export class UploadError extends Error { constructor(message, status = 400) {super(message); this.status = status;} }

export async function parseRequest(request) {
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) throw new UploadError('첨부 용량이 너무 커요. 사진을 줄여 다시 보내 주세요.', 413);
  const chunks = []; let total = 0;
  const reader = request.body?.getReader();
  if (reader) {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) { await reader.cancel(); throw new UploadError('첨부 용량이 너무 커요.', 413); }
      chunks.push(value);
    }
  }
  const body = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) {body.set(chunk, offset); offset += chunk.byteLength;}
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data')) {
    try { return {input: JSON.parse(new TextDecoder().decode(body)), images: []}; }
    catch {throw new UploadError('잘못된 요청이에요.');}
  }
  let form, input;
  try {form = await new Response(body, {headers: {'content-type': contentType}}).formData(); input = JSON.parse(form.get('payload'));}
  catch {throw new UploadError('요청과 사진을 읽지 못했어요. 다시 첨부해 주세요.');}
  const files = form.getAll('images');
  if (files.length > MAX_IMAGES) throw new UploadError(`사진은 ${MAX_IMAGES}장까지 첨부할 수 있어요.`);
  const images = [];
  for (const file of files) {
    if (typeof file === 'string' || !IMAGE_TYPES.has(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) throw new UploadError('사진은 장당 250KB 이하의 JPEG·WebP만 보낼 수 있어요. 다시 첨부해 주세요.');
    const data = new Uint8Array(await file.arrayBuffer());
    const size = imageDimensions(data, file.type);
    if (!size || !size.width || !size.height || Math.max(size.width, size.height) > MAX_IMAGE_EDGE) throw new UploadError('사진 형식이나 크기를 확인해 주세요. 다시 첨부하면 자동으로 줄여 드려요.');
    const hash = await sha256(data);
    if (images.some(image => image.hash === hash)) continue;
    images.push({id: crypto.randomUUID(), mime: file.type, data, bytes: data.length, hash});
  }
  return {input, images};
}
