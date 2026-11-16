import { isValidDashboardPhoto, MAX_UPLOAD_BYTES, ALLOWED_TYPES } from '../v462/dashboard-background.js';
export function cropGeometry(iw, ih, width, height, zoom = 1, dx = 0, dy = 0) {
  const base = Math.max(width / iw, height / ih);
  const scale = base * Math.max(1, Math.min(4, Number(zoom) || 1));
  const renderedWidth = iw * scale, renderedHeight = ih * scale;
  const maxX = Math.max(0, (renderedWidth - width) / 2), maxY = Math.max(0, (renderedHeight - height) / 2);
  const offsetX = Math.max(-maxX, Math.min(maxX, dx)), offsetY = Math.max(-maxY, Math.min(maxY, dy));
  return { scale, x: (width - renderedWidth) / 2 + offsetX, y: (height - renderedHeight) / 2 + offsetY, dx: offsetX, dy: offsetY };
}
function decodePhoto(file) {
  if (!file || !ALLOWED_TYPES.includes(file.type)) throw new Error('Bitte JPG, PNG oder WebP auswählen.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Das Foto darf höchstens 8 MB gross sein.');
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); if (img.naturalWidth * img.naturalHeight > 70000000) reject(new Error('Fotoauflösung zu hoch.')); else resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Das Bild konnte nicht geöffnet werden.')); };
    img.src = url;
  });
}
export async function openDashboardPhotoEditor(file, { expectedUid, currentUid, onSave }) {
  const img = await decodePhoto(file);
  if (currentUid() !== expectedUid) throw new Error('Das Konto wurde gewechselt.');
  return new Promise((resolve, reject) => {
    const backdrop = document.createElement('div'); backdrop.className = 'v47-editor-backdrop';
    backdrop.innerHTML = `<section class="v47-editor" role="dialog" aria-modal="true" aria-labelledby="v47EditorTitle">
      <h2 id="v47EditorTitle">Hintergrund zuschneiden</h2><p>Ziehe das Foto mit dem Finger in Position. Vergrössern oder verkleinern mit dem Regler.</p>
      <div class="v47-editor-frame"><canvas width="1000" height="460" aria-label="Vorschau des zugeschnittenen Hintergrunds"></canvas></div>
      <label for="v47EditorZoom">Bildgrösse</label><input id="v47EditorZoom" type="range" min="100" max="400" value="100" step="2">
      <p class="v47-editor-status" role="status" aria-live="polite"></p>
      <div class="v47-editor-actions"><button type="button" data-editor-cancel class="ghost-button">Abbrechen</button><button type="button" data-editor-save class="primary-button">Vorschau übernehmen</button></div>
    </section>`;
    const previouslyFocused = document.activeElement;
    document.body.append(backdrop);
    const canvas = backdrop.querySelector('canvas'), ctx = canvas.getContext('2d');
    const slider = backdrop.querySelector('#v47EditorZoom'), save = backdrop.querySelector('[data-editor-save]');
    const status = backdrop.querySelector('.v47-editor-status');
    let zoom = 1, dx = 0, dy = 0, pointer = null, done = false;
    const preview = () => {
      const g = cropGeometry(img.naturalWidth, img.naturalHeight, canvas.width, canvas.height, zoom, dx, dy);
      dx = g.dx; dy = g.dy; ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,g.x,g.y,img.naturalWidth*g.scale,img.naturalHeight*g.scale);
    };
    const events = new AbortController();
    function finish(err) { if (done) return; done = true; events.abort(); backdrop.remove(); if(previouslyFocused?.isConnected) previouslyFocused.focus(); if (err) reject(err); else resolve(); }
    const cancel = () => finish();
    backdrop.querySelector('[data-editor-cancel]').addEventListener('click', cancel);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) cancel(); });
    const keyHandler = e => {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); return; }
      if (e.key !== 'Tab') return;
      const focusable=[...backdrop.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if(!focusable.length){e.preventDefault();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };
    document.addEventListener('keydown', keyHandler, { signal: events.signal });
    slider.addEventListener('input', () => { zoom = Number(slider.value) / 100; preview(); });
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => { pointer = {id:e.pointerId,x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!pointer || pointer.id !== e.pointerId) return;
      const rect = canvas.getBoundingClientRect(); dx += (e.clientX - pointer.x) * canvas.width / rect.width; dy += (e.clientY - pointer.y) * canvas.height / rect.height;
      pointer.x=e.clientX; pointer.y=e.clientY; preview();
    });
    canvas.addEventListener('pointerup',()=>{pointer=null;});canvas.addEventListener('pointercancel',()=>{pointer=null;});
    save.addEventListener('click', async () => {
      save.disabled=true;status.textContent='Bild wird vorbereitet …';
      try {
        if(currentUid()!==expectedUid) throw new Error('Das Konto wurde gewechselt.');
        let data='';
        for(let i=0;i<6;i++) {data=canvas.toDataURL('image/jpeg',Math.max(0.46,0.82-i*.06));if(isValidDashboardPhoto(data))break;}
        if (!isValidDashboardPhoto(data)) throw new Error('Bild für dieses Gerät zu gross. Bitte eine kleinere Datei auswählen.');
        await onSave(data);
        if(currentUid()!==expectedUid) throw new Error('Das Konto wurde gewechselt.');
        finish();
      } catch(error) {status.textContent=error.message||'Bild konnte nicht gespeichert werden.';save.disabled=false;}
    });
    preview();slider.focus();
  });
}
