<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import JsonTreeNode from './components/JsonTreeNode.vue';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const weightingTableConfig = import.meta.env.VITE_SCALE_WEIGHTING_TABLE || '';

function parseWeightingTable(rawTable) {
  const defaultTable = [
    { duration: 24, weighting: 1.2 },
    { duration: 12, weighting: 1.0 },
    { duration: 6, weighting: 0.8 },
    { duration: 3, weighting: 0.6 },
    { duration: 2, weighting: 0.5 },
    { duration: 0, weighting: 0.3 }
  ];

  const raw = String(rawTable || '').trim();
  if (!raw) {
    return defaultTable;
  }

  const parsed = raw
    .split(/\s*[;|\n]\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(/[,:]/).map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) {
        return null;
      }

      const duration = Number(parts[0]);
      const weighting = Number(parts[1]);

      if (!Number.isFinite(duration) || !Number.isFinite(weighting)) {
        return null;
      }

      return { duration, weighting };
    })
    .filter(Boolean);

  return parsed.length > 0 ? parsed : defaultTable;
}

const weightingTable = parseWeightingTable(weightingTableConfig);
const currentView = ref('json-loader');
const loading = ref(false);
const errorMessage = ref('');
const events = ref([]);
const users = ref([]);
const usersLoading = ref(false);
const usersErrorMessage = ref('');
const jsonLoadErrorMessage = ref('');
const jsonLoadData = ref(null);
const jsonLoadLoading = ref(false);
const saveEventLoading = ref(false);
const saveEventErrorMessage = ref('');
const saveEventSuccessMessage = ref('');
const eventsIndex = ref([]);
const eventsIndexLoading = ref(false);
const eventsIndexErrorMessage = ref('');
const selectedEventYear = ref('');
const selectedEventSeries = ref('');
const selectedEventTitle = ref('');
const transformErrorMessage = ref('');
const transformedRows = ref([]);
const transformedColumns = ref([]);
const transformedDisplayMode = ref('raw');
const showCategoryMappingDialog = ref(false);
const categoryMappingRows = ref([]);
const categoryMappingErrorMessage = ref('');
const fixedCategoryColumns = ['MJ', 'WJ', 'XJ', 'MO', 'WO', 'XO', 'MV', 'WV', 'XV', 'MSV', 'WSV', 'XSV', 'MUV', 'WUV', 'XUV'];
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

const newUser = reactive({
  name: '',
  email: ''
});

const editingUserKey = ref(null);
const editUserForm = reactive({
  name: '',
  email: ''
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

const filteredEventSeries = computed(() => {
  const targetYear = String(selectedEventYear.value || '').trim();
  if (!targetYear) {
    return [];
  }

  return [...new Set(
    eventsIndex.value
      .filter((item) => String(item?.eventYear ?? '').trim() === targetYear)
      .map((item) => String(item?.eventSeries || '').trim())
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right));
});

const filteredEvents = computed(() => {
  const targetYear = String(selectedEventYear.value || '').trim();
  const targetSeries = String(selectedEventSeries.value || '').trim();

  if (!targetYear || !targetSeries) {
    return [];
  }

  const matchingSeries = eventsIndex.value.filter(
    (item) =>
      String(item?.eventYear ?? '').trim() === targetYear
      && String(item?.eventSeries || '').trim() === targetSeries
  );

  return matchingSeries
    .flatMap((item, seriesIndex) =>
      (Array.isArray(item?.events) ? item.events : []).map((eventItem, eventIndex) => ({
        key: `${seriesIndex}-${eventIndex}-${String(eventItem?.eventTitle || eventItem?.eventName || '').trim()}`,
        title: String(eventItem?.eventTitle || eventItem?.eventName || '').trim(),
        eventName: String(eventItem?.eventName || '').trim(),
        eventCourse: String(eventItem?.eventCourse || '').trim(),
        path: String(eventItem?.path || '').trim()
      }))
    )
    .filter((eventItem) => Boolean(eventItem.title));
});

const selectedEventDetails = computed(() =>
  filteredEvents.value.find((eventItem) => eventItem.key === selectedEventTitle.value) || null
);

const selectedEventResultsUrl = computed(() => {
  const year = String(selectedEventYear.value || '').trim();
  const details = selectedEventDetails.value;

  if (!year || !details) {
    return '';
  }

  const toSlug = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  const hasEventCourse = Boolean(String(details.eventCourse || '').trim());

  const eventNameSource = hasEventCourse
      ? `${selectedEventSeries.value}/${details.eventName}`
      : selectedEventSeries.value;

  const eventCourseSource = hasEventCourse
    ? details.eventCourse
    : details.eventName;

  const eventNameSlug = toSlug(eventNameSource);
  const eventCourseSlug = toSlug(eventCourseSource);

  if (!eventNameSlug || !eventCourseSlug) {
    return '';
  }

  return `https://rogaine-results.com/${year}/${eventNameSlug}/${eventCourseSlug}/results.json`;
});

const scaledColumns = computed(() =>
  transformedColumns.value.filter((column) => column !== 'team_name' && column !== 'team_member')
);

const scaledColumnMax = computed(() => {
  const maxByColumn = {};

  for (const column of scaledColumns.value) {
    let maxValue = 0;

    for (const row of transformedRows.value) {
      const numericValue = Number(row[column]);
      if (Number.isFinite(numericValue) && numericValue > maxValue) {
        maxValue = numericValue;
      }
    }

    maxByColumn[column] = maxValue;
  }

  return maxByColumn;
});

const scaledRows = computed(() =>
  transformedRows.value.map((row) => {
    const scaledRow = { ...row };

    for (const column of scaledColumns.value) {
      const maxValue = scaledColumnMax.value[column];
      const numericValue = Number(row[column]);

      if (!Number.isFinite(numericValue)) {
        scaledRow[column] = row[column];
      } else if (numericValue === 0) {
        scaledRow[column] = '';
      } else if (maxValue > 0) {
        const percentage = (numericValue / maxValue) * 100;
        const weightedPercentage = percentage * selectedDurationWeighting.value;
        scaledRow[column] = Math.ceil(weightedPercentage);
      } else {
        scaledRow[column] = '';
      }
    }

    return scaledRow;
  })
);

const displayedTransformedRows = computed(() =>
  transformedDisplayMode.value === 'scaled' ? scaledRows.value : transformedRows.value
);

const selectedEventDuration = computed(() => {
  const duration = Number(jsonLoadData.value?.event_duration);
  return Number.isFinite(duration) ? duration : null;
});

const selectedDurationWeighting = computed(() => {
  const duration = selectedEventDuration.value;
  if (duration === null) {
    return 1;
  }

  for (const item of weightingTable) {
    if (duration >= item.duration) {
      return item.weighting;
    }
  }

  return weightingTable.at(-1)?.weighting ?? 1;
});

watch(filteredEventSeries, (options) => {
  if (!options.includes(selectedEventSeries.value)) {
    selectedEventSeries.value = '';
  }
});

watch(filteredEvents, (options) => {
  if (!options.some((eventItem) => eventItem.key === selectedEventTitle.value)) {
    selectedEventTitle.value = '';
  }
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

function transformedColumnLabel(column) {
  if (column === 'team_name') {
    return 'Team';
  }

  if (column === 'team_member') {
    return 'Member';
  }

  if (column === 'final_score') {
    return 'Score';
  }

  return column;
}

function selectedEventCategories() {
  return normalizeList(selectedTeamsEvent.value?.categories || []);
}

function userKey(user) {
  return `${user.name}::${user.email}`;
}

function switchView(view) {
  currentView.value = view;

  if (view === 'json-loader') {
    closeTeamsView();
    fetchEventsIndex();
  } else {
    closeTeamsView();
  }
}

async function fetchEventsIndex() {
  if (eventsIndexLoading.value) {
    return;
  }

  eventsIndexLoading.value = true;
  eventsIndexErrorMessage.value = '';

  try {
    const query = new URLSearchParams({
      url: 'https://rogaine-results.com/events.json'
    });

    const response = await fetch(`${apiBaseUrl}/api/json-loader?${query.toString()}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load events index');
    }

    const data = await response.json();
    eventsIndex.value = Array.isArray(data) ? data : [];
  } catch (error) {
    eventsIndexErrorMessage.value = error.message || 'Failed to load events index';
  } finally {
    eventsIndexLoading.value = false;
  }
}

function normalizeNameValue(value) {
  const collapsed = String(value || '').trim().replace(/\s+/g, ' ');
  if (!collapsed) {
    return '';
  }

  const lettersOnly = collapsed.replace(/[^a-zA-Z]/g, '');
  if (!lettersOnly) {
    return collapsed;
  }

  const isAllUpper = lettersOnly === lettersOnly.toUpperCase();
  const isAllLower = lettersOnly === lettersOnly.toLowerCase();

  if (!(isAllUpper || isAllLower)) {
    return collapsed;
  }

  return collapsed
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function parseTeamNameAndMembers(rawName) {
  const fullName = String(rawName || '');
  const separatorIndex = fullName.indexOf(';');

  if (separatorIndex >= 0) {
    const teamName = normalizeNameValue(fullName.slice(0, separatorIndex));
    const membersText = fullName.slice(separatorIndex + 1);
    const members = membersText
      .split(',')
      .map((member) => normalizeNameValue(member))
      .filter(Boolean);

    return {
      teamName,
      members
    };
  }

  const colonIndex = fullName.indexOf(':');
  if (colonIndex >= 0) {
    const teamName = normalizeNameValue(fullName.slice(0, colonIndex));
    const membersText = fullName.slice(colonIndex + 1);
    const members = membersText
      .split(',')
      .map((member) => normalizeNameValue(member.replace(/[.)]+$/g, '')))
      .filter(Boolean);

    return {
      teamName,
      members
    };
  }

  const openParenIndex = fullName.indexOf('(');
  if (openParenIndex >= 0) {
    const teamName = normalizeNameValue(fullName.slice(0, openParenIndex));
    const membersText = fullName.slice(openParenIndex + 1);
    const members = membersText
      .split(',')
      .map((member) => normalizeNameValue(member.replace(/[.)]+$/g, '')))
      .filter(Boolean);

    return {
      teamName,
      members
    };
  }

  const teamName = normalizeNameValue(fullName);
  const members = [teamName].filter(Boolean);

  return {
    teamName,
    members
  };
}

function normalizeRawTeamCategory(value) {
  let normalized = String(value || '').trim().toUpperCase();
  normalized = normalized.replace(/[\s:;]*\d+$/g, '').trim();
  normalized = normalized.replace(/[:;]+$/g, '').trim();
  return normalized;
}

function extractNormalizedTeamCategories(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return [];
  }

  const groupedPattern = /[^,;]+?\d+(?=\s+[^,;]+?\d+|$|[,;])/g;
  const groupedMatches = rawValue.match(groupedPattern);

  const rawCategories = groupedMatches && groupedMatches.length > 0
    ? groupedMatches
    : rawValue.split(/[;,]+/).map((token) => token.trim()).filter(Boolean);

  return [...new Set(
    rawCategories
      .map((token) => normalizeRawTeamCategory(token))
      .filter(Boolean)
  )];
}

function transformLoadedJson() {
  transformErrorMessage.value = '';
  transformedRows.value = [];
  transformedDisplayMode.value = 'raw';

  if (!jsonLoadData.value || typeof jsonLoadData.value !== 'object') {
    transformErrorMessage.value = 'Load results data first.';
    return;
  }

  const categories = fixedCategoryColumns;

  const teamsData = Array.isArray(jsonLoadData.value.teams) ? jsonLoadData.value.teams : [];

  if (teamsData.length === 0) {
    transformErrorMessage.value = 'No teams found in loaded results.';
    return;
  }

  const rows = [];

  const categoryMapping = new Map(
    fixedCategoryColumns.map((category) => [normalizeRawTeamCategory(category), category])
  );

  for (const row of categoryMappingRows.value) {
    const rawCategory = normalizeRawTeamCategory(row?.rawCategory);
    const mappedCategory = normalizeRawTeamCategory(row?.mappedCategory);

    if (rawCategory && mappedCategory) {
      categoryMapping.set(rawCategory, mappedCategory);
    }
  }

  for (const team of teamsData) {
    const { teamName, members } = parseTeamNameAndMembers(team?.name);
    const finalScore = team?.final_score ?? null;
    const rawTeamCategories = extractNormalizedTeamCategories(team?.category);
    const mappedTeamCategories = new Set(
      rawTeamCategories
        .map((rawCategory) => categoryMapping.get(rawCategory) || '')
        .filter(Boolean)
    );

    for (const member of members) {
      const row = {
        team_name: teamName,
        team_member: member,
        final_score: finalScore
      };

      for (const category of categories) {
        row[category] = mappedTeamCategories.has(category) ? finalScore : '';
      }

      rows.push(row);
    }
  }

  transformedColumns.value = ['team_name', 'team_member', 'final_score', ...fixedCategoryColumns];
  transformedRows.value = rows;
}

function openCategoryMappingDialog() {
  transformErrorMessage.value = '';
  categoryMappingErrorMessage.value = '';

  if (!jsonLoadData.value || typeof jsonLoadData.value !== 'object') {
    transformErrorMessage.value = 'Load results data first.';
    return;
  }

  const rawGrades = Array.isArray(jsonLoadData.value.event_grades)
    ? jsonLoadData.value.event_grades.map((grade) => String(grade).trim()).filter(Boolean)
    : [];

  if (rawGrades.length === 0) {
    transformErrorMessage.value = 'No event_grades found in loaded results.';
    return;
  }

  categoryMappingRows.value = rawGrades.map((grade) => ({
    rawCategory: grade,
    mappedCategory: fixedCategoryColumns.includes(normalizeRawTeamCategory(grade))
      ? normalizeRawTeamCategory(grade)
      : ''
  }));

  showCategoryMappingDialog.value = true;
}

function closeCategoryMappingDialog() {
  categoryMappingErrorMessage.value = '';
  showCategoryMappingDialog.value = false;
}

function applyCategoryMappingAndTransform() {
  const selectedMappings = categoryMappingRows.value
    .map((row) => normalizeRawTeamCategory(row?.mappedCategory))
    .filter(Boolean);

  const uniqueMappings = new Set(selectedMappings);
  if (uniqueMappings.size !== selectedMappings.length) {
    categoryMappingErrorMessage.value = 'Duplicate mapped categories are not allowed (except Unmapped).';
    return;
  }

  categoryMappingErrorMessage.value = '';
  showCategoryMappingDialog.value = false;
  transformLoadedJson();
}

async function saveSelectedEvent(overwrite = false) {
  saveEventErrorMessage.value = '';
  saveEventSuccessMessage.value = '';

  if (!jsonLoadData.value || !selectedEventDetails.value) {
    saveEventErrorMessage.value = 'Load results and select an event before saving.';
    return;
  }

  const payload = {
    year: Number(selectedEventYear.value),
    series: String(selectedEventSeries.value || '').trim(),
    name: String(selectedEventDetails.value.title || '').trim(),
    date: String(jsonLoadData.value.start_date || '').trim(),
    organiser: String(jsonLoadData.value.organiser || '').trim(),
    duration: Number(jsonLoadData.value.event_duration),
    overwrite
  };

  if (!payload.year || !payload.series || !payload.name || !payload.date || !payload.organiser || Number.isNaN(payload.duration)) {
    saveEventErrorMessage.value = 'Missing required event details to save.';
    return;
  }

  saveEventLoading.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/save-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 409 && !overwrite) {
      const shouldOverwrite = window.confirm('Event already exists. Overwrite existing event details?');
      if (shouldOverwrite) {
        saveEventLoading.value = false;
        await saveSelectedEvent(true);
      }
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to save event details');
    }

    const data = await response.json();
    saveEventSuccessMessage.value = data.message || 'Event saved successfully.';
  } catch (error) {
    saveEventErrorMessage.value = error.message || 'Failed to save event details';
  } finally {
    saveEventLoading.value = false;
  }
}

async function loadSelectedEventJson() {
  const url = selectedEventResultsUrl.value;
  if (!url) {
    jsonLoadErrorMessage.value = 'Select year and event before loading.';
    return;
  }

  jsonLoadLoading.value = true;
  jsonLoadErrorMessage.value = '';

  try {
    const query = new URLSearchParams({ url });
    const response = await fetch(`${apiBaseUrl}/api/json-loader?${query.toString()}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load results from URL');
    }

    const data = await response.json();
    jsonLoadData.value = data;
    transformErrorMessage.value = '';
    transformedRows.value = [];
    transformedColumns.value = [];
    saveEventErrorMessage.value = '';
    saveEventSuccessMessage.value = '';
  } catch (error) {
    jsonLoadErrorMessage.value = error.message || 'Failed to load results';
    jsonLoadData.value = null;
    transformErrorMessage.value = '';
    transformedRows.value = [];
    transformedColumns.value = [];
    saveEventErrorMessage.value = '';
    saveEventSuccessMessage.value = '';
  } finally {
    jsonLoadLoading.value = false;
  }
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

async function fetchUsers() {
  usersLoading.value = true;
  usersErrorMessage.value = '';

  try {
    const response = await fetch(`${apiBaseUrl}/api/users`);
    if (!response.ok) {
      throw new Error('Failed to load users');
    }
    users.value = await response.json();
  } catch (error) {
    usersErrorMessage.value = error.message;
  } finally {
    usersLoading.value = false;
  }
}

function resetNewUserForm() {
  newUser.name = '';
  newUser.email = '';
}

function cancelUserEdit() {
  editingUserKey.value = null;
  editUserForm.name = '';
  editUserForm.email = '';
}

async function addUser() {
  usersErrorMessage.value = '';

  const payload = {
    name: newUser.name.trim(),
    email: newUser.email.trim()
  };

  if (!payload.name || !payload.email) {
    usersErrorMessage.value = 'Name and Email are required.';
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to save user');
    }

    resetNewUserForm();
    await fetchUsers();
  } catch (error) {
    usersErrorMessage.value = error.message;
  }
}

function startUserEdit(user) {
  editingUserKey.value = userKey(user);
  editUserForm.name = user.name;
  editUserForm.email = user.email;
}

async function saveUserEdit(originalUser) {
  usersErrorMessage.value = '';

  const payload = {
    name: editUserForm.name.trim(),
    email: editUserForm.email.trim()
  };

  if (!payload.name || !payload.email) {
    usersErrorMessage.value = 'Name and Email are required.';
    return;
  }

  try {
    const query = new URLSearchParams({
      name: originalUser.name,
      email: originalUser.email
    });

    const response = await fetch(`${apiBaseUrl}/api/users?${query.toString()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to update user');
    }

    cancelUserEdit();
    await fetchUsers();
  } catch (error) {
    usersErrorMessage.value = error.message;
  }
}

async function deleteUser(user) {
  usersErrorMessage.value = '';

  try {
    const query = new URLSearchParams({
      name: user.name,
      email: user.email
    });

    const response = await fetch(`${apiBaseUrl}/api/users?${query.toString()}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to delete user');
    }

    if (editingUserKey.value === userKey(user)) {
      cancelUserEdit();
    }

    await fetchUsers();
  } catch (error) {
    usersErrorMessage.value = error.message;
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
  fetchEventsIndex();
});
</script>

<template>
  <main>
    <h1>Rogainizer</h1>

    <div class="view-switcher">
      <button type="button" :class="{ active: currentView === 'json-loader' }" @click="switchView('json-loader')">Results Loader</button>
    </div>

    <template v-if="currentView === 'users'">
      <p v-if="usersErrorMessage" class="error">{{ usersErrorMessage }}</p>
      <p v-if="usersLoading">Loading users...</p>

      <table v-if="!usersLoading" class="events-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input v-model="newUser.name" type="text" placeholder="User name" />
            </td>
            <td>
              <input v-model="newUser.email" type="email" placeholder="name@example.com" />
            </td>
            <td class="actions-cell">
              <button type="button" @click="addUser">Add</button>
            </td>
          </tr>

          <tr v-for="user in users" :key="userKey(user)">
            <td v-if="editingUserKey === userKey(user)">
              <input v-model="editUserForm.name" type="text" />
            </td>
            <td v-else>{{ user.name }}</td>

            <td v-if="editingUserKey === userKey(user)">
              <input v-model="editUserForm.email" type="email" />
            </td>
            <td v-else>{{ user.email }}</td>

            <td class="actions-cell">
              <template v-if="editingUserKey === userKey(user)">
                <button type="button" @click="saveUserEdit(user)">Save</button>
                <button type="button" @click="cancelUserEdit">Cancel</button>
              </template>
              <template v-else>
                <button type="button" @click="startUserEdit(user)">Edit</button>
                <button type="button" @click="deleteUser(user)">Delete</button>
              </template>
            </td>
          </tr>

          <tr v-if="users.length === 0">
            <td colspan="3" class="empty-state">No users yet.</td>
          </tr>
        </tbody>
      </table>
    </template>

    <template v-else>
      <section class="json-loader-section">
        <h2>Load Results</h2>
        <p class="json-loader-subtitle">Select year, event series, and event, then click Load to retrieve results.</p>
        <div class="json-loader-controls">
          <label>
            Year
            <input v-model="selectedEventYear" type="text" inputmode="numeric" placeholder="2026" />
          </label>
          <label>
            Event Series
            <select v-model="selectedEventSeries" :disabled="filteredEventSeries.length === 0">
              <option value="" disabled>Select event series</option>
              <option v-for="series in filteredEventSeries" :key="`series-${series}`" :value="series">
                {{ series }}
              </option>
            </select>
          </label>
          <label>
            Event
            <select v-model="selectedEventTitle" :disabled="filteredEvents.length === 0">
              <option value="" disabled>Select event</option>
              <option v-for="eventItem in filteredEvents" :key="`event-${eventItem.key}`" :value="eventItem.key">
                {{ eventItem.title }}
              </option>
            </select>
          </label>
        </div>
        <p v-if="eventsIndexLoading">Loading events index...</p>
        <p v-if="eventsIndexErrorMessage" class="error">{{ eventsIndexErrorMessage }}</p>
        <button type="button" @click="loadSelectedEventJson" :disabled="jsonLoadLoading || !selectedEventResultsUrl">
          {{ jsonLoadLoading ? 'Loading...' : 'Load' }}
        </button>
        <button type="button" @click="saveSelectedEvent()" :disabled="saveEventLoading || jsonLoadData === null">
          {{ saveEventLoading ? 'Saving...' : 'Save Event' }}
        </button>
        <p v-if="selectedEventResultsUrl" class="json-loader-url">{{ selectedEventResultsUrl }}</p>
        <button type="button" @click="openCategoryMappingDialog" :disabled="jsonLoadLoading || jsonLoadData === null">
          Transform
        </button>
        <p v-if="jsonLoadErrorMessage" class="error">{{ jsonLoadErrorMessage }}</p>
        <p v-if="saveEventErrorMessage" class="error">{{ saveEventErrorMessage }}</p>
        <p v-if="saveEventSuccessMessage" class="success">{{ saveEventSuccessMessage }}</p>
        <p v-if="transformErrorMessage" class="error">{{ transformErrorMessage }}</p>

        <div v-if="jsonLoadData !== null" class="json-panels">
          <div class="json-output-panel">
            <h3>Raw Results</h3>
            <JsonTreeNode :value="jsonLoadData" label="root" />
          </div>

          <div class="json-output-panel transformed-output-panel">
            <h3>Transformed Data</h3>
            <div v-if="transformedRows.length > 0" class="transformed-mode-switch">
              <label>
                <input v-model="transformedDisplayMode" type="radio" value="raw" />
                Raw
              </label>
              <label>
                <input v-model="transformedDisplayMode" type="radio" value="scaled" />
                Scaled
              </label>
            </div>
            <table v-if="transformedRows.length > 0" class="events-table transformed-table">
              <thead>
                <tr>
                  <th v-for="column in transformedColumns" :key="`transform-header-${column}`">{{ transformedColumnLabel(column) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIndex) in displayedTransformedRows" :key="`transform-row-${rowIndex}`">
                  <td
                    v-for="column in transformedColumns"
                    :key="`transform-cell-${rowIndex}-${column}`"
                    :class="{
                      'scaled-score-cell': transformedDisplayMode === 'scaled' && column !== 'team_name' && column !== 'team_member'
                    }"
                  >
                    {{ row[column] }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="empty-state">Run Transform to view transformed rows.</p>
          </div>
        </div>
      </section>

      <div v-if="showCategoryMappingDialog" class="dialog-backdrop">
        <div class="mapping-dialog" role="dialog" aria-modal="true" aria-label="Category mapping">
          <h3>Category Mapping</h3>
          <p>Map raw categories to transformed categories before running transform.</p>

          <table class="events-table mapping-table">
            <thead>
              <tr>
                <th>Raw Category</th>
                <th>Mapped Category</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in categoryMappingRows" :key="`mapping-row-${rowIndex}`">
                <td>{{ row.rawCategory }}</td>
                <td>
                  <select v-model="row.mappedCategory">
                    <option value="">Unmapped</option>
                    <option v-for="category in fixedCategoryColumns" :key="`map-option-${rowIndex}-${category}`" :value="category">
                      {{ category }}
                    </option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="mapping-dialog-actions">
            <p v-if="categoryMappingErrorMessage" class="error mapping-dialog-error">{{ categoryMappingErrorMessage }}</p>
            <button type="button" @click="closeCategoryMappingDialog">Cancel</button>
            <button type="button" @click="applyCategoryMappingAndTransform">Apply</button>
          </div>
        </div>
      </div>
    </template>
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

.view-switcher {
  display: flex;
  gap: 0.5rem;
  margin: 0.75rem 0 1.25rem;
}

.view-switcher .active {
  font-weight: 700;
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

.success {
  color: #0b6e2e;
}

.empty-state {
  text-align: center;
}

.json-loader-section {
  margin-top: 1rem;
  text-align: left;
}

.json-loader-subtitle {
  margin-top: 0;
}

.json-loader-controls {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 280px));
  margin: 0.5rem 0 1rem;
}

.json-loader-controls label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.json-loader-url {
  margin: 0.5rem 0;
  word-break: break-all;
}

.transformed-mode-switch {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.transformed-mode-switch label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.events-table td.scaled-score-cell {
  text-align: right;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.mapping-dialog {
  background: #fff;
  color: #111;
  border-radius: 8px;
  border: 1px solid #ddd;
  padding: 1rem;
  width: min(760px, 100%);
  max-height: 90vh;
  overflow: auto;
}

.mapping-table {
  margin: 0.75rem 0;
}

.mapping-dialog-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
}

.mapping-dialog-error {
  margin-right: auto;
}

.json-output-panel {
  margin-top: 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 0.75rem;
  min-width: 0;
}

.json-output-panel h3 {
  margin-top: 0;
}

.json-panels {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  align-items: start;
  width: 100%;
}

.transformed-table {
  margin-top: 0;
  width: max-content;
}

.transformed-output-panel {
  width: 100%;
  min-width: 0;
  overflow-x: auto;
}

@media (min-width: 1024px) {
  .json-loader-section {
    width: 100vw;
    margin-left: calc(50% - 50vw);
    padding: 0 1rem;
    box-sizing: border-box;
  }

  .json-panels {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  }
}
</style>
