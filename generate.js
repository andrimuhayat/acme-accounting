const fs = require('fs');

const accounts = ['Cash', 'Accounts Receivable', 'Inventory', 'Accounts Payable', 'Sales Revenue', 'Cost of Goods Sold', 'Salaries Expense', 'Rent Expense', 'Utilities Expense', 'Interest Expense', 'Tax Expense', 'Loan Payable', 'Common Stock', 'Retained Earnings', 'Dividends Payable', 'Sales Tax Payable', 'Prepaid Expenses', 'Accrued Liabilities', 'Unearned Revenue', 'Fixed Assets'];
const descriptions = ['Invoice payment', 'Purchase of goods', 'Salary disbursement', 'Rent payment', 'Product sale', 'Inventory adjustment', 'Utility bill', 'Loan repayment', 'Interest income', 'Tax payment'];

function getRandomDate() {
  const start = new Date(2020, 0, 1);
  const end = new Date(2025, 0, 1);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
    .toISOString().split('T')[0];
}

function getRandomAmount() {
  return (Math.random() * 120000).toFixed(2);
}

for (let i = 0; i < 2000000; i++) {
  const date = getRandomDate();
  const account = accounts[Math.floor(Math.random() * accounts.length)];
  const description = descriptions[Math.floor(Math.random() * descriptions.length)];
  const debit = Math.random() > 0.5 ? getRandomAmount() : '';
  const credit = debit === '' ? getRandomAmount() : '';
  if (fs.existsSync(`tmp/${date.substring(0, 7)}.csv`)) {
    fs.writeFileSync(`tmp/${date.substring(0, 7)}.csv`, `${date},${account},${description},${debit},${credit}\n`, { flag: 'a' });
  } else {
    fs.writeFileSync(`tmp/${date.substring(0, 7)}.csv`, `${date},${account},${description},${debit},${credit}\n`);
  }
}

console.log('Generated 1 million accounting line items in accounting_line_items.csv');
