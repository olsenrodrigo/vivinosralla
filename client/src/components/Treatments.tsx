import { motion } from "framer-motion";
import { Stethoscope, Activity, AlertCircle, Scissors } from "lucide-react";

/*
 * WHITELABEL: Personalizar
 * - Titulo e descricao da secao
 * - Lista de tratamentos/procedimentos
 * - Icones adequados a especialidade
 * - Nota de rodape
 * - Cores: #5B8C9B (primary), #2C3E50 (secondary), #EDF2F4 (muted)
 */

export default function Treatments() {
  /* WHITELABEL: Lista de tratamentos */
  const treatments = [
    { icon: Stethoscope, text: "Tratamento ou procedimento 1" },
    { icon: Activity, text: "Tratamento ou procedimento 2" },
    { icon: Scissors, text: "Tratamento ou procedimento 3" },
    { icon: Stethoscope, text: "Tratamento ou procedimento 4" },
    { icon: Activity, text: "Tratamento ou procedimento 5" },
    { icon: Scissors, text: "Tratamento ou procedimento 6" },
  ];

  return (
    <section id="treatments" className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 rounded-full mb-6" style={{ backgroundColor: "#EDF2F4" }}>
            <span className="text-sm font-medium" style={{ color: "#5B8C9B" }}>Tratamentos</span>
          </div>

          <h3 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: "#212529" }}>
            Tratamentos e Procedimentos
          </h3>

          <p className="text-lg max-w-4xl mx-auto" style={{ color: "#3C3C3C" }}>
            Procedimentos realizados com tecnicas atualizadas, visando precisao e melhor recuperacao.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          {treatments.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="flex items-start gap-4 bg-white rounded-xl p-5 shadow-lg border hover:shadow-xl transition-all"
              style={{ borderColor: "rgba(91, 140, 155, 0.15)" }}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EDF2F4" }}>
                <item.icon className="w-5 h-5" style={{ color: "#5B8C9B" }} />
              </div>
              <span className="font-medium pt-2" style={{ color: "#212529" }}>{item.text}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-start gap-3 max-w-3xl mx-auto p-6 rounded-xl"
          style={{ backgroundColor: "rgba(91, 140, 155, 0.08)" }}
        >
          <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: "#5B8C9B" }} />
          <p className="text-base" style={{ color: "#3C3C3C" }}>
            {/* WHITELABEL: Nota */}
            A indicacao de tratamento e feita apos avaliacao medica criteriosa, sempre com decisao
            compartilhada e orientacao clara ao paciente.
          </p>
        </motion.div>
      </div>
    </section>
  );
}