import { InputError } from '../http/error.mjs'
import { sheetBounds } from './bounds.mjs'

export const SHEET_VERTEX_LIMIT = 200000
const MAX_SHEETS = 100

// 接受多种图幅写法，统一抽出边界：
//  {left,bottom,right,top} | {bounds:{...}} | {bounds:[l,b,r,t]} |
//  [left,bottom,right,top] | {x,y,width,height}
export function readBoundsSpec(item) {
  if (Array.isArray(item)) {
    const [left, bottom, right, top] = item
    return { left, bottom, right, top }
  }
  if (item && typeof item === 'object') {
    if (item.bounds && typeof item.bounds === 'object') {
      if (Array.isArray(item.bounds)) {
        const [left, bottom, right, top] = item.bounds
        return { left, bottom, right, top }
      }
      return item.bounds
    }
    if (item.left != null || item.right != null || item.bottom != null || item.top != null) return item
    if (item.x != null && item.width != null) {
      return { left: item.x, bottom: item.y ?? 0, right: item.x + item.width, top: (item.y ?? 0) + item.height }
    }
  }
  return item
}

export function sheetIdentity(item, index) {
  const object = item && typeof item === 'object' && !Array.isArray(item) ? item : null
  const provided = object
    ? (object.id ?? object.key ?? object.code ?? object.name ?? object.label ?? object.title)
    : undefined
  const customKey = provided != null && String(provided).trim() !== '' ? String(provided) : undefined
  const explicitId = object ? (object.id ?? object.key ?? object.code) : undefined
  const id = explicitId != null && String(explicitId).trim() !== ''
    ? String(explicitId)
    : (customKey ?? `sheet-${index + 1}`)
  const name = object ? (object.name ?? object.label ?? object.title ?? customKey) : undefined
  return { id, name: name != null ? String(name) : undefined, customKey, index,
    label: name != null ? String(name) : (customKey ?? `第 ${index + 1} 幅`) }
}

// 错误信息里的点名方式：始终带序号，并在用户给了标识/名称时带上原值。
export function sheetTag(sheet) {
  return `第 ${sheet.index + 1} 幅${sheet.customKey ? `“${sheet.customKey}”` : ''}`
}

// 从输入中找到图幅数组；找不到返回 null（走单幅逻辑）。
export function readSheetList(input) {
  if (Array.isArray(input?.sheets)) return input.sheets
  if (input?.sheets && typeof input.sheets === 'object') {
    return Object.entries(input.sheets).map(([id, value]) => ({ id, ...(value && typeof value === 'object' ? value : {}) }))
  }
  if (Array.isArray(input?.sheet)) return input.sheet
  for (const key of ['sheetSet', 'set', 'tiles', 'frames', 'pages', 'panels', 'plates', 'atlasSheets', 'layout']) {
    const value = input?.[key]
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.sheets)) return value.sheets
  }
  if (Array.isArray(input?.bounds)) {
    // 元素是对象/数组时视为多幅列表；纯数字数组则是单幅的 [左,南,东,北] 写法。
    const first = input.bounds[0]
    if (first && typeof first === 'object') return input.bounds
    return null
  }
  return null
}

function overlapEps(surface) {
  return 1e-9 * Math.max(1, surface.right, surface.top)
}

// 校验并归一化一组图幅。任何一幅边界无效、id 重复或两幅内部面积重叠，
// 都聚合成一次 400，并在 issues / 错误信息里点名受影响图幅。
export function normalizeSheets(surface, list) {
  if (!Array.isArray(list)) throw new InputError('分幅组需要是图幅数组。')
  if (!list.length) throw new InputError('分幅组至少需要一张图幅。')
  if (list.length > MAX_SHEETS) throw new InputError(`一次最多编排 ${MAX_SHEETS} 张图幅。`)

  const issues = []
  const sheets = []
  const ids = new Map()

  list.forEach((item, index) => {
    const identity = sheetIdentity(item, index)
    let bounds = null
    try {
      bounds = sheetBounds(surface, readBoundsSpec(item))
    } catch (error) {
      issues.push({ kind: 'bounds', index, id: identity.id, label: identity.label,
        message: `${sheetTag(identity)}边界无效：${error.message}` })
    }
    const rawId = item && typeof item === 'object' && !Array.isArray(item)
      ? (item.id ?? item.key ?? item.code)
      : undefined
    if (rawId != null && String(rawId).trim() !== '') {
      const key = String(rawId)
      if (ids.has(key)) issues.push({ kind: 'duplicate-id', index, id: key, label: identity.label,
        message: `${sheetTag(identity)}的图幅标识 “${key}” 与前面的图幅重复。` })
      else ids.set(key, index)
    }
    sheets.push({ ...identity, bounds })
  })

  const eps = overlapEps(surface)
  for (let i = 0; i < sheets.length; i++) {
    for (let j = i + 1; j < sheets.length; j++) {
      const a = sheets[i].bounds, b = sheets[j].bounds
      if (!a || !b) continue
      const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const overlapHeight = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom)
      if (overlapWidth > eps && overlapHeight > eps) {
        const message = `${sheetTag(sheets[i])}与${sheetTag(sheets[j])}内部重叠，相邻图幅只能共用一截边。`
        issues.push({ kind: 'overlap', indexes: [i, j], ids: [sheets[i].id, sheets[j].id], message })
      }
    }
  }

  if (issues.length) {
    const error = new InputError(issues.map(issue => issue.message).join(' '), 400)
    error.issues = issues
    throw error
  }
  return sheets
}

const approx = (a, b, eps) => Math.abs(a - b) <= eps

// 为每幅生成左、底共边的邻幅覆盖区间。
// policy.left: 该幅左边 x=left 上，被西侧图幅右边覆盖的 y 区间集合；
// policy.bottom: 该幅底边 y=bottom 上，被南侧图幅顶边覆盖的 x 区间集合。
export function edgePolicies(sheets, surface) {
  const eps = overlapEps(surface)
  return sheets.map(sheet => {
    const b = sheet.bounds
    const left = []
    const bottom = []
    for (const other of sheets) {
      if (other === sheet) continue
      const o = other.bounds
      // 西邻幅：other.right ≈ b.left 且确实在西侧。
      if (approx(o.right, b.left, eps) && o.left < b.left - eps) {
        left.push([o.bottom, o.top])
      }
      // 南邻幅：other.top ≈ b.bottom 且确实在南侧。
      if (approx(o.top, b.bottom, eps) && o.bottom < b.bottom - eps) {
        bottom.push([o.left, o.right])
      }
    }
    return { left, bottom }
  })
}

// 非抛出式校验：返回 { valid, sheets, issues }，供需要逐幅标注而不中断的调用方。
export function inspectSheets(surface, list) {
  try {
    const sheets = normalizeSheets(surface, list)
    return { valid: true, sheets, issues: [] }
  } catch (error) {
    if (error instanceof InputError && Array.isArray(error.issues)) return { valid: false, sheets: [], issues: error.issues }
    throw error
  }
}

// 按 id / 名称 / 序号找到指定图幅；找不到返回 -1。数字与数字字符串按 0 基序号。
export function findSheetIndex(sheets, selector) {
  if (selector == null) return -1
  if (typeof selector === 'number') {
    return Number.isInteger(selector) && selector >= 0 && selector < sheets.length ? selector : -1
  }
  const key = String(selector)
  let index = sheets.findIndex(s => s.id === key)
  if (index >= 0) return index
  index = sheets.findIndex(s => s.name === key || s.label === key)
  if (index >= 0) return index
  if (/^\d+$/.test(key)) {
    const zeroBased = Number(key)
    if (zeroBased >= 0 && zeroBased < sheets.length) return zeroBased
  }
  return -1
}
