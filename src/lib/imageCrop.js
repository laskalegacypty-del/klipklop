function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load selected image'))
    image.src = src
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Could not process cropped image'))
        return
      }
      resolve(blob)
    }, type, quality)
  })
}

export async function createCroppedImageFile({
  imageSrc,
  cropPixels,
  fileName = 'photo.jpg',
  outputType = 'image/jpeg',
  quality = 0.85,
  maxDimension = 1200,
}) {
  if (!imageSrc) throw new Error('Missing image source')
  if (!cropPixels?.width || !cropPixels?.height) throw new Error('Please position the crop first')

  const image = await loadImage(imageSrc)
  // Preserve the crop's own aspect ratio (square when the caller used
  // aspect={1}, whatever ratio they picked otherwise) rather than forcing a
  // square canvas — only cap the longer side at maxDimension.
  const scale = Math.min(1, maxDimension / Math.max(cropPixels.width, cropPixels.height))
  const outWidth = Math.round(cropPixels.width * scale)
  const outHeight = Math.round(cropPixels.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not open image editor')

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
    outWidth,
    outHeight,
  )

  const blob = await canvasToBlob(canvas, outputType, quality)
  return new File([blob], fileName, { type: outputType })
}
