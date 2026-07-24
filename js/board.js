/* Board renderer and input handler using canvas. Relies on ChessEngine provided in chess.js */
class BoardUI{
  constructor(canvasId, options={}){
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.engine = options.engine; // instance of ChessEngine
    this.size = 640; this.canvas.width = this.size; this.canvas.height = this.size;
    this.squareSize = this.size/8; this.selected = null; this.lastMove = null; this.flipped = false;
    this.dragging = null; this.dragOffset = {x:0,y:0};
    this.pieceMap = this._defaultPieceMap();
    window.addEventListener('resize',()=>this._resize()); this._bindEvents(); this.draw();
  }

  _defaultPieceMap(){
    return {
      'K':'♔','Q':'♕','R':'♖','B':'♗','N':'♘','P':'♙',
      'k':'♚','q':'♛','r':'♜','b':'♝','n':'♞','p':'♟'
    };
  }

  _resize(){ const rect = this.canvas.getBoundingClientRect(); const s = Math.min(rect.width, 640); this.canvas.width = s; this.canvas.height = s; this.size = s; this.squareSize = s/8; this.draw(); }

  _bindEvents(){
    this.canvas.addEventListener('mousedown', e=> this._onDown(e));
    window.addEventListener('mousemove', e=> this._onMove(e));
    window.addEventListener('mouseup', e=> this._onUp(e));
    this.canvas.addEventListener('touchstart', e=> this._onDown(e.touches[0]));
    this.canvas.addEventListener('touchmove', e=> { e.preventDefault(); this._onMove(e.touches[0]); }, {passive:false});
    this.canvas.addEventListener('touchend', e=> this._onUp(e.changedTouches[0]));
  }

  _posToSquare(x,y){ const rect = this.canvas.getBoundingClientRect(); const bx = x-rect.left, by = y-rect.top; const file = Math.floor(bx/this.squareSize); const rank = 7-Math.floor(by/this.squareSize); const idx = rank*8 + file; return idx; }

  _onDown(e){ const idx = this._posToSquare(e.clientX,e.clientY); const piece = this.engine.board[idx]; if(piece){ this.selected = idx; this.dragging = {from:idx,piece}; const rect = this.canvas.getBoundingClientRect(); this.dragOffset.x = e.clientX - rect.left - (idx%8+0.5)*this.squareSize; this.dragOffset.y = e.clientY - rect.top - ((7-Math.floor(idx/8))+0.5)*this.squareSize; }
  }

  _onMove(e){ if(!this.dragging) return; this._mouseX = e.clientX; this._mouseY = e.clientY; this.draw(); }

  _onUp(e){ if(!this.dragging) return; const to = this._posToSquare(e.clientX,e.clientY); const from = this.dragging.from; const moved = this.engine.make({from,to}); this.lastMove = moved? {from,to}: null; this.dragging = null; this.selected = null; if(this.onMove) this.onMove({from,to,moved}); this.draw(); }

  // expose method to check promotion needs
  checkPromotion(from,to){
    const legal = this.engine.legalMoves(); return legal.some(m=>m.from===from && m.to===to && m.promotion);
  }

  draw(){ const ctx = this.ctx; ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    // draw squares
    for(let r=7;r>=0;r--){ for(let f=0;f<8;f++){ const x = f*this.squareSize, y = (7-r)*this.squareSize; const dark = (f+r)%2; ctx.fillStyle = dark? 'rgba(6,182,212,0.06)':'rgba(255,255,255,0.02)'; ctx.fillRect(x,y,this.squareSize,this.squareSize); } }
    // highlights: last move
    if(this.lastMove){ ctx.fillStyle='rgba(245,158,11,0.12)'; this._fillSquare(this.lastMove.from); this._fillSquare(this.lastMove.to); }
    // draw pieces
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font = `${Math.floor(this.squareSize*0.7)}px serif`;
    for(let i=0;i<64;i++){ const p = this.engine.board[i]; if(!p) continue; if(this.dragging && i===this.dragging.from) continue; const pos = this._indexToXY(i); ctx.fillStyle = p===p.toUpperCase() ? '#fff' : '#ddd'; ctx.fillText(this.pieceMap[p]||'?', pos.x+this.squareSize/2, pos.y+this.squareSize/2); }
    // draw dragging piece
    if(this.dragging){ const p = this.dragging.piece; const glyph = this.pieceMap[p]||'?'; const rect = this.canvas.getBoundingClientRect(); const x = this._mouseX - rect.left - this.dragOffset.x; const y = this._mouseY - rect.top - this.dragOffset.y; ctx.globalAlpha = 0.95; ctx.fillStyle = p===p.toUpperCase() ? '#fff' : '#ddd'; ctx.fillText(glyph, x+this.squareSize/2, y+this.squareSize/2); ctx.globalAlpha = 1; }
  }

  _fillSquare(idx){ const pos = this._indexToXY(idx); this.ctx.fillRect(pos.x+4,pos.y+4,this.squareSize-8,this.squareSize-8); }
  _indexToXY(i){ const f = i%8; const r = Math.floor(i/8); return {x: f*this.squareSize, y: (7-r)*this.squareSize}; }

  flip(){ this.flipped = !this.flipped; this.draw(); }
}

window.BoardUI = BoardUI;
