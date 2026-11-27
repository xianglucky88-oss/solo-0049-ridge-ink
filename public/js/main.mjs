import { request } from './request.mjs'
import { download } from './download.mjs'
import { job } from './form.mjs'
import { showArtwork, showMeasureSheet } from './artwork.mjs'
import { showLevels } from './levels.mjs'
import { drawProfile } from './profile.mjs'
import { renderZones, selectionTotals, describeTotals } from './zones.mjs'

const q = selector => document.querySelector(selector)
const form = q('form')
let lastJob = null
let current = null
let busy = false
const selection = new Set()
const status = text => { q('#status').textContent = text }

function selectedIds() { return [...selection] }

function updateSelectionUi() {
  if (!current) return
  current.view.highlight(selection)
  for (const item of q('#zones').querySelectorAll('li[data-zone]')) {
    const box = item.querySelector('input')
    if (box) box.checked = selection.has(item.dataset.zone)
  }
  q('#selected-total').textContent = selection.size
    ? describeTotals(selectionTotals(current.sheet, selection))
    : '尚未选片。'
  // Stay enabled so clicking with nothing chosen can explain what to do.
  q('#briefing').disabled = false
}

function toggle(id, checked) {
  if (!current || !current.sheet.zones.some(zone => zone.id === id)) return
  if (checked) selection.add(id)
  else selection.delete(id)
  updateSelectionUi()
}

function resetSelection() {
  selection.clear()
  updateSelectionUi()
}

function renderMeasurement(sheet) {
  q('#measure-sheet').hidden = false
  q('#sheet').hidden = true
  const view = showMeasureSheet(q('#measure-sheet'), sheet.preview ?? sheet.svg)
  const previousId = current?.sheet.sheetId
  // A new grid or crop produces a new sheetId; zone ids from the old sheet no
  // longer apply, so the choice starts empty again. Re-rendering the same sheet
  // keeps what was already picked.
  const carried = previousId === sheet.sheetId ? new Set([...selection].filter(id => sheet.zones.some(zone => zone.id === id))) : new Set()
  current = { sheet, view, viewBox: sheet.viewBox }
  q('#measure-panel').hidden = false
  q('#measure-hint').textContent = `工区 ${sheet.zones.length} 片 · 无需施工 ${Number(sheet.none.area).toFixed(0)} m² · 无法核量 ${Number(sheet.unknown.area).toFixed(0)} m²`
  renderZones(q('#zones'), sheet, carried, toggle)
  q('#briefing').hidden = false
  q('#export').textContent = '导出完整核量图 SVG'
  selection.clear()
  for (const id of carried) selection.add(id)
  updateSelectionUi()
}

function renderContours(sheet) {
  q('#measure-sheet').hidden = true
  q('#measure-sheet').replaceChildren()
  q('#measure-panel').hidden = true
  q('#briefing').hidden = true
  q('#export').textContent = '导出当前图幅 SVG'
  showArtwork(q('#sheet'), sheet.svg)
  current = { sheet, view: null }
  selection.clear()
  q('#selected-total').textContent = '尚未选片。'
}

async function render() {
  if (busy) return
  busy = true
  try {
    const input = job(form)
    status('正在制图…')
    const sheet = await request('sheet', input)
    showLevels(q('#levels'), sheet)
    drawProfile(q('#profile'), sheet.profile)
    const missing = sheet.profile.filter(point => point.z === null).length
    q('#profile-note').textContent = `测线总长 ${sheet.section.length.toFixed(1)} 米 · ${missing} 个缺测点`
    // Any freshly generated sheet starts with an empty selection: zone ids are
    // only meaningful for the sheet they came from.
    if (sheet.design) renderMeasurement(sheet)
    else renderContours(sheet)
    lastJob = input
    q('#export').disabled = false
    status(sheet.design
      ? `预览已更新 · ${sheet.zones.length} 个工区${selection.size ? '' : ' · 请选片后再导出交底图'}`
      : `预览已更新 · ${sheet.faces} 个有效三角面`)
  } catch (error) { status(error.message) }
  finally { busy = false }
}

async function loadDemo() {
  try {
    const grid = await request('demo')
    form.elements.grid.value = JSON.stringify(grid)
    const design = JSON.parse(JSON.stringify(grid))
    // Terrain change that yields several cut and fill zones: a broad swell in
    // the west, a hollow in the east and a gentle wave over the middle.
    design.elevations = design.elevations.map((z, index) => {
      if (z === null) return null
      const x = index % design.width, y = Math.floor(index / design.width)
      const change = 24 * Math.exp(-((x - 7) ** 2 + (y - 13) ** 2) / 30)
        - 22 * Math.exp(-((x - 21) ** 2 + (y - 9) ** 2) / 26)
        + 16 * Math.sin((x - 5) / 2.6) * Math.cos((y - 10) / 2.9)
      return Math.round((z + change) * 10) / 10
    })
    form.elements['design-grid'].value = JSON.stringify(design)
    form.elements.design.checked = true
    q('#design-fields').hidden = false
    await render()
  } catch (error) { status(error.message) }
}

form.onsubmit = event => { event.preventDefault(); render() }
q('#demo').onclick = loadDemo

q('#file').onchange = async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 150000) return status('格网文件超出大小限制。')
  try { form.elements.grid.value = await file.text(); await render() } catch { status('无法打开格网。') }
}

q('#export').onclick = async () => {
  // Full sheet: contour sheet, or the complete measurement sheet with every
  // zone. The briefing download is a separate control.
  try {
    const name = current?.sheet.design ? 'ridge-measure.svg' : 'ridge-sheet.svg'
    download(await request('export', lastJob), name)
  } catch (error) { status(error.message) }
}

q('#briefing').onclick = async () => {
  if (!current?.sheet.design) return
  if (!selection.size) return status('请先选择工区再导出交底图。')
  try {
    const body = { ...lastJob, selection: { sheetId: current.sheet.sheetId, zones: selectedIds() } }
    download(await request('export', body), 'ridge-briefing.svg')
  } catch (error) { status(error.message) }
}

q('#clear-selection').onclick = () => { if (current?.view) resetSelection() }

// Clicking a zone's interior toggles it; clicking none/unknown leaves the
// current selection untouched.
q('#measure-sheet').addEventListener('click', event => {
  const id = current?.view?.hitZone(event)
  if (!id) return
  toggle(id, !selection.has(id))
})

for (const [flag, fields] of [['crop', '#crop-fields'], ['measure', '#section-fields'], ['design', '#design-fields']]) {
  const input = form.elements[flag]
  const update = () => { q(fields).hidden = !input.checked }
  input.onchange = update
  update()
}

await loadDemo()
