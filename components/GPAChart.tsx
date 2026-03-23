import WebView from 'react-native-webview';
import { Platform, StyleSheet, View } from 'react-native';
import { scaleSize } from '@/lib/responsive';

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:transparent;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
</style>
</head>
<body>
<div style="background:#F3F3F3;border-radius:24px;padding:20px 20px 16px 20px;width:calc(100vw - 0px);max-width:420px">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
    <span style="font-weight:700;font-size:18px;color:#111">Your GPA</span>
    <div style="display:flex;gap:18px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <span style="font-size:13px;font-weight:600;color:#111">with StudyPup</span>
        <div style="width:36px;height:4px;border-radius:2px;background:#FD8A8A"></div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <span style="font-size:13px;font-weight:500;color:#999">self-study</span>
        <div style="width:36px;height:4px;border-radius:2px;background:#CFCFCF"></div>
      </div>
    </div>
  </div>

  <!-- Chart -->
  <svg id="chart" width="100%" height="200" viewBox="0 0 380 200" preserveAspectRatio="none"></svg>

</div>

<script>
const W = 380, H = 200, PAD = { t: 12, r: 12, b: 12, l: 12 };
const cW = W - PAD.l - PAD.r;
const cH = H - PAD.t - PAD.b;

const FULL = [
  { studypup: 2.0, self: 2.0 },
  { studypup: 2.7, self: 2.1 },
  { studypup: 3.2, self: 2.2 },
  { studypup: 4.0, self: 2.4 },
  { studypup: 4.5, self: 2.3 },
];
const MIN_Y = 1.8, MAX_Y = 4.7;

function toX(i, total) { return PAD.l + (i / (total - 1)) * cW; }
function toY(v) { return PAD.t + (1 - (v - MIN_Y) / (MAX_Y - MIN_Y)) * cH; }

// Cardinal spline through points
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = 'M ' + pts[0][0] + ' ' + pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ' C ' + cp1x + ' ' + cp1y + ' ' + cp2x + ' ' + cp2y + ' ' + p2[0] + ' ' + p2[1];
  }
  return d;
}

const svg = document.getElementById('chart');
const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// Grid lines
const gridYs = [1, 2, 3, 4].map(i => PAD.t + (i / 4) * cH);
gridYs.forEach(y => {
  svg.appendChild(el('line', { x1: PAD.l, y1: y, x2: W - PAD.r, y2: y, stroke: '#DADADA', 'stroke-width': 1, 'stroke-dasharray': '6 10' }));
});

// Lines (start hidden with 0 length)
const selfPts = FULL.map((d, i) => [toX(i, FULL.length), toY(d.self)]);
const pupPts  = FULL.map((d, i) => [toX(i, FULL.length), toY(d.studypup)]);

const selfPath = svg.appendChild(el('path', { d: smoothPath(selfPts), fill: 'none', stroke: '#CFCFCF', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
const pupPath  = svg.appendChild(el('path', { d: smoothPath(pupPts),  fill: 'none', stroke: '#FD8A8A', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

// Animate via stroke-dasharray reveal
function animatePath(pathEl, duration) {
  const len = pathEl.getTotalLength();
  pathEl.setAttribute('stroke-dasharray', len);
  pathEl.setAttribute('stroke-dashoffset', len);
  const start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    pathEl.setAttribute('stroke-dashoffset', len * (1 - ease));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Small delay so WebView is fully rendered
setTimeout(() => {
  animatePath(selfPath, 2000);
  animatePath(pupPath, 2600);
}, 100);
</script>
</body>
</html>`;

const IPAD_HTML = HTML
  .replace('max-width:420px', 'max-width:560px')
  .replace('height="200"', 'height="260"')
  .replace('viewBox="0 0 380 200"', 'viewBox="0 0 520 260"')
  .replace('const W = 380, H = 200', 'const W = 520, H = 260');

export default function GPAChart() {
  const isIpad = Platform.OS === 'ios' && Platform.isPad;
  return (
    <View style={[styles.wrap, isIpad && styles.wrapIpad]}>
      <WebView
        source={{ html: isIpad ? IPAD_HTML : HTML }}
        style={styles.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: scaleSize(300), borderRadius: scaleSize(24), overflow: 'hidden' },
  wrapIpad: { height: scaleSize(380) },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
