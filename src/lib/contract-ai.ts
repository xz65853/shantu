import { chatCompletion } from '@/lib/ai'

/** 合同正文允许的占位符（AI 生成时必须使用这些，保持变量兼容） */
export const CONTRACT_PLACEHOLDERS = [
  '{{甲方姓名}}',
  '{{甲方身份证}}',
  '{{甲方电话}}',
  '{{乙方名称}}',
  '{{乙方信用代码}}',
  '{{乙方电话}}',
  '{{乙方负责人}}',
  '{{乙方签署}}',
  '{{服务内容}}',
  '{{合同金额}}',
  '{{合同金额大写}}',
  '{{开始日期}}',
  '{{结束日期}}',
  '{{服务天数}}',
  '{{附加条款}}',
  '{{签署日期}}',
]

/**
 * AI 起草合同正文（HTML）。
 * 严格约束占位符变量：AI 只允许使用上述占位符，不得改名/替换，
 * 保证后端 buildContractData 能正常填充渲染、合同可用。
 */
export async function generateContractContentByAI(params: {
  serviceType: string
  packageName?: string
  requirements?: string
  adminId?: number
}): Promise<string> {
  const prompt = `你是资深合同律师，请为「${params.serviceType}」起草一份数字营销服务合同正文。

套餐：${params.packageName || '标准服务'}
${params.requirements ? `额外要求：${params.requirements}` : ''}

【硬性要求】
1. 合同正文必须使用以下占位符变量（原样保留，禁止改名、替换或新增其它占位符）：
${CONTRACT_PLACEHOLDERS.join('、')}
2. 输出 HTML，用 <h2> 作条目标题、<p> 作段落。
3. 法律依据：《中华人民共和国民法典》《广告法》《电子商务法》《个人信息保护法》。
4. 结构依次：标题 → 双方信息 → 服务内容 → 服务期限 → 合同金额与支付 → 双方权利义务 → 知识产权 → 数据与个人信息 → 保密 → 违约责任 → 合同解除 → 争议解决 → 其他约定(含{{附加条款}}) → 签署。
5. 双方信息里，乙方必须包含：名称{{乙方名称}}、统一社会信用代码{{乙方信用代码}}、联系电话{{乙方电话}}，不得写死具体号码。
6. 落款（签署段）乙方一侧必须写「乙方签署：{{乙方名称}}{{乙方签署}}」，签署方式用 {{乙方签署}} 变量表达，不要写死「盖章」或「签字」或「负责人」字样（该变量由系统按主体类型自动填充：个体户→负责人签字，公司→盖章）。
7. 只输出合同正文 HTML，不要输出任何解释、前言或代码块标记。`

  const result = await chatCompletion({
    messages: [{ role: 'user', content: prompt }],
    scene: 'report_analysis',
    adminId: params.adminId ?? null,
    maxTokens: 4000,
    timeoutMs: 60000,
  })

  return result.content || ''
}
