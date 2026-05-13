const $ = (id) => document.getElementById(id);

const imageInput = $('imageInput');
const preview = $('preview');
const ocrButton = $('ocrButton');
const clearButton = $('clearButton');
const rawText = $('rawText');
const notesText = $('notesText');
const notesButton = $('notesButton');
const renderButton = $('renderButton');
const downloadButton = $('downloadButton');
const demoButton = $('demoButton');
const titleInput = $('titleInput');
const styleSelect = $('styleSelect');
const statusEl = $('status');
const progress = $('ocrProgress');
const canvas = $('notesCanvas');
const ctx = canvas.getContext('2d');

let selectedImage = null;
let lastBlobUrl = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

imageInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  selectedImage = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;
  ocrButton.disabled = false;
  statusEl.textContent = 'Imatge carregada. Ja pots fer OCR.';
});

ocrButton.addEventListener('click', async () => {
  if (!selectedImage || !window.Tesseract) {
    statusEl.textContent = 'No hi ha imatge o Tesseract encara no està carregat.';
    return;
  }

  ocrButton.disabled = true;
  progress.hidden = false;
  progress.value = 0;
  statusEl.textContent = 'Llegint la imatge...';

  try {
    const result = await Tesseract.recognize(selectedImage, 'cat+spa+eng', {
      logger: (m) => {
        if (m.status) statusEl.textContent = `${m.status}...`;
        if (typeof m.progress === 'number') progress.value = Math.round(m.progress * 100);
      },
    });
    rawText.value = cleanOcrText(result.data.text);
    statusEl.textContent = 'OCR acabat. Revisa el text abans de generar els apunts.';
  } catch (error) {
    console.error(error);
    statusEl.textContent = 'No he pogut fer l’OCR. Prova una foto més clara o escriu el text manualment.';
  } finally {
    ocrButton.disabled = false;
    setTimeout(() => { progress.hidden = true; }, 1200);
  }
});

clearButton.addEventListener('click', () => {
  selectedImage = null;
  imageInput.value = '';
  preview.hidden = true;
  preview.removeAttribute('src');
  ocrButton.disabled = true;
  rawText.value = '';
  notesText.value = '';
  statusEl.textContent = '';
  downloadButton.disabled = true;
  drawBlankPage();
});

demoButton.addEventListener('click', () => {
  rawText.value = `La fotosíntesi\nLes plantes fabriquen el seu aliment amb la llum solar.\nTransformen aigua i diòxid de carboni en glucosa i oxigen.\nElements importants: clorofil·la, cloroplasts, glucosa, oxigen, CO2 i aigua.\nPrimer les arrels absorbeixen aigua. Després les fulles capten CO2. La clorofil·la capta la llum. Dins dels cloroplasts es forma glucosa i s'allibera oxigen.\nExemple: els arbres i les algues fan fotosíntesi.`;
  titleInput.value = 'La fotosíntesi';
});

notesButton.addEventListener('click', () => {
  const text = cleanOcrText(rawText.value);
  if (!text.trim()) {
    notesText.value = 'Enganxa o extreu text abans de generar apunts.';
    return;
  }
  notesText.value = buildStudyNotes(text, titleInput.value.trim() || guessTitle(text));
});

renderButton.addEventListener('click', async () => {
  const title = titleInput.value.trim() || guessTitle(notesText.value || rawText.value) || 'Els meus apunts';
  const content = notesText.value.trim() || buildStudyNotes(rawText.value, title);
  if (!content.trim()) {
    statusEl.textContent = 'Primer cal tenir text o apunts.';
    return;
  }
  await document.fonts.ready;
  renderNotesImage(title, content, styleSelect.value);
  downloadButton.disabled = false;
  statusEl.textContent = 'Imatge creada. La pots descarregar en PNG.';
});

downloadButton.addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = lastBlobUrl;
    a.download = `${slugify(titleInput.value || 'apunts')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, 'image/png', 0.95);
});

function cleanOcrText(text) {
  return (text || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function guessTitle(text) {
  const firstLine = (text || '').split('\n').map(s => s.trim()).find(Boolean);
  if (!firstLine) return 'Els meus apunts';
  return firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine;
}

function splitSentences(text) {
  return text
    .replace(/\n+/g, '. ')
    .split(/(?<=[.!?])\s+|;\s+|\s-\s/)
    .map(s => s.trim())
    .filter(s => s.length > 8);
}

function buildStudyNotes(text, title) {
  const sentences = splitSentences(text);
  const keywords = extractKeywords(text);
  const summary = sentences.slice(0, 3).join(' ');
  const important = keywords.slice(0, 7).map(k => `- ${capitalize(k)}: concepte important del tema.`).join('\n');
  const ordered = sentences.slice(0, 6).map((s, i) => `${i + 1}. ${ensurePeriod(s)}`).join('\n');
  const examples = sentences.filter(s => /exemple|com ara|per exemple|arbres|plantes|classe|pissarra|full/i.test(s)).slice(0, 3);
  const examplesText = (examples.length ? examples : sentences.slice(-3)).map(s => `- ${ensurePeriod(s)}`).join('\n');

  return `${title}\n\n1. Tema\n${ensurePeriod(sentences[0] || summary || text.slice(0, 160))}\n\n2. Resum curt\n${ensurePeriod(summary || text.slice(0, 420))}\n\n3. Conceptes importants\n${important || '- Idea principal: punt central del tema.\n- Paraules clau: termes que cal recordar.'}\n\n4. Explicació ordenada\n${ordered || '1. Revisa el text detectat.\n2. Corregeix els errors de l’OCR.\n3. Torna a generar els apunts.'}\n\n5. Exemples\n${examplesText}\n\n6. Preguntes per estudiar\n1. Què explica aquest tema?\n2. Quins conceptes són més importants?\n3. Com es pot resumir en una frase?\n4. Quin exemple ajuda a entendre-ho?\n5. Quina part cal repassar més?`;
}

function extractKeywords(text) {
  const stop = new Set('a al als amb de del dels des d el els en entre es la les lo i o que per pel pels un una uns unes ho hi no sí se ser és són com quan on qui què quin quina quins quines aquest aquesta aquests aquestes també més menys molt molta molts moltes'.split(' '));
  const counts = new Map();
  const words = text.toLowerCase().normalize('NFC').match(/[a-zàèéíïòóúüç·]{4,}/gi) || [];
  for (const word of words) {
    const w = word.toLowerCase();
    if (stop.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function ensurePeriod(str) {
  const s = (str || '').trim();
  if (!s) return '';
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

function slugify(str) {
  return (str || 'apunts').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'apunts';
}

function drawBlankPage() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawNotebookBackground();
  ctx.fillStyle = '#1746b8';
  ctx.font = '700 72px Caveat, Patrick Hand, cursive';
  ctx.textAlign = 'center';
  ctx.fillText('Els teus apunts', canvas.width / 2, 150);
  ctx.textAlign = 'left';
}

function drawNotebookBackground() {
  ctx.fillStyle = '#fffef9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#d7e8ff';
  ctx.lineWidth = 1.3;
  for (let y = 88; y < canvas.height; y += 46) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.strokeStyle = '#ffc7c7';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(78, 0); ctx.lineTo(78, canvas.height); ctx.stroke();
}

function renderNotesImage(title, notes, style) {
  canvas.width = 1240;
  canvas.height = 1754;
  drawNotebookBackground();

  if (style === 'realistic') addPaperTexture();

  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1746b8';
  ctx.font = '700 80px Caveat, Patrick Hand, cursive';
  wrapText(title, canvas.width / 2, 52, 980, 82, 'center');
  underline(canvas.width / 2 - 230, 145, 460, '#38a22d');

  const lines = normalizeNotes(notes, title);
  let y = 205;
  const marginX = 105;
  const maxWidth = canvas.width - marginX - 72;

  for (const line of lines) {
    if (y > canvas.height - 110) break;
    if (line.type === 'blank') { y += 18; continue; }

    if (line.type === 'heading') {
      ctx.font = '700 40px Patrick Hand, Caveat, cursive';
      const width = Math.min(ctx.measureText(line.text).width + 28, maxWidth);
      highlight(marginX - 8, y + 4, width, 42);
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'left';
      ctx.fillText(line.text, marginX, y);
      y += 58;
      continue;
    }

    if (line.type === 'bullet') {
      ctx.font = '500 34px Patrick Hand, Caveat, cursive';
      ctx.fillStyle = '#1746b8';
      ctx.beginPath(); ctx.arc(marginX + 8, y + 19, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111827';
      y = wrapText(line.text.replace(/^-\s*/, ''), marginX + 38, y, maxWidth - 38, 42, 'left');
      y += 5;
      continue;
    }

    if (line.type === 'number') {
      const match = line.text.match(/^(\d+\.)(.*)$/);
      ctx.font = '700 34px Patrick Hand, Caveat, cursive';
      ctx.fillStyle = '#1746b8';
      ctx.textAlign = 'left';
      ctx.fillText(match?.[1] || '', marginX, y);
      ctx.fillStyle = '#111827';
      ctx.font = '500 34px Patrick Hand, Caveat, cursive';
      y = wrapText((match?.[2] || line.text).trim(), marginX + 45, y, maxWidth - 45, 42, 'left');
      y += 5;
      continue;
    }

    ctx.font = '500 34px Patrick Hand, Caveat, cursive';
    ctx.fillStyle = '#111827';
    y = wrapText(line.text, marginX, y, maxWidth, 42, 'left');
    y += 8;
  }

  drawBottomDoodle();
}

function normalizeNotes(notes, title) {
  return notes.split('\n').map(s => s.trim()).map((text) => {
    if (!text) return { type: 'blank', text };
    if (text === title) return { type: 'blank', text: '' };
    if (/^\d+\.\s+[A-ZÀ-Ú]/.test(text) && text.length < 55 && !text.endsWith('?')) return { type: 'heading', text };
    if (/^-\s+/.test(text)) return { type: 'bullet', text };
    if (/^\d+\.\s+/.test(text)) return { type: 'number', text };
    return { type: 'text', text };
  });
}

function wrapText(text, x, y, maxWidth, lineHeight, align = 'left') {
  ctx.textAlign = align;
  const words = text.split(/\s+/);
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

function highlight(x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#b9f3a4';
  const r = 10;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function underline(x, y, w, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= w; i += 18) {
    ctx.lineTo(x + i, y + Math.sin(i / 35) * 4);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBottomDoodle() {
  const y = canvas.height - 72;
  ctx.save();
  ctx.strokeStyle = '#1746b8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(140, y);
  for (let x = 140; x < canvas.width - 140; x += 18) {
    ctx.lineTo(x, y + Math.sin(x / 62) * 7);
  }
  ctx.stroke();
  ctx.font = '700 42px Caveat, cursive';
  ctx.fillStyle = '#1746b8';
  ctx.textAlign = 'center';
  ctx.fillText('♡', canvas.width / 2, y - 24);
  ctx.restore();
}

function addPaperTexture() {
  ctx.save();
  ctx.globalAlpha = 0.035;
  for (let i = 0; i < 8000; i++) {
    const v = Math.random() * 255;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
  }
  ctx.restore();
}

drawBlankPage();
