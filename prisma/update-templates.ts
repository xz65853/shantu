import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const tpls = await prisma.contractTemplate.findMany()
  for (const t of tpls) {
    let html = t.contentHtml || ''
    const before = html
    // 乙方信息占位符化：信用代码、电话（注意甲方电话已是变量，勿误伤）
    html = html.replace(/统一社会信用代码：________________/g, '统一社会信用代码：{{乙方信用代码}}')
    html = html.replace(/联系电话：________________/g, '联系电话：{{乙方电话}}')
    // 落款：签署方式改为变量（个体户→负责人签字 / 公司→盖章）
    html = html.replace(/乙方签署：{{乙方名称}}（盖章）/g, '乙方签署：{{乙方名称}}{{乙方签署}}')
    await prisma.contractTemplate.update({
      where: { id: t.id },
      data: {
        contentHtml: html,
        partyBPhone: '16607370500',
        partyBType: 'individual',
      },
    })
    console.log(`[${t.id}] ${t.name}: ${before !== html ? '正文已更新' : '正文无变化'} | 电话=16607370500 主体=个体户`)
  }
  console.log('完成')
}

main()
  .catch((e) => {
    console.error('执行失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
