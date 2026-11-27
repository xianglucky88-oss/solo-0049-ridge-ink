import { request } from './request.mjs'
import { download } from './download.mjs'
import { job } from './form.mjs'
import { showArtwork } from './artwork.mjs'
import { showLevels } from './levels.mjs'
import { drawProfile } from './profile.mjs'

const q = selector => document.querySelector(selector)
const form = q('form')
let lastJob, busy = false
let baseKey = ''
let manualLabels = []
const status = text => { q('#status').textContent = text }

// 制图参数变化会重算闭环编号，手动调整只在同一底图内沿用。
function baseSignature(input) {
  return JSON.stringify([input.grid, input.interval, input.offset, input.bounds])
}

async function render() {
  if (busy) return
  busy = true
  try {
    const input = job(form)
    const signature = baseSignature(input)
    if (signature !== baseKey) {
      baseKey = signature
      manualLabels = []
    }
    status('正在制图…')
    const sheet = await request('sheet', { ...input, labels: manualLabels })
    showArtwork(q('#sheet'), sheet.svg, {
      bounds: sheet.bounds,
      onMove: (loopId, point) => commitLabel(loopId, point),
      onStatus: status
    })
    showLevels(q('#levels'), sheet)
    drawProfile(q('#profile'), sheet.profile)
    const missing = sheet.profile.filter(p => p.z === null).length
    q('#profile-note').textContent = `测线总长 ${sheet.section.length.toFixed(1)} 米 · ${missing} 个缺测点`
    lastJob = { ...input, labels: manualLabels }
    q('#export').disabled = false
    const note = sheet.unlabeledLoops ? ` · ${sheet.unlabeledLoops} 个闭环无可用空位` : ''
    status(`预览已更新 · ${sheet.faces} 个有效三角面 · ${sheet.labels.length} 个高程标注${note}`)
  } catch (error) { status(error.message) }
  finally { busy = false }
}

// 落点确认走同一制图接口；失败时保留上次确认的图面与标注。
async function commitLabel(loopId, point) {
  const next = manualLabels.filter(label => label.loopId !== loopId)
  next.push({ loopId, x: point.x, y: point.y })
  const input = job(form)
  const sheet = await request('sheet', { ...input, labels: next })
  manualLabels = next
  lastJob = { ...input, labels: manualLabels }
  showArtwork(q('#sheet'), sheet.svg, {
    bounds: sheet.bounds,
    onMove: (id, drop) => commitLabel(id, drop),
    onStatus: status
  })
  showLevels(q('#levels'), sheet)
  status('标注位置已确认。')
}

async function loadDemo() {
  try {
    form.elements.grid.value = JSON.stringify(await request('demo'))
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
  try { download(await request('export', lastJob), 'ridge-sheet.svg') }
  catch (error) { status(error.message) }
}
for (const [flag, fields] of [['crop', '#crop-fields'], ['measure', '#section-fields']]) {
  const toggle = form.elements[flag]
  const update = () => { q(fields).hidden = !toggle.checked }
  toggle.onchange = update
  update()
}
await loadDemo()
