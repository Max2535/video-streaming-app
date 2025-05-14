import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Watch from './pages/Watch';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/watch/:filename" element={<Watch />} />
      </Routes>
    </Router>
  );
}

export default App;
