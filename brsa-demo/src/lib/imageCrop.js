function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load that photo'))
    image.src = src
  })
}

export function isPhotoSrc(value) {
  if (!value || typeof value !== 'string') return false
  if (value === 'dust' || value.length <= 2) return false
  return /^(https?:\/\/|\/|data:image\/|blob:)/.test(value)
}

export const PHOTO_SLOTS = {
  avatar: {
    aspect: 1,
    title: 'Profile photo',
    hint: 'Square crop — keep the face in the middle.',
    maxWidth: 900,
    frame: 'aspect-square',
  },
  cover: {
    aspect: 3,
    title: 'Cover photo',
    hint: 'Wide banner — put the action in the centre.',
    maxWidth: 1600,
    frame: 'aspect-[3/1]',
  },
  horse: {
    aspect: 4 / 5,
    title: 'Horse photo',
    hint: 'Portrait — get the head and neck in the frame.',
    maxWidth: 1200,
    frame: 'aspect-[4/5]',
  },
  post: {
    aspect: 4 / 3,
    title: 'Photo',
    hint: 'This is exactly how it will show in the yard.',
    maxWidth: 1400,
    frame: 'aspect-[4/3]',
  },
}

export async function createCroppedImageDataUrl({
  imageSrc,
  cropPixels,
  outputType = 'image/jpeg',
  quality = 0.86,
  maxWidth = 1400,
}) {
  if (!imageSrc) throw new Error('Missing photo')
  if (!cropPixels?.width || !cropPixels?.height) throw new Error('Move the crop until it looks right')

  const image = await loadImage(imageSrc)
  const scale = Math.min(1, maxWidth / cropPixels.width)
  const width = Math.max(1, Math.round(cropPixels.width * scale))
  const height = Math.max(1, Math.round(cropPixels.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not open the photo editor')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    width,
    height,
  )
  return canvas.toDataURL(outputType, quality)
}
