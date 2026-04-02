import { supabase } from './supabaseClient'

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

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

