
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';


const getNowDatetimeLocal = (): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const API_BASE_URL = 'http://103.219.1.138:4430/api/resource';

// Types
interface FormData {
  billNo: string;
  company: string;
  department: string;
  tokenNumber: string;
  patient_id: string;
  full_name: string;
  customer_name: string;
  contactNo: string;
  dateTime: string;
  ageYears: string;
  gender: string;
  selfPaying: boolean;
  transactionType: string;
  doctor: string;
  warehouse: string;
}

interface Item {
  _rowid: string;
  item_code: string;
  item_name: string;
  unit: string;
  item_group: string;
  gst_hsn_code: string;
  batchNo: string;
  expiry: string;
  stockQty: string;
  orderedQty: string;
  saleQty: string;
  unitSaleRate: string;
  amount: string;
  discountPerc: number;
  discountAmt: string;
  givenQty: string;
  cgstPerc: number;
  cgstAmt: string;
  sgstPerc: number;
  sgstAmt: string;
  totalPayable: string;
  searchText: string;
  showSuggestions: boolean;
}

interface Totals {
  total_amount: string;
  sub_total: string;
  item_amount: string;
  total_cgst: string;
  total_sgst: string;
  total_discount: string;
  grand_total: string;
  cash_received: string;
  change_amount: string;
  net_amount: string;
}

interface AccountDetails {
  account_details: string;
  date_amount: string;
  net: string;
  percent_discount: number;
  cash_in_rs: number;
  cash_in_advance: number;
  total_cash: string;
  due_dis: string;
  credit: string;
  balance: string;
}

interface NamedEntity {
  name: string;
}

interface Customer {
  name: string;
  customer_name: string;
}

interface ItemMaster {
  item_code: string;
  item_name: string;
  stock_uom: string;
  item_group: string;
  gst_hsn_code: string;
  stock_qty: number;
}

const App: React.FC = () => {
  // State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [formData, setFormData] = useState<FormData>({
    billNo: '',
    company: '',
    department: '',
    tokenNumber: '',
    patient_id: '',
    full_name: '',
    customer_name: '',
    contactNo: '',
    dateTime: getNowDatetimeLocal(), // Now safe to use
    ageYears: '',
    gender: '',
    selfPaying: true,
    transactionType: 'Cash',
    doctor: '',
    warehouse: '',
  });
  const [companies, setCompanies] = useState<NamedEntity[]>([]);
  const [warehouses, setWarehouses] = useState<NamedEntity[]>([]);
  const [departments, setDepartments] = useState<NamedEntity[]>([]);
  const [showDepartmentSuggestions, setShowDepartmentSuggestions] = useState<boolean>(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerAddresses, setCustomerAddresses] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [selectedCustomerCode, setSelectedCustomerCode] = useState<string>('');
  const [doctors, setDoctors] = useState<NamedEntity[]>([]);
  const [classifications, setClassifications] = useState<NamedEntity[]>([]);
  const [itemMasterList, setItemMasterList] = useState<ItemMaster[]>([]);
  const [itemLoading, setItemLoading] = useState<boolean>(false);
  const [searchFields, setSearchFields] = useState<{
    classification: string;
    generic: boolean;
    search_text: string;
    search_by_generic: string;
    available_stock: number;
  }>({
    classification: '',
    generic: false,
    search_text: '',
    search_by_generic: '',
    available_stock: 0,
  });
  const [showSubstitute, setShowSubstitute] = useState<boolean>(false);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [allItemsSelected, setAllItemsSelected] = useState<boolean>(false);
  const [totals, setTotals] = useState<Totals>({
    total_amount: '0.00',
    sub_total: '0.00',
    item_amount: '0.00',
    total_cgst: '0.00',
    total_sgst: '0.00',
    total_discount: '0.00',
    grand_total: '0.00',
    cash_received: '0',
    change_amount: '0.00',
    net_amount: '0.00',
  });
  const [accountDetails, setAccountDetails] = useState<AccountDetails>({
    account_details: '',
    date_amount: '0.00',
    net: '0.00',
    percent_discount: 0,
    cash_in_rs: 0,
    cash_in_advance: 0,
    total_cash: '0.00',
    due_dis: '0.00',
    credit: '0.00',
    balance: '0.00',
  });

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Computed
  const filteredDepartments = useMemo(() => {
    if (!formData.department) return departments;
    const searchLower = formData.department.toLowerCase().trim();
    return departments.filter(dept => dept.name.toLowerCase().includes(searchLower));
  }, [formData.department, departments]);

  // Helper Functions
  const newRow = (): Item => ({
    _rowid: Date.now().toString(36) + Math.random().toString(36).slice(2),
    item_code: '',
    item_name: '',
    unit: '',
    item_group: '',
    gst_hsn_code: '',
    batchNo: '',
    expiry: '',
    stockQty: '',
    orderedQty: '',
    saleQty: '',
    unitSaleRate: '',
    amount: '',
    discountPerc: 0,
    discountAmt: '',
    givenQty: '',
    cgstPerc: 0,
    cgstAmt: '',
    sgstPerc: 0,
    sgstAmt: '',
    totalPayable: '',
    searchText: '',
    showSuggestions: false,
  });

  // API Calls
  const fetchCompanies = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/Company?fields=["name","country","gst_category"]&limit_page_length=1000`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        setCompanies(Array.isArray(data.data) ? data.data : []);
        if (data.data.length > 0) {
          setFormData(prev => ({ ...prev, company: data.data[0].name }));
          onCompanyChange(data.data[0].name);
        }
      } else {
        throw new Error(`Failed to fetch companies: ${resp.status} ${resp.statusText}`);
      }
    } catch (e) {
      console.error('Error fetching companies:', e);
      setCompanies([]);
      setErrorMessage('Error fetching companies: ' + (e as Error).message);
    }
  };

  const fetchWarehouses = async () => {
    if (!formData.company) return;
    try {
      const filters = encodeURIComponent(JSON.stringify([['company', '=', formData.company]]));
      const resp = await fetch(`${API_BASE_URL}/Warehouse?fields=["name"]&filters=${filters}&limit_page_length=1000`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        setWarehouses(Array.isArray(data.data) ? data.data : []);
        if (data.data.length > 0) {
          setFormData(prev => ({ ...prev, warehouse: data.data[0].name }));
        } else {
          setFormData(prev => ({ ...prev, warehouse: '' }));
          setErrorMessage(`No warehouses found for company "${formData.company}". Please create a warehouse first.`);
        }
      } else {
        throw new Error(`Failed to fetch warehouses: ${resp.status} ${resp.statusText}`);
      }
    } catch (e) {
      console.error('Error fetching warehouses:', e);
      setWarehouses([]);
      setFormData(prev => ({ ...prev, warehouse: '' }));
      setErrorMessage('Error fetching warehouses: ' + (e as Error).message);
    }
  };

  const fetchDepartments = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/Department?fields=["name"]&limit_page_length=1000`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        setDepartments(Array.isArray(data.data) ? data.data : []);
        if (data.data.length > 0) {
          setFormData(prev => ({ ...prev, department: data.data[0].name }));
        } else {
          console.warn('No departments found in ERPNext.');
          setErrorMessage('No departments found. Please create a department in ERPNext.');
        }
      } else {
        throw new Error(`Failed to fetch departments: ${resp.status} ${resp.statusText}`);
      }
    } catch (e) {
      console.error('Error fetching departments:', e);
      setDepartments([]);
      setErrorMessage('Error fetching departments: ' + (e as Error).message);
      setFormData(prev => ({ ...prev, department: '' }));
    }
  };

  const fetchCustomers = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/Customer?fields=["name","customer_name"]&limit_page_length=1000`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        setCustomers(Array.isArray(data.data) ? data.data : []);
      } else {
        throw new Error(`Failed to fetch customers: ${resp.status} ${resp.statusText}`);
      }
    } catch (e) {
      console.error('Error fetching customers:', e);
      setCustomers([]);
      setErrorMessage('Error fetching customers: ' + (e as Error).message);
    }
  };

  const fetchAddressForCustomer = async (customerCode: string) => {
    setCustomerAddresses([]);
    setSelectedAddress('');
    if (!customerCode) return;

    const fields = encodeURIComponent(JSON.stringify([
      'address_title', 'address_type', 'address_line1', 'address_line2',
      'city', 'state', 'country', 'pincode', 'links'
    ]));

    try {
      const resp = await fetch(`${API_BASE_URL}/Address?fields=${fields}&limit_page_length=1000`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        const matches = (data.data || []).filter((addr: any) =>
          Array.isArray(addr.links) &&
          addr.links.some((l: any) => l.link_doctype === 'Customer' && l.link_name === customerCode)
        );
        setCustomerAddresses(matches.map((addr: any) =>
          [addr.address_title, addr.address_type, addr.address_line1, addr.address_line2, addr.city, addr.state, addr.country, addr.pincode].filter(Boolean).join(', ')
        ));
        setSelectedAddress(matches[0] ? matches[0].map((addr: any) =>
          [addr.address_title, addr.address_type, addr.address_line1, addr.address_line2, addr.city, addr.state, addr.country, addr.pincode].filter(Boolean).join(', ')
        )[0] : '');
      } else {
        throw new Error(`Failed to fetch addresses: ${resp.status} ${resp.statusText}`);
      }
    } catch (e) {
      console.error('Error fetching addresses:', e);
      setCustomerAddresses([]);
      setSelectedAddress('');
      setErrorMessage('Error fetching address: ' + (e as Error).message);
    }
  };

  const fetchDoctors = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/Doctor Master?fields=["name"]`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        setDoctors(Array.isArray(data.data) ? data.data : []);
      } else {
        throw new Error(`Failed to fetch doctors: ${resp.status} ${resp.statusText}`);
      }
    } catch (e) {
      console.error('Error fetching doctors:', e);
      setDoctors([]);
      setErrorMessage('Error fetching doctors: ' + (e as Error).message);
    }
  };

  const fetchClassifications = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/Classification?fields=["name"]&limit_page_length=1000`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        setClassifications(data.data || []);
      } else {
        throw new Error(`Failed to fetch classifications: ${resp.status} ${resp.statusText}`);
      }
    } catch (e) {
      console.error('Error fetching classifications:', e);
      setClassifications([]);
      setErrorMessage('Error fetching classifications: ' + (e as Error).message);
    }
  };

  const fetchPatientNameDirect = async () => {
    const pid = formData.patient_id?.trim();
    if (!pid) {
      setFormData(prev => ({ ...prev, full_name: '' }));
      return;
    }
    try {
      const resp = await fetch(`${API_BASE_URL}/Patient Master/${encodeURIComponent(pid)}?fields=["full_name"]`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        setFormData(prev => ({ ...prev, full_name: data.data?.full_name || '' }));
      } else {
        setFormData(prev => ({ ...prev, full_name: '' }));
        setErrorMessage('Patient not found');
      }
    } catch (e) {
      console.error('Error fetching patient name:', e);
      setFormData(prev => ({ ...prev, full_name: '' }));
      setErrorMessage('Error fetching patient name: ' + (e as Error).message);
    }
  };

  const fetchItemMaster = async () => {
    setItemLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/Item?fields=["item_code","item_name","stock_uom","item_group","gst_hsn_code"]`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        setItemMasterList(Array.isArray(data.data)
          ? data.data.map((item: any) => ({
              item_code: item.item_code,
              item_name: item.item_name || item.item_code,
              unit: item.stock_uom || '',
              item_group: item.item_group || '',
              gst_hsn_code: item.gst_hsn_code || '',
              stock_qty: item.actual_qty || 0,
            }))
          : []);
      } else {
        throw new Error(`Failed to fetch items: ${resp.status} ${resp.statusText}`);
      }
    } catch (e) {
      console.error('Error fetching items:', e);
      setItemMasterList([]);
      setErrorMessage('Error fetching items: ' + (e as Error).message);
    } finally {
      setItemLoading(false);
    }
  };

  const fetchStockForItem = async (itemCode: string) => {
    if (!itemCode) return;
    try {
      const filters = encodeURIComponent(JSON.stringify([['item_code', '=', itemCode]]));
      const response = await fetch(`${API_BASE_URL}/Item?fields=["item_code","actual_qty"]&filters=${filters}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          const stockData = data.data[0];
          setItems(prev => prev.map(item =>
            item.item_code === stockData.item_code
              ? { ...item, stockQty: stockData.actual_qty?.toString() || '0' }
              : item
          ));
          if (searchFields.search_text === stockData.item_code) {
            setSearchFields(prev => ({ ...prev, available_stock: stockData.actual_qty || 0 }));
          }
        }
      } else {
        setErrorMessage('Failed to fetch stock for item: ' + itemCode);
      }
    } catch (e) {
      console.error('Error fetching stock for item:', e);
      setErrorMessage('Error fetching stock for item: ' + (e as Error).message);
    }
  };

  const fetchStockUpdates = async () => {
    try {
      const itemCodes = items
        .filter(item => item.item_code)
        .map(item => item.item_code)
        .concat(searchFields.search_text ? [searchFields.search_text] : []);
      if (!itemCodes.length) return;

      const filters = encodeURIComponent(JSON.stringify([['item_code', 'in', itemCodes]]));
      const response = await fetch(`${API_BASE_URL}/Item?fields=["item_code","actual_qty"]&filters=${filters}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        data.data.forEach((stockItem: any) => {
          setItems(prev => prev.map(item =>
            item.item_code === stockItem.item_code
              ? { ...item, stockQty: stockItem.actual_qty?.toString() || '0' }
              : item
          ));
          if (searchFields.search_text === stockItem.item_code) {
            setSearchFields(prev => ({ ...prev, available_stock: stockItem.actual_qty || 0 }));
          }
        });
      } else {
        setErrorMessage('Failed to fetch stock updates');
      }
    } catch (e) {
      console.error('Error fetching stock updates:', e);
      setErrorMessage('Error fetching stock updates: ' + (e as Error).message);
    }
  };

  // Polling
  const startPolling = useCallback(() => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    pollingInterval.current = setInterval(fetchStockUpdates, 10000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  // Handlers
  const onDepartmentSearch = () => {
    setShowDepartmentSuggestions(true);
    validateDepartment();
  };

  const onDepartmentBlur = () => {
    setTimeout(() => {
      setShowDepartmentSuggestions(false);
      validateDepartment();
    }, 200);
  };

  const selectDepartment = (deptName: string) => {
    setFormData(prev => ({ ...prev, department: deptName }));
    setShowDepartmentSuggestions(false);
    validateDepartment();
  };

  const validateDepartment = () => {
    const dept = formData.department?.trim();
    if (!dept) {
      setErrorMessage('Department is required.');
      setFormData(prev => ({ ...prev, department: '' }));
      return false;
    }
    if (!departments.some(d => d.name === dept)) {
      setErrorMessage(`Invalid department: "${dept}". Please select a valid department from ERPNext.`);
      setFormData(prev => ({ ...prev, department: '' }));
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const onCompanyChange = async (companyName: string | undefined = formData.company) => {
    const company = companies.find(c => c.name === companyName);
    if (company) {
      if (!company.country || !company.gst_category) {
        setErrorMessage(`Selected company "${company.name}" is missing country or GST category. Please update the Company record.`);
        setFormData(prev => ({ ...prev, company: '', warehouse: '', department: '' }));
        setWarehouses([]);
        setDepartments([]);
      } else {
        await fetchWarehouses();
        await fetchDepartments();
      }
    } else {
      setFormData(prev => ({ ...prev, warehouse: '', department: '' }));
      setWarehouses([]);
      setDepartments([]);
    }
  };

  const onCustomerChange = () => {
    const customer = customers.find(c => c.customer_name === formData.customer_name);
    setSelectedCustomerCode(customer?.name || '');
    fetchAddressForCustomer(customer?.name || '');
  };

  const addSearchItem = () => {
    setItems(prev => [...prev, newRow()]);
  };

  const deleteSelectedRows = () => {
    setItems(prev => prev.filter(item => !selectedRows.includes(item._rowid)));
    setSelectedRows([]);
    setAllItemsSelected(false);
    calculateTotals();
  };

  const toggleSelectAll = () => {
    if (!allItemsSelected) {
      setSelectedRows(items.map(it => it._rowid));
      setAllItemsSelected(true);
    } else {
      setSelectedRows([]);
      setAllItemsSelected(false);
    }
  };

  const filteredItems = (searchText: string) => {
    if (!searchText) return itemMasterList;
    const searchLower = searchText.toLowerCase();
    return itemMasterList.filter(
      item =>
        item.item_code.toLowerCase().includes(searchLower) ||
        item.item_name.toLowerCase().includes(searchLower)
    );
  };

  const onItemSearch = (idx: number) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = newItems[idx];
      if (!item) return prev;
      item.showSuggestions = true;
      if (!item.searchText) {
        item.item_code = '';
        item.item_name = '';
        item.unit = '';
        item.item_group = '';
        item.gst_hsn_code = '';
        item.stockQty = '';
      }
      if (item.searchText) {
        fetchStockForItem(item.searchText);
      }
      return newItems;
    });
  };

  const onItemFocus = (idx: number) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = newItems[idx];
      if (item) {
        item.showSuggestions = true;
      }
      return newItems;
    });
  };

  const onItemBlur = (idx: number) => {
    setTimeout(() => {
      setItems(prev => {
        const newItems = [...prev];
        const item = newItems[idx];
        if (item) {
          item.showSuggestions = false;
        }
        return newItems;
      });
    }, 200);
  };

  const selectItem = (idx: number, master: ItemMaster) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = newItems[idx];
      if (item) {
        item.item_code = master.item_code;
        item.item_name = master.item_name;
        item.unit = master.unit;
        item.item_group = master.item_group;
        item.gst_hsn_code = master.gst_hsn_code;
        item.stockQty = master.stock_qty?.toString() || '';
        item.searchText = `${master.item_code} - ${master.item_name}`;
        item.showSuggestions = false;
        updateItem(idx);
        fetchStockForItem(master.item_code);
      }
      return newItems;
    });
  };

  const updateItem = (idx: number) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = newItems[idx];
      const q = Number(item.saleQty) || 0;
      const rate = Number(item.unitSaleRate) || 0;
      item.amount = (q * rate).toFixed(2);
      item.discountAmt = (((item.discountPerc || 0) / 100) * Number(item.amount)).toFixed(2);
      item.cgstAmt = (((item.cgstPerc || 0) / 100) * (Number(item.amount) - Number(item.discountAmt))).toFixed(2);
      item.sgstAmt = (((item.sgstPerc || 0) / 100) * (Number(item.amount) - Number(item.discountAmt))).toFixed(2);
      item.totalPayable = (
        Number(item.amount) -
        Number(item.discountAmt) +
        Number(item.cgstAmt) +
        Number(item.sgstAmt)
      ).toFixed(2);
      return newItems;
    });
    calculateTotals();
  };

  const calculateTotals = () => {
    let totalAmount = 0, totalDiscount = 0, totalCgst = 0, totalSgst = 0, grandTotal = 0;
    items.forEach(item => {
      totalAmount += Number(item.amount) || 0;
      totalDiscount += Number(item.discountAmt) || 0;
      totalCgst += Number(item.cgstAmt) || 0;
      totalSgst += Number(item.sgstAmt) || 0;
      grandTotal += Number(item.totalPayable) || 0;
    });
    setTotals({
      total_amount: totalAmount.toFixed(2),
      item_amount: totalAmount.toFixed(2),
      sub_total: totalAmount.toFixed(2),
      total_discount: totalDiscount.toFixed(2),
      total_cgst: totalCgst.toFixed(2),
      total_sgst: totalSgst.toFixed(2),
      grand_total: grandTotal.toFixed(2),
      net_amount: grandTotal.toFixed(2),
      cash_received: totals.cash_received,
      change_amount: totals.change_amount,
    });
    calculateChange();
  };

  const calculateChange = () => {
    const cashReceived = parseFloat(totals.cash_received) || 0;
    const grandTotal = parseFloat(totals.grand_total) || 0;
    setTotals(prev => ({ ...prev, change_amount: (cashReceived - grandTotal).toFixed(2) }));
  };

  const calculatePercentDiscount = () => {
    const discountPerc = Number(accountDetails.percent_discount) || 0;
    const subTotal = Number(totals.sub_total) || 0;
    const discountAmt = (discountPerc / 100) * subTotal;
    setTotals(prev => ({
      ...prev,
      total_discount: (Number(prev.total_discount) + discountAmt).toFixed(2),
      grand_total: (subTotal - discountAmt + Number(prev.total_cgst) + Number(prev.total_sgst)).toFixed(2),
      net_amount: (subTotal - discountAmt + Number(prev.total_cgst) + Number(prev.total_sgst)).toFixed(2),
    }));
    calculateChange();
  };

  const calculateTotalCash = () => {
    const cashInRs = parseFloat(accountDetails.cash_in_rs.toString()) || 0;
    const cashInAdvance = parseFloat(accountDetails.cash_in_advance.toString()) || 0;
    const totalCash = (cashInRs + cashInAdvance).toFixed(2);
    setAccountDetails(prev => ({ ...prev, total_cash: totalCash }));
    setTotals(prev => ({ ...prev, cash_received: totalCash }));
    calculateChange();
  };

  const saveInvoice = async () => {
    setIsLoading(true);
    setErrorMessage('');

    if (!formData.company) {
      setErrorMessage('Company is required');
      setIsLoading(false);
      return;
    }
    if (!formData.customer_name) {
      setErrorMessage('Customer is required');
      setIsLoading(false);
      return;
    }
    if (!formData.warehouse) {
      setErrorMessage('Warehouse is required');
      setIsLoading(false);
      return;
    }
    if (!validateDepartment()) {
      setIsLoading(false);
      return;
    }
    if (!items.length || items.every(item => !item.item_code)) {
      setErrorMessage('At least one valid item is required');
      setIsLoading(false);
      return;
    }
    if (!formData.dateTime) {
      setErrorMessage('Date and Time is required');
      setIsLoading(false);
      return;
    }
    for (const item of items) {
      if (item.item_code && Number(item.saleQty) > Number(item.stockQty)) {
        setErrorMessage(`Sale quantity for ${item.item_code} cannot exceed stock quantity (${item.stockQty})`);
        setIsLoading(false);
        return;
      }
    }

    try {
      const payload = {
        doctype: 'Sales Invoice',
        customer: formData.customer_name,
        company: formData.company,
        posting_date: formData.dateTime.split('T')[0],
        department: formData.department,
        update_stock: 1,
        items: items
          .filter(item => item.item_code)
          .map(item => ({
            doctype: 'Sales Invoice Item',
            item_code: item.item_code,
            item_name: item.item_name,
            description: item.item_name,
            gst_hsn_code: item.gst_hsn_code || '',
            item_group: item.item_group || '',
            qty: Number(item.saleQty) || 1,
            stock_uom: item.unit || 'Nos',
            uom: item.unit || 'Nos',
            conversion_factor: 1,
            stock_qty: Number(item.saleQty) || 1,
            rate: Number(item.unitSaleRate) || 0,
            amount: Number(item.amount) || 0,
            discount_percentage: Number(item.discountPerc) || 0,
            discount_amount: Number(item.discountAmt) || 0,
            warehouse: formData.warehouse,
            patient: formData.patient_id || '',
            department: formData.department,
            custom_ordered_qty: Number(item.orderedQty) || 0,
            custom_already_given_qty: Number(item.givenQty) || 0,
            price_list_rate: Number(item.unitSaleRate) || 0,
            base_price_list_rate: Number(item.unitSaleRate) || 0,
          })),
        total: Number(totals.total_amount) || 0,
        net_total: Number(totals.item_amount) || 0,
        total_taxes_and_charges: Number(totals.total_cgst) + Number(totals.total_sgst),
        grand_total: Number(totals.grand_total) || 0,
        rounded_total: Number(totals.grand_total) || 0,
        discount_amount: Number(totals.total_discount) || 0,
      };

      console.log('Saving invoice with payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${API_BASE_URL}/Sales Invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        setFormData(prev => ({ ...prev, billNo: result.data.name }));
        alert('Invoice saved successfully!');
        resetForm();
      } else {
        const errorData = await response.json();
        console.error('Failed to save invoice:', errorData);
        setErrorMessage(errorData.message || 'Failed to save invoice');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      setErrorMessage('Error saving invoice: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateInvoice = () => {
    alert('Demo: Update pressed. Integrate API as needed.');
  };

  const printInvoice = () => {
    alert('Demo: Print pressed. Integrate API as needed.');
  };

  const cancelInvoice = () => {
    if (window.confirm('Are you sure you want to cancel?')) {
      resetForm();
    }
  };

  const clearError = () => {
    setErrorMessage('');
  };

  const resetForm = () => {
    setFormData({
      billNo: '',
      company: companies.length > 0 ? companies[0].name : '',
      department: departments.length > 0 ? departments[0].name : '',
      tokenNumber: '',
      patient_id: '',
      full_name: '',
      customer_name: '',
      contactNo: '',
      dateTime: getNowDatetimeLocal(),
      ageYears: '',
      gender: '',
      selfPaying: true,
      transactionType: 'Cash',
      doctor: '',
      warehouse: warehouses.length > 0 ? warehouses[0].name : '',
    });
    setCustomerAddresses([]);
    setSelectedAddress('');
    setSelectedCustomerCode('');
    setItems([]);
    addSearchItem();
    setTotals({
      total_amount: '0.00',
      sub_total: '0.00',
      item_amount: '0.00',
      total_cgst: '0.00',
      total_sgst: '0.00',
      total_discount: '0.00',
      grand_total: '0.00',
      cash_received: '0',
      change_amount: '0.00',
      net_amount: '0.00',
    });
    setAccountDetails({
      account_details: '',
      date_amount: '0.00',
      net: '0.00',
      percent_discount: 0,
      cash_in_rs: 0,
      cash_in_advance: 0,
      total_cash: '0.00',
      due_dis: '0.00',
      credit: '0.00',
      balance: '0.00',
    });
  };

  // Effects
  useEffect(() => {
    fetchDoctors();
    fetchItemMaster();
    fetchClassifications();
    fetchCustomers();
    fetchCompanies();
    fetchDepartments();
    addSearchItem();
    startPolling();
    return () => {
      stopPolling();
    };
  }, []);

  useEffect(() => {
    if (!items.length) {
      setAllItemsSelected(false);
      setSelectedRows([]);
    } else if (items.every(r => selectedRows.includes(r._rowid))) {
      setAllItemsSelected(true);
    } else {
      setAllItemsSelected(false);
    }
  }, [items, selectedRows]);

  return (
    <div className="min-h-screen bg-gray-100 p-2 font-sans w-full overflow-x-auto">
      <div className="bg-white rounded-lg shadow-md border border-gray-300 p-3 max-w-full mx-auto min-h-[900px]">
        <div className="bg-blue-600 text-white p-3 rounded-t flex justify-between items-center">
          <h1 className="text-lg font-bold">Pharmacy → Sales Transaction → PH-POS Sale Bill / Invoice</h1>
          <div className="flex gap-2">
            <button onClick={saveInvoice} disabled={isLoading} className="bg-green-500 text-white px-3 py-1 rounded disabled:opacity-60">Save</button>
            <button onClick={updateInvoice} disabled={isLoading} className="bg-orange-500 text-white px-3 py-1 rounded disabled:opacity-60">Update</button>
            <button onClick={printInvoice} className="bg-gray-500 text-white px-3 py-1 rounded">Print</button>
            <button onClick={cancelInvoice} className="bg-red-500 text-white px-3 py-1 rounded">Cancel</button>
          </div>
        </div>

        {isLoading && (
          <div className="bg-blue-100 border border-blue-500 p-4 rounded my-4 text-center">
            <p>Processing...</p>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-100 border border-red-500 p-4 rounded my-4 flex justify-between items-center">
            <p className="text-red-700">{errorMessage}</p>
            <button onClick={clearError} className="bg-red-500 text-white px-2 py-1 rounded text-sm">Close</button>
          </div>
        )}

        {/* Bill Details Form */}
        <div className="bg-white border border-gray-300 rounded my-4">
          <div className="bg-blue-100 p-2 border-b border-gray-300">
            <h3 className="text-sm font-bold">Bill Details</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4 p-4">
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Bill No.</label>
              <input value={formData.billNo} readOnly className="border border-gray-300 rounded p-1 text-sm bg-gray-100" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Company</label>
              <select
                value={formData.company}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setFormData(prev => ({ ...prev, company: e.target.value }));
                  onCompanyChange(e.target.value);
                }}
                className="border border-gray-300 rounded p-1 text-sm"
              >
                {companies.map(company => (
                  <option key={company.name} value={company.name}>{company.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Warehouse</label>
              <select
                value={formData.warehouse}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, warehouse: e.target.value }))}
                className="border border-gray-300 rounded p-1 text-sm"
              >
                <option value="">--Select Warehouse--</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.name} value={warehouse.name}>{warehouse.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col relative">
              <label className="font-semibold text-sm text-right sm:text-left">Department</label>
              <div className="relative">
                <input
                  value={formData.department}
                  onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setFormData(prev => ({ ...prev, department: e.target.value }));
                    onDepartmentSearch();
                  }}
                  onFocus={() => setShowDepartmentSuggestions(true)}
                  onBlur={onDepartmentBlur}
                  placeholder="Enter Department..."
                  className="border border-gray-300 rounded p-1 text-sm w-full"
                />
                {showDepartmentSuggestions && (
                  <div className="absolute left-0 right-0 top-7 z-10 max-h-40 p-0 bg-white border border-blue-500 rounded shadow-md overflow-y-auto text-xs">
                    {filteredDepartments.map(dept => (
                      <div
                        key={dept.name}
                        onMouseDown={() => selectDepartment(dept.name)}
                        className="p-2 cursor-pointer hover:bg-blue-100"
                      >
                        {dept.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Patient ID</label>
              <input
                value={formData.patient_id}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, patient_id: e.target.value }))}
                onBlur={fetchPatientNameDirect}
                placeholder="Enter Patient ID or name..."
                className="border border-gray-300 rounded p-1 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Patient Name</label>
              <input value={formData.full_name} readOnly className="border border-gray-300 rounded p-1 text-sm bg-gray-100" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Token Number:</label>
              <input
                value={formData.tokenNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, tokenNumber: e.target.value }))}
                className="border border-gray-300 rounded p-1 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Date & Time</label>
              <input
                type="datetime-local"
                value={formData.dateTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, dateTime: e.target.value }))}
                className="border border-gray-300 rounded p-1 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Customer</label>
              <select
                value={formData.customer_name}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setFormData(prev => ({ ...prev, customer_name: e.target.value }));
                  onCustomerChange();
                }}
                className="border border-gray-300 rounded p-1 text-sm"
              >
                {customers.map(c => (
                  <option key={c.customer_name} value={c.customer_name}>{c.customer_name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Self Paying</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={formData.selfPaying}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, selfPaying: e.target.checked }))}
                  className="h-4 w-4"
                />
                <span className="text-sm">Yes</span>
              </div>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Customer Address:</label>
              <input value={selectedAddress} readOnly placeholder="Address (auto)" className="border border-gray-300 rounded p-1 text-sm bg-gray-100" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Contact No.</label>
              <input
                value={formData.contactNo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, contactNo: e.target.value }))}
                placeholder="Enter contact number"
                className="border border-gray-300 rounded p-1 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Age in Years</label>
              <input
                type="number"
                value={formData.ageYears}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, ageYears: e.target.value }))}
                placeholder="Enter age"
                className="border border-gray-300 rounded p-1 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Gender</label>
              <select
                value={formData.gender}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                className="border border-gray-300 rounded p-1 text-sm"
              >
                <option value="">--Select--</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Transaction Type</label>
              <select
                value={formData.transactionType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, transactionType: e.target.value }))}
                className="border border-gray-300 rounded p-1 text-sm"
              >
                <option value="Cash">Cash</option>
                <option value="Credit">Credit</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Doctor</label>
              <select
                value={formData.doctor}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, doctor: e.target.value }))}
                className="border border-gray-300 rounded p-1 text-sm"
              >
                <option value="">--Select--</option>
                {doctors.map(doctor => (
                  <option key={doctor.name} value={doctor.name}>{doctor.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-sm text-right sm:text-left">Requisition No.:</label>
              <input
                value={formData.tokenNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, tokenNumber: e.target.value }))}
                className="border border-gray-300 rounded p-1 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Search Details Section */}
        <div className="bg-white border border-gray-300 rounded my-4">
          <div className="bg-blue-100 p-2 border-b border-gray-300">
            <h3 className="text-sm font-bold">Search Details</h3>
          </div>
          <div className="bg-blue-50 p-2 border border-blue-200 rounded-b">
            <div className="flex flex-col sm:flex-row gap-5 items-center mb-2">
              <label className="flex flex-col sm:flex-row items-center gap-2">
                <span className="text-sm">Classification:</span>
                <select
                  value={searchFields.classification}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchFields(prev => ({ ...prev, classification: e.target.value }))}
                  className="border border-gray-300 rounded p-1 text-sm h-9"
                >
                  <option value="">Select</option>
                  {classifications.map(cl => (
                    <option key={cl.name} value={cl.name}>{cl.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={searchFields.generic}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFields(prev => ({ ...prev, generic: e.target.checked }))}
                  className="h-4 w-4"
                />
                <span className="text-sm">Generic</span>
              </label>
              <input
                value={searchFields.search_text}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFields(prev => ({ ...prev, search_text: e.target.value }))}
                placeholder="Type to search item..."
                className="border border-gray-300 rounded p-1 text-sm h-9 flex-1"
              />
              <input
                value={searchFields.search_by_generic}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchFields(prev => ({ ...prev, search_by_generic: e.target.value }))}
                placeholder="Search Generic Name"
                className="border border-gray-300 rounded p-1 text-sm h-9 flex-1"
              />
              <span className="text-sm">Available Stock: {searchFields.available_stock}</span>
              <button onClick={addSearchItem} className="bg-green-500 text-white px-3 py-1 rounded text-sm">Add Item</button>
            </div>
            <div>
              <button
                onClick={() => setShowSubstitute(prev => !prev)}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
              >
                Show Substitute Item
              </button>
            </div>
          </div>
        </div>

        {/* Item Table */}
        <div className="bg-white border border-gray-300 rounded my-4 overflow-x-auto">
          <table className="w-full border-collapse text-xs min-w-[1500px]">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 p-2 text-center">
                  <input
                    type="checkbox"
                    checked={allItemsSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                </th>
                <th className="border border-gray-300 p-2 text-center">#</th>
                <th className="border border-gray-300 p-2 text-center w-[250px]">Item</th>
                <th className="border border-gray-300 p-2 text-center">Batch No.</th>
                <th className="border border-gray-300 p-2 text-center">Expiry Date</th>
                <th className="border border-gray-300 p-2 text-center">Stock Qty</th>
                <th className="border border-gray-300 p-2 text-center">Ordered Qty.</th>
                <th className="border border-gray-300 p-2 text-center">Sale Qty</th>
                <th className="border border-gray-300 p-2 text-center">Unit Sale Rate</th>
                <th className="border border-gray-300 p-2 text-center">Item Amount</th>
                <th className="border border-gray-300 p-2 text-center">Discount (%)</th>
                <th className="border border-gray-300 p-2 text-center">Discount Amt.</th>
                <th className="border border-gray-300 p-2 text-center">Already Given Qty</th>
                <th className="border border-gray-300 p-2 text-center">CGST (%)</th>
                <th className="border border-gray-300 p-2 text-center">CGST Amt.</th>
                <th className="border border-gray-300 p-2 text-center">SGST (%)</th>
                <th className="border border-gray-300 p-2 text-center">SGST Amt.</th>
                <th className="border border-gray-300 p-2 text-center">Total Payable</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item._rowid} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      type="checkbox"
                      value={item._rowid}
                      checked={selectedRows.includes(item._rowid)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const value = e.target.value;
                        setSelectedRows(prev =>
                          e.target.checked
                            ? [...prev, value]
                            : prev.filter(id => id !== value)
                        );
                      }}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input value={i + 1} readOnly className="border border-gray-300 rounded p-1 text-xs w-full bg-gray-100" />
                  </td>
                  <td className="border border-gray-300 p-2 text-center w-[250px]">
                    <div className="relative">
                      <input
                        value={item.searchText}
                        onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setItems(prev => {
                            const newItems = [...prev];
                            newItems[i].searchText = e.target.value;
                            return newItems;
                          });
                          onItemSearch(i);
                        }}
                        onFocus={() => onItemFocus(i)}
                        onBlur={() => onItemBlur(i)}
                        placeholder="Search item code or name..."
                        className="border border-gray-300 rounded p-1 text-xs w-full"
                      />
                      {item.showSuggestions && (
                        <div className="absolute left-0 right-0 top-7 z-10 max-h-40 p-0 bg-white border border-blue-500 rounded shadow-md overflow-y-auto text-xs">
                          {filteredItems(item.searchText).map(master => (
                            <div
                              key={master.item_code}
                              onMouseDown={() => selectItem(i, master)}
                              className="p-2 cursor-pointer hover:bg-blue-100"
                            >
                              <strong>{master.item_code}</strong><br />
                              {master.item_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      value={item.batchNo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItems(prev => {
                        const newItems = [...prev];
                        newItems[i].batchNo = e.target.value;
                        return newItems;
                      })}
                      className="border border-gray-300 rounded p-1 text-xs w-full"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      type="date"
                      value={item.expiry}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItems(prev => {
                        const newItems = [...prev];
                        newItems[i].expiry = e.target.value;
                        return newItems;
                      })}
                      className="border border-gray-300 rounded p-1 text-xs w-full"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      value={item.stockQty}
                      readOnly
                      className="border border-gray-300 rounded p-1 text-xs w-full bg-gray-100"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      type="number"
                      value={item.orderedQty}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setItems(prev => {
                          const newItems = [...prev];
                          newItems[i].orderedQty = e.target.value;
                          return newItems;
                        });
                        updateItem(i);
                      }}
                      className="border border-gray-300 rounded p-1 text-xs w-full"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      type="number"
                      value={item.saleQty}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setItems(prev => {
                          const newItems = [...prev];
                          newItems[i].saleQty = e.target.value;
                          return newItems;
                        });
                        updateItem(i);
                      }}
                      className="border border-gray-300 rounded p-1 text-xs w-full"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitSaleRate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setItems(prev => {
                          const newItems = [...prev];
                          newItems[i].unitSaleRate = e.target.value;
                          return newItems;
                        });
                        updateItem(i);
                      }}
                      className="border border-gray-300 rounded p-1 text-xs w-full"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      value={item.amount}
                      readOnly
                      className="border border-gray-300 rounded p-1 text-xs w-full bg-gray-100"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      type="number"
                      step="0.01"
                      value={item.discountPerc}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setItems(prev => {
                          const newItems = [...prev];
                          newItems[i].discountPerc = Number(e.target.value);
                          return newItems;
                        });
                        updateItem(i);
                      }}
                      className="border border-gray-300 rounded p-1 text-xs w-full"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      value={item.discountAmt}
                      readOnly
                      className="border border-gray-300 rounded p-1 text-xs w-full bg-gray-100"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      value={item.givenQty}
                      readOnly
                      className="border border-gray-300 rounded p-1 text-xs w-full bg-gray-100"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      type="number"
                      step="0.01"
                      value={item.cgstPerc}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setItems(prev => {
                          const newItems = [...prev];
                          newItems[i].cgstPerc = Number(e.target.value);
                          return newItems;
                        });
                        updateItem(i);
                      }}
                      className="border border-gray-300 rounded p-1 text-xs w-full"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      value={item.cgstAmt}
                      readOnly
                      className="border border-gray-300 rounded p-1 text-xs w-full bg-gray-100"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      type="number"
                      step="0.01"
                      value={item.sgstPerc}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setItems(prev => {
                          const newItems = [...prev];
                          newItems[i].sgstPerc = Number(e.target.value);
                          return newItems;
                        });
                        updateItem(i);
                      }}
                      className="border border-gray-300 rounded p-1 text-xs w-full"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      value={item.sgstAmt}
                      readOnly
                      className="border border-gray-300 rounded p-1 text-xs w-full bg-gray-100"
                    />
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <input
                      value={item.totalPayable}
                      readOnly
                      className="border border-gray-300 rounded p-1 text-xs w-full bg-gray-100"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2">
            <button
              onClick={deleteSelectedRows}
              disabled={!selectedRows.length}
              className="bg-red-500 text-white px-3 py-1 rounded disabled:opacity-60"
            >
              Delete Selected
            </button>
          </div>
        </div>

        {/* Account Details */}
        <div className="bg-white border border-gray-300 rounded my-4">
          <div className="bg-blue-100 p-2 border-b border-gray-300">
            <h3 className="text-sm font-bold">Account Details</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 text-xs">
            <div className="flex flex-col">
              <label className="font-semibold text-xs">Amount</label>
              <input value={totals.total_amount} readOnly className="border border-gray-300 rounded p-1 text-right bg-gray-100" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">CGST Amount</label>
              <input value={totals.total_cgst} readOnly className="border border-gray-300 rounded p-1 text-right bg-gray-100" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">SGST Amount</label>
              <input value={totals.total_sgst} readOnly className="border border-gray-300 rounded p-1 text-right bg-gray-100" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">Item Amount</label>
              <input value={totals.item_amount} readOnly className="border border-gray-300 rounded p-1 text-right bg-gray-100" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">Sub Total</label>
              <input value={totals.sub_total} readOnly className="border border-gray-300 rounded p-1 text-right bg-gray-100" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">Date Amount</label>
              <input value={accountDetails.date_amount} readOnly className="border border-gray-300 rounded p-1 text-right bg-gray-100" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">Net</label>
              <input value={accountDetails.net} className="border border-gray-300 rounded p-1 text-right" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">Discount %</label>
              <input
                type="number"
                step="0.01"
                value={accountDetails.percent_discount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setAccountDetails(prev => ({ ...prev, percent_discount: Number(e.target.value) }));
                  calculatePercentDiscount();
                }}
                className="border border-gray-300 rounded p-1 text-right"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">Total Discount</label>
              <input value={totals.total_discount} readOnly className="border border-gray-300 rounded p-1 text-right bg-gray-100" />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">Cash In Rs.</label>
              <input
                type="number"
                step="0.01"
                value={accountDetails.cash_in_rs}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setAccountDetails(prev => ({ ...prev, cash_in_rs: Number(e.target.value) }));
                  calculateTotalCash();
                }}
                className="border border-gray-300 rounded p-1 text-right"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">Cash in Advance</label>
              <input
                type="number"
                step="0.01"
                value={accountDetails.cash_in_advance}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setAccountDetails(prev => ({ ...prev, cash_in_advance: Number(e.target.value) }));
                  calculateTotalCash();
                }}
                className="border border-gray-300 rounded p-1 text-right"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-xs">Cash Received</label>
              <input value={accountDetails.total_cash} readOnly className="border border-gray-300 rounded p-1 text-right bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
