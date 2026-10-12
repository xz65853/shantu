/**
 * 确保存在超级管理员账号（服务器上用 node 直接执行，不依赖 TS）
 * 用法：node prisma/seed-admin.js [username] [password]
 */
const path = require('node:path')
const ROOT = path.resolve(__dirname, '..')
const { PrismaClient } = require(path.join(ROOT, 'node_modules/@prisma/client'))
const bcrypt = require(path.join(ROOT, 'node_modules/bcryptjs'))

const username = process.argv[2] || 'admin'
const password = process.argv[3] || 'Shantu@2026'
const reset = process.argv.includes('--reset')

const prisma = new PrismaClient()

async function main() {
  if (reset) {
    await prisma.admin.updateMany({
      where: { username },
      data: { passwordHash: bcrypt.hashSync(password, 10), isActive: true },
    })
    console.log(`✓ 已重置管理员密码：${username} / ${password}`)
    return
  }

  const count = await prisma.admin.count()
  if (count === 0) {
    await prisma.admin.create({
      data: {
        username,
        passwordHash: bcrypt.hashSync(password, 10),
        displayName: '超级管理员',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    })
    console.log(`✓ 已创建管理员：${username} / ${password}`)
  } else {
    const exists = await prisma.admin.findUnique({ where: { username } })
    if (!exists) {
      await prisma.admin.create({
        data: {
          username,
          passwordHash: bcrypt.hashSync(password, 10),
          displayName: '超级管理员',
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      })
      console.log(`✓ 已补建管理员：${username} / ${password}`)
    } else {
      console.log(`· 管理员 ${username} 已存在（共 ${count} 个账号）`)
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('失败：', e.message)
    await prisma.$disconnect()
    process.exit(1)
  })
