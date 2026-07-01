// api/transcript.js
// Vercel serverless function. Place this file at: api/transcript.js in your repo root.
// Vercel auto-deploys anything in /api as a serverless endpoint — no extra config needed.

const { YoutubeTranscript } = require('youtube-transcript');

module.exports = async (req, res) => {
  // Allow your frontend to call this (same-origin on Vercel, but harmless to keep)
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { videoId, url } = req.query;
  const id = videoId || extractVideoId(url);

  if (!id) {
    return res.status(400).json({ error: 'Missing or invalid videoId/url' });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(id);

    return res.status(200).json({
      videoId: id,
      segments: transcript.map(t => ({
        start: Math.round(t.offset / 1000),
        text: t.text
      })),
      fullText: transcript.map(t => t.text).join(' ')
    });
  } catch (err) {
    console.error('Transcript fetch failed:', err);
    return res.status(500).json({
      error: 'Could not fetch transcript.',
      debug: err.message || String(err)
    });
  }
};

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
                               }
