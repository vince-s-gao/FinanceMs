export const paymentMethods = [
  { value: "TRANSFER", label: "银行转账" },
  { value: "CASH", label: "现金" },
  { value: "CHECK", label: "支票" },
  { value: "DRAFT", label: "汇票" },
  { value: "OTHER", label: "其他" },
];

export const currencies = [
  { value: "CNY", label: "CNY-人民币元" },
  { value: "USD", label: "USD-美元" },
  { value: "EUR", label: "EUR-欧元" },
  { value: "HKD", label: "HKD-港币" },
];

export const accountTypes = [
  { value: "PERSONAL", label: "个人账户" },
  { value: "CORPORATE", label: "对公账户" },
];

export const bankOptions = [
  { value: "ICBC", label: "中国工商银行" },
  { value: "CCB", label: "中国建设银行" },
  { value: "ABC", label: "中国农业银行" },
  { value: "BOC", label: "中国银行" },
  { value: "BOCOM", label: "交通银行" },
  { value: "CMB", label: "招商银行" },
  { value: "CITIC", label: "中信银行" },
  { value: "CEB", label: "光大银行" },
  { value: "CMBC", label: "民生银行" },
  { value: "PAB", label: "平安银行" },
  { value: "SPDB", label: "浦发银行" },
  { value: "CIB", label: "兴业银行" },
  { value: "HXB", label: "华夏银行" },
  { value: "GDB", label: "广发银行" },
  { value: "PSBC", label: "中国邮政储蓄银行" },
  { value: "OTHER", label: "其他银行" },
];

export const regionOptions = [
  {
    value: "beijing",
    label: "北京市",
    children: [{ value: "beijing", label: "北京市" }],
  },
  {
    value: "shanghai",
    label: "上海市",
    children: [{ value: "shanghai", label: "上海市" }],
  },
  {
    value: "guangdong",
    label: "广东省",
    children: [
      { value: "guangzhou", label: "广州市" },
      { value: "shenzhen", label: "深圳市" },
      { value: "dongguan", label: "东莞市" },
      { value: "foshan", label: "佛山市" },
    ],
  },
  {
    value: "zhejiang",
    label: "浙江省",
    children: [
      { value: "hangzhou", label: "杭州市" },
      { value: "ningbo", label: "宁波市" },
      { value: "wenzhou", label: "温州市" },
    ],
  },
  {
    value: "jiangsu",
    label: "江苏省",
    children: [
      { value: "nanjing", label: "南京市" },
      { value: "suzhou", label: "苏州市" },
      { value: "wuxi", label: "无锡市" },
    ],
  },
  {
    value: "sichuan",
    label: "四川省",
    children: [
      { value: "chengdu", label: "成都市" },
      { value: "mianyang", label: "绵阳市" },
    ],
  },
];
