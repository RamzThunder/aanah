export function createRequestImages() {
  const dialog = document.querySelector('#requestImageDialog'), large = document.querySelector('#requestImageLarge');
  const urls = new Set(); let generation = 0;
  document.querySelector('#requestImageClose').onclick = () => dialog.close();
  dialog.addEventListener('close', () => large.removeAttribute('src'));
  return {
    reset() {generation++; dialog.close(); large.removeAttribute('src'); for (const url of urls) URL.revokeObjectURL(url); urls.clear();},
    append(item, request) {
      if (!request.images?.length) return;
      const section = document.createElement('section'); section.className = 'request-captures';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = `문제 상황 캡처 ${request.images.length}장 보기`;
      button.setAttribute('aria-expanded', 'false');
      const grid = document.createElement('div'); grid.className = 'capture-grid'; grid.hidden = true;
      const error = document.createElement('p'); error.className = 'err'; error.setAttribute('role', 'alert');
      let loaded = false;
      button.onclick = async () => {
        if (loaded) {grid.hidden = !grid.hidden; button.setAttribute('aria-expanded', String(!grid.hidden)); return;}
        const version = generation; button.disabled = true; error.textContent = '';
        const pending = [];
        try {
          for (const [index, image] of request.images.entries()) {
            const response = await fetch(`/api/admin/images/${image.id}`, {headers: {authorization: `Bearer ${sessionStorage.getItem('aanah-admin-key')}`}, cache: 'no-store'});
            if (!response.ok) throw new Error(response.status === 401 ? '로그인이 만료됐어요. 다시 로그인해 주세요.' : '사진을 불러오지 못했어요. 다시 눌러 주세요.');
            const blob = await response.blob();
            if (version !== generation || !item.isConnected) return;
            const url = URL.createObjectURL(blob); urls.add(url); pending.push(url);
            const thumb = document.createElement('button'); thumb.className = 'capture-thumb'; thumb.type = 'button';
            thumb.setAttribute('aria-label', `캡처 ${index + 1} 확대`);
            const img = document.createElement('img'); img.src = url; img.alt = `첨부 캡처 ${index + 1}`;
            const caption = document.createElement('span'); caption.textContent = `${Math.ceil(image.byte_size / 1024)}KB · 눌러서 확대`;
            thumb.append(img, caption);
            thumb.onclick = () => {large.src = url; large.alt = `${request.title || '요청'} · 첨부 캡처 ${index + 1}`; dialog.showModal();};
            grid.append(thumb);
          }
          loaded = true; grid.hidden = false; button.setAttribute('aria-expanded', 'true');
        } catch (err) {
          for (const url of pending) {URL.revokeObjectURL(url); urls.delete(url);}
          grid.replaceChildren(); error.textContent = err.message;
        } finally {button.disabled = false;}
      };
      section.append(button, grid, error); item.append(section);
    },
  };
}
