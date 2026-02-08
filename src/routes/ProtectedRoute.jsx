// src/routes/ProtectedRoute.jsx - NOUVELLE VERSION POUR JWT
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

// Mapping des rôles vers les pages autorisées
const ROLE_PERMISSIONS = {
  admin: ['*'], // Accès à tout
  head_of_sales: ['/leads-management', '/tracking-sheet', '/', '/admin/leads'],
  commercial: ['/tracking-sheet', '/'],
  tech: ['/admin/leads', '/', '/monitoring-perf'],
  finance: ['/', '/reports'],
};

export default function ProtectedRoute({ children, allowedRoles = null }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = apiClient.getToken();
    const user = apiClient.getUser();

    if (!token || !user) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    // Vérifier si le rôle est autorisé (si spécifié)
    if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'admin') {
      setAllowed(false);
      setLoading(false);
      return;
    }

    // Optionnel : vérifier le token côté serveur
    try {
      await apiClient.getMe();
      setAllowed(true);
    } catch (e) {
      console.error("getMe failed:", e);
      // TEMP: ne wipe pas tant qu'on n'a pas compris
      // apiClient.clearAuth();
      setAllowed(false);
    }

    setLoading(false);
  };

  if (loading) {
    const isDark = document.body.classList.contains('dark-mode') ||
                   document.documentElement.classList.contains('dark-mode');
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: isDark ? '#1a1a1e' : '#f5f5f7',
        color: isDark ? '#f5f5f7' : '#1d1d1f'
      }}>
        Chargement...
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
