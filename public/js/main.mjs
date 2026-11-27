import { request } from './request.mjs'
import { download } from './download.mjs'
import { job, showEntry } from './form.mjs'
import { showArtwork } from './artwork.mjs'
import { showLevels } from './levels.mjs'
import { drawProfile } from './profile.mjs'
import { pickGround } from './pick.mjs'

const q = selector => document.querySelector(selector)
const form = q('form')
let lastJob, busy = false
let entry = null
let currentBounds = null
const status = text => { q('#status').textContent = text }

async function render() {
  if (busy) return
  busy = true
  try {
    const input = job(form)
    status('正在制图…')
    const sheet = await request('sheet', input)
    showArtwork(q('#sheet'), sheet.svg)
    showLevels(q('#levels'), sheet)
    drawProfile(q('#profile'), sheet.profile)
    const missing = sheet.profile.filter(p => p.z === null).length
    q('#profile-note').textContent = `测线总长 ${sheet.section.length.toFixed(1)} 米 · ${missing} 个缺测点`
    currentBounds = sheet.bounds
    if (sheet.water) {
      const inView = sheet.water.entry.x >= sheet.bounds.left && sheet.water.entry.x <= sheet.bounds.right &&
        sheet.water.entry.y >= sheet.bounds.bottom && sheet.water.entry.y <= sheet.bounds.top
      q('#water-note').textContent =
        `水位 ${sheet.water.level} 米 · 连通 ${sheet.water.faces} 个低洼三角面` +
        (inView ? '' : ' · 入水点在当前图幅之外，范围仍按全格网计算并填色')
    } else {
      q('#water-note').textContent = ''
    }
    lastJob = input
    // 只有服务端确认有效的入水位置才保留，保证缩小图幅后重发的始终是合法地面坐标
    entry = sheet.water ? { x: sheet.water.entry.x, y: sheet.water.entry.y } : null
    showEntry(form, entry)
    q('#export').disabled = false
    status(`预览已更新 · ${sheet.faces} 个有效三角面`)
  } catch (error) {
    status(error.message)
    // 本次取点被拒绝时，只读坐标框恢复为上一个仍有效的入水位置
    showEntry(form, entry)
  }
  finally { busy = false }
}

async function loadDemo() {
  try {
    form.elements.grid.value = JSON.stringify(await request('demo'))
    await render()
  } catch (error) { status(error.message) }
}

function onPick(event) {
  if (!currentBounds) return
  const levelValue = form.elements.level.value
  if (levelValue === '' || !Number.isFinite(Number(levelValue))) {
    return status('请先给定积水水位，再点选入水位置。')
  }
  const point = pickGround(q('#sheet'), currentBounds, event)
  if (!point) return status('点击落在图面留白处，无法作为入水位置，请在图幅内重新选点。')
  // 先填入候选坐标；render 成功后才会真正保留，失败时 catch 恢复上一个有效起点
  showEntry(form, point)
  render()
}

form.onsubmit = event => { event.preventDefault(); render() }
q('#demo').onclick = loadDemo
q('#sheet').onclick = onPick
q('#clear-entry').onclick = () => {
  entry = null
  form.elements.level.value = ''
  showEntry(form, null)
  q('#water-note').textContent = ''
  status('已清除入水位置。')
  render()
}
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
// 水位手动修改后，若已保留入水位置则重新分析；入水位置本身始终按地面坐标保留
form.elements.level.onchange = () => {
  if (entry) showEntry(form, entry)
}
await loadDemo()
