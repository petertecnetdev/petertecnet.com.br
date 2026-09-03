const clamp = value => Math.max(0, Math.min(255, Math.round(value)))

const rgbToHex = ([r, g, b]) => `#${[r, g, b].map(value => clamp(value).toString(16).padStart(2, '0')).join('')}`

const saturation = ([r, g, b]) => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

const distance = (a, b) => Math.sqrt(
  ((a[0] - b[0]) ** 2) + ((a[1] - b[1]) ** 2) + ((a[2] - b[2]) ** 2)
)

const mix = (rgb, target, amount) => rgb.map((channel, index) => clamp(channel + (target[index] - channel) * amount))

function quantize([r, g, b], step = 24) {
  return [
    clamp(Math.round(r / step) * step),
    clamp(Math.round(g / step) * step),
    clamp(Math.round(b / step) * step),
  ]
}

function scoreColor(entry) {
  const sat = saturation(entry.rgb)
  const lum = luminance(entry.rgb)
  const middleLum = 1 - Math.min(1, Math.abs(lum - 0.52) * 1.45)
  return entry.count * (0.5 + sat * 1.8) * (0.65 + middleLum * 0.35)
}

function pickDistinct(candidates, already, minimumDistance = 82) {
  return candidates.find(candidate => already.every(selected => distance(candidate.rgb, selected.rgb) >= minimumDistance))
}

export async function extractBrandPalette(file) {
  if (!(file instanceof Blob)) return null

  const bitmap = await createImageBitmap(file)
  const maxSide = 144
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    bitmap.close?.()
    return null
  }

  context.clearRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const pixels = context.getImageData(0, 0, width, height).data
  const buckets = new Map()
  let coloredPixels = 0

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3]
    if (alpha < 96) continue

    const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]]
    const sat = saturation(rgb)
    const lum = luminance(rgb)

    // Transparência, branco/preto de fundo e cinzas quase neutros não devem dominar a marca.
    if (lum > 0.965 || lum < 0.035 || sat < 0.075) continue

    coloredPixels += 1
    const q = quantize(rgb)
    const key = q.join(',')
    const entry = buckets.get(key) || { rgb: q, count: 0 }
    entry.count += 1
    buckets.set(key, entry)
  }

  let candidates = [...buckets.values()].sort((a, b) => scoreColor(b) - scoreColor(a))

  // Logos monocromáticas ainda recebem uma paleta utilizável.
  if (!candidates.length) {
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 96) continue
      const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]]
      const lum = luminance(rgb)
      if (lum > 0.97 || lum < 0.03) continue
      const q = quantize(rgb, 20)
      const key = q.join(',')
      const entry = buckets.get(key) || { rgb: q, count: 0 }
      entry.count += 1
      buckets.set(key, entry)
    }
    candidates = [...buckets.values()].sort((a, b) => b.count - a.count)
  }

  if (!candidates.length) return null

  const primary = candidates[0]
  const secondary = pickDistinct(candidates.slice(1), [primary], 76) || {
    rgb: mix(primary.rgb, luminance(primary.rgb) > 0.58 ? [0, 0, 0] : [255, 255, 255], 0.24),
  }
  const accent = pickDistinct(candidates.slice(1), [primary, secondary], 68) || {
    rgb: mix(primary.rgb, [255 - primary.rgb[0], 255 - primary.rgb[1], 255 - primary.rgb[2]], 0.36),
  }

  return {
    primary_color: rgbToHex(primary.rgb),
    secondary_color: rgbToHex(secondary.rgb),
    accent_color: rgbToHex(accent.rgb),
    sampled_pixels: coloredPixels,
  }
}
