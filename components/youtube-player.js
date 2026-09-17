/** Project video parsing shared by admin, backups and the public player.
 * The legacy youtubeUrl / youtube_url field stores all supported video URLs.
 */

function getProjectVideo(value, autoplay = false) {
  const input = String(value || '').trim();
  if (!input) return null;
  let url;
  try { url = new URL(input); } catch (_) {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(input)) return null;
  }
  if (url && (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)) return null;
  const youtube = getYouTubeWatchUrl(input);
  if (youtube) return { type: 'youtube', url: youtube, embedUrl: getYouTubeEmbedUrl(input, autoplay) };
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match = url.pathname.match(host === 'player.vimeo.com'
      ? /^\/video\/(\d+)\/?$/
      : /^\/(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/);
    if (!match) return null;
    const hash = match[2] || url.searchParams.get('h') || '';
    if (hash && !/^[a-zA-Z0-9]+$/.test(hash)) return null;
    const canonical = new URL(`https://player.vimeo.com/video/${match[1]}`);
    if (hash) canonical.searchParams.set('h', hash);
    const embed = new URL(canonical);
    embed.searchParams.set('playsinline', '1');
    if (autoplay) embed.searchParams.set('autoplay', '1');
    return { type: 'vimeo', url: canonical.href, embedUrl: embed.href };
  }
  if (/\.(mp4|webm)$/i.test(url.pathname)) return { type: 'file', url: url.href };
  return null;
}

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
