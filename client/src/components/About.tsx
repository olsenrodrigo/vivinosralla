import { motion } from "framer-motion";
import { Award, BookOpen, GraduationCap, Briefcase, IdCard, Building2 } from "lucide-react";

/*
 * WHITELABEL: Personalizar
 * - Nome e titulo do medico
 * - Biografia completa
 * - Lista de credenciais
 * - Foto do profissional
 * - Indicadores numericos
 * - Frase de posicionamento
 * - Cores: #5B8C9B (primary), #2C3E50 (secondary), #EDF2F4 (muted)
 */

export default function About() {
  /* WHITELABEL: Credenciais do profissional */
  const credentials = [
    { icon: Briefcase, text: "X anos de experiencia medica" },
    { icon: Award, text: "Titulo de Especialista em [area]" },
    { icon: BookOpen, text: "Subespecializacao em [area]" },
    { icon: GraduationCap, text: "Formado(a) pela [universidade]" },
    { icon: Building2, text: "Atendimento em centros de referencia" },
    { icon: IdCard, text: "CRM XXXXXX/UF" },
  ];

  return (
    <section id="about" className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-block px-4 py-2 rounded-full mb-6" style={{ backgroundColor: "#EDF2F4" }}>
              <span className="text-sm font-medium" style={{ color: "#5B8C9B" }}>Sobre o(a) Especialista</span>
            </div>

            {/* WHITELABEL: Nome do profissional */}
            <h3 className="text-4xl md:text-5xl font-bold mb-2" style={{ color: "#212529" }}>
              Dr(a). Nome Sobrenome
            </h3>

            <p className="text-lg mb-6 font-medium" style={{ color: "#5B8C9B" }}>
              {/* WHITELABEL: Subtitulo */}
              Medicina com proposito, tecnica e humanidade
            </p>

            {/* WHITELABEL: Paragrafos de biografia */}
            <p className="text-lg mb-4 leading-relaxed" style={{ color: "#3C3C3C" }}>
              <strong>Dr(a). Nome Sobrenome</strong> e medico(a) especialista em <strong>[especialidade]</strong>,
              com solida formacao academica e atuacao focada em um cuidado responsavel, atualizado e individualizado.
            </p>

            <p className="text-lg mb-4 leading-relaxed" style={{ color: "#3C3C3C" }}>
              Formado(a) pela <strong>[universidade]</strong>, realizou residencia medica em <strong>[especialidade]</strong>
              e subespecializacao em <strong>[area]</strong>. Possui ampla experiencia clinica e cirurgica.
            </p>

            <p className="text-lg mb-8 leading-relaxed" style={{ color: "#3C3C3C" }}>
              Com <strong>X anos de atuacao</strong>, trabalha com atencao as particularidades de cada caso,
              priorizando o dialogo, a clareza das informacoes e a tomada de decisao compartilhada com o paciente.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 mt-8">
              {credentials.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06 }}
                  className="flex items-center gap-3 rounded-xl p-3 border"
                  style={{ borderColor: "rgba(91, 140, 155, 0.15)", backgroundColor: "rgba(237, 242, 244, 0.4)" }}
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EDF2F4" }}>
                    <item.icon className="w-4 h-4" style={{ color: "#5B8C9B" }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "#212529" }}>{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative flex justify-center"
          >
            {/* WHITELABEL: Substituir por foto do profissional */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl max-w-sm">
              <div
                className="w-full h-[550px] flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #EDF2F4 0%, #5B8C9B 100%)" }}
              >
                <div className="text-center text-white p-8">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-white/20 flex items-center justify-center">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium opacity-80">Foto do(a) Profissional</p>
                  <p className="text-sm opacity-60 mt-2">Substituir por foto profissional</p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 w-56 h-56 rounded-3xl -z-10" style={{ backgroundColor: "rgba(91, 140, 155, 0.1)" }} />
            <div className="absolute -top-6 -left-6 w-40 h-40 rounded-full -z-10" style={{ backgroundColor: "rgba(91, 140, 155, 0.1)" }} />
          </motion.div>
        </div>

        {/* WHITELABEL: Indicadores numericos */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 pt-16 border-t"
          style={{ borderColor: "rgba(91, 140, 155, 0.2)" }}
        >
          {[
            { value: "X anos", label: "de experiencia na especialidade" },
            { value: "N especializacoes", label: "Area 1, Area 2, Area 3" },
            { value: "Formacao", label: "Universidade de referencia" },
          ].map((item, index) => (
            <div key={index} className="text-center">
              <div className="text-2xl md:text-3xl font-bold mb-2" style={{ color: "#2C3E50" }}>{item.value}</div>
              <div className="text-base" style={{ color: "#3C3C3C" }}>{item.label}</div>
            </div>
          ))}
        </motion.div>

        {/* WHITELABEL: Frase de posicionamento */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 text-center"
        >
          <blockquote className="text-3xl md:text-4xl font-bold italic max-w-3xl mx-auto mb-8" style={{ color: "#2C3E50" }}>
            "Frase de posicionamento do profissional aqui."
          </blockquote>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
            className="px-8 py-4 text-white rounded-full font-medium hover:shadow-xl transition-all cursor-pointer"
            style={{ background: "#5B8C9B" }}
          >
            Agendar minha consulta
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}