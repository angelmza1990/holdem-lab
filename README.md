# Hold'em Lab

Tools for the math of No-Limit Texas Hold'em: preflop ranges, an equity calculator for hands and ranges, a pot odds calculator and bet sizing. Everything runs in the browser.

**Live site:** https://angelmza1990.github.io/holdem-lab/

## Tools

- **[Preflop ranges](https://angelmza1990.github.io/holdem-lab/ranges/)**: the 169 starting hands on a 13×13 grid, with baseline 6-max ranges at 100bb (opens from every position, big blind and small blind defence, button vs cutoff, button vs a 3-bet), mixed strategies, a strength view against 1, 2 and 5 random hands, and an editor to paint, type and share your own ranges.
- **[Equity calculator](https://angelmza1990.github.io/holdem-lab/equity/)**: exact cards or ranges for up to six players on any board. Exact enumeration when the number of deals is small, Monte Carlo with a margin of error otherwise, in a Web Worker.
- **[Pot odds](https://angelmza1990.github.io/holdem-lab/pot-odds/)**: from the pot, the bet and your chance of winning (outs, an equity, or your cards against a range), the verdict, the EV of calling, the largest bet you can call, the implied odds you would need, every common bet size, what the next cards can make, and an outs reference table.
- **[Bet sizing](https://angelmza1990.github.io/holdem-lab/bet-sizing/)**: minimum defence frequency, bluff break-even and balanced value-to-bluff ratios by size; the expected value of each size from your read of the opponent's fold rates; and geometric sizing to get all in by the river.
- **[Method](https://angelmza1990.github.io/holdem-lab/method/)**: how it is computed and checked.

## How it works

Static HTML, CSS and JavaScript with no dependencies.

```
assets/engine.js          cards, 7-card evaluator, range parsing, equity (exact and Monte Carlo)
assets/odds.js            pot odds and bet sizing formulas
assets/ranges.js          baseline preflop ranges
assets/equity-worker.js   runs equity off the main thread
scripts/                  precompute data/preflop-equity.json and data/matchups.json
tests/                    engine and formula tests
```

The evaluator is tested against the known frequencies of all 2,598,960 five-card and all 133,784,560 seven-card hands, and against an independent naive evaluator on 200,000 random hands. CI runs the tests and opens every page in headless Chrome on each push.

The preflop ranges are baseline conventions, not solver output.

## Run it locally

```sh
python3 -m http.server 8080          # then open http://localhost:8080
node --test tests/*.test.js          # FULL=1 adds the 7-card enumeration (about 10 s)
node scripts/build_preflop_equity.js # rebuild the precomputed tables
node scripts/build_matchups.js
```

## License

MIT.
