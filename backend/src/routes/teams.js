import { Router } from 'express';
import pool from '../config/db.js';

const router = Router({ mergeParams: true });

function normalizeCompetitors(value) {
  return [...new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean))].join(', ');
}

function normalizeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function parseStoredList(value) {
  if (Array.isArray(value)) {
    return normalizeList(value);
  }

  if (typeof value !== 'string') {
    return [];
  }

  try {
    return normalizeList(JSON.parse(value));
  } catch {
    return [];
  }
}

function mapTeamRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    competitors: row.competitors,
    course: row.course,
    category: row.category,
    score: Number(row.score)
  };
}

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0) {
    return null;
  }
  return score;
}

async function getEventDetails(eventId) {
  const [rows] = await pool.query('SELECT id, courses, categories FROM events WHERE id = ?', [eventId]);

  if (rows.length === 0) {
    return null;
  }

  return {
    id: rows[0].id,
    courses: parseStoredList(rows[0].courses),
    categories: parseStoredList(rows[0].categories)
  };
}

function validateTeamSelections(eventDetails, course, category) {
  if (!eventDetails.courses.includes(course)) {
    return `course must be one of the event courses: ${eventDetails.courses.join(', ') || '(none configured)'}`;
  }

  if (!eventDetails.categories.includes(category)) {
    return `category must be one of the event categories: ${eventDetails.categories.join(', ') || '(none configured)'}`;
  }

  return null;
}

router.get('/', async (req, res) => {
  const eventId = Number(req.params.eventId);

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ message: 'invalid event id' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, event_id, name, competitors, course, category, score
       FROM teams
       WHERE event_id = ?
       ORDER BY id ASC`,
      [eventId]
    );

    res.json(rows.map(mapTeamRow));
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        message: 'teams table does not exist. Run backend/sql/init.sql first.'
      });
    }

    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  const eventId = Number(req.params.eventId);
  const { name, competitors, course, category, score } = req.body;
  const normalizedScore = normalizeScore(score ?? 0);

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ message: 'invalid event id' });
  }

  if (!name || !competitors || !course || !category) {
    return res.status(400).json({ message: 'name, competitors, course, category, and score are required' });
  }

  if (normalizedScore === null) {
    return res.status(400).json({ message: 'score must be a non-negative number' });
  }

  try {
    const eventDetails = await getEventDetails(eventId);
    if (!eventDetails) {
      return res.status(404).json({ message: 'event not found' });
    }

    const selectionError = validateTeamSelections(eventDetails, course, category);
    if (selectionError) {
      return res.status(400).json({ message: selectionError });
    }

    const [result] = await pool.query(
      'INSERT INTO teams (event_id, name, competitors, course, category, score) VALUES (?, ?, ?, ?, ?, ?)',
      [eventId, name, normalizeCompetitors(competitors), course, category, normalizedScore]
    );

    const [rows] = await pool.query(
      `SELECT id, event_id, name, competitors, course, category, score
       FROM teams
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(mapTeamRow(rows[0]));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:teamId', async (req, res) => {
  const eventId = Number(req.params.eventId);
  const teamId = Number(req.params.teamId);
  const { name, competitors, course, category, score } = req.body;
  const normalizedScore = normalizeScore(score);

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ message: 'invalid event id' });
  }

  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ message: 'invalid team id' });
  }

  if (!name || !competitors || !course || !category) {
    return res.status(400).json({ message: 'name, competitors, course, category, and score are required' });
  }

  if (normalizedScore === null) {
    return res.status(400).json({ message: 'score must be a non-negative number' });
  }

  try {
    const eventDetails = await getEventDetails(eventId);
    if (!eventDetails) {
      return res.status(404).json({ message: 'event not found' });
    }

    const selectionError = validateTeamSelections(eventDetails, course, category);
    if (selectionError) {
      return res.status(400).json({ message: selectionError });
    }

    const [result] = await pool.query(
      `UPDATE teams
       SET name = ?, competitors = ?, course = ?, category = ?, score = ?
       WHERE id = ? AND event_id = ?`,
      [name, normalizeCompetitors(competitors), course, category, normalizedScore, teamId, eventId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'team not found' });
    }

    const [rows] = await pool.query(
      `SELECT id, event_id, name, competitors, course, category, score
       FROM teams
       WHERE id = ? AND event_id = ?`,
      [teamId, eventId]
    );

    res.json(mapTeamRow(rows[0]));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:teamId', async (req, res) => {
  const eventId = Number(req.params.eventId);
  const teamId = Number(req.params.teamId);

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ message: 'invalid event id' });
  }

  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ message: 'invalid team id' });
  }

  try {
    const [result] = await pool.query('DELETE FROM teams WHERE id = ? AND event_id = ?', [teamId, eventId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'team not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
