module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { videoId, url } = req.query;
  const targetUrl = url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing videoId or url' });
  }

  try {
    const apiRes = await fetch(
      `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(targetUrl)}`,
      { headers: { 'x-api-key': process.env.SUPADATA_API_KEY } }
    );

    if (!apiRes.ok) {
      const errData = await apiRes.json().catch(() => ({}));
      throw new Error(errData.error || `Supadata error: ${apiRes.status}`);
    }

    const data = await apiRes.json();

    const segments = data.content.map(c => ({
      start: Math.round(c.offset / 1000),
      text: c.text
    }));

    return res.status(200).json({
      videoId: targetUrl,
      segments,
      fullText: segments.map(s => s.text).join(' ')
    });
  } catch (err) {
    console.error('Transcript fetch failed:', err);
    return res.status(500).json({ error: 'Could not fetch transcript.', debug: err.message });
  }
};
