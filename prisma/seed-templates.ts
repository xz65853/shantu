import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PARTY_B = '桃江闪途网络科技工作室（个体工商户）'

/** 公共条款（法律/保密/违约/争议），各类合同共用，保持法律一致性 */
function commonClauses() {
  return `
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
<p>甲方签署：{{甲方姓名}}（手写签名）　签署日期：{{签署日期}}</p>
<p>乙方签署：{{乙方名称}}{{乙方签署}}　签署日期：{{签署日期}}</p>`
}

function head(title: string, serviceItems: string) {
  return `<h1>${title}</h1>

<p>甲方（客户）：{{甲方姓名}}<br/>
联系电话：{{甲方电话}}<br/>
身份证号：{{甲方身份证}}</p>

<p>乙方（服务方）：{{乙方名称}}<br/>
统一社会信用代码：{{乙方信用代码}}<br/>
联系电话：{{乙方电话}}</p>

<p>根据《中华人民共和国民法典》《中华人民共和国广告法》《中华人民共和国电子商务法》《中华人民共和国个人信息保护法》及相关法律法规，甲乙双方本着平等自愿、诚实信用的原则，就乙方为甲方提供下述服务事宜，经协商一致，订立本合同。</p>

<h2>第一条 服务内容</h2>
${serviceItems}
<p>本合同服务内容：{{服务内容}}</p>
<p>具体服务清单与交付标准以《服务确认单》为准，作为本合同附件。</p>

<h2>第二条 服务期限</h2>
<p>自 {{开始日期}} 起至 {{结束日期}} 止，共 {{服务天数}} 天。</p>
<p>服务期满前 15 日双方可协商续约，未续约则合同到期自动终止。</p>

<h2>第三条 合同金额与支付</h2>
<p>1. 本合同总金额为人民币 ¥{{合同金额}}（大写：{{合同金额大写}}）。</p>
<p>2. 支付方式：甲方通过微信/银行转账一次性支付至乙方指定账户。</p>
<p>3. 发票：乙方为个体工商户，按国家规定开具发票。</p>
<p>4. 因甲方原因中途终止服务的，已支付费用按已实际服务天数折算，剩余部分不予退还；因乙方原因终止的，未服务部分按比例退还。</p>
`
}

const TEMPLATES = [
  {
    name: '抖音代运营服务合同',
    contentHtml: head(
      '抖音代运营服务合同',
      `<p>乙方为甲方提供抖音/短视频账号代运营服务（按双方确认的套餐执行）：</p>
<p>1. 账号定位与内容策划：账号人设定位、内容方向规划、选题与脚本策划；</p>
<p>2. 视频拍摄与剪辑：拍摄执行、后期剪辑、封面与标题制作；</p>
<p>3. 发布与运营：按时发布、话题与标签优化、评论互动维护、粉丝运营；</p>
<p>4. 数据复盘：按月提供播放量、涨粉、互动、转化等数据复盘报告；</p>
<p>5. 平台合规：遵守抖音平台规则，避免违规限流。</p>`
    ) + commonClauses(),
    bindPackages: ['monthly', 'quarterly', 'yearly'], // 月度/季度/年度代运营
  },
  {
    name: 'AI 视频制作服务合同',
    contentHtml: head(
      'AI 视频制作服务合同',
      `<p>乙方为甲方提供 AI 视频制作服务（按双方确认的套餐执行）：</p>
<p>1. AI 脚本生成：基于甲方产品与卖点，使用 AI 工具生成短视频脚本；</p>
<p>2. AI 成片制作：AI 数字人/AI 素材生成、智能配音、字幕与剪辑成片；</p>
<p>3. 成片交付：按约定数量交付成片源文件与成品；</p>
<p>4. 修改与调整：每批次提供约定次数的修改；</p>
<p>5. AI 素材合规：乙方保证所用 AI 工具与素材已获合法授权。</p>`
    ) + commonClauses(),
    bindPackages: ['ai'], // AI短视频服务
  },
  {
    name: '平面设计服务合同',
    contentHtml: head(
      '平面设计服务合同',
      `<p>乙方为甲方提供平面设计服务（按双方确认的套餐执行）：</p>
<p>1. 宣传物料设计：海报、宣传图、朋友圈素材、活动长图；</p>
<p>2. 电商视觉设计：详情页、主图、banner、店铺装修；</p>
<p>3. 品牌物料：Logo 应用规范、名片、宣传册等延展设计；</p>
<p>4. 交付与修改：按约定数量交付设计稿源文件与成品，并提供约定次数修改；</p>
<p>5. 字体与素材：乙方保证所用字体、图片素材已获商用授权。</p>`
    ) + commonClauses(),
    bindPackages: [] as string[],
  },
  {
    name: '综合数字营销服务合同（混合）',
    contentHtml: head(
      '综合数字营销服务合同',
      `<p>乙方为甲方提供综合数字营销服务（按双方确认的套餐执行，可包含以下多项）：</p>
<p>1. 抖音/短视频账号代运营：账号定位、内容策划、拍摄剪辑、发布运营、数据复盘；</p>
<p>2. 平面设计服务：宣传图、海报、详情页、朋友圈素材等设计；</p>
<p>3. AI 视频制作：AI 脚本生成与 AI 成片制作；</p>
<p>4. 直播运营：直播策划、场控、复盘；</p>
<p>5. 本地生活/投流：团购上架、达人对接、广告投放优化（如有约定）。</p>
<p>各项服务的数量与频次以《服务确认单》为准。</p>`
    ) + commonClauses(),
    bindPackages: [] as string[],
  },
]

async function main() {
  console.log('=== 开始创建业务合同模板 ===')
  for (const t of TEMPLATES) {
    const exist = await prisma.contractTemplate.findFirst({ where: { name: t.name } })
    let tpl
    if (exist) {
      tpl = await prisma.contractTemplate.update({
        where: { id: exist.id },
        data: { contentHtml: t.contentHtml, partyBName: PARTY_B },
      })
      console.log(`更新模板: ${t.name} (id=${tpl.id})`)
    } else {
      tpl = await prisma.contractTemplate.create({
        data: {
          name: t.name,
          contentHtml: t.contentHtml,
          partyBName: PARTY_B,
          isDefault: false,
          version: 1,
        },
      })
      console.log(`创建模板: ${t.name} (id=${tpl.id})`)
    }

    // 绑定套餐
    for (const slug of t.bindPackages) {
      const pkg = await prisma.package.findFirst({ where: { slug } })
      if (pkg) {
        await prisma.package.update({ where: { id: pkg.id }, data: { templateId: tpl.id } })
        console.log(`  绑定套餐: ${pkg.name}(${slug}) -> ${t.name}`)
      } else {
        console.log(`  ⚠️ 套餐未找到: ${slug}`)
      }
    }
  }

  console.log('\n=== 最终绑定结果 ===')
  const pkgs = await prisma.package.findMany({
    orderBy: { id: 'asc' },
    include: { template: { select: { id: true, name: true } } },
  })
  for (const p of pkgs) {
    console.log(`套餐[${p.id}] ${p.name.padEnd(14)} -> ${p.template?.name || '(未绑定，走默认模板)'}`)
  }

  const tpls = await prisma.contractTemplate.findMany({ select: { id: true, name: true, isDefault: true } })
  console.log('\n模板列表:')
  for (const t of tpls) console.log(`  [${t.id}] ${t.name}${t.isDefault ? ' (默认)' : ''}`)
}

main()
  .catch((e) => {
    console.error('执行失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
