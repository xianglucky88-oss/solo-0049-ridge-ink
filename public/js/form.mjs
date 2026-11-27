export function job(form) {
  const field = new FormData(form)
  let grid
  try { grid = JSON.parse(field.get('grid')) } catch { throw new Error('现状格网需要使用有效的 JSON。') }
  const numbers = names => Object.fromEntries(names.map(name => [name, field.get(name) === '' ? NaN : Number(field.get(name))]))
  const parameters = numbers(['interval','offset'])
  if (!Object.values(parameters).every(Number.isFinite)) throw new Error('请输入有效等高距和参考高程。')
  const input = { grid, ...parameters,
    bounds: field.get('crop') ? numbers(['left','bottom','right','top']) : null,
    section: field.get('measure') ? numbers(['x1','y1','x2','y2','count']) : null }
  if (field.get('design')) {
    const design = (() => {
      try { return JSON.parse(field.get('design-grid')) } catch { throw new Error('设计格网需要使用有效的 JSON。') }
    })()
    const origin = numbers(['design-left','design-bottom'])
    if (Number.isFinite(origin['design-left'])) design.originX = origin['design-left']
    if (Number.isFinite(origin['design-bottom'])) design.originY = origin['design-bottom']
    input.design = design
  }
  return input
}
