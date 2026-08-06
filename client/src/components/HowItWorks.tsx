import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

/*
 * WHITELABEL: Personalizar
 * - Titulo e descricao da secao
 * - Topicos de conteudo educativo (titulo + descricao)
 * - Quantidade de cards
 * - Cores: #5B8C9B (primary), #2C3E50 (secondary), #EDF2F4 (muted)
 */

export default function HowItWorks() {
  /* WHITELABEL: Topicos de conteudo educativo */
  const topics = [
    {
      title: "Topico educativo 1",
      description: "Descricao breve sobre o tema, explicando ao paciente de forma acessivel e clara.",
    },
    {
      title: "Topico educativo 2",
      description: "Descricao breve sobre o tema, explicando ao paciente de forma acessivel e clara.",
    },
    {
      title: "Topico educativo 3",
      description: "Descricao breve sobre o tema, explicando ao paciente de forma acessivel e clara.",
    },
    {
      title: "Topico educativo 4",
      description: "Descricao breve sobre o tema, explicando ao paciente de forma acessivel e clara.",
    },
    {
      title: "Topico educativo 5",
      description: "Descricao breve sobre o tema, explicando ao paciente de forma acessivel e clara.",
    },
    {
      title: "Topico educativo 6",
      description: "Descricao breve sobre o tema, explicando ao paciente de forma acessivel e clara.",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 rounded-full mb-6" style={{ backgroundColor: "#EDF2F4" }}>
            <span className="text-sm font-medium" style={{ color: "#5B8C9B" }}>Conteudo Educativo</span>
          </div>

          <h3 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: "#212529" }}>
            O que voce precisa saber
          </h3>

          <p className="text-lg max-w-3xl mx-auto" style={{ color: "#3C3C3C" }}>
            Informacao de qualidade para cuidar melhor da sua saude.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {topics.map((topic, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-white rounded-2xl p-6 shadow-lg border hover:shadow-xl transition-all"
              style={{ borderColor: "rgba(91, 140, 155, 0.15)" }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ backgroundColor: "#EDF2F4" }}
              >
                <BookOpen className="w-5 h-5" style={{ color: "#5B8C9B" }} />
              </div>

              <h4 className="text-lg font-bold mb-3" style={{ color: "#212529" }}>
                {topic.title}
              </h4>

              <p className="text-sm leading-relaxed" style={{ color: "#3C3C3C" }}>
                {topic.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}