import { Router } from 'express';

const router = Router();

router.get('/', async (req, res) => {
  const rawUrl = String(req.query.url || '').trim();

  if (!rawUrl) {
    return res.status(400).json({ message: 'Query parameter "url" is required.' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return res.status(400).json({ message: 'Invalid URL.' });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return res.status(400).json({ message: 'Only HTTP/HTTPS URLs are allowed.' });
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 15000);

  try {
    const response = await fetch(targetUrl, {
      signal: abortController.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(502).json({ message: `Failed to fetch JSON (status ${response.status}).` });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return res.status(502).json({ message: 'Remote URL did not return JSON.' });
    }

    const json = await response.json();
    return res.json(json);
  } catch (error) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({ message: 'Timed out while fetching JSON.' });
    }

    return res.status(502).json({ message: 'Unable to fetch JSON from URL.' });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
