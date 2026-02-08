import { generateSitemap, generateSitemapIndex, generateSitemapFiles, MAX_URLS_PER_SITEMAP } from '../src/generator/sitemap';
import { SitemapEntry } from '../src/types';

describe('Sitemap Generator', () => {
  const baseUrl = 'https://greynewell.github.io/claude-chef';

  const entries: SitemapEntry[] = [
    { loc: `${baseUrl}/high-protein-carbonara.html`, lastmod: '2024-01-15', priority: '0.8' },
    { loc: `${baseUrl}/engineers-ramen.html`, lastmod: '2024-01-10', priority: '0.8' },
  ];

  it('should generate valid XML with urlset root element', () => {
    const xml = generateSitemap(entries);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</urlset>');
  });

  it('should include all entries as <url> elements', () => {
    const xml = generateSitemap(entries);
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(2);
  });

  it('should include loc, lastmod, and priority for each entry', () => {
    const xml = generateSitemap(entries);
    expect(xml).toContain(`<loc>${baseUrl}/high-protein-carbonara.html</loc>`);
    expect(xml).toContain('<lastmod>2024-01-15</lastmod>');
    expect(xml).toContain('<priority>0.8</priority>');
  });

  it('should produce well-formed XML for empty entries', () => {
    const xml = generateSitemap([]);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(0);
  });
});

describe('Sitemap Index Generator', () => {
  it('should generate valid sitemapindex XML', () => {
    const xml = generateSitemapIndex([
      { loc: 'https://example.com/sitemap-1.xml', lastmod: '2024-01-15' },
      { loc: 'https://example.com/sitemap-2.xml', lastmod: '2024-01-15' },
    ]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('</sitemapindex>');
    expect(xml).toContain('<loc>https://example.com/sitemap-1.xml</loc>');
    expect(xml).toContain('<loc>https://example.com/sitemap-2.xml</loc>');
    const count = (xml.match(/<sitemap>/g) || []).length;
    expect(count).toBe(2);
  });
});

describe('generateSitemapFiles', () => {
  const baseUrl = 'https://greynewell.github.io/claude-chef';

  it('should return a single sitemap.xml when under the limit', () => {
    const entries: SitemapEntry[] = [
      { loc: `${baseUrl}/recipe-1.html`, lastmod: '2024-01-15', priority: '0.8' },
      { loc: `${baseUrl}/recipe-2.html`, lastmod: '2024-01-15', priority: '0.8' },
    ];
    const files = generateSitemapFiles(entries, baseUrl);
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe('sitemap.xml');
    expect(files[0].content).toContain('<urlset');
  });

  it('should split into multiple files with an index when over the limit', () => {
    const entries: SitemapEntry[] = [];
    const total = MAX_URLS_PER_SITEMAP + 100;
    for (let i = 0; i < total; i++) {
      entries.push({ loc: `${baseUrl}/recipe-${i}.html`, lastmod: '2024-01-15', priority: '0.8' });
    }

    const files = generateSitemapFiles(entries, baseUrl);

    // Should have index + 2 sitemap files
    expect(files).toHaveLength(3);

    // First file is the index
    expect(files[0].filename).toBe('sitemap.xml');
    expect(files[0].content).toContain('<sitemapindex');
    expect(files[0].content).toContain(`${baseUrl}/sitemap-1.xml`);
    expect(files[0].content).toContain(`${baseUrl}/sitemap-2.xml`);

    // Second file has MAX_URLS_PER_SITEMAP entries
    expect(files[1].filename).toBe('sitemap-1.xml');
    expect(files[1].content).toContain('<urlset');
    const count1 = (files[1].content.match(/<url>/g) || []).length;
    expect(count1).toBe(MAX_URLS_PER_SITEMAP);

    // Third file has the remaining 100 entries
    expect(files[2].filename).toBe('sitemap-2.xml');
    const count2 = (files[2].content.match(/<url>/g) || []).length;
    expect(count2).toBe(100);
  });

  it('should return a single file when exactly at the limit', () => {
    const entries: SitemapEntry[] = [];
    for (let i = 0; i < MAX_URLS_PER_SITEMAP; i++) {
      entries.push({ loc: `${baseUrl}/recipe-${i}.html`, lastmod: '2024-01-15', priority: '0.8' });
    }

    const files = generateSitemapFiles(entries, baseUrl);
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe('sitemap.xml');
    expect(files[0].content).toContain('<urlset');
  });
});
