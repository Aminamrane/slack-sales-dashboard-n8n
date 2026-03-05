import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import myLogoDark from '../assets/my_image2.png';
import './Login.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      await apiClient.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      if (err.message?.includes('invalide') || err.message?.includes('expiré')) {
        setExpired(true);
      }
      setError(err.message || 'Lien invalide ou expiré');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
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
            <h1>Lien invalide</h1>
            <p>Ce lien de réinitialisation est invalide ou a expiré.</p>
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link
              to="/forgot-password"
              style={{
                color: '#5b6abf',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#4a59a8'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#5b6abf'}
            >
              Refaire une demande
            </Link>
            <Link
              to="/login"
              style={{
                color: '#6b7280',
                fontSize: '13px',
                fontWeight: 400,
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1d1d1f'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
            >
              ← Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <h1>Nouveau mot de passe</h1>
          <p>{success ? 'Mot de passe réinitialisé' : 'Choisissez un nouveau mot de passe'}</p>
        </div>

        {success ? (
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
              Votre mot de passe a été réinitialisé. Redirection vers la connexion...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span>{expired ? 'Ce lien a expiré ou a déjà été utilisé.' : error}</span>
                {expired && (
                  <Link
                    to="/forgot-password"
                    style={{ color: '#5b6abf', fontSize: '13px', fontWeight: 500, textDecoration: 'none', marginTop: '6px' }}
                  >
                    Refaire une demande →
                  </Link>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password">Nouveau mot de passe</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm">Confirmer le mot de passe</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  id="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Retapez le mot de passe"
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Réinitialisation...' : 'Réinitialiser'}
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
