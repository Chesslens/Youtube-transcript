const { Innertube } = require('youtubei.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { videoId, url } = req.query;
  const id = videoId || extractVideoId(url);

  if (!id) {
    return res.status(400).json({ error: 'Missing or invalid videoId/url' });
  }

  try {
    const yt = await Innertube.create({ retrieve_player: false });
    const info = await yt.getInfo(id);
    const transcriptData = await info.getTranscript();

    const segments = transcriptData.transcript.content.body.initial_segments.map(seg => ({
      start: Math.round(Number(seg.start_ms) / 1000),
      text: seg.snippet.text
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

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
