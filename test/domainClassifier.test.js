import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyProofPilotDomain } from '../src/services/domainClassifier.js';

test('accepts supported startup questions', () => {
  assert.equal(classifyProofPilotDomain('How should I validate my startup idea?').supported, true);
});

test('rejects clearly unsupported questions', () => {
  assert.equal(classifyProofPilotDomain('What is the weather today?').supported, false);
});

test('keeps startup context when an adjacent domain is mentioned', () => {
  assert.equal(classifyProofPilotDomain('Help me pitch a sports analytics startup.').supported, true);
});

test('does not match keywords inside unrelated words', () => {
  assert.equal(classifyProofPilotDomain('Can you proofread this poem?').supported, false);
});
