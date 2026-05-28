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

async function save() {
  if (!form.value.name.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Name is required', life: 3000 });
    return;
  }
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
    :style="{ width: '32rem' }"
    :closable="true"
  >
    <div class="dialog-form">
      <div class="field">
        <label>Name *</label>
        <InputText v-model="form.name" class="w-full" placeholder="Household name" />
      </div>

      <Divider align="left"><span class="divider-text">Address (optional)</span></Divider>

      <div class="field">
        <label>Street</label>
        <InputText v-model="form.address.street" class="w-full" placeholder="Street address" />
      </div>
      <div class="field-row">
        <div class="field flex-1">
          <label>City</label>
          <InputText v-model="form.address.city" class="w-full" />
        </div>
        <div class="field" style="width: 6rem">
          <label>State</label>
          <InputText v-model="form.address.state" class="w-full" />
        </div>
        <div class="field" style="width: 7rem">
          <label>ZIP</label>
          <InputText v-model="form.address.zip" class="w-full" />
        </div>
      </div>
      <div class="field">
        <label>Country</label>
        <InputText v-model="form.address.country" class="w-full" placeholder="Country" />
      </div>
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
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.field label {
  font-size: 0.875rem;
  font-weight: 500;
}
.field-row {
  display: flex;
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
