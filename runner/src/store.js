import pg from 'pg'
import * as Minio from 'minio'
import { config } from './config.js'

const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 4 })
const minio = new Minio.Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey
})

export const store = {
  async getSession(sessionId) {
    const { rows } = await pool.query('SELECT id, start_time, coverage FROM sessions WHERE id = $1', [sessionId])
    return rows[0]
  },

  async markRunning(sessionId) {
    await pool.query(`UPDATE sessions SET status = 'running' WHERE id = $1`, [sessionId])
  },

  async putVideo(sessionId, filePath) {
    const key = `sessions/${sessionId}/session.webm`
    await minio.fPutObject(config.minio.bucket, key, filePath, { 'Content-Type': 'video/webm' })
    return key
  },

  async putImage(key, buffer) {
    await minio.putObject(config.minio.bucket, key, buffer, buffer.length, { 'Content-Type': 'image/jpeg' })
    return key
  },

  // One moment from the evidence engine. timestamp_ms is session time
  // (recording_offset_ms + video time), which is what Playback reads.
  async saveMoment(sessionId, moment, { timestampMs, shotKeys, profiles }) {
    await pool.query(
      `INSERT INTO empathy_moments
         (session_id, timestamp_ms, label, note, screenshot_url, active_profiles,
          source, detector, profile_id, video_ms, rect, evidence,
          shot_url, shot_clean_url, closeup_url, pattern_count, headline, fact, for_team, internal_ref)
       VALUES ($1, $2, $3, $4, $5, $6, 'runner', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [sessionId, timestampMs, moment.headline, moment.fact, shotKeys.shot, JSON.stringify(profiles || []),
       moment.detector, moment.profile, moment.videoMs, JSON.stringify(moment.element.rect),
       JSON.stringify({
         tier: moment.tier, step: moment.step, measured: moment.evidence, element: moment.element,
         pattern: moment.pattern, number: moment.number, held: moment.held
       }),
       shotKeys.shot, shotKeys.clean, shotKeys.closeup, moment.pattern?.count ?? 1,
       moment.headline, moment.fact, moment.forTeam, moment.internalRef ?? null]
    )
    await pool.query('UPDATE sessions SET empathy_moment_count = empathy_moment_count + 1 WHERE id = $1', [sessionId])
  },

  // Every run ends here, with or without a video, so no session is left
  // waiting forever. Without a video it ends as no_video, never complete.
  async finalize(sessionId, { videoKey, durationSeconds, recordingOffsetMs, coverage, timings, debug }) {
    await pool.query(
      `UPDATE sessions
          SET status = CASE WHEN $3::text IS NULL THEN 'no_video' ELSE 'complete' END,
              processing_complete = TRUE,
              end_time = NOW(),
              duration_seconds = $2,
              video_url = $3,
              recording_offset_ms = $4,
              coverage = COALESCE(coverage, '{}'::jsonb) || $5::jsonb,
              run_timings = $6,
              run_debug = $7
        WHERE id = $1`,
      [sessionId, durationSeconds ?? null, videoKey ?? null, recordingOffsetMs ?? null,
       JSON.stringify(coverage || {}), JSON.stringify(timings || {}), JSON.stringify(debug || {})]
    )
  },

  async close() {
    await pool.end()
  }
}
