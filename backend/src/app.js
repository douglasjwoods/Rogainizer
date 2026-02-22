import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import usersRouter from './routes/users.js';
import eventsRouter from './routes/events.js';
import jsonLoaderRouter from './routes/json-loader.js';
import leaderBoardsRouter from './routes/leader-boards.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'Rogainizer API is running' });
});

app.use('/api/health', healthRouter);
app.use('/api/users', usersRouter);
app.use('/api/events', eventsRouter);
app.use('/api/json-loader', jsonLoaderRouter);
app.use('/api/leader-boards', leaderBoardsRouter);

export default app;
