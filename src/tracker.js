import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { wasmUrl, faceModelUrl } from './vision-assets.js'

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
    baseOptions: { modelAssetPath: faceModelUrl, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  })
  try {
    return await FaceLandmarker.createFromOptions(files, options('GPU'))
  } catch {
    return FaceLandmarker.createFromOptions(files, options('CPU'))
  }
}
