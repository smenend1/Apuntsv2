const $ = s => document.querySelector(s);
const sourceCanvas = $('#sourceCanvas');
const processedCanvas = $('#processedCanvas');
const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
const pctx = processedCanvas.getContext('2d', { willReadFrequently: true });
let originalImage = null;
let currentRotation = 0;
let cropStart = null;
let cropRect = null;
let structuredText = '';
let deferredPrompt = null;

const cameraInput = $('#cameraInput');
const galleryInput = $('#galleryInput');
const openCameraBtn = $('#openCameraBtn');
const openGalleryBtn = $('#openGalleryBtn');
const controls = ['#rotateBtn','#cropBtn','#resetBtn','#processBtn','#ocrBtn'];

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#installBtn').classList.remove('hidden'); });
$('#installBtn').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt = null; $('#installBtn').classList.add('hidden'); });

openCameraBtn.addEventListener('click', () => cameraInput.click());
openGalleryBtn.addEventListener('click', () => galleryInput.click());
cameraInput.addEventListener('change', handleImageInput);
galleryInput.addEventListener('change', handleImageInput);

async function handleImageInput(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const img = await loadImage(file);
  originalImage = img; currentRotation = 0; cropRect = null;
  drawSource(); enableControls(true); processImage();
  cameraInput.value = '';
  galleryInput.value = '';
}

$('#rotateBtn').addEventListener('click', () => { currentRotation = (currentRotation + 90) % 360; cropRect = null; drawSource(); processImage(); });
$('#resetBtn').addEventListener('click', () => { cropRect = null; currentRotation = 0; drawSource(); processImage(); });
$('#cropBtn').addEventListener('click', () => { if (!cropRect) return setStatus('Marca primer una selecció arrossegant sobre la imatge.'); applyCrop(); });
['#contrast','#threshold','#scale','#binarize','#sharpen','#preset','#psm'].forEach(id => $(id).addEventListener('input', processImage));
$('#processBtn').addEventListener('click', processImage);
$('#ocrBtn').addEventListener('click', runOCR);
$('#notesBtn').addEventListener('click', generateNotes);
$('#demoBtn').addEventListener('click', () => { $('#ocrText').value = 'La fotosíntesi transforma aigua i diòxid de carboni en glucosa i oxigen. Té lloc als cloroplasts gràcies a la llum solar.'; $('#titleInput').value='La fotosíntesi'; generateNotes(); });
$('#downloadBtn').addEventListener('click', downloadNotesPNG);
$('#copyBtn').addEventListener('click', async () => { await navigator.clipboard.writeText(structuredText); setStatus('Text copiat.'); });

function enableControls(on){ controls.forEach(id => $(id).disabled = !on); }
function setStatus(msg){ $('#status').textContent = msg || ''; }
function loadImage(file){ return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=URL.createObjectURL(file); }); }

function drawSource(){
  if (!originalImage) return;
  const maxSide = 1400;
  const rotated = currentRotation % 180 !== 0;
  const iw = originalImage.naturalWidth, ih = originalImage.naturalHeight;
  let w = rotated ? ih : iw, h = rotated ? iw : ih;
  const ratio = Math.min(1, maxSide / Math.max(w,h)); w = Math.round(w*ratio); h = Math.round(h*ratio);
  sourceCanvas.width = w; sourceCanvas.height = h;
  sctx.save(); sctx.clearRect(0,0,w,h); sctx.translate(w/2,h/2); sctx.rotate(currentRotation*Math.PI/180);
  const dw = Math.round(iw*ratio), dh = Math.round(ih*ratio);
  sctx.drawImage(originalImage, -dw/2, -dh/2, dw, dh); sctx.restore();
  if (cropRect) drawCropOverlay();
}

sourceCanvas.addEventListener('pointerdown', e => { if (!originalImage) return; cropStart = point(e); cropRect = {x:cropStart.x,y:cropStart.y,w:0,h:0}; drawSource(); });
sourceCanvas.addEventListener('pointermove', e => { if (!cropStart) return; const pt=point(e); cropRect={x:Math.min(cropStart.x,pt.x),y:Math.min(cropStart.y,pt.y),w:Math.abs(pt.x-cropStart.x),h:Math.abs(pt.y-cropStart.y)}; drawSource(); });
window.addEventListener('pointerup', () => { if (cropRect && (cropRect.w < 15 || cropRect.h < 15)) cropRect = null; cropStart = null; drawSource(); });
function point(e){ const r=sourceCanvas.getBoundingClientRect(); return {x:(e.clientX-r.left)*sourceCanvas.width/r.width,y:(e.clientY-r.top)*sourceCanvas.height/r.height}; }
function drawCropOverlay(){ sctx.save(); sctx.fillStyle='rgba(0,0,0,.25)'; sctx.fillRect(0,0,sourceCanvas.width,sourceCanvas.height); sctx.clearRect(cropRect.x,cropRect.y,cropRect.w,cropRect.h); sctx.strokeStyle='#2563eb'; sctx.lineWidth=4; sctx.strokeRect(cropRect.x,cropRect.y,cropRect.w,cropRect.h); sctx.restore(); }
function applyCrop(){
  const {x,y,w,h}=cropRect; const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h; tmp.getContext('2d').drawImage(sourceCanvas,x,y,w,h,0,0,w,h);
  const img=new Image(); img.onload=()=>{ originalImage=img; currentRotation=0; cropRect=null; drawSource(); processImage(); setStatus('Retall aplicat.'); }; img.src=tmp.toDataURL('image/png');
}

function applyPreset(){
  const mode = $('#preset').value;
  if (mode === 'whiteboard') { $('#contrast').value=75; $('#threshold').value=175; $('#scale').value=3; $('#binarize').checked=true; $('#sharpen').checked=true; }
  if (mode === 'paper') { $('#contrast').value=55; $('#threshold').value=165; $('#scale').value=2.5; $('#binarize').checked=true; $('#sharpen').checked=true; }
  if (mode === 'printed') { $('#contrast').value=35; $('#threshold').value=150; $('#scale').value=2; $('#binarize').checked=false; $('#sharpen').checked=false; }
}
$('#preset').addEventListener('change', applyPreset);

function processImage(){
  if (!originalImage) return;
  const scale = Number($('#scale').value);
  processedCanvas.width = Math.round(sourceCanvas.width * scale);
  processedCanvas.height = Math.round(sourceCanvas.height * scale);
  pctx.imageSmoothingEnabled = true;
  pctx.drawImage(sourceCanvas, 0, 0, processedCanvas.width, processedCanvas.height);
  let img = pctx.getImageData(0,0,processedCanvas.width,processedCanvas.height);
  const data = img.data;
  const contrast = Number($('#contrast').value);
  const factor = (259*(contrast+255))/(255*(259-contrast));
  const threshold = Number($('#threshold').value);
  for(let i=0;i<data.length;i+=4){
    let r=data[i],g=data[i+1],b=data[i+2];
    let gray = 0.299*r + 0.587*g + 0.114*b;
    gray = factor*(gray-128)+128;
    gray = Math.max(0, Math.min(255, gray));
    if ($('#binarize').checked) gray = gray > threshold ? 255 : 0;
    data[i]=data[i+1]=data[i+2]=gray;
  }
  pctx.putImageData(img,0,0);
  if ($('#sharpen').checked) sharpenCanvas();
}
function sharpenCanvas(){
  const w=processedCanvas.width,h=processedCanvas.height;
  const src=pctx.getImageData(0,0,w,h); const out=pctx.createImageData(w,h); const s=src.data,d=out.data;
  const k=[0,-1,0,-1,5,-1,0,-1,0];
  for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++) for(let c=0;c<3;c++){
    let v=0,idx=0; for(let ky=-1;ky<=1;ky++) for(let kx=-1;kx<=1;kx++){ v += s[((y+ky)*w+(x+kx))*4+c]*k[idx++]; }
    d[(y*w+x)*4+c]=Math.max(0,Math.min(255,v)); d[(y*w+x)*4+3]=255;
  }
  pctx.putImageData(out,0,0);
}

async function runOCR(){
  if (!window.Tesseract) return setStatus('No s’ha pogut carregar Tesseract. Revisa la connexió.');
  processImage(); $('#progress').classList.remove('hidden'); $('#progress').value=0; $('#ocrBtn').disabled=true;
  setStatus('Llegint imatge...');
  try{
    const psm = $('#psm').value;
    const result = await Tesseract.recognize(processedCanvas, 'cat+spa+eng', {
      logger: m => { if (m.status) setStatus(m.status); if (m.progress) $('#progress').value=m.progress; }
    }, { tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' });
    const text = cleanOCR(result.data.text || '');
    $('#ocrText').value = text;
    setStatus(text.trim() ? 'OCR acabat. Revisa i corregeix el text abans de generar.' : 'No he pogut llegir text útil. Escriu-lo manualment a la caixa.');
  } catch(err){ console.error(err); setStatus('Ha fallat l’OCR. Prova de retallar més o escriu el text manualment.'); }
  finally{ $('#progress').classList.add('hidden'); $('#ocrBtn').disabled=false; }
}
function cleanOCR(t){ return t.replace(/[|_=~`^{}\[\]<>]/g,' ').replace(/\s+\n/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/[ \t]{2,}/g,' ').trim(); }

function generateNotes(){
  const raw = $('#ocrText').value.trim();
  const title = $('#titleInput').value.trim() || guessTitle(raw) || 'Apunts';
  if (!raw) return setStatus('Primer posa text a la caixa de revisió.');
  const notes = structureNotes(raw, title);
  structuredText = notes.text;
  const page = $('#notesPreview'); page.className = 'notesPage ' + ($('#styleSelect').value === 'compact' ? 'compact' : ($('#styleSelect').value === 'clean' ? 'clean' : ''));
  page.innerHTML = notes.html;
  $('#downloadBtn').disabled=false; $('#copyBtn').disabled=false; setStatus('Apunts generats.');
}
function guessTitle(raw){ const first = raw.split(/[.\n]/).find(Boolean) || ''; return first.length < 48 ? first : ''; }
function structureNotes(raw, title){
  const sentences = raw.split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(Boolean);
  const keywords = extractKeywords(raw);
  const summary = sentences.slice(0,3).join(' ');
  const important = keywords.map(k => `<li><span class="blue">${esc(k)}:</span> concepte important del tema.</li>`).join('') || '<li>Revisa el text OCR i afegeix conceptes importants.</li>';
  const steps = sentences.slice(0,6).map(s=>`<li>${esc(s)}</li>`).join('');
  const questions = keywords.slice(0,5).map(k=>`<li>Què vol dir ${esc(k)}?</li>`).join('') + (sentences.length ? '<li>Quina és la idea principal?</li>' : '');
  const html = `<h1 class="notesTitle">${esc(title)}</h1>
    <div><span class="sectionTitle">1. Tema</span><p>${esc(sentences[0] || raw)}</p></div>
    <div><span class="sectionTitle">2. Resum curt</span><p>${esc(summary || raw)}</p></div>
    <div><span class="sectionTitle">3. Conceptes importants</span><ul>${important}</ul></div>
    <div><span class="sectionTitle">4. Explicació ordenada</span><ol>${steps || `<li>${esc(raw)}</li>`}</ol></div>
    <div><span class="sectionTitle">5. Preguntes per estudiar</span><ol>${questions || '<li>Què cal recordar?</li>'}</ol></div>
    <div class="doodle">⌁ ❦ ♡ ❦ ⌁</div>`;
  const text = `${title}\n\nTema\n${sentences[0] || raw}\n\nResum curt\n${summary || raw}\n\nConceptes importants\n${keywords.map(k=>'- '+k).join('\n')}\n\nExplicació ordenada\n${sentences.map((s,i)=>`${i+1}. ${s}`).join('\n')}`;
  return {html,text};
}
function extractKeywords(raw){
  const stop = new Set('a al als amb de del dels des el els en es és i la les lo l o per que un una uns unes com quan on qui què quin quina quins quines també molt més menys'.split(' '));
  const words = raw.toLowerCase().normalize('NFC').match(/[a-zà-ÿ0-9·]{4,}/gi) || [];
  const counts = new Map(); words.forEach(w=>{ if(!stop.has(w)) counts.set(w,(counts.get(w)||0)+1); });
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([w])=>w.charAt(0).toUpperCase()+w.slice(1));
}
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

async function downloadNotesPNG(){
  const node = $('#notesPreview');
  await document.fonts.ready;
  const w = Math.min(1100, Math.max(760, node.scrollWidth));
  const h = Math.max(1000, node.scrollHeight + 60);
  const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d');
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#c7ddff'; ctx.lineWidth=1; for(let y=32;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.strokeStyle='#fecaca'; ctx.beginPath();ctx.moveTo(46,0);ctx.lineTo(46,h);ctx.stroke();
  let y=54; ctx.textBaseline='top'; ctx.textAlign='center'; ctx.font='700 60px Caveat, Kalam, cursive'; ctx.fillStyle='#1744c6'; ctx.fillText($('#titleInput').value.trim() || 'Apunts', w/2, y); y+=82;
  ctx.textAlign='left'; ctx.font='700 30px Kalam, cursive'; ctx.fillStyle='#111827';
  const lines = structuredText.split('\n').filter(l=>l.trim());
  for (const line of lines.slice(1)) {
    if (y > h-60) break;
    const isHead = !line.match(/^[\d\-]/) && line.length < 30;
    if (isHead) { ctx.fillStyle='#b8ef9f'; const mw=ctx.measureText(line).width+18; ctx.fillRect(68,y+12,mw,18); ctx.fillStyle='#111827'; ctx.font='700 31px Kalam, cursive'; ctx.fillText(line,72,y); y+=38; }
    else { ctx.font='400 25px Kalam, cursive'; ctx.fillStyle=line.startsWith('-')||line.match(/^\d+\./)?'#1744c6':'#111827'; wrapText(ctx,line,86,y,w-120,31); y += 31 * (Math.ceil(ctx.measureText(line).width/(w-120)) || 1); }
  }
  const a=document.createElement('a'); a.download='apunts-lens.png'; a.href=canvas.toDataURL('image/png'); a.click();
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight){ const words=text.split(' '); let line=''; for(const word of words){ const test=line+word+' '; if(ctx.measureText(test).width>maxWidth && line){ ctx.fillText(line,x,y); line=word+' '; y+=lineHeight; } else line=test; } ctx.fillText(line,x,y); }
