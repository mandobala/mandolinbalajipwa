import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIDEOS_FILE = path.join(process.cwd(), 'src/data/youtube-videos.json');

export async function fetchAndUpdateYouTubeVideos() {
  const YOUTUBE_API_KEY = 'AIzaSyC08asXz_XMuyLVEgzRxMU2BVJE43O45e8';
  const CHANNEL_ID = 'UCOMb0jCFPsDVs3A8YNPXG8Q';
  const maxResults = 50;
  
  // Load existing videos
  const existingVideos = getYouTubeVideos();
  const existingIds = new Set(existingVideos.map(video => video.id));
  
  let newVideos = [];
  let nextPageToken = null;

  try {
    do {
      const queryParams = new URLSearchParams({
        key: YOUTUBE_API_KEY,
        channelId: CHANNEL_ID,
        part: 'snippet,id',
        order: 'date',
        maxResults: maxResults.toString(),
        type: 'video',
        ...(nextPageToken && { pageToken: nextPageToken })
      });

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${queryParams.toString()}`
      );
      const data = await response.json();
      console.log(data);

      if (!response.ok) {
        throw new Error(`YouTube API error: ${data.error?.message || 'Unknown error'}`);
      }

      const fetchedVideos = data.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: `https://img.youtube.com/vi/${item.id.videoId}/maxresdefault.jpg`,
        publishDate: item.snippet.publishedAt // Store as ISO string
      }));

      // Only add videos we don't already have
      const uniqueNewVideos = fetchedVideos.filter(video => !existingIds.has(video.id));
      newVideos = [...newVideos, ...uniqueNewVideos];
      
      if (uniqueNewVideos.length === 0) {
        break;
      }

      nextPageToken = data.nextPageToken;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (nextPageToken);

    const dataDir = path.join(process.cwd(), 'src/data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const allVideos = [...existingVideos, ...newVideos].sort((a, b) => 
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );

    fs.writeFileSync(VIDEOS_FILE, JSON.stringify({
      lastUpdated: new Date().toISOString(),
      totalVideos: allVideos.length,
      videos: allVideos
    }, null, 2));

    console.log(`Added ${newVideos.length} new videos. Total videos: ${allVideos.length}`);
    return allVideos;

  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return existingVideos;
  }
}

export function getYouTubeVideos() {
  try {
    if (!fs.existsSync(VIDEOS_FILE)) {
      return [];
    }

    const data = JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf-8'));
    // Convert the stored date strings back to Date objects
    return data.videos.map(video => ({
      ...video,
      publishDate: new Date(video.publishDate)
    }));
  } catch (error) {
    console.error('Error reading videos file:', error);
    return [];
  }
}