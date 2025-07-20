function App() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontSize: '2rem'
    }}>
      Hello World 🎉
    </div>
  );
}

export default App;
import Contrat     from "./pages/Contrat";
<Route path="/contrat/new" element={<Contrat />} />
import Signature from "./pages/Signature";

<Route path="/signature/:id" element={<Signature />} />

