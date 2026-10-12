import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 通用合同模板（含占位符变量，与后端 buildContractData 完全对齐）
const DEFAULT_TEMPLATE_HTML = `<h1>闪途数字营销服务合同</h1>

<p>甲方（客户）：{{甲方姓名}}<br/>
联系电话：{{甲方电话}}<br/>
身份证号：{{甲方身份证}}</p>

<p>乙方（服务方）：{{乙方名称}}<br/>
统一社会信用代码：{{乙方信用代码}}<br/>
联系电话：{{乙方电话}}</p>

<p>根据《中华人民共和国民法典》《中华人民共和国广告法》《中华人民共和国电子商务法》《中华人民共和国个人信息保护法》及相关法律法规，甲乙双方本着平等自愿、诚实信用的原则，就乙方为甲方提供数字营销服务事宜，经协商一致，订立本合同。</p>

<h2>第一条 服务内容</h2>
<p>乙方为甲方提供以下服务（按双方确认的套餐执行）：</p>
<p>{{服务内容}}</p>
<p>具体服务清单以《服务确认单》为准，作为本合同附件。</p>

<h2>第二条 服务期限</h2>
<p>自 {{开始日期}} 起至 {{结束日期}} 止，共 {{服务天数}} 天。</p>
<p>服务期满前 15 日双方可协商续约，未续约则合同到期自动终止。</p>

<h2>第三条 合同金额与支付</h2>
<p>1. 本合同总金额为人民币 ¥{{合同金额}}（大写：{{合同金额大写}}）。</p>
<p>2. 支付方式：甲方通过微信/银行转账一次性支付至乙方指定账户。</p>
<p>3. 发票：乙方为个体工商户，按国家规定开具发票。</p>
<p>4. 因甲方原因中途终止服务的，已支付费用按已实际服务天数折算，剩余部分不予退还；因乙方原因终止的，未服务部分按比例退还。</p>

<h2>第四条 双方权利与义务</h2>
<p>1. 甲方应及时提供开展服务所需的营业执照、产品资料、账号权限、品牌素材，并对所提供内容的合法性、真实性负责。</p>
<p>2. 乙方应按本合同约定内容与频次提供服务，按月同步服务进展与数据复盘。</p>
<p>3. 服务成果以双方书面确认的服务范围为准，超出范围的需求另行报价。</p>
<p>4. 甲方保证其经营活动合法合规，不涉及虚假宣传、侵权、违法商品；因甲方自身违法经营导致的后果由甲方承担。</p>

<h2>第五条 知识产权</h2>
<p>1. 乙方为甲方创作的成品内容（视频、图文、设计稿），在甲方付清全款后，著作权归甲方所有，乙方保留署名权及案例展示权（脱敏后）。</p>
<p>2. 乙方使用的 AI 工具、SaaS 平台、字体、音乐素材，其知识产权归原权利人所有，乙方保证已获得合法授权。</p>
<p>3. 甲方提供的商标、Logo、产品图，知识产权归甲方。</p>

<h2>第六条 数据与个人信息</h2>
<p>1. 双方在合作中接触到的对方经营数据、客户信息，仅用于本合同目的，不得外泄。</p>
<p>2. 涉及个人信息处理的，双方遵守《个人信息保护法》，未经对方书面同意不得收集、使用、向第三方提供。</p>

<h2>第七条 保密条款</h2>
<p>双方对合作中知悉的对方商业秘密（客户名单、报价、经营数据、账号信息）负有保密义务，未经书面同意不得向第三方披露，本义务在合同终止后持续 2 年。</p>

<h2>第八条 违约责任</h2>
<p>1. 任何一方违反本合同，应赔偿对方因此遭受的直接经济损失。</p>
<p>2. 乙方未按约定交付服务的，甲方有权要求补做或按未交付部分比例退款。</p>
<p>3. 甲方逾期付款的，每逾期一日按未付金额的万分之五支付违约金。</p>

<h2>第九条 合同解除</h2>
<p>1. 双方协商一致可解除本合同。</p>
<p>2. 一方严重违约，经书面催告 7 日内未改正的，另一方有权解除合同并要求赔偿。</p>

<h2>第十条 争议解决</h2>
<p>本合同适用中华人民共和国法律。因本合同发生争议，双方应友好协商；协商不成的，任何一方可向乙方所在地人民法院提起诉讼。</p>

<h2>第十一条 其他约定</h2>
<p>{{附加条款}}</p>

<p>本合同自甲方手写签名（电子签名同等效力）之日起生效，一式两份，甲乙双方各执一份。</p>

<p>甲方签署：{{甲方姓名}}（手写签名）<br/>
签署日期：{{签署日期}}</p>

<p>乙方签署：{{乙方名称}}{{乙方签署}}<br/>
签署日期：{{签署日期}}</p>`

// 内置附加条款库
const BUILTIN_CLAUSES = [
  { name: '营业额分成条款', content: '按甲方实际线上营业额的 __% 计提，每月结算。' },
  { name: 'KPI 对赌条款', content: '某月未达双方约定的 KPI 指标，减免下月服务费 __%。' },
  { name: '投流代付条款', content: '广告消耗由甲方预付，乙方代为操作投放。' },
  { name: '账号归属条款', content: '账号所有权归甲方，乙方仅代运营，合作终止后完整移交甲方。' },
  { name: '保密违约金', content: '违反保密条款的，违约方赔付对方违约金 __ 元。' },
]

async function main() {
  // 1. 内置默认模板
  const existingTemplate = await prisma.contractTemplate.findFirst({ where: { name: '通用合同模板' } })
  if (!existingTemplate) {
    const t = await prisma.contractTemplate.create({
      data: {
        name: '通用合同模板',
        contentHtml: DEFAULT_TEMPLATE_HTML,
        partyBName: '桃江闪途网络科技工作室（个体工商户）',
        partyBAddress: '',
        partyBPhone: '',
        isDefault: true,
        version: 1,
      },
    })
    await prisma.contractTemplateVersion.create({
      data: {
        templateId: t.id,
        version: 1,
        name: t.name,
        contentHtml: t.contentHtml,
        sealImageUrl: t.sealImageUrl,
        partyBName: t.partyBName,
        partyBAddress: t.partyBAddress,
        partyBPhone: t.partyBPhone,
      },
    })
    // 确保唯一默认
    await prisma.contractTemplate.updateMany({ where: { id: { not: t.id } }, data: { isDefault: false } })
    console.log('✓ 通用合同模板已创建')
  } else {
    console.log('· 通用合同模板已存在，跳过')
  }

  // 2. 内置附加条款
  let createdCount = 0
  for (const c of BUILTIN_CLAUSES) {
    const exists = await prisma.contractClause.findFirst({ where: { name: c.name } })
    if (!exists) {
      await prisma.contractClause.create({ data: { ...c, isBuiltin: true } })
      createdCount++
    }
  }
  console.log(`✓ 附加条款初始化完成（新增 ${createdCount} 条）`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
