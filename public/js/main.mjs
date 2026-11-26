import { request } from './request.mjs'
import { download } from './download.mjs'
import { job } from './form.mjs'
import { showArtwork } from './artwork.mjs'
import { showLevels } from './levels.mjs'
import { drawProfile } from './profile.mjs'

const q = selector => document.querySelector(selector)
const form = q('form')
let lastJob, busy = false
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
    lastJob = input
    q('#export').disabled = false
    status(`预览已更新 · ${sheet.faces} 个有效三角面`)
  } catch (error) { status(error.message) }
  finally { busy = false }
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
