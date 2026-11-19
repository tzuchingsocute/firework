import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs'
import { resolve } from 'node:path'

export const sequence = { fps: 30, width: 320, height: 240, seconds: 12 }
export const faceFixture = {
  source: 'https://commons.wikimedia.org/wiki/File:Grace_Hopper.jpg',
  license: 'U.S. public domain, James S. Davis, US Navy (NH 96919-KN)',
  description: 'Public-domain portrait translated across a plain background; no landmark annotations.',
}

export const crownFixture = {
  visibleCrown: [[40, 30], [43, 25], [49, 20], [55, 17], [60, 13], [68, 10], [76, 8],
    [81, 8], [88, 10], [96, 13], [103, 17], [108, 22], [112, 29]],
  placements: { normal: { zoom: 1, top: 46 }, close: { zoom: 1.48, top: 10 }, clipped: { zoom: 1.48, top: -38 } },
}

export const holdoutCrowns = {
  'holdout-normal': { zoom: 1, top: 46, reference: [[30, 65], [35, 57], [39, 45], [44, 35], [50, 26],
    [56, 20], [63, 16], [70, 14], [78, 11], [85, 13], [93, 16], [102, 21], [108, 29],
    [114, 40], [117, 47], [121, 50], [125, 57]] },
  'holdout-tilt': { zoom: 1.16, top: 27, reference: [[26, 64], [30, 55], [32, 43], [38, 31], [44, 23],
    [50, 18], [57, 15], [65, 12], [72, 15], [80, 17], [89, 18], [98, 23], [104, 31],
    [110, 41], [114, 52], [119, 56], [122, 64]] },
}
export const crownScenarios = [...Object.keys(crownFixture.placements), ...Object.keys(holdoutCrowns)]

export function createFaceVideo({ portraitFraming = false, cropFraming = false, headDistance } = {}) {
  const { fps, width, height, seconds } = cropFraming ? { fps: 30, width: 380, height: 320, seconds: 8 } : portraitFraming
    ? { fps: 30, width: 180, height: 320, seconds: 12 } : sequence
  const portrait = readFileSync(new URL(holdoutCrowns[headDistance] ? `./fixtures/${headDistance}.gray` : headDistance ? './fixtures/eileen-collins.gray' : './fixtures/grace-hopper.gray', import.meta.url))
  const portraitWidth = 150
  const portraitHeight = 176
  if (portrait.length !== portraitWidth * portraitHeight) throw new Error('Invalid portrait fixture')
  mkdirSync('test-results', { recursive: true })
  const path = resolve(cropFraming ? 'test-results/crop-scenes.y4m' : headDistance ? `test-results/head-${headDistance}.y4m` : portraitFraming ? 'test-results/surface-scenes.y4m' : 'test-results/face-scenes.y4m')
  const file = openSync(path, 'w')
  const frame = Buffer.alloc(width * height * 1.5, 128)
  try {
    writeSync(file, `YUV4MPEG2 W${width} H${height} F${fps}:1 Ip A1:1 C420jpeg\n`)
    for (let index = 0; index < fps * seconds; index++) {
      const time = index / fps
      frame.fill(48, 0, width * height)
      if (headDistance) {
        const { zoom, top } = holdoutCrowns[headDistance] ?? crownFixture.placements[headDistance]
        const left = (width - Math.round(portraitWidth * zoom)) / 2
        for (let y = 0; y < height; y++) {
          const row = Math.floor((y - top) / zoom)
          if (row < 0 || row >= portraitHeight) continue
          for (let x = 0; x < width; x++) {
            const column = Math.floor((x - left) / zoom)
            if (column >= 0 && column < portraitWidth) frame[y * width + x] = portrait[row * portraitWidth + column]
          }
        }
      } else if (cropFraming || time < 4 || time >= 7) {
        const center = (width - portraitWidth) / 2
        const amplitude = portraitFraming ? 10 : 48
        const left = time < 8 ? center : Math.round(center + amplitude * Math.sin((time - 8) * Math.PI / 2))
        const top = portraitFraming || cropFraming ? 46 : 32
        for (let row = 0; row < portraitHeight; row++) {
          portrait.copy(frame, (row + top) * width + left, row * portraitWidth, (row + 1) * portraitWidth)
        }
      }
      writeSync(file, 'FRAME\n')
      writeSync(file, frame)
    }
  } finally {
    closeSync(file)
  }
  return path
}
