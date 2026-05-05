import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";

// ── ORIGINS (niches) ─────────────────────────────────────────────────────────
const ORIGINS = [
  'BTP', 'Micro crèche', 'Ambulance', 'Dentiste', 'Pharmacie',
  'Salle de sport', 'Esthétique', 'Tech', 'Hôtellerie',
  'Grande Distribution', 'Tertiaire', 'Boulangerie', 'Immobilier',
  'Restauration', 'Générales',
];

// ── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:    { color: '#10b981', label: 'En cours' },
  paused:    { color: '#fb923c', label: 'En pause' },
  cancelled: { color: '#ef4444', label: 'Annulée' },
  deleted:   { color: '#94a3b8', label: 'Supprimée' },
};

const STATUSES = ['active', 'paused', 'cancelled'];

// ── MEDIA URL RESOLVER ───────────────────────────────────────────────────────
// Backend retourne des paths relatifs (`/uploads/images/<uuid>.webp`).
// Préfixe par API base URL pour les rendre absolus dans les <img>/<video>.
const mediaUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiClient.baseUrl}${path}`;
};

// ── FORMAT FILE SIZE ─────────────────────────────────────────────────────────
const fmtSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ── FORMAT RELATIVE DATE (court) ─────────────────────────────────────────────
const fmtRelative = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD < 7) return `il y a ${diffD}j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

export default function Campaigns() {
  const navigate = useNavigate();

  // ── DARK MODE ──────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  const C = {
    bg:        darkMode ? '#1e1f28' : '#ffffff',
    border:    darkMode ? '#2a2b36' : '#e2e6ef',
    surface:   darkMode ? '#13141b' : '#edf0f8',
    text:      darkMode ? '#eef0f6' : '#1e2330',
    muted:     darkMode ? '#5e6273' : '#9ca3af',
    subtle:    darkMode ? '#252636' : '#f4f6fb',
    secondary: darkMode ? '#8b8fa0' : '#6b7280',
    accent:    darkMode ? '#7c8adb' : '#5b6abf',
    shadow:    darkMode ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  };

  // ── AUTH ────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── DATA (legacy: campagnes manuelles, conservées pour onglets paused/cancelled) ──
  const [campaigns, setCampaigns] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);

  // ── FORM STATE (legacy) ─────────────────────────────────────────────────
  const [form, setForm] = useState({ title: '', description: '', origin: '', status: 'active', cover_image_url: '' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── CREATIVE FORM (legacy modal détail campagne) ────────────────────────
  const [showCreativeForm, setShowCreativeForm] = useState(false);
  const [editingCreative, setEditingCreative] = useState(null);
  const [creativeForm, setCreativeForm] = useState({ title: '', description: '', image_url: '', video_url: '', status: 'active' });
  const [creativeUploading, setCreativeUploading] = useState(false);

  // ── DATA "EN COURS" — piloté par ad_name (nouveau) ──────────────────────
  const [activeAds, setActiveAds] = useState([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adSearch, setAdSearch] = useState('');
  const [selectedAd, setSelectedAd] = useState(null); // ouvre le modal d'enrichissement

  // ── AUTH CHECK ──────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const token = apiClient.getToken();
        const user = apiClient.getUser();
        if (!token || !user) { navigate("/login"); return; }
        if (user.role !== 'admin' && user.role !== 'marketing') { navigate("/"); return; }
        setSession({ user: { email: user.email, user_metadata: { name: user.name, avatar_url: user.avatar_url || null } } });
        await Promise.all([fetchCampaigns(), fetchActiveAds()]);
      } catch {
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ── FETCH ───────────────────────────────────────────────────────────────
  const fetchCampaigns = async () => {
    try {
      const resp = await apiClient.get('/api/v1/campaigns');
      setCampaigns(resp.campaigns || resp || []);
    } catch (e) {
      console.error('Failed to fetch campaigns:', e);
    }
  };

  const fetchActiveAds = useCallback(async () => {
    setAdsLoading(true);
    try {
      const resp = await apiClient.get('/api/v1/campaigns/active-ads');
      setActiveAds(resp.ads || []);
    } catch (e) {
      console.error('Failed to fetch active ads:', e);
    } finally {
      setAdsLoading(false);
    }
  }, []);

  const fetchCampaignDetail = async (id) => {
    try {
      const resp = await apiClient.get(`/api/v1/campaigns/${id}`);
      setSelectedCampaign(resp);
    } catch (e) {
      console.error('Failed to fetch campaign detail:', e);
    }
  };

  // ── FILTERED LEGACY (paused / cancelled uniquement maintenant) ──────────
  const filteredLegacy = useMemo(() => {
    return campaigns.filter(c => c.status === statusFilter);
  }, [campaigns, statusFilter]);

  // ── FILTERED ADS (onglet "active") ──────────────────────────────────────
  const filteredAds = useMemo(() => {
    if (!adSearch.trim()) return activeAds;
    const q = adSearch.trim().toLowerCase();
    return activeAds.filter(a => (a.ad_name || '').toLowerCase().includes(q));
  }, [activeAds, adSearch]);

  const adsStats = useMemo(() => {
    const total = activeAds.length;
    const enriched = activeAds.filter(a => a.campaign && a.campaign.creative).length;
    return { total, enriched, missing: total - enriched };
  }, [activeAds]);

  // ── HANDLERS LEGACY ─────────────────────────────────────────────────────
  const handleUpload = async (file, type = 'image') => {
    const endpoint = type === 'video' ? '/api/v1/uploads/video' : '/api/v1/uploads/image';
    try {
      const resp = await apiClient.uploadFile(endpoint, file);
      return resp.url;
    } catch (e) {
      setError(`Erreur upload: ${e.message}`);
      return null;
    }
  };

  const handleCoverUpload = async (file) => {
    setUploading(true);
    const url = await handleUpload(file, 'image');
    if (url) setForm(prev => ({ ...prev, cover_image_url: url }));
    setUploading(false);
  };

  const resetForm = () => {
    setForm({ title: '', description: '', origin: '', status: 'active', cover_image_url: '' });
    setError('');
    setEditingCampaign(null);
  };

  const openEdit = (camp) => {
    setForm({
      title: camp.title || '',
      description: camp.description || '',
      origin: camp.origin || '',
      status: camp.status || 'active',
      cover_image_url: camp.cover_image_url || '',
    });
    setEditingCampaign(camp);
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Le titre est requis'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingCampaign) {
        await apiClient.patch(`/api/v1/campaigns/${editingCampaign.id}`, form);
      } else {
        await apiClient.post('/api/v1/campaigns', form);
      }
      await fetchCampaigns();
      setShowCreateModal(false);
      resetForm();
      if (editingCampaign && selectedCampaign?.id === editingCampaign.id) {
        fetchCampaignDetail(editingCampaign.id);
      }
    } catch (e) {
      setError(e.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette campagne ?')) return;
    try {
      await apiClient.delete(`/api/v1/campaigns/${id}`);
      await fetchCampaigns();
      if (selectedCampaign?.id === id) setSelectedCampaign(null);
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await apiClient.patch(`/api/v1/campaigns/${id}`, { status });
      await fetchCampaigns();
      if (selectedCampaign?.id === id) fetchCampaignDetail(id);
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
  };

  // ── CREATIVE HANDLERS (legacy) ──────────────────────────────────────────
  const resetCreativeForm = () => {
    setCreativeForm({ title: '', description: '', image_url: '', video_url: '', status: 'active' });
    setEditingCreative(null);
    setShowCreativeForm(false);
  };

  const handleCreativeSave = async () => {
    if (!selectedCampaign) return;
    if (!creativeForm.title.trim()) { setError('Le titre de la créa est requis'); return; }
    setSaving(true);
    try {
      if (editingCreative) {
        await apiClient.patch(`/api/v1/campaigns/${selectedCampaign.id}/creatives/${editingCreative.id}`, creativeForm);
      } else {
        await apiClient.post(`/api/v1/campaigns/${selectedCampaign.id}/creatives`, creativeForm);
      }
      await fetchCampaignDetail(selectedCampaign.id);
      await fetchCampaigns();
      resetCreativeForm();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreativeDelete = async (cid) => {
    if (!selectedCampaign || !window.confirm('Supprimer cette créa ?')) return;
    try {
      await apiClient.delete(`/api/v1/campaigns/${selectedCampaign.id}/creatives/${cid}`);
      await fetchCampaignDetail(selectedCampaign.id);
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
  };

  const handleCreativeUpload = async (file, type) => {
    setCreativeUploading(true);
    const url = await handleUpload(file, type);
    if (url) {
      const key = type === 'video' ? 'video_url' : 'image_url';
      setCreativeForm(prev => ({ ...prev, [key]: url }));
    }
    setCreativeUploading(false);
  };

  // ── FORMAT DATE ─────────────────────────────────────────────────────────
  const fmtDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ── LOADING ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface }}>
        <p style={{ color: C.muted, fontFamily: "'Inter', sans-serif" }}>Chargement...</p>
      </div>
    );
  }

  // ── SHARED STYLES ───────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500,
    border: `1px solid ${C.border}`, background: darkMode ? '#16171e' : '#fff', color: C.text,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const labelStyle = { fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' };

  const StatusBadge = ({ status, small }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', padding: small ? '2px 8px' : '3px 10px',
        borderRadius: 50, fontSize: small ? 10 : 11, fontWeight: 600,
        background: `${cfg.color}18`, color: cfg.color,
      }}>{cfg.label}</span>
    );
  };

  const isAdsTab = statusFilter === 'active';

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 0, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", background: C.surface, minHeight: '100vh' }}>
      <style>{`
        @keyframes pageReveal { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes modalOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalCardIn { from { opacity: 0; transform: scale(0.92) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
      `}</style>

      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />

      <div style={{ animation: 'pageReveal 0.5s cubic-bezier(0.4,0,0.2,1) both', paddingTop: 80 }}>
        {/* Outer wrapper */}
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px 40px' }}>
          <div style={{ background: darkMode ? 'rgba(0,0,0,0.10)' : 'rgba(190,197,215,0.20)', borderRadius: 32, padding: 18 }}>
            <div style={{ background: C.bg, borderRadius: 24, padding: '32px 36px', border: `1px solid ${C.border}` }}>

              {/* ── HEADER ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Campagnes Marketing</h1>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>
                    {isAdsTab
                      ? "Pubs détectées via Meta Ads — enrichissez-les avec vos créas et descriptions."
                      : "Gérez vos campagnes publicitaires et créas"}
                  </p>
                </div>
                {!isAdsTab && (
                  <button onClick={() => { resetForm(); setShowCreateModal(true); }} style={{
                    padding: '10px 20px', borderRadius: 10, border: 'none',
                    background: darkMode ? '#fff' : '#1e2330', color: darkMode ? '#1e2330' : '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <span style={{ fontSize: 16 }}>+</span> Nouvelle campagne
                  </button>
                )}
              </div>

              {/* ── STATUS FILTER PILLS ── */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} style={{
                    padding: '6px 16px', borderRadius: 50, border: `1.5px solid ${statusFilter === s ? C.accent : 'transparent'}`,
                    background: statusFilter === s ? `${C.accent}12` : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                    color: statusFilter === s ? C.accent : C.secondary,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>{STATUS_CONFIG[s].label}</button>
                ))}

                {/* Counter + search uniquement sur l'onglet active */}
                {isAdsTab && (
                  <>
                    <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.secondary, fontWeight: 500 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px', borderRadius: 50,
                        background: adsStats.missing > 0 ? '#fb923c14' : '#10b98114',
                        color: adsStats.missing > 0 ? '#fb923c' : '#10b981',
                        fontWeight: 600,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                        {adsStats.missing > 0
                          ? `${adsStats.missing} à enrichir / ${adsStats.total}`
                          : `${adsStats.total} pubs enrichies`}
                      </span>
                      <button onClick={fetchActiveAds} disabled={adsLoading} title="Rafraîchir" style={{
                        width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.muted, cursor: adsLoading ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          style={{ animation: adsLoading ? 'spin 0.8s linear infinite' : 'none' }}>
                          <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                      </button>
                    </div>
                    <div style={{ marginLeft: 'auto', position: 'relative' }}>
                      <input
                        value={adSearch}
                        onChange={(e) => setAdSearch(e.target.value)}
                        placeholder="Rechercher un ad_name..."
                        style={{
                          width: 240, padding: '7px 12px 7px 32px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                          border: `1px solid ${C.border}`, background: darkMode ? '#16171e' : '#fff', color: C.text,
                          fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"
                        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>
                  </>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════════
                   ONGLET "EN COURS" — pubs Meta par ad_name
                  ══════════════════════════════════════════════════════════ */}
              {isAdsTab ? (
                adsLoading && activeAds.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <p style={{ color: C.muted, fontSize: 14 }}>Chargement des pubs...</p>
                  </div>
                ) : filteredAds.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <p style={{ color: C.muted, fontSize: 14 }}>
                      {adSearch.trim()
                        ? `Aucun ad_name ne correspond à "${adSearch}".`
                        : "Aucune pub active détectée pour le moment."}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
                    {filteredAds.map((ad, i) => (
                      <AdCard
                        key={ad.ad_name}
                        ad={ad}
                        index={i}
                        C={C}
                        darkMode={darkMode}
                        onClick={() => setSelectedAd(ad)}
                      />
                    ))}
                  </div>
                )
              ) : (
                /* ══════════════════════════════════════════════════════════
                     ONGLETS LEGACY (paused / cancelled) — campagnes manuelles
                    ══════════════════════════════════════════════════════════ */
                filteredLegacy.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <p style={{ color: C.muted, fontSize: 14 }}>Aucune campagne {STATUS_CONFIG[statusFilter]?.label?.toLowerCase()}</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
                    {filteredLegacy.map((camp, i) => (
                      <div key={camp.id} onClick={() => fetchCampaignDetail(camp.id)} style={{
                        borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', cursor: 'pointer',
                        background: C.bg, transition: 'all 0.2s ease',
                        animation: `cardIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms both`,
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = darkMode ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        {/* Cover image */}
                        <div style={{ height: 160, background: darkMode ? '#16171e' : '#f0f1f4', overflow: 'hidden', position: 'relative' }}>
                          {camp.cover_image_url ? (
                            <img src={mediaUrl(camp.cover_image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ opacity: 0.3 }}>
                                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                              </svg>
                            </div>
                          )}
                          <div style={{ position: 'absolute', top: 10, right: 10 }}>
                            <StatusBadge status={camp.status} small />
                          </div>
                        </div>
                        {/* Info */}
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: 15, fontWeight: 650, color: C.text, marginBottom: 4, letterSpacing: '-0.01em' }}>{camp.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {camp.origin && (
                              <span style={{ padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 600, background: `${C.accent}12`, color: C.accent }}>{camp.origin}</span>
                            )}
                            <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(camp.created_at)}</span>
                            {camp.creatives_count > 0 && (
                              <span style={{ fontSize: 11, color: C.secondary }}>{camp.creatives_count} créa{camp.creatives_count > 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

            </div>
          </div>
        </div>
      </div>

      {/* ══ AD ENRICHMENT MODAL (nouveau) ══ */}
      {selectedAd && (
        <AdEnrichModal
          ad={selectedAd}
          C={C}
          darkMode={darkMode}
          inputStyle={inputStyle}
          labelStyle={labelStyle}
          onClose={() => setSelectedAd(null)}
          onSaved={async () => {
            await fetchActiveAds();
            setSelectedAd(null);
          }}
        />
      )}

      {/* ══ CREATE/EDIT CAMPAIGN MODAL (legacy) ══ */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'modalOverlayIn 0.2s ease both' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateModal(false); resetForm(); } }}>
          <div style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', background: C.bg, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: '28px', animation: 'modalCardIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>{editingCampaign ? 'Modifier la campagne' : 'Nouvelle campagne'}</h2>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Title */}
              <div>
                <label style={labelStyle}>Titre *</label>
                <input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Nom de la campagne" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border} />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Objectifs, angle, message..." rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }}
                  onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border} />
              </div>

              {/* Origin + Status row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Origine / Niche</label>
                  <select value={form.origin} onChange={(e) => setForm(p => ({ ...p, origin: e.target.value }))} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: 30, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                    <option value="">Sélectionner...</option>
                    {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Statut</label>
                  <select value={form.status} onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', paddingRight: 30, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                  </select>
                </div>
              </div>

              {/* Cover image upload */}
              <div>
                <label style={labelStyle}>Image de couverture</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = C.accent; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = C.border; const f = e.dataTransfer.files[0]; if (f) handleCoverUpload(f); }}
                  onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = (e) => { if (e.target.files[0]) handleCoverUpload(e.target.files[0]); }; inp.click(); }}
                  style={{
                    border: `2px dashed ${C.border}`, borderRadius: 12, padding: form.cover_image_url ? 0 : '24px 16px',
                    textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s', overflow: 'hidden',
                    background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  }}
                >
                  {form.cover_image_url ? (
                    <img src={mediaUrl(form.cover_image_url)} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                  ) : uploading ? (
                    <p style={{ color: C.accent, fontSize: 12, fontWeight: 600, margin: 0 }}>Upload en cours...</p>
                  ) : (
                    <>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ marginBottom: 6, opacity: 0.5 }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>Glissez une image ou cliquez pour uploader</p>
                    </>
                  )}
                </div>
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 12, margin: 0, fontWeight: 500 }}>{error}</p>}

              <button onClick={handleSave} disabled={saving} style={{
                width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                background: saving ? C.muted : (darkMode ? '#fff' : '#1e2330'),
                color: saving ? '#fff' : (darkMode ? '#1e2330' : '#fff'),
                fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s', marginTop: 4,
              }}>{saving ? 'Enregistrement...' : (editingCampaign ? 'Enregistrer' : 'Créer la campagne')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CAMPAIGN DETAIL MODAL (legacy) ══ */}
      {selectedCampaign && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'modalOverlayIn 0.2s ease both' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setSelectedCampaign(null); resetCreativeForm(); } }}>
          <div style={{ width: '100%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', background: C.bg, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.3)', animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both', display: 'flex', flexDirection: 'column' }}>

            {/* Cover */}
            <div style={{ height: 200, position: 'relative', overflow: 'hidden', flexShrink: 0, borderRadius: '16px 16px 0 0' }}>
              {selectedCampaign.cover_image_url ? (
                <img src={mediaUrl(selectedCampaign.cover_image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: darkMode ? '#16171e' : '#f0f1f4' }} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.5) 100%)' }} />
              <button onClick={() => { setSelectedCampaign(null); resetCreativeForm(); }} style={{
                position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 24px', background: darkMode ? 'rgba(30,31,40,0.6)' : 'rgba(255,255,255,0.5)', backdropFilter: 'blur(16px)' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: darkMode ? '#eef0f6' : '#1e2330' }}>{selectedCampaign.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <StatusBadge status={selectedCampaign.status} />
                  {selectedCampaign.origin && <span style={{ padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 600, background: `${C.accent}12`, color: C.accent }}>{selectedCampaign.origin}</span>}
                  <span style={{ fontSize: 11, color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}>{fmtDate(selectedCampaign.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '24px', flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <button onClick={() => openEdit(selectedCampaign)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Modifier
                </button>
                {selectedCampaign.status === 'active' && (
                  <button onClick={() => handleStatusChange(selectedCampaign.id, 'paused')} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid #fb923c40`, background: '#fb923c12', color: '#fb923c', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Mettre en pause</button>
                )}
                {selectedCampaign.status === 'paused' && (
                  <button onClick={() => handleStatusChange(selectedCampaign.id, 'active')} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid #10b98140`, background: '#10b98112', color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reprendre</button>
                )}
                <button onClick={() => handleDelete(selectedCampaign.id)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid #ef444440`, background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>Supprimer</button>
              </div>

              {selectedCampaign.description && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Description</div>
                  <p style={{ fontSize: 13.5, color: C.secondary, lineHeight: 1.6, margin: 0 }}>{selectedCampaign.description}</p>
                </div>
              )}

              <div style={{ height: 1, background: C.border, margin: '0 0 20px' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Créas ({(selectedCampaign.creatives || []).length})</div>
                <button onClick={() => { resetCreativeForm(); setShowCreativeForm(true); }} style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                }}>+ Ajouter</button>
              </div>

              {showCreativeForm && (
                <div style={{ padding: '16px', borderRadius: 12, border: `1px solid ${C.border}`, background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Titre *</label>
                      <input value={creativeForm.title} onChange={(e) => setCreativeForm(p => ({ ...p, title: e.target.value }))} placeholder="Nom de la créa" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Statut</label>
                      <select value={creativeForm.status} onChange={(e) => setCreativeForm(p => ({ ...p, status: e.target.value }))} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Description</label>
                    <input value={creativeForm.description} onChange={(e) => setCreativeForm(p => ({ ...p, description: e.target.value }))} placeholder="Description de la créa" style={inputStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Image</label>
                      <div onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = (e) => { if (e.target.files[0]) handleCreativeUpload(e.target.files[0], 'image'); }; inp.click(); }}
                        style={{ border: `1.5px dashed ${C.border}`, borderRadius: 8, padding: creativeForm.image_url ? 0 : '12px', textAlign: 'center', cursor: 'pointer', overflow: 'hidden', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {creativeForm.image_url ? <img src={mediaUrl(creativeForm.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: C.muted }}>{creativeUploading ? 'Upload...' : '+ Image'}</span>}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Vidéo</label>
                      <div onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*'; inp.onchange = (e) => { if (e.target.files[0]) handleCreativeUpload(e.target.files[0], 'video'); }; inp.click(); }}
                        style={{ border: `1.5px dashed ${C.border}`, borderRadius: 8, padding: '12px', textAlign: 'center', cursor: 'pointer', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, color: creativeForm.video_url ? '#10b981' : C.muted }}>{creativeForm.video_url ? '✓ Vidéo uploadée' : (creativeUploading ? 'Upload...' : '+ Vidéo')}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={resetCreativeForm} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.secondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                    <button onClick={handleCreativeSave} disabled={saving} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? '...' : (editingCreative ? 'Enregistrer' : 'Ajouter')}</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(selectedCampaign.creatives || []).filter(c => c.status !== 'deleted').map(crea => (
                  <div key={crea.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: darkMode ? 'rgba(255,255,255,0.02)' : '#fafbfd' }}>
                    <div style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: darkMode ? '#16171e' : '#f0f1f4' }}>
                      {crea.image_url ? <img src={mediaUrl(crea.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ opacity: 0.4 }}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{crea.title}</div>
                      {crea.description && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{crea.description}</div>}
                    </div>
                    <StatusBadge status={crea.status} small />
                    {crea.video_url && <span style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>vid</span>}
                    <button onClick={(e) => { e.stopPropagation(); setCreativeForm({ title: crea.title || '', description: crea.description || '', image_url: crea.image_url || '', video_url: crea.video_url || '', status: crea.status || 'active' }); setEditingCreative(crea); setShowCreativeForm(true); }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleCreativeDelete(crea.id); }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid #ef444430`, background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>
                ))}
                {(selectedCampaign.creatives || []).filter(c => c.status !== 'deleted').length === 0 && !showCreativeForm && (
                  <div style={{ textAlign: 'center', padding: '24px 16px', borderRadius: 10, border: `1.5px dashed ${C.border}` }}>
                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Aucune créa pour cette campagne</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AdCard — carte ad_name (onglet "En cours")
// ═══════════════════════════════════════════════════════════════════════════════
function AdCard({ ad, index, C, darkMode, onClick }) {
  const enriched = !!(ad.campaign && ad.campaign.creative);
  const creative = ad.campaign?.creative;
  // Priorité affichage : image thumbnail > poster vidéo thumb > placeholder
  const thumb = creative?.image_thumbnail_url || creative?.video_thumbnail_url || null;
  const hasVideoOnly = !creative?.image_thumbnail_url && !!creative?.video_thumbnail_url;

  return (
    <div onClick={onClick} style={{
      borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', cursor: 'pointer',
      background: C.bg, transition: 'all 0.2s ease',
      animation: `cardIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${index * 60}ms both`,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = darkMode ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Visuel */}
      <div style={{ height: 160, background: darkMode ? '#16171e' : '#f0f1f4', overflow: 'hidden', position: 'relative' }}>
        {thumb ? (
          <>
            <img src={mediaUrl(thumb)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {hasVideoOnly && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.18)',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#1e2330"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ opacity: 0.4 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
            </svg>
            <span style={{ fontSize: 10, color: C.muted, fontWeight: 500, opacity: 0.7 }}>Pas encore enrichie</span>
          </div>
        )}
        {/* Badge état enrichissement */}
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          {enriched ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
              borderRadius: 50, fontSize: 10, fontWeight: 600,
              background: '#10b981e8', color: '#fff', backdropFilter: 'blur(8px)',
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              Enrichi
            </span>
          ) : (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
              borderRadius: 50, fontSize: 10, fontWeight: 600,
              background: '#fb923ce8', color: '#fff', backdropFilter: 'blur(8px)',
            }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              À enrichir
            </span>
          )}
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 15, fontWeight: 650, color: C.text, marginBottom: 6, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ad.ad_name}>
          {ad.ad_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 600,
            background: `${C.accent}12`, color: C.accent,
          }}>
            {ad.lead_count} lead{ad.lead_count > 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: C.muted }}>
            Dernier : {fmtRelative(ad.last_lead_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AdEnrichModal — modal d'enrichissement d'une pub par ad_name
// ═══════════════════════════════════════════════════════════════════════════════
function AdEnrichModal({ ad, C, darkMode, inputStyle, labelStyle, onClose, onSaved }) {
  const existing = ad.campaign?.creative || null;
  const isEdit = !!ad.campaign;

  const [description, setDescription] = useState(existing?.description || ad.campaign?.description || '');
  // Médias upload state
  const [imageData, setImageData] = useState(
    existing?.image_url
      ? { url: existing.image_url, thumbnail_url: existing.image_thumbnail_url, width: null, height: null, size_bytes: null, persisted: true }
      : null
  );
  const [videoData, setVideoData] = useState(
    existing?.video_url
      ? {
          url: existing.video_url,
          thumbnail_url: existing.video_thumbnail_url,
          poster_url: null,
          duration_seconds: null,
          width: null, height: null, size_bytes: null,
          persisted: true,
        }
      : null
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [imageError, setImageError] = useState('');
  const [videoError, setVideoError] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Upload handlers (utilisent les NOUVEAUX endpoints optimisés) ──────
  const onPickImage = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/jpeg,image/png,image/webp,image/gif';
    inp.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setImageError('');
      setUploadingImage(true);
      try {
        const resp = await apiClient.uploadFile('/api/v1/uploads/campaign-image', f);
        setImageData({ ...resp, persisted: false });
      } catch (err) {
        if (err.status === 413) setImageError('Image trop lourde, maximum 10 MB.');
        else if (err.status === 400) setImageError(err.message || 'Format invalide. Utilisez JPEG, PNG, WebP ou GIF.');
        else setImageError(err.message || "Échec de l'upload de l'image.");
      } finally {
        setUploadingImage(false);
      }
    };
    inp.click();
  };

  const onPickVideo = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'video/mp4,video/quicktime,video/webm,video/x-msvideo';
    inp.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setVideoError('');
      setUploadingVideo(true);
      try {
        const resp = await apiClient.uploadFile('/api/v1/uploads/campaign-video', f);
        setVideoData({ ...resp, persisted: false });
      } catch (err) {
        if (err.status === 413) setVideoError('Vidéo trop lourde, maximum 50 MB.');
        else if (err.status === 400) setVideoError(err.message || 'Vidéo invalide (format non supporté ou durée > 60s).');
        else setVideoError(err.message || "Échec de l'upload de la vidéo.");
      } finally {
        setUploadingVideo(false);
      }
    };
    inp.click();
  };

  const removeImage = () => { setImageData(null); setImageError(''); };
  const removeVideo = () => { setVideoData(null); setVideoError(''); };

  const handleSave = async () => {
    setSaveError('');
    if (!description.trim()) {
      setSaveError('La description est requise.');
      return;
    }
    setSaving(true);
    try {
      // Build payload — on n'envoie QUE les médias présents dans l'UI.
      // Si l'utilisateur a retiré explicitement un média en édition, on
      // doit l'effacer côté backend ; mais le contrat dit "upsert non
      // destructif" → omettre = ne pas effacer. Pour l'instant, on
      // n'envoie que ce qui est présent (cohérent avec le UX "ajouter
      // ou remplacer", pas "effacer").
      const payload = {
        ad_name: ad.ad_name,
        description: description.trim(),
      };
      if (imageData) {
        payload.image_url = imageData.url;
        payload.image_thumbnail_url = imageData.thumbnail_url;
      }
      if (videoData) {
        payload.video_url = videoData.url;
        payload.video_thumbnail_url = videoData.thumbnail_url;
      }
      await apiClient.post('/api/v1/campaigns/by-ad-name', payload);
      await onSaved();
    } catch (err) {
      setSaveError(err.message || 'Erreur lors de la sauvegarde.');
      setSaving(false);
    }
  };

  // Lock body scroll pendant le modal
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'modalOverlayIn 0.2s ease both', padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto',
        background: C.bg, borderRadius: 16, border: `1px solid ${C.border}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)', padding: '28px',
        animation: 'modalCardIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {isEdit ? 'Modifier la pub' : 'Enrichir la pub'}
            </div>
            <h2 style={{
              margin: 0, fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: '-0.02em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={ad.ad_name}>{ad.ad_name}</h2>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: C.secondary }}>
              <span>{ad.lead_count} lead{ad.lead_count > 1 ? 's' : ''}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.muted }} />
              <span>Dernier : {fmtRelative(ad.last_lead_at)}</span>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} style={{
            width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.muted, cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
          }}>×</button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Description (REQUIS) */}
          <div>
            <label style={labelStyle}>Texte de la pub <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Le texte exact de la pub diffusée sur Meta Ads (forcé, requis)..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 90, lineHeight: 1.5 }}
              onFocus={(e) => e.target.style.borderColor = C.accent}
              onBlur={(e) => e.target.style.borderColor = C.border}
            />
          </div>

          {/* Médias : grid 2 colonnes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* IMAGE */}
            <MediaUploadCard
              C={C}
              darkMode={darkMode}
              labelStyle={labelStyle}
              kind="image"
              data={imageData}
              uploading={uploadingImage}
              error={imageError}
              onPick={onPickImage}
              onRemove={removeImage}
            />

            {/* VIDEO */}
            <MediaUploadCard
              C={C}
              darkMode={darkMode}
              labelStyle={labelStyle}
              kind="video"
              data={videoData}
              uploading={uploadingVideo}
              error={videoError}
              onPick={onPickVideo}
              onRemove={removeVideo}
            />

          </div>

          {/* Note vidéo */}
          <p style={{
            margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.5,
            padding: '10px 12px', borderRadius: 8,
            background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
            border: `1px solid ${C.border}`,
          }}>
            Image (max 10 MB, recompressée WebP) et vidéo (max 50 MB, ≤ 60s, transcodée H.264 1080p).
            La vidéo est optionnelle. Le transcodage peut prendre 30 à 60s.
          </p>

          {/* Save error */}
          {saveError && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: '#ef444412', color: '#ef4444', border: '1px solid #ef444430',
            }}>{saveError}</div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.secondary, fontSize: 13, fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >Annuler</button>
            <button
              onClick={handleSave}
              disabled={saving || !description.trim() || uploadingImage || uploadingVideo}
              style={{
                padding: '10px 22px', borderRadius: 10, border: 'none',
                background: (saving || !description.trim() || uploadingImage || uploadingVideo)
                  ? C.muted
                  : (darkMode ? '#fff' : '#1e2330'),
                color: (saving || !description.trim() || uploadingImage || uploadingVideo)
                  ? '#fff'
                  : (darkMode ? '#1e2330' : '#fff'),
                fontSize: 13, fontWeight: 600,
                cursor: (saving || !description.trim() || uploadingImage || uploadingVideo) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all 0.15s',
              }}
            >
              {saving && (
                <span style={{
                  width: 12, height: 12, borderRadius: '50%',
                  border: '2px solid currentColor', borderTopColor: 'transparent',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block',
                }} />
              )}
              {saving ? 'Enregistrement...' : (isEdit ? 'Enregistrer' : 'Enrichir la pub')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MediaUploadCard — sous-composant upload (image OU vidéo) avec preview
// ═══════════════════════════════════════════════════════════════════════════════
function MediaUploadCard({ C, darkMode, labelStyle, kind, data, uploading, error, onPick, onRemove }) {
  const isVideo = kind === 'video';
  const label = isVideo ? 'Vidéo (optionnel)' : 'Image';
  const previewUrl = data?.thumbnail_url ? mediaUrl(data.thumbnail_url) : null;

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div
        onClick={!uploading && !data ? onPick : undefined}
        style={{
          position: 'relative', borderRadius: 12,
          border: `2px dashed ${error ? '#ef4444' : C.border}`,
          background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          height: 180, overflow: 'hidden',
          cursor: !uploading && !data ? 'pointer' : 'default',
          transition: 'border-color 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={(e) => { if (!data && !uploading) e.currentTarget.style.borderColor = C.accent; }}
        onMouseLeave={(e) => { if (!data && !uploading) e.currentTarget.style.borderColor = error ? '#ef4444' : C.border; }}
      >
        {uploading ? (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `3px solid ${C.border}`, borderTopColor: C.accent,
              animation: 'spin 0.7s linear infinite', margin: '0 auto 8px',
            }} />
            <p style={{ margin: 0, fontSize: 11, color: C.accent, fontWeight: 600 }}>
              {isVideo ? 'Transcodage...' : 'Upload...'}
            </p>
            {isVideo && (
              <p style={{ margin: '4px 0 0', fontSize: 10, color: C.muted }}>
                Peut prendre 30 à 60s
              </p>
            )}
          </div>
        ) : data && previewUrl ? (
          <>
            <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {isVideo && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.18)', pointerEvents: 'none',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#1e2330"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
              </div>
            )}
            {/* Overlay actions */}
            <div style={{
              position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6,
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); onPick(); }}
                title="Remplacer"
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                title="Retirer"
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ marginBottom: 6, opacity: 0.5 }}>
              {isVideo ? (
                <>
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </>
              ) : (
                <>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </>
              )}
            </svg>
            <p style={{ margin: 0, fontSize: 11, color: C.muted, fontWeight: 500 }}>
              {isVideo ? 'Cliquer pour ajouter' : 'Cliquer pour uploader'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: C.muted, opacity: 0.7 }}>
              {isVideo ? 'MP4/MOV/WEBM ≤ 50 MB, ≤ 60s' : 'JPEG/PNG/WebP ≤ 10 MB'}
            </p>
          </div>
        )}
      </div>

      {/* Métadonnées post-upload */}
      {data && !uploading && !data.persisted && (
        <p style={{ margin: '6px 0 0', fontSize: 10, color: C.secondary, fontWeight: 500 }}>
          {data.width && data.height ? `${data.width}×${data.height}` : ''}
          {data.size_bytes ? ` · ${fmtSize(data.size_bytes)}` : ''}
          {isVideo && data.duration_seconds ? ` · ${data.duration_seconds.toFixed(1)}s` : ''}
        </p>
      )}
      {data?.persisted && !uploading && (
        <p style={{ margin: '6px 0 0', fontSize: 10, color: C.secondary, fontWeight: 500 }}>
          Média existant — cliquez sur l'icône ↻ pour remplacer.
        </p>
      )}

      {/* Erreur */}
      {error && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ef4444', fontWeight: 500 }}>
          {error}
        </p>
      )}
    </div>
  );
}
