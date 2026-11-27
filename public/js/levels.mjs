export function showLevels(list, sheet) {
  const rows = sheet.levels.map(({ height, paths, loops, labels }) => {
    const item = document.createElement('li')
    const key = document.createElement('strong')
    key.textContent = `${Number(height.toFixed(3))} 米`
    item.append(key, ` ${paths} 条线 · ${loops} 条独立闭环 · ${labels} 个标注`)
    return item
  })
  if (!rows.length) {
    const empty = document.createElement('li')
    empty.textContent = '选幅内没有等高线。'
    rows.push(empty)
  }
  list.replaceChildren(...rows)
}
