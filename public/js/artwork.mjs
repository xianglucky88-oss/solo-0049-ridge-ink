let asset

export function showArtwork(image, svg) {
  if (asset) URL.revokeObjectURL(asset)
  asset = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  image.src = asset
  image.hidden = false
}
