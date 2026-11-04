import test from 'node:test'
import assert from 'node:assert/strict'
import { validateDocumentUpload, documentStorageKey, assertTitleHasNoIdentityData } from './documents'
import { signObjectRequest, isObjectStorageConfigured } from '../../integrations/storage'

const ok = { kind: 'passport', title: 'Dee passport scan', mimeType: 'application/pdf', byteSize: 1000, checksumSha256: 'a'.repeat(64) }

test('accepts a valid declaration and normalizes it', () => {
  const v = validateDocumentUpload({ ...ok, title: '  Dee passport scan ', mimeType: 'APPLICATION/PDF', checksumSha256: 'A'.repeat(64) })
  assert.equal(v.title, 'Dee passport scan'); assert.equal(v.mimeType, 'application/pdf'); assert.equal(v.checksumSha256, 'a'.repeat(64))
})
for (const [name, patch] of [['kind', { kind: 'selfie' }], ['type', { mimeType: 'application/x-msdownload' }], ['empty file', { byteSize: 0 }], ['huge file', { byteSize: 26 * 1048576 }], ['fraction', { byteSize: 1.5 }], ['checksum', { checksumSha256: 'zz' }], ['blank title', { title: '  ' }], ['long title', { title: 'x'.repeat(121) }]] as any[]) {
  test(`rejects bad ${name}`, () => assert.throws(() => validateDocumentUpload({ ...ok, ...patch })))
}
test('titles cannot carry passport numbers or birth dates', () => {
  for (const bad of ['Dee X1234567', 'Passport 123456789', 'DOB 1990-04-12', 'born 04/12/1990', 'AB 123 456 78']) assert.throws(() => assertTitleHasNoIdentityData(bad), /passport numbers or birth dates/, bad)
  for (const good of ['Dee passport scan', 'Hotel Roma confirmation', 'Signed terms v2', 'Visa, Japan']) assert.doesNotThrow(() => assertTitleHasNoIdentityData(good), good)
})
test('storage keys are trip-scoped, unguessable and never contain the original file name', () => {
  const a = documentStorageKey('trip1', 'application/pdf'), b = documentStorageKey('trip1', 'application/pdf')
  assert.match(a, /^trips\/trip1\/documents\/[a-f0-9]{32}\/file\.pdf$/); assert.notEqual(a, b)
  assert.match(documentStorageKey('t', 'image/jpeg'), /file\.jpg$/)
})
test('unconfigured storage says so and refuses to sign', () => {
  const saved = { ...process.env }; for (const k of Object.keys(process.env)) if (k.startsWith('S3_')) delete process.env[k]
  try { assert.equal(isObjectStorageConfigured(), false); assert.throws(() => signObjectRequest('GET', { key: 'k', contentType: 'x', byteSize: 1, checksumSha256: 'a'.repeat(64) }), /required/) } finally { Object.assign(process.env, saved) }
})
test('configured storage signs a short-lived GET without leaking the secret', () => {
  const saved = { ...process.env }; Object.assign(process.env, { S3_ENDPOINT: 'https://s3.example.com', S3_BUCKET_NAME: 'b', S3_REGION: 'us-east-1', S3_ACCESS_KEY_ID: 'AKID', S3_SECRET_ACCESS_KEY: 'topsecret' })
  try {
    assert.equal(isObjectStorageConfigured(), true)
    const s = signObjectRequest('GET', { key: 'trips/a/x.pdf', contentType: 'application/pdf', byteSize: 1, checksumSha256: 'a'.repeat(64) }, 99999)
    assert.ok(!s.url.includes('topsecret')); assert.match(s.url, /X-Amz-Expires=900/)
  } finally { for (const k of Object.keys(process.env)) if (k.startsWith('S3_')) delete process.env[k]; Object.assign(process.env, saved) }
})
