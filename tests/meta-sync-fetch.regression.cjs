const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function load(fetch) {
  const source = fs.readFileSync(path.join(__dirname, '../lib/social/meta.ts'), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace(/^export /gm, '');
  const context = {
    URL, Response, Map, Set, Error, Date, Number, process, fetch,
    SocialPlatform: { facebook: 'facebook', instagram: 'instagram' },
    encryptSecret: x => x, decryptSecret: x => x,
  };
  vm.createContext(context);
  vm.runInContext(stripTypeScriptTypes(source), context);
  return context;
}
function response(data, status = 200) { return new Response(JSON.stringify(data), { status }); }

test('Facebook history is independent of optional insights', async () => {
  const urls = [];
  const api = load(async url => {
    urls.push(new URL(url));
    return response({ data: [{ id: 'fb1', message: 'Existing post' }] });
  });
  const posts = await api.fetchFacebookPagePosts('page', 'token');
  assert.equal(posts[0].id, 'fb1');
  assert.doesNotMatch(urls[0].searchParams.get('fields'), /insights/);
});

test('Instagram follows sparse pages and deduplicates by provider ID', async () => {
  const urls = [];
  const pages = [
    { data: [{ id: 'ig1' }], paging: { next: 'https://untrusted.invalid/', cursors: { after: 'cursor1' } } },
    { data: [], paging: { next: 'unused', cursors: { after: 'cursor2' } } },
    { data: [{ id: 'ig1' }, { id: 'ig2' }] },
  ];
  const api = load(async url => { urls.push(new URL(url)); return response(pages.shift()); });
  const posts = await api.fetchInstagramMedia('account', 'token');
  assert.equal(posts.length, 2);
  assert.equal(urls.length, 3);
  assert.equal(urls[1].searchParams.get('after'), 'cursor1');
  assert.equal(urls[2].searchParams.get('after'), 'cursor2');
  assert.ok(urls.every(url => url.hostname === 'graph.facebook.com'));
});

test('Facebook authentication errors propagate without a fallback', async () => {
  let calls = 0;
  const api = load(async () => { calls++; return response({ error: { message: 'Invalid OAuth access token' } }, 400); });
  await assert.rejects(api.fetchFacebookPagePosts('page', 'token'), /Invalid OAuth/);
  assert.equal(calls, 1);
});

test('Repeated provider cursors fail instead of looping', async () => {
  const api = load(async () => response({ data: [], paging: { next: 'unused', cursors: { after: 'same' } } }));
  await assert.rejects(api.fetchInstagramMedia('account', 'token'), /invalid pagination/);
});
