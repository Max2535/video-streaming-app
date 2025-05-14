import React from 'react';

function App() {
  return (
    <div className="p-10 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-4">Video Streaming</h1>
      <video controls width="720">
        <source src="http://localhost:4000/video/sample.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

export default App;
