import { FilesetResolver, PoseLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision'
import { wasmUrl } from '../vision-assets.js'

let models
async function load() {
  const files = await FilesetResolver.forVisionTasks(wasmUrl)
  const pose = await PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'CPU' },
    runningMode: 'VIDEO', numPoses: 1,
  })
  try {
    const segment = await ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite', delegate: 'CPU' },
      runningMode: 'VIDEO', outputCategoryMask: true, outputConfidenceMasks: false,
    })
    return { pose, segment }
  } catch (error) { pose.close(); throw error }
}

self.onmessage = async ({ data }) => {
  const { bitmap, time, videoWidth, videoHeight, mode, chin, faceAnchor, videoTime } = data
  try {
    models ??= load()
    const { pose, segment } = await models
    const landmarks = pose.detectForVideo(bitmap, time).landmarks[0]
    segment.segmentForVideo(bitmap, time, result => {
      const source = result.categoryMask
      const mask = new Uint8Array(source.getAsUint8Array())
      self.postMessage({ time, inferenceFinishedAt: performance.timeOrigin + performance.now(), videoWidth, videoHeight, mode, chin, faceAnchor, videoTime, pose: landmarks, mask,
        maskWidth: source.width, maskHeight: source.height }, [mask.buffer])
    })
  } catch (error) {
    self.postMessage({ error: error.message })
  } finally {
    bitmap.close()
  }
}
