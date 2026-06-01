<script setup lang="ts">
/**
 * Accessible form-field wrapper.
 *
 * - Associates a real <label> with its control via a generated id (SSR-stable
 *   through useId()), so screen readers announce the field name.
 * - Conveys required state both visually (*) and to assistive tech (an sr-only
 *   "(required)" baked into the label's accessible name).
 * - Renders an inline, role="alert" error that is linked to the control through
 *   aria-describedby, so validation failures are announced and tied to the field
 *   instead of vanishing into a corner toast.
 *
 * The id is exposed via slot prop rather than hard-applied, because PrimeVue
 * splits into two families: native-id inputs (InputText / Textarea bind :id) and
 * wrapper widgets (Dropdown/Select, DatePicker/Calendar, InputNumber, Checkbox,
 * ToggleSwitch/InputSwitch, InputChips/Chips bind :input-id). The consumer binds
 * the exposed id to whichever prop its widget needs.
 */
const props = defineProps<{
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Override the generated id (rarely needed). */
  fieldId?: string;
}>();

const auto = useId();
const id = computed(() => props.fieldId ?? `ff-${auto}`);
const hintId = computed(() => `${id.value}-hint`);
const errorId = computed(() => `${id.value}-error`);

const describedby = computed(() => {
  const parts: string[] = [];
  if (props.hint) parts.push(hintId.value);
  if (props.error) parts.push(errorId.value);
  return parts.length ? parts.join(' ') : undefined;
});
</script>

<template>
  <div class="form-field">
    <label :for="id" class="form-field-label">
      {{ label }}<span v-if="required" class="form-field-req" aria-hidden="true"> *</span><span
        v-if="required"
        class="sr-only"
      > (required)</span>
    </label>

    <slot
      :id="id"
      :describedby="describedby"
      :invalid="Boolean(error)"
      :required="Boolean(required)"
    />

    <small v-if="hint" :id="hintId" class="form-field-hint">{{ hint }}</small>
    <small v-if="error" :id="errorId" class="form-field-error" role="alert">{{ error }}</small>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0; /* allow the control to shrink inside flex/grid rows */
}

.form-field-label {
  font-weight: 500;
  font-size: 0.875rem;
}

.form-field-req {
  color: var(--p-red-500, #ef4444);
}

.form-field-hint {
  color: var(--p-text-muted-color);
  font-size: 0.8125rem;
}

.form-field-error {
  color: var(--p-red-500, #ef4444);
  font-size: 0.8125rem;
  overflow-wrap: break-word;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
