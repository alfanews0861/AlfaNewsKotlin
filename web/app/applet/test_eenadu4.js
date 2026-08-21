async function test() {
  try {
    const response = await fetch('https://www.eenadu.net/telugu-news/districts/ap/nellore', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.google.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    console.log('Status:', response.status);
    const text = await response.text();
    
    // Extract hrefs using regex
    const hrefRegex = /href="([^"]+)"/g;
    let match;
    const links = new Set();
    while ((match = hrefRegex.exec(text)) !== null) {
        links.add(match[1]);
    }
    
    console.log('Total Links:', links.size);
    const arr = Array.from(links);
    console.log('Sample Links:', arr.slice(0, 20));
    
    // Filter by 'nellore'
    const nelloreLinks = arr.filter(l => l.toLowerCase().includes('nellore'));
    console.log('Nellore Links:', nelloreLinks.length);
    if (nelloreLinks.length > 0) {
        console.log('Sample Nellore Links:', nelloreLinks.slice(0, 5));
    }
    
    // Filter by 'article'
    const articleLinks = arr.filter(l => l.toLowerCase().includes('article'));
    console.log('Article Links:', articleLinks.length);
    if (articleLinks.length > 0) {
        console.log('Sample Article Links:', articleLinks.slice(0, 5));
    }
  } catch (e) {
    console.error(e);
  }
}
test();
