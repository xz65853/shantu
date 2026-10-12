/**
 * 微信小程序 / 微信支付 配置的字段定义（纯常量，前后端共用，客户端安全）
 * 服务端读写逻辑见 wechat-settings.ts
 */

export type WechatFieldType = 'text' | 'textarea' | 'image' | 'switch' | 'select'

export type WechatField = {
  key: string
  label: string
  type: WechatFieldType
  placeholder?: string
  hint?: string
  options?: { value: string; label: string }[]
  secret?: boolean
}

export const WECHAT_GROUPS: { group: string; desc?: string; items: WechatField[] }[] = [
  {
    group: '小程序基本信息',
    desc: '小程序名称、AppID、头像、简介等基础资料，保存后小程序端可读取。',
    items: [
      { key: 'wxapp_enable', label: '启用小程序', type: 'switch', hint: '关闭后小程序端接口不返回配置' },
      { key: 'wxapp_name', label: '小程序名称', type: 'text', placeholder: '如：闪途' },
      { key: 'wxapp_appid', label: 'AppID（小程序ID）', type: 'text', placeholder: 'wx****************' },
      {
        key: 'wxapp_secret',
        label: 'AppSecret（小程序密钥）',
        type: 'text',
        secret: true,
        placeholder: '留空表示不修改',
        hint: '敏感信息，加密存储，保存后不再显示明文',
      },
      { key: 'wxapp_original_id', label: '原始 ID', type: 'text', placeholder: 'gh_************' },
      { key: 'wxapp_avatar', label: '小程序头像', type: 'image' },
      { key: 'wxapp_qrcode', label: '小程序码', type: 'image' },
      { key: 'wxapp_intro', label: '小程序简介', type: 'textarea' },
      { key: 'wxapp_category', label: '服务类目', type: 'text', placeholder: '如：商业服务 > 广告/设计' },
      { key: 'wxapp_version', label: '当前版本号', type: 'text', placeholder: '如：1.0.0' },
      {
        key: 'wxapp_audit_status',
        label: '审核状态',
        type: 'select',
        options: [
          { value: '未提交', label: '未提交' },
          { value: '审核中', label: '审核中' },
          { value: '已发布', label: '已发布' },
          { value: '已驳回', label: '已驳回' },
        ],
      },
      {
        key: 'wxapp_env',
        label: '当前运行环境',
        type: 'select',
        options: [
          { value: '开发版', label: '开发版' },
          { value: '体验版', label: '体验版' },
          { value: '正式版', label: '正式版' },
        ],
      },
      { key: 'wxapp_contact_phone', label: '客服电话', type: 'text' },
      { key: 'wxapp_remark', label: '备注', type: 'textarea' },
    ],
  },
  {
    group: '微信支付',
    desc: '商户号、API 密钥与回调地址。密钥加密存储，需确认服务器域名已备案并配置好回调。',
    items: [
      { key: 'wxpay_enable', label: '启用微信支付', type: 'switch' },
      {
        key: 'wxpay_mode',
        label: '接入模式',
        type: 'select',
        options: [
          { value: '直连商户', label: '直连商户' },
          { value: '服务商', label: '服务商（需填服务商商户号）' },
        ],
      },
      { key: 'wxpay_mchid', label: '商户号 MchID', type: 'text', placeholder: '10 位数字' },
      { key: 'wxpay_mch_name', label: '商户名称', type: 'text' },
      { key: 'wxpay_sp_mchid', label: '服务商商户号', type: 'text', hint: '接入模式为「服务商」时填写' },
      { key: 'wxpay_sp_appid', label: '服务商 AppID', type: 'text', hint: '接入模式为「服务商」时填写' },
      {
        key: 'wxpay_api_v3_key',
        label: 'API v3 密钥',
        type: 'text',
        secret: true,
        placeholder: '留空表示不修改',
        hint: '微信商户平台设置的 32 位密钥，加密存储',
      },
      { key: 'wxpay_cert_serial', label: '商户证书序列号', type: 'text' },
      {
        key: 'wxpay_private_key',
        label: '商户 API 私钥（PEM）',
        type: 'textarea',
        secret: true,
        placeholder: '-----BEGIN PRIVATE KEY----- 留空表示不修改',
        hint: 'apiclient_key.pem 全文内容，加密存储',
      },
      {
        key: 'wxpay_notify_url',
        label: '支付回调地址',
        type: 'text',
        placeholder: 'https://你的域名/api/pay/wxpay/notify',
      },
      {
        key: 'wxpay_refund_notify_url',
        label: '退款回调地址',
        type: 'text',
        placeholder: 'https://你的域名/api/pay/wxpay/refund-notify',
      },
    ],
  },
  {
    group: '接口与服务器域名',
    desc: '小程序 request 合法域名等业务配置，需与微信公众平台后台配置保持一致。',
    items: [
      {
        key: 'wxapp_api_base',
        label: '接口基础地址',
        type: 'text',
        placeholder: 'https://你的域名',
        hint: '小程序端请求后端接口的根地址，必须是已备案的 HTTPS 域名',
      },
      {
        key: 'wxapp_request_domain',
        label: 'request 合法域名',
        type: 'text',
        placeholder: '多个用英文逗号分隔',
      },
      { key: 'wxapp_socket_domain', label: 'socket 合法域名', type: 'text', placeholder: '多个用英文逗号分隔' },
      { key: 'wxapp_upload_domain', label: 'uploadFile 合法域名', type: 'text' },
      { key: 'wxapp_download_domain', label: 'downloadFile 合法域名', type: 'text' },
      { key: 'wxapp_business_domain', label: '业务域名', type: 'text', hint: 'web-view 可加载的域名' },
    ],
  },
  {
    group: '小程序首页内容',
    desc: '小程序首页的标题、公告、快捷入口等展示内容，保存后小程序端下次打开即生效。',
    items: [
      { key: 'wxapp_home_title', label: '首页主标题', type: 'text', placeholder: '如：把生意搬到线上' },
      { key: 'wxapp_home_subtitle', label: '首页副标题', type: 'text', placeholder: '如：抖音代运营 · 短视频 · 直播' },
      { key: 'wxapp_home_notice', label: '首页公告', type: 'text', placeholder: '如：本周限时免费领取运营诊断' },
      {
        key: 'wxapp_home_badges',
        label: '优势标签',
        type: 'textarea',
        placeholder: '每行一个，如：\n官方认证服务商\n100+ 实体企业服务经验',
        hint: '显示在首页顶部，每行一个标签',
      },
      { key: 'wxapp_home_button_text', label: '首页主按钮文案', type: 'text', placeholder: '如：免费获取运营方案' },
      { key: 'wxapp_home_qrcode', label: '首页客服二维码', type: 'image', hint: '我的页与首页弹层可展示' },
      { key: 'wxapp_show_cases', label: '首页展示案例', type: 'switch' },
      { key: 'wxapp_show_articles', label: '首页展示文章', type: 'switch' },
      { key: 'wxapp_show_packages', label: '首页展示套餐', type: 'switch' },
    ],
  },
]

/** 所有允许的 key，后端白名单过滤用 */
export const WECHAT_KEYS: string[] = WECHAT_GROUPS.flatMap((g) => g.items.map((i) => i.key))

/** 需要加密存储的敏感字段 */
export const WECHAT_SECRET_KEYS: string[] = WECHAT_GROUPS.flatMap((g) =>
  g.items.filter((i) => i.secret).map((i) => i.key),
)

export const DEFAULT_WECHAT_SETTINGS: Record<string, string> = {
  wxapp_enable: '0',
  wxapp_name: '',
  wxapp_appid: '',
  wxapp_secret: '',
  wxapp_original_id: '',
  wxapp_avatar: '',
  wxapp_qrcode: '',
  wxapp_intro: '',
  wxapp_category: '',
  wxapp_version: '',
  wxapp_audit_status: '未提交',
  wxapp_env: '正式版',
  wxapp_contact_phone: '',
  wxapp_remark: '',
  wxpay_enable: '0',
  wxpay_mode: '直连商户',
  wxpay_mchid: '',
  wxpay_mch_name: '',
  wxpay_sp_mchid: '',
  wxpay_sp_appid: '',
  wxpay_api_v3_key: '',
  wxpay_cert_serial: '',
  wxpay_private_key: '',
  wxpay_notify_url: '',
  wxpay_refund_notify_url: '',
  wxapp_api_base: '',
  wxapp_request_domain: '',
  wxapp_socket_domain: '',
  wxapp_upload_domain: '',
  wxapp_download_domain: '',
  wxapp_business_domain: '',
  wxapp_home_title: '',
  wxapp_home_subtitle: '',
  wxapp_home_notice: '',
  wxapp_home_badges: '',
  wxapp_home_button_text: '免费获取运营方案',
  wxapp_home_qrcode: '',
  wxapp_show_cases: '1',
  wxapp_show_articles: '1',
  wxapp_show_packages: '1',
}

/** 掩码前缀：前端看到即表示「已配置」，原样提交或留空表示不修改 */
export const MASK_PREFIX = '••••••'

/** 小程序端可安全下发的字段（不含任何密钥） */
export const WECHAT_PUBLIC_KEYS = [
  'wxapp_enable',
  'wxapp_name',
  'wxapp_appid',
  'wxapp_original_id',
  'wxapp_avatar',
  'wxapp_qrcode',
  'wxapp_intro',
  'wxapp_category',
  'wxapp_version',
  'wxapp_audit_status',
  'wxapp_env',
  'wxapp_contact_phone',
  'wxapp_api_base',
  'wxapp_home_title',
  'wxapp_home_subtitle',
  'wxapp_home_notice',
  'wxapp_home_badges',
  'wxapp_home_button_text',
  'wxapp_home_qrcode',
  'wxapp_show_cases',
  'wxapp_show_articles',
  'wxapp_show_packages',
  'wxpay_enable',
  'wxpay_mchid',
  'wxpay_mch_name',
]
