import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         year,
         series,
         name,
         DATE_FORMAT(date, '%Y-%m-%d') AS date,
         organiser,
         duration_hours AS duration
       FROM events
       ORDER BY year ASC, series ASC, date ASC, id ASC`
    );
    res.json(rows);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        message: 'events table does not exist. Run backend/sql/init.sql first.'
      });
    }
    res.status(500).json({ message: error.message });
  }
});

router.post('/save-result', async (req, res) => {
  const {
    year,
    series,
    name,
    date,
    organiser,
    duration,
    overwrite = false
  } = req.body;

  const eventYear = Number(year);
  const durationHours = Number(duration);

  if (!Number.isInteger(eventYear) || eventYear <= 0) {
    return res.status(400).json({ message: 'year must be a positive integer' });
  }

  if (!series || !name || !date || !organiser || !Number.isFinite(durationHours)) {
    return res.status(400).json({
      message: 'year, series, name, date, organiser, and duration are required'
    });
  }

  try {
    const [existingRows] = await pool.query(
      `SELECT id
       FROM events
       WHERE year = ? AND series = ? AND name = ?
       LIMIT 1`,
      [eventYear, series, name]
    );

    const existingEvent = existingRows[0] || null;

    if (existingEvent && !overwrite) {
      return res.status(409).json({
        message: 'Event already exists. Confirm overwrite to continue.',
        exists: true
      });
    }

    let eventId;

    if (existingEvent) {
      await pool.query(
        `UPDATE events
         SET date = ?, organiser = ?, duration_hours = ?, year = ?, series = ?, name = ?
         WHERE id = ?`,
        [date, organiser, durationHours, eventYear, series, name, existingEvent.id]
      );
      eventId = existingEvent.id;
    } else {
      const [insertResult] = await pool.query(
        `INSERT INTO events (
          name,
          year,
          series,
          date,
          organiser,
          duration_hours
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, eventYear, series, date, organiser, durationHours]
      );
      eventId = insertResult.insertId;
    }

    const [savedRows] = await pool.query(
      `SELECT
        id,
        year,
        series,
        name,
        DATE_FORMAT(date, '%Y-%m-%d') AS date,
        organiser,
        duration_hours AS duration
       FROM events
       WHERE id = ?`,
      [eventId]
    );

    return res.json({
      message: existingEvent ? 'Event overwritten successfully.' : 'Event saved successfully.',
      event: savedRows[0]
    });
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({
        message: 'events table schema is missing required columns. Run backend/sql/init.sql first.'
      });
    }

    return res.status(500).json({ message: error.message });
  }
});

export default router;
