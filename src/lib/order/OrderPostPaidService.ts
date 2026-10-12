import { prisma } from '@/lib/db'
import { ensureContractForOrder, computeServicePeriod, buildServiceContent, renderContractPdf } from '@/lib/contract-service'
import { sendOrderPaidNotify } from '@/lib/notify/order-notify'
import { genProjectNo } from '@/lib/orderNo'

/**
 * 支付成功后自动处理：
 * 1. 创建合同（如未创建）
 * 2. 创建项目（如未创建）+ 初始服务周期
 * 3. 通知管理员 + 小程序消息
 */
export async function handleOrderPaid(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { package: true },
  })
  if (!order) return { ok: false, error: '订单不存在' }

  // 项目必须归属会员（游客线索单不自动建项目）
  if (!order.memberId) return { ok: false, error: '订单缺少会员信息' }
  const memberId = order.memberId

  // 1. 创建合同（幂等）
  let contract
  try {
    contract = await ensureContractForOrder(order.id)
  } catch (e) {
    console.error('[OrderPostPaid] 合同创建失败', e instanceof Error ? e.stack : String(e))
  }

  // 1.5 支付后重新渲染合同：补上乙方公章/负责人签字（未付款时渲染的是无签章版）
  if (contract?.id) {
    try {
      await renderContractPdf(contract.id)
    } catch (e) {
      console.error('[OrderPostPaid] 合同重渲染失败', e instanceof Error ? e.stack : String(e))
    }
  }

  // 2. 创建项目（幂等：已存在则跳过）
  const existingProject = await prisma.project.findFirst({ where: { orderId: order.id } })
  if (existingProject) {
    return { ok: true, projectId: existingProject.id, contractId: contract?.id, duplicated: true }
  }

  // 项目名称：{客户真实姓名}-{套餐名}-{YYYYMM}
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { realName: true, name: true, nickname: true },
  })
  const customerName = member?.realName || member?.name || member?.nickname || order.name
  const projectName = `${customerName}-${order.packageName || '服务'}-${ym}`

  // 服务期限：开始=支付日，结束=按套餐周期
  const period = computeServicePeriod(now, order.period, order.periodDays)

  // 服务内容：从套餐描述带入
  const serviceDesc = buildServiceContent(order.package, order)

  // 事务内创建项目 + 初始服务周期（保证一致性与幂等）
  const project = await prisma.$transaction(async (tx) => {
    const dup = await tx.project.findFirst({ where: { orderId: order.id } })
    if (dup) return dup

    const created = await tx.project.create({
      data: {
        name: projectName,
        memberId,
        orderId: order.id,
        packageName: order.packageName,
        serviceDesc,
        manager: null,
        startAt: now,
        endAt: period.endAt,
        status: 'RUNNING',
        note: null,
      },
    })

    // 项目编号：XM + 6 位自增 id（与后台手动创建的项目保持一致）
    const withNo = await tx.project.update({
      where: { id: created.id },
      data: { projectNo: genProjectNo(created.id) },
    })

    // 创建初始服务周期（V2.0：续费时在同一项目下新增周期）
    await tx.servicePeriod.create({
      data: {
        projectId: created.id,
        orderId: order.id,
        packageName: order.packageName,
        periodDays: order.periodDays || period.days,
        startAt: now,
        endAt: period.endAt,
        status: 'PENDING',
      },
    })

    return withNo
  })

  // 3. 通知
  try {
    await sendOrderPaidNotify({
      orderId: order.id,
      orderNo: order.orderNo,
      memberId,
      memberName: customerName,
      phone: order.phone,
      packageName: order.packageName,
      amount: order.amount,
      projectName,
    })
  } catch (e) {
    console.error('[OrderPostPaid] 通知失败', e instanceof Error ? e.stack : String(e))
  }

  return { ok: true, projectId: project.id, contractId: contract?.id, duplicated: false }
}
