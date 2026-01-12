// src/App.jsx

import { Routes, Route } from "react-router-dom";
import MouseDot from "./components/MouseDot.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import ContractNew from "./pages/ContractNew.jsx";
import Signature from "./pages/Signature.jsx";

export default function App() {
  return (
    <>
      <MouseDot size={10} lag={0.15} />
      <Routes>
        <Route path="/" element={<Leaderboard />} />
        <Route path="/contracts/new" element={<ContractNew />} />
        <Route path="/signature/:id" element={<Signature />} />
      </Routes>
    </>
  );
}
