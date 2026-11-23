import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { wasmUrl } from '../vision-assets.js'

let model
async function load() {
  const files = await FilesetResolver.forVisionTasks(wasmUrl)
  return HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'CPU' },
    runningMode: 'VIDEO', numHands: 2,
  })
}
self.onmessage = async ({ data }) => {
  const { bitmap, time, key } = data
  try {
    model ??= load()
    const tracker = await model
    const start = performance.now()
    const result = tracker.detectForVideo(bitmap, time)
    const detections = result.landmarks.map((landmarks, index) => ({
      landmarks, side: result.handedness[index]?.[0]?.categoryName, score: result.handedness[index]?.[0]?.score,
    }))
    self.postMessage({ detections, time, key, inferenceMs: performance.now() - start })
  } catch (error) {
    self.postMessage({ error: error.message })
  } finally {
    bitmap.close()
  }
}
