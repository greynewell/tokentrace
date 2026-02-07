import { buildProviders } from '../../src/affiliates/registry';

describe('buildProviders', () => {
  it('should always include Walmart even when no env vars are set', () => {
    const providers = buildProviders({});
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe('Walmart');
  });

  it('should include Amazon and Walmart when AMAZON_AFFILIATE_TAG is set', () => {
    const providers = buildProviders({ AMAZON_AFFILIATE_TAG: 'test-20' });
    expect(providers).toHaveLength(2);
    const names = providers.map(p => p.name);
    expect(names).toContain('Amazon');
    expect(names).toContain('Walmart');
  });

  it('should include both providers when all env vars are set', () => {
    const providers = buildProviders({
      AMAZON_AFFILIATE_TAG: 'test-20',
      WALMART_AFFILIATE_ID: 'impact-123',
    });
    expect(providers).toHaveLength(2);
    const names = providers.map(p => p.name);
    expect(names).toContain('Amazon');
    expect(names).toContain('Walmart');
  });

  it('should pass affiliate ID to Walmart when set', () => {
    const providers = buildProviders({ WALMART_AFFILIATE_ID: 'test-affiliate' });
    const walmart = providers.find(p => p.name === 'Walmart');
    expect(walmart).toBeDefined();
    const link = walmart!.generateLink('test product');
    expect(link).toContain('affiliateId=test-affiliate');
  });

  it('should generate Walmart links without affiliate ID when not set', () => {
    const providers = buildProviders({});
    const walmart = providers.find(p => p.name === 'Walmart');
    expect(walmart).toBeDefined();
    const link = walmart!.generateLink('test product');
    expect(link).not.toContain('affiliateId');
    expect(link).toContain('walmart.com/search');
  });
});
