import { motion } from "framer-motion";
import { GraduationCap, Eye, Heart, Globe } from "lucide-react";

/*
 * WHITELABEL: Personalizar
 * - Titulo e subtitulo
 * - Cards de diferenciais (icone, titulo, descricao) — padrao 4 cards em 2 colunas
 * - Cores: #5B8C9B (primary), #2C3E50 (secondary), #EDF2F4 (muted)
 */

export default function Differentials() {
  /* WHITELABEL: Diferenciais do profissional */
  const differentials = [
    {
      icon: GraduationCap,
      title: "Formacao de excelencia",
      description: "Formacao academica solida em universidade de referencia, com especializacoes e atualizacao continua na area de atuacao.",
    },
    {
      icon: Eye,
      title: "Decisao com responsabilidade",
      description: "Cada indicacao e feita com criterio, evitando excessos e priorizando o que realmente e necessario para o paciente.",
    },
    {
      icon: Heart,
      title: "Cuidado individualizado e continuo",
      description: "Acompanhamento proximo em todas as etapas, da primeira consulta ao pos-operatorio ou seguimento de longo prazo.",
    },
    {
      icon: Globe,
      title: "Abordagem integrada da saude",
      description: "Visao que considera nao apenas a doenca, mas o paciente como um todo, incluindo habitos, estilo de vida e qualidade de vida.",
    },
  ];

  return (
    <section id="differentials" className="py-24" style={{ backgroundColor: "#EDF2F4" }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-block px-4 py-2 rounded-full mb-6" style={{ backgroundColor: "rgba(91, 140, 155, 0.15)" }}>
              <span className="text-sm font-medium" style={{ color: "#2C3E50" }}>Por que escolher</span>
            </div>

            <h3 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: "#212529" }}>
              {/* WHITELABEL: Titulo */}
              Diferenciais do Atendimento
            </h3>

            <p className="text-xl" style={{ color: "#3C3C3C" }}>
              {/* WHITELABEL: Subtitulo */}
              Um cuidado que vai alem do diagnostico.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {differentials.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-8 shadow-sm border"
                style={{ borderColor: "rgba(91, 140, 155, 0.15)" }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: "linear-gradient(135deg, #5B8C9B 0%, #2C3E50 100%)" }}
                >
                  <item.icon className="w-8 h-8 text-white" />
                </div>

                <h4 className="text-xl font-bold mb-4" style={{ color: "#212529" }}>
                  {item.title}
                </h4>

                <p className="leading-relaxed" style={{ color: "#3C3C3C" }}>
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}