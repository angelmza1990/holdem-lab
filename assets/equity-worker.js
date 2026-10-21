// Runs equity calculations off the main thread.
// In:  { id, players: [[[c1, c2, w], ...], ...], board: [...], iterations }
// Out: { id, progress: true, samples, equity } while simulating, then { id, done: true, result } or { id, error }
importScripts("engine.js");

self.onmessage = (e) => {
  const { id, players, board, iterations } = e.data;
  try {
    const result = Poker.equity(players, board, [], {
      iterations,
      onProgress: (samples, equity) => self.postMessage({ id, progress: true, samples, equity }),
    });
    self.postMessage({ id, done: true, result });
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
