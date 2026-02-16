import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

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
    const parsed = JSON.parse(value);
    return normalizeList(parsed);
  } catch {
    return [];
  }
}

function mapEventRow(row) {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    location: row.location,
    courses: parseStoredList(row.courses),
    categories: parseStoredList(row.categories)
  };
}

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, DATE_FORMAT(event_date, '%Y-%m-%d') AS date, location, courses, categories
       FROM events
       ORDER BY event_date ASC, id ASC`
    );
    res.json(rows.map(mapEventRow));
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        message: 'events table does not exist. Run backend/sql/init.sql first.'
      });
    }
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  const { name, date, location, courses, categories } = req.body;
  const normalizedCourses = normalizeList(courses);
  const normalizedCategories = normalizeList(categories);

  if (!name || !date || !location) {
    return res.status(400).json({ message: 'name, date, and location are required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO events (name, event_date, location, courses, categories) VALUES (?, ?, ?, ?, ?)',
      [name, date, location, JSON.stringify(normalizedCourses), JSON.stringify(normalizedCategories)]
    );

    const [rows] = await pool.query(
      `SELECT id, name, DATE_FORMAT(event_date, '%Y-%m-%d') AS date, location, courses, categories
       FROM events
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(mapEventRow(rows[0]));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const eventId = Number(req.params.id);
  const { name, date, location, courses, categories } = req.body;
  const normalizedCourses = normalizeList(courses);
  const normalizedCategories = normalizeList(categories);

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ message: 'invalid event id' });
  }

  if (!name || !date || !location) {
    return res.status(400).json({ message: 'name, date, and location are required' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE events SET name = ?, event_date = ?, location = ?, courses = ?, categories = ? WHERE id = ?',
      [name, date, location, JSON.stringify(normalizedCourses), JSON.stringify(normalizedCategories), eventId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'event not found' });
    }

    const [rows] = await pool.query(
      `SELECT id, name, DATE_FORMAT(event_date, '%Y-%m-%d') AS date, location, courses, categories
       FROM events
       WHERE id = ?`,
      [eventId]
    );

    res.json(mapEventRow(rows[0]));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const eventId = Number(req.params.id);

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ message: 'invalid event id' });
  }

  try {
    const [result] = await pool.query('DELETE FROM events WHERE id = ?', [eventId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'event not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
