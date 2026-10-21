// Baseline preflop ranges for 6-max cash games, 100 big blinds deep, 2.5bb opens (3bb from the SB).
// They follow common published conventions and are meant as a starting point, not solver output.
// Each action is range text in the engine's notation; a class may be split between actions with
// ":weight" (e.g. "A5s:0.5" in two actions means each half of the time).
window.RANGES = {
  scenarios: [
    {
      id: "utg-rfi", group: "Open raise", position: "UTG", title: "UTG opens",
      note: "First to act with five players behind: the tightest opening range.",
      actions: {
        raise: "55+, A8s+, A5s-A3s, K9s+, QTs+, J9s+, T9s, 98s, 87s:0.5, ATo+, KJo+",
      },
    },
    {
      id: "hj-rfi", group: "Open raise", position: "HJ", title: "Hijack opens",
      note: "Four players behind.",
      actions: {
        raise: "44+, A7s+, A5s-A3s, K9s+, Q9s+, J9s+, T9s, 98s, 87s:0.5, ATo+, KJo+, QJo:0.5",
      },
    },
    {
      id: "co-rfi", group: "Open raise", position: "CO", title: "Cutoff opens",
      note: "Three players behind.",
      actions: {
        raise: "22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, 54s:0.5, A9o+, KTo+, QTo+, JTo",
      },
    },
    {
      id: "btn-rfi", group: "Open raise", position: "BTN", title: "Button opens",
      note: "Only the blinds behind, and position for the rest of the hand.",
      actions: {
        raise: "22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 75s+, 64s+, 54s, 53s, 43s:0.5, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o, 87o:0.5",
      },
    },
    {
      id: "sb-rfi", group: "Open raise", position: "SB", title: "Small blind opens",
      note: "Raise-or-fold strategy against the big blind alone.",
      actions: {
        raise: "22+, A2s+, K3s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A4o+, K9o+, Q9o+, J9o+, T9o",
      },
    },
    {
      id: "bb-vs-btn", group: "Facing an open", position: "BB", title: "Big blind vs button open",
      note: "Closing the action with a good price: the widest defence. 3-bets mix value with suited blockers.",
      actions: {
        raise: "TT+, AJs+, A5s-A4s, KQs, K9s:0.5, Q9s:0.5, J9s:0.5, T8s:0.5, 97s:0.5, 86s:0.5, 75s:0.5, 65s:0.5, 54s:0.5, AQo+",
        call: "99-22, ATs-A6s, A3s-A2s, KJs-KTs, K9s:0.5, K8s-K2s, QJs-QTs, Q9s:0.5, Q8s-Q2s, JTs, J9s:0.5, J8s-J4s, T9s, T8s:0.5, T7s-T6s, 98s, 97s:0.5, 96s, 87s, 86s:0.5, 85s, 76s, 75s:0.5, 74s, 65s:0.5, 64s, 54s:0.5, 53s, 43s, AJo-A2o, KQo-K7o, QJo-Q8o, JTo-J8o, T9o-T8o, 98o, 87o, 76o",
      },
    },
    {
      id: "bb-vs-utg", group: "Facing an open", position: "BB", title: "Big blind vs UTG open",
      note: "Against the strongest range, defend tighter and 3-bet mostly for value.",
      actions: {
        raise: "QQ+, AKs, AKo, A5s:0.5",
        call: "JJ-22, AQs-A2s, A5s:0.5, KTs+, K9s:0.5, QTs+, Q9s:0.5, J9s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, AQo-ATo, KJo+, QJo",
      },
    },
    {
      id: "sb-vs-btn", group: "Facing an open", position: "SB", title: "Small blind vs button open",
      note: "Out of position with the big blind still to act: 3-bet or fold.",
      actions: {
        raise: "77+, A8s+, A5s-A3s, K9s+, Q9s+, J9s+, T9s, 98s:0.5, 87s:0.5, 76s:0.5, ATo+, KJo+, QJo:0.5",
      },
    },
    {
      id: "btn-vs-co", group: "Facing an open", position: "BTN", title: "Button vs cutoff open",
      note: "In position against a fairly wide range: 3-bet the top and some suited blockers, call the rest.",
      actions: {
        raise: "TT+, AJs+, A5s-A4s, KQs, AQo+, KJs:0.5, 76s:0.5, 65s:0.5",
        call: "99-22, ATs-A6s, KJs:0.5, KTs-K9s, QTs+, J9s+, T8s+, 98s, 97s, 87s, 76s:0.5, 65s:0.5, 54s, AJo, KQo",
      },
    },
    {
      id: "btn-vs-bb3b", group: "Facing a 3-bet", position: "BTN", title: "Button open, big blind 3-bets",
      note: "After opening the button and facing a 3-bet to about 11bb.",
      actions: {
        raise: "KK+, QQ:0.5, AKs, AKo:0.5, A5s-A4s:0.5",
        call: "QQ:0.5, JJ-55, AQs-ATs, A9s-A6s:0.5, A5s-A4s:0.5, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, 65s:0.5, AKo:0.5, AQo, KQo:0.5",
      },
    },
  ],
};
