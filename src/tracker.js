import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { wasmUrl, faceModelUrl, cdnWasmUrl, cdnFaceModelUrl } from './vision-assets.js'

export const contours = [
  FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_LIPS,
].flat()

async function loadTracker(runtimeUrl, modelUrl) {
  const files = await FilesetResolver.forVisionTasks(runtimeUrl)
  const options = delegate => ({
    baseOptions: { modelAssetPath: modelUrl, delegate },
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


export async function createTracker() {
  try {
    return await loadTracker(cdnWasmUrl, cdnFaceModelUrl)
  } catch (error) {
    console.warn('国内 CDN 加载失败，尝试站点资源', error)
    return loadTracker(wasmUrl, faceModelUrl)
  }
}
