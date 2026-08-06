import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

const languages = [
  {
    code: "pt",
    path: "/",
    label: "Português",
    flag: (
      <svg width="24" height="16" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <rect width="256" height="480" fill="#009c3b" />
        <rect x="256" width="384" height="480" fill="#FEDD00" />
        <polygon points="320,60 580,240 320,420 60,240" fill="#FEDD00" />
        <polygon points="320,60 580,240 320,420 60,240" fill="#FEDD00" />
        <circle cx="320" cy="240" r="100" fill="#002776" />
        <path
          d="M220,240 Q320,190 420,240"
          stroke="white"
          strokeWidth="28"
          fill="none"
        />
      </svg>
    ),
  },
  {
    code: "en",
    path: "/en",
    label: "English",
    flag: (
      <svg width="24" height="16" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="480" fill="#012169" />
        <path d="M0,0 L640,480 M640,0 L0,480" stroke="white" strokeWidth="60" />
        <path d="M0,0 L640,480 M640,0 L0,480" stroke="#C8102E" strokeWidth="40" />
        <path d="M320,0 V480 M0,240 H640" stroke="white" strokeWidth="100" />
        <path d="M320,0 V480 M0,240 H640" stroke="#C8102E" strokeWidth="60" />
      </svg>
    ),
  },
  {
    code: "es",
    path: "/es",
    label: "Español",
    flag: (
      <svg width="24" height="16" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="480" fill="#c60b1e" />
        <rect y="120" width="640" height="240" fill="#ffc400" />
      </svg>
    ),
  },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const changeLanguage = (code: string, path: string) => {
    i18n.changeLanguage(code);
    setLocation(path);
    setIsOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:bg-gray-50 cursor-pointer"
        style={{ borderColor: "rgba(91, 140, 155, 0.3)" }}
        aria-label="Select language"
      >
        <span className="flex-shrink-0 rounded overflow-hidden shadow-sm">{currentLang.flag}</span>
        <span className="text-xs font-medium hidden sm:inline" style={{ color: "#494949" }}>
          {currentLang.code.toUpperCase()}
        </span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="#494949"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border overflow-hidden z-50"
            style={{ borderColor: "rgba(91, 140, 155, 0.2)", minWidth: "160px" }}
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code, lang.path)}
                className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 cursor-pointer"
                style={{
                  backgroundColor:
                    lang.code === i18n.language ? "rgba(91, 140, 155, 0.08)" : "transparent",
                }}
              >
                <span className="flex-shrink-0 rounded overflow-hidden shadow-sm">{lang.flag}</span>
                <span
                  className="text-sm font-medium"
                  style={{ color: lang.code === i18n.language ? "#5B8C9B" : "#494949" }}
                >
                  {lang.label}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
