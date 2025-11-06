/* script.js — Advanced mode enhancements (presets, import/export, fit-to-original, preview rotate/flip)
   Non-destructive: only modifies UI and preview transforms; does not change core compression logic.
*/
(function(){
  document.addEventListener('DOMContentLoaded', initAdvancedExtras);

  function initAdvancedExtras(){
    const adv = document.getElementById('advancedMode');
    if(!adv) return;

    // Create a compact control row and inject into Advanced Mode (keeps HTML file unchanged)
    const container = document.createElement('div');
    container.className = 'advanced-extra-controls';
    container.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:12px;align-items:center;';
    container.innerHTML = `
      <select id="presetSelect" class="p-2 rounded" aria-label="Presets"></select>
      <button id="savePresetBtn" class="fancy-btn px-3 py-2" title="Save current advanced settings">Save Preset</button>
      <button id="deletePresetBtn" class="px-3 py-2 rounded" title="Delete selected preset" style="background:transparent;border:1px solid rgba(255,255,255,0.06);color:var(--text-color)">Delete</button>
      <button id="exportPresetBtn" class="px-3 py-2 rounded" title="Copy preset JSON to clipboard" style="background:transparent;border:1px solid rgba(255,255,255,0.06);">Export</button>
      <button id="importPresetBtn" class="px-3 py-2 rounded" title="Import preset JSON">Import</button>
      <button id="fitOriginalBtn" class="px-3 py-2 rounded" title="Set size to original image" style="background:var(--primary-color);color:#fff;">Fit to original</button>
      <button id="rotateLeftBtn" class="px-3 py-2 rounded" title="Rotate preview left">⤺</button>
      <button id="rotateRightBtn" class="px-3 py-2 rounded" title="Rotate preview right">⤻</button>
      <button id="flipHBtn" class="px-3 py-2 rounded" title="Flip preview horizontally">⇋</button>
      <button id="flipVBtn" class="px-3 py-2 rounded" title="Flip preview vertically">⇅</button>
      <div id="compareToggleWrap" style="display:flex;align-items:center;gap:8px;margin-left:6px">
        <button id="toggleCompareBtn" class="px-3 py-2 rounded" title="Toggle compare slider">Compare</button>
        <div id="qualityScore" style="font-weight:700;color:var(--primary-light);min-width:140px;text-align:left;">Quality: —</div>
        <div id="palette" aria-hidden="false" style="display:flex;gap:6px;align-items:center"></div>
      </div>
      <div id="watermarkWrap" style="display:flex;flex-direction:column;gap:6px;margin-left:8px;min-width:260px">
        <div style="display:flex;gap:8px;align-items:center">
          <input id="watermarkEnabled" type="checkbox" /> <label for="watermarkEnabled" style="font-weight:600">Watermark</label>
          <select id="watermarkPresetSelect" style="flex:1"></select>
        </div>
        <input id="watermarkText" placeholder="Watermark text (or leave blank)" style="width:100%" />
        <div style="display:flex;gap:8px;align-items:center">
          <label style="font-size:13px">Opacity</label>
          <input id="watermarkOpacity" type="range" min="0" max="100" value="40" />
          <label style="font-size:13px">Size</label>
          <input id="watermarkSize" type="number" min="10" max="200" value="24" style="width:72px" />
          <select id="watermarkPos">
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
            <option value="center">Center</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="preserveExif" type="checkbox" /> <label for="preserveExif">Preserve EXIF (JPEG only)</label>
        </div>
      </div>
    `;

    // Insert as first child of advanced mode so it appears at top of the panel
    adv.insertBefore(container, adv.firstChild);

    // Grab references to existing inputs inside index.html
    const widthInput = document.getElementById('imgWidth');
    const heightInput = document.getElementById('imgHeight');
    const qualityRange = document.getElementById('qualityRange');
    const formatSelect = document.getElementById('formatSelect');
    const maxSizeInput = document.getElementById('maxSizeKB');
    const presetSelect = document.getElementById('presetSelect');
    const saveBtn = document.getElementById('savePresetBtn');
    const deleteBtn = document.getElementById('deletePresetBtn');
    const exportBtn = document.getElementById('exportPresetBtn');
    const importBtn = document.getElementById('importPresetBtn');
    const fitBtn = document.getElementById('fitOriginalBtn');
    const rotateLeftBtn = document.getElementById('rotateLeftBtn');
    const rotateRightBtn = document.getElementById('rotateRightBtn');
    const flipHBtn = document.getElementById('flipHBtn');
    const flipVBtn = document.getElementById('flipVBtn');

    // Local state for preview-only transforms (non-destructive to compression pipeline)
    let rotation = 0; let flipH = false; let flipV = false;

    // Preset storage utility
    const STORAGE_KEY = 'imgCompressorPresets_v1';
    let presets = loadPresets();

    function loadPresets(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e){ return {}; } }
    function savePresets(obj){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); presets = obj; renderPresetOptions(); } catch(e){ console.warn('Could not save presets', e); } }

    function renderPresetOptions(){
      presetSelect.innerHTML = '<option value="">— Presets —</option>';
      Object.keys(presets).forEach(name => {
        const opt = document.createElement('option'); opt.value = name; opt.textContent = name; presetSelect.appendChild(opt);
      });
    }
    renderPresetOptions();

    // Watermark presets storage
    const WM_KEY = 'imgCompressorWatermarkPresets_v1';
    let wmPresets = loadWMPresets();
    function loadWMPresets(){ try { return JSON.parse(localStorage.getItem(WM_KEY) || '{}'); } catch(e){ return {}; } }
    function saveWMPresets(v){ try { localStorage.setItem(WM_KEY, JSON.stringify(v)); wmPresets = v; renderWMPresetOptions(); } catch(e){} }
    const wmPresetSelect = document.getElementById('watermarkPresetSelect');
    function renderWMPresetOptions(){ if(!wmPresetSelect) return; wmPresetSelect.innerHTML = '<option value="">— WM Presets —</option>'; Object.keys(wmPresets).forEach(n=>{ const o = document.createElement('option'); o.value=n; o.textContent=n; wmPresetSelect.appendChild(o); }); }
    renderWMPresetOptions();

    // initialize watermark settings in global scope
    window.watermarkSettings = window.watermarkSettings || { enabled:false, text:'', opacity:0.4, size:24, position:'bottom-right' };
    // wire watermark controls
    const wmEnabled = document.getElementById('watermarkEnabled');
    const wmText = document.getElementById('watermarkText');
    const wmOpacity = document.getElementById('watermarkOpacity');
    const wmSize = document.getElementById('watermarkSize');
    const wmPos = document.getElementById('watermarkPos');
    const wmPresetSel = document.getElementById('watermarkPresetSelect');
    const preserveExifChk = document.getElementById('preserveExif');

    // restore UI from settings
    if(wmEnabled) wmEnabled.checked = !!window.watermarkSettings.enabled;
    if(wmText) wmText.value = window.watermarkSettings.text || '';
    if(wmOpacity) wmOpacity.value = Math.round((window.watermarkSettings.opacity||0.4)*100);
    if(wmSize) wmSize.value = window.watermarkSettings.size || 24;
    if(wmPos) wmPos.value = window.watermarkSettings.position || 'bottom-right';
    if(preserveExifChk) preserveExifChk.checked = !!window.preserveExif;

    function updateWMFromUI(){ window.watermarkSettings = { enabled: !!(wmEnabled && wmEnabled.checked), text: wmText ? wmText.value : '', opacity: (wmOpacity? parseInt(wmOpacity.value)/100:0.4), size: wmSize ? parseInt(wmSize.value):24, position: wmPos ? wmPos.value : 'bottom-right' }; window.preserveExif = !!(preserveExifChk && preserveExifChk.checked); }

    [wmEnabled, wmText, wmOpacity, wmSize, wmPos, preserveExifChk].forEach(el=>{ if(!el) return; el.addEventListener('input', ()=>{ updateWMFromUI(); }); });

    // Save watermark preset (small helper in same UI)
    const saveWMBtn = document.createElement('button'); saveWMBtn.textContent='Save WM'; saveWMBtn.className='px-3 py-2 rounded'; saveWMBtn.style.marginLeft='6px';
    container.appendChild(saveWMBtn);
    saveWMBtn.addEventListener('click', ()=>{
      const name = prompt('Watermark preset name') || ''; if(!name) return; wmPresets[name] = {...window.watermarkSettings}; saveWMPresets(wmPresets); showToast('Watermark preset saved');
    });
    if(wmPresetSel) wmPresetSel.addEventListener('change', ()=>{
      const n = wmPresetSel.value; if(!n) return; const s = wmPresets[n]; if(!s) return; window.watermarkSettings = {...s}; // update UI
      if(wmEnabled) wmEnabled.checked = !!s.enabled; if(wmText) wmText.value = s.text||''; if(wmOpacity) wmOpacity.value = Math.round((s.opacity||0.4)*100); if(wmSize) wmSize.value = s.size||24; if(wmPos) wmPos.value = s.position||'bottom-right'; updateWMFromUI(); showToast('Watermark preset applied');
    });

    // Set up observers to enhance preview areas when compressed images appear
    function onPreviewImgReady(containerId, cb) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const mo = new MutationObserver(mutations => {
        for (const m of mutations) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 && n.tagName === 'IMG') cb(n);
            // also handle if added a wrapper containing img
            if (n.nodeType === 1) {
              const img = n.querySelector && n.querySelector('img');
              if (img) cb(img);
            }
          }
        }
      });
      mo.observe(container, { childList: true, subtree: true });
      // if image already present
      const existing = container.querySelector && container.querySelector('img'); if (existing) cb(existing);
    }

    // compute PSNR and palette when compressed previews update
    function updateMetricsFor(previewId, originalId) {
      const compressedImg = document.getElementById(previewId) && document.getElementById(previewId).querySelector('img');
      const originalImg = document.getElementById(originalId) && document.getElementById(originalId).querySelector('img');
      if (!compressedImg || !originalImg) return;
      // when both have natural sizes, compute
      Promise.all([imgLoaded(originalImg), imgLoaded(compressedImg)]).then(() => {
        try {
          const psnr = computePSNR(originalImg, compressedImg);
          const qDiv = document.getElementById('qualityScore');
          if (qDiv) qDiv.textContent = `Quality: ${isFinite(psnr) ? psnr.toFixed(1) + ' dB' : 'Perfect'}`;
          // update palette from original
          getDominantColors(originalImg, 5).then(colors => {
            const pal = document.getElementById('palette');
            if (!pal) return;
            pal.innerHTML = '';
            colors.forEach(c => {
              const sw = document.createElement('div'); sw.style.width = '26px'; sw.style.height = '20px'; sw.style.borderRadius='4px'; sw.style.boxShadow='0 2px 6px rgba(0,0,0,0.3)'; sw.style.background = c; pal.appendChild(sw);
            });
          });
        } catch(e) { /* ignore */ }
      }).catch(()=>{});
    }

    // wire observers for both easy and advanced compressed previews
    onPreviewImgReady('easyCompressedPreview', () => updateMetricsFor('easyCompressedPreview', 'easyOriginalPreview'));
    onPreviewImgReady('compressedPreview', () => updateMetricsFor('compressedPreview', 'originalPreview'));

    // Compare slider toggle: show draggable before/after overlay over the advanced compressed preview
    const toggleCompareBtn = document.getElementById('toggleCompareBtn');
    let compareActive = false;
    let compareOverlay = null;
    if (toggleCompareBtn) {
      toggleCompareBtn.addEventListener('click', ()=>{
        compareActive = !compareActive;
        if (compareActive) {
          createCompareOverlay('originalPreview','compressedPreview');
          toggleCompareBtn.textContent = 'Close Compare';
        } else {
          removeCompareOverlay();
          toggleCompareBtn.textContent = 'Compare';
        }
      });
    }

    function createCompareOverlay(originalId, compressedId) {
      removeCompareOverlay();
      const parent = document.getElementById(compressedId);
      const origImg = document.getElementById(originalId) && document.getElementById(originalId).querySelector('img');
      const compImg = parent && parent.querySelector('img');
      if (!parent || !origImg || !compImg) return showToast('Load images to compare');
      // ensure parent positioned
      parent.style.position = parent.style.position || 'relative';
      const wrap = document.createElement('div');
      wrap.className = 'compare-overlay';
      Object.assign(wrap.style,{position:'absolute',inset:'0',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1200,overflow:'hidden'});
      // base images
      const imgA = document.createElement('img'); imgA.src = origImg.src; imgA.style.width='100%'; imgA.style.height='100%'; imgA.style.objectFit='contain'; imgA.style.position='absolute'; imgA.style.left='0'; imgA.style.top='0';
      const imgB = document.createElement('img'); imgB.src = compImg.src; imgB.style.width='100%'; imgB.style.height='100%'; imgB.style.objectFit='contain'; imgB.style.position='absolute'; imgB.style.left='0'; imgB.style.top='0'; imgB.style.clipPath = 'inset(0 50% 0 0)';
      // handle
      const handle = document.createElement('div'); handle.style.position='absolute'; handle.style.top='0'; handle.style.bottom='0'; handle.style.width='4px'; handle.style.left='50%'; handle.style.background='linear-gradient(180deg,#fff,#ccc)'; handle.style.cursor='ew-resize'; handle.style.zIndex=1300; handle.style.boxShadow='0 0 8px rgba(0,0,0,0.6)';
      wrap.appendChild(imgA); wrap.appendChild(imgB); wrap.appendChild(handle);
      parent.appendChild(wrap); compareOverlay = wrap;

      // dragging
      let dragging = false;
      handle.addEventListener('pointerdown', e=>{ dragging=true; handle.setPointerCapture(e.pointerId); });
      window.addEventListener('pointerup', ()=>{ dragging=false; });
      window.addEventListener('pointermove', e=>{ if(!dragging) return; const rect = parent.getBoundingClientRect(); let x = e.clientX - rect.left; let pct = Math.max(0, Math.min(1, x / rect.width)); imgB.style.clipPath = `inset(0 ${((1-pct)*100).toFixed(2)}% 0 0)`; handle.style.left = (pct*100) + '%'; });
    }

    function removeCompareOverlay(){ if (compareOverlay && compareOverlay.parentNode) compareOverlay.parentNode.removeChild(compareOverlay); compareOverlay = null; }

    // helper: wait for image load
    function imgLoaded(img) {
      return new Promise((res, rej) => {
        if (!img) return rej();
        if (img.complete && img.naturalWidth) return res();
        img.onload = () => res();
        img.onerror = () => res();
      });
    }

    // compute PSNR between two images via temporary canvases
    function computePSNR(imgA, imgB) {
      const w = Math.min(imgA.naturalWidth, imgB.naturalWidth);
      const h = Math.min(imgA.naturalHeight, imgB.naturalHeight);
      if (!w || !h) return NaN;
      const cA = document.createElement('canvas'); cA.width = w; cA.height = h; const ctxA = cA.getContext('2d'); ctxA.drawImage(imgA, 0, 0, w, h);
      const cB = document.createElement('canvas'); cB.width = w; cB.height = h; const ctxB = cB.getContext('2d'); ctxB.drawImage(imgB, 0, 0, w, h);
      const dA = ctxA.getImageData(0,0,w,h).data; const dB = ctxB.getImageData(0,0,w,h).data;
      let mse = 0; let count=0;
      for (let i=0;i<dA.length;i+=4) {
        const dr = dA[i] - dB[i]; const dg = dA[i+1] - dB[i+1]; const db = dA[i+2] - dB[i+2];
        mse += (dr*dr + dg*dg + db*db)/3;
        count++;
      }
      mse = mse / count;
      if (mse === 0) return Infinity;
      const psnr = 10 * Math.log10((255*255) / mse);
      return psnr;
    }

    // extract dominant colors by simple quantization + counting (fast, client-side)
    function getDominantColors(img, count = 5) {
      return new Promise((res) => {
        const W = 80; const H = Math.max(40, Math.round((img.naturalHeight/img.naturalWidth) * W));
        const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
        try { ctx.drawImage(img, 0,0, W, H); } catch(e) { return res([]); }
        const d = ctx.getImageData(0,0,W,H).data;
        const map = new Map();
        for (let i=0;i<d.length;i+=4) {
          const r = Math.round(d[i]/16)*16; const g = Math.round(d[i+1]/16)*16; const b = Math.round(d[i+2]/16)*16;
          const key = `${r},${g},${b}`;
          map.set(key, (map.get(key)||0)+1);
        }
        const arr = Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,count).map(x=>{
          const [r,g,b] = x[0].split(','); return `rgb(${r},${g},${b})`; });
        res(arr);
      });
    }

    // Read/Apply functions
    function readSettings(){
      return {
        width: widthInput ? parseInt(widthInput.value)||'' : '',
        height: heightInput ? parseInt(heightInput.value)||'' : '',
        quality: qualityRange ? parseInt(qualityRange.value)||40 : 40,
        format: formatSelect ? formatSelect.value || 'image/jpeg' : 'image/jpeg',
        maxSizeKB: maxSizeInput ? (parseInt(maxSizeInput.value)||'') : '',
        manualMode: !!(window.manualMode),
        manualSettings: window.manualSettings ? {...window.manualSettings} : null,
        filter: window.currentFilter || 'none'
      };
    }

    function applySettings(s){
      if(!s) return;
      if(widthInput && s.width !== undefined) widthInput.value = s.width || '';
      if(heightInput && s.height !== undefined) heightInput.value = s.height || '';
      if(qualityRange && s.quality !== undefined) qualityRange.value = s.quality;
      if(formatSelect && s.format) formatSelect.value = s.format;
      if(maxSizeInput && s.maxSizeKB !== undefined) maxSizeInput.value = s.maxSizeKB || '';
      if(s.manualMode !== undefined && document.getElementById('toggleManual') && document.getElementById('toggleFilters')){
        if(s.manualMode) {
          window.manualMode = true;
          document.getElementById('toggleManual').classList.replace('bg-gray-700','bg-purple-600');
          document.getElementById('toggleFilters').classList.replace('bg-purple-600','bg-gray-700');
        } else {
          window.manualMode = false;
          document.getElementById('toggleFilters').classList.replace('bg-gray-700','bg-purple-600');
          document.getElementById('toggleManual').classList.replace('bg-purple-600','bg-gray-700');
        }
      }
      if(s.manualSettings && window.manualSettings) window.manualSettings = {...s.manualSettings};
      if(s.filter) {
        window.currentFilter = s.filter;
        // mark active filter button (if present)
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === s.filter));
      }

      showToast('Preset applied');
      // Trigger refresh of previews/compression (if images exist)
      if(window.originalImage) {
        setTimeout(()=>{ if(window.compressNow) window.compressNow(); if(window.compressEasy) window.compressEasy(); }, 80);
      }
    }

    // Button handlers
    saveBtn.addEventListener('click', ()=>{
      let name = prompt('Preset name (e.g. web-large)') || '';
      name = name.trim(); if(!name) return showToast('Cancelled');
      const s = readSettings();
      presets[name] = s; savePresets(presets);
      showToast('Preset saved');
    });

    presetSelect.addEventListener('change', ()=>{
      const name = presetSelect.value; if(!name) return; applySettings(presets[name]);
    });

    deleteBtn.addEventListener('click', ()=>{
      const name = presetSelect.value; if(!name) return showToast('Select a preset to delete');
      if(!confirm(`Delete preset "${name}"?`)) return;
      delete presets[name]; savePresets(presets); showToast('Preset deleted');
    });

    exportBtn.addEventListener('click', async ()=>{
      const name = presetSelect.value; if(!name) return showToast('Select a preset to export');
      const txt = JSON.stringify({name, data: presets[name]}, null, 2);
      try { await navigator.clipboard.writeText(txt); showToast('Preset JSON copied to clipboard'); }
      catch(e) { prompt('Copy this JSON:', txt); }
    });

    importBtn.addEventListener('click', ()=>{
      const txt = prompt('Paste preset JSON (name + data)') || '';
      if(!txt) return;
      try {
        const obj = JSON.parse(txt);
        if(obj.name && obj.data) { presets[obj.name] = obj.data; savePresets(presets); showToast('Imported preset: ' + obj.name); }
        else showToast('Invalid preset format');
      } catch(e) { showToast('Invalid JSON'); }
    });

    fitBtn.addEventListener('click', ()=>{
      if(!window.originalImage) return showToast('Load an image first');
      if(widthInput) widthInput.value = window.originalImage.width;
      if(heightInput) heightInput.value = window.originalImage.height;
      showToast('Size set to original image');
    });

    rotateLeftBtn.addEventListener('click', ()=>{ rotation = (rotation - 90) % 360; updatePreviewTransforms(); showToast('Rotated'); });
    rotateRightBtn.addEventListener('click', ()=>{ rotation = (rotation + 90) % 360; updatePreviewTransforms(); showToast('Rotated'); });
    flipHBtn.addEventListener('click', ()=>{ flipH = !flipH; updatePreviewTransforms(); showToast('Flipped horizontally'); });
    flipVBtn.addEventListener('click', ()=>{ flipV = !flipV; updatePreviewTransforms(); showToast('Flipped vertically'); });

    function updatePreviewTransforms(){
      ['originalPreview','compressedPreview','easyOriginalPreview','easyCompressedPreview'].forEach(id => {
        const container = document.getElementById(id); if(!container) return; const img = container.querySelector('img'); if(!img) return;
        img.style.transform = `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;
        img.style.transition = 'transform 300ms ease';
      });
    }

    // Small toast helper (visual feedback inside page)
    function showToast(msg, timeout=1400){
      const t = document.createElement('div'); t.className = 'script-toast'; t.textContent = msg;
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:#fff;padding:8px 14px;border-radius:8px;z-index:2000;font-weight:600;';
      document.body.appendChild(t);
      setTimeout(()=> t.style.opacity='0.01', timeout - 200);
      setTimeout(()=> t.remove(), timeout);
    }

    // Store presets when page unloads (already persisted on save but keep consistency)
    window.addEventListener('beforeunload', ()=> savePresets(presets));
  }
})();
