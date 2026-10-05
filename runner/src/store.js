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
