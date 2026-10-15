// src/components/sequenceMail/themeContext.js
//
// Thème (`light` | `dark`) du mini client, transmis aux parties rendues sous <body> (fenêtres
// flottantes, fantôme de glisser-déposer) qui ne sont pas dans l'arbre DOM du composant.

import { createContext, useContext } from 'react';

export const ThemeContext = createContext('light');

/**
 * @brief Classes CSS qui portent les variables de couleur du thème courant, plus `smx-beige` : le fond beige à points et les
 * cases de sélection de la Gestion de séquence (cf. beigeStyles.js). L'Éditeur de mail n'utilise pas ce hook : il garde son apparence.
 */
export const useThemeClass = () => `smx-theme-${useContext(ThemeContext)} smx-beige`;
