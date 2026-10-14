import { NewsPost } from '../types';

export const AP_DISTRICTS: string[] = [
  'అల్లూరి సీతారామరాజు', 'అనకాపల్లి', 'అనంతపురం', 'అన్నమయ్య', 'బాపట్ల', 'చిత్తూరు', 'కోనసీమ',
  'తూర్పు గోదావరి', 'ఏలూరు', 'గుంటూరు', 'కాకినాడ', 'కృష్ణా', 'కర్నూలు', 'నంద్యాల', 'ఎన్టీఆర్',
  'పల్నాడు', 'పార్వతీపురం మన్యం', 'ప్రకాశం', 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు', 'శ్రీ సత్యసాయి',
  'శ్రీకాకుళం', 'తిరుపతి', 'విశాఖపట్నం', 'విజయనగరం', 'పశ్చిమ గోదావరి', 'వైఎస్ఆర్ కడప'
];

export const TS_DISTRICTS: string[] = [
  'ఆదిలాబాద్', 'భద్రాద్రి కొత్తగూడెం', 'హన్మకొండ', 'హైదరాబాద్', 'జగిత్యాల', 'జనగాం', 'జయశంకర్ భూపాలపల్లి',
  'జోగులాంబ గద్వాల', 'కామారెడ్డి', 'కరీంనగర్', 'ఖమ్మం', 'కుమ్రం భీమ్ ఆసిఫాబాద్', 'మహబూబాబాద్', 'మహబూబ్ నగర్',
  'మంచిర్యాల', 'మెదక్', 'మేడ్చల్ మల్కాజిగిరి', 'ములుగు', 'నాగర్ కర్నూల్', 'నల్గొండ', 'నారాయణపేట', 'నిర్మల్',
  'నిజామాబాద్', 'పెద్దపల్లి', 'రాజన్న సిరిసిల్ల', 'రంగారెడ్డి', 'సంగారెడ్డి', 'సిద్దిపేట', 'సూర్యాపేట',
  'వికారాబాద్', 'వనపర్తి', 'వరంగల్', 'యాదాద్రి భువనగిరి'
];

export const ALL_DISTRICTS: string[] = [...AP_DISTRICTS, ...TS_DISTRICTS];

export const DISTRICT_ALIASES: Record<string, string[]> = {
  'హైదరాబాద్': ['హైదరాబాద్', 'hyderabad', 'hyd', 'సికింద్రాబాద్', 'secunderabad', 'సైబరాబాద్', 'cyberabad'],
  'విశాఖపట్నం': ['విశాఖపట్నం', 'విశాఖ', 'వైజాగ్', 'visakhapatnam', 'vizag'],
  'ఎన్టీఆర్': ['ఎన్టీఆర్', 'విజయవాడ', 'vijayawada', 'ntr'],
  'గుంటూరు': ['గుంటూరు', 'guntur'],
  'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు': ['నెల్లూరు', 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు', 'nellore', 'spsr nellore'],
  'తిరుపతి': ['తిరుపతి', 'తిరుమల', 'tirupati', 'tirumala'],
  'కర్నూలు': ['కర్నూలు', 'kurnool'],
  'కడప': ['కడప', 'వైఎస్ఆర్ కడప', 'వైఎస్సార్ కడప', 'kadapa', 'ysr kadapa'],
  'వైఎస్ఆర్ కడప': ['కడప', 'వైఎస్ఆర్ కడప', 'వైఎస్సార్ కడప', 'kadapa', 'ysr kadapa'],
  'వరంగల్': ['వరంగల్', 'warangal'],
  'హన్మకొండ': ['హన్మకొండ', 'హనుమకొండ', 'hanamkonda', 'hanumakonda'],
  'ఖమ్మం': ['ఖమ్మం', 'khammam'],
  'కరీంనగర్': ['కరీంనగర్', 'karimnagar'],
  'నిజామాబాద్': ['నిజామాబాద్', 'nizamabad'],
  'నల్గొండ': ['నల్గొండ', 'నల్లగొండ', 'nalgonda'],
  'మంచిర్యాల': ['మంచిర్యాల', 'mancherial'],
  'సిద్దిపేట': ['సిద్దిపేట', 'siddipet'],
  'సూర్యాపేట': ['సూర్యాపేట', 'suryapet'],
  'మహబూబ్ నగర్': ['మహబూబ్ నగర్', 'మహబూబ్‌నగర్', 'mahbubnagar', 'mahboobnagar'],
  'రంగారెడ్డి': ['రంగారెడ్డి', 'rangareddy', 'ranga reddy'],
  'మేడ్చల్ మల్కాజిగిరి': ['మేడ్చల్', 'మల్కాజిగిరి', 'మేడ్చల్ మల్కాజిగిరి', 'medchal'],
  'సంగారెడ్డి': ['సంగారెడ్డి', 'sangareddy'],
  'విజయనగరం': ['విజయనగరం', 'vizianagaram'],
  'శ్రీకాకుళం': ['శ్రీకాకుళం', 'srikakulam'],
  'అనంతపురం': ['అనంతపురం', 'anantapur', 'ananthapur'],
  'అనకాపల్లి': ['అనకాపల్లి', 'anakapalli'],
  'కాకినాడ': ['కాకినాడ', 'kakinada'],
  'తూర్పు గోదావరి': ['తూర్పు గోదావరి', 'రాజమండ్రి', 'రాజమహేంద్రవరం', 'east godavari', 'rajahmundry'],
  'పశ్చిమ గోదావరి': ['పశ్చిమ గోదావరి', 'భీమవరం', 'west godavari', 'bhimavaram'],
  'కోనసీమ': ['కోనసీమ', 'అమలాపురం', 'konaseema', 'amalapuram'],
  'ఏలూరు': ['ఏలూరు', 'eluru'],
  'కృష్ణా': ['కృష్ణా', 'మచిలీపట్నం', 'krishna', 'machilipatnam'],
  'ప్రకాశం': ['ప్రకాశం', 'ఒంగోలు', 'prakasam', 'ongole'],
  'బాపట్ల': ['బాపట్ల', 'చీరాల', 'bapatla'],
  'పల్నాడు': ['పల్నాడు', 'నరసరావుపేట', 'palnadu'],
  'శ్రీ సత్యసాయి': ['శ్రీ సత్యసాయి', 'పుట్టపర్తి', 'sri sathya sai', 'puttaparthi'],
  'అన్నమయ్య': ['అన్నమయ్య', 'రాయచోటి', 'మదనపల్లె', 'annamayya', 'rayachoti'],
  'చిత్తూరు': ['చిత్తూరు', 'chittoor'],
  'నంద్యాల': ['నంద్యాల', 'nandyal'],
  'ఆదిలాబాద్': ['ఆదిలాబాద్', 'adilabad'],
  'భద్రాద్రి కొత్తగూడెం': ['భద్రాద్రి', 'కొత్తగూడెం', 'భద్రాచలం', 'bhadradri', 'kothagudem'],
  'జగిత్యాల': ['జగిత్యాల', 'jagtial'],
  'జనగాం': ['జనగాం', 'jangaon'],
  'జయశంకర్ భూపాలపల్లి': ['జయశంకర్', 'భూపాలపల్లి', 'bhupalpally'],
  'జోగులాంబ గద్వాల': ['జోగులాంబ', 'గద్వాల', 'gadwal'],
  'కామారెడ్డి': ['కామారెడ్డి', 'kamareddy'],
  'కుమ్రం భీమ్ ఆసిఫాబాద్': ['కుమ్రం భీమ్', 'ఆసిఫాబాద్', 'asifabad'],
  'మహబూబాబాద్': ['మహబూబాబాద్', 'mahabubabad'],
  'మెదక్': ['మెదక్', 'medak'],
  'ములుగు': ['ములుగు', 'mulugu'],
  'నాగర్ కర్నూల్': ['నాగర్ కర్నూల్', 'nagarkurnool'],
  'నారాయణపేట': ['నారాయణపేట', 'narayanpet'],
  'నిర్మల్': ['నిర్మల్', 'nirmal'],
  'పెద్దపల్లి': ['పెద్దపల్లి', 'రామగుండం', 'peddapalli'],
  'రాజన్న సిరిసిల్ల': ['రాజన్న సిరిసిల్ల', 'సిరిసిల్ల', 'sircilla'],
  'వికారాబాద్': ['వికారాబాద్', 'vikarabad'],
  'వనపర్తి': ['వనపర్తి', 'wanaparthy'],
  'యాదాద్రి భువనగిరి': ['యాదాద్రి', 'భువనగిరి', 'yadadri', 'bhuvanagiri'],
  'అల్లూరి సీతారామరాజు': ['అల్లూరి సీతారామరాజు', 'పాడేరు', 'అరకు', 'alluri', 'paderu', 'araku'],
  'పార్వతీపురం మన్యం': ['పార్వతీపురం మన్యం', 'పార్వతీపురం', 'మన్యం', 'parvathipuram'],
};

export function getDistrictAliases(district: string): string[] {
  const clean = district.trim().toLowerCase();
  const matchedKey = Object.keys(DISTRICT_ALIASES).find((k) =>
    k.toLowerCase() === clean || clean.includes(k.toLowerCase()) || k.toLowerCase().includes(clean)
  );
  if (matchedKey && DISTRICT_ALIASES[matchedKey]) {
    return DISTRICT_ALIASES[matchedKey];
  }
  return [clean];
}

export function isDistrictMatch(postText: string | undefined | null, targetDistrict: string): boolean {
  if (!postText || !targetDistrict) return false;
  const pLower = postText.toLowerCase().trim();
  const tLower = targetDistrict.toLowerCase().trim();

  if (pLower === tLower || pLower.includes(tLower) || tLower.includes(pLower)) {
    return true;
  }

  const aliases = getDistrictAliases(targetDistrict);
  return aliases.some((a) => pLower.includes(a.toLowerCase()));
}

export function isPostFromDistrict(post: NewsPost, targetDistrict: string): boolean {
  if (!post || !targetDistrict) return false;

  // 1. Check direct post.district
  if (isDistrictMatch(post.district, targetDistrict)) return true;

  // 2. Check categories array
  if (post.categories?.some((c) => isDistrictMatch(c, targetDistrict))) return true;

  // 3. Check post.category
  if (isDistrictMatch(post.category, targetDistrict)) return true;

  // 4. Check post.location
  if (isDistrictMatch(post.location, targetDistrict)) return true;

  // 5. Check post.reporter mandal/district
  const anyPost = post as any;
  if (isDistrictMatch(anyPost.reporterDistrict, targetDistrict)) return true;

  // 6. Substring in headline
  const headline = `${post.headline?.telugu || ''} ${post.headline?.english || ''}`;
  const aliases = getDistrictAliases(targetDistrict);
  return aliases.some((a) => headline.toLowerCase().includes(a.toLowerCase()));
}

export function isPostFromAp(post: NewsPost): boolean {
  if (post.state === 'AP' || post.state === 'Andhra Pradesh' || post.state === 'Andhra') return true;

  if (post.district && AP_DISTRICTS.some((d) => isDistrictMatch(post.district, d))) {
    return true;
  }

  if (post.categories?.some((c) => c.includes('AP') || c.includes('ఆంధ్ర') || c.toLowerCase().includes('andhra'))) {
    return true;
  }

  const text = `${post.category || ''} ${post.location || ''} ${post.headline?.telugu || ''}`.toLowerCase();
  return text.includes('ఆంధ్ర') || text.includes('అమరావతి') || text.includes('విజయవాడ') || text.includes('విశాఖ') || text.includes('వైసీపీ') || text.includes('టిడిపి') || text.includes('కూటమి');
}

export function isPostFromTs(post: NewsPost): boolean {
  if (post.state === 'TS' || post.state === 'TG' || post.state === 'Telangana' || post.state === 'తెలంగాణ') return true;

  if (post.district && TS_DISTRICTS.some((d) => isDistrictMatch(post.district, d))) {
    return true;
  }

  if (post.categories?.some((c) => c.includes('TS') || c.includes('తెలంగాణ') || c.toLowerCase().includes('telangana'))) {
    return true;
  }

  const text = `${post.category || ''} ${post.location || ''} ${post.headline?.telugu || ''}`.toLowerCase();
  return text.includes('తెలంగాణ') || text.includes('హైదరాబాద్') || text.includes('వరంగల్') || text.includes('రేవంత్') || text.includes('బిఆర్ఎస్');
}

/**
 * Filter posts by Selected Category or District with multi-keyword matching
 */
export function filterPostsByCategory(posts: NewsPost[], selectedKey: string): NewsPost[] {
  if (!selectedKey || selectedKey === 'all') return posts;

  const keyLower = selectedKey.toLowerCase().trim();

  // 1. Special Stories
  if (keyLower === 'స్పెషల్ స్టోరీస్' || keyLower === 'special-stories') {
    return posts.filter(
      (p) =>
        p.isSpecialStory === true ||
        p.webOnly === true ||
        p.category === 'స్పెషల్ స్టోరీస్' ||
        p.categories?.includes('స్పెషల్ స్టోరీస్')
    );
  }

  // 2. Andhra Pradesh State News
  if (keyLower === 'ఆంధ్రప్రదేశ్' || keyLower === 'ap' || keyLower === 'andhra') {
    return posts.filter((p) => isPostFromAp(p));
  }

  // 3. Telangana State News
  if (keyLower === 'తెలంగాణ' || keyLower === 'ts' || keyLower === 'telangana') {
    return posts.filter((p) => isPostFromTs(p));
  }

  // 4. Specific District
  const isDistrict = ALL_DISTRICTS.find((d) => isDistrictMatch(d, selectedKey));
  if (isDistrict) {
    return posts.filter((p) => isPostFromDistrict(p, isDistrict));
  }

  // 5. All District News (జిల్లా వార్తలు)
  if (keyLower === 'జిల్లా వార్తలు' || keyLower === 'districts_menu' || keyLower === 'district-news') {
    return posts.filter(
      (p) =>
        Boolean(p.district) ||
        Boolean(p.location) ||
        Boolean(p.mandal) ||
        isPostFromAp(p) ||
        isPostFromTs(p) ||
        (p.category && (p.category.includes('జిల్లా') || p.category.includes('local') || p.category.includes('స్థానిక')))
    );
  }

  // 5. Standard Category Multi-Keyword Matching
  const categoryKeywords: Record<string, string[]> = {
    'రాజకీయం': ['రాజకీయం', 'రాజకీయాలు', 'రాజకీయ', 'politics', 'political', 'రాకీయం', 'election', 'ఎన్నికలు', 'ప్రభుత్వం', 'మంత్రి', 'పాలన', 'కాంగ్రెస్', 'టిడిపి', 'వైసీపీ', 'బిజెపి', 'బిఆర్ఎస్'],
    'రాజకీయాలు': ['రాజకీయం', 'రాజకీయాలు', 'రాజకీయ', 'politics', 'political', 'రాకీయం', 'election', 'ఎన్నికలు', 'ప్రభుత్వం', 'మంత్రి', 'పాలన', 'కాంగ్రెస్', 'టిడిపి', 'వైసీపీ', 'బిజెపి', 'బిఆర్ఎస్'],
    'సినిమా': ['సినిమా', 'వినోదం', 'cinema', 'movie', 'entertainment', 'films', 'hero', 'trailer', 'ott', 'film', 'నటుడు', 'తారలు'],
    'వినోదం': ['సినిమా', 'వినోదం', 'cinema', 'movie', 'entertainment', 'films', 'hero', 'trailer', 'ott', 'film', 'నటుడు', 'తారలు'],
    'క్రీడలు': ['క్రీడలు', 'స్పోర్ట్స్', 'sports', 'cricket', 'ipl', 'football', 'మ్యాచ్', 'ట్రోఫీ'],
    'స్పోర్ట్స్': ['క్రీడలు', 'స్పోర్ట్స్', 'sports', 'cricket', 'ipl', 'football', 'మ్యాచ్', 'ట్రోఫీ'],
    'క్రైమ్': ['క్రైమ్', 'crime', 'accident', 'పోలీస్', 'police', 'కేసు', 'అరెస్ట్'],
    'వ్యాపారం': ['వ్యాపారం', 'బిజినెస్', 'business', 'economy', 'stock', 'బంగారం', 'gold', 'మార్కెట్', 'ధరలు'],
    'బిజినెస్': ['వ్యాపారం', 'బిజినెస్', 'business', 'economy', 'stock', 'బంగారం', 'gold', 'మార్కెట్', 'ధరలు'],
    'టెక్నాలజీ': ['టెక్నాలజీ', 'technology', 'tech', 'ai', 'గ్యాడ్జెట్', 'స్మార్ట్‌ఫోన్'],
    'విద్య/ఉద్యోగాలు': ['విద్య', 'ఉద్యోగాలు', 'education', 'jobs', 'నోటిఫికేషన్', 'పరీక్ష', 'exam'],
    'విద్య': ['విద్య', 'ఉద్యోగాలు', 'education', 'jobs', 'నోటిఫికేషన్', 'పరీక్ష', 'exam'],
    'భక్తి': ['భక్తి', 'spiritual', 'devotion', 'ఆలయం', 'గుడి', 'పూజ', 'దేవుడు', 'ఆధ్యాత్మికం'],
    'వ్యవసాయం': ['వ్యవసాయం', 'agriculture', 'రైతు', 'పంట', 'వరి', 'సేద్యం'],
    'ఆరోగ్యం': ['ఆరోగ్యం', 'health', 'వైద్యం', 'హాస్పిటల్', 'డాక్టర్', 'ఆస్పత్రి'],
    'జాతీయం': ['జాతీయం', 'national', 'భారత్', 'ఢిల్లీ', 'మోదీ', 'కేంద్రం'],
    'అంతర్జాతీయం': ['అంతర్జాతీయం', 'international', 'world', 'అమెరికా', 'గ్లోబల్', 'nri'],
    'జిల్లా వార్తలు': ['జిల్లా వార్త', 'జిల్లా', 'local', 'స్థానిక'],
    'జిల్లా వార్త': ['జిల్లా వార్త', 'జిల్లా', 'local', 'స్థానిక'],
  };

  const matchedKeywords = categoryKeywords[selectedKey] || [keyLower];

  return posts.filter((p) => {
    const pCat = (p.category || '').toLowerCase();
    const pCats = (p.categories || []).map((c) => c.toLowerCase());
    const hLine = `${p.headline?.telugu || ''} ${p.headline?.english || ''}`.toLowerCase();

    return matchedKeywords.some(
      (kw) =>
        pCat.includes(kw.toLowerCase()) ||
        pCats.some((c) => c.includes(kw.toLowerCase())) ||
        hLine.includes(kw.toLowerCase())
    );
  });
}
