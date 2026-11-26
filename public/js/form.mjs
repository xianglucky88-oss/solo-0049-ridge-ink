export function job(form) {
  const field = new FormData(form)
  let grid
  try { grid = JSON.parse(field.get('grid')) } catch { throw new Error('高程格网需要使用有效的 JSON。') }
  const numbers = names => Object.fromEntries(names.map(name => [name, field.get(name) === '' ? NaN : Number(field.get(name))]))
  const parameters = numbers(['interval','offset'])
  if (!Object.values(parameters).every(Number.isFinite)) throw new Error('请输入有效等高距和参考高程。')
  return { grid, ...parameters,
    bounds: field.get('crop') ? numbers(['left','bottom','right','top']) : null,
    section: field.get('measure') ? numbers(['x1','y1','x2','y2','count']) : null }
}
