const { getSubtitles } = require('youtube-caption-extractor');
const { Innertube } = require('youtubei.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { videoId, url } = req.query;
  const id = videoId || extractVideoId(url);

  if (!id) {
    return res.status(400).json({ error: 'Missing or invalid videoId/url' });
  }

  const attempts = [
    () => methodCaptionExtractor(id),
    () => methodYoutubei(id),
    () => methodDirectTimedText(id),
  ];

  const errors = [];
  for (const attempt of attempts) {
    try {
      const segments = await attempt();
      if (segments && segments.length > 0) {
        return res.status(200).json({
          videoId: id,
          segments,
          fullText: segments.map(s => s.text).join(' ')
        });
      }
    } catch (err) {
      errors.push(err.message || String(err));
    }
  }

  return res.status(500).json({
    error: 'Could not fetch transcript after trying all methods.',
    debug: errors.join(' | ')
  });
};

// Method 1: youtube-caption-extractor
async function methodCaptionExtractor(id) {
  const subs = await getSubtitles({ videoID: id, lang: 'en' });
  return subs.map(s => ({ start: Math.round(Number(s.start)), text: s.text }));
}

// Method 2: youtubei.js
async function methodYoutubei(id) {
  const yt = await Innertube.create();
  const info = await yt.getInfo(id);
  const tracks = info.captions?.caption_tracks;
  if (!tracks || tracks.length === 0) throw new Error('youtubei.js: no caption tracks');
  const track = tracks.find(t => t.language_code === 'en') || tracks[0];
  const capRes = await fetch(track.base_url + '&fmt=json3');
  const capData = await capRes.json();
  return (capData.events || [])
    .filter(e => e.segs)
    .map(e => ({ start: Math.round(e.tStartMs / 1000), text: e.segs.map(s => s.utf8).join('') }));
}

// Method 3: Direct timedtext endpoint (last resort, oldest technique)
async function methodDirectTimedText(id) {
  const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    body: JSON.stringify({
      context: { client: { clientName: 'ANDROID', clientVersion: '19.09.37' } },
      videoId: id
    })
  });
  const playerData = await playerRes.json();
  const track = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.[0];
  if (!track) throw new Error('direct timedtext: no caption track in player response');

  const capRes = await fetch(track.baseUrl + '&fmt=json3', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const capData = await capRes.json();
  return (capData.events || [])
    .filter(e => e.segs)
    .map(e => ({ start: Math.round(e.tStartMs / 1000), text: e.segs.map(s => s.utf8).join('') }));
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
