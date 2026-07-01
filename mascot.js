/* ============================================================
   mascot.js — shape mascot animation engine
   Two-segment jointed limbs, scene sequencer, kick/slam transitions
   ============================================================ */

const VBOX = 260, CX = 130, CY = 130;

/* ── shape body paths ───────────────────────────────────────── */
function pentPath(cx,cy,r){
  const p=[];for(let i=0;i<5;i++){const a=(Math.PI*2/5)*i-Math.PI/2;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
  return p.map((v,i)=>(i?'L':'M')+v[0].toFixed(1)+' '+v[1].toFixed(1)).join(' ')+'Z';
}
function hexPath(cx,cy,r){
  const p=[];for(let i=0;i<6;i++){const a=(Math.PI*2/6)*i-Math.PI/2;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
  return p.map((v,i)=>(i?'L':'M')+v[0].toFixed(1)+' '+v[1].toFixed(1)).join(' ')+'Z';
}
function starPath(cx,cy,ro,ri){
  const p=[];for(let i=0;i<10;i++){const r=i%2?ri:ro,a=(Math.PI/5)*i-Math.PI/2;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
  return p.map((v,i)=>(i?'L':'M')+v[0].toFixed(1)+' '+v[1].toFixed(1)).join(' ')+'Z';
}

const SHAPE_DEFS = {
  pentagon:{color:'#FFB4A2',stroke:'#2B1B17',build:(cx,cy)=>`<path d="${pentPath(cx,cy,72)}" fill="#FFB4A2" stroke="#2B1B17" stroke-width="3.5"/>`},
  circle:  {color:'#A8DADC',stroke:'#2B1B17',build:(cx,cy)=>`<circle cx="${cx}" cy="${cy}" r="72" fill="#A8DADC" stroke="#2B1B17" stroke-width="3.5"/>`},
  star:    {color:'#FFD166',stroke:'#2B1B17',build:(cx,cy)=>`<path d="${starPath(cx,cy,78,36)}" fill="#FFD166" stroke="#2B1B17" stroke-width="3.5"/>`},
  square:  {color:'#B5E48C',stroke:'#2B1B17',build:(cx,cy)=>`<rect x="${cx-62}" y="${cy-62}" width="124" height="124" rx="14" fill="#B5E48C" stroke="#2B1B17" stroke-width="3.5"/>`},
  triangle:{color:'#F4A261',stroke:'#2B1B17',build:(cx,cy)=>`<polygon points="${cx},${cy-76} ${cx+76},${cy+60} ${cx-76},${cy+60}" fill="#F4A261" stroke="#2B1B17" stroke-width="3.5"/>`},
  hexagon: {color:'#C9B1FF',stroke:'#2B1B17',build:(cx,cy)=>`<path d="${hexPath(cx,cy,72)}" fill="#C9B1FF" stroke="#2B1B17" stroke-width="3.5"/>`},
};
const SHAPE_KEYS = Object.keys(SHAPE_DEFS);

/* ── lerp helper ────────────────────────────────────────────── */
const lerp = (a,b,t) => a+(b-a)*t;
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const easeInOut = t => t<0.5 ? 2*t*t : -1+(4-2*t)*t;

/* ── two-segment limb renderer ──────────────────────────────── */
/*
  Each limb: shoulder/hip anchor → upper segment → elbow/knee → lower segment → hand/foot
  Angles in degrees. upperLen, lowerLen in SVG units.
  Returns SVG path string for a smooth bezier limb.
*/
function limbPath(ax, ay, upperAngleDeg, lowerAngleDeg, upperLen, lowerLen){
  const ua = upperAngleDeg * Math.PI/180;
  const ex = ax + Math.cos(ua)*upperLen;   // elbow/knee x
  const ey = ay + Math.sin(ua)*upperLen;   // elbow/knee y
  const la = (upperAngleDeg + lowerAngleDeg) * Math.PI/180;
  const hx = ex + Math.cos(la)*lowerLen;  // hand/foot x
  const hy = ey + Math.sin(la)*lowerLen;  // hand/foot y
  // bezier through elbow for smoothness
  const cx1 = (ax+ex)/2, cy1 = (ay+ey)/2;
  const cx2 = (ex+hx)/2, cy2 = (ey+hy)/2;
  return {
    path: `M${ax.toFixed(1)},${ay.toFixed(1)} Q${cx1.toFixed(1)},${cy1.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} Q${cx2.toFixed(1)},${cy2.toFixed(1)} ${hx.toFixed(1)},${hy.toFixed(1)}`,
    ex, ey, hx, hy
  };
}

/* ── prop SVG builders (props held in hand) ─────────────────── */
function calendarPropSVG(hx, hy, angle, scale=1){
  // held in two hands — drawn around hand anchor
  const w=54*scale, h=44*scale;
  const rx = hx - w/2, ry = hy - 4*scale;
  return `<g transform="translate(${hx},${hy}) rotate(${angle}) translate(${-w/2},${-4*scale}) scale(${scale})">
    <rect x="0" y="0" width="${w/scale}" height="${h/scale}" rx="5" fill="#FFFDF8" stroke="#2B1B17" stroke-width="2.5"/>
    <rect x="0" y="0" width="${w/scale}" height="13" rx="5" fill="#FFB4A2" stroke="#2B1B17" stroke-width="2.5"/>
    <line x1="10" y1="-4" x2="10" y2="8" stroke="#2B1B17" stroke-width="2" stroke-linecap="round"/>
    <line x1="${w/scale-10}" y1="-4" x2="${w/scale-10}" y2="8" stroke="#2B1B17" stroke-width="2" stroke-linecap="round"/>
    <line x1="8"  y1="21" x2="20" y2="21" stroke="#2B1B17" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="24" y1="21" x2="36" y2="21" stroke="#2B1B17" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="8"  y1="30" x2="20" y2="30" stroke="#2B1B17" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="30" cy="30" r="4" fill="#C9184A"/>
  </g>`;
}

function menuPropSVG(hx, hy, angle, scale=1){
  const w=42*scale, h=56*scale;
  return `<g transform="translate(${hx},${hy}) rotate(${angle}) translate(${-w/2*scale},${-6*scale}) scale(${scale})">
    <rect x="0" y="0" width="${w/scale}" height="${h/scale}" rx="5" fill="#FFFDF8" stroke="#2B1B17" stroke-width="2.5"/>
    <text x="${w/scale/2}" y="14" font-family="Fraunces,serif" font-size="9" fill="#C9184A" text-anchor="middle" font-weight="600">MENU</text>
    <line x1="6" y1="22" x2="${w/scale-6}" y2="22" stroke="#2B1B17" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="6" y1="29" x2="${w/scale-10}" y2="29" stroke="#2B1B17" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="6" y1="36" x2="${w/scale-6}" y2="36" stroke="#2B1B17" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="6" y1="43" x2="${w/scale-8}" y2="43" stroke="#2B1B17" stroke-width="1.6" stroke-linecap="round"/>
  </g>`;
}

function clipboardPropSVG(hx, hy, angle, scale=1){
  const w=42*scale, h=52*scale;
  return `<g transform="translate(${hx},${hy}) rotate(${angle}) translate(${-w/2*scale},${-4*scale}) scale(${scale})">
    <rect x="0" y="4" width="${w/scale}" height="${h/scale}" rx="4" fill="#FFFDF8" stroke="#2B1B17" stroke-width="2.5"/>
    <rect x="${w/scale/2-10}" y="0" width="20" height="10" rx="3" fill="#A8DADC" stroke="#2B1B17" stroke-width="2"/>
    <line x1="7" y1="20" x2="${w/scale-7}" y2="20" stroke="#2B1B17" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="7" y1="28" x2="${w/scale-10}" y2="28" stroke="#2B1B17" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="7" y1="36" x2="${w/scale-7}" y2="36" stroke="#2B1B17" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M7 46 L11 50 L19 41" stroke="#3E7C59" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function bowPropSVG(bx, by, size=1){
  // bow tie sitting on body, two lobes + knot
  const s = 18*size;
  return `<g transform="translate(${bx},${by})">
    <ellipse cx="${-s*0.7}" cy="0" rx="${s*0.75}" ry="${s*0.42}" fill="#C9184A" stroke="#2B1B17" stroke-width="2" transform="rotate(-15)"/>
    <ellipse cx="${s*0.7}" cy="0" rx="${s*0.75}" ry="${s*0.42}" fill="#C9184A" stroke="#2B1B17" stroke-width="2" transform="rotate(15)"/>
    <ellipse cx="0" cy="0" rx="${s*0.22}" ry="${s*0.3}" fill="#A00030" stroke="#2B1B17" stroke-width="1.5"/>
  </g>`;
}

/* ── SVG element factory ────────────────────────────────────── */
function makeSVG(){
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox',`0 0 ${VBOX} ${VBOX}`);
  svg.style.cssText = 'width:100%;height:100%;overflow:visible;display:block;';
  return svg;
}

/* ── mascot state ───────────────────────────────────────────── */
let _shapeKey = null;
let _svg = null;
let _animId = null;
let _sceneT0 = 0;
let _currentScreen = 'screen-ask';
let _pointer = {x:0.5, y:0.4};
let _leanTarget = {x:0, y:0};
let _lean = {x:0, y:0};
let _idleTimer = null;
let _idlePhase = 0;
const IDLE_PHASES = ['neutral','wave','stretch','look','sit'];

/* ── joint state (lerped each frame) ────────────────────────── */
const J = {
  bodyX:0, bodyY:0, bodyRot:0, bodyScaleX:1, bodyScaleY:1,
  headTilt:0,
  UAL:-90, LAL:30,  // upper/lower arm LEFT  (degrees, 0=right)
  UAR:-90, LAR:-30, // upper/lower arm RIGHT
  ULL:80,  LLL:20,  // upper/lower leg LEFT
  ULR:80,  LLR:-20, // upper/lower leg RIGHT
  mouthOpen:0, eyeSquint:0,
  propAngle:0, propScale:1, propOffX:0, propOffY:0, showProp:false,
  blush:0,
};
const JT = Object.assign({}, J); // target values

function lerpJ(speed){
  const s = clamp(speed, 0.01, 1);
  for(const k of Object.keys(JT)){
    if(typeof JT[k] === 'number') J[k] = lerp(J[k], JT[k], s);
    else if(typeof JT[k] === 'boolean') J[k] = JT[k];
  }
}

/* ── eye tracking ───────────────────────────────────────────── */
function eyeOffset(){
  return {
    x: (_pointer.x - 0.5) * 9,
    y: (_pointer.y - 0.4) * 9
  };
}

/* ── draw one frame ─────────────────────────────────────────── */
function drawFrame(){
  if(!_svg) return;
  const def = SHAPE_DEFS[_shapeKey];
  if(!def) return;

  const sw = 4.5; // limb stroke width
  const ULA = J.UAL, LLA = J.LAL;
  const URA = J.UAR, LRA = J.LAR;
  const ULLA = J.ULL, LLLA = J.LLL;
  const ULRA = J.ULR, LLRA = J.LLR;

  // shoulder/hip anchors relative to body center (CX,CY)
  const shoulderLX = CX - 58, shoulderLY = CY - 2;
  const shoulderRX = CX + 58, shoulderRY = CY - 2;
  const hipLX = CX - 24, hipLY = CY + 62;
  const hipRX = CX + 24, hipRY = CY + 62;

  const armL  = limbPath(shoulderLX, shoulderLY, ULA, LLA, 52, 48);
  const armR  = limbPath(shoulderRX, shoulderRY, URA, LRA, 52, 48);
  const legL  = limbPath(hipLX, hipLY, ULLA, LLLA, 50, 46);
  const legR  = limbPath(hipRX, hipRY, ULRA, LLRA, 50, 46);

  const eo = eyeOffset();
  const smileD = J.mouthOpen > 0.5
    ? `M${CX-18} ${CY+14} Q${CX} ${CY+32} ${CX+18} ${CY+14}`
    : `M${CX-16} ${CY+18} Q${CX} ${CY+28} ${CX+16} ${CY+18}`;

  // prop rendered at right hand position
  let propMarkup = '';
  if(J.showProp){
    const rhx = armR.hx + J.propOffX;
    const rhy = armR.hy + J.propOffY;
    const lhx = armL.hx;
    const lhy = armL.hy;
    if(_currentScreen === 'screen-calendar'){
      // held with both hands — midpoint between hands
      const mhx = (rhx+lhx)/2, mhy = (rhy+lhy)/2;
      propMarkup = calendarPropSVG(mhx, mhy, J.propAngle, J.propScale);
    } else if(_currentScreen === 'screen-vibe'){
      propMarkup = menuPropSVG(rhx, rhy, J.propAngle, J.propScale);
    } else if(_currentScreen === 'screen-confirm'){
      propMarkup = clipboardPropSVG(rhx, rhy, J.propAngle, J.propScale);
    } else if(_currentScreen === 'screen-dress'){
      // bow on body center chest
      propMarkup = bowPropSVG(CX + J.propOffX, CY + 18 + J.propOffY, J.propScale);
    }
  }

  // blush ellipses opacity
  const blushOp = J.blush.toFixed(2);

  _svg.innerHTML = `
    <g transform="translate(${J.bodyX.toFixed(1)},${J.bodyY.toFixed(1)}) rotate(${J.bodyRot.toFixed(2)},${CX},${CY}) scale(${J.bodyScaleX.toFixed(3)},${J.bodyScaleY.toFixed(3)})">
      <path d="${legL.path}" stroke="#2B1B17" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${legR.path}" stroke="#2B1B17" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${def.build(CX,CY)}
      ${propMarkup}
      <path d="${armL.path}" stroke="#2B1B17" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${armR.path}" stroke="#2B1B17" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="rotate(${J.headTilt.toFixed(2)},${CX},${CY-10})">
        <ellipse cx="${CX-26}" cy="${CY-16}" rx="10" ry="${10-J.eyeSquint*4}" fill="#2B1B17"/>
        <ellipse cx="${CX+26}" cy="${CY-16}" rx="10" ry="${10-J.eyeSquint*4}" fill="#2B1B17"/>
        <circle cx="${(CX-22+eo.x).toFixed(1)}" cy="${(CY-20+eo.y).toFixed(1)}" r="3.5" fill="white"/>
        <circle cx="${(CX+30+eo.x).toFixed(1)}" cy="${(CY-20+eo.y).toFixed(1)}" r="3.5" fill="white"/>
        <ellipse cx="${CX-36}" cy="${CY+4}" rx="10" ry="6" fill="#C9184A" opacity="${blushOp}"/>
        <ellipse cx="${CX+36}" cy="${CY+4}" rx="10" ry="6" fill="#C9184A" opacity="${blushOp}"/>
        <path d="${smileD}" stroke="#2B1B17" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>
    </g>`;
}

/* ── scene definitions ──────────────────────────────────────── */
/*
  Each scene is a function(t) that sets JT values based on time t (seconds).
  t loops: t = t % sceneDuration
  Scene phases drive the character through the described activity.
*/

function sceneAsk(t){
  // Nervous, shuffles feet, fidgets hands, occasional shy wave
  const loop = t % 6.0;
  const SPEED = 0.12;
  JT.showProp = false;
  JT.blush = 0.35;

  if(loop < 1.5){
    // shuffle feet nervously — weight shift side to side
    const sh = Math.sin(loop * 4.2);
    JT.bodyX = sh * 8;
    JT.bodyY = Math.abs(sh) * 4;
    JT.bodyRot = sh * 3;
    JT.UAL = -110 + sh*8; JT.LAL = 20 + sh*5;
    JT.UAR = -70 + sh*8;  JT.LAR = -20 - sh*5;
    JT.ULL = 85 + sh*10;  JT.LLL = 15 - sh*5;
    JT.ULR = 75 - sh*10;  JT.LLR = -15 + sh*5;
    JT.headTilt = sh * 6;
    JT.mouthOpen = 0;
  } else if(loop < 2.8){
    // wring hands nervously — both arms come to center
    const wt = (loop-1.5)/1.3;
    const wr = Math.sin(wt*Math.PI*3)*8;
    JT.bodyX = 0; JT.bodyY = 0; JT.bodyRot = 0;
    JT.UAL = -50; JT.LAL = -60 + wr;
    JT.UAR = -130; JT.LAR = 60 - wr;
    JT.ULL = 80; JT.LLL = 10; JT.ULR = 80; JT.LLR = -10;
    JT.headTilt = Math.sin(wt*3)*4;
    JT.mouthOpen = 0;
  } else if(loop < 4.2){
    // shy wave — one arm goes up, body tilts slightly
    const wt = (loop-2.8)/1.4;
    const wave = Math.sin(wt*Math.PI*4)*18;
    JT.bodyX = -6; JT.bodyY = 0; JT.bodyRot = -4;
    JT.UAR = -145 + wave; JT.LAR = -40;
    JT.UAL = -90; JT.LAL = 15;
    JT.ULL = 85; JT.LLL = 10; JT.ULR = 75; JT.LLR = -10;
    JT.headTilt = -5;
    JT.mouthOpen = 0.4;
  } else {
    // look down shyly, shuffle again
    const sh = Math.sin((loop-4.2)*3.5);
    JT.bodyX = sh*5; JT.bodyY = 3; JT.bodyRot = sh*2;
    JT.UAL = -95; JT.LAL = 20; JT.UAR = -85; JT.LAR = -20;
    JT.ULL = 80+sh*8; JT.LLL = 12; JT.ULR = 80-sh*8; JT.LLR = -12;
    JT.headTilt = 10; // looking down
    JT.mouthOpen = 0;
  }
}

function sceneCalendar(t){
  // Walk to calendar, hold out, bring close, squint, tilt head, step back
  const loop = t % 7.0;
  JT.showProp = false;
  JT.blush = 0;

  if(loop < 1.2){
    // walk forward (toward viewer/calendar)
    const wt = loop/1.2;
    const cyc = Math.sin(wt*Math.PI*4);
    JT.bodyX = lerp(0,-30,easeInOut(wt));
    JT.bodyY = -Math.abs(cyc)*5;
    JT.bodyRot = cyc*4;
    JT.UAL = cyc*35; JT.LAL = 15+cyc*10;
    JT.UAR = -cyc*35; JT.LAR = -15-cyc*10;
    JT.ULL = 80-cyc*28; JT.LLL = 10+Math.max(0,cyc)*18;
    JT.ULR = 80+cyc*28; JT.LLR = -10-Math.max(0,-cyc)*18;
    JT.showProp = false; JT.mouthOpen = 0;
  } else if(loop < 2.2){
    // hold calendar out with both hands, arms extend forward
    const ht = (loop-1.2)/1.0;
    JT.bodyX = -30; JT.bodyY = 0; JT.bodyRot = 0;
    JT.UAL = lerp(0,-60,easeInOut(ht));  JT.LAL = lerp(15,50,easeInOut(ht));
    JT.UAR = lerp(0,-120,easeInOut(ht)); JT.LAR = lerp(-15,-50,easeInOut(ht));
    JT.ULL = 80; JT.LLL = 10; JT.ULR = 80; JT.LLR = -10;
    JT.showProp = ht>0.3; JT.propAngle = -5; JT.propScale = 1;
    JT.headTilt = 0; JT.mouthOpen = 0;
  } else if(loop < 3.5){
    // bring closer, lean in, squint to read
    const rt = (loop-2.2)/1.3;
    JT.bodyX = -30 + lerp(0,14,easeInOut(rt));
    JT.bodyY = lerp(0,-8,easeInOut(rt));
    JT.bodyRot = lerp(0,-6,easeInOut(rt));
    JT.UAL = -60+lerp(0,20,rt); JT.LAL = 50+lerp(0,10,rt);
    JT.UAR = -120-lerp(0,20,rt); JT.LAR = -50-lerp(0,10,rt);
    JT.headTilt = Math.sin(rt*Math.PI*2)*12;
    JT.eyeSquint = lerp(0,0.6,easeInOut(rt));
    JT.showProp = true; JT.propAngle = -10+rt*5; JT.propScale = 1.1;
    JT.mouthOpen = 0;
  } else if(loop < 4.8){
    // nod slowly — understanding
    const nt = (loop-3.5)/1.3;
    JT.bodyX = -16; JT.bodyY = 0; JT.bodyRot = 0;
    JT.UAL = -40; JT.LAL = 60; JT.UAR = -140; JT.LAR = -60;
    JT.headTilt = Math.sin(nt*Math.PI*1.5)*8;
    JT.eyeSquint = 0; JT.showProp = true; JT.propAngle = 0; JT.propScale = 1;
    JT.mouthOpen = 0.3;
  } else if(loop < 6.0){
    // step back, lower calendar
    const bt = (loop-4.8)/1.2;
    const cyc = Math.sin(bt*Math.PI*3);
    JT.bodyX = lerp(-16,0,easeInOut(bt));
    JT.bodyY = -Math.abs(cyc)*4; JT.bodyRot = cyc*3;
    JT.UAL = lerp(-40,0,bt); JT.LAL = lerp(60,20,bt);
    JT.UAR = lerp(-140,-90,bt); JT.LAR = lerp(-60,-25,bt);
    JT.ULL = 80-cyc*22; JT.LLL = 10+Math.max(0,cyc)*14;
    JT.ULR = 80+cyc*22; JT.LLR = -10-Math.max(0,-cyc)*14;
    JT.showProp = bt<0.7; JT.headTilt = 0; JT.mouthOpen = 0;
  } else {
    // neutral pause before repeat
    const pt = (loop-6.0)/1.0;
    JT.bodyX=0;JT.bodyY=0;JT.bodyRot=0;
    JT.UAL=-100;JT.LAL=20;JT.UAR=-80;JT.LAR=-20;
    JT.ULL=80;JT.LLL=10;JT.ULR=80;JT.LLR=-10;
    JT.headTilt=0;JT.showProp=false;JT.mouthOpen=0;
  }
}

function sceneVibe(t){
  // Walk to menu board, read top-to-bottom with finger, nod at something
  const loop = t % 7.5;
  JT.showProp = false; JT.blush = 0;

  if(loop < 1.0){
    // walk to menu
    const wt = loop/1.0;
    const cyc = Math.sin(wt*Math.PI*5);
    JT.bodyX = lerp(0,-28,easeInOut(wt));
    JT.bodyY = -Math.abs(cyc)*4; JT.bodyRot = cyc*3;
    JT.UAL = cyc*30; JT.LAL = 15;
    JT.UAR = -cyc*30; JT.LAR = -15;
    JT.ULL = 80-cyc*25; JT.LLL = 8+Math.max(0,cyc)*16;
    JT.ULR = 80+cyc*25; JT.LLR = -8-Math.max(0,-cyc)*16;
    JT.showProp = false; JT.mouthOpen = 0;
  } else if(loop < 1.8){
    // raise menu to reading position
    const rt = (loop-1.0)/0.8;
    JT.bodyX = -28; JT.bodyY = 0; JT.bodyRot = 0;
    JT.UAR = lerp(-90,-130,easeInOut(rt)); JT.LAR = lerp(-15,-55,easeInOut(rt));
    JT.UAL = -80; JT.LAL = 15;
    JT.ULL = 80; JT.LLL = 10; JT.ULR = 80; JT.LLR = -10;
    JT.showProp = rt>0.2; JT.propAngle = 8; JT.propScale = 1;
    JT.mouthOpen = 0;
  } else if(loop < 4.0){
    // read top to bottom — right arm finger traces, body subtly bobs
    const rt = (loop-1.8)/2.2;
    JT.bodyX = -28; JT.bodyY = Math.sin(rt*Math.PI*1.5)*3; JT.bodyRot = -2;
    // left arm points/traces down menu
    JT.UAL = -120 + rt*30; JT.LAL = -10 + rt*20;
    JT.UAR = -130; JT.LAR = -55;
    JT.headTilt = Math.sin(rt*Math.PI*2)*5;
    JT.eyeSquint = 0;
    JT.showProp = true; JT.propAngle = 8; JT.propScale = 1;
    JT.mouthOpen = 0;
  } else if(loop < 5.2){
    // nod excitedly at something, look excited
    const nt = (loop-4.0)/1.2;
    JT.bodyX = -28; JT.bodyY = -Math.abs(Math.sin(nt*Math.PI*2))*7; JT.bodyRot = 0;
    JT.UAL = -90; JT.LAL = -40; // left fist pump
    JT.UAR = -130; JT.LAR = -55;
    JT.headTilt = Math.sin(nt*Math.PI*3)*6;
    JT.mouthOpen = 0.8; JT.eyeSquint = -0.3;
    JT.showProp = true;
  } else if(loop < 6.5){
    // step back, lower menu
    const bt = (loop-5.2)/1.3;
    const cyc = Math.sin(bt*Math.PI*3);
    JT.bodyX = lerp(-28,0,easeInOut(bt));
    JT.bodyY = -Math.abs(cyc)*4; JT.bodyRot = cyc*2;
    JT.UAR = lerp(-130,-90,bt); JT.LAR = lerp(-55,-25,bt);
    JT.UAL = lerp(-90,0,bt); JT.LAL = lerp(-40,20,bt);
    JT.ULL = 80-cyc*20; JT.LLL = 10+Math.max(0,cyc)*14;
    JT.ULR = 80+cyc*20; JT.LLR = -10-Math.max(0,-cyc)*14;
    JT.showProp = bt<0.6; JT.mouthOpen = lerp(0.8,0,bt);
  } else {
    JT.bodyX=0;JT.bodyY=0;JT.bodyRot=0;
    JT.UAL=-100;JT.LAL=20;JT.UAR=-80;JT.LAR=-20;
    JT.ULL=80;JT.LLL=10;JT.ULR=80;JT.LLR=-10;
    JT.showProp=false;JT.headTilt=0;JT.mouthOpen=0;
  }
}

function sceneDress(t){
  // Bow on body, reach up to adjust, check angle, adjust again, pat satisfied
  const loop = t % 6.0;
  JT.showProp = true; JT.blush = 0.2;
  JT.propOffX = 0; JT.propOffY = 0;

  if(loop < 1.2){
    // both hands reach up toward bow
    const rt = loop/1.2;
    JT.bodyX=0;JT.bodyY=0;JT.bodyRot=0;
    JT.UAL = lerp(-90,-50,easeInOut(rt)); JT.LAL = lerp(20,-40,easeInOut(rt));
    JT.UAR = lerp(-90,-130,easeInOut(rt)); JT.LAR = lerp(-20,40,easeInOut(rt));
    JT.ULL=80;JT.LLL=10;JT.ULR=80;JT.LLR=-10;
    JT.headTilt=lerp(0,-8,rt);
    JT.propScale = 1; JT.propAngle = 0;
    JT.mouthOpen=0;
  } else if(loop < 2.5){
    // fidget/adjust — small wiggles on the arms
    const ft = (loop-1.2)/1.3;
    const wig = Math.sin(ft*Math.PI*5)*8;
    JT.UAL = -50+wig; JT.LAL = -40-wig;
    JT.UAR = -130-wig; JT.LAR = 40+wig;
    JT.headTilt = -8 + Math.sin(ft*Math.PI*2)*5;
    JT.propAngle = wig*0.4;
    JT.mouthOpen=0; JT.bodyRot=wig*0.3;
  } else if(loop < 3.5){
    // step back to check — arms lower, look at bow
    const ct = (loop-2.5)/1.0;
    JT.UAL = lerp(-50,-90,easeInOut(ct)); JT.LAL = lerp(-40,20,easeInOut(ct));
    JT.UAR = lerp(-130,-90,easeInOut(ct)); JT.LAR = lerp(40,-20,easeInOut(ct));
    JT.bodyX = lerp(0,10,easeInOut(ct));
    JT.headTilt = lerp(-8,6,ct);
    JT.propAngle = lerp(wig=>0,0,ct); // settle
    JT.propAngle = 0;
    JT.mouthOpen = 0;
  } else if(loop < 4.5){
    // reach up again, quick adjustment
    const at = (loop-3.5)/1.0;
    const wig2 = Math.sin(at*Math.PI*4)*5;
    JT.bodyX = 0;
    JT.UAL = -60+wig2; JT.LAL = -30-wig2;
    JT.UAR = -120-wig2; JT.LAR = 30+wig2;
    JT.headTilt = -5;
    JT.propAngle = wig2*0.3;
    JT.mouthOpen = 0;
  } else {
    // pat satisfied — one hand pats bow then falls, smile
    const pt = (loop-4.5)/1.5;
    JT.UAR = lerp(-120,-90,pt); JT.LAR = lerp(30,-20,pt);
    JT.UAL = -90; JT.LAL = 20;
    JT.headTilt = lerp(-5,0,pt);
    JT.mouthOpen = lerp(0,0.7,easeInOut(pt));
    JT.blush = lerp(0.2,0.4,pt);
    JT.bodyRot=0;
  }
}

function sceneConfirm(t){
  // Hold clipboard, read seriously, nod, tick box, satisfied stamp
  const loop = t % 7.0;
  JT.showProp = true; JT.blush = 0;

  if(loop < 1.0){
    // raise clipboard into reading position
    const rt = loop/1.0;
    JT.bodyX=0;JT.bodyY=0;JT.bodyRot=0;
    JT.UAR = lerp(-80,-125,easeInOut(rt)); JT.LAR = lerp(-20,-50,easeInOut(rt));
    JT.UAL = lerp(-100,-70,easeInOut(rt)); JT.LAL = lerp(20,10,easeInOut(rt));
    JT.ULL=80;JT.LLL=10;JT.ULR=80;JT.LLR=-10;
    JT.propAngle = 5; JT.propScale = 1;
    JT.headTilt=0; JT.mouthOpen=0;
  } else if(loop < 3.0){
    // read seriously — eyes scan, body still
    const rt = (loop-1.0)/2.0;
    JT.bodyX=0;JT.bodyY=Math.sin(rt*Math.PI*2)*2;JT.bodyRot=-3;
    JT.UAR = -125; JT.LAR = -50;
    JT.UAL = -70; JT.LAL = 10;
    JT.headTilt = Math.sin(rt*Math.PI*1.5)*6;
    JT.propAngle = 5; JT.propScale = 1;
    JT.eyeSquint = 0.3;
    JT.mouthOpen = 0;
  } else if(loop < 4.2){
    // nod slowly — understanding
    const nt = (loop-3.0)/1.2;
    JT.bodyY = lerp(0,-6,Math.abs(Math.sin(nt*Math.PI*1.5)));
    JT.headTilt = Math.sin(nt*Math.PI*2)*5;
    JT.eyeSquint = 0;
    JT.mouthOpen = 0.2;
    JT.bodyRot=-3;
  } else if(loop < 5.2){
    // tick box — left arm extends to tap clipboard
    const tt = (loop-4.2)/1.0;
    const tap = Math.sin(tt*Math.PI*3);
    JT.UAL = -70 + tap*(-30); JT.LAL = 10 + tap*(-40);
    JT.bodyRot = -3 + tap*2;
    JT.mouthOpen = 0.3;
    JT.headTilt = 0;
  } else if(loop < 6.2){
    // satisfied nod + lower clipboard slightly
    const st = (loop-5.2)/1.0;
    JT.UAR = lerp(-125,-110,st); JT.LAR = lerp(-50,-35,st);
    JT.UAL = lerp(-70,-90,st); JT.LAL = lerp(10,20,st);
    JT.headTilt = Math.sin(st*Math.PI*2)*8;
    JT.mouthOpen = lerp(0.3,0.7,easeInOut(st));
    JT.bodyRot = lerp(-3,0,st);
  } else {
    // return to neutral
    const rt = (loop-6.2)/0.8;
    JT.UAR = lerp(-110,-80,rt); JT.LAR = lerp(-35,-20,rt);
    JT.UAL = lerp(-90,-100,rt); JT.LAL = lerp(20,20,rt);
    JT.showProp = 1-rt > 0.3; JT.bodyRot=0; JT.mouthOpen=0;
    JT.headTilt=0;
  }
}

function sceneSuccess(t){
  // Surprise jump → land → hand over mouth → look away → huge grin → side shuffle
  // Does NOT loop — plays out then settles into happy sway
  JT.showProp = false; JT.blush = 0;

  if(t < 0.6){
    // sudden jump upward — legs push off
    const jt = t/0.6;
    JT.bodyY = lerp(0,-40,easeInOut(jt));
    JT.bodyScaleX = lerp(1,0.88,jt); JT.bodyScaleY = lerp(1,1.12,jt);
    JT.UAL = lerp(-90,-150,jt); JT.LAL = lerp(20,30,jt);
    JT.UAR = lerp(-90,-30,jt);  JT.LAR = lerp(-20,-30,jt);
    JT.ULL = lerp(80,60,jt); JT.LLL = lerp(10,-20,jt);
    JT.ULR = lerp(80,60,jt); JT.LLR = lerp(-10,20,jt);
    JT.headTilt=0; JT.mouthOpen=0.9; JT.eyeSquint=-0.4;
  } else if(t < 1.0){
    // land — squash
    const lt = (t-0.6)/0.4;
    JT.bodyY = lerp(-40,8,easeInOut(lt));
    JT.bodyScaleX = lerp(0.88,1.14,lt); JT.bodyScaleY = lerp(1.12,0.88,lt);
    JT.UAL = lerp(-150,-90,lt); JT.UAR = lerp(-30,-90,lt);
    JT.ULL = lerp(60,85,lt); JT.LLL = lerp(-20,18,lt);
    JT.ULR = lerp(60,85,lt); JT.LLR = lerp(20,-18,lt);
    JT.mouthOpen=0.8;
  } else if(t < 1.3){
    // recover from squash
    const rt = (t-1.0)/0.3;
    JT.bodyY = lerp(8,0,easeInOut(rt));
    JT.bodyScaleX = lerp(1.14,1,rt); JT.bodyScaleY = lerp(0.88,1,rt);
    JT.mouthOpen=0.6;
  } else if(t < 2.5){
    // hand over mouth — both arms come up to face
    const ht = (t-1.3)/1.2;
    JT.bodyY=0; JT.bodyScaleX=1; JT.bodyScaleY=1;
    JT.UAR = lerp(-90,-70,easeInOut(ht)); JT.LAR = lerp(-20,-90,easeInOut(ht));
    JT.UAL = lerp(-90,-110,easeInOut(ht)); JT.LAL = lerp(20,-60,easeInOut(ht));
    JT.headTilt = lerp(0,5,ht);
    JT.mouthOpen = lerp(0.6,0,ht); // hand covers it
    JT.eyeSquint = -0.5;
    JT.blush = lerp(0,0.5,ht);
  } else if(t < 3.6){
    // look away to the side — head turns, body shifts
    const lat = (t-2.5)/1.1;
    JT.bodyX = lerp(0,12,easeInOut(lat)); JT.bodyRot = lerp(0,8,easeInOut(lat));
    JT.headTilt = lerp(5,-12,easeInOut(lat));
    JT.UAR = -70; JT.LAR = -90;
    JT.UAL = -110; JT.LAL = -60;
    JT.eyeSquint = -0.5; JT.blush = 0.5; JT.mouthOpen=0;
  } else if(t < 4.2){
    // turn back with growing grin
    const bt = (t-3.6)/0.6;
    JT.bodyX = lerp(12,0,easeInOut(bt)); JT.bodyRot = lerp(8,0,easeInOut(bt));
    JT.headTilt = lerp(-12,0,easeInOut(bt));
    JT.UAR = lerp(-70,-90,bt); JT.LAR = lerp(-90,-20,bt);
    JT.UAL = lerp(-110,-90,bt); JT.LAL = lerp(-60,20,bt);
    JT.mouthOpen = lerp(0,1,easeInOut(bt));
    JT.eyeSquint = lerp(-0.5,-0.2,bt);
    JT.blush = 0.5;
  } else {
    // side-to-side happy shuffle — forever
    const st = t - 4.2;
    const sh = Math.sin(st*2.8);
    JT.bodyX = sh*16;
    JT.bodyY = -Math.abs(sh)*8;
    JT.bodyRot = sh*7;
    JT.bodyScaleX = 1 + Math.abs(sh)*0.04;
    JT.bodyScaleY = 1 - Math.abs(sh)*0.04;
    // arms swing with the sway — open and happy
    JT.UAL = -100 + sh*20; JT.LAL = 25 + sh*10;
    JT.UAR = -80 - sh*20;  JT.LAR = -25 - sh*10;
    JT.ULL = 80 + sh*18;   JT.LLL = 12 + Math.max(0,-sh)*16;
    JT.ULR = 80 - sh*18;   JT.LLR = -12 - Math.max(0,sh)*16;
    JT.headTilt = sh * 9;
    JT.mouthOpen = 1;
    JT.eyeSquint = -0.3;
    JT.blush = 0.55;
  }
}

/* idle actions between main scene repetitions */
function sceneIdle(subPhase, t){
  const loop = t % 3.5;
  JT.showProp = false; JT.blush = 0;
  if(subPhase === 'wave'){
    const wt = loop/3.5;
    const wave = Math.sin(wt*Math.PI*6)*20;
    JT.bodyX=0;JT.bodyY=0;JT.bodyRot=0;
    JT.UAR = -140+wave; JT.LAR = -30;
    JT.UAL = -85; JT.LAL = 20;
    JT.ULL=80;JT.LLL=10;JT.ULR=80;JT.LLR=-10;
    JT.headTilt=-4; JT.mouthOpen=0.5;
  } else if(subPhase === 'stretch'){
    const sh = Math.sin(loop*1.4);
    JT.UAL = -160+sh*10; JT.LAL = 20+sh*5;
    JT.UAR = -20-sh*10;  JT.LAR = -20-sh*5;
    JT.bodyY = sh*4; JT.headTilt=sh*3;
    JT.mouthOpen=0;
  } else if(subPhase === 'look'){
    const tilt = Math.sin(loop*1.2)*16;
    JT.bodyRot=tilt*0.3; JT.headTilt=tilt;
    JT.UAL=-90;JT.LAL=20;JT.UAR=-90;JT.LAR=-20;
    JT.mouthOpen=0;
  } else if(subPhase === 'sit'){
    JT.bodyY=18;
    JT.ULL=120; JT.LLL=-40; JT.ULR=120; JT.LLR=40;
    JT.UAL=-80;JT.LAL=30;JT.UAR=-100;JT.LAR=-30;
    JT.mouthOpen=0;
  } else {
    // neutral sway
    const s=Math.sin(loop*1.8);
    JT.bodyX=s*5;JT.bodyRot=s*3;
    JT.UAL=-95+s*5;JT.LAL=20;JT.UAR=-85-s*5;JT.LAR=-20;
    JT.ULL=80;JT.LLL=10;JT.ULR=80;JT.LLR=-10;
    JT.mouthOpen=0;
  }
}

/* ── main animation loop ────────────────────────────────────── */
const SCENE_FNS = {
  'screen-ask':     sceneAsk,
  'screen-calendar':sceneCalendar,
  'screen-vibe':    sceneVibe,
  'screen-dress':   sceneDress,
  'screen-confirm': sceneConfirm,
  'screen-success': sceneSuccess,
};

// idle cycling state
let _idleActive = false;
let _idlePhaseKey = 'neutral';
let _idleT0 = 0;
let _idleDur = 0;
let _mainSceneT0 = 0;
let _inIdlePhase = false;
const SCENE_DUR = {
  'screen-ask':7.5,'screen-calendar':8,'screen-vibe':8.5,'screen-dress':7,'screen-confirm':8,'screen-success':999,
};
const IDLE_KEYS = ['neutral','wave','stretch','look','sit'];

function startScene(screenId){
  _currentScreen = screenId;
  _mainSceneT0 = performance.now()/1000;
  _inIdlePhase = false;
  _idleActive = screenId !== 'screen-success';
  scheduleNextIdle();
}

function scheduleNextIdle(){
  clearTimeout(_idleTimer);
  if(!_idleActive || _currentScreen==='screen-success') return;
  const sceneDur = SCENE_DUR[_currentScreen]||7;
  const wait = sceneDur + 0.8 + Math.random()*2;
  _idleTimer = setTimeout(()=>{
    _inIdlePhase = true;
    _idleT0 = performance.now()/1000;
    _idleDur = 2.5 + Math.random()*2;
    _idlePhaseKey = IDLE_KEYS[Math.floor(Math.random()*IDLE_KEYS.length)];
    setTimeout(()=>{
      _inIdlePhase = false;
      _mainSceneT0 = performance.now()/1000;
      scheduleNextIdle();
    }, _idleDur*1000);
  }, wait*1000);
}

function stopScene(){
  clearTimeout(_idleTimer);
  _idleActive = false;
  if(_animId){ cancelAnimationFrame(_animId); _animId=null; }
}

function startLoop(){
  stopScene();
  function frame(){
    const now = performance.now()/1000;
    _lean.x += (_leanTarget.x - _lean.x)*0.07;
    _lean.y += (_leanTarget.y - _lean.y)*0.07;

    if(_currentScreen==='screen-success'){
      const st = now - _mainSceneT0;
      sceneSuccess(st);
    } else if(_inIdlePhase){
      const it = now - _idleT0;
      sceneIdle(_idlePhaseKey, it);
    } else {
      const mt = now - _mainSceneT0;
      const fn = SCENE_FNS[_currentScreen];
      if(fn) fn(mt);
    }

    // apply lean on top of scene-driven body pos
    JT.bodyX += _lean.x;
    JT.bodyY += _lean.y;

    lerpJ(0.1);
    drawFrame();
    _animId = requestAnimationFrame(frame);
  }
  _animId = requestAnimationFrame(frame);
}

/* ── public API ─────────────────────────────────────────────── */
function mascotBuild(shapeKey){
  _shapeKey = shapeKey;
  const host = document.getElementById('mascot-svg-host');
  if(!host) return;
  host.innerHTML = '';
  _svg = makeSVG();
  host.appendChild(_svg);
  drawFrame();
}

function mascotStartScene(screenId){
  startScene(screenId);
  if(!_animId) startLoop();
}

function mascotStop(){
  stopScene();
}

function mascotSetPointer(nx, ny){
  _pointer.x = clamp(nx,0,1);
  _pointer.y = clamp(ny,0,1);
  _leanTarget.x = clamp((nx-0.5)*28,-18,18);
  _leanTarget.y = clamp((ny-0.4)*22,-12,12);
}

/* ── pointer tracking (global) ──────────────────────────────── */
document.addEventListener('mousemove',e=>{
  const wrap = document.getElementById('mascot-stage-wrap');
  if(!wrap) return;
  const r = wrap.getBoundingClientRect();
  mascotSetPointer((e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height);
});
document.addEventListener('touchmove',e=>{
  if(!e.touches||!e.touches[0]) return;
  const wrap = document.getElementById('mascot-stage-wrap');
  if(!wrap) return;
  const r = wrap.getBoundingClientRect();
  mascotSetPointer((e.touches[0].clientX-r.left)/r.width, (e.touches[0].clientY-r.top)/r.height);
},{passive:true});

/* ── kick/slam transition ───────────────────────────────────── */
let _transInProgress = false;
let _transToken = 0;
let _pendingNav = null;

function buildFighterSvg(shapeKey, poseType='idle'){
  const def = SHAPE_DEFS[shapeKey];
  if(!def) return document.createElementNS('http://www.w3.org/2000/svg','svg');
  const sw=4.5;
  const svg = makeSVG();
  // pick arm pose based on poseType
  let alUp=-95,alLo=20,arUp=-85,arLo=-20;
  if(poseType==='run'){alUp=-130;alLo=30;arUp=-50;arLo=-20;}
  if(poseType==='hit'){alUp=-140;alLo=-30;arUp=-40;arLo=30;}
  const armL = limbPath(CX-58,CY-2,alUp,alLo,52,48);
  const armR = limbPath(CX+58,CY-2,arUp,arLo,52,48);
  const legL = limbPath(CX-24,CY+62,80,15,50,46);
  const legR = limbPath(CX+24,CY+62,80,-15,50,46);
  svg.innerHTML=`
    <path d="${legL.path}" stroke="#2B1B17" stroke-width="${sw}" fill="none" stroke-linecap="round"/>
    <path d="${legR.path}" stroke="#2B1B17" stroke-width="${sw}" fill="none" stroke-linecap="round"/>
    ${def.build(CX,CY)}
    <path d="${armL.path}" stroke="#2B1B17" stroke-width="${sw}" fill="none" stroke-linecap="round"/>
    <path d="${armR.path}" stroke="#2B1B17" stroke-width="${sw}" fill="none" stroke-linecap="round"/>
    <ellipse cx="${CX-26}" cy="${CY-16}" rx="10" ry="10" fill="#2B1B17"/>
    <ellipse cx="${CX+26}" cy="${CY-16}" rx="10" ry="10" fill="#2B1B17"/>
    <circle cx="${CX-22}" cy="${CY-20}" r="3.5" fill="white"/>
    <circle cx="${CX+30}" cy="${CY-20}" r="3.5" fill="white"/>
    <path d="M${CX-16} ${CY+18} Q${CX} ${CY+28} ${CX+16} ${CY+18}" stroke="#2B1B17" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  return svg;
}

function spawnBurst(container){
  const b = document.createElement('div');
  b.style.cssText=`position:absolute;left:50%;top:46%;width:72px;height:72px;pointer-events:none;z-index:9;transform:translate(-50%,-50%) scale(0.3);opacity:1;transition:transform .28s ease-out,opacity .28s ease-out;`;
  b.innerHTML=`<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#2B1B17" stroke-width="3.5" stroke-linecap="round">
      <line x1="36" y1="3" x2="36" y2="18"/><line x1="36" y1="54" x2="36" y2="69"/>
      <line x1="3" y1="36" x2="18" y2="36"/><line x1="54" y1="36" x2="69" y2="36"/>
      <line x1="12" y1="12" x2="22" y2="22"/><line x1="50" y1="50" x2="60" y2="60"/>
      <line x1="12" y1="60" x2="22" y2="50"/><line x1="50" y1="22" x2="60" y2="12"/>
    </g>
    <circle cx="36" cy="36" r="10" fill="#FFD166" stroke="#2B1B17" stroke-width="2.5"/>
  </svg>`;
  container.appendChild(b);
  requestAnimationFrame(()=>{
    b.style.transform='translate(-50%,-50%) scale(1.2)';
    setTimeout(()=>{ b.style.opacity='0'; b.style.transform='translate(-50%,-50%) scale(1.6)'; },60);
    setTimeout(()=>{ if(b.parentNode) b.parentNode.removeChild(b); },320);
  });
}

function mascotRunTransition(newShapeKey, newScreenId, onSwap){
  if(_transInProgress){
    _pendingNav = {newShapeKey, newScreenId, onSwap};
    return;
  }
  _transInProgress = true;
  const myToken = ++_transToken;

  mascotStop();

  const wrap = document.getElementById('mascot-stage-wrap');
  if(!wrap){ onSwap(); _transInProgress=false; return; }
  const W=wrap.clientWidth, H=wrap.clientHeight;

  const overlay = document.createElement('div');
  overlay.style.cssText='position:absolute;inset:0;z-index:12;pointer-events:none;';
  wrap.appendChild(overlay);

  const outEl = document.createElement('div');
  outEl.style.cssText='position:absolute;inset:0;will-change:transform;';
  outEl.appendChild(buildFighterSvg(_shapeKey||newShapeKey,'idle'));
  overlay.appendChild(outEl);

  // hide real host
  const host = document.getElementById('mascot-svg-host');
  if(host) host.style.visibility='hidden';

  const ok = ()=> myToken===_transToken;
  function cleanup(){
    if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if(host) host.style.visibility='visible';
    _transInProgress=false;
    if(_pendingNav){
      const n=_pendingNav; _pendingNav=null;
      mascotRunTransition(n.newShapeKey,n.newScreenId,n.onSwap);
    }
  }

  const mode = Math.random()<0.5?'side':'top';

  if(mode==='side'){
    const fromLeft = Math.random()<0.5;
    const inEl = document.createElement('div');
    inEl.style.cssText=`position:absolute;inset:0;will-change:transform;
      transform:translateX(${fromLeft?-W*1.4:W*1.4}px) rotate(${fromLeft?-20:20}deg) scale(0.85);opacity:0.95;`;
    inEl.appendChild(buildFighterSvg(newShapeKey,'run'));
    overlay.appendChild(inEl);

    // run in
    requestAnimationFrame(()=>{
      if(!ok()) return;
      inEl.style.transition='transform .30s cubic-bezier(0.25,0.46,0.45,0.94)';
      inEl.style.transform=`translateX(0px) rotate(${fromLeft?4:-4}deg) scale(1.04)`;
    });

    // contact — outgoing flashes + recoil
    setTimeout(()=>{
      if(!ok()) return;
      spawnBurst(overlay);
      const rx = fromLeft?22:-22, rr = fromLeft?14:-14;
      outEl.style.setProperty('--rx',rx+'px');
      outEl.style.setProperty('--rr',rr+'deg');
      outEl.classList.add('hit-flash','hit-recoil');
      // incoming bounce-back from impact
      inEl.style.transition='transform .10s ease-out';
      inEl.style.transform=`translateX(${fromLeft?-12:12}px) rotate(${fromLeft?2:-2}deg) scale(0.97)`;
    },180);

    // incoming settles
    setTimeout(()=>{
      if(!ok()) return;
      inEl.style.transition='transform .16s cubic-bezier(0.34,1.4,0.64,1)';
      inEl.style.transform='translateX(0) rotate(0) scale(1)';
    },295);

    // swap
    setTimeout(()=>{
      if(!ok()) return;
      onSwap();
      cleanup();
      mascotBuild(newShapeKey);
      mascotStartScene(newScreenId);
      startLoop();
    },580);

  } else {
    // top drop body-slam
    const inEl = document.createElement('div');
    inEl.style.cssText=`position:absolute;inset:0;will-change:transform;
      transform:translateY(${-H*1.5}px) rotate(-10deg) scale(0.9);opacity:0.95;`;
    inEl.appendChild(buildFighterSvg(newShapeKey,'run'));
    overlay.appendChild(inEl);

    requestAnimationFrame(()=>{
      if(!ok()) return;
      inEl.style.transition='transform .22s cubic-bezier(0.7,0,0.9,0.4)';
      inEl.style.transform='translateY(0px) rotate(4deg) scale(1.1)';
    });

    const side = Math.random()<0.5?-1:1;

    setTimeout(()=>{
      if(!ok()) return;
      spawnBurst(overlay);
      outEl.style.setProperty('--rx',side*18+'px');
      outEl.style.setProperty('--rr',side*12+'deg');
      outEl.classList.add('hit-flash','hit-recoil');
      // squash landing
      inEl.style.transition='transform .08s ease-out';
      inEl.style.transform='translateY(9px) rotate(2deg) scale(1.12) scaleY(0.87)';
    },230);

    setTimeout(()=>{
      if(!ok()) return;
      inEl.style.transition='transform .18s cubic-bezier(0.34,1.5,0.64,1)';
      inEl.style.transform='translateY(0) rotate(-1deg) scale(1)';
    },320);

    setTimeout(()=>{
      if(!ok()) return;
      onSwap();
      cleanup();
      mascotBuild(newShapeKey);
      mascotStartScene(newScreenId);
      startLoop();
    },620);
  }
}

/* ── bubble helper ──────────────────────────────────────────── */
function mascotSetBubble(text){
  const el = document.getElementById('mascot-bubble');
  if(!el) return;
  if(text){ el.textContent=text; el.classList.add('show'); }
  else el.classList.remove('show');
}

/* expose globals used by index.html */
window.mascotBuild = mascotBuild;
window.mascotStartScene = mascotStartScene;
window.mascotStop = mascotStop;
window.mascotRunTransition = mascotRunTransition;
window.mascotSetBubble = mascotSetBubble;
window.SHAPE_KEYS = SHAPE_KEYS;
