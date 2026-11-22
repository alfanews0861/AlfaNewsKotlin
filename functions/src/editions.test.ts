import {
  ALL_STATE_CODES,
  EDITIONS,
  validateLanguageForState,
  getCollectionForEdition,
  resolveStateCode,
  resolveExpansionDistrict,
  getEditionTopic,
  getLocalizedField,
} from './editions';
import { areMandalsMatching, extractDistrictAndMandal } from './location_data';

describe('Backend 9-State Multi-Edition Registry & Location Hierarchy', () => {
  test('registers all 9 states with 236 total districts', () => {
    expect(ALL_STATE_CODES).toHaveLength(9);
    const totalDistricts = ALL_STATE_CODES.reduce(
      (sum, code) => sum + EDITIONS[code].districts.length,
      0
    );
    expect(totalDistricts).toBe(236);
  });

  test('enforces strict state-bound languages with zero cross-state translation', () => {
    expect(validateLanguageForState('GJ', 'te')).toBe('gu');
    expect(validateLanguageForState('GJ', 'gu')).toBe('gu');
    expect(validateLanguageForState('GJ', 'en')).toBe('en');

    expect(validateLanguageForState('PB', 'pa')).toBe('pa');
    expect(validateLanguageForState('PB', 'hi')).toBe('hi');
    expect(validateLanguageForState('PB', 'en')).toBe('en');
    expect(validateLanguageForState('PB', 'te')).toBe('pa');

    expect(validateLanguageForState('AP', 'te')).toBe('te');
    expect(validateLanguageForState('TS', 'en')).toBe('en');
    expect(validateLanguageForState('TS', 'hi')).toBe('te');

    expect(validateLanguageForState('UP', 'hi')).toBe('hi');
    expect(validateLanguageForState('UK', 'te')).toBe('hi');
    expect(validateLanguageForState('HP', 'en')).toBe('en');
    expect(validateLanguageForState('GA', 'en')).toBe('en');
    expect(validateLanguageForState('MN', 'hi')).toBe('hi');
  });

  test('routes AP & TS strictly to legacy news collection and expansion states to language collections', () => {
    expect(getCollectionForEdition('AP', 'te')).toBe('news');
    expect(getCollectionForEdition('AP', 'en')).toBe('news');
    expect(getCollectionForEdition('TS', 'te')).toBe('news');
    expect(getCollectionForEdition('TS', 'en')).toBe('news');

    expect(getCollectionForEdition('UP', 'hi')).toBe('news_hi');
    expect(getCollectionForEdition('UP', 'en')).toBe('news_en');
    expect(getCollectionForEdition('PB', 'pa')).toBe('news_pa');
    expect(getCollectionForEdition('GJ', 'gu')).toBe('news_gu');
    expect(getCollectionForEdition('GA', 'en')).toBe('news_en');
    expect(getCollectionForEdition('MN', 'en')).toBe('news_en');
  });

  test('resolves state codes, expansion district aliases, FCM topics, and localized fields', () => {
    expect(resolveStateCode('Andhra Pradesh')).toBe('AP');
    expect(resolveStateCode('తెలంగాణ')).toBe('TS');
    expect(resolveStateCode('उत्तर प्रदेश')).toBe('UP');
    expect(resolveStateCode('ગુજરાત')).toBe('GJ');
    expect(resolveStateCode(null, 'Noida')).toBe('UP');
    expect(resolveStateCode(null, 'Mohali')).toBe('PB');

    expect(resolveExpansionDistrict('नोएडा')).toEqual({ district: 'Gautam Buddha Nagar', stateCode: 'UP' });
    expect(resolveExpansionDistrict('અમદાવાદ')).toEqual({ district: 'Ahmedabad', stateCode: 'GJ' });

    expect(getEditionTopic('UP', 'hi')).toBe('edition_hi_up');
    expect(getEditionTopic('PB', 'pa')).toBe('edition_pa_pb');
    expect(getEditionTopic('GJ', 'te')).toBe('edition_gu_gj');

    expect(getLocalizedField({ hi: 'ताज़ा खबर', english: 'Breaking News' }, 'hi')).toBe('ताज़ा खबर');
    expect(getLocalizedField({ pa: 'ਤਾਜ਼ਾ ਖ਼ਬਰ', english: 'Breaking News' }, 'pa')).toBe('ਤਾਜ਼ਾ ਖ਼ਬਰ');
    expect(getLocalizedField({ gu: 'તાજા સમાચાર', english: 'Breaking News' }, 'gu')).toBe('તાજા સમાચાર');
  });

  test('supports 3-tier Tehsil/Taluka/Sub-Division matching across expansion states for cross-mandal reporter attribution', () => {
    expect(areMandalsMatching('Tiswadi', 'Panaji')).toBe(true);
    expect(areMandalsMatching('Mohali', 'SAS Nagar')).toBe(true);
    expect(areMandalsMatching('Sanand', 'સાણંદ')).toBe(true);
    expect(areMandalsMatching('Tiswadi', 'Bardez')).toBe(false);

    const goaExtracted = extractDistrictAndMandal('Panaji smart city road work begins in Tiswadi taluka', '');
    expect(goaExtracted.district).toBe('North Goa');
    expect(goaExtracted.mandal).toBe('Tiswadi');

    const gjExtracted = extractDistrictAndMandal('સુરતના બારડોલી તાલુકામાં ભારે વરસાદ', '');
    expect(gjExtracted.district).toBe('Surat');
    expect(gjExtracted.mandal).toBe('Bardoli');
  });

  test('generates unique edition FCM topics and bounded collection mappings for all 7 expansion states', () => {
    const expectedTopics: Record<string, string> = {
      UP: 'edition_hi_up',
      PB: 'edition_pa_pb',
      UK: 'edition_hi_uk',
      GA: 'edition_en_ga',
      MN: 'edition_en_mn',
      HP: 'edition_hi_hp',
      GJ: 'edition_gu_gj',
    };
    const seenTopics = new Set<string>();
    for (const [state, topic] of Object.entries(expectedTopics)) {
      const code = state as keyof typeof EDITIONS;
      const computed = getEditionTopic(code, EDITIONS[code].primaryLanguage);
      expect(computed).toBe(topic);
      seenTopics.add(computed);
    }
    expect(seenTopics.size).toBe(7);

    // Localized field fallback when native key is stored in `local`
    expect(getLocalizedField({ local: 'लखनऊ में मेट्रो विस्तार', english: '' }, 'hi')).toBe('लखनऊ में मेट्रो विस्तार');
    expect(getLocalizedField({ local: 'ਅੰਮ੍ਰਿਤਸਰ ਵਿੱਚ ਨਵਾਂ ਪ੍ਰੋਜੈਕਟ' }, 'pa')).toBe('ਅੰਮ੍ਰਿਤਸਰ ਵਿੱਚ ਨਵਾਂ ਪ੍ਰੋਜੈਕਟ');
    expect(getLocalizedField({ local: 'સુરતમાં નવો બ્રિજ' }, 'gu')).toBe('સુરતમાં નવો બ્રિજ');
    expect(getLocalizedField({ english: 'Panaji waterfront upgrade begins' }, 'en')).toBe('Panaji waterfront upgrade begins');
  });
});
