import { dependencies } from '../package.json'

// Keep the runtime version aligned with the installed MediaPipe package.
export const wasmUrl = `${import.meta.env.BASE_URL}mediapipe/${dependencies['@mediapipe/tasks-vision']}/wasm`
export const faceModelUrl = `${import.meta.env.BASE_URL}mediapipe/models/v1/face_landmarker.task`

// Immutable references keep the mirrored model and installed runtime reproducible.
export const cdnWasmUrl = `https://cdn.jsdmirror.cn/npm/@mediapipe/tasks-vision@${dependencies['@mediapipe/tasks-vision']}/wasm`
export const cdnFaceModelUrl = 'https://cdn.jsdmirror.cn/gh/tzuchingsocute/firework@8d625360f0d8b199dfadd4438e0b9098b1b7a108/public/mediapipe/models/v1/face_landmarker.task'
