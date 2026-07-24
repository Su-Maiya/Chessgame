/* Simple AI using minimax with basic evaluation (material + piece-square). Not ultra-strong but usable. */
class AI {
  constructor(engine){ this.engine = engine; }

  evaluate(board){
    const vals = {'p':100,'n':320,'b':330,'r':500,'q':900,'k':20000};
    let score = 0;
    for(let i=0;i<64;i++){ const p = board[i]; if(!p) continue; const v = vals[p.toLowerCase()]||0; score += (p===p.toUpperCase()? v : -v); }
    return score;
  }

  bestMove(depth=2){
    const moves = this.engine.legalMoves(); if(!moves.length) return null;
    let best = moves[0], bestScore = -Infinity;
    for(const m of moves){ this.engine._makeMoveInternal(m); const score = -this._negamax(depth-1, -Infinity, Infinity); this.engine._undoInternal(); if(score>bestScore){ bestScore=score; best=m; } }
    return best;
  }

  _negamax(depth, alpha, beta){
    if(depth===0) return this.evaluate(this.engine.board);
    const moves = this.engine.legalMoves(); if(!moves.length) return this.engine._inCheck(this.engine.turn)? -99999:0;
    let max = -Infinity;
    for(const m of moves){ this.engine._makeMoveInternal(m); const val = -this._negamax(depth-1, -beta, -alpha); this.engine._undoInternal(); if(val>max) max=val; if(val>alpha) alpha=val; if(alpha>=beta) break; }
    return max;
  }
}

window.ChessAI = AI;
