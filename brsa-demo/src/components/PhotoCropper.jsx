import { useEffect, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import toast from 'react-hot-toast'
import { Camera } from 'lucide-react'
import { createCroppedImageDataUrl, isPhotoSrc, PHOTO_SLOTS } from '../lib/imageCrop'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import { cn } from './ui/cn'

export function PhotoCropper({ open, slot = 'avatar', source, onClose, onSave }) {
  const spec = PHOTO_SLOTS[slot] || PHOTO_SLOTS.avatar
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pixels, setPixels] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setPixels(null)
  }, [open, source])

  async function save() {
    if (!source || !pixels) {
      toast.error('Drag and zoom until the photo sits in the frame')
      return
    }
    setBusy(true)
    try {
      const dataUrl = await createCroppedImageDataUrl({
        imageSrc: source,
        cropPixels: pixels,
        maxWidth: spec.maxWidth,
      })
      onSave(dataUrl)
      onClose()
    } catch (err) {
      toast.error(err?.message || 'Could not crop that photo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={spec.title} size="xl">
      <p className="text-sm text-stone-600">{spec.hint} Drag to move, then zoom.</p>
      <div className="relative h-72 overflow-hidden rounded-xl bg-charcoal sm:h-96">
        {source ? (
          <Cropper
            image={source}
            crop={crop}
            zoom={zoom}
            aspect={spec.aspect}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, next) => setPixels(next)}
          />
        ) : null}
      </div>
      <label className="block text-sm font-medium text-stone-700">
        Zoom
        <input
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="mt-2 w-full accent-brand-400"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || !source}>
          {busy ? 'Saving…' : 'Save crop'}
        </Button>
      </div>
    </Modal>
  )
}

export function PhotoStage({
  slot = 'avatar',
  src,
  alt = '',
  editable = false,
  onSave,
  className,
  imgClassName = 'h-full w-full object-cover',
  empty,
  compact = false,
}) {
  const spec = PHOTO_SLOTS[slot] || PHOTO_SLOTS.avatar
  const inputRef = useRef(null)
  const blobRef = useRef(null)
  const [source, setSource] = useState(null)

  useEffect(() => () => {
    if (blobRef.current) URL.revokeObjectURL(blobRef.current)
  }, [])

  function openFile() {
    inputRef.current?.click()
  }

  function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Pick a photo file')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Keep it under 8 MB')
      return
    }
    if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    const url = URL.createObjectURL(file)
    blobRef.current = url
    setSource(url)
  }

  function recrop() {
    if (isPhotoSrc(src)) setSource(src)
    else openFile()
  }

  function close() {
    setSource(null)
  }

  return (
    <div className={cn('relative overflow-hidden bg-dust-100', spec.frame, className)}>
      {isPhotoSrc(src) ? (
        <img src={src} alt={alt} className={imgClassName} />
      ) : (
        empty || (
          <div className="flex h-full w-full items-center justify-center text-sm text-stone-500">
            No photo yet
          </div>
        )
      )}
      {editable ? (
        <>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <div
            className={
              compact
                ? 'absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-1'
                : 'absolute inset-x-0 bottom-0 flex flex-wrap justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-2'
            }
          >
            {compact ? (
              <>
                <button
                  type="button"
                  onClick={openFile}
                  className="rounded-sm bg-white/95 p-1.5 text-charcoal"
                  aria-label={isPhotoSrc(src) ? 'Change photo' : 'Add photo'}
                >
                  <Camera size={14} />
                </button>
                {isPhotoSrc(src) ? (
                  <button type="button" onClick={recrop} className="rounded-sm bg-white/95 px-1.5 py-1 text-[10px] font-semibold text-charcoal">
                    Crop
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={openFile}>
                  <Camera size={14} />
                  {isPhotoSrc(src) ? 'Change photo' : 'Add photo'}
                </Button>
                {isPhotoSrc(src) ? (
                  <Button size="sm" variant="secondary" onClick={recrop}>
                    Recrop
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}
      <PhotoCropper
        open={Boolean(source)}
        slot={slot}
        source={source}
        onClose={close}
        onSave={(dataUrl) => {
          onSave?.(dataUrl)
          close()
        }}
      />
    </div>
  )
}
