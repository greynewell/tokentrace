import { SitemapEntry } from '../types';

export const MAX_URLS_PER_SITEMAP = 50000;

/**
 * Generate a sitemap.xml string from an array of entries.
 */
export function generateSitemap(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      entry => {
        const changefreqTag = entry.changefreq ? `\n    <changefreq>${entry.changefreq}</changefreq>` : '';
        return `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <priority>${entry.priority}</priority>${changefreqTag}
  </url>`;
      }
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

/**
 * Generate a sitemap index XML that references multiple sitemap files.
 */
export function generateSitemapIndex(sitemaps: { loc: string; lastmod: string }[]): string {
  const entries = sitemaps
    .map(
      s => `  <sitemap>
    <loc>${s.loc}</loc>
    <lastmod>${s.lastmod}</lastmod>
  </sitemap>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

/**
 * Generate sitemap files, splitting into multiple files if entries exceed the limit.
 * Returns an array of { filename, content } objects to write.
 * When split, sitemap.xml becomes the index and sitemap-1.xml, sitemap-2.xml, etc. hold the URLs.
 */
export function generateSitemapFiles(
  entries: SitemapEntry[],
  baseUrl: string
): { filename: string; content: string }[] {
  if (entries.length <= MAX_URLS_PER_SITEMAP) {
    return [{ filename: 'sitemap.xml', content: generateSitemap(entries) }];
  }

  const files: { filename: string; content: string }[] = [];
  const chunks: SitemapEntry[][] = [];

  for (let i = 0; i < entries.length; i += MAX_URLS_PER_SITEMAP) {
    chunks.push(entries.slice(i, i + MAX_URLS_PER_SITEMAP));
  }

  const lastmod = entries[0]?.lastmod || new Date().toISOString().split('T')[0];
  const sitemapRefs: { loc: string; lastmod: string }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const filename = `sitemap-${i + 1}.xml`;
    files.push({ filename, content: generateSitemap(chunks[i]) });
    sitemapRefs.push({ loc: `${baseUrl}/${filename}`, lastmod });
  }

  files.unshift({ filename: 'sitemap.xml', content: generateSitemapIndex(sitemapRefs) });

  return files;
}
