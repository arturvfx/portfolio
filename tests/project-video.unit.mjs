import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ URL, URLSearchParams });
vm.runInContext(readFileSync(new URL('../components/youtube-player.js', import.meta.url), 'utf8'), context);
const parse = context.getProjectVideo;

test('existing YouTube formats retain their canonical URL and player', () => {
  for (const input of ['dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']) {
    assert.equal(parse(input).url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.match(parse(input, true).embedUrl, /youtube-nocookie\.com.*autoplay=1/);
  }
});

test('Vimeo public, embed and unlisted links keep their privacy hash', () => {
  assert.equal(parse('https://vimeo.com/123456').type, 'vimeo');
  for (const input of ['https://vimeo.com/123456/abc123', 'https://player.vimeo.com/video/123456?h=abc123']) {
    const video = parse(input, true);
    assert.equal(video.url, 'https://player.vimeo.com/video/123456?h=abc123');
    assert.equal(new URL(video.embedUrl).searchParams.get('h'), 'abc123');
    assert.equal(new URL(video.embedUrl).searchParams.get('autoplay'), '1');
    assert.equal(parse(video.url).url, video.url);
  }
});

test('direct media preserves signed queries and supports Supabase storage', () => {
  for (const url of ['https://example.supabase.co/storage/v1/object/public/portfolio-media/full.mp4', 'https://cdn.example.com/Full.WEBM?token=abc#t=2']) {
    assert.equal(parse(url).type, 'file');
    assert.equal(parse(url).url, url);
  }
});

test('unsupported pages, unsafe schemes and lookalike hosts are rejected', () => {
  for (const input of ['', 'javascript:alert(1)', 'ftp://example.com/video.mp4', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://vimeo.com.evil.test/1234', 'https://example.com/watch', 'https://user:pass@example.com/video.mp4', 'https://vimeo.com/event/1234']) {
    assert.equal(parse(input), null, input);
  }
});
