import { useState } from 'react';
import Home from './home/Home';
export default function App() {
  const [place, setPlace] = useState('');
  return place ? <main className="foundation-workspace"><button onClick={() => setPlace('')}>← Home</button><h1>{place}</h1><p>Your local workspace. Site evidence and geometry are not yet available.</p></main> : <Home onOpen={setPlace} />;
}
