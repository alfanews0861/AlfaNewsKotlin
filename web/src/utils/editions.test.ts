import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_STATE_CODES,
  EDITIONS,
  validateLanguageForState,
  getCollectionForEdition,
  resolveStateCode,
  getMandalsForDistrict,
  getConstituencyForSubDistrict,
  getSiblingMandalsInConstituency,
  getHeadlineFontClass,
  getBodyFontClass,
  getLocalizedText,
} from '../data/editions.ts';
import { isPostAllowedForHomeFeed } from './newsFeedBlender.ts';

test('Edition Registry covers all 9 states and 236 districts', () => {
  assert.equal(ALL_STATE_CODES.length, 9);
  const totalDistricts = ALL_STATE_CODES.reduce(
    (sum, code) => sum + EDITIONS[code].districts.length,
    0
  );
  assert.equal(totalDistricts, 236);
});

test('Strict state-bound language validation blocks cross-state translation', () => {
  // Gujarat must NEVER allow Telugu — falls back to Gujarati
  assert.equal(validateLanguageForState('GJ', 'te'), 'gu');
  assert.equal(validateLanguageForState('GJ', 'gu'), 'gu');
  assert.equal(validateLanguageForState('GJ', 'en'), 'en');

  // Punjab allows Punjabi, Hindi, English only
  assert.equal(validateLanguageForState('PB', 'pa'), 'pa');
  assert.equal(validateLanguageForState('PB', 'hi'), 'hi');
  assert.equal(validateLanguageForState('PB', 'en'), 'en');
  assert.equal(validateLanguageForState('PB', 'te'), 'pa');

  // AP & TS allow Telugu and English only
  assert.equal(validateLanguageForState('AP', 'te'), 'te');
  assert.equal(validateLanguageForState('TS', 'en'), 'en');
  assert.equal(validateLanguageForState('TS', 'gu'), 'te');

  // UP, UK, HP allow Hindi and English only
  assert.equal(validateLanguageForState('UP', 'hi'), 'hi');
  assert.equal(validateLanguageForState('UK', 'te'), 'hi');
  assert.equal(validateLanguageForState('HP', 'en'), 'en');

  // Goa & Manipur allow English and Hindi only
  assert.equal(validateLanguageForState('GA', 'en'), 'en');
  assert.equal(validateLanguageForState('MN', 'hi'), 'hi');
  assert.equal(validateLanguageForState('GA', 'te'), 'en');
});

test('Firestore collection partitioning keeps AP & TS strictly on legacy news collection', () => {
  assert.equal(getCollectionForEdition('AP', 'te'), 'news');
  assert.equal(getCollectionForEdition('AP', 'en'), 'news');
  assert.equal(getCollectionForEdition('TS', 'te'), 'news');
  assert.equal(getCollectionForEdition('TS', 'en'), 'news');

  assert.equal(getCollectionForEdition('UP', 'hi'), 'news_hi');
  assert.equal(getCollectionForEdition('UP', 'en'), 'news_en');
  assert.equal(getCollectionForEdition('UK', 'hi'), 'news_hi');
  assert.equal(getCollectionForEdition('HP', 'hi'), 'news_hi');
  assert.equal(getCollectionForEdition('PB', 'pa'), 'news_pa');
  assert.equal(getCollectionForEdition('PB', 'hi'), 'news_hi');
  assert.equal(getCollectionForEdition('GJ', 'gu'), 'news_gu');
  assert.equal(getCollectionForEdition('GA', 'en'), 'news_en');
  assert.equal(getCollectionForEdition('MN', 'en'), 'news_en');
});

test('Phase 1: Strict AP vs TS Home Feed Isolation (even when isGlobal=true)', () => {
  const apStatePost: any = {
    id: 'ap-1',
    state: 'Andhra Pradesh',
    stateCode: 'AP',
    district: 'State',
    isGlobal: true,
    category: 'రాజకీయం',
    categories: ['రాజకీయం', 'Andhra Pradesh'],
    headline: { telugu: 'ఆంధ్రప్రదేశ్ ప్రభుత్వం కీలక నిర్ణయం' },
    content: { telugu: 'అమరావతిలో సమీక్షా సమావేశం జరిగింది.' },
  };

  const tsStatePost: any = {
    id: 'ts-1',
    state: 'Telangana',
    stateCode: 'TS',
    district: 'State',
    isGlobal: true,
    category: 'రాజకీయం',
    categories: ['రాజకీయం', 'Telangana'],
    headline: { telugu: 'తెలంగాణ అసెంబ్లీ బడ్జెట్ సమావేశాలు' },
    content: { telugu: 'హైదరాబాద్‌లో సీఎం రేవంత్ రెడ్డి సమీక్ష.' },
  };

  const nationalUniversalPost: any = {
    id: 'nat-1',
    state: '',
    district: 'National',
    isGlobal: true,
    category: 'జాతీయం',
    categories: ['జాతీయం', 'క్రీడలు'],
    headline: { telugu: 'భారత జట్టు ఘన విజయం' },
    content: { telugu: 'అంతర్జాతీయ క్రికెట్ టోర్నీలో భారత్ విజయం సాధించింది.' },
  };

  // TS user (Hyderabad): sees TS + National, NEVER AP (even though isGlobal=true)
  assert.equal(isPostAllowedForHomeFeed(tsStatePost, 'హైదరాబాద్', 'TS'), true);
  assert.equal(isPostAllowedForHomeFeed(nationalUniversalPost, 'హైదరాబాద్', 'TS'), true);
  assert.equal(isPostAllowedForHomeFeed(apStatePost, 'హైదరాబాద్', 'TS'), false);

  // AP user (Visakhapatnam): sees AP + National, NEVER TS (even though isGlobal=true)
  assert.equal(isPostAllowedForHomeFeed(apStatePost, 'విశాఖపట్నం', 'AP'), true);
  assert.equal(isPostAllowedForHomeFeed(nationalUniversalPost, 'విశాఖపట్నం', 'AP'), true);
  assert.equal(isPostAllowedForHomeFeed(tsStatePost, 'విశాఖపట్నం', 'AP'), false);
});

test('Phase 2: 3-tier Sub-District -> Constituency -> District hierarchy works for expansion states', () => {
  assert.equal(resolveStateCode('Lucknow'), 'UP');
  assert.equal(resolveStateCode('Amritsar'), 'PB');
  assert.equal(resolveStateCode('Ahmedabad'), 'GJ');
  assert.equal(resolveStateCode('North Goa'), 'GA');

  const lucknowTehsils = getMandalsForDistrict('Lucknow');
  assert.ok(lucknowTehsils.length >= 4);

  const constituency = getConstituencyForSubDistrict('North Goa', 'Tiswadi');
  assert.ok(constituency && constituency.length > 0);

  const siblings = getSiblingMandalsInConstituency('North Goa', 'Tiswadi');
  assert.ok(siblings.some((s) => s.includes('Tiswadi')));
});

test('Multi-script rounded font helpers & localized text fallback', () => {
  assert.equal(getHeadlineFontClass('te'), 'font-ramabhadra');
  assert.equal(getBodyFontClass('te'), 'font-mallanna');
  assert.equal(getHeadlineFontClass('hi'), 'font-headline-hi');
  assert.equal(getBodyFontClass('hi'), 'font-body-hi');
  assert.equal(getHeadlineFontClass('pa'), 'font-headline-pa');
  assert.equal(getBodyFontClass('pa'), 'font-body-pa');
  assert.equal(getHeadlineFontClass('gu'), 'font-headline-gu');
  assert.equal(getBodyFontClass('gu'), 'font-body-gu');

  const multi = { local: 'लखनऊ ब्रेकिंग', hi: 'लखनऊ ब्रेकिंग', english: 'Lucknow Breaking' };
  assert.equal(getLocalizedText(multi, 'hi'), 'लखनऊ ब्रेकिंग');
  assert.equal(getLocalizedText(multi, 'en'), 'Lucknow Breaking');
});
