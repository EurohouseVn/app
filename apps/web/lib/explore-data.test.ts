import assert from 'node:assert/strict';
import test from 'node:test';
import { faqItems, knowledgeArticles } from './explore-data';
import { getIndexableRoutes } from './indexable-routes';

test('knowledge registry has eight useful, reviewed articles across both topic clusters', () => {
  assert.ok(knowledgeArticles.length >= 8);
  assert.ok(knowledgeArticles.some((item) => item.topicCluster === 'RESIDENTIAL'));
  assert.ok(knowledgeArticles.some((item) => item.topicCluster === 'INDUSTRIAL'));
  const indexable: Set<string> = new Set(getIndexableRoutes().map((route) => route.path));

  for (const article of knowledgeArticles) {
    assert.ok(article.summary.length >= 70, `${article.slug} needs an answer-first summary`);
    assert.ok(article.sections.length >= 2, `${article.slug} needs at least two sections`);
    assert.ok(!Number.isNaN(Date.parse(article.publishedAt)), `${article.slug} publishedAt must be valid`);
    assert.ok(!Number.isNaN(Date.parse(article.modifiedAt)), `${article.slug} modifiedAt must be valid`);
    assert.ok(article.reviewedBy.length > 0, `${article.slug} needs an editor or reviewer`);
    assert.ok(article.relatedRoutes.length >= 2, `${article.slug} needs at least two internal links`);
    for (const route of article.relatedRoutes) {
      assert.ok(indexable.has(route.href), `${article.slug} links to non-indexable route ${route.href}`);
    }
  }
});

test('FAQ questions are unique and every answer is visible copy', () => {
  const questions = faqItems.map((item) => item.question.trim().toLocaleLowerCase('vi'));
  assert.equal(new Set(questions).size, questions.length);
  assert.ok(faqItems.every((item) => item.answer.trim().length >= 30));
});
