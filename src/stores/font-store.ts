// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { create } from 'zustand';
import type { FontInfo } from '../lib/types';
import { psdEngine } from '../lib/psd-engine';
import { qtRenderer } from '../lib/qt-renderer';
import { usePsdStore } from './psd-store';

interface FontState {
  fonts: FontInfo[];
  loading: boolean;
  error: string | null;
}

interface FontActions {
  registerFont: (file: File) => Promise<void>;
  clearError: () => void;
}

export const useFontStore = create<FontState & FontActions>((set) => ({
  fonts: [],
  loading: false,
  error: null,

  registerFont: async (file) => {
    set({ loading: true, error: null });
    document.body.style.cursor = 'wait';

    try {
      const data = await file.arrayBuffer();
      const result = await psdEngine.registerFont(data, file.name);

      const fontInfo: FontInfo = {
        fontId: result.fontId,
        families: result.families,
        fileName: file.name
      };

      console.log('[FontStore] Registered font families:', result.families);

      set(state => ({
        fonts: [...state.fonts, fontInfo],
        loading: false
      }));

      // Invalidate Qt renderer's cached parses so they will be re-parsed with new fonts
      console.log('[FontStore] Font registered, invalidating Qt renderer cache');
      qtRenderer.invalidateForFonts();

      // Trigger recomposite for loaded PSDs to use new fonts
      const psdState = usePsdStore.getState();
      console.log('[FontStore] Triggering recomposite, psdA:', !!psdState.psdA, 'psdB:', !!psdState.psdB, 'renderMode:', psdState.renderMode);
      if (psdState.psdA || psdState.psdB) {
        const tasks: Promise<void>[] = [];
        if (psdState.psdA) {
          tasks.push(psdState.recomposite('A'));
        }
        if (psdState.psdB) {
          tasks.push(psdState.recomposite('B'));
        }
        await Promise.all(tasks);
        console.log('[FontStore] Recomposite complete');
      }
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to register font'
      });
    } finally {
      document.body.style.cursor = '';
    }
  },

  clearError: () => set({ error: null })
}));
