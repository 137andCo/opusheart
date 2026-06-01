<template>
  <div class="events-page">
    <header class="page-header">
      <h1 id="events-heading">Upcoming Events</h1>
      <p class="page-subtitle">Join us for worship, fellowship, and community.</p>
      <a
        :href="`${config.public.apiBase}/events/public/ical`"
        class="ical-link"
        aria-label="Subscribe to event calendar via iCal"
      >
        Subscribe to Calendar (iCal)
      </a>
    </header>

    <div v-if="pending" class="loading" aria-live="polite">Loading events...</div>

    <div v-else-if="events.length === 0" class="empty-state" aria-live="polite">
      <p>No upcoming events at this time. Check back soon!</p>
    </div>

    <section v-else aria-labelledby="events-heading">
      <p class="sr-only" aria-live="polite">{{ resultStatus }}</p>
      <ul class="event-list" role="list">
        <li v-for="event in events" :key="event.id" class="event-item">
          <div class="event-date-badge" aria-hidden="true">
            <span class="date-month">{{ formatMonth(event.startDate) }}</span>
            <span class="date-day">{{ formatDay(event.startDate) }}</span>
            <span class="date-weekday">{{ formatWeekday(event.startDate) }}</span>
          </div>

          <article class="event-details">
            <h2 class="event-title">{{ event.title }}</h2>

            <div class="event-meta">
              <span class="sr-only">{{ fullDate(event.startDate) }}</span>
              <time :datetime="event.startDate" class="event-time">
                {{ formatTime(event.startDate) }}
                <template v-if="event.endDate"> &ndash; {{ formatTime(event.endDate) }}</template>
              </time>
              <span v-if="event.allDay" class="all-day-badge">All Day</span>
            </div>

            <p v-if="event.location" class="event-location">{{ event.location }}</p>
            <p class="event-description">{{ event.description }}</p>

            <div v-if="event.volunteerSlots?.length" class="volunteer-info">
              <span class="volunteer-label">Volunteers needed:</span>
              <span
                v-for="slot in event.volunteerSlots"
                :key="slot.role"
                class="volunteer-slot"
              >
                {{ slot.role }}
                <span class="slot-count">({{ slot.filled?.length || 0 }}/{{ slot.needed }})</span>
              </span>
            </div>

            <div class="event-badges">
              <span v-if="event.registrationRequired" class="badge badge-register">
                Registration Required
              </span>
              <span v-if="event.maxAttendees" class="badge badge-capacity">
                Capacity: {{ event.maxAttendees }}
              </span>
              <span v-if="event.recurring" class="badge badge-recurring">
                {{ formatRecurrence(event.recurring) }}
              </span>
            </div>
          </article>
        </li>
      </ul>

      <nav v-if="totalPages > 1" class="pagination" aria-label="Event pages">
        <button
          :disabled="currentPage <= 1"
          class="page-btn"
          aria-label="Previous page"
          @click="currentPage--"
        >
          Previous
        </button>
        <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
        <button
          :disabled="currentPage >= totalPages"
          class="page-btn"
          aria-label="Next page"
          @click="currentPage++"
        >
          Next
        </button>
      </nav>
    </section>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const currentPage = ref(1);

const queryParams = computed(() => ({
  page: currentPage.value,
  limit: 20,
}));

const { data, pending } = await useFetch<{
  events: any[];
  pagination: { total: number; page: number; limit: number; pages: number };
}>(`${config.public.apiBase}/events/public`, {
  query: queryParams,
  watch: [queryParams],
  server: true,
});

const events = computed(() => data.value?.events || []);
const totalPages = computed(() => data.value?.pagination?.pages || 1);

const resultStatus = computed(() => {
  if (pending.value) return 'Loading…';
  if (events.value.length === 0) return 'No results found.';
  return `${events.value.length} result(s)`;
});

function toDate(d: string | Date) {
  return new Date(d);
}

function formatMonth(d: string | Date) {
  return toDate(d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

function formatDay(d: string | Date) {
  return toDate(d).getDate();
}

function formatWeekday(d: string | Date) {
  return toDate(d).toLocaleDateString('en-US', { weekday: 'short' });
}

function formatTime(d: string | Date) {
  return toDate(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fullDate(d: string | Date) {
  return toDate(d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRecurrence(rule: any) {
  if (!rule) return '';
  const freq = rule.frequency;
  const map: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Every 2 Weeks',
    monthly: 'Monthly',
    yearly: 'Yearly',
  };
  return map[freq] || freq;
}

useHead({
  title: 'Upcoming Events',
  meta: [
    {
      name: 'description',
      content: 'View upcoming community events, worship services, and fellowship gatherings.',
    },
    { property: 'og:title', content: 'Upcoming Events' },
    {
      property: 'og:description',
      content: 'View upcoming community events, worship services, and fellowship gatherings.',
    },
  ],
});
</script>

<style scoped>
.page-header {
  text-align: center;
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 2rem;
  color: var(--oh-text);
  margin-bottom: 0.5rem;
}

.page-subtitle {
  color: var(--oh-muted);
  font-size: 1.1rem;
  margin-bottom: 1rem;
}

.ical-link {
  display: inline-block;
  padding: 0.5rem 1.25rem;
  border: 1px solid var(--oh-primary);
  border-radius: var(--oh-radius);
  font-weight: 500;
  font-size: 0.875rem;
}

.loading,
.empty-state {
  text-align: center;
  padding: 3rem 0;
  color: var(--oh-muted);
}

.event-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.event-item {
  display: flex;
  gap: 1.25rem;
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
  padding: 1.25rem;
  align-items: flex-start;
}

.event-date-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 64px;
  padding: 0.5rem;
  background: var(--oh-primary);
  color: white;
  border-radius: var(--oh-radius);
  flex-shrink: 0;
}

.date-month {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.date-day {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.2;
}

.date-weekday {
  font-size: 0.6875rem;
  opacity: 0.85;
}

.event-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.event-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--oh-text);
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--oh-muted);
}

.all-day-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: var(--oh-surface);
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--oh-primary);
}

.event-location {
  font-size: 0.875rem;
  color: var(--oh-muted);
}

.event-description {
  font-size: 0.9375rem;
  color: var(--oh-text);
  line-height: 1.5;
}

.volunteer-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.8125rem;
}

.volunteer-label {
  font-weight: 600;
  color: var(--oh-text);
}

.volunteer-slot {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: var(--oh-surface);
  border-radius: var(--oh-radius);
  color: var(--oh-muted);
}

.slot-count {
  font-weight: 600;
  color: var(--oh-primary);
}

.event-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-register {
  background: var(--oh-warning-bg);
  color: var(--oh-warning-fg);
}

.badge-capacity {
  background: var(--oh-info-bg);
  color: var(--oh-info-fg);
}

.badge-recurring {
  background: var(--oh-success-bg);
  color: var(--oh-success-fg);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--oh-border);
}

.page-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--oh-border);
  border-radius: var(--oh-radius);
  background: var(--oh-bg);
  color: var(--oh-primary);
  font-weight: 500;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn:not(:disabled):hover {
  background: var(--oh-surface);
}

.page-info {
  font-size: 0.875rem;
  color: var(--oh-muted);
}

@media (max-width: 640px) {
  .event-item {
    flex-direction: column;
    align-items: stretch;
  }

  .event-date-badge {
    flex-direction: row;
    gap: 0.5rem;
    min-width: auto;
    padding: 0.375rem 0.75rem;
  }

  .date-day {
    font-size: 1.125rem;
  }
}
</style>
