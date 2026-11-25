export const MAX_IMAGES = 3;
export const MAX_IMAGE_BYTES = 250 * 1024;
export const MAX_IMAGE_EDGE = 1920;
export const MAX_REQUEST_BYTES = 1100 * 1024;
export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
export const IMAGE_TYPES = new Set(['image/jpeg', 'image/webp']);

// 브라우저가 다시 인코딩한 JPEG/WebP만 받는다. 파일 확장자나 MIME 표기만 믿지 않는다.
export function imageDimensions(bytes, mime) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset, value) => value.split('').every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  if (mime === 'image/webp' && bytes.length >= 30 && ascii(0, 'RIFF') && ascii(8, 'WEBP') && view.getUint32(4, true) + 8 === bytes.length) {
    if (ascii(12, 'VP8 ') && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
      return {width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff};
    }
    if (ascii(12, 'VP8L') && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return {width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1};
    }
    // VP8X canvas에서 만든 정지 이미지만 허용한다(애니메이션 비트 제외).
    if (ascii(12, 'VP8X') && !(bytes[20] & 2)) {
      return {width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)};
    }
  }
  if (mime === 'image/jpeg' && bytes.length > 10 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 0xff) return null;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > bytes.length) return null;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) return {height: view.getUint16(offset + 3), width: view.getUint16(offset + 5)};
      offset += length;
    }
  }
  return null;
}
