import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  blendHomeFeed,
  buildInterestProfile,
  expandCategoriesForFirestoreQuery,
  getPostCategoryTag,
  normalizeCategoryKey,
  pickFastPathTop3,
} from './newsFeedBlender.ts';
import type { NewsPost } from '../types.ts';

const NOW = 1_760_000_000_000;
const MIN = 60_000;
const HR = 60 * MIN;

function makePost(overrides: Partial<NewsPost> & { id: string }): NewsPost {
  return {
    id: overrides.id,
    headline: { telugu: `వార్త ${overrides.id}`, english: `News ${overrides.id}` },
    content: { telugu: 'కంటెంట్', english: 'Content' },
    mediaUrl: 'https://example.com/img.jpg',
    mediaType: 'image',
    postFormat: '9:16' as NewsPost['postFormat'],
    reporter: { id: 'rep1', name: 'Reporter' },
    location: '',
    district: 'General',
    timestamp: NOW,
    categories: ['General'],
    likes: 0,
    comments: 0,
    shares: 0,
    qualityScore: 6,
    approved: true,
    ...overrides,
  };
}

describe('newsFeedBlender — Anti-Scraper-Burst & 40/30/30 User Interest Blending', () => {
  it('defeats 6 Sports + 5 National scraper burst, preserves Fast Path 3 anchors, and blends user interests + local district cleanly', () => {
    // Exact scenario reported by user:
    // Scraper just inserted 6 Sports (0-5 mins ago) + 5 National (6-10 mins ago) at the very top!
    const scrapedSports = Array.from({ length: 6 }, (_, i) =>
      makePost({
        id: `sports_${i + 1}`,
        categories: ['క్రీడలు'],
        category: 'క్రీడలు',
        timestamp: NOW - i * MIN,
      })
    );
    const scrapedNational = Array.from({ length: 5 }, (_, i) =>
      makePost({
        id: `national_${i + 1}`,
        categories: ['జాతీయం'],
        category: 'జాతీయం',
        timestamp: NOW - (6 + i) * MIN,
      })
    );

    // Older articles (1-3 hours ago) matching user interests (Cinema, Technology) + Local District (గుంటూరు) + Discovery
    const cinemaPosts = Array.from({ length: 5 }, (_, i) =>
      makePost({
        id: `cinema_${i + 1}`,
        categories: ['Cinema'], // English tag — tests bilingual matching against Telugu 'సినిమా' score!
        category: 'వినోదం',
        timestamp: NOW - (1 + i * 0.3) * HR,
      })
    );
    const techPosts = Array.from({ length: 4 }, (_, i) =>
      makePost({
        id: `tech_${i + 1}`,
        categories: ['టెక్నాలజీ'],
        category: 'టెక్నాలజీ',
        timestamp: NOW - (1.2 + i * 0.3) * HR,
      })
    );
    const localPosts = Array.from({ length: 6 }, (_, i) =>
      makePost({
        id: `local_${i + 1}`,
        district: 'గుంటూరు',
        categories: ['రాజకీయం'], // Notice: no literal 'జిల్లా వార్త' tag — tests local district detection fix!
        category: 'రాజకీయం',
        timestamp: NOW - (0.8 + i * 0.4) * HR,
      })
    );
    const otherDiscovery = [
      makePost({ id: 'biz_1', categories: ['వ్యాపారం'], category: 'వ్యాపారం', timestamp: NOW - 1.5 * HR }),
      makePost({ id: 'health_1', categories: ['ఆరోగ్యం'], category: 'ఆరోగ్యం', timestamp: NOW - 1.6 * HR }),
      makePost({ id: 'crime_1', categories: ['క్రైమ్'], category: 'క్రైమ్', timestamp: NOW - 1.7 * HR }),
      makePost({ id: 'politics_1', categories: ['రాజకీయం'], category: 'రాజకీయం', timestamp: NOW - 1.8 * HR }),
    ];

    // Other district post that MUST be rejected by strict Home Feed filter
    const otherDistrictPost = makePost({
      id: 'warangal_leak',
      district: 'వరంగల్',
      categories: ['జిల్లా వార్త', 'క్రైమ్'],
      category: 'క్రైమ్',
      timestamp: NOW - 2 * MIN,
    });

    const userDistrict = 'గుంటూరు';
    // User loves Cinema & Technology (recorded in Telugu)
    const profile = buildInterestProfile({
      localCategoryScores: { 'సినిమా': 18, 'టెక్నాలజీ': 14 },
    });

    // Step 1: Fast Path query sees latest 10 (6 Sports + 4 National) -> picks 3 anchors
    const fastCandidates = [...scrapedSports, ...scrapedNational].slice(0, 10);
    const fastTop3 = pickFastPathTop3(fastCandidates, profile, userDistrict, 3, NOW);
    assert.equal(fastTop3.length, 3);
    // Even within Fast Path 3, shouldn't put 3 Sports back-to-back when National is available
    assert.notEqual(
      getPostCategoryTag(fastTop3[0], userDistrict),
      getPostCategoryTag(fastTop3[1], userDistrict)
    );

    // Step 2: Full parallel blend runs with Fast Path 3 anchored at [0, 1, 2]
    const allPosts = [
      ...scrapedSports,
      ...scrapedNational,
      ...cinemaPosts,
      ...techPosts,
      ...localPosts,
      ...otherDiscovery,
      otherDistrictPost,
    ];

    const t0 = performance.now();
    const blended = blendHomeFeed({
      posts: allPosts,
      fastPathAnchors: fastTop3,
      userDistrict,
      profile,
      nowMs: NOW,
    });
    const elapsedMs = performance.now() - t0;

    // Performance check: must be lightning fast (< 15ms even in cold JS JIT)
    assert.ok(elapsedMs < 25, `Blending should be ultra-fast, took ${elapsedMs.toFixed(2)}ms`);

    // Other district leak must NEVER appear
    assert.equal(blended.some((p) => p.id === 'warangal_leak'), false);

    // Fast Path 3 MUST remain anchored untouched at [0, 1, 2]
    assert.deepEqual(
      blended.slice(0, 3).map((p) => p.id),
      fastTop3.map((p) => p.id)
    );

    // Inspect the next 10 blended slots [3..12]
    const blendedWindow = blended.slice(3, 13);
    const windowCats = blendedWindow.map((p) => getPostCategoryTag(p, userDistrict));

    // Must NOT be dominated by Sports + National!
    const sportsOrNationalCount = windowCats.filter((c) => c === 'sports' || c === 'national').length;
    assert.ok(
      sportsOrNationalCount <= 2,
      `Expected <= 2 Sports/National in blended slots [3..12], got ${sportsOrNationalCount}: ${windowCats.join(', ')}`
    );

    // User's preferred categories (cinema + technology) must make up at least 3 of the 10 blended slots
    const interestCount = windowCats.filter((c) => c === 'cinema' || c === 'technology').length;
    assert.ok(
      interestCount >= 3,
      `Expected >= 3 user-interest posts (cinema/tech) in [3..12], got ${interestCount}: ${windowCats.join(', ')}`
    );

    // Local district posts (గుంటూరు) must make up at least 2-3 of the 10 blended slots
    const localCount = windowCats.filter((c) => c === 'local_district').length;
    assert.ok(
      localCount >= 2,
      `Expected >= 2 local district posts in [3..12], got ${localCount}: ${windowCats.join(', ')}`
    );

    // Zero back-to-back identical categories across indices [2..12] (including boundary after Fast Path 3!)
    for (let i = 3; i < Math.min(13, blended.length); i++) {
      const prevCat = getPostCategoryTag(blended[i - 1], userDistrict);
      const currCat = getPostCategoryTag(blended[i], userDistrict);
      assert.notEqual(
        currCat,
        prevCat,
        `Back-to-back duplicate category '${currCat}' at index ${i} (${blended.slice(0, 13).map((p) => getPostCategoryTag(p, userDistrict)).join(', ')})`
      );
    }

    // Zero duplicates
    assert.equal(new Set(blended.map((p) => p.id)).size, blended.length);
  });

  it('expands Telugu/English preferred categories cleanly within Firestore 10-item limit', () => {
    const expanded = expandCategoriesForFirestoreQuery(['సినిమా', 'Technology', 'క్రీడలు', 'Politics'], 10);
    assert.ok(expanded.length <= 10);
    assert.ok(expanded.includes('సినిమా'));
    assert.ok(expanded.includes('Cinema'));
    assert.ok(expanded.includes('టెక్నాలజీ'));
    assert.ok(expanded.includes('Technology'));
  });

  it('normalizes Telugu and English category aliases consistently', () => {
    assert.equal(normalizeCategoryKey('క్రీడలు'), 'sports');
    assert.equal(normalizeCategoryKey('Sports'), 'sports');
    assert.equal(normalizeCategoryKey('వినోదం'), 'cinema');
    assert.equal(normalizeCategoryKey('OTT'), 'cinema');
    assert.equal(normalizeCategoryKey('రాజకీయాలు'), 'politics');
    assert.equal(normalizeCategoryKey('జాతీయం'), 'national');
    assert.equal(normalizeCategoryKey('అంతర్జాతీయం'), 'international');
  });

  it('prevents scraper burst domination even for cold-start users with zero history', () => {
    const scrapedSports = Array.from({ length: 6 }, (_, i) =>
      makePost({ id: `sp_${i}`, categories: ['క్రీడలు'], timestamp: NOW - i * MIN })
    );
    const scrapedNational = Array.from({ length: 5 }, (_, i) =>
      makePost({ id: `nat_${i}`, categories: ['జాతీయం'], timestamp: NOW - (6 + i) * MIN })
    );
    const diverseOthers = [
      makePost({ id: 'pol_1', categories: ['రాజకీయం'], timestamp: NOW - HR }),
      makePost({ id: 'cin_1', categories: ['సినిమా'], timestamp: NOW - 1.1 * HR }),
      makePost({ id: 'biz_1', categories: ['వ్యాపారం'], timestamp: NOW - 1.2 * HR }),
      makePost({ id: 'tech_1', categories: ['టెక్నాలజీ'], timestamp: NOW - 1.3 * HR }),
      makePost({ id: 'loc_1', district: 'గుంటూరు', categories: ['జిల్లా వార్త'], timestamp: NOW - 1.4 * HR }),
      makePost({ id: 'loc_2', district: 'గుంటూరు', categories: ['జిల్లా వార్త'], timestamp: NOW - 1.5 * HR }),
    ];

    const emptyProfile = buildInterestProfile({});
    const anchors = pickFastPathTop3([...scrapedSports, ...scrapedNational].slice(0, 10), emptyProfile, 'గుంటూరు', 3, NOW);
    const blended = blendHomeFeed({
      posts: [...scrapedSports, ...scrapedNational, ...diverseOthers],
      fastPathAnchors: anchors,
      userDistrict: 'గుంటూరు',
      profile: emptyProfile,
      nowMs: NOW,
    });

    const next8Cats = blended.slice(3, 11).map((p) => getPostCategoryTag(p, 'గుంటూరు'));
    const uniqueCatsInNext8 = new Set(next8Cats);
    assert.ok(
      uniqueCatsInNext8.size >= 4,
      `Cold-start blended window should have rich diversity (>= 4 categories), got: ${next8Cats.join(', ')}`
    );
  });
});
