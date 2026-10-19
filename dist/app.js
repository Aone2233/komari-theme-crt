;(() => {
  "use strict"

  const VERSION = "1.1.1"

  const PALETTES = [
    { id: "graphite", name: "Graphite", sw: "#2a2c30" },
    { id: "phosphor", name: "Phosphor", sw: "#6dfc8e" },
    { id: "amber", name: "Amber", sw: "#ffb64a" },
    { id: "nord", name: "Nord", sw: "#88c0d0" },
    { id: "dusk", name: "Dusk", sw: "#c3a6ff" },
    { id: "paper", name: "Paper", sw: "#f6f5f1" },
  ]

  const DEFAULTS = {
    palette: "graphite",
    allow_switch: true,
    scanlines: false,
    username: "guest",
    hostname: "",
    notice: "",
    show_summary: true,
    default_view: "grid",
    show_remark: true,
    show_admin: true,
  }

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag)
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue
        if (k === "class") el.className = v
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v)
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v)
        else el.setAttribute(k, v === true ? "" : v)
      }
    }
    append(el, kids)
    return el
  }
  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue
      el.append(k instanceof Node ? k : document.createTextNode(String(k)))
    }
  }

  function put(el, ...kids) { el.replaceChildren(); append(el, kids) }
  const span = (cls, text) => h("span", { class: cls }, text)
  const line = (...kids) => h("div", { class: "ln" }, ...kids)
  const SVGNS = "http://www.w3.org/2000/svg"
  function s(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag)
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v)
    return el
  }

  const store = {
    get(k) { try { return localStorage.getItem("crt." + k) } catch { return null } },
    set(k, v) { try { v == null ? localStorage.removeItem("crt." + k) : localStorage.setItem("crt." + k, v) } catch {} },
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const p2 = (x) => String(x).padStart(2, "0")
  const clock = (d = new Date()) => `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
  const pctOf = (used, total) => (total > 0 ? (used / total) * 100 : 0)
  const level = (p) => (p >= 90 ? "err" : p >= 75 ? "warn" : "ok")

  function scale(n, units, base = 1024) {
    let i = 0
    let v = Math.max(0, n || 0)
    while (v >= 1000 && i < units.length - 1) { v /= base; i++ }
    return [v, units[i]]
  }

  function hsize(n) {
    const [v, u] = scale((n || 0) / 1024, ["K", "M", "G", "T", "P"])
    return (v < 10 && u !== "K" ? v.toFixed(2) : v < 100 && u !== "K" ? v.toFixed(1) : Math.round(v)) + u
  }

  function iec(n) {
    const [v, u] = scale(n, ["B", "KiB", "MiB", "GiB", "TiB", "PiB"])
    return u === "B" ? `${Math.round(v)} B` : `${v.toFixed(2)} ${u}`
  }
  const iecRate = (n) => {
    const [v, u] = scale(n, ["B/s", "KiB/s", "MiB/s", "GiB/s"])
    return u === "B/s" ? `${Math.round(v)} B/s` : `${v.toFixed(1)} ${u}`
  }

  function freeH(n) {
    if (!n) return "0B"
    const [v, u] = scale(n, ["B", "Ki", "Mi", "Gi", "Ti"])
    return (v < 10 && u !== "B" ? v.toFixed(1) : Math.round(v)) + u
  }

  function dfH(n) {
    if (!n) return "0"
    const [v, u] = scale(n, ["B", "K", "M", "G", "T"])
    return (v < 10 && u !== "B" ? v.toFixed(1) : Math.round(v)) + (u === "B" ? "" : u)
  }

  function uptimeText(sec) {
    const d = Math.floor(sec / 86400), hh = Math.floor((sec % 86400) / 3600), mm = Math.floor((sec % 3600) / 60)
    const hm = hh ? `${String(hh).padStart(2)}:${p2(mm)}` : `${mm} min`
    return d ? `${d} day${d === 1 ? "" : "s"}, ${hm}` : hm
  }

  function htopUptime(sec) {
    const d = Math.floor(sec / 86400)
    const t = `${p2(Math.floor((sec % 86400) / 3600))}:${p2(Math.floor((sec % 3600) / 60))}:${p2(Math.floor(sec % 60))}`
    return d ? `${d} day${d === 1 ? "" : "s"}, ${t}` : t
  }

  function dur(sec) {
    if (sec == null || !isFinite(sec) || sec < 0) return "?"
    const d = Math.floor(sec / 86400), hh = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
    if (d > 0) return `${d}d ${hh}h`
    if (hh > 0) return `${hh}h ${m}m`
    if (m > 0) return `${m}m`
    return `${Math.floor(sec)}s`
  }
  // 按码点而不是 UTF-16 单元截断：`slice` 会把 emoji 的代理对劈开，渲染成 "�"。
  const fit = (str, w) => {
    const chars = Array.from(String(str ?? ""))
    return chars.length > w ? chars.slice(0, Math.max(0, w - 1)).join("") + "+" : String(str ?? "").padEnd(w)
  }

  // Nekomari 的 region 是自由文本（可能是 "🇯🇵 JP"、"Asia/JP" 或 "Japan"），
  // 而 top 表格的 RG 列只有两个字符宽。取出一个 ASCII 国家码用于表格，
  // 面板标题和详情页仍显示完整 region。
  function regionCode(region) {
    const ascii = String(region || "").replace(/[^\x20-\x7e]/g, "").trim()
    if (!ascii) return ""
    const trailing = /(?:^|[\s,/\-])([A-Za-z]{2})$/.exec(ascii)
    if (trailing) return trailing[1].toUpperCase()
    const letters = ascii.replace(/[^A-Za-z]/g, "")
    return letters.slice(0, 2).toUpperCase()
  }

  // 面板/详情页里显示的区域名：纯 ASCII 就原样显示，带旗帜 emoji 或中日韩文字时
  // 退回国家码 —— JetBrains Mono 没有 emoji 字形，旗帜会渲染成豆腐块。
  function regionLabel(region) {
    const text = String(region || "").trim()
    if (!text) return ""
    return /[^\x20-\x7e]/.test(text) ? regionCode(text) : text
  }

  function offlineFor(n) {
    if (n.last_seen_ago !== undefined) return n.last_seen_ago
    if (!n.last_seen) return null
    return Math.max(0, Date.now() / 1000 - n.last_seen)
  }
  function monthUsed(n) {
    if (typeof n.month_used === "number") return n.month_used
    const rx = n.month_rx || 0, tx = n.month_tx || 0
    switch (n.traffic_mode) {
      case "up": return tx
      case "down": return rx
      case "max": return Math.max(rx, tx)
      case "min": return Math.min(rx, tx)
      default: return rx + tx
    }
  }

  class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status }
  }

  function describe(status) {
    if (status === 0) return "network unreachable, retrying"
    if (status === 401 || status === 403) return "permission denied: this status page requires sign-in"
    if (status === 429) return "too many requests, try again shortly"
    if (status >= 500) return `service unavailable (HTTP ${status})`
    return `request blocked (HTTP ${status})`
  }

  // `/api/*` 的 JSON 读取接口有两种外壳：RPC 桥接的 {status,message,data} 和
  // WithRaw 的裸对象（/api/me）。两者都在这里归一，调用方只看到数据本身。
  function unwrap(payload) {
    if (payload && typeof payload === "object" && typeof payload.status === "string") {
      if (payload.status.toLowerCase() === "error") {
        throw new ApiError(200, payload.message || "request failed")
      }
      if ("data" in payload) return payload.data
    }
    return payload
  }

  async function request(path, options) {
    let res
    try {
      res = await fetch(path, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout?.(20000),
        ...options,
      })
    } catch {
      throw new ApiError(0, describe(0))
    }
    if (!res.ok) throw new ApiError(res.status, describe(res.status))
    if (res.status === 204) return undefined
    let payload
    try {
      payload = await res.json()
    } catch {
      throw new ApiError(res.status, "unexpected response from server")
    }
    return unwrap(payload)
  }

  const apiGet = (path) => request(path)

  // JSON-RPC 2.0：Komari/Nekomari 的读接口几乎都经 /api/rpc2 暴露，方法名决定权限
  // 与脱敏规则（hidden 节点、访客可见的 IP、错误信息），主题不自行拼 REST 路径。
  let rpcSequence = 0
  async function rpc(method, params) {
    const body = JSON.stringify({ jsonrpc: "2.0", id: ++rpcSequence, method, params: params || {} })
    let res
    try {
      res = await fetch("/api/rpc2", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
        signal: AbortSignal.timeout?.(20000),
      })
    } catch {
      throw new ApiError(0, describe(0))
    }
    if (!res.ok) throw new ApiError(res.status, describe(res.status))
    let payload
    try {
      payload = await res.json()
    } catch {
      throw new ApiError(res.status, "unexpected response from server")
    }
    if (payload && payload.error) {
      throw new ApiError(res.status, payload.error.message || "request failed")
    }
    return payload ? payload.result : undefined
  }

  const num = (v) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : null)

  // Komari 的节点元信息（models.Client）→ CRT 的节点模型。
  // 字段名差异集中在这里，渲染层保持上游的写法。
  function normalizeNode(client) {
    return {
      id: client.uuid,
      name: client.name || client.uuid,
      group: client.group || "",
      country: client.region || "",
      region_code: regionCode(client.region),
      region_label: regionLabel(client.region),
      os: client.os || "",
      kernel: client.kernel_version || "",
      arch: client.arch || "",
      virt: client.virtualization || "",
      cpu_name: client.cpu_name || "",
      cpu_cores: client.cpu_cores || 0,
      agent_version: client.version || "",
      public_remark: client.public_remark || "",
      remark: client.remark || "",
      traffic_limit: client.traffic_limit || 0,
      traffic_mode: client.traffic_limit_type || "sum",
      traffic_reset_day: undefined,
      // 静态总量单独留一份：/api/records/load 的 ram_total/disk_total 恒为 0，
      // 详情页的百分比要在这里兜底，不能指望记录里带 total。
      mem_total: client.mem_total || 0,
      swap_total: client.swap_total || 0,
      disk_total: client.disk_total || 0,
      online: false,
      last_seen: null,
      day_rx: 0,
      day_tx: 0,
      month_rx: 0,
      month_tx: 0,
      month_known: false,
      total_rx: 0,
      total_tx: 0,
      metrics: null,
    }
  }

  // 一台上报完整的主机才有 metrics：缺了 CPU/内存/磁盘/网速任何一组，面板显示的是
  // "waiting"，而不是一排 0%。这与上游对 metrics=null 的语义一致。
  function reportMetrics(status) {
    if (!status || typeof status !== "object") return null
    const metrics = {
      cpu: num(status.cpu),
      mem_total: num(status.ram_total),
      mem_used: num(status.ram),
      swap_total: num(status.swap_total),
      swap_used: num(status.swap),
      disk_total: num(status.disk_total),
      disk_used: num(status.disk),
      net_rx: num(status.net_in),
      net_tx: num(status.net_out),
      load: [num(status.load), num(status.load5), num(status.load15)],
      uptime: num(status.uptime),
      procs: num(status.process),
      tcp: num(status.connections_tcp),
      udp: num(status.connections_udp),
    }
    const essential = [metrics.cpu, metrics.mem_used, metrics.mem_total, metrics.disk_used, metrics.disk_total, metrics.net_rx, metrics.net_tx]
    return essential.every((v) => v != null) ? metrics : null
  }

  // common:getNodesLatestStatus 一次返回整张表的最近状态；把它并进节点模型。
  function applyStatus(nodes, status) {
    for (const node of nodes) {
      const latest = status ? status[node.id] : null
      if (!latest) {
        node.online = false
        continue
      }
      node.online = latest.online === true
      const seen = latest.time ? Date.parse(latest.time) / 1000 : node.online ? Date.now() / 1000 : NaN
      node.last_seen = isFinite(seen) ? seen : null
      node.metrics = reportMetrics(latest)
      const cycleDown = num(latest.traffic_down)
      const cycleUp = num(latest.traffic_up)
      node.month_known = cycleDown != null || cycleUp != null
      if (node.month_known) {
        node.month_rx = cycleDown || 0
        node.month_tx = cycleUp || 0
      }
      node.total_rx = num(latest.net_total_down) || 0
      node.total_tx = num(latest.net_total_up) || 0
    }
  }

  // 展示用的配置来自 /api/public 的 theme_settings：服务端已经把清单里声明的默认值
  // 填好，所以这里只做类型/取值校验，不重复实现默认值逻辑。
  function coerceConfig(saved) {
    const out = { ...DEFAULTS }
    if (!saved || typeof saved !== "object") return out
    if (typeof saved.palette === "string" && PALETTES.some((p) => p.id === saved.palette)) out.palette = saved.palette
    for (const key of ["allow_switch", "scanlines", "show_summary", "show_remark", "show_admin"]) {
      if (typeof saved[key] === "boolean") out[key] = saved[key]
    }
    if (typeof saved.username === "string") out.username = saved.username
    if (typeof saved.hostname === "string") out.hostname = saved.hostname
    if (typeof saved.notice === "string") out.notice = saved.notice
    if (saved.default_view === "grid" || saved.default_view === "list") out.default_view = saved.default_view
    return out
  }

  function historyDays(publicSettings) {
    const hours = publicSettings && typeof publicSettings.record_preserve_time === "number" ? publicSettings.record_preserve_time : 0
    if (!hours || !isFinite(hours)) return 7
    return Math.max(1, Math.min(365, Math.round(hours / 24)))
  }

  const state = {
    me: null,
    publicSettings: null,
    cfg: { ...DEFAULTS },
    nodes: null,
    error: "",
    group: null,
    view: store.get("view"),
    filter: "",
    sort: store.get("sort") || "",
    route: null,
    range: Number(store.get("range")) || 24,
  }

  const STATUS_INTERVAL = 2000
  const TRAFFIC_INTERVAL = 5 * 60 * 1000

  async function loadNodes() {
    const map = await rpc("common:getNodes")
    const list = map && typeof map === "object" ? Object.values(map) : []
    return list.filter((client) => client && client.uuid).map(normalizeNode)
  }

  async function loadStatus() {
    const map = await rpc("common:getNodesLatestStatus", { include_ping: false })
    return map && typeof map === "object" ? map : {}
  }

  async function loadSite() {
    let publicSettings = null
    let me = null
    try { publicSettings = await apiGet("/api/public") } catch (e) { publicSettings = null }
    try { me = await apiGet("/api/me") } catch (e) { me = null }
    return { publicSettings, me }
  }

  // 今日流量：public:queryMetrics 的 traffic.* 只保存"连续性校验过的区间增量"，
  // 用 aggregation=sum 求和才是窗口总量；语义不是 interval_delta_v2 的序列一律不累加
  // （那是计费周期累计值，按桶相加会得到几十倍的假数字）。
  async function loadDayTraffic(nodes) {
    const ids = (nodes || []).map((n) => n.id)
    if (!ids.length) return
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const params = (aggregation, start) => ({
      metric_keys: ["traffic.up", "traffic.down"],
      entity_ids: ids,
      start: start.toISOString(),
      end: now.toISOString(),
      max_points: 400,
      aggregation,
    })
    const [day, cycle] = await Promise.all([
      rpc("public:queryMetrics", params("sum", midnight)).catch(() => null),
      rpc("public:queryMetrics", params("last", new Date(now.getTime() - 35 * 24 * 3600 * 1000))).catch(() => null),
    ])
    const read = (response, cumulative) => {
      const out = new Map()
      for (const series of (response && response.series) || []) {
        if (!series || !series.entity_id) continue
        if (cumulative && series.semantics && series.semantics !== "billing_cycle_cumulative") continue
        let value = null
        for (const point of series.points || []) {
          if (point && typeof point.value === "number" && isFinite(point.value) && point.value >= 0) {
            if (!cumulative) value = (value || 0) + point.value
            else value = point.value
          }
        }
        if (value == null) continue
        const entry = out.get(series.entity_id) || { rx: 0, tx: 0 }
        if (series.metric_key === "traffic.up") entry.tx = value
        else if (series.metric_key === "traffic.down") entry.rx = value
        out.set(series.entity_id, entry)
      }
      return out
    }
    const dayTotals = read(day, false)
    const cycleTotals = read(cycle, true)
    for (const node of nodes || []) {
      const today = dayTotals.get(node.id)
      node.day_rx = today ? today.rx : 0
      node.day_tx = today ? today.tx : 0
      if (!node.month_known) {
        const month = cycleTotals.get(node.id)
        if (month) {
          node.month_rx = month.rx
          node.month_tx = month.tx
          node.month_known = true
        }
      }
    }
    renderAll()
  }

  // 实时数据：轮询 common:getNodesLatestStatus。它和 /api/clients 走同一份上报缓存，
  // 但服务端已经做了 hidden 过滤、质量标记和字段归并，主题不需要再解析原始 report。
  function live(onNodes, onError) {
    let timer = null
    let stopped = false
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(tick, document.hidden ? STATUS_INTERVAL * 4 : STATUS_INTERVAL)
    }
    const tick = async () => {
      if (stopped) return
      try {
        const status = await loadStatus()
        if (stopped) return
        applyStatus(state.nodes || [], status)
        onNodes(state.nodes || [])
      } catch (e) {
        if (!stopped) onError(e)
      }
      if (!stopped) schedule()
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearTimeout(timer)
      else tick()
    })
    tick()
  }

  const slug = (str) => String(str || "").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "")
  const signedIn = () => !!state.me?.authed
  const user = () => (signedIn() ? "root" : slug(state.cfg.username) || "guest")
  const sigil = () => (signedIn() ? "#" : "$")
  const host = () => slug(state.cfg.hostname) || slug(state.me?.site_name) || "status"

  let hostIndex = new Map()
  function indexHosts(nodes) {
    const seen = new Map()
    hostIndex = new Map(nodes.map((n) => {
      const base = slug(n.name) || `node${n.id}`
      const k = (seen.get(base) || 0) + 1
      seen.set(base, k)
      return [n.id, k === 1 ? base : `${base}-${k}`]
    }))
  }
  const nodeHost = (n) => hostIndex.get(n.id) || slug(n.name) || `node${n.id}`

  function ps(path, cmd, args, hostname) {
    return h("div", { class: "ps" },
      span("u", `${user()}@${hostname || host()}`), span("sym", ":"), span("path", path), span("sym", sigil() + " "),
      span("cmd", cmd), args != null && args !== "" ? [cmd ? " " : "", typeof args === "string" ? span("arg", args) : args] : null)
  }

  const groupsOf = (nodes) => [...new Set(nodes.map((n) => n.group ?? "").filter(Boolean))]
  const inGroup = (n) => state.group === null || (n.group ?? "") === state.group
  function matches(n, q) {
    if (!q) return true
    const hay = [n.name, n.country, n.group, n.os, n.public_remark, n.virt, n.arch].filter(Boolean).join(" ").toLowerCase()
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
  }
  const memPct = (n) => pctOf(n.metrics?.mem_used, n.metrics?.mem_total)
  const diskPct = (n) => pctOf(n.metrics?.disk_used, n.metrics?.disk_total)
  const SORTS = {
    name: (a, b) => a.name.localeCompare(b.name),
    cpu: (a, b) => (b.metrics?.cpu ?? -1) - (a.metrics?.cpu ?? -1),
    mem: (a, b) => memPct(b) - memPct(a),
    disk: (a, b) => diskPct(b) - diskPct(a),
    net: (a, b) => ((b.metrics?.net_rx ?? 0) + (b.metrics?.net_tx ?? 0)) - ((a.metrics?.net_rx ?? 0) + (a.metrics?.net_tx ?? 0)),
    up: (a, b) => (b.metrics?.uptime ?? -1) - (a.metrics?.uptime ?? -1),
  }

  const rank = (n) => (!n.online ? 2 : n.metrics ? 0 : 1)
  function shown() {
    const list = (state.nodes || []).filter((n) => inGroup(n) && matches(n, state.filter))
    const sorted = state.sort && SORTS[state.sort] ? [...list].sort(SORTS[state.sort]) : list
    return [...sorted].sort((a, b) => rank(a) - rank(b))
  }
  const currentView = () => ((state.view || state.cfg.default_view) === "list" ? "list" : "grid")
  function setView(v) { state.view = v; store.set("view", v); renderAll() }
  function setSort(k) { state.sort = k; store.set("sort", k || null); renderAll() }

  function applyPalette() {
    const id = (state.cfg.allow_switch && store.get("palette")) || state.cfg.palette
    document.documentElement.dataset.palette = PALETTES.some((p) => p.id === id) ? id : DEFAULTS.palette
    document.documentElement.classList.toggle("scan-on", !!state.cfg.scanlines)
  }
  function setPalette(id) { store.set("palette", id); applyPalette(); renderBar() }

  const $ = (id) => document.getElementById(id)
  const el = { bar: $("bar"), notice: $("notice"), screen: $("screen"), out: $("out"), cli: $("cli"), cmd: $("cmd"), ps1: $("ps1") }

  let menuOpen = false
  addEventListener("click", () => { if (menuOpen) { menuOpen = false; renderBar() } })
  function renderBar() {
    const nodes = state.nodes || []
    const up = nodes.filter((n) => n.online).length
    const pal = document.documentElement.dataset.palette
    const groups = groupsOf(nodes)
    const ungrouped = nodes.some((n) => !(n.group ?? ""))
    const home = state.route == null
    const wins = [{ key: null, label: "all" }, ...groups.map((g) => ({ key: g, label: g })),
      ...(groups.length && ungrouped ? [{ key: "", label: "ungrouped" }] : [])]
    const win = (w, i) => {
      const active = home && state.group === w.key
      return h("button", { class: "win" + (active ? " on" : ""), "aria-pressed": String(active),
        onclick: () => { state.group = w.key; if (!home) go(null); else renderAll() } }, `${i}:${w.label}${active ? "*" : ""}`)
    }
    const node = home ? null : nodes.find((n) => n.id === state.route)

    put(el.bar, h("div", { class: "tin" },
      h("button", { class: "sess", title: "Home", onclick: () => { state.group = null; go(null) } }, `[${host()}]`),
      h("nav", { class: "wins", "aria-label": "Groups" },
        home ? wins.map(win) : [win(wins[0], 0), h("span", { class: "win on" }, `1:ssh ${node ? nodeHost(node) : state.route}*`)]),

      home ? h("span", { class: "views seg" },
        h("button", { "aria-pressed": String(currentView() === "grid"), onclick: () => setView("grid") }, "htop"),
        h("button", { "aria-pressed": String(currentView() === "list"), onclick: () => setView("list") }, "top")) : null,
      h("span", { class: "stat seg" }, span("num up", `${up}/${nodes.length} up`), span("num clk", clock().slice(0, 5))),
      state.error ? span("err", state.error) : null,
      h("span", { class: "right seg" },
        state.cfg.allow_switch ? h("span", { class: "theme" },
          h("button", { class: "tbtn", "aria-haspopup": "true", "aria-expanded": String(menuOpen),
            onclick: (e) => { e.stopPropagation(); menuOpen = !menuOpen; renderBar() } }, "theme:" + pal),
          menuOpen ? h("span", { class: "menu", role: "menu" }, PALETTES.map((p) => h("button", {
            role: "menuitemradio", "aria-checked": String(pal === p.id),
            onclick: (e) => { e.stopPropagation(); menuOpen = false; setPalette(p.id) },
          }, h("span", { class: "sw", style: { background: p.sw } }), (p.id === pal ? " * " : "   ") + p.id))) : null) : null,
        state.cfg.show_admin || state.me?.authed ? h("a", { class: "adm", href: "/admin" }, "admin") : null,
      ),
    ))
    el.ps1.textContent = `${user()}@${home ? host() : node ? nodeHost(node) : host()}:~${sigil()}`
    el.cmd.placeholder = home ? "run 'help', or 'grep <name>' to filter" : "run 'exit' to go back, or 'help'"
    document.title = state.me?.site_name || host()
  }
  setInterval(() => { const c = el.bar.querySelector(".clk"); if (c) c.textContent = clock().slice(0, 5) }, 10000)

  function renderNotice() {
    const t = (state.cfg.notice || "").trim()
    el.notice.hidden = !t || state.route != null
    el.notice.textContent = t
  }

  const lastLogin = (() => {
    const prev = Number(store.get("last_login")) || 0
    store.set("last_login", String(Date.now()))
    if (!prev) return null
    const d = new Date(prev)
    return `Last login: ${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${clock(d)} ${d.getFullYear()} from web`
  })()

  const B = (t) => span("b", t)
  function topSummary(list) {
    const up = list.filter((n) => n.online)
    const on = up.filter((n) => n.metrics)
    const waiting = up.length - on.length
    const down = list.length - up.length
    const avg = (f) => (on.length ? on.reduce((a, n) => a + f(n), 0) / on.length : 0)
    const load = [0, 1, 2].map((i) => avg((n) => (Array.isArray(n.metrics.load) ? n.metrics.load[i] : 0)).toFixed(2))
    const cpu = avg((n) => n.metrics.cpu).toFixed(1)
    const busiest = on.reduce((b, n) => (!b || n.metrics.cpu > b.metrics.cpu ? n : b), null)
    const max = busiest ? busiest.metrics.cpu.toFixed(1) : "0.0"
    const mem = on.reduce((a, n) => [a[0] + n.metrics.mem_used, a[1] + n.metrics.mem_total], [0, 0])
    const gib = (x) => (x / 1024 ** 3).toFixed(1)
    const rx = on.reduce((a, n) => a + n.metrics.net_rx, 0)
    const tx = on.reduce((a, n) => a + n.metrics.net_tx, 0)
    const day = list.reduce((a, n) => a + (n.day_rx || 0) + (n.day_tx || 0), 0)
    const n = (v, w = 0) => span("hi", String(v).padStart(w))
    const downN = span(down ? "err" : "hi", String(down))

    if (innerWidth < 640) {
      return h("div", { class: "term num" },
        line("top - ", clock(), " up ", n(up.length), "/", list.length, " hosts"),
        line(B("load average:"), " ", load.join(", ")),
        line(B("Hosts:"), " ", n(list.length), " total, ", n(on.length), " run, ", n(waiting), " wait, ", downN, " down"),
        line(B("%Cpu(s):"), " ", n(cpu), " avg, ", n(max), " max"),
        line(B("GiB Mem:"), " ", n(gib(mem[1])), " total, ", n(gib(mem[0])), " used"),
        line(B("Net/s:"), " ", n(iecRate(rx)), " rx, ", n(iecRate(tx)), " tx"),
        line(B("Today:"), " ", n(iec(day)), " transferred"))
    }
    return h("div", { class: "term num" },
      line("top - ", clock(), " up ", n(up.length), " of ", list.length, " hosts,  load average: ", load.join(", ")),
      line(B("Hosts:"), n(list.length, 4), " total,", n(on.length, 4), " running,", n(waiting, 4), " waiting,",
        span(down ? "err" : "hi", String(down).padStart(4)), " down"),
      line(B("%Cpu(s):"), n(cpu, 6), " avg,", n(max, 6), " max", busiest ? span("dim", `  (${busiest.name})`) : null),
      line(B("GiB Mem :"), n(gib(mem[1]), 9), " total,", n(gib(mem[1] - mem[0]), 9), " free,", n(gib(mem[0]), 9), " used"),
      line(B("Net/s   :"), n(iecRate(rx), 12), " rx,", n(iecRate(tx), 12), " tx,", n(iec(day), 12), " today"),
    )
  }

  let charW = 0
  function measure() {
    if (!charW) {
      const probe = h("span", { class: "term", style: { position: "absolute", visibility: "hidden" } }, "0".repeat(40))
      el.screen.append(probe)
      charW = probe.getBoundingClientRect().width / 40 || 8
      probe.remove()
    }
    return charW
  }
  document.fonts?.ready.then(() => { charW = 0; renderAll() })

  function paneLayout(chars) {
    return { chars, W: Math.max(10, chars - 5) }
  }

  const seg = (parts) => line(parts.map(([c, t]) => (c ? span(c, t) : t)))
  const segLen = (parts) => parts.reduce((a, [, t]) => a + t.length, 0)

  function pair(left, right, width) {
    const gap = width - segLen(left) - segLen(right)
    return gap >= 2 ? seg([...left, [null, " ".repeat(gap)], ...right]) : null
  }
  function bodyChars() {
    const sample = el.screen.querySelector(".pane .body")
    const grid = el.screen.querySelector(".panes")
    const inner = sample ? sample.clientWidth : Math.min(560, (grid?.clientWidth || innerWidth) - 34)
    return Math.floor(inner / measure())
  }

  function meter(label, pct, text, width) {
    const v = Math.max(0, Math.min(100, pct || 0))
    const room = Math.max(0, width - text.length)
    const bars = Math.min(room, Math.round((v / 100) * width))
    return line(span("mk", label), span("br", "["), span("bar " + level(v), "|".repeat(bars)), " ".repeat(room - bars),
      span("mv", text), span("br", "]"))
  }
  const krate = (n) => hsize(n) + "/s"

  const panes = new Map()
  function paneFor(n, L) {
    let p = panes.get(n.id)
    if (!p) {
      p = h("article", { class: "pane", tabindex: "0", "data-id": n.id, onclick: () => go(n.id),
        onkeydown: (e) => { if (e.key === "Enter") go(n.id) } })
      panes.set(n.id, p)
    }
    fillPane(p, n, L)
    return p
  }
  function fillPane(p, n, L) {
    const m = n.metrics
    p.classList.toggle("off", !n.online)
    p.setAttribute("aria-label", n.name)

    const status = !n.online ? span("err", `offline ${dur(offlineFor(n))}`) : m ? null : span("warn", "waiting")
    const body = h("div", { class: "body term num" })
    if (m) {
      const W = L.W
      const quota = n.traffic_limit > 0
      const meters = [
        meter("CPU", m.cpu, m.cpu.toFixed(1) + "%", W),
        meter("Mem", pctOf(m.mem_used, m.mem_total), `${hsize(m.mem_used)}/${hsize(m.mem_total)}`, W),
        meter("Dsk", pctOf(m.disk_used, m.disk_total), `${hsize(m.disk_used)}/${hsize(m.disk_total)}`, W),
        quota ? meter("Qta", pctOf(monthUsed(n), n.traffic_limit), `${hsize(monthUsed(n))}/${hsize(n.traffic_limit)}`, W)
          : m.swap_total > 0 ? meter("Swp", pctOf(m.swap_used, m.swap_total), `${hsize(m.swap_used)}/${hsize(m.swap_total)}`, W)
            : meter("Trf", 0, `${hsize((n.month_rx || 0) + (n.month_tx || 0))} this month`, W),
      ]
      const load = Array.isArray(m.load) ? [["b", m.load[0].toFixed(2)], ["dim", " " + m.load.slice(1).map((x) => x.toFixed(2)).join(" ")]] : [[null, "-"]]
      const tasks = [["tk", "Tasks: "], ["b", String(m.procs ?? "-")], [null, "; "], ["b", String(m.tcp ?? "-")], [null, " tcp, "],
        ["b", String(m.udp ?? "-")], [null, " udp"]]
      const uptime = [["tk", "Uptime: "], ["b", htopUptime(m.uptime)]]
      const net = [["tk", "Net: "], ["dim", "rx "], ["b", krate(m.net_rx)], ["dim", "  tx "], ["b", krate(m.net_tx)]]
      const chars = L.chars

      const r1 = pair(tasks, [["tk", "Load average: "], ...load], chars) || pair(tasks, [["tk", "Load: "], ...load], chars)
      const r2 = pair(uptime, net, chars)
      append(body, [meters, r1 && r2 ? [r1, r2] : [seg(tasks), seg([["tk", "Load average: "], ...load]), seg(uptime), seg(net)]])
    } else if (n.online) {
      append(body, [line(span("dim", `ssh: connected to ${nodeHost(n)}, waiting for the first report`)), line(span("cursor", "█"))])
    } else {
      const ago = offlineFor(n)
      append(body, [
        line(span("err", `ssh: connect to host ${nodeHost(n)} port 22: Connection timed out`)),
        line(span("dim", ago == null ? "never seen" : `last seen ${dur(ago)} ago`)),
      ])
    }
    if (state.cfg.show_remark && n.public_remark) append(body, [line(span("dim", "# " + n.public_remark))])
    put(p,
      h("div", { class: "head" }, h("span", { class: "name", title: n.name }, n.name),
        n.region_code ? span("tag", n.region_code) : n.region_label ? span("tag", n.region_label) : null, span("grow"), status ? h("span", { class: "st" }, status) : null),
      body)
  }
  function renderPanes(box, list) {
    const grid = box.querySelector(".panes") || h("div", { class: "panes" })
    if (!grid.isConnected) put(box, grid)
    const L = paneLayout(bodyChars())
    const want = list.map((n) => paneFor(n, L))
    want.forEach((c, i) => { if (grid.children[i] !== c) grid.insertBefore(c, grid.children[i] || null) })
    while (grid.children.length > want.length) grid.lastChild.remove()
    for (const id of panes.keys()) if (!state.nodes.some((n) => n.id === id)) panes.delete(id)

    const L2 = paneLayout(bodyChars())
    if (L2.chars !== L.chars) list.forEach((n) => fillPane(panes.get(n.id), n, L2))
  }

  let lastWidth = 0, resizeT
  new ResizeObserver(() => {
    const w = el.screen.clientWidth
    if (w === lastWidth) return
    lastWidth = w

    charW = 0
    clearTimeout(resizeT)
    resizeT = setTimeout(renderAll, 60)
  }).observe(el.screen)

  const lvl = (p) => (p >= 90 ? "err" : p >= 75 ? "warn" : null)
  const clampW = (xs, lo, hi) => Math.max(lo, Math.min(hi, Math.max(0, ...xs)))

  const colw = (() => { try { return JSON.parse(store.get("colw") || "{}") || {} } catch { return {} } })()
  const saveColw = () => store.set("colw", Object.keys(colw).length ? JSON.stringify(colw) : null)
  function startResize(e, c) {
    e.preventDefault()
    e.stopPropagation()
    const x0 = e.clientX, w0 = c.w, cw = measure()
    document.documentElement.classList.add("resizing")

    dragLock = true
    const move = (ev) => {
      const w = Math.max(3, Math.min(60, w0 + Math.round((ev.clientX - x0) / cw)))
      if (w !== colw[c.t]) { colw[c.t] = w; renderHome() }
    }
    const up = () => {
      removeEventListener("pointermove", move)
      removeEventListener("pointerup", up)
      document.documentElement.classList.remove("resizing")
      saveColw()
      dragLock = false
      renderHome()
    }
    addEventListener("pointermove", move)
    addEventListener("pointerup", up)
  }
  function renderTable(box, list) {
    const groups = groupsOf(state.nodes)
    const narrow = innerWidth < 640

    const order = new Map(state.nodes.map((n, i) => [n.id, i + 1]))
    const cols = [
      { t: "#", w: Math.max(2, String(state.nodes.length).length), r: 1, v: (n) => String(order.get(n.id)), cls: () => "dim" },
      { t: "S", w: 1, v: (n) => (n.online ? (n.metrics ? "R" : "S") : "X"),
        cls: (n) => (n.online ? (n.metrics ? "ok" : "warn") : "err") },
      { k: "name", name: true, t: "NAME", w: clampW(list.map((n) => n.name.length), narrow ? 6 : 8, narrow ? 14 : 20), v: (n) => n.name },
      groups.length && !narrow ? { t: "GROUP", w: clampW(groups.map((g) => g.length), 5, 16), v: (n) => n.group || "-", cls: () => "dim" } : null,
      narrow ? null : { t: "RG", w: 2, v: (n) => n.region_code || "--", cls: () => "dim" },
      { k: "cpu", t: "%CPU", w: 5, r: 1, v: (n) => (n.metrics ? n.metrics.cpu.toFixed(1) : "-"), cls: (n) => n.metrics && lvl(n.metrics.cpu) },
      { k: "mem", t: "%MEM", w: 5, r: 1, v: (n) => (n.metrics ? memPct(n).toFixed(1) : "-"), cls: (n) => n.metrics && lvl(memPct(n)) },
      narrow ? null : { k: "disk", t: "%DSK", w: 5, r: 1, v: (n) => (n.metrics ? diskPct(n).toFixed(1) : "-"), cls: (n) => n.metrics && lvl(diskPct(n)) },
      narrow ? null : { k: "net", t: "RX/s", w: 11, r: 1, v: (n) => (n.metrics ? iecRate(n.metrics.net_rx) : "-") },
      narrow ? null : { t: "TX/s", w: 11, r: 1, v: (n) => (n.metrics ? iecRate(n.metrics.net_tx) : "-") },
      narrow ? null : { t: "%QTA", w: 5, r: 1, v: (n) => (n.traffic_limit > 0 ? pctOf(monthUsed(n), n.traffic_limit).toFixed(1) : "-"),
        cls: (n) => (n.traffic_limit > 0 ? lvl(pctOf(monthUsed(n), n.traffic_limit)) : "dim") },
      { k: "up", t: "UPTIME", w: 9, r: 1, v: (n) => (n.metrics ? dur(n.metrics.uptime) : n.online ? "-" : "-" + dur(offlineFor(n))) },
    ].filter(Boolean)

    for (const c of cols) if (colw[c.t]) c.w = colw[c.t]
    const tight = cols.findIndex((c) => c.name)

    const gap = (i) => (i === 0 ? "" : i <= tight || narrow ? "  " : "   ")
    const cell = (c, text) => (c.r && String(text).length <= c.w ? String(text).padStart(c.w) : fit(String(text), c.w))

    const handle = (i) => (i === 0 ? "" : h("span", {
      class: "rz", title: `Drag to resize ${cols[i - 1].t}; double-click to reset`,
      onpointerdown: (e) => startResize(e, cols[i - 1]),
      ondblclick: () => { delete colw[cols[i - 1].t]; saveColw(); renderHome() },
    }, gap(i)))
    const head = h("div", { class: "thead" }, cols.map((c, i) => [handle(i),
      c.k ? h("button", { class: state.sort === c.k ? "on" : null, title: "Sort by " + c.t,
        onclick: () => setSort(state.sort === c.k ? "" : c.k) }, cell(c, c.t)) : span(null, cell(c, c.t))]))
    const rows = list.map((n) => h("div", { class: "trow" + (n.online ? "" : " off"), tabindex: "0",
      onclick: () => go(n.id), onkeydown: (e) => { if (e.key === "Enter") go(n.id) } },
    cols.map((c, i) => [gap(i), span(c.cls?.(n) || null, cell(c, c.v(n)))])))
    put(box, h("div", { class: "table term num" }, h("div", { class: "tbl" }, head, rows)))
  }

  const EASE = "cubic-bezier(.2, .7, .2, 1)", DUR = 300
  const calm = matchMedia("(prefers-reduced-motion: reduce)")
  let colPx = null, animReady = false, dragLock = false
  function applyColumn(px) {
    if (dragLock) return
    const want = px && innerWidth >= 760 ? Math.ceil(px) : null
    if (want === colPx) return

    const before = el.screen.getBoundingClientRect()
    for (const t of [el.screen, el.out]) for (const a of t.getAnimations()) a.cancel()
    colPx = want
    const root = document.documentElement
    root.classList.toggle("view-top", want != null)
    if (want != null) root.style.setProperty("--col", want + "px")
    else root.style.removeProperty("--col")
    const after = el.screen.getBoundingClientRect()
    const dx = before.left - after.left
    if (!animReady || calm.matches || Math.abs(dx) < 1) return
    const extra = Math.max(0, after.width - before.width)
    const frames = { transform: [`translateX(${dx}px)`, "translateX(0)"] }
    if (extra > 0) frames.clipPath = [`inset(0 ${extra}px 0 0)`, "inset(0 0 0 0)"]
    for (const t of [el.screen, el.out]) t.animate(frames, { duration: DUR, easing: EASE })
  }

  let home = null
  function renderHome() {
    if (!home || !home.root.isConnected) {
      const motd = h("div", { class: "term dim" })
      const sumPs = h("div"), sum = h("div")
      const viewPs = h("div"), view = h("div", { class: "view" })
      home = { root: h("div", { class: "home" }, motd, sumPs, sum, viewPs, view), motd, sumPs, sum, viewPs, view }
      put(el.screen, home.root)
    }
    if (!state.nodes) {
      put(home.motd)
      put(home.sumPs, ps("~", "ssh", `${user()}@${host()}`))
      put(home.sum, h("div", { class: "term dim" }, line(`Connecting to ${host()} port 22...`), line(span("cursor", "█"))))
      put(home.viewPs); put(home.view)
      return
    }
    put(home.motd, lastLogin ? line(lastLogin) : line(`Welcome to ${host()}. Type 'help' for the commands you can run here.`))
    const list = shown()
    const scope = state.nodes.filter(inGroup)
    const where = state.group == null ? "" : ` --group=${JSON.stringify(state.group || "ungrouped")}`
    const grep = state.filter ? ` | grep -i ${JSON.stringify(state.filter)}` : ""
    const listView = currentView() === "list"
    const showSum = state.cfg.show_summary
    home.sumPs.hidden = home.sum.hidden = !showSum
    if (showSum) {
      put(home.sumPs, ps("~", "top", `-bn1${where} | head -5`))
      put(home.sum, topSummary(scope))
    }
    const sortArg = state.sort ? ` -o %${{ name: "NAME", cpu: "CPU", mem: "MEM", disk: "DSK", net: "NET", up: "UPTIME" }[state.sort]}` : ""
    put(home.viewPs, ps("~", listView ? "top" : "htop", (listView ? `-bn1${sortArg}` : `--tree${sortArg}`) + where + grep))
    if (!list.length) {
      put(home.view, h("div", { class: "term dim" },
        state.filter ? `grep: no servers match ${JSON.stringify(state.filter)}` : state.nodes.length ? "htop: this group is empty" : "htop: no public servers yet"))
      return
    }
    if (listView) {
      renderTable(home.view, list)
      applyColumn(home.view.querySelector(".tbl")?.getBoundingClientRect().width)
    } else {
      applyColumn(null)
      renderPanes(home.view, list)
    }
  }

  let detail = null
  function windows() {
    const days = state.me?.history_days ?? 7
    const whole = Math.max(1, Math.min(365, days)) * 24
    return [...[1, 6, 24, 168, 720, 2160].filter((x) => x * 1.25 <= whole), whole]
  }
  const winLabel = (hrs) => (hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`)

  function renderDetail() {
    applyColumn(null)
    if (!state.nodes) return
    const n = state.nodes.find((x) => x.id === state.route)
    if (!n) {
      detail = null
      put(el.screen, h("div", { class: "term" },
        ps("~", "ssh", String(state.route)),
        line(span("err", `ssh: Could not resolve hostname ${state.route}: Name or service not known`)),
        line(span("dim", "Back to all servers: "), h("button", { class: "link", onclick: () => go(null) }, "cd ~"))))
      return
    }
    if (!detail || detail.id !== n.id || !detail.root.isConnected) {
      clearInterval(detail?.timer)
      const info = h("div", { class: "info" }), ranges = h("div"), charts = h("div", { class: "charts" })
      const root = h("div", { class: "detail" }, info, ranges, charts)
      detail = { id: n.id, root, info, ranges, charts, metricsReady: false, timer: setInterval(() => loadCharts(), 60000) }
      put(el.screen, root)
      window.scrollTo(0, 0)
      if (!windows().includes(state.range)) state.range = windows().find((w) => w >= 24) ?? windows().at(-1)
      renderRanges()
      loadCharts()
    }
    fillDetail(n)
  }

  const col = (text, w, right) => (right ? String(text).padStart(w) : String(text).padEnd(w))
  function fillDetail(n) {
    const m = n.metrics
    // 深链接直接打开详情页时，第一帧往往还没有实时数据；内存/磁盘的百分比要靠
    // 节点总量才能画，所以等它到了再补一次图表，而不是等 60 秒后的定时刷新。
    if (m && detail && detail.id === n.id && !detail.metricsReady) {
      detail.metricsReady = true
      loadCharts()
    }
    const nh = nodeHost(n)
    const narrow = innerWidth < 640
    const here = (cmd, args) => ps("~", cmd, args, nh)

    const blocks = []
    const blk = (prompt, out) => blocks.push(h("div", { class: "blk" }, prompt, out))
    if (!n.online) {
      const ago = offlineFor(n)
      blk(ps("~", "ssh", nh), h("div", { class: "term" },
        line(span("err", `ssh: connect to host ${nh} port 22: Connection timed out`)),
        line(span("dim", ago == null ? "# this host has never reported" : `# last report ${dur(ago)} ago; showing what the hub remembers`))))
    } else {
      blk(ps("~", "ssh", nh), h("div", { class: "term dim" }, line(n.os ? `Welcome to ${n.os}` : `Welcome to ${nh}`), lastLogin ? line(lastLogin) : null))
    }
    const label = (k, w = 17) => span("mk", k.padStart(w) + ": ")
    blk(here("hostnamectl"), h("div", { class: "term" },
      line(label("Static hostname"), n.name),
      n.group ? line(label("Location"), `${n.group}${n.region_label ? ", " + n.region_label : ""}`) : n.region_label ? line(label("Location"), n.region_label) : null,
      line(label("Virtualization"), n.virt || "none"),
      line(label("Operating System"), n.os || "unknown"),
      line(label("Kernel"), n.kernel ? `Linux ${n.kernel}` : "unknown"),
      line(label("Architecture"), n.arch || "unknown"),
      line(label("Monitor Agent"), n.agent_version || "unknown"),
      state.cfg.show_remark && n.public_remark ? line(label("Pretty hostname"), n.public_remark) : null,
      n.remark ? line(label("Private note"), span("warn", n.remark)) : null))
    const lw = narrow ? 12 : 22
    blk(here("lscpu", "| grep -E 'Model name|^CPU\\(s\\)'"), h("div", { class: "term" },
      line(span("mk", "CPU(s):".padEnd(lw)), String(n.cpu_cores || "?")),
      line(span("mk", "Model name:".padEnd(lw)), n.cpu_name || "unknown")))
    if (m) {
      const load = Array.isArray(m.load) ? m.load.map((x) => x.toFixed(2)).join(", ") : "-"
      blk(here("uptime"), h("div", { class: "term num" },
        line(` ${clock()} up ${uptimeText(m.uptime)},  ${m.procs ?? "?"} tasks,  load average: ${load}`)))

      const fw = narrow ? [6, 10, 9, 9] : [6, 14, 12, 12]
      const freeRow = (k, total, used) => line(span("mk", col(k, fw[0])), col(freeH(total), fw[1], 1), col(freeH(used), fw[2], 1), col(freeH(Math.max(0, total - used)), fw[3], 1))
      blk(here("free", "-h"), h("div", { class: "term num" },
        line(" ".repeat(fw[0]), col("total", fw[1], 1), col("used", fw[2], 1), col("free", fw[3], 1)),
        freeRow("Mem:", m.mem_total, m.mem_used),
        freeRow("Swap:", m.swap_total, m.swap_used)))
      const use = pctOf(m.disk_used, m.disk_total)
      const dw = narrow ? 10 : 16
      blk(here("df", "-h /"), h("div", { class: "term num" },
        line(col("Filesystem", dw), col("Size", 6, 1), col("Used", 6, 1), col("Avail", 6, 1), col("Use%", 5, 1), " Mounted on"),
        line(col("/dev/root", dw), col(dfH(m.disk_total), 6, 1), col(dfH(m.disk_used), 6, 1),
          col(dfH(Math.max(0, m.disk_total - m.disk_used)), 6, 1), span(lvl(use), col(Math.round(use) + "%", 5, 1)), " /")))
      blk(here("ss", "-s"), h("div", { class: "term num" },
        line(col("Transport", 12), "Total"),
        line(col("TCP", 12), String(m.tcp ?? "-")),
        line(col("UDP", 12), String(m.udp ?? "-"))))
    }

    const kw = narrow ? 10 : 12, vw = narrow ? 11 : 12
    const vrow = (k, rx, tx) => line(span("mk", col(k, kw, 1)), "  ", col(iec(rx), vw, 1), span("dim", "  /"), col(iec(tx), vw, 1),
      narrow ? null : [span("dim", "  /"), col(iec(rx + tx), vw, 1)])
    const quota = n.traffic_limit > 0
      ? `quota ${iec(monthUsed(n))} of ${iec(n.traffic_limit)} (${pctOf(monthUsed(n), n.traffic_limit).toFixed(1)}%)` + (n.traffic_reset_day ? `, resets on day ${n.traffic_reset_day}` : "")
      : null
    blk(here("vnstat"), h("div", { class: "term num" },
      line(" ".repeat(kw + 2), col("rx", vw, 1), "   ", col("tx", vw, 1), narrow ? null : ["   ", col("total", vw, 1)]),
      line(span("dim", " ".repeat(kw + 2) + "─".repeat(narrow ? vw * 2 + 3 : vw * 3 + 9))),
      vrow(narrow ? "today" : "today", n.day_rx || 0, n.day_tx || 0),
      vrow(narrow ? "month" : "this month", n.month_rx || 0, n.month_tx || 0),
      vrow(narrow ? "total" : "all time", n.total_rx || 0, n.total_tx || 0),
      m ? line(span("mk", col("now", kw, 1)), "  ", col(iecRate(m.net_rx), vw, 1), span("dim", "  /"), col(iecRate(m.net_tx), vw, 1)) : null,
      quota ? line(span("dim", (narrow ? "" : " ".repeat(kw + 2)) + quota)) : null))
    put(detail.info, ...blocks)
  }

  function renderRanges() {
    const n = state.nodes?.find((x) => x.id === detail.id)
    const flags = windows().map((w) => h("button", { class: "flag" + (w === state.range ? " on" : ""), "aria-pressed": String(w === state.range),
      onclick: () => { state.range = w; store.set("range", w); renderRanges(); loadCharts() } }, "--range=" + winLabel(w)))
    put(detail.ranges, ps("~", "sar", h("span", null, "-u -r -n DEV ", flags.map((f, i) => [i ? " " : "", f])), n ? nodeHost(n) : null))
  }

  // ---- 延迟（ping）图表 -------------------------------------------------
  //
  // 数据来自 public:queryMetrics 的 ping.* 指标：服务端把每条 ping 记录写成三条
  // 指标，tags 里带 task_id / family / protocol / role。同一任务的双栈、双协议或
  // 参考点因此是【不同的序列】，不能合成一条线。
  //
  // 延迟优先用 ping.success_latency_ms（v2 起只记录成功的样本）；旧服务端没有这条
  // 指标时退回 ping.latency_ms，并把负值（失败样本）当作缺失。两条路都拿不到数据
  // 时再退回 /api/records/ping（旧版本一直有的原始记录表），避免“图表凭空消失”。
  const PING_COLORS = ["var(--fg)", "var(--accent)", "var(--warn)", "var(--key)", "var(--dim)"]
  const PING_METRIC_KEYS = ["ping.success_latency_ms", "ping.latency_ms", "ping.loss"]
  const PING_FALLBACK_KEYS = ["ping.latency_ms", "ping.loss"]
  const pingMs = (value) => (value >= 100 ? value.toFixed(0) : value.toFixed(1)) + " ms"
  const pingPct = (value) => value.toFixed(1) + "%"

  async function queryPingSeries(uuid, keys) {
    return rpc("public:queryMetrics", {
      entity_id: uuid,
      metric_keys: keys,
      hours: state.range,
      max_points: 240,
      aggregation: "avg",
    }).catch((e) => ({ error: e.message }))
  }

  function seriesTags(series) {
    if (series && series.tags) return series.tags
    const points = series && Array.isArray(series.points) ? series.points : []
    const first = points.find((point) => point && point.tags)
    return (first && first.tags) || {}
  }

  function seriesPoints(series) {
    const out = new Map()
    for (const point of (series && series.points) || []) {
      if (!point || typeof point.value !== "number" || !isFinite(point.value)) continue
      const ts = Date.parse(point.time) / 1000
      if (isFinite(ts)) out.set(ts, point.value)
    }
    return out
  }

  function medianStep(times) {
    const diffs = []
    for (let i = 1; i < times.length; i++) {
      const diff = times[i] - times[i - 1]
      if (diff > 0) diffs.push(diff)
    }
    if (!diffs.length) return 60
    diffs.sort((left, right) => left - right)
    return Math.max(1, Math.round(diffs[Math.floor(diffs.length / 2)]))
  }

  // 任务是否属于这台机器：clients 里点名，或 default_on（新加入的机器自动开启）。
  // clients 为空且 default_on=false 的任务不属于任何现有节点。
  function pingTasksFor(tasks, uuid) {
    return (Array.isArray(tasks) ? tasks : []).filter((task) => {
      if (!task) return false
      const clients = Array.isArray(task.clients) ? task.clients : []
      return clients.includes(uuid) || task.default_on === true
    })
  }

  // 旧服务端/旧数据的兜底：/api/records/ping 一直存在，按 60 秒桶聚合成与指标同形的
  // 延迟平均值与丢包比例。没有任何记录时返回空数组，由调用方决定是否显示占位提示。
  async function pingRecordGroups(uuid, tasks) {
    const groups = new Map()
    for (const task of tasks.slice(0, 8)) {
      const res = await apiGet(
        `/api/records/ping?uuid=${encodeURIComponent(uuid)}&task_id=${encodeURIComponent(task.id)}&hours=${state.range}`,
      ).catch(() => null)
      const records = res && Array.isArray(res.records) ? res.records : []
      const buckets = new Map()
      for (const record of records) {
        const ts = Date.parse(record.time) / 1000
        if (!isFinite(ts)) continue
        const tags = {
          task_id: String(record.task_id || task.id),
          family: record.family || "",
          protocol: record.ping_type || "",
          role: record.role || "",
        }
        const key = [tags.task_id, tags.family, tags.protocol, tags.role].join("|")
        const group = groups.get(key) || { taskId: tags.task_id, task, tags, values: new Map(), loss: new Map() }
        const minute = Math.floor(ts / 60) * 60
        const bucket = buckets.get(key) || new Map()
        const stat = bucket.get(minute) || { sum: 0, count: 0, loss: 0, total: 0 }
        stat.total += 1
        if (typeof record.value === "number" && record.value < 0) stat.loss += 1
        else if (typeof record.value === "number") {
          stat.sum += record.value
          stat.count += 1
        }
        bucket.set(minute, stat)
        buckets.set(key, bucket)
        groups.set(key, group)
      }
      for (const [key, bucket] of buckets) {
        const group = groups.get(key)
        for (const [ts, stat] of bucket) {
          if (stat.count > 0) group.values.set(ts, stat.sum / stat.count)
          group.loss.set(ts, stat.total ? stat.loss / stat.total : 0)
        }
      }
    }
    return [...groups.values()].filter((group) => group.values.size)
  }

  async function loadPingCharts(uuid) {
    const [tasksRaw, first] = await Promise.all([
      rpc("public:getPublicPingTasks").catch(() => []),
      queryPingSeries(uuid, PING_METRIC_KEYS),
    ])
    let result = first
    if (result && result.error) result = await queryPingSeries(uuid, PING_FALLBACK_KEYS)
    const tasks = Array.isArray(tasksRaw) ? tasksRaw : []
    const taskMap = new Map()
    for (const task of tasks) taskMap.set(String(task.id), task)

    const families = new Map()
    const noteFamily = (taskId, family) => {
      if (!family) return
      const set = families.get(taskId) || new Set()
      set.add(family)
      families.set(taskId, set)
    }

    const groups = new Map()
    for (const series of (result && result.series) || []) {
      const tags = seriesTags(series)
      const taskId = String(tags.task_id || "").trim()
      if (!taskId) continue
      const key = [taskId, tags.family || "", tags.protocol || "", tags.role || ""].join("|")
      const group = groups.get(key) || { taskId, task: taskMap.get(taskId), tags, success: null, latency: null, loss: null }
      if (series.metric_key === "ping.success_latency_ms") group.success = series
      else if (series.metric_key === "ping.latency_ms") group.latency = series
      else if (series.metric_key === "ping.loss") group.loss = series
      groups.set(key, group)
      noteFamily(taskId, tags.family)
    }

    const chartGroups = []
    for (const group of groups.values()) {
      const source = group.success || group.latency
      if (!source) continue
      const values = seriesPoints(source)
      // 旧序列里失败样本是 -1；成功序列本来就不含它们。这里统一把负值当缺失。
      for (const [ts, value] of [...values]) if (value < 0) values.delete(ts)
      if (!values.size) continue
      chartGroups.push({ ...group, values, loss: group.loss ? seriesPoints(group.loss) : new Map() })
    }

    const assigned = pingTasksFor(tasks, uuid)
    if (!chartGroups.length) {
      // 指标库里没有 ping 序列（旧服务端 / 历史数据未迁移）：退回原始记录表。
      chartGroups.push(...(await pingRecordGroups(uuid, assigned)))
      for (const group of chartGroups) noteFamily(group.taskId, group.tags.family)
    }
    if (!chartGroups.length) {
      // 有 ping 任务、但两个数据源都没有样本：显示一张带说明的空图，而不是让图表
      // 静默消失 —— 否则读者无法区分“没有配置 ping”和“有配置但没数据”。
      if (assigned.length) {
        return { charts: [chart("ping latency ms", [], 60, [], pingMs, null, "no ping samples in this range", true)], error: "" }
      }
      return { charts: [], error: (result && result.error) || "" }
    }

    const order = (group) => [
      group.task ? group.task.weight ?? 0 : Number.MAX_SAFE_INTEGER,
      Number(group.taskId) || 0,
      group.tags.family || "",
      group.tags.protocol || "",
    ]
    chartGroups.sort((left, right) => {
      const a = order(left), b = order(right)
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
      return 0
    })

    const label = (group) => {
      const base = (group.task && group.task.name) || `task ${group.taskId}`
      const bits = []
      if (group.tags.role === "reference") bits.push("ref")
      const family = group.tags.family
      const familyCount = (families.get(group.taskId) || new Set()).size
      if (family && familyCount > 1) bits.push(family === "ipv6" ? "v6" : family === "ipv4" ? "v4" : family)
      const protocol = group.tags.protocol
      if (protocol && (!group.task || group.task.type !== protocol)) bits.push(protocol)
      return bits.length ? `${base} (${bits.join(" ")})` : base
    }

    const build = (pick, groups = chartGroups) => {
      const used = groups
        .map((group) => ({ group, points: pick(group) }))
        .filter((item) => item.points && item.points.size)
      if (!used.length) return null
      const times = [...new Set(used.flatMap((item) => [...item.points.keys()]))].sort((left, right) => left - right)
      const series = used.map((item, index) => ({
        name: label(item.group),
        color: PING_COLORS[index % PING_COLORS.length],
        v: times.map((ts) => (item.points.has(ts) ? item.points.get(ts) : null)),
      }))
      return { times, series, step: medianStep(times) }
    }

    const charts = []
    const latency = build((group) => group.values)
    if (latency) {
      charts.push(chart("ping latency ms", latency.times, latency.step, latency.series, pingMs, null, "", true))
    }
    // 丢包一直为 0 时不画一张平躺的 0% 图，只列真正丢过包的路径；
    // 一旦画了，就保留这些路径的 0% 桶，否则折线会断成几个孤立圆点，
    // 看不出「哪段时间正常、哪一段在丢」。
    const lossGroups = chartGroups.filter((group) => [...group.loss.values()].some((value) => value > 0))
    const loss = lossGroups.length
      ? build((group) => {
          const values = new Map()
          for (const [ts, value] of group.loss) values.set(ts, value * 100)
          return values
        }, lossGroups)
      : null
    if (loss) {
      charts.push(chart("ping loss %", loss.times, loss.step, loss.series, pingPct, 100, "", true))
    }
    return { charts, error: "" }
  }

  // `ping` 命令的现场诊断：把「任务 → 指标查询 → 原始记录」三段各自的实际情况打印出来。
  // 页面上「没有 ping 图」通常来自其中一个环节为空，这里不必让用户去翻开发者工具。
  async function printPingDiagnostics(node) {
    const lines = [span("dim", `host: ${node.name} (${node.id})   range ${winLabel(state.range)}`)]
    let tasks = []
    try {
      tasks = await rpc("public:getPublicPingTasks")
    } catch (e) {
      lines.push(span("err", `public:getPublicPingTasks failed: ${e.message}`))
    }
    const assigned = pingTasksFor(tasks, node.id)
    if (!assigned.length) {
      lines.push(span("warn", "no ping task assigned to this host"))
      tasks.slice(0, 8).forEach((task) => lines.push(span("dim", `  task ${task.id} ${task.name}: clients=${(task.clients || []).length} default_on=${!!task.default_on}`)))
    } else {
      for (const task of assigned) lines.push(`  task ${task.id}  ${task.name}  (${task.type}, ${task.interval}s)`)
    }
    const metrics = await queryPingSeries(node.id, PING_METRIC_KEYS)
    if (metrics.error) {
      lines.push(span("err", `queryMetrics: ${metrics.error}`))
      const fallback = await queryPingSeries(node.id, PING_FALLBACK_KEYS)
      if (fallback.error) lines.push(span("err", `queryMetrics (legacy keys): ${fallback.error}`))
      else lines.push(`queryMetrics (legacy keys): ${(fallback.series || []).length} series`)
    } else {
      const series = Array.isArray(metrics.series) ? metrics.series : []
      const points = series.reduce((total, item) => total + (Array.isArray(item.points) ? item.points.length : 0), 0)
      lines.push(`queryMetrics: ${series.length} series, ${points} points`)
      for (const item of series.slice(0, 10)) {
        lines.push(span("dim", `  ${item.metric_key}  ${JSON.stringify(item.tags || {})}  ${(item.points || []).length} pts`))
      }
    }
    for (const task of assigned.slice(0, 8)) {
      const res = await apiGet(`/api/records/ping?uuid=${encodeURIComponent(node.id)}&task_id=${encodeURIComponent(task.id)}&hours=${state.range}`).catch(() => null)
      lines.push(`records/ping task ${task.id}: ${res && Array.isArray(res.records) ? res.records.length : 0} records`)
    }
    print("ping", ...lines)
  }

  async function loadCharts() {
    if (!detail || document.hidden) return
    const d = detail
    const n = state.nodes.find((x) => x.id === d.id)
    const points = Math.max(60, Math.min(1440, Math.round((d.charts.clientWidth || 800) / 2)))
    if (!d.charts.childElementCount) d.charts.append(h("div", { class: "term dim" }, "collecting samples…"))
    const [res, ping] = await Promise.all([
      apiGet(`/api/records/load?uuid=${encodeURIComponent(d.id)}&hours=${state.range}&load_type=all`)
        .catch((e) => ({ error: e.message })),
      loadPingCharts(d.id),
    ])
    if (detail !== d) return
    // /api/records/load 按请求跨度自动选择分辨率（分钟/5 分钟/小时/天桶），这里再按
    // 图表宽度抽一层，保证一条折线的点数与像素数同量级。
    const raw = Array.isArray(res.records) ? res.records : []
    const stride = raw.length > points ? Math.ceil(raw.length / points) : 1
    const rows = []
    for (let i = 0; i < raw.length; i += stride) {
      const r = raw[i]
      if (!r) continue
      const ts = Date.parse(r.time) / 1000
      if (!isFinite(ts)) continue
      rows.push({
        ts,
        cpu: r.cpu,
        mem_used: r.ram,
        mem_total: r.ram_total,
        swap_used: r.swap,
        disk_used: r.disk,
        disk_total: r.disk_total,
        net_rx: r.net_in,
        net_tx: r.net_out,
      })
    }
    rows.sort((a, b) => a.ts - b.ts)
    const last = rows[rows.length - 1] || {}
    const step = rows.length > 1 ? Math.max(1, Math.round((rows[rows.length - 1].ts - rows[0].ts) / (rows.length - 1))) : 60
    const t = rows.map((r) => r.ts)
    const memTotal = n?.mem_total || last.mem_total || n?.metrics?.mem_total || 0
    const diskTotal = n?.disk_total || last.disk_total || n?.metrics?.disk_total || 0
    const swapTotal = n?.swap_total || n?.metrics?.swap_total || 0
    const pct = (v) => v.toFixed(2)
    const charts = [
      chart("%user", t, step, [{ name: "avg", color: "var(--fg)", v: rows.map((r) => r.cpu) }],
        pct, 100, res.error),
      chart("%memused", t, step, [{ name: "mem", color: "var(--fg)", v: rows.map((r) => (memTotal ? pctOf(r.mem_used, memTotal) : null)) },
        swapTotal && rows.some((r) => r.swap_used != null) ? { name: "swap", color: "var(--warn)", v: rows.map((r) => pctOf(r.swap_used, swapTotal)) } : null],
      pct, 100, res.error),
      chart("rxkB/s txkB/s", t, step, [{ name: "rx", color: "var(--fg)", v: rows.map((r) => r.net_rx) },
        { name: "tx", color: "var(--accent)", v: rows.map((r) => r.net_tx) }], iecRate, null, res.error),
      chart("%diskused", t, step, [{ name: "/", color: "var(--fg)", v: rows.map((r) => (diskTotal ? pctOf(r.disk_used, diskTotal) : null)) }],
        pct, 100, res.error),
    ]
    for (const extra of ping.charts) charts.push(extra)
    put(d.charts, ...charts)
  }

  function chart(title, ts, step, series, fmt, fixedMax, error, wide) {
    series = series.filter(Boolean)
    // ping 图可能同时有多条任务/地址族折线，图例较长；让它横跨整个 charts 网格，
    // 否则半宽列里标题会被挤成两行、压到折线上。
    const box = h("section", { class: "chart" + (wide ? " wide" : "") })
    const all = series.flatMap((x) => x.v).filter((v) => v != null && isFinite(v))
    box.append(h("div", { class: "head" }, span("t", title),
      h("span", { class: "legend" }, series.map((x) => h("span", null, h("i", { style: { background: x.color } }), x.name))),
      span("grow"), all.length ? span("peak num", "max " + fmt(Math.max(...all))) : null))
    if (error) { box.append(h("div", { class: "msg err" }, "sar: " + error)); return box }
    if (ts.length < 2) { box.append(h("div", { class: "msg" }, "sar: no samples in this range")); return box }

    const W = 600, H = 130, T = 4, Bt = H - 2
    const max = fixedMax ?? Math.max(1, ...all) * 1.15
    const t0 = ts[0], t1 = ts.at(-1)
    const X = (x) => ((x - t0) / Math.max(1, t1 - t0)) * W
    const Y = (v) => Bt - (Math.min(v, max) / max) * (Bt - T)
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none" })
    for (const f of [0, 0.5, 1]) {
      svg.append(s("line", { class: "grid-line", x1: 0, x2: W, y1: Y(max * f), y2: Y(max * f), "vector-effect": "non-scaling-stroke" }))
    }
    const gapAt = step * 2.5
    for (const x of series) {
      let seg = []
      const flush = () => {
        if (seg.length === 1) svg.append(s("circle", { cx: seg[0][0], cy: seg[0][1], r: 1.2, fill: x.color }))
        else if (seg.length > 1) svg.append(s("polyline", {
          points: seg.map((pt) => pt.join(",")).join(" "), fill: "none", stroke: x.color,
          "stroke-width": 1.25, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round",
        }))
        seg = []
      }
      x.v.forEach((v, i) => {
        if (v == null || !isFinite(v)) { flush(); return }
        if (i > 0 && ts[i] - ts[i - 1] > gapAt) flush()
        seg.push([X(ts[i]).toFixed(1), Y(v).toFixed(1)])
      })
      flush()
    }
    const cursor = s("line", { y1: T, y2: Bt, stroke: "var(--dim)", "stroke-dasharray": "2 3", "vector-effect": "non-scaling-stroke", visibility: "hidden" })
    svg.append(cursor)

    const tip = h("div", { class: "tip num", hidden: true })
    const range = t1 - t0
    svg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect()
      const at = t0 + ((e.clientX - r.left) / r.width) * range
      let i = 0
      for (let k = 1; k < ts.length; k++) if (Math.abs(ts[k] - at) < Math.abs(ts[i] - at)) i = k
      cursor.setAttribute("x1", X(ts[i])); cursor.setAttribute("x2", X(ts[i])); cursor.setAttribute("visibility", "visible")
      put(tip, h("div", { class: "dim" }, stamp(ts[i], range, true)),
        ...series.map((x) => h("div", null, h("span", { style: { color: x.color } }, x.name.padEnd(5)),
          x.v[i] == null ? span("dim", "-") : fmt(x.v[i]))))
      tip.hidden = false
      const left = e.clientX - box.getBoundingClientRect().left
      tip.style.left = Math.max(4, Math.min(left + 14, box.clientWidth - tip.offsetWidth - 4)) + "px"
    })
    svg.addEventListener("pointerleave", () => { tip.hidden = true; cursor.setAttribute("visibility", "hidden") })
    box.append(svg, h("div", { class: "axis num" }, span(null, stamp(t0, range)), span(null, stamp(t0 + range / 2, range)), span(null, stamp(t1, range))), tip)
    return box
  }
  function stamp(sec, range, full) {
    const d = new Date(sec * 1000)
    const hm = `${p2(d.getHours())}:${p2(d.getMinutes())}`
    return range >= 86400 || full ? `${MONTHS[d.getMonth()]} ${d.getDate()} ${hm}` : hm
  }

  function readRoute() {
    const m = /^\/node\/([^/]+)\/?$/.exec(location.pathname)
    return m ? decodeURIComponent(m[1]) : null
  }
  function go(id) {
    const path = id == null ? "/" : `/node/${id}`
    if (location.pathname !== path) history.pushState(null, "", path)
    state.route = id
    if (id == null) { clearInterval(detail?.timer); detail = null }
    hideOut()
    renderAll()
    if (id == null) window.scrollTo(0, 0)
  }
  addEventListener("popstate", () => {
    state.route = readRoute()
    if (state.route == null) { clearInterval(detail?.timer); detail = null }
    renderAll()
  })

  function renderAll() {
    renderBar()
    renderNotice()
    if (state.route == null) { detail = null; renderHome() } else { home = null; renderDetail() }
  }

  const past = []
  let pastIdx = -1
  function hideOut() { el.out.hidden = true; put(el.out) }
  function print(cmd, ...lines) {
    el.out.hidden = false
    put(el.out, ps("~", cmd), h("div", { class: "term" }, lines.map((l) => line(l))),
      h("div", { class: "hint dim" }, h("button", { class: "link", onclick: hideOut }, "clear"), "  or press Esc"))
    el.out.scrollIntoView({ block: "end", behavior: "smooth" })
  }
  const runBtn = (text, cmd) => h("button", { class: "link", onclick: () => run(cmd ?? text) }, text)
  function findNode(q) {
    if (!q || !state.nodes) return null
    const ql = q.toLowerCase()
    return state.nodes.find((n) => String(n.id) === q) || state.nodes.find((n) => n.name.toLowerCase() === ql || nodeHost(n) === ql)
      || state.nodes.find((n) => n.name.toLowerCase().startsWith(ql) || nodeHost(n).startsWith(ql))
      || state.nodes.find((n) => n.name.toLowerCase().includes(ql))
  }
  const HELP = [
    ["ssh <server>", "open a server (a prefix is enough; Tab completes)"],
    ["grep <text>", "filter servers as you type; Esc clears the filter"],
    ["cd <group>", "switch group; cd ~ shows every server"],
    ["htop", "server panes"],
    ["top", "process-table view"],
    ["sort <key>", Object.keys(SORTS).join(" | ") + " | off"],
    ["theme [name]", PALETTES.map((p) => p.id).join(" | ")],
    ["ping [server]", "diagnose the ping chart: tasks, metric series, raw records"],
    ["clear", "clear this output"],
  ]
  const COMMANDS = {
    help: () => print("help", span("dim", `GNU bash-ish, version ${VERSION}. Enter runs a command; any other word filters the servers.`), "",
      ...HELP.map(([usage, desc]) => {
        const name = usage.split(" ")[0]
        return h("span", null, runBtn(name), usage.slice(name.length).padEnd(18 - name.length), span("dim", desc))
      })),
    ssh: (args) => {
      const n = findNode(args.join(" "))
      if (n) go(n.id)
      else print("ssh " + args.join(" "), span("err", `ssh: Could not resolve hostname ${args.join(" ") || "''"}: Name or service not known`))
    },
    cat: (args) => COMMANDS.ssh(args),
    open: (args) => COMMANDS.ssh(args),
    grep: (args) => { setFilter(args.join(" ")); if (state.route != null) go(null) },
    ls: (args) => COMMANDS.grep(args),
    cd: (args) => {
      const g = args.join(" ")
      if (!g || g === "~" || g === "/" || g === "..") { state.group = null; go(null); return }
      const groups = groupsOf(state.nodes || [])
      const hit = groups.find((x) => x === g) || groups.find((x) => x.toLowerCase().startsWith(g.toLowerCase()))
      if (hit) { state.group = hit; go(null) }
      else if (g.toLowerCase() === "ungrouped") { state.group = ""; go(null) }
      else print("cd " + g, span("err", `bash: cd: ${g}: No such file or directory`))
    },
    htop: () => { setView("grid"); if (state.route != null) go(null) },
    top: () => { setView("list"); if (state.route != null) go(null) },
    sort: (args) => {
      const k = args[0]
      if (!k || k === "off") setSort("")
      else if (SORTS[k]) setSort(k)
      else print("sort " + k, span("err", `sort: invalid key '${k}'; try ` + Object.keys(SORTS).join(", ")))
    },
    theme: (args) => {
      if (!state.cfg.allow_switch) return print("theme", span("err", "theme: palette switching is disabled on this host"))
      const p = PALETTES.find((x) => x.id === args[0])
      if (p) { setPalette(p.id); return }
      const cur = document.documentElement.dataset.palette
      print("theme" + (args[0] ? " " + args[0] : ""), ...PALETTES.map((x) => h("span", null, x.id === cur ? "* " : "  ", runBtn(x.id, "theme " + x.id))))
    },
    clear: () => hideOut(),
    exit: () => { hideOut(); go(null); el.cmd.blur() },
    logout: () => COMMANDS.exit(),
    whoami: () => print("whoami", user()),
    hostname: () => print("hostname", host()),
    uptime: () => print("uptime", topSummary(state.nodes || []).firstChild.textContent.replace(/^top - /, " ")),
    ping: (args) => {
      const node = args.length
        ? findNode(args.join(" "))
        : state.route != null
          ? (state.nodes || []).find((item) => item.id === state.route)
          : null
      if (!node) return print("ping", span("err", "ping: ssh into a server first, or: ping <server>"))
      printPingDiagnostics(node)
    },
    admin: () => { location.href = "/admin" },
  }
  const QUIET = new Set(["grep", "ls"])
  function setFilter(q) { state.filter = q; if (state.route == null) renderHome() }
  function run(line_) {
    const raw = line_.trim()
    if (!raw) return
    past.unshift(raw); if (past.length > 50) past.pop(); pastIdx = -1
    const [name, ...args] = raw.split(/\s+/)
    el.cmd.value = ""
    if (COMMANDS[name]) {
      if (!QUIET.has(name)) state.filter = ""
      COMMANDS[name](args)
      if (state.route == null) renderHome()
      return
    }

    state.filter = raw
    const list = shown()
    if (list.length === 1) { state.filter = ""; go(list[0].id) }
    else if (!list.length) {
      state.filter = ""
      print(raw, span("err", `bash: ${name}: command not found`), span("dim", "try 'help', or type part of a server name"))
      if (state.route == null) renderHome()
    } else if (state.route != null) go(null)
    else renderHome()
  }
  el.cli.addEventListener("submit", (e) => { e.preventDefault(); run(el.cmd.value) })
  el.cmd.addEventListener("input", () => {

    const m = /^(?:grep|ls)\s+(.*)$/.exec(el.cmd.value)
    if (!m) return
    state.filter = m[1].trim()
    if (state.route == null) renderHome()
  })
  el.cmd.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { el.cmd.value = ""; state.filter = ""; hideOut(); if (state.route == null) renderHome(); else go(null) }
    else if (e.key === "ArrowUp" && past.length) { e.preventDefault(); pastIdx = Math.min(past.length - 1, pastIdx + 1); el.cmd.value = past[pastIdx] }
    else if (e.key === "ArrowDown") { e.preventDefault(); pastIdx = Math.max(-1, pastIdx - 1); el.cmd.value = pastIdx < 0 ? "" : past[pastIdx] }
    else if (e.key === "Tab") { e.preventDefault(); complete() }
    else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); hideOut() }
  })
  function complete() {
    const v = el.cmd.value
    const parts = v.split(/\s+/)
    let pool, prefix
    if (parts.length <= 1) { pool = Object.keys(COMMANDS); prefix = parts[0] }
    else {
      const cmd = parts[0]
      prefix = parts.slice(1).join(" ")
      pool = cmd === "cd" ? groupsOf(state.nodes || []) : cmd === "theme" ? PALETTES.map((p) => p.id)
        : cmd === "sort" ? Object.keys(SORTS) : (state.nodes || []).map(nodeHost)
    }
    const hits = [...new Set(pool.filter((x) => x.toLowerCase().startsWith(prefix.toLowerCase())))]
    if (!hits.length) return
    let common = hits[0]
    for (const x of hits) while (!x.toLowerCase().startsWith(common.toLowerCase())) common = common.slice(0, -1)
    const done = hits.length === 1 ? hits[0] + " " : common
    el.cmd.value = parts.length <= 1 ? done : parts[0] + " " + done
    if (hits.length > 1) print(v, hits.slice(0, 60).join("   "))
  }

  addEventListener("keydown", (e) => {
    if (e.target === el.cmd || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.target instanceof HTMLElement && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return
    if (e.key === "Escape") { if (!el.out.hidden) hideOut(); else if (state.route != null) go(null); return }
    if (e.key === "/") { e.preventDefault(); el.cmd.focus(); return }
    if (e.key.length === 1 && e.key !== " ") el.cmd.focus()
  })

  state.route = readRoute()
  applyPalette()

  // 私有站点把匿名调用挡在 JSON-RPC 里（HTTP 仍是 200），所以登录提示不能只看
  // 状态码：服务端那句 "Private site enabled, please login first" 同样要给出入口。
  const needsLogin = (e) =>
    e.status === 401 || e.status === 403 || /login|private|permission|unauthor/i.test(e.message || "")

  function showBootError(e) {
    state.error = e.message
    home = null
    put(el.screen, h("div", { class: "term" }, ps("~", "top", "-bn1"),
      line(span("err", "top: " + e.message)),
      needsLogin(e)
        ? line(h("a", { class: "link", href: "/admin" }, "sign in →"))
        : line(span("dim", "retrying…"))))
    renderBar()
  }

  async function start() {
    const { publicSettings, me } = await loadSite()
    state.publicSettings = publicSettings
    state.me = {
      authed: !!(me && me.logged_in),
      username: (me && me.username) || "Guest",
      site_name: (publicSettings && publicSettings.sitename) || "",
      history_days: historyDays(publicSettings),
    }
    state.cfg = coerceConfig(publicSettings && publicSettings.theme_settings)
    applyPalette()

    // 节点列表是唯一硬依赖：拿不到就整页只报这一条错误，而不是显示一张空面板。
    state.nodes = await loadNodes()
    indexHosts(state.nodes)
    state.error = ""
    renderAll()
    loadDayTraffic(state.nodes)
    setInterval(() => loadDayTraffic(state.nodes), TRAFFIC_INTERVAL)

    live((nodes) => {
      state.nodes = nodes
      state.error = ""
      renderAll()

      if (!animReady) setTimeout(() => {
        animReady = true
        document.documentElement.classList.add("anim")
      }, 300)
    }, (e) => {
      state.error = e.message
      if (!state.nodes) showBootError(e)
      else renderBar()
    })
  }

  boot()
  renderBar()

  async function boot() {
    try {
      await start()
    } catch (e) {
      showBootError(e)
      setTimeout(boot, 5000)
    }
  }
})()





