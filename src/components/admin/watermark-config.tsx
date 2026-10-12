'use client'

import { useEffect, useMemo, useState } from 'react'
import { useToast } from './toast'
import { Loader2, Eye, FileText, ImagePlus, Smartphone } from 'lucide-react'

type Cfg = Record<string, string>

const DEFAULTS: Cfg = {
  cwm_enable: '1', cwm_template: '{name} {idcard4} {timestamp}', cwm_font_size: '11', cwm_color: '#999999', cwm_opacity: '0.5', cwm_rotate: '-30', cwm_gap_x: '300', cwm_gap_y: '250',
  watermark_enable: '1', watermark_template: '{name} {phone4} {date}', watermark_guest_text: '演示数据', watermark_font_size: '12', watermark_color: '#c0c0c0', watermark_opacity: '0.2', watermark_rotate: '-30', watermark_gap_x: '300', watermark_gap_y: '250',
  upload_wm_enable: '1', upload_wm_text: '桃江闪途网络科技工作室', upload_wm_color: '#ffffff', upload_wm_opacity: '0.38', upload_wm_font_size: '30', upload_wm_rotate: '-24', upload_wm_gap_x: '420', upload_wm_gap_y: '240',
  article_wm_enable: '1', article_wm_text: '桃江闪途 · 原创',
  media_wm_enable: '1', media_wm_template: '内部资料 · {operator} {time}',
  order_wm_enable: '0',
  realname_wm_enable: '1', realname_wm_text: '仅供核对',
}

/** 变量说明 */
const VARS = [
  ['{name}', '当前客户姓名', '{{姓名}}'],
  ['{idcard4}', '身份证最后 4 位', '{{身份证后4位}}'],
  ['{phone4}', '手机最后 4 位', '{{手机号后4位}}'],
  ['{timestamp}', '合同生成时间 YYYY-MM-DD HH:mm', '{{时间戳}}'],
  ['{date}', '今天 YYYY-MM-DD', '{{日期}}'],
]

function escapeXml(s: string): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 生成斜纹平铺水印 SVG（实时预览用，与后端 buildSvg 同构；可选描边用于上传图片水印的白字黑边效果） */
function buildTile(text: string, cfg: { color: string; opacity: number; fontSize: number; gapX: number; gapY: number; rotate: number; strokeColor?: string; strokeOpacity?: number; fontFamily?: string }): string {
  const w = cfg.gapX
  const h = cfg.gapY
  const cx = Math.round(w / 2)
  const cy = Math.round(h / 2)
  const stroke = cfg.strokeColor
    ? ` stroke="${cfg.strokeColor}" stroke-opacity="${cfg.strokeOpacity ?? 0}" stroke-width="1"`
    : ''
  const ff = cfg.fontFamily || 'PingFang SC, Microsoft YaHei, sans-serif'
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<text x="${cx}" y="${cy}" font-size="${cfg.fontSize}" fill="${cfg.color}" fill-opacity="${cfg.opacity}"${stroke} ` +
    `font-family="${ff}" text-anchor="middle" dominant-baseline="middle" ` +
    `transform="rotate(${cfg.rotate} ${cx} ${cy})">${escapeXml(text)}</text></svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** 预览区：模拟一个斜纹平铺效果 */
function Preview({ text, color, opacity, fontSize, gapX, gapY, rotate, strokeColor, strokeOpacity, fontFamily }: { text: string; color: string; opacity: number; fontSize: number; gapX: number; gapY: number; rotate: number; strokeColor?: string; strokeOpacity?: number; fontFamily?: string }) {
  const bg = useMemo(() => {
    try {
      return buildTile(text || '水印预览', { color, opacity, fontSize, gapX: Math.max(40, gapX), gapY: Math.max(40, gapY), rotate, strokeColor, strokeOpacity, fontFamily })
    } catch {
      return ''
    }
  }, [text, color, opacity, fontSize, gapX, gapY, rotate, strokeColor, strokeOpacity, fontFamily])

  return (
    <div className="relative h-56 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* 模拟正文 */}
      <div className="absolute inset-0 p-4 text-slate-400">
        <div className="mb-2 h-3 w-2/3 rounded bg-slate-200" />
        <div className="mb-2 h-3 w-full rounded bg-slate-100" />
        <div className="mb-2 h-3 w-5/6 rounded bg-slate-100" />
        <div className="mb-2 h-3 w-3/4 rounded bg-slate-100" />
        <div className="mb-2 h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
      {/* 水印层 */}
      {bg && (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url("${bg}")`, backgroundSize: `${Math.max(40, gapX)}px ${Math.max(40, gapY)}px` }}
        />
      )}
    </div>
  )
}

/** 数字输入 */
function NumField({ label, value, onChange, min, max, step, error }: { label: string; value: string; onChange: (v: string) => void; min?: number; max?: number; step?: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 w-full rounded-lg border px-2 text-sm outline-none focus:border-blue-500 ${error ? 'border-red-400' : 'border-slate-200'}`}
      />
      {error ? <span className="mt-1 block text-xs text-red-500">{error}</span> : null}
    </label>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}

export function WatermarkConfig() {
  const [cfg, setCfg] = useState<Cfg>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const toast = useToast()

  useEffect(() => {
    fetch('/api/admin/watermark')
      .then((r) => r.json())
      .then((j) => {
        if (j && j.code === 0 && j.data) setCfg({ ...DEFAULTS, ...j.data })
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const set = (k: string, v: string) => setCfg((prev) => ({ ...prev, [k]: v }))

  // 保存前校验：非法值在字段下方红字提示，不 alert、不静默
  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    const numFields: Array<[string, number, number]> = [
      ['cwm_font_size', 6, 72], ['cwm_opacity', 0, 1], ['cwm_rotate', -90, 90], ['cwm_gap_x', 100, 800], ['cwm_gap_y', 100, 800],
      ['watermark_font_size', 6, 72], ['watermark_opacity', 0, 1], ['watermark_rotate', -90, 90], ['watermark_gap_x', 100, 800], ['watermark_gap_y', 100, 800],
      ['upload_wm_font_size', 6, 72], ['upload_wm_opacity', 0, 1], ['upload_wm_rotate', -90, 90], ['upload_wm_gap_x', 100, 800], ['upload_wm_gap_y', 100, 800],
    ]
    for (const [k, min, max] of numFields) {
      const raw = cfg[k]
      if (raw === '' || raw == null) { errs[k] = '必填'; continue }
      const n = Number(raw)
      if (!Number.isFinite(n)) { errs[k] = '请输入数字'; continue }
      if (n < min || n > max) { errs[k] = `范围 ${min}~${max}`; continue }
    }
    // 颜色格式校验：#RGB / #RRGGBB
    const colorFields = ['cwm_color', 'watermark_color', 'upload_wm_color']
    for (const k of colorFields) {
      const v = cfg[k] || ''
      if (!/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(v)) errs[k] = '颜色格式应为 #RRGGBB'
    }
    // 模板必填（开关开启时）
    if (cfg.cwm_enable !== '0' && !(cfg.cwm_template || '').trim()) errs['cwm_template'] = '内容模板不能为空'
    if (cfg.watermark_enable !== '0' && !(cfg.watermark_template || '').trim()) errs['watermark_template'] = '内容模板不能为空'
    if (cfg.upload_wm_enable !== '0' && !(cfg.upload_wm_text || '').trim()) errs['upload_wm_text'] = '水印文字不能为空'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const save = async () => {
    if (saving) return
    if (!validate()) {
      toast.error('保存失败：请检查标红的字段')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/admin/watermark', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      let j: { code?: number; message?: string } | null = null
      try { j = await r.json() } catch { j = null }
      if (j && j.code === 0) toast.success('保存成功')
      else toast.error('保存失败：' + ((j && j.message) || '服务器未返回有效响应（' + r.status + '）'))
    } catch {
      toast.error('保存失败：网络错误，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 合同水印预览文本（模拟真实变量代入）
  const cwmPreviewText = useMemo(() => {
    const t = cfg.cwm_template || '{name} {idcard4} {timestamp}'
    return t.replace(/\{name\}/g, '张伟').replace(/\{idcard4\}/g, '7239').replace(/\{timestamp\}/g, '2026-10-06 12:00')
  }, [cfg.cwm_template])

  // 小程序水印预览文本（已登录客户）
  const wmPreviewText = useMemo(() => {
    const t = cfg.watermark_template || '{name} {phone4} {date}'
    return t.replace(/\{name\}/g, '张伟').replace(/\{phone4\}/g, '6688').replace(/\{date\}/g, '2026-10-06')
  }, [cfg.watermark_template])

  // 上传图片水印预览文本
  const uploadWmPreviewText = useMemo(() => cfg.upload_wm_text || '桃江闪途网络科技工作室', [cfg.upload_wm_text])

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中…
      </div>
    )
  }

  const cwmOn = cfg.cwm_enable !== '0'
  const wmOn = cfg.watermark_enable !== '0'
  const upOn = cfg.upload_wm_enable !== '0'

  return (
    <div className="space-y-6">
      {/* ============ 一、合同 PDF 水印 ============ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-800">合同 PDF 水印</h3>
          </div>
          <Switch checked={cwmOn} onChange={(v) => set('cwm_enable', v ? '1' : '0')} />
        </div>
        <p className="mb-4 text-xs text-slate-500">客户签署的合同，水印为：客户姓名 + 身份证后4位 + 时间戳，防外传。</p>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* 左：表单 */}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">内容模板</span>
              <input
                type="text"
                value={cfg.cwm_template}
                disabled={!cwmOn}
                onChange={(e) => set('cwm_template', e.target.value)}
                className={`h-9 w-full rounded-lg border px-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50 ${errors.cwm_template ? 'border-red-400' : 'border-slate-200'}`}
              />
              {errors.cwm_template ? <span className="mt-1 block text-xs text-red-500">{errors.cwm_template}</span> : null}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="字号（px）" value={cfg.cwm_font_size} onChange={(v) => set('cwm_font_size', v)} min={6} max={72} error={errors.cwm_font_size} />
              <NumField label="不透明度（0~1）" value={cfg.cwm_opacity} onChange={(v) => set('cwm_opacity', v)} min={0} max={1} step="0.05" error={errors.cwm_opacity} />
              <NumField label="旋转角度（度）" value={cfg.cwm_rotate} onChange={(v) => set('cwm_rotate', v)} min={-90} max={90} error={errors.cwm_rotate} />
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">颜色</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cfg.cwm_color}
                    disabled={!cwmOn}
                    onChange={(e) => set('cwm_color', e.target.value)}
                    className={`h-9 w-12 cursor-pointer rounded border ${errors.cwm_color ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  <span className="text-sm text-slate-600">{cfg.cwm_color}</span>
                  {errors.cwm_color ? <span className="text-xs text-red-500">{errors.cwm_color}</span> : null}
                </div>
              </label>
              <NumField label="横向间距（px）" value={cfg.cwm_gap_x} onChange={(v) => set('cwm_gap_x', v)} min={100} max={800} error={errors.cwm_gap_x} />
              <NumField label="纵向间距（px）" value={cfg.cwm_gap_y} onChange={(v) => set('cwm_gap_y', v)} min={100} max={800} error={errors.cwm_gap_y} />
            </div>
            <p className="text-xs text-slate-400">每页条数按页面大小与间距自动计算。</p>
          </div>
          {/* 右：预览 */}
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs text-slate-500">
              <Eye className="h-3.5 w-3.5" /> 实时预览
            </div>
            <Preview text={cwmPreviewText} color={cfg.cwm_color} opacity={num(cfg.cwm_opacity, 0.5)} fontSize={num(cfg.cwm_font_size, 11)} gapX={num(cfg.cwm_gap_x, 300)} gapY={num(cfg.cwm_gap_y, 250)} rotate={num(cfg.cwm_rotate, -30)} />
          </div>
        </div>
      </div>

      {/* ============ 二、小程序水印 ============ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-800">小程序水印（案例 / 日报 / 月报）</h3>
          </div>
          <Switch checked={wmOn} onChange={(v) => set('watermark_enable', v ? '1' : '0')} />
        </div>
        <p className="mb-4 text-xs text-slate-500">小程序案例详情、项目日报、项目月报页面使用。未登录看案例显示「{cfg.watermark_guest_text || '演示数据'}」，已登录显示客户姓名 + 手机后4位 + 日期。</p>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">内容模板</span>
              <input
                type="text"
                value={cfg.watermark_template}
                disabled={!wmOn}
                onChange={(e) => set('watermark_template', e.target.value)}
                className={`h-9 w-full rounded-lg border px-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50 ${errors.watermark_template ? 'border-red-400' : 'border-slate-200'}`}
              />
              {errors.watermark_template ? <span className="mt-1 block text-xs text-red-500">{errors.watermark_template}</span> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">未登录访客水印文字</span>
              <input
                type="text"
                value={cfg.watermark_guest_text}
                disabled={!wmOn}
                onChange={(e) => set('watermark_guest_text', e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="字号（px）" value={cfg.watermark_font_size} onChange={(v) => set('watermark_font_size', v)} min={6} max={72} error={errors.watermark_font_size} />
              <NumField label="不透明度（0~1）" value={cfg.watermark_opacity} onChange={(v) => set('watermark_opacity', v)} min={0} max={1} step="0.05" error={errors.watermark_opacity} />
              <NumField label="旋转角度（度）" value={cfg.watermark_rotate} onChange={(v) => set('watermark_rotate', v)} min={-90} max={90} error={errors.watermark_rotate} />
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">颜色</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cfg.watermark_color}
                    disabled={!wmOn}
                    onChange={(e) => set('watermark_color', e.target.value)}
                    className={`h-9 w-12 cursor-pointer rounded border ${errors.watermark_color ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  <span className="text-sm text-slate-600">{cfg.watermark_color}</span>
                  {errors.watermark_color ? <span className="text-xs text-red-500">{errors.watermark_color}</span> : null}
                </div>
              </label>
              <NumField label="横向间距（px）" value={cfg.watermark_gap_x} onChange={(v) => set('watermark_gap_x', v)} min={100} max={800} error={errors.watermark_gap_x} />
              <NumField label="纵向间距（px）" value={cfg.watermark_gap_y} onChange={(v) => set('watermark_gap_y', v)} min={100} max={800} error={errors.watermark_gap_y} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs text-slate-500">
              <Eye className="h-3.5 w-3.5" /> 实时预览（已登录客户）
            </div>
            <Preview text={wmPreviewText} color={cfg.watermark_color} opacity={num(cfg.watermark_opacity, 0.2)} fontSize={num(cfg.watermark_font_size, 12)} gapX={num(cfg.watermark_gap_x, 300)} gapY={num(cfg.watermark_gap_y, 250)} rotate={num(cfg.watermark_rotate, -30)} />
          </div>
        </div>
      </div>

      {/* ============ 上传图片水印 ============ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-800">上传图片水印（案例 / 日报 / 月报）</h3>
          </div>
          <Switch checked={upOn} onChange={(v) => set('upload_wm_enable', v ? '1' : '0')} />
        </div>
        <p className="mb-4 text-xs text-slate-500">管理后台在案例「项目图片」、日报「工作截图」、月报「运营截图」上传时，把水印烧录进图片（防盗图）。保存后立即生效，无需重启。</p>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">水印文字内容</span>
              <input
                type="text"
                value={cfg.upload_wm_text}
                disabled={!upOn}
                onChange={(e) => set('upload_wm_text', e.target.value)}
                className={`h-9 w-full rounded-lg border px-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50 ${errors.upload_wm_text ? 'border-red-400' : 'border-slate-200'}`}
              />
              {errors.upload_wm_text ? <span className="mt-1 block text-xs text-red-500">{errors.upload_wm_text}</span> : null}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="字号（px）" value={cfg.upload_wm_font_size} onChange={(v) => set('upload_wm_font_size', v)} min={6} max={72} error={errors.upload_wm_font_size} />
              <NumField label="不透明度（0~1）" value={cfg.upload_wm_opacity} onChange={(v) => set('upload_wm_opacity', v)} min={0} max={1} step="0.05" error={errors.upload_wm_opacity} />
              <NumField label="旋转角度（度）" value={cfg.upload_wm_rotate} onChange={(v) => set('upload_wm_rotate', v)} min={-90} max={90} error={errors.upload_wm_rotate} />
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">颜色</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cfg.upload_wm_color}
                    disabled={!upOn}
                    onChange={(e) => set('upload_wm_color', e.target.value)}
                    className={`h-9 w-12 cursor-pointer rounded border ${errors.upload_wm_color ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  <span className="text-sm text-slate-600">{cfg.upload_wm_color}</span>
                  {errors.upload_wm_color ? <span className="text-xs text-red-500">{errors.upload_wm_color}</span> : null}
                </div>
              </label>
              <NumField label="横向间距（px）" value={cfg.upload_wm_gap_x} onChange={(v) => set('upload_wm_gap_x', v)} min={100} max={800} error={errors.upload_wm_gap_x} />
              <NumField label="纵向间距（px）" value={cfg.upload_wm_gap_y} onChange={(v) => set('upload_wm_gap_y', v)} min={100} max={800} error={errors.upload_wm_gap_y} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs text-slate-500">
              <Eye className="h-3.5 w-3.5" /> 实时预览
            </div>
            <Preview text={uploadWmPreviewText} color={cfg.upload_wm_color} opacity={num(cfg.upload_wm_opacity, 0.38)} fontSize={num(cfg.upload_wm_font_size, 30)} gapX={num(cfg.upload_wm_gap_x, 420)} gapY={num(cfg.upload_wm_gap_y, 240)} rotate={num(cfg.upload_wm_rotate, -24)} fontFamily="Noto Sans CJK SC, sans-serif" />
          </div>
        </div>
      </div>

      {/* ============ 三、其他水印开关 ============ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-base font-semibold text-slate-800">其他场景水印</h3>
        <p className="mb-4 text-xs text-slate-500">这些开关控制各模块是否显示水印；全部关闭则对应页面不显示。</p>

        <div className="divide-y divide-slate-100">
          {/* 文章 */}
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium text-slate-700">文章 / 博客</div>
              <div className="text-xs text-slate-500">固定文案「{cfg.article_wm_text || '桃江闪途 · 原创'}」，防抄袭</div>
            </div>
            <Switch checked={cfg.article_wm_enable !== '0'} onChange={(v) => set('article_wm_enable', v ? '1' : '0')} />
          </div>
          {/* 素材库 */}
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium text-slate-700">素材库</div>
              <div className="text-xs text-slate-500">仅后台查看时显示「内部资料 · 操作人 时间」</div>
            </div>
            <Switch checked={cfg.media_wm_enable !== '0'} onChange={(v) => set('media_wm_enable', v ? '1' : '0')} />
          </div>
          {/* 订单 */}
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium text-slate-700">订单详情 / 对账单</div>
              <div className="text-xs text-slate-500">客户姓名 + 手机后4位（财务数据，默认关闭）</div>
            </div>
            <Switch checked={cfg.order_wm_enable !== '0'} onChange={(v) => set('order_wm_enable', v ? '1' : '0')} />
          </div>
          {/* 实名 */}
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium text-slate-700">会员实名身份证图片</div>
              <div className="text-xs text-slate-500">仅后台查看，身份证图上打「{cfg.realname_wm_text || '仅供核对'}」</div>
            </div>
            <Switch checked={cfg.realname_wm_enable !== '0'} onChange={(v) => set('realname_wm_enable', v ? '1' : '0')} />
          </div>
        </div>
      </div>

      {/* ============ 变量说明 + 保存 ============ */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h4 className="mb-2 text-sm font-semibold text-slate-700">模板可用变量</h4>
        <div className="mb-4 flex flex-wrap gap-2">
          {VARS.map(([k, desc, cn]) => (
            <span key={k} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
              <code className="font-mono text-blue-600">{k}</code>
              <span className="ml-1 text-slate-500">= {desc}</span>
              {cn ? <span className="ml-1 text-slate-400">（{cn}）</span> : null}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存设置
          </button>

        </div>
      </div>
    </div>
  )
}
