export function showLevels(list, sheet) {
  const visible = sheet.levels.filter(level => level.paths)
  const rows = visible.map(({ height, paths, loops }) => {
    const item = document.createElement('li')
    const key = document.createElement('strong')
    key.textContent = `${Number(height.toFixed(3))} 米`
    item.append(key, ` ${paths} 条线 · ${loops} 条闭线`)
    return item
  })
  if (!rows.length) {
    const empty = document.createElement('li')
    empty.textContent = '选幅内没有等高线。'
    rows.push(empty)
  }
  list.replaceChildren(...rows)
}
