const slides = [...document.querySelectorAll('#stage > .slide')];
const notes = [
  {
    cue: '0:00–0:15 · 15 seconds',
    speech: 'After a party, you want the photos your friends took. But they’re on other phones. You message the group, ask people to send them, and still miss some. Collecting event photos is manual work.',
    direction: 'Сначала знакомая проблема: после вечеринки нужно выпрашивать фотографии. Без статистики и метафор.'
  },
  {
    cue: '0:15–0:35 · 20 seconds',
    speech: 'RollCall collects those photos in one shared album. The host creates the album and shares a QR code. Guests scan it, sign in with Google, and upload their photos. Everyone who joins can see the album and download the originals.',
    direction: 'Решение одним предложением, затем три шага под фотографиями. Это сценарий продукта, а не три скриншота.'
  },
  {
    cue: '0:35–0:47 · 12 seconds',
    speech: 'One QR code for the event. No app to install. Guests use their phone’s browser. Google sign-in is the only account step before joining the album.',
    direction: '1 QR и 0 установок являются проверяемыми фактами продукта. Данных о пользователях и скорости пока нет. Не называть эти числа результатами исследования.'
  },
  {
    cue: '0:47–1:12 · 25 seconds',
    speech: 'The album also handles the repetitive work. It groups similar photos and shows the best shot first. The other originals remain available. To find a photo, type what’s in it, like birthday cake. Our focus is simple: collect the photos, reduce duplicates, and make them easy to find.',
    direction: 'Конкретное объяснение сложности внутри продукта: группировка похожих фото и поиск по содержимому. Повтор фото иллюстрирует группировку, а не реальный замер алгоритма.'
  },
  {
    cue: '1:12–1:25 · Demo 1:25–2:55 · Closing 2:55–3:00',
    speech: 'Now we’ll scan the QR code, join the album, and upload a photo. You’ll see it appear on the second phone. Then we’ll show grouping and search.',
    direction: 'Переключитесь на приложение. 1:25–1:40 QR и вход гостя; 1:40–2:05 загрузка; 2:05–2:25 фото на втором устройстве и оригинал; 2:25–2:45 похожие кадры и поиск; 2:45–2:55 запас. Вернитесь на этот же слайд. В 2:55–3:00 скажите: “RollCall collects your event photos in one shared album. Thank you.” Всего речь 90 секунд, демо 90 секунд. Не показывайте Notes на проекторе.'
  }
];
const stage = document.querySelector('#stage');
const wrap = document.querySelector('.stage-wrap');
const panel = document.querySelector('#notes');
const overview = document.querySelector('#overview');
let current = Math.max(0, Math.min(slides.length - 1, (Number(location.hash.slice(1)) || 1) - 1));
let remaining = 180;
let running = false;
let deadline = 0;

function resize() {
  stage.style.setProperty('--scale', wrap.clientWidth / 1600);
  document.querySelectorAll('.mini-stage').forEach(el => {
    el.style.transform = `scale(${el.parentElement.clientWidth / 1600})`;
  });
}
new ResizeObserver(resize).observe(wrap);
window.addEventListener('resize', resize);

function show(index, updateHash = true) {
  current = Math.max(0, Math.min(slides.length - 1, index));
  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === current);
    slide.setAttribute('aria-hidden', String(i !== current));
    slide.inert = i !== current;
  });
  document.querySelector('#prev').disabled = current === 0;
  document.querySelector('#next').disabled = current === slides.length - 1;
  document.querySelector('#counter').textContent = `${current + 1} / ${slides.length}`;
  document.querySelector('#cue').textContent = notes[current].cue;
  document.querySelector('#notes-title').textContent = slides[current].dataset.title;
  document.querySelector('#speech').textContent = notes[current].speech;
  document.querySelector('#direction').textContent = notes[current].direction;
  document.querySelector('#announcement').textContent = `Slide ${current + 1}: ${slides[current].dataset.title}`;
  document.title = `RollCall · ${current + 1}/${slides.length} · ${slides[current].dataset.title}`;
  document.querySelectorAll('.thumbnail').forEach((el, i) => el.setAttribute('aria-current', String(i === current)));
  if (updateHash) history.replaceState(null, '', `#${current + 1}`);
}
function toggleNotes(force) {
  panel.hidden = force === undefined ? !panel.hidden : !force;
  document.querySelector('#notes-toggle').setAttribute('aria-expanded', String(!panel.hidden));
}
function toggleOverview() {
  if (overview.open) overview.close();
  else { overview.showModal(); resize(); }
  document.querySelector('#overview-toggle').setAttribute('aria-expanded', String(overview.open));
}
async function fullscreen() {
  toggleNotes(false);
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    document.body.classList.toggle('presenting');
    resize();
  }
}
document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('presenting', Boolean(document.fullscreenElement));
  resize();
});
function updateClock() {
  if (running) remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  document.querySelector('#timer').textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  document.querySelector('#timer').classList.toggle('over', remaining === 0);
  if (remaining === 0) running = false;
  document.querySelector('#timer-toggle').textContent = running ? 'Pause rehearsal' : remaining < 180 ? 'Resume rehearsal' : 'Start rehearsal';
}
function toggleTimer() {
  if (remaining === 0) remaining = 180;
  running = !running;
  if (running) deadline = Date.now() + remaining * 1000;
  updateClock();
}
setInterval(updateClock, 250);
document.querySelector('#timer-toggle').addEventListener('click', toggleTimer);
document.querySelector('#timer-reset').addEventListener('click', () => { running = false; remaining = 180; updateClock(); });
document.querySelector('#prev').addEventListener('click', () => show(current - 1));
document.querySelector('#next').addEventListener('click', () => show(current + 1));
document.querySelector('#notes-toggle').addEventListener('click', () => toggleNotes());
document.querySelector('#notes-close').addEventListener('click', () => toggleNotes(false));
document.querySelector('#overview-toggle').addEventListener('click', toggleOverview);
document.querySelector('#overview-close').addEventListener('click', () => overview.close());
overview.addEventListener('close', () => document.querySelector('#overview-toggle').setAttribute('aria-expanded', 'false'));
document.querySelector('#fullscreen').addEventListener('click', fullscreen);
window.addEventListener('hashchange', () => show((Number(location.hash.slice(1)) || 1) - 1, false));
document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (overview.open) return;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); show(current + 1); }
  else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(event.key)) { event.preventDefault(); show(current - 1); }
  else if (event.key === 'Home') { event.preventDefault(); show(0); }
  else if (event.key === 'End') { event.preventDefault(); show(slides.length - 1); }
  else if (/^[1-5]$/.test(event.key)) show(Number(event.key) - 1);
  else if (event.key.toLowerCase() === 'n') toggleNotes();
  else if (event.key.toLowerCase() === 'o') toggleOverview();
  else if (event.key.toLowerCase() === 'f') fullscreen();
  else if (event.key.toLowerCase() === 't') toggleTimer();
  else if (event.key === 'Escape') { toggleNotes(false); document.body.classList.remove('presenting'); resize(); }
});
let touchStart = null;
wrap.addEventListener('touchstart', event => { touchStart = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }; }, { passive: true });
wrap.addEventListener('touchend', event => {
  if (!touchStart) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
  touchStart = null;
}, { passive: true });
slides.forEach((slide, i) => {
  const button = document.createElement('button');
  button.className = 'thumbnail';
  button.setAttribute('aria-label', `Go to slide ${i + 1}: ${slide.dataset.title}`);
  const mini = document.createElement('div'); mini.className = 'mini-wrap';
  const canvas = document.createElement('div'); canvas.className = 'mini-stage';
  const clone = slide.cloneNode(true); clone.setAttribute('aria-hidden', 'true'); clone.inert = true;
  clone.querySelectorAll('img').forEach(img => img.alt = '');
  canvas.append(clone); mini.append(canvas);
  const label = document.createElement('span'); label.className = 'thumbnail-label'; label.textContent = `${i + 1}. ${slide.dataset.title}`;
  button.append(mini, label);
  button.addEventListener('click', () => { show(i); overview.close(); });
  document.querySelector('#overview-grid').append(button);
});
show(current);
resize();
