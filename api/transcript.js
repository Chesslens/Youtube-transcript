const { Innertube } = require('youtubei.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { videoId, url } = req.query;
  const id = videoId || extractVideoId(url);

  if (!id) {
    return res.status(400).json({ error: 'Missing or invalid videoId/url' });
  }

  try {
    const yt = await Innertube.create();
    const info = await yt.getInfo(id);

    const tracks = info.captions?.caption_tracks;
    if (!tracks || tracks.length === 0) {
      return res.status(500).json({ error: 'Could not fetch transcript.', debug: 'No caption tracks found for this video.' });
    }

    const track = tracks.find(t => t.language_code === 'en') || tracks[0];
    const captionRes = await fetch(track.base_url + '&fmt=json3');
    const captionData = await captionRes.json();

    const segments = (captionData.events || [])
      .filter(e => e.segs)
      .map(e => ({
        start: Math.round(e.tStartMs / 1000),
        text: e.segs.map(s => s.utf8).join('')
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
