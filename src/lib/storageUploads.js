import { supabase } from './supabaseClient'

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024
const VIDEO_MAX_BYTES = 100 * 1024 * 1024

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
])

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export class UploadValidationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'UploadValidationError'
    this.code = code
  }
}

function extFromMime(mime) {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return null
  }
}

function videoExtFromMime(mime) {
  switch (mime) {
    case 'video/mp4':
      return 'mp4'
    case 'video/quicktime':
      return 'mov'
    default:
      return null
  }
}

function buildValidationError(code, message) {
  return new UploadValidationError(code, message)
}

/**
 * Upload an image to Supabase Storage.
 *
 * Returns:
 *  - { path, publicUrl }
 */
export async function uploadImageToBucket({
  bucket,
  path,
  file,
  maxBytes = DEFAULT_MAX_BYTES,
}) {
  if (!file) throw new Error('No file selected')

  if (file.size > maxBytes) {
    throw new Error(`Photo must be under ${Math.round(maxBytes / (1024 * 1024))}MB`)
  }

  if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
    // Most common culprit: iOS HEIC/HEIF
    throw new Error('Please upload a JPG, PNG, or WebP image')
  }

  const ext = extFromMime(file.type)
  if (!ext) throw new Error('Unsupported image type')

  // If caller passes a path ending with a different extension, normalize it.
  const normalizedPath = path.replace(/\.[^.\/]+$/, `.${ext}`)

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(normalizedPath, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedPath)
  const publicUrl = data?.publicUrl
  if (!publicUrl) throw new Error('Could not generate photo URL')

  return { path: normalizedPath, publicUrl }
}

export async function uploadVideoToBucket({
  bucket,
  path,
  file,
  maxBytes = VIDEO_MAX_BYTES,
  onProgress,
}) {
  if (!file) {
    throw buildValidationError('missing_file', 'No file selected')
  }

  if (file.size > maxBytes) {
    throw buildValidationError('file_too_large', 'Video must be under 100MB')
  }

  if (!ALLOWED_VIDEO_MIMES.has(file.type)) {
    throw buildValidationError('unsupported_type', 'Please upload an MP4 or MOV video')
  }

  const ext = videoExtFromMime(file.type)
  if (!ext) {
    throw buildValidationError('unsupported_type', 'Please upload an MP4 or MOV video')
  }

  const normalizedPath = path.replace(/\.[^.\/]+$/, `.${ext}`)
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) {
    throw new Error('You must be signed in to upload videos')
  }
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL is not configured')
  }

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${normalizedPath}`)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('content-type', file.type)

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || typeof onProgress !== 'function') return
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)))
      onProgress(percent)
    }

    xhr.onerror = () => reject(new Error('Network error while uploading video'))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (typeof onProgress === 'function') onProgress(100)
        resolve()
        return
      }
      reject(new Error('Could not upload video. Please try again.'))
    }

    xhr.send(file)
  })

  const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedPath)
  const publicUrl = data?.publicUrl
  if (!publicUrl) {
    throw new Error('Could not generate video URL')
  }

  return { path: normalizedPath, publicUrl }
}

