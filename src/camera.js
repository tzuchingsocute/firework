export const preferredCapture = {
  facingMode: { ideal: 'user' },
  width: { ideal: 720 },
  height: { ideal: 1280 },
  aspectRatio: { ideal: 9 / 16 },
  resizeMode: { ideal: 'none' },
}

export async function openCamera(video, signal, onEnded, deviceId) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('请通过 HTTPS 或 localhost 打开页面，并使用支持摄像头的浏览器。')
  }

  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: deviceId ? { ...preferredCapture, deviceId: { exact: deviceId } } : preferredCapture,
    })
    signal.throwIfAborted()
    video.srcObject = stream
    stream.getVideoTracks()[0].addEventListener('ended', onEnded)
    await video.play()
    return stream
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop())
    if (video.srcObject === stream) video.srcObject = null
    const messages = {
      NotAllowedError: '摄像头权限未获准。请在浏览器的网站设置中允许摄像头，再重试。',
      NotFoundError: '找不到摄像头。请连接或启用摄像头后重试。',
      NotReadableError: '无法读取摄像头。请检查系统权限，或关闭正在使用摄像头的应用。',
    }
    throw new Error(messages[error.name] ?? '无法启动摄像头，请检查设备后重试。', { cause: error })
  }
}
