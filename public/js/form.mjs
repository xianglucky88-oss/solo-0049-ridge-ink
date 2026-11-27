export function job(form) {
  const field = new FormData(form)
  let grid
  try { grid = JSON.parse(field.get('grid')) } catch { throw new Error('高程格网需要使用有效的 JSON。') }
  const numbers = names => Object.fromEntries(names.map(name => [name, field.get(name) === '' ? NaN : Number(field.get(name))]))
  const parameters = numbers(['interval','offset'])
  if (!Object.values(parameters).every(Number.isFinite)) throw new Error('请输入有效等高距和参考高程。')

  let sheets = null
  if (field.get('group')) {
    const text = field.get('sheets')
    let parsed
    try { parsed = JSON.parse(text) } catch { throw new Error('分幅组需要是有效的 JSON 数组。') }
    if (Array.isArray(parsed)) sheets = parsed
    else if (parsed && typeof parsed === 'object') sheets = parsed
    else throw new Error('分幅组应是图幅对象组成的 JSON 数组。')
  }

  return { grid, ...parameters,
    sheets,
    bounds: !field.get('group') && field.get('crop') ? numbers(['left','bottom','right','top']) : null,
    section: field.get('measure') ? numbers(['x1','y1','x2','y2','count']) : null }
}

// 依据当前格网的制图范围生成一个含 T 字接点的三分幅示例。
export function tLayoutFor(form) {
  let grid
  try { grid = JSON.parse(new FormData(form).get('grid')) } catch { throw new Error('请先提供有效的高程格网。') }
  if (!grid || !Number.isInteger(grid.width) || !Number.isInteger(grid.height) || !Number.isFinite(grid.unit)) {
    throw new Error('格网缺少 width / height / unit。')
  }
  const right = (grid.width - 1) * grid.unit
  const top = (grid.height - 1) * grid.unit
  const x = Number((right * 0.56).toFixed(3))
  const y = Number((top * 0.5).toFixed(3))
  return [
    { id: 'west', name: '西大幅', left: 0, bottom: 0, right: x, top },
    { id: 'ne', name: '东北幅', left: x, bottom: y, right, top },
    { id: 'se', name: '东南幅', left: x, bottom: 0, right, top: y }
  ]
}
