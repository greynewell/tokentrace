import * as fs from 'fs';
import * as path from 'path';
import { loadContributors, getAvatarUrl, ContributorProfile } from '../src/contributors';

describe('loadContributors', () => {
  const testDir = path.join(__dirname, '.test-contributors');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should return empty map when contributors.json does not exist', () => {
    const contributors = loadContributors(testDir);
    expect(contributors.size).toBe(0);
  });

  it('should load contributors from contributors.json', () => {
    const data = {
      profiles: {
        'test-user': {
          name: 'Test User',
          bio: 'A test user',
          github: 'testuser',
        },
      },
    };
    fs.writeFileSync(path.join(testDir, 'contributors.json'), JSON.stringify(data));

    const contributors = loadContributors(testDir);
    expect(contributors.size).toBe(1);
    expect(contributors.get('test-user')).toEqual({
      name: 'Test User',
      bio: 'A test user',
      github: 'testuser',
    });
  });

  it('should handle multiple contributors', () => {
    const data = {
      profiles: {
        'user-one': { name: 'User One', github: 'userone' },
        'user-two': { name: 'User Two', twitter: 'usertwo' },
      },
    };
    fs.writeFileSync(path.join(testDir, 'contributors.json'), JSON.stringify(data));

    const contributors = loadContributors(testDir);
    expect(contributors.size).toBe(2);
    expect(contributors.has('user-one')).toBe(true);
    expect(contributors.has('user-two')).toBe(true);
  });

  it('should handle malformed JSON gracefully', () => {
    fs.writeFileSync(path.join(testDir, 'contributors.json'), 'not valid json');
    const contributors = loadContributors(testDir);
    expect(contributors.size).toBe(0);
  });
});

describe('getAvatarUrl', () => {
  it('should return custom avatar when provided', () => {
    const profile: ContributorProfile = {
      name: 'Test',
      avatar: 'https://example.com/avatar.jpg',
      github: 'testuser',
    };
    expect(getAvatarUrl(profile)).toBe('https://example.com/avatar.jpg');
  });

  it('should return GitHub avatar URL when only github is provided', () => {
    const profile: ContributorProfile = {
      name: 'Test',
      github: 'testuser',
    };
    expect(getAvatarUrl(profile)).toBe('https://github.com/testuser.png?size=200');
  });

  it('should return null when no avatar or github is provided', () => {
    const profile: ContributorProfile = {
      name: 'Test',
    };
    expect(getAvatarUrl(profile)).toBeNull();
  });

  it('should prefer custom avatar over GitHub avatar', () => {
    const profile: ContributorProfile = {
      name: 'Test',
      avatar: 'https://custom.com/photo.png',
      github: 'testuser',
    };
    expect(getAvatarUrl(profile)).toBe('https://custom.com/photo.png');
  });
});
