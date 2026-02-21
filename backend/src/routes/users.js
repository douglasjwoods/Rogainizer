import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT name, email FROM users ORDER BY name ASC, email ASC LIMIT 200');
    res.json(rows);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        message: 'users table does not exist. Run backend/sql/init.sql first.'
      });
    }
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'name and email are required' });
  }

  try {
    await pool.query('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
    const [rows] = await pool.query('SELECT name, email FROM users WHERE name = ? AND email = ?', [name, email]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'name + email must be unique' });
    }
    res.status(500).json({ message: error.message });
  }
});

router.put('/', async (req, res) => {
  const originalName = String(req.query.name || '').trim();
  const originalEmail = String(req.query.email || '').trim();
  const { name, email } = req.body;

  if (!originalName || !originalEmail) {
    return res.status(400).json({ message: 'original name and email query parameters are required' });
  }

  if (!name || !email) {
    return res.status(400).json({ message: 'name and email are required' });
  }

  try {
    const [existingRows] = await pool.query('SELECT name, email FROM users WHERE name = ? AND email = ?', [originalName, originalEmail]);

    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'user not found' });
    }

    await pool.query('UPDATE users SET name = ?, email = ? WHERE name = ? AND email = ?', [name, email, originalName, originalEmail]);

    const [rows] = await pool.query('SELECT name, email FROM users WHERE name = ? AND email = ?', [name, email]);
    res.json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'name + email must be unique' });
    }
    res.status(500).json({ message: error.message });
  }
});

router.delete('/', async (req, res) => {
  const name = String(req.query.name || '').trim();
  const email = String(req.query.email || '').trim();

  if (!name || !email) {
    return res.status(400).json({ message: 'name and email query parameters are required' });
  }

  try {
    const [result] = await pool.query('DELETE FROM users WHERE name = ? AND email = ?', [name, email]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'user not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
