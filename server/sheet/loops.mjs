// 从连通路径中识别完整独立的闭环：首尾相接、全程节点均为二度，
// 且裁剪后仍在图幅内保持闭合。经过分岔点或被图框切开的线不算闭环。

function isClosedLine(line) {
  return Boolean(line[0].id) && line[0].id === line.at(-1).id
}

// 度 = 该节点在同级线段中关联的边数；经过分岔点的闭环会出现度不为 2 的节点。
function nodeDegree(lines) {
  const degree = new Map()
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      for (const point of [line[i - 1], line[i]]) {
        if (point.id) degree.set(point.id, (degree.get(point.id) ?? 0) + 1)
      }
    }
  }
  return degree
}

function passesBranch(line, degree) {
  for (let i = 0; i < line.length - 1; i++) {
    if (degree.get(line[i].id) !== 2) return true
  }
  return false
}

function chunkClosed(chunk) {
  return chunk.length > 1 && Boolean(chunk[0].id) && chunk[0].id === chunk.at(-1).id
}

// 输入同级的原始路径与每条路径的裁剪结果，返回带闭环标记的线。
export function classifyLines(rawLines, clippedChunks) {
  const degree = nodeDegree(rawLines)
  const lines = []
  rawLines.forEach((raw, index) => {
    const independent = isClosedLine(raw) && !passesBranch(raw, degree)
    for (const chunk of clippedChunks[index]) {
      lines.push({ points: chunk, loopId: null, closed: independent && chunkClosed(chunk) })
    }
  })
  return lines
}

// 按高程、环上最小节点标识给出全局确定的闭环编号。
export function assignLoopIds(layers) {
  const loops = []
  for (const layer of layers) {
    for (const line of layer.lines) {
      if (!line.closed) continue
      const ids = line.points.slice(0, -1).map(point => point.id).sort()
      loops.push({ line, height: layer.height, key: [layer.height, ids[0], ids.join('|')].join('~') })
    }
  }
  loops.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  loops.forEach((item, index) => { item.line.loopId = `L${index}` })
  return loops.map(item => item.line.loopId)
}
