"use client"

import { motion } from "framer-motion"
import { TaskCard } from "./task-card"

interface TaskColumnProps {
  title: string
  subtitle: string
  color: "purple" | "cyan" | "slate"
  tasks: Array<{
    id: string
    title: string
    description: string
    priority: "high" | "medium" | "low"
    dueDate: string
  }>
  onTaskComplete: (taskId: string) => void
}

const colorConfig = {
  purple: {
    gradient: "from-purple-500/20 to-purple-600/10",
    border: "border-purple-500/30 hover:border-purple-500/50",
    text: "text-purple-400",
    glow: "hover:shadow-lg hover:shadow-purple-500/50",
  },
  cyan: {
    gradient: "from-cyan-500/20 to-cyan-600/10",
    border: "border-cyan-500/30 hover:border-cyan-500/50",
    text: "text-cyan-400",
    glow: "hover:shadow-lg hover:shadow-cyan-500/50",
  },
  slate: {
    gradient: "from-slate-500/20 to-slate-600/10",
    border: "border-slate-500/30 hover:border-slate-500/50",
    text: "text-slate-400",
    glow: "hover:shadow-lg hover:shadow-slate-500/50",
  },
}

export function TaskColumn({ title, subtitle, color, tasks, onTaskComplete }: TaskColumnProps) {
  const config = colorConfig[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col"
    >
      {/* Column header */}
      <div className="mb-6">
        <h2 className={`text-lg font-bold ${config.text} tracking-tight`}>{title}</h2>
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      </div>

      {/* Tasks container */}
      <motion.div
        className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 custom-scrollbar"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.08,
            },
          },
        }}
      >
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            <TaskCard task={task} color={color} onComplete={() => onTaskComplete(task.id)} />
          </motion.div>
        ))}

        {tasks.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 text-slate-500">
            <p className="text-sm">No tasks in this column</p>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
