import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface VideoItem {
  title: string;
  filename: string;
  thumbnail: string;
  relativePath: string;
}

type CategorizedVideos = Record<string, VideoItem[]>;

const Home = () => {
  const [grouped, setGrouped] = useState<CategorizedVideos>({});
  const [isLoading, setIsLoading] = useState<boolean>(true); // ✅ เพิ่ม loading state
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/videos`)
      .then(res => res.json())
      .then((videos: VideoItem[]) => {
        const groupedByCategory: CategorizedVideos = {};

        videos.forEach((video) => {
          const category = video.relativePath.includes(pathSep())
            ? video.relativePath.split(pathSep())[0]
            : 'Uncategorized';

          if (!groupedByCategory[category]) {
            groupedByCategory[category] = [];
          }
          groupedByCategory[category].push(video);
        });

        setGrouped(groupedByCategory);
      })
      .catch(err => {
        console.error('Failed to fetch videos:', err);
      })
      .finally(() => setIsLoading(false)); // ✅ จบการโหลดเสมอ
  }, []);

  const pathSep = () => (window.navigator.platform.startsWith('Win') ? '\\' : '/');

  return (
    <div className="bg-black min-h-screen p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">📂 Video Library</h1>

      {isLoading ? (
        <div className="text-center text-gray-400">🔄 กำลังโหลดรายการวิดีโอ...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center text-gray-500">📭 ไม่มีวิดีโอที่พบ</div>
      ) : (
        Object.entries(grouped).map(([category, videos]) => (
          <div key={category} className="mb-10">
            <h2 className="text-xl font-semibold mb-3 capitalize">{category}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {videos.map((v, i) => (
                <div
                  key={i}
                  className="bg-gray-800 rounded-lg overflow-hidden shadow hover:shadow-xl transition cursor-pointer"
                  onClick={() => navigate(`/watch/${encodeURIComponent(v.relativePath)}`)}
                >
                  <div className="aspect-video bg-gray-900 relative">
                    <img
                      src={`${process.env.REACT_APP_API_URL}/${v.thumbnail}`}
                      alt={v.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 w-full bg-black bg-opacity-60 p-1 text-xs truncate">
                      {v.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default Home;
