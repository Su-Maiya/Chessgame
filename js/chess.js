/* Minimal, self-contained chess engine supporting standard rules.
   Exposes: Chess class with methods: reset(), load(fen), fen(), moves(), make(move), undo(), legalMoves(), inCheck(), gameOverChecks()
*/
class Chess {
  constructor(fen){
    this.reset();
    if(fen) this.load(fen);
  }

  reset(){
    this._initFEN = 'start';
    this.board = new Array(64).fill(null);
    this.turn = 'w';
    this.castling = {w:{K:true,Q:true},b:{K:true,Q:true}};
    this.ep = null; // en passant square index
    this.halfmove = 0; this.fullmove = 1;
    this.history = [];
    this._fenHistory = {};
    this.load('start');
  }

  load(fen){
    if(fen==='start') fen = 'rn...';
    if(fen==='start' || fen==='rn...'){
      const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      fen = start;
    }
    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    let i=0;
    for(let r=0;r<8;r++){
      const row = rows[r];
      let file=0;
      for(const ch of row){
        if(/[1-8]/.test(ch)){ file += parseInt(ch,10); }
        else{ this.board[(7-r)*8 + file] = ch; file++; }
      }
    }
    this.turn = parts[1];
    this.castling = {w:{K:false,Q:false},b:{K:false,Q:false}};
    if(parts[2] && parts[2] !== '-'){
      this.castling.w.K = parts[2].includes('K');
      this.castling.w.Q = parts[2].includes('Q');
      this.castling.b.K = parts[2].includes('k');
      this.castling.b.Q = parts[2].includes('q');
    }
    this.ep = parts[3] === '-' ? null : this._algebraicToIndex(parts[3]);
    this.halfmove = parseInt(parts[4]||'0',10);
    this.fullmove = parseInt(parts[5]||'1',10);
    this.history = [];
    this._fenHistory = {};
    this._recordFen();
  }

  fen(){
    let fenRows = '';
    for(let r=7;r>=0;r--){
      let empty=0;
      for(let f=0;f<8;f++){
        const p = this.board[r*8+f];
        if(!p) empty++; else { if(empty){ fenRows += empty; empty=0;} fenRows += p; }
      }
      if(empty) fenRows += empty;
      if(r>0) fenRows += '/';
    }
    const castling = (this.castling.w.K? 'K':'') + (this.castling.w.Q? 'Q':'') + (this.castling.b.K? 'k':'') + (this.castling.b.Q? 'q':'');
    const ep = this.ep === null ? '-' : this._indexToAlgebraic(this.ep);
    return `${fenRows} ${this.turn} ${castling||'-'} ${ep} ${this.halfmove} ${this.fullmove}`;
  }

  _algebraicToIndex(s){
    const file = s.charCodeAt(0)-97; const rank = parseInt(s[1],10)-1; return rank*8+file;
  }
  _indexToAlgebraic(i){ const f = i%8; const r = Math.floor(i/8); return String.fromCharCode(97+f)+(r+1);
  }

  _recordFen(){ const f = this.fen(); this._fenHistory[f] = (this._fenHistory[f]||0)+1; }

  getPiece(i){ return this.board[i]; }

  // Generate pseudo-legal moves for current side
  moves(){ return this.legalMoves(); }

  legalMoves(){
    const moves = [];
    const side = this.turn;
    for(let i=0;i<64;i++){ const p = this.board[i]; if(!p) continue; const isWhite = p===p.toUpperCase(); if((isWhite? 'w':'b')!==side) continue; this._generatePieceMoves(i,p,moves); }
    // filter moves that leave king in check
    const legal = [];
    for(const m of moves){ this._makeMoveInternal(m); const inCheck = this._inCheck(side); this._undoInternal(); if(!inCheck) legal.push(m); }
    return legal;
  }

  _generatePieceMoves(i,p,moves){
    const isWhite = p===p.toUpperCase(); const piece = p.toLowerCase(); const dir = isWhite?1:-1;
    const r = Math.floor(i/8), f = i%8;
    const push = (to,opts={})=> moves.push(Object.assign({from:i,to, piece:p},opts));
    if(piece==='p'){
      const forward = i + dir*8;
      if(this._onBoard(forward) && !this.board[forward]){ // single
        if((isWhite && Math.floor(forward/8)===7) || (!isWhite && Math.floor(forward/8)===0)){
          ['q','r','b','n'].forEach(prom=> push(forward,{promotion: isWhite?prom.toUpperCase():prom}));
        } else push(forward);
        const startRank = isWhite?1:6; const double = i + dir*16; if(r===startRank && !this.board[double]) push(double,{double:true});
      }
      // captures
      for(const df of [-1,1]){
        const to = i + dir*8 + df; if(!this._onBoard(to)) continue; const tf = to%8; if(Math.abs(tf-f)!==1) continue; const target = this.board[to]; if(target && (target===target.toLowerCase() === isWhite)){
          // same color
        } else if(target){ // capture
          if((isWhite && Math.floor(to/8)===7) || (!isWhite && Math.floor(to/8)===0)){
            ['q','r','b','n'].forEach(prom=> push(to,{captured:target,promotion: isWhite?prom.toUpperCase():prom}));
          } else push(to,{captured:target});
        } else if(this.ep===to){ push(to,{captured:'ep',ep:true}); }
      }
      return;
    }
    const slides = {n:[[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]], b:[[1,1],[1,-1],[-1,-1],[-1,1]], r:[[1,0],[-1,0],[0,1],[0,-1]], q:[[1,1],[1,-1],[-1,-1],[-1,1],[1,0],[-1,0],[0,1],[0,-1]], k:[[1,1],[1,-1],[-1,-1],[-1,1],[1,0],[-1,0],[0,1],[0,-1]] };
    if(piece==='n'){
      for(const d of slides.n){ const to = (r+d[1])*8 + (f+d[0]); if(!this._onBoardIndex(to)) continue; const t = this.board[to]; if(!t || this._isOpposite(p,t)) push(to,{captured:t}); }
      return;
    }
    if(piece==='b' || piece==='r' || piece==='q'){
      const arr = slides[piece];
      for(const d of arr){ let nr=r+d[1], nf=f+d[0]; while(nr>=0 && nr<8 && nf>=0 && nf<8){ const to = nr*8+nf; const t = this.board[to]; if(!t) push(to); else{ if(this._isOpposite(p,t)) push(to,{captured:t}); break; } nr+=d[1]; nf+=d[0]; }
      }
      return;
    }
    if(piece==='k'){
      for(const d of slides.k){ const to = (r+d[1])*8 + (f+d[0]); if(!this._onBoardIndex(to)) continue; const t = this.board[to]; if(!t || this._isOpposite(p,t)) push(to,{captured:t}); }
      // castling
      if(this._isWhite(p) && this.castling.w.K){ if(!this.board[61] && !this.board[62]) push(62,{castle:'K'}); }
      if(this._isWhite(p) && this.castling.w.Q){ if(!this.board[59] && !this.board[58] && !this.board[57]) push(58,{castle:'Q'}); }
      if(!this._isWhite(p) && this.castling.b.K){ if(!this.board[5] && !this.board[6]) push(6,{castle:'k'}); }
      if(!this._isWhite(p) && this.castling.b.Q){ if(!this.board[3] && !this.board[2] && !this.board[1]) push(2,{castle:'q'}); }
    }
  }

  _onBoard(i){ return i>=0 && i<64; }
  _onBoardIndex(i){ return this._onBoard(i); }
  _isWhite(p){ return p===p.toUpperCase(); }
  _isOpposite(a,b){ return (a===a.toUpperCase()) !== (b===b.toUpperCase()); }

  _makeMoveInternal(m){
    // apply without recording history
    const snapshot = {board: this.board.slice(), turn:this.turn, castling: JSON.parse(JSON.stringify(this.castling)), ep:this.ep, halfmove:this.halfmove, fullmove:this.fullmove};
    this._internalSnap = snapshot;
    const piece = this.board[m.from];
    // handle castle
    if(m.castle){ if(m.castle==='K'){ // white
        this.board[62]='K'; this.board[63]=null; this.board[61]=null; this.board[60]='K';
      } else if(m.castle==='Q'){ this.board[58]='K'; this.board[56]=null; this.board[59]=null; this.board[60]='K'; }
    }
    this.board[m.to] = m.promotion? m.promotion : this.board[m.from]; this.board[m.from]=null;
    if(m.ep){ // remove captured pawn
      const capIndex = this.turn==='w'? m.to-8 : m.to+8; this.board[capIndex]=null;
    }
    this.turn = this.turn==='w'? 'b':'w';
  }

  _undoInternal(){ const s = this._internalSnap; this.board = s.board; this.turn = s.turn; this.castling = s.castling; this.ep = s.ep; this.halfmove = s.halfmove; this.fullmove = s.fullmove; this._internalSnap = null; }

  make(move){
    // move can be object or {from,to}
    const legal = this.legalMoves(); let m = null;
    if(typeof move === 'string'){
      // simple algebraic like e2e4
      const from = this._algebraicToIndex(move.slice(0,2)); const to = this._algebraicToIndex(move.slice(2,4)); m = legal.find(x=>x.from===from && x.to===to);
    } else if(move.from!==undefined){ m = legal.find(x=>x.from===move.from && x.to===move.to && (move.promotion? x.promotion===move.promotion:true)); }
    if(!m) return false;
    // record history
    this.history.push({fen:this.fen(),move:m});
    // apply
    this._makeMoveInternal(m);
    this._recordFen();
    return true;
  }

  undo(){ if(!this.history.length) return false; const last = this.history.pop(); this.load(last.fen); return true; }

  _inCheck(side){ // find king
    const king = side==='w' ? 'K':'k'; let idx=-1; for(let i=0;i<64;i++) if(this.board[i]===king) idx=i;
    if(idx===-1) return false; // missing king
    // check for opponent attacks - brute force: generate opponent moves and see if any to idx
    const prevTurn = this.turn; this.turn = side==='w'?'b':'w'; const moves = [];
    for(let i=0;i<64;i++){ const p=this.board[i]; if(!p) continue; const isWhite = p===p.toUpperCase(); if((isWhite?'w':'b')!==this.turn) continue; this._generatePieceMoves(i,p,moves); }
    this.turn = prevTurn;
    return moves.some(m=>m.to===idx);
  }

  inCheck(){ return this._inCheck(this.turn); }

  gameOverChecks(){
    const legal = this.legalMoves(); const inCheck = this._inCheck(this.turn);
    if(legal.length===0 && inCheck) return {result:'checkmate',winner: this.turn==='w'?'black':'white'};
    if(legal.length===0 && !inCheck) return {result:'stalemate'};
    // 50-move
    if(this.halfmove>=100) return {result:'draw','reason':'fifty-move'};
    // repetition
    const f = this.fen(); if(this._fenHistory[f]>=3) return {result:'draw','reason':'threefold'};
    return null;
  }

  // Simple PGN/FEN helpers
  exportFEN(){ return this.fen(); }
  importFEN(f){ this.load(f); }
}

// Expose globally
window.ChessEngine = Chess;
