import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const SERVICES = [
  {
    name: '抖音代运营',
    slug: 'douyin-operation',
    enName: 'DOUYIN',
    summary: '从账号定位、内容策划、拍摄、剪辑，到直播、投流、数据复盘，全流程运营。',
    detail:
      '账号定位与人设搭建\n内容选题与脚本策划\n短视频拍摄与剪辑\n账号日常运营与发布\n数据分析与月度复盘\n投流配合与优化建议',
    process:
      '现状诊断：账号、产品、目标客户梳理\n账号定位：人设、栏目、更新节奏\n内容生产：选题、脚本、拍摄、剪辑\n运营发布：标题、话题、发布时间\n数据复盘：播放、互动、线索\n持续优化：调整内容方向',
    target:
      '有产品但没有专人做抖音的企业\n已有账号但更新不稳定、没有效果的商家\n希望把抖音作为长期获客渠道的品牌',
    faq:
      '多久能看到效果：通常需要 4 到 8 周的内容积累期\n需要企业配合什么：提供产品资料、拍摄场地与出镜人员\n是否包含拍摄：可以按方案包含拍摄与剪辑',
  },
  {
    name: '短视频运营',
    slug: 'short-video',
    enName: 'CONTENT',
    summary: '账号定位｜选题策划｜脚本｜拍摄｜剪辑｜发布｜数据分析。',
    detail:
      '账号内容定位\n选题库搭建\n脚本撰写\n拍摄执行\n剪辑与包装\n发布与数据跟踪',
    process:
      '明确内容方向\n搭建选题库\n脚本撰写与确认\n拍摄\n剪辑包装\n发布与复盘',
    target: '想持续产出内容但缺少团队的实体门店\n需要产品内容素材的电商商家',
    faq: '一个月产出多少条：根据方案确定更新频率\n是否需要企业出镜：视内容形式而定',
  },
  {
    name: '直播运营',
    slug: 'live-operation',
    enName: 'LIVE',
    summary: '直播间搭建｜主播培训｜直播脚本｜选品｜排品｜投流｜复盘。',
    detail:
      '直播间场景搭建\n直播流程与脚本设计\n主播话术培训\n选品与排品\n直播中控与投流配合\n直播数据复盘',
    process:
      '直播间搭建\n脚本与话术准备\n选品排品\n开播执行\n数据复盘\n下一场优化',
    target: '想做直播带货但缺乏团队的商家\n已有直播间但转化不理想的企业',
    faq: '是否提供主播：可协助培训或推荐\n需要什么设备：根据预算给出设备清单',
  },
  {
    name: '本地生活',
    slug: 'local-life',
    enName: 'LOCAL',
    summary: '团购搭建｜门店短视频｜达人合作｜直播团购｜广告投放。',
    detail:
      '抖音团购搭建\n门店内容拍摄\n达人探店合作\n直播团购\n本地广告投放\n核销数据跟踪',
    process:
      '门店与产品梳理\n团购套餐设计\n内容拍摄与达人合作\n直播团购\n本地投放\n核销复盘',
    target: '餐饮、茶饮、美业、休闲娱乐等本地门店\n希望提升到店客流的实体商家',
    faq: '达人如何合作：按门店预算匹配本地达人\n团购如何设置：结合客单价与利润设计套餐',
  },
  {
    name: '广告投放',
    slug: 'ads',
    enName: 'ADS',
    summary: '抖音广告｜巨量引擎｜千川｜本地推广｜朋友圈广告｜小红书等。',
    detail:
      '投放目标与预算规划\n素材制作与测试\n巨量引擎 / 千川投放\n本地推广投放\n数据监控与优化\n投放复盘报告',
    process:
      '目标与预算确认\n素材制作\n小预算测试\n放量投放\n数据优化\n复盘报告',
    target: '已有内容但想加速获客的企业\n希望控制获客成本的商家',
    faq: '投放预算多少合适：先用小预算测试再放量\n如何判断效果：以线索成本与成交为目标',
  },
  {
    name: '电商运营',
    slug: 'ecommerce',
    enName: 'SHOP',
    summary: '账号运营｜商品内容｜直播带货｜短视频带货｜投流｜数据分析。',
    detail:
      '店铺与商品内容优化\n账号与短视频内容\n直播带货\n达人分销\n投流\n数据分析',
    process:
      '商品与人群分析\n内容方向与素材\n直播或短视频带货\n投流放大\n数据复盘',
    target: '有产品想做抖音电商的企业\n已有店铺但销量停滞的商家',
    faq: '是否包含达人分销：可按方案配合\n需要多少启动预算：根据品类与投放策略确定',
  },
]

const CASE_CATEGORIES = ['抖音运营', '本地生活', '电商', '直播', '企业品牌']
const ARTICLE_CATEGORIES = ['抖音运营', '直播运营', '短视频', '本地生活', '电商', '行业观察']

const CASES = [
  {
    title: '安化冰碛岩项目',
    slug: 'anhu-ice-moraine',
    subtitle: '把地方特产做成可持续更新的内容账号',
    industry: '茶具 / 文创',
    projectType: '抖音运营 · 直播',
    categoryName: '抖音运营',
    summary: '围绕产品特性与使用场景，重新梳理账号定位与内容结构，并配合直播测试。',
    background:
      '产品本身有独特性，但线上内容缺少清晰定位。\n账号更新不稳定，内容与购买人群之间的关联不强。',
    strategy:
      '重新梳理账号定位与人设\n建立以产品使用场景为主的选题结构\n内容与直播配合，测试不同转化路径',
    execution:
      '账号定位与主页优化\n选题库搭建与脚本撰写\n产品短视频拍摄与剪辑\n账号日常运营与发布\n直播间搭建与开播测试\n数据记录与复盘',
    result:
      '账号内容方向明确，更新节奏稳定。\n项目执行过程与后续优化方向已形成可复用的流程。',
    showMetrics: false,
  },
  {
    title: '安化黑茶项目',
    slug: 'anhu-black-tea',
    subtitle: '短视频 + 直播 + 商品内容的一体化运营',
    industry: '茶叶',
    projectType: '短视频 · 直播 · 电商',
    categoryName: '电商',
    summary: '从内容到商品页的链路梳理，配合直播与短视频带货测试。',
    background: '茶叶品类竞争激烈，单纯讲产品很难形成差异。\n需要把产地、工艺与饮用场景讲清楚。',
    strategy:
      '以产地与工艺作为内容主线\n商品内容与人设内容配合\n短视频与直播共同测试转化',
    execution:
      '内容主线与选题规划\n产品与产地素材拍摄\n商品内容优化\n短视频带货测试\n直播排品与话术\n数据复盘',
    result: '形成稳定的内容主线与商品表达方式，为后续持续运营打好基础。',
    showMetrics: false,
  },
  {
    title: '本地实体商家项目',
    slug: 'local-merchant',
    subtitle: '抖音本地生活 + 短视频 + 团购获客',
    industry: '餐饮 / 汽车 / 装修 / 工厂',
    projectType: '本地生活',
    categoryName: '本地生活',
    summary: '面向本地门店的团购搭建、内容拍摄与达人合作，配合本地投放获取客流。',
    background: '门店依赖自然客流，线上渠道基本没有内容积累。\n缺少团购套餐与线上转化路径。',
    strategy:
      '设计适合线上的团购套餐\n以门店环境与产品为主拍摄短视频\n结合本地达人与本地投放放大曝光',
    execution:
      '团购套餐设计与上架\n门店短视频拍摄\n达人探店合作\n直播团购\n本地推广投放\n核销数据跟踪',
    result: '建立从线上曝光到到店核销的完整路径，为后续长期运营提供数据与素材积累。',
    showMetrics: false,
  },
]

const ARTICLES = [
  {
    title: '抖音代运营到底在运营什么？',
    slug: 'what-is-douyin-operation',
    categoryName: '抖音运营',
    summary: '很多人以为代运营就是代发视频，实际上它包含定位、内容、数据、投放与复盘。',
    content:
      '很多老板找代运营，第一句话是"帮我多发点视频"。\n但账号真正的问题，往往不是发得少，而是没有方向。\n\n第一层：账号定位。\n你的账号是谁、讲给谁听、让人记住什么。定位不清楚，发得越多越乱。\n\n第二层：内容结构。\n不是每条视频都追求爆款，而是要有稳定的选题结构：讲产品、讲场景、讲人、讲过程。\n\n第三层：数据复盘。\n播放量只是结果。更要看完播率、互动率、主页访问与私信咨询。\n\n第四层：转化路径。\n内容带来关注之后，客户从哪里联系你、怎么下单、怎么到店，这条路径要提前设计好。\n\n第五层：持续优化。\n每月复盘哪些选题有效，下个月就围绕它做更多。\n\n所以代运营不是"帮你发视频"，而是帮你把一条从内容到客户的链路跑通。',
  },
  {
    title: '实体门店为什么要做抖音？',
    slug: 'why-store-need-douyin',
    categoryName: '本地生活',
    summary: '门店的客户半径有限，抖音本地生活做的是把半径内的客户先找到你。',
    content:
      '实体门店最大的限制是位置。\n路过的人有限，自然客流就有天花板。\n\n抖音本地生活的价值，是把门店周边几公里内、本来不会路过的人，提前刷到你。\n\n具体怎么做：\n第一，团购套餐要设计好。不是把菜单搬上去，而是设计一个让人愿意先买的低价体验款。\n\n第二，内容要拍门店本身。环境、制作过程、老板、真实顾客反应，这些都是素材。\n\n第三，达人探店是加速器。本地达人自带信任，但要注意匹配门店定位。\n\n第四，看核销而不是只看播放。播放量再高，核销为零也没有意义。\n\n门店做抖音，不是为了当网红，是为了让周边客户在做选择时，先想到你。',
  },
  {
    title: '一个新账号前 30 天应该怎么做？',
    slug: 'new-account-first-30-days',
    categoryName: '抖音运营',
    summary: '前 30 天不要急着投流，先把定位、内容结构和更新节奏跑起来。',
    content:
      '第 1 周：定位与基础。\n确定账号人设、头像、简介、主页背景。先把"你是谁"讲清楚。\n\n第 2 周：内容测试。\n围绕 3 到 5 个选题方向各发几条，观察哪类内容的完播和互动更好。\n\n第 3 周：加大有效方向。\n把数据较好的选题继续深挖，形成 2 到 3 个固定栏目。\n\n第 4 周：稳定节奏。\n确定更新频率，把选题库排到下一个月。\n\n前 30 天不要做的事：\n不要一上来就大额投流，内容没验证之前，投流只会放大问题。\n不要频繁改定位，账号需要时间积累标签。\n不要只追热点，热点流量不精准，很难带来真实客户。\n\n30 天之后，再看数据决定要不要投流、要不要开播。',
  },
  {
    title: '直播间没有成交，应该先看哪些数据？',
    slug: 'live-room-no-conversion',
    categoryName: '直播运营',
    summary: '直播间不出单，先别急着换品，按数据顺序排查问题。',
    content:
      '直播间没成交，通常是四个环节里有一个断了。\n\n第一，看场观和停留。\n如果场观低，是流量问题；如果停留短，是内容和场景留不住人。\n\n第二，看商品点击率。\n有人看但没人点商品，说明讲解和商品之间的关联不够强，或者价格没有讲清楚。\n\n第三，看下单转化率。\n点了商品但没付款，常见原因是价格预期、信任不足、或缺紧迫感。\n\n第四，看客单价和复购。\n成交了但利润低，就要调整排品结构。\n\n排查顺序建议：\n先解决停留，再解决点击，最后解决成交。\n不要一上来就换品，先把前一环的问题修好。\n\n另外，直播复盘要固定表格：场观、平均停留、商品点击、下单率、退款率。每次直播后填一次，几次之后问题会很清楚。',
  },
]

async function main() {
  console.log('开始初始化数据...')

  // 管理员
  const adminCount = await prisma.admin.count()
  if (adminCount === 0) {
    await prisma.admin.create({
      data: {
        username: 'admin',
        passwordHash: bcrypt.hashSync('Shantu@2026', 10),
        displayName: '超级管理员',
        role: 'SUPER_ADMIN',
      },
    })
    console.log('✓ 已创建管理员：admin / Shantu@2026')
  }

  // 服务项目
  for (const [index, service] of SERVICES.entries()) {
    const exists = await prisma.service.findUnique({ where: { slug: service.slug } })
    if (!exists) {
      await prisma.service.create({
        data: {
          name: service.name,
          slug: service.slug,
          enName: service.enName,
          summary: service.summary,
          detail: service.detail,
          process: service.process,
          target: service.target,
          faq: service.faq,
          sort: index,
          status: 'PUBLISHED',
        },
      })
    }
  }
  console.log('✓ 服务项目已初始化')

  // 案例分类
  for (const [index, name] of CASE_CATEGORIES.entries()) {
    const slug = `case-${index + 1}`
    const exists = await prisma.caseCategory.findUnique({ where: { slug } })
    if (!exists) {
      await prisma.caseCategory.create({ data: { name, slug, sort: index } })
    }
  }

  // 案例
  for (const [index, item] of CASES.entries()) {
    const exists = await prisma.case.findUnique({ where: { slug: item.slug } })
    if (!exists) {
      const category = await prisma.caseCategory.findFirst({ where: { name: item.categoryName } })
      await prisma.case.create({
        data: {
          title: item.title,
          slug: item.slug,
          subtitle: item.subtitle,
          industry: item.industry,
          projectType: item.projectType,
          summary: item.summary,
          background: item.background,
          strategy: item.strategy,
          execution: item.execution,
          result: item.result,
          showMetrics: item.showMetrics,
          status: 'PUBLISHED',
          sort: index,
          isFeatured: index < 3,
          categoryId: category?.id ?? null,
        },
      })
    }
  }
  console.log('✓ 案例已初始化（不含虚构数据）')

  // 文章分类
  for (const [index, name] of ARTICLE_CATEGORIES.entries()) {
    const slug = `blog-${index + 1}`
    const exists = await prisma.articleCategory.findUnique({ where: { slug } })
    if (!exists) {
      await prisma.articleCategory.create({ data: { name, slug, sort: index } })
    }
  }

  // 文章
  for (const article of ARTICLES) {
    const exists = await prisma.article.findUnique({ where: { slug: article.slug } })
    if (!exists) {
      const category = await prisma.articleCategory.findFirst({ where: { name: article.categoryName } })
      await prisma.article.create({
        data: {
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          author: '闪途运营',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          categoryId: category?.id ?? null,
        },
      })
    }
  }
  console.log('✓ 文章已初始化')

  // 表单选项
  const industries = ['餐饮', '茶叶', '工厂', '汽车', '装修', '电商', '其他']
  const requirements = ['抖音代运营', '短视频', '直播', '本地生活', '广告投放', '电商运营', '其他']

  for (const [index, label] of industries.entries()) {
    const exists = await prisma.formOption.findFirst({ where: { group: 'industry', label } })
    if (!exists) {
      await prisma.formOption.create({
        data: { group: 'industry', label, value: label, sort: index },
      })
    }
  }
  for (const [index, label] of requirements.entries()) {
    const exists = await prisma.formOption.findFirst({ where: { group: 'requirement', label } })
    if (!exists) {
      await prisma.formOption.create({
        data: { group: 'requirement', label, value: label, sort: index },
      })
    }
  }
  console.log('✓ 表单选项已初始化')

  // 网站设置
  const settings: Record<string, string> = {
    site_name: '湖南闪途文化传媒有限公司',
    site_slogan: '实体企业线上增长服务商',
    logo_text: '闪途文化传媒',
    footer_note: '帮助实体企业，把生意搬到线上。',
    seo_title: '湖南闪途文化传媒有限公司｜实体企业线上增长服务商',
    seo_description:
      '湖南闪途文化传媒有限公司，专注抖音代运营、短视频运营、直播运营、本地生活、广告投放与电商运营，帮助实体企业把生意搬到线上。',
    seo_keywords: '抖音代运营,短视频运营,直播运营,本地生活运营,广告投放,湖南闪途文化传媒',
    about_intro:
      '湖南闪途文化传媒有限公司，专注于企业线上营销与数字化运营服务。围绕抖音代运营、短视频、直播、本地生活、广告投放及电商运营，为实体企业提供线上内容、流量与获客解决方案。',
  }

  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
  }
  console.log('✓ 网站设置已初始化')

  // ---------------- 套餐（价格单位：分） ----------------
  const PACKAGES = [
    {
      name: '月度代运营',
      slug: 'monthly',
      period: '月',
      price: 300000, // 3000 元
      originalPrice: null,
      summary: '适合刚开始做线上、想先跑通内容与账号方向的商家。',
      features: JSON.stringify([
        '账号定位与人设搭建',
        '内容选题与脚本规划',
        '每月 12 条短视频（拍摄 + 剪辑）',
        '账号日常运营与发布',
        '数据复盘与优化建议',
      ]),
      recommended: false,
      status: 1,
      sort: 1,
    },
    {
      name: '季度代运营',
      slug: 'quarterly',
      period: '季度',
      price: 1200000, // 12000 元
      originalPrice: 1500000,
      summary: '适合已明确要做线上获客、希望形成稳定内容产出的企业。',
      features: JSON.stringify([
        '包含月度套餐全部服务',
        '账号定位迭代与栏目规划',
        '每月 16 条短视频（拍摄 + 剪辑）',
        '直播策划与陪跑（每月 2 场）',
        '投流方案与预算建议',
        '专属运营群 + 月度数据报告',
      ]),
      recommended: true,
      status: 1,
      sort: 2,
    },
    {
      name: '年度代运营',
      slug: 'yearly',
      period: '年',
      price: 3600000, // 36000 元
      originalPrice: 4800000,
      summary: '适合把线上作为长期获客渠道、需要稳定团队的品牌与企业。',
      features: JSON.stringify([
        '包含季度套餐全部服务',
        '年度内容策略与栏目体系搭建',
        '每月 20 条短视频（拍摄 + 剪辑）',
        '直播运营与主播培训（每月 4 场）',
        '全年代投与投流优化',
        '本地生活 / 团购搭建与运营',
        '季度经营复盘会 + 专属运营团队',
      ]),
      recommended: false,
      status: 1,
      sort: 3,
    },
  ]

  for (const pkg of PACKAGES) {
    const exists = await prisma.package.findUnique({ where: { slug: pkg.slug } })
    if (exists) {
      await prisma.package.update({ where: { slug: pkg.slug }, data: pkg })
    } else {
      await prisma.package.create({ data: pkg })
    }
  }
  console.log('✓ 套餐已初始化（3000/月、12000/季、36000/年）')

  console.log('\n初始化完成。')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
