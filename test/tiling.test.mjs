import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compose, selectSheet } from '../server/sheet/compose.mjs'
import { composeAtlas } from '../server/sheet/atlas.mjs'
import { clipPath } from '../server/sheet/clip-path.mjs'
import { findSheetIndex, normalizeSheets, edgePolicies } from '../server/sheet/sheets.mjs'
import { demo } from '../server/terrain/demo.mjs'

const unitGrid = (elevations, width = 2, height = 2) => ({ width, height, unit: 1, elevations })

test('既有单幅行为与分级路径数保持不变', () => {
  const a = compose({ grid: unitGrid([0, 10, 10, 20]), interval: 5 })
  assert.ok(a.levels.some(x => x.height === 10 && x.paths === 1))
  const crop = compose({ grid: demo(), bounds: { left: 40, bottom: 40, right: 450, top: 370 } })
  assert.match(crop.svg, /viewBox="0 0 410 330"/)
  const data = { grid: demo() }
  assert.equal(compose(data).svg, compose(data).svg)
  assert.match(compose(data).svg, /data-elevation/)
})

test('生成一组相邻图幅，每幅有独立 SVG、边界与分级路径数', () => {
  const sheets = [
    { id: 'W', left: 0, bottom: 0, right: 300, top: 420 },
    { id: 'NE', left: 300, bottom: 210, right: 540, top: 420 },
    { id: 'SE', left: 300, bottom: 0, right: 540, top: 210 }
  ]
  const r = compose({ grid: demo(), sheets })
  assert.equal(r.mode, 'atlas')
  assert.equal(r.sheets.length, 3)
  assert.match(r.svg, /<svg/)
  for (const s of r.sheets) {
    assert.match(s.svg, /viewBox="0 0 /)
    assert.ok(Array.isArray(s.levels))
    assert.ok(s.vertices <= 200000)
  }
  assert.equal(r.svg, compose({ grid: demo(), sheets }).svg)
})

test('相邻竖边（含 T 字接点）两侧线端落在完全相同的制图坐标', () => {
  const line = [{ x: -5, y: 9 }, { x: 25, y: 6 }] // 穿过 x=10, y=7.5
  const big = { left: 0, bottom: 0, right: 10, top: 20 }
  const low = { left: 10, bottom: 0, right: 20, top: 10 }
  const high = { left: 10, bottom: 10, right: 20, top: 20 }
  const bigEnd = clipPath(line, big).at(-1).at(-1)
  const lowStart = clipPath(line, low)[0][0]
  assert.equal(bigEnd.x, 10)
  assert.equal(bigEnd.x, lowStart.x)
  assert.equal(bigEnd.y, lowStart.y)
  // 只蹭到上角尖的另一小幅不得产出任何线段。
  assert.deepEqual(clipPath(line, high), [])
})

test('横边两侧线端坐标一致', () => {
  const line = [{ x: 2, y: -5 }, { x: 8, y: 25 }] // 穿过 y=10
  const south = { left: 0, bottom: 0, right: 10, top: 10 }
  const north = { left: 0, bottom: 10, right: 10, top: 20 }
  const sEnd = clipPath(line, south).at(-1).at(-1)
  const nStart = clipPath(line, north)[0][0]
  assert.equal(sEnd.y, 10)
  assert.equal(sEnd.x, nStart.x)
  assert.equal(sEnd.y, nStart.y)
})

test('角尖轻蹭（含浮点扰动）不产生短线或假接点', () => {
  const b = { left: 0, bottom: 0, right: 10, top: 10 }
  assert.deepEqual(clipPath([{ x: 5, y: -5 }, { x: 15, y: 5 }], b), [])
  assert.deepEqual(clipPath([{ x: 5, y: -5 + 1e-14 }, { x: 15, y: 5 + 1e-14 }], b), [])
  assert.deepEqual(clipPath([
    { x: 5, y: -5, id: 'a' }, { x: 10, y: 0, id: 'c' }, { x: 15, y: -5, id: 'b' }
  ], b), [])
  // 真正从角进入幅内的线仍保留。
  assert.equal(clipPath([{ x: -1, y: -1 }, { x: 5, y: 5 }], b).length, 1)
})

test('沿共边的等高线：竖边归西幅、横边归南幅（整组 compose 验证）', () => {
  // z=10x 的线性坡：15 米等高线是 x=1.5 的竖直线。
  const vElev = []
  for (let y = 0; y < 3; y++) vElev.push(0, 10, 20, 30)
  const vertical = composeAtlas(
    { grid: { width: 4, height: 3, unit: 1, elevations: vElev }, interval: 10, offset: 5 },
    [{ id: 'W', left: 0, bottom: 0, right: 1.5, top: 2 }, { id: 'E', left: 1.5, bottom: 0, right: 3, top: 2 }])
  assert.equal(vertical.sheets[0].contours.find(l => l.height === 15).paths.length, 1)
  assert.equal(vertical.sheets[1].contours.find(l => l.height === 15).paths.length, 0)

  // z=10y：15 米等高线是 y=1.5 的水平线，归南幅。
  const hElev = []
  for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) hElev.push(y * 10)
  const horizontal = composeAtlas(
    { grid: { width: 3, height: 4, unit: 1, elevations: hElev }, interval: 10, offset: 5 },
    [{ id: 'S', left: 0, bottom: 0, right: 2, top: 1.5 }, { id: 'N', left: 0, bottom: 1.5, right: 2, top: 3 }])
  assert.equal(horizontal.sheets[0].contours.find(l => l.height === 15).paths.length, 1)
  assert.equal(horizontal.sheets[1].contours.find(l => l.height === 15).paths.length, 0)
})

test('覆盖感知策略：未被邻幅共用的沿边段仍由本幅保留', () => {
  const surface = { right: 20, top: 20 }
  const sheets = normalizeSheets(surface, [
    { id: 'W', left: 0, bottom: 10, right: 10, top: 20 },
    { id: 'E', left: 10, bottom: 0, right: 20, top: 20 }])
  const policy = edgePolicies(sheets, surface)[1]
  const line = [{ x: 10, y: 3 }, { x: 10, y: 17 }]
  // 西邻幅只覆盖 y=10..20，故 y=3..10 留下，y=10..17 让出。
  const chunks = clipPath(line, sheets[1].bounds, policy)
  assert.equal(chunks.length, 1)
  assert.deepEqual(chunks[0].map(p => [p.x, p.y]), [[10, 3], [10, 10]])
})

test('内部重叠的图幅组被拒绝并点名相关图幅', () => {
  assert.throws(() => compose({ grid: demo(), sheets: [
    { id: 'A', left: 0, bottom: 0, right: 300, top: 300 },
    { name: '东块', left: 200, bottom: 100, right: 540, top: 420 }
  ] }), error => error.status === 400 &&
    /第 1 幅“A”/.test(error.message) && /第 2 幅“东块”/.test(error.message) &&
    error.issues.some(i => i.kind === 'overlap'))
})

test('边界无效与重复标识都聚合成带序号的问题', () => {
  assert.throws(() => normalizeSheets({ right: 10, top: 10 }, [
    { id: 'A', left: 0, bottom: 0, right: 99, top: 10 }]), /第 1 幅/)
  assert.throws(() => normalizeSheets({ right: 10, top: 10 }, [
    { id: 'X', left: 0, bottom: 0, right: 5, top: 10 },
    { id: 'X', left: 5, bottom: 0, right: 10, top: 10 }]), /重复/)
})

test('findSheetIndex 支持 id、名称与 0 基序号', () => {
  const sheets = [{ id: 'w', name: '西', index: 0 }, { id: 'e', name: '东', index: 1 }]
  assert.equal(findSheetIndex(sheets, 'e'), 1)
  assert.equal(findSheetIndex(sheets, '西'), 0)
  assert.equal(findSheetIndex(sheets, 1), 1)
  assert.equal(findSheetIndex(sheets, '0'), 0)
  assert.equal(findSheetIndex(sheets, 'zzz'), -1)
})

test('selectSheet 对无效选择器抛 404', () => {
  const r = compose({ grid: demo(), sheets: [{ id: 'a', left: 0, bottom: 0, right: 270, top: 420 }, { id: 'b', left: 270, bottom: 0, right: 540, top: 420 }] })
  assert.equal(selectSheet(r, { sheet: 'b' }).index, 1)
  assert.throws(() => selectSheet(r, { sheet: 'nope' }), e => e.status === 404)
})

test('整块过密时逐幅判定，超限信息点名图幅', () => {
  const W = 100, H = 100, z = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    z.push(Math.round(2000 * Math.sin(x * 0.9) * Math.cos(y * 0.7) + 1500 * ((x * 13 + y * 7) % 17)))
  }
  const grid = { width: W, height: H, unit: 10, elevations: z }
  assert.throws(() => compose({ grid, interval: 300 }), e => e.status === 422)
  assert.throws(() => compose({ grid, interval: 300, sheets: [
    { id: 'big', left: 0, bottom: 0, right: 495, top: 990 }
  ] }), e => e.status === 422 && /第 1 幅“big”/.test(e.message) && Array.isArray(e.issues))
})
