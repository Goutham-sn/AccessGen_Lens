import { Router } from 'express'
import multer from 'multer'
import { uploadFrames, uploadRecording, streamMedia } from '../controllers/frames.controller.js'
import { sessionWriter } from '../middleware/sessionWriter.js'

const router = Router()

// Memory storage: the file is held in RAM only long enough to hand its
// buffer straight to MinIO; sessions are short, so this stays small.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }
})

// The owner, or the session's upload token. Checked before multer reads
// the body.
router.post('/sessions/:id/frames', sessionWriter('frames'), uploadFrames)
router.post('/sessions/:id/recording', sessionWriter('recording'), upload.single('video'), uploadRecording)
// Media streaming is public-read by object key; keys are unguessable UUID paths.
router.get('/media/*', streamMedia)

export default router
