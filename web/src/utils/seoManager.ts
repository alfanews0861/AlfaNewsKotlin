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

  // Standard Meta Tags
  setMeta('description', finalDesc);
  if (props.keywords) setMeta('keywords', props.keywords);

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
    const articleSchema = {
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
      inLanguage: 'te-IN',
    };
    schemaScript.textContent = JSON.stringify(articleSchema);
  } else {
    const websiteSchema = {
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
    };
    schemaScript.textContent = JSON.stringify(websiteSchema);
  }
}
