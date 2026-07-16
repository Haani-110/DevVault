import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';

export function useTheme() {
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  return { theme, toggleTheme };
}
