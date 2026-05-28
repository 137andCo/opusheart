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

const isEdit = computed(() => !!props.resource);
const dialogTitle = computed(() => (isEdit.value ? 'Edit Resource' : 'New Resource'));

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
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

async function save() {
  if (!form.value.name.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Name is required', life: 3000 });
    return;
  }
  if (!form.value.category) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Category is required', life: 3000 });
    return;
  }
  if (!form.value.provider.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Provider is required', life: 3000 });
    return;
  }
  if (!form.value.eligibility.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Eligibility is required', life: 3000 });
    return;
  }
  if (!form.value.hours.trim()) {
    toast.add({ severity: 'warn', summary: 'Validation', detail: 'Hours are required', life: 3000 });
    return;
  }

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
    :style="{ width: '750px' }"
    @update:visible="closeDialog"
  >
    <div class="dialog-form">
      <div class="field">
        <label>Name *</label>
        <InputText v-model="form.name" class="w-full" placeholder="Resource name" />
      </div>

      <div class="field">
        <label>Description</label>
        <Textarea v-model="form.description" class="w-full" :rows="3" placeholder="Resource description" />
      </div>

      <div class="field-row">
        <div class="field">
          <label>Category *</label>
          <Dropdown
            v-model="form.category"
            :options="categoryOptions"
            option-label="label"
            option-value="value"
            class="w-full"
            placeholder="Select category"
          />
        </div>
        <div class="field">
          <label>Subcategory</label>
          <InputText v-model="form.subcategory" class="w-full" placeholder="Subcategory" />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Provider *</label>
          <InputText v-model="form.provider" class="w-full" placeholder="Organization or provider" />
        </div>
        <div class="field">
          <label>Eligibility *</label>
          <InputText v-model="form.eligibility" class="w-full" placeholder="Who is eligible" />
        </div>
      </div>

      <div class="field">
        <label>Hours *</label>
        <InputText v-model="form.hours" class="w-full" placeholder="e.g., Mon-Fri 9am-5pm" />
      </div>

      <div class="field-row">
        <div class="field">
          <label>Phone</label>
          <InputText v-model="form.phone" class="w-full" placeholder="Phone number" />
        </div>
        <div class="field">
          <label>Email</label>
          <InputText v-model="form.email" class="w-full" placeholder="Contact email" />
        </div>
      </div>

      <div class="field">
        <label>Website</label>
        <InputText v-model="form.website" class="w-full" placeholder="https://..." />
      </div>

      <div class="section-label">Address</div>
      <div class="field">
        <label>Street</label>
        <InputText v-model="form.address.street" class="w-full" placeholder="Street address" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>City</label>
          <InputText v-model="form.address.city" class="w-full" placeholder="City" />
        </div>
        <div class="field">
          <label>State</label>
          <InputText v-model="form.address.state" class="w-full" placeholder="State" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>ZIP</label>
          <InputText v-model="form.address.zip" class="w-full" placeholder="ZIP code" />
        </div>
        <div class="field">
          <label>Country</label>
          <InputText v-model="form.address.country" class="w-full" placeholder="Country" />
        </div>
      </div>

      <div class="section-label">Location (optional)</div>
      <div class="field-row">
        <div class="field">
          <label>Latitude</label>
          <InputNumber v-model="form.location.lat" class="w-full" :min-fraction-digits="1" :max-fraction-digits="8" placeholder="Latitude" />
        </div>
        <div class="field">
          <label>Longitude</label>
          <InputNumber v-model="form.location.lng" class="w-full" :min-fraction-digits="1" :max-fraction-digits="8" placeholder="Longitude" />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Languages</label>
          <InputText v-model="form.languages" class="w-full" placeholder="Comma-separated, e.g., English, Spanish" />
        </div>
        <div class="field">
          <label>Tags</label>
          <InputText v-model="form.tags" class="w-full" placeholder="Comma-separated tags" />
        </div>
      </div>

      <div class="field-checkbox">
        <InputSwitch v-model="form.featured" />
        <label>Featured</label>
      </div>
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
.field label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.field-checkbox label {
  font-weight: 500;
  font-size: 0.875rem;
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
</style>
