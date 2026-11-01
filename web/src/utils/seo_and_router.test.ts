import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewsSlug, getNewsUrl, getCategorySlug, getTopicUrl, parsePath } from './router.ts';
import { isDistrictMatch, ALL_DISTRICTS, filterPostsByCategory } from './newsFilter.ts';

test('SEO Slug Generation - createNewsSlug', () => {
  // Telugu headline slugification
  const teluguSlug = createNewsSlug('ఆంధ్రప్రదేశ్‌లో భారీ వర్షాలు - రెడ్ అలర్ట్ జారీ!');
  assert.ok(teluguSlug.length > 0);
  assert.ok(!teluguSlug.includes('!'));
  assert.ok(!teluguSlug.includes(' '));

  // English headline slugification
  const englishSlug = createNewsSlug('AP Govt Announces New Welfare Scheme 2026!');
  assert.equal(englishSlug, 'AP-Govt-Announces-New-Welfare-Scheme-2026');

  // Fallback on empty or undefined headline
  assert.equal(createNewsSlug(''), 'vaartha');
  assert.equal(createNewsSlug(undefined), 'vaartha');
});

test('SEO News Article URL - getNewsUrl', () => {
  const post = {
    id: 'post_abc123',
    headline: {
      telugu: 'నెల్లూరులో భారీ వర్షాలు',
      english: 'Heavy Rains in Nellore',
    },
  };

  const url = getNewsUrl(post);
  assert.ok(url.startsWith('/news/'));
  assert.ok(url.endsWith('--post_abc123'));

  // Invalid post returns home
  assert.equal(getNewsUrl(null as any), '/');
  assert.equal(getNewsUrl({ id: '' }), '/');
});

test('SEO Topic URL - getTopicUrl', () => {
  assert.equal(getTopicUrl('జగన్'), `/topic/${encodeURIComponent('జగన్')}`);
  assert.equal(getTopicUrl('#వైసీపీ'), `/topic/${encodeURIComponent('వైసీపీ')}`);
  assert.equal(getTopicUrl(''), '/');
});

test('SEO Category Mapping - getCategorySlug', () => {
  assert.equal(getCategorySlug('ఆంధ్రప్రదేశ్'), 'andhra-pradesh');
  assert.equal(getCategorySlug('తెలంగాణ'), 'telangana');
  assert.equal(getCategorySlug('రాజకీయం'), 'politics');
  assert.equal(getCategorySlug('సినిమా'), 'cinema');
  assert.equal(getCategorySlug('క్రీడలు'), 'sports');
  assert.equal(getCategorySlug('క్రైమ్'), 'crime');
  assert.equal(getCategorySlug('వ్యాపారం'), 'business');
  assert.equal(getCategorySlug('టెక్నాలజీ'), 'technology');
});

test('Router Path Parser - parsePath with Topics & Entities', () => {
  // Root / Home
  assert.deepEqual(parsePath('/', ''), { type: 'home' });

  // News URL with slug--id format
  const newsRoute = parsePath('/news/bhaaree-varshaalu--post_999', '');
  assert.deepEqual(newsRoute, { type: 'news', id: 'post_999' });

  // Direct News ID
  const directNewsRoute = parsePath('/news/post_999', '');
  assert.deepEqual(directNewsRoute, { type: 'news', id: 'post_999' });

  // Category URL
  const catRoute = parsePath('/category/politics', '');
  assert.deepEqual(catRoute, { type: 'category', category: 'రాజకీయం', slug: 'politics' });

  // Topic & Hashtag URL
  const topicRoute = parsePath('/topic/%E0%B0%9C%E0%B0%97%E0%B0%A8%E0%B1%8D', '');
  assert.deepEqual(topicRoute, { type: 'topic', topic: 'జగన్' });

  const tagRoute = parsePath('/tag/YSRCP', '');
  assert.deepEqual(tagRoute, { type: 'topic', topic: 'YSRCP' });

  // Classifieds URL
  assert.deepEqual(parsePath('/classifieds', ''), { type: 'classifieds' });

  // Policy URLs
  assert.deepEqual(parsePath('/about', ''), { type: 'policy', policy: 'about' });
  assert.deepEqual(parsePath('/privacy-policy', ''), { type: 'policy', policy: 'privacy-policy' });
});

test('District Matching & Aliases - isDistrictMatch', () => {
  // Alias checks
  assert.ok(isDistrictMatch('నెల్లూరు', 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు'));
  assert.ok(isDistrictMatch('వైజాగ్', 'విశాఖపట్నం'));
  assert.ok(isDistrictMatch('విజయవాడ', 'ఎన్టీఆర్'));
  assert.ok(isDistrictMatch('తిరుపతి', 'తిరుపతి'));
  assert.ok(isDistrictMatch('హైదరాబాద్', 'హైదరాబాద్'));

  // Negative checks
  assert.strictEqual(isDistrictMatch('గుంటూరు', 'విశాఖపట్నం'), false);
  assert.strictEqual(isDistrictMatch('', 'హైదరాబాద్'), false);

  // Verification of district catalog
  assert.ok(ALL_DISTRICTS.length >= 50);
});

test('Topic & Entity Filtering - filterPostsByCategory', () => {
  const dummyPosts: any[] = [
    {
      id: 'p1',
      headline: { telugu: 'వైసీపీ అధినేత జగన్ మోహన్ రెడ్డి ప్రెస్ మీట్' },
      tags: ['జగన్', 'వైసీపీ'],
      entities: { people: ['జగన్ మోహన్ రెడ్డి'], organizations: ['వైసీపీ'] },
      category: 'రాజకీయం',
    },
    {
      id: 'p2',
      headline: { telugu: 'అమరావతిలో సీఎం చంద్రబాబు సమీక్ష' },
      tags: ['చంద్రబాబు', 'అమరావతి'],
      entities: { people: ['చంద్రబాబు నాయుడు'], locations: ['అమరావతి'] },
      category: 'రాజకీయం',
    },
    {
      id: 'p3',
      headline: { telugu: 'నెల్లూరు జిల్లాలో భారీ వర్షాలు' },
      district: 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు',
      tags: ['వర్షాలు'],
      category: 'వాతావరణం',
    },
  ];

  // Match by person / hashtag topic 'జగన్'
  const jaganPosts = filterPostsByCategory(dummyPosts, 'జగన్');
  assert.equal(jaganPosts.length, 1);
  assert.equal(jaganPosts[0].id, 'p1');

  // Match by topic 'చంద్రబాబు'
  const cbnPosts = filterPostsByCategory(dummyPosts, 'చంద్రబాబు');
  assert.equal(cbnPosts.length, 1);
  assert.equal(cbnPosts[0].id, 'p2');

  // Match by hashtag 'వర్షాలు'
  const rainPosts = filterPostsByCategory(dummyPosts, 'వర్షాలు');
  assert.equal(rainPosts.length, 1);
  assert.equal(rainPosts[0].id, 'p3');
});
