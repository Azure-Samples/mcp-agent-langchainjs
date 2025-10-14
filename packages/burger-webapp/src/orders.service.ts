export interface BurgerOrder {
  id: string;
  createdAt: string;
  items: Array<{
    burgerId: string;
    quantity: number;
    extraToppingIds?: string[];
  }>;
  estimatedCompletionAt: string;
  totalPrice: number;
  status: string;
  nickname?: string;
  readyAt?: string;
  completedAt?: string;
}

export async function fetchOrders({
  apiBaseUrl,
  status,
  lastMinutes = 10,
}: {
  apiBaseUrl: string;
  status?: string;
  lastMinutes?: number;
}): Promise<BurgerOrder[] | undefined> {
  try {
    const parameters = new URLSearchParams();
    if (status) parameters.append('status', status);
    if (lastMinutes) parameters.append('last', `${lastMinutes}m`);
    const url = `${apiBaseUrl}/api/orders?${parameters.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}
