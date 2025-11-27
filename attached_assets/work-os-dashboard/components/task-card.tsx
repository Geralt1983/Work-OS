"use client"

import { motion } from "framer-motion"
import { CheckCircle2 } from "lucide-react"

interface TaskCardProps {
  task: {
    id: string
    title: string
    description: string
    priority: "high" | "medium" | "low"
    dueDate: string
  }
  color: "purple" | "cyan" | "slate"
  onComplete: () => void
}

const colorConfig = {
  purple: {
    glowColor: "shadow-purple-500/30",
    accentColor: "bg-purple-500/20 border-purple-500/50",
  },
  cyan: {
    glowColor: "shadow-cyan-500/30",
    accentColor: "bg-cyan-500/20 border-cyan-500/50",
  },
  slate: {
    glowColor: "shadow-slate-500/30",
    accentColor: "bg-slate-500/20 border-slate-500/50",
  },
}

const priorityConfig = {
  high: { label: "High", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  medium: { label: "Medium", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  low: { label: "Low", color: "bg-green-500/20 text-green-300 border-green-500/30" },
}

export function TaskCard({ task, color, onComplete }: TaskCardProps) {
  const colorCfg = colorConfig[color]
  const priorityCfg = priorityConfig[task.priority]

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`group relative p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all cursor-grab active:cursor-grabbing hover:${colorCfg.glowColor} shadow-lg`}
    >
      {/* Inner white glow */}
      <motion.div
        whileHover={{ opacity: 1 }}
        initial={{ opacity: 0 }}
        className="absolute inset-0 rounded-2xl border border-white/5 opacity-0 transition-opacity pointer-events-none"
      />

      {/* Colored accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${colorCfg.accentColor}`} />

      <div className="relative z-10">
        {/* Header with ID */}
        <div className="flex items-start justify-between mb-3">
          <p className="font-mono text-xs font-bold text-slate-400 tracking-wider">{task.id}</p>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onComplete}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-green-500/20 text-green-400"
          >
            <CheckCircle2 size={18} />
          </motion.button>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-white mb-1 line-clamp-2 text-sm leading-tight">{task.title}</h3>

        {/* Description */}
        <p className="text-xs text-slate-400 mb-4 line-clamp-2">{task.description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg border text-xs font-medium ${priorityCfg.color}`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-current" />
            {priorityCfg.label}
          </motion.div>

          <span className="text-xs text-slate-500">{task.dueDate}</span>
        </div>
      </div>

      {/* Hover glow effect */}
      <motion.div
        whileHover={{ opacity: 0.1 }}
        initial={{ opacity: 0 }}
        className={`absolute inset-0 rounded-2xl blur-xl ${colorCfg.glowColor.replace("shadow-", "bg-")}`}
        style={{ pointerEvents: "none" }}
      />
    </motion.div>
  )
}
