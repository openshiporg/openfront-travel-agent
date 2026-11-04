import { randomBytes } from 'node:crypto'

export const DOCUMENT_MIME_TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'text/plain': 'txt' }
export const DOCUMENT_KINDS = ['passport', 'visa', 'insurance', 'supplier_confirmation', 'signed_terms']
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

/** Titles are plain, searchable fields. Identity data belongs in the private file, never in the title. */
export function assertTitleHasNoIdentityData(title: string) {
  const compact = title.replace(/[\s-]/g, '')
  const looksLikeDate = /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\b/.test(title)
  const looksLikeNumber = /\d{6,}/.test(compact) || /\b[A-Z]{1,2}\d{6,9}\b/i.test(title)
  if (looksLikeDate || looksLikeNumber) throw new Error('Titles must not contain passport numbers or birth dates; keep those inside the uploaded file')
}

export function validateDocumentUpload(i: { kind: unknown; title: unknown; mimeType: unknown; byteSize: unknown; checksumSha256: unknown }) {
  const kind = String(i.kind || '')
  if (!DOCUMENT_KINDS.includes(kind)) throw new Error('Choose a document kind')
  const title = String(i.title || '').trim()
  if (!title) throw new Error('Title required')
  if (title.length > 120) throw new Error('Title must be 120 characters or fewer')
  assertTitleHasNoIdentityData(title)
  const mimeType = String(i.mimeType || '').trim().toLowerCase()
  if (!DOCUMENT_MIME_TYPES[mimeType]) throw new Error('This file type is not allowed; use PDF, JPEG, PNG, WebP or plain text')
  const byteSize = Number(i.byteSize)
  if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > MAX_DOCUMENT_BYTES) throw new Error('File size must be between 1 byte and 25 MB')
  const checksumSha256 = String(i.checksumSha256 || '').trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(checksumSha256)) throw new Error('SHA-256 checksum must be 64 hexadecimal characters')
  return { kind, title, mimeType, byteSize, checksumSha256 }
}

/** The uploaded file's own name is never used: a passport scan called "Jane-Doe-X1234567.pdf" must not leak into an object key. */
export function documentStorageKey(tripId: string, mimeType: string) {
  return `trips/${tripId}/documents/${randomBytes(16).toString('hex')}/file.${DOCUMENT_MIME_TYPES[mimeType]}`
}
