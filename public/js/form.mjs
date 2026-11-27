export function job(form) {
  const field = new FormData(form)
  let grid
  try { grid = JSON.parse(field.get('grid')) } catch { throw new Error('高程格网需要使用有效的 JSON。') }
  const numbers = names => Object.fromEntries(names.map(name => [name, field.get(name) === '' ? NaN : Number(field.get(name))]))
  const parameters = numbers(['interval','offset'])
  if (!Object.values(parameters).every(Number.isFinite)) throw new Error('请输入有效等高距和参考高程。')
  const water = waterJob(form, field)
  return { grid, ...parameters,
    bounds: field.get('crop') ? numbers(['left','bottom','right','top']) : null,
    section: field.get('measure') ? numbers(['x1','y1','x2','y2','count']) : null,
    water }
}

// 入水位置以地面坐标保留；未给定水位或未选点时不发起积水分析
export function waterJob(form, field = new FormData(form)) {
  const level = field.get('level') === '' ? NaN : Number(field.get('level'))
  const x = field.get('entryX') === '' ? NaN : Number(field.get('entryX'))
  const y = field.get('entryY') === '' ? NaN : Number(field.get('entryY'))
  if (Number.isNaN(level) && Number.isNaN(x) && Number.isNaN(y)) return null
  if (!Number.isFinite(level)) throw new Error('请输入有效的积水水位。')
  if (![x, y].every(Number.isFinite)) throw new Error('请在图幅上点选入水位置。')
  return { level, x, y }
}

export function showEntry(form, entry) {
  form.elements.entryX.value = entry ? Number(entry.x.toFixed(3)) : ''
  form.elements.entryY.value = entry ? Number(entry.y.toFixed(3)) : ''
  form.querySelector('#clear-entry').disabled = !entry
}
