import { fetchAndUpdateYouTubeVideos } from '../src/utils/youtube.mjs';

async function main() {
  console.log('Fetching YouTube videos...');
  const videos = await fetchAndUpdateYouTubeVideos();
  console.log(`Successfully processed videos. Total in storage: ${videos.length}`);
}

main().catch(console.error);