import { test } from 'node:test';
import assert from 'node:assert';
import { getOptimizedImageUrl } from './imageHelper.ts';

test('imageHelper - returns default image when url is empty or null', () => {
  assert.match(getOptimizedImageUrl(''), /bg\.png/);
  assert.match(getOptimizedImageUrl(null), /bg\.png/);
  assert.match(getOptimizedImageUrl(undefined), /bg\.png/);
});

test('imageHelper - preserves existing wsrv.nl urls without re-encoding', () => {
  const wsrvUrl = 'https://wsrv.nl/?url=test.jpg&w=640';
  assert.strictEqual(getOptimizedImageUrl(wsrvUrl), wsrvUrl);
});

test('imageHelper - formats raw image urls with width, webp output, and q=75', () => {
  const rawUrl = 'https://firebasestorage.googleapis.com/v0/b/app/o/image.jpg?alt=media';
  const optimized = getOptimizedImageUrl(rawUrl, 640);
  assert.ok(optimized.startsWith('https://wsrv.nl/?url='));
  assert.ok(optimized.includes('w=640'));
  assert.ok(optimized.includes('output=webp'));
  assert.ok(optimized.includes('q=75'));
});

test('imageHelper - allows custom width such as 100 for blur backgrounds', () => {
  const rawUrl = 'https://example.com/photo.jpg';
  const optimized = getOptimizedImageUrl(rawUrl, 100);
  assert.ok(optimized.includes('w=100'));
});
