import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import myLogoDark from '../assets/my_image2.png';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiClient.login(email.trim().toLowerCase(), password);

      console.log("LOGIN RES:", res);
      console.log("TOKEN AFTER LOGIN:", apiClient.getToken());
      console.log("USER AFTER LOGIN:", apiClient.getUser());

      const token = apiClient.getToken();
      const user = apiClient.getUser();

      if (!token || !user) {
        throw new Error("Login OK mais token/user non stockés (apiClient incohérent).");
      }

      navigate('/');
    } catch (err) {
      setError(err.message || 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img
              src={myLogoDark}
              alt="Owner Technology"
              style={{
                width: '52px',
                height: '52px',
                objectFit: 'contain'
              }}
            />
          </div>
          <h1>Owner Technology</h1>
          <p>Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email professionnel</label>
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@ownertechnology.com"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <div className="input-wrapper">
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '-8px' }}>
            <Link
              to="/forgot-password"
              style={{
                color: '#6b7280',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1d1d1f'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Connexion' : 'Se connecter'}
          </button>

          <a
            href="mailto:y.amrane@ownertechnology.com"
            style={{
              color: '#9ca3af',
              fontSize: '13px',
              fontWeight: 400,
              textDecoration: 'none',
              textAlign: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#6b7280'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
          >
            Contacter le support
          </a>
        </form>
      </div>
    </div>
  );
}
