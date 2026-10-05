import * as Minio from 'minio'
import { requireEnv } from './requireEnv.js'

const { MINIO_ACCESS_KEY, MINIO_SECRET_KEY } = requireEnv('MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY')

export const BUCKET = process.env.MINIO_BUCKET || 'accessgen-lens'

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY
})

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET)
  if (!exists) {
    await minioClient.makeBucket(BUCKET)
  }
  console.log(`[storage] bucket "${BUCKET}" ready`)
}
