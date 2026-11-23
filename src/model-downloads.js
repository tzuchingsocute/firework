// Model versions are pinned to the bundled files and their immutable mirror.
const MODEL_TIMEOUT_MS = 15000
const directory = `${import.meta.env.BASE_URL ?? '/'}mediapipe/models/v1/`
const mirror = 'https://cdn.jsdmirror.cn/gh/tzuchingsocute/firework@c203cf88a6a7f77a5f6c55cf3adf63637e5f3112/public/mediapipe/models/v1/'

export function modelSources(filename) {
  return [mirror + filename, directory + filename]
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
