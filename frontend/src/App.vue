<script setup>
import { computed, onMounted, reactive, ref } from 'vue';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const loading = ref(false);
const errorMessage = ref('');
const events = ref([]);
const teams = ref([]);
const teamsLoading = ref(false);
const teamsErrorMessage = ref('');
const selectedTeamsEvent = ref(null);
const teamSortBy = ref('score');
const teamSortDirection = ref('desc');

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

const newTeam = reactive({
  name: '',
  competitors: '',
  course: '',
  category: '',
  score: ''
});

const editingTeamId = ref(null);
const editTeamForm = reactive({
  name: '',
  competitors: '',
  course: '',
  category: '',
  score: ''
});

const sortedTeams = computed(() => {
  const items = [...teams.value];
  const directionFactor = teamSortDirection.value === 'asc' ? 1 : -1;

  items.sort((left, right) => {
    if (teamSortBy.value === 'score') {
      const leftScore = Number(left.score);
      const rightScore = Number(right.score);
      if (leftScore === rightScore) {
        return left.id - right.id;
      }
      return (leftScore - rightScore) * directionFactor;
    }

    const leftValue = String(left[teamSortBy.value] || '').toLowerCase();
    const rightValue = String(right[teamSortBy.value] || '').toLowerCase();

    if (leftValue === rightValue) {
      return left.id - right.id;
    }

    return leftValue.localeCompare(rightValue) * directionFactor;
  });

  return items;
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

function selectedEventCourses() {
  return normalizeList(selectedTeamsEvent.value?.courses || []);
}

function selectedEventCategories() {
  return normalizeList(selectedTeamsEvent.value?.categories || []);
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

function resetNewTeamForm() {
  newTeam.name = '';
  newTeam.competitors = '';
  newTeam.course = selectedEventCourses()[0] || '';
  newTeam.category = selectedEventCategories()[0] || '';
  newTeam.score = '';
}

function cancelTeamEdit() {
  editingTeamId.value = null;
  editTeamForm.name = '';
  editTeamForm.competitors = '';
  editTeamForm.course = '';
  editTeamForm.category = '';
  editTeamForm.score = '';
}

async function fetchTeams(eventId) {
  teamsLoading.value = true;
  teamsErrorMessage.value = '';

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${eventId}/teams`);
    if (!response.ok) {
      throw new Error('Failed to load teams');
    }
    teams.value = await response.json();
  } catch (error) {
    teamsErrorMessage.value = error.message;
  } finally {
    teamsLoading.value = false;
  }
}

async function openTeams(eventItem) {
  selectedTeamsEvent.value = eventItem;
  teams.value = [];
  resetNewTeamForm();
  cancelTeamEdit();
  await fetchTeams(eventItem.id);
}

function closeTeamsView() {
  selectedTeamsEvent.value = null;
  teams.value = [];
  teamsErrorMessage.value = '';
  resetNewTeamForm();
  cancelTeamEdit();
}

async function addTeam() {
  const eventId = selectedTeamsEvent.value?.id;
  if (!eventId) {
    return;
  }

  teamsErrorMessage.value = '';

  const payload = {
    name: newTeam.name.trim(),
    competitors: newTeam.competitors,
    course: newTeam.course.trim(),
    category: newTeam.category.trim(),
    score: Number(newTeam.score)
  };

  if (!payload.name || !payload.competitors.trim() || !payload.course || !payload.category || Number.isNaN(payload.score)) {
    teamsErrorMessage.value = 'Name, competitors, course, category, and score are required.';
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${eventId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to add team');
    }

    resetNewTeamForm();
    await fetchTeams(eventId);
  } catch (error) {
    teamsErrorMessage.value = error.message;
  }
}

function startTeamEdit(teamItem) {
  editingTeamId.value = teamItem.id;
  editTeamForm.name = teamItem.name;
  editTeamForm.competitors = teamItem.competitors;
  editTeamForm.course = teamItem.course;
  editTeamForm.category = teamItem.category;
  editTeamForm.score = String(teamItem.score);
}

async function saveTeamEdit(teamId) {
  const eventId = selectedTeamsEvent.value?.id;
  if (!eventId) {
    return;
  }

  teamsErrorMessage.value = '';

  const payload = {
    name: editTeamForm.name.trim(),
    competitors: editTeamForm.competitors,
    course: editTeamForm.course.trim(),
    category: editTeamForm.category.trim(),
    score: Number(editTeamForm.score)
  };

  if (!payload.name || !payload.competitors.trim() || !payload.course || !payload.category || Number.isNaN(payload.score)) {
    teamsErrorMessage.value = 'Name, competitors, course, category, and score are required.';
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${eventId}/teams/${teamId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to save team');
    }

    cancelTeamEdit();
    await fetchTeams(eventId);
  } catch (error) {
    teamsErrorMessage.value = error.message;
  }
}

async function deleteTeam(teamId) {
  const eventId = selectedTeamsEvent.value?.id;
  if (!eventId) {
    return;
  }

  teamsErrorMessage.value = '';

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${eventId}/teams/${teamId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to delete team');
    }

    if (editingTeamId.value === teamId) {
      cancelTeamEdit();
    }

    await fetchTeams(eventId);
  } catch (error) {
    teamsErrorMessage.value = error.message;
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

    if (selectedTeamsEvent.value?.id === id) {
      selectedTeamsEvent.value = null;
      teams.value = [];
      teamsErrorMessage.value = '';
      resetNewTeamForm();
      cancelTeamEdit();
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

    <table v-if="!loading && !selectedTeamsEvent" class="events-table">
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
              <button type="button" @click="openTeams(eventItem)">Teams</button>
            </template>
          </td>
        </tr>

        <tr v-if="events.length === 0">
          <td colspan="6" class="empty-state">No events yet.</td>
        </tr>
      </tbody>
    </table>

    <section v-if="selectedTeamsEvent" class="teams-section">
      <button type="button" class="back-button" @click="closeTeamsView">Back to Events</button>
      <h2>Teams - {{ selectedTeamsEvent.name }}</h2>
      <p class="teams-subtitle">Add teams for this event.</p>
      <div class="teams-sort-controls">
        <label>
          Sort by
          <select v-model="teamSortBy">
            <option value="score">Score</option>
            <option value="course">Course</option>
            <option value="category">Category</option>
          </select>
        </label>
        <label>
          Direction
          <select v-model="teamSortDirection">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>
      <p v-if="teamsErrorMessage" class="error">{{ teamsErrorMessage }}</p>
      <p v-if="teamsLoading">Loading teams...</p>

      <table v-if="!teamsLoading" class="teams-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Competitors (comma separated)</th>
            <th>Course</th>
            <th>Category</th>
            <th>Score</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input v-model="newTeam.name" type="text" placeholder="Team name" />
            </td>
            <td>
              <input v-model="newTeam.competitors" type="text" placeholder="Alice, Bob" />
            </td>
            <td>
              <select v-model="newTeam.course">
                <option value="" disabled>Select course</option>
                <option v-for="courseOption in selectedEventCourses()" :key="`new-course-${courseOption}`" :value="courseOption">
                  {{ courseOption }}
                </option>
              </select>
            </td>
            <td>
              <select v-model="newTeam.category">
                <option value="" disabled>Select category</option>
                <option v-for="categoryOption in selectedEventCategories()" :key="`new-category-${categoryOption}`" :value="categoryOption">
                  {{ categoryOption }}
                </option>
              </select>
            </td>
            <td>
              <input v-model="newTeam.score" type="number" min="0" step="0.01" placeholder="0" />
            </td>
            <td class="actions-cell">
              <button type="button" @click="addTeam">Add</button>
            </td>
          </tr>

          <tr v-for="teamItem in sortedTeams" :key="teamItem.id">
            <td v-if="editingTeamId === teamItem.id">
              <input v-model="editTeamForm.name" type="text" />
            </td>
            <td v-else>{{ teamItem.name }}</td>

            <td v-if="editingTeamId === teamItem.id">
              <input v-model="editTeamForm.competitors" type="text" />
            </td>
            <td v-else>{{ teamItem.competitors }}</td>

            <td v-if="editingTeamId === teamItem.id">
              <select v-model="editTeamForm.course">
                <option value="" disabled>Select course</option>
                <option v-for="courseOption in selectedEventCourses()" :key="`edit-course-${teamItem.id}-${courseOption}`" :value="courseOption">
                  {{ courseOption }}
                </option>
              </select>
            </td>
            <td v-else>{{ teamItem.course }}</td>

            <td v-if="editingTeamId === teamItem.id">
              <select v-model="editTeamForm.category">
                <option value="" disabled>Select category</option>
                <option v-for="categoryOption in selectedEventCategories()" :key="`edit-category-${teamItem.id}-${categoryOption}`" :value="categoryOption">
                  {{ categoryOption }}
                </option>
              </select>
            </td>
            <td v-else>{{ teamItem.category }}</td>

            <td v-if="editingTeamId === teamItem.id">
              <input v-model="editTeamForm.score" type="number" min="0" step="0.01" />
            </td>
            <td v-else>{{ teamItem.score }}</td>

            <td class="actions-cell">
              <template v-if="editingTeamId === teamItem.id">
                <button type="button" @click="saveTeamEdit(teamItem.id)">Save</button>
                <button type="button" @click="cancelTeamEdit">Cancel</button>
              </template>
              <template v-else>
                <button type="button" @click="startTeamEdit(teamItem)">Edit</button>
                <button type="button" @click="deleteTeam(teamItem.id)">Delete</button>
              </template>
            </td>
          </tr>

          <tr v-if="sortedTeams.length === 0">
            <td colspan="6" class="empty-state">No teams yet for this event.</td>
          </tr>
        </tbody>
      </table>
    </section>
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

select {
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

.teams-section {
  margin-top: 2rem;
}

.back-button {
  margin-bottom: 0.75rem;
}

.teams-subtitle {
  margin-top: 0;
}

.teams-sort-controls {
  display: flex;
  gap: 1rem;
  margin: 0.5rem 0 1rem;
  flex-wrap: wrap;
}

.teams-sort-controls label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.teams-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.events-table th,
.events-table td,
.teams-table th,
.teams-table td {
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
