// Whether Playback should keep waiting for a recording. The backend decides
// the upload window with the database clock and sends it as
// uploadWindow: { open, waitUntil }, so the browser's clock never matters.
// No video and an open window: keep waiting. Anything else is final.
export function keepWaitingForVideo(playback) {
  if (!playback?.session) return true // nothing loaded yet
  if (playback.session.video_url) return false
  return playback.uploadWindow?.open === true
}
