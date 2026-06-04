export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  budget: number;
  budgetRemaining: number;
  active: boolean;
  createdAt: string;
  employeeCount?: number;
}

export interface Employee {
  id: string;
  name: string;
  dailyRate: number;
  projectId: string;
  active: boolean;
}

export interface Payroll {
  id: string;
  projectId: string;
  weekStart: string;
  weekEnd: string;
  totalPaid: number;
  status: 'open' | 'closed';
  createdAt: string;
  payments?: Payment[];
}

export interface Attendance {
  id?: string;
  payrollId: string;
  employeeId: string;
  day: string;
  present: boolean;
}

export interface Payment {
  id: string;
  payrollId: string;
  employeeId: string;
  daysWorked: number;
  amount: number;
  employee?: Employee;
}
