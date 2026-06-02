<script setup lang="ts">
import { BLOCK_DEFINITIONS, BLOCK_TYPES, createBlock, type BlockType } from '@opusheart/builder';

const props = defineProps<{ modelValue: any[] }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: any[]): void }>();

const blocks = ref<any[]>([]);
let internal = false;

watch(
  () => props.modelValue,
  (v) => {
    if (internal) {
      internal = false;
      return;
    }
    blocks.value = Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : [];
  },
  { immediate: true, deep: true },
);

watch(
  blocks,
  () => {
    internal = true;
    emit('update:modelValue', JSON.parse(JSON.stringify(blocks.value)));
  },
  { deep: true },
);

// Block types, labels, and default factories come from @opusheart/builder — the
// one source of truth shared with the public renderer and the server.
const addType = ref<BlockType>('hero');

const addTypeOptions = BLOCK_TYPES.map((t) => ({ label: BLOCK_DEFINITIONS[t].label, value: t }));

const headingLevelOptions = [
  { label: 'H2', value: 2 },
  { label: 'H3', value: 3 },
  { label: 'H4', value: 4 },
];

const alignOptions = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
];

function typeLabel(type: string): string {
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Block';
}

function move(i: number, dir: number) {
  const target = i + dir;
  if (target < 0 || target >= blocks.value.length) return;
  const [item] = blocks.value.splice(i, 1);
  blocks.value.splice(target, 0, item);
}

function remove(i: number) {
  blocks.value.splice(i, 1);
}

function addBlock(type: BlockType) {
  blocks.value.push(JSON.parse(JSON.stringify(createBlock(type))));
}
</script>

<template>
  <div class="content-editor">
    <p v-if="blocks.length === 0" class="empty-state">
      No content blocks yet. Add a Hero for a bold opening.
    </p>

    <div
      v-for="(block, i) in blocks"
      :key="i"
      class="block-card"
    >
      <div class="block-header">
        <span class="block-type">{{ typeLabel(block.type) }}</span>
        <div class="block-actions">
          <Button
            icon="pi pi-arrow-up"
            text
            rounded
            size="small"
            :disabled="i === 0"
            :aria-label="`Move block ${i + 1} up`"
            @click="move(i, -1)"
          />
          <Button
            icon="pi pi-arrow-down"
            text
            rounded
            size="small"
            :disabled="i === blocks.length - 1"
            :aria-label="`Move block ${i + 1} down`"
            @click="move(i, 1)"
          />
          <Button
            icon="pi pi-trash"
            text
            rounded
            size="small"
            severity="danger"
            :aria-label="`Delete block ${i + 1}`"
            @click="remove(i)"
          />
        </div>
      </div>

      <!-- Hero -->
      <div v-if="block.type === 'hero'" class="block-fields">
        <FormField label="Eyebrow">
          <template #default="{ id }">
            <InputText :id="id" v-model="block.eyebrow" class="w-full" placeholder="Small label above the heading" />
          </template>
        </FormField>
        <FormField label="Heading">
          <template #default="{ id }">
            <InputText :id="id" v-model="block.heading" class="w-full" placeholder="Bold opening headline" />
          </template>
        </FormField>
        <FormField label="Subheading">
          <template #default="{ id }">
            <Textarea :id="id" v-model="block.subheading" class="w-full" :rows="2" placeholder="Supporting copy" />
          </template>
        </FormField>
        <div class="field-row">
          <FormField label="CTA Label">
            <template #default="{ id }">
              <InputText :id="id" v-model="block.ctaLabel" class="w-full" placeholder="Button text" />
            </template>
          </FormField>
          <FormField label="CTA Link">
            <template #default="{ id }">
              <InputText :id="id" v-model="block.ctaHref" class="w-full" placeholder="/where-it-goes" />
            </template>
          </FormField>
        </div>
        <FormField label="Alignment">
          <template #default="{ id }">
            <Dropdown
              :input-id="id"
              v-model="block.align"
              :options="alignOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </template>
        </FormField>
      </div>

      <!-- Heading -->
      <div v-else-if="block.type === 'heading'" class="block-fields">
        <FormField label="Text">
          <template #default="{ id }">
            <InputText :id="id" v-model="block.text" class="w-full" placeholder="Heading text" />
          </template>
        </FormField>
        <FormField label="Level">
          <template #default="{ id }">
            <Dropdown
              :input-id="id"
              v-model="block.level"
              :options="headingLevelOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </template>
        </FormField>
      </div>

      <!-- Paragraph -->
      <div v-else-if="block.type === 'paragraph'" class="block-fields">
        <FormField label="Text">
          <template #default="{ id }">
            <Textarea :id="id" v-model="block.text" class="w-full" :rows="4" placeholder="Paragraph text" />
          </template>
        </FormField>
      </div>

      <!-- Image -->
      <div v-else-if="block.type === 'image'" class="block-fields">
        <FormField label="Image URL">
          <template #default="{ id }">
            <InputText :id="id" v-model="block.src" class="w-full" placeholder="https://… or /path.jpg" />
          </template>
        </FormField>
        <FormField label="Alt Text">
          <template #default="{ id }">
            <InputText :id="id" v-model="block.alt" class="w-full" placeholder="Describe the image" />
          </template>
        </FormField>
        <FormField label="Caption">
          <template #default="{ id }">
            <InputText :id="id" v-model="block.caption" class="w-full" placeholder="Optional caption" />
          </template>
        </FormField>
      </div>
    </div>

    <div class="add-block-row">
      <Dropdown
        v-model="addType"
        :options="addTypeOptions"
        option-label="label"
        option-value="value"
        class="add-type-select"
        aria-label="Block type to add"
      />
      <Button
        label="Add block"
        icon="pi pi-plus"
        outlined
        @click="addBlock(addType)"
      />
    </div>
  </div>
</template>

<style scoped>
.content-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  margin: 0;
  padding: 0.75rem 0;
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}

.block-card {
  border: 1px solid var(--p-surface-200);
  border-radius: var(--p-border-radius, 6px);
  background: var(--p-surface-50);
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.block-type {
  font-weight: 600;
  font-size: 0.875rem;
}

.block-actions {
  display: flex;
  gap: 0.25rem;
}

.block-fields {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.875rem;
}

.add-block-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.add-type-select {
  min-width: 10rem;
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
