import React from 'react';
import PickList from './PickList';

// Boutons de choix des fenêtres de qualification de la sheet (absent : relancer ou non ; reporté : date ou à reporter).
// Deux choix : la liste reste ouverte, l'explication du choix retenu toujours lisible.
export default function ChoiceButtons({ items, value, onPick, disabled }) {
  return <PickList items={items} value={value} onPick={onPick} disabled={disabled} fold={false} />;
}
