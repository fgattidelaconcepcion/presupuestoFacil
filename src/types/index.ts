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
  /** Plata que el cliente ya entregó (adelanto / seña / pagos parciales). */
  advanceAmount: number;
  status: "active" | "finished";
  active: boolean;
  createdAt: string;
  employeeCount?: number;
}

export interface Cobro {
  id: string;
  projectId: string;
  amount: number;
  date: string;
  note?: string | null;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  dailyRate: number;
  paymentType: "daily" | "sqm";
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
  status: "open" | "closed";
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

export interface Expense {
  id: string;
  projectId: string;
  description: string;
  amount: number;
  date: string;
  createdAt: string;
}

export type MaterialOrderStatus = "pending" | "partial" | "complete";

export interface MaterialItem {
  id: string;
  orderId: string;
  name: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  /** Precio por unidad. 0 = sin precio cargado (no descuenta del presupuesto). */
  unitPrice: number;
  received: boolean;
  receivedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface MaterialOrder {
  id: string;
  projectId: string;
  name: string;
  supplier?: string | null;
  notes?: string | null;
  orderDate: string;
  status: MaterialOrderStatus;
  items: MaterialItem[];
  createdAt: string;
}
