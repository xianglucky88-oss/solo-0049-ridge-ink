export function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits)
}

export function renderZones(list, sheet, selection, onToggle) {
  const rows = sheet.zones.map(zone => {
    const item = document.createElement('li')
    item.dataset.zone = zone.id
    const label = document.createElement('label')
    label.className = 'zone-row'
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = selection.has(zone.id)
    box.addEventListener('change', () => onToggle(zone.id, box.checked))
    const text = document.createElement('span')
    text.className = `zone-text ${zone.kind}`
    const name = document.createElement('strong')
    name.textContent = zone.id
    text.append(name, ` ${zone.kind === 'cut' ? '挖方' : '填方'} · 面积 ${formatNumber(zone.area)} m² · 方量 ${formatNumber(zone.volume)} m³`)
    label.append(box, text)
    item.append(label)
    return item
  })
  if (!rows.length) {
    const empty = document.createElement('li')
    empty.className = 'empty'
    empty.textContent = '这张图没有可核量的工区。'
    rows.push(empty)
  }
  list.replaceChildren(...rows)
}

export function selectionTotals(sheet, selection) {
  const totals = { cut: { area: 0, volume: 0 }, fill: { area: 0, volume: 0 } }
  for (const zone of sheet.zones) {
    if (!selection.has(zone.id)) continue
    totals[zone.kind].area += zone.area
    totals[zone.kind].volume += zone.volume
  }
  return totals
}

export function describeTotals(totals) {
  return `所选挖方 · 面积 ${formatNumber(totals.cut.area)} m² · 方量 ${formatNumber(totals.cut.volume)} m³ ｜ ` +
    `所选填方 · 面积 ${formatNumber(totals.fill.area)} m² · 方量 ${formatNumber(totals.fill.volume)} m³`
}
