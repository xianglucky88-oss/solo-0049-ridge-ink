import { request } from './request.mjs'
import { download } from './download.mjs'
import { job, tLayoutFor } from './form.mjs'
import { showArtwork } from './artwork.mjs'
import { showLevels } from './levels.mjs'
import { drawProfile } from './profile.mjs'

const q = selector => document.querySelector(selector)
const form = q('form')

// 唯一的“最后确认成功的一组”。切换图幅与所有下载都只从这里取图形与设置，
// 表单里尚未提交/提交失败的调整不会影响预览和补导。
let confirmed = null
let view = 'all'
let busy = false

const status = text => { q('#status').textContent = text }
const svgBlob = svg => new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
const safeName = value => String(value ?? 'sheet').replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 60) || 'sheet'

function sheetViews(result) {
  return result?.mode === 'atlas' ? result.sheets : []
}

function currentSvg() {
  const { result } = confirmed
  const sheets = sheetViews(result)
  if (typeof view === 'number' && sheets[view]) return sheets[view].svg
  return result.svg
}

function currentFilename() {
  const { result } = confirmed
  const sheets = sheetViews(result)
  if (typeof view === 'number' && sheets[view]) {
    const s = sheets[view]
    return `ridge-sheet-${view + 1}-${safeName(s.id)}.svg`
  }
  return result.mode === 'atlas' ? 'ridge-atlas.svg' : 'ridge-sheet.svg'
}

function renderTabs() {
  const bar = q('#sheet-tabs')
  const { result } = confirmed
  const tabs = []
  if (result.mode === 'atlas') tabs.push({ key: 'all', label: '整组拼版' })
  for (const s of sheetViews(result)) tabs.push({ key: s.index, label: s.label || s.id || `第 ${s.index + 1} 幅` })
  if (result.mode !== 'atlas') { bar.replaceChildren(); bar.hidden = true; return }
  bar.hidden = false
  bar.replaceChildren(...tabs.map(tab => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'tab' + (tab.key === view ? ' active' : '')
    button.setAttribute('role', 'tab')
    button.dataset.key = String(tab.key)
    button.textContent = tab.label
    button.onclick = () => {
      view = tab.key === 'all' ? 'all' : Number(tab.key)
      renderView()
    }
    return button
  }))
}

function renderView() {
  const { result } = confirmed
  const sheets = sheetViews(result)
  let levels = result.levels
  let heading = '图幅'
  if (typeof view === 'number' && sheets[view]) {
    const s = sheets[view]
    levels = s.levels
    heading = `图幅 · ${s.label || s.id}`
    q('#sheet').alt = `${s.label || s.id} 的地形等高线`
  } else if (result.mode === 'atlas') {
    heading = `整组拼版 · ${result.sheetCount} 幅`
    q('#sheet').alt = '整组图幅拼在一起的地形等高线'
  } else {
    q('#sheet').alt = '当前图幅的地形等高线'
  }
  q('#sheet-heading').textContent = heading
  showArtwork(q('#sheet'), currentSvg())
  showLevels(q('#levels'), { levels })
  for (const button of q('#sheet-tabs').querySelectorAll('.tab')) {
    const key = button.dataset.key === 'all' ? 'all' : Number(button.dataset.key)
    button.classList.toggle('active', key === view)
  }
}

function renderConfirmedExtras() {
  const { result } = confirmed
  drawProfile(q('#profile'), result.profile)
  const missing = result.profile.filter(p => p.z === null).length
  q('#profile-note').textContent = `测线总长 ${result.section.length.toFixed(1)} 米 · ${missing} 个缺测点`
  q('#export').disabled = false
  q('#export-all').disabled = result.mode !== 'atlas'
  const note = q('#confirmed-note')
  note.hidden = true
  note.textContent = ''
}

async function render() {
  if (busy) return
  busy = true
  let input
  try { input = job(form) }
  catch (error) {
    status(error.message)
    if (confirmed) {
      const note = q('#confirmed-note')
      note.textContent = `设置未能解析；下方预览与下载仍为上一次确认的${confirmed.result.mode === 'atlas' ? `整组 ${confirmed.result.sheetCount} 幅` : '图幅'}。`
      note.hidden = false
    }
    busy = false
    return
  }
  status('正在制图…')
  try {
    const result = await request('sheet', input)
    if (result.mode === 'atlas' && (view === 'all' || !(typeof view === 'number' && result.sheets[view]))) view = 'all'
    confirmed = { input, result }
    renderTabs()
    renderView()
    renderConfirmedExtras()
    q('#confirmed-note').hidden = true
    status(result.mode === 'atlas'
      ? `已确认整组 ${result.sheetCount} 幅 · ${result.faces} 个有效三角面 · 各幅均在顶点上限内`
      : `预览已更新 · ${result.faces} 个有效三角面`)
  } catch (error) {
    status(error.message)
    if (confirmed) {
      const note = q('#confirmed-note')
      note.textContent = `这些调整尚未确认成功；下方预览与下载仍为上一次确认的${confirmed.result.mode === 'atlas' ? `整组 ${confirmed.result.sheetCount} 幅` : '图幅'}。`
      note.hidden = false
      q('#export').disabled = false
      q('#export-all').disabled = confirmed.result.mode !== 'atlas'
    }
  } finally { busy = false }
}

async function loadDemo() {
  try {
    form.elements.grid.value = JSON.stringify(await request('demo'))
    await render()
  } catch (error) { status(error.message) }
}

async function exportCurrent() {
  if (!confirmed) return
  const { input, result } = confirmed
  const sheets = sheetViews(result)
  const activeSingle = typeof view === 'number' && sheets[view]
  const filename = activeSingle
    ? `ridge-sheet-${view + 1}-${safeName(sheets[view].id)}.svg`
    : currentFilename()
  try {
    const payload = activeSingle ? { ...input, sheetIndex: view } : input
    download(await request('export', payload), filename)
  } catch (error) {
    download(svgBlob(currentSvg()), filename)
    status(`在线补导未成功，已下载上次确认的图形（${error.message}）`)
  }
}

async function exportAll() {
  if (!confirmed) return
  const { input, result } = confirmed
  if (result.mode !== 'atlas') { exportCurrent(); return }
  try {
    download(await request('export-all', input), 'ridge-atlas.svg')
  } catch (error) {
    download(svgBlob(result.svg), 'ridge-atlas.svg')
    status(`整组在线导出未成功，已下载上次确认的整组 SVG（${error.message}）`)
  }
}

form.onsubmit = event => { event.preventDefault(); render() }
q('#demo').onclick = loadDemo
q('#export').onclick = exportCurrent
q('#export-all').onclick = exportAll
q('#make-t').onclick = () => {
  try {
    form.elements.sheets.value = JSON.stringify(tLayoutFor(form), null, 2)
    form.elements.group.checked = true
    q('#group-fields').hidden = false
    status('已按当前格网生成 T 形三分幅，点击“更新图幅”确认。')
  } catch (error) { status(error.message) }
}
q('#file').onchange = async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 150000) return status('格网文件超出大小限制。')
  try { form.elements.grid.value = await file.text(); await render() } catch { status('无法打开格网。') }
}
for (const [flag, fields] of [['group', '#group-fields'], ['crop', '#crop-fields'], ['measure', '#section-fields']]) {
  const toggle = form.elements[flag]
  const update = () => { q(fields).hidden = !toggle.checked }
  toggle.onchange = update
  update()
}
// 分幅组与单幅裁剪互斥：启用一组时收起并取消单幅。
form.elements.group.onchange = () => {
  q('#group-fields').hidden = !form.elements.group.checked
  if (form.elements.group.checked) {
    form.elements.crop.checked = false
    q('#crop-fields').hidden = true
  }
}
form.elements.crop.onchange = () => {
  q('#crop-fields').hidden = !form.elements.crop.checked
  if (form.elements.crop.checked) {
    form.elements.group.checked = false
    q('#group-fields').hidden = true
  }
}
await loadDemo()
