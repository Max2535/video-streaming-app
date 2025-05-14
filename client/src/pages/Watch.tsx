import { useParams } from 'react-router-dom';
import VideoPlayer from '../Components/VideoPlayer';
import React from 'react';

const Watch = () => {
  const { filename } = useParams();

  if (!filename) return <div className="text-white">ไม่พบวิดีโอ</div>;

  const src = `${process.env.REACT_APP_API_URL}/video/${encodeURIComponent(filename)}`;

  return (
    <div className="bg-black min-h-screen flex flex-col items-center justify-center text-white p-4">
      <h2 className="text-xl mb-4 break-words text-center">{filename}</h2>
      <VideoPlayer src={src} />
    </div>
  );
};

export default Watch;
