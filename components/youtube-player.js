/** YouTube URL parsing shared by the admin and public project page. */

function getYouTubeVideoId(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  let url;
  try {
    url = new URL(input);
  } catch (error) {
    return '';
  }

  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  let candidate = '';
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] || '';
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') candidate = url.searchParams.get('v') || '';
    else {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) candidate = parts[1] || '';
    }
  }

  return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : '';
}

function getYouTubeWatchUrl(value) {
  const videoId = getYouTubeVideoId(value);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
}

function getYouTubeEmbedUrl(value, autoplay = false) {
  const videoId = getYouTubeVideoId(value);
  if (!videoId) return '';

  const parameters = new URLSearchParams({
    rel: '0',
    playsinline: '1'
  });
  if (autoplay) parameters.set('autoplay', '1');

  return `https://www.youtube-nocookie.com/embed/${videoId}?${parameters.toString()}`;
}
