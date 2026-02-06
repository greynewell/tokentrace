import * as fs from 'fs';
import * as path from 'path';
import { enrichCommand } from '../src/cli/enrich';
import { LlmClient, EnrichmentResult } from '../src/enrichment/types';

const TEST_RECIPES_DIR = path.resolve(__dirname, '../.test-enrich-recipes');
const CACHE_DIR = path.join(TEST_RECIPES_DIR, '.cache');

const mockEnrichment: EnrichmentResult = {
  ingredients: [{ ingredient: 'flour', searchTerm: 'all purpose flour', normalizedName: 'Flour' }],
  gear: [{ name: 'bowl', searchTerm: 'mixing bowl' }],
  cookingTips: ['Sift flour'],
  coachingPrompt: 'Step by step guide.',
};

// Mock returns batch format: { "slug": { ...enrichment } }
const mockClient: LlmClient = {
  complete: jest.fn().mockImplementation(() => {
    return Promise.resolve(JSON.stringify({
      'test-recipe': mockEnrichment,
      'other-recipe': mockEnrichment,
    }));
  }),
};

const sampleRecipe = `---
title: Test Recipe
description: A test recipe.
author: Claude Chef Community
prep_time: PT5M
cook_time: PT10M
servings: 1
calories: 200
keywords:
  - test
---

## Ingredients

- flour

## Instructions

1. Mix.
`;

describe('enrichCommand', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_RECIPES_DIR)) {
      fs.rmSync(TEST_RECIPES_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_RECIPES_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_RECIPES_DIR, 'test-recipe.md'), sampleRecipe);
    (mockClient.complete as jest.Mock).mockClear();
  });

  afterAll(() => {
    if (fs.existsSync(TEST_RECIPES_DIR)) {
      fs.rmSync(TEST_RECIPES_DIR, { recursive: true });
    }
  });

  it('should enrich all recipes and create cache files', async () => {
    await enrichCommand(TEST_RECIPES_DIR, mockClient);
    expect(mockClient.complete).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(CACHE_DIR, 'test-recipe.json'))).toBe(true);
  });

  it('should skip already cached recipes', async () => {
    await enrichCommand(TEST_RECIPES_DIR, mockClient);
    (mockClient.complete as jest.Mock).mockClear();
    await enrichCommand(TEST_RECIPES_DIR, mockClient);
    expect(mockClient.complete).not.toHaveBeenCalled();
  });

  it('should enrich only the specified recipe when slug is provided', async () => {
    // Add a second recipe
    fs.writeFileSync(
      path.join(TEST_RECIPES_DIR, 'other-recipe.md'),
      sampleRecipe.replace('Test Recipe', 'Other Recipe')
    );
    await enrichCommand(TEST_RECIPES_DIR, mockClient, { slug: 'test-recipe' });
    expect(mockClient.complete).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(CACHE_DIR, 'test-recipe.json'))).toBe(true);
    expect(fs.existsSync(path.join(CACHE_DIR, 'other-recipe.json'))).toBe(false);
  });
});
