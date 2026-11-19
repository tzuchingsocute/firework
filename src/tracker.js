import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { dependencies } from '../package.json'

const wasmUrl = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${dependencies['@mediapipe/tasks-vision']}/wasm`
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export const contours = [
  FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_LIPS,
].flat()

export async function createTracker() {
  const files = await FilesetResolver.forVisionTasks(wasmUrl)
  const options = delegate => ({
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  })
  try {
    return await FaceLandmarker.createFromOptions(files, options('GPU'))
  } catch {
    return FaceLandmarker.createFromOptions(files, options('CPU'))
  }
}
