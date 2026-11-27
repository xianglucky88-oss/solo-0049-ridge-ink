let asset

export function showArtwork(image, svg) {
  if (asset) URL.revokeObjectURL(asset)
  asset = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  image.src = asset
  image.hidden = false
}

// Render the measurement sheet inline so its zones stay clickable. The server
// SVG is used verbatim; zone <g> elements carry data-zone and data-kind.
export function showMeasureSheet(container, svg) {
  container.innerHTML = svg
  const root = container.querySelector('svg')
  if (!root) return null
  const groups = [...root.querySelectorAll('[data-zone]')]
  return {
    root,
    groups,
    // With nothing chosen the drawing stays whole; once zones are chosen the
    // others recede so the selected work areas stand out.
    highlight(selected) {
      for (const group of groups) {
        const active = selected.has(group.dataset.zone)
        if (selected.size === 0) {
          group.removeAttribute('data-selected')
          group.classList.remove('selected')
        } else {
          group.dataset.selected = String(active)
          group.classList.toggle('selected', active)
        }
      }
    },
    hitZone(event) {
      const group = event.target.closest?.('[data-zone]')
      return group?.dataset.zone ?? null
    }
  }
}

export function clearArtwork() {
  if (asset) URL.revokeObjectURL(asset)
  asset = null
}
