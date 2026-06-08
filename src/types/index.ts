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
  status: 'active' | 'finished';
  active: boolean;
  createdAt: string;
  employeeCount?: number;
}

export interface Employee {
  id: string;
  name: string;
  dailyRate: number;
  paymentType: 'daily' | 'sqm';
  sqmRate?: number;
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
  attendances?: Attendance[];
}

export interface Attendance {
  id?: string;
  payrollId: string;
  employeeId: string;
  day: string;
  present: boolean;
  metersWorked?: number;
}

export interface Payment {
  id: string;
  payrollId: string;
  employeeId: string;
  daysWorked: number;
  metersTotal: number;
  amount: number;
  employee?: Employee;
}

