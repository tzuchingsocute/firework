import { dependencies } from '../package.json'

// Keep the runtime version aligned with the installed MediaPipe package.
export const wasmUrl = `${import.meta.env.BASE_URL}mediapipe/${dependencies['@mediapipe/tasks-vision']}/wasm`
