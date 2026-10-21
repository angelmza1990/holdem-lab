// Pot odds and bet sizing arithmetic. Amounts are in any unit (chips or big blinds).
// pot = the pot before the bet being faced; bet = the amount to call.
(function (root) {
  "use strict";

  /** Equity needed to call profitably, ignoring future betting: bet / (pot + 2 bet). */
  const requiredEquity = (pot, bet) => bet / (pot + 2 * bet);

  /** Odds the pot lays, as "x to 1": (pot + bet) / bet. */
  const potOdds = (pot, bet) => (pot + bet) / bet;

  /** Expected value of calling: win the pot and the bet with probability eq, lose the call otherwise. */
  const callEV = (eq, pot, bet) => eq * (pot + bet) - (1 - eq) * bet;

  /** Largest bet that can be called with equity eq (Infinity at 50% or more). */
  const maxCall = (eq, pot) => (eq >= 0.5 ? Infinity : (eq * pot) / (1 - 2 * eq));

  /** Extra money you must expect to win later for a call to break even (0 if it already does). */
  const impliedNeeded = (eq, pot, bet) => (eq <= 0 ? Infinity : Math.max(0, ((1 - eq) * bet) / eq - (pot + bet)));

  function binom(n, k) {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  }
  /** Probability that at least one of `outs` cards arrives in `draws` cards from `unseen`. */
  const hitProbability = (outs, unseen, draws) => 1 - binom(unseen - outs, draws) / binom(unseen, draws);

  /** The rule of 2 and 4: outs x 2% per card to come (x 4 on the flop when seeing both cards). */
  const ruleOf2and4 = (outs, draws) => Math.min(1, outs * (draws === 2 ? 0.04 : 0.02));

  // ---------- betting side ----------
  // s = bet as a fraction of the pot (0.5 = half pot).
  /** Minimum defence frequency: the share of a range that must continue so a bluff cannot profit automatically. */
  const mdf = (s) => 1 / (1 + s);

  /** How often a pure bluff must work to break even: bet / (pot + bet). */
  const bluffBreakeven = (s) => s / (1 + s);

  /** On the river with a polarized range, the share of bluffs in a balanced betting range: s / (1 + 2s). */
  const balancedBluffShare = (s) => s / (1 + 2 * s);

  /**
   * EV of betting, relative to giving up now: the opponent folds with probability fold (we win the pot);
   * otherwise they call and we win the final pot with probability eqCalled.
   */
  const betEV = (fold, eqCalled, pot, bet) => fold * pot + (1 - fold) * (eqCalled * (pot + 2 * bet) - bet);

  /** Fold frequency at which a bet with equity eqCalled when called breaks even against checking (approximated by eq * pot). */
  const foldNeeded = (eqCalled, eqCheck, pot, bet) => {
    // fold*pot + (1-fold)*(e*(pot+2b) - b) = eqCheck*pot  ->  solve for fold
    const called = eqCalled * (pot + 2 * bet) - bet;
    if (pot - called === 0) return 0;
    return Math.min(1, Math.max(0, (eqCheck * pot - called) / (pot - called)));
  };

  const api = { requiredEquity, potOdds, callEV, maxCall, impliedNeeded, hitProbability, ruleOf2and4, binom, mdf, bluffBreakeven, balancedBluffShare, betEV, foldNeeded };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Odds = api;
})(typeof self !== "undefined" ? self : this);
