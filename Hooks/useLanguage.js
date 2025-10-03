import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = 'app_language';

export default function useLanguage(defaultLang = 'vi') {
  const [language, setLanguage] = useState(defaultLang);

  useEffect(() => {
    (async () => {
      try {
        const savedLang = await AsyncStorage.getItem(LANG_KEY);
        if (savedLang) setLanguage(savedLang);
      } catch {}
    })();
  }, []);

  return { language, setLanguage, LANG_KEY };
}
