import assert from 'assert';
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';
const html = fs.readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const scripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g));
const script = scripts[scripts.length - 1][1];
function boot(options = {}) {
  const attrs = { 'data-theme': 'dark' }, classes = [], events = {}, posts = [], frames = [];
  let height = 900.2, resize;
  const root = { setAttribute(k,v) { attrs[k]=v; }, getAttribute(k) { return attrs[k]; } };
  const toggle = { addEventListener(k,fn) { events['toggle:'+k]=fn; } };
  const wrap = { getBoundingClientRect() { return { height }; } };
  const window = { addEventListener(k,fn) { events[k]=fn; }, requestAnimationFrame(fn) { frames.push(fn); } };
  window.parent = options.standalone ? window : { postMessage(data,origin) { posts.push({data,origin}); } };
  function ResizeObserver(fn) { resize=fn; this.observe = target => assert.strictEqual(target,wrap); }
  window.ResizeObserver = ResizeObserver;
  const document = { documentElement:root, body:{ classList:{ add(c) { classes.push(c); } } }, referrer:options.referrer === undefined ? 'https://aryayae.com/projects/ek/' : options.referrer, getElementById() { return toggle; }, querySelector() { return wrap; } };
  vm.runInNewContext(script, {window,document,location:{search:options.search || '',ancestorOrigins:options.ancestors || []},URL,URLSearchParams,ResizeObserver,isFinite,localStorage:{getItem() {return options.stored || null;}},setTimeout() { throw new Error('Unexpected freeze retry'); }});
  function flush() { while(frames.length) frames.shift()(); }
  flush();
  return {attrs,classes,events,posts,window,flush, resize(h) {height=h; resize(); flush();}};
}
const app=boot({search:'?bare&theme=light',stored:'dark'});
assert(app.classes.includes('ek-bare'));
assert.strictEqual(app.attrs['data-theme'],'light');
assert.strictEqual(app.posts[0].data.type,'ek-nakajima-height');
assert.strictEqual(app.posts[0].data.height,901);
assert.strictEqual(app.posts[0].origin,'https://aryayae.com');
app.resize(450.1);
assert.strictEqual(app.posts[1].data.height,451,'height must shrink');
app.resize(450.1);
assert.strictEqual(app.posts.length,2,'unchanged heights are suppressed');
function message(source,origin,theme,type='ek-nakajima-theme') {app.events.message({source,origin,data:{type,theme}});app.flush();}
message({},'https://aryayae.com','dark');
message(app.window.parent,'https://evil.example','dark');
message(app.window.parent,'https://aryayae.com','invalid');
message(app.window.parent,'https://aryayae.com','dark','wrong');
assert.strictEqual(app.attrs['data-theme'],'light');
message(app.window.parent,'https://aryayae.com','dark');
assert.strictEqual(app.attrs['data-theme'],'dark');
const solo=boot({standalone:true,search:'?bare',stored:'light'});
assert.strictEqual(solo.posts.length,0);
assert.strictEqual(solo.attrs['data-theme'],'light');
solo.events['toggle:click']();
assert.strictEqual(solo.attrs['data-theme'],'dark');
assert.strictEqual(boot({search:'?theme=invalid',stored:'light'}).attrs['data-theme'],'light');
assert.strictEqual(boot({referrer:''}).posts.length,0,'unknown parent must not receive posts');
assert.strictEqual(boot({referrer:'',ancestors:['https://aryayae.com']}).posts[0].origin,'https://aryayae.com');
assert(!/body\.ek-bare\s+\.intro/.test(html),'widget introduction must remain visible');
assert(/body\.ek-bare header\.hero,[\s\S]*?footer \{ display: none; \}/.test(html));
assert(!script.includes('document.documentElement.scrollHeight'));
console.log('embed bridge: theme validation, bare shell, standalone behavior and shrinking height passed');
