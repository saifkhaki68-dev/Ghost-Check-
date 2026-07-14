import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeText, runAiCheckers } from './checkers.js';

test('analyzeText extracts basic article features', () => {
  const features = analyzeText(`
    It is important to note that this is a concise sentence. Moreover, this sentence follows a similar shape.

    Furthermore, the article continues in a consistent and informational cadence. In conclusion, readers should verify sources.
  `);

  assert.equal(typeof features.wordCount, 'number');
  assert.equal(typeof features.averageSentenceLength, 'number');
  assert.ok(features.aiTransitionRatio > 0);
});

test('runAiCheckers returns multiple detector results and source recommendations', async () => {
  const result = await runAiCheckers({
    title: 'Medical research article',
    url: 'https://example.com/article',
    text: Array.from(
      { length: 80 },
      () => 'It is important to note that medical research should be reviewed with credible health sources.',
    ).join(' '),
  });

  assert.equal(result.checkers.length, 3);
  assert.ok(result.aiProbability >= 0);
  assert.ok(result.recommendedSources.some((source) => source.url.includes('nih.gov')));
});
