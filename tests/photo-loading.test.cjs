const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

class Element extends EventTarget {
  constructor(attrs = {}) { super(); this.attrs = { ...attrs }; this.style = { setProperty() {} }; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
}
class Image extends Element {
  constructor(back) {
    super({ width: '900', height: '1200', ...(back ? {} : { src: 'small-front.jpg' }) });
    this.dataset = { originalSrc: back ? 'original-back.jpg' : 'original-front.jpg', src: 'small-back.jpg', srcset: 'small-back.jpg 640w' };
    this.complete = !back; this.naturalWidth = back ? 0 : 900; this.requests = [];
  }
  get currentSrc() { return this.attrs.src || ''; }
  set src(v) { this.attrs.src = v; this.requests.push(v); this.complete = false; this.naturalWidth = 0; }
  set srcset(v) { this.attrs.srcset = v; }
  fail() { this.complete = true; this.naturalWidth = 0; this.dispatchEvent(new Event('error')); }
  succeed() { this.complete = true; this.naturalWidth = 900; this.dispatchEvent(new Event('load')); }
}
function setup() {
  const front = new Image(false), back = new Image(true), button = new Element();
  button.dataset = { photoName: 'Photo' };
  const faces = [front, back].map(img => Object.assign(new Element(), { querySelector: () => img }));
  button.querySelector = selector => faces[selector.includes('front') ? 0 : 1];
  const document = { baseURI: 'https://example.test/family/',
    querySelectorAll: s => s.startsWith('img') ? [front, back] : [button],
    getElementById: () => null };
  vm.runInNewContext(fs.readFileSync('couple-photos.js', 'utf8'), { document, URL });
  return { front, back, button, click: () => button.dispatchEvent(new Event('click')) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('backs stay unloaded until clicked and remain hidden until successfully loaded', async () => {
  const s = setup(); assert.equal(s.back.requests.length, 0);
  s.click(); assert.equal(s.back.requests.length, 1);
  assert.equal(s.button.getAttribute('aria-pressed'), 'false');
  s.back.succeed(); await tick();
  assert.equal(s.button.getAttribute('aria-pressed'), 'true');
  s.click(); await tick(); s.click(); await tick();
  assert.equal(s.back.requests.length, 1);
});

test('failed fronts retry once then fall back to the original without an infinite loop', () => {
  const s = setup(); s.front.fail();
  assert.match(s.front.currentSrc, /image_retry=1/);
  s.front.fail(); assert.equal(s.front.currentSrc, 'original-front.jpg');
  s.front.fail(); s.front.fail(); assert.equal(s.front.requests.length, 2);
  assert.equal(s.back.requests.length, 0);
});

test('back fallback finishes before flipping, without requiring image.decode', async () => {
  const s = setup(); assert.equal(s.back.decode, undefined);
  s.click(); s.back.fail(); s.back.fail();
  assert.equal(s.back.currentSrc, 'original-back.jpg');
  assert.equal(s.button.getAttribute('aria-pressed'), 'false');
  s.back.succeed(); await tick();
  assert.equal(s.button.getAttribute('aria-pressed'), 'true');
});

test('exhausted retries keep the front visible and permit another user attempt', async () => {
  const s = setup(); s.click(); s.back.fail(); s.back.fail(); s.back.fail(); await tick();
  assert.equal(s.button.getAttribute('aria-pressed'), 'false');
  assert.equal(s.button.getAttribute('aria-busy'), null);
  const count = s.back.requests.length;
  s.click(); assert.equal(s.back.requests.length, count + 1);
  s.back.succeed(); await tick();
  assert.equal(s.button.getAttribute('aria-pressed'), 'true');
});
