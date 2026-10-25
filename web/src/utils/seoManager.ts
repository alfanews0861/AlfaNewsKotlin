/**
 * SEO Manager for Alfa News Telugu
 * Manages Dynamic Meta Tags, Social OpenGraph, and Schema.org JSON-LD Structured Data
 */

export interface SeoProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  author?: string;
  category?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
  tags?: string[];
  people?: string[];
  locations?: string[];
  organizations?: string[];
}

export function updatePageSeo(props: SeoProps) {
  if (typeof document === 'undefined') return;

  const siteName = 'ఆల్ఫా న్యూస్ తెలుగు | Alfa News Telugu';
  const defaultDesc = 'ఆల్ఫా న్యూస్ తెలుగు - ఆంధ్రప్రదేశ్, తెలంగాణ మరియు సమగ్ర జిల్లా వార్తలు, బ్రేకింగ్ న్యూస్, ప్రత్యక్ష ప్రసారం, రాజకీయాలు, సినిమా మరియు తాజా సమాచారం.';
  const defaultImage = 'https://alfanews.app/app_icon.png';
  const defaultUrl = 'https://alfanews.app/';

  const finalTitle = props.title ? `${props.title} | ${siteName}` : siteName;
  const finalDesc = props.description || defaultDesc;
  const finalImage = props.image || defaultImage;
  const finalUrl = props.url || defaultUrl;
  const finalType = props.type || 'website';

  // 1. Title
  document.title = finalTitle;

  // 2. Helper to set or create meta tags
  const setMeta = (nameOrProperty: string, content: string, isProperty = false) => {
    const attr = isProperty ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, nameOrProperty);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  // Build comprehensive keywords combining tags, people, locations, and organizations
  const keywordSet = new Set<string>();
  if (props.category) keywordSet.add(props.category);
  if (props.tags) props.tags.forEach((t) => keywordSet.add(t.replace(/^#/, '')));
  if (props.people) props.people.forEach((p) => keywordSet.add(p));
  if (props.locations) props.locations.forEach((l) => keywordSet.add(l));
  if (props.organizations) props.organizations.forEach((o) => keywordSet.add(o));
  keywordSet.add('ఆల్ఫా న్యూస్');
  keywordSet.add('Alfa News');
  keywordSet.add('తెలుగు వార్తలు');
  keywordSet.add('Telugu News');
  if (props.keywords) {
    props.keywords.split(',').forEach((k) => keywordSet.add(k.trim()));
  }
  const finalKeywords = Array.from(keywordSet).filter(Boolean).join(', ');

  // Standard Meta Tags
  setMeta('description', finalDesc);
  if (finalKeywords) {
    setMeta('keywords', finalKeywords);
    if (props.type === 'article') {
      setMeta('news_keywords', finalKeywords);
    }
  }

  // Open Graph (Facebook, WhatsApp, LinkedIn)
  setMeta('og:site_name', 'Alfa News Telugu', true);
  setMeta('og:title', props.title || siteName, true);
  setMeta('og:description', finalDesc, true);
  setMeta('og:image', finalImage, true);
  setMeta('og:url', finalUrl, true);
  setMeta('og:type', finalType, true);
  setMeta('og:locale', 'te_IN', true);

  // Twitter Card
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', props.title || siteName);
  setMeta('twitter:description', finalDesc);
  setMeta('twitter:image', finalImage);

  // Canonical Link
  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', finalUrl);

  // 3. Schema.org JSON-LD structured data
  let schemaScript = document.getElementById('alfa-seo-schema') as HTMLScriptElement | null;
  if (!schemaScript) {
    schemaScript = document.createElement('script');
    schemaScript.id = 'alfa-seo-schema';
    schemaScript.type = 'application/ld+json';
    document.head.appendChild(schemaScript);
  }

  if (props.type === 'article') {
    const articleSchema: any = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': finalUrl,
      },
      headline: props.title || 'Alfa News Telugu',
      image: [finalImage],
      datePublished: props.publishedTime || new Date().toISOString(),
      dateModified: props.publishedTime || new Date().toISOString(),
      author: {
        '@type': 'Person',
        name: props.author || 'ఆల్ఫా న్యూస్ డెస్క్',
      },
      publisher: {
        '@type': 'NewsMediaOrganization',
        name: 'Alfa News Telugu',
        url: 'https://alfanews.app',
        logo: {
          '@type': 'ImageObject',
          url: 'https://alfanews.app/app_icon.png',
        },
      },
      description: finalDesc,
      articleSection: props.category || 'వార్తలు',
      keywords: finalKeywords,
      inLanguage: 'te-IN',
    };

    // Google Knowledge Graph & Discovery Entity Enrichment
    const aboutEntities: any[] = [];
    if (props.people && props.people.length > 0) {
      props.people.forEach((p) => {
        aboutEntities.push({
          '@type': 'Person',
          name: p,
        });
      });
    }
    if (props.locations && props.locations.length > 0) {
      props.locations.forEach((l) => {
        aboutEntities.push({
          '@type': 'Place',
          name: l,
        });
      });
    }
    if (props.organizations && props.organizations.length > 0) {
      props.organizations.forEach((o) => {
        aboutEntities.push({
          '@type': 'Organization',
          name: o,
        });
      });
    }

    if (aboutEntities.length > 0) {
      articleSchema.about = aboutEntities;
      articleSchema.mentions = aboutEntities;
    }

    if (props.locations && props.locations.length > 0) {
      articleSchema.contentLocation = {
        '@type': 'Place',
        name: props.locations[0],
      };
    }

    schemaScript.textContent = JSON.stringify(articleSchema);
  } else {
    const schemas: any[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'NewsMediaOrganization',
        name: 'Alfa News Telugu',
        url: 'https://alfanews.app',
        logo: 'https://alfanews.app/app_icon.png',
        sameAs: [
          'https://play.google.com/store/apps/details?id=com.alfanews.telugu',
        ],
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://alfanews.app/?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    ];

    if (props.breadcrumbs && props.breadcrumbs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: props.breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      });
    }

    schemaScript.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : schemas);
  }
}

export function updateHomeSeo() {
  updatePageSeo({
    title: 'తాజా తెలుగు వార్తలు, బ్రేకింగ్ న్యూస్, జిల్లా వార్తలు',
    description: 'ఆల్ఫా న్యూస్ తెలుగు - ఆంధ్రప్రదేశ్, తెలంగాణ సమగ్ర జిల్లా వార్తలు, బ్రేకింగ్ న్యూస్, ప్రత్యక్ష ప్రసారం, రాజకీయాలు, సినిమా, వినోదం మరియు ప్రత్యేక కథనాలు.',
    url: 'https://alfanews.app/',
    type: 'website',
  });
}

export function updateCategorySeo(categoryName: string, path: string) {
  const catTitle = `${categoryName} తాజా వార్తలు`;
  const url = `https://alfanews.app${path}`;
  updatePageSeo({
    title: catTitle,
    description: `${categoryName} కు సంబంధించిన సమగ్ర తాజా వార్తలు, బ్రేకింగ్ అప్‌డేట్స్ మరియు విశ్లేషణలు - ఆల్ఫా న్యూస్ తెలుగు.`,
    url: url,
    type: 'website',
    breadcrumbs: [
      { name: 'హోమ్', url: 'https://alfanews.app/' },
      { name: categoryName, url: url },
    ],
  });
}

export function updateDistrictSeo(districtName: string, path: string) {
  const distTitle = `${districtName} జిల్లా తాజా వార్తలు`;
  const url = `https://alfanews.app${path}`;
  updatePageSeo({
    title: distTitle,
    description: `${districtName} జిల్లా సమగ్ర తాజా వార్తలు, మండల సమాచారం, తాజా సంఘటనలు మరియు ప్రత్యేక కథనాలు - ఆల్ఫా న్యూస్ తెలుగు.`,
    url: url,
    type: 'website',
    breadcrumbs: [
      { name: 'హోమ్', url: 'https://alfanews.app/' },
      { name: 'జిల్లా వార్తలు', url: 'https://alfanews.app/category/districts' },
      { name: districtName, url: url },
    ],
  });
}
