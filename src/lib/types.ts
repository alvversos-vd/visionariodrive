export interface DailyEntry {
  id: string;
  date: string;
  hoursWorked: number;
  kmDriven: number;
  totalEarnings: number;
  fuelPrice: number;
  vehicleConsumption: number;
  installment: number;
  maintenance: number;
  insurance: number;
  otherCosts: number;
  // Calculated
  litersConsumed: number;
  fuelCost: number;
  monthlyFixedCosts: number;
  dailyFixedCost: number;
  totalCost: number;
  profit: number;
  profitPerHour: number;
  profitPerKm: number;
}

export interface DailyGoal {
  amount: number;
}

export function calculateEntry(input: {
  hoursWorked: number;
  kmDriven: number;
  totalEarnings: number;
  fuelPrice: number;
  vehicleConsumption: number;
  installment: number;
  maintenance: number;
  insurance: number;
  otherCosts: number;
}): Omit<DailyEntry, 'id' | 'date'> {
  const litersConsumed = input.vehicleConsumption > 0 ? input.kmDriven / input.vehicleConsumption : 0;
  const fuelCost = litersConsumed * input.fuelPrice;
  const monthlyFixedCosts = input.installment + input.maintenance + input.insurance + input.otherCosts;
  const dailyFixedCost = monthlyFixedCosts / 30;
  const totalCost = fuelCost + dailyFixedCost;
  const profit = input.totalEarnings - totalCost;
  const profitPerHour = input.hoursWorked > 0 ? profit / input.hoursWorked : 0;
  const profitPerKm = input.kmDriven > 0 ? profit / input.kmDriven : 0;

  return {
    ...input,
    litersConsumed,
    fuelCost,
    monthlyFixedCosts,
    dailyFixedCost,
    totalCost,
    profit,
    profitPerHour,
    profitPerKm,
  };
}
