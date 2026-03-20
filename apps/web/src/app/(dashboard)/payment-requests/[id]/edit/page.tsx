'use client';

// InfFinanceMs - 编辑付款申请页面
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Card,
  Space,
  Upload,
  message,
  Typography,
  Row,
  Col,
  Spin,
  Modal,
  Empty,
  Radio,
  Cascader,
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

// 付款方式选项
const paymentMethods = [
  { value: 'TRANSFER', label: '银行转账' },
  { value: 'CASH', label: '现金' },
  { value: 'CHECK', label: '支票' },
  { value: 'DRAFT', label: '汇票' },
  { value: 'OTHER', label: '其他' },
];

// 币种选项
const currencies = [
  { value: 'CNY', label: 'CNY-人民币元' },
  { value: 'USD', label: 'USD-美元' },
  { value: 'EUR', label: 'EUR-欧元' },
  { value: 'HKD', label: 'HKD-港币' },
];

// 账户类型选项
const accountTypes = [
  { value: 'PERSONAL', label: '个人账户' },
  { value: 'CORPORATE', label: '对公账户' },
];

// 银行列表
const bankOptions = [
  { value: 'ICBC', label: '中国工商银行' },
  { value: 'CCB', label: '中国建设银行' },
  { value: 'ABC', label: '中国农业银行' },
  { value: 'BOC', label: '中国银行' },
  { value: 'BOCOM', label: '交通银行' },
  { value: 'CMB', label: '招商银行' },
  { value: 'CITIC', label: '中信银行' },
  { value: 'CEB', label: '光大银行' },
  { value: 'CMBC', label: '民生银行' },
  { value: 'PAB', label: '平安银行' },
  { value: 'SPDB', label: '浦发银行' },
  { value: 'CIB', label: '兴业银行' },
  { value: 'HXB', label: '华夏银行' },
  { value: 'GDB', label: '广发银行' },
  { value: 'PSBC', label: '中国邮政储蓄银行' },
  { value: 'OTHER', label: '其他银行' },
];

// 地区选项（省市级联）
const regionOptions = [
  {
    value: 'beijing',
    label: '北京市',
    children: [{ value: 'beijing', label: '北京市' }],
  },
  {
    value: 'shanghai',
    label: '上海市',
    children: [{ value: 'shanghai', label: '上海市' }],
  },
  {
    value: 'guangdong',
    label: '广东省',
    children: [
      { value: 'guangzhou', label: '广州市' },
      { value: 'shenzhen', label: '深圳市' },
      { value: 'dongguan', label: '东莞市' },
      { value: 'foshan', label: '佛山市' },
    ],
  },
  {
    value: 'zhejiang',
    label: '浙江省',
    children: [
      { value: 'hangzhou', label: '杭州市' },
      { value: 'ningbo', label: '宁波市' },
      { value: 'wenzhou', label: '温州市' },
    ],
  },
  {
    value: 'jiangsu',
    label: '江苏省',
    children: [
      { value: 'nanjing', label: '南京市' },
      { value: 'suzhou', label: '苏州市' },
      { value: 'wuxi', label: '无锡市' },
    ],
  },
  {
    value: 'sichuan',
    label: '四川省',
    children: [
      { value: 'chengdu', label: '成都市' },
      { value: 'mianyang', label: '绵阳市' },
    ],
  },
];

// 银行账户/收款方信息接口（合并后的结构）
interface BankAccount {
  id: string;
  accountType: string;    // 账户类型：PERSONAL/CORPORATE
  accountName: string;    // 户名
  accountNo: string;      // 账号
  bankCode?: string;      // 银行代码
  bankName: string;       // 银行名称
  region?: string[];      // 银行所在地区 [省, 市]
  bankBranch?: string;    // 支行名称
  remark?: string;        // 备注
  currency: string;
  isDefault: boolean;
}

interface Attachment {
  name: string;
  url: string;
  size?: number;
}

interface PurchaseContract {
  id: string;
  contractNo: string;
  name: string;
  contractType?: string;
  customer?: { id: string; name: string; code?: string };
}

export default function EditPaymentRequestPage() {
  const params = useParams();
  const router = useRouter();
  const [form] = Form.useForm();
  const [addAccountForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [purchaseContracts, setPurchaseContracts] = useState<PurchaseContract[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [addAccountModalVisible, setAddAccountModalVisible] = useState(false);
  const [addAccountLoading, setAddAccountLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 加载银行账户列表
  const loadBankAccounts = async () => {
    try {
      const accounts = await api.get<BankAccount[]>('/bank-accounts');
      setBankAccounts(accounts);
      return accounts;
    } catch (error) {
      console.error('加载银行账户失败:', error);
      return [];
    }
  };

  // 根据搜索关键词过滤银行账户
  const filteredBankAccounts = useMemo(() => {
    if (!searchKeyword.trim()) {
      return bankAccounts;
    }
    const keyword = searchKeyword.toLowerCase();
    return bankAccounts.filter(
      (account) =>
        account.accountName.toLowerCase().includes(keyword) ||
        account.accountNo.toLowerCase().includes(keyword) ||
        account.bankName.toLowerCase().includes(keyword)
    );
  }, [bankAccounts, searchKeyword]);

  // 新增银行账户（收款方信息）
  const handleAddBankAccount = async () => {
    try {
      const values = await addAccountForm.validateFields();
      setAddAccountLoading(true);
      
      // 获取银行名称
      const bankName = bankOptions.find(b => b.value === values.bankCode)?.label || values.bankCode;
      
      const response = await api.post<BankAccount>('/bank-accounts', {
        accountType: values.accountType,
        accountName: values.accountName,
        accountNo: values.accountNo,
        bankCode: values.bankCode,
        bankName: bankName,
        region: values.region,
        bankBranch: values.branchName,  // 后端字段名为 bankBranch
        remark: values.remark,
        currency: 'CNY',
        isDefault: false,
      });
      
      message.success('收款账户添加成功');
      setAddAccountModalVisible(false);
      addAccountForm.resetFields();
      // 重新加载银行账户列表
      await loadBankAccounts();
      // 自动选中新添加的账户
      form.setFieldValue('bankAccountId', response.id);
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error('添加收款账户失败');
      console.error('添加收款账户失败:', error);
    } finally {
      setAddAccountLoading(false);
    }
  };

  // 渲染银行账户选项
  const renderBankAccountOption = (account: BankAccount) => (
    <div className="py-1">
      <div className="flex items-center gap-2">
        <span className="font-medium">{account.accountName}</span>
        <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded">
          {account.accountType === 'PERSONAL' ? '个人' : '对公'}
        </span>
      </div>
      <div className="text-xs text-gray-500">
        {account.bankName} {account.bankBranch && `· ${account.bankBranch}`}
      </div>
      <div className="text-xs text-gray-400">{account.accountNo}</div>
    </div>
  );

  // 自定义下拉菜单渲染
  const dropdownRender = (menu: React.ReactNode) => (
    <div>
      {/* 搜索框 */}
      <div className="p-2 border-b">
        <Input
          placeholder="搜索收款方名称、账号或开户行"
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          allowClear
        />
      </div>
      {/* 账户列表 */}
      <div className="max-h-60 overflow-auto">
        {filteredBankAccounts.length > 0 ? (
          menu
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={searchKeyword ? '未找到匹配的收款方' : '暂无收款方账户'}
            className="py-4"
          />
        )}
      </div>
      {/* 新增按钮 */}
      <div className="p-2 border-t">
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          block
          onClick={() => {
            setDropdownOpen(false);
            setAddAccountModalVisible(true);
          }}
        >
          新增收款方账户
        </Button>
      </div>
    </div>
  );

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const [request, accounts, contracts] = await Promise.all([
          api.get<any>(`/payment-requests/${params.id}`),
          api.get<BankAccount[]>('/bank-accounts'),
          api.get<PurchaseContract[]>('/payment-requests/purchase-contract-options'),
        ]);

        // 检查状态是否允许编辑
        if (request.status !== 'DRAFT') {
          message.error('只有草稿状态的申请可以编辑');
          router.push(`/payment-requests/${params.id}`);
          return;
        }

        setBankAccounts(accounts);
        setPurchaseContracts(contracts || []);

        // 设置表单值（收款方信息已整合到银行账户中）
        form.setFieldsValue({
          contractId: request.contractId,
          reason: request.reason,
          amount: Number(request.amount),
          currency: request.currency,
          paymentMethod: request.paymentMethod,
          paymentDate: dayjs(request.paymentDate),
          bankAccountId: request.bankAccountId,
          remark: request.remark || '',
        });

        // 设置附件列表
        if (request.attachments && request.attachments.length > 0) {
          const files: UploadFile[] = request.attachments.map((att: Attachment, index: number) => ({
            uid: String(index),
            name: att.name,
            status: 'done',
            url: att.url,
            size: att.size,
          }));
          setFileList(files);
        }
      } catch (error: any) {
        message.error(error.message || '加载数据失败');
        router.push('/payment-requests');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [params.id, form, router]);

  // 处理文件上传
  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;

    if (file.size > 100 * 1024 * 1024) {
      message.error(`文件 ${file.name} 超过100MB限制`);
      onError(new Error('文件过大'));
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.post<{ url: string; filename: string }>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newFile: UploadFile = {
        uid: file.uid,
        name: file.name,
        status: 'done',
        url: result.url,
        size: file.size,
      };
      setFileList((prev) => [...prev, newFile]);
      onSuccess(result, file);
    } catch (error: any) {
      message.error(`上传 ${file.name} 失败`);
      onError(error);
    }
  };

  // 删除附件
  const handleRemoveFile = (file: UploadFile) => {
    setFileList((prev) => prev.filter((f) => f.uid !== file.uid));
    return true;
  };

  // 保存表单
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      // 构建附件数据
      const attachments: Attachment[] = fileList.map((f) => ({
        name: f.name,
        url: f.url || '',
        size: f.size,
      }));

      // 收款方信息已整合到银行账户中，通过 bankAccountId 关联
      const payload = {
        contractId: values.contractId,
        reason: values.reason,
        amount: values.amount,
        currency: values.currency,
        paymentMethod: values.paymentMethod,
        paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        bankAccountId: values.bankAccountId,
        remark: values.remark,
        attachments,
      };

      await api.put(`/payment-requests/${params.id}`, payload);
      message.success('保存成功');
      router.push(`/payment-requests/${params.id}`);
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
        />
        <div>
          <Title level={4} style={{ margin: 0 }}>编辑付款申请</Title>
          <Text type="secondary">修改付款申请信息</Text>
        </div>
      </div>

      <Form form={form} layout="vertical">
        {/* 申请详情 */}
        <Card title="申请详情">
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                name="contractId"
                label="关联合同（采购）"
                rules={[{ required: true, message: '请选择采购合同' }]}
                extra="付款申请仅支持关联采购合同"
              >
                <Select
                  placeholder="请选择采购合同"
                  showSearch
                  optionFilterProp="label"
                  options={purchaseContracts.map((contract) => ({
                    value: contract.id,
                    label: `${contract.contractNo} - ${contract.name}（${contract.customer?.name || '未命名主体'}）`,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="reason"
                label="付款事由"
                rules={[{ required: true, message: '请输入付款事由' }]}
              >
                <Input placeholder="请输入" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="amount"
                label="付款金额"
                rules={[{ required: true, message: '请输入付款金额' }]}
              >
                <InputNumber
                  placeholder="请输入金额"
                  style={{ width: '100%' }}
                  min={0.01}
                  precision={2}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="currency" label="币种">
                <Select options={currencies} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="paymentMethod"
                label="付款方式"
                rules={[{ required: true, message: '请选择付款方式' }]}
              >
                <Select placeholder="请选择" options={paymentMethods} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="paymentDate"
                label="付款日期"
                rules={[{ required: true, message: '请选择付款日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="bankAccountId"
                label="收款方账户"
                rules={[{ required: true, message: '请选择收款方账户' }]}
                extra="包含收款方名称、账号、开户行信息"
              >
                <Select
                  placeholder="请选择或搜索收款方"
                  open={dropdownOpen}
                  onDropdownVisibleChange={setDropdownOpen}
                  dropdownRender={dropdownRender}
                  optionLabelProp="label"
                  showSearch={false}
                >
                  {filteredBankAccounts.map((account) => (
                    <Select.Option
                      key={account.id}
                      value={account.id}
                      label={`${account.accountName} - ${account.bankName}`}
                    >
                      {renderBankAccountOption(account)}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <TextArea placeholder="请输入备注信息" rows={3} />
          </Form.Item>
        </Card>

        {/* 附件 */}
        <Card title="附件" extra={<Text type="secondary">上限30个文件，最大100MB/个</Text>}>
          <Upload
            customRequest={handleUpload}
            fileList={fileList}
            onRemove={handleRemoveFile}
            multiple
            maxCount={30}
          >
            <Button icon={<UploadOutlined />}>上传文件</Button>
          </Upload>
        </Card>

        {/* 操作按钮 */}
        <div className="flex justify-end">
          <Space>
            <Button onClick={() => router.back()}>取消</Button>
            <Button type="primary" onClick={handleSave} loading={saving}>
              保存
            </Button>
          </Space>
        </div>
      </Form>

      {/* 新增收款账户弹窗 */}
      <Modal
        title="添加账户"
        open={addAccountModalVisible}
        onCancel={() => {
          setAddAccountModalVisible(false);
          addAccountForm.resetFields();
        }}
        onOk={handleAddBankAccount}
        confirmLoading={addAccountLoading}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        width={500}
      >
        <Form
          form={addAccountForm}
          layout="vertical"
          className="mt-4"
          initialValues={{ accountType: 'PERSONAL' }}
        >
          <Form.Item
            name="accountType"
            label="账户类型"
            rules={[{ required: true, message: '请选择账户类型' }]}
          >
            <Radio.Group options={accountTypes} />
          </Form.Item>
          <Form.Item
            name="accountName"
            label="户名"
            rules={[{ required: true, message: '请输入收款人姓名' }]}
          >
            <Input placeholder="请输入收款人姓名" />
          </Form.Item>
          <Form.Item
            name="accountNo"
            label="账号"
            rules={[{ required: true, message: '请输入收款人账号' }]}
          >
            <Input placeholder="请输入收款人账号" />
          </Form.Item>
          <Form.Item
            name="bankCode"
            label="银行"
            rules={[{ required: true, message: '请选择银行' }]}
          >
            <Select
              placeholder="请选择银行"
              options={bankOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="region"
            label="银行所在地区"
            rules={[{ required: true, message: '请选择银行所在地区' }]}
          >
            <Cascader
              placeholder="请选择"
              options={regionOptions}
            />
          </Form.Item>
          <Form.Item
            name="branchName"
            label="银行支行"
            rules={[{ required: true, message: '请输入银行支行' }]}
          >
            <Input placeholder="请输入银行支行名称" />
          </Form.Item>
          <Form.Item
            name="remark"
            label="备注"
          >
            <Input.TextArea
              placeholder="请输入"
              rows={3}
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
