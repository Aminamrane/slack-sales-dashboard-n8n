// src/components/sequenceMail/themeContext.js
//
// Thème (`light` | `dark`) du mini client, transmis aux parties rendues sous <body> (fenêtres
// flottantes, fantôme de glisser-déposer) qui ne sont pas dans l'arbre DOM du composant.

import { createContext, useContext } from 'react';

export const ThemeContext = createContext('light');

/** @brief Classe CSS qui porte les variables de couleur du thème courant. */
export const useThemeClass = () => `smx-theme-${useContext(ThemeContext)}`;
