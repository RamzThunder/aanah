import test from 'node:test';
import assert from 'node:assert/strict';
import {imageDimensions, MAX_REQUEST_BYTES, MAX_IMAGE_BYTES} from './request-image-rules.mjs';
import {parseRequest, UploadError} from './functions/api/_request-images.js';

// 3×2 JPEG의 SOF 헤더로 크기 파싱을 검증한다.
const jpeg = Uint8Array.from([0xff,0xd8,0xff,0xc0,0,11,8,0,2,0,3,1,1,0x11,0,0xff,0xd9]);
function upload(files) {
  const form = new FormData(); form.set('payload', JSON.stringify({kind: 'bug', body: '버튼이 작동하지 않아요.'}));
  for (const file of files) form.append('images', new Blob([file.data], {type: file.type}), 'capture.jpg');
  return new Request('https://aanah.fyi/api/requests', {method: 'POST', body: form});
}
test('dimensions come from the image header, not filename or claimed MIME', () => {
  assert.deepEqual(imageDimensions(jpeg, 'image/jpeg'), {width: 3, height: 2});
  assert.equal(imageDimensions(jpeg, 'image/webp'), null);
  assert.equal(imageDimensions(new TextEncoder().encode('<svg onload="alert(1)">'), 'image/jpeg'), null);
  assert.equal(imageDimensions(jpeg.slice(0, 12), 'image/jpeg'), null);
});
test('multipart accepts bounded encoded photos and removes duplicate images', async () => {
  const parsed = await parseRequest(upload([{type: 'image/jpeg', data: jpeg}, {type: 'image/jpeg', data: jpeg}]));
  assert.equal(parsed.input.kind, 'bug'); assert.equal(parsed.images.length, 1);
  assert.deepEqual(parsed.images[0].data, jpeg); assert.equal(parsed.images[0].hash.length, 64);
});
test('multipart rejects excessive count, bytes, dimensions and mismatched contents', async () => {
  await assert.rejects(parseRequest(upload(Array.from({length: 4}, () => ({type: 'image/jpeg', data: jpeg})))), UploadError);
  await assert.rejects(parseRequest(upload([{type: 'image/jpeg', data: new Uint8Array(MAX_IMAGE_BYTES + 1)}])), UploadError);
  const huge = jpeg.slice(); huge[9] = 0xff; huge[10] = 0xff;
  await assert.rejects(parseRequest(upload([{type: 'image/jpeg', data: huge}])), UploadError);
  await assert.rejects(parseRequest(upload([{type: 'image/png', data: jpeg}])), UploadError);
  await assert.rejects(parseRequest(upload([{type: 'image/jpeg', data: new TextEncoder().encode('<html>fake</html>')}])), UploadError);
});
test('body limits also apply to chunked uploads with no content-length', async () => {
  let cancelled = false;
  const stream = new ReadableStream({start(controller) {controller.enqueue(new Uint8Array(MAX_REQUEST_BYTES)); controller.enqueue(new Uint8Array(1));}, cancel() {cancelled = true;}});
  const request = new Request('https://aanah.fyi/api/requests', {method: 'POST', body: stream, duplex: 'half'});
  await assert.rejects(parseRequest(request), error => error.status === 413); assert.equal(cancelled, true);
});
test('legacy JSON requests continue to work without attachments', async () => {
  const payload = {kind: 'idea', body: '기능 제안'};
  const {input, images} = await parseRequest(new Request('https://aanah.fyi/api/requests', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)}));
  assert.deepEqual(input, payload); assert.deepEqual(images, []);
});
