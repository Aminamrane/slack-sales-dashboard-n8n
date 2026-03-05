import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import myLogoDark from '../assets/my_image2.png';
import './Login.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.forgotPassword(email);
    } catch { /* toujours afficher le message de succès */ }
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img
              src={myLogoDark}
              alt="Owner Technology"
              style={{ width: '52px', height: '52px', objectFit: 'contain' }}
            />
          </div>
          <h1>Mot de passe oublié</h1>
          <p>{sent ? 'Vérifiez votre boîte mail' : 'Entrez votre email professionnel'}</p>
        </div>

        {sent ? (
          <div style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #bbf7d0',
              color: '#16a34a',
              padding: '14px 16px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500,
              lineHeight: 1.5,
            }}>
              Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.
            </div>
            <Link
              to="/login"
              style={{
                color: '#6b7280',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1d1d1f'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
            >
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
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
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>

            <Link
              to="/login"
              style={{
                color: '#6b7280',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                textAlign: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1d1d1f'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
            >
              ← Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
