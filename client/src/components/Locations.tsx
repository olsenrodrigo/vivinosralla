import { motion } from "framer-motion";
import { MapPin, Clock, Users, Shield } from "lucide-react";

/*
 * WHITELABEL: Personalizar
 * - Titulo e descricao
 * - Features do consultorio
 * - Endereco completo
 * - Embed do Google Maps
 * - Cores: #5B8C9B (primary), #2C3E50 (secondary), #EDF2F4 (muted)
 */

export default function Locations() {
  /* WHITELABEL: Caracteristicas do consultorio */
  const features = [
    {
      icon: Shield,
      text: "Ambiente acolhedor e confortavel",
    },
    {
      icon: Clock,
      text: "Consultas com tempo dedicado a cada paciente",
    },
    {
      icon: Users,
      text: "Equipe preparada para suporte em agendamentos",
    },
  ];

  return (
    <section id="locations" className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 rounded-full mb-6" style={{ backgroundColor: "rgba(91, 140, 155, 0.15)" }}>
            <span className="text-sm font-medium" style={{ color: "#2C3E50" }}>Consultorio</span>
          </div>

          <h3 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: "#212529" }}>
            Consultorio
          </h3>

          <p className="text-xl max-w-3xl mx-auto" style={{ color: "#3C3C3C" }}>
            Um espaco pensado para oferecer conforto, privacidade e tranquilidade.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="space-y-6">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-4 bg-white rounded-xl p-5 shadow-sm border"
                  style={{ borderColor: "rgba(91, 140, 155, 0.15)" }}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EDF2F4" }}>
                    <feature.icon className="w-5 h-5" style={{ color: "#5B8C9B" }} />
                  </div>
                  <span className="font-medium pt-2" style={{ color: "#212529" }}>{feature.text}</span>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-8 p-6 rounded-2xl border"
              style={{ borderColor: "rgba(91, 140, 155, 0.2)", backgroundColor: "rgba(237, 242, 244, 0.5)" }}
            >
              <div className="flex items-start gap-3 mb-4">
                <MapPin className="w-5 h-5 flex-shrink-0 mt-1" style={{ color: "#5B8C9B" }} />
                <div>
                  <p className="font-bold" style={{ color: "#212529" }}>Endereco</p>
                  {/* WHITELABEL: Endereco */}
                  <p style={{ color: "#3C3C3C" }}>
                    Rua Exemplo, 123<br />
                    Sala 456 — Bairro<br />
                    Cidade/UF
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl overflow-hidden shadow-lg border"
            style={{ borderColor: "rgba(91, 140, 155, 0.15)" }}
          >
            {/* WHITELABEL: Substituir embed do Google Maps */}
            <div
              className="w-full flex items-center justify-center"
              style={{ minHeight: "480px", backgroundColor: "#EDF2F4" }}
            >
              <div className="text-center p-8">
                <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: "#5B8C9B" }} />
                <p className="text-lg font-medium" style={{ color: "#2C3E50" }}>Google Maps</p>
                <p className="text-sm mt-2" style={{ color: "#3C3C3C" }}>Substituir pelo embed do mapa</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}