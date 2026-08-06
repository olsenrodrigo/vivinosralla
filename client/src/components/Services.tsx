import { motion } from "framer-motion";
import { CheckCircle2, Stethoscope } from "lucide-react";

/*
 * WHITELABEL: Personalizar
 * - Titulo da secao e descricao
 * - Lista de especialidades/servicos
 * - CTA text
 * - Cores: #5B8C9B (primary), #2C3E50 (secondary), #EDF2F4 (muted)
 */

export default function Services() {
  /* WHITELABEL: Lista de servicos oferecidos */
  const services = [
    "Servico ou especialidade 1",
    "Servico ou especialidade 2",
    "Servico ou especialidade 3",
    "Servico ou especialidade 4",
    "Servico ou especialidade 5",
    "Servico ou especialidade 6",
    "Servico ou especialidade 7",
    "Servico ou especialidade 8",
    "Servico ou especialidade 9",
  ];

  return (
    <section id="services" className="py-24" style={{ backgroundColor: "#EDF2F4" }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 rounded-full mb-6" style={{ backgroundColor: "rgba(91, 140, 155, 0.15)" }}>
            <span className="text-sm font-medium" style={{ color: "#2C3E50" }}>Especialidades</span>
          </div>

          <h3 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: "#212529" }}>
            {/* WHITELABEL: Titulo */}
            Especialidades e Servicos
          </h3>

          <p className="text-xl max-w-4xl mx-auto" style={{ color: "#3C3C3C" }}>
            {/* WHITELABEL: Descricao */}
            Atendimento completo com foco em diagnostico preciso, prevencao e qualidade de vida.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto mb-16">
          {services.map((service, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border"
              style={{ borderColor: "rgba(91, 140, 155, 0.15)" }}
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#5B8C9B" }} />
              <span className="font-medium" style={{ color: "#212529" }}>{service}</span>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl p-12 text-center text-white"
          style={{ background: "linear-gradient(135deg, #5B8C9B 0%, #2C3E50 100%)" }}
        >
          <h4 className="text-3xl font-bold mb-4 text-white">
            {/* WHITELABEL: CTA titulo */}
            Sua saude nao pode esperar
          </h4>
          <p className="text-xl mb-8 max-w-2xl mx-auto" style={{ color: "#EDF2F4" }}>
            {/* WHITELABEL: CTA descricao */}
            Atendimento particular com consultas dedicadas a entender profundamente o historico e orientar
            cada paciente com clareza.
          </p>
          <button
            className="px-8 py-4 bg-white rounded-full font-semibold hover:bg-opacity-90 transition-colors cursor-pointer"
            style={{ color: "#2C3E50" }}
            onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
          >
            Agendar Consulta
          </button>
        </motion.div>
      </div>
    </section>
  );
}