<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  household: any | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const toast = useToast();

const saving = ref(false);
const errors = reactive<Record<string, string>>({ name: '' });
const form = ref({
  name: '',
  address: {
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  },
});

watch(() => props.visible, (val) => {
  if (val) {
    errors.name = '';
    if (props.household) {
      form.value = {
        name: props.household.name || '',
        address: {
          street: props.household.address?.street || '',
          city: props.household.address?.city || '',
          state: props.household.address?.state || '',
          zip: props.household.address?.zip || '',
          country: props.household.address?.country || '',
        },
      };
    } else {
      form.value = { name: '', address: { street: '', city: '', state: '', zip: '', country: '' } };
    }
  }
});

const isEdit = computed(() => !!props.household);
const dialogTitle = computed(() => isEdit.value ? 'Edit Household' : 'New Household');

function buildBody() {
  const body: Record<string, any> = { name: form.value.name };
  const addr = form.value.address;
  const hasAddress = addr.street || addr.city || addr.state || addr.zip || addr.country;
  if (hasAddress) {
    body.address = {};
    if (addr.street) body.address.street = addr.street;
    if (addr.city) body.address.city = addr.city;
    if (addr.state) body.address.state = addr.state;
    if (addr.zip) body.address.zip = addr.zip;
    if (addr.country) body.address.country = addr.country;
  }
  return body;
}

function validate(): boolean {
  errors.name = form.value.name.trim() ? '' : 'Name is required.';
  return !Object.values(errors).some(Boolean);
}

async function save() {
  if (!validate()) return;
  saving.value = true;
  try {
    const body = buildBody();
    if (isEdit.value) {
      const id = props.household._id || props.household.id;
      await api(`/api/households/${id}`, { method: 'PUT', body });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Household updated', life: 3000 });
    } else {
      await api('/api/households', { method: 'POST', body });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Household created', life: 3000 });
    }
    emit('saved');
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: err.data?.error?.message || 'Failed to save household', life: 4000 });
  } finally {
    saving.value = false;
  }
}

function close() {
  emit('update:visible', false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="close"
    :header="dialogTitle"
    modal
    :style="{ width: '32rem', maxWidth: '92vw' }"
    :closable="true"
  >
    <div class="dialog-form">
      <FormField label="Name" required :error="errors.name">
        <template #default="{ id, describedby, invalid }">
          <InputText :id="id" v-model="form.name" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="Household name" />
        </template>
      </FormField>

      <Divider align="left"><span class="divider-text">Address (optional)</span></Divider>

      <FormField label="Street">
        <template #default="{ id }">
          <InputText :id="id" v-model="form.address.street" class="w-full" placeholder="Street address" />
        </template>
      </FormField>
      <div class="field-row">
        <FormField label="City" class="flex-1">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.address.city" class="w-full" />
          </template>
        </FormField>
        <FormField label="State" style="width: 6rem">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.address.state" class="w-full" />
          </template>
        </FormField>
        <FormField label="ZIP" style="width: 7rem">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.address.zip" class="w-full" />
          </template>
        </FormField>
      </div>
      <FormField label="Country">
        <template #default="{ id }">
          <InputText :id="id" v-model="form.address.country" class="w-full" placeholder="Country" />
        </template>
      </FormField>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="close" />
      <Button :label="isEdit ? 'Update' : 'Create'" :loading="saving" @click="save" />
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.field-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.flex-1 {
  flex: 1;
}
.w-full {
  width: 100%;
}
.divider-text {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}
</style>
