# Changelog

## v1.1.1 — 2026-10-19

- 新增 `ping` 命令行诊断：打印节点分配的 ping 任务、`public:queryMetrics` 返回的序列/点数与 `/api/records/ping` 的原始记录条数。
- ping 指标查询失败时自动退回旧键 `ping.latency_ms` / `ping.loss`（不再依赖 `ping.success_latency_ms`）。
- 指标库没有 ping 序列时，回退到 `/api/records/ping` 聚合出延迟/丢包曲线。
- 节点已配置 ping 任务但窗口内没有数据时，显示带说明的占位图，而不是让图表静默消失。

## v1.1.0 — 2026-10-19

- 详情页新增 **ping 延迟图**（按任务 / 地址族 / 协议 / 参考点分线）与**丢包图**（窗口内出现丢包时显示）。
- ping 图横跨整行；标题与图例改为文档流，长图例不再压住折线。
- 节点 `region` 归一为两字母代码用于表格与面板，避免旗帜 emoji 缺字形。
- 修复桌面双栏详情里 `uptime` 行被裁切的问题。

## v1.0.0 — 2026-10-19

- 首个 Komari/Nekomari 移植版本：保留上游 CRT 的界面、六套配色、命令行与字体，数据层改为 Komari 公开接口，主题清单改为 managed 配置。
