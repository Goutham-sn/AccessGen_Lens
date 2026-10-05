import { minioClient, BUCKET } from '../config/storage.js'

export async function putDataUrl(key, dataUrl) {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  const buffer = Buffer.from(base64, 'base64')
  const contentType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
  await minioClient.putObject(BUCKET, key, buffer, buffer.length, { 'Content-Type': contentType })
  return key
}

export async function putBuffer(key, buffer, contentType) {
  await minioClient.putObject(BUCKET, key, buffer, buffer.length, { 'Content-Type': contentType })
  return key
}

export async function getObjectBuffer(key) {
  const stream = await minioClient.getObject(BUCKET, key)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export async function getObjectStream(key) {
  return minioClient.getObject(BUCKET, key)
}

export async function statObject(key) {
  return minioClient.statObject(BUCKET, key)
}
