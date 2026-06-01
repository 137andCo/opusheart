<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  resource: any | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved'): void;
}>();

const api = useApi();
const toast = useToast();
const saving = ref(false);

const categoryOptions = [
  { label: 'Food', value: 'food' },
  { label: 'Housing', value: 'housing' },
  { label: 'Utilities', value: 'utilities' },
  { label: 'Medical', value: 'medical' },
  { label: 'Mental Health', value: 'mental_health' },
  { label: 'Employment', value: 'employment' },
  { label: 'Education', value: 'education' },
  { label: 'Legal', value: 'legal' },
  { label: 'Transportation', value: 'transportation' },
  { label: 'Clothing', value: 'clothing' },
  { label: 'Financial', value: 'financial' },
  { label: 'Childcare', value: 'childcare' },
  { label: 'Senior Services', value: 'senior_services' },
  { label: 'Disability', value: 'disability' },
  { label: 'Substance Abuse', value: 'substance_abuse' },
  { label: 'Domestic Violence', value: 'domestic_violence' },
  { label: 'Veterans', value: 'veterans' },
  { label: 'Other', value: 'other' },
];

const defaultForm = () => ({
  name: '',
  description: '',
  category: '' as string,
  subcategory: '',
  provider: '',
  eligibility: '',
  hours: '',
  phone: '',
  email: '',
  website: '',
  address: {
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  },
  location: {
    lat: null as number | null,
    lng: null as number | null,
  },
  languages: '',
  tags: '',
  featured: false,
});

const form = ref(defaultForm());

const errors = reactive<Record<string, string>>({
  name: '',
  category: '',
  provider: '',
  eligibility: '',
  hours: '',
});

const isEdit = computed(() => !!props.resource);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Resource' : 'New Resource'));

function resetErrors() {
  errors.name = '';
  errors.category = '';
  errors.provider = '';
  errors.eligibility = '';
  errors.hours = '';
}

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    resetErrors();
    if (props.resource) {
      const r = props.resource;
      form.value = {
        name: r.name || '',
        description: r.description || '',
        category: r.category || '',
        subcategory: r.subcategory || '',
        provider: r.provider || '',
        eligibility: r.eligibility || '',
        hours: r.hours || '',
        phone: r.phone || '',
        email: r.email || '',
        website: r.website || '',
        address: {
          street: r.address?.street || '',
          city: r.address?.city || '',
          state: r.address?.state || '',
          zip: r.address?.zip || '',
          country: r.address?.country || '',
        },
        location: {
          lat: r.location?.lat ?? null,
          lng: r.location?.lng ?? null,
        },
        languages: Array.isArray(r.languages) ? r.languages.join(', ') : (r.languages || ''),
        tags: Array.isArray(r.tags) ? r.tags.join(', ') : (r.tags || ''),
        featured: r.featured || false,
      };
    } else {
      form.value = defaultForm();
    }
  },
);

function closeDialog() {
  emit('update:visible', false);
}

function validate(): boolean {
  errors.name = form.value.name.trim() ? '' : 'Name is required.';
  errors.category = form.value.category ? '' : 'Category is required.';
  errors.provider = form.value.provider.trim() ? '' : 'Provider is required.';
  errors.eligibility = form.value.eligibility.trim() ? '' : 'Eligibility is required.';
  errors.hours = form.value.hours.trim() ? '' : 'Hours are required.';
  return !Object.values(errors).some(Boolean);
}

async function save() {
  if (!validate()) return;

  saving.value = true;
  try {
    const body: Record<string, any> = {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      category: form.value.category,
      provider: form.value.provider.trim(),
      eligibility: form.value.eligibility.trim(),
      hours: form.value.hours.trim(),
      address: {
        street: form.value.address.street.trim(),
        city: form.value.address.city.trim(),
        state: form.value.address.state.trim(),
        zip: form.value.address.zip.trim(),
      },
      featured: form.value.featured,
    };

    if (form.value.subcategory.trim()) body.subcategory = form.value.subcategory.trim();
    if (form.value.phone.trim()) body.phone = form.value.phone.trim();
    if (form.value.email.trim()) body.email = form.value.email.trim();
    if (form.value.website.trim()) body.website = form.value.website.trim();
    if (form.value.address.country.trim()) body.address.country = form.value.address.country.trim();

    if (form.value.location.lat != null && form.value.location.lng != null) {
      body.location = { lat: form.value.location.lat, lng: form.value.location.lng };
    }

    if (form.value.languages.trim()) {
      body.languages = form.value.languages.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (form.value.tags.trim()) {
      body.tags = form.value.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    const id = props.resource?._id || props.resource?.id;
    if (isEdit.value && id) {
      await api(`/api/resources/${id}`, { method: 'PUT', body });
      toast.add({ severity: 'success', summary: 'Updated', detail: 'Resource updated successfully', life: 3000 });
    } else {
      await api('/api/resources', { method: 'POST', body });
      toast.add({ severity: 'success', summary: 'Created', detail: 'Resource created successfully', life: 3000 });
    }

    emit('saved');
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.data?.error?.message || 'Failed to save resource',
      life: 4000,
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="dialogTitle"
    modal
    :closable="true"
    :style="{ width: '750px', maxWidth: '92vw' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <FormField label="Name" required :error="errors.name">
        <template #default="{ id, describedby, invalid }">
          <InputText :id="id" v-model="form.name" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="Resource name" />
        </template>
      </FormField>

      <FormField label="Description">
        <template #default="{ id }">
          <Textarea :id="id" v-model="form.description" class="w-full" :rows="3" placeholder="Resource description" />
        </template>
      </FormField>

      <div class="field-row">
        <FormField label="Category" required :error="errors.category">
          <template #default="{ id, describedby, invalid }">
            <Dropdown
              :input-id="id"
              v-model="form.category"
              :options="categoryOptions"
              option-label="label"
              option-value="value"
              class="w-full"
              :aria-describedby="describedby"
              :invalid="invalid"
              placeholder="Select category"
            />
          </template>
        </FormField>
        <FormField label="Subcategory">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.subcategory" class="w-full" placeholder="Subcategory" />
          </template>
        </FormField>
      </div>

      <div class="field-row">
        <FormField label="Provider" required :error="errors.provider">
          <template #default="{ id, describedby, invalid }">
            <InputText :id="id" v-model="form.provider" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="Organization or provider" />
          </template>
        </FormField>
        <FormField label="Eligibility" required :error="errors.eligibility">
          <template #default="{ id, describedby, invalid }">
            <InputText :id="id" v-model="form.eligibility" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="Who is eligible" />
          </template>
        </FormField>
      </div>

      <FormField label="Hours" required :error="errors.hours">
        <template #default="{ id, describedby, invalid }">
          <InputText :id="id" v-model="form.hours" class="w-full" :aria-describedby="describedby" :invalid="invalid" placeholder="e.g., Mon-Fri 9am-5pm" />
        </template>
      </FormField>

      <div class="field-row">
        <FormField label="Phone">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.phone" class="w-full" placeholder="Phone number" />
          </template>
        </FormField>
        <FormField label="Email">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.email" class="w-full" placeholder="Contact email" />
          </template>
        </FormField>
      </div>

      <FormField label="Website">
        <template #default="{ id }">
          <InputText :id="id" v-model="form.website" class="w-full" placeholder="https://..." />
        </template>
      </FormField>

      <div class="section-label">Address</div>
      <FormField label="Street">
        <template #default="{ id }">
          <InputText :id="id" v-model="form.address.street" class="w-full" placeholder="Street address" />
        </template>
      </FormField>
      <div class="field-row">
        <FormField label="City">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.address.city" class="w-full" placeholder="City" />
          </template>
        </FormField>
        <FormField label="State">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.address.state" class="w-full" placeholder="State" />
          </template>
        </FormField>
      </div>
      <div class="field-row">
        <FormField label="ZIP">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.address.zip" class="w-full" placeholder="ZIP code" />
          </template>
        </FormField>
        <FormField label="Country">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.address.country" class="w-full" placeholder="Country" />
          </template>
        </FormField>
      </div>

      <div class="section-label">Location (optional)</div>
      <div class="field-row">
        <FormField label="Latitude">
          <template #default="{ id }">
            <InputNumber :input-id="id" v-model="form.location.lat" class="w-full" :min-fraction-digits="1" :max-fraction-digits="8" placeholder="Latitude" />
          </template>
        </FormField>
        <FormField label="Longitude">
          <template #default="{ id }">
            <InputNumber :input-id="id" v-model="form.location.lng" class="w-full" :min-fraction-digits="1" :max-fraction-digits="8" placeholder="Longitude" />
          </template>
        </FormField>
      </div>

      <div class="field-row">
        <FormField label="Languages">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.languages" class="w-full" placeholder="Comma-separated, e.g., English, Spanish" />
          </template>
        </FormField>
        <FormField label="Tags">
          <template #default="{ id }">
            <InputText :id="id" v-model="form.tags" class="w-full" placeholder="Comma-separated tags" />
          </template>
        </FormField>
      </div>

      <FormField label="Featured">
        <template #default="{ id }">
          <InputSwitch :input-id="id" v-model="form.featured" />
        </template>
      </FormField>
    </div>

    <template #footer>
      <div class="dialog-actions">
        <Button label="Cancel" severity="secondary" text @click="closeDialog" />
        <Button :label="isEdit ? 'Update' : 'Create'" :loading="saving" @click="save" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.section-label {
  font-weight: 600;
  font-size: 0.9rem;
  margin-top: 0.5rem;
  color: var(--p-text-color);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}
.w-full {
  width: 100%;
}
@media (max-width: 640px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
