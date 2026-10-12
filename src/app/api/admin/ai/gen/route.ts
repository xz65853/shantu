import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { chatCompletion, type AiScene } from '@/lib/ai'
import { rateLimited, clientIp } from '@/lib/rate-limit'
import { getSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

/**
 * 后台 AI 通用生成接口
 * POST /api/admin/ai/gen  { scene, data }
 * scene: article_write | case_write | dashboard_brief | daily_fill | title_suggest
 */
export async function POST(req: NextRequest) {
  let admin
  try {
    admin = await requireAdmin()
  } catch {
    return NextResponse.json({ code: 401, message: '未登录' }, { status: 401 })
  }

  let body: { scene?: string; data?: Record<string, unknown>; serviceTypeId?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 400, message: '参数错误' }, { status: 400 })
  }

  // 限流：从后台配置读取，默认每分钟3次
  const allSettings = await getSettings();
  let aiLimitPerMinute = 3;
  try {
    const cfg = JSON.parse(allSettings.ai_rate_limit || '{}');
    aiLimitPerMinute = Number(cfg[body.scene || '']) || Number(cfg.default) || 3;
  } catch {}
  const ip = clientIp(req);
  if (rateLimited(`ai:${admin.id}:${body.scene||"unknown"}`, aiLimitPerMinute, 60_000)) {
    return NextResponse.json({ code: 429, message: `该功能每分钟最多${aiLimitPerMinute}次，请稍后再试` }, { status: 429 });
  }
  if (rateLimited(`ai-ip:${ip}`, aiLimitPerMinute * 3, 60_000)) {
    return NextResponse.json({ code: 429, message: '操作太频繁，请稍后再试' }, { status: 429 });
  }

  const scene = body.scene as AiScene
  const d = body.data || {}
  let system = ''
  let user = ''

  try {
    // 根据服务类型动态拼 AI 语境
    let serviceContext = ''
    if (body.serviceTypeId) {
      const st = await prisma.serviceType.findUnique({ where: { id: Number(body.serviceTypeId) } }).catch(() => null)
      if (st) {
        let fieldNames: string[] = []
        try { fieldNames = (JSON.parse(st.fieldsConfig || '[]') as { name: string }[]).map((f) => f.name) } catch {}
        serviceContext = `\n【服务类型】当前客户购买的是「${st.name}」服务。`
        if (fieldNames.length) serviceContext += `这类服务日报/月报关注这些指标：${fieldNames.join('、')}。`
        if (st.aiContext) serviceContext += `\n${st.aiContext}`
        serviceContext += '\n回答时紧扣这个服务类型的场景和指标，不要聊不相关的内容。'
      }
    }
    if (scene === 'article_write') {
      const topic = String(d.topic || '').trim()
      if (!topic) return NextResponse.json({ code: 400, message: '请输入文章主题' })
      const keywords = String(d.keywords || '').trim()
      const length = Number(d.length) || 1500
      const style = String(d.style || '专业科普')
      system = '你是桃江闪途网络的资深内容运营，擅长写商家抖音/本地生活方向的干货文章。输出用 Markdown，标题精炼，正文分小节，口语化但专业，不编数据。'
      user = `请写一篇文章：
主题：${topic}
关键词：${keywords}
字数：约${length}字
风格：${style}
要求：
1. 先给3个备选标题（每行一个，以【标题1】【标题2】【标题3】开头）
2. 空一行后给出正文，正文用## 分2-4个小节，每节有小标题
3. 结尾给一句行动建议
4. 不要写"作为AI"这类话`
    } else if (scene === 'case_write') {
      const industry = String(d.industry || '').trim()
      const period = String(d.period || '').trim()
      const metrics = String(d.metrics || '').trim()
      if (!industry) return NextResponse.json({ code: 400, message: '请输入客户行业' })
      system = '你是案例包装专家，写出来的案例要真实、有数据感，不夸大。输出 Markdown。'
      user = `请写一个服务案例：
客户行业：${industry}
服务周期：${period}
关键数据：${metrics || '（客户未提供具体数据，用合理占位如「[填写真实数据]」）'}
结构要求：
【案例标题】一行，突出结果
## 客户痛点
## 我们的方案
## 执行过程
## 成果数据
结尾一句话总结。数据部分如果没给，用 [ ] 占位让运营补。`
    } else if (scene === 'daily_fill') {
      const raw = String(d.raw || '').trim()
      if (!raw) return NextResponse.json({ code: 400, message: '先简单写两句今天做了什么' })
      system = '你是运营助理，把运营手写的碎碎念扩写成结构清晰的日报，不编造具体数字。'
      user = `运营今天随手记的内容：${raw}
请扩写成完整日报，分三部分：
## 今日完成
## 数据与进展（没有数据就写"待补充"，不要编数字）
## 明日计划
语气务实，300字以内。`
    } else if (scene === 'title_suggest') {
      const content = String(d.content || '').trim()
      if (!content) return NextResponse.json({ code: 400, message: '没有正文可参考' })
      system = '你是爆款标题策划，基于正文生成吸引点击但不标题党。'
      user = `正文如下，请生成5个备选标题，每行一个：\n${content.slice(0, 1500)}`
    } else if (scene === 'dashboard_brief') {
      // 服务端自己取真实数据
      const now = new Date()
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const [pendingOrders, paidOrders, pendingContracts, pendingLeads, newLeads, activeProjects] = await Promise.all([
        prisma.order.count({ where: { status: 'PENDING', deletedAt: null } }).catch(() => 0),
        prisma.order.count({ where: { status: 'PAID', deletedAt: null } }).catch(() => 0),
        prisma.contract.count({ where: { status: 'PENDING', deletedAt: null } }).catch(() => 0),
        prisma.lead.count({ where: { status: 'PENDING', deletedAt: null } }).catch(() => 0),
        prisma.lead.count({ where: { createdAt: { gte: startToday }, deletedAt: null } }).catch(() => 0),
        prisma.project.count({ where: { deletedAt: null } }).catch(() => 0),
      ])
      system = '你是运营主管，每天早上给管理员一段简短的今日工作播报，200字以内，分点，说人话，不空话。'
      user = `今天是${now.getMonth()+1}月${now.getDate()}日。后台真实数据：
- 待支付订单 ${pendingOrders} 单
- 已支付订单 ${paidOrders} 单
- 待签合同 ${pendingContracts} 份
- 待跟进线索 ${pendingLeads} 条（今日新增 ${newLeads}）
- 进行中项目 ${activeProjects} 个
请输出：
【今日待办】挑最该先做的3件事
【重点关注】风险或需要催办的事项
【一句话建议】
基于真实数字，不要编。`
    } else {
      return NextResponse.json({ code: 400, message: '未知场景' }, { status: 400 })
    }

    system = system + serviceContext
    const result = await chatCompletion({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      scene,
      adminId: admin.id,
      temperature: 0.7,
      maxTokens: 2000,
      timeoutMs: 60000,
    })

    return NextResponse.json({ code: 0, content: result.content })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI 生成失败'
    // FriendlyError 的 message 已经是用户友好文案
    return NextResponse.json({ code: 500, message: msg }, { status: 200 })
  }
}
