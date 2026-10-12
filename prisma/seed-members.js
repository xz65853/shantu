/**
 * 会员数据迁移：为历史会员回填会员ID（user_id）
 * 服务器上执行：node prisma/seed-members.js
 */
const path = require('node:path')
const ROOT = path.resolve(__dirname, '..')
const { PrismaClient } = require(path.join(ROOT, 'node_modules/@prisma/client'))

const prisma = new PrismaClient()

function genUserId(id) {
  return `TJ${String(100000 + id)}`
}

async function main() {
  const list = await prisma.member.findMany({
    where: { OR: [{ userId: null }, { userId: '' }] },
    select: { id: true, phone: true },
  })
  for (const m of list) {
    await prisma.member.update({ where: { id: m.id }, data: { userId: genUserId(m.id) } })
  }
  const all = await prisma.member.findMany({
    select: { id: true, userId: true, phone: true, type: true, passwordHash: true },
  })
  console.log(`已回填 ${list.length} 个会员ID，当前会员共 ${all.length} 个`)
  for (const m of all.slice(0, 10)) {
    console.log(`  #${m.id} ${m.userId} ${m.phone || '无手机号'} ${m.type} ${m.passwordHash ? '已设密码' : '未设密码'}`)
  }
}

main()
  .catch((e) => {
    console.error('失败：', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
