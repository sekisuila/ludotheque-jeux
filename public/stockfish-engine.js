// Stockfish 19 integration for Strathasard.
// The engine binary is copied at build time from npm package stockfish@19.0.0.
// See /vendor/stockfish/Copying.txt and /vendor/stockfish/SOURCE.txt.

(() => {
  const ENGINE_URL = "/vendor/stockfish/stockfish-19-lite-single.js";
  const MIN_ELO = 1320;
  const MAX_ELO = 3190;

  let worker = null;
  let readyPromise = null;
  let pending = null;

  function clampElo(value) {
    return Math.max(MIN_ELO, Math.min(MAX_ELO, Math.round(Number(value) || MIN_ELO)));
  }

  function stateToFen(state) {
    const rows = state.board.map(row => {
      let out = "";
      let empty = 0;
      for (const piece of row) {
        if (!piece) {
          empty++;
          continue;
        }
        if (empty) {
          out += String(empty);
          empty = 0;
        }
        out += piece;
      }
      if (empty) out += String(empty);
      return out;
    });

    const castling = ["K", "Q", "k", "q"].filter(key => state.castling?.[key]).join("") || "-";
    const ep = state.enPassant
      ? "abcdefgh"[state.enPassant[1]] + String(8 - state.enPassant[0])
      : "-";

    return `${rows.join("/")} ${state.turn} ${castling} ${ep} ${Number(state.halfmove || 0)} ${Number(state.fullmove || 1)}`;
  }

  function parseUciMove(game, uci) {
    if (!uci || uci === "(none)" || uci.length < 4) return null;
    const fc = "abcdefgh".indexOf(uci[0]);
    const fr = 8 - Number(uci[1]);
    const tc = "abcdefgh".indexOf(uci[2]);
    const tr = 8 - Number(uci[3]);
    const promotion = uci[4] ? uci[4].toUpperCase() : null;
    if ([fr, fc, tr, tc].some(Number.isNaN) || fc < 0 || tc < 0) return null;

    return game.legalMoves().find(move =>
      move.fr === fr && move.fc === fc && move.tr === tr && move.tc === tc &&
      (move.promotion || null) === promotion
    ) || null;
  }

  function onWorkerMessage(event) {
    const text = String(event.data ?? "");
    for (const line of text.split(/\r?\n/)) {
      const msg = line.trim();
      if (!msg) continue;

      if (pending?.kind === "uci" && msg === "uciok") {
        const { resolve } = pending;
        pending = null;
        resolve();
        continue;
      }

      if (pending?.kind === "ready" && msg === "readyok") {
        const { resolve } = pending;
        pending = null;
        resolve();
        continue;
      }

      if (pending?.kind === "move" && msg.startsWith("bestmove ")) {
        const best = msg.split(/\s+/)[1] || null;
        const { resolve } = pending;
        pending = null;
        resolve(best);
      }
    }
  }

  function failEngine(error) {
    if (pending) {
      pending.reject(error instanceof Error ? error : new Error(String(error)));
      pending = null;
    }
    try { worker?.terminate(); } catch {}
    worker = null;
    readyPromise = null;
  }

  function waitFor(kind, command, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      if (!worker) return reject(new Error("Stockfish n’est pas chargé."));
      if (pending) return reject(new Error("Stockfish est déjà occupé."));
      const timer = setTimeout(() => {
        if (pending?.kind === kind) {
          pending = null;
          reject(new Error("Stockfish ne répond pas."));
        }
      }, timeoutMs);
      pending = {
        kind,
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); }
      };
      worker.postMessage(command);
    });
  }

  async function ensureReady() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      worker = new Worker(ENGINE_URL);
      worker.addEventListener("message", onWorkerMessage);
      worker.addEventListener("error", event => failEngine(new Error(event.message || "Erreur Stockfish.")));

      await waitFor("uci", "uci", 15000);
      worker.postMessage("setoption name Hash value 16");
      await waitFor("ready", "isready", 15000);
    })().catch(error => {
      failEngine(error);
      throw error;
    });
    return readyPromise;
  }

  async function chooseMove(game, level) {
    await ensureReady();

    const raw = String(level || "");
    if (raw === "sf-max") {
      worker.postMessage("setoption name UCI_LimitStrength value false");
      worker.postMessage("setoption name Skill Level value 20");
    } else {
      const elo = clampElo(raw.replace(/^sf-/, ""));
      worker.postMessage("setoption name UCI_LimitStrength value true");
      worker.postMessage(`setoption name UCI_Elo value ${elo}`);
    }

    await waitFor("ready", "isready", 10000);
    worker.postMessage(`position fen ${stateToFen(game.state)}`);

    const bestmove = await waitFor("move", "go movetime 650", 15000);
    return parseUciMove(game, bestmove);
  }

  function stop() {
    if (worker) {
      try { worker.postMessage("stop"); } catch {}
    }
  }

  function destroy() {
    stop();
    failEngine(new Error("Stockfish arrêté."));
  }

  window.StrathasardStockfish = {
    MIN_ELO,
    MAX_ELO,
    stateToFen,
    chooseMove,
    stop,
    destroy
  };
})();
