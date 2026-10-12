const fs = require('fs')
const path = require('path')

const envPath = path.join(process.cwd(), '.env')
const env = {}
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  })
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const report = { backfilled: [], merged: [], pending: [], beforeOrderCount: 0, afterOrderCount: 0 }
  report.beforeOrderCount = await prisma.order.count()

  const orphanOrders = await prisma.order.findMany({
    where: { memberId: null },
    select: { id: true, orderNo: true, name: true, phone: true, status: true },
  })
  for (const o of orphanOrders) {
    const m = await prisma.member.findFirst({ where: { phone: o.phone, mergedInto: null }, orderBy: { id: 'asc' } })
    if (m) {
      await prisma.order.update({ where: { id: o.id }, data: { memberId: m.id } })
      report.backfilled.push({ orderNo: o.orderNo, phone: o.phone, memberId: m.id, status: o.status })
    } else {
      report.pending.push({ orderNo: o.orderNo, phone: o.phone, reason: '手机号无匹配会员，待人工处理' })
    }
  }

  const allWithPhone = await prisma.member.findMany({ where: { phone: { not: null }, mergedInto: null }, orderBy: { id: 'asc' } })
  const byPhone = {}
  for (const m of allWithPhone) {
    if (!m.phone) continue
    ;(byPhone[m.phone] ||= []).push(m)
  }
  for (const phone of Object.keys(byPhone)) {
    const arr = byPhone[phone]
    if (arr.length <= 1) continue
    const primary = arr[0]
    for (let i = 1; i < arr.length; i++) {
      const sub = arr[i]
      await prisma.$transaction([
        prisma.order.updateMany({ where: { memberId: sub.id }, data: { memberId: primary.id } }),
        prisma.project.updateMany({ where: { memberId: sub.id }, data: { memberId: primary.id } }),
        prisma.member.update({ where: { id: sub.id }, data: { mergedInto: primary.id } }),
        prisma.member.update({ where: { id: primary.id }, data: { source: 'both' } }),
        prisma.memberMergeLog.create({ data: { fromMemberId: sub.id, toMemberId: primary.id, fromPhone: sub.phone, toPhone: primary.phone, operator: 'script' } }),
      ])
      report.merged.push({ phone, primaryId: primary.id, mergedId: sub.id })
    }
  }

  const paidOrders = await prisma.order.findMany({
    where: { status: 'PAID' },
    select: { orderNo: true, memberId: true, name: true, phone: true, member: { select: { id: true, phone: true, name: true, nickname: true } } },
  })
  for (const o of paidOrders) {
    if (o.memberId && o.member && o.member.phone && o.member.phone !== o.phone) {
      const match = await prisma.member.findFirst({ where: { phone: o.phone, mergedInto: null } })
      report.pending.push({
        orderNo: o.orderNo, orderPhone: o.phone, orderName: o.name,
        currentMemberId: o.memberId, currentMemberPhone: o.member.phone,
        matchMemberId: match ? match.id : null,
        reason: '已支付订单，订单手机号与挂载会员手机号不一致，疑似同人多档案，待人工合并',
      })
    }
  }

  report.afterOrderCount = await prisma.order.count()
  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
