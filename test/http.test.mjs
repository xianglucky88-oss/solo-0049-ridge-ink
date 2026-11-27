import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../server/app.mjs'
import { demo } from '../server/terrain/demo.mjs'

const baseInput = () => ({
  grid: demo(),
  sheets: [
    { id: 'W', left: 0, bottom: 0, right: 300, top: 420 },
    { id: 'E1', left: 300, bottom: 0, right: 540, top: 210 },
    { id: 'E2', left: 300, bottom: 210, right: 540, top: 420 }
  ]
})

async function withServer(run) {
  const server = createApp()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  try { await run(`http://127.0.0.1:${port}`) } finally { await new Promise(r => server.close(r)) }
}

test('HTTP: /sheet 给整组，/sheet/<id> 给单张，export 整组与单张 SVG 完全对应', async () => {
  await withServer(async base => {
    const res = await fetch(`${base}/api/ridge-ink/sheet`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(baseInput())
    })
    assert.equal(res.status, 200)
    const atlas = await res.json()
    assert.equal(atlas.sheets.length, 3)

    const one = await (await fetch(`${base}/api/ridge-ink/sheet/E2`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(baseInput())
    })).json()
    assert.equal(one.id, 'E2')
    assert.equal(one.svg, atlas.sheets.find(s => s.id === 'E2').svg)

    const allSvg = await (await fetch(`${base}/api/ridge-ink/export`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(baseInput())
    })).text()
    assert.ok(allSvg.startsWith('<svg'))
    assert.equal(allSvg, atlas.svg)

    const oneSvgRes = await fetch(`${base}/api/ridge-ink/export/E1`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(baseInput())
    })
    assert.match(oneSvgRes.headers.get('content-type'), /image\/svg\+xml/)
    const oneSvg = await oneSvgRes.text()
    assert.equal(oneSvg, atlas.sheets.find(s => s.id === 'E1').svg)
  })
})

test('HTTP: 重叠图幅返回 400 与受影响图幅 issues；未知选择器 404', async () => {
  await withServer(async base => {
    const bad = baseInput()
    bad.sheets = [
      { id: 'A', left: 0, bottom: 0, right: 300, top: 300 },
      { id: 'B', left: 200, bottom: 100, right: 540, top: 420 }]
    const res = await fetch(`${base}/api/ridge-ink/sheet`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bad)
    })
    assert.equal(res.status, 400)
    const body = await res.json()
    assert.match(body.error, /A/)
    assert.equal(body.issues[0].kind, 'overlap')

    const r404 = await fetch(`${base}/api/ridge-ink/export-sheet`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseInput(), sheet: 'missing' })
    })
    assert.equal(r404.status, 404)
  })
})
