const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../assets/odds.js");
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test("pot odds", () => {
  close(O.requiredEquity(100, 50), 0.25);   // half pot: need 25%
  close(O.requiredEquity(100, 100), 1 / 3); // pot size: need 33.3%
  close(O.potOdds(100, 50), 3);             // 3 to 1
  close(O.callEV(0.25, 100, 50), 0);        // break even exactly at the required equity
  close(O.callEV(0.5, 100, 100), 50);
});

test("max callable bet is the inverse of the required equity", () => {
  for (const eq of [0.1, 0.2, 0.3333, 0.45]) {
    const b = O.maxCall(eq, 100);
    close(O.requiredEquity(100, b), eq, 1e-9);
  }
  assert.equal(O.maxCall(0.5, 100), Infinity);
});

test("implied odds close the gap to break even", () => {
  const eq = 0.2, pot = 100, bet = 100;
  const x = O.impliedNeeded(eq, pot, bet);
  close(eq * (pot + bet + x) - (1 - eq) * bet, 0);
  assert.equal(O.impliedNeeded(0.5, 100, 50), 0);
});

test("draw probabilities", () => {
  close(O.hitProbability(9, 47, 1), 9 / 47);                 // flush draw, turn card
  close(O.hitProbability(9, 47, 2), 1 - (38 * 37) / (47 * 46)); // by the river: 34.97%
  close(O.hitProbability(8, 46, 1), 8 / 46);                 // open-ended, river card
  close(O.ruleOf2and4(9, 2), 0.36);
});

test("bet sizing identities", () => {
  close(O.mdf(1), 0.5);                // pot-size bet: defend half
  close(O.mdf(0.5), 2 / 3);
  close(O.bluffBreakeven(0.5), 1 / 3); // half pot bluff needs a third of folds
  close(O.balancedBluffShare(1), 1 / 3); // pot bet: 2 value : 1 bluff
  // A pure bluff (no equity) breaks even when the fold rate equals bluffBreakeven.
  close(O.betEV(O.bluffBreakeven(0.75), 0, 100, 75), 0);
  // ...and foldNeeded agrees with it when checking would win nothing.
  close(O.foldNeeded(0, 0, 100, 75), O.bluffBreakeven(0.75));
});
