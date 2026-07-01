const { getSubtitles } = require('youtube-caption-extractor');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { videoId, url } = req.query;
  const id = videoId || extractVideoId(url);

  if (!id) {
    return res.status(400).json({ error: 'Missing or invalid videoId/url' });
  }

  try {
    const subtitles = await getSubtitlesWithRetry(id);

    const segments = subtitles.map(s => ({
      start: Math.round(Number(s.start)),
      text: s.text
    }));

    return res.status(200).json({
      videoId: id,
      segments,
      fullText: segments.map(s => s.text).join(' ')
    });
  } catch (err) {
    console.error('Transcript fetch failed:', err);
    return res.status(500).json({
      error: 'Could not fetch transcript.',
      debug: err.message || String(err)
    });
  }
};

async function getSubtitlesWithRetry(videoID, lang = 'en', maxAttempts = 3) {
  let lastError;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await getSubtitles({ videoID, lang });
    } catch (err) {
      lastError = err;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastError;
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
