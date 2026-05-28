import type { Ref } from 'vue';

interface UseCrudApiReturn<T> {
  items: Ref<T[]>;
  totalRecords: Ref<number>;
  loading: Ref<boolean>;
  page: Ref<number>;
  limit: Ref<number>;
  filters: Ref<Record<string, any>>;
  fetchAll: () => Promise<void>;
  fetchOne: (id: string) => Promise<T>;
  create: (body: Record<string, any>) => Promise<T>;
  update: (id: string, body: Record<string, any>) => Promise<T>;
  remove: (id: string) => Promise<void>;
  onPage: (event: { page: number; rows: number }) => void;
}

export function useCrudApi<T>(basePath: string, itemsKey: string): UseCrudApiReturn<T> {
  const api = useApi();
  const toast = useToast();

  const items = ref<T[]>([]) as Ref<T[]>;
  const totalRecords = ref(0);
  const loading = ref(false);
  const page = ref(1);
  const limit = ref(20);
  const filters = ref<Record<string, any>>({});

  async function fetchAll() {
    loading.value = true;
    try {
      const query: Record<string, any> = {
        page: page.value,
        limit: limit.value,
      };
      for (const [k, v] of Object.entries(filters.value)) {
        if (v !== null && v !== undefined && v !== '') {
          query[k] = v;
        }
      }
      const data = await api<any>(basePath, { query });
      items.value = (data[itemsKey] as T[]) || [];
      totalRecords.value = data.total || 0;
    } catch (err: any) {
      toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to load data', life: 4000 });
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: string): Promise<T> {
    return api<T>(`${basePath}/${id}`);
  }

  async function create(body: Record<string, any>): Promise<T> {
    const result = await api<T>(basePath, { method: 'POST', body });
    toast.add({ severity: 'success', summary: 'Created', detail: 'Record created successfully', life: 3000 });
    return result;
  }

  async function update(id: string, body: Record<string, any>): Promise<T> {
    const result = await api<T>(`${basePath}/${id}`, { method: 'PUT', body });
    toast.add({ severity: 'success', summary: 'Updated', detail: 'Record updated successfully', life: 3000 });
    return result;
  }

  async function remove(id: string): Promise<void> {
    await api<void>(`${basePath}/${id}`, { method: 'DELETE' });
    toast.add({ severity: 'success', summary: 'Deleted', detail: 'Record deleted', life: 3000 });
  }

  function onPage(event: { page: number; rows: number }) {
    page.value = event.page + 1; // PrimeVue DataTable is 0-indexed
    limit.value = event.rows;
    fetchAll();
  }

  return { items, totalRecords, loading, page, limit, filters, fetchAll, fetchOne, create, update, remove, onPage };
}
