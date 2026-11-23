// Use the same Starvoid model addresses in local and production builds.
const MODEL_TIMEOUT_MS = 15000
const directory = `${import.meta.env.BASE_URL ?? '/'}mediapipe/models/v1/`
const starvoidModels = Object.freeze({
  'face_landmarker.task': 'https://starvoid.cn/firework/mediapipe/models/v1/face_landmarker.task',
  'pose_landmarker_lite.task': 'https://starvoid.cn/firework/vendor/models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  'selfie_multiclass_256x256.tflite': 'https://starvoid.cn/firework/vendor/models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite',
  'hand_landmarker.task': 'https://starvoid.cn/firework/vendor/models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
})

export function modelSources(filename) {
  const remote = starvoidModels[filename]
  if (!remote) throw new Error(`未知模型: ${filename}`)
  return [remote, directory + filename]
}

export async function loadModel(filename) {
  const errors = []
  for (const url of modelSources(filename)) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(MODEL_TIMEOUT_MS) })
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
      return new Uint8Array(await response.arrayBuffer())
    } catch (error) {
      errors.push(error)
    }
  }
  throw new AggregateError(errors, `模型下载失败: ${filename}`)
}
