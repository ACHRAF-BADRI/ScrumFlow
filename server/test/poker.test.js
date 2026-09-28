import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as poker from '../src/services/poker.js';

const nora = { _id: 'u1', name: 'Nora' };
const tom = { _id: 'u2', name: 'Tom' };

describe('planning poker', () => {
  test('votes stay hidden until revealed, then give an average and a suggestion', () => {
    poker.startRound('p1', 't1', nora);
    poker.vote('p1', nora, '3');
    poker.vote('p1', tom, '8');
    const hidden = poker.publicState('p1');
    assert.deepEqual(hidden.votes.map((v) => v.value), [null, null]);
    assert.equal(hidden.average, undefined);

    poker.reveal('p1');
    const shown = poker.publicState('p1');
    assert.deepEqual(shown.votes.map((v) => v.value), ['3', '8']);
    assert.deepEqual([shown.average, shown.suggestion, shown.consensus], [5.5, 5, false]);
    assert.equal(poker.vote('p1', nora, '5'), null, 'no voting after the reveal');
  });

  test('same card twice takes the vote back, unknown cards are ignored', () => {
    poker.startRound('p2', 't1', nora);
    poker.vote('p2', nora, '5');
    poker.vote('p2', nora, '5');
    assert.equal(poker.publicState('p2').votes.length, 0);
    assert.equal(poker.vote('p2', nora, '4'), null);
    assert.equal(poker.reveal('p2'), null, 'nothing to reveal without votes');
  });

  test('restart clears the votes, end removes the round', () => {
    poker.startRound('p3', 't9', nora);
    poker.vote('p3', nora, '13');
    poker.vote('p3', tom, '13');
    poker.reveal('p3');
    assert.equal(poker.publicState('p3').consensus, true);
    poker.restart('p3');
    assert.deepEqual([poker.publicState('p3').revealed, poker.publicState('p3').votes.length], [false, 0]);
    poker.endRound('p3');
    assert.equal(poker.publicState('p3'), null);
  });

  test('summary ignores "?" and coffee cards', () => {
    assert.deepEqual(poker.summary(['?', 'coffee']), { average: null, suggestion: null, consensus: false });
    assert.equal(poker.summary(['2', '?', '3']).suggestion, 3);
  });
});
