"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { translate } from "@/lib/i18n";
type Language = "ko" | "en";
const Context = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (text: string) => string;
  locale: string;
}>({ language: "ko", setLanguage: () => {}, t: (s) => s, locale: "ko-KR" });
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setValue] = useState<Language>("ko");
  useEffect(() => {
    try {
      if (localStorage.getItem("api-observatory-language") === "en")
        setValue("en");
    } catch {}
  }, []);
  const setLanguage = useCallback((value: Language) => {
    setValue(value);
    try {
      localStorage.setItem("api-observatory-language", value);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const t = useCallback(
    (text: string) => translate(text, language),
    [language],
  );
  return (
    <Context
      value={{
        language,
        setLanguage,
        t,
        locale: language === "ko" ? "ko-KR" : "en-US",
      }}
    >
      {children}
    </Context>
  );
}
export const useLanguage = () => useContext(Context);
