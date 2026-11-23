import { afterEach, expect, it, vi } from 'vitest'
import { modelSources, loadModel } from '../src/model-downloads.js'

afterEach(() => vi.unstubAllGlobals())
it('uses the same Starvoid addresses followed by site for local and production', () => {
  vi.stubGlobal('location', { hostname: '127.0.0.1' })
  const local = modelSources('pose_landmarker_lite.task')
  vi.stubGlobal('location', { hostname: 'tzuchingsocute.github.io' })
  expect(modelSources('pose_landmarker_lite.task')).toEqual(local)
  const sources = modelSources('selfie_multiclass_256x256.tflite', 'tzuchingsocute.github.io')
  expect(sources[0]).toBe('https://starvoid.cn/firework/vendor/models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite')
  expect(sources[1]).toBe('/mediapipe/models/v1/selfie_multiclass_256x256.tflite')
})
it('falls back on Starvoid timeout and returns the exact model bytes', async () => {
  vi.stubGlobal('location', { hostname: 'tzuchingsocute.github.io' })
  const fetch = vi.fn().mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError')).mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
  vi.stubGlobal('fetch', fetch)
  expect(await loadModel('hand_landmarker.task')).toEqual(new Uint8Array([1, 2, 3]))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
})
it('does not accept an HTTP error as model bytes', async () => {
  vi.stubGlobal('location', { hostname: 'localhost' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', { status: 404 })))
  await expect(loadModel('face_landmarker.task')).rejects.toThrow('模型下载失败')
})
