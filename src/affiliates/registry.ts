import { AffiliateProvider } from './types';
import { AmazonProvider } from './amazon';
import { WalmartProvider } from './walmart';

export function buildProviders(env: Record<string, string | undefined>): AffiliateProvider[] {
  const providers: AffiliateProvider[] = [];

  if (env.AMAZON_AFFILIATE_TAG) {
    providers.push(new AmazonProvider(env.AMAZON_AFFILIATE_TAG));
  }

  // Always include Walmart - works with or without affiliate ID
  providers.push(new WalmartProvider(env.WALMART_AFFILIATE_ID));

  return providers;
}
