// Pictures for the demo studios, drawn in the browser so the demos ship no image files.
// Every picture comes from a seed string, so a demo looks the same each time it is set up.

function rng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h += 0x6D2B79F5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return { c, g: c.getContext('2d')! }
}

// A fine grain over everything, so flat colour reads as paint or paper.
function grain(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, amount = 18) {
  const img = g.getImageData(0, 0, w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amount
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
}

const done = (c: HTMLCanvasElement) => c.toDataURL('image/jpeg', 0.84)

export async function fontsReady() {
  try { await document.fonts.load('40px Recoleta') } catch { /* falls back to serif */ }
}

// Soft stacked colour fields, like a painting photographed straight on.
export function painting(seed: string, palette: string[], w = 640, h = 800) {
  const r = rng(seed)
  const { c, g } = canvas(w, h)
  g.fillStyle = palette[0]; g.fillRect(0, 0, w, h)
  const bands = 2 + Math.floor(r() * 2)
  let y = h * 0.06
  for (let i = 0; i < bands; i++) {
    const bh = (h * 0.88 - h * 0.04 * (bands - 1)) / bands
    // Feathered edges: the same field drawn several times, a little smaller and fainter each time.
    g.save()
    g.fillStyle = palette[1 + (i % (palette.length - 1))]
    const x0 = w * 0.08 + r() * 8, bw = w * 0.84 - r() * 12
    for (let k = 10; k >= 0; k--) {
      g.globalAlpha = 0.09 + (10 - k) * 0.004
      g.fillRect(x0 - k * 1.5, y - k * 1.5, bw + k * 3, bh + k * 3)
    }
    g.globalAlpha = 0.85
    g.fillRect(x0 + 3, y + 3, bw - 6, bh - 6)
    g.restore()
    y += bh + h * 0.04
  }
  grain(g, w, h, r, 22)
  return done(c)
}

// A loose garden or landscape of round marks, for works on paper.
export function marks(seed: string, palette: string[], w = 800, h = 600) {
  const r = rng(seed)
  const { c, g } = canvas(w, h)
  g.fillStyle = palette[0]; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 70; i++) {
    g.save()
    g.globalAlpha = 0.35 + r() * 0.5
    g.fillStyle = palette[1 + Math.floor(r() * (palette.length - 1))]
    g.beginPath()
    g.ellipse(r() * w, h * 0.25 + r() * h * 0.8, 10 + r() * 60, 8 + r() * 40, r() * Math.PI, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  grain(g, w, h, r, 16)
  return done(c)
}

function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = word } else line = test
  }
  if (line) lines.push(line)
  return lines
}

type Motif = 'moon' | 'harbour' | 'snow' | 'hills' | 'none'

// A book cover: a coloured ground, a simple motif, the title and the name.
export function cover(seed: string, title: string, byline: string, palette: string[], motif: Motif, w = 600, h = 760) {
  const r = rng(seed)
  const { c, g } = canvas(w, h)
  g.fillStyle = palette[0]; g.fillRect(0, 0, w, h)
  const ink = palette[1], accent = palette[2] ?? palette[1]
  if (motif === 'moon') {
    g.fillStyle = accent; g.beginPath(); g.arc(w * 0.68, h * 0.36, w * 0.17, 0, Math.PI * 2); g.fill()
    g.fillStyle = ink
    g.beginPath(); g.moveTo(0, h * 0.78); g.quadraticCurveTo(w * 0.35, h * 0.6, w, h * 0.74); g.lineTo(w, h); g.lineTo(0, h); g.fill()
    g.fillStyle = palette[3] ?? '#C8642D'
    g.beginPath(); g.moveTo(w * 0.28, h * 0.7); g.lineTo(w * 0.34, h * 0.6); g.lineTo(w * 0.38, h * 0.67); g.lineTo(w * 0.46, h * 0.66); g.lineTo(w * 0.44, h * 0.73); g.fill()
  } else if (motif === 'harbour') {
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = ink; g.globalAlpha = 0.25 + i * 0.1; g.lineWidth = 3
      g.beginPath()
      for (let x = 0; x <= w; x += 10) g.lineTo(x, h * (0.62 + i * 0.05) + Math.sin(x / 40 + i) * 6)
      g.stroke()
    }
    g.globalAlpha = 1
    g.fillStyle = accent; g.beginPath(); g.moveTo(w * 0.42, h * 0.58); g.lineTo(w * 0.62, h * 0.58); g.lineTo(w * 0.58, h * 0.62); g.lineTo(w * 0.46, h * 0.62); g.fill()
    g.fillRect(w * 0.515, h * 0.44, 4, h * 0.14)
  } else if (motif === 'snow') {
    g.fillStyle = accent
    for (let i = 0; i < 90; i++) { g.globalAlpha = 0.5 + r() * 0.5; g.beginPath(); g.arc(r() * w, r() * h * 0.8, 2 + r() * 5, 0, Math.PI * 2); g.fill() }
    g.globalAlpha = 1; g.fillStyle = ink
    g.beginPath(); g.moveTo(0, h * 0.8); g.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.82); g.lineTo(w, h); g.lineTo(0, h); g.fill()
  } else if (motif === 'hills') {
    for (let i = 0; i < 3; i++) {
      g.fillStyle = palette[1 + i] ?? ink; g.globalAlpha = 0.9
      g.beginPath(); g.moveTo(0, h * (0.6 + i * 0.08))
      for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (0.6 + i * 0.08) + Math.sin(x / (80 + i * 30) + r() * 0.2 + i) * 22)
      g.lineTo(w, h); g.lineTo(0, h); g.fill()
    }
    g.globalAlpha = 1
  }
  g.fillStyle = motif === 'none' ? ink : (palette[4] ?? ink)
  g.textBaseline = 'top'
  g.font = `${Math.round(w * 0.085)}px Recoleta, Georgia, serif`
  const lines = wrapText(g, title, w * 0.8)
  lines.forEach((l, i) => g.fillText(l, w * 0.1, h * 0.08 + i * w * 0.1))
  g.font = `${Math.round(w * 0.032)}px Inter, Helvetica, sans-serif`
  g.fillText(byline.toUpperCase(), w * 0.1, h * 0.08 + lines.length * w * 0.1 + w * 0.03)
  grain(g, w, h, r, 10)
  return done(c)
}

// An album or single sleeve: square, circles and lines.
export function sleeve(seed: string, title: string, palette: string[], w = 640) {
  const r = rng(seed)
  const { c, g } = canvas(w, w)
  g.fillStyle = palette[0]; g.fillRect(0, 0, w, w)
  const cx = w * (0.35 + r() * 0.3), cy = w * (0.35 + r() * 0.3)
  for (let i = 7; i > 0; i--) {
    g.fillStyle = palette[1 + (i % (palette.length - 1))]
    g.globalAlpha = 0.85
    g.beginPath(); g.arc(cx, cy, (w * 0.42 * i) / 7, 0, Math.PI * 2); g.fill()
  }
  g.globalAlpha = 1
  g.fillStyle = palette[0]
  g.font = `${Math.round(w * 0.05)}px Inter, Helvetica, sans-serif`
  g.textBaseline = 'bottom'
  g.fillText(title.toUpperCase(), w * 0.06, w * 0.94)
  grain(g, w, w, r, 14)
  return done(c)
}

// A soft, out-of-focus colour study for mood boards.
export function mood(seed: string, palette: string[], w = 640, h = 480) {
  const r = rng(seed)
  const { c, g } = canvas(w, h)
  g.fillStyle = palette[0]; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 7; i++) {
    const x = r() * w, y = r() * h, rad = w * (0.2 + r() * 0.3)
    const col = palette[1 + (i % (palette.length - 1))]
    const grad = g.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0, col); grad.addColorStop(1, col + '00')
    g.fillStyle = grad; g.fillRect(0, 0, w, h)
  }
  grain(g, w, h, r, 20)
  return done(c)
}
