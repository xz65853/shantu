'use client'

import { useEffect, useState } from 'react'

type Row = {
  id: number
  name: string
  icon: string | null
  description: string | null
  enabled: boolean
  fieldsConfig: string | null
  reportConfig: string | null
  sort: number
}

const PRESETS = [
  { label: '代运营', fields: [
    { name: '发布视频数', type: 'number', unit: '条', required: true },
    { name: '直播场次', type: 'number', unit: '场' },
    { name: '播放量', type: 'number', unit: '次' },
    { name: '新粉丝', type: 'number', unit: '人' },
    { name: '咨询数', type: 'number', unit: '个' },
    { name: 'GMV', type: 'number', unit: '元' },
    { name: '文字总结', type: 'textarea', required: true },
  ]},
  { label: '平面设计', fields: [
    { name: '完成稿数', type: 'number', unit: '张' },
    { name: '修改稿数', type: 'number', unit: '张' },
    { name: '设计类型', type: 'multiselect', options: ['海报','详情页','LOGO','朋友圈'] },
    { name: '设计稿预览', type: 'image' },
    { name: '文字总结', type: 'textarea' },
  ]},
  { label: '开发', fields: [
    { name: '今日进度', type: 'percent' },
    { name: '完成功能点', type: 'textarea' },
    { name: '修复bug', type: 'number' },
    { name: '界面截图', type: 'image' },
  ]},
]

export function ServiceTypesManager() {
  const [list, setList] = useState<Row[]>([])
  const [editing, setEditing] = useState<Partial<Row> | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const r = await fetch('/api/admin/service-types')
    const j = await r.json()
    if (j.code === 0) setList(j.data)
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setLoading(true)
    try {
      const url = editing.id ? `/api/admin/service-types/${editing.id}` : '/api/admin/service-types'
      const r = await fetch(url, {
        method: editing.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const j = await r.json()
      if (j.code === 0) { setEditing(null); load() }
      else alert(j.message || '保存失败')
    } finally { setLoading(false) }
  }

  async function remove(id: number) {
    if (!confirm('确认删除该服务类型？已绑定的套餐会失去类型。')) return
    await fetch(`/api/admin/service-types/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm" style={{ color: '#5B6B82' }}>配置服务类型，新增套餐时选择；日报/月报字段按此配置动态渲染。</p>
        <button onClick={() => setEditing({ enabled: true, sort: 0, fieldsConfig: '[]', reportConfig: '{}' })}
          className="rounded-lg px-3 py-2 text-xs font-medium text-white"
          style={{ background: '#3B6EF5' }}>
          + 新增服务类型
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border" style={{ background: '#fff', borderColor: '#E8ECF2' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#FAFBFD', color: '#9AA7B8', fontSize: 12 }}>
              <th className="px-4 py-2.5 text-left font-medium">排序</th>
              <th className="px-4 py-2.5 text-left font-medium">类型名称</th>
              <th className="px-4 py-2.5 text-left font-medium">描述</th>
              <th className="px-4 py-2.5 text-left font-medium">日报字段数</th>
              <th className="px-4 py-2.5 text-left font-medium">状态</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              let fieldCount = 0
              try { fieldCount = JSON.parse(r.fieldsConfig || '[]').length } catch {}
              return (
                <tr key={r.id} className="border-t" style={{ borderColor: '#F0F3F8' }}>
                  <td className="px-4 py-3" style={{ color: '#9AA7B8' }}>{r.sort}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#1E2A3B' }}>{r.name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#5B6B82' }}>{r.description || '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#5B6B82' }}>{fieldCount} 个字段</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-xs" style={{
                      background: r.enabled ? '#E8F7F0' : '#F0F3F8',
                      color: r.enabled ? '#22A06B' : '#9AA7B8' }}>
                      {r.enabled ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="mr-3 text-xs" style={{ color: '#3B6EF5' }} onClick={() => setEditing(r)}>编辑</button>
                    <button className="text-xs" style={{ color: '#E5544B' }} onClick={() => remove(r.id)}>删除</button>
                  </td>
                </tr>
              )
            })}
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-xs" style={{ color: '#9AA7B8' }}>暂无服务类型，点右上角新增</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.4)' }}
          onClick={() => !loading && setEditing(null)}>
          <div className="max-h-[90vh] w-[640px] overflow-y-auto rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-base font-semibold">{editing.id ? '编辑服务类型' : '新增服务类型'}</h3>

            <label className="mb-1 block text-xs" style={{ color: '#5B6B82' }}>类型名称 *</label>
            <input className="mb-3 w-full rounded-lg border p-2 text-sm" style={{ borderColor: '#E8ECF2' }}
              value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="例：直播代播" />

            <label className="mb-1 block text-xs" style={{ color: '#5B6B82' }}>描述</label>
            <input className="mb-3 w-full rounded-lg border p-2 text-sm" style={{ borderColor: '#E8ECF2' }}
              value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />

            <label className="mb-1 block text-xs" style={{ color: '#5B6B82' }}>AI 语境描述（让 AI 知道这个服务该聊什么）</label>
            <textarea className="mb-3 w-full rounded-lg border p-2 text-xs" rows={2} style={{ borderColor: '#E8ECF2' }}
              value={editing.aiContext || ''} onChange={(e) => setEditing({ ...editing, aiContext: e.target.value })}
              placeholder="例：这是平面设计服务项目，AI 聊天时关注完成稿数、修改次数、设计风格和客户反馈，不要聊播放量涨粉。" />

            <div className="mb-3 flex items-center gap-2">
              <input type="checkbox" checked={editing.enabled !== false} id="en"
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />
              <label htmlFor="en" className="text-sm">启用</label>
            </div>

            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs" style={{ color: '#5B6B82' }}>日报字段配置（JSON 数组）</label>
              <div className="flex gap-1">
                {PRESETS.map((p) => (
                  <button key={p.label} type="button"
                    className="rounded px-2 py-0.5 text-xs" style={{ background: '#F4F6FA', color: '#3B6EF5' }}
                    onClick={() => setEditing({ ...editing, fieldsConfig: JSON.stringify(p.fields, null, 2) })}>
                    用{p.label}模板
                  </button>
                ))}
              </div>
            </div>
            <textarea className="mb-3 w-full rounded-lg border p-2 font-mono text-xs" rows={9} style={{ borderColor: '#E8ECF2' }}
              value={editing.fieldsConfig || ''}
              onChange={(e) => setEditing({ ...editing, fieldsConfig: e.target.value })}
              placeholder='[{"name":"发布视频数","type":"number","unit":"条","required":true}]' />

            <label className="mb-1 block text-xs" style={{ color: '#5B6B82' }}>月报汇总规则（JSON）</label>
            <textarea className="mb-4 w-full rounded-lg border p-2 font-mono text-xs" rows={4} style={{ borderColor: '#E8ECF2' }}
              value={editing.reportConfig || ''}
              onChange={(e) => setEditing({ ...editing, reportConfig: e.target.value })}
              placeholder='{"videos":"sum","gmv":"sum","summary":"omit"}' />

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: '#E8ECF2' }}>取消</button>
              <button onClick={save} disabled={loading}
                className="rounded-lg px-4 py-2 text-xs text-white disabled:opacity-60" style={{ background: '#3B6EF5' }}>
                {loading ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
