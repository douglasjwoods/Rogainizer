import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import usersRouter from './routes/users.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'Rogainizer API is running' });
});

app.use('/api/health', healthRouter);
app.use('/api/users', usersRouter);

export default app;
