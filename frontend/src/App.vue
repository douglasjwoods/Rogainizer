<script setup>
import { computed, onMounted, ref, watch } from 'vue';
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
const currentView = ref('leader-boards');
const jsonLoadErrorMessage = ref('');
const jsonLoadData = ref(null);
const jsonLoadLoading = ref(false);
const saveEventLoading = ref(false);
const saveEventErrorMessage = ref('');
const saveEventSuccessMessage = ref('');
const savedEventId = ref(null);
const saveTransformedLoading = ref(false);
const saveTransformedErrorMessage = ref('');
const saveTransformedSuccessMessage = ref('');
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
const leaderBoards = ref([]);
const leaderBoardsLoading = ref(false);
const leaderBoardsErrorMessage = ref('');
const activeLeaderBoard = ref(null);
const leaderBoardScoresRows = ref([]);
const leaderBoardScoresLoading = ref(false);
const leaderBoardScoresErrorMessage = ref('');
const leaderBoardScoresDisplayMode = ref('scaled');
const leaderBoardScoreSortColumn = ref('final_score');
const leaderBoardScoreSortDirection = ref('desc');
const showLeaderBoardMemberDialog = ref(false);
const selectedLeaderBoardMember = ref('');
const leaderBoardMemberEventRows = ref([]);
const leaderBoardMemberEventsLoading = ref(false);
const leaderBoardMemberEventsErrorMessage = ref('');
const showCreateLeaderBoardDialog = ref(false);
const createLeaderBoardLoading = ref(false);
const createLeaderBoardErrorMessage = ref('');
const createLeaderBoardSuccessMessage = ref('');
const newLeaderBoardName = ref('');
const newLeaderBoardYear = ref('');
const leaderBoardYearResults = ref([]);
const leaderBoardYearResultsLoading = ref(false);
const leaderBoardYearResultsErrorMessage = ref('');
const selectedLeaderBoardResultIds = ref([]);
const resultsEvents = ref([]);
const resultsEventsLoading = ref(false);
const resultsEventsErrorMessage = ref('');
const selectedResultsEventId = ref('');
const selectedResultsEvent = ref(null);
const eventResultsRows = ref([]);
const eventResultsLoading = ref(false);
const eventResultsErrorMessage = ref('');
const eventResultsDisplayMode = ref('scaled');
const showOnlyFlaggedResultMembers = ref(false);
const showEditResultDialog = ref(false);
const editResultId = ref(null);
const editResultTeamName = ref('');
const editResultTeamMember = ref('');
const editResultLoading = ref(false);
const editResultErrorMessage = ref('');
const showEditLeaderBoardDialog = ref(false);
const editLeaderBoardId = ref(null);
const editLeaderBoardLoading = ref(false);
const editLeaderBoardLoadingDetails = ref(false);
const editLeaderBoardErrorMessage = ref('');
const editLeaderBoardName = ref('');
const editLeaderBoardYear = ref('');
const editLeaderBoardYearResults = ref([]);
const editLeaderBoardYearResultsLoading = ref(false);
const editLeaderBoardYearResultsErrorMessage = ref('');
const selectedEditLeaderBoardResultIds = ref([]);

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

const leaderBoardScoreColumns = computed(() => ['team_member', 'event_count', 'final_score', ...fixedCategoryColumns]);
const eventResultsColumns = computed(() => ['team_name', 'team_member', 'final_score', ...fixedCategoryColumns]);

const displayedLeaderBoardScoreRows = computed(() =>
  leaderBoardScoresRows.value.map((row) => {
    const modeValues = row[leaderBoardScoresDisplayMode.value] || {};
    return {
      team_name: row.team_name,
      team_member: row.team_member,
      ...modeValues
    };
  })
);

const sortedLeaderBoardScoreRows = computed(() => {
  const items = [...displayedLeaderBoardScoreRows.value];
  const sortColumn = leaderBoardScoreSortColumn.value;
  const direction = leaderBoardScoreSortDirection.value === 'asc' ? 1 : -1;

  items.sort((left, right) => {
    if (sortColumn === 'team_name' || sortColumn === 'team_member') {
      const leftValue = String(left[sortColumn] || '').toLowerCase();
      const rightValue = String(right[sortColumn] || '').toLowerCase();
      return leftValue.localeCompare(rightValue) * direction;
    }

    const leftValue = Number(left[sortColumn] ?? 0);
    const rightValue = Number(right[sortColumn] ?? 0);
    return (leftValue - rightValue) * direction;
  });

  return items;
});

const displayedEventResultsRows = computed(() =>
  eventResultsRows.value.map((row) => {
    const modeValues = row[eventResultsDisplayMode.value] || {};
    return {
      id: row.id,
      team_name: row.team_name,
      team_member: row.team_member,
      ...modeValues
    };
  })
);

const filteredEventResultsRows = computed(() => {
  if (!showOnlyFlaggedResultMembers.value) {
    return displayedEventResultsRows.value;
  }

  return displayedEventResultsRows.value.filter((row) => shouldHighlightMemberName(row.team_member));
});

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

watch(newLeaderBoardYear, () => {
  if (showCreateLeaderBoardDialog.value) {
    fetchLeaderBoardYearResults();
  }
});

watch(editLeaderBoardYear, () => {
  if (showEditLeaderBoardDialog.value && !editLeaderBoardLoadingDetails.value) {
    fetchEditLeaderBoardYearResults();
  }
});

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

  if (column === 'event_count') {
    return 'Events';
  }

  return column;
}

function isLeaderBoardScoreColumn(column) {
  return column !== 'team_name' && column !== 'team_member';
}

function sortLeaderBoardScoresBy(column) {
  if (!isLeaderBoardScoreColumn(column)) {
    return;
  }

  if (leaderBoardScoreSortColumn.value === column) {
    leaderBoardScoreSortDirection.value = leaderBoardScoreSortDirection.value === 'asc' ? 'desc' : 'asc';
    return;
  }

  leaderBoardScoreSortColumn.value = column;
  leaderBoardScoreSortDirection.value = 'desc';
}

function leaderBoardSortIndicator(column) {
  if (leaderBoardScoreSortColumn.value !== column) {
    return '';
  }

  return leaderBoardScoreSortDirection.value === 'asc' ? ' ▲' : ' ▼';
}

function leaderBoardColumnLabel(column) {
  if (column === 'team_member') {
    return ' ';
  }

  return transformedColumnLabel(column);
}

function formatLeaderBoardScoreCell(row, column) {
  if (column === 'team_member') {
    return row[column];
  }

  if (column === 'event_count') {
    const numericValue = Number(row[column] ?? 0);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  if (isLeaderBoardScoreColumn(column)) {
    const numericValue = Number(row[column]);
    if (!Number.isFinite(numericValue) || numericValue === 0) {
      return ' ';
    }
  }

  return row[column];
}

function closeLeaderBoardMemberDialog() {
  showLeaderBoardMemberDialog.value = false;
  selectedLeaderBoardMember.value = '';
  leaderBoardMemberEventRows.value = [];
  leaderBoardMemberEventsErrorMessage.value = '';
}

function eventRowCategoriesText(eventRow) {
  const mode = leaderBoardScoresDisplayMode.value;
  const modeSuffix = mode === 'scaled' ? 'Scaled' : 'Raw';

  return fixedCategoryColumns
    .map((category) => {
      const fieldName = `${category.toLowerCase()}${modeSuffix}`;
      const numericValue = Number(eventRow?.[fieldName] ?? 0);
      if (!Number.isFinite(numericValue) || numericValue === 0) {
        return '';
      }
      return `${category}: ${numericValue}`;
    })
    .filter(Boolean)
    .join(', ');
}

function eventRowScoreValue(eventRow) {
  const fieldName = leaderBoardScoresDisplayMode.value === 'scaled' ? 'finalScoreScaled' : 'finalScoreRaw';
  const numericValue = Number(eventRow?.[fieldName] ?? 0);

  if (!Number.isFinite(numericValue) || numericValue === 0) {
    return ' ';
  }

  return numericValue;
}

async function openLeaderBoardMemberDialog(row) {
  if (!activeLeaderBoard.value?.id) {
    return;
  }

  const memberName = String(row?.team_member || '').trim();
  if (!memberName) {
    return;
  }

  selectedLeaderBoardMember.value = memberName;
  leaderBoardMemberEventRows.value = [];
  leaderBoardMemberEventsErrorMessage.value = '';
  leaderBoardMemberEventsLoading.value = true;
  showLeaderBoardMemberDialog.value = true;

  try {
    const query = new URLSearchParams({ member: memberName });
    const response = await fetch(`${apiBaseUrl}/api/leader-boards/${activeLeaderBoard.value.id}/member-events?${query.toString()}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load member event scores');
    }

    const data = await response.json();
    leaderBoardMemberEventRows.value = Array.isArray(data) ? data : [];
  } catch (error) {
    leaderBoardMemberEventsErrorMessage.value = error.message || 'Failed to load member event scores';
  } finally {
    leaderBoardMemberEventsLoading.value = false;
  }
}

function switchView(view) {
  currentView.value = view;

  if (view === 'leader-boards') {
    fetchLeaderBoards();
  }

  if (view === 'results') {
    fetchResultsEvents();
  }
}

function formatResultCell(row, column) {
  if (column === 'team_name' || column === 'team_member') {
    return row[column] || ' ';
  }

  const numericValue = Number(row[column] ?? 0);
  if (!Number.isFinite(numericValue) || numericValue === 0) {
    return ' ';
  }

  return numericValue;
}

function shouldHighlightMemberName(memberName) {
  const words = String(memberName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return false;
  }

  if (words.length === 1 || words.length > 2) {
    return true;
  }

  const startsWithCapital = (value) => /^[A-Z]/.test(String(value || '').trim());
  const firstName = words[0];
  const lastName = words[words.length - 1];

  return !startsWithCapital(firstName) || !startsWithCapital(lastName);
}

async function fetchResultsEvents() {
  if (resultsEventsLoading.value) {
    return;
  }

  resultsEventsLoading.value = true;
  resultsEventsErrorMessage.value = '';

  try {
    const response = await fetch(`${apiBaseUrl}/api/events`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load events');
    }

    const data = await response.json();
    resultsEvents.value = Array.isArray(data) ? data : [];
  } catch (error) {
    resultsEventsErrorMessage.value = error.message || 'Failed to load events';
  } finally {
    resultsEventsLoading.value = false;
  }
}

async function loadSelectedEventResults() {
  const eventId = Number(selectedResultsEventId.value);
  eventResultsErrorMessage.value = '';
  eventResultsRows.value = [];
  selectedResultsEvent.value = null;

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return;
  }

  eventResultsLoading.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${eventId}/results`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load event results');
    }

    const data = await response.json();
    selectedResultsEvent.value = data?.event || null;
    const rows = Array.isArray(data?.rows) ? data.rows : [];

    eventResultsRows.value = rows.map((item) => ({
      id: Number(item?.id ?? 0),
      team_name: String(item?.team_name || ''),
      team_member: String(item?.team_member || ''),
      raw: {
        final_score: Number(item?.final_score_raw ?? 0),
        MJ: Number(item?.mj_raw ?? 0),
        WJ: Number(item?.wj_raw ?? 0),
        XJ: Number(item?.xj_raw ?? 0),
        MO: Number(item?.mo_raw ?? 0),
        WO: Number(item?.wo_raw ?? 0),
        XO: Number(item?.xo_raw ?? 0),
        MV: Number(item?.mv_raw ?? 0),
        WV: Number(item?.wv_raw ?? 0),
        XV: Number(item?.xv_raw ?? 0),
        MSV: Number(item?.msv_raw ?? 0),
        WSV: Number(item?.wsv_raw ?? 0),
        XSV: Number(item?.xsv_raw ?? 0),
        MUV: Number(item?.muv_raw ?? 0),
        WUV: Number(item?.wuv_raw ?? 0),
        XUV: Number(item?.xuv_raw ?? 0)
      },
      scaled: {
        final_score: Number(item?.final_score_scaled ?? 0),
        MJ: Number(item?.mj_scaled ?? 0),
        WJ: Number(item?.wj_scaled ?? 0),
        XJ: Number(item?.xj_scaled ?? 0),
        MO: Number(item?.mo_scaled ?? 0),
        WO: Number(item?.wo_scaled ?? 0),
        XO: Number(item?.xo_scaled ?? 0),
        MV: Number(item?.mv_scaled ?? 0),
        WV: Number(item?.wv_scaled ?? 0),
        XV: Number(item?.xv_scaled ?? 0),
        MSV: Number(item?.msv_scaled ?? 0),
        WSV: Number(item?.wsv_scaled ?? 0),
        XSV: Number(item?.xsv_scaled ?? 0),
        MUV: Number(item?.muv_scaled ?? 0),
        WUV: Number(item?.wuv_scaled ?? 0),
        XUV: Number(item?.xuv_scaled ?? 0)
      }
    }));
  } catch (error) {
    eventResultsErrorMessage.value = error.message || 'Failed to load event results';
  } finally {
    eventResultsLoading.value = false;
  }
}

function openEditResultDialog(row) {
  const resultId = Number(row?.id);
  if (!Number.isInteger(resultId) || resultId <= 0) {
    return;
  }

  editResultId.value = resultId;
  editResultTeamName.value = String(row?.team_name || '');
  editResultTeamMember.value = String(row?.team_member || '');
  editResultErrorMessage.value = '';
  showEditResultDialog.value = true;
}

function closeEditResultDialog() {
  showEditResultDialog.value = false;
  editResultId.value = null;
  editResultErrorMessage.value = '';
}

async function saveEditedResultRow() {
  editResultErrorMessage.value = '';

  const eventId = Number(selectedResultsEventId.value);
  const resultId = Number(editResultId.value);

  if (!Number.isInteger(eventId) || eventId <= 0) {
    editResultErrorMessage.value = 'Select an event first.';
    return;
  }

  if (!Number.isInteger(resultId) || resultId <= 0) {
    editResultErrorMessage.value = 'Invalid result row selected.';
    return;
  }

  const payload = {
    team_name: String(editResultTeamName.value || '').trim(),
    team_member: String(editResultTeamMember.value || '').trim()
  };

  if (!payload.team_member) {
    editResultErrorMessage.value = 'Member is required.';
    return;
  }

  editResultLoading.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${eventId}/results/${resultId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to update result row');
    }

    await loadSelectedEventResults();
    closeEditResultDialog();
  } catch (error) {
    editResultErrorMessage.value = error.message || 'Failed to update result row';
  } finally {
    editResultLoading.value = false;
  }
}

async function deleteResultRow(row) {
  const eventId = Number(selectedResultsEventId.value);
  const resultId = Number(row?.id);

  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(resultId) || resultId <= 0) {
    return;
  }

  const confirmed = window.confirm('Delete this result row?');
  if (!confirmed) {
    return;
  }

  eventResultsErrorMessage.value = '';

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${eventId}/results/${resultId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to delete result row');
    }

    await loadSelectedEventResults();
  } catch (error) {
    eventResultsErrorMessage.value = error.message || 'Failed to delete result row';
  }
}

watch(selectedResultsEventId, () => {
  if (currentView.value === 'results') {
    loadSelectedEventResults();
  }
});

async function fetchLeaderBoards() {
  leaderBoardsLoading.value = true;
  leaderBoardsErrorMessage.value = '';

  try {
    const response = await fetch(`${apiBaseUrl}/api/leader-boards`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load leader boards');
    }

    const data = await response.json();
    leaderBoards.value = Array.isArray(data) ? data : [];
  } catch (error) {
    leaderBoardsErrorMessage.value = error.message || 'Failed to load leader boards';
  } finally {
    leaderBoardsLoading.value = false;
  }
}

async function createLeaderBoardScoreView(leaderBoard) {
  if (!leaderBoard?.id) {
    return;
  }

  activeLeaderBoard.value = {
    id: leaderBoard.id,
    name: leaderBoard.name,
    year: leaderBoard.year,
    eventCount: leaderBoard.eventCount
  };
  leaderBoardScoresRows.value = [];
  leaderBoardScoresErrorMessage.value = '';
  leaderBoardScoresDisplayMode.value = 'scaled';
  leaderBoardScoreSortColumn.value = 'final_score';
  leaderBoardScoreSortDirection.value = 'desc';
  leaderBoardScoresLoading.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/leader-boards/${leaderBoard.id}/scoreboard`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to create leader board scores');
    }

    const data = await response.json();
    const rows = Array.isArray(data?.rows) ? data.rows : [];

    leaderBoardScoresRows.value = rows.map((item) => {
      const rawValues = {
        event_count: Number(item?.event_count ?? 0),
        final_score: Number(item?.final_score_raw ?? 0),
        MJ: Number(item?.mj_raw ?? 0),
        WJ: Number(item?.wj_raw ?? 0),
        XJ: Number(item?.xj_raw ?? 0),
        MO: Number(item?.mo_raw ?? 0),
        WO: Number(item?.wo_raw ?? 0),
        XO: Number(item?.xo_raw ?? 0),
        MV: Number(item?.mv_raw ?? 0),
        WV: Number(item?.wv_raw ?? 0),
        XV: Number(item?.xv_raw ?? 0),
        MSV: Number(item?.msv_raw ?? 0),
        WSV: Number(item?.wsv_raw ?? 0),
        XSV: Number(item?.xsv_raw ?? 0),
        MUV: Number(item?.muv_raw ?? 0),
        WUV: Number(item?.wuv_raw ?? 0),
        XUV: Number(item?.xuv_raw ?? 0)
      };

      const scaledValues = {
        event_count: Number(item?.event_count ?? 0),
        final_score: Number(item?.final_score_scaled ?? 0),
        MJ: Number(item?.mj_scaled ?? 0),
        WJ: Number(item?.wj_scaled ?? 0),
        XJ: Number(item?.xj_scaled ?? 0),
        MO: Number(item?.mo_scaled ?? 0),
        WO: Number(item?.wo_scaled ?? 0),
        XO: Number(item?.xo_scaled ?? 0),
        MV: Number(item?.mv_scaled ?? 0),
        WV: Number(item?.wv_scaled ?? 0),
        XV: Number(item?.xv_scaled ?? 0),
        MSV: Number(item?.msv_scaled ?? 0),
        WSV: Number(item?.wsv_scaled ?? 0),
        XSV: Number(item?.xsv_scaled ?? 0),
        MUV: Number(item?.muv_scaled ?? 0),
        WUV: Number(item?.wuv_scaled ?? 0),
        XUV: Number(item?.xuv_scaled ?? 0)
      };

      return {
        team_name: String(item?.team_name || ''),
        team_member: String(item?.team_member || ''),
        raw: rawValues,
        scaled: scaledValues
      };
    });
  } catch (error) {
    leaderBoardScoresErrorMessage.value = error.message || 'Failed to create leader board scores';
  } finally {
    leaderBoardScoresLoading.value = false;
  }
}

function openCreateLeaderBoardDialog() {
  createLeaderBoardErrorMessage.value = '';
  createLeaderBoardSuccessMessage.value = '';
  newLeaderBoardName.value = '';
  newLeaderBoardYear.value = '';
  leaderBoardYearResults.value = [];
  leaderBoardYearResultsErrorMessage.value = '';
  selectedLeaderBoardResultIds.value = [];
  showCreateLeaderBoardDialog.value = true;
}

function closeCreateLeaderBoardDialog() {
  showCreateLeaderBoardDialog.value = false;
  createLeaderBoardErrorMessage.value = '';
  leaderBoardYearResultsErrorMessage.value = '';
}

async function openEditLeaderBoardDialog(leaderBoard) {
  const leaderBoardId = Number(leaderBoard?.id);
  if (!Number.isInteger(leaderBoardId) || leaderBoardId <= 0) {
    return;
  }

  createLeaderBoardSuccessMessage.value = '';
  editLeaderBoardErrorMessage.value = '';
  editLeaderBoardYearResultsErrorMessage.value = '';
  editLeaderBoardId.value = leaderBoardId;
  editLeaderBoardName.value = String(leaderBoard?.name || '').trim();
  editLeaderBoardYear.value = String(leaderBoard?.year || '').trim();
  editLeaderBoardYearResults.value = [];
  selectedEditLeaderBoardResultIds.value = [];
  showEditLeaderBoardDialog.value = true;
  editLeaderBoardLoadingDetails.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/leader-boards/details/${leaderBoardId}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load leader board details');
    }

    const data = await response.json();
    const loadedLeaderBoard = data?.leaderBoard || {};
    editLeaderBoardName.value = String(loadedLeaderBoard?.name || '').trim();
    editLeaderBoardYear.value = String(loadedLeaderBoard?.year || '').trim();

    selectedEditLeaderBoardResultIds.value = Array.isArray(data?.eventIds)
      ? [...new Set(data.eventIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
      : [];

    await fetchEditLeaderBoardYearResults(true);
  } catch (error) {
    editLeaderBoardErrorMessage.value = error.message || 'Failed to load leader board details';
  } finally {
    editLeaderBoardLoadingDetails.value = false;
  }
}

function closeEditLeaderBoardDialog() {
  showEditLeaderBoardDialog.value = false;
  editLeaderBoardId.value = null;
  editLeaderBoardErrorMessage.value = '';
  editLeaderBoardYearResultsErrorMessage.value = '';
}

async function fetchEditLeaderBoardYearResults(preserveSelection = false) {
  const year = Number(editLeaderBoardYear.value);
  editLeaderBoardYearResultsErrorMessage.value = '';
  editLeaderBoardYearResults.value = [];

  if (!preserveSelection) {
    selectedEditLeaderBoardResultIds.value = [];
  }

  if (!Number.isInteger(year) || year <= 0) {
    return;
  }

  editLeaderBoardYearResultsLoading.value = true;

  try {
    const query = new URLSearchParams({ year: String(year) });
    const response = await fetch(`${apiBaseUrl}/api/leader-boards/year-results?${query.toString()}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load results for selected year');
    }

    const data = await response.json();
    editLeaderBoardYearResults.value = Array.isArray(data) ? data : [];

    const validIds = new Set(editLeaderBoardYearResults.value.map((result) => Number(result.id)).filter((value) => Number.isInteger(value) && value > 0));
    selectedEditLeaderBoardResultIds.value = selectedEditLeaderBoardResultIds.value.filter((id) => validIds.has(id));
  } catch (error) {
    editLeaderBoardYearResultsErrorMessage.value = error.message || 'Failed to load results for selected year';
  } finally {
    editLeaderBoardYearResultsLoading.value = false;
  }
}

function toggleEditLeaderBoardResultSelection(eventId) {
  const numericId = Number(eventId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return;
  }

  if (selectedEditLeaderBoardResultIds.value.includes(numericId)) {
    selectedEditLeaderBoardResultIds.value = selectedEditLeaderBoardResultIds.value.filter((id) => id !== numericId);
    return;
  }

  selectedEditLeaderBoardResultIds.value = [...selectedEditLeaderBoardResultIds.value, numericId];
}

async function updateLeaderBoard() {
  editLeaderBoardErrorMessage.value = '';
  createLeaderBoardSuccessMessage.value = '';

  const leaderBoardId = Number(editLeaderBoardId.value);
  const payload = {
    name: String(editLeaderBoardName.value || '').trim(),
    year: Number(editLeaderBoardYear.value),
    eventIds: selectedEditLeaderBoardResultIds.value
  };

  if (!Number.isInteger(leaderBoardId) || leaderBoardId <= 0) {
    editLeaderBoardErrorMessage.value = 'Invalid leader board selected.';
    return;
  }

  if (!payload.name || !Number.isInteger(payload.year) || payload.year <= 0) {
    editLeaderBoardErrorMessage.value = 'Name and Year (positive integer) are required.';
    return;
  }

  if (!Array.isArray(payload.eventIds) || payload.eventIds.length === 0) {
    editLeaderBoardErrorMessage.value = 'Select at least one result to include in the leader board.';
    return;
  }

  editLeaderBoardLoading.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/leader-boards/${leaderBoardId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to update leader board');
    }

    const data = await response.json();
    createLeaderBoardSuccessMessage.value = data.message || 'Leader board updated successfully.';
    await fetchLeaderBoards();

    if (activeLeaderBoard.value?.id === leaderBoardId) {
      activeLeaderBoard.value = {
        ...activeLeaderBoard.value,
        name: payload.name,
        year: payload.year,
        eventCount: payload.eventIds.length
      };
      await createLeaderBoardScoreView(activeLeaderBoard.value);
    }

    closeEditLeaderBoardDialog();
  } catch (error) {
    editLeaderBoardErrorMessage.value = error.message || 'Failed to update leader board';
  } finally {
    editLeaderBoardLoading.value = false;
  }
}

async function fetchLeaderBoardYearResults() {
  const year = Number(newLeaderBoardYear.value);
  leaderBoardYearResultsErrorMessage.value = '';
  leaderBoardYearResults.value = [];
  selectedLeaderBoardResultIds.value = [];

  if (!Number.isInteger(year) || year <= 0) {
    return;
  }

  leaderBoardYearResultsLoading.value = true;

  try {
    const query = new URLSearchParams({ year: String(year) });
    const response = await fetch(`${apiBaseUrl}/api/leader-boards/year-results?${query.toString()}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load results for selected year');
    }

    const data = await response.json();
    leaderBoardYearResults.value = Array.isArray(data) ? data : [];
  } catch (error) {
    leaderBoardYearResultsErrorMessage.value = error.message || 'Failed to load results for selected year';
  } finally {
    leaderBoardYearResultsLoading.value = false;
  }
}

function toggleLeaderBoardResultSelection(eventId) {
  const numericId = Number(eventId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return;
  }

  if (selectedLeaderBoardResultIds.value.includes(numericId)) {
    selectedLeaderBoardResultIds.value = selectedLeaderBoardResultIds.value.filter((id) => id !== numericId);
    return;
  }

  selectedLeaderBoardResultIds.value = [...selectedLeaderBoardResultIds.value, numericId];
}

async function createLeaderBoard() {
  createLeaderBoardErrorMessage.value = '';
  createLeaderBoardSuccessMessage.value = '';

  const payload = {
    name: String(newLeaderBoardName.value || '').trim(),
    year: Number(newLeaderBoardYear.value),
    eventIds: selectedLeaderBoardResultIds.value
  };

  if (!payload.name || !Number.isInteger(payload.year) || payload.year <= 0) {
    createLeaderBoardErrorMessage.value = 'Name and Year (positive integer) are required.';
    return;
  }

  if (!Array.isArray(payload.eventIds) || payload.eventIds.length === 0) {
    createLeaderBoardErrorMessage.value = 'Select at least one result to include in the leader board.';
    return;
  }

  createLeaderBoardLoading.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/leader-boards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to create leader board');
    }

    const data = await response.json();
    createLeaderBoardSuccessMessage.value = data.message || 'Leader board created successfully.';
    await fetchLeaderBoards();
    closeCreateLeaderBoardDialog();
  } catch (error) {
    createLeaderBoardErrorMessage.value = error.message || 'Failed to create leader board';
  } finally {
    createLeaderBoardLoading.value = false;
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

function normalizeTeamMemberName(value) {
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

  const lower = collapsed.toLowerCase();
  return lower.replace(/(^|[^a-zA-Z])([a-z])/g, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function hasNzCountryCode(value) {
  const text = String(value || '').trim();
  const match = text.match(/\(([^)]+)\)\s*$/);
  if (!match) {
    return false;
  }

  const code = String(match[1] || '').trim().toUpperCase();
  return code === 'NZ' || code === 'NZL';
}

function stripTrailingCountryCode(value) {
  return String(value || '').trim().replace(/\s*\(([^)]+)\)\s*$/g, '').trim();
}

function parseTeamNameAndMembers(rawName) {
  const fullName = String(rawName || '');
  const separatorIndex = fullName.indexOf(';');

  if (separatorIndex >= 0) {
    const teamName = normalizeTeamMemberName(fullName.slice(0, separatorIndex));
    const membersText = fullName.slice(separatorIndex + 1);
    const members = membersText
      .split(',')
      .map((member) => normalizeTeamMemberName(member))
      .filter(Boolean);

    return {
      teamName,
      members
    };
  }

  const colonIndex = fullName.indexOf(':');
  if (colonIndex >= 0) {
    const teamName = normalizeTeamMemberName(fullName.slice(0, colonIndex));
    const membersText = fullName.slice(colonIndex + 1);
    const members = membersText
      .split(',')
      .map((member) => normalizeTeamMemberName(member.replace(/[.]+$/g, '')))
      .filter(Boolean);

    return {
      teamName,
      members
    };
  }

  const parenthesizedMemberListPattern = /^\s*[^,;:]+?\([^)]*\)\s*(,\s*[^,;:]+?\([^)]*\)\s*)+$/;
  if (parenthesizedMemberListPattern.test(fullName)) {
    const members = fullName
      .split(',')
      .map((member) => normalizeTeamMemberName(member))
      .filter(Boolean);

    return {
      teamName: members[0] || '',
      members
    };
  }

  const openParenIndex = fullName.indexOf('(');
  if (openParenIndex >= 0) {
    const teamName = normalizeTeamMemberName(fullName.slice(0, openParenIndex));
    const membersText = fullName.slice(openParenIndex + 1);
    const members = membersText
      .split(',')
      .map((member) => normalizeTeamMemberName(member.replace(/[.]+$/g, '')))
      .filter(Boolean);

    return {
      teamName,
      members
    };
  }

  const teamName = normalizeTeamMemberName(fullName);
  const members = [normalizeTeamMemberName(fullName)].filter(Boolean);

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
  const hasAnyNzTaggedMember = teamsData.some((team) => {
    const { members } = parseTeamNameAndMembers(team?.name);
    return members.some((member) => hasNzCountryCode(member));
  });

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
    const filteredMembers = hasAnyNzTaggedMember
      ? members.filter((member) => hasNzCountryCode(member))
      : members;
    if (filteredMembers.length === 0) {
      continue;
    }

    const finalScore = team?.final_score ?? null;
    const rawTeamCategories = extractNormalizedTeamCategories(team?.category);
    const mappedTeamCategories = new Set(
      rawTeamCategories
        .map((rawCategory) => categoryMapping.get(rawCategory) || '')
        .filter(Boolean)
    );

    for (const member of filteredMembers) {
      const row = {
        team_name: teamName,
        team_member: stripTrailingCountryCode(member),
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
    savedEventId.value = Number(data?.event?.id) || null;
  } catch (error) {
    saveEventErrorMessage.value = error.message || 'Failed to save event details';
  } finally {
    saveEventLoading.value = false;
  }
}

async function saveTransformedResults() {
  saveTransformedErrorMessage.value = '';
  saveTransformedSuccessMessage.value = '';

  if (transformedRows.value.length === 0) {
    saveTransformedErrorMessage.value = 'Run Transform before saving results.';
    return;
  }

  if (!savedEventId.value) {
    saveTransformedErrorMessage.value = 'Save Event first so transformed data can be linked.';
    return;
  }

  const rowsPayload = transformedRows.value.map((row, index) => {
    const scaledRow = scaledRows.value[index] || {};

    const raw = {
      final_score: row.final_score ?? null
    };

    const scaled = {
      final_score: scaledRow.final_score ?? null
    };

    for (const category of fixedCategoryColumns) {
      raw[category] = row[category] ?? null;
      scaled[category] = scaledRow[category] ?? null;
    }

    return {
      team_name: row.team_name,
      team_member: row.team_member,
      raw,
      scaled
    };
  });

  saveTransformedLoading.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/events/${savedEventId.value}/transformed-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rows: rowsPayload })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to save transformed results');
    }

    const data = await response.json();
    saveTransformedSuccessMessage.value = data.message || 'Transformed results saved successfully.';
  } catch (error) {
    saveTransformedErrorMessage.value = error.message || 'Failed to save transformed results';
  } finally {
    saveTransformedLoading.value = false;
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
    saveTransformedErrorMessage.value = '';
    saveTransformedSuccessMessage.value = '';
    savedEventId.value = null;
  } catch (error) {
    jsonLoadErrorMessage.value = error.message || 'Failed to load results';
    jsonLoadData.value = null;
    transformErrorMessage.value = '';
    transformedRows.value = [];
    transformedColumns.value = [];
    saveEventErrorMessage.value = '';
    saveEventSuccessMessage.value = '';
    saveTransformedErrorMessage.value = '';
    saveTransformedSuccessMessage.value = '';
    savedEventId.value = null;
  } finally {
    jsonLoadLoading.value = false;
  }
}

onMounted(() => {
  fetchEventsIndex();
  fetchLeaderBoards();
});
</script>

<template>
  <main>
    <h1>Rogainizer</h1>

    <div class="view-switcher">
      <button type="button" :class="{ active: currentView === 'leader-boards' }" @click="switchView('leader-boards')">Leader Boards</button>
      <button type="button" :class="{ active: currentView === 'results' }" @click="switchView('results')">Results</button>
      <button type="button" :class="{ active: currentView === 'json-loader' }" @click="switchView('json-loader')">Results Loader</button>
    </div>

    <section v-if="currentView === 'json-loader'" class="json-loader-section">
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
              <button type="button" @click="saveTransformedResults" :disabled="saveTransformedLoading || transformedRows.length === 0">
                {{ saveTransformedLoading ? 'Saving...' : 'Save Results' }}
              </button>
            </div>
            <p v-if="saveTransformedErrorMessage" class="error">{{ saveTransformedErrorMessage }}</p>
            <p v-if="saveTransformedSuccessMessage" class="success">{{ saveTransformedSuccessMessage }}</p>
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

    <section v-else-if="currentView === 'results'" class="json-loader-section">
      <h2>Results</h2>
      <div class="json-loader-controls">
        <label>
          Event
          <select v-model="selectedResultsEventId" :disabled="resultsEventsLoading || resultsEvents.length === 0">
            <option value="" disabled>Select event</option>
            <option v-for="eventItem in resultsEvents" :key="`saved-event-${eventItem.id}`" :value="String(eventItem.id)">
              {{ eventItem.year }} - {{ eventItem.series }} - {{ eventItem.name }}
            </option>
          </select>
        </label>
      </div>
      <p v-if="resultsEventsLoading">Loading events...</p>
      <p v-if="resultsEventsErrorMessage" class="error">{{ resultsEventsErrorMessage }}</p>
      <p v-if="selectedResultsEvent">{{ selectedResultsEvent.name }} ({{ selectedResultsEvent.date }})</p>

      <div v-if="eventResultsRows.length > 0" class="transformed-mode-switch">
        <label>
          <input v-model="eventResultsDisplayMode" type="radio" value="raw" />
          Raw
        </label>
        <label>
          <input v-model="eventResultsDisplayMode" type="radio" value="scaled" />
          Scaled
        </label>
        <label>
          <input v-model="showOnlyFlaggedResultMembers" type="checkbox" />
          Flagged only
        </label>
      </div>

      <p v-if="eventResultsLoading">Loading results...</p>
      <p v-if="eventResultsErrorMessage" class="error">{{ eventResultsErrorMessage }}</p>

      <table v-if="!eventResultsLoading && filteredEventResultsRows.length > 0" class="events-table transformed-table">
        <thead>
          <tr>
            <th v-for="column in eventResultsColumns" :key="`event-results-header-${column}`">{{ transformedColumnLabel(column) }}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in filteredEventResultsRows" :key="`event-results-row-${row.id || rowIndex}`">
            <td
              v-for="column in eventResultsColumns"
              :key="`event-results-cell-${rowIndex}-${column}`"
              :class="{
                'scaled-score-cell': eventResultsDisplayMode === 'scaled' && column !== 'team_name' && column !== 'team_member',
                'result-member-warning': column === 'team_member' && shouldHighlightMemberName(row.team_member)
              }"
            >
              {{ formatResultCell(row, column) }}
            </td>
            <td>
              <button type="button" @click="openEditResultDialog(row)">Edit</button>
              <button type="button" @click="deleteResultRow(row)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="!eventResultsLoading" class="empty-state">No saved results for this event.</p>
    </section>

    <div v-if="showEditResultDialog" class="dialog-backdrop">
      <div class="mapping-dialog" role="dialog" aria-modal="true" aria-label="Edit result row">
        <h3>Edit Result Row</h3>
        <div class="json-loader-controls">
          <label>
            Team
            <input v-model="editResultTeamName" type="text" placeholder="Team name" />
          </label>
          <label>
            Member
            <input v-model="editResultTeamMember" type="text" placeholder="Member name" />
          </label>
        </div>
        <p v-if="editResultErrorMessage" class="error">{{ editResultErrorMessage }}</p>
        <div class="mapping-dialog-actions">
          <button type="button" @click="closeEditResultDialog">Cancel</button>
          <button type="button" @click="saveEditedResultRow" :disabled="editResultLoading">
            {{ editResultLoading ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>

    <section v-else-if="currentView === 'leader-boards'" class="json-loader-section">
      <p v-if="createLeaderBoardSuccessMessage" class="success">{{ createLeaderBoardSuccessMessage }}</p>
      <p v-if="leaderBoardsErrorMessage" class="error">{{ leaderBoardsErrorMessage }}</p>
      <p v-if="leaderBoardsLoading">Loading leader boards...</p>

      <div class="leader-boards-layout">
        <div class="json-output-panel">
          <table v-if="!leaderBoardsLoading" class="events-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Year</th>
                <th>Events</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="leaderBoard in leaderBoards" :key="leaderBoard.id">
                <td>{{ leaderBoard.name }}</td>
                <td>{{ leaderBoard.year }}</td>
                <td>{{ leaderBoard.eventCount }}</td>
                <td>
                  <button type="button" @click="openEditLeaderBoardDialog(leaderBoard)">Edit</button>
                  <button type="button" @click="createLeaderBoardScoreView(leaderBoard)">View</button>
                </td>
              </tr>
              <tr v-if="leaderBoards.length === 0">
                <td colspan="4" class="empty-state">No leader boards yet.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="activeLeaderBoard !== null" class="json-output-panel transformed-output-panel">
          <h3>Leader Board Scores: {{ activeLeaderBoard.name }}</h3>
          <p v-if="leaderBoardScoresErrorMessage" class="error">{{ leaderBoardScoresErrorMessage }}</p>
          <p v-if="leaderBoardScoresLoading">Creating scores...</p>

          <div v-if="!leaderBoardScoresLoading && leaderBoardScoresRows.length > 0" class="transformed-mode-switch">
            <label>
              <input v-model="leaderBoardScoresDisplayMode" type="radio" value="scaled" />
              Scaled
            </label>
            <label>
              <input v-model="leaderBoardScoresDisplayMode" type="radio" value="raw" />
              Raw
            </label>
          </div>

          <table v-if="!leaderBoardScoresLoading && leaderBoardScoresRows.length > 0" class="events-table transformed-table">
            <thead>
              <tr>
                <th
                  v-for="column in leaderBoardScoreColumns"
                  :key="`leader-board-score-header-${column}`"
                  :class="{ 'sortable-header': isLeaderBoardScoreColumn(column) }"
                  @click="sortLeaderBoardScoresBy(column)"
                >
                  {{ leaderBoardColumnLabel(column) }}{{ leaderBoardSortIndicator(column) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in sortedLeaderBoardScoreRows" :key="`leader-board-score-row-${rowIndex}`">
                <td
                  v-for="column in leaderBoardScoreColumns"
                  :key="`leader-board-score-cell-${rowIndex}-${column}`"
                  :class="{
                    'scaled-score-cell': leaderBoardScoresDisplayMode === 'scaled' && column !== 'team_name' && column !== 'team_member',
                    'member-cell': column === 'team_member'
                  }"
                  @click="column === 'team_member' ? openLeaderBoardMemberDialog(row) : null"
                >
                  {{ formatLeaderBoardScoreCell(row, column) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else-if="!leaderBoardScoresLoading" class="empty-state">No scores found for this leader board.</p>
        </div>
      </div>
    </section>

    <div v-if="showLeaderBoardMemberDialog" class="dialog-backdrop">
      <div class="mapping-dialog" role="dialog" aria-modal="true" aria-label="Member event scores">
        <h3>Member Event Scores</h3>
        <p>{{ selectedLeaderBoardMember }}</p>
        <p v-if="leaderBoardMemberEventsErrorMessage" class="error">{{ leaderBoardMemberEventsErrorMessage }}</p>
        <p v-if="leaderBoardMemberEventsLoading">Loading event scores...</p>

        <table v-if="!leaderBoardMemberEventsLoading && leaderBoardMemberEventRows.length > 0" class="events-table mapping-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Date</th>
              <th>Score</th>
              <th>Categories</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="eventRow in leaderBoardMemberEventRows" :key="`member-event-row-${eventRow.eventId}`">
              <td>{{ eventRow.eventName }}</td>
              <td>{{ eventRow.date }}</td>
              <td>{{ eventRowScoreValue(eventRow) }}</td>
              <td>{{ eventRowCategoriesText(eventRow) || ' ' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="!leaderBoardMemberEventsLoading" class="empty-state">No event scores found for this member.</p>

        <div class="mapping-dialog-actions">
          <button type="button" @click="closeLeaderBoardMemberDialog">Close</button>
        </div>
      </div>
    </div>

    <div v-if="showCreateLeaderBoardDialog" class="dialog-backdrop">
      <div class="mapping-dialog" role="dialog" aria-modal="true" aria-label="Create leader board">
        <h3>Create Leader Board</h3>
        <div class="json-loader-controls">
          <label>
            Name
            <input v-model="newLeaderBoardName" type="text" placeholder="Leader board name" />
          </label>
          <label>
            Year
            <input v-model="newLeaderBoardYear" type="text" inputmode="numeric" placeholder="2026" />
          </label>
        </div>
        <p v-if="leaderBoardYearResultsLoading">Loading results for selected year...</p>
        <p v-if="leaderBoardYearResultsErrorMessage" class="error">{{ leaderBoardYearResultsErrorMessage }}</p>
        <p v-if="createLeaderBoardErrorMessage" class="error">{{ createLeaderBoardErrorMessage }}</p>

        <table v-if="leaderBoardYearResults.length > 0" class="events-table mapping-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Name</th>
              <th>Series</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="result in leaderBoardYearResults" :key="`leader-board-result-${result.id}`">
              <td>
                <input
                  type="checkbox"
                  :checked="selectedLeaderBoardResultIds.includes(result.id)"
                  @change="toggleLeaderBoardResultSelection(result.id)"
                />
              </td>
              <td>{{ result.name }}</td>
              <td>{{ result.series }}</td>
              <td>{{ result.date }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="!leaderBoardYearResultsLoading" class="empty-state">Load year results to select entries.</p>

        <div class="mapping-dialog-actions">
          <button type="button" @click="closeCreateLeaderBoardDialog">Cancel</button>
          <button type="button" @click="createLeaderBoard" :disabled="createLeaderBoardLoading">
            {{ createLeaderBoardLoading ? 'Saving...' : 'Save Leader Board' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showEditLeaderBoardDialog" class="dialog-backdrop">
      <div class="mapping-dialog" role="dialog" aria-modal="true" aria-label="Edit leader board">
        <h3>Edit Leader Board</h3>
        <div class="json-loader-controls">
          <label>
            Name
            <input v-model="editLeaderBoardName" type="text" placeholder="Leader board name" />
          </label>
          <label>
            Year
            <input v-model="editLeaderBoardYear" type="text" inputmode="numeric" placeholder="2026" />
          </label>
        </div>
        <p v-if="editLeaderBoardLoadingDetails">Loading leader board details...</p>
        <p v-if="editLeaderBoardYearResultsLoading">Loading results for selected year...</p>
        <p v-if="editLeaderBoardYearResultsErrorMessage" class="error">{{ editLeaderBoardYearResultsErrorMessage }}</p>
        <p v-if="editLeaderBoardErrorMessage" class="error">{{ editLeaderBoardErrorMessage }}</p>

        <table v-if="editLeaderBoardYearResults.length > 0" class="events-table mapping-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Name</th>
              <th>Series</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="result in editLeaderBoardYearResults" :key="`edit-leader-board-result-${result.id}`">
              <td>
                <input
                  type="checkbox"
                  :checked="selectedEditLeaderBoardResultIds.includes(result.id)"
                  @change="toggleEditLeaderBoardResultSelection(result.id)"
                />
              </td>
              <td>{{ result.name }}</td>
              <td>{{ result.series }}</td>
              <td>{{ result.date }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="!editLeaderBoardYearResultsLoading" class="empty-state">Load year results to select entries.</p>

        <div class="mapping-dialog-actions">
          <button type="button" @click="closeEditLeaderBoardDialog">Cancel</button>
          <button type="button" @click="updateLeaderBoard" :disabled="editLeaderBoardLoading || editLeaderBoardLoadingDetails">
            {{ editLeaderBoardLoading ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>

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

.events-table th,
.events-table td {
  border: 1px solid #ddd;
  padding: 0.6rem;
  text-align: left;
}

.events-table th.sortable-header {
  cursor: pointer;
  user-select: none;
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

.events-table td.member-cell {
  cursor: pointer;
  text-decoration: underline;
}

.events-table td.result-member-warning {
  color: #b00020;
  font-weight: 600;
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

.leader-boards-layout {
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

  .leader-boards-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  }
}
</style>
