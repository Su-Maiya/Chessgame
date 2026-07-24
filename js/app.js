document.addEventListener('DOMContentLoaded', ()=>{
  // init engine and UI
  const engine = new window.ChessEngine();
  const board = new window.BoardUI('chessboard',{engine});
  const ai = new window.ChessAI(engine);

  const turnEl = document.getElementById('turn');
  const movesEl = document.getElementById('move-history');
  const undoBtn = document.getElementById('undo');
  const redoBtn = document.getElementById('redo');
  const flipBtn = document.getElementById('flip');
  const restartBtn = document.getElementById('restart');
  const clockWhiteEl = document.getElementById('clock-white');
  const clockBlackEl = document.getElementById('clock-black');
  const capturedWhiteEl = document.getElementById('captured-white');
  const capturedBlackEl = document.getElementById('captured-black');
  const promoModal = document.getElementById('promotion-modal');
  const aiDifficulty = document.getElementById('ai-difficulty');
  const timeControl = document.getElementById('time-control');
  const exportPgnBtn = document.getElementById('export-pgn');
  const exportFenBtn = document.getElementById('export-fen');
  const importFenBtn = document.getElementById('import-fen-btn');

  // state
  let redoStack = [];
  let clocks = {white: 300, black: 300}; // seconds default
  let clockInterval = null; let clockRunning = false;
  let currentClockSide = 'w';

  // audio
  const audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  function playBeep(freq=880, time=0.06){ const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='sine'; o.frequency.value=freq; o.connect(g); g.connect(audioCtx.destination); g.gain.value=0.03; o.start(); o.stop(audioCtx.currentTime+time); }

  function refreshUI(){ turnEl.textContent = engine.turn==='w' ? 'White' : 'Black'; board.draw(); renderMoves(); updateCaptured(); updateClocksUI(); }
  function renderMoves(){ movesEl.innerHTML = ''; engine.history.forEach((h,i)=>{ const d = document.createElement('div'); d.textContent = `${i+1}. ${squareName(h.move.from)}${h.move.captured? 'x':'' }${squareName(h.move.to)}`; movesEl.appendChild(d); }); }

  function squareName(i){ const f = String.fromCharCode(97 + (i%8)); const r = Math.floor(i/8)+1; return `${f}${r}`; }

  function updateCaptured(){ const whiteCaps = []; const blackCaps = []; engine.history.forEach(h=>{ const c = h.move.captured; if(!c) return; if(c==='ep') return; if(c===c.toUpperCase()) blackCaps.push(c); else whiteCaps.push(c); }); capturedWhiteEl.textContent = whiteCaps.map(x=>pieceGlyph(x)).join(' '); capturedBlackEl.textContent = blackCaps.map(x=>pieceGlyph(x)).join(' '); }

  function pieceGlyph(p){ const map = {'K':'♔','Q':'♕','R':'♖','B':'♗','N':'♘','P':'♙','k':'♚','q':'♛','r':'♜','b':'♝','n':'♞','p':'♟'}; return map[p]||p; }

  function updateClocksUI(){ clockWhiteEl.textContent = fmt(clocks.white); clockBlackEl.textContent = fmt(clocks.black); }
  function fmt(s){ const m = Math.floor(s/60); const sec = s%60; return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'); }

  function startClocks(){ if(clockInterval) return; clockInterval = setInterval(()=>{ if(!clockRunning) return; if(currentClockSide==='w'){ clocks.white = Math.max(0, clocks.white-1); if(clocks.white<=0) onTimeOut('white'); } else { clocks.black = Math.max(0, clocks.black-1); if(clocks.black<=0) onTimeOut('black'); } updateClocksUI(); },1000); clockRunning = true; }
  function stopClocks(){ clockRunning = false; if(clockInterval){ clearInterval(clockInterval); clockInterval = null; } }
  function resetClocks(){ const seconds = parseInt(timeControl.value,10); clocks.white = seconds; clocks.black = seconds; updateClocksUI(); }
  function onTimeOut(side){ stopClocks(); alert(`${side} flag! Game over (demo).`); }

  // export/import
  exportPgnBtn.addEventListener('click', ()=>{ const pgn = exportPGN(); const w = window.open('about:blank','_blank'); w.document.write(`<pre>${pgn}</pre>`); });
  exportFenBtn.addEventListener('click', ()=>{ prompt('FEN', engine.exportFEN()); });
  importFenBtn.addEventListener('click', ()=>{ const f = prompt('Enter FEN'); if(f) { engine.importFEN(f); board.lastMove = null; redoStack = []; resetClocks(); refreshUI(); } });

  function exportPGN(){ const moves = []; for(let i=0;i<engine.history.length;i++){ const mv = engine.history[i].move; moves.push(`${squareName(mv.from)}${mv.captured? 'x':'' }${squareName(mv.to)}`); }
    let lines=''; for(let i=0;i<moves.length;i+=2){ const num = Math.floor(i/2)+1; lines += `${num}. ${moves[i]||''} ${moves[i+1]||''} `; } return lines || '(no moves)'; }

  board.onMove = ({from,to,moved})=>{ refreshUI(); // if opponent is AI and it's their turn
    // handle promotion if move wasn't applied but needs promotion
    if(!moved){ if(board.checkPromotion(from,to)){ // show modal
        promoModal.setAttribute('aria-hidden','false');
        promoModal.querySelectorAll('.promo-piece').forEach(b=> b.onclick = ()=>{
          const piece = b.dataset.piece; const pawn = engine.board[from]; const promotion = (pawn===pawn.toUpperCase())? piece.toUpperCase(): piece;
          engine.make({from,to,promotion}); promoModal.setAttribute('aria-hidden','true'); redoStack = []; refreshUI(); // then run AI if needed
          if(engine.turn==='b') aiRespond();
        });
      }
      return;
    }
    // successful move
    redoStack = [];
    playBeep();
    // start clocks on first move
    if(engine.history.length===1){ resetClocks(); currentClockSide = engine.turn; startClocks(); }
    // AI response
    if(engine.turn==='b'){ setTimeout(()=>{ aiRespond(); }, 220); }
  };

  function aiRespond(){ const depth = mapDifficulty(parseInt(aiDifficulty.value,10)); const m = ai.bestMove(depth); if(m){ engine.make(m); board.lastMove = {from:m.from,to:m.to}; playBeep(600); refreshUI(); } }

  function mapDifficulty(val){ return Math.max(1, Math.min(4, val)); }

  undoBtn.addEventListener('click', ()=>{ const last = engine.history[engine.history.length-1]; if(last) redoStack.push(last.move); engine.undo(); refreshUI(); });
  redoBtn.addEventListener('click', ()=>{ const m = redoStack.pop(); if(m){ engine.make({from:m.from,to:m.to,promotion:m.promotion}); refreshUI(); } });
  flipBtn.addEventListener('click', ()=>{ board.flip(); });
  restartBtn.addEventListener('click', ()=>{ engine.load('start'); board.lastMove = null; refreshUI(); });

  // theme toggle
  const themeToggle = document.getElementById('theme-toggle'); themeToggle.addEventListener('click', ()=>{ document.body.classList.toggle('dark'); document.body.classList.toggle('light'); });

  // contact form validation
  const contact = document.getElementById('contact-form'); contact.addEventListener('submit', e=>{ e.preventDefault(); alert('Thanks — message sent (demo)'); contact.reset(); });

  // newsletter
  const news = document.getElementById('newsletter'); news.addEventListener('submit', e=>{ e.preventDefault(); alert('Subscribed (demo)'); news.reset(); });

  // scroll top
  const st = document.getElementById('scroll-top'); st.addEventListener('click', ()=> window.scrollTo({top:0,behavior:'smooth'}));

  // hide loading
  const loader = document.getElementById('loading-screen'); setTimeout(()=>{ loader.style.display='none'; },600);

  refreshUI();
});
