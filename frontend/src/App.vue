<script setup>
import { onMounted, reactive, ref } from 'vue';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const loading = ref(false);
const errorMessage = ref('');
const events = ref([]);

const newEvent = reactive({
  name: '',
  date: '',
  location: '',
  courses: '',
  categories: ''
});

const editingEventId = ref(null);
const editForm = reactive({
  name: '',
  date: '',
  location: '',
  courses: '',
  categories: ''
});

function normalizeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function parseCommaList(value) {
  return normalizeList(String(value || '').split(','));
}

function listToCommaText(value) {
  return normalizeList(value).join(', ');
}

async function fetchEvents() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const response = await fetch(`${apiBaseUrl}/api/events`);
    if (!response.ok) {
      throw new Error('Failed to load events');
    }
    events.value = await response.json();
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

function resetNewEventForm() {
  newEvent.name = '';
  newEvent.date = '';
  newEvent.location = '';
  newEvent.courses = '';
  newEvent.categories = '';
}

async function addEvent() {
  errorMessage.value = '';

  const payload = {
    name: newEvent.name.trim(),
    date: newEvent.date,
    location: newEvent.location.trim(),
    courses: parseCommaList(newEvent.courses),
    categories: parseCommaList(newEvent.categories)
  };

  if (!payload.name || !payload.date || !payload.location) {
    errorMessage.value = 'Name, Date, and Location are required.';
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to save event');
    }

    resetNewEventForm();
    await fetchEvents();
  } catch (error) {
    errorMessage.value = error.message;
  }
}

function startEdit(eventItem) {
  editingEventId.value = eventItem.id;
  editForm.name = eventItem.name;
  editForm.date = eventItem.date;
  editForm.location = eventItem.location;
  editForm.courses = listToCommaText(eventItem.courses);
  editForm.categories = listToCommaText(eventItem.categories);
}

function cancelEdit() {
  editingEventId.value = null;
  editForm.name = '';
  editForm.date = '';
  editForm.location = '';
  editForm.courses = '';
  editForm.categories = '';
}

async function saveEdit(id) {
  errorMessage.value = '';

  const payload = {
    name: editForm.name.trim(),
    date: editForm.date,
    location: editForm.location.trim(),
    courses: parseCommaList(editForm.courses),
    categories: parseCommaList(editForm.categories)
  };

  if (!payload.name || !payload.date || !payload.location) {
    errorMessage.value = 'Name, Date, and Location are required.';
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to save event');
    }

    cancelEdit();
    await fetchEvents();
  } catch (error) {
    errorMessage.value = error.message;
  }
}

async function deleteEvent(id) {
  errorMessage.value = '';

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to delete event');
    }

    if (editingEventId.value === id) {
      cancelEdit();
    }

    await fetchEvents();
  } catch (error) {
    errorMessage.value = error.message;
  }
}

onMounted(() => {
  fetchEvents();
});
</script>

<template>
  <main>
    <h1>Rogaine Events</h1>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="loading">Loading events...</p>

    <table v-if="!loading" class="events-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Date</th>
          <th>Location</th>
          <th>Courses</th>
          <th>Categories</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <input v-model="newEvent.name" type="text" placeholder="Event name" />
          </td>
          <td>
            <input v-model="newEvent.date" type="date" />
          </td>
          <td>
            <input v-model="newEvent.location" type="text" placeholder="Event location" />
          </td>
          <td>
            <input v-model="newEvent.courses" type="text" placeholder="6hr, 12hr" />
          </td>
          <td>
            <input v-model="newEvent.categories" type="text" placeholder="MO, WO, XO" />
          </td>
          <td class="actions-cell">
            <button type="button" @click="addEvent">Add</button>
          </td>
        </tr>

        <tr v-for="eventItem in events" :key="eventItem.id">
          <td v-if="editingEventId === eventItem.id">
            <input v-model="editForm.name" type="text" />
          </td>
          <td v-else>{{ eventItem.name }}</td>

          <td v-if="editingEventId === eventItem.id">
            <input v-model="editForm.date" type="date" />
          </td>
          <td v-else>{{ eventItem.date }}</td>

          <td v-if="editingEventId === eventItem.id">
            <input v-model="editForm.location" type="text" />
          </td>
          <td v-else>{{ eventItem.location }}</td>

          <td v-if="editingEventId === eventItem.id">
            <input v-model="editForm.courses" type="text" placeholder="6hr, 12hr" />
          </td>
          <td v-else>{{ eventItem.courses?.join(', ') || '-' }}</td>

          <td v-if="editingEventId === eventItem.id">
            <input v-model="editForm.categories" type="text" placeholder="MO, WO, XO" />
          </td>
          <td v-else>{{ eventItem.categories?.join(', ') || '-' }}</td>

          <td class="actions-cell">
            <template v-if="editingEventId === eventItem.id">
              <button type="button" @click="saveEdit(eventItem.id)">Save</button>
              <button type="button" @click="cancelEdit">Cancel</button>
            </template>
            <template v-else>
              <button type="button" @click="startEdit(eventItem)">Edit</button>
              <button type="button" @click="deleteEvent(eventItem.id)">Delete</button>
            </template>
          </td>
        </tr>

        <tr v-if="events.length === 0">
          <td colspan="6" class="empty-state">No events yet.</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
main {
  max-width: 920px;
  margin: 3rem auto;
  padding: 0 1rem;
  font-family: Inter, system-ui, Arial, sans-serif;
}

input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

button {
  padding: 0.5rem 0.8rem;
  cursor: pointer;
}

.events-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.events-table th,
.events-table td {
  border: 1px solid #ddd;
  padding: 0.6rem;
  text-align: left;
}

.error {
  color: #b00020;
}

.empty-state {
  text-align: center;
}
</style>
