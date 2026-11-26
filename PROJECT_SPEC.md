# 岭线排图 · 项目规格

小幅地形等高线制图工具。制图师导入规则高程格网，在分片三角网内生成矢量等高线、测线剖面和带制图坐标的 SVG。

## 领域规则

格网为 `{ "width": 2, "height": 2, "unit": 10, "elevations": [0,10,20,30] }`。`elevations` 从南向北逐行排列，同一行从西向东。`null` 表示缺测。每个格子沿西南—东北对角线切成两块，每片只在三顶点均有效时参与制图。

等高线按参考高程与等高距产生最多 100 个高程级。等高点归于该级高侧；精确落在顶点的交点按格点标识去重，其他交点按共享边标识去重。全等高面内部没有线，分岔顶点不自动选相接方向。出图前裁剪路径，选幅内允许最多 200,000 个路径顶点。

剖面等间距采样包含两端点；缺测位置记 `null`。位于边界的样点采相邻有效面，共边插值相同。剖面端点使用整个格网的东、北坐标。SVG 的 x 从选幅西边向东，y 从选幅北边向南；`data-elevation` 保存该线高程。

## 接口

`GET /api/ridge-ink/demo` 返回格网。`POST /api/ridge-ink/sheet` 接收 `grid`、`interval`、`offset` 以及可选 `bounds`、`section`，返回图幅 SVG、分级路径数和剖面。`POST /api/ridge-ink/export` 使用相同输入下载 SVG。

## 模块

- `server/http` 负责输入边界及输出媒体类型。
- `server/terrain` 负责高程格网、相邻面和三角插值。
- `server/contour` 负责等高交点与路径连通。
- `server/profile` 负责测线长度、采样和缺测。
- `server/sheet` 负责选幅、裁剪与矢量制图。
- `public/js` 负责制图编辑、预览和下载。

## 验证

`npm run build` 检查 ECMAScript 模块语法及服务装载。`.project-runtime.json` 记录可复跑的有界生产工作流检查。自动化测试套件留待后续。
