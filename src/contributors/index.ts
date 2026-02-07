import * as fs from 'fs';
import * as path from 'path';
import { ContributorProfile, ContributorData } from './types';

/**
 * Load contributor profiles from contributors.json.
 * Returns an empty map if the file doesn't exist.
 */
export function loadContributors(rootDir: string): Map<string, ContributorProfile> {
  const filePath = path.join(rootDir, 'contributors.json');
  const profiles = new Map<string, ContributorProfile>();

  if (!fs.existsSync(filePath)) {
    return profiles;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data: ContributorData = JSON.parse(content);

    if (data.profiles) {
      for (const [slug, profile] of Object.entries(data.profiles)) {
        profiles.set(slug, profile);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not load contributors.json: ${error}`);
  }

  return profiles;
}

/**
 * Get avatar URL for a contributor.
 * Falls back to GitHub avatar if no custom avatar is set.
 */
export function getAvatarUrl(profile: ContributorProfile): string | null {
  if (profile.avatar) {
    return profile.avatar;
  }
  if (profile.github) {
    return `https://github.com/${profile.github}.png?size=200`;
  }
  return null;
}

export { ContributorProfile, ContributorData } from './types';
