// Preserve the verified person's identity and capacity, including holding links.
export function ndaRepresentatives(data) {
  return (data.representatives || []).map(r => ({
    fullName: (r.full_name || '').trim(),
    ...(r.first_name && r.last_name ? { firstName: r.first_name, lastName: r.last_name } : {}),
    role: (r.role || 'Gérant').trim(),
  })).filter(r => r.fullName);
}

export const emptyRepresentative = () => ({ fullName: '', role: 'Représentant habilité' });
