import { motion } from "framer-motion";
import { Calendar, ArrowRight, User } from "lucide-react";

/*
 * WHITELABEL: Personalizar
 * - Titulo principal e highlight
 * - Nome e subtitulo do profissional
 * - Descricao
 * - Link do botao primario (WhatsApp ou contact scroll)
 * - Estatisticas (valor + label)
 * - Logo watermark: importar imagem e descomentar o bloco
 * - Cores: #5B8C9B (primary), #2C3E50 (secondary), #EDF2F4 (muted)
 */

interface HeroProps {
  scrollToSection?: (section: string) => void;
}

export default function Hero({ scrollToSection }: HeroProps) {
  const goTo = (id: string) => {
    if (scrollToSection) {
      scrollToSection(id);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div id="hero" className="relative min-h-screen flex items-center">

      {/* Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* WHITELABEL: Substituir gradiente por imagem de fundo se necessario */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #2C3E50 0%, #3D566E 40%, #5B8C9B 100%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(44,62,80,0.97) 0%, rgba(44,62,80,0.80) 55%, rgba(44,62,80,0.20) 100%)" }}
        />

        {/*
          WHITELABEL: Logo watermark — descomentar e importar o simbolo do logo
          import logoSimbolo from "../assets/images/logo-simbolo.png";

          <img
            src={logoSimbolo}
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "-4%",
              top: "50%",
              transform: "translateY(-50%)",
              width: "min(46vw, 480px)",
              opacity: 0.14,
              mixBlendMode: "screen",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        */}
      </div>

      {/* Conteudo */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-20 pb-8">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* WHITELABEL: Headline — max text-6xl para caber em MacBook 13" */}
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 leading-tight">
              Atendimento especializado com{" "}
              <span style={{ color: "#5B8C9B" }}>tecnica e cuidado</span>
            </h2>

            {/* WHITELABEL: Nome e titulo */}
            <p className="text-base sm:text-lg mb-2 font-semibold leading-snug" style={{ color: "#EDF2F4" }}>
              Dr(a). Nome — Especialidade Medica
            </p>

            {/* WHITELABEL: Descricao */}
            <p className="text-sm sm:text-base mb-6 leading-relaxed" style={{ color: "rgba(237,242,244,0.85)" }}>
              Profissional com ampla experiencia e formacao solida, dedicado(a) a oferecer um
              atendimento humanizado, baseado em evidencias cientificas e focado na qualidade
              de vida do paciente.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* WHITELABEL: Botao primario — substituir href pelo WhatsApp ou usar onClick */}
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => goTo("contact")}
                className="group px-7 py-3.5 text-white rounded-full font-medium flex items-center justify-center gap-2 hover:shadow-xl transition-all cursor-pointer text-sm sm:text-base"
                style={{ background: "#5B8C9B" }}
              >
                <Calendar size={18} />
                Agendar Consulta
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => goTo("about")}
                className="px-7 py-3.5 backdrop-blur-sm text-white rounded-full font-medium border-2 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-base"
                style={{ backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.25)" }}
              >
                <User size={18} />
                {/* WHITELABEL: Texto do botao secundario */}
                Conheca o(a) Especialista
              </motion.button>
            </div>
          </motion.div>

          {/* WHITELABEL: Indicadores numericos */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            {[
              { value: "10+", label: "Anos de Experiencia" },
              { value: "3", label: "Especializacoes" },
              { value: "USP", label: "Formacao Academica" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                {/* WHITELABEL: Usar a cor de destaque (não branco) para as stats contrastarem com o gradiente escuro */}
                <div className="text-2xl sm:text-3xl font-bold mb-0.5" style={{ color: "#5B8C9B" }}>{stat.value}</div>
                <div className="text-xs sm:text-sm" style={{ color: "rgba(237,242,244,0.8)" }}>{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

    </div>
  );
}
